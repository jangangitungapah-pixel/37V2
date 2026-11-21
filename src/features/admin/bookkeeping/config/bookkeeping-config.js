/**
 * Canonical configuration, categories, tabs, period presets, and bounded query limits
 * for Pembukuan (Bookkeeping & Financial Control Center).
 */

export const BOOKKEEPING_TIME_ZONE = 'Asia/Jakarta';

export const BOOKKEEPING_TABS = {
  OVERVIEW: 'overview',
  TRANSACTIONS: 'transactions',
  CASH_SETTLEMENT: 'cash_settlement',
  REPORTS: 'reports',
};

export const BOOKKEEPING_TAB_ITEMS = [
  { id: BOOKKEEPING_TABS.OVERVIEW, label: 'Overview', urlKey: 'overview' },
  { id: BOOKKEEPING_TABS.TRANSACTIONS, label: 'Transactions', urlKey: 'transactions' },
  {
    id: BOOKKEEPING_TABS.CASH_SETTLEMENT,
    label: 'Cash & Settlement',
    urlKey: 'cash-settlement',
  },
  { id: BOOKKEEPING_TABS.REPORTS, label: 'Reports', urlKey: 'reports' },
];

export const BOOKKEEPING_PERIOD_PRESETS = {
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  THIS_YEAR: 'this_year',
  CUSTOM: 'custom',
};

export const BOOKKEEPING_PERIOD_PRESET_OPTIONS = [
  { id: BOOKKEEPING_PERIOD_PRESETS.THIS_MONTH, label: 'This Month', indoLabel: 'Bulan Ini' },
  { id: BOOKKEEPING_PERIOD_PRESETS.LAST_MONTH, label: 'Last Month', indoLabel: 'Bulan Lalu' },
  { id: BOOKKEEPING_PERIOD_PRESETS.THIS_YEAR, label: 'This Year', indoLabel: 'Tahun Ini' },
  { id: BOOKKEEPING_PERIOD_PRESETS.CUSTOM, label: 'Custom Range', indoLabel: 'Pilih Tanggal' },
];

export const BOOKKEEPING_SOURCE_MODULES = {
  BOOKKEEPING: 'bookkeeping',
  COMMISSION_AND_FEE: 'commission-and-fee',
  PAYMENT_AND_BILL: 'payment-and-bill',
};

export const BOOKKEEPING_SOURCE_TYPES = {
  MANUAL: 'manual',
  COMMISSION_BATCH: 'commission_batch',
  MANUAL_REVERSAL: 'manual_reversal',
};

export const BOOKKEEPING_ENTRY_TYPES = {
  INCOME: 'income',
  EXPENSE_ACCRUAL: 'expense_accrual',
  REVERSAL: 'reversal',
};

export const BOOKKEEPING_SETTLEMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  REVERSED: 'reversed',
};

export const BOOKKEEPING_SETTLEMENT_TYPES = {
  EXPENSE_PAYMENT: 'expense_payment',
};

export const BOOKKEEPING_PAYMENT_METHODS = ['cash', 'transfer', 'qris', 'other'];

export const BOOKKEEPING_PAYMENT_METHOD_OPTIONS = [
  { id: 'cash', label: 'Cash', indoLabel: 'Tunai' },
  { id: 'transfer', label: 'Transfer', indoLabel: 'Transfer Bank' },
  { id: 'qris', label: 'QRIS', indoLabel: 'QRIS' },
  { id: 'other', label: 'Other', indoLabel: 'Lainnya' },
];

export const MANUAL_INCOME_CATEGORIES = [
  { id: 'other_studio_service', label: 'Other Studio Service', indoLabel: 'Layanan Studio Lain' },
  { id: 'equipment_rental', label: 'Equipment Rental', indoLabel: 'Sewa Alat Tambahan' },
  { id: 'merchandise', label: 'Merchandise', indoLabel: 'Penjualan Merchandise' },
  { id: 'other_income', label: 'Other Income', indoLabel: 'Pemasukan Lainnya' },
];

export const MANUAL_INCOME_CATEGORY_IDS = MANUAL_INCOME_CATEGORIES.map((c) => c.id);

export const MANUAL_EXPENSE_CATEGORIES = [
  { id: 'utilities', label: 'Utilities', indoLabel: 'Listrik & Air' },
  {
    id: 'internet_communication',
    label: 'Internet & Communication',
    indoLabel: 'Internet & Komunikasi',
  },
  {
    id: 'cleaning_housekeeping',
    label: 'Cleaning & Housekeeping',
    indoLabel: 'Kebersihan & Perawatan Ruang',
  },
  {
    id: 'equipment_maintenance',
    label: 'Equipment Maintenance',
    indoLabel: 'Perbaikan & Maintenance Alat',
  },
  { id: 'equipment_purchase', label: 'Equipment Purchase', indoLabel: 'Pembelian Alat Studio' },
  { id: 'studio_supplies', label: 'Studio Supplies', indoLabel: 'Perlengkapan Operasional' },
  { id: 'transportation', label: 'Transportation', indoLabel: 'Transportasi' },
  { id: 'rent_facilities', label: 'Rent & Facilities', indoLabel: 'Sewa & Fasilitas' },
  {
    id: 'other_operational_expense',
    label: 'Other Operational Expense',
    indoLabel: 'Biaya Operasional Lainnya',
  },
];

export const MANUAL_EXPENSE_CATEGORY_IDS = MANUAL_EXPENSE_CATEGORIES.map((c) => c.id);

export const COMMISSION_EXPENSE_CATEGORIES = [
  { id: 'staff_commission', label: 'Staff Commission', indoLabel: 'Komisi Staff Studio' },
  {
    id: 'recording_operator_fee',
    label: 'Recording Operator Fee',
    indoLabel: 'Fee Operator Recording',
  },
];

export const SYSTEM_INCOME_CATEGORIES = [
  { id: 'customer_session_payment', label: 'Studio Session Payment', indoLabel: 'Pembayaran Sesi' },
  {
    id: 'customer_payment_reversal',
    label: 'Payment Correction (Reversal)',
    indoLabel: 'Koreksi Pembayaran',
  },
];

export const ALL_BOOKKEEPING_CATEGORIES = [
  ...SYSTEM_INCOME_CATEGORIES,
  ...MANUAL_INCOME_CATEGORIES,
  ...COMMISSION_EXPENSE_CATEGORIES,
  ...MANUAL_EXPENSE_CATEGORIES,
];

export const LEDGER_SOURCE_TYPES = {
  CUSTOMER_PAYMENT: 'customer_payment',
  CUSTOMER_PAYMENT_REVERSAL: 'customer_payment_reversal',
  MANUAL_INCOME: 'manual_income',
  MANUAL_EXPENSE: 'manual_expense',
  COMMISSION_ACCRUAL: 'commission_accrual',
  PAYABLE_SETTLEMENT: 'payable_settlement',
  MANUAL_PAYABLE: 'manual_payable',
  MANUAL_PAYABLE_SETTLEMENT: 'manual_payable_settlement',
  MANUAL_REVERSAL: 'manual_reversal',
};

export const LEDGER_PRESENTATION_TYPES = {
  CASH: 'cash',
  ACCRUAL: 'accrual',
  SETTLEMENT: 'settlement',
  CORRECTION: 'correction',
};

export const LEDGER_SOURCE_GROUPS = {
  INVOICE: 'invoice',
  COMMISSION: 'commission',
  MANUAL: 'manual',
};

// Bounded Firestore query limits (single-field indexed queries only)
export const BOOKKEEPING_ENTRIES_PAGE_SIZE = 100;
export const BOOKKEEPING_SETTLEMENTS_PAGE_SIZE = 100;
export const BOOKKEEPING_PAYABLES_LIMIT = 200;
export const BOOKKEEPING_INVOICES_PAGE_SIZE = 150;
export const BOOKKEEPING_PAYMENTS_PAGE_SIZE = 150;
export const BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT = 200;

const CATEGORY_LABEL_MAP = Object.fromEntries(
  ALL_BOOKKEEPING_CATEGORIES.map((item) => [item.id, item]),
);

const PAYMENT_METHOD_LABEL_MAP = Object.fromEntries(
  BOOKKEEPING_PAYMENT_METHOD_OPTIONS.map((item) => [item.id, item]),
);

export function getBookkeepingCategoryLabel(categoryId = '') {
  const clean = String(categoryId || '').trim();
  return CATEGORY_LABEL_MAP[clean]?.label || clean || 'Other';
}

export function getBookkeepingPaymentMethodLabel(method = '') {
  const clean = String(method || '').trim();
  return PAYMENT_METHOD_LABEL_MAP[clean]?.label || '-';
}

export function getLedgerSourceGroupLabel(sourceGroup = '') {
  if (sourceGroup === LEDGER_SOURCE_GROUPS.INVOICE) return 'Invoice';
  if (sourceGroup === LEDGER_SOURCE_GROUPS.COMMISSION) return 'Commission';
  return 'Manual';
}

export function getLedgerPresentationMeta(presentationType = '') {
  switch (presentationType) {
    case LEDGER_PRESENTATION_TYPES.CASH:
      return { label: 'Cash Tx', fullLabel: 'Cash Transaction', tone: 'lime' };
    case LEDGER_PRESENTATION_TYPES.ACCRUAL:
      return { label: 'Accrual', fullLabel: 'Expense Accrual (Payable)', tone: 'amber' };
    case LEDGER_PRESENTATION_TYPES.SETTLEMENT:
      return { label: 'Settlement', fullLabel: 'Payable Settlement (Cash Out)', tone: 'ink' };
    case LEDGER_PRESENTATION_TYPES.CORRECTION:
      return { label: 'Correction', fullLabel: 'Accounting Correction', tone: 'neutral' };
    default:
      return { label: 'Entry', fullLabel: 'Financial Entry', tone: 'neutral' };
  }
}

export function getPayableStatusMeta(status = '') {
  switch (status) {
    case BOOKKEEPING_SETTLEMENT_STATUS.PAID:
      return { label: 'Paid', indoLabel: 'Lunas', tone: 'lime' };
    case BOOKKEEPING_SETTLEMENT_STATUS.PARTIALLY_PAID:
      return { label: 'Partially Paid', indoLabel: 'Dibayar Sebagian', tone: 'amber' };
    case BOOKKEEPING_SETTLEMENT_STATUS.REVERSED:
      return { label: 'Reversed', indoLabel: 'Dikoreksi', tone: 'neutral' };
    case BOOKKEEPING_SETTLEMENT_STATUS.UNPAID:
    default:
      return { label: 'Unpaid', indoLabel: 'Belum Dibayar', tone: 'orange' };
  }
}

export function getLedgerStatusMeta(status = '') {
  switch (status) {
    case 'recorded':
      return { label: 'Recorded', tone: 'lime' };
    case 'accrued':
      return { label: 'Accrued', tone: 'amber' };
    case 'partially_settled':
      return { label: 'Partially Paid', tone: 'amber' };
    case 'settled':
      return { label: 'Settled', tone: 'lime' };
    case 'reversed':
      return { label: 'Reversed', tone: 'neutral' };
    default:
      return { label: 'Recorded', tone: 'neutral' };
  }
}
