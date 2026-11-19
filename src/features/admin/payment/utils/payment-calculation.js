/**
 * Pure Integer Rupiah Financial Calculations, Metrics Aggregation,
 * and Filter Helpers for Payment & Bill Management (Phase 8).
 */

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { normalizePhoneNumber } from '@/features/admin/customer/utils/phone-number';

import { getTimestampDateIso } from './invoice-format';
import {
  computeStoredPaymentStatus,
  getEffectivePaymentStatus,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  TRANSACTION_TYPE,
} from './invoice-status';

export function toNonNegativeRupiahInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

/**
 * Computes updated invoice payment aggregates after applying a positive payment
 * or compensating reversal in integer Rupiah.
 */
export function computeInvoicePaymentTotals({ totalAmount, currentAmountPaid, deltaAmount }) {
  const safeTotal = toNonNegativeRupiahInt(totalAmount);
  const safeCurrentPaid = toNonNegativeRupiahInt(currentAmountPaid);
  const safeDelta = Math.round(Number(deltaAmount) || 0);
  const nextAmountPaid = Math.max(0, safeCurrentPaid + safeDelta);
  const nextBalanceDue = Math.max(0, safeTotal - nextAmountPaid);
  const nextPaymentStatus = computeStoredPaymentStatus(safeTotal, nextAmountPaid);

  return {
    totalAmount: safeTotal,
    amountPaid: nextAmountPaid,
    balanceDue: nextBalanceDue,
    paymentStatus: nextPaymentStatus,
  };
}

/**
 * Computes Payment and Bill overview metrics accurately without mixing
 * issued billing totals with actual cash received or internal commissions.
 *
 * - `outstandingBalance`: sum(invoice.balanceDue) across all active (issued) invoices
 * - `paymentsReceived`: sum(payment) - sum(reversals) within the active filtered transaction set
 * - `totalInvoices`: count of issued invoices in the active period filter
 * - `unpaidOrPartialCount`: count of active issued invoices in period with balanceDue > 0
 */
export function computeOverviewMetrics({
  allInvoices = [],
  periodInvoices = [],
  periodTransactions = [],
  referenceDateIso = getJakartaTodayIso(),
} = {}) {
  let outstandingBalance = 0;
  let allActiveUnpaidOrPartialCount = 0;
  let overdueCount = 0;

  for (const inv of allInvoices) {
    if (!inv || inv.invoiceStatus !== INVOICE_STATUS.ISSUED) continue;
    const balance = toNonNegativeRupiahInt(inv.balanceDue);
    outstandingBalance += balance;
    if (balance > 0) {
      allActiveUnpaidOrPartialCount += 1;
      if (getEffectivePaymentStatus(inv, referenceDateIso) === PAYMENT_STATUS.OVERDUE) {
        overdueCount += 1;
      }
    }
  }

  let totalInvoices = 0;
  let periodUnpaidOrPartialCount = 0;
  let periodOutstandingBalance = 0;

  for (const inv of periodInvoices) {
    if (!inv || inv.invoiceStatus === INVOICE_STATUS.VOID) continue;
    totalInvoices += 1;
    const balance = toNonNegativeRupiahInt(inv.balanceDue);
    periodOutstandingBalance += balance;
    if (balance > 0) {
      periodUnpaidOrPartialCount += 1;
    }
  }

  let grossPaymentsReceived = 0;
  let totalReversals = 0;
  let paymentCount = 0;
  let reversalCount = 0;

  for (const tx of periodTransactions) {
    if (!tx) continue;
    const amount = toNonNegativeRupiahInt(tx.amount);
    if (tx.transactionType === TRANSACTION_TYPE.REVERSAL) {
      totalReversals += amount;
      reversalCount += 1;
    } else if (tx.transactionType === TRANSACTION_TYPE.PAYMENT) {
      grossPaymentsReceived += amount;
      paymentCount += 1;
    }
  }

  const paymentsReceived = grossPaymentsReceived - totalReversals;

  return {
    outstandingBalance,
    periodOutstandingBalance,
    paymentsReceived,
    grossPaymentsReceived,
    totalReversals,
    paymentCount,
    reversalCount,
    totalInvoices,
    unpaidOrPartialCount: periodUnpaidOrPartialCount,
    allActiveUnpaidOrPartialCount,
    overdueCount,
  };
}

/**
 * Checks whether an invoice matches the active directory filters.
 */
export function filterInvoices({
  invoices = [],
  searchQuery = '',
  invoiceStatus = 'all',
  paymentStatus = 'all',
  studioId = 'all',
  dateFrom = '',
  dateTo = '',
  referenceDateIso = getJakartaTodayIso(),
} = {}) {
  const cleanSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();
  const normalizedSearchPhone = cleanSearch.length >= 4 ? normalizePhoneNumber(cleanSearch) : '';
  const digitsOnlySearch = cleanSearch.replace(/\D/g, '');

  return invoices.filter((inv) => {
    if (!inv) return false;

    if (invoiceStatus !== 'all' && inv.invoiceStatus !== invoiceStatus) {
      return false;
    }

    const effectiveStatus = getEffectivePaymentStatus(inv, referenceDateIso);
    if (paymentStatus !== 'all') {
      if (inv.invoiceStatus === INVOICE_STATUS.VOID) return false;
      if (paymentStatus === PAYMENT_STATUS.OVERDUE) {
        if (effectiveStatus !== PAYMENT_STATUS.OVERDUE) return false;
      } else if (inv.paymentStatus !== paymentStatus) {
        return false;
      }
    }

    if (studioId !== 'all' && inv.bookingSnapshot?.studioId !== studioId) {
      return false;
    }

    const bookingDate = inv.bookingSnapshot?.bookingDate || getTimestampDateIso(inv.invoiceDate);
    if (dateFrom && bookingDate && bookingDate < dateFrom) {
      return false;
    }
    if (dateTo && bookingDate && bookingDate > dateTo) {
      return false;
    }

    if (cleanSearch) {
      const invNumMatch = String(inv.invoiceNumber || '')
        .toLowerCase()
        .includes(cleanSearch);
      const nameMatch = String(inv.customerSnapshot?.name || '')
        .toLowerCase()
        .includes(cleanSearch);
      const bandMatch = String(inv.customerSnapshot?.bandName || '')
        .toLowerCase()
        .includes(cleanSearch);
      const bookingIdMatch = String(inv.bookingId || '')
        .toLowerCase()
        .includes(cleanSearch);

      const rawPhone = String(inv.customerSnapshot?.phone || '');
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const phoneMatch =
        rawPhone.toLowerCase().includes(cleanSearch) ||
        (normalizedSearchPhone && rawPhone === normalizedSearchPhone) ||
        (digitsOnlySearch.length >= 4 && phoneDigits.includes(digitsOnlySearch));

      if (!invNumMatch && !nameMatch && !bandMatch && !phoneMatch && !bookingIdMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks whether payment transactions match the active Transactions tab filters.
 */
export function filterTransactions({
  transactions = [],
  invoicesById = new Map(),
  searchQuery = '',
  paymentMethod = 'all',
  transactionType = 'all',
  dateFrom = '',
  dateTo = '',
} = {}) {
  const cleanSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();

  return transactions.filter((tx) => {
    if (!tx) return false;

    if (paymentMethod !== 'all' && tx.paymentMethod !== paymentMethod) {
      return false;
    }

    if (transactionType !== 'all' && tx.transactionType !== transactionType) {
      return false;
    }

    const txDateIso = getTimestampDateIso(tx.receivedAt || tx.createdAt);
    if (dateFrom && txDateIso && txDateIso < dateFrom) {
      return false;
    }
    if (dateTo && txDateIso && txDateIso > dateTo) {
      return false;
    }

    if (cleanSearch) {
      const linkedInvoice = invoicesById.get(tx.invoiceId) || null;
      const idMatch = String(tx.id || '')
        .toLowerCase()
        .includes(cleanSearch);
      const invNumMatch = String(tx.invoiceNumber || '')
        .toLowerCase()
        .includes(cleanSearch);
      const refMatch = String(tx.referenceNumber || '')
        .toLowerCase()
        .includes(cleanSearch);
      const notesMatch = String(tx.notes || '')
        .toLowerCase()
        .includes(cleanSearch);
      const customerNameMatch = String(linkedInvoice?.customerSnapshot?.name || '')
        .toLowerCase()
        .includes(cleanSearch);
      const bandMatch = String(linkedInvoice?.customerSnapshot?.bandName || '')
        .toLowerCase()
        .includes(cleanSearch);

      if (
        !idMatch &&
        !invNumMatch &&
        !refMatch &&
        !notesMatch &&
        !customerNameMatch &&
        !bandMatch
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Resolves the latest authoritative payment view for a Calendar booking:
 * - Uses the linked Invoice aggregate whenever an invoice exists (never stale `initialPaymentStatus`)
 * - Falls back to booking initial snapshot only for legacy bookings without an invoice yet
 */
export function resolveBookingLatestPaymentView(booking, invoice = null) {
  if (invoice && invoice.id) {
    const effectiveStatus = getEffectivePaymentStatus(invoice);
    const totalAmount = toNonNegativeRupiahInt(invoice.financialSnapshot?.totalAmount);
    const amountPaid = toNonNegativeRupiahInt(invoice.amountPaid);
    const balanceDue = toNonNegativeRupiahInt(invoice.balanceDue);

    return {
      source: 'invoice',
      hasInvoice: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: invoice.invoiceStatus,
      paymentStatus: effectiveStatus,
      storedPaymentStatus: invoice.paymentStatus,
      totalAmount,
      amountPaid,
      balanceDue,
      isSnapshotMismatch: booking && toNonNegativeRupiahInt(booking.totalAmount) !== totalAmount,
    };
  }

  const totalAmount = toNonNegativeRupiahInt(booking?.totalAmount);
  const initialPaidAmount = Math.min(
    totalAmount,
    toNonNegativeRupiahInt(booking?.initialPaidAmount),
  );
  const balanceDue = Math.max(0, totalAmount - initialPaidAmount);
  const storedPaymentStatus =
    booking?.initialPaymentStatus || computeStoredPaymentStatus(totalAmount, initialPaidAmount);

  return {
    source: 'booking_snapshot',
    hasInvoice: false,
    invoiceId: '',
    invoiceNumber: '',
    invoiceStatus: '',
    paymentStatus: storedPaymentStatus,
    storedPaymentStatus,
    totalAmount,
    amountPaid: initialPaidAmount,
    balanceDue,
    isSnapshotMismatch: false,
  };
}
