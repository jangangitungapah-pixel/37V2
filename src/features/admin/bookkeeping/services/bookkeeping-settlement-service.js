/**
 * Transactional Payable Settlement Service for Pembukuan.
 *
 * Supports partial & full settlement of Staff Commission, Recording Operator Fee,
 * and Unpaid Manual Expenses using strict Firestore optimistic transactions:
 * - Pre-generated stable `settlementId` (`operationId`)
 * - All reads before writes
 * - Idempotent retry return on matching `settlementId`
 * - Optimistic `version` & remaining-balance checks preventing concurrent overpayment
 * - Atomic append-only `bookkeepingSettlements/{settlementId}` + payable aggregate update
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import {
  BOOKKEEPING_ENTRY_TYPES,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SETTLEMENT_TYPES,
  BOOKKEEPING_SOURCE_MODULES,
  BOOKKEEPING_SOURCE_TYPES,
} from '../config/bookkeeping-config';
import { getBookkeepingRepositoryAdapter } from '../repositories/bookkeeping-repository';
import {
  derivePayableSettlementStatus,
  normalizeBookkeepingEntryRecord,
  normalizeBookkeepingSettlementRecord,
  validateSettlementInput,
} from '../schemas/bookkeeping-schema';
import { formatBookkeepingRupiah } from '../utils/bookkeeping-format';
import { resolveJakartaTimestampInput } from '../utils/bookkeeping-period';
import {
  assertActiveOwnerBookkeepingActor,
  createBookkeepingServiceError,
} from './bookkeeping-entry-service';

export async function settleBookkeepingEntry({
  entryId,
  settlementId = generateOperationId('bk_set'),
  expectedVersion,
  amount,
  paidDate,
  paymentMethod = 'transfer',
  referenceNumber = '',
  notes = '',
  actorUid,
  actorRole,
  adapter = getBookkeepingRepositoryAdapter(),
}) {
  const cleanUid = assertActiveOwnerBookkeepingActor(actorUid, actorRole);
  const cleanEntryId = String(entryId || '').trim();
  const cleanSettlementId = String(settlementId || '').trim() || generateOperationId('bk_set');

  if (!cleanEntryId) {
    throw createBookkeepingServiceError('bookkeeping/entry-not-found', 'ID kewajiban tidak valid.');
  }

  const validation = validateSettlementInput({
    amount,
    paidDate,
    paymentMethod,
    referenceNumber,
    notes,
  });

  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Data pelunasan belum lengkap.';
    throw createBookkeepingServiceError(
      'bookkeeping/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  const todayIso = getJakartaTodayIso();
  const validData = validation.data;

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingEntry, existingSettlement] = await Promise.all([
      tx.getBookkeepingEntry(cleanEntryId),
      tx.getBookkeepingSettlement(cleanSettlementId),
    ]);

    if (!existingEntry) {
      throw createBookkeepingServiceError(
        'bookkeeping/entry-not-found',
        'Kewajiban pembayaran tidak ditemukan di database.',
      );
    }

    // Strict Idempotency Replay Guard
    if (existingSettlement) {
      if (existingSettlement.entryId !== cleanEntryId) {
        throw createBookkeepingServiceError(
          'bookkeeping/duplicate-operation-id',
          'ID transaksi settlement sudah digunakan oleh kewajiban lain.',
        );
      }
      return {
        entry: existingEntry,
        settlement: existingSettlement,
        idempotentReplay: true,
      };
    }

    if (
      existingEntry.entryType !== BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL ||
      existingEntry.category === 'owner_allocation' ||
      existingEntry.category === 'owner' ||
      (existingEntry.sourceType !== BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH &&
        existingEntry.sourceType !== BOOKKEEPING_SOURCE_TYPES.MANUAL)
    ) {
      throw createBookkeepingServiceError(
        'bookkeeping/not-payable',
        'Catatan ini bukan kewajiban pengeluaran yang dapat dilunasi.',
      );
    }

    if (existingEntry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED) {
      throw createBookkeepingServiceError(
        'bookkeeping/entry-reversed',
        'Kewajiban ini telah dikoreksi (reversed) sehingga tidak dapat dibayar.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingEntry.version !== Number(expectedVersion)
    ) {
      throw createBookkeepingServiceError(
        'bookkeeping/stale-version',
        'Saldo kewajiban baru saja berubah di sesi lain. Muat ulang daftar lalu coba kembali.',
      );
    }

    if (existingEntry.remainingAmount <= 0) {
      throw createBookkeepingServiceError(
        'bookkeeping/already-settled',
        'Kewajiban ini sudah lunas seluruhnya (sisa Rp 0).',
      );
    }

    if (validData.amount > existingEntry.remainingAmount) {
      throw createBookkeepingServiceError(
        'bookkeeping/overpayment-not-allowed',
        `Nominal pembayaran (${formatBookkeepingRupiah(validData.amount)}) melebihi sisa kewajiban (${formatBookkeepingRupiah(existingEntry.remainingAmount)}).`,
        {
          requestedAmount: validData.amount,
          remainingAmount: existingEntry.remainingAmount,
        },
      );
    }

    // 2. ALL WRITES AFTER ALL READS
    const now = tx.nowValue();
    const paidAt = resolveJakartaTimestampInput(validData.paidDate, tx, todayIso);

    const nextAmountSettled = existingEntry.amountSettled + validData.amount;
    const nextRemainingAmount = Math.max(0, existingEntry.amount - nextAmountSettled);
    const nextStatus = derivePayableSettlementStatus(existingEntry.amount, nextAmountSettled);

    const settlementDoc = {
      entryId: cleanEntryId,
      sourceModule: BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING,
      sourceType: existingEntry.sourceType,
      sourceId: existingEntry.sourceId || cleanEntryId,
      settlementType: BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT,
      amount: validData.amount,
      currency: 'IDR',
      paymentMethod: validData.paymentMethod,
      paidAt,
      referenceNumber: validData.referenceNumber,
      notes: validData.notes,
      operationId: cleanSettlementId,
      createdAt: now,
      createdByUid: cleanUid,
    };

    const entryAggregateUpdate = {
      amountSettled: nextAmountSettled,
      remainingAmount: nextRemainingAmount,
      settlementStatus: nextStatus,
      lastSettlementId: cleanSettlementId,
      lastSettledAt: paidAt,
      updatedAt: now,
      updatedByUid: cleanUid,
      version: existingEntry.version + 1,
    };

    tx.setBookkeepingSettlement(cleanSettlementId, settlementDoc);
    tx.updateBookkeepingEntry(cleanEntryId, entryAggregateUpdate);

    return {
      entry: normalizeBookkeepingEntryRecord(cleanEntryId, {
        ...existingEntry,
        ...entryAggregateUpdate,
      }),
      settlement: normalizeBookkeepingSettlementRecord(cleanSettlementId, settlementDoc),
      idempotentReplay: false,
    };
  });
}
