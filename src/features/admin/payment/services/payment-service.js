/**
 * Atomic Payment Recording, Shared Transaction-Scoped Payment Application & Append-Only
 * Reversal Ledger Service for 37 Music Studio (Phase 8 + Payment Evidence & Verification v1).
 *
 * Guarantees:
 * - All reads occur before writes inside a single Firestore transaction
 * - Idempotent payment creation via pre-generated or deterministic `transactionId`
 * - Strict overpayment protection (`amount <= invoice.balanceDue`)
 * - Concurrency-safe version & balance checks (prevents negative balances)
 * - Enforces mandatory Client evidence policy on `clientPaymentEvidenceRequired === true` invoices
 * - Shared transaction-scoped logic (`applyValidatedPaymentInTransaction`) reused identically by
 *   both manual Admin recording and Client Payment Evidence verification
 * - Optional Admin evidence attachment written atomically alongside Admin-managed payments
 * - Append-only compensating reversals (`pay_rev_{originalTransactionId}`) with zero direct edits/deletes
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';
import {
  PAYMENT_EVIDENCE_SCHEMA_VERSION,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '@/features/payment-evidence/config/payment-evidence-config';
import {
  normalizePaymentEvidenceRecord,
  validatePaymentEvidenceAsset,
} from '@/features/payment-evidence/schemas/payment-evidence-schema';
import { generatePaymentEvidenceId } from '@/features/payment-evidence/utils/payment-evidence-utils';

import { getPaymentRepositoryAdapter } from '../repositories/payment-repository';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
  validatePaymentReversalInput,
  validateRecordPaymentInput,
} from '../schemas/payment-schema';
import { buildReversalPaymentId } from '../utils/invoice-number';
import {
  INVOICE_STATUS,
  PAYMENT_SOURCE,
  SUPPORTED_PAYMENT_METHODS,
  TRANSACTION_TYPE,
} from '../utils/invoice-status';
import { computeInvoicePaymentTotals } from '../utils/payment-calculation';
import { assertAuthenticatedPaymentActor, createPaymentServiceError } from './invoice-service';

export function buildReceivedAtValue(receivedDateIso, tx) {
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
 * Shared transaction-scoped payment application logic used by BOTH:
 * 1. `recordInvoicePayment()` (Admin-managed manual recording)
 * 2. `verifyClientPaymentEvidence()` (Staff verification of Client Portal proof)
 *
 * Caller MUST have already completed all transaction reads (`existingInvoice`,
 * `existingTransaction`, and any evidence doc) before invoking this helper.
 */
function isMatchingClientReservation(reservation, invoice) {
  if (!reservation || !invoice?.bookingId) return false;
  const reservationUid = String(reservation.clientUid || '').trim();
  const invoiceUid = String(invoice.clientUid || '').trim();
  return (
    reservation.bookingId === invoice.bookingId &&
    reservation.invoiceId === invoice.id &&
    String(reservation.customerId || '') === String(invoice.customerId || '') &&
    (!reservationUid || !invoiceUid || reservationUid === invoiceUid)
  );
}

export function applyValidatedPaymentInTransaction(
  tx,
  {
    transactionId,
    existingInvoice,
    existingTransaction = null,
    existingClientReservation = null,
    expectedVersion,
    amount,
    paymentMethod = 'cash',
    receivedDate = '',
    referenceNumber = '',
    notes = '',
    source = PAYMENT_SOURCE.MANUAL,
    actorUid,
    allowClientEvidenceInvoice = false,
    now = null,
  },
) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanTxId = String(transactionId || '').trim();
  const cleanInvoiceId = String(existingInvoice?.id || '').trim();

  if (!existingInvoice || !cleanInvoiceId) {
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

  if (existingInvoice.clientPaymentEvidenceRequired && !allowClientEvidenceInvoice) {
    throw createPaymentServiceError(
      'payment/client-evidence-required',
      'Invoice ini berasal dari Client Portal dan wajib melalui unggah serta verifikasi bukti pembayaran pada tab Payment Evidence.',
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

  const amountInt = Number(amount);
  if (!Number.isInteger(amountInt) || amountInt <= 0) {
    throw createPaymentServiceError(
      'payment/validation-error',
      'Nominal pembayaran harus berupa bilangan bulat lebih besar dari Rp 0.',
    );
  }

  if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw createPaymentServiceError(
      'payment/validation-error',
      'Metode pembayaran tidak valid.',
    );
  }

  // Strict Overpayment Protection
  if (amountInt > existingInvoice.balanceDue) {
    throw createPaymentServiceError(
      'payment/overpayment-not-allowed',
      `Nominal pembayaran (${formatRupiah(amountInt)}) melebihi sisa tagihan (${formatRupiah(existingInvoice.balanceDue)}).`,
      {
        requestedAmount: amountInt,
        balanceDue: existingInvoice.balanceDue,
      },
    );
  }

  const effectiveNow = now ?? tx.nowValue();
  const receivedAt = buildReceivedAtValue(receivedDate, tx);

  const nextTotals = computeInvoicePaymentTotals({
    totalAmount: existingInvoice.financialSnapshot.totalAmount,
    currentAmountPaid: existingInvoice.amountPaid,
    deltaAmount: amountInt,
  });

  const transactionDoc = {
    invoiceId: cleanInvoiceId,
    invoiceNumber: existingInvoice.invoiceNumber,
    bookingId: existingInvoice.bookingId,
    customerId: existingInvoice.customerId,
    clientUid: String(existingInvoice.clientUid || ''),
    transactionType: TRANSACTION_TYPE.PAYMENT,
    amount: amountInt,
    currency: 'IDR',
    paymentMethod,
    receivedAt,
    referenceNumber: String(referenceNumber || '').trim(),
    notes: String(notes || '').trim(),
    source,
    reversalOfTransactionId: null,
    recordedByUid: cleanActorUid,
    createdAt: effectiveNow,
  };

  const updatedInvoiceDoc = {
    invoiceNumber: existingInvoice.invoiceNumber,
    bookingId: existingInvoice.bookingId,
    customerId: existingInvoice.customerId,
    invoiceStatus: existingInvoice.invoiceStatus,
    currency: existingInvoice.currency,
    clientPaymentEvidenceRequired: Boolean(existingInvoice.clientPaymentEvidenceRequired),
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
    updatedAt: effectiveNow,
    updatedByUid: cleanActorUid,
    version: existingInvoice.version + 1,
  };

  tx.setPaymentTransaction(cleanTxId, transactionDoc);
  tx.updateInvoice(cleanInvoiceId, updatedInvoiceDoc);
  if (
    isMatchingClientReservation(existingClientReservation, existingInvoice) &&
    typeof tx.updateClientReservation === 'function'
  ) {
    tx.updateClientReservation(existingInvoice.bookingId, {
      paymentStatus: nextTotals.paymentStatus,
      updatedAt: effectiveNow,
    });
  }

  return {
    invoice: normalizeInvoiceRecord(cleanInvoiceId, updatedInvoiceDoc),
    transaction: normalizePaymentTransactionRecord(cleanTxId, transactionDoc),
    idempotentReplay: false,
    now: effectiveNow,
  };
}

/**
 * Records a customer payment against an Admin-managed issued invoice inside one atomic
 * Firestore transaction, optionally attaching a validated Cloudinary evidence record.
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
  optionalEvidence = null,
  evidenceId = '',
  expectedCloudName = '',
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

  let validatedEvidenceAsset = null;
  if (optionalEvidence) {
    const assetCheck = validatePaymentEvidenceAsset(optionalEvidence, expectedCloudName);
    if (!assetCheck.isValid) {
      throw createPaymentServiceError(
        'payment/invalid-evidence',
        assetCheck.error || 'Metadata bukti pembayaran tidak valid.',
      );
    }
    validatedEvidenceAsset = assetCheck.data;
  }

  const cleanEvidenceId = validatedEvidenceAsset
    ? String(evidenceId || '').trim() || generatePaymentEvidenceId('ev_adm')
    : '';

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingInvoice, existingTransaction, existingEvidence] = await Promise.all([
      tx.getInvoice(cleanInvoiceId),
      tx.getPaymentTransaction(cleanTxId),
      cleanEvidenceId && typeof tx.getPaymentEvidence === 'function'
        ? tx.getPaymentEvidence(cleanEvidenceId)
        : Promise.resolve(null),
    ]);

    // 2. SHARED TRANSACTIONAL VALIDATION & WRITES
    const existingClientReservation =
      existingInvoice?.bookingId && typeof tx.getClientReservation === 'function'
        ? await tx.getClientReservation(existingInvoice.bookingId)
        : null;

    const applied = applyValidatedPaymentInTransaction(tx, {
      transactionId: cleanTxId,
      existingInvoice,
      existingTransaction,
      existingClientReservation,
      expectedVersion,
      amount: validation.data.amount,
      paymentMethod: validation.data.paymentMethod,
      receivedDate: validation.data.receivedDate,
      referenceNumber: validation.data.referenceNumber,
      notes: validation.data.notes,
      source: PAYMENT_SOURCE.MANUAL,
      actorUid: cleanActorUid,
      allowClientEvidenceInvoice: false,
    });

    if (applied.idempotentReplay) {
      return {
        invoice: applied.invoice,
        transaction: applied.transaction,
        evidence: existingEvidence || null,
        idempotentReplay: true,
      };
    }

    let attachedEvidence = null;
    if (validatedEvidenceAsset && !existingEvidence && typeof tx.setPaymentEvidence === 'function') {
      const claimedDate =
        validation.data.receivedDate && isValidIsoDateString(validation.data.receivedDate)
          ? validation.data.receivedDate
          : getJakartaTodayIso();
      const evidenceDoc = {
        schemaVersion: PAYMENT_EVIDENCE_SCHEMA_VERSION,
        invoiceId: cleanInvoiceId,
        invoiceNumber: existingInvoice.invoiceNumber,
        bookingId: existingInvoice.bookingId,
        customerId: existingInvoice.customerId,
        clientUid: String(existingInvoice.clientUid || ''),
        evidenceSource: PAYMENT_EVIDENCE_SOURCES.ADMIN_MANUAL,
        status: PAYMENT_EVIDENCE_STATUSES.ATTACHED,
        claimedAmount: validation.data.amount,
        paymentMethod: validation.data.paymentMethod,
        claimedPaidAt: claimedDate,
        referenceNumber: validation.data.referenceNumber,
        evidence: validatedEvidenceAsset,
        submittedByUid: cleanActorUid,
        submittedAt: applied.now,
        reviewedAt: null,
        reviewedByUid: '',
        rejectionReason: '',
        verifiedAmount: validation.data.amount,
        linkedTransactionId: cleanTxId,
        createdAt: applied.now,
        updatedAt: applied.now,
        version: 1,
      };
      tx.setPaymentEvidence(cleanEvidenceId, evidenceDoc);
      attachedEvidence = normalizePaymentEvidenceRecord(cleanEvidenceId, evidenceDoc);
    }

    return {
      invoice: applied.invoice,
      transaction: applied.transaction,
      evidence: attachedEvidence,
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
 * - Never edits or deletes the original payment transaction or associated paymentEvidence history.
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

    const existingClientReservation =
      existingInvoice.bookingId && typeof tx.getClientReservation === 'function'
        ? await tx.getClientReservation(existingInvoice.bookingId)
        : null;

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
      clientUid: String(existingInvoice.clientUid || ''),
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
      clientPaymentEvidenceRequired: Boolean(existingInvoice.clientPaymentEvidenceRequired),
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
    if (
      isMatchingClientReservation(existingClientReservation, existingInvoice) &&
      typeof tx.updateClientReservation === 'function'
    ) {
      tx.updateClientReservation(existingInvoice.bookingId, {
        paymentStatus: nextTotals.paymentStatus,
        updatedAt: now,
      });
    }

    return {
      invoice: normalizeInvoiceRecord(cleanInvoiceId, updatedInvoiceDoc),
      reversal: normalizePaymentTransactionRecord(reversalTxId, reversalDoc),
    };
  });
}
