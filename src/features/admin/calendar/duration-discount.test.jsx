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
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import { validateServiceOptionForm } from '@/features/admin/settings/pricing/schemas/pricing-settings-schema';
import { savePricingSettings } from '@/features/admin/settings/pricing/services/pricing-settings-service';
import { calculateDurationAutomaticDiscount } from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';
import { clonePricingSettings } from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import { INITIAL_PAYMENT_STATUS } from './config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from './repositories/calendar-booking-repository';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  updateOrRescheduleBooking,
} from './services/calendar-booking-service';
import {
  calculateBookingPricingSnapshot,
  extractBookingFinancialSnapshot,
} from './utils/booking-pricing';
import { getJakartaTodayIso } from './utils/calendar-date';

function mockAuthenticatedUser(
  role = 'owner',
  uid = role === 'owner' ? 'owner-uid-1' : 'staff-uid-2',
) {
  const displayName = role === 'owner' ? '37 Music Studio Owner' : 'Rina Studio Operator';
  const email = role === 'owner' ? 'owner@37studio.com' : 'operator@37studio.com';

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

function renderAppAt(initialEntry = '/admin/calendar') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function withRehearsalRegularOverride(overrides = {}) {
  const cloned = clonePricingSettings(DEFAULT_PRICING_SETTINGS);
  cloned.serviceTypes = cloned.serviceTypes.map((svc) =>
    svc.id === 'rehearsal'
      ? {
          ...svc,
          options: svc.options.map((opt) =>
            opt.id === 'rehearsal-regular'
              ? {
                  ...opt,
                  ...overrides,
                  pricing: {
                    ...opt.pricing,
                    ...(overrides.pricing || {}),
                  },
                }
              : opt,
          ),
        }
      : svc,
  );
  return cloned;
}

describe('Duration-Based Automatic Discount (Catalog V2 Integrated)', () => {
  let pricingAdapter;
  let bookingAdapter;
  const todayIso = getJakartaTodayIso();

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();
    pricingAdapter = createInMemoryPricingSettingsAdapter();
    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    setPricingSettingsRepositoryAdapter(pricingAdapter);
    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(createInMemoryCustomerRepositoryAdapter(bookingAdapter));
  });

  afterEach(() => {
    cleanup();
    resetPricingSettingsRepositoryAdapter();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
  });

  describe('1. Domain Calculator & Business Rules', () => {
    it.each([
      { durationMinutes: 60, expectedBlocks: 0, expectedDiscount: 0 },
      { durationMinutes: 120, expectedBlocks: 0, expectedDiscount: 0 },
      { durationMinutes: 180, expectedBlocks: 1, expectedDiscount: 30000 },
      { durationMinutes: 240, expectedBlocks: 1, expectedDiscount: 30000 },
      { durationMinutes: 300, expectedBlocks: 1, expectedDiscount: 30000 },
      { durationMinutes: 360, expectedBlocks: 2, expectedDiscount: 60000 },
      { durationMinutes: 420, expectedBlocks: 2, expectedDiscount: 60000 },
      { durationMinutes: 540, expectedBlocks: 3, expectedDiscount: 90000 },
    ])(
      'computes exact automatic duration discount for $durationMinutes minutes -> Rp $expectedDiscount',
      ({ durationMinutes, expectedBlocks, expectedDiscount }) => {
        const snapshot = calculateBookingPricingSnapshot({
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'rehearsal-regular',
          durationMinutes,
          pricingSettings: DEFAULT_PRICING_SETTINGS,
        });

        const expectedSubtotal = (100000 * durationMinutes) / 60;
        expect(snapshot.subtotal).toBe(expectedSubtotal);
        expect(snapshot.discountAmount).toBe(expectedDiscount);
        expect(snapshot.totalAmount).toBe(expectedSubtotal - expectedDiscount);

        if (expectedDiscount > 0) {
          expect(snapshot.appliedDiscountName).toBe('Diskon Durasi');
          expect(snapshot.automaticDiscount).toEqual({
            type: 'duration_multiple',
            intervalMinutes: 180,
            eligibleBlocks: expectedBlocks,
            discountPerBlock: 30000,
            totalDiscount: expectedDiscount,
          });
        } else {
          expect(snapshot.appliedDiscountName).toBe('');
          expect(snapshot.automaticDiscount).toBeNull();
        }
      },
    );

    it('matches the 5-hour Rp 50.000/jam example (Rp 250.000 - Rp 30.000 = Rp 220.000)', () => {
      const settings50k = withRehearsalRegularOverride({
        pricing: { mode: PRICING_MODES.HOURLY, hourlyRate: 50000 },
      });

      const snapshot = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 300,
        pricingSettings: settings50k,
      });

      expect(snapshot.subtotal).toBe(250000);
      expect(snapshot.discountAmount).toBe(30000);
      expect(snapshot.totalAmount).toBe(220000);
      expect(snapshot.automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 1,
        discountPerBlock: 30000,
        totalDiscount: 30000,
      });
    });

    it('grants Rp 0 discount when duration discount rules are disabled on the subcategory', () => {
      const disabledRehearsalSettings = withRehearsalRegularOverride({
        discountRules: [
          {
            id: 'disc-rehearsal-regular-3h',
            name: 'Diskon Durasi',
            mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
            intervalMinutes: 180,
            minimumDurationMinutes: 0,
            discountAmount: 30000,
            isActive: false,
          },
        ],
      });

      const rehearsal6h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 360,
        pricingSettings: disabledRehearsalSettings,
      });
      expect(rehearsal6h.subtotal).toBe(600000);
      expect(rehearsal6h.discountAmount).toBe(0);
      expect(rehearsal6h.totalAmount).toBe(600000);
      expect(rehearsal6h.automaticDiscount).toBeNull();

      // Recording Tracking Reguler has no duration discount rules by default
      const tracking6h = calculateBookingPricingSnapshot({
        serviceTypeId: 'recording',
        serviceOptionId: 'tracking-regular',
        durationMinutes: 360,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(tracking6h.discountAmount).toBe(0);
      expect(tracking6h.automaticDiscount).toBeNull();
    });

    it('never allows final price to become negative and caps discount at subtotal', () => {
      const lowRateSettings = withRehearsalRegularOverride({
        pricing: { mode: PRICING_MODES.HOURLY, hourlyRate: 5000 },
      });

      const snapshot = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 180,
        pricingSettings: lowRateSettings,
      });

      expect(snapshot.subtotal).toBe(15000);
      expect(snapshot.discountAmount).toBe(15000);
      expect(snapshot.totalAmount).toBe(0);
      expect(snapshot.automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 1,
        discountPerBlock: 30000,
        totalDiscount: 15000,
      });
    });

    it('rejects invalid discount rule interval/amount configurations and safely ignores invalid values in domain calculator', async () => {
      expect(
        calculateDurationAutomaticDiscount({
          durationMinutes: 360,
          subtotal: 600000,
          durationDiscount: { enabled: true, intervalMinutes: 0, discountAmount: 30000 },
        }).discountAmount,
      ).toBe(0);

      expect(
        calculateDurationAutomaticDiscount({
          durationMinutes: 360,
          subtotal: 600000,
          durationDiscount: { enabled: true, intervalMinutes: -180, discountAmount: 30000 },
        }).discountAmount,
      ).toBe(0);

      expect(
        calculateDurationAutomaticDiscount({
          durationMinutes: 360,
          subtotal: 600000,
          durationDiscount: { enabled: true, intervalMinutes: 180, discountAmount: 30000.5 },
        }).discountAmount,
      ).toBe(0);

      const invalidInterval = validateServiceOptionForm(
        {
          id: 'rehearsal-regular',
          name: 'Reguler',
          description: 'Latihan',
          isActive: true,
          sortOrder: 1,
          pricing: {
            mode: PRICING_MODES.HOURLY,
            hourlyRate: 100000,
            durationMinutes: null,
            basePrice: null,
            discountAmount: 0,
            projectPrice: null,
            unitLabel: '',
          },
          discountRules: [
            {
              id: 'disc-bad-interval',
              name: 'Bad Interval',
              mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
              intervalMinutes: 0,
              minimumDurationMinutes: 0,
              discountAmount: 30000,
              isActive: true,
            },
          ],
          fees: {
            staff: { mode: 'none', amount: 0 },
            owner: { mode: 'none', amount: 0 },
            recordingOperator: { mode: 'none', amount: 0 },
          },
        },
        DELIVERY_MODES.STUDIO,
      );
      expect(invalidInterval.isValid).toBe(false);

      const invalidSettings = withRehearsalRegularOverride({
        discountRules: [
          {
            id: 'disc-bad-interval',
            name: 'Bad Interval',
            mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
            intervalMinutes: 0,
            minimumDurationMinutes: 0,
            discountAmount: 30000,
            isActive: true,
          },
        ],
      });

      await expect(
        savePricingSettings({
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          expectedVersion: 0,
          adapter: pricingAdapter,
          settings: invalidSettings,
        }),
      ).rejects.toMatchObject({ code: 'pricing/validation-error' });
    });

    it('preserves existing Fixed Shift packages and Fixed Shift recording pricing without double discounting', () => {
      // Fixed Shift package (Paket 3 Hours) uses ONLY its own discount (30k)
      const pkg3h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'pkg-rehearsal-3h',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(pkg3h.subtotal).toBe(300000);
      expect(pkg3h.discountAmount).toBe(30000);
      expect(pkg3h.totalAmount).toBe(270000);
      expect(pkg3h.automaticDiscount).toBeNull();

      // Fixed Shift package (Paket 5 Hours)
      const pkg5h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'pkg-rehearsal-5h',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(pkg5h.subtotal).toBe(500000);
      expect(pkg5h.discountAmount).toBe(50000);
      expect(pkg5h.totalAmount).toBe(450000);
      expect(pkg5h.automaticDiscount).toBeNull();

      // Fixed Shift recording (Live 3h & Multitrack Shift 6h) must NOT be altered
      const fixedRec3h = calculateBookingPricingSnapshot({
        serviceTypeId: 'recording',
        serviceOptionId: 'live-recording-3h',
        durationMinutes: 180,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(fixedRec3h.subtotal).toBe(420000);
      expect(fixedRec3h.discountAmount).toBe(0);
      expect(fixedRec3h.totalAmount).toBe(420000);
      expect(fixedRec3h.automaticDiscount).toBeNull();

      const fixedRec6h = calculateBookingPricingSnapshot({
        serviceTypeId: 'recording',
        serviceOptionId: 'multitrack-shift-6h',
        durationMinutes: 360,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(fixedRec6h.subtotal).toBe(800000);
      expect(fixedRec6h.discountAmount).toBe(0);
      expect(fixedRec6h.totalAmount).toBe(800000);
      expect(fixedRec6h.automaticDiscount).toBeNull();
    });
  });

  describe('2. Booking Snapshot Persistence, Historical Immutability & Finance Consistency', () => {
    it('persists automaticDiscount snapshot on create, ignores UI-tampered discount values, keeps historical snapshots immutable after settings changes, and exposes identical figures to Finance', async () => {
      const created = await createBooking({
        bookingId: 'bkg-auto-disc-5h',
        eventId: 'evt-auto-disc-5h',
        actorUid: 'staff-uid-2',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
        formValues: {
          customerName: 'Bima Satria',
          phone: '081234567890',
          bandName: 'Pulse 37',
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'rehearsal-regular',
          studioId: 'room-a',
          date: todayIso,
          startMinute: 600,
          durationPreset: '300', // 5 hours
          customDurationMinutes: '300',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
          dpAmount: '100000',
          paymentMethod: 'transfer',
          notes: 'Latihan 5 jam reguler',
          // Attempted UI tampering must be ignored by domain service
          discountAmount: 499000,
          totalAmount: 1000,
          automaticDiscount: {
            type: 'duration_multiple',
            intervalMinutes: 60,
            eligibleBlocks: 5,
            discountPerBlock: 99000,
            totalDiscount: 495000,
          },
        },
        adapter: bookingAdapter,
      });

      expect(created.subtotal).toBe(500000);
      expect(created.discountAmount).toBe(30000);
      expect(created.totalAmount).toBe(470000);
      expect(created.automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 1,
        discountPerBlock: 30000,
        totalDiscount: 30000,
      });

      // Owner subsequently changes Rehearsal Reguler rate & disables duration discount
      const updatedSettings = await savePricingSettings({
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        expectedVersion: 0,
        adapter: pricingAdapter,
        settings: withRehearsalRegularOverride({
          pricing: { mode: PRICING_MODES.HOURLY, hourlyRate: 150000 },
          discountRules: [],
        }),
      });

      // Stored historical booking remains completely unaffected
      const storedAfterSettingsChange = bookingAdapter._inspectState().bookings.get(created.id);
      const financeSnapshot = extractBookingFinancialSnapshot(storedAfterSettingsChange);
      expect(financeSnapshot).toEqual({
        subtotal: 500000,
        discountAmount: 30000,
        automaticDiscount: {
          type: 'duration_multiple',
          intervalMinutes: 180,
          eligibleBlocks: 1,
          discountPerBlock: 30000,
          totalDiscount: 30000,
        },
        totalAmount: 470000,
        finalPrice: 470000,
        initialPaidAmount: 100000,
        remainingBalance: 370000,
      });

      // Rescheduling to Room B at 12:00 keeps original historical automaticDiscount snapshot intact
      const rescheduled = await updateOrRescheduleBooking({
        bookingId: created.id,
        expectedVersion: created.version,
        actorUid: 'staff-uid-2',
        mode: 'reschedule',
        pricingSettings: updatedSettings,
        formValues: {
          customerName: created.customerName,
          phone: created.phone,
          bandName: created.bandName,
          serviceTypeId: created.serviceTypeId,
          serviceOptionId: created.serviceOptionId,
          studioId: 'room-b',
          date: todayIso,
          startMinute: 720,
          durationPreset: '300',
          customDurationMinutes: '300',
          notes: 'Pindah ke Room B',
        },
        adapter: bookingAdapter,
      });

      expect(rescheduled.studioId).toBe('room-b');
      expect(rescheduled.subtotal).toBe(500000);
      expect(rescheduled.discountAmount).toBe(30000);
      expect(rescheduled.totalAmount).toBe(470000);
      expect(rescheduled.automaticDiscount).toEqual(created.automaticDiscount);
    });
  });

  describe('3. Booking Form UI Reactivity & Booking Detail Drawer Integration', () => {
    it('recalculates Diskon Durasi live when changing duration presets, end time, or service without page reload, hides discount row when Rp 0, and saves snapshot', async () => {
      const user = userEvent.setup();
      // Operator (Staff) can create Studio bookings and receives automatic duration discount
      mockAuthenticatedUser('staff', 'staff-uid-2');

      renderAppAt('/admin/calendar');
      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      await user.click(screen.getByRole('button', { name: /new booking/i }));
      const modal = await screen.findByRole('dialog', { name: /tambah booking/i });

      // Default 1 Jam (60 min) -> Diskon Durasi row is hidden when discount is 0, info note is visible
      expect(within(modal).queryByText(/^Diskon Durasi$/)).toBeNull();
      expect(within(modal).getByText(/berlaku setiap kelipatan/i)).toBeTruthy();
      expect(within(modal).getByText('Harga Normal')).toBeTruthy();
      expect(within(modal).getByText('Total Pembayaran')).toBeTruthy();

      // Switch duration to 5 Jam -> Harga Normal Rp 500.000, Diskon Durasi -Rp 30.000, Total Pembayaran Rp 470.000
      await user.click(within(modal).getByRole('button', { name: '5 Jam' }));
      expect(within(modal).getByText('Diskon Durasi')).toBeTruthy();
      expect(within(modal).getAllByText(/Rp\s*500\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/-Rp\s*30\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Rp\s*470\.000/).length).toBeGreaterThan(0);

      // Switch duration to 6 Jam -> Diskon Durasi -Rp 60.000, Total Pembayaran Rp 540.000
      await user.click(within(modal).getByRole('button', { name: '6 Jam' }));
      expect(within(modal).getAllByText(/-Rp\s*60\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Rp\s*540\.000/).length).toBeGreaterThan(0);

      // Change Jam Selesai from 16:00 (960) to 12:00 (720 -> 2 hours from 10:00) -> discount disappears
      const endTimeSelect = within(modal).getByLabelText(/jam selesai/i);
      fireEvent.change(endTimeSelect, { target: { value: '720' } });
      expect(within(modal).queryByText(/^Diskon Durasi$/)).toBeNull();
      expect(within(modal).getAllByText(/Rp\s*200\.000/).length).toBeGreaterThan(0);

      // Change Jam Selesai to 15:00 (900 -> 5 hours from 10:00) -> Diskon Durasi -Rp 30.000 returns
      fireEvent.change(endTimeSelect, { target: { value: '900' } });
      expect(within(modal).getByText('Diskon Durasi')).toBeTruthy();
      expect(within(modal).getAllByText(/Rp\s*470\.000/).length).toBeGreaterThan(0);

      // Switch Service to Recording (Tracking Reguler has no duration discount) -> Diskon Durasi disappears
      const serviceGroup = within(modal).getByRole('group', { name: /pilih layanan studio/i });
      // WFA services (Mixing / Mastering) MUST NOT appear in Studio Booking Form
      expect(within(serviceGroup).queryByRole('button', { name: /mixing/i })).toBeNull();
      expect(within(serviceGroup).queryByRole('button', { name: /mastering/i })).toBeNull();

      await user.click(within(serviceGroup).getByRole('button', { name: /recording/i }));
      expect(within(modal).queryByText(/^Diskon Durasi$/)).toBeNull();

      // Switch back to Rehearsal (5 Jam) and submit booking
      await user.click(within(serviceGroup).getByRole('button', { name: /rehearsal/i }));
      expect(within(modal).getByText('Diskon Durasi')).toBeTruthy();

      fireEvent.change(within(modal).getByLabelText(/nama customer/i), {
        target: { value: 'Rendra Pratama' },
      });
      fireEvent.change(within(modal).getByLabelText(/nomor hp \/ whatsapp/i), {
        target: { value: '081344556677' },
      });
      await user.click(within(modal).getByRole('button', { name: /simpan booking/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
      });

      const savedBookings = Array.from(bookingAdapter._inspectState().bookings.values());
      expect(savedBookings).toHaveLength(1);
      expect(savedBookings[0].subtotal).toBe(500000);
      expect(savedBookings[0].discountAmount).toBe(30000);
      expect(savedBookings[0].totalAmount).toBe(470000);
      expect(savedBookings[0].automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 1,
        discountPerBlock: 30000,
        totalDiscount: 30000,
      });

      // Open Booking Detail Drawer and confirm persisted Diskon Durasi is displayed
      const upcomingSection = screen.getByRole('region', { name: /upcoming bookings/i });
      await user.click(
        await within(upcomingSection).findByRole('button', {
          name: /detail booking rendra pratama/i,
        }),
      );
      const drawer = await screen.findByRole('dialog', { name: /rendra pratama/i });
      expect(within(drawer).getByText('Harga Normal')).toBeTruthy();
      expect(within(drawer).getByText('Diskon Durasi')).toBeTruthy();
      expect(within(drawer).getByText(/^-Rp\s*30\.000$/)).toBeTruthy();
      expect(within(drawer).getByText(/1x kelipatan 3 jam/i)).toBeTruthy();
      expect(within(drawer).getAllByText(/Rp\s*470\.000/).length).toBeGreaterThan(0);
    });
  });

  describe('4. Owner vs Staff/Operator Authorization & Firestore Rules Contract', () => {
    it('enforces Owner-only settings writes and booking automaticDiscount math & immutability in firestore.rules', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      expect(rulesContent).toContain('function isActiveOwner()');
      expect(rulesContent).toContain('allow create: if isActiveOwner()');
      expect(rulesContent).toContain('allow update: if isActiveOwner()');
      expect(rulesContent).toContain("'automaticDiscount'");
      expect(rulesContent).toContain('function isValidBookingAutomaticDiscountShape(data)');
      expect(rulesContent).toContain('function isBookingAutomaticDiscountMathMatched(data)');
      expect(rulesContent).toContain('data.discountAmount <= data.subtotal');
      expect(rulesContent).toContain('data.totalAmount == data.subtotal - data.discountAmount');
      expect(rulesContent).toContain(
        "reqData.get('automaticDiscount', null) == resData.get('automaticDiscount', null)",
      );
    });
  });
});
