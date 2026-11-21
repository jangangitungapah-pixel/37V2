import {
  BookOpenText,
  Boxes,
  CalendarDays,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Settings2,
  UsersRound,
} from 'lucide-react';

/**
 * Central navigation and route configuration for the 37 Music Studio Admin Shell.
 *
 * Menu order is strictly locked per Phase 4 specification:
 * 01. Dashboard
 * 02. Calendar
 * 03. Customer
 * 04. Payment and Bill
 * 05. Commission and Fee
 * 06. Inventory
 * 07. Pembukuan
 * 08. Settings
 *
 * Note: Phase 4 intentionally grants both `owner` and `staff` roles identical
 * visibility and navigation access across all eight routes. Role-specific permissions
 * are deferred to a future user-directed phase.
 */
export const ADMIN_NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    order: '01',
    label: 'Dashboard',
    path: 'dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    eyebrow: 'MODULE 01 • WORKSPACE OVERVIEW',
    summary:
      'Central studio operations hub providing quick access across all eight management modules.',
    scopeNotes: [
      'Unified entry point for authenticated Owner and Staff sessions',
      'Direct navigation shortcuts to all studio management workspaces',
      'Operational overview widgets will be connected in a dedicated future phase',
    ],
  },
  {
    id: 'calendar',
    order: '02',
    label: 'Calendar',
    path: 'calendar',
    href: '/admin/calendar',
    icon: CalendarDays,
    eyebrow: 'MODULE 02 • STUDIO SCHEDULING',
    summary:
      'Dedicated workspace reserved for rehearsal, recording, and mixing session scheduling across studio rooms.',
    scopeNotes: [
      'Room A and Room B session slot timeline foundation',
      'Booking conflict prevention and shift scheduling workflow (planned)',
      'Engineer and room assignment views will be added in the Calendar phase',
    ],
  },
  {
    id: 'customer',
    order: '03',
    label: 'Customer',
    path: 'customer',
    href: '/admin/customer',
    icon: UsersRound,
    eyebrow: 'MODULE 03 • CLIENT DIRECTORY',
    summary:
      'Dedicated workspace reserved for managing band profiles, solo artists, producers, and booking contacts.',
    scopeNotes: [
      'Client contact directory and band roster records (planned)',
      'Session history association and communication preferences (planned)',
      'Customer lookup and profile management will be added in the Customer phase',
    ],
  },
  {
    id: 'payment-and-bill',
    order: '04',
    label: 'Payment and Bill',
    path: 'payment-and-bill',
    href: '/admin/payment-and-bill',
    icon: ReceiptText,
    eyebrow: 'MODULE 04 • BILLING & INVOICES',
    summary:
      'Dedicated workspace reserved for session invoices, deposit tracking, and client payment verification.',
    scopeNotes: [
      'Session billing records and payment status tracking (planned)',
      'Deposit and settlement confirmation workflow (planned)',
      'Invoice generation and receipt logs will be added in the Payment and Bill phase',
    ],
  },
  {
    id: 'commission-and-fee',
    order: '05',
    label: 'Commission and Fee',
    path: 'commission-and-fee',
    href: '/admin/commission-and-fee',
    icon: HandCoins,
    eyebrow: 'MODULE 05 • CREW & ENGINEER PAYOUTS',
    summary:
      'Dedicated workspace reserved for audio engineer session fees, crew allowances, and commission rules.',
    scopeNotes: [
      'Engineer session fee structures and crew payout logs (planned)',
      'Commission calculation rules linked to completed sessions (planned)',
      'Payout settlement tracking will be added in the Commission and Fee phase',
    ],
  },
  {
    id: 'inventory',
    order: '06',
    label: 'Inventory',
    path: 'inventory',
    href: '/admin/inventory',
    icon: Boxes,
    eyebrow: 'MODULE 06 • GEAR & BACKLINE ASSETS',
    summary:
      'Dedicated workspace reserved for tracking studio instruments, amplifiers, microphones, cables, and maintenance.',
    scopeNotes: [
      'Room A and Room B backline and microphone asset registry (planned)',
      'Equipment condition status and maintenance notes (planned)',
      'Consumables and spare parts tracking will be added in the Inventory phase',
    ],
  },
  {
    id: 'pembukuan',
    order: '07',
    label: 'Pembukuan',
    path: 'pembukuan',
    href: '/admin/pembukuan',
    icon: BookOpenText,
    eyebrow: 'MODULE 07 • STUDIO BOOKKEEPING',
    summary:
      'Dedicated workspace reserved for studio income and expense ledgers, cashflow records, and financial summaries.',
    scopeNotes: [
      'Structured operational income and expense ledger entries (planned)',
      'Period reconciliation and studio cashflow records (planned)',
      'Bookkeeping exports and reports will be added in the Pembukuan phase',
    ],
  },
  {
    id: 'settings',
    order: '08',
    label: 'Settings',
    path: 'settings',
    href: '/admin/settings',
    icon: Settings2,
    eyebrow: 'MODULE 08 • STUDIO CONFIGURATION',
    summary:
      'Dedicated workspace reserved for studio profile details, room parameters, operating hours, and system preferences.',
    scopeNotes: [
      'Studio profile, operating hours, and contact channel settings (planned)',
      'Room parameters and service category configuration (planned)',
      'Role-based access controls will be configured in a future phase',
    ],
  },
];

export function getAdminModuleById(moduleId) {
  return ADMIN_NAVIGATION_ITEMS.find((item) => item.id === moduleId) || ADMIN_NAVIGATION_ITEMS[0];
}

export function getAdminNavItemByPath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/, '');
  const matched = ADMIN_NAVIGATION_ITEMS.find(
    (item) => normalized === item.href || normalized.startsWith(`${item.href}/`),
  );
  return matched || ADMIN_NAVIGATION_ITEMS[0];
}
