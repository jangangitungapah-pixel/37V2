/**
 * Atomic Payment Recording & Append-Only Reversal Ledger Service
 * for 37 Music Studio (Phase 8 — Payment & Bill Management).
 *
 * Guarantees:
 * - All reads occur before writes inside a single Firestore transaction
 * - Idempotent payment creation via pre-generated stable `transactionId`
 * - Strict overpayment protection (`amount <= invoice.balanceDue`)
 * - Concurrency-safe version & balance checks (prevents negative balances)
 * - Append-only compensating reversals (`pay_rev_{originalTransactionId}`) with zero direct edits/deletes
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

import { getPaymentRepositoryAdapter } from '../repositories/payment-repository';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
  validatePaymentReversalInput,
  validateRecordPaymentInput,
} from '../schemas/payment-schema';
import { buildReversalPaymentId } from '../utils/invoice-number';
import { INVOICE_STATUS, PAYMENT_SOURCE, TRANSACTION_TYPE } from '../utils/invoice-status';
import { computeInvoicePaymentTotals } from '../utils/payment-calculation';
import { assertAuthenticatedPaymentActor, createPaymentServiceError } from './invoice-service';

function buildReceivedAtValue(receivedDateIso, tx) {
  const cleanDate = String(receivedDateIso || '').trim();
  const todayIso = getJakartaTodayIso();
  if (!cleanDate || cleanDate === todayIso || !isValidIsoDateString(cleanDate)) {
    return tx.nowValue();
  }
  const parsedDate = new Date(`${cleanDate}T12:00:00+07:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return tx.nowValue();
  }
  return tx.timestampFromDate(parsedDate);
}

/**
 * Records a customer payment against an issued invoice inside one atomic Firestore transaction.
 */
export async function recordInvoicePayment({
  transactionId = generateOperationId('pay'),
  invoiceId,
  expectedVersion,
  amount,
  paymentMethod = 'cash',
  receivedDate = '',
  referenceNumber = '',
  notes = '',
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanTxId = String(transactionId || '').trim() || generateOperationId('pay');

  if (!cleanInvoiceId) {
    throw createPaymentServiceError('invoice/not-found', 'ID invoice tidak valid.');
  }

  const validation = validateRecordPaymentInput({
    amount,
    paymentMethod,
    receivedDate,
    referenceNumber,
    notes,
  });

  if (!validation.isValid) {
    const firstMsg =
      Object.values(validation.errors)[0] || 'Data pembayaran belum lengkap atau tidak valid.';
    throw createPaymentServiceError('payment/validation-error', firstMsg, validation.errors);
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingInvoice, existingTransaction] = await Promise.all([
      tx.getInvoice(cleanInvoiceId),
      tx.getPaymentTransaction(cleanTxId),
    ]);

    if (!existingInvoice) {
      throw createPaymentServiceError('invoice/not-found', 'Invoice tidak ditemukan di database.');
    }

    // Strict Idempotency: if this exact transactionId already committed for this invoice,
    // return the existing result without adding `amountPaid` a second time.
    if (existingTransaction) {
      if (existingTransaction.invoiceId !== cleanInvoiceId) {
        throw createPaymentServiceError(
          'payment/duplicate-transaction-id',
          'ID transaksi pembayaran sudah digunakan oleh invoice lain.',
        );
      }
      return {
        invoice: existingInvoice,
        transaction: existingTransaction,
        idempotentReplay: true,
      };
    }

    if (existingInvoice.invoiceStatus === INVOICE_STATUS.VOID) {
      throw createPaymentServiceError(
        'payment/invoice-void',
        'Invoice berstatus Void tidak dapat menerima pembayaran baru.',
      );
    }

    if (existingInvoice.invoiceStatus !== INVOICE_STATUS.ISSUED) {
      throw createPaymentServiceError(
        'payment/invoice-not-issued',
        'Pembayaran hanya dapat dicatat pada invoice berstatus Issued.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingInvoice.version !== Number(expectedVersion)
    ) {
      throw createPaymentServiceError(
        'payment/stale-invoice',
        'Tagihan invoice baru saja berubah di sesi lain. Muat ulang detail invoice lalu coba kembali.',
      );
    }

    if (existingInvoice.balanceDue <= 0) {
      throw createPaymentServiceError(
        'payment/already-paid',
        'Invoice ini sudah lunas (sisa tagihan Rp 0).',
      );
    }

    // Strict Overpayment Protection
    if (validation.data.amount > existingInvoice.balanceDue) {
      throw createPaymentServiceError(
        'payment/overpayment-not-allowed',
        `Nominal pembayaran (${formatRupiah(validation.data.amount)}) melebihi sisa tagihan (${formatRupiah(existingInvoice.balanceDue)}).`,
        {
          requestedAmount: validation.data.amount,
          balanceDue: existingInvoice.balanceDue,
        },
      );
    }

    // 2. ALL WRITES AFTER ALL READS
    const now = tx.nowValue();
    const receivedAt = buildReceivedAtValue(validation.data.receivedDate, tx);

    const nextTotals = computeInvoicePaymentTotals({
      totalAmount: existingInvoice.financialSnapshot.totalAmount,
      currentAmountPaid: existingInvoice.amountPaid,
      deltaAmount: validation.data.amount,
    });

    const transactionDoc = {
      invoiceId: cleanInvoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      bookingId: existingInvoice.bookingId,
      customerId: existingInvoice.customerId,
      transactionType: TRANSACTION_TYPE.PAYMENT,
      amount: validation.data.amount,
      currency: 'IDR',
      paymentMethod: validation.data.paymentMethod,
      receivedAt,
      referenceNumber: validation.data.referenceNumber,
      notes: validation.data.notes,
      source: PAYMENT_SOURCE.MANUAL,
      reversalOfTransactionId: null,
      recordedByUid: cleanActorUid,
      createdAt: now,
    };

    const updatedInvoiceDoc = {
      invoiceNumber: existingInvoice.invoiceNumber,
      bookingId: existingInvoice.bookingId,
      customerId: existingInvoice.customerId,
      invoiceStatus: existingInvoice.invoiceStatus,
      currency: existingInvoice.currency,
      customerSnapshot: existingInvoice.customerSnapshot,
      bookingSnapshot: existingInvoice.bookingSnapshot,
      financialSnapshot: existingInvoice.financialSnapshot,
      amountPaid: nextTotals.amountPaid,
      balanceDue: nextTotals.balanceDue,
      paymentStatus: nextTotals.paymentStatus,
      invoiceDate: existingInvoice.invoiceDate,
      dueDate: existingInvoice.dueDate,
      lastPaymentTransactionId: cleanTxId,
      voidReason: existingInvoice.voidReason,
      createdAt: existingInvoice.createdAt,
      createdByUid: existingInvoice.createdByUid,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existingInvoice.version + 1,
    };

    tx.setPaymentTransaction(cleanTxId, transactionDoc);
    tx.updateInvoice(cleanInvoiceId, updatedInvoiceDoc);

    return {
      invoice: normalizeInvoiceRecord(cleanInvoiceId, updatedInvoiceDoc),
      transaction: normalizePaymentTransactionRecord(cleanTxId, transactionDoc),
      idempotentReplay: false,
    };
  });
}

/**
 * Records a compensating append-only reversal for a previously recorded payment transaction.
 *
 * Important operational semantics:
 * - Entry correction only (not a physical refund settlement workflow).
 * - Strictly 1 reversal per original transaction via deterministic ID `pay_rev_{originalTxId}`.
 * - Never edits or deletes the original payment transaction.
 */
export async function reversePaymentTransaction({
  invoiceId,
  originalTransactionId,
  expectedVersion,
  reason,
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanOriginalTxId = String(originalTransactionId || '').trim();

  if (!cleanInvoiceId || !cleanOriginalTxId) {
    throw createPaymentServiceError(
      'payment/invalid-reversal-target',
      'ID invoice dan ID transaksi asal wajib tersedia untuk koreksi/reversal.',
    );
  }

  const validation = validatePaymentReversalInput({ reason });
  if (!validation.isValid) {
    throw createPaymentServiceError(
      'payment/validation-error',
      validation.errors.reason,
      validation.errors,
    );
  }

  const reversalTxId = buildReversalPaymentId(cleanOriginalTxId);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingInvoice, originalTx, existingReversal] = await Promise.all([
      tx.getInvoice(cleanInvoiceId),
      tx.getPaymentTransaction(cleanOriginalTxId),
      tx.getPaymentTransaction(reversalTxId),
    ]);

    if (!existingInvoice) {
      throw createPaymentServiceError('invoice/not-found', 'Invoice tidak ditemukan.');
    }

    if (existingInvoice.invoiceStatus === INVOICE_STATUS.VOID) {
      throw createPaymentServiceError(
        'payment/invoice-void',
        'Invoice berstatus Void tidak dapat dikoreksi.',
      );
    }

    if (!originalTx || originalTx.invoiceId !== cleanInvoiceId) {
      throw createPaymentServiceError(
        'payment/original-not-found',
        'Transaksi pembayaran asal tidak ditemukan pada invoice ini.',
      );
    }

    if (originalTx.transactionType !== TRANSACTION_TYPE.PAYMENT) {
      throw createPaymentServiceError(
        'payment/cannot-reverse-reversal',
        'Transaksi reversal tidak dapat di-reverse ulang.',
      );
    }

    // Strict one-reversal-per-transaction protection
    if (existingReversal) {
      throw createPaymentServiceError(
        'payment/already-reversed',
        'Transaksi pembayaran ini sudah pernah dikoreksi (reversed) sebelumnya.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingInvoice.version !== Number(expectedVersion)
    ) {
      throw createPaymentServiceError(
        'payment/stale-invoice',
        'Data invoice telah berubah di sesi lain. Muat ulang detail invoice lalu coba kembali.',
      );
    }

    if (originalTx.amount > existingInvoice.amountPaid) {
      throw createPaymentServiceError(
        'payment/invalid-reversal-amount',
        'Nominal transaksi asal melebihi total terbayar pada invoice saat ini.',
      );
    }

    // 2. ALL WRITES AFTER ALL READS
    const now = tx.nowValue();
    const nextTotals = computeInvoicePaymentTotals({
      totalAmount: existingInvoice.financialSnapshot.totalAmount,
      currentAmountPaid: existingInvoice.amountPaid,
      deltaAmount: -originalTx.amount,
    });

    const reversalDoc = {
      invoiceId: cleanInvoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      bookingId: existingInvoice.bookingId,
      customerId: existingInvoice.customerId,
      transactionType: TRANSACTION_TYPE.REVERSAL,
      amount: originalTx.amount,
      currency: 'IDR',
      paymentMethod: originalTx.paymentMethod,
      receivedAt: now,
      referenceNumber: originalTx.referenceNumber || '',
      notes: validation.data.reason,
      source: PAYMENT_SOURCE.REVERSAL,
      reversalOfTransactionId: cleanOriginalTxId,
      recordedByUid: cleanActorUid,
      createdAt: now,
    };

    const updatedInvoiceDoc = {
      invoiceNumber: existingInvoice.invoiceNumber,
      bookingId: existingInvoice.bookingId,
      customerId: existingInvoice.customerId,
      invoiceStatus: existingInvoice.invoiceStatus,
      currency: existingInvoice.currency,
      customerSnapshot: existingInvoice.customerSnapshot,
      bookingSnapshot: existingInvoice.bookingSnapshot,
      financialSnapshot: existingInvoice.financialSnapshot,
      amountPaid: nextTotals.amountPaid,
      balanceDue: nextTotals.balanceDue,
      paymentStatus: nextTotals.paymentStatus,
      invoiceDate: existingInvoice.invoiceDate,
      dueDate: existingInvoice.dueDate,
      lastPaymentTransactionId: reversalTxId,
      voidReason: existingInvoice.voidReason,
      createdAt: existingInvoice.createdAt,
      createdByUid: existingInvoice.createdByUid,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existingInvoice.version + 1,
    };

    tx.setPaymentTransaction(reversalTxId, reversalDoc);
    tx.updateInvoice(cleanInvoiceId, updatedInvoiceDoc);

    return {
      invoice: normalizeInvoiceRecord(cleanInvoiceId, updatedInvoiceDoc),
      reversal: normalizePaymentTransactionRecord(reversalTxId, reversalDoc),
    };
  });
}
