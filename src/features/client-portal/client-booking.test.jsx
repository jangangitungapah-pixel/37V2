import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const portalBookingMocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  listeners: new Set(),
  signOut: vi.fn(),
  getRedirectResult: vi.fn(),
  staffLookup: null,
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: () => ({ name: '[DEFAULT]' }),
}));

vi.mock('@/lib/firebase/auth', () => ({
  getFirebaseAuth: () => portalBookingMocks.auth,
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getFirebaseDb: () => ({ _mockDb: true }),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    setCustomParameters() { }
  }

  return {
    GoogleAuthProvider: MockGoogleAuthProvider,
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: (...args) => portalBookingMocks.getRedirectResult(...args),
    sendPasswordResetEmail: vi.fn(),
    signOut: (...args) => portalBookingMocks.signOut(...args),
    onAuthStateChanged: (_auth, callback) => {
      portalBookingMocks.listeners.add(callback);
      queueMicrotask(() => {
        if (portalBookingMocks.listeners.has(callback)) {
          callback(portalBookingMocks.auth.currentUser);
        }
      });
      return () => {
        portalBookingMocks.listeners.delete(callback);
      };
    },
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ _mockDb: true })),
  Timestamp: { fromDate: (d) => d },
  doc: (_db, col, id) => ({ col, id, path: `${col}/${id}` }),
  getDoc: async (docRef) => {
    if (docRef?.col === 'staffProfiles' && typeof portalBookingMocks.staffLookup === 'function') {
      const result = await portalBookingMocks.staffLookup(docRef.id);
      return {
        exists: () => Boolean(result?.exists),
        data: () => result?.data || null,
      };
    }
    return {
      exists: () => false,
      data: () => null,
    };
  },
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  onSnapshot: vi.fn((_q, onNext) => {
    queueMicrotask(() => onNext({ docs: [] }));
    return () => { };
  }),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

import { AppRoutes } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { resetPublicSubmissionCooldownForTests } from '@/features/admin/booking-requests/services/booking-request-service';
import { mapPublicServiceToInternalPricing } from '@/features/admin/booking-requests/utils/booking-request-normalize';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { resolveFormDurationMinutes } from '@/features/admin/calendar/schemas/booking-schema';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
} from '@/features/admin/calendar/services/calendar-booking-service';
import {
  calculateBookingPricingSnapshot,
  calculateCustomerPriceEstimate,
} from '@/features/admin/calendar/utils/booking-pricing';
import {
  addDaysToIsoDate,
  getJakartaTodayIso,
} from '@/features/admin/calendar/utils/calendar-date';
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
import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import {
  savePricingSettings,
  syncPublicPricingCatalog,
} from '@/features/admin/settings/pricing/services/pricing-settings-service';
import { clonePricingSettings } from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';
import {
  createInMemoryPublicAvailabilityRepositoryAdapter,
  resetPublicAvailabilityRepositoryAdapter,
  setPublicAvailabilityRepositoryAdapter,
} from '@/features/public-availability/repositories/public-availability-repository';
import {
  createInMemoryPublicPricingCatalogAdapter,
  resetPublicPricingCatalogRepositoryAdapter,
  setPublicPricingCatalogRepositoryAdapter,
} from '@/features/public-pricing/repositories/public-pricing-repository';
import {
  buildPublicPricingProjection,
  normalizePublicPricingCatalog,
} from '@/features/public-pricing/utils/public-pricing-projection';
import { queryClient } from '@/lib/query-client';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_PROFILE_SOURCE,
  CLIENT_ROLE,
} from './config/client-portal-config';
import {
  createInMemoryClientBillingRepositoryAdapter,
  resetClientBillingRepositoryAdapter,
  setClientBillingRepositoryAdapter,
} from './billing/repositories/client-billing-repository';
import {
  createInMemoryClientPortalRepositoryAdapter,
  resetClientPortalRepositoryAdapter,
  setClientPortalRepositoryAdapter,
} from './repositories/client-portal-repository';

function seedAuthenticatedClient(
  clientAdapter,
  {
    uid = 'client-book-uid-1',
    customerId = 'cust_book_client_1',
    email = 'dimas.band@gmail.com',
    displayName = 'Dimas Pratama',
    phoneDisplay = '+62 812-5555-8888',
  } = {},
) {
  clientAdapter._seedClientProfile(customerId, {
    customerId,
    ownerUid: null,
    profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
    displayName,
    emailNormalized: email,
    phoneDisplay,
    photoURL: '',
    status: 'active',
  });
  clientAdapter._seedClientCustomerLink(customerId, {
    customerId,
    ownerUid: uid,
    emailNormalized: email,
    profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
  });
  clientAdapter._seedClientAccount(uid, {
    uid,
    role: CLIENT_ROLE,
    status: CLIENT_ACCOUNT_STATUS.ACTIVE,
    customerId,
    profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
    emailNormalized: email,
    displayName,
    photoURL: '',
    authProvider: 'google.com',
    emailVerified: true,
  });

  portalBookingMocks.auth.currentUser = {
    uid,
    email,
    displayName,
    photoURL: '',
    emailVerified: true,
    providerId: 'google.com',
    providerData: [{ providerId: 'google.com' }],
    getIdTokenResult: async () => ({
      claims: {
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      },
    }),
  };
}

function seedAuthenticatedStaff(clientAdapter, role = 'owner', uid = 'owner-uid-1') {
  const email = role === 'owner' ? 'owner@37music.id' : 'staff@37music.id';
  const displayName = role === 'owner' ? '37 Studio Owner' : 'Rina Studio Staff';
  clientAdapter._seedStaffProfile(uid, {
    displayName,
    email,
    role,
    active: true,
  });
  portalBookingMocks.auth.currentUser = {
    uid,
    email,
    displayName,
    emailVerified: true,
    providerId: 'password',
    providerData: [{ providerId: 'password' }],
    getIdTokenResult: async () => ({
      claims: { email_verified: true, firebase: { sign_in_provider: 'password' } },
    }),
  };
}

function renderAppAt(initialEntry = '/portal/book') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Client Portal Phase 3 — Self-Service Booking, Project Inquiry, Pricing Projection & Admin Integration', () => {
  let clientAdapter;
  let pricingAdapter;
  let publicPricingAdapter;
  let publicAvailabilityAdapter;
  let bookingRequestAdapter;
  let bookingAdapter;
  const todayIso = getJakartaTodayIso();
  const tomorrowIso = addDaysToIsoDate(todayIso, 1);

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    resetPublicSubmissionCooldownForTests();
    queryClient.clear();

    clientAdapter = createInMemoryClientPortalRepositoryAdapter();
    setClientPortalRepositoryAdapter(clientAdapter);
    portalBookingMocks.staffLookup = (uid) => clientAdapter.hasStaffProfile(uid);
    portalBookingMocks.auth.currentUser = null;
    portalBookingMocks.listeners.clear();
    portalBookingMocks.signOut.mockReset();
    portalBookingMocks.getRedirectResult.mockReset().mockResolvedValue(null);

    const publishedCatalog = buildPublicPricingProjection({
      ...DEFAULT_PRICING_SETTINGS,
      version: 2,
    });
    publicPricingAdapter = createInMemoryPublicPricingCatalogAdapter(publishedCatalog);
    setPublicPricingCatalogRepositoryAdapter(publicPricingAdapter);

    pricingAdapter = createInMemoryPricingSettingsAdapter(
      { ...clonePricingSettings(DEFAULT_PRICING_SETTINGS), version: 2 },
      { publicPricingAdapter },
    );
    setPricingSettingsRepositoryAdapter(pricingAdapter);

    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(createInMemoryCustomerRepositoryAdapter(bookingAdapter));
    setPaymentRepositoryAdapter(createInMemoryPaymentRepositoryAdapter(bookingAdapter));

    publicAvailabilityAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
      initialMetadata: { isReady: true, backfilledFromDate: todayIso },
      initialProjections: [
        // Room A occupied 14:00-16:00 tomorrow; Room B occupied 10:00-14:00 and 14:00-18:00?
        // Leave 14:00 open on Room B only, 10:00 occupied on both Room A and Room B!
        {
          id: 'proj_room_a_10',
          schemaVersion: 1,
          date: tomorrowIso,
          studioId: 'room-a',
          startMinute: 600,
          endMinute: 720,
        },
        {
          id: 'proj_room_b_10',
          schemaVersion: 1,
          date: tomorrowIso,
          studioId: 'room-b',
          startMinute: 600,
          endMinute: 720,
        },
        {
          id: 'proj_room_a_14',
          schemaVersion: 1,
          date: tomorrowIso,
          studioId: 'room-a',
          startMinute: 840,
          endMinute: 960,
        },
      ],
    });
    setPublicAvailabilityRepositoryAdapter(publicAvailabilityAdapter);

    bookingRequestAdapter = createInMemoryBookingRequestRepositoryAdapter(bookingAdapter);
    setBookingRequestRepositoryAdapter(bookingRequestAdapter);
    setClientBillingRepositoryAdapter(
      createInMemoryClientBillingRepositoryAdapter({ bookingAdapter }),
    );
  });

  afterEach(() => {
    cleanup();
    resetClientPortalRepositoryAdapter();
    resetPublicPricingCatalogRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
    resetPublicAvailabilityRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
    resetClientBillingRepositoryAdapter();
    portalBookingMocks.listeners.clear();
    portalBookingMocks.staffLookup = null;
    queryClient.clear();
  });

  it('A. Projects clean publicPricingCatalog/current without fees/unconfigured items and fails closed on invalid shapes', () => {
    const projected = buildPublicPricingProjection({
      ...DEFAULT_PRICING_SETTINGS,
      version: 5,
    });

    expect(projected.schemaVersion).toBe(4);
    expect(projected.version).toBe(5);
    expect(projected.serviceOptionIndex).toEqual(
      projected.serviceTypes.flatMap((service) =>
        service.options.map((option) => ({
          serviceTypeId: service.id,
          serviceLabelSnapshot: service.name,
          serviceOptionId: option.id,
          serviceOptionName: option.name,
          deliveryMode: service.deliveryMode,
        })),
      ),
    );

    // Zero internal fee or operational fields anywhere in the projected object
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('fees');
    expect(serialized).not.toContain('operationalSettings');
    expect(serialized).not.toContain('updatedByUid');
    expect(serialized).not.toContain('dailyMealAllowancePerStaff');

    // Inactive & unconfigured options (pkg-rehearsal-6h, rec-lite, rec-pro, rec-drum-only) stripped
    const rehearsal = projected.serviceTypes.find((s) => s.id === 'rehearsal');
    expect(rehearsal.options.map((o) => o.id)).toEqual([
      'rehearsal-regular',
      'pkg-rehearsal-3h',
      'pkg-rehearsal-5h',
    ]);
    const recording = projected.serviceTypes.find((s) => s.id === 'recording');
    expect(recording.options.map((o) => o.id)).toEqual([
      'live-recording-3h',
      'rec-others',
      'tracking-regular',
      'multitrack-shift-6h',
    ]);

    // Normalization fails closed on missing doc or forbidden key leak
    expect(normalizePublicPricingCatalog(null).isValid).toBe(false);
    expect(
      normalizePublicPricingCatalog({
        ...projected,
        operationalSettings: { dailyMealAllowancePerStaff: 25000 },
      }).isValid,
    ).toBe(false);
    expect(
      normalizePublicPricingCatalog({
        ...projected,
        serviceOptionIndex: projected.serviceOptionIndex.map((entry, index) =>
          index === 0 ? { ...entry, serviceOptionName: 'Forged option name' } : entry,
        ),
      }).isValid,
    ).toBe(false);
    expect(
      normalizePublicPricingCatalog({
        ...projected,
        serviceOptionIndex: projected.serviceOptionIndex.slice(1),
      }).isValid,
    ).toBe(false);
    expect(
      normalizePublicPricingCatalog({
        ...projected,
        serviceTypes: [
          {
            ...rehearsal,
            options: [
              {
                ...rehearsal.options[0],
                fees: { staff: { mode: 'fixed', amount: 15000 } },
              },
            ],
          },
        ],
      }).isValid,
    ).toBe(false);
  });

  it('B. Owner atomic save & Admin auto-sync / manual retry sync publicPricingCatalog/current while blocking Staff mutations and preserving legacy V1', async () => {
    const user = userEvent.setup();

    // Staff denied saving or syncing
    await expect(
      syncPublicPricingCatalog({
        actorUid: 'staff-uid-2',
        actorRole: 'staff',
        adapter: pricingAdapter,
      }),
    ).rejects.toMatchObject({ code: 'pricing/owner-only' });

    // Owner saves updated rate -> atomically publishes v3 publicPricingCatalog/current
    const updatedSettings = clonePricingSettings(DEFAULT_PRICING_SETTINGS);
    updatedSettings.serviceTypes[0].options[0].pricing.hourlyRate = 110000;
    const savedV3 = await savePricingSettings({
      actorUid: 'owner-uid-1',
      actorRole: 'owner',
      expectedVersion: 2,
      settings: updatedSettings,
      adapter: pricingAdapter,
    });
    expect(savedV3.version).toBe(3);
    expect(publicPricingAdapter._getStoredDoc().version).toBe(3);
    expect(publicPricingAdapter._getStoredDoc().serviceTypes[0].options[0].pricing.hourlyRate).toBe(
      110000,
    );

    // 1. When publicPricingCatalog/current is missing but settings/pricing v3 is persisted,
    // an active Owner opening Admin Settings automatically heals and syncs v3 without altering settings/pricing
    publicPricingAdapter._setStoredDoc(null);
    seedAuthenticatedStaff(clientAdapter, 'owner', 'owner-uid-1');

    renderAppAt('/admin/settings/price-and-fee');

    await waitFor(
      () => {
        expect(publicPricingAdapter._getStoredDoc()?.version).toBe(3);
      },
      { timeout: 5000 },
    );
    expect(
      await screen.findByText(/public pricing catalog v3 berhasil disinkronkan/i),
    ).toBeTruthy();
    expect(pricingAdapter._getStoredDoc().version).toBe(3);
    cleanup();

    // 2. When auto-sync fails once due to transient error, Owner sees clear error banner and can manually retry
    publicPricingAdapter._setStoredDoc(null);
    pricingAdapter._setNextSyncError({
      code: 'unavailable',
      message: 'Temporary sync error',
    });

    renderAppAt('/admin/settings/price-and-fee');

    await screen.findByRole('button', { name: /sync public catalog/i }, { timeout: 5000 });
    const alertBanner = await screen.findByRole('alert', { timeout: 5000 });
    expect(alertBanner.textContent).toContain('Koneksi ke Firestore terputus');
    expect(publicPricingAdapter._getStoredDoc()).toBeNull();

    const manualSyncBtn = screen.getByRole('button', { name: /sync public catalog/i });
    await user.click(manualSyncBtn);

    await waitFor(
      () => {
        expect(publicPricingAdapter._getStoredDoc()?.version).toBe(3);
      },
      { timeout: 5000 },
    );
    expect(
      await screen.findByText(/public pricing catalog v3 berhasil disinkronkan/i),
    ).toBeTruthy();
  });

  it('C. Matches customer-facing calculator and Admin BookingSnapshot math (hourly ceil, Rehearsal 3h discount, Fixed Shift + hourly extension, manual_quote null)', () => {
    const catalog = publicPricingAdapter._getStoredDoc();

    // 1. Hourly ceiling: 90m -> 2h * 100k = 200k; 150m -> 3h * 100k = 300k
    const reh90Est = calculateCustomerPriceEstimate({
      catalog,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'rehearsal-regular',
      durationMinutes: 90,
    });
    const reh90Admin = calculateBookingPricingSnapshot({
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'rehearsal-regular',
      durationMinutes: 90,
      pricingSettings: DEFAULT_PRICING_SETTINGS,
    });
    expect(reh90Est.estimatedTotal).toBe(200000);
    expect(reh90Admin.totalAmount).toBe(200000);

    // 2. Rehearsal 3h/5h/6h automatic block discount matches identically
    for (const [mins, expected] of [
      [180, 270000],
      [300, 470000],
      [360, 540000],
    ]) {
      const cust = calculateCustomerPriceEstimate({
        catalog,
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: mins,
      });
      const admin = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: mins,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(cust.estimatedTotal).toBe(expected);
      expect(admin.totalAmount).toBe(expected);
    }

    // 3. Fixed Shift + hourly extension using active hourly option rate from same serviceType
    // Paket Rehearsal 3 Jam (300k - 30k = 270k) + 1h Reguler (100k) = 370k
    const pkgExtEst = calculateCustomerPriceEstimate({
      catalog,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'pkg-rehearsal-3h',
      durationMinutes: 240,
    });
    const pkgExtAdmin = calculateBookingPricingSnapshot({
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'pkg-rehearsal-3h',
      durationMinutes: 240,
      pricingSettings: DEFAULT_PRICING_SETTINGS,
    });
    expect(pkgExtEst.canExtendDuration).toBe(true);
    expect(pkgExtEst.extensionHourlyRate).toBe(100000);
    expect(pkgExtEst.extensionAmount).toBe(100000);
    expect(pkgExtEst.discountAmount).toBe(30000);
    expect(pkgExtEst.estimatedTotal).toBe(370000);
    expect(pkgExtAdmin.totalAmount).toBe(370000);
    expect(
      resolveFormDurationMinutes(
        {
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'pkg-rehearsal-3h',
          durationPreset: 'custom',
          customDurationMinutes: '240',
        },
        DEFAULT_PRICING_SETTINGS,
      ),
    ).toBe(240);

    // Live Recording 3h (420k) + 1h Tracking Reguler (150k) = 570k
    const recExtEst = calculateCustomerPriceEstimate({
      catalog,
      serviceTypeId: 'recording',
      serviceOptionId: 'live-recording-3h',
      durationMinutes: 240,
    });
    const recExtAdmin = calculateBookingPricingSnapshot({
      serviceTypeId: 'recording',
      serviceOptionId: 'live-recording-3h',
      durationMinutes: 240,
      pricingSettings: DEFAULT_PRICING_SETTINGS,
    });
    expect(recExtEst.estimatedTotal).toBe(570000);
    expect(recExtAdmin.totalAmount).toBe(570000);

    // Fixed Shift CANNOT extend when serviceType has no active hourly option (never invents rate)
    const noHourlyCatalog = {
      ...catalog,
      serviceTypes: catalog.serviceTypes.map((svc) =>
        svc.id === 'rehearsal'
          ? { ...svc, options: svc.options.filter((opt) => opt.id === 'pkg-rehearsal-3h') }
          : svc,
      ),
    };
    const lockedShiftEst = calculateCustomerPriceEstimate({
      catalog: noHourlyCatalog,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'pkg-rehearsal-3h',
      durationMinutes: 240,
    });
    expect(lockedShiftEst.canExtendDuration).toBe(false);
    expect(lockedShiftEst.durationMinutes).toBe(180);
    expect(lockedShiftEst.estimatedTotal).toBe(270000);

    // 4. Manual quote returns null estimatedTotal (never fake Rp 0) + zero fees + fail closed on null catalog
    const manualQuote = calculateCustomerPriceEstimate({
      catalog,
      serviceTypeId: 'recording',
      serviceOptionId: 'rec-others',
      durationMinutes: 180,
    });
    expect(manualQuote.isManualQuote).toBe(true);
    expect(manualQuote.estimatedTotal).toBeNull();
    expect(manualQuote).not.toHaveProperty('commissionSnapshot');
    expect(
      calculateCustomerPriceEstimate({ catalog: null, serviceTypeId: 'rehearsal' }),
    ).toBeNull();
  });

  it('D. Fails closed when catalog or availability is unready, runs 3-step Studio Booking flow with extended Fixed Shift + Room Any merge, prevents double submits, and persists 38-key Client Portal request', async () => {
    const user = userEvent.setup();
    seedAuthenticatedClient(clientAdapter, {
      displayName: 'Dimas Pratama',
      phoneDisplay: '+62 812-5555-8888',
    });

    // 1. Fail closed when publicPricingCatalog/current is missing: shows honest unpublished notice + Check Again button
    publicPricingAdapter._setStoredDoc(null);
    renderAppAt('/portal/book');
    const unavailableState = await screen.findByTestId('client-pricing-unavailable-state');
    expect(unavailableState.textContent).toContain('Studio pricing catalog is not published yet');
    expect(unavailableState.textContent).not.toContain('currently being synchronized');
    expect(screen.queryByTestId('client-booking-step-select-session')).toBeNull();

    // Publish publicPricingCatalog/current and click Check Again -> enters booking wizard
    publicPricingAdapter._setStoredDoc(
      buildPublicPricingProjection({ ...DEFAULT_PRICING_SETTINGS, version: 2 }),
    );
    await user.click(screen.getByRole('button', { name: /check again/i }));

    // Step 1: Select Session (Rehearsal -> Paket Rehearsal 3 Jam)
    expect(await screen.findByTestId('client-booking-step-select-session')).toBeTruthy();
    await user.click(screen.getByTestId('client-service-card-rehearsal'));
    await user.click(screen.getByTestId('client-option-card-pkg-rehearsal-3h'));
    await user.click(screen.getByRole('button', { name: /continue to schedule/i }));

    // Step 2: Choose Schedule -> switch date to tomorrow -> duration defaults to 3h -> extend to 4h
    expect(await screen.findByTestId('client-booking-step-schedule')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^next day$/i }));
    await user.click(screen.getByTestId('client-duration-btn-240'));

    expect(screen.getByTestId('client-schedule-price-badge').textContent).toContain('370.000');

    // No Preference ('any'): 10:00 occupied in BOTH rooms -> booked; 14:00 occupied only in Room A -> selectable showing Room B!
    await waitFor(() => {
      expect(screen.getByTestId('client-slot-10:00').getAttribute('data-slot-state')).toBe(
        'occupied',
      );
      expect(screen.getByTestId('client-slot-14:00').getAttribute('data-slot-state')).toBe(
        'available',
      );
    });
    expect(screen.getByTestId('client-slot-14:00').textContent).toContain('Room B');

    await user.click(screen.getByTestId('client-slot-14:00'));
    await user.click(screen.getByTestId('client-schedule-continue-btn'));

    // Step 3: Review & Send (prefilled contact, consent check, honest non-confirmation)
    expect(await screen.findByTestId('client-booking-step-review')).toBeTruthy();
    expect(screen.getByLabelText(/your name/i).value).toBe('Dimas Pratama');
    expect(screen.getByLabelText(/whatsapp \/ phone number/i).value).toBe('+62 812-5555-8888');
    expect(screen.getByTestId('client-booking-price-summary').textContent).toContain('370.000');

    await user.type(screen.getByLabelText(/band \/ artist name/i), 'Midnight Echo');
    await user.type(screen.getByLabelText(/notes for studio crew/i), 'Bring extra cymbal stand');

    // Without privacy consent -> validation error, zero saved docs
    await user.click(screen.getByTestId('client-booking-submit-btn'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(bookingRequestAdapter._inspectState().requests.size).toBe(0);

    // Check consent & submit (verify single-flight guard by clicking twice)
    await user.click(screen.getByRole('checkbox'));
    await Promise.all([
      user.click(screen.getByTestId('client-booking-submit-btn')),
      user.click(screen.getByTestId('client-booking-submit-btn')),
    ]);

    expect(await screen.findByTestId('client-booking-success-view')).toBeTruthy();
    expect(screen.getByText(/Request Received · Pending Studio Review/i)).toBeTruthy();

    const storedRequests = Array.from(bookingRequestAdapter._inspectState().requests.values());
    expect(storedRequests).toHaveLength(1);
    expect(storedRequests[0]).toMatchObject({
      requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
      source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
      clientUid: 'client-book-uid-1',
      customerId: 'cust_book_client_1',
      publicServiceId: 'rehearsal',
      serviceOptionId: 'pkg-rehearsal-3h',
      serviceOptionName: 'Paket 3 Hours',
      pricingVersion: 2,
      requestedRoomId: 'any',
      preferredDate: tomorrowIso,
      preferredStartMinute: 840,
      preferredDurationMinutes: 240,
      bandName: 'Midnight Echo',
      status: 'new',
    });
  });

  it('E. Completes 3-step Mix & Master project inquiry cleanly without studio rooms, availability slots, or duration pickers', async () => {
    const user = userEvent.setup();
    seedAuthenticatedClient(clientAdapter);

    renderAppAt('/portal/book');
    expect(await screen.findByTestId('client-booking-step-select-session')).toBeTruthy();

    // Select WFA service (Mixing -> Mixing Reguler)
    await user.click(screen.getByTestId('client-service-card-mixing'));
    await user.click(screen.getByTestId('client-option-card-mixing-regular'));
    await user.click(screen.getByRole('button', { name: /continue to project details/i }));

    // Step 2: Project Details ONLY (no Room A / Room B / time slots!)
    expect(await screen.findByTestId('client-booking-step-project-details')).toBeTruthy();
    expect(screen.queryByTestId('client-booking-step-schedule')).toBeNull();
    expect(screen.queryByRole('group', { name: /choose room preference/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /choose session duration/i })).toBeNull();

    const projectDetailsContinue = screen.getByRole('button', { name: /continue to review/i });
    expect(projectDetailsContinue.disabled).toBe(true);

    await user.type(screen.getByLabelText(/project \/ artist name/i), 'Senja EP');
    expect(projectDetailsContinue.disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'EP' }));
    await user.type(screen.getByLabelText(/track count/i), '5');
    fireEvent.change(screen.getByLabelText(/target deadline/i), {
      target: { value: tomorrowIso },
    });
    await user.type(
      screen.getByLabelText(/project brief \/ references/i),
      'Warm indie rock mix reference',
    );
    expect(projectDetailsContinue.disabled).toBe(false);
    await user.click(projectDetailsContinue);

    // Step 3: Review & Send
    expect(await screen.findByTestId('client-booking-step-review')).toBeTruthy();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByTestId('client-booking-submit-btn'));

    expect(await screen.findByTestId('client-booking-success-view')).toBeTruthy();

    const storedRequests = Array.from(bookingRequestAdapter._inspectState().requests.values());
    expect(storedRequests).toHaveLength(1);
    expect(storedRequests[0]).toMatchObject({
      requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
      source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
      publicServiceId: 'mixing',
      serviceOptionId: 'mixing-regular',
      serviceOptionName: 'Mixing Reguler',
      requestedRoomId: null,
      preferredDate: null,
      preferredStartMinute: null,
      preferredDurationMinutes: null,
      targetDeadline: tomorrowIso,
      bandName: 'Senja EP',
    });
    expect(storedRequests[0].notes).toContain('[Project Type: EP • Tracks: 5]');
    expect(storedRequests[0].notes).toContain('Project Brief: Warm indie rock mix reference');
  });

  it('F. Integrates Client Portal booking requests into Admin Inbox, Detail Drawer & Calendar BookingFormDialog with exact serviceOptionId + duration mapping and stale-option safeguard', async () => {
    const user = userEvent.setup();

    // Verify stale/deactivated serviceOptionId requires manual selection
    const withoutPkg = clonePricingSettings(DEFAULT_PRICING_SETTINGS);
    withoutPkg.serviceTypes[0].options = withoutPkg.serviceTypes[0].options.map((opt) =>
      opt.id === 'pkg-rehearsal-3h' ? { ...opt, isActive: false } : opt,
    );
    const missingMap = mapPublicServiceToInternalPricing(
      'rehearsal',
      withoutPkg.serviceTypes,
      'pkg-rehearsal-3h',
    );
    expect(missingMap.requiresManualSelection).toBe(true);
    expect(missingMap.serviceOptionId).toBe('');

    // Seed a Client Portal Studio Booking request into Admin Inbox
    await bookingRequestAdapter.createPublicBookingRequest({
      requestId: 'req_client_portal_int1',
      payload: {
        schemaVersion: 1,
        requestReference: 'REQ-CPINT001',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: 'new',
        statusReason: '',
        customerName: 'Dimas Client',
        bandName: 'Midnight Echo',
        contactPhone: '+6281255558888',
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-b',
        preferredDate: tomorrowIso,
        preferredStartMinute: 840,
        preferredDurationMinutes: 240,
        targetDeadline: null,
        notes: 'Client extended 4h pkg',
        privacyConsent: true,
        consentVersion: 'v1',
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'pkg-rehearsal-3h',
        serviceOptionName: 'Paket 3 Hours',
        pricingVersion: 2,
        assignedStaffUid: '',
        assignedStaffName: '',
        lastCommunicationAt: null,
        lastCommunicationType: '',
        lastCommunicationStatus: '',
        linkedBookingId: null,
        confirmedBookingSnapshot: null,
        confirmedAt: null,
        confirmedByUid: '',
        appCheckState: 'unconfigured',
        updatedByUid: '',
        version: 1,
      },
    });

    seedAuthenticatedStaff(clientAdapter, 'staff', 'staff-uid-1');

    // Open Admin Booking Requests Inbox -> inspect badge & open Drawer
    renderAppAt('/admin/booking-requests');
    expect(await screen.findByText('REQ-CPINT001')).toBeTruthy();
    expect(screen.getAllByText('Client Portal').length).toBeGreaterThan(0);
    const requestRow = screen.getByTestId('booking-request-row-req_client_portal_int1');
    expect(within(requestRow).getByText('Rehearsal')).toBeTruthy();
    expect(within(requestRow).getByText('Paket 3 Hours')).toBeTruthy();

    await user.click(screen.getByText('REQ-CPINT001'));
    expect(await screen.findByText(/Katalog Publik v2/i)).toBeTruthy();

    // Navigate to Calendar conversion link
    const convertLink = screen.getByTestId('convert-to-calendar-booking-link');
    await user.click(convertLink);

    const dialog = await screen.findByRole('dialog', { name: /tambah booking/i });
    const reqBanner = within(dialog).getByTestId('booking-form-request-banner');
    expect(reqBanner.textContent).toContain('Client Portal');
    expect(reqBanner.textContent).toContain('Paket 3 Hours');

    // Exact serviceOptionId + extended 240m (Rp 370.000) prefilled identically!
    expect(within(dialog).getAllByText(/Rp\s*370\.000/).length).toBeGreaterThan(0);

    await user.click(within(dialog).getByRole('button', { name: /simpan booking/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
    });

    const bookings = Array.from(bookingAdapter._inspectState().bookings.values());
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'pkg-rehearsal-3h',
      durationMinutes: 240,
      subtotal: 400000,
      discountAmount: 30000,
      totalAmount: 370000,
    });
  });

  it('G. Displays live confirmed sessions, pending requests, history, and Overview summary in Client Portal with real-time confirmation updates and error retry', async () => {
    const user = userEvent.setup();
    const yesterdayIso = addDaysToIsoDate(todayIso, -1);
    const dayAfterIso = addDaysToIsoDate(todayIso, 2);

    seedAuthenticatedClient(clientAdapter, {
      uid: 'client-book-uid-1',
      customerId: 'cust_book_client_1',
      displayName: 'Dimas Pratama',
      phoneDisplay: '+62 812-5555-8888',
    });

    bookingRequestAdapter._seedRequests([
      {
        id: 'req_cp_confirmed_upcoming',
        requestReference: 'REQ-UPCM0001',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        customerName: 'Dimas Pratama',
        bandName: 'Midnight Echo',
        contactPhone: '+6281255558888',
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: tomorrowIso,
        preferredStartMinute: 720,
        preferredDurationMinutes: 120,
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'rehearsal-regular',
        serviceOptionName: 'Reguler',
        pricingVersion: 2,
        linkedBookingId: 'bkg_cp_up_1',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_cp_up_1',
          bookingReference: 'BKG_CP_UP_1',
          studioId: 'room-a',
          studioName: 'Room A — Live Room',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Reguler',
          date: tomorrowIso,
          startMinute: 720,
          endMinute: 840,
          durationMinutes: 120,
        },
        confirmedAt: `${todayIso}T09:00:00.000Z`,
        createdAt: `${todayIso}T08:00:00.000Z`,
      },
      {
        id: 'req_cp_pending_studio',
        requestReference: 'REQ-PEND0002',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.NEW,
        customerName: 'Dimas Pratama',
        bandName: 'Midnight Echo',
        contactPhone: '+6281255558888',
        publicServiceId: 'recording',
        serviceLabelSnapshot: 'Recording',
        requestedRoomId: 'room-b',
        preferredDate: dayAfterIso,
        preferredStartMinute: 900,
        preferredDurationMinutes: 120,
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'tracking-regular',
        serviceOptionName: 'Tracking Reguler',
        pricingVersion: 2,
        createdAt: `${todayIso}T10:00:00.000Z`,
      },
      {
        id: 'req_cp_wfa_mix',
        requestReference: 'REQ-MIX00003',
        requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
        status: BOOKING_REQUEST_STATUS.IN_REVIEW,
        customerName: 'Dimas Pratama',
        bandName: 'Senja EP',
        contactPhone: '+6281255558888',
        publicServiceId: 'mixing',
        serviceLabelSnapshot: 'Mixing',
        targetDeadline: dayAfterIso,
        notes: 'Need warm vintage bus glue',
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'mixing-regular',
        serviceOptionName: 'Mixing Reguler',
        pricingVersion: 2,
        createdAt: `${todayIso}T07:00:00.000Z`,
      },
      {
        id: 'req_cp_past_confirmed',
        requestReference: 'REQ-PAST0004',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        customerName: 'Dimas Pratama',
        bandName: 'Midnight Echo',
        contactPhone: '+6281255558888',
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: yesterdayIso,
        preferredStartMinute: 600,
        preferredDurationMinutes: 60,
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'rehearsal-regular',
        serviceOptionName: 'Reguler',
        pricingVersion: 2,
        linkedBookingId: 'bkg_cp_past_1',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_cp_past_1',
          bookingReference: 'BKG_CP_PAST1',
          studioId: 'room-a',
          studioName: 'Room A — Live Room',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Reguler',
          date: yesterdayIso,
          startMinute: 600,
          endMinute: 660,
          durationMinutes: 60,
        },
        confirmedAt: `${yesterdayIso}T08:00:00.000Z`,
        createdAt: `${yesterdayIso}T07:00:00.000Z`,
      },
      {
        id: 'req_cp_declined_hist',
        requestReference: 'REQ-DECL0005',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.DECLINED,
        statusReason: 'Room maintenance scheduled.',
        customerName: 'Dimas Pratama',
        bandName: 'Midnight Echo',
        contactPhone: '+6281255558888',
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: yesterdayIso,
        preferredStartMinute: 780,
        preferredDurationMinutes: 120,
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'client-book-uid-1',
        customerId: 'cust_book_client_1',
        serviceOptionId: 'rehearsal-regular',
        serviceOptionName: 'Reguler',
        pricingVersion: 2,
        createdAt: `${yesterdayIso}T05:00:00.000Z`,
      },
      {
        id: 'req_other_client_secret',
        requestReference: 'REQ-OTHER999',
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        customerName: 'Secret Band',
        contactPhone: '+6281999999999',
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-b',
        preferredDate: tomorrowIso,
        preferredStartMinute: 600,
        preferredDurationMinutes: 60,
        source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
        clientUid: 'other-client-uid-999',
        customerId: 'cust_other_999',
        serviceOptionId: 'rehearsal-regular',
        serviceOptionName: 'Reguler',
        pricingVersion: 2,
        linkedBookingId: 'bkg_other_secret',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_other_secret',
          bookingReference: 'BKG_SECRET_X',
          studioId: 'room-b',
          studioName: 'Room B — Control + Booth',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Reguler',
          date: tomorrowIso,
          startMinute: 600,
          endMinute: 660,
          durationMinutes: 60,
        },
      },
    ]);

    const reservationFixture = (overrides = {}) => ({
      schemaVersion: 2,
      bookingId: 'bkg_fixture',
      bookingReference: 'BKG_FIXTURE',
      customerId: 'cust_book_client_1',
      clientUid: 'client-book-uid-1',
      sourceRequestId: '',
      acceptedOfferId: '',
      invoiceId: 'inv_bkg_fixture',
      studioId: 'room-a',
      studioName: 'Room A — Live Room',
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      date: tomorrowIso,
      startMinute: 600,
      endMinute: 660,
      durationMinutes: 60,
      timeZone: 'Asia/Jakarta',
      reservationStatus: 'confirmed',
      sessionStatus: 'upcoming',
      holdExpiresAt: null,
      effectiveTotalAmount: 420000,
      minimumDepositAmount: null,
      depositStatus: null,
      paymentStatus: 'unpaid',
      createdAt: `${todayIso}T07:00:00.000Z`,
      updatedAt: `${todayIso}T11:00:00.000Z`,
      version: 2,
      ...overrides,
    });

    // Canonical projection intentionally disagrees with the old request snapshot:
    // the Client must see the latest Calendar schedule, not the stale confirmedBookingSnapshot.
    bookingAdapter._seedClientReservation('bkg_cp_up_1', reservationFixture({
      bookingId: 'bkg_cp_up_1',
      bookingReference: 'BKG_LIVE_UP1',
      sourceRequestId: 'req_cp_confirmed_upcoming',
      studioId: 'room-b',
      studioName: 'Room B — Control + Booth',
      serviceTypeName: 'Recording',
      serviceOptionName: 'Tracking Updated',
      date: dayAfterIso,
      startMinute: 900,
      endMinute: 960,
      durationMinutes: 60,
    }));
    bookingAdapter._seedClientReservation('bkg_cp_past_1', reservationFixture({
      bookingId: 'bkg_cp_past_1',
      bookingReference: 'BKG_LIVE_PAST',
      sourceRequestId: 'req_cp_past_confirmed',
      date: yesterdayIso,
      sessionStatus: 'completed',
    }));
    bookingAdapter._seedClientReservation('bkg_walkin_001', reservationFixture({
      bookingId: 'bkg_walkin_001',
      bookingReference: 'BKG_WALKIN01',
      clientUid: '',
      sourceRequestId: '',
      serviceOptionName: 'Walk-in',
      date: addDaysToIsoDate(todayIso, 5),
      startMinute: 600,
      endMinute: 660,
    }));
    bookingAdapter._seedClientReservation('bkg_cancelled_001', reservationFixture({
      bookingId: 'bkg_cancelled_001',
      bookingReference: 'BKG_CANCELLED',
      sessionStatus: 'cancelled',
      reservationStatus: 'cancelled',
    }));
    bookingAdapter._seedClientReservation('bkg_no_show_001', reservationFixture({
      bookingId: 'bkg_no_show_001',
      bookingReference: 'BKG_NO_SHOW',
      sessionStatus: 'no_show',
    }));
    bookingAdapter._seedClientReservation('bkg_other_client_001', reservationFixture({
      bookingId: 'bkg_other_client_001',
      bookingReference: 'BKG_OTHER_SECRET',
      customerId: 'cust_other_999',
      clientUid: 'other-client-uid-999',
    }));

    renderAppAt('/portal/bookings');

    const bookingsPage = await screen.findByTestId('client-bookings-page');
    expect(await screen.findByText('Live Updates')).toBeTruthy();
    expect(bookingsPage.textContent).not.toContain('Sync Pending');

    // Strict client isolation: another client's record never appears
    expect(screen.queryByText('REQ-OTHER999')).toBeNull();
    expect(screen.queryByText('BKG_SECRET_X')).toBeNull();

    const upcomingSection = screen.getByTestId('client-bookings-section-upcoming');
    const requestsSection = screen.getByTestId('client-bookings-section-requests');
    const historySection = screen.getByTestId('client-bookings-section-history');

    expect(within(upcomingSection).getByText('BKG_LIVE_UP1')).toBeTruthy();
    expect(within(requestsSection).getByText('REQ-PEND0002')).toBeTruthy();
    expect(within(requestsSection).getByText('REQ-MIX00003')).toBeTruthy();
    expect(within(historySection).getByText('BKG_LIVE_PAST')).toBeTruthy();
    expect(within(upcomingSection).getByText('BKG_WALKIN01')).toBeTruthy();
    expect(within(upcomingSection).getByText('Room B — Control + Booth')).toBeTruthy();
    expect(within(upcomingSection).getByText(/Recording.*Tracking Updated/)).toBeTruthy();
    expect(within(historySection).getByText('BKG_CANCELLED')).toBeTruthy();
    expect(within(historySection).getByText('BKG_NO_SHOW')).toBeTruthy();
    expect(within(historySection).getByText('No Show')).toBeTruthy();
    expect(bookingsPage.textContent).not.toContain('BKG_OTHER_SECRET');
    expect(within(historySection).getByText('REQ-DECL0005')).toBeTruthy();
    expect(within(historySection).getByText('Room maintenance scheduled.')).toBeTruthy();

    // Tab filters work accurately
    await user.click(screen.getByRole('tab', { name: /Upcoming/i }));
    expect(screen.queryByTestId('client-bookings-section-requests')).toBeNull();
    expect(screen.queryByTestId('client-bookings-section-history')).toBeNull();
    await user.click(screen.getByRole('tab', { name: /All Groups/i }));

    // Real-time update: confirming pending request moves it to Upcoming immediately with zero manual sync
    await createBooking({
      actorUid: 'owner-uid-1',
      bookingRequestId: 'req_cp_pending_studio',
      formValues: {
        customerName: 'Dimas Pratama',
        phone: '+6281255558888',
        bandName: 'Midnight Echo',
        studioId: 'room-b',
        serviceTypeId: 'recording',
        serviceOptionId: 'tracking-regular',
        date: dayAfterIso,
        startMinute: 900,
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
      },
      pricingSettings: DEFAULT_PRICING_SETTINGS,
      adapter: bookingAdapter,
    });

    await waitFor(() => {
      const nextUpcoming = screen.getByTestId('client-bookings-section-upcoming');
      expect(within(nextUpcoming).getByText('REQ-PEND0002')).toBeTruthy();
    });
    expect(
      within(screen.getByTestId('client-bookings-section-requests')).queryByText('REQ-PEND0002'),
    ).toBeNull();
    cleanup();

    // Verify /portal Overview shows live counts, Next Session & Recent Activity
    renderAppAt('/portal');
    const overviewPage = await screen.findByTestId('client-portal-home');
    expect(await screen.findByText('Live updates')).toBeTruthy();
    expect(overviewPage.textContent).not.toContain('Awaiting module sync');
    expect(overviewPage.textContent).not.toContain('Schedule Integration Pending');

    const nextSessionCard = screen.getByTestId('client-overview-next-session');
    expect(await within(nextSessionCard).findByText('BKG_LIVE_UP1')).toBeTruthy();
    expect(within(nextSessionCard).getByText('Room A — Live Room')).toBeTruthy();

    const activityCard = screen.getByTestId('client-overview-recent-activity');
    expect(within(activityCard).getByText('BKG_LIVE_UP1')).toBeTruthy();
    cleanup();

    // Error + Try Again retry flow on /portal/bookings
    bookingRequestAdapter._setNextClientSubscribeError({
      code: 'unavailable',
      message: 'Network unavailable',
    });
    renderAppAt('/portal/bookings');
    const errorState = await screen.findByTestId('client-bookings-error-state');
    expect(errorState.textContent).toContain('Network connection interrupted');
    await user.click(within(errorState).getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('client-bookings-section-upcoming')).toBeTruthy();
  });

  it('H. Automatically heals Public Availability & Public Pricing from AdminLayout without manual user clicks and hides redundant Re-sync buttons once healthy', async () => {
    seedAuthenticatedStaff(clientAdapter, 'owner', 'owner-uid-1');

    bookingAdapter._sharedStore.publicAvailability.clear();
    const freshAvailabilityAdapter = createInMemoryPublicAvailabilityRepositoryAdapter({
      sharedStore: bookingAdapter._sharedStore,
      initialMetadata: { isReady: false, backfilledFromDate: '' },
    });
    setPublicAvailabilityRepositoryAdapter(freshAvailabilityAdapter);
    publicPricingAdapter._setStoredDoc(null);

    // Visiting generic /admin/dashboard silently heals BOTH Public Availability & Public Pricing
    renderAppAt('/admin/dashboard');

    await waitFor(async () => {
      const meta = await freshAvailabilityAdapter.getPublicAvailabilityMetadata();
      expect(meta.isReady).toBe(true);
      expect(publicPricingAdapter._getStoredDoc()?.version).toBe(2);
    });
    cleanup();

    // Calendar Toolbar exposes the healthy public status on demand without a redundant re-sync action.
    renderAppAt('/admin/calendar');
    const calendarStatusToggle = await screen.findByRole('button', {
      name: /status kalender publik: publik aktif/i,
    });
    expect(calendarStatusToggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(calendarStatusToggle);

    const calendarStatusDetails = await screen.findByRole('region', {
      name: /detail kalender publik/i,
    });
    expect(calendarStatusDetails.textContent).toMatch(/tersinkron otomatis/i);
    expect(within(calendarStatusDetails).queryByRole('button', { name: /sinkronkan/i })).toBeNull();
    cleanup();

    renderAppAt('/admin/settings/price-and-fee');
    const pricingSyncBanner = await screen.findByTestId('public-pricing-synced-banner');
    expect(pricingSyncBanner.textContent).toMatch(/tersinkron otomatis/i);
    expect(within(pricingSyncBanner).queryByRole('button', { name: /re-sync/i })).toBeNull();
  });
});
