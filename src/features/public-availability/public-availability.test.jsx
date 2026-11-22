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
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  cancelBooking,
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  transitionBookingSession,
  updateOrRescheduleBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  createInMemoryGalleryRepositoryAdapter,
  resetGalleryRepositoryAdapter,
  setGalleryRepositoryAdapter,
} from '@/features/admin/gallery/repositories/gallery-repository';
import {
  createInMemoryLandingPagePlacementAdapter,
  resetLandingPagePlacementAdapter,
  setLandingPagePlacementAdapter,
} from '@/features/admin/gallery/repositories/landing-page-placement-repository';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';

import {
  PUBLIC_AVAILABILITY_ALLOWED_KEYS,
  PUBLIC_AVAILABILITY_FORBIDDEN_FIELDS,
  PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
  PUBLIC_SLOT_STATES,
} from './config/public-availability-config';
import { PublicAvailabilityPage } from './pages/PublicAvailabilityPage';
import {
  createInMemoryPublicAvailabilityRepositoryAdapter,
  resetPublicAvailabilityRepositoryAdapter,
  setPublicAvailabilityRepositoryAdapter,
} from './repositories/public-availability-repository';
import { backfillPublicAvailabilityProjections } from './services/public-availability-service';
import {
  buildPublicAvailabilityProjectionFromBooking,
  buildRoomDayAvailabilitySlots,
  evaluatePublicIntervalAvailability,
  hasOnlySanitizedPublicAvailabilityKeys,
  OPERATING_HALF_HOUR_SLOTS,
  OPERATING_HOURLY_SLOTS,
} from './utils/public-availability-calculation';

// Fixed reference time: 2026-11-25 at 13:15 WIB (06:15 UTC), minuteOfDay = 795
const FIXED_NOW = new Date('2026-11-25T06:15:00.000Z');
const FIXED_TODAY_ISO = '2026-11-25';
const FIXED_TOMORROW_ISO = '2026-11-26';

function mockUnauthenticatedVisitor() {
  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback(null));
    return () => { };
  });
}

function mockAuthenticatedActor(role = 'owner', uid = 'owner-uid-1') {
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Staff';
  const email = role === 'owner' ? 'owner@37studio.com' : 'staff@37studio.com';

  mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
    queueMicrotask(() => callback({ uid, email, displayName }));
    return () => { };
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

describe('Public Availability Calendar & Sanitized Projection Architecture', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();
    mockUnauthenticatedVisitor();
    setGalleryRepositoryAdapter(createInMemoryGalleryRepositoryAdapter([]));
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));
    setPublicSiteSettingsRepositoryAdapter(createInMemoryPublicSiteSettingsAdapter(null));
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
    resetPublicAvailabilityRepositoryAdapter();
    resetPublicSiteSettingsRepositoryAdapter();
    resetGalleryRepositoryAdapter();
    resetLandingPagePlacementAdapter();
  });

  describe('B. Public Route (/availability), Room Query Params, Navigation & Inquiry Carry-Over', () => {
    it('renders /availability without authentication, protects /admin routes, initializes room filter from query param, and carries selected slot into Landing Page inquiry form', async () => {
      const user = userEvent.setup();
      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        initialProjections: [
          {
            id: 'bkg_occ_1',
            date: FIXED_TOMORROW_ISO,
            studioId: 'room-b',
            startMinute: 1140, // 19:00
            endMinute: 1260, // 21:00
          },
        ],
        initialMetadata: {
          isReady: true,
          backfilledFromDate: FIXED_TODAY_ISO,
        },
      });
      setPublicAvailabilityRepositoryAdapter(publicAdapter);

      render(
        <AppProviders>
          <MemoryRouter
            initialEntries={[
              `/availability?room=room-b&date=${FIXED_TOMORROW_ISO}&view=day&service=recording`,
            ]}
          >
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      // Reaches /availability without any login redirect
      expect(
        await screen.findByRole('heading', { level: 1, name: /studio availability/i }),
      ).toBeTruthy();

      // Room B is active from `?room=room-b` and Room A is filtered out
      expect(await screen.findByTestId('public-availability-room-room-b')).toBeTruthy();
      expect(screen.queryByTestId('public-availability-room-room-a')).toBeNull();

      // Occupied slot 19:00–19:30 is marked occupied and not a selectable button
      const occupiedSlot = screen.getByTestId(`slot-room-b-${FIXED_TOMORROW_ISO}-19:00`);
      expect(occupiedSlot.getAttribute('data-slot-state')).toBe('occupied');
      expect(occupiedSlot.tagName).not.toBe('BUTTON');

      // Available slot 21:00–21:30 is selectable
      const availableSlotBtn = screen.getByTestId(`slot-room-b-${FIXED_TOMORROW_ISO}-21:00`);
      expect(availableSlotBtn.getAttribute('data-slot-state')).toBe('available');
      await user.click(availableSlotBtn);

      // Selected Slot Bar appears
      const selectedBar = await screen.findByTestId('public-availability-selected-bar');
      expect(within(selectedBar).getByText(/21:00 WIB/i)).toBeTruthy();

      // Continue to Booking Request -> navigates to Landing Page and prefills date, time, room, and service
      await user.click(
        within(selectedBar).getByRole('button', { name: /continue to booking request/i }),
      );

      expect(
        await screen.findByRole('heading', { level: 2, name: /send booking request/i }),
      ).toBeTruthy();
      expect(screen.getByLabelText(/preferred date/i).value).toBe(FIXED_TOMORROW_ISO);
      expect(screen.getByLabelText(/preferred start time/i).value).toBe('21:00');
      expect(screen.getByLabelText(/room preference/i).value).toBe('room-b');
      expect(
        screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed'),
      ).toBe('true');
    });

    it('supports date navigation (Next, Previous, Today) and Day / Week view switching while keeping /admin/calendar protected from public visitors', async () => {
      const user = userEvent.setup();
      setPublicAvailabilityRepositoryAdapter(
        createInMemoryPublicAvailabilityRepositoryAdapter({
          initialProjections: [],
          initialMetadata: { isReady: true, backfilledFromDate: FIXED_TODAY_ISO },
        }),
      );

      render(
        <MemoryRouter initialEntries={[`/availability?date=${FIXED_TODAY_ISO}&view=day`]}>
          <PublicAvailabilityPage now={FIXED_NOW} />
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('public-availability-room-room-a')).toBeTruthy();
      expect(screen.getByTestId('public-availability-room-room-b')).toBeTruthy();
      expect(screen.getByTestId('public-availability-period-label').textContent).toMatch(
        /Rabu, 25 November 2026/i,
      );

      // Next day -> Kamis, 26 November 2026
      await user.click(screen.getByRole('button', { name: /next day/i }));
      expect(screen.getByTestId('public-availability-period-label').textContent).toMatch(
        /Kamis, 26 November 2026/i,
      );

      // Today -> Rabu, 25 November 2026
      await user.click(screen.getByRole('button', { name: /^today$/i }));
      expect(screen.getByTestId('public-availability-period-label').textContent).toMatch(
        /Rabu, 25 November 2026/i,
      );

      // Switch to Week View
      await user.click(screen.getByRole('button', { name: /week view/i }));
      expect(screen.getByRole('button', { name: /week view/i }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(screen.getAllByText(/7-Day Overview/i)).toHaveLength(2);

      cleanup();

      // Attempting to visit /admin/calendar unauthenticated redirects to /staff/login
      render(
        <AppProviders>
          <MemoryRouter initialEntries={['/admin/calendar']}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      expect(await screen.findByLabelText(/studio email address/i)).toBeTruthy();
    });
  });

  describe('C. Privacy & Firestore Security Rules Contract Verification', () => {
    it('strips all private customer, booking, service, and financial fields from public projections and never renders PII in the public DOM', async () => {
      const fullBooking = {
        id: 'bkg_secret_999',
        customerId: 'cust_secret_1',
        customerName: 'Secret VIP Artist',
        bandName: 'Classified Project Band',
        phone: '+6281199998888',
        phoneNormalized: '+6281199998888',
        studioId: 'room-a',
        serviceTypeId: 'recording',
        serviceTypeName: 'Recording',
        serviceOptionId: 'recording-multitrack',
        serviceOptionName: 'Multitrack',
        deliveryMode: 'studio',
        pricingMode: 'hourly',
        pricingSettingsVersion: 2,
        serviceId: 'recording',
        serviceLabel: 'Recording',
        packageId: 'multitrack',
        packageLabel: 'Multitrack',
        recordingTypeId: 'multitrack',
        recordingTypeLabel: 'Multitrack',
        date: FIXED_TOMORROW_ISO,
        startMinute: 840,
        durationMinutes: 120,
        endMinute: 960,
        unitRate: 250000,
        subtotal: 500000,
        discountAmount: 50000,
        totalAmount: 450000,
        initialPaymentStatus: 'partial',
        initialPaidAmount: 200000,
        paymentMethod: 'transfer',
        sessionStatus: 'upcoming',
        notes: 'Confidential album tracking session notes',
        createdByUid: 'staff_uid_01',
        updatedByUid: 'staff_uid_01',
      };

      const projection = buildPublicAvailabilityProjectionFromBooking(fullBooking, 'NOW_TS');
      expect(hasOnlySanitizedPublicAvailabilityKeys(projection)).toBe(true);
      expect(Object.keys(projection).sort()).toEqual([...PUBLIC_AVAILABILITY_ALLOWED_KEYS].sort());

      for (const forbiddenKey of PUBLIC_AVAILABILITY_FORBIDDEN_FIELDS) {
        expect(forbiddenKey in projection).toBe(false);
      }

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        initialProjections: [{ id: fullBooking.id, ...projection }],
        initialMetadata: { isReady: true, backfilledFromDate: FIXED_TODAY_ISO },
      });
      setPublicAvailabilityRepositoryAdapter(publicAdapter);

      const { container } = render(
        <MemoryRouter initialEntries={[`/availability?date=${FIXED_TOMORROW_ISO}&view=day`]}>
          <PublicAvailabilityPage now={FIXED_NOW} />
        </MemoryRouter>,
      );

      await screen.findByTestId(`slot-room-a-${FIXED_TOMORROW_ISO}-14:00`);
      const html = container.innerHTML;
      expect(html).not.toContain('Secret VIP Artist');
      expect(html).not.toContain('Classified Project Band');
      expect(html).not.toContain('81199998888');
      expect(html).not.toContain('bkg_secret_999');
      expect(html).not.toContain('Confidential album tracking');
      expect(html).not.toContain('450000');
    });

    it('enforces strict Firestore Security Rules for publicAvailability and publicAvailabilityMetadata while keeping canonical collections protected', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesText = fs.readFileSync(rulesPath, 'utf8');

      // Canonical collections remain strictly staff/owner gated
      expect(rulesText).toMatch(
        /match \/bookings\/\{bookingId\}\s*\{\s*allow read: if isActiveStaff\(\);/,
      );
      expect(rulesText).toMatch(
        /match \/bookingSlots\/\{slotId\}\s*\{\s*allow read: if isActiveStaff\(\);/,
      );
      expect(rulesText).toMatch(
        /match \/invoices\/\{invoiceId\}\s*\{\s*allow read: if isActiveStaff\(\);/,
      );

      // Sanitized publicAvailability rules enforce 6-key schema + getAfter canonical booking match
      expect(rulesText).toContain('function isValidPublicAvailabilityProjectionShape(data)');
      expect(rulesText).toContain(
        'function isPublicAvailabilityMatchedToCanonicalBookingAfter(data, bookingId)',
      );
      expect(rulesText).toContain('match /publicAvailability/{bookingId}');
      expect(rulesText).toMatch(
        /match \/publicAvailability\/\{bookingId\}\s*\{\s*allow read: if true;\s*allow create, update: if isActiveStaff\(\)/,
      );

      // Metadata rules allow public get on 'status' only, disallow list, and restrict writes to active Owner
      expect(rulesText).toContain('function isValidPublicAvailabilityMetadataShape(data)');
      expect(rulesText).toMatch(
        /match \/publicAvailabilityMetadata\/\{docId\}\s*\{\s*allow get: if docId == 'status';\s*allow list: if false;\s*allow create, update: if isActiveOwner\(\)/,
      );
    });
  });

  describe('D. Booking Projection Atomic Synchronization Across All Lifecycle Transitions', () => {
    const validBookingForm = {
      customerName: 'Raka Pratama',
      phone: '081234567890',
      bandName: 'Garasi Noise',
      studioId: 'room-a',
      serviceId: 'rehearsal',
      packageId: '',
      recordingTypeId: '',
      date: FIXED_TOMORROW_ISO,
      startMinute: 600, // 10:00
      durationPreset: '120', // 10:00 - 12:00
      customDurationMinutes: '120',
      initialPaymentStatus: 'unpaid',
      dpAmount: '',
      paymentMethod: 'cash',
      notes: 'Band rehearsal',
    };

    it('synchronizes publicAvailability atomically across create, conflict failure, edit, reschedule, check-in, start, complete, cancel, and mark_no_show', async () => {
      const bookingAdapter = createInMemoryBookingRepositoryAdapter();
      setBookingRepositoryAdapter(bookingAdapter);

      // 1. Create Booking -> creates projection atomically
      const created = await createBooking({
        bookingId: 'bkg_sync_1',
        eventId: 'evt_sync_1',
        actorUid: 'staff_uid_1',
        formValues: validBookingForm,
        adapter: bookingAdapter,
      });
      expect(created.id).toBe('bkg_sync_1');

      let state = bookingAdapter._inspectState();
      expect(state.publicAvailability.has('bkg_sync_1')).toBe(true);
      expect(state.publicAvailability.get('bkg_sync_1')).toMatchObject({
        schemaVersion: 1,
        date: FIXED_TOMORROW_ISO,
        studioId: 'room-a',
        startMinute: 600,
        endMinute: 720,
      });

      // 2. Idempotent retry -> does not duplicate or corrupt projection
      await createBooking({
        bookingId: 'bkg_sync_1',
        eventId: 'evt_sync_1',
        actorUid: 'staff_uid_1',
        formValues: validBookingForm,
        adapter: bookingAdapter,
      });
      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.size).toBe(1);

      // 3. Failed Create (Slot conflict on Room A 11:00–13:00) -> leaves no second projection
      await expect(
        createBooking({
          bookingId: 'bkg_conflict_2',
          eventId: 'evt_conflict_2',
          actorUid: 'staff_uid_1',
          formValues: {
            ...validBookingForm,
            customerName: 'Conflicting Band',
            phone: '081299990000',
            startMinute: 660,
            durationPreset: '120',
            customDurationMinutes: '120',
          },
          adapter: bookingAdapter,
        }),
      ).rejects.toThrow(/bentrok/i);

      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.has('bkg_conflict_2')).toBe(false);
      expect(state.publicAvailability.size).toBe(1);

      // 4. Edit & Reschedule (move to Room B 14:00–16:00) -> updates projection atomically
      const rescheduled = await updateOrRescheduleBooking({
        bookingId: 'bkg_sync_1',
        expectedVersion: 1,
        eventId: 'evt_resched_1',
        actorUid: 'staff_uid_1',
        mode: 'reschedule',
        formValues: {
          ...validBookingForm,
          studioId: 'room-b',
          startMinute: 840,
          durationPreset: '120',
          customDurationMinutes: '120',
        },
        adapter: bookingAdapter,
      });
      expect(rescheduled.studioId).toBe('room-b');
      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.get('bkg_sync_1')).toMatchObject({
        date: FIXED_TOMORROW_ISO,
        studioId: 'room-b',
        startMinute: 840,
        endMinute: 960,
      });

      // 5. Check-In -> preserves projection
      const checkedIn = await transitionBookingSession({
        bookingId: 'bkg_sync_1',
        action: 'check_in',
        expectedVersion: rescheduled.version,
        eventId: 'evt_checkin_1',
        actorUid: 'staff_uid_1',
        adapter: bookingAdapter,
      });
      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.has('bkg_sync_1')).toBe(true);

      // 6. Start Session -> preserves projection
      const started = await transitionBookingSession({
        bookingId: 'bkg_sync_1',
        action: 'start_session',
        expectedVersion: checkedIn.version,
        eventId: 'evt_start_1',
        actorUid: 'staff_uid_1',
        adapter: bookingAdapter,
      });
      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.has('bkg_sync_1')).toBe(true);

      // 7. Complete Session -> preserves occupancy according to existing slot lock contract
      await transitionBookingSession({
        bookingId: 'bkg_sync_1',
        action: 'complete_session',
        expectedVersion: started.version,
        eventId: 'evt_complete_1',
        actorUid: 'staff_uid_1',
        adapter: bookingAdapter,
      });
      state = bookingAdapter._inspectState();
      expect(state.publicAvailability.has('bkg_sync_1')).toBe(true);

      // 8. Create a second booking and Cancel it -> removes projection atomically
      const toCancel = await createBooking({
        bookingId: 'bkg_cancel_2',
        eventId: 'evt_create_2',
        actorUid: 'staff_uid_1',
        formValues: {
          ...validBookingForm,
          phone: '081377778888',
          startMinute: 600,
          durationPreset: '60',
          customDurationMinutes: '60',
        },
        adapter: bookingAdapter,
      });
      expect(bookingAdapter._inspectState().publicAvailability.has('bkg_cancel_2')).toBe(true);

      await cancelBooking({
        bookingId: 'bkg_cancel_2',
        expectedVersion: toCancel.version,
        eventId: 'evt_cancel_2',
        actorUid: 'staff_uid_1',
        reason: 'Customer requested cancellation',
        adapter: bookingAdapter,
      });
      expect(bookingAdapter._inspectState().publicAvailability.has('bkg_cancel_2')).toBe(false);

      // 9. Create a third booking on today and Mark No-Show after grace period -> removes projection atomically
      const toNoShow = await createBooking({
        bookingId: 'bkg_noshow_3',
        eventId: 'evt_create_3',
        actorUid: 'staff_uid_1',
        formValues: {
          ...validBookingForm,
          phone: '081355556666',
          date: FIXED_TODAY_ISO,
          startMinute: 600, // 10:00 WIB
          durationPreset: '60',
          customDurationMinutes: '60',
        },
        adapter: bookingAdapter,
      });
      expect(bookingAdapter._inspectState().publicAvailability.has('bkg_noshow_3')).toBe(true);

      await transitionBookingSession({
        bookingId: 'bkg_noshow_3',
        action: 'mark_no_show',
        expectedVersion: toNoShow.version,
        eventId: 'evt_noshow_3',
        actorUid: 'staff_uid_1',
        now: FIXED_NOW, // 13:15 WIB > 10:15 WIB grace cutoff
        adapter: bookingAdapter,
      });
      expect(bookingAdapter._inspectState().publicAvailability.has('bkg_noshow_3')).toBe(false);
    });
  });

  describe('E. Owner-Authenticated Legacy Backfill & Readiness Gate', () => {
    it('backfills active future bookings with bounded pagination, excludes cancelled/no-show, strips PII, is idempotent, and marks readiness true only after verification', async () => {
      const bookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'leg_active_1',
          customerName: 'Legacy Band 1',
          phone: '081211112222',
          studioId: 'room-a',
          date: FIXED_TODAY_ISO,
          startMinute: 600,
          durationMinutes: 120,
          endMinute: 720,
          sessionStatus: 'upcoming',
        },
        {
          id: 'leg_active_2',
          customerName: 'Legacy Band 2',
          phone: '081233334444',
          studioId: 'room-b',
          date: FIXED_TOMORROW_ISO,
          startMinute: 1200,
          durationMinutes: 180,
          endMinute: 1380,
          sessionStatus: 'in_progress',
        },
        {
          id: 'leg_cancelled_3',
          customerName: 'Cancelled Legacy',
          phone: '081255556666',
          studioId: 'room-a',
          date: FIXED_TOMORROW_ISO,
          startMinute: 780,
          durationMinutes: 60,
          endMinute: 840,
          sessionStatus: 'cancelled',
        },
        {
          id: 'leg_noshow_4',
          customerName: 'NoShow Legacy',
          phone: '081277778888',
          studioId: 'room-b',
          date: FIXED_TODAY_ISO,
          startMinute: 600,
          durationMinutes: 60,
          endMinute: 660,
          sessionStatus: 'no_show',
        },
      ]);

      // Clear auto-seeded projections to simulate legacy database before publicAvailability existed
      bookingAdapter._sharedStore.publicAvailability.clear();

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        sharedStore: bookingAdapter._sharedStore,
        initialMetadata: { isReady: false, backfilledFromDate: '' },
      });

      // Rejects non-Owner caller
      await expect(
        backfillPublicAvailabilityProjections({
          actorUid: 'staff_1',
          actorRole: 'staff',
          fromDateIso: FIXED_TODAY_ISO,
          adapter: publicAdapter,
        }),
      ).rejects.toThrow(/owner/i);

      // Run backfill with small pageSize=2 and writeBatchSize=1 to exercise pagination & chunking
      const result = await backfillPublicAvailabilityProjections({
        actorUid: 'owner_1',
        actorRole: 'owner',
        fromDateIso: FIXED_TODAY_ISO,
        pageSize: 2,
        writeBatchSize: 1,
        adapter: publicAdapter,
      });

      expect(result.isReady).toBe(true);
      expect(result.isPartial).toBe(false);
      expect(result.totalBookingsScanned).toBe(4);
      expect(result.activeProjectedCount).toBe(2);
      expect(result.excludedCancelledOrNoShowCount).toBe(2);

      const projections = publicAdapter._inspectProjections();
      expect(projections.size).toBe(2);
      expect(projections.has('leg_active_1')).toBe(true);
      expect(projections.has('leg_active_2')).toBe(true);
      expect(projections.has('leg_cancelled_3')).toBe(false);
      expect(projections.has('leg_noshow_4')).toBe(false);

      // Verify raw projection has zero PII
      const rawProj1 = publicAdapter._inspectRawProjection('leg_active_1');
      expect(hasOnlySanitizedPublicAvailabilityKeys(rawProj1)).toBe(true);

      // Repeated backfill is idempotent
      const secondRun = await backfillPublicAvailabilityProjections({
        actorUid: 'owner_1',
        actorRole: 'owner',
        fromDateIso: FIXED_TODAY_ISO,
        pageSize: 2,
        writeBatchSize: 2,
        adapter: publicAdapter,
      });
      expect(secondRun.isReady).toBe(true);
      expect(publicAdapter._inspectProjections().size).toBe(2);

      // Simulated write failure leaves readiness false
      publicAdapter._setFailOnWriteChunk(0);
      await expect(
        backfillPublicAvailabilityProjections({
          actorUid: 'owner_1',
          actorRole: 'owner',
          fromDateIso: FIXED_TODAY_ISO,
          adapter: publicAdapter,
        }),
      ).rejects.toThrow(/simulated batch write failure/i);

      const metaAfterFail = await publicAdapter.getPublicAvailabilityMetadata();
      expect(metaAfterFail.isReady).toBe(false);
    });
  });

  describe('F. Time, Operating Window (10:00-23:00), Duration-Fit & Fail-Closed States', () => {
    it('supports all 13 hourly public slots from 10:00 to 23:00 (while preserving 26 half-hour canonical slots), disables past slots, flags partial HH:30 overlaps as occupied, and enforces full duration fit', () => {
      // Public display uses 13 1-hour slots (10:00–11:00 through 22:00–23:00)
      expect(OPERATING_HOURLY_SLOTS).toHaveLength(13);
      expect(OPERATING_HOURLY_SLOTS[0].startLabel).toBe('10:00');
      expect(OPERATING_HOURLY_SLOTS[0].rangeLabel).toBe('10:00 – 11:00');
      expect(OPERATING_HOURLY_SLOTS[12].startLabel).toBe('22:00');
      expect(OPERATING_HOURLY_SLOTS[12].endLabel).toBe('23:00');
      expect(OPERATING_HOURLY_SLOTS.some((s) => s.startLabel.endsWith(':30'))).toBe(false);

      // Canonical 30-minute granularity remains 26 slots for Admin Booking Request compatibility
      expect(OPERATING_HALF_HOUR_SLOTS).toHaveLength(26);

      // On FIXED_TODAY_ISO at 13:15 WIB (795), hourly slots starting before 13:15 (10:00..13:00) are PAST
      // Suppose Room A has an occupied session at 15:00–17:00 (900–1020) and a late session at 22:00–23:00 (1320–1380)
      const projections = [
        {
          id: 'p1',
          date: FIXED_TODAY_ISO,
          studioId: 'room-a',
          startMinute: 900, // 15:00
          endMinute: 1020, // 17:00
        },
        {
          id: 'p2',
          date: FIXED_TODAY_ISO,
          studioId: 'room-a',
          startMinute: 1320, // 22:00
          endMinute: 1380, // 23:00
        },
      ];

      // Evaluate with a 2-hour (120m) requested duration
      const daySlots = buildRoomDayAvailabilitySlots({
        dateIso: FIXED_TODAY_ISO,
        studioId: 'room-a',
        projections,
        requestedDurationMinutes: 120,
        now: FIXED_NOW,
      });

      expect(daySlots.slots).toHaveLength(13);
      expect(daySlots.totalSlotsCount).toBe(13);
      expect(daySlots.slots.some((s) => s.startLabel.endsWith(':30'))).toBe(false);

      const byLabel = new Map(daySlots.slots.map((s) => [s.startLabel, s]));

      // 10:00..13:00 are in the past relative to 13:15 WIB
      expect(byLabel.get('10:00').state).toBe(PUBLIC_SLOT_STATES.PAST);
      expect(byLabel.get('13:00').state).toBe(PUBLIC_SLOT_STATES.PAST);

      // 14:00 has only 60 minutes free before 15:00 occupied session -> cannot fit 120m!
      expect(byLabel.get('14:00').state).toBe(PUBLIC_SLOT_STATES.DURATION_TOO_SHORT);
      expect(byLabel.get('14:00').isSelectable).toBe(false);

      // 15:00 and 16:00 are occupied
      expect(byLabel.get('15:00').state).toBe(PUBLIC_SLOT_STATES.OCCUPIED);
      expect(byLabel.get('16:00').state).toBe(PUBLIC_SLOT_STATES.OCCUPIED);

      // 17:00..20:00 have 17:00–22:00 free (5 hours) -> can fit 120m!
      expect(byLabel.get('17:00').state).toBe(PUBLIC_SLOT_STATES.AVAILABLE);
      expect(byLabel.get('17:00').isSelectable).toBe(true);
      expect(byLabel.get('20:00').state).toBe(PUBLIC_SLOT_STATES.AVAILABLE);

      // 21:00 has only 60m before the 22:00–23:00 late session -> DURATION_TOO_SHORT
      expect(byLabel.get('21:00').state).toBe(PUBLIC_SLOT_STATES.DURATION_TOO_SHORT);

      // 22:00 is occupied by the late session ending at 23:00
      expect(byLabel.get('22:00').state).toBe(PUBLIC_SLOT_STATES.OCCUPIED);

      // Legacy partial HH:30 booking (11:30–12:30) fail-closed marks BOTH 11:00 and 12:00 hourly slots as occupied
      const halfHourOverlapSlots = buildRoomDayAvailabilitySlots({
        dateIso: FIXED_TOMORROW_ISO,
        studioId: 'room-a',
        projections: [
          {
            id: 'p_legacy_half',
            date: FIXED_TOMORROW_ISO,
            studioId: 'room-a',
            startMinute: 690, // 11:30
            endMinute: 750, // 12:30
          },
        ],
        now: FIXED_NOW,
      });
      const tomorrowMap = new Map(halfHourOverlapSlots.slots.map((s) => [s.startLabel, s]));
      expect(tomorrowMap.get('10:00').state).toBe(PUBLIC_SLOT_STATES.AVAILABLE);
      expect(tomorrowMap.get('11:00').state).toBe(PUBLIC_SLOT_STATES.OCCUPIED);
      expect(tomorrowMap.get('12:00').state).toBe(PUBLIC_SLOT_STATES.OCCUPIED);
      expect(tomorrowMap.get('13:00').state).toBe(PUBLIC_SLOT_STATES.AVAILABLE);

      // Room B is completely unaffected by Room A's projections
      const roomBEval = evaluatePublicIntervalAvailability({
        dateIso: FIXED_TODAY_ISO,
        studioId: 'room-b',
        startMinute: 900,
        durationMinutes: 120,
        projections,
        now: FIXED_NOW,
      });
      expect(roomBEval.isAvailable).toBe(true);
    });

    it('fails closed when metadata is not ready or when query results are truncated', async () => {
      // 1. Metadata not ready -> displays required message and zero selectable slots
      setPublicAvailabilityRepositoryAdapter(
        createInMemoryPublicAvailabilityRepositoryAdapter({
          initialProjections: [],
          initialMetadata: { isReady: false, backfilledFromDate: '' },
        }),
      );

      render(
        <MemoryRouter initialEntries={['/availability']}>
          <PublicAvailabilityPage now={FIXED_NOW} />
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('public-availability-not-ready-state')).toBeTruthy();
      expect(
        screen.getByText(/availability data is not ready yet\. please contact the studio\./i),
      ).toBeTruthy();
      expect(screen.queryByTestId('public-availability-room-room-a')).toBeNull();
      cleanup();

      // 2. Truncated query -> fails closed and offers Switch to Day View
      setPublicAvailabilityRepositoryAdapter(
        createInMemoryPublicAvailabilityRepositoryAdapter({
          initialProjections: [],
          initialMetadata: { isReady: true, backfilledFromDate: FIXED_TODAY_ISO },
          forceTruncated: true,
        }),
      );

      render(
        <MemoryRouter initialEntries={['/availability?view=week']}>
          <PublicAvailabilityPage now={FIXED_NOW} />
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('public-availability-truncated-state')).toBeTruthy();
      expect(screen.queryByTestId('public-availability-room-room-a')).toBeNull();
    });
  });

  describe('G. Auto-Initialization, Failure Recovery, WhatsApp Fallback & Batch Guards', () => {
    it('auto-initializes live schedule on /availability only for authenticated active Owners while keeping public/staff read-only', async () => {
      const bookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'auto_sync_bkg_1',
          customerName: 'Secret Band',
          phone: '081200001111',
          studioId: 'room-a',
          date: FIXED_TOMORROW_ISO,
          startMinute: 960,
          durationMinutes: 120,
          endMinute: 1080,
          sessionStatus: 'upcoming',
        },
      ]);
      bookingAdapter._sharedStore.publicAvailability.clear();

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        sharedStore: bookingAdapter._sharedStore,
        initialMetadata: { isReady: false, backfilledFromDate: '' },
      });
      const writeBatchSpy = vi.spyOn(publicAdapter, 'writePublicAvailabilityBatch');
      const setMetaSpy = vi.spyOn(publicAdapter, 'setPublicAvailabilityMetadata');
      setPublicAvailabilityRepositoryAdapter(publicAdapter);

      // 1. Unauthenticated visitor sees not_ready and zero writes / zero Owner controls
      render(
        <AppProviders>
          <MemoryRouter initialEntries={['/availability']}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      expect(await screen.findByTestId('public-availability-not-ready-state')).toBeTruthy();
      expect(screen.queryByTestId('public-availability-owner-sync-panel')).toBeNull();
      expect(writeBatchSpy).not.toHaveBeenCalled();
      expect(setMetaSpy).not.toHaveBeenCalled();
      cleanup();

      // 2. Authenticated non-Owner Staff sees not_ready and zero writes / zero Owner controls
      mockAuthenticatedActor('staff', 'staff-uid-2');
      render(
        <AppProviders>
          <MemoryRouter initialEntries={['/availability']}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      expect(await screen.findByTestId('public-availability-not-ready-state')).toBeTruthy();
      expect(screen.queryByTestId('public-availability-owner-sync-panel')).toBeNull();
      expect(writeBatchSpy).not.toHaveBeenCalled();
      expect(setMetaSpy).not.toHaveBeenCalled();
      cleanup();

      // 3. Authenticated active Owner auto-initializes and transitions to live schedule
      mockAuthenticatedActor('owner', 'owner-uid-1');
      render(
        <AppProviders>
          <MemoryRouter initialEntries={[`/availability?date=${FIXED_TOMORROW_ISO}&view=day`]}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      expect(await screen.findByTestId('public-availability-room-room-a')).toBeTruthy();
      expect(
        screen
          .getByTestId(`slot-room-a-${FIXED_TOMORROW_ISO}-16:00`)
          .getAttribute('data-slot-state'),
      ).toBe('occupied');
      const meta = await publicAdapter.getPublicAvailabilityMetadata();
      expect(meta.isReady).toBe(true);
    });

    it('stops retrying on Owner backfill failure on /availability and recovers on manual retry without infinite loops', async () => {
      const user = userEvent.setup();
      mockAuthenticatedActor('owner', 'owner-uid-1');

      const bookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'retry_bkg_1',
          customerName: 'Retry Session',
          phone: '081244445555',
          studioId: 'room-b',
          date: FIXED_TOMORROW_ISO,
          startMinute: 720,
          durationMinutes: 60,
          endMinute: 780,
          sessionStatus: 'upcoming',
        },
      ]);
      bookingAdapter._sharedStore.publicAvailability.clear();

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        sharedStore: bookingAdapter._sharedStore,
        initialMetadata: { isReady: false, backfilledFromDate: '' },
      });
      publicAdapter._setFailOnWriteChunk(0);
      const setMetaSpy = vi.spyOn(publicAdapter, 'setPublicAvailabilityMetadata');
      setPublicAvailabilityRepositoryAdapter(publicAdapter);

      render(
        <AppProviders>
          <MemoryRouter initialEntries={[`/availability?date=${FIXED_TOMORROW_ISO}&view=day`]}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      const ownerPanel = await screen.findByTestId('public-availability-owner-sync-panel');
      await waitFor(() => {
        expect(within(ownerPanel).getByRole('alert').textContent).toMatch(
          /simulated batch write failure/i,
        );
      });

      // Only 1 automatic attempt fired (resetReadinessFirst call)
      const callsBeforeManualRetry = setMetaSpy.mock.calls.length;
      expect(callsBeforeManualRetry).toBe(1);

      // Clear simulated failure and trigger manual retry
      publicAdapter._setFailOnWriteChunk(-1);
      await user.click(
        within(ownerPanel).getByRole('button', { name: /sync & activate live schedule/i }),
      );

      expect(await screen.findByTestId('public-availability-room-room-b')).toBeTruthy();
      expect(
        screen
          .getByTestId(`slot-room-b-${FIXED_TOMORROW_ISO}-12:00`)
          .getAttribute('data-slot-state'),
      ).toBe('occupied');
    });

    it('renders verified WhatsApp chat button in /availability not_ready state when configured', async () => {
      setPublicSiteSettingsRepositoryAdapter(
        createInMemoryPublicSiteSettingsAdapter({
          studioName: '37 Music Studio',
          publicWhatsappNumber: '+6281234567890',
        }),
      );
      setPublicAvailabilityRepositoryAdapter(
        createInMemoryPublicAvailabilityRepositoryAdapter({
          initialProjections: [],
          initialMetadata: { isReady: false, backfilledFromDate: '' },
        }),
      );

      render(
        <MemoryRouter initialEntries={['/availability']}>
          <PublicAvailabilityPage now={FIXED_NOW} />
        </MemoryRouter>,
      );

      const notReadyCard = await screen.findByTestId('public-availability-not-ready-state');
      const waLink = within(notReadyCard).getByRole('link', { name: /chat on whatsapp/i });
      expect(waLink.getAttribute('href')).toContain('https://wa.me/6281234567890?text=');
      expect(waLink.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('enforces safe write batch size (4) and skips redundant Firestore deletes for cancelled bookings without projections', async () => {
      expect(PUBLIC_BACKFILL_BATCH_WRITE_LIMIT).toBe(4);

      const bookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'active_clean_1',
          customerName: 'Active Band',
          phone: '081211110000',
          studioId: 'room-a',
          date: FIXED_TOMORROW_ISO,
          startMinute: 660,
          durationMinutes: 60,
          endMinute: 720,
          sessionStatus: 'upcoming',
        },
        {
          id: 'cancelled_no_proj_2',
          customerName: 'Cancelled Band',
          phone: '081222220000',
          studioId: 'room-a',
          date: FIXED_TOMORROW_ISO,
          startMinute: 780,
          durationMinutes: 60,
          endMinute: 840,
          sessionStatus: 'cancelled',
        },
        {
          id: 'cancelled_with_stale_proj_3',
          customerName: 'Stale Cancelled Band',
          phone: '081233330000',
          studioId: 'room-b',
          date: FIXED_TOMORROW_ISO,
          startMinute: 900,
          durationMinutes: 60,
          endMinute: 960,
          sessionStatus: 'cancelled',
        },
      ]);

      // Remove projections for 1 & 2, but keep a stale projection ONLY for 3
      bookingAdapter._sharedStore.publicAvailability.clear();
      bookingAdapter._sharedStore.publicAvailability.set('cancelled_with_stale_proj_3', {
        id: 'cancelled_with_stale_proj_3',
        schemaVersion: 1,
        date: FIXED_TOMORROW_ISO,
        studioId: 'room-b',
        startMinute: 900,
        endMinute: 960,
        updatedAt: { seconds: 1700000000 },
      });

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        sharedStore: bookingAdapter._sharedStore,
        initialMetadata: { isReady: false, backfilledFromDate: '' },
      });
      const writeSpy = vi.spyOn(publicAdapter, 'writePublicAvailabilityBatch');

      const result = await backfillPublicAvailabilityProjections({
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        fromDateIso: FIXED_TODAY_ISO,
        adapter: publicAdapter,
      });

      expect(result.isReady).toBe(true);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const batchCallArg = writeSpy.mock.calls[0][0];
      expect(batchCallArg.upserts.map((u) => u.bookingId)).toEqual(['active_clean_1']);
      expect(batchCallArg.deleteIds).toEqual(['cancelled_with_stale_proj_3']);
    });

    it('displays live public schedule sync banner and auto-initializes when an active Owner opens AdminCalendarPage', async () => {
      mockAuthenticatedActor('owner', 'owner-uid-1');

      const liveTodayIso = getJakartaTodayIso();
      const bookingAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'cal_auto_bkg_1',
          customerName: 'Calendar Auto Sync Band',
          phone: '081288889999',
          studioId: 'room-a',
          date: liveTodayIso,
          startMinute: 1200,
          durationMinutes: 60,
          endMinute: 1260,
          sessionStatus: 'upcoming',
        },
      ]);
      bookingAdapter._sharedStore.publicAvailability.clear();

      setBookingRepositoryAdapter(bookingAdapter);
      setCustomerRepositoryAdapter(createInMemoryCustomerRepositoryAdapter(bookingAdapter));
      setPaymentRepositoryAdapter(createInMemoryPaymentRepositoryAdapter(bookingAdapter));
      setPricingSettingsRepositoryAdapter(createInMemoryPricingSettingsAdapter());

      const publicAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
        sharedStore: bookingAdapter._sharedStore,
        initialMetadata: { isReady: false, backfilledFromDate: '' },
      });
      setPublicAvailabilityRepositoryAdapter(publicAdapter);

      render(
        <AppProviders>
          <MemoryRouter initialEntries={['/admin/calendar']}>
            <AppRoutes />
          </MemoryRouter>
        </AppProviders>,
      );

      const syncBanner = await screen.findByTestId('admin-public-availability-sync-banner');
      expect(await within(syncBanner).findByText(/aktif & tersinkron/i)).toBeTruthy();

      const meta = await publicAdapter.getPublicAvailabilityMetadata();
      expect(meta.isReady).toBe(true);
      expect(publicAdapter._inspectProjections().has('cal_auto_bkg_1')).toBe(true);
    });
  });
});
