/**
 * Append-Only Invoice Price Adjustment Service (`AD-06`, `OD-11`) for 37 Music Studio.
 *
 * Guarantees:
 * - Strict Reads-Before-Writes atomic transaction updating `invoices/{invoiceId}/adjustments/{adjustmentId}`,
 *   parent `invoices/{invoiceId}`, and `clientReservations/{bookingId}` in one commit
 * - Preserves `financialSnapshot` and `minimumDepositAmount` completely immutable
 * - Recomputes `adjustmentTotal`, `effectiveTotalAmount >= 0`, `balanceDue`, `overpaidCreditBalance`,
 *   and `paymentStatus` (supporting `overpaid_credit_pending` when receipts exceed reduced total)
 * - Idempotent via pre-generated `adj_{24hex}` identifier & `expectedVersion` optimistic concurrency
 */

import { getPaymentRepositoryAdapter } from '../repositories/payment-repository';
import {
  generateAdjustmentId,
  normalizeInvoiceAdjustmentRecord,
  normalizeInvoiceRecord,
  validateCreateInvoiceAdjustmentInput,
} from '../schemas/payment-schema';
import { INVOICE_STATUS } from '../utils/invoice-status';
import { computeInvoicePaymentTotals } from '../utils/payment-calculation';
import { assertAuthenticatedPaymentActor, createPaymentServiceError } from './invoice-service';

function isMatchingClientReservationForInvoice(reservation, invoice) {
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

/**
 * Core transaction-scoped helper shared by both direct Admin adjustments (`/admin/payment-and-bill`)
 * and Calendar scope/duration pricing updates (`updateOrRescheduleBooking`).
 */
export function applyInvoiceAdjustmentInTransaction(
  tx,
  {
    adjustmentId = generateAdjustmentId(),
    existingInvoice,
    existingAdjustment = null,
    existingClientReservation = null,
    expectedVersion,
    category = 'manual_correction',
    deltaAmount,
    reason,
    linkedChangeRequestId = null,
    approvedByUid = '',
    clientApprovedAt = null,
    actorUid,
    now = null,
  },
) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(existingInvoice?.id || '').trim();
  const cleanAdjustmentId = String(adjustmentId || '').trim() || generateAdjustmentId();

  if (!existingInvoice || !cleanInvoiceId) {
    throw createPaymentServiceError('invoice/not-found', 'Invoice tidak ditemukan di database.');
  }

  // Idempotent retry protection
  if (existingAdjustment) {
    if (existingAdjustment.invoiceId !== cleanInvoiceId) {
      throw createPaymentServiceError(
        'adjustment/duplicate-id',
        'ID penyesuaian tagihan sudah digunakan pada invoice lain.',
      );
    }
    return {
      invoice: existingInvoice,
      adjustment: existingAdjustment,
      idempotentReplay: true,
    };
  }

  if (existingInvoice.invoiceStatus === INVOICE_STATUS.VOID) {
    throw createPaymentServiceError(
      'adjustment/invoice-void',
      'Invoice berstatus Void tidak dapat diberi penyesuaian harga.',
    );
  }

  if (existingInvoice.invoiceStatus !== INVOICE_STATUS.ISSUED) {
    throw createPaymentServiceError(
      'adjustment/invoice-not-issued',
      'Penyesuaian harga hanya dapat diterapkan pada invoice berstatus Issued.',
    );
  }

  if (
    expectedVersion !== null &&
    expectedVersion !== undefined &&
    Number.isInteger(Number(expectedVersion)) &&
    existingInvoice.version !== Number(expectedVersion)
  ) {
    throw createPaymentServiceError(
      'adjustment/stale-invoice',
      'Data invoice telah berubah di sesi lain. Muat ulang detail invoice lalu coba lagi.',
    );
  }

  const currentEffectiveTotal = Number(
    existingInvoice.effectiveTotalAmount ?? existingInvoice.financialSnapshot?.totalAmount ?? 0,
  );
  const validation = validateCreateInvoiceAdjustmentInput(
    { category, deltaAmount, reason },
    { currentEffectiveTotal },
  );
  if (!validation.isValid) {
    const firstMsg =
      Object.values(validation.errors)[0] || 'Data penyesuaian harga tidak valid.';
    throw createPaymentServiceError(
      firstMsg.includes('kurang dari Rp 0')
        ? 'adjustment/negative-total-not-allowed'
        : 'adjustment/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  const nextAdjustmentTotal =
    (Number(existingInvoice.adjustmentTotal) || 0) + validation.data.deltaAmount;
  const baseTotal = existingInvoice.financialSnapshot?.totalAmount || 0;
  if (baseTotal + nextAdjustmentTotal < 0) {
    throw createPaymentServiceError(
      'adjustment/negative-total-not-allowed',
      'Total tagihan efektif tidak boleh kurang dari Rp 0.',
    );
  }

  const nextTotals = computeInvoicePaymentTotals({
    totalAmount: baseTotal,
    adjustmentTotal: nextAdjustmentTotal,
    refundedTotal: existingInvoice.refundedTotal || 0,
    creditConvertedTotal: existingInvoice.creditConvertedTotal || 0,
    currentAmountPaid: existingInvoice.amountPaid || 0,
    deltaAmount: 0,
  });

  const effectiveNow = now ?? tx.nowValue();
  const targetType = existingInvoice.targetType === 'project' ? 'project' : 'booking';
  const targetId =
    targetType === 'project'
      ? String(existingInvoice.projectId || existingInvoice.bookingId || cleanInvoiceId)
      : String(existingInvoice.bookingId || cleanInvoiceId.replace(/^inv_/, ''));

  const adjustmentDoc = {
    schemaVersion: 1,
    adjustmentId: cleanAdjustmentId,
    invoiceId: cleanInvoiceId,
    targetType,
    targetId,
    category: validation.data.category,
    deltaAmount: validation.data.deltaAmount,
    reason: validation.data.reason,
    linkedChangeRequestId: linkedChangeRequestId ? String(linkedChangeRequestId).trim() : null,
    approvedByUid: String(approvedByUid || '').trim() || cleanActorUid,
    clientApprovedAt: clientApprovedAt ?? null,
    createdAt: effectiveNow,
    createdByUid: cleanActorUid,
  };

  const existingClientUid = String(existingInvoice.clientUid || '').trim();
  const updatedInvoiceDoc = {
    invoiceNumber: existingInvoice.invoiceNumber,
    bookingId: existingInvoice.bookingId,
    customerId: existingInvoice.customerId,
    ...(existingClientUid ? { clientUid: existingClientUid } : {}),
    invoiceStatus: existingInvoice.invoiceStatus,
    currency: existingInvoice.currency,
    clientPaymentEvidenceRequired: Boolean(existingInvoice.clientPaymentEvidenceRequired),
    customerSnapshot: existingInvoice.customerSnapshot,
    bookingSnapshot: existingInvoice.bookingSnapshot,
    financialSnapshot: existingInvoice.financialSnapshot,
    adjustmentTotal: nextTotals.adjustmentTotal,
    effectiveTotalAmount: nextTotals.effectiveTotalAmount,
    amountPaid: nextTotals.amountPaid,
    refundedTotal: nextTotals.refundedTotal,
    creditConvertedTotal: nextTotals.creditConvertedTotal,
    overpaidCreditBalance: nextTotals.overpaidCreditBalance,
    balanceDue: nextTotals.balanceDue,
    paymentStatus: nextTotals.paymentStatus,
    ...(existingInvoice.targetType ? { targetType: existingInvoice.targetType } : {}),
    ...(existingInvoice.depositPolicySnapshot
      ? { depositPolicySnapshot: existingInvoice.depositPolicySnapshot }
      : {}),
    ...(Number.isInteger(existingInvoice.minimumDepositAmount)
      ? { minimumDepositAmount: existingInvoice.minimumDepositAmount }
      : {}),
    ...(existingInvoice.depositStatus ? { depositStatus: existingInvoice.depositStatus } : {}),
    ...(existingInvoice.balanceDuePolicy
      ? { balanceDuePolicy: existingInvoice.balanceDuePolicy }
      : {}),
    invoiceDate: existingInvoice.invoiceDate,
    dueDate: existingInvoice.dueDate,
    lastPaymentTransactionId: existingInvoice.lastPaymentTransactionId,
    lastAdjustmentId: cleanAdjustmentId,
    adjustmentCount: (Number(existingInvoice.adjustmentCount) || 0) + 1,
    voidReason: existingInvoice.voidReason,
    createdAt: existingInvoice.createdAt,
    createdByUid: existingInvoice.createdByUid,
    updatedAt: effectiveNow,
    updatedByUid: cleanActorUid,
    version: existingInvoice.version + 1,
  };

  tx.setInvoiceAdjustment(cleanInvoiceId, cleanAdjustmentId, adjustmentDoc);
  tx.updateInvoice(cleanInvoiceId, updatedInvoiceDoc);

  if (
    isMatchingClientReservationForInvoice(existingClientReservation, existingInvoice) &&
    typeof tx.updateClientReservation === 'function'
  ) {
    tx.updateClientReservation(existingInvoice.bookingId, {
      effectiveTotalAmount: nextTotals.effectiveTotalAmount,
      paymentStatus: nextTotals.paymentStatus,
      updatedAt: effectiveNow,
    });
  }

  return {
    invoice: normalizeInvoiceRecord(cleanInvoiceId, updatedInvoiceDoc),
    adjustment: normalizeInvoiceAdjustmentRecord(cleanAdjustmentId, adjustmentDoc),
    idempotentReplay: false,
    now: effectiveNow,
  };
}

/**
 * Records an append-only price adjustment under `invoices/{invoiceId}/adjustments/{adjustmentId}`
 * and atomically recomputes parent invoice aggregates and Client Portal reservation projection.
 */
export async function createInvoiceAdjustment({
  adjustmentId = generateAdjustmentId(),
  invoiceId,
  expectedVersion,
  category = 'manual_correction',
  deltaAmount,
  reason,
  linkedChangeRequestId = null,
  approvedByUid = '',
  clientApprovedAt = null,
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanAdjId = String(adjustmentId || '').trim() || generateAdjustmentId();

  if (!cleanInvoiceId) {
    throw createPaymentServiceError('invoice/not-found', 'ID invoice tidak valid.');
  }

  const preValidation = validateCreateInvoiceAdjustmentInput({ category, deltaAmount, reason });
  if (!preValidation.isValid) {
    const firstMsg =
      Object.values(preValidation.errors)[0] || 'Data penyesuaian harga tidak valid.';
    throw createPaymentServiceError('adjustment/validation-error', firstMsg, preValidation.errors);
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingInvoice, existingAdjustment] = await Promise.all([
      tx.getInvoice(cleanInvoiceId),
      typeof tx.getInvoiceAdjustment === 'function'
        ? tx.getInvoiceAdjustment(cleanInvoiceId, cleanAdjId)
        : Promise.resolve(null),
    ]);

    const existingClientReservation =
      existingInvoice?.bookingId && typeof tx.getClientReservation === 'function'
        ? await tx.getClientReservation(existingInvoice.bookingId)
        : null;

    return applyInvoiceAdjustmentInTransaction(tx, {
      adjustmentId: cleanAdjId,
      existingInvoice,
      existingAdjustment,
      existingClientReservation,
      expectedVersion,
      category: preValidation.data.category,
      deltaAmount: preValidation.data.deltaAmount,
      reason: preValidation.data.reason,
      linkedChangeRequestId,
      approvedByUid,
      clientApprovedAt,
      actorUid: cleanActorUid,
    });
  });
}
