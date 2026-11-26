import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnAuthStateChanged = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db, collectionName, docId) => ({
  path: `${collectionName}/${docId}`,
  id: docId,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  Timestamp: { fromDate: (d) => d },
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: vi.fn(async () => ({ docs: [] })),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

import { AppProviders } from '@/app/providers/AppProviders';
import {
  resetBookkeepingRepositoryAdapter,
  setBookkeepingRepositoryAdapter,
} from '@/features/admin/bookkeeping/repositories/bookkeeping-repository';
import {
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  resetCommissionRepositoryAdapter,
  setCommissionRepositoryAdapter,
} from '@/features/admin/commission/repositories/commission-repository';
import {
  resetInventoryRepositoryAdapter,
  setInventoryRepositoryAdapter,
} from '@/features/admin/inventory/repositories/inventory-repository';
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage';
import {
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';

import {
  buildBookingTrendSeries,
  buildCashFlowTrendSeries,
  buildNeedsAttentionItems,
  buildTodayRoomSchedules,
  computeOwnerPeriodFinancialSummary,
  computeTodayCashIn,
  computeTodayOverviewMetrics,
} from './utils/dashboard-calculations';
import {
  formatBookingTimeRange,
  getJakartaGreetingInfo,
  resolveDashboardPeriodBounds,
} from './utils/dashboard-date';

const FIXED_NOW = new Date('2026-11-22T07:30:00.000Z'); // 14:30 WIB (870 minutes from midnight) on Minggu, 22 November 2026
const FIXED_TODAY_ISO = '2026-11-22';

function mockAuthenticatedUser(role = 'owner') {
  const uid = role === 'owner' ? 'owner-uid-1' : 'staff-uid-2';
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Staff';
  const email = role === 'owner' ? 'owner@37studio.com' : 'staff@37studio.com';

  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback({ uid, email, displayName }));
    return () => {};
  });

  mockGetDoc.mockResolvedValue({
    id: uid,
    exists: () => true,
    data: () => ({
      displayName,
      email,
      role,
      active: true,
    }),
  });
}

function createMockDashboardAdapters({
  todayBookings = [],
  periodBookings = [],
  isTodayTruncated = false,
  isPeriodTruncated = false,
  todayInvoices = [],
  isTodayInvoicesTruncated = false,
  recentInvoices = [],
  inventoryItems = [],
  paymentTransactions = [],
  hasMoreTransactions = false,
  bookkeepingEntries = [],
  hasMoreEntries = false,
  activePayables = [],
  hasMorePayables = false,
  bookkeepingSettlements = [],
  hasMoreSettlements = false,
  commissionBookings = [],
  commissionPostingItems = new Map(),
  commissionResolutions = new Map(),
  newBookingRequests = [],
} = {}) {
  const unsubSpies = {
    bookingRange: vi.fn(),
    invoicesRange: vi.fn(),
    recentInvoices: vi.fn(),
    inventoryItems: vi.fn(),
    paymentTransactions: vi.fn(),
    bookkeepingEntries: vi.fn(),
    activePayables: vi.fn(),
    bookkeepingSettlements: vi.fn(),
    commissionPeriod: vi.fn(),
    commissionPostings: vi.fn(),
    commissionResolutions: vi.fn(),
    bookingRequests: vi.fn(),
  };

  const bookingAdapter = {
    subscribeBookingsInRange: vi.fn(({ startDate, endDate, maxLimit = 300, onData }) => {
      const isSingleToday = startDate === endDate;
      queueMicrotask(() => {
        onData?.({
          bookings: isSingleToday ? todayBookings : periodBookings,
          isTruncated: isSingleToday ? isTodayTruncated : isPeriodTruncated,
          maxLimit,
        });
      });
      return unsubSpies.bookingRange;
    }),
  };

  const paymentAdapter = {
    subscribeInvoicesInBookingDateRange: vi.fn(({ onData }) => {
      queueMicrotask(() => {
        onData?.({
          invoices: todayInvoices,
          isTruncated: isTodayInvoicesTruncated,
        });
      });
      return unsubSpies.invoicesRange;
    }),
    subscribeInvoices: vi.fn(({ maxLimit = 100, onData }) => {
      queueMicrotask(() => {
        onData?.({
          invoices: recentInvoices,
          hasMore: false,
          maxLimit,
        });
      });
      return unsubSpies.recentInvoices;
    }),
    subscribePaymentTransactions: vi.fn(({ maxLimit = 300, onData }) => {
      queueMicrotask(() => {
        onData?.({
          transactions: paymentTransactions,
          hasMore: hasMoreTransactions,
          maxLimit,
        });
      });
      return unsubSpies.paymentTransactions;
    }),
  };

  const inventoryAdapter = {
    subscribeInventoryItems: vi.fn(({ maxLimit = 100, onData }) => {
      queueMicrotask(() => {
        onData?.({
          items: inventoryItems,
          hasMore: false,
          maxLimit,
        });
      });
      return unsubSpies.inventoryItems;
    }),
  };

  const bookkeepingAdapter = {
    subscribeBookkeepingEntries: vi.fn(({ maxLimit = 300, onData }) => {
      queueMicrotask(() => {
        onData?.({
          entries: bookkeepingEntries,
          hasMore: hasMoreEntries,
          maxLimit,
        });
      });
      return unsubSpies.bookkeepingEntries;
    }),
    subscribeActivePayables: vi.fn(({ maxLimit = 200, onData }) => {
      queueMicrotask(() => {
        onData?.({
          payables: activePayables,
          hasMore: hasMorePayables,
          maxLimit,
        });
      });
      return unsubSpies.activePayables;
    }),
    subscribeBookkeepingSettlements: vi.fn(({ maxLimit = 300, onData }) => {
      queueMicrotask(() => {
        onData?.({
          settlements: bookkeepingSettlements,
          hasMore: hasMoreSettlements,
          maxLimit,
        });
      });
      return unsubSpies.bookkeepingSettlements;
    }),
  };

  const commissionAdapter = {
    subscribePeriodCompletedBookings: vi.fn(({ onData }) => {
      queueMicrotask(() => {
        onData?.({
          bookings: commissionBookings,
          hasMore: false,
        });
      });
      return unsubSpies.commissionPeriod;
    }),
    subscribePostingItemsForBookingIds: vi.fn(({ onData }) => {
      queueMicrotask(() => {
        onData?.(commissionPostingItems);
      });
      return unsubSpies.commissionPostings;
    }),
    subscribeReviewResolutionsForBookingIds: vi.fn(({ onData }) => {
      queueMicrotask(() => {
        onData?.(commissionResolutions);
      });
      return unsubSpies.commissionResolutions;
    }),
  };

  const bookingRequestAdapter = {
    subscribeNewBookingRequests: vi.fn(({ maxLimit = 20, onData }) => {
      queueMicrotask(() => {
        const sliced = newBookingRequests.slice(0, maxLimit);
        onData?.({
          requests: sliced,
          hasMore: newBookingRequests.length > maxLimit,
          maxLimit,
        });
      });
      return unsubSpies.bookingRequests;
    }),
  };

  setBookingRepositoryAdapter(bookingAdapter);
  setPaymentRepositoryAdapter(paymentAdapter);
  setInventoryRepositoryAdapter(inventoryAdapter);
  setBookkeepingRepositoryAdapter(bookkeepingAdapter);
  setCommissionRepositoryAdapter(commissionAdapter);
  setBookingRequestRepositoryAdapter(bookingRequestAdapter);

  return {
    bookingAdapter,
    paymentAdapter,
    inventoryAdapter,
    bookkeepingAdapter,
    commissionAdapter,
    bookingRequestAdapter,
    unsubSpies,
  };
}

function renderDashboard({ now = FIXED_NOW } = {}) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AdminDashboardPage now={now} />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Studio Operations Command Center — Dashboard Overhaul', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();
    if (typeof HTMLCanvasElement !== 'undefined') {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
        font: '',
        measureText: (text) => ({ width: String(text || '').length * 7 }),
      }));
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetBookingRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetInventoryRepositoryAdapter();
    resetBookkeepingRepositoryAdapter();
    resetCommissionRepositoryAdapter();
  });

  describe('15.1 Role Access & Query Safety (Owner vs Staff)', () => {
    it('renders Owner financial overview, Cash Flow chart, and Owner-only Needs Attention items for Owner', async () => {
      mockAuthenticatedUser('owner');
      const { bookkeepingAdapter, commissionAdapter, paymentAdapter } = createMockDashboardAdapters(
        {
          todayBookings: [
            {
              id: 'bk-1',
              date: FIXED_TODAY_ISO,
              studioId: 'room-a',
              startMinute: 840,
              endMinute: 960,
              durationMinutes: 120,
              customerName: 'Budi Santoso',
              bandName: 'The Echoes',
              serviceTypeName: 'Rehearsal',
              serviceOptionName: 'Reguler',
              sessionStatus: 'in_progress',
            },
          ],
          todayInvoices: [
            {
              id: 'inv-1',
              bookingId: 'bk-1',
              invoiceNumber: 'INV-20261122-001',
              invoiceStatus: 'issued',
              paymentStatus: 'partial',
              totalAmount: 200000,
              amountPaid: 100000,
              balanceDue: 100000,
              dueDate: FIXED_TODAY_ISO,
            },
          ],
          paymentTransactions: [
            {
              id: 'tx-1',
              invoiceId: 'inv-1',
              transactionType: 'payment',
              amount: 100000,
              receivedAt: '2026-11-22T06:00:00.000Z',
            },
          ],
          activePayables: [
            {
              id: 'bk-entry-1',
              entryType: 'expense_accrual',
              category: 'staff_commission',
              description: 'Komisi Batch 01',
              amount: 150000,
              amountSettled: 0,
              remainingAmount: 150000,
              settlementStatus: 'unpaid',
              occurredAt: '2026-11-21T10:00:00.000Z',
            },
          ],
          bookkeepingSettlements: [
            {
              id: 'settle-1',
              entryId: 'bk-entry-0',
              settlementType: 'expense_payment',
              sourceType: 'manual',
              amount: 40000,
              paidAt: '2026-11-22T05:00:00.000Z',
            },
          ],
          commissionBookings: [
            {
              id: 'bk-completed-1',
              date: FIXED_TODAY_ISO,
              serviceTypeId: 'rehearsal',
              serviceTypeName: 'Rehearsal',
              deliveryMode: 'studio',
              sessionStatus: 'completed',
              actualCompletedAt: '2026-11-22T04:00:00.000Z',
              commissionSnapshot: {
                schemaVersion: 2,
                staff: { basis: 'fixed', rate: 25000, amount: 25000 },
                owner: { basis: 'none', rate: 0, amount: 0 },
                recordingOperator: { basis: 'none', rate: 0, amount: 0 },
                settingsVersion: 1,
              },
            },
          ],
        },
      );

      renderDashboard();

      expect(
        await screen.findByRole('heading', {
          name: /selamat siang, 37 music studio owner/i,
        }),
      ).toBeTruthy();

      // Owner 4th metric card is Kas Masuk Hari Ini
      await waitFor(() => {
        expect(screen.getByText('Kas Masuk Hari Ini')).toBeTruthy();
      });

      // Owner Financial Section & Cash Flow Chart are rendered
      expect(await screen.findByText('Perubahan Kas Bersih')).toBeTruthy();
      expect(screen.getByTestId('dashboard-owner-financial-section')).toBeTruthy();
      expect(screen.getByText('Kas Masuk')).toBeTruthy();
      expect(screen.getByText('Kas Keluar')).toBeTruthy();
      expect(screen.getByText('Outstanding Payables')).toBeTruthy();

      // Owner-only Needs Attention items appear
      await waitFor(() => {
        expect(screen.getByTestId('attention-item-commission_review')).toBeTruthy();
        expect(screen.getByTestId('attention-item-outstanding_payables')).toBeTruthy();
      });

      expect(paymentAdapter.subscribePaymentTransactions).toHaveBeenCalledTimes(1);
      expect(bookkeepingAdapter.subscribeBookkeepingEntries).toHaveBeenCalledTimes(1);
      expect(bookkeepingAdapter.subscribeActivePayables).toHaveBeenCalledTimes(1);
      expect(bookkeepingAdapter.subscribeBookkeepingSettlements).toHaveBeenCalledTimes(1);
      expect(commissionAdapter.subscribePeriodCompletedBookings).toHaveBeenCalledTimes(1);
    });

    it('strictly hides Owner financial sections and never calls Owner-only repositories for Staff', async () => {
      mockAuthenticatedUser('staff');
      const { bookkeepingAdapter, commissionAdapter, paymentAdapter } = createMockDashboardAdapters(
        {
          todayBookings: [
            {
              id: 'bk-staff-1',
              date: FIXED_TODAY_ISO,
              studioId: 'room-a',
              startMinute: 960,
              endMinute: 1080,
              durationMinutes: 120,
              customerName: 'Andi Pratama',
              serviceTypeName: 'Rehearsal',
              sessionStatus: 'upcoming',
            },
          ],
          todayInvoices: [
            {
              id: 'inv-staff-1',
              bookingId: 'bk-staff-1',
              invoiceNumber: 'INV-20261122-002',
              invoiceStatus: 'issued',
              paymentStatus: 'paid',
              totalAmount: 180000,
              amountPaid: 180000,
              balanceDue: 0,
              dueDate: FIXED_TODAY_ISO,
            },
          ],
        },
      );

      renderDashboard();

      expect(
        await screen.findByRole('heading', {
          name: /selamat siang, rina studio staff/i,
        }),
      ).toBeTruthy();

      // Staff sees operational 4th metric card ("Sesi Akan Datang") instead of "Kas Masuk Hari Ini"
      await waitFor(() => {
        expect(screen.getByText('Sesi Akan Datang')).toBeTruthy();
      });
      expect(screen.queryByText('Kas Masuk Hari Ini')).toBeNull();
      expect(screen.queryByTestId('dashboard-owner-financial-section')).toBeNull();
      expect(screen.queryByText('Perubahan Kas Bersih')).toBeNull();
      expect(screen.queryByText('Outstanding Payables')).toBeNull();
      expect(screen.queryByTestId('dashboard-cash-flow-chart-section')).toBeNull();

      // Verify zero calls to Owner-only repositories
      expect(paymentAdapter.subscribePaymentTransactions).not.toHaveBeenCalled();
      expect(bookkeepingAdapter.subscribeBookkeepingEntries).not.toHaveBeenCalled();
      expect(bookkeepingAdapter.subscribeActivePayables).not.toHaveBeenCalled();
      expect(bookkeepingAdapter.subscribeBookkeepingSettlements).not.toHaveBeenCalled();
      expect(commissionAdapter.subscribePeriodCompletedBookings).not.toHaveBeenCalled();
      expect(commissionAdapter.subscribePostingItemsForBookingIds).not.toHaveBeenCalled();
      expect(commissionAdapter.subscribeReviewResolutionsForBookingIds).not.toHaveBeenCalled();
    });
  });

  describe('15.2 Daily Overview & Authoritative Invoice Resolution', () => {
    it('computes today active bookings in Asia/Jakarta excluding cancelled and no_show, and distinguishes missing invoice vs authoritative unpaid invoice', () => {
      const todayBookings = [
        {
          id: 'b-upcoming-unpaid',
          date: FIXED_TODAY_ISO,
          sessionStatus: 'upcoming',
          initialPaymentStatus: 'unpaid',
        },
        {
          id: 'b-inprogress-paid',
          date: FIXED_TODAY_ISO,
          sessionStatus: 'in_progress',
          initialPaymentStatus: 'paid',
        },
        {
          id: 'b-completed-missing-inv',
          date: FIXED_TODAY_ISO,
          sessionStatus: 'completed',
          initialPaymentStatus: 'unpaid',
        },
        {
          id: 'b-cancelled',
          date: FIXED_TODAY_ISO,
          sessionStatus: 'cancelled',
        },
        {
          id: 'b-noshow',
          date: FIXED_TODAY_ISO,
          sessionStatus: 'no_show',
        },
      ];

      // Notice `b-completed-missing-inv` has NO loaded invoice in `invoicesByBookingId`
      const invoicesByBookingId = new Map([
        [
          'b-upcoming-unpaid',
          {
            id: 'inv-1',
            bookingId: 'b-upcoming-unpaid',
            invoiceStatus: 'issued',
            paymentStatus: 'partial',
            totalAmount: 300000,
            amountPaid: 100000,
            balanceDue: 200000,
            dueDate: FIXED_TODAY_ISO,
          },
        ],
        [
          'b-inprogress-paid',
          {
            id: 'inv-2',
            bookingId: 'b-inprogress-paid',
            invoiceStatus: 'issued',
            paymentStatus: 'paid',
            totalAmount: 250000,
            amountPaid: 250000,
            balanceDue: 0,
            dueDate: FIXED_TODAY_ISO,
          },
        ],
      ]);

      const overview = computeTodayOverviewMetrics({
        todayBookings,
        invoicesByBookingId,
        isInvoicesTruncated: true,
        paymentTransactions: [],
        isOwner: true,
        todayIso: FIXED_TODAY_ISO,
      });

      // Active bookings = upcoming + in_progress + completed (3), excluding cancelled & no_show
      expect(overview.todayActiveBookingsCount).toBe(3);
      expect(overview.inProgressSessionsCount).toBe(1);
      expect(overview.upcomingSessionsCount).toBe(1);
      expect(overview.completedSessionsCount).toBe(1);
      expect(overview.cancelledSessionsCount).toBe(1);
      expect(overview.noShowSessionsCount).toBe(1);

      // Only `b-upcoming-unpaid` has an authoritative unpaid invoice; `b-completed-missing-inv` is tracked as unverified
      expect(overview.unpaidBookingsCount).toBe(1);
      expect(overview.unpaidBookingsBalanceDue).toBe(200000);
      expect(overview.paidBookingsCount).toBe(1);
      expect(overview.unverifiedInvoiceBookingsCount).toBe(1);
    });

    it('computes time-sensitive Asia/Jakarta greetings across all 4 WIB periods', () => {
      expect(getJakartaGreetingInfo(new Date('2026-11-22T01:00:00.000Z')).greeting).toBe(
        'Selamat pagi',
      ); // 08:00 WIB
      expect(getJakartaGreetingInfo(new Date('2026-11-22T06:00:00.000Z')).greeting).toBe(
        'Selamat siang',
      ); // 13:00 WIB
      expect(getJakartaGreetingInfo(new Date('2026-11-22T09:30:00.000Z')).greeting).toBe(
        'Selamat sore',
      ); // 16:30 WIB
      expect(getJakartaGreetingInfo(new Date('2026-11-22T14:00:00.000Z')).greeting).toBe(
        'Selamat malam',
      ); // 21:00 WIB
    });
  });

  describe('15.3 Financial Integrity & Anti-Double-Counting Rules', () => {
    it('subtracts payment reversals, never double-counts invoice.amountPaid with paymentTransactions, and never includes unpaid accruals in Cash Out', () => {
      const periodBounds = resolveDashboardPeriodBounds({
        periodId: '7d',
        todayIso: FIXED_TODAY_ISO,
      });

      // Invoice has amountPaid: 500,000 AND corresponding paymentTransactions exist
      const invoices = [
        {
          id: 'inv-100',
          bookingId: 'bk-100',
          invoiceStatus: 'issued',
          paymentStatus: 'paid',
          totalAmount: 500000,
          amountPaid: 500000,
          balanceDue: 0,
          issuedAt: '2026-11-20T05:00:00.000Z',
        },
      ];

      const paymentTransactions = [
        {
          id: 'tx-pay-1',
          invoiceId: 'inv-100',
          transactionType: 'payment',
          amount: 500000,
          receivedAt: '2026-11-22T03:00:00.000Z',
        },
        {
          id: 'tx-rev-1',
          invoiceId: 'inv-100',
          transactionType: 'reversal',
          amount: 120000,
          receivedAt: '2026-11-22T04:00:00.000Z',
        },
      ];

      // Bookkeeping entries include an UNPAID expense accrual of 300,000 and a partially settled expense accrual
      const bookkeepingEntries = [
        {
          id: 'entry-unpaid-accrual',
          sourceModule: 'commission',
          sourceType: 'commission_batch',
          entryType: 'expense_accrual',
          category: 'staff_commission',
          amount: 300000,
          amountSettled: 0,
          remainingAmount: 300000,
          settlementStatus: 'unpaid',
          occurredAt: '2026-11-21T06:00:00.000Z',
        },
        {
          id: 'entry-partial-accrual',
          sourceModule: 'bookkeeping',
          sourceType: 'manual',
          entryType: 'expense_accrual',
          category: 'utilities',
          amount: 200000,
          amountSettled: 75000,
          remainingAmount: 125000,
          settlementStatus: 'partially_paid',
          occurredAt: '2026-11-22T02:00:00.000Z',
        },
      ];

      // Actual cash paid out in bookkeepingSettlements is ONLY 75,000
      const bookkeepingSettlements = [
        {
          id: 'settlement-actual-1',
          entryId: 'entry-partial-accrual',
          settlementType: 'expense_payment',
          sourceType: 'manual',
          amount: 75000,
          paidAt: '2026-11-22T05:00:00.000Z',
        },
      ];

      const todayCash = computeTodayCashIn({
        paymentTransactions,
        todayIso: FIXED_TODAY_ISO,
      });
      expect(todayCash.grossPayments).toBe(500000);
      expect(todayCash.reversalsTotal).toBe(120000);
      expect(todayCash.netCashIn).toBe(380000);

      const summary = computeOwnerPeriodFinancialSummary({
        invoices,
        outstandingInvoices: invoices,
        paymentTransactions,
        bookkeepingEntries,
        activePayables: bookkeepingEntries,
        bookkeepingSettlements,
        periodBounds,
        todayIso: FIXED_TODAY_ISO,
      });

      // Cash In must be 380,000 (NOT 500,000 + 380,000)
      expect(summary.cashIn).toBe(380000);
      // Cash Out must be 75,000 from actual settlements (NOT 300,000 + 200,000 unpaid accruals)
      expect(summary.cashOut).toBe(75000);
      // Net Cash Movement = 380,000 - 75,000 = 305,000
      expect(summary.netCashMovement).toBe(305000);
      // Outstanding Payables = 300,000 + 125,000 = 425,000
      expect(summary.outstandingPayables).toBe(425000);

      const trend = buildCashFlowTrendSeries({
        paymentTransactions,
        bookkeepingEntries,
        bookkeepingSettlements,
        periodBounds,
      });
      expect(trend.totalCashIn).toBe(380000);
      expect(trend.totalCashOut).toBe(75000);
      expect(trend.totalNetMovement).toBe(305000);
    });

    it('never labels Net Cash Movement as Profit or Laba Bersih in the Owner UI', async () => {
      mockAuthenticatedUser('owner');
      createMockDashboardAdapters();
      renderDashboard();

      expect(await screen.findByText('Perubahan Kas Bersih')).toBeTruthy();
      expect(screen.getByTestId('dashboard-owner-financial-section')).toBeTruthy();
      expect(screen.getByText(/net cash movement/i)).toBeTruthy();
      expect(screen.queryByText(/laba bersih/i)).toBeNull();
    });
  });

  describe('15.4 Today Studio Schedule', () => {
    it('groups bookings into Room A and Room B, sorts chronologically by startMinute, and excludes cancelled bookings', () => {
      const schedule = buildTodayRoomSchedules({
        todayBookings: [
          {
            id: 'a-late',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            startMinute: 900,
            endMinute: 1020,
            customerName: 'Late Band',
            sessionStatus: 'upcoming',
          },
          {
            id: 'a-early',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            startMinute: 600,
            endMinute: 720,
            customerName: 'Early Band',
            sessionStatus: 'completed',
          },
          {
            id: 'a-cancelled',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            startMinute: 720,
            endMinute: 840,
            customerName: 'Cancelled Band',
            sessionStatus: 'cancelled',
          },
          {
            id: 'b-only',
            date: FIXED_TODAY_ISO,
            studioId: 'room-b',
            startMinute: 780,
            endMinute: 900,
            customerName: 'Recording Artist',
            sessionStatus: 'in_progress',
          },
        ],
        invoicesByBookingId: new Map(),
        todayIso: FIXED_TODAY_ISO,
      });

      expect(schedule.totalActiveSessions).toBe(3);
      expect(schedule.totalCancelledSessions).toBe(1);

      const roomA = schedule.rooms.find((r) => r.id === 'room-a');
      const roomB = schedule.rooms.find((r) => r.id === 'room-b');

      expect(roomA.sessions.map((s) => s.id)).toEqual(['a-early', 'a-late']);
      expect(roomA.sessions[0].timeRangeLabel).toBe(formatBookingTimeRange(600, 720));
      expect(roomB.sessions.map((s) => s.id)).toEqual(['b-only']);
    });

    it('renders room-level empty state, full-day empty state, and truncation warning banner', async () => {
      mockAuthenticatedUser('staff');
      createMockDashboardAdapters({
        todayBookings: [
          {
            id: 'only-room-a',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            startMinute: 660,
            endMinute: 720,
            customerName: 'Solo Guitarist',
            serviceTypeName: 'Rehearsal',
            sessionStatus: 'upcoming',
          },
        ],
        isTodayTruncated: true,
      });

      renderDashboard();

      await screen.findByText('Solo Guitarist');
      // Truncation banner visible
      expect(screen.getByText(/menampilkan 300 sesi pertama untuk hari ini/i)).toBeTruthy();

      // Room B empty state visible while Room A has a session
      const roomBContainer = screen.getByTestId('dashboard-schedule-room-b');
      expect(within(roomBContainer).getByText(/tidak ada sesi aktif di room b/i)).toBeTruthy();
    });
  });

  describe('15.5 Needs Attention Prioritization & Empty State', () => {
    it('prioritizes Overdue Invoices first, excludes Owner-only items for Staff, and shows equipment maintenance items', () => {
      const commonInput = {
        invoices: [
          {
            id: 'inv-unpaid',
            invoiceStatus: 'issued',
            paymentStatus: 'unpaid',
            totalAmount: 150000,
            amountPaid: 0,
            balanceDue: 150000,
            dueDate: '2026-11-25',
          },
          {
            id: 'inv-overdue',
            invoiceStatus: 'issued',
            paymentStatus: 'unpaid',
            totalAmount: 400000,
            amountPaid: 0,
            balanceDue: 400000,
            dueDate: '2026-11-15',
          },
        ],
        todayBookings: [
          {
            id: 'bk-due-checkin',
            date: FIXED_TODAY_ISO,
            startMinute: 780, // 13:00 WIB (past current 14:30 WIB)
            endMinute: 900,
            customerName: 'CheckIn Band',
            sessionStatus: 'upcoming',
          },
        ],
        activePayables: [
          {
            id: 'pay-1',
            entryType: 'expense_accrual',
            settlementStatus: 'unpaid',
            amount: 100000,
            amountSettled: 0,
            remainingAmount: 100000,
          },
        ],
        commissionReviewSummary: {
          pendingCount: 2,
          needsReviewCount: 1,
          payableTotal: 90000,
        },
        inventoryItems: [
          {
            id: 'eq-1',
            name: 'Marshall JCM800',
            itemType: 'equipment',
            isActive: true,
            nextMaintenanceDate: '2026-11-10',
            equipmentStock: {
              availableQuantity: 1,
              maintenanceQuantity: 1,
              damagedQuantity: 0,
              retiredQuantity: 0,
            },
          },
        ],
        todayIso: FIXED_TODAY_ISO,
        currentMinuteOfDay: 870,
      };

      const ownerList = buildNeedsAttentionItems({
        ...commonInput,
        isOwner: true,
      });

      expect(ownerList.map((item) => item.type)).toEqual([
        'overdue_invoices',
        'active_session_action',
        'commission_review',
        'outstanding_payables',
        'equipment_maintenance',
        'unpaid_invoices',
      ]);

      const staffList = buildNeedsAttentionItems({
        ...commonInput,
        isOwner: false,
      });

      expect(staffList.map((item) => item.type)).toEqual([
        'overdue_invoices',
        'active_session_action',
        'equipment_maintenance',
        'unpaid_invoices',
      ]);
    });

    it('renders calm positive empty state when zero items require attention', async () => {
      mockAuthenticatedUser('staff');
      createMockDashboardAdapters();
      renderDashboard();

      const emptyBox = await screen.findByTestId('needs-attention-empty-state');
      expect(
        within(emptyBox).getByText('Semua operasional dalam kondisi terkendali.'),
      ).toBeTruthy();
    });
  });

  describe('15.6 Charts, Period Selector & Partial Coverage Notices', () => {
    it('switches Booking Trend & Cash Flow charts across 7 hari, 30 hari, and 90 hari and renders coverage notices when truncated', async () => {
      const user = userEvent.setup();
      mockAuthenticatedUser('owner');
      const { bookingAdapter } = createMockDashboardAdapters({
        periodBookings: [
          {
            id: 'pb-1',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            durationMinutes: 120,
            sessionStatus: 'completed',
          },
          {
            id: 'pb-2',
            date: FIXED_TODAY_ISO,
            studioId: 'room-b',
            durationMinutes: 180,
            sessionStatus: 'upcoming',
          },
        ],
        isPeriodTruncated: true,
        paymentTransactions: [
          {
            id: 'pt-1',
            transactionType: 'payment',
            amount: 250000,
            receivedAt: '2026-11-22T04:00:00.000Z',
          },
        ],
        hasMoreTransactions: true,
      });

      renderDashboard();

      await screen.findByTestId('booking-trend-echarts-container');
      expect(screen.getByTestId('booking-trend-truncation-banner')).toBeTruthy();
      expect(await screen.findByTestId('cash-flow-partial-coverage-banner')).toBeTruthy();
      expect(screen.getByTestId('cash-flow-echarts-container')).toBeTruthy();

      // Switch to 7 hari
      const periodGroup = screen.getByRole('group', {
        name: /pilih rentang periode tren booking/i,
      });
      await user.click(within(periodGroup).getByRole('button', { name: '7 hari' }));

      await waitFor(() => {
        expect(bookingAdapter.subscribeBookingsInRange).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2026-11-16',
            endDate: '2026-11-22',
          }),
        );
      });

      // Switch to 90 hari
      await user.click(within(periodGroup).getByRole('button', { name: '90 hari' }));

      await waitFor(() => {
        expect(bookingAdapter.subscribeBookingsInRange).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2026-08-25',
            endDate: '2026-11-22',
          }),
        );
      });
    });

    it('excludes cancelled and no_show bookings from Booking Trend active volume', () => {
      const bounds = resolveDashboardPeriodBounds({
        periodId: '7d',
        todayIso: FIXED_TODAY_ISO,
      });
      const series = buildBookingTrendSeries({
        bookings: [
          {
            id: '1',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            durationMinutes: 60,
            sessionStatus: 'completed',
          },
          {
            id: '2',
            date: FIXED_TODAY_ISO,
            studioId: 'room-b',
            durationMinutes: 120,
            sessionStatus: 'cancelled',
          },
          {
            id: '3',
            date: FIXED_TODAY_ISO,
            studioId: 'room-a',
            durationMinutes: 60,
            sessionStatus: 'no_show',
          },
        ],
        periodBounds: bounds,
      });

      expect(series.totalActiveBookings).toBe(1);
      expect(series.totalCancelledOrNoShow).toBe(2);
      expect(series.totalHoursBooked).toBe(1);
    });
  });

  describe('15.7 Reliability: Error Recovery & Listener Cleanup on Unmount', () => {
    it('renders section error state with retry action and cleans up all active subscriptions on unmount', async () => {
      const user = userEvent.setup();
      mockAuthenticatedUser('owner');
      const { bookingAdapter, unsubSpies } = createMockDashboardAdapters();

      let shouldFail = true;
      bookingAdapter.subscribeBookingsInRange.mockImplementation(({ onData, onError }) => {
        queueMicrotask(() => {
          if (shouldFail) {
            onError?.(new Error('Koneksi Firestore terputus sementara.'));
          } else {
            onData?.({ bookings: [], isTruncated: false, maxLimit: 300 });
          }
        });
        return unsubSpies.bookingRange;
      });

      const { unmount } = renderDashboard();

      expect(await screen.findByText('Gagal memuat ringkasan operasional hari ini')).toBeTruthy();

      shouldFail = false;
      const retryButtons = screen.getAllByRole('button', { name: /coba lagi|muat ulang/i });
      await user.click(retryButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Booking Hari Ini')).toBeTruthy();
      });

      unmount();

      expect(unsubSpies.bookingRange).toHaveBeenCalled();
      expect(unsubSpies.invoicesRange).toHaveBeenCalled();
      expect(unsubSpies.recentInvoices).toHaveBeenCalled();
      expect(unsubSpies.inventoryItems).toHaveBeenCalled();
      expect(unsubSpies.paymentTransactions).toHaveBeenCalled();
      expect(unsubSpies.bookkeepingEntries).toHaveBeenCalled();
      expect(unsubSpies.activePayables).toHaveBeenCalled();
      expect(unsubSpies.bookkeepingSettlements).toHaveBeenCalled();
      expect(unsubSpies.commissionPeriod).toHaveBeenCalled();
      expect(unsubSpies.bookingRequests).toHaveBeenCalled();
    });
  });

  describe('15.8 Public Booking Requests Needs Attention & Preview Integration', () => {
    it('surfaces New Booking Requests in Needs Attention and recent preview for Owner & Staff when new requests exist', async () => {
      mockAuthenticatedUser('owner');
      createMockDashboardAdapters({
        newBookingRequests: [
          {
            id: 'req_dash001',
            requestReference: 'REQ-DASH0001',
            requestType: 'studio_booking',
            status: 'new',
            customerName: 'Nadia Vocal',
            bandName: 'Velvet Echo',
            contactPhone: '+6281234567890',
            publicServiceId: 'rehearsal',
            serviceLabelSnapshot: 'Rehearsal',
            requestedRoomId: 'room-a',
            preferredDate: '2026-11-24',
            preferredStartMinute: 1140,
            preferredDurationMinutes: 120,
            privacyConsent: true,
            createdAt: '2026-11-22T08:00:00.000Z',
          },
        ],
      });

      renderDashboard();

      expect(await screen.findByText(/1 new booking requests/i)).toBeTruthy();
      expect(screen.getAllByText(/nadia vocal/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/REQ-DASH0001/).length).toBeGreaterThanOrEqual(1);

      const attentionItem = screen.getByTestId('attention-item-new_booking_requests');
      expect(
        within(attentionItem)
          .getByRole('link', { name: /buka inbox request/i })
          .getAttribute('href'),
      ).toBe('/admin/booking-requests');

      cleanup();

      mockAuthenticatedUser('staff');
      createMockDashboardAdapters({
        newBookingRequests: [
          {
            id: 'req_dash002',
            requestReference: 'REQ-DASH0002',
            requestType: 'post_production_inquiry',
            status: 'new',
            customerName: 'Bagas Mixer',
            contactPhone: '+6281333444555',
            publicServiceId: 'mix-master',
            serviceLabelSnapshot: 'Mix & Master',
            privacyConsent: true,
            createdAt: '2026-11-22T09:00:00.000Z',
          },
        ],
      });

      renderDashboard();

      expect(await screen.findByText(/1 new booking requests/i)).toBeTruthy();
      expect(screen.getAllByText(/bagas mixer/i).length).toBeGreaterThanOrEqual(1);
    });

    it('omits New Booking Requests Needs Attention card when zero new requests exist', async () => {
      mockAuthenticatedUser('staff');
      createMockDashboardAdapters({ newBookingRequests: [] });

      renderDashboard();

      expect(
        await screen.findByRole('heading', {
          name: /selamat siang, rina studio staff/i,
        }),
      ).toBeTruthy();

      expect(screen.queryByTestId('attention-item-new_booking_requests')).toBeNull();
    });
  });
});
