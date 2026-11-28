import { STUDIO_ROOMS } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import {
  getEffectivePaymentStatus,
  INVOICE_STATUS,
  isInvoiceOverdue,
  PAYMENT_STATUS,
  TRANSACTION_TYPE,
} from '@/features/admin/payment/utils/invoice-status';
import { toNonNegativeRupiahInt } from '@/features/admin/payment/utils/payment-calculation';

export const CLIENT_INVOICE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const CLIENT_PAYMENT_METHOD_LABELS = Object.freeze({
  cash: 'Cash',
  transfer: 'Bank Transfer',
  qris: 'QRIS',
  other: 'Other',
});

export const CLIENT_TRANSACTION_TYPE_LABELS = Object.freeze({
  [TRANSACTION_TYPE.PAYMENT]: 'Payment Received',
  [TRANSACTION_TYPE.REVERSAL]: 'Payment Correction',
});

/**
 * Only `issued` and `void` invoices are customer-visible.
 * `draft` invoices are strictly internal and never exposed to Client Portal.
 */
export function isCustomerVisibleInvoiceStatus(invoiceStatus) {
  return invoiceStatus === INVOICE_STATUS.ISSUED || invoiceStatus === INVOICE_STATUS.VOID;
}

/**
 * Customer-safe allow-list projection for an invoice document.
 * Strips internal identifiers (`customerId`, `createdByUid`, `updatedByUid`,
 * `lastPaymentTransactionId`, `voidReason`) and preserves immutable snapshots.
 */
export function projectClientInvoiceRecord(idOrRecord, maybeRawData = undefined) {
  const normalized =
    maybeRawData !== undefined
      ? normalizeInvoiceRecord(idOrRecord, maybeRawData)
      : idOrRecord && typeof idOrRecord === 'object'
        ? normalizeInvoiceRecord(idOrRecord.id, idOrRecord)
        : null;

  if (!normalized || !normalized.id) return null;
  if (!isCustomerVisibleInvoiceStatus(normalized.invoiceStatus)) {
    return null;
  }

  return {
    id: normalized.id,
    invoiceNumber: normalized.invoiceNumber,
    bookingId: normalized.bookingId,
    invoiceStatus: normalized.invoiceStatus,
    currency: 'IDR',
    clientPaymentEvidenceRequired: Boolean(normalized.clientPaymentEvidenceRequired),
    customerSnapshot: {
      name: normalized.customerSnapshot.name,
      phone: normalized.customerSnapshot.phone,
      bandName: normalized.customerSnapshot.bandName,
    },
    bookingSnapshot: {
      serviceTypeName: normalized.bookingSnapshot.serviceTypeName,
      serviceOptionName: normalized.bookingSnapshot.serviceOptionName,
      studioId: normalized.bookingSnapshot.studioId,
      bookingDate: normalized.bookingSnapshot.bookingDate,
      startMinute: normalized.bookingSnapshot.startMinute,
      endMinute: normalized.bookingSnapshot.endMinute,
      durationMinutes: normalized.bookingSnapshot.durationMinutes,
    },
    financialSnapshot: {
      subtotal: toNonNegativeRupiahInt(normalized.financialSnapshot.subtotal),
      discountAmount: toNonNegativeRupiahInt(normalized.financialSnapshot.discountAmount),
      totalAmount: toNonNegativeRupiahInt(normalized.financialSnapshot.totalAmount),
    },
    adjustmentTotal: Number.isFinite(Number(normalized.adjustmentTotal))
      ? Math.round(Number(normalized.adjustmentTotal))
      : 0,
    effectiveTotalAmount: toNonNegativeRupiahInt(
      normalized.effectiveTotalAmount ?? normalized.financialSnapshot.totalAmount,
    ),
    amountPaid: toNonNegativeRupiahInt(normalized.amountPaid),
    overpaidCreditBalance: toNonNegativeRupiahInt(normalized.overpaidCreditBalance),
    balanceDue: toNonNegativeRupiahInt(normalized.balanceDue),
    paymentStatus: normalized.paymentStatus,
    adjustmentCount: Math.max(0, Math.round(Number(normalized.adjustmentCount) || 0)),
    ...(Number.isInteger(normalized.minimumDepositAmount)
      ? { minimumDepositAmount: normalized.minimumDepositAmount }
      : {}),
    ...(normalized.depositStatus ? { depositStatus: normalized.depositStatus } : {}),
    ...(normalized.depositPolicySnapshot
      ? {
          depositPolicySnapshot: {
            type: normalized.depositPolicySnapshot.type,
            minimumDepositAmount: toNonNegativeRupiahInt(
              normalized.depositPolicySnapshot.minimumDepositAmount,
            ),
          },
        }
      : {}),
    ...(normalized.balanceDuePolicy
      ? {
          balanceDuePolicy: {
            trigger: normalized.balanceDuePolicy.trigger,
            dueDate: normalized.balanceDuePolicy.dueDate,
          },
        }
      : {}),
    invoiceDate: normalized.invoiceDate,
    dueDate: normalized.dueDate,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
}

export function getClientPaymentMethodLabel(paymentMethod) {
  const key = String(paymentMethod || '')
    .trim()
    .toLowerCase();
  return CLIENT_PAYMENT_METHOD_LABELS[key] || CLIENT_PAYMENT_METHOD_LABELS.other;
}

export function getClientTransactionTypeLabel(transactionType) {
  return transactionType === TRANSACTION_TYPE.REVERSAL
    ? CLIENT_TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.REVERSAL]
    : CLIENT_TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.PAYMENT];
}

export function sortClientTransactions(transactions = []) {
  return [...transactions].sort((a, b) => {
    const timeB = getTimestampMillis(b?.receivedAt) || getTimestampMillis(b?.createdAt);
    const timeA = getTimestampMillis(a?.receivedAt) || getTimestampMillis(a?.createdAt);
    if (timeB !== timeA) return timeB - timeA;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}

/**
 * Customer-safe allow-list projection for payment ledger entries.
 * Explicitly strips `recordedByUid`, `customerId`, `notes`, `source`, and internal
 * reversal target IDs, while marking reversed payments clearly as corrected entries.
 */
export function projectClientPaymentTransactions(rawTransactions = []) {
  const normalizedList = [];
  for (const item of Array.isArray(rawTransactions) ? rawTransactions : []) {
    if (!item) continue;
    const normalized = normalizePaymentTransactionRecord(item.id, item);
    if (normalized && normalized.id) {
      normalizedList.push(normalized);
    }
  }

  const reversedTransactionIds = new Set();
  for (const tx of normalizedList) {
    if (tx.transactionType === TRANSACTION_TYPE.REVERSAL && tx.reversalOfTransactionId) {
      reversedTransactionIds.add(tx.reversalOfTransactionId);
    }
  }

  const sorted = sortClientTransactions(normalizedList);

  const transactions = sorted.map((tx) => ({
    id: tx.id,
    invoiceId: tx.invoiceId,
    invoiceNumber: tx.invoiceNumber,
    transactionType: tx.transactionType,
    transactionTypeLabel: getClientTransactionTypeLabel(tx.transactionType),
    amount: toNonNegativeRupiahInt(tx.amount),
    currency: 'IDR',
    paymentMethod: tx.paymentMethod,
    paymentMethodLabel: getClientPaymentMethodLabel(tx.paymentMethod),
    receivedAt: tx.receivedAt || tx.createdAt || null,
    referenceNumber: String(tx.referenceNumber || '').trim(),
    isReversed:
      tx.transactionType === TRANSACTION_TYPE.PAYMENT && reversedTransactionIds.has(tx.id),
  }));

  return {
    transactions,
    reversedTransactionIds,
  };
}

/**
 * Maps internal `invoiceStatus` + dynamic `getEffectivePaymentStatus()` into
 * Client Portal display labels & Spatial Ambient badge tones:
 * - issued + unpaid   -> Unpaid
 * - issued + partial  -> Partial Payment
 * - issued + paid     -> Paid
 * - issued + overdue  -> Overdue
 * - void              -> Cancelled
 */
export function getClientInvoiceStatusDisplay(invoice, referenceDateIso = getJakartaTodayIso()) {
  if (!invoice || invoice.invoiceStatus === INVOICE_STATUS.VOID) {
    return {
      filterKey: 'cancelled',
      label: 'Cancelled',
      invoiceStatusLabel: 'Cancelled',
      tone: 'neutral',
      isOverdue: false,
      isSettled: false,
      isCancelled: true,
    };
  }

  const effective = getEffectivePaymentStatus(invoice, referenceDateIso);
  const overdue = isInvoiceOverdue(invoice, referenceDateIso);

  if (effective === PAYMENT_STATUS.OVERDUE || overdue) {
    return {
      filterKey: 'overdue',
      label: 'Overdue',
      invoiceStatusLabel: 'Issued',
      tone: 'danger',
      isOverdue: true,
      isSettled: false,
      isCancelled: false,
    };
  }

  if (effective === PAYMENT_STATUS.PARTIAL) {
    return {
      filterKey: 'partial',
      label: 'Partial Payment',
      invoiceStatusLabel: 'Issued',
      tone: 'amber',
      isOverdue: false,
      isSettled: false,
      isCancelled: false,
    };
  }

  if (effective === PAYMENT_STATUS.OVERPAID_CREDIT_PENDING) {
    return {
      filterKey: 'paid',
      label: 'Credit Pending',
      invoiceStatusLabel: 'Issued',
      tone: 'amber',
      isOverdue: false,
      isOverpaid: true,
      isSettled: true,
      isCancelled: false,
    };
  }

  if (effective === PAYMENT_STATUS.PAID) {
    return {
      filterKey: 'paid',
      label: 'Paid',
      invoiceStatusLabel: 'Issued',
      tone: 'emerald',
      isOverdue: false,
      isSettled: true,
      isCancelled: false,
    };
  }

  return {
    filterKey: 'unpaid',
    label: 'Unpaid',
    invoiceStatusLabel: 'Issued',
    tone: 'orange',
    isOverdue: false,
    isSettled: false,
    isCancelled: false,
  };
}

/**
 * Sorts customer invoices newest first using `invoiceDate` with fallback to `createdAt`.
 * Handles Firestore Timestamp, Date, `{ seconds }`, and ISO strings uniformly.
 */
export function sortClientInvoices(invoices = []) {
  return [...invoices].sort((a, b) => {
    const timeB = getTimestampMillis(b?.invoiceDate) || getTimestampMillis(b?.createdAt);
    const timeA = getTimestampMillis(a?.invoiceDate) || getTimestampMillis(a?.createdAt);
    if (timeB !== timeA) return timeB - timeA;
    return String(b?.invoiceNumber || '').localeCompare(String(a?.invoiceNumber || ''));
  });
}

/**
 * Computes Module A Billing Overview summary metrics strictly from the Client's own invoices:
 * - Total Outstanding: SUM(balanceDue) where invoiceStatus === 'issued'
 * - Total Paid:        SUM(amountPaid) where invoiceStatus === 'issued'
 * - Unpaid Invoices:   COUNT where invoiceStatus === 'issued' && balanceDue > 0
 * - Overdue Invoices:  COUNT where invoiceStatus === 'issued' && effectiveStatus === 'overdue'
 */
export function computeClientBillingMetrics(invoices = [], referenceDateIso = getJakartaTodayIso()) {
  let totalOutstanding = 0;
  let totalPaid = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  const filterCounts = {
    all: 0,
    unpaid: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };

  for (const inv of Array.isArray(invoices) ? invoices : []) {
    if (!inv || !isCustomerVisibleInvoiceStatus(inv.invoiceStatus)) continue;

    filterCounts.all += 1;
    const statusDisplay = getClientInvoiceStatusDisplay(inv, referenceDateIso);
    if (statusDisplay.filterKey in filterCounts) {
      filterCounts[statusDisplay.filterKey] += 1;
    }

    if (inv.invoiceStatus !== INVOICE_STATUS.ISSUED) {
      continue;
    }

    const balanceDue = toNonNegativeRupiahInt(inv.balanceDue);
    const amountPaid = toNonNegativeRupiahInt(inv.amountPaid);

    totalOutstanding += balanceDue;
    totalPaid += amountPaid;

    if (balanceDue > 0) {
      unpaidCount += 1;
    }

    if (getEffectivePaymentStatus(inv, referenceDateIso) === PAYMENT_STATUS.OVERDUE) {
      overdueCount += 1;
    }
  }

  return {
    totalOutstanding,
    totalPaid,
    unpaidCount,
    overdueCount,
    filterCounts,
  };
}

/**
 * Local in-memory search and filter over already-subscribed customer invoices.
 * Never triggers additional Firestore reads on keystroke or filter change.
 */
export function filterClientInvoices({
  invoices = [],
  statusFilter = 'all',
  searchQuery = '',
  referenceDateIso = getJakartaTodayIso(),
} = {}) {
  const cleanFilter = String(statusFilter || 'all')
    .trim()
    .toLowerCase();
  const cleanSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();

  return (Array.isArray(invoices) ? invoices : []).filter((inv) => {
    if (!inv || !isCustomerVisibleInvoiceStatus(inv.invoiceStatus)) {
      return false;
    }

    const display = getClientInvoiceStatusDisplay(inv, referenceDateIso);
    if (cleanFilter !== 'all' && display.filterKey !== cleanFilter) {
      return false;
    }

    if (cleanSearch) {
      const invoiceNumber = String(inv.invoiceNumber || '').toLowerCase();
      const bookingRef = String(inv.bookingId || '').toLowerCase();
      const serviceType = String(inv.bookingSnapshot?.serviceTypeName || '').toLowerCase();
      const serviceOption = String(inv.bookingSnapshot?.serviceOptionName || '').toLowerCase();
      const combinedService = formatClientInvoiceServiceTitle(inv.bookingSnapshot).toLowerCase();

      if (
        !invoiceNumber.includes(cleanSearch) &&
        !bookingRef.includes(cleanSearch) &&
        !serviceType.includes(cleanSearch) &&
        !serviceOption.includes(cleanSearch) &&
        !combinedService.includes(cleanSearch)
      ) {
        return false;
      }
    }

    return true;
  });
}

export function formatClientInvoiceServiceTitle(bookingSnapshot) {
  const serviceType = String(bookingSnapshot?.serviceTypeName || 'Studio Session').trim();
  const serviceOption = String(bookingSnapshot?.serviceOptionName || '').trim();
  if (serviceOption && serviceOption.toLowerCase() !== serviceType.toLowerCase()) {
    return `${serviceType} · ${serviceOption}`;
  }
  return serviceType || 'Studio Session';
}

export function formatClientStudioRoom(studioId) {
  const cleanId = String(studioId || '').trim();
  if (!cleanId) return 'Studio';
  if (Array.isArray(STUDIO_ROOMS)) {
    const matched = STUDIO_ROOMS.find((room) => room.id === cleanId);
    if (matched?.name) return matched.name;
    if (matched?.label) return matched.label;
  }
  if (cleanId === 'room-a') return 'Room A';
  if (cleanId === 'room-b') return 'Room B';
  return cleanId;
}

export function formatClientRupiah(amount) {
  return formatRupiah(toNonNegativeRupiahInt(amount)).replace(/\u00A0/g, ' ');
}

/**
 * Builds dynamic WhatsApp confirmation link for an outstanding invoice using
 * public site settings (`publicWhatsappNumber` + `studioName`).
 */
export function buildClientInvoiceWhatsAppUrl({
  publicWhatsappNumber = '',
  studioName = '37 Music Studio',
  invoiceNumber = '',
} = {}) {
  const digits = String(publicWhatsappNumber || '').replace(/\D/g, '');
  const cleanInvoiceNumber = String(invoiceNumber || '').trim();
  if (!digits || !cleanInvoiceNumber) return '';

  const cleanStudioName = String(studioName || '37 Music Studio').trim() || '37 Music Studio';
  const message = `Halo ${cleanStudioName}, saya ingin konfirmasi pembayaran untuk invoice ${cleanInvoiceNumber}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function mapClientBillingErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('permission-denied')) {
    return 'You do not have permission to view these billing records. Please sign in again if your session changed.';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Unable to reach the billing ledger right now. Please check your connection and try again.';
  }
  return 'Unable to load your billing information right now. Please try again.';
}

/**
 * Triggers native browser A4 printing (`window.print()`) with `#studio-print-portal`
 * isolation (`body[data-studio-print-mode='true']`), hiding sidebar, topbar, dialogs,
 * backdrops, and interactive buttons during `@media print`.
 */
export function triggerClientStudioPrint() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  document.body.setAttribute('data-studio-print-mode', 'true');

  const cleanup = () => {
    document.body.removeAttribute('data-studio-print-mode');
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  window.print?.();
}
