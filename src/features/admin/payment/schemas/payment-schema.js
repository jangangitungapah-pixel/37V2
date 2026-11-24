/**
 * Zod Input Validation & Firestore Record Normalizers
 * for `invoices` and `paymentTransactions` (Phase 8 — Payment & Bill Management).
 */

import { z } from 'zod';

import { isValidIsoDateString } from '@/features/admin/calendar/utils/calendar-date';
import { normalizePhoneNumber } from '@/features/admin/customer/utils/phone-number';

import { buildInvoiceId, buildInvoiceNumber } from '../utils/invoice-number';
import {
  computeStoredPaymentStatus,
  INVOICE_STATUS,
  PAYMENT_SOURCE,
  SUPPORTED_PAYMENT_METHODS,
  TRANSACTION_TYPE,
} from '../utils/invoice-status';
import { toNonNegativeRupiahInt } from '../utils/payment-calculation';

const recordPaymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Nominal pembayaran harus berupa angka valid.' })
    .int('Nominal pembayaran harus bilangan bulat Rupiah.')
    .positive('Nominal pembayaran harus lebih dari Rp 0.'),
  paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS, {
    errorMap: () => ({
      message: 'Pilih metode pembayaran yang valid (Cash, Transfer, QRIS, Other).',
    }),
  }),
  receivedDate: z
    .string()
    .trim()
    .refine(
      (val) => !val || isValidIsoDateString(val),
      'Tanggal pembayaran harus berformat YYYY-MM-DD.',
    ),
  referenceNumber: z
    .string()
    .trim()
    .max(120, 'Nomor referensi maksimal 120 karakter.')
    .optional()
    .default(''),
  notes: z.string().trim().max(400, 'Catatan maksimal 400 karakter.').optional().default(''),
});

const paymentReversalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Alasan koreksi / reversal minimal 3 karakter.')
    .max(300, 'Alasan koreksi maksimal 300 karakter.'),
});

const voidInvoiceSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Alasan pembatalan (void) invoice minimal 3 karakter.')
    .max(300, 'Alasan void maksimal 300 karakter.'),
});

export function validateRecordPaymentInput(input, maxAllowedBalanceDue = null) {
  const parsed = recordPaymentSchema.safeParse({
    amount: input?.amount,
    paymentMethod: input?.paymentMethod,
    receivedDate: input?.receivedDate || '',
    referenceNumber: input?.referenceNumber || '',
    notes: input?.notes || '',
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] || 'form';
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  if (
    maxAllowedBalanceDue !== null &&
    maxAllowedBalanceDue !== undefined &&
    parsed.data.amount > toNonNegativeRupiahInt(maxAllowedBalanceDue)
  ) {
    return {
      isValid: false,
      errors: {
        amount: `Nominal pembayaran melebihi sisa tagihan (maksimal Rp ${toNonNegativeRupiahInt(maxAllowedBalanceDue).toLocaleString('id-ID')}).`,
      },
      data: null,
    };
  }

  return { isValid: true, errors: {}, data: parsed.data };
}

export function validatePaymentReversalInput(input) {
  const parsed = paymentReversalSchema.safeParse({
    reason: input?.reason || '',
  });

  if (!parsed.success) {
    return {
      isValid: false,
      errors: { reason: parsed.error.issues[0]?.message || 'Alasan koreksi wajib diisi.' },
      data: null,
    };
  }

  return { isValid: true, errors: {}, data: parsed.data };
}

export function validateVoidInvoiceInput(input) {
  const parsed = voidInvoiceSchema.safeParse({
    reason: input?.reason || '',
  });

  if (!parsed.success) {
    return {
      isValid: false,
      errors: { reason: parsed.error.issues[0]?.message || 'Alasan void invoice wajib diisi.' },
      data: null,
    };
  }

  return { isValid: true, errors: {}, data: parsed.data };
}

/**
 * Normalizes a raw Firestore `invoices/{invoiceId}` document into a safe domain object.
 */
export function normalizeInvoiceRecord(id, data = {}) {
  const bookingId = String(data.bookingId || '').trim();
  const bookingDate = String(data.bookingSnapshot?.bookingDate || '').trim();
  const subtotal = toNonNegativeRupiahInt(data.financialSnapshot?.subtotal);
  const discountAmount = Math.min(
    subtotal,
    toNonNegativeRupiahInt(data.financialSnapshot?.discountAmount),
  );
  const totalAmount = toNonNegativeRupiahInt(
    data.financialSnapshot?.totalAmount ?? Math.max(0, subtotal - discountAmount),
  );
  const amountPaid = Math.min(totalAmount, toNonNegativeRupiahInt(data.amountPaid));
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  const validInvoiceStatuses = Object.values(INVOICE_STATUS);
  const invoiceStatus = validInvoiceStatuses.includes(data.invoiceStatus)
    ? data.invoiceStatus
    : INVOICE_STATUS.ISSUED;

  return {
    id: String(id || data.id || buildInvoiceId(bookingId)),
    invoiceNumber:
      String(data.invoiceNumber || '').trim() ||
      (bookingId ? buildInvoiceNumber({ bookingId, bookingDate }) : ''),
    bookingId,
    customerId: String(data.customerId || '').trim(),
    invoiceStatus,
    currency: 'IDR',
    clientPaymentEvidenceRequired: data.clientPaymentEvidenceRequired === true,
    customerSnapshot: {
      name: String(data.customerSnapshot?.name || '').trim(),
      phone: String(data.customerSnapshot?.phone || '').trim(),
      bandName: String(data.customerSnapshot?.bandName || '').trim(),
    },
    bookingSnapshot: {
      serviceTypeName: String(data.bookingSnapshot?.serviceTypeName || 'Rehearsal').trim(),
      serviceOptionName: String(data.bookingSnapshot?.serviceOptionName || '').trim(),
      studioId: String(data.bookingSnapshot?.studioId || 'room-a').trim(),
      bookingDate,
      startMinute: Number.isFinite(Number(data.bookingSnapshot?.startMinute))
        ? Math.round(Number(data.bookingSnapshot.startMinute))
        : 600,
      endMinute: Number.isFinite(Number(data.bookingSnapshot?.endMinute))
        ? Math.round(Number(data.bookingSnapshot.endMinute))
        : 660,
      durationMinutes: Number.isFinite(Number(data.bookingSnapshot?.durationMinutes))
        ? Math.round(Number(data.bookingSnapshot.durationMinutes))
        : 60,
    },
    financialSnapshot: {
      subtotal,
      discountAmount,
      totalAmount,
    },
    amountPaid,
    balanceDue,
    paymentStatus: computeStoredPaymentStatus(totalAmount, amountPaid),
    invoiceDate: data.invoiceDate ?? data.createdAt ?? null,
    dueDate:
      typeof data.dueDate === 'string' && isValidIsoDateString(data.dueDate)
        ? data.dueDate.trim()
        : null,
    lastPaymentTransactionId: data.lastPaymentTransactionId
      ? String(data.lastPaymentTransactionId).trim()
      : null,
    voidReason: String(data.voidReason || '').trim(),
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || '').trim(),
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || '').trim(),
    version:
      Number.isInteger(Number(data.version)) && Number(data.version) >= 1
        ? Number(data.version)
        : 1,
  };
}

/**
 * Normalizes a raw Firestore `paymentTransactions/{transactionId}` document into a safe domain object.
 */
export function normalizePaymentTransactionRecord(id, data = {}) {
  const validTypes = Object.values(TRANSACTION_TYPE);
  const transactionType = validTypes.includes(data.transactionType)
    ? data.transactionType
    : TRANSACTION_TYPE.PAYMENT;

  const paymentMethod = SUPPORTED_PAYMENT_METHODS.includes(data.paymentMethod)
    ? data.paymentMethod
    : 'cash';

  const validSources = Object.values(PAYMENT_SOURCE);
  const source = validSources.includes(data.source) ? data.source : PAYMENT_SOURCE.MANUAL;

  return {
    id: String(id || data.id || ''),
    invoiceId: String(data.invoiceId || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    bookingId: String(data.bookingId || '').trim(),
    customerId: String(data.customerId || '').trim(),
    transactionType,
    amount: toNonNegativeRupiahInt(data.amount),
    currency: 'IDR',
    paymentMethod,
    receivedAt: data.receivedAt ?? data.createdAt ?? null,
    referenceNumber: String(data.referenceNumber || '').trim(),
    notes: String(data.notes || '').trim(),
    source,
    reversalOfTransactionId: data.reversalOfTransactionId
      ? String(data.reversalOfTransactionId).trim()
      : null,
    recordedByUid: String(data.recordedByUid || '').trim(),
    createdAt: data.createdAt ?? null,
  };
}

/**
 * Constructs an exact 21-key Firestore invoice payload from a booking snapshot.
 * Strictly excludes all internal Staff / Owner / Recording Operator fees.
 */
export function buildInvoiceDocumentFromBooking({
  bookingId,
  booking,
  customerId,
  actorUid,
  timestamp,
  invoiceDate = timestamp,
  dueDate = null,
  initialPaymentTransactionId = null,
  initialPaidAmount = 0,
  clientPaymentEvidenceRequired = false,
}) {
  const cleanBookingId = String(bookingId || booking?.id || '').trim();
  const invoiceId = buildInvoiceId(cleanBookingId);
  const bookingDate = String(booking?.date || '').trim();
  const invoiceNumber = buildInvoiceNumber({ bookingId: cleanBookingId, bookingDate });

  const subtotal = toNonNegativeRupiahInt(booking?.subtotal);
  const discountAmount = Math.min(subtotal, toNonNegativeRupiahInt(booking?.discountAmount));
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const safeInitialPaid = Math.min(totalAmount, toNonNegativeRupiahInt(initialPaidAmount));
  const balanceDue = Math.max(0, totalAmount - safeInitialPaid);

  const canonicalPhone =
    String(booking?.phoneNormalized || '').trim() ||
    normalizePhoneNumber(booking?.phone || '') ||
    String(booking?.phone || '').trim();

  const serviceTypeName = String(
    booking?.serviceTypeName || booking?.serviceLabel || 'Rehearsal',
  ).trim();
  const serviceOptionName = String(
    booking?.serviceOptionName || booking?.packageLabel || booking?.recordingTypeLabel || '',
  ).trim();

  const invoiceDoc = {
    invoiceNumber,
    bookingId: cleanBookingId,
    customerId: String(customerId ?? booking?.customerId ?? '').trim(),
    invoiceStatus: INVOICE_STATUS.ISSUED,
    currency: 'IDR',
    clientPaymentEvidenceRequired: Boolean(clientPaymentEvidenceRequired),
    customerSnapshot: {
      name: String(booking?.customerName || '').trim() || 'Customer',
      phone: canonicalPhone,
      bandName: String(booking?.bandName || '').trim(),
    },
    bookingSnapshot: {
      serviceTypeName,
      serviceOptionName,
      studioId: String(booking?.studioId || 'room-a').trim(),
      bookingDate,
      startMinute: Math.round(Number(booking?.startMinute) || 600),
      endMinute: Math.round(
        Number(booking?.endMinute) ||
          (Number(booking?.startMinute) || 600) + (Number(booking?.durationMinutes) || 60),
      ),
      durationMinutes: Math.round(Number(booking?.durationMinutes) || 60),
    },
    financialSnapshot: {
      subtotal,
      discountAmount,
      totalAmount,
    },
    amountPaid: safeInitialPaid,
    balanceDue,
    paymentStatus: computeStoredPaymentStatus(totalAmount, safeInitialPaid),
    invoiceDate,
    dueDate: typeof dueDate === 'string' && isValidIsoDateString(dueDate) ? dueDate.trim() : null,
    lastPaymentTransactionId: safeInitialPaid > 0 ? initialPaymentTransactionId : null,
    voidReason: '',
    createdAt: timestamp,
    createdByUid: actorUid,
    updatedAt: timestamp,
    updatedByUid: actorUid,
    version: 1,
  };

  return {
    invoiceId,
    invoiceNumber,
    invoiceDoc,
  };
}
