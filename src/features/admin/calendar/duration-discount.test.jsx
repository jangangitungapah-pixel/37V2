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
import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import { validateSessionTypeForm } from '@/features/admin/settings/pricing/schemas/pricing-settings-schema';
import { savePricingSettings } from '@/features/admin/settings/pricing/services/pricing-settings-service';
import { calculateDurationAutomaticDiscount } from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';

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

describe('Duration-Based Automatic Discount', () => {
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
  });

  afterEach(() => {
    cleanup();
    resetPricingSettingsRepositoryAdapter();
    resetBookingRepositoryAdapter();
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
          serviceId: 'rehearsal',
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
      const settings50k = {
        ...DEFAULT_PRICING_SETTINGS,
        sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
          s.id === 'rehearsal'
            ? {
                ...s,
                hourlyRate: 50000,
                durationDiscount: {
                  enabled: true,
                  intervalMinutes: 180,
                  discountAmount: 30000,
                },
              }
            : s,
        ),
      };

      const snapshot = calculateBookingPricingSnapshot({
        serviceId: 'rehearsal',
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

    it('grants Rp 0 discount when duration discount is disabled on the service', () => {
      const disabledRehearsalSettings = {
        ...DEFAULT_PRICING_SETTINGS,
        sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
          s.id === 'rehearsal'
            ? {
                ...s,
                durationDiscount: {
                  enabled: false,
                  intervalMinutes: 180,
                  discountAmount: 30000,
                },
              }
            : s,
        ),
      };

      const rehearsal6h = calculateBookingPricingSnapshot({
        serviceId: 'rehearsal',
        durationMinutes: 360,
        pricingSettings: disabledRehearsalSettings,
      });
      expect(rehearsal6h.subtotal).toBe(600000);
      expect(rehearsal6h.discountAmount).toBe(0);
      expect(rehearsal6h.totalAmount).toBe(600000);
      expect(rehearsal6h.automaticDiscount).toBeNull();

      // Mixing is disabled by default
      const mixing6h = calculateBookingPricingSnapshot({
        serviceId: 'mixing',
        durationMinutes: 360,
        pricingSettings: DEFAULT_PRICING_SETTINGS,
      });
      expect(mixing6h.discountAmount).toBe(0);
      expect(mixing6h.automaticDiscount).toBeNull();
    });

    it('never allows final price to become negative and caps discount at subtotal', () => {
      const lowRateSettings = {
        ...DEFAULT_PRICING_SETTINGS,
        sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
          s.id === 'rehearsal'
            ? {
                ...s,
                hourlyRate: 5000,
                durationDiscount: {
                  enabled: true,
                  intervalMinutes: 180,
                  discountAmount: 30000,
                },
              }
            : s,
        ),
      };

      const snapshot = calculateBookingPricingSnapshot({
        serviceId: 'rehearsal',
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

    it('rejects invalid durationDiscount interval/amount configurations and safely ignores invalid values in domain calculator', async () => {
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

      const invalidInterval = validateSessionTypeForm({
        id: 'rehearsal',
        name: 'Rehearsal',
        description: 'Latihan',
        hourlyRate: 100000,
        durationDiscount: { enabled: true, intervalMinutes: 0, discountAmount: 30000 },
        isActive: true,
        sortOrder: 1,
      });
      expect(invalidInterval.isValid).toBe(false);
      expect(invalidInterval.errors['durationDiscount.intervalMinutes']).toBeTruthy();

      const invalidFloatAmount = validateSessionTypeForm({
        id: 'rehearsal',
        name: 'Rehearsal',
        description: 'Latihan',
        hourlyRate: 100000,
        durationDiscount: { enabled: true, intervalMinutes: 180, discountAmount: 15000.5 },
        isActive: true,
        sortOrder: 1,
      });
      expect(invalidFloatAmount.isValid).toBe(false);
      expect(invalidFloatAmount.errors['durationDiscount.discountAmount']).toBeTruthy();

      await expect(
        savePricingSettings({
          actorUid: 'owner-uid-1',
          actorRole: 'owner',
          expectedVersion: 0,
          adapter: pricingAdapter,
          settings: {
            ...DEFAULT_PRICING_SETTINGS,
            sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
              s.id === 'rehearsal'
                ? {
                    ...s,
                    durationDiscount: {
                      enabled: true,
                      intervalMinutes: 0,
                      discountAmount: 30000,
                    },
                  }
                : s,
            ),
          },
        }),
      ).rejects.toMatchObject({ code: 'pricing/validation-error' });
    });

    it('preserves existing package pricing and fixed-session recording pricing without double discounting', () => {
      const settingsWithRecordingDurationDiscount = {
        ...DEFAULT_PRICING_SETTINGS,
        sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
          s.id === 'recording'
            ? {
                ...s,
                durationDiscount: {
                  enabled: true,
                  intervalMinutes: 180,
                  discountAmount: 30000,
                },
              }
            : s,
        ),
      };

      // Package pricing (Paket Rehearsal 3 Jam) must NOT double-discount
      const pkg3h = calculateBookingPricingSnapshot({
        packageId: 'pkg-rehearsal-3h',
        pricingSettings: settingsWithRecordingDurationDiscount,
      });
      expect(pkg3h.subtotal).toBe(300000);
      expect(pkg3h.discountAmount).toBe(30000);
      expect(pkg3h.totalAmount).toBe(270000);
      expect(pkg3h.automaticDiscount).toBeNull();

      // Package pricing (Paket Rehearsal 5 Jam)
      const pkg5h = calculateBookingPricingSnapshot({
        packageId: 'pkg-rehearsal-5h',
        pricingSettings: settingsWithRecordingDurationDiscount,
      });
      expect(pkg5h.subtotal).toBe(500000);
      expect(pkg5h.discountAmount).toBe(50000);
      expect(pkg5h.totalAmount).toBe(450000);
      expect(pkg5h.automaticDiscount).toBeNull();

      // Fixed-session recording (Live Recording 3 Jam & Multitrack Shift 6 Jam) must NOT be altered
      const fixedRec3h = calculateBookingPricingSnapshot({
        serviceId: 'recording',
        recordingTypeId: 'live-recording-3h',
        durationMinutes: 180,
        pricingSettings: settingsWithRecordingDurationDiscount,
      });
      expect(fixedRec3h.subtotal).toBe(420000);
      expect(fixedRec3h.discountAmount).toBe(0);
      expect(fixedRec3h.totalAmount).toBe(420000);
      expect(fixedRec3h.automaticDiscount).toBeNull();

      const fixedRec6h = calculateBookingPricingSnapshot({
        serviceId: 'recording',
        recordingTypeId: 'multitrack-shift-6h',
        durationMinutes: 360,
        pricingSettings: settingsWithRecordingDurationDiscount,
      });
      expect(fixedRec6h.subtotal).toBe(800000);
      expect(fixedRec6h.discountAmount).toBe(0);
      expect(fixedRec6h.totalAmount).toBe(800000);
      expect(fixedRec6h.automaticDiscount).toBeNull();

      // Regular hourly recording (Tracking Reguler) DOES apply durationDiscount when enabled on Recording
      const hourlyRec6h = calculateBookingPricingSnapshot({
        serviceId: 'recording',
        recordingTypeId: 'tracking-regular',
        durationMinutes: 360,
        pricingSettings: settingsWithRecordingDurationDiscount,
      });
      expect(hourlyRec6h.subtotal).toBe(900000);
      expect(hourlyRec6h.discountAmount).toBe(60000);
      expect(hourlyRec6h.totalAmount).toBe(840000);
      expect(hourlyRec6h.automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 2,
        discountPerBlock: 30000,
        totalDiscount: 60000,
      });
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
          serviceId: 'rehearsal',
          packageId: '',
          recordingTypeId: '',
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

      // Owner subsequently disables/modifies Rehearsal duration discount and hourly rate
      const updatedSettings = await savePricingSettings({
        actorUid: 'owner-uid-1',
        actorRole: 'owner',
        expectedVersion: 0,
        adapter: pricingAdapter,
        settings: {
          ...DEFAULT_PRICING_SETTINGS,
          sessionTypes: DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
            s.id === 'rehearsal'
              ? {
                  ...s,
                  hourlyRate: 150000,
                  durationDiscount: {
                    enabled: false,
                    intervalMinutes: 120,
                    discountAmount: 50000,
                  },
                }
              : s,
          ),
        },
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
          serviceId: created.serviceId,
          packageId: '',
          recordingTypeId: '',
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
      // Operator (Staff) can create bookings and receives automatic duration discount
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

      // Switch Service to Mixing (duration discount disabled) -> Diskon Durasi disappears
      const serviceGroup = within(modal).getByRole('group', { name: /pilih layanan studio/i });
      await user.click(within(serviceGroup).getByRole('button', { name: /mixing/i }));
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
    it('allows Owner to configure and save durationDiscount on a Session Type while restricting Staff/Operator to read-only', async () => {
      const user = userEvent.setup();

      // 1. Staff/Operator cannot modify settings in UI or domain service
      await expect(
        savePricingSettings({
          actorUid: 'staff-uid-2',
          actorRole: 'staff',
          expectedVersion: 0,
          adapter: pricingAdapter,
          settings: DEFAULT_PRICING_SETTINGS,
        }),
      ).rejects.toMatchObject({ code: 'pricing/owner-only' });

      mockAuthenticatedUser('staff', 'staff-uid-2');
      renderAppAt('/admin/settings/price-and-fee');
      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      expect(screen.getByText(/mode baca saja \(staff \/ operator\)/i)).toBeTruthy();
      const staffSessionSection = screen.getByRole('region', { name: /session types/i });
      expect(
        within(staffSessionSection).queryByRole('button', { name: /add session type/i }),
      ).toBeNull();
      const staffEditRehearsalBtns = within(staffSessionSection).getAllByRole('button', {
        name: /edit rehearsal/i,
      });
      expect(staffEditRehearsalBtns[0].disabled).toBe(true);
      const staffSaveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      expect(within(staffSaveBar).getByRole('button', { name: /save changes/i }).disabled).toBe(
        true,
      );

      cleanup();

      // 2. Owner can edit Rehearsal durationDiscount (interval & discount amount) and save
      mockAuthenticatedUser('owner', 'owner-uid-1');
      renderAppAt('/admin/settings/price-and-fee');
      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      const ownerSessionSection = screen.getByRole('region', { name: /session types/i });
      const editRehearsalBtn = within(ownerSessionSection).getAllByRole('button', {
        name: /edit rehearsal/i,
      })[0];
      await user.click(editRehearsalBtn);

      const editDialog = await screen.findByRole('dialog', { name: /edit session type/i });
      const enabledCheckbox = within(editDialog).getByLabelText(/enable duration discount/i);
      expect(enabledCheckbox.checked).toBe(true);

      fireEvent.change(within(editDialog).getByLabelText(/discount interval \(menit\)/i), {
        target: { value: '120' },
      });
      fireEvent.change(within(editDialog).getByLabelText(/discount amount \(idr\)/i), {
        target: { value: '25000' },
      });
      await user.click(within(editDialog).getByRole('button', { name: /update session/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit session type/i })).toBeNull();
      });

      const ownerSaveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      await user.click(within(ownerSaveBar).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(within(ownerSaveBar).getByText(/tersimpan • v1/i)).toBeTruthy();
      });

      const persistedRehearsal = pricingAdapter
        ._getStoredDoc()
        .sessionTypes.find((s) => s.id === 'rehearsal');
      expect(persistedRehearsal.durationDiscount).toEqual({
        enabled: true,
        intervalMinutes: 120,
        discountAmount: 25000,
      });
    });

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
