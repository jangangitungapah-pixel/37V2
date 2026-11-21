/**
 * Indonesian Rupiah Formatting, Date Display, and RFC-4180 CSV Export Helpers
 * for Pembukuan (Bookkeeping & Financial Control Center).
 */

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  getBookkeepingPaymentMethodLabel,
  getLedgerSourceGroupLabel,
} from '../config/bookkeeping-config';
import { parseJakartaTimestamp } from './bookkeeping-period';

/**
 * Formats integer Rupiah values with distinct negative sign display (`-Rp 250.000`).
 */
export function formatBookkeepingRupiah(amount, { showPositiveSign = false } = {}) {
  const numeric = Math.round(Number(amount) || 0);
  if (numeric < 0) {
    return `-${formatRupiah(Math.abs(numeric))}`;
  }
  if (numeric > 0 && showPositiveSign) {
    return `+${formatRupiah(numeric)}`;
  }
  return formatRupiah(numeric);
}

/**
 * Formats a Firestore/Date timestamp into Indonesian date display (WIB).
 */
export function formatBookkeepingDate(value) {
  const parsed = parseJakartaTimestamp(value);
  if (!parsed.isValid || !parsed.dateIso) return '-';
  return formatIndonesianDateMedium(parsed.dateIso);
}

/**
 * Formats a Firestore/Date timestamp with hours & minutes (WIB).
 */
export function formatBookkeepingDateTime(value) {
  if (!value) return '-';
  return formatIndonesianTimestamp(value);
}

/**
 * Escapes a value cleanly according to RFC-4180 CSV rules while guarding against
 * spreadsheet formula injection when cells start with `=`, `+`, `-`, or `@`.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds UTF-8 CSV content with numeric Rupiah columns preserved as raw integers.
 */
export function buildCsvContent(headers = [], rows = []) {
  const lines = [
    headers.map((h) => escapeCsvCell(h)).join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          if (typeof cell === 'number' && Number.isFinite(cell)) {
            return String(Math.round(cell));
          }
          return escapeCsvCell(cell);
        })
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

/**
 * CSV builder for unified Transactions Ledger (reflects active UI filters).
 * Numeric `Amount (IDR)` contains pure integer values without currency formatting.
 */
export function buildLedgerCsv(items = []) {
  const headers = [
    'Date (ISO)',
    'Date',
    'Description',
    'Category',
    'Source',
    'Type',
    'Nature',
    'Amount (IDR)',
    'Status',
    'Payment Method',
    'Reference',
  ];

  const rows = (items || []).map((item) => [
    item.dateIso || '',
    formatBookkeepingDate(item.date),
    item.description || '',
    item.categoryLabel || '',
    getLedgerSourceGroupLabel(item.sourceGroup),
    item.direction === 'income' ? 'Income' : 'Expense',
    item.presentationType || '',
    Math.round(Number(item.signedAmount ?? item.amount) || 0),
    item.statusLabel || item.status || '',
    item.paymentMethod ? getBookkeepingPaymentMethodLabel(item.paymentMethod) : '-',
    item.referenceNumber || '',
  ]);

  return buildCsvContent(headers, rows);
}

/**
 * CSV builder for Cash Movement report / workspace table.
 */
export function buildCashMovementCsv(items = []) {
  const headers = [
    'Date (ISO)',
    'Date',
    'Description',
    'Direction',
    'Category',
    'Source',
    'Payment Method',
    'Amount (IDR)',
    'Status',
    'Reference',
    'Actor UID',
  ];

  const rows = (items || []).map((item) => [
    item.dateIso || '',
    formatBookkeepingDate(item.date),
    item.description || '',
    item.direction === 'income' ? 'Cash In' : 'Cash Out',
    item.categoryLabel || '',
    getLedgerSourceGroupLabel(item.sourceGroup),
    getBookkeepingPaymentMethodLabel(item.paymentMethod),
    Math.round(Number(item.signedAmount ?? item.amount) || 0),
    item.statusLabel || 'Settled',
    item.referenceNumber || '',
    item.actorUid || '',
  ]);

  return buildCsvContent(headers, rows);
}

/**
 * CSV builder for Outstanding Payables list.
 */
export function buildPayablesCsv(payables = []) {
  const headers = [
    'Accrued Date (ISO)',
    'Accrued Date',
    'Description',
    'Category',
    'Source',
    'Due Date (ISO)',
    'Original Amount (IDR)',
    'Amount Settled (IDR)',
    'Remaining Balance (IDR)',
    'Status',
    'Reference',
  ];

  const rows = (payables || []).map((entry) => {
    const parsedDate = parseJakartaTimestamp(entry.occurredAt || entry.postedAt || entry.createdAt);
    return [
      parsedDate.dateIso || '',
      formatBookkeepingDate(entry.occurredAt || entry.postedAt || entry.createdAt),
      entry.description || '',
      entry.categoryLabel || entry.category || '',
      entry.sourceType === 'commission_batch' ? 'Commission' : 'Manual',
      entry.dueDate || '',
      Math.round(Number(entry.amount) || 0),
      Math.round(Number(entry.amountSettled) || 0),
      Math.round(Number(entry.remainingAmount) || 0),
      entry.settlementStatus || 'unpaid',
      entry.referenceNumber || entry.sourceId || '',
    ];
  });

  return buildCsvContent(headers, rows);
}

/**
 * CSV builder for Period Financial Summary Report.
 */
export function buildPeriodReportCsv({ periodBounds, metrics, categoryBreakdown = [] }) {
  const headers = ['Section', 'Metric / Category', 'Scope', 'Amount (IDR)', 'Reference / Period'];

  const periodRangeText = `${periodBounds?.periodStart || ''} to ${periodBounds?.periodEnd || ''}`;
  const rows = [
    [
      'Income Summary',
      'Billed Revenue (Issued Invoices)',
      'Selected Period',
      metrics.totalBilled,
      periodRangeText,
    ],
    [
      'Income Summary',
      'Customer Cash Received (Net)',
      'Selected Period',
      metrics.customerCashReceived,
      periodRangeText,
    ],
    [
      'Income Summary',
      'Other Manual Income',
      'Selected Period',
      metrics.manualIncomeTotal,
      periodRangeText,
    ],
    [
      'Income Summary',
      'Total Income Received',
      'Selected Period',
      metrics.totalIncomeReceived,
      periodRangeText,
    ],
    [
      'Income Summary',
      'Customer Outstanding Receivable',
      'Current Balance',
      metrics.customerOutstandingReceivable,
      'As of today',
    ],
    [
      'Expense Summary',
      'Staff Commission Accrued',
      'Selected Period',
      metrics.staffCommissionAccrued,
      periodRangeText,
    ],
    [
      'Expense Summary',
      'Recording Operator Fee Accrued',
      'Selected Period',
      metrics.recordingOperatorFeeAccrued,
      periodRangeText,
    ],
    [
      'Expense Summary',
      'Manual Expense Accrued',
      'Selected Period',
      metrics.manualExpenseAccrued,
      periodRangeText,
    ],
    [
      'Expense Summary',
      'Total Expense Accrued',
      'Selected Period',
      metrics.totalExpenseAccrued,
      periodRangeText,
    ],
    [
      'Expense Summary',
      'Expense Settled (Cash Out)',
      'Selected Period',
      metrics.totalOperatingCashOut,
      periodRangeText,
    ],
    [
      'Expense Summary',
      'Remaining Outstanding Payables',
      'Current Balance',
      metrics.outstandingPayables,
      'As of today',
    ],
    ['Cash Summary', 'Cash In', 'Selected Period', metrics.totalIncomeReceived, periodRangeText],
    ['Cash Summary', 'Cash Out', 'Selected Period', metrics.totalOperatingCashOut, periodRangeText],
    [
      'Cash Summary',
      'Net Cash Movement',
      'Selected Period',
      metrics.netCashMovement,
      periodRangeText,
    ],
  ];

  if (metrics.hasOpeningBalance) {
    rows.push(
      [
        'Cash Summary',
        'Configured Opening Balance',
        'User Configured',
        metrics.openingCashBalance,
        metrics.openingBalanceAsOf || 'Custom',
      ],
      [
        'Cash Summary',
        'Opening + Net Cash Movement',
        'Selected Period',
        metrics.closingCashMovement,
        periodRangeText,
      ],
    );
  }

  for (const cat of categoryBreakdown) {
    rows.push([
      'Category Breakdown',
      cat.label,
      'Selected Period',
      cat.amount,
      `${cat.count} entries`,
    ]);
  }

  return buildCsvContent(headers, rows);
}

/**
 * Triggers a clean browser CSV download.
 */
export function triggerCsvDownload(filename, csvContent) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
