import fs from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db, collectionName, docId) => ({
  path: `${collectionName}/${docId}`,
  id: docId,
}));
const mockInitializeAppCheck = vi.fn((app, opts) => ({ app, opts, _isMockAppCheck: true }));
const mockReCaptchaV3Provider = vi.fn(function MockReCaptchaV3Provider(siteKey) {
  this.siteKey = siteKey;
});
const mockGetAppCheckToken = vi.fn(async () => ({ token: 'mock-app-check-token' }));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: (...args) => mockSignOut(...args),
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
    queueMicrotask(() => onNext({ docs: [] }));
    return () => {};
  }),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args) => mockInitializeAppCheck(...args),
  ReCaptchaV3Provider: mockReCaptchaV3Provider,
  getToken: (...args) => mockGetAppCheckToken(...args),
}));

import { AppRoutes } from '@/App';
import { BookingSection } from '@/components/landing/BookingSection';
import { landingPageContent } from '@/data/landing-page-content';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createInMemoryBookingRepositoryAdapter,
  createBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
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
import { AuthContext } from '@/features/auth/AuthContext';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';
import {
  ensureAppCheckTokenForPublicWrite,
  getAppCheckSiteKey,
  initializeFirebaseAppCheck,
  resetAppCheckForTests,
  resolveDevAppCheckDebugToken,
} from '@/lib/firebase/app-check';

import {
  BOOKING_REQUEST_ACTIVITY_TYPES,
  BOOKING_REQUEST_COMMUNICATION_TYPES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from './config/booking-request-config';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from './repositories/booking-request-repository';
import {
  createInMemoryWhatsAppTemplateRepositoryAdapter,
  resetWhatsAppTemplateRepositoryAdapter,
  setWhatsAppTemplateRepositoryAdapter,
} from './repositories/whatsapp-template-repository';
import {
  mapBookingRequestErrorToMessage,
  resetPublicSubmissionCooldownForTests,
  submitPublicBookingRequest,
  transitionBookingRequestStatus,
} from './services/booking-request-service';
import {
  buildWhatsAppClickToChatUrl,
  restoreDefaultWhatsAppTemplate,
  saveWhatsAppTemplate,
} from './services/whatsapp-message-service';
import { mapPublicServiceToInternalPricing } from './utils/booking-request-normalize';
import {
  buildTemplateVariableMap,
  findUnresolvedPlaceholders,
  renderWhatsAppTemplate,
} from './utils/whatsapp-template-renderer';

function getFutureDateIso(daysAhead = 5) {
  const base = new Date();
  base.setDate(base.getDate() + daysAhead);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPastDateIso(daysBack = 3) {
  const base = new Date();
  base.setDate(base.getDate() - daysBack);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildAuthValue({
  uid = 'owner-uid-1',
  role = 'owner',
  displayName = '37 Music Studio Owner',
  email = 'owner@37music.id',
  active = true,
} = {}) {
  return {
    user: {
      uid,
      email,
      displayName,
      metadata: { lastSignInTime: '2026-11-22T01:00:00.000Z' },
    },
    profile: {
      uid,
      role,
      displayName,
      email,
      active,
    },
    role,
    status: 'authenticated',
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    clearAuthError: vi.fn(),
  };
}

function setupLinkedInMemoryAdapters(initialRequests = [], pricingDoc = DEFAULT_PRICING_SETTINGS) {
  const bookingAdapter = createInMemoryBookingRepositoryAdapter();
  const requestAdapter = createInMemoryBookingRequestRepositoryAdapter(
    bookingAdapter,
    initialRequests,
  );
  const templateAdapter = createInMemoryWhatsAppTemplateRepositoryAdapter();
  const siteSettingsAdapter = createInMemoryPublicSiteSettingsAdapter(null);
  const pricingAdapter = createInMemoryPricingSettingsAdapter(pricingDoc);
  const customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
  const paymentAdapter = createInMemoryPaymentRepositoryAdapter(bookingAdapter);

  setBookingRepositoryAdapter(bookingAdapter);
  setBookingRequestRepositoryAdapter(requestAdapter);
  setWhatsAppTemplateRepositoryAdapter(templateAdapter);
  setPublicSiteSettingsRepositoryAdapter(siteSettingsAdapter);
  setPricingSettingsRepositoryAdapter(pricingAdapter);
  setCustomerRepositoryAdapter(customerAdapter);
  setPaymentRepositoryAdapter(paymentAdapter);

  return {
    bookingAdapter,
    requestAdapter,
    templateAdapter,
    siteSettingsAdapter,
    pricingAdapter,
    customerAdapter,
    paymentAdapter,
  };
}

describe('Phase H — Public Booking Request Workflow, Calendar Conversion & WhatsApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetPublicSubmissionCooldownForTests();
    resetAppCheckForTests();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetPublicSubmissionCooldownForTests();
    resetAppCheckForTests();
    resetBookingRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
    resetWhatsAppTemplateRepositoryAdapter();
    resetPublicSiteSettingsRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
  });

  describe('Group 1 — Public Request Submission & Anti-Spam Validation', () => {
    it('persists Rehearsal & Recording studio bookings with canonical E.164 phone, REQ- reference, and consent', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters();
      const targetDate = getFutureDateIso(4);

      const rehearsal = await submitPublicBookingRequest({
        requestId: 'req_REH1234567890ABCDEF',
        input: {
          customerName: 'Raka Pratama',
          bandName: 'Midnight Static',
          contactPhone: '0812-3456-7890',
          publicServiceId: 'rehearsal',
          requestedRoomId: 'room-a',
          preferredDate: targetDate,
          preferredTime: '19:30',
          duration: '2 hours',
          notes: 'Butuh 2 mic vokal tambahan.',
          privacyConsent: true,
        },
        formOpenedAtMs: Date.now() - 5000,
        minElapsedMs: 1000,
        cooldownMs: 0,
        adapter: requestAdapter,
      });

      expect(rehearsal.id).toBe('req_REH1234567890ABCDEF');
      expect(rehearsal.requestReference).toBe('REQ-REH12345');
      expect(rehearsal.requestType).toBe(BOOKING_REQUEST_TYPES.STUDIO_BOOKING);
      expect(rehearsal.status).toBe(BOOKING_REQUEST_STATUS.NEW);
      expect(rehearsal.contactPhone).toBe('+6281234567890');
      expect(rehearsal.requestedRoomId).toBe('room-a');
      expect(rehearsal.preferredDate).toBe(targetDate);
      expect(rehearsal.preferredStartMinute).toBe(1170);
      expect(rehearsal.preferredDurationMinutes).toBe(120);
      expect(rehearsal.privacyConsent).toBe(true);
      expect(rehearsal.consentVersion).toBe('v1');
      expect(rehearsal.version).toBe(1);
      expect(rehearsal.linkedBookingId).toBeNull();

      const recording = await submitPublicBookingRequest({
        requestId: 'req_REC9876543210ABCDEF',
        input: {
          customerName: 'Sinta Wijaya',
          contactPhone: '+6281911223344',
          publicServiceId: 'recording',
          requestedRoomId: 'room-b',
          preferredDate: targetDate,
          preferredTime: '13:00',
          duration: '4 hours',
          privacyConsent: true,
        },
        formOpenedAtMs: Date.now() - 5000,
        minElapsedMs: 1000,
        cooldownMs: 0,
        adapter: requestAdapter,
      });

      expect(recording.requestType).toBe(BOOKING_REQUEST_TYPES.STUDIO_BOOKING);
      expect(recording.publicServiceId).toBe('recording');
      expect(recording.requestedRoomId).toBe('room-b');
      expect(recording.preferredStartMinute).toBe(780);
      expect(recording.preferredDurationMinutes).toBe(240);
    });

    it('persists Mix & Master as post_production_inquiry without creating room or slot requirements', async () => {
      const { requestAdapter, bookingAdapter } = setupLinkedInMemoryAdapters();
      const targetDeadline = getFutureDateIso(10);

      const postProd = await submitPublicBookingRequest({
        requestId: 'req_MIX1122334455667788',
        input: {
          customerName: 'Dimas Producer',
          bandName: 'Lampu Kota',
          contactPhone: '081355566677',
          publicServiceId: 'mix-master',
          requestedRoomId: 'room-a', // Ignored/nulled for post-production inquiry
          preferredDate: getFutureDateIso(2),
          preferredTime: '19:00',
          duration: '3 hours',
          targetDeadline,
          notes: '8 stems WAV 48kHz 24-bit.',
          privacyConsent: true,
        },
        formOpenedAtMs: Date.now() - 3000,
        minElapsedMs: 1000,
        cooldownMs: 0,
        adapter: requestAdapter,
      });

      expect(postProd.requestType).toBe(BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY);
      expect(postProd.publicServiceId).toBe('mix-master');
      expect(postProd.requestedRoomId).toBeNull();
      expect(postProd.preferredDate).toBeNull();
      expect(postProd.preferredStartMinute).toBeNull();
      expect(postProd.preferredDurationMinutes).toBeNull();
      expect(postProd.targetDeadline).toBe(targetDeadline);

      const state = bookingAdapter._inspectState();
      expect(state.bookings.size).toBe(0);
      expect(state.slots.size).toBe(0);
    });

    it('rejects invalid phone, past dates, operating-hours overflow, missing consent, and empty required fields', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters();
      const base = {
        customerName: 'Raka Pratama',
        contactPhone: '081234567890',
        publicServiceId: 'rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: getFutureDateIso(3),
        preferredTime: '19:00',
        duration: '2 hours',
        privacyConsent: true,
      };

      await expect(
        submitPublicBookingRequest({
          input: { ...base, customerName: '' },
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/validation-error' });

      await expect(
        submitPublicBookingRequest({
          input: { ...base, contactPhone: '123' },
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/validation-error' });

      await expect(
        submitPublicBookingRequest({
          input: { ...base, preferredDate: getPastDateIso(2) },
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/validation-error' });

      await expect(
        submitPublicBookingRequest({
          input: { ...base, preferredTime: '22:00', duration: '2 hours' }, // ends at 24:00 > 23:00
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/validation-error' });

      await expect(
        submitPublicBookingRequest({
          input: { ...base, privacyConsent: false },
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/validation-error' });

      expect(requestAdapter._inspectState().requests.size).toBe(0);
    });

    it('enforces client honeypot, minimum dwell elapsed time, and submission cooldown guards', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters();
      const validInput = {
        customerName: 'Tania Bass',
        contactPhone: '081299988877',
        publicServiceId: 'rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: getFutureDateIso(4),
        preferredTime: '16:00',
        duration: '2 hours',
        privacyConsent: true,
      };

      await expect(
        submitPublicBookingRequest({
          input: validInput,
          honeypotValue: 'http://spam-bot.example',
          formOpenedAtMs: Date.now() - 5000,
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/spam-detected' });

      const now = new Date();
      await expect(
        submitPublicBookingRequest({
          input: validInput,
          formOpenedAtMs: now.getTime() - 200,
          minElapsedMs: 1000,
          now,
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/submitted-too-fast' });

      await submitPublicBookingRequest({
        input: validInput,
        formOpenedAtMs: Date.now() - 5000,
        minElapsedMs: 1000,
        cooldownMs: 15000,
        adapter: requestAdapter,
      });

      await expect(
        submitPublicBookingRequest({
          input: validInput,
          formOpenedAtMs: Date.now() - 5000,
          minElapsedMs: 1000,
          cooldownMs: 15000,
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/cooldown-active' });
    });

    it('prevents double-click duplicate submissions, avoids fake success on repository errors, and shows honest pending REQ receipt', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters();
      let resolvePendingCreate;
      const slowCreateSpy = vi.fn(
        () =>
          new Promise((resolve) => {
            resolvePendingCreate = resolve;
          }),
      );
      const customAdapter = {
        ...requestAdapter,
        createPublicBookingRequest: slowCreateSpy,
      };
      setBookingRequestRepositoryAdapter(customAdapter);

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <BookingSection
            bookingSection={landingPageContent.bookingSection}
            selectionVersion={0}
            minSubmitElapsedMs={0}
            submitCooldownMs={0}
          />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText(/your name/i), 'Gilang Drum');
      await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '081234567890');
      await user.click(
        screen.getByRole('checkbox', { name: /i agree that 37 music studio may store/i }),
      );

      const submitBtn = screen.getByRole('button', { name: /submit booking request/i });
      await user.click(submitBtn);
      await user.click(submitBtn);

      await waitFor(() => {
        expect(slowCreateSpy).toHaveBeenCalledTimes(1);
      });

      resolvePendingCreate({
        id: 'req_UILOCK01',
        requestReference: 'REQ-UILOCK01',
        requestType: 'studio_booking',
        status: 'new',
        customerName: 'Gilang Drum',
        contactPhone: '+6281234567890',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomLabel: 'Room A — Live Room',
        preferredDate: getFutureDateIso(1),
        preferredTimeLabel: '19:00',
        preferredDurationMinutes: 120,
      });

      expect(await screen.findByText('Booking request received')).toBeTruthy();
      expect(screen.getAllByText(/REQ-UILOCK01/).length).toBeGreaterThanOrEqual(1);

      // Now verify failed write produces honest error & zero fake receipt
      cleanup();
      requestAdapter._setNextCreateError(
        Object.assign(new Error('Permission denied'), { code: 'permission-denied' }),
      );
      setBookingRequestRepositoryAdapter(requestAdapter);

      render(
        <MemoryRouter>
          <BookingSection
            bookingSection={landingPageContent.bookingSection}
            selectionVersion={0}
            minSubmitElapsedMs={0}
            submitCooldownMs={0}
          />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText(/your name/i), 'Riko Fail');
      await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '081234567899');
      await user.click(
        screen.getByRole('checkbox', { name: /i agree that 37 music studio may store/i }),
      );
      await user.click(screen.getByRole('button', { name: /submit booking request/i }));

      expect(await screen.findByTestId('booking-request-error-alert')).toBeTruthy();
      expect(screen.queryByText('Booking request received')).toBeNull();
    });
  });

  describe('Group 2 — Firestore Security Contract & Firebase App Check', () => {
    it('enforces strict Firestore Security Rules contracts for publicSiteSettings, publicBookingRequests, communications, activities, and templates', () => {
      const rulesSource = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

      // publicSiteSettings/{docId}
      expect(rulesSource).toContain('match /publicSiteSettings/{docId}');
      expect(rulesSource).toMatch(
        /match \/publicSiteSettings\/\{docId\}[\s\S]*allow get: if docId == 'site';[\s\S]*allow create, update: if isActiveOwner\(\)\s*&& docId == 'site'/,
      );

      // publicBookingRequests/{requestId}
      expect(rulesSource).toContain('match /publicBookingRequests/{requestId}');
      expect(rulesSource).toContain('data.size() == 33');
      expect(rulesSource).toContain("data.status == 'new'");
      expect(rulesSource).toContain('data.privacyConsent == true');
      expect(rulesSource).toContain("data.contactPhone.matches('^\\\\+[1-9][0-9]{7,14}$')");
      expect(rulesSource).toContain('allow read: if isActiveStaff();');
      expect(rulesSource).toContain('isBookingRequestCustomerFieldsUnchanged(nextData, prevData)');
      expect(rulesSource).toContain('nextData.version == prevData.version + 1');
      expect(rulesSource).toContain(
        'existsAfter(/databases/$(database)/documents/bookings/$(nextData.linkedBookingId))',
      );
      expect(rulesSource).toContain(
        'getAfter(/databases/$(database)/documents/bookings/$(nextData.linkedBookingId))',
      );
      expect(rulesSource).toContain('allow delete: if false;');

      // Immutable subcollections outside Factory Reset
      expect(rulesSource).toContain('match /communications/{eventId}');
      expect(rulesSource).toContain('match /activities/{eventId}');
      expect(rulesSource).toContain('allow update: if false;');
      expect(rulesSource).toContain('allow delete: if canFactoryResetDelete();');

      // WhatsApp Templates
      expect(rulesSource).toContain('match /bookingRequestMessageTemplates/{templateId}');
      expect(rulesSource).toContain('allow create, update: if isActiveOwner()');
    });

    it('configures App Check with ReCaptchaV3Provider once, prevents double initialization, and blocks debug token in production', async () => {
      vi.stubEnv('VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY', '');
      const unconfiguredRes = await ensureAppCheckTokenForPublicWrite();
      expect(unconfiguredRes).toEqual({ initialized: false, state: 'unconfigured' });
      expect(getAppCheckSiteKey()).toBe('');

      vi.stubEnv('VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY', '6LeTestSiteKey123');
      vi.stubEnv('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'debug-token-dev-only');

      // Guard: PROD=true disables debug token even if configured
      vi.stubEnv('PROD', true);
      vi.stubEnv('DEV', false);
      expect(resolveDevAppCheckDebugToken()).toBeNull();

      vi.stubEnv('PROD', false);
      vi.stubEnv('DEV', true);
      expect(resolveDevAppCheckDebugToken()).toBe('debug-token-dev-only');

      const inst1 = await initializeFirebaseAppCheck();
      const inst2 = await initializeFirebaseAppCheck();
      expect(inst1).toBeTruthy();
      expect(inst2).toBe(inst1);
      expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
      expect(mockReCaptchaV3Provider).toHaveBeenCalledWith('6LeTestSiteKey123');

      const writeRes = await ensureAppCheckTokenForPublicWrite();
      expect(writeRes).toEqual({ initialized: true, state: 'verified' });
      expect(mockGetAppCheckToken).toHaveBeenCalledWith(inst1, false);
    });
  });

  describe('Group 3 — Calendar Conversion & Atomic Request Confirmation', () => {
    it('maps public services dynamically against active internal studio catalog and requires explicit selection when ambiguous', () => {
      const rehearsMapped = mapPublicServiceToInternalPricing(
        'rehearsal',
        DEFAULT_PRICING_SETTINGS.serviceTypes,
      );
      expect(rehearsMapped.isEligible).toBe(true);
      expect(rehearsMapped.isMapped).toBe(true);
      expect(rehearsMapped.requiresManualSelection).toBe(false);
      expect(rehearsMapped.serviceTypeId).toBe('rehearsal');

      const mixMasterMapped = mapPublicServiceToInternalPricing(
        'mix-master',
        DEFAULT_PRICING_SETTINGS.serviceTypes,
      );
      expect(mixMasterMapped.isEligible).toBe(false);
      expect(mixMasterMapped.requiresManualSelection).toBe(false);

      const renamedCustomCatalog = [
        {
          id: 'band-session-custom',
          name: 'Sesi Band Ruang A',
          deliveryMode: 'studio',
          isActive: true,
          options: [
            {
              id: 'opt-1',
              name: 'Standard',
              isActive: true,
              pricing: { mode: 'hourly', hourlyRate: 90000 },
            },
          ],
        },
      ];
      const ambiguous = mapPublicServiceToInternalPricing('rehearsal', renamedCustomCatalog);
      expect(ambiguous.isEligible).toBe(true);
      expect(ambiguous.isMapped).toBe(false);
      expect(ambiguous.requiresManualSelection).toBe(true);
      expect(ambiguous.reason).toMatch(/tidak memiliki pemetaan tunggal/i);
    });

    it('prefills /admin/calendar?action=new-booking&requestId=... preserving HH:30 slot and converts atomically into confirmed Calendar booking', async () => {
      const targetDate = getFutureDateIso(6);
      const { bookingAdapter, requestAdapter } = setupLinkedInMemoryAdapters([
        {
          id: 'req_CALCONV01',
          requestReference: 'REQ-CALCONV1',
          requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
          status: BOOKING_REQUEST_STATUS.ACCEPTED,
          customerName: 'Aria Vocal',
          bandName: 'Solaris',
          contactPhone: '+6281277788899',
          publicServiceId: 'rehearsal',
          serviceLabelSnapshot: 'Rehearsal',
          requestedRoomId: 'room-b',
          preferredDate: targetDate,
          preferredStartMinute: 1170, // 19:30 half-hour slot!
          preferredDurationMinutes: 120,
          notes: 'Bawa keyboard sendiri.',
          privacyConsent: true,
          version: 2,
          createdAt: '2026-11-22T05:00:00.000Z',
        },
      ]);

      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={buildAuthValue({ role: 'owner', uid: 'owner-conv-1' })}>
          <MemoryRouter
            initialEntries={[`/admin/calendar?action=new-booking&requestId=req_CALCONV01`]}
          >
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const banner = await screen.findByTestId(
        'booking-form-request-banner',
        {},
        { timeout: 5000 },
      );
      expect(within(banner).getByText(/REQ-CALCONV1/i)).toBeTruthy();

      expect(screen.getByDisplayValue('Aria Vocal')).toBeTruthy();
      expect(screen.getByDisplayValue('+6281277788899')).toBeTruthy();
      expect(screen.getByText(/19:30 WIB \(Pilihan Request\)/i)).toBeTruthy();

      await user.click(screen.getByRole('button', { name: /simpan booking/i }));

      await waitFor(() => {
        const updatedReq = requestAdapter._inspectState().requests.get('req_CALCONV01');
        expect(updatedReq?.status).toBe(BOOKING_REQUEST_STATUS.CONFIRMED);
        expect(updatedReq?.linkedBookingId).toBeTruthy();
      });

      const state = bookingAdapter._inspectState();
      const updatedReq = state.bookingRequests.get('req_CALCONV01');
      expect(updatedReq.confirmedBookingSnapshot.bookingId).toBe(updatedReq.linkedBookingId);
      expect(updatedReq.confirmedBookingSnapshot.studioId).toBe('room-b');
      expect(updatedReq.confirmedBookingSnapshot.startMinute).toBe(1170);
      expect(updatedReq.confirmedBookingSnapshot.durationMinutes).toBe(120);
      expect(state.bookings.size).toBe(1);
      expect(state.slots.size).toBe(4); // 120m = 4 half-hour slots
      expect(state.publicAvailability.size).toBe(1);
      expect(state.invoices.size).toBe(1);
      expect(state.customers.size).toBe(1);

      const activities = Array.from(state.bookingRequestActivities.values()).filter(
        (a) => a.requestId === 'req_CALCONV01',
      );
      expect(
        activities.some((a) => a.eventType === BOOKING_REQUEST_ACTIVITY_TYPES.BOOKING_CONFIRMED),
      ).toBe(true);
    });

    it('forces manual pricing selection when catalog mapping is ambiguous and rejects post-production inquiry conversion in Calendar UI', async () => {
      const targetDate = getFutureDateIso(7);
      const renamedPricing = {
        ...DEFAULT_PRICING_SETTINGS,
        serviceTypes: [
          {
            id: 'custom-room-session',
            name: 'Sesi Latihan Khusus',
            deliveryMode: 'studio',
            isActive: true,
            isSystem: false,
            sortOrder: 1,
            options: [
              {
                id: 'opt-custom-hourly',
                name: 'Hourly Reguler',
                description: 'Per jam',
                isActive: true,
                isSystem: false,
                sortOrder: 1,
                pricing: {
                  mode: 'hourly',
                  hourlyRate: 85000,
                  durationMinutes: 60,
                  basePrice: null,
                  discountAmount: 0,
                  projectPrice: null,
                  unitLabel: '',
                },
                discountRules: [],
                fees: {
                  staff: { mode: 'none', amount: 0 },
                  owner: { mode: 'none', amount: 0 },
                  recordingOperator: { mode: 'none', amount: 0 },
                },
              },
            ],
          },
        ],
      };

      setupLinkedInMemoryAdapters(
        [
          {
            id: 'req_AMBIG01',
            requestReference: 'REQ-AMBIG001',
            requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
            status: BOOKING_REQUEST_STATUS.NEW,
            customerName: 'Fajar Custom',
            contactPhone: '+6281411122233',
            publicServiceId: 'rehearsal',
            serviceLabelSnapshot: 'Rehearsal',
            requestedRoomId: 'room-a',
            preferredDate: targetDate,
            preferredStartMinute: 960,
            preferredDurationMinutes: 120,
            privacyConsent: true,
            version: 1,
            createdAt: '2026-11-22T06:00:00.000Z',
          },
          {
            id: 'req_POST01',
            requestReference: 'REQ-POST0001',
            requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
            status: BOOKING_REQUEST_STATUS.NEW,
            customerName: 'Nino Mix',
            contactPhone: '+6281422233344',
            publicServiceId: 'mix-master',
            serviceLabelSnapshot: 'Mix & Master',
            privacyConsent: true,
            version: 1,
            createdAt: '2026-11-22T06:30:00.000Z',
          },
        ],
        renamedPricing,
      );

      render(
        <AuthContext.Provider value={buildAuthValue()}>
          <MemoryRouter
            initialEntries={['/admin/calendar?action=new-booking&requestId=req_AMBIG01']}
          >
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const banner = await screen.findByTestId(
        'booking-form-request-banner',
        {},
        { timeout: 5000 },
      );
      expect(within(banner).getByText(/tidak memiliki pemetaan tunggal/i)).toBeTruthy();

      cleanup();

      render(
        <AuthContext.Provider value={buildAuthValue()}>
          <MemoryRouter
            initialEntries={['/admin/calendar?action=new-booking&requestId=req_POST01']}
          >
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect(
        await screen.findByText(/bersifat Post-Production/i, {}, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.queryByTestId('booking-form-request-banner')).toBeNull();
    });

    it('rolls back on slot conflict leaving request unconfirmed, prevents duplicate confirmation, and keeps retries idempotent', async () => {
      const targetDate = getFutureDateIso(8);
      const { bookingAdapter, requestAdapter } = setupLinkedInMemoryAdapters([
        {
          id: 'req_LOCKTEST',
          requestReference: 'REQ-LOCKTEST',
          requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
          status: BOOKING_REQUEST_STATUS.IN_REVIEW,
          customerName: 'Bima Gitar',
          contactPhone: '+6281211112222',
          publicServiceId: 'rehearsal',
          serviceLabelSnapshot: 'Rehearsal',
          requestedRoomId: 'room-a',
          preferredDate: targetDate,
          preferredStartMinute: 900,
          preferredDurationMinutes: 120,
          privacyConsent: true,
          version: 1,
          createdAt: '2026-11-22T07:00:00.000Z',
        },
        {
          id: 'req_POSTTEST',
          requestReference: 'REQ-POSTTEST',
          requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
          status: BOOKING_REQUEST_STATUS.NEW,
          customerName: 'Dian Vocal',
          contactPhone: '+6281299900011',
          publicServiceId: 'mix-master',
          serviceLabelSnapshot: 'Mix & Master',
          privacyConsent: true,
          version: 1,
          createdAt: '2026-11-22T07:10:00.000Z',
        },
      ]);

      const baseFormValues = {
        customerName: 'Pesaing Slot',
        phone: '+6281200000001',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        serviceId: 'rehearsal',
        studioId: 'room-a',
        date: targetDate,
        startMinute: '900',
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
        dpAmount: '',
        paymentMethod: 'cash',
        notes: '',
      };

      // Seed an occupying booking on that exact slot
      await createBooking({
        bookingId: 'bkg_OCCUPIER',
        eventId: 'evt_OCCUPIER',
        actorUid: 'owner-1',
        formValues: baseFormValues,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
        adapter: bookingAdapter,
      });

      // Slot conflict rolls back cleanly -> request MUST stay unconfirmed!
      await expect(
        createBooking({
          bookingId: 'bkg_FROM_REQ_FAIL',
          eventId: 'evt_FROM_REQ_FAIL',
          actorUid: 'owner-1',
          formValues: {
            ...baseFormValues,
            customerName: 'Bima Gitar',
            phone: '+6281211112222',
          },
          bookingRequestId: 'req_LOCKTEST',
          pricingSettings: DEFAULT_PRICING_SETTINGS,
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/slot-conflict' });

      const unconfirmedReq = requestAdapter._inspectState().requests.get('req_LOCKTEST');
      expect(unconfirmedReq.status).toBe(BOOKING_REQUEST_STATUS.IN_REVIEW);
      expect(unconfirmedReq.linkedBookingId).toBeNull();

      // Reject post-production inquiry conversion
      await expect(
        createBooking({
          bookingId: 'bkg_POST_FAIL',
          eventId: 'evt_POST_FAIL',
          actorUid: 'owner-1',
          formValues: {
            ...baseFormValues,
            startMinute: '1140',
            customerName: 'Dian Vocal',
            phone: '+6281299900011',
          },
          bookingRequestId: 'req_POSTTEST',
          pricingSettings: DEFAULT_PRICING_SETTINGS,
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/request-not-studio' });

      // Convert onto open slot 19:00 with fixed IDs + test idempotent retry
      const confirmed = await createBooking({
        bookingId: 'bkg_RETRY_IDEMP',
        eventId: 'evt_RETRY_IDEMP',
        actorUid: 'owner-1',
        formValues: {
          ...baseFormValues,
          startMinute: '1140',
          customerName: 'Bima Gitar',
          phone: '+6281211112222',
        },
        bookingRequestId: 'req_LOCKTEST',
        requestActivityEventId: 'reqact_RETRY_IDEMP',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
        adapter: bookingAdapter,
      });

      const retried = await createBooking({
        bookingId: 'bkg_RETRY_IDEMP',
        eventId: 'evt_RETRY_IDEMP',
        actorUid: 'owner-1',
        formValues: {
          ...baseFormValues,
          startMinute: '1140',
          customerName: 'Bima Gitar',
          phone: '+6281211112222',
        },
        bookingRequestId: 'req_LOCKTEST',
        requestActivityEventId: 'reqact_RETRY_IDEMP',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
        adapter: bookingAdapter,
      });

      expect(retried.id).toBe(confirmed.id);
      const afterConfirm = requestAdapter._inspectState().requests.get('req_LOCKTEST');
      expect(afterConfirm.status).toBe(BOOKING_REQUEST_STATUS.CONFIRMED);
      expect(afterConfirm.linkedBookingId).toBe('bkg_RETRY_IDEMP');

      // Duplicate conversion with a new bookingId must be blocked
      await expect(
        createBooking({
          bookingId: 'bkg_SECOND_DUP',
          eventId: 'evt_SECOND_DUP',
          actorUid: 'owner-1',
          formValues: {
            ...baseFormValues,
            startMinute: '600',
            customerName: 'Bima Gitar',
            phone: '+6281211112222',
          },
          bookingRequestId: 'req_LOCKTEST',
          pricingSettings: DEFAULT_PRICING_SETTINGS,
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/request-already-confirmed' });
    });
  });

  describe('Group 4 — WhatsApp Templates, Click-to-Chat URL Builder & Communication Logging', () => {
    it('builds valid encoded wa.me links, rejects invalid numbers, and renders 13 allowlisted variables without eval()', () => {
      const validWa = buildWhatsAppClickToChatUrl({
        phone: '0812-3456-7890',
        message: 'Halo Raka!\nJadwal & info',
      });
      expect(validWa.isValid).toBe(true);
      expect(validWa.waDigits).toBe('6281234567890');
      expect(validWa.url).toBe(
        `https://wa.me/6281234567890?text=${encodeURIComponent('Halo Raka!\nJadwal & info')}`,
      );

      expect(buildWhatsAppClickToChatUrl({ phone: '123', message: 'hi' }).isValid).toBe(false);

      const unconfirmedReq = {
        requestReference: 'REQ-UNCONF01',
        status: BOOKING_REQUEST_STATUS.ACCEPTED,
        linkedBookingId: null,
        customerName: 'Tania',
        bandName: 'Echo Nine',
        serviceLabelSnapshot: 'Recording',
        requestedRoomLabel: 'Room B — Control + Booth',
        preferredDate: '2026-12-01',
        preferredTimeLabel: '14:00',
        preferredDurationMinutes: 180,
        confirmedBookingSnapshot: {
          bookingId: 'bkg_SPOOF',
          bookingReference: 'BKG-SPOOF',
          studioId: 'room-b',
          studioName: 'Room B',
          serviceTypeName: 'Recording',
          serviceOptionName: 'Hourly',
          date: '2026-12-01',
          startMinute: 840,
          endMinute: 1020,
          durationMinutes: 180,
        },
      };

      // Confirmed fields must NOT populate when status !== 'confirmed' or linkedBookingId missing
      const unconfirmedVars = buildTemplateVariableMap({
        request: unconfirmedReq,
        studioName: '37 Music Studio',
      });
      expect(unconfirmedVars.confirmedDate).toBe('');
      expect(unconfirmedVars.bookingReference).toBe('');
      expect(unconfirmedVars.customerName).toBe('Tania');
      expect(unconfirmedVars.bandName).toBe('Echo Nine');

      const missingRender = renderWhatsAppTemplate(
        'Ref {bookingReference} + {unknownToken} untuk {customerName}',
        unconfirmedVars,
      );
      expect(missingRender.hasUnresolvedVariables).toBe(true);
      expect(missingRender.missingVariables).toContain('bookingReference');
      expect(missingRender.unknownVariables).toContain('unknownToken');
      expect(findUnresolvedPlaceholders(missingRender.renderedText)).toEqual([
        'bookingReference',
        'unknownToken',
      ]);

      // Now mark confirmed + linkedBookingId
      const confirmedVars = buildTemplateVariableMap({
        request: {
          ...unconfirmedReq,
          status: BOOKING_REQUEST_STATUS.CONFIRMED,
          linkedBookingId: 'bkg_REAL_1',
          confirmedBookingSnapshot: {
            ...unconfirmedReq.confirmedBookingSnapshot,
            bookingId: 'bkg_REAL_1',
            bookingReference: 'BKG_REAL_1',
          },
        },
        studioName: '37 Music Studio',
      });
      expect(confirmedVars.bookingReference).toBe('BKG_REAL_1');
      expect(confirmedVars.confirmedTime).toBe('14:00');
      expect(confirmedVars.confirmedEndTime).toBe('17:00');
    });

    it('gates booking_confirmed template, blocks unresolved tokens, opens wa.me truthfully, and logs Prepared -> Marked Sent -> Staff Note', async () => {
      const targetDate = getFutureDateIso(9);
      const { requestAdapter } = setupLinkedInMemoryAdapters([
        {
          id: 'req_WA01',
          requestReference: 'REQ-WA000001',
          requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
          status: BOOKING_REQUEST_STATUS.IN_REVIEW,
          customerName: 'Nadia Vocal',
          bandName: 'Velvet Tone',
          contactPhone: '+6281234567890',
          publicServiceId: 'rehearsal',
          serviceLabelSnapshot: 'Rehearsal',
          requestedRoomId: 'room-a',
          preferredDate: targetDate,
          preferredStartMinute: 1140,
          preferredDurationMinutes: 120,
          privacyConsent: true,
          version: 1,
          createdAt: '2026-11-22T05:00:00.000Z',
        },
      ]);

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const user = userEvent.setup();

      render(
        <AuthContext.Provider value={buildAuthValue({ role: 'staff', uid: 'staff-wa-1' })}>
          <MemoryRouter initialEntries={['/admin/booking-requests?requestId=req_WA01']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const templateSelect = await screen.findByLabelText(/pilih template pesan internal/i);
      const confirmedOption = within(templateSelect).getByRole('option', {
        name: /booking confirmed/i,
      });
      expect(confirmedOption.disabled).toBe(true);

      const editor = screen.getByLabelText(/preview & edit pesan whatsapp/i);
      expect(editor.value).toContain('Nadia Vocal');
      expect(editor.value).toContain('REQ-WA000001');

      const openBtn = screen.getByRole('button', { name: /open whatsapp with message/i });
      expect(openBtn.disabled).toBe(false);

      // Typing unresolved placeholder blocks OPEN WHATSAPP WITH MESSAGE
      fireEvent.change(editor, { target: { value: 'Halo Nadia {customBrokenVar}' } });
      expect(await screen.findByTestId('whatsapp-unresolved-vars-warning')).toBeTruthy();
      expect(openBtn.disabled).toBe(true);

      await user.click(screen.getByRole('button', { name: /reset ke template/i }));
      expect(openBtn.disabled).toBe(false);

      await user.click(openBtn);

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledTimes(1);
      });
      expect(openSpy.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
      expect(openSpy.mock.calls[0][1]).toBe('_blank');
      expect(openSpy.mock.calls[0][2]).toBe('noopener,noreferrer');

      // Truthful UI state: Prepared in WhatsApp, NEVER Delivered!
      expect(await screen.findByText('Prepared in WhatsApp')).toBeTruthy();
      expect(screen.queryByText(/delivered/i)).toBeNull();

      await user.click(screen.getByRole('button', { name: /^mark as sent$/i }));
      expect(await screen.findByText('Manually marked sent')).toBeTruthy();

      await user.type(
        screen.getByLabelText(/catatan internal staff/i),
        'Customer minta jadwal jam 19:00.',
      );
      await user.click(screen.getByRole('button', { name: /simpan catatan/i }));

      await waitFor(() => {
        const comms = Array.from(requestAdapter._inspectState().communications.values()).filter(
          (c) => c.requestId === 'req_WA01',
        );
        expect(comms).toHaveLength(3);
        const eventTypes = comms.map((c) => c.eventType);
        expect(eventTypes).toContain(BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED);
        expect(eventTypes).toContain(BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT);
        expect(eventTypes).toContain(BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED);
      });
    });

    it('allows Owner to create/edit/restore WhatsApp templates and blocks Staff mutations cleanly', async () => {
      const { templateAdapter } = setupLinkedInMemoryAdapters();

      // Service-level Staff denial
      await expect(
        saveWhatsAppTemplate({
          actorUid: 'staff-1',
          actorRole: 'staff',
          templateInput: {
            label: 'Staff Blocked',
            category: 'follow_up',
            body: 'Halo {customerName}, tidak diizinkan.',
          },
          adapter: templateAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/template-forbidden' });

      // Staff UI hides Kelola Template WhatsApp
      render(
        <AuthContext.Provider value={buildAuthValue({ role: 'staff', uid: 'staff-1' })}>
          <MemoryRouter initialEntries={['/admin/booking-requests']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await screen.findByRole('heading', { name: /incoming booking requests/i });
      expect(screen.queryByRole('button', { name: /kelola template whatsapp/i })).toBeNull();

      cleanup();

      // Owner UI manages templates and restores default
      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={buildAuthValue({ role: 'owner', uid: 'owner-1' })}>
          <MemoryRouter initialEntries={['/admin/booking-requests']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      await user.click(await screen.findByRole('button', { name: /kelola template whatsapp/i }));
      const dialog = await screen.findByRole('dialog', {
        name: /kelola template pesan whatsapp/i,
      });

      await user.click(within(dialog).getByRole('button', { name: /buat template baru/i }));
      await user.type(within(dialog).getByLabelText(/nama template/i), 'Promo Studio Weekend');
      await user.click(within(dialog).getByRole('button', { name: /simpan template/i }));

      expect(await within(dialog).findByText('Promo Studio Weekend')).toBeTruthy();

      await restoreDefaultWhatsAppTemplate({
        actorUid: 'owner-1',
        actorRole: 'owner',
        templateId: 'request_received',
        adapter: templateAdapter,
      });
    });
  });

  describe('Group 5 — Admin Inbox, Sidebar Badge (9+ Cap) & Controlled Status Transitions', () => {
    it('displays bounded 9+ sidebar badge on AdminLayout and clears/decrements as requests move out of new', async () => {
      const targetDate = getFutureDateIso(5);
      const twelveNew = Array.from({ length: 12 }, (_, idx) => ({
        id: `req_BADGE_${String(idx + 1).padStart(2, '0')}`,
        requestReference: `REQ-BADGE${String(idx + 1).padStart(2, '0')}`,
        requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
        status: BOOKING_REQUEST_STATUS.NEW,
        customerName: `Customer ${idx + 1}`,
        contactPhone: `+6281200000${String(idx + 10).padStart(2, '0')}`,
        publicServiceId: 'rehearsal',
        serviceLabelSnapshot: 'Rehearsal',
        requestedRoomId: 'room-a',
        preferredDate: targetDate,
        preferredStartMinute: 960,
        preferredDurationMinutes: 120,
        privacyConsent: true,
        version: 1,
        createdAt: `2026-11-22T0${Math.min(9, idx)}:${String(idx * 3).padStart(2, '0')}:00.000Z`,
      }));

      const { requestAdapter } = setupLinkedInMemoryAdapters(twelveNew);
      const user = userEvent.setup();

      render(
        <AuthContext.Provider value={buildAuthValue({ role: 'owner', uid: 'owner-inbox-1' })}>
          <MemoryRouter initialEntries={['/admin/booking-requests']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      const bookingReqLink = await screen.findByRole('link', { name: /booking requests/i });
      expect(within(bookingReqLink).getByText('9+')).toBeTruthy();

      // Open a row and walk controlled status lifecycle: new -> in_review -> accepted -> declined
      await user.click(await screen.findByTestId('booking-request-row-req_BADGE_01'));
      const drawer = await screen.findByRole('dialog');

      await user.click(within(drawer).getByRole('button', { name: /mark in review/i }));
      await waitFor(() => {
        expect(requestAdapter._inspectState().requests.get('req_BADGE_01')?.status).toBe(
          BOOKING_REQUEST_STATUS.IN_REVIEW,
        );
      });

      await user.click(within(drawer).getByRole('button', { name: /accept request/i }));
      expect(await within(drawer).findByText(/accepted ≠ confirmed/i)).toBeTruthy();
      expect(
        within(drawer).getByTestId('convert-to-calendar-booking-link').getAttribute('href'),
      ).toBe('/admin/calendar?action=new-booking&requestId=req_BADGE_01');

      await user.click(within(drawer).getByRole('button', { name: /decline request/i }));
      await user.type(within(drawer).getByLabelText(/alasan penolakan/i), 'Jadwal sudah penuh.');
      await user.click(within(drawer).getByRole('button', { name: /konfirmasi decline/i }));

      await waitFor(() => {
        expect(requestAdapter._inspectState().requests.get('req_BADGE_01')?.status).toBe(
          BOOKING_REQUEST_STATUS.DECLINED,
        );
      });
    });

    it('rejects direct manual status transition to confirmed outside canonical createBooking transaction', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters([
        {
          id: 'req_GUARD_CONF',
          requestReference: 'REQ-GUARD001',
          requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
          status: BOOKING_REQUEST_STATUS.ACCEPTED,
          customerName: 'Rafi',
          contactPhone: '+6281234567890',
          publicServiceId: 'rehearsal',
          serviceLabelSnapshot: 'Rehearsal',
          requestedRoomId: 'room-a',
          preferredDate: getFutureDateIso(3),
          preferredStartMinute: 960,
          preferredDurationMinutes: 120,
          privacyConsent: true,
          version: 1,
          createdAt: '2026-11-22T08:00:00.000Z',
        },
      ]);

      await expect(
        transitionBookingRequestStatus({
          requestId: 'req_GUARD_CONF',
          expectedVersion: 1,
          nextStatus: BOOKING_REQUEST_STATUS.CONFIRMED,
          actorUid: 'owner-1',
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/invalid-transition' });
    });
  });

  describe('Group 6 — Reliability (Empty, Error + Retry, Pagination, Unmount Cleanup, Optimistic Concurrency)', () => {
    it('handles empty state, error retry, pagination loadMore, truncation notice, and listener cleanup on unmount', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters([]);
      const user = userEvent.setup();

      const { unmount } = render(
        <AuthContext.Provider value={buildAuthValue()}>
          <MemoryRouter initialEntries={['/admin/booking-requests']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect(await screen.findByText('Belum ada booking request masuk')).toBeTruthy();
      unmount();

      // Seed 55 requests to exercise default 50-item cap + truncation banner + loadMore
      const fiftyFive = Array.from({ length: 55 }, (_, i) => ({
        id: `req_PAGE_${String(i + 1).padStart(2, '0')}`,
        requestReference: `REQ-PAGE${String(i + 1).padStart(2, '0')}`,
        requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
        status: BOOKING_REQUEST_STATUS.IN_REVIEW,
        customerName: `Mix Client ${String(i + 1).padStart(2, '0')}`,
        contactPhone: '+6281234567890',
        publicServiceId: 'mix-master',
        serviceLabelSnapshot: 'Mix & Master',
        privacyConsent: true,
        version: 1,
        createdAt: `2026-11-${String(Math.max(1, 22 - Math.floor(i / 4))).padStart(2, '0')}T10:00:00.000Z`,
      }));
      requestAdapter._seedRequests(fiftyFive);

      const unsubListSpy = vi.fn();
      const origSubscribe = requestAdapter.subscribeBookingRequests;
      let failOnce = true;
      vi.spyOn(requestAdapter, 'subscribeBookingRequests').mockImplementation((opts) => {
        if (failOnce) {
          failOnce = false;
          queueMicrotask(() => opts.onError?.(new Error('Koneksi inbox terputus.')));
          return unsubListSpy;
        }
        const realUnsub = origSubscribe(opts);
        return () => {
          unsubListSpy();
          realUnsub();
        };
      });

      const view = render(
        <AuthContext.Provider value={buildAuthValue()}>
          <MemoryRouter initialEntries={['/admin/booking-requests']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthContext.Provider>,
      );

      expect(await screen.findByText('Koneksi inbox terputus.')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /coba lagi/i }));

      expect(await screen.findByText(/menampilkan maksimal 50 request terbaru/i)).toBeTruthy();
      const loadMoreBtn = screen.getByRole('button', { name: /muat request berikutnya/i });
      await user.click(loadMoreBtn);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /muat request berikutnya/i })).toBeNull();
      });

      view.unmount();
      expect(unsubListSpy).toHaveBeenCalled();
    });

    it('enforces optimistic concurrency version checks and maps network errors cleanly', async () => {
      const { requestAdapter } = setupLinkedInMemoryAdapters([
        {
          id: 'req_CONC01',
          requestReference: 'REQ-CONC0001',
          requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
          status: BOOKING_REQUEST_STATUS.NEW,
          customerName: 'Tono',
          contactPhone: '+6281234567890',
          publicServiceId: 'mix-master',
          serviceLabelSnapshot: 'Mix & Master',
          privacyConsent: true,
          version: 1,
          createdAt: '2026-11-22T09:00:00.000Z',
        },
      ]);

      const updated = await transitionBookingRequestStatus({
        requestId: 'req_CONC01',
        expectedVersion: 1,
        nextStatus: BOOKING_REQUEST_STATUS.IN_REVIEW,
        actorUid: 'owner-1',
        adapter: requestAdapter,
      });
      expect(updated.version).toBe(2);

      // Stale expectedVersion=1 rejected cleanly
      await expect(
        transitionBookingRequestStatus({
          requestId: 'req_CONC01',
          expectedVersion: 1,
          nextStatus: BOOKING_REQUEST_STATUS.ACCEPTED,
          actorUid: 'owner-2',
          adapter: requestAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking-request/stale-update' });

      expect(mapBookingRequestErrorToMessage({ code: 'unavailable' })).toMatch(
        /network connection interrupted/i,
      );
    });
  });
});
