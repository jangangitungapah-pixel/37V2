/**
 * Configuration & Domain Constants for 37 Music Studio — Studio Operations Command Center.
 */

export const DASHBOARD_TIME_ZONE = 'Asia/Jakarta';

export const DASHBOARD_PERIOD_PRESETS = {
  DAYS_7: '7d',
  DAYS_30: '30d',
  DAYS_90: '90d',
};

export const DASHBOARD_PERIOD_OPTIONS = [
  {
    id: DASHBOARD_PERIOD_PRESETS.DAYS_7,
    days: 7,
    label: '7 hari',
    fullLabel: '7 Hari Terakhir',
  },
  {
    id: DASHBOARD_PERIOD_PRESETS.DAYS_30,
    days: 30,
    label: '30 hari',
    fullLabel: '30 Hari Terakhir',
  },
  {
    id: DASHBOARD_PERIOD_PRESETS.DAYS_90,
    days: 90,
    label: '90 hari',
    fullLabel: '90 Hari Terakhir',
  },
];

export const DASHBOARD_QUERY_LIMITS = {
  TODAY_BOOKINGS: 300,
  PERIOD_BOOKINGS: 300,
  TODAY_INVOICES: 300,
  RECENT_INVOICES: 100,
  PAYMENT_TRANSACTIONS: 300,
  BOOKKEEPING_ENTRIES: 300,
  ACTIVE_PAYABLES: 200,
  BOOKKEEPING_SETTLEMENTS: 300,
  COMMISSION_REVIEW: 100,
  INVENTORY_ITEMS: 100,
};

export const DASHBOARD_ROOMS = [
  {
    id: 'room-a',
    label: 'Room A',
    shortLabel: 'Room A',
    subtitle: 'Rehearsal & Live Room Utama',
  },
  {
    id: 'room-b',
    label: 'Room B',
    shortLabel: 'Room B',
    subtitle: 'Recording & Production Studio',
  },
];

export const DASHBOARD_ATTENTION_TYPES = {
  OVERDUE_INVOICES: 'overdue_invoices',
  OVERDUE_DEPOSIT_HOLDS: 'overdue_deposit_holds',
  NEW_BOOKING_REQUESTS: 'new_booking_requests',
  ACTIVE_SESSION_ACTION: 'active_session_action',
  COMMISSION_REVIEW: 'commission_review',
  OUTSTANDING_PAYABLES: 'outstanding_payables',
  EQUIPMENT_MAINTENANCE: 'equipment_maintenance',
  UNPAID_INVOICES: 'unpaid_invoices',
};

export const DASHBOARD_ATTENTION_PRIORITY = {
  [DASHBOARD_ATTENTION_TYPES.OVERDUE_INVOICES]: 1,
  [DASHBOARD_ATTENTION_TYPES.OVERDUE_DEPOSIT_HOLDS]: 2,
  [DASHBOARD_ATTENTION_TYPES.NEW_BOOKING_REQUESTS]: 3,
  [DASHBOARD_ATTENTION_TYPES.ACTIVE_SESSION_ACTION]: 4,
  [DASHBOARD_ATTENTION_TYPES.COMMISSION_REVIEW]: 5,
  [DASHBOARD_ATTENTION_TYPES.OUTSTANDING_PAYABLES]: 6,
  [DASHBOARD_ATTENTION_TYPES.EQUIPMENT_MAINTENANCE]: 7,
  [DASHBOARD_ATTENTION_TYPES.UNPAID_INVOICES]: 8,
};
