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
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
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
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
  createInMemoryCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import { savePricingSettings } from '@/features/admin/settings/pricing/services/pricing-settings-service';

import {
  createInMemoryCommissionRepositoryAdapter,
  resetCommissionRepositoryAdapter,
  setCommissionRepositoryAdapter,
} from './repositories/commission-repository';
import {
  BOOKKEEPING_CATEGORY,
  BOOKKEEPING_ENTRY_TYPE,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SOURCE_MODULE,
  BOOKKEEPING_SOURCE_TYPE,
} from './schemas/commission-schema';
import {
  postCommissionBatch,
  resolveNeedsReviewBooking,
} from './services/commission-posting-service';
import {
  buildCommissionBookkeepingEntryId,
  classifyBookingForCommission,
  COMMISSION_ITEM_STATUS,
  computeCommissionAggregateTotals,
} from './utils/commission-calculation';
import { resolveCommissionPeriodBounds } from './utils/commission-period';
import { parseCommissionSnapshot } from './utils/commission-snapshot';

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

function makeSeedBooking({
  id = 'bkg-test-1',
  customerName = 'Arief Music',
  bandName = 'The Velvet Echo',
  studioId = 'room-a',
  serviceTypeId = 'rehearsal',
  serviceTypeName = 'Rehearsal',
  serviceOptionId = 'reguler',
  serviceOptionName = 'Reguler',
  deliveryMode = 'studio',
  date = '2026-11-10',
  durationMinutes = 120,
  totalAmount = 200000,
  sessionStatus = BOOKING_SESSION_STATUS.COMPLETED,
  actualCompletedAt = new Date('2026-11-10T10:00:00.000Z'), // 17:00 WIB on 10 Nov 2026
  commissionSnapshot = {
    schemaVersion: 2,
    staff: { basis: 'hourly', rate: 10000, amount: 20000 },
    owner: { basis: 'fixed', rate: 15000, amount: 15000 },
    recordingOperator: { basis: 'none', rate: 0, amount: 0 },
    settingsVersion: 2,
  },
  version = 2,
} = {}) {
  return {
    id,
    customerId: 'cust-1',
    customerName,
    phone: '081234567890',
    phoneNormalized: '+6281234567890',
    bandName,
    studioId,
    serviceTypeId,
    serviceTypeName,
    serviceOptionId,
    serviceOptionName,
    deliveryMode,
    pricingMode: 'hourly',
    pricingSettingsVersion: 2,
    serviceId: serviceTypeId,
    serviceLabel: serviceTypeName,
    packageId: '',
    packageLabel: '',
    recordingTypeId: '',
    recordingTypeLabel: '',
    date,
    startMinute: 600,
    durationMinutes,
    endMinute: 600 + durationMinutes,
    timeZone: 'Asia/Jakarta',
    unitRate: 100000,
    subtotal: totalAmount,
    discountAmount: 0,
    totalAmount,
    automaticDiscount: null,
    commissionSnapshot,
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
    initialPaidAmount: 0,
    paymentMethod: '',
    sessionStatus,
    actualCompletedAt,
    notes: '',
    createdByUid: 'staff-1',
    updatedByUid: 'staff-1',
    version,
  };
}

function setupSharedAdapters(seedBookings = [], seedInvoices = []) {
  const pricingAdapter = createInMemoryPricingSettingsAdapter({
    ...DEFAULT_PRICING_SETTINGS,
    version: 2,
  });
  setPricingSettingsRepositoryAdapter(pricingAdapter);

  const bookingAdapter = createInMemoryBookingRepositoryAdapter(
    seedBookings,
    [],
    [],
    seedInvoices,
    [],
  );
  setBookingRepositoryAdapter(bookingAdapter);
  setCustomerRepositoryAdapter(createInMemoryCustomerRepositoryAdapter(bookingAdapter));
  setPaymentRepositoryAdapter(createInMemoryPaymentRepositoryAdapter(bookingAdapter));

  const commissionAdapter = createInMemoryCommissionRepositoryAdapter(bookingAdapter);
  setCommissionRepositoryAdapter(commissionAdapter);

  return { bookingAdapter, commissionAdapter, pricingAdapter };
}

function renderCommissionApp(route = '/admin/commission-and-fee') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Phase 9 — Commission & Fee Management (Review, Approval & Bookkeeping Posting)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockOnAuthStateChanged.mockReset();
    mockGetDoc.mockReset();
  });

  afterEach(() => {
    cleanup();
    resetCommissionRepositoryAdapter();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
  });

  describe('A. Eligibility & Period Completion Rules', () => {
    it('accepts completed studio Rehearsal & Recording sessions and strictly excludes non-completed, WFA, and missing actualCompletedAt bookings', () => {
      const novBounds = resolveCommissionPeriodBounds({
        preset: 'custom',
        customStartDate: '2026-11-01',
        customEndDate: '2026-11-30',
      });
      const octBounds = resolveCommissionPeriodBounds({
        preset: 'custom',
        customStartDate: '2026-10-01',
        customEndDate: '2026-10-31',
      });

      const rehearsalCompleted = makeSeedBooking({ id: 'b-reh', serviceTypeId: 'rehearsal' });
      const recordingCompleted = makeSeedBooking({
        id: 'b-rec',
        serviceTypeId: 'recording',
        serviceTypeName: 'Recording',
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'hourly', rate: 10000, amount: 30000 },
          owner: { basis: 'none', rate: 0, amount: 0 },
          recordingOperator: { basis: 'fixed', rate: 75000, amount: 75000 },
          settingsVersion: 2,
        },
      });
      const upcoming = makeSeedBooking({
        id: 'b-up',
        sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      });
      const inProgress = makeSeedBooking({
        id: 'b-ip',
        sessionStatus: BOOKING_SESSION_STATUS.IN_PROGRESS,
      });
      const cancelled = makeSeedBooking({
        id: 'b-can',
        sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      });
      const noShow = makeSeedBooking({
        id: 'b-ns',
        sessionStatus: BOOKING_SESSION_STATUS.NO_SHOW,
      });
      const wfaService = makeSeedBooking({
        id: 'b-wfa',
        serviceTypeId: 'mixing',
        serviceTypeName: 'Mixing',
        deliveryMode: 'wfa',
      });
      const missingCompletedAt = makeSeedBooking({
        id: 'b-no-ts',
        actualCompletedAt: null,
      });

      // Booking created Oct 31, completed Nov 1 at 00:30 WIB (2026-10-31T17:30:00Z)
      const crossMonth = makeSeedBooking({
        id: 'b-cross',
        date: '2026-10-31',
        actualCompletedAt: new Date('2026-10-31T17:30:00.000Z'), // Nov 1 00:30 WIB in Asia/Jakarta!
      });

      expect(
        classifyBookingForCommission(rehearsalCompleted, { periodBounds: novBounds }).status,
      ).toBe(COMMISSION_ITEM_STATUS.PENDING);
      expect(
        classifyBookingForCommission(recordingCompleted, { periodBounds: novBounds }).status,
      ).toBe(COMMISSION_ITEM_STATUS.PENDING);
      expect(classifyBookingForCommission(upcoming, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
      expect(classifyBookingForCommission(inProgress, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
      expect(classifyBookingForCommission(cancelled, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
      expect(classifyBookingForCommission(noShow, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
      expect(classifyBookingForCommission(wfaService, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
      expect(
        classifyBookingForCommission(missingCompletedAt, { periodBounds: novBounds }).status,
      ).toBe(COMMISSION_ITEM_STATUS.NOT_ELIGIBLE);

      // Must belong to November (completion date), NOT October (booking.date)
      expect(classifyBookingForCommission(crossMonth, { periodBounds: novBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.PENDING,
      );
      expect(classifyBookingForCommission(crossMonth, { periodBounds: octBounds }).status).toBe(
        COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      );
    });
  });

  describe('B & C. Snapshot Compatibility, Settings Isolation & Payable vs Owner Allocation Math', () => {
    it('supports V2 + Legacy V1 snapshots, isolates Owner Allocation from Total Payable, routes invalid/null snapshots to Needs Review, and never recalculates after Settings change', async () => {
      const v2Parsed = parseCommissionSnapshot({
        schemaVersion: 2,
        staff: { basis: 'hourly', rate: 10000, amount: 30000 },
        owner: { basis: 'fixed', rate: 25000, amount: 25000 },
        recordingOperator: { basis: 'manual', rate: 80000, amount: 80000 },
        settingsVersion: 2,
      });
      expect(v2Parsed.isValid).toBe(true);
      expect(v2Parsed.staffPayableAmount).toBe(30000);
      expect(v2Parsed.recordingOperatorPayableAmount).toBe(80000);
      expect(v2Parsed.ownerAllocationReference).toBe(25000);
      expect(v2Parsed.payableTotal).toBe(110000); // Owner 25k excluded!

      const v1Parsed = parseCommissionSnapshot({
        staffBasis: 'rehearsal_hourly',
        staffRate: 10000,
        staffAmount: 20000,
        recordingOperatorAmount: 50000,
        settingsVersion: 1,
      });
      expect(v1Parsed.isValid).toBe(true);
      expect(v1Parsed.schemaVersion).toBe(1);
      expect(v1Parsed.staffPayableAmount).toBe(20000);
      expect(v1Parsed.recordingOperatorPayableAmount).toBe(50000);
      expect(v1Parsed.ownerAllocationReference).toBe(0);
      expect(v1Parsed.payableTotal).toBe(70000);

      expect(parseCommissionSnapshot(null).isValid).toBe(false);
      expect(
        parseCommissionSnapshot({
          schemaVersion: 2,
          staff: { basis: 'hourly', rate: 10000, amount: -5000 },
          owner: { basis: 'none', rate: 0, amount: 0 },
          recordingOperator: { basis: 'none', rate: 0, amount: 0 },
          settingsVersion: 2,
        }).isValid,
      ).toBe(false);

      // Booking with ONLY Owner Allocation -> zero_payable (never triggers expense posting)
      const ownerOnlyBooking = makeSeedBooking({
        id: 'b-owner-only',
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'none', rate: 0, amount: 0 },
          owner: { basis: 'fixed', rate: 40000, amount: 40000 },
          recordingOperator: { basis: 'none', rate: 0, amount: 0 },
          settingsVersion: 2,
        },
      });
      expect(classifyBookingForCommission(ownerOnlyBooking).status).toBe(
        COMMISSION_ITEM_STATUS.ZERO_PAYABLE,
      );

      // Saving a completely different Settings V3 fee rate NEVER alters already-recorded snapshots
      const pricingAdapter = createInMemoryPricingSettingsAdapter({
        ...DEFAULT_PRICING_SETTINGS,
        version: 2,
      });
      const updated = structuredClone(DEFAULT_PRICING_SETTINGS);
      updated.version = 2;
      updated.serviceTypes[0].options[0].fees.staff = { mode: 'fixed', amount: 999000 };
      await savePricingSettings({
        draftSettings: updated,
        expectedVersion: 2,
        actorUid: 'owner-uid-1',
        adapter: pricingAdapter,
      });

      const bookingHistorical = makeSeedBooking({
        id: 'b-hist',
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'hourly', rate: 10000, amount: 20000 },
          owner: { basis: 'fixed', rate: 15000, amount: 15000 },
          recordingOperator: { basis: 'none', rate: 0, amount: 0 },
          settingsVersion: 2,
        },
      });
      const classifiedAfterSettingsChange = classifyBookingForCommission(bookingHistorical);
      expect(classifiedAfterSettingsChange.staffPayableAmount).toBe(20000);
      expect(classifiedAfterSettingsChange.payableTotal).toBe(20000);

      const totals = computeCommissionAggregateTotals([
        classifiedAfterSettingsChange,
        classifyBookingForCommission(
          makeSeedBooking({
            id: 'b-v1',
            commissionSnapshot: {
              staffBasis: 'package',
              staffRate: 15000,
              staffAmount: 15000,
              recordingOperatorAmount: 60000,
              settingsVersion: 1,
            },
          }),
        ),
      ]);
      expect(totals).toEqual({
        completedSessionsCount: 2,
        staffCommissionTotal: 35000,
        recordingOperatorFeeTotal: 60000,
        payableTotal: 95000,
        ownerAllocationReferenceTotal: 15000,
      });
    });
  });

  describe('E, F & G. Atomic Posting Transaction, Concurrency, Idempotency & Data Isolation', () => {
    it('creates CommissionBatch, unique CommissionPostingItems, and Staff/Operator BookkeepingEntries atomically without touching Owner Allocation, snapshots, or customer invoices', async () => {
      const bookings = [
        makeSeedBooking({
          id: 'b-post-1',
          customerName: 'Band Satu',
          serviceTypeId: 'recording',
          serviceTypeName: 'Recording',
          commissionSnapshot: {
            schemaVersion: 2,
            staff: { basis: 'hourly', rate: 10000, amount: 30000 },
            owner: { basis: 'fixed', rate: 25000, amount: 25000 },
            recordingOperator: { basis: 'fixed', rate: 75000, amount: 75000 },
            settingsVersion: 2,
          },
        }),
        makeSeedBooking({
          id: 'b-post-2',
          customerName: 'Band Dua (V1)',
          commissionSnapshot: {
            staffBasis: 'rehearsal_hourly',
            staffRate: 10000,
            staffAmount: 20000,
            recordingOperatorAmount: 0,
            settingsVersion: 1,
          },
        }),
      ];
      const seedInvoices = [
        {
          id: 'inv_b-post-1',
          invoiceNumber: '37MS-20261110-AABBCCDDEEFF',
          bookingId: 'b-post-1',
          customerId: 'cust-1',
          invoiceStatus: 'issued',
          currency: 'IDR',
          customerSnapshot: { name: 'Band Satu', phone: '+6281234567890', bandName: '' },
          bookingSnapshot: {
            serviceTypeName: 'Recording',
            serviceOptionName: 'Reguler',
            studioId: 'room-a',
            bookingDate: '2026-11-10',
            startMinute: 600,
            endMinute: 720,
            durationMinutes: 120,
          },
          financialSnapshot: { subtotal: 300000, discountAmount: 0, totalAmount: 300000 },
          amountPaid: 0,
          balanceDue: 300000,
          paymentStatus: 'unpaid',
          invoiceDate: { seconds: 1794300000 },
          dueDate: null,
          lastPaymentTransactionId: null,
          voidReason: '',
          createdByUid: 'staff-1',
          updatedByUid: 'staff-1',
          version: 1,
        },
      ];

      const { bookingAdapter, commissionAdapter } = setupSharedAdapters(bookings, seedInvoices);

      // 1. Staff attempting to call postCommissionBatch is rejected immediately
      await expect(
        postCommissionBatch({
          batchId: 'cbt_staff_reject',
          actorUid: 'staff-1',
          actorRole: 'staff',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          selectedBookings: [{ bookingId: 'b-post-1', expectedVersion: 2 }],
          adapter: commissionAdapter,
        }),
      ).rejects.toMatchObject({ code: 'commission/owner-only' });

      // 2. Concurrent posting from two Owner tabs for overlapping booking -> only 1 succeeds
      const attempt1 = postCommissionBatch({
        batchId: 'cbt_concurrent_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: '1–30 November 2026',
        selectedBookings: [
          { bookingId: 'b-post-1', expectedVersion: 2 },
          { bookingId: 'b-post-2', expectedVersion: 2 },
        ],
        adapter: commissionAdapter,
      });

      const attempt2 = postCommissionBatch({
        batchId: 'cbt_concurrent_2',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        periodLabel: '1–30 November 2026',
        selectedBookings: [{ bookingId: 'b-post-2', expectedVersion: 2 }],
        adapter: commissionAdapter,
      });

      const [res1, res2] = await Promise.allSettled([attempt1, attempt2]);
      expect(res1.status).toBe('fulfilled');
      expect(res2.status).toBe('rejected');
      expect(res2.reason.code).toBe('commission/already-posted');

      const { batch, postingItems, bookkeepingEntries } = res1.value;
      expect(batch.bookingCount).toBe(2);
      expect(batch.staffCommissionTotal).toBe(50000);
      expect(batch.recordingOperatorFeeTotal).toBe(75000);
      expect(batch.payableTotal).toBe(125000); // Owner 25k excluded!
      expect(batch.ownerAllocationReferenceTotal).toBe(25000);
      expect(postingItems).toHaveLength(2);
      expect(bookkeepingEntries).toHaveLength(2);

      const staffEntry = bookkeepingEntries.find(
        (e) => e.category === BOOKKEEPING_CATEGORY.STAFF_COMMISSION,
      );
      const opEntry = bookkeepingEntries.find(
        (e) => e.category === BOOKKEEPING_CATEGORY.RECORDING_OPERATOR_FEE,
      );

      expect(staffEntry).toMatchObject({
        id: buildCommissionBookkeepingEntryId('cbt_concurrent_1', 'staff'),
        sourceModule: BOOKKEEPING_SOURCE_MODULE,
        sourceType: BOOKKEEPING_SOURCE_TYPE,
        sourceId: 'cbt_concurrent_1',
        entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
        amount: 50000,
        settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
      });
      expect(opEntry).toMatchObject({
        id: buildCommissionBookkeepingEntryId('cbt_concurrent_1', 'operator'),
        sourceModule: BOOKKEEPING_SOURCE_MODULE,
        sourceType: BOOKKEEPING_SOURCE_TYPE,
        sourceId: 'cbt_concurrent_1',
        entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
        amount: 75000,
        settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
      });

      // 3. Idempotent retry with exact same batchId replays cleanly without creating duplicates
      const replay = await postCommissionBatch({
        batchId: 'cbt_concurrent_1',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        selectedBookings: [
          { bookingId: 'b-post-1', expectedVersion: 2 },
          { bookingId: 'b-post-2', expectedVersion: 2 },
        ],
        adapter: commissionAdapter,
      });
      expect(replay.idempotentReplay).toBe(true);

      const state = commissionAdapter._inspectState();
      expect(state.commissionBatches.size).toBe(1);
      expect(state.commissionPostingItems.size).toBe(2);
      expect(state.bookkeepingEntries.size).toBe(2);

      // 4. Customer Invoice and historical booking commissionSnapshot remained completely untouched
      const bookingSnapState = bookingAdapter._inspectState();
      expect(bookingSnapState.invoices.get('inv_b-post-1').balanceDue).toBe(300000);
      expect(bookingSnapState.bookings.get('b-post-1').commissionSnapshot.staff.amount).toBe(30000);
    });

    it('rejects stale booking versions and non-completed bookings atomically without partial writes, and skips creating empty Operator bookkeeping entries when only Staff fee exists', async () => {
      const staleCandidate = makeSeedBooking({ id: 'b-stale-1', version: 3 });
      const upcomingCandidate = makeSeedBooking({
        id: 'b-upcoming-status',
        sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      });
      const staffOnlyCandidate = makeSeedBooking({
        id: 'b-staff-only',
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'fixed', rate: 25000, amount: 25000 },
          owner: { basis: 'fixed', rate: 50000, amount: 50000 },
          recordingOperator: { basis: 'none', rate: 0, amount: 0 },
          settingsVersion: 2,
        },
      });

      const { commissionAdapter } = setupSharedAdapters([
        staleCandidate,
        upcomingCandidate,
        staffOnlyCandidate,
      ]);

      // Stale booking version triggers full rollback
      await expect(
        postCommissionBatch({
          batchId: 'cbt_stale_fail',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          selectedBookings: [
            { bookingId: 'b-staff-only', expectedVersion: 2 },
            { bookingId: 'b-stale-1', expectedVersion: 2 }, // stale (DB is v3)
          ],
          adapter: commissionAdapter,
        }),
      ).rejects.toMatchObject({ code: 'commission/stale-review' });

      expect(commissionAdapter._inspectState().commissionPostingItems.size).toBe(0);
      expect(commissionAdapter._inspectState().commissionBatches.size).toBe(0);

      // Non-completed booking triggers full rollback
      await expect(
        postCommissionBatch({
          batchId: 'cbt_noncomp_fail',
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          selectedBookings: [{ bookingId: 'b-upcoming-status', expectedVersion: 2 }],
          adapter: commissionAdapter,
        }),
      ).rejects.toMatchObject({ code: 'commission/booking-not-completed' });

      // Valid Staff-only booking creates ONLY staff entry (NO operator entry, NO owner entry)
      const ok = await postCommissionBatch({
        batchId: 'cbt_staff_only',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        selectedBookings: [{ bookingId: 'b-staff-only', expectedVersion: 2 }],
        adapter: commissionAdapter,
      });

      expect(ok.batch.staffCommissionTotal).toBe(25000);
      expect(ok.batch.recordingOperatorFeeTotal).toBe(0);
      expect(ok.batch.payableTotal).toBe(25000);
      expect(ok.batch.ownerAllocationReferenceTotal).toBe(50000);
      expect(ok.bookkeepingEntries).toHaveLength(1);
      expect(ok.bookkeepingEntries[0].category).toBe(BOOKKEEPING_CATEGORY.STAFF_COMMISSION);
    });

    it('enforces Owner-only idempotent Needs Review resolution without mutating booking snapshots or bookkeepingEntries', async () => {
      const legacyNoSnapshot = makeSeedBooking({
        id: 'b-legacy-missing-snap',
        commissionSnapshot: null,
        version: 2,
      });
      const { bookingAdapter, commissionAdapter } = setupSharedAdapters([legacyNoSnapshot]);

      await expect(
        resolveNeedsReviewBooking({
          bookingId: 'b-legacy-missing-snap',
          expectedVersion: 2,
          reason: 'Staff tidak boleh menyelesaikan',
          actorUid: 'staff-1',
          actorRole: 'staff',
          adapter: commissionAdapter,
        }),
      ).rejects.toMatchObject({ code: 'commission/owner-only' });

      const firstResolve = await resolveNeedsReviewBooking({
        bookingId: 'b-legacy-missing-snap',
        expectedVersion: 2,
        reason: 'Booking lama sebelum sistem komisi aktif',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: commissionAdapter,
      });
      expect(firstResolve.idempotentReplay).toBe(false);

      const replayResolve = await resolveNeedsReviewBooking({
        bookingId: 'b-legacy-missing-snap',
        expectedVersion: 2,
        reason: 'Alasan duplikat',
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        adapter: commissionAdapter,
      });
      expect(replayResolve.idempotentReplay).toBe(true);

      const state = commissionAdapter._inspectState();
      expect(state.commissionReviewResolutions.size).toBe(1);
      expect(state.bookkeepingEntries.size).toBe(0);
      expect(
        bookingAdapter._inspectState().bookings.get('b-legacy-missing-snap').commissionSnapshot,
      ).toBeNull();
    });

    it('declares strict Owner-only Firestore Rules contracts for commissionBatches, commissionPostingItems, bookkeepingEntries, and commissionReviewResolutions', () => {
      const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
      expect(rulesContent).toContain('match /commissionBatches/{batchId}');
      expect(rulesContent).toContain('match /commissionPostingItems/{itemId}');
      expect(rulesContent).toContain('match /bookkeepingEntries/{entryId}');
      expect(rulesContent).toContain('match /commissionReviewResolutions/{resolutionId}');
      expect(rulesContent).toContain('function isValidCommissionBatchCreate(data, batchId)');
      expect(rulesContent).toContain('function isValidCommissionPostingItemCreate(data, itemId)');
      expect(rulesContent).toContain(
        'function isValidCommissionBookkeepingEntryCreate(data, entryId)',
      );
      expect(rulesContent).toContain(
        'function isValidCommissionReviewResolutionCreate(data, resolutionId)',
      );
      expect(rulesContent).toContain('allow update, delete: if false;');
    });
  });

  describe('D, F & G. Commission UI Integration (/admin/commission-and-fee)', () => {
    it('blocks Active Staff with Owner Access Required and keeps financial records unread', async () => {
      setupSharedAdapters([makeSeedBooking({ id: 'b-hidden-1', customerName: 'Secret Client' })]);
      mockAuthenticatedStaff('staff', 'staff-uid-2');

      renderCommissionApp('/admin/commission-and-fee');

      expect(await screen.findByRole('heading', { name: /owner access required/i })).toBeTruthy();
      expect(screen.getByText(/read only — owner approval required/i)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /post to pembukuan/i })).toBeNull();
      expect(screen.queryByText('Secret Client')).toBeNull();
    });

    it('supports full Owner flow: period review, Needs Review guard, select all & clear, Confirm & Post to Pembukuan, Posted audit history, and prevents re-selecting posted items', async () => {
      const user = userEvent.setup();

      // Use fixed current date in Jakarta so "This Month" matches seeded completed sessions!
      const nowJakarta = resolveCommissionPeriodBounds({ preset: 'this_month' });
      const midThisMonthIso = `${nowJakarta.periodStart.slice(0, 8)}10T10:00:00.000Z`;
      const prevMonthBounds = resolveCommissionPeriodBounds({ preset: 'last_month' });
      const prevMonthTs = new Date(`${prevMonthBounds.periodStart.slice(0, 8)}12T10:00:00.000Z`);

      const eligibleRec = makeSeedBooking({
        id: 'bkg-ui-rec',
        customerName: 'Luna Project',
        bandName: 'Moonlight',
        serviceTypeId: 'recording',
        serviceTypeName: 'Recording',
        serviceOptionName: 'Live Recording 3H',
        actualCompletedAt: new Date(midThisMonthIso),
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'hourly', rate: 10000, amount: 30000 },
          owner: { basis: 'fixed', rate: 20000, amount: 20000 },
          recordingOperator: { basis: 'fixed', rate: 80000, amount: 80000 },
          settingsVersion: 2,
        },
      });
      const eligibleReh = makeSeedBooking({
        id: 'bkg-ui-reh',
        customerName: 'Band Senja',
        bandName: 'Senja',
        serviceTypeId: 'rehearsal',
        serviceTypeName: 'Rehearsal',
        actualCompletedAt: new Date(midThisMonthIso),
        commissionSnapshot: {
          schemaVersion: 2,
          staff: { basis: 'hourly', rate: 10000, amount: 20000 },
          owner: { basis: 'none', rate: 0, amount: 0 },
          recordingOperator: { basis: 'none', rate: 0, amount: 0 },
          settingsVersion: 2,
        },
      });
      const needsReviewItem = makeSeedBooking({
        id: 'bkg-ui-bad',
        customerName: 'Booking Tanpa Snapshot',
        bandName: '',
        actualCompletedAt: new Date(midThisMonthIso),
        commissionSnapshot: null,
      });
      const lastMonthSession = makeSeedBooking({
        id: 'bkg-ui-prev',
        customerName: 'Band Bulan Lalu',
        actualCompletedAt: prevMonthTs,
      });

      const { commissionAdapter } = setupSharedAdapters([
        eligibleRec,
        eligibleReh,
        needsReviewItem,
        lastMonthSession,
      ]);
      mockAuthenticatedStaff('owner', 'owner-uid-1');

      renderCommissionApp('/admin/commission-and-fee');

      // 1. Wait for current month review rows
      await waitFor(() => {
        expect(screen.getAllByText('Luna Project').length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('Band Senja').length).toBeGreaterThan(0);
      expect(screen.queryByText('Band Bulan Lalu')).toBeNull();

      // Needs Review section starts compact/collapsed; expanding shows missing snapshot item and allows explicit Owner dismissal
      expect(screen.getByText(/needs review \(1\)/i)).toBeTruthy();
      expect(screen.queryByText(/booking tanpa snapshot/i)).toBeNull();
      await user.click(screen.getByRole('button', { name: /lihat \(1\)/i }));
      expect(screen.getByText(/booking tanpa snapshot/i)).toBeTruthy();

      // Dismiss Needs Review item via Owner audit resolution dialog
      await user.click(screen.getByRole('button', { name: /tandai selesai/i }));
      const resolveDialog = await screen.findByRole('dialog', {
        name: /tandai selesai diperiksa/i,
      });
      await user.click(within(resolveDialog).getByRole('button', { name: /tandai selesai/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByText(/needs review \(1\)/i)).toBeNull();
      });
      expect(commissionAdapter._inspectState().commissionReviewResolutions.size).toBe(1);
      expect(
        screen.getByText(/1 sesi lama pada periode ini sudah ditandai selesai diperiksa/i),
      ).toBeTruthy();

      // 2. Test Last Month preset & Custom Date Range filter, then return to This Month
      await user.click(screen.getByRole('button', { name: /last month/i }));
      expect(await screen.findAllByText('Band Bulan Lalu')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /custom date range/i }));
      expect(screen.getByLabelText(/dari tanggal selesai/i)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /this month/i }));
      await screen.findAllByText('Luna Project');

      // 3. Test Search filter & clear
      const searchBox = screen.getByLabelText(/cari booking id, pelanggan, band, atau paket/i);
      await user.type(searchBox, 'Moonlight');
      expect(screen.queryByText('Band Senja')).toBeNull();
      await user.clear(searchBox);
      await screen.findAllByText('Band Senja');

      // 4. Open Booking Detail Drawer to inspect V2 basis & Owner Reference
      const detailButtons = screen.getAllByRole('button', { name: /^detail$/i });
      await user.click(detailButtons[0]);
      const drawer = await screen.findByRole('dialog', { name: /luna project/i });
      expect(within(drawer).getByText(/owner allocation \(referensi saja\)/i)).toBeTruthy();
      await user.click(
        within(drawer).getByRole('button', { name: /tutup detail komisi booking/i }),
      );
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // 5. Select All Eligible -> verify live SELECTED ITEMS summary & Clear -> Select One -> Select All
      const selectAllBtn = screen.getByRole('button', { name: /select all eligible \(2\)/i });
      await user.click(selectAllBtn);

      const postBtn = screen.getByRole('button', { name: /post to pembukuan/i });
      expect(postBtn.hasAttribute('disabled')).toBe(false);

      // Clear & test single -> multiple selection
      await user.click(screen.getAllByRole('button', { name: /clear selection/i })[0]);
      expect(postBtn.hasAttribute('disabled')).toBe(true);

      await user.click(screen.getByLabelText('Pilih booking bkg-ui-rec'));
      expect(postBtn.hasAttribute('disabled')).toBe(false);
      await user.click(screen.getByLabelText('Pilih booking bkg-ui-reh'));
      await user.click(postBtn);

      // 6. Confirm Commission Posting Dialog verifies summary totals (Staff 50k + Operator 80k = 130k, Owner Ref 20k)
      const confirmDialog = await screen.findByRole('dialog', {
        name: /confirm commission posting/i,
      });
      expect(within(confirmDialog).getByText(/rp\s*130\.000/i)).toBeTruthy();
      expect(
        within(confirmDialog).getByText(
          /posting ini belum berarti pembayaran kepada staff atau operator sudah dilakukan/i,
        ),
      ).toBeTruthy();

      await user.click(within(confirmDialog).getByRole('button', { name: /confirm & post/i }));

      // 7. Pending queue clears the 2 posted items; switching Status Filter to Posted shows them non-selectable!
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      const statusSelect = screen.getByLabelText(/filter status posting sesi/i);
      await user.selectOptions(statusSelect, 'posted');

      await waitFor(() => {
        expect(screen.getAllByText('Luna Project').length).toBeGreaterThan(0);
      });
      const postedCheckbox = screen.getByLabelText('Pilih booking bkg-ui-rec');
      expect(postedCheckbox.hasAttribute('disabled')).toBe(true);

      // 8. Switch to Posted tab -> verify Commission Batch renders & open Batch Detail Drawer -> inspect Bookkeeping entries
      await user.click(screen.getByRole('tab', { name: /posted/i }));
      const batchDetailBtn = await screen.findByRole('button', { name: /detail batch/i });
      expect(screen.getByText(/posted • belum dibayar di pembukuan/i)).toBeTruthy();

      await user.click(batchDetailBtn);
      const batchDrawer = await screen.findByRole('dialog');
      expect(within(batchDrawer).getByText(/catatan masuk ke pembukuan \(2\)/i)).toBeTruthy();
      expect(within(batchDrawer).getByText(/rincian booking dalam batch \(2\)/i)).toBeTruthy();

      expect(commissionAdapter._inspectState().commissionBatches.size).toBe(1);
      expect(commissionAdapter._inspectState().commissionPostingItems.size).toBe(2);
      expect(commissionAdapter._inspectState().bookkeepingEntries.size).toBe(2);
    });
  });
});
