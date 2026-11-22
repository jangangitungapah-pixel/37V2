import fs from 'node:fs';
import path from 'node:path';
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
  startAfter: vi.fn(),
  onSnapshot: vi.fn((_q, onNext) => {
    queueMicrotask(() => onNext({ docs: [], exists: () => false, data: () => ({}) }));
    return () => {};
  }),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

import { AppRoutes } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import {
  BOOKING_SESSION_STATUS,
  INITIAL_PAYMENT_STATUS,
} from '@/features/admin/calendar/config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { createInMemoryBookingRepositoryAdapter } from '@/features/admin/calendar/services/calendar-booking-service';
import {
  createInMemoryCommissionRepositoryAdapter,
  resetCommissionRepositoryAdapter,
  setCommissionRepositoryAdapter,
} from '@/features/admin/commission/repositories/commission-repository';
import { postCommissionBatch } from '@/features/admin/commission/services/commission-posting-service';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import {
  recordInvoicePayment,
  reversePaymentTransaction,
} from '@/features/admin/payment/services/payment-service';
import { voidInvoice } from '@/features/admin/payment/services/invoice-service';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import {
  BOOKKEEPING_ENTRY_TYPE,
  BOOKKEEPING_SETTLEMENT_STATUS,
} from '@/features/admin/commission/schemas/commission-schema';

import { BOOKKEEPING_PERIOD_PRESETS } from './config/bookkeeping-config';
import {
  createInMemoryBookkeepingRepositoryAdapter,
  resetBookkeepingRepositoryAdapter,
  setBookkeepingRepositoryAdapter,
} from './repositories/bookkeeping-repository';
import {
  createManualExpenseEntry,
  createManualIncomeEntry,
  reverseBookkeepingEntry,
  saveBookkeepingOpeningBalance,
} from './services/bookkeeping-entry-service';
import { settleBookkeepingEntry } from './services/bookkeeping-settlement-service';
import {
  buildCashMovementItems,
  buildExpenseCategoryBreakdown,
  buildUnifiedLedgerItems,
  calculateBookkeepingMetrics,
  isActivePayableEntry,
} from './utils/bookkeeping-calculation';
import {
  buildCashMovementCsv,
  buildLedgerCsv,
  buildPayablesCsv,
  buildPeriodReportCsv,
} from './utils/bookkeeping-format';
import { resolveBookkeepingPeriodBounds } from './utils/bookkeeping-period';

function mockAuthenticatedStaff(role = 'owner', uid = 'owner-uid-1') {
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Staff';
  const email = role === 'owner' ? 'owner@37studio.com' : 'staff@37studio.com';

  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback({ uid, email, displayName }));
    return () => {};
  });

  mockGetDoc.mockImplementation(async (docRef) => {
    if (docRef.path === `staffProfiles/${uid}`) {
      return {
        id: uid,
        exists: () => true,
        data: () => ({
          displayName,
          email,
          role,
          active: true,
        }),
      };
    }

    return {
      id: docRef.id,
      exists: () => false,
      data: () => ({}),
    };
  });
}

function setupSharedAdapters({ bookings = [], invoices = [], paymentTransactions = [] } = {}) {
  const bookingAdapter = createInMemoryBookingRepositoryAdapter(
    bookings,
    [],
    [],
    invoices,
    paymentTransactions,
  );
  const customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
  const paymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);
  const commissionAdapter = createInMemoryCommissionRepositoryAdapter(bookingAdapter);
  const bookkeepingAdapter = createInMemoryBookkeepingRepositoryAdapter(bookingAdapter);
  const pricingAdapter = createInMemoryPricingSettingsAdapter({
    ...DEFAULT_PRICING_SETTINGS,
    version: 2,
  });

  setBookingRepositoryAdapter(bookingAdapter);
  setCustomerRepositoryAdapter(customerAdapter);
  setPaymentRepositoryAdapter(paymentAdapter);
  setCommissionRepositoryAdapter(commissionAdapter);
  setBookkeepingRepositoryAdapter(bookkeepingAdapter);
  setPricingSettingsRepositoryAdapter(pricingAdapter);

  return {
    bookingAdapter,
    paymentAdapter,
    commissionAdapter,
    bookkeepingAdapter,
    pricingAdapter,
  };
}

function makeInvoice({
  id = 'inv_bkg-1',
  bookingId = 'bkg-1',
  invoiceNumber = '37MS-20261110-AABBCCDDEEFF',
  totalAmount = 500000,
  amountPaid = 0,
  invoiceStatus = 'issued',
  invoiceDate = new Date('2026-11-10T05:00:00.000Z'),
  customerName = 'Andi Band',
} = {}) {
  const balanceDue = Math.max(0, totalAmount - amountPaid);
  return {
    id,
    bookingId,
    invoiceNumber,
    customerId: 'cust-1',
    invoiceStatus,
    currency: 'IDR',
    customerSnapshot: { name: customerName, phone: '081234567890', bandName: 'The Echoes' },
    bookingSnapshot: {
      serviceTypeName: 'Recording',
      serviceOptionName: 'Live Track',
      studioId: 'room-a',
      bookingDate: '2026-11-10',
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: { subtotal: totalAmount, discountAmount: 0, totalAmount },
    amountPaid,
    balanceDue,
    paymentStatus: amountPaid === 0 ? 'unpaid' : amountPaid >= totalAmount ? 'paid' : 'partial',
    invoiceDate,
    dueDate: null,
    version: 1,
    createdAt: invoiceDate,
    createdByUid: 'staff-1',
    updatedAt: invoiceDate,
    updatedByUid: 'staff-1',
  };
}

function makeCompletedBooking({
  id = 'bkg-comp-1',
  actualCompletedAt = new Date('2026-11-10T10:00:00.000Z'),
  staffAmount = 150000,
  ownerAmount = 100000,
  operatorAmount = 200000,
} = {}) {
  return {
    id,
    customerId: 'cust-1',
    customerName: 'Bima',
    phone: '08123456789',
    bandName: 'Rhythm',
    studioId: 'room-a',
    serviceId: 'recording',
    serviceTypeId: 'recording',
    serviceTypeName: 'Recording',
    serviceOptionName: 'Shift Recording',
    deliveryMode: 'studio',
    pricingMode: 'fixed',
    date: '2026-11-10',
    startMinute: 600,
    durationMinutes: 180,
    endMinute: 780,
    totalAmount: 650000,
    sessionStatus: BOOKING_SESSION_STATUS.COMPLETED,
    actualCompletedAt,
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
    initialPaidAmount: 650000,
    commissionSnapshot: {
      schemaVersion: 2,
      staff: { basis: 'fixed', rate: staffAmount, amount: staffAmount },
      owner: { basis: 'fixed', rate: ownerAmount, amount: ownerAmount },
      recordingOperator: { basis: 'fixed', rate: operatorAmount, amount: operatorAmount },
      settingsVersion: 2,
    },
    version: 1,
  };
}

function renderBookkeepingApp(initialRoute = '/admin/pembukuan') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Bookkeeping & Financial Control Center (/admin/pembukuan)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockOnAuthStateChanged.mockReset();
    mockGetDoc.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetCommissionRepositoryAdapter();
    resetBookkeepingRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
  });

  describe('A. Income, Billed Revenue, Reversals & Manual Income Integrity', () => {
    it('counts customer payment once, reduces Cash In on reversal, excludes invoice total & voided invoices from Cash In, and records manual income separately', async () => {
      const novBounds = resolveBookkeepingPeriodBounds({
        preset: BOOKKEEPING_PERIOD_PRESETS.CUSTOM,
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-30',
      });

      const invIssued = makeInvoice({
        id: 'inv_bkg-1',
        bookingId: 'bkg-1',
        totalAmount: 500000,
        amountPaid: 0,
        invoiceDate: new Date('2026-11-10T05:00:00.000Z'),
      });
      const invVoid = makeInvoice({
        id: 'inv_bkg-2',
        bookingId: 'bkg-2',
        invoiceNumber: '37MS-20261111-112233445566',
        totalAmount: 400000,
        amountPaid: 0,
        invoiceStatus: 'issued',
        invoiceDate: new Date('2026-11-11T05:00:00.000Z'),
      });

      const { paymentAdapter, bookkeepingAdapter } = setupSharedAdapters({
        invoices: [invIssued, invVoid],
      });

      // Void inv_bkg-2 cleanly
      await voidInvoice({
        invoiceId: 'inv_bkg-2',
        expectedVersion: 1,
        reason: 'Customer cancel before payment',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });

      // Record 200k payment then reverse it, plus record valid 300k payment against inv_bkg-1
      const pay1 = await recordInvoicePayment({
        transactionId: 'pay_test_1',
        invoiceId: 'inv_bkg-1',
        expectedVersion: 1,
        amount: 200000,
        paymentMethod: 'transfer',
        receivedDate: '2026-11-12',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });

      const rev1 = await reversePaymentTransaction({
        invoiceId: 'inv_bkg-1',
        originalTransactionId: 'pay_test_1',
        expectedVersion: pay1.invoice.version,
        reason: 'Nominal input ganda',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });

      await recordInvoicePayment({
        transactionId: 'pay_test_2',
        invoiceId: 'inv_bkg-1',
        expectedVersion: rev1.invoice.version,
        amount: 300000,
        paymentMethod: 'qris',
        receivedDate: '2026-11-13',
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });

      // Manual income 125k (does NOT create fake invoice or paymentTransaction)
      const manualInc = await createManualIncomeEntry({
        entryId: 'bk_inc_test_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Sewa gitar fender tambahan',
          category: 'equipment_rental',
          amount: 125000,
          receivedDate: '2026-11-14',
          paymentMethod: 'cash',
          referenceNumber: 'KW-101',
        },
        adapter: bookkeepingAdapter,
      });

      // Idempotent retry must NOT double count
      const replay = await createManualIncomeEntry({
        entryId: 'bk_inc_test_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Sewa gitar fender tambahan',
          category: 'equipment_rental',
          amount: 125000,
          receivedDate: '2026-11-14',
          paymentMethod: 'cash',
        },
        adapter: bookkeepingAdapter,
      });
      expect(replay.idempotentReplay).toBe(true);
      expect(manualInc.entry.amount).toBe(125000);

      const payState = paymentAdapter._inspectState();
      const bkState = bookkeepingAdapter._inspectState();

      // Still only 2 invoices (no fake invoice for manual income!)
      expect(payState.invoices.size).toBe(2);
      // Still only 3 paymentTransactions (pay_test_1, pay_rev_pay_test_1, pay_test_2)
      expect(payState.paymentTransactions.size).toBe(3);

      const metrics = calculateBookkeepingMetrics({
        invoices: Array.from(payState.invoices.values()),
        paymentTransactions: Array.from(payState.paymentTransactions.values()),
        bookkeepingEntries: Array.from(bkState.bookkeepingEntries.values()).map(
          (e) =>
            // normalize via service return structure already normalized or calculate directly
            e,
        ),
        bookkeepingSettlements: Array.from(bkState.bookkeepingSettlements.values()),
        periodBounds: novBounds,
      });

      // Billed Revenue = ONLY issued invoice 500k (voided 400k excluded)
      expect(metrics.totalBilled).toBe(500000);
      // Customer Cash Received = (200k + 300k) - 200k reversal = 300k (NEVER adds 500k invoice total!)
      expect(metrics.customerCashReceived).toBe(300000);
      expect(metrics.manualIncomeTotal).toBe(125000);
      expect(metrics.totalIncomeReceived).toBe(425000);
      // Customer Receivable = 500k - 300k = 200k (voided excluded)
      expect(metrics.customerOutstandingReceivable).toBe(200000);
    });
  });

  describe('B. Commission Integration, Owner Allocation Exclusion & Partial/Full Settlement', () => {
    it('creates staff & operator payables from Commission batch, excludes Owner Allocation, keeps unpaid accrual out of Cash Out, and supports partial + full settlement without double counting', async () => {
      const novBounds = resolveBookkeepingPeriodBounds({
        preset: BOOKKEEPING_PERIOD_PRESETS.CUSTOM,
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-30',
      });

      const booking = makeCompletedBooking({
        id: 'bkg-c1',
        staffAmount: 500000,
        ownerAmount: 250000, // Reference only! Must NEVER enter payables or expenses!
        operatorAmount: 200000,
      });

      const { commissionAdapter, bookkeepingAdapter } = setupSharedAdapters({
        bookings: [booking],
      });

      const postRes = await postCommissionBatch({
        batchId: 'cbt-1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        selectedBookings: [
          {
            bookingId: 'bkg-c1',
            expectedVersion: 1,
          },
        ],
        adapter: commissionAdapter,
      });

      expect(postRes.bookkeepingEntries).toHaveLength(2);
      const staffEntryId = 'bk_commission_cbt-1_staff';
      const opEntryId = 'bk_commission_cbt-1_operator';

      // Verify Owner Allocation is rejected if manually constructed
      expect(
        isActivePayableEntry({
          entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
          category: 'owner_allocation',
          settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
        }),
      ).toBe(false);

      // Before settlement: payables = 700k (500k staff + 200k operator), Cash Out = 0!
      const rawEntriesBefore = Array.from(
        bookkeepingAdapter._inspectState().bookkeepingEntries.values(),
      );
      const beforeMetrics = calculateBookkeepingMetrics({
        bookkeepingEntries: rawEntriesBefore,
        bookkeepingSettlements: [],
        periodBounds: novBounds,
      });
      expect(beforeMetrics.totalExpenseAccrued).toBe(700000);
      expect(beforeMetrics.outstandingPayables).toBe(700000);
      expect(beforeMetrics.totalOperatingCashOut).toBe(0);

      // Partial Settlement of Staff Commission: 300k of 500k
      const part1 = await settleBookkeepingEntry({
        entryId: staffEntryId,
        settlementId: 'bk_set_part_1',
        expectedVersion: 1,
        amount: 300000,
        paidDate: '2026-11-15',
        paymentMethod: 'transfer',
        referenceNumber: 'TRF-01',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: bookkeepingAdapter,
      });

      expect(part1.entry.amount).toBe(500000); // Original untouched!
      expect(part1.entry.amountSettled).toBe(300000);
      expect(part1.entry.remainingAmount).toBe(200000);
      expect(part1.entry.settlementStatus).toBe('partially_paid');
      expect(part1.entry.version).toBe(2);

      // Full settlement of remaining 200k
      const part2 = await settleBookkeepingEntry({
        entryId: staffEntryId,
        settlementId: 'bk_set_part_2',
        expectedVersion: 2,
        amount: 200000,
        paidDate: '2026-11-20',
        paymentMethod: 'cash',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: bookkeepingAdapter,
      });

      expect(part2.entry.amount).toBe(500000);
      expect(part2.entry.amountSettled).toBe(500000);
      expect(part2.entry.remainingAmount).toBe(0);
      expect(part2.entry.settlementStatus).toBe('paid');
      expect(part2.entry.version).toBe(3);

      // Verify metrics after 500k staff settled + 200k operator still unpaid
      const afterState = bookkeepingAdapter._inspectState();
      const afterMetrics = calculateBookkeepingMetrics({
        bookkeepingEntries: [part2.entry, rawEntriesBefore.find((e) => e.id === opEntryId)],
        bookkeepingSettlements: Array.from(afterState.bookkeepingSettlements.values()),
        periodBounds: novBounds,
      });

      expect(afterMetrics.totalExpenseAccrued).toBe(700000); // Batch never double-counted!
      expect(afterMetrics.totalOperatingCashOut).toBe(500000);
      expect(afterMetrics.outstandingPayables).toBe(200000); // Remaining Operator fee
    });
  });

  describe('C. Manual Expenses (Paid vs Unpaid) & Owner Correction/Reversal', () => {
    it('atomically creates Paid expense + settlement once, creates Unpaid payable without Cash Out until settled, and preserves reversal history while blocking settled reversals', async () => {
      const novBounds = resolveBookkeepingPeriodBounds({
        preset: BOOKKEEPING_PERIOD_PRESETS.CUSTOM,
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-30',
      });
      const { bookkeepingAdapter } = setupSharedAdapters();

      // 1. Paid Manual Expense (Electricity 350k) -> atomic accrual + settlement
      const paidRes = await createManualExpenseEntry({
        entryId: 'bk_exp_paid_1',
        settlementId: 'bk_set_paid_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Tagihan Listrik PLN Studio',
          category: 'utilities',
          amount: 350000,
          expenseDate: '2026-11-10',
          paymentStatus: 'paid',
          paymentMethod: 'transfer',
          paidDate: '2026-11-10',
          referenceNumber: 'PLN-NOV',
        },
        adapter: bookkeepingAdapter,
      });

      expect(paidRes.entry.settlementStatus).toBe('paid');
      expect(paidRes.entry.paidOnCreate).toBe(true);
      expect(paidRes.settlement.amount).toBe(350000);

      // 2. Unpaid Manual Expense (AC Maintenance 600k) -> accrual ONLY, Cash Out unchanged
      const unpaidRes = await createManualExpenseEntry({
        entryId: 'bk_exp_unpaid_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Servis AC Studio A & B',
          category: 'equipment_maintenance',
          amount: 600000,
          expenseDate: '2026-11-11',
          paymentStatus: 'unpaid',
          dueDate: '2026-11-25',
        },
        adapter: bookkeepingAdapter,
      });

      expect(unpaidRes.entry.settlementStatus).toBe('unpaid');
      expect(unpaidRes.entry.remainingAmount).toBe(600000);
      expect(unpaidRes.settlement).toBeNull();

      // Reversal of SETTLED Paid Manual Expense MUST BE REJECTED
      await expect(
        reverseBookkeepingEntry({
          entryId: 'bk_exp_paid_1',
          expectedVersion: 1,
          reason: 'Coba hapus pengeluaran lunas',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/cannot-reverse-settled-entry' });

      // 3. Unpaid Manual Expense that was input wrong (wrong amount) -> Owner reverses safely
      const wrongUnpaid = await createManualExpenseEntry({
        entryId: 'bk_exp_wrong_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Salah input pembelian kabel',
          category: 'studio_supplies',
          amount: 999000,
          expenseDate: '2026-11-12',
          paymentStatus: 'unpaid',
        },
        adapter: bookkeepingAdapter,
      });

      const revRes = await reverseBookkeepingEntry({
        entryId: wrongUnpaid.entry.id,
        expectedVersion: wrongUnpaid.entry.version,
        reason: 'Nominal salah input seharusnya 99rb',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: bookkeepingAdapter,
      });

      expect(revRes.originalEntry.settlementStatus).toBe('reversed');
      expect(revRes.reversalEntry.id).toBe('bk_rev_bk_exp_wrong_1');

      const stateAfterRev = bookkeepingAdapter._inspectState();
      // Original + Reversal both preserved (no permanent delete!)
      expect(stateAfterRev.bookkeepingEntries.has('bk_exp_wrong_1')).toBe(true);
      expect(stateAfterRev.bookkeepingEntries.has('bk_rev_bk_exp_wrong_1')).toBe(true);

      // Verify Ledger avoids duplicating immediate paid manual expense while Cash Out sums settlements once
      const metrics = calculateBookkeepingMetrics({
        bookkeepingEntries: Array.from(stateAfterRev.bookkeepingEntries.values()),
        bookkeepingSettlements: Array.from(stateAfterRev.bookkeepingSettlements.values()),
        periodBounds: novBounds,
      });

      expect(metrics.manualExpenseAccrued).toBe(350000 + 600000); // Reversed 999k excluded!
      expect(metrics.totalOperatingCashOut).toBe(350000); // Unpaid 600k NOT cash out yet!
      expect(metrics.outstandingPayables).toBe(600000);

      const ledger = buildUnifiedLedgerItems({
        bookkeepingEntries: Array.from(stateAfterRev.bookkeepingEntries.values()),
        bookkeepingSettlements: Array.from(stateAfterRev.bookkeepingSettlements.values()),
      });
      // For paid manual expense `bk_exp_paid_1`, settlement `bk_set_paid_1` is represented by 1 clean `manual_expense` row
      expect(ledger.filter((i) => i.entryId === 'bk_exp_paid_1')).toHaveLength(1);
    });
  });

  describe('D. Settlement Concurrency, Idempotency, Stale Version & Guardrails', () => {
    it('prevents overpayment, enforces idempotent operationId, serializes concurrent settlements without negative balances, rejects stale versions & non-Owners, and rolls back failed writes cleanly', async () => {
      const { bookkeepingAdapter } = setupSharedAdapters();

      const exp = await createManualExpenseEntry({
        entryId: 'bk_exp_conc_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Kewajiban Vendor Audio',
          category: 'equipment_maintenance',
          amount: 500000,
          expenseDate: '2026-11-10',
          paymentStatus: 'unpaid',
        },
        adapter: bookkeepingAdapter,
      });

      // 1. Non-owner rejected
      await expect(
        settleBookkeepingEntry({
          entryId: exp.entry.id,
          settlementId: 'bk_set_staff_attempt',
          expectedVersion: 1,
          amount: 100000,
          paidDate: '2026-11-11',
          paymentMethod: 'cash',
          actorUid: 'staff-uid-2',
          actorRole: 'staff',
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/owner-only' });

      // 2. Empty actor UID rejected
      await expect(
        createManualIncomeEntry({
          actorUid: '',
          actorRole: 'owner',
          input: {
            description: 'Tes tanpa UID',
            category: 'other_income',
            amount: 50000,
            receivedDate: '2026-11-11',
            paymentMethod: 'cash',
          },
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/unauthenticated' });

      // 3. Overpayment rejected with zero writes
      await expect(
        settleBookkeepingEntry({
          entryId: exp.entry.id,
          settlementId: 'bk_set_overpay',
          expectedVersion: 1,
          amount: 600000,
          paidDate: '2026-11-11',
          paymentMethod: 'cash',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/overpayment-not-allowed' });
      expect(bookkeepingAdapter._inspectState().bookkeepingSettlements.size).toBe(0);

      // 4. Stale version rejected
      await expect(
        settleBookkeepingEntry({
          entryId: exp.entry.id,
          settlementId: 'bk_set_stale',
          expectedVersion: 99,
          amount: 100000,
          paidDate: '2026-11-11',
          paymentMethod: 'cash',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/stale-version' });

      // 5. Concurrent settlements (300k + 300k on 500k balance) -> only ONE succeeds, second safely fails!
      const [c1, c2] = await Promise.allSettled([
        settleBookkeepingEntry({
          entryId: exp.entry.id,
          settlementId: 'bk_set_conc_a',
          expectedVersion: 1,
          amount: 300000,
          paidDate: '2026-11-11',
          paymentMethod: 'transfer',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
        settleBookkeepingEntry({
          entryId: exp.entry.id,
          settlementId: 'bk_set_conc_b',
          expectedVersion: 1,
          amount: 300000,
          paidDate: '2026-11-11',
          paymentMethod: 'transfer',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
      ]);

      expect([c1.status, c2.status].sort()).toEqual(['fulfilled', 'rejected']);
      const settledState = bookkeepingAdapter._inspectState();
      expect(settledState.bookkeepingSettlements.size).toBe(1);
      expect(settledState.bookkeepingEntries.get(exp.entry.id).remainingAmount).toBe(200000);

      // 6. Idempotent retry with same settlementId returns idempotentReplay: true without duplicating!
      const replay = await settleBookkeepingEntry({
        entryId: exp.entry.id,
        settlementId: 'bk_set_conc_a',
        expectedVersion: 1,
        amount: 300000,
        paidDate: '2026-11-11',
        paymentMethod: 'transfer',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: bookkeepingAdapter,
      });
      expect(replay.idempotentReplay).toBe(true);
      expect(bookkeepingAdapter._inspectState().bookkeepingSettlements.size).toBe(1);

      // 7. Duplicate settlementId on a DIFFERENT entry is rejected!
      await expect(
        settleBookkeepingEntry({
          entryId: 'other-entry-id',
          settlementId: 'bk_set_conc_a',
          amount: 50000,
          paidDate: '2026-11-11',
          paymentMethod: 'cash',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          adapter: bookkeepingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'bookkeeping/entry-not-found' });

      // 8. Verify in-memory adapter enforces all reads before writes
      await expect(
        bookkeepingAdapter.runAtomicTransaction(async (tx) => {
          tx.setBookkeepingEntry('bad', { amount: 1 });
          await tx.getBookkeepingEntry('bk_exp_conc_1');
        }),
      ).rejects.toThrow(/reads before writes/i);
    });
  });

  describe('E. Reports, Asia/Jakarta Date Boundaries, CSV Formatting & Inventory Isolation', () => {
    it('enforces exact Asia/Jakarta month boundary (UTC 17:00 = 00:00 WIB next day), computes Opening Cash Movement, category breakdown, numeric CSV, and ignores inventory', async () => {
      // 2026-10-31T17:00:00.000Z === 2026-11-01T00:00:00.000+07:00 (FIRST MILLISECOND OF NOV WIB!)
      const novMidnightWib = new Date('2026-10-31T17:00:00.000Z');
      // 2026-10-31T16:59:59.999Z === 2026-10-31T23:59:59.999+07:00 (LAST MILLISECOND OF OCT WIB!)
      const octLastMsWib = new Date('2026-10-31T16:59:59.999Z');

      const novBounds = resolveBookkeepingPeriodBounds({
        preset: BOOKKEEPING_PERIOD_PRESETS.CUSTOM,
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-30',
      });

      const invOct = makeInvoice({
        id: 'inv_oct',
        bookingId: 'bkg-oct',
        totalAmount: 400000,
        amountPaid: 0,
        invoiceDate: octLastMsWib,
      });
      const invNov = makeInvoice({
        id: 'inv_nov',
        bookingId: 'bkg-nov',
        totalAmount: 750000,
        amountPaid: 500000,
        invoiceDate: novMidnightWib,
      });

      const payNov = {
        id: 'pay_nov_1',
        invoiceId: 'inv_nov',
        invoiceNumber: invNov.invoiceNumber,
        bookingId: 'bkg-nov',
        customerId: 'cust-1',
        transactionType: 'payment',
        amount: 500000,
        currency: 'IDR',
        paymentMethod: 'qris',
        receivedAt: novMidnightWib,
      };

      const { bookkeepingAdapter } = setupSharedAdapters({
        invoices: [invOct, invNov],
        paymentTransactions: [payNov],
      });

      const settings = await saveBookkeepingOpeningBalance({
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          enabled: true,
          openingCashBalance: 1000000,
          openingBalanceAsOf: '2026-11-01',
          openingBalanceNote: 'Kas awal November',
        },
        adapter: bookkeepingAdapter,
      });

      const entries = [
        {
          id: 'e-nov-util',
          sourceModule: 'bookkeeping',
          sourceType: 'manual',
          entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
          category: 'utilities',
          description: 'Listrik November',
          amount: 200000,
          amountSettled: 200000,
          remainingAmount: 0,
          paidOnCreate: true,
          settlementStatus: 'paid',
          occurredAt: novMidnightWib,
        },
        {
          id: 'e-oct-util',
          sourceModule: 'bookkeeping',
          sourceType: 'manual',
          entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
          category: 'utilities',
          description: 'Listrik Oktober',
          amount: 150000,
          amountSettled: 0,
          remainingAmount: 150000,
          settlementStatus: 'unpaid',
          occurredAt: octLastMsWib,
        },
        // Rogue Inventory-sourced object must NEVER count as bookkeeping expense
        {
          id: 'e-inv-ignore',
          sourceModule: 'inventory',
          sourceType: 'inventory_movement',
          entryType: 'expense_accrual',
          category: 'studio_supplies',
          description: 'Stok masuk senar gitar',
          amount: 999999,
          remainingAmount: 999999,
          settlementStatus: 'unpaid',
          occurredAt: novMidnightWib,
        },
      ];

      const settlements = [
        {
          id: 's-nov-1',
          entryId: 'e-nov-util',
          sourceModule: 'bookkeeping',
          sourceType: 'manual',
          sourceId: 'e-nov-util',
          settlementType: 'expense_payment',
          amount: 200000,
          currency: 'IDR',
          paymentMethod: 'cash',
          paidAt: novMidnightWib,
        },
      ];

      const metrics = calculateBookkeepingMetrics({
        invoices: [invOct, invNov],
        paymentTransactions: [payNov],
        bookkeepingEntries: entries,
        bookkeepingSettlements: settlements,
        periodBounds: novBounds,
        settings,
      });

      expect(metrics.totalBilled).toBe(750000); // Oct 400k excluded from Nov period!
      expect(metrics.customerOutstandingReceivable).toBe(400000 + 250000); // Current AR includes BOTH Oct & Nov!
      expect(metrics.totalIncomeReceived).toBe(500000);
      expect(metrics.totalOperatingCashOut).toBe(200000);
      expect(metrics.netCashMovement).toBe(300000);
      expect(metrics.closingCashMovement).toBe(1300000);
      expect(metrics.totalExpenseAccrued).toBe(200000); // Inventory 999k + Oct 150k excluded!
      expect(metrics.outstandingPayables).toBe(150000); // Oct unpaid payable still current, Inventory excluded!

      const breakdown = buildExpenseCategoryBreakdown({
        bookkeepingEntries: entries,
        periodBounds: novBounds,
      });
      expect(breakdown).toEqual([
        {
          categoryId: 'utilities',
          label: 'Utilities',
          amount: 200000,
          count: 1,
          sharePercent: 100,
        },
      ]);

      const cashItems = buildCashMovementItems({
        invoices: [invOct, invNov],
        paymentTransactions: [payNov],
        bookkeepingEntries: entries,
        bookkeepingSettlements: settlements,
        periodBounds: novBounds,
      });

      // Verify CSV exports output pure integers for amounts (no "Rp" inside numeric cells)
      const ledgerCsv = buildLedgerCsv(
        buildUnifiedLedgerItems({
          invoices: [invNov],
          paymentTransactions: [payNov],
          bookkeepingEntries: entries,
          bookkeepingSettlements: settlements,
        }),
      );
      const cashCsv = buildCashMovementCsv(cashItems);
      const payablesCsv = buildPayablesCsv(metrics.openPayables);
      const reportCsv = buildPeriodReportCsv({
        periodBounds: novBounds,
        metrics,
        categoryBreakdown: breakdown,
      });

      expect(ledgerCsv).toContain('500000');
      expect(ledgerCsv).not.toContain('Rp 500.000');
      expect(cashCsv).toContain('-200000');
      expect(payablesCsv).toContain('150000');
      expect(reportCsv).toContain('1300000');
    });
  });

  describe('F. UI Integration, Owner vs Staff Route Guard & Firestore Security Rules Contract', () => {
    it('blocks Active Staff on /admin/pembukuan with Owner Access Required and keeps financial records hidden', async () => {
      const { bookkeepingAdapter } = setupSharedAdapters();
      await createManualIncomeEntry({
        entryId: 'bk_inc_secret_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        input: {
          description: 'Pendapatan Rahasia Studio',
          category: 'other_income',
          amount: 750000,
          receivedDate: '2026-11-15',
          paymentMethod: 'cash',
        },
        adapter: bookkeepingAdapter,
      });

      mockAuthenticatedStaff('staff', 'staff-uid-2');
      renderBookkeepingApp('/admin/pembukuan');

      expect(await screen.findByRole('heading', { name: /owner access required/i })).toBeTruthy();
      expect(screen.getByText(/restricted financial control center/i)).toBeTruthy();
      expect(screen.queryByText(/pendapatan rahasia studio/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /tambah catatan pembukuan baru/i })).toBeNull();
    });

    it('supports full Owner Bookkeeping UI workflow across Overview, + New Entry (Income & Unpaid Expense), Cash & Settlement (Settle Payment), Transactions, Detail Drawer & Reports (ECharts)', async () => {
      const user = userEvent.setup();
      const todayBounds = resolveBookkeepingPeriodBounds({
        preset: BOOKKEEPING_PERIOD_PRESETS.THIS_MONTH,
      });
      const todayIsoMid = `${todayBounds.periodStart.slice(0, 8)}10T10:00:00.000Z`;

      const { commissionAdapter, paymentAdapter, bookingAdapter } = setupSharedAdapters({
        bookings: [
          makeCompletedBooking({
            id: 'bkg-ui-bk',
            actualCompletedAt: new Date(todayIsoMid),
            staffAmount: 150000,
            ownerAmount: 90000,
            operatorAmount: 250000,
          }),
        ],
        invoices: [
          makeInvoice({
            id: 'inv_bkg-ui-bk',
            bookingId: 'bkg-ui-bk',
            totalAmount: 800000,
            amountPaid: 0,
            invoiceDate: new Date(todayIsoMid),
            customerName: 'Nadia Quartet',
          }),
        ],
      });

      // Record a customer payment & post commission batch via existing services
      await recordInvoicePayment({
        transactionId: 'pay_ui_bk_1',
        invoiceId: 'inv_bkg-ui-bk',
        expectedVersion: 1,
        amount: 300000,
        paymentMethod: 'transfer',
        receivedDate: todayBounds.periodStart,
        actorUid: 'owner-uid-1',
        adapter: paymentAdapter,
      });

      await postCommissionBatch({
        batchId: 'cbt-ui-bk',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: todayBounds.periodStart,
        periodEnd: todayBounds.periodEnd,
        selectedBookings: [{ bookingId: 'bkg-ui-bk', expectedVersion: 1 }],
        adapter: commissionAdapter,
      });
      expect(bookingAdapter._inspectState().bookings.size).toBe(1);

      mockAuthenticatedStaff('owner', 'owner-uid-1');
      renderBookkeepingApp('/admin/pembukuan');

      // 1. Overview renders real KPIs (300k Cash In, 0 Cash Out, 400k Payables [150k + 250k], 300k Net Movement)
      expect(await screen.findByText(/total income received/i)).toBeTruthy();
      expect(await screen.findAllByText(/nadia quartet/i)).toBeTruthy();

      // 2. "+ New Entry" -> Record Manual Income (100k)
      await user.click(screen.getByRole('button', { name: /tambah catatan pembukuan baru/i }));
      await user.click(screen.getByRole('menuitem', { name: /record income/i }));

      const incDialog = await screen.findByRole('dialog', { name: /record income/i });
      await user.type(within(incDialog).getByLabelText(/description/i), 'Sewa Mic Tambahan');
      await user.type(within(incDialog).getByLabelText(/amount \(idr\)/i), '100000');
      await user.click(within(incDialog).getByRole('button', { name: /save manual income/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // 3. Switch to "Cash & Settlement" tab and settle Staff Commission 150k partially (100k)
      await user.click(screen.getByRole('tab', { name: /cash & settlement/i }));
      const settleBtns = await screen.findAllByRole('button', { name: /settle payment/i });
      expect(settleBtns.length).toBeGreaterThan(0);

      await user.click(settleBtns[0]);
      const settleDialog = await screen.findByRole('dialog', {
        name: /bayar kewajiban operasional/i,
      });
      const amtInput = within(settleDialog).getByLabelText(/amount to pay/i);
      await user.clear(amtInput);
      await user.type(amtInput, '100000');
      await user.click(within(settleDialog).getByRole('button', { name: /confirm settlement/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // 4. Switch to Transactions tab, filter/inspect Detail Drawer
      await user.click(screen.getByRole('tab', { name: /^transactions/i }));
      const detailButtons = await screen.findAllByRole('button', { name: /detail/i });
      expect(detailButtons.length).toBeGreaterThan(0);
      await user.click(detailButtons[0]);

      const drawer = await screen.findByRole('dialog');
      expect(within(drawer).getByText(/nominal tercatat/i)).toBeTruthy();
      await user.click(within(drawer).getByRole('button', { name: /tutup detail transaksi/i }));

      // 5. Switch to Reports tab -> ECharts container + Income/Expense/Cash summaries render cleanly
      await user.click(screen.getByRole('tab', { name: /^reports$/i }));
      expect(await screen.findByText(/a\. income summary/i)).toBeTruthy();
      expect(screen.getByText(/b\. expense summary/i)).toBeTruthy();
      expect(screen.getByLabelText(/grafik distribusi pengeluaran per kategori/i)).toBeTruthy();
    });

    it('declares strict Owner-only Firestore Security Rules for bookkeepingEntries, bookkeepingSettlements, and bookkeepingSettings while preserving Phase 9 Commission rules', () => {
      const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

      expect(rulesContent).toContain('match /bookkeepingEntries/{entryId}');
      expect(rulesContent).toContain('match /bookkeepingSettlements/{settlementId}');
      expect(rulesContent).toContain('match /bookkeepingSettings/{docId}');

      expect(rulesContent).toContain(
        'function isValidCommissionBookkeepingEntryCreate(data, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidManualIncomeBookkeepingEntryCreate(data, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidManualExpenseBookkeepingEntryCreate(data, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidManualReversalBookkeepingEntryCreate(data, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidBookkeepingSettlementAggregateUpdate(reqData, resData, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidManualBookkeepingReversalMarkUpdate(reqData, resData, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidBookkeepingSettlementCreate(data, settlementId)',
      );

      // Settlements append-only & entries cannot be permanently deleted outside Factory Reset
      expect(rulesContent).toContain('allow update: if false;');
      expect(rulesContent).toContain('allow delete: if canFactoryResetDelete();');
      expect(rulesContent).toContain('allow delete: if false;');
    });
  });
});
