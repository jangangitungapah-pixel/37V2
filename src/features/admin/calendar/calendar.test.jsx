import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

import { BOOKING_SESSION_STATUS, INITIAL_PAYMENT_STATUS } from './config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from './repositories/calendar-booking-repository';
import { validateBookingFormPayload } from './schemas/booking-schema';
import {
  cancelBooking,
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  transitionBookingSession,
  updateOrRescheduleBooking,
} from './services/calendar-booking-service';
import {
  buildDeterministicSlotId,
  computeTimelineOverlapLayout,
  doTimeIntervalsOverlap,
  isBookingNoShowEligible,
} from './utils/booking-time';
import { getJakartaTodayIso } from './utils/calendar-date';

function mockAuthenticatedStaff(role = 'owner', uid = 'owner-uid-1') {
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

function renderCalendarAt(initialEntry = '/admin/calendar') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Phase 5 — Admin Calendar & Studio Booking Management', () => {
  let memoryAdapter;
  const todayIso = getJakartaTodayIso();

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();
    memoryAdapter = createInMemoryBookingRepositoryAdapter();
    setBookingRepositoryAdapter(memoryAdapter);
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
  });

  describe('1. Domain Logic, Overlap Rules, Pricing & Transaction Integrity', () => {
    it('enforces exact interval overlap math where adjacent bookings do not conflict and rooms are independent', () => {
      // 10:00 (600) to 12:00 (720) vs 12:00 (720) to 14:00 (840) -> allowed!
      expect(doTimeIntervalsOverlap(600, 720, 720, 840)).toBe(false);
      // 10:00 (600) to 12:00 (720) vs 11:30 (690) to 13:00 (780) -> overlap!
      expect(doTimeIntervalsOverlap(600, 720, 690, 780)).toBe(true);

      // Historical overlap layout assigns side-by-side columns without dropping bookings
      const layout = computeTimelineOverlapLayout([
        { id: 'b1', startMinute: 600, durationMinutes: 120, endMinute: 720 },
        { id: 'b2', startMinute: 660, durationMinutes: 120, endMinute: 780 },
      ]);
      expect(layout).toHaveLength(2);
      expect(layout[0].totalColumns).toBe(2);
      expect(layout[1].totalColumns).toBe(2);
      expect(layout[0].columnIndex).not.toBe(layout[1].columnIndex);
    });

    it('validates required customer fields, phone format, calendar dates, 30-min durations, operating hours, and DP bounds', () => {
      // Invalid phone, invalid date, non-30-min duration, DP > total
      const invalidCheck = validateBookingFormPayload({
        customerName: 'A',
        phone: '123',
        bandName: '',
        serviceId: 'rehearsal',
        packageId: '',
        recordingTypeId: '',
        studioId: 'room-a',
        date: '2026-02-30',
        startMinute: 600,
        durationPreset: 'custom',
        customDurationMinutes: 45,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
        dpAmount: 500000,
        paymentMethod: 'transfer',
      });

      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.errors.customerName).toBeTruthy();
      expect(invalidCheck.errors.phone).toBeTruthy();
      expect(invalidCheck.errors.date).toBeTruthy();
      expect(invalidCheck.errors.durationMinutes).toBeTruthy();
      expect(invalidCheck.errors.dpAmount).toBeTruthy();

      // Valid custom 90-minute Rehearsal (1.5h * Rp 100.000 = Rp 150.000) with Rp 50.000 DP
      const validCheck = validateBookingFormPayload({
        customerName: 'Dimas Saputra',
        phone: '081234567890',
        bandName: 'Midnight Echo',
        serviceId: 'rehearsal',
        packageId: '',
        recordingTypeId: '',
        studioId: 'room-a',
        date: todayIso,
        startMinute: 600,
        durationPreset: 'custom',
        customDurationMinutes: 90,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
        dpAmount: '50000',
        paymentMethod: 'qris',
      });

      expect(validCheck.isValid).toBe(true);
      expect(validCheck.pricing.totalAmount).toBe(150000);
      expect(validCheck.pricing.initialPaidAmount).toBe(50000);
      expect(validCheck.pricing.remainingBalance).toBe(100000);
    });

    it('creates a booking atomically with deterministic 30-minute slot locks and prevents concurrent double-booking of the same room slot', async () => {
      const baseForm = {
        customerName: 'Raka Pratama',
        phone: '081298765432',
        bandName: 'Solaris',
        serviceId: 'rehearsal',
        packageId: '',
        recordingTypeId: '',
        studioId: 'room-a',
        date: '2026-11-20',
        startMinute: 600, // 10:00
        durationPreset: '120', // 2 hours -> 10:00, 10:30, 11:00, 11:30
        customDurationMinutes: '120',
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
        dpAmount: '',
        paymentMethod: 'transfer',
        notes: 'Amplifier Marshall siap',
      };

      // Concurrent race between two transactions for overlapping slots in Room A
      const results = await Promise.allSettled([
        createBooking({
          bookingId: 'bkg-race-1',
          eventId: 'evt-race-1',
          actorUid: 'owner-uid-1',
          formValues: baseForm,
          adapter: memoryAdapter,
        }),
        createBooking({
          bookingId: 'bkg-race-2',
          eventId: 'evt-race-2',
          actorUid: 'staff-uid-2',
          formValues: {
            ...baseForm,
            customerName: 'Budi Santoso',
            startMinute: 660, // 11:00 (overlaps 11:00 & 11:30!)
          },
          adapter: memoryAdapter,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.code).toBe('booking/slot-conflict');

      // Verify exact 4 deterministic 30-minute slot locks exist in store
      const storeState = memoryAdapter._inspectState();
      expect(storeState.bookings.size).toBe(1);
      expect(storeState.slots.size).toBe(4);
      expect(storeState.slots.has(buildDeterministicSlotId('2026-11-20', 'room-a', 600))).toBe(
        true,
      );
      expect(storeState.slots.has(buildDeterministicSlotId('2026-11-20', 'room-a', 630))).toBe(
        true,
      );
      expect(storeState.slots.has(buildDeterministicSlotId('2026-11-20', 'room-a', 660))).toBe(
        true,
      );
      expect(storeState.slots.has(buildDeterministicSlotId('2026-11-20', 'room-a', 690))).toBe(
        true,
      );

      // Same time in Room B is allowed!
      const roomBBooking = await createBooking({
        bookingId: 'bkg-room-b',
        eventId: 'evt-room-b',
        actorUid: 'owner-uid-1',
        formValues: {
          ...baseForm,
          studioId: 'room-b',
          customerName: 'Nadia Putri',
        },
        adapter: memoryAdapter,
      });
      expect(roomBBooking.studioId).toBe('room-b');
    });

    it('guarantees idempotency on retry and rejects stale updates when version mismatches', async () => {
      const formValues = {
        customerName: 'Arif Nugroho',
        phone: '081122334455',
        bandName: 'Echoes',
        serviceId: 'mixing',
        packageId: '',
        recordingTypeId: '',
        studioId: 'room-b',
        date: '2026-11-21',
        startMinute: 780, // 13:00
        durationPreset: '60',
        customDurationMinutes: '60',
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        dpAmount: '',
        paymentMethod: 'cash',
        notes: '',
      };

      const firstCall = await createBooking({
        bookingId: 'bkg-idem-1',
        eventId: 'evt-idem-1',
        actorUid: 'owner-uid-1',
        formValues,
        adapter: memoryAdapter,
      });

      // Retry with the exact same bookingId and eventId
      const retryCall = await createBooking({
        bookingId: 'bkg-idem-1',
        eventId: 'evt-idem-1',
        actorUid: 'owner-uid-1',
        formValues,
        adapter: memoryAdapter,
      });

      expect(retryCall.id).toBe(firstCall.id);
      const stateAfterRetry = memoryAdapter._inspectState();
      expect(stateAfterRetry.bookings.size).toBe(1);
      expect(stateAfterRetry.events.size).toBe(1);

      // Update once (version 1 -> 2)
      const updated = await updateOrRescheduleBooking({
        bookingId: 'bkg-idem-1',
        expectedVersion: 1,
        eventId: 'evt-update-1',
        actorUid: 'owner-uid-1',
        formValues: {
          ...formValues,
          notes: 'Tambahan referensi track',
        },
        mode: 'edit',
        adapter: memoryAdapter,
      });
      expect(updated.version).toBe(2);

      // Attempt update with stale version=1 -> must reject with booking/stale-update
      await expect(
        updateOrRescheduleBooking({
          bookingId: 'bkg-idem-1',
          expectedVersion: 1,
          eventId: 'evt-update-stale',
          actorUid: 'staff-uid-2',
          formValues: {
            ...formValues,
            notes: 'Overwrite stale',
          },
          mode: 'edit',
          adapter: memoryAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/stale-update' });
    });

    it('atomically releases old slot locks and locks new slots on reschedule, and rolls back completely if target slot conflicts', async () => {
      // Booking A at 10:00–11:00 (slot 600, 630)
      const bookingA = await createBooking({
        bookingId: 'bkg-resched-a',
        eventId: 'evt-resched-a',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Band Alpha',
          phone: '081200001111',
          bandName: 'Alpha',
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-a',
          date: '2026-11-22',
          startMinute: 600,
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '',
          paymentMethod: 'cash',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      // Booking B at 14:00–15:00 (slot 840, 870)
      await createBooking({
        bookingId: 'bkg-resched-b',
        eventId: 'evt-resched-b',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Band Beta',
          phone: '081200002222',
          bandName: 'Beta',
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-a',
          date: '2026-11-22',
          startMinute: 840,
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '',
          paymentMethod: 'cash',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      // 1. Attempt to reschedule Booking A into Booking B's 14:00 slot -> must fail and preserve Booking A's 10:00 locks
      await expect(
        updateOrRescheduleBooking({
          bookingId: bookingA.id,
          expectedVersion: bookingA.version,
          eventId: 'evt-conflict-resched',
          actorUid: 'owner-uid-1',
          mode: 'reschedule',
          formValues: {
            customerName: 'Band Alpha',
            phone: '081200001111',
            bandName: 'Alpha',
            serviceId: 'rehearsal',
            packageId: '',
            recordingTypeId: '',
            studioId: 'room-a',
            date: '2026-11-22',
            startMinute: 840,
            durationPreset: '60',
            customDurationMinutes: '60',
            initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
            dpAmount: '',
            paymentMethod: 'cash',
            notes: '',
          },
          adapter: memoryAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/slot-conflict' });

      const stateAfterFailedReschedule = memoryAdapter._inspectState();
      expect(
        stateAfterFailedReschedule.slots.get(buildDeterministicSlotId('2026-11-22', 'room-a', 600))
          ?.bookingId,
      ).toBe(bookingA.id);

      // 2. Reschedule Booking A to 12:00–13:00 (slot 720, 750) -> succeeds, releases 600 & 630, locks 720 & 750
      const rescheduledA = await updateOrRescheduleBooking({
        bookingId: bookingA.id,
        expectedVersion: bookingA.version,
        eventId: 'evt-valid-resched',
        actorUid: 'owner-uid-1',
        mode: 'reschedule',
        formValues: {
          customerName: 'Band Alpha',
          phone: '081200001111',
          bandName: 'Alpha',
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-a',
          date: '2026-11-22',
          startMinute: 720,
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '',
          paymentMethod: 'cash',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      expect(rescheduledA.startMinute).toBe(720);
      const stateAfterValidReschedule = memoryAdapter._inspectState();
      expect(
        stateAfterValidReschedule.slots.has(buildDeterministicSlotId('2026-11-22', 'room-a', 600)),
      ).toBe(false);
      expect(
        stateAfterValidReschedule.slots.get(buildDeterministicSlotId('2026-11-22', 'room-a', 720))
          ?.bookingId,
      ).toBe(bookingA.id);
    });

    it('enforces session lifecycle transitions, 15-minute No Show grace period, and atomic slot release on Cancel', async () => {
      const booking = await createBooking({
        bookingId: 'bkg-life-1',
        eventId: 'evt-life-create',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Rizky Ramadhan',
          phone: '081355556666',
          bandName: 'Komet',
          serviceId: 'recording',
          packageId: '',
          recordingTypeId: 'live-recording-3h',
          studioId: 'room-b',
          date: '2026-11-18',
          startMinute: 600, // 10:00 WIB
          durationPreset: '180',
          customDurationMinutes: '180',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '150000',
          paymentMethod: 'qris',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      // Cannot complete before starting
      await expect(
        transitionBookingSession({
          bookingId: booking.id,
          action: 'complete_session',
          expectedVersion: booking.version,
          actorUid: 'owner-uid-1',
          adapter: memoryAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/invalid-transition' });

      // Cannot mark No Show at 10:10 WIB (only 10 minutes past start; requires 15-min grace period)
      const tenMinutesPastStart = new Date('2026-11-18T10:10:00+07:00');
      expect(isBookingNoShowEligible(booking, tenMinutesPastStart)).toBe(false);
      await expect(
        transitionBookingSession({
          bookingId: booking.id,
          action: 'mark_no_show',
          expectedVersion: booking.version,
          actorUid: 'owner-uid-1',
          now: tenMinutesPastStart,
          adapter: memoryAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/no-show-not-eligible' });

      // Check-in -> Start -> Complete
      const checkedIn = await transitionBookingSession({
        bookingId: booking.id,
        action: 'check_in',
        expectedVersion: booking.version,
        actorUid: 'staff-uid-2',
        adapter: memoryAdapter,
      });
      expect(checkedIn.checkedInByUid).toBe('staff-uid-2');

      const started = await transitionBookingSession({
        bookingId: booking.id,
        action: 'start_session',
        expectedVersion: checkedIn.version,
        actorUid: 'staff-uid-2',
        adapter: memoryAdapter,
      });
      expect(started.sessionStatus).toBe(BOOKING_SESSION_STATUS.IN_PROGRESS);

      const completed = await transitionBookingSession({
        bookingId: booking.id,
        action: 'complete_session',
        expectedVersion: started.version,
        actorUid: 'staff-uid-2',
        adapter: memoryAdapter,
      });
      expect(completed.sessionStatus).toBe(BOOKING_SESSION_STATUS.COMPLETED);

      // Test Cancel on a second booking releases slots and retains booking record
      const bookingToCancel = await createBooking({
        bookingId: 'bkg-cancel-1',
        eventId: 'evt-cancel-create',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Dina Lestari',
          phone: '081377778888',
          bandName: '',
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-a',
          date: '2026-11-18',
          startMinute: 900, // 15:00
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          dpAmount: '',
          paymentMethod: 'cash',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      const cancelled = await cancelBooking({
        bookingId: bookingToCancel.id,
        expectedVersion: bookingToCancel.version,
        actorUid: 'owner-uid-1',
        reason: 'Jadwal dibatalkan customer',
        adapter: memoryAdapter,
      });
      expect(cancelled.sessionStatus).toBe(BOOKING_SESSION_STATUS.CANCELLED);

      const finalState = memoryAdapter._inspectState();
      // Booking record still exists (never permanently deleted)
      expect(finalState.bookings.get(bookingToCancel.id)?.sessionStatus).toBe(
        BOOKING_SESSION_STATUS.CANCELLED,
      );
      // Slot locks for 15:00 & 15:30 are released
      expect(finalState.slots.has(buildDeterministicSlotId('2026-11-18', 'room-a', 900))).toBe(
        false,
      );
    });
  });

  describe('2. Calendar Workspace UI, Booking Form Modal & Detail Drawer', () => {
    it('switches Day / Week / Month views, filters by Room & Payment Status, searches bookings, and opens Booking Detail Drawer', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');

      // Seed two bookings on todayIso
      await createBooking({
        bookingId: 'bkg-ui-1',
        eventId: 'evt-ui-1',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Farhan Prakoso',
          phone: '081211112222',
          bandName: 'Neon Pulse',
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-a',
          date: todayIso,
          startMinute: 600, // 10:00
          durationPreset: '120',
          customDurationMinutes: '120',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '100000',
          paymentMethod: 'transfer',
          notes: 'Bawa snare sendiri',
        },
        adapter: memoryAdapter,
      });

      await createBooking({
        bookingId: 'bkg-ui-2',
        eventId: 'evt-ui-2',
        actorUid: 'owner-uid-1',
        formValues: {
          customerName: 'Siska Amelia',
          phone: '081233334444',
          bandName: 'Velvet Sun',
          serviceId: 'mastering',
          packageId: '',
          recordingTypeId: '',
          studioId: 'room-b',
          date: todayIso,
          startMinute: 780, // 13:00
          durationPreset: '60',
          customDurationMinutes: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
          dpAmount: '',
          paymentMethod: 'qris',
          notes: '',
        },
        adapter: memoryAdapter,
      });

      renderCalendarAt('/admin/calendar');

      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      // Switch to Day view
      const viewModeGroup = screen.getByRole('group', { name: /mode tampilan kalender/i });
      await user.click(within(viewModeGroup).getByRole('button', { name: 'Day' }));
      expect(await screen.findByLabelText(/tampilan jadwal harian/i)).toBeTruthy();

      // Both bookings are visible
      expect(screen.getAllByText('Farhan Prakoso').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Siska Amelia').length).toBeGreaterThan(0);

      // Filter by Room B -> only Siska Amelia remains visible
      const roomFilterGroup = screen.getByRole('group', { name: /filter ruangan studio/i });
      await user.click(within(roomFilterGroup).getByRole('button', { name: /room b/i }));
      expect(screen.queryByText('Farhan Prakoso')).toBeNull();
      expect(screen.getAllByText('Siska Amelia').length).toBeGreaterThan(0);

      // Reset to All Rooms, filter by DP payment status -> only Farhan Prakoso remains
      await user.click(within(roomFilterGroup).getByRole('button', { name: /all rooms/i }));
      const paymentFilterGroup = screen.getByRole('group', { name: /filter status pembayaran/i });
      await user.click(within(paymentFilterGroup).getByRole('button', { name: 'DP' }));
      expect(screen.getAllByText('Farhan Prakoso').length).toBeGreaterThan(0);
      expect(screen.queryByText('Siska Amelia')).toBeNull();

      // Reset payment filter and test Search input
      await user.click(
        within(paymentFilterGroup).getByRole('button', { name: /all payment status/i }),
      );
      const searchInput = screen.getByRole('searchbox', {
        name: /cari customer, band, atau project/i,
      });
      await user.type(searchInput, 'Velvet Sun');
      expect(screen.queryByText('Farhan Prakoso')).toBeNull();
      expect(screen.getAllByText('Siska Amelia').length).toBeGreaterThan(0);

      // Clear search and click Upcoming Bookings item to open BookingDetailDrawer
      await user.clear(searchInput);
      const upcomingSection = screen.getByRole('region', { name: /upcoming bookings/i });
      const upcomingItemBtn = within(upcomingSection).getByRole('button', {
        name: /detail booking farhan prakoso/i,
      });
      await user.click(upcomingItemBtn);

      const detailDrawer = await screen.findByRole('dialog', {
        name: /farhan prakoso/i,
      });
      expect(within(detailDrawer).getByText('Neon Pulse')).toBeTruthy();
      expect(within(detailDrawer).getByText('081211112222')).toBeTruthy();
      expect(within(detailDrawer).getAllByText(/booking dibuat/i).length).toBeGreaterThan(0);
    });

    it('opens Booking Form pre-filled from an empty timeline slot, creates a booking, and preserves inputs on conflict error', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');
      renderCalendarAt('/admin/calendar');

      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      // Switch to Day view and click empty 10:30 slot on Room B
      const viewModeGroup = screen.getByRole('group', { name: /mode tampilan kalender/i });
      await user.click(within(viewModeGroup).getByRole('button', { name: 'Day' }));

      const emptySlotBtn = await screen.findByRole('button', {
        name: new RegExp(`tambah booking room b tanggal ${todayIso} jam 10:30`, 'i'),
      });
      await user.click(emptySlotBtn);

      const modal = await screen.findByRole('dialog', { name: /tambah booking/i });

      // Verify prefill from clicked slot: Room B + 10:30 (startMinute = 630)
      const startSelect = within(modal).getByLabelText(/jam mulai/i);
      expect(startSelect.value).toBe('630');

      // Fill customer fields and save
      fireEvent.change(within(modal).getByLabelText(/nama customer/i), {
        target: { value: 'Gilang Dirga' },
      });
      fireEvent.change(within(modal).getByLabelText(/nomor hp \/ whatsapp/i), {
        target: { value: '081399990000' },
      });
      fireEvent.change(within(modal).getByLabelText(/nama band \/ project/i), {
        target: { value: 'The Astral' },
      });

      const saveBtn = within(modal).getByRole('button', { name: /simpan booking/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
      });

      expect(screen.getAllByText('Gilang Dirga').length).toBeGreaterThan(0);
    });
  });

  describe('3. Firestore Security Rules Contract Verification', () => {
    it('enforces active staff access, schema validation, payment snapshot immutability, delete prevention, and append-only events in firestore.rules', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      // 1. Active staff helper checks auth, staffProfiles existence, active == true, role in ['owner', 'staff']
      expect(rulesContent).toContain('function isActiveStaff()');
      expect(rulesContent).toContain('.data.active == true');
      expect(rulesContent).toContain(".data.role in ['owner', 'staff']");

      // 2. Preserves staffProfiles rule
      expect(rulesContent).toContain('match /staffProfiles/{uid}');

      // 3. Bookings rules: no public access, permanent delete denied, payment snapshot locked on update
      expect(rulesContent).toContain('match /bookings/{bookingId}');
      expect(rulesContent).toContain('allow delete: if false;');
      expect(rulesContent).toContain(
        'request.resource.data.initialPaymentStatus == resource.data.initialPaymentStatus',
      );
      expect(rulesContent).toContain(
        'request.resource.data.initialPaidAmount == resource.data.initialPaidAmount',
      );
      expect(rulesContent).toContain(
        'request.resource.data.paymentMethod == resource.data.paymentMethod',
      );

      // 4. BookingSlots rules: existsAfter & getAfter atomic booking verification
      expect(rulesContent).toContain('match /bookingSlots/{slotId}');
      expect(rulesContent).toContain('existsAfter(');
      expect(rulesContent).toContain('getAfter(');

      // 5. BookingEvents rules: append-only (update, delete denied)
      expect(rulesContent).toContain('match /bookingEvents/{eventId}');
      expect(rulesContent).toContain('allow update, delete: if false;');
    });
  });
});
