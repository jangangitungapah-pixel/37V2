/**
 * Invoice & Payment Status Constants, Overdue Computation (Asia/Jakarta),
 * and UI Metadata Helpers (Phase 8 — Payment & Bill Management).
 */

import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  VOID: 'void',
};

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERPAID_CREDIT_PENDING: 'overpaid_credit_pending',
  OVERDUE: 'overdue',
};

export const TRANSACTION_TYPE = {
  PAYMENT: 'payment',
  REVERSAL: 'reversal',
};

export const PAYMENT_SOURCE = {
  BOOKING_INITIAL_PAYMENT: 'booking_initial_payment',
  MANUAL: 'manual',
  STAFF_CASH_DESK: 'staff_cash_desk',
  LEGACY_INITIAL_SNAPSHOT: 'legacy_initial_snapshot',
  CLIENT_EVIDENCE_VERIFIED: 'client_evidence_verified',
  REVERSAL: 'reversal',
};

export const SUPPORTED_PAYMENT_METHODS = ['cash', 'transfer', 'qris', 'other'];

export const ADJUSTMENT_CATEGORIES = {
  DURATION_CHANGE: 'duration_change',
  ROOM_CHANGE: 'room_change',
  SERVICE_CHANGE: 'service_change',
  SCOPE_ADDENDUM: 'scope_addendum',
  DISCOUNT_CREDIT: 'discount_credit',
  CANCELLATION_FEE: 'cancellation_fee',
  MANUAL_CORRECTION: 'manual_correction',
};

export const SUPPORTED_ADJUSTMENT_CATEGORIES = [
  ADJUSTMENT_CATEGORIES.DURATION_CHANGE,
  ADJUSTMENT_CATEGORIES.ROOM_CHANGE,
  ADJUSTMENT_CATEGORIES.SERVICE_CHANGE,
  ADJUSTMENT_CATEGORIES.SCOPE_ADDENDUM,
  ADJUSTMENT_CATEGORIES.DISCOUNT_CREDIT,
  ADJUSTMENT_CATEGORIES.CANCELLATION_FEE,
  ADJUSTMENT_CATEGORIES.MANUAL_CORRECTION,
];

export const ADJUSTMENT_CATEGORY_OPTIONS = [
  { id: ADJUSTMENT_CATEGORIES.MANUAL_CORRECTION, label: 'Koreksi Manual Tagihan', clientLabel: 'Manual Correction' },
  { id: ADJUSTMENT_CATEGORIES.DURATION_CHANGE, label: 'Perubahan Durasi', clientLabel: 'Duration Adjustment' },
  { id: ADJUSTMENT_CATEGORIES.ROOM_CHANGE, label: 'Perubahan Ruangan', clientLabel: 'Room Adjustment' },
  { id: ADJUSTMENT_CATEGORIES.SERVICE_CHANGE, label: 'Perubahan Layanan / Paket', clientLabel: 'Service Adjustment' },
  { id: ADJUSTMENT_CATEGORIES.SCOPE_ADDENDUM, label: 'Tambahan Scope / Addendum', clientLabel: 'Scope Addendum' },
  { id: ADJUSTMENT_CATEGORIES.DISCOUNT_CREDIT, label: 'Diskon / Kredit Tambahan', clientLabel: 'Discount / Credit' },
  { id: ADJUSTMENT_CATEGORIES.CANCELLATION_FEE, label: 'Biaya Pembatalan', clientLabel: 'Cancellation Fee' },
];

export const INVOICE_STATUS_OPTIONS = [
  { id: 'all', label: 'Semua Status' },
  { id: INVOICE_STATUS.ISSUED, label: 'Aktif' },
  { id: INVOICE_STATUS.DRAFT, label: 'Draf' },
  { id: INVOICE_STATUS.VOID, label: 'Dibatalkan' },
];

export const INVOICE_PAYMENT_STATUS_OPTIONS = [
  { id: 'all', label: 'Semua Status Pembayaran', compactLabel: 'Semua' },
  { id: PAYMENT_STATUS.UNPAID, label: 'Belum Bayar', compactLabel: 'Belum Bayar' },
  { id: PAYMENT_STATUS.PARTIAL, label: 'DP / Sebagian', compactLabel: 'DP' },
  { id: PAYMENT_STATUS.PAID, label: 'Lunas', compactLabel: 'Lunas' },
  {
    id: PAYMENT_STATUS.OVERPAID_CREDIT_PENDING,
    label: 'Kelebihan Bayar',
    compactLabel: 'Lebih Bayar',
  },
  { id: PAYMENT_STATUS.OVERDUE, label: 'Lewat Tempo', compactLabel: 'Tempo' },
];

export const TRANSACTION_TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'Semua' },
  { id: TRANSACTION_TYPE.PAYMENT, label: 'Pembayaran' },
  { id: TRANSACTION_TYPE.REVERSAL, label: 'Pembatalan' },
];

/**
 * Computes the persisted base payment status (`unpaid` | `partial` | `paid` | `overpaid_credit_pending`)
 * strictly from integer `effectiveTotalAmount`, `amountPaid`, and resolved refund/credit totals.
 */
export function computeStoredPaymentStatus(
  totalAmount,
  amountPaid,
  { refundedTotal = 0, creditConvertedTotal = 0 } = {},
) {
  const safeTotal = Math.max(0, Math.round(Number(totalAmount) || 0));
  const safePaid = Math.max(0, Math.round(Number(amountPaid) || 0));
  const safeRefunded = Math.max(0, Math.round(Number(refundedTotal) || 0));
  const safeCreditConverted = Math.max(0, Math.round(Number(creditConvertedTotal) || 0));
  const overpaidCreditBalance = Math.max(
    0,
    safePaid - safeTotal - safeRefunded - safeCreditConverted,
  );
  if (overpaidCreditBalance > 0) {
    return PAYMENT_STATUS.OVERPAID_CREDIT_PENDING;
  }

  const balanceDue = Math.max(0, safeTotal - safePaid);
  if (balanceDue <= 0) {
    return PAYMENT_STATUS.PAID;
  }
  if (safePaid > 0) {
    return PAYMENT_STATUS.PARTIAL;
  }
  return PAYMENT_STATUS.UNPAID;
}

/**
 * Checks whether an invoice is currently overdue based on local Asia/Jakarta date.
 * - Requires an explicit `dueDate` (`YYYY-MM-DD`)
 * - Never marks an invoice without a dueDate as overdue
 * - Never marks a void or fully paid invoice as overdue
 */
export function isInvoiceOverdue(invoice, referenceDateIso = getJakartaTodayIso()) {
  if (!invoice || typeof invoice !== 'object') return false;
  if (invoice.invoiceStatus === INVOICE_STATUS.VOID) return false;

  const balanceDue = Math.max(0, Math.round(Number(invoice.balanceDue) || 0));
  if (balanceDue <= 0) return false;

  const dueDate = typeof invoice.dueDate === 'string' ? invoice.dueDate.trim() : '';
  if (!dueDate || !isValidIsoDateString(dueDate)) return false;

  const today = isValidIsoDateString(referenceDateIso) ? referenceDateIso : getJakartaTodayIso();
  return dueDate < today;
}

/**
 * Computes the effective display payment status (`unpaid` | `partial` | `paid` | `overdue`).
 */
export function getEffectivePaymentStatus(invoice, referenceDateIso = getJakartaTodayIso()) {
  if (!invoice || typeof invoice !== 'object') return PAYMENT_STATUS.UNPAID;
  if (isInvoiceOverdue(invoice, referenceDateIso)) {
    return PAYMENT_STATUS.OVERDUE;
  }
  const effectiveTotalAmount = Number(
    invoice.effectiveTotalAmount ?? invoice.financialSnapshot?.totalAmount ?? invoice.totalAmount ?? 0,
  );
  const amountPaid = Number(invoice.amountPaid ?? 0);
  return computeStoredPaymentStatus(effectiveTotalAmount, amountPaid, {
    refundedTotal: invoice.refundedTotal,
    creditConvertedTotal: invoice.creditConvertedTotal,
  });
}

export function getInvoiceStatusMeta(invoiceStatus) {
  switch (invoiceStatus) {
    case INVOICE_STATUS.DRAFT:
      return {
        id: INVOICE_STATUS.DRAFT,
        label: 'Draf',
        badgeClass: 'bg-[#151515]/[0.06] text-[#46433D] border-[#151515]/12',
      };
    case INVOICE_STATUS.VOID:
      return {
        id: INVOICE_STATUS.VOID,
        label: 'Dibatalkan',
        badgeClass: 'bg-[#151515] text-[#F1EEE4] border-[#151515]',
      };
    case INVOICE_STATUS.ISSUED:
    default:
      return {
        id: INVOICE_STATUS.ISSUED,
        label: 'Aktif',
        badgeClass: 'bg-white text-[#151515] border-[#151515]/14',
      };
  }
}

export function getPaymentStatusMeta(paymentStatus) {
  switch (paymentStatus) {
    case PAYMENT_STATUS.PAID:
      return {
        id: PAYMENT_STATUS.PAID,
        label: 'Lunas',
        indoLabel: 'Lunas',
        shortLabel: 'Lunas',
        badgeClass: 'bg-[#EDF8C2] text-[#243300] border-[#8BAD12]/35',
      };
    case PAYMENT_STATUS.PARTIAL:
      return {
        id: PAYMENT_STATUS.PARTIAL,
        label: 'DP / Sebagian',
        indoLabel: 'DP / Sebagian',
        shortLabel: 'DP',
        badgeClass: 'bg-[#FEF4DD] text-[#8A4B08] border-amber-500/25',
      };
    case PAYMENT_STATUS.OVERPAID_CREDIT_PENDING:
      return {
        id: PAYMENT_STATUS.OVERPAID_CREDIT_PENDING,
        label: 'Kelebihan Bayar',
        indoLabel: 'Kelebihan Bayar (Perlu Tindak Lanjut)',
        shortLabel: 'Lebih Bayar',
        badgeClass: 'bg-[#FEF4DD] text-[#8A4B08] border-amber-500/35',
      };
    case PAYMENT_STATUS.OVERDUE:
      return {
        id: PAYMENT_STATUS.OVERDUE,
        label: 'Lewat Tempo',
        indoLabel: 'Lewat Jatuh Tempo',
        shortLabel: 'Lewat Tempo',
        badgeClass: 'bg-[#FFEDE8] text-[#B92B0C] border-[#FF4B22]/25',
      };
    case PAYMENT_STATUS.UNPAID:
    default:
      return {
        id: PAYMENT_STATUS.UNPAID,
        label: 'Belum Bayar',
        indoLabel: 'Belum Bayar',
        shortLabel: 'Belum Bayar',
        badgeClass: 'bg-[#F8F6EF] text-[#46433D] border-[#151515]/12',
      };
  }
}

export function getTransactionTypeMeta(transactionType) {
  if (transactionType === TRANSACTION_TYPE.REVERSAL) {
    return {
      id: TRANSACTION_TYPE.REVERSAL,
      label: 'Pembatalan',
      indoLabel: 'Koreksi / Pembatalan',
      badgeClass: 'bg-[#FFEDE8] text-[#B92B0C] border-[#FF4B22]/25',
    };
  }
  return {
    id: TRANSACTION_TYPE.PAYMENT,
    label: 'Pembayaran',
    indoLabel: 'Pembayaran Masuk',
    badgeClass: 'bg-[#EDF8C2] text-[#243300] border-[#8BAD12]/35',
  };
}

export function getPaymentSourceMeta(source) {
  switch (source) {
    case PAYMENT_SOURCE.BOOKING_INITIAL_PAYMENT:
      return {
        id: source,
        label: 'Pembayaran Awal Booking',
        shortLabel: 'DP / Awal Booking',
      };
    case PAYMENT_SOURCE.LEGACY_INITIAL_SNAPSHOT:
      return {
        id: source,
        label: 'Pembayaran Awal (Data Lama)',
        shortLabel: 'Data Lama',
      };
    case PAYMENT_SOURCE.CLIENT_EVIDENCE_VERIFIED:
      return {
        id: source,
        label: 'Bukti Pembayaran Client Portal',
        shortLabel: 'Bukti Client Portal',
      };
    case PAYMENT_SOURCE.STAFF_CASH_DESK:
      return {
        id: source,
        label: 'Kasir Tunai Studio (Staff / Owner)',
        shortLabel: 'Tunai Studio Desk',
      };
    case PAYMENT_SOURCE.REVERSAL:
      return {
        id: source,
        label: 'Koreksi / Pembatalan',
        shortLabel: 'Koreksi Pembatalan',
      };
    case PAYMENT_SOURCE.MANUAL:
    default:
      return {
        id: PAYMENT_SOURCE.MANUAL,
        label: 'Input Pembayaran Manual',
        shortLabel: 'Input Manual',
      };
  }
}

export function getAdjustmentCategoryMeta(category, { locale = 'id' } = {}) {
  const matched = ADJUSTMENT_CATEGORY_OPTIONS.find((opt) => opt.id === category);
  if (matched) {
    return {
      id: matched.id,
      label: locale === 'en' ? matched.clientLabel : matched.label,
    };
  }
  return {
    id: String(category || ''),
    label: locale === 'en' ? 'Price Adjustment' : 'Penyesuaian Harga',
  };
}
