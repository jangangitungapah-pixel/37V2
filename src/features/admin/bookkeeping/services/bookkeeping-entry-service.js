/**
 * Atomic Manual Financial Entry, Owner-Only Reversal, and Opening Balance Service
 * for Pembukuan (Bookkeeping & Financial Control Center).
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
  normalizeBookkeepingEntryRecord,
  normalizeBookkeepingSettingsRecord,
  normalizeBookkeepingSettlementRecord,
  validateBookkeepingReversalInput,
  validateManualExpenseInput,
  validateManualIncomeInput,
  validateOpeningBalanceInput,
} from '../schemas/bookkeeping-schema';
import { resolveJakartaTimestampInput } from '../utils/bookkeeping-period';

export function createBookkeepingServiceError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

export function assertActiveOwnerBookkeepingActor(actorUid, actorRole) {
  const cleanUid = String(actorUid || '').trim();
  const cleanRole = String(actorRole || '')
    .trim()
    .toLowerCase();

  if (!cleanUid) {
    throw createBookkeepingServiceError(
      'bookkeeping/unauthenticated',
      'Sesi pengguna tidak valid. Silakan login kembali.',
    );
  }
  if (cleanRole !== 'owner') {
    throw createBookkeepingServiceError(
      'bookkeeping/owner-only',
      'Hanya Owner aktif yang diizinkan mengelola atau mencatat data Pembukuan.',
    );
  }
  return cleanUid;
}

export function mapBookkeepingErrorToMessage(error) {
  const code = String(error?.code || '').trim();
  switch (code) {
    case 'bookkeeping/owner-only':
      return 'Hanya Owner aktif yang diizinkan melakukan aksi Pembukuan ini.';
    case 'bookkeeping/unauthenticated':
      return 'Sesi autentikasi berakhir. Silakan masuk kembali.';
    case 'bookkeeping/validation-error':
      return error.message || 'Periksa kembali data yang Anda masukkan.';
    case 'bookkeeping/overpayment-not-allowed':
      return error.message || 'Nominal pelunasan melebihi sisa kewajiban saat ini.';
    case 'bookkeeping/already-settled':
      return 'Kewajiban ini sudah lunas seluruhnya (sisa Rp 0).';
    case 'bookkeeping/stale-version':
      return 'Data kewajiban berubah di sesi lain. Muat ulang halaman lalu coba kembali.';
    case 'bookkeeping/duplicate-operation-id':
      return 'ID operasi settlement sudah digunakan oleh transaksi lain.';
    case 'bookkeeping/entry-not-found':
      return 'Catatan pembukuan tidak ditemukan di database.';
    case 'bookkeeping/not-payable':
      return 'Catatan ini bukan kewajiban pengeluaran yang dapat dilunasi.';
    case 'bookkeeping/entry-reversed':
    case 'bookkeeping/already-reversed':
      return 'Catatan ini sudah dikoreksi (reversed) sebelumnya.';
    case 'bookkeeping/cannot-reverse-system-entry':
      return 'Catatan dari modul Commission atau modul lain tidak boleh dikoreksi dari sini.';
    case 'bookkeeping/cannot-reverse-settled-entry':
      return 'Pengeluaran yang sudah pernah dibayar/dilunasi tidak dapat dibatalkan melalui koreksi v1.';
    case 'permission-denied':
      return 'Akses ditolak oleh aturan keamanan Firestore (khusus Owner aktif).';
    default:
      return error?.message || 'Terjadi kendala saat memproses transaksi Pembukuan.';
  }
}

/**
 * Records a non-invoice manual studio income inside `bookkeepingEntries`.
 * Strictly uses `sourceModule: 'bookkeeping'`, `sourceType: 'manual'` (never creates fake invoices).
 */
export async function createManualIncomeEntry({
  entryId = generateOperationId('bk_inc'),
  actorUid,
  actorRole,
  input,
  adapter = getBookkeepingRepositoryAdapter(),
}) {
  const cleanUid = assertActiveOwnerBookkeepingActor(actorUid, actorRole);
  const cleanEntryId = String(entryId || '').trim() || generateOperationId('bk_inc');

  const validation = validateManualIncomeInput(input);
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Data pemasukan manual tidak valid.';
    throw createBookkeepingServiceError(
      'bookkeeping/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  const todayIso = getJakartaTodayIso();
  const { description, category, amount, receivedDate, paymentMethod, referenceNumber, notes } =
    validation.data;

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const existing = await tx.getBookkeepingEntry(cleanEntryId);
    if (existing) {
      if (
        existing.sourceModule === BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING &&
        existing.entryType === BOOKKEEPING_ENTRY_TYPES.INCOME
      ) {
        return { entry: existing, idempotentReplay: true };
      }
      throw createBookkeepingServiceError(
        'bookkeeping/duplicate-operation-id',
        'ID entri sudah digunakan oleh transaksi lain.',
      );
    }

    // 2. WRITES AFTER READS
    const now = tx.nowValue();
    const occurredAt = resolveJakartaTimestampInput(receivedDate, tx, todayIso);

    const entryDoc = {
      sourceModule: BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING,
      sourceType: BOOKKEEPING_SOURCE_TYPES.MANUAL,
      sourceId: cleanEntryId,
      entryType: BOOKKEEPING_ENTRY_TYPES.INCOME,
      category,
      description,
      amount,
      currency: 'IDR',
      settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.PAID,
      paymentMethod,
      referenceNumber,
      notes,
      occurredAt,
      createdAt: now,
      createdByUid: cleanUid,
      version: 1,
    };

    tx.setBookkeepingEntry(cleanEntryId, entryDoc);

    return {
      entry: normalizeBookkeepingEntryRecord(cleanEntryId, entryDoc),
      idempotentReplay: false,
    };
  });
}

/**
 * Records a manual studio expense (`Paid` or `Unpaid`) atomically:
 * - If Paid: creates BOTH `bookkeepingEntries` (settled) AND `bookkeepingSettlements` in one transaction.
 * - If Unpaid: creates ONLY `bookkeepingEntries` (`unpaid` payable obligation) with zero settlement.
 */
export async function createManualExpenseEntry({
  entryId = generateOperationId('bk_exp'),
  settlementId = generateOperationId('bk_set'),
  actorUid,
  actorRole,
  input,
  adapter = getBookkeepingRepositoryAdapter(),
}) {
  const cleanUid = assertActiveOwnerBookkeepingActor(actorUid, actorRole);
  const cleanEntryId = String(entryId || '').trim() || generateOperationId('bk_exp');
  const cleanSettlementId = String(settlementId || '').trim() || generateOperationId('bk_set');

  const validation = validateManualExpenseInput(input);
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Data pengeluaran manual tidak valid.';
    throw createBookkeepingServiceError(
      'bookkeeping/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  const todayIso = getJakartaTodayIso();
  const {
    description,
    category,
    amount,
    expenseDate,
    paymentStatus,
    paymentMethod,
    paidDate,
    dueDate,
    referenceNumber,
    notes,
  } = validation.data;
  const isPaidNow = paymentStatus === 'paid';

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingEntry, existingSettlement] = await Promise.all([
      tx.getBookkeepingEntry(cleanEntryId),
      isPaidNow ? tx.getBookkeepingSettlement(cleanSettlementId) : Promise.resolve(null),
    ]);

    if (existingEntry) {
      if (
        existingEntry.sourceModule === BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING &&
        existingEntry.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL
      ) {
        return {
          entry: existingEntry,
          settlement: existingSettlement,
          idempotentReplay: true,
        };
      }
      throw createBookkeepingServiceError(
        'bookkeeping/duplicate-operation-id',
        'ID entri pengeluaran sudah digunakan oleh catatan lain.',
      );
    }

    if (isPaidNow && existingSettlement) {
      throw createBookkeepingServiceError(
        'bookkeeping/duplicate-operation-id',
        'ID settlement sudah digunakan oleh pembayaran lain.',
      );
    }

    // 2. ALL WRITES AFTER READS
    const now = tx.nowValue();
    const occurredAt = resolveJakartaTimestampInput(expenseDate, tx, todayIso);
    const paidAt = isPaidNow ? resolveJakartaTimestampInput(paidDate, tx, todayIso) : null;

    const entryDoc = {
      sourceModule: BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING,
      sourceType: BOOKKEEPING_SOURCE_TYPES.MANUAL,
      sourceId: cleanEntryId,
      entryType: BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL,
      category,
      description,
      amount,
      currency: 'IDR',
      settlementStatus: isPaidNow
        ? BOOKKEEPING_SETTLEMENT_STATUS.PAID
        : BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
      amountSettled: isPaidNow ? amount : 0,
      remainingAmount: isPaidNow ? 0 : amount,
      paidOnCreate: isPaidNow,
      dueDate: isPaidNow ? null : dueDate || null,
      paymentMethod: isPaidNow ? paymentMethod : '',
      referenceNumber,
      notes,
      lastSettlementId: isPaidNow ? cleanSettlementId : null,
      lastSettledAt: isPaidNow ? paidAt : null,
      occurredAt,
      createdAt: now,
      createdByUid: cleanUid,
      updatedAt: now,
      updatedByUid: cleanUid,
      version: 1,
    };

    tx.setBookkeepingEntry(cleanEntryId, entryDoc);

    let settlementRecord = null;
    if (isPaidNow) {
      const settlementDoc = {
        entryId: cleanEntryId,
        sourceModule: BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING,
        sourceType: BOOKKEEPING_SOURCE_TYPES.MANUAL,
        sourceId: cleanEntryId,
        settlementType: BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT,
        amount,
        currency: 'IDR',
        paymentMethod,
        paidAt,
        referenceNumber,
        notes,
        operationId: cleanSettlementId,
        createdAt: now,
        createdByUid: cleanUid,
      };
      tx.setBookkeepingSettlement(cleanSettlementId, settlementDoc);
      settlementRecord = normalizeBookkeepingSettlementRecord(cleanSettlementId, settlementDoc);
    }

    return {
      entry: normalizeBookkeepingEntryRecord(cleanEntryId, entryDoc),
      settlement: settlementRecord,
      idempotentReplay: false,
    };
  });
}

/**
 * Owner-only Correction / Reversal for Manual Bookkeeping Entries that have ZERO settlements.
 * Never permanently deletes the source record, creates an immutable compensating `reversal`
 * entry (`bk_rev_{entryId}`), and strictly refuses modifying Commission entries or settled payables.
 */
export async function reverseBookkeepingEntry({
  entryId,
  expectedVersion,
  reason,
  actorUid,
  actorRole,
  adapter = getBookkeepingRepositoryAdapter(),
}) {
  const cleanUid = assertActiveOwnerBookkeepingActor(actorUid, actorRole);
  const cleanEntryId = String(entryId || '').trim();

  if (!cleanEntryId) {
    throw createBookkeepingServiceError('bookkeeping/entry-not-found', 'ID entri tidak valid.');
  }

  const validation = validateBookkeepingReversalInput({ reason });
  if (!validation.isValid) {
    throw createBookkeepingServiceError(
      'bookkeeping/validation-error',
      validation.errors.reason,
      validation.errors,
    );
  }

  const reversalId = `bk_rev_${cleanEntryId}`;
  const cleanReason = validation.data.reason;

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [originalEntry, existingReversal] = await Promise.all([
      tx.getBookkeepingEntry(cleanEntryId),
      tx.getBookkeepingEntry(reversalId),
    ]);

    if (!originalEntry) {
      throw createBookkeepingServiceError(
        'bookkeeping/entry-not-found',
        'Catatan pembukuan yang ingin dikoreksi tidak ditemukan.',
      );
    }

    if (existingReversal) {
      return {
        originalEntry,
        reversalEntry: existingReversal,
        idempotentReplay: true,
      };
    }

    if (
      originalEntry.sourceModule !== BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING ||
      originalEntry.sourceType !== BOOKKEEPING_SOURCE_TYPES.MANUAL
    ) {
      throw createBookkeepingServiceError(
        'bookkeeping/cannot-reverse-system-entry',
        'Koreksi ini hanya tersedia untuk catatan manual Pembukuan. Catatan Commission tidak dapat diubah dari sini.',
      );
    }

    if (originalEntry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED) {
      throw createBookkeepingServiceError(
        'bookkeeping/already-reversed',
        'Catatan manual ini sudah dikoreksi sebelumnya.',
      );
    }

    if (
      originalEntry.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL &&
      (originalEntry.amountSettled > 0 ||
        originalEntry.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.UNPAID)
    ) {
      throw createBookkeepingServiceError(
        'bookkeeping/cannot-reverse-settled-entry',
        'Pengeluaran manual yang sudah dibayar atau dicicil tidak dapat dibatalkan melalui koreksi v1.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      originalEntry.version !== Number(expectedVersion)
    ) {
      throw createBookkeepingServiceError(
        'bookkeeping/stale-version',
        'Catatan berubah di sesi lain. Muat ulang detail lalu coba kembali.',
      );
    }

    // 2. ALL WRITES AFTER READS
    const now = tx.nowValue();
    const reversalDescription = `Koreksi: ${originalEntry.description}`.slice(0, 280);

    const reversalDoc = {
      sourceModule: BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING,
      sourceType: BOOKKEEPING_SOURCE_TYPES.MANUAL_REVERSAL,
      sourceId: cleanEntryId,
      entryType: BOOKKEEPING_ENTRY_TYPES.REVERSAL,
      reversalOfEntryId: cleanEntryId,
      originalEntryType: originalEntry.entryType,
      category: originalEntry.category,
      description: reversalDescription,
      amount: originalEntry.amount,
      currency: 'IDR',
      settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.REVERSED,
      notes: cleanReason,
      occurredAt: now,
      createdAt: now,
      createdByUid: cleanUid,
      version: 1,
    };

    const entryUpdatePayload = {
      settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.REVERSED,
      reversedByEntryId: reversalId,
      reversalReason: cleanReason,
      reversedAt: now,
      reversedByUid: cleanUid,
      updatedAt: now,
      updatedByUid: cleanUid,
      version: originalEntry.version + 1,
      ...(originalEntry.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL
        ? { remainingAmount: 0 }
        : {}),
    };

    tx.setBookkeepingEntry(reversalId, reversalDoc);
    tx.updateBookkeepingEntry(cleanEntryId, entryUpdatePayload);

    return {
      originalEntry: normalizeBookkeepingEntryRecord(cleanEntryId, {
        ...originalEntry,
        ...entryUpdatePayload,
      }),
      reversalEntry: normalizeBookkeepingEntryRecord(reversalId, reversalDoc),
      idempotentReplay: false,
    };
  });
}

/**
 * Owner-only configuration of optional Opening Cash Movement Balance (`bookkeepingSettings/default`).
 */
export async function saveBookkeepingOpeningBalance({
  actorUid,
  actorRole,
  input,
  adapter = getBookkeepingRepositoryAdapter(),
}) {
  const cleanUid = assertActiveOwnerBookkeepingActor(actorUid, actorRole);
  const validation = validateOpeningBalanceInput(input);
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Konfigurasi saldo awal tidak valid.';
    throw createBookkeepingServiceError(
      'bookkeeping/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    await tx.getBookkeepingSettings();
    const now = tx.nowValue();
    const payload = {
      openingCashBalance: validation.data.enabled ? validation.data.openingCashBalance : null,
      openingBalanceAsOf: validation.data.enabled
        ? validation.data.openingBalanceAsOf || null
        : null,
      openingBalanceNote: validation.data.enabled ? validation.data.openingBalanceNote || '' : '',
      updatedAt: now,
      updatedByUid: cleanUid,
    };

    tx.setBookkeepingSettings(payload);
    return normalizeBookkeepingSettingsRecord('default', payload);
  });
}
