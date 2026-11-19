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
  OVERDUE: 'overdue',
};

export const TRANSACTION_TYPE = {
  PAYMENT: 'payment',
  REVERSAL: 'reversal',
};

export const PAYMENT_SOURCE = {
  BOOKING_INITIAL_PAYMENT: 'booking_initial_payment',
  MANUAL: 'manual',
  LEGACY_INITIAL_SNAPSHOT: 'legacy_initial_snapshot',
  REVERSAL: 'reversal',
};

export const SUPPORTED_PAYMENT_METHODS = ['cash', 'transfer', 'qris', 'other'];

export const INVOICE_STATUS_OPTIONS = [
  { id: 'all', label: 'All Invoice Status' },
  { id: INVOICE_STATUS.ISSUED, label: 'Issued' },
  { id: INVOICE_STATUS.DRAFT, label: 'Draft' },
  { id: INVOICE_STATUS.VOID, label: 'Void' },
];

export const INVOICE_PAYMENT_STATUS_OPTIONS = [
  { id: 'all', label: 'All Payment Status', compactLabel: 'All' },
  { id: PAYMENT_STATUS.UNPAID, label: 'Unpaid', compactLabel: 'Unpaid' },
  { id: PAYMENT_STATUS.PARTIAL, label: 'Partial', compactLabel: 'Partial' },
  { id: PAYMENT_STATUS.PAID, label: 'Paid', compactLabel: 'Paid' },
  { id: PAYMENT_STATUS.OVERDUE, label: 'Overdue', compactLabel: 'Overdue' },
];

export const TRANSACTION_TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'All Types' },
  { id: TRANSACTION_TYPE.PAYMENT, label: 'Payment' },
  { id: TRANSACTION_TYPE.REVERSAL, label: 'Reversal' },
];

/**
 * Computes the persisted base payment status (`unpaid` | `partial` | `paid`)
 * strictly from integer `totalAmount` and `amountPaid`.
 */
export function computeStoredPaymentStatus(totalAmount, amountPaid) {
  const safeTotal = Math.max(0, Math.round(Number(totalAmount) || 0));
  const safePaid = Math.max(0, Math.round(Number(amountPaid) || 0));
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
  const totalAmount = Number(invoice.financialSnapshot?.totalAmount ?? invoice.totalAmount ?? 0);
  const amountPaid = Number(invoice.amountPaid ?? 0);
  return computeStoredPaymentStatus(totalAmount, amountPaid);
}

export function getInvoiceStatusMeta(invoiceStatus) {
  switch (invoiceStatus) {
    case INVOICE_STATUS.DRAFT:
      return {
        id: INVOICE_STATUS.DRAFT,
        label: 'Draft',
        badgeClass: 'bg-neutral-200 text-neutral-800 border-studio-ink',
      };
    case INVOICE_STATUS.VOID:
      return {
        id: INVOICE_STATUS.VOID,
        label: 'Void',
        badgeClass: 'bg-neutral-800 text-neutral-100 border-studio-ink',
      };
    case INVOICE_STATUS.ISSUED:
    default:
      return {
        id: INVOICE_STATUS.ISSUED,
        label: 'Issued',
        badgeClass: 'bg-studio-white text-studio-ink border-studio-ink',
      };
  }
}

export function getPaymentStatusMeta(paymentStatus) {
  switch (paymentStatus) {
    case PAYMENT_STATUS.PAID:
      return {
        id: PAYMENT_STATUS.PAID,
        label: 'Paid',
        indoLabel: 'Lunas',
        shortLabel: 'Lunas',
        badgeClass: 'bg-studio-lime text-studio-ink border-studio-ink',
      };
    case PAYMENT_STATUS.PARTIAL:
      return {
        id: PAYMENT_STATUS.PARTIAL,
        label: 'Partial',
        indoLabel: 'DP / Sebagian',
        shortLabel: 'DP',
        badgeClass: 'bg-amber-200 text-studio-ink border-studio-ink',
      };
    case PAYMENT_STATUS.OVERDUE:
      return {
        id: PAYMENT_STATUS.OVERDUE,
        label: 'Overdue',
        indoLabel: 'Jatuh Tempo',
        shortLabel: 'Overdue',
        badgeClass: 'bg-studio-orange text-studio-white border-studio-ink',
      };
    case PAYMENT_STATUS.UNPAID:
    default:
      return {
        id: PAYMENT_STATUS.UNPAID,
        label: 'Unpaid',
        indoLabel: 'Belum Bayar',
        shortLabel: 'Belum Bayar',
        badgeClass: 'bg-studio-ivory text-studio-ink border-studio-ink',
      };
  }
}

export function getTransactionTypeMeta(transactionType) {
  if (transactionType === TRANSACTION_TYPE.REVERSAL) {
    return {
      id: TRANSACTION_TYPE.REVERSAL,
      label: 'Reversal',
      indoLabel: 'Koreksi / Reversal',
      badgeClass: 'bg-studio-orange text-studio-white border-studio-ink',
    };
  }
  return {
    id: TRANSACTION_TYPE.PAYMENT,
    label: 'Payment',
    indoLabel: 'Pembayaran Masuk',
    badgeClass: 'bg-studio-lime text-studio-ink border-studio-ink',
  };
}

export function getPaymentSourceMeta(source) {
  switch (source) {
    case PAYMENT_SOURCE.BOOKING_INITIAL_PAYMENT:
      return {
        id: source,
        label: 'Initial Booking Payment',
        shortLabel: 'DP / Awal Booking',
      };
    case PAYMENT_SOURCE.LEGACY_INITIAL_SNAPSHOT:
      return {
        id: source,
        label: 'Legacy Initial Payment',
        shortLabel: 'Legacy Initial',
      };
    case PAYMENT_SOURCE.REVERSAL:
      return {
        id: source,
        label: 'Correction Reversal',
        shortLabel: 'Koreksi Reversal',
      };
    case PAYMENT_SOURCE.MANUAL:
    default:
      return {
        id: PAYMENT_SOURCE.MANUAL,
        label: 'Manual Ledger Entry',
        shortLabel: 'Manual Payment',
      };
  }
}
