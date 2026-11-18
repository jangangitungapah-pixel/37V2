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
import { INITIAL_PAYMENT_STATUS } from '@/features/admin/calendar/config/calendar-config';
import {
  normalizeBookingRecord,
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createInMemoryBookingRepositoryAdapter,
  updateOrRescheduleBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
import { calculateBookingPricingSnapshot } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import { DEFAULT_PRICING_SETTINGS } from './pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from './pricing/repositories/pricing-settings-repository';
import { savePricingSettings } from './pricing/services/pricing-settings-service';
import { selectBestSessionDiscount } from './pricing/utils/calculate-pricing-settings';

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

function renderAppAt(initialEntry = '/admin/settings') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Phase 6 — Admin Settings & Price and Fee Configuration', () => {
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

  describe('1. Settings Navigation, UI CRUD, Safe Delete, Unsaved State & Save Behavior', () => {
    it('renders Settings overview at /admin/settings, navigates to /admin/settings/price-and-fee, and keeps Settings active in Sidebar', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/settings');

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Settings' }, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.getByText(/studio configuration and operational presets/i)).toBeTruthy();
      expect(
        screen.getByText(
          /manage studio session rates, packages, discounts, and operational staff fees\./i,
        ),
      ).toBeTruthy();

      const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
      const navLinks = within(sidebarNav).getAllByRole('link');
      expect(navLinks).toHaveLength(8);
      const settingsNavLink = within(sidebarNav).getByRole('link', { name: 'Settings' });
      expect(settingsNavLink.getAttribute('aria-current')).toBe('page');

      // Navigate into /admin/settings/price-and-fee
      const openSubpageLink = screen.getByRole('link', { name: /open price and fee settings/i });
      await user.click(openSubpageLink);

      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      // Breadcrumb & active sidebar link remain on Settings
      const settingsBreadcrumb = screen.getByRole('navigation', { name: /settings breadcrumb/i });
      expect(within(settingsBreadcrumb).getByText('Admin')).toBeTruthy();
      expect(within(settingsBreadcrumb).getByText('Settings')).toBeTruthy();
      expect(within(settingsBreadcrumb).getByText('Price and Fee Settings')).toBeTruthy();
      expect(settingsNavLink.getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();

      // Did not auto-create settings/pricing document on load
      expect(pricingAdapter._getStoredDoc()).toBeNull();
      expect(screen.getByText(/default presets • belum disimpan/i)).toBeTruthy();
    });

    it('supports adding/editing/toggling/deleting Session Types, Recording Options, Packages, Discounts, Operational Fees, safe delete check, and atomic Save / failure recovery', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/settings/price-and-fee');

      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      // 1. Safe Delete Check: Deleting "Rehearsal" session is blocked while active rehearsal packages exist
      const sessionSection = screen.getByRole('region', { name: /session types/i });
      const deleteRehearsalBtn = within(sessionSection).getAllByRole('button', {
        name: /delete rehearsal/i,
      })[0];
      await user.click(deleteRehearsalBtn);

      const blockedDialog = await screen.findByRole('dialog', {
        name: /session type tidak dapat dihapus/i,
      });
      expect(within(blockedDialog).getByText(/masih digunakan oleh paket aktif/i)).toBeTruthy();
      await user.click(within(blockedDialog).getByRole('button', { name: /mengerti/i }));

      // 2. Add custom Session Type
      await user.click(within(sessionSection).getByRole('button', { name: /add session type/i }));
      const addSessionDialog = await screen.findByRole('dialog', { name: /add session type/i });
      fireEvent.change(within(addSessionDialog).getByLabelText(/session name/i), {
        target: { value: 'Podcast Recording' },
      });
      fireEvent.change(within(addSessionDialog).getByLabelText(/hourly rate/i), {
        target: { value: '180000' },
      });
      await user.click(within(addSessionDialog).getByRole('button', { name: /add session/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add session type/i })).toBeNull();
      });
      expect(within(sessionSection).getAllByText('Podcast Recording').length).toBeGreaterThan(0);

      // 3. Add Studio Package (including Staff & Operator Commissions)
      const pkgSection = screen.getByRole('region', { name: /studio packages/i });
      await user.click(within(pkgSection).getByRole('button', { name: /add package/i }));
      const pkgDialog = await screen.findByRole('dialog', { name: /add studio package/i });
      fireEvent.change(within(pkgDialog).getByLabelText(/package name/i), {
        target: { value: 'Paket Podcast Pro 2 Jam' },
      });
      fireEvent.change(within(pkgDialog).getByLabelText(/duration \(menit\)/i), {
        target: { value: '120' },
      });
      fireEvent.change(within(pkgDialog).getByLabelText(/base price/i), {
        target: { value: '360000' },
      });
      fireEvent.change(within(pkgDialog).getByLabelText(/package discount/i), {
        target: { value: '60000' },
      });
      fireEvent.change(within(pkgDialog).getByLabelText(/^staff commission/i), {
        target: { value: '25000' },
      });
      fireEvent.change(within(pkgDialog).getByLabelText(/recording operator commission/i), {
        target: { value: '40000' },
      });

      // Live final price preview in dialog checks 360.000 - 60.000 = 300.000
      expect(within(pkgDialog).getByText(/Rp\s*300\.000/)).toBeTruthy();
      await user.click(within(pkgDialog).getByRole('button', { name: /^add package$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add studio package/i })).toBeNull();
      });

      // 4. Add Discount Preset
      const discountSection = screen.getByRole('region', { name: /discount presets/i });
      await user.click(within(discountSection).getByRole('button', { name: /add discount/i }));
      const discountDialog = await screen.findByRole('dialog', { name: /add discount preset/i });
      fireEvent.change(within(discountDialog).getByLabelText(/discount name/i), {
        target: { value: 'Rehearsal Promo 4H' },
      });
      fireEvent.change(within(discountDialog).getByLabelText(/min\. duration/i), {
        target: { value: '240' },
      });
      fireEvent.change(within(discountDialog).getByLabelText(/discount amount/i), {
        target: { value: '45000' },
      });
      await user.click(within(discountDialog).getByRole('button', { name: /^add discount$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add discount preset/i })).toBeNull();
      });

      // 5. Configure Rehearsal Staff Commission & Daily Meal Allowance
      const feesSection = screen.getByRole('region', { name: /staff and operational fees/i });
      fireEvent.change(
        within(feesSection).getByLabelText(/rehearsal staff commission per hour/i, {
          selector: 'input',
        }),
        { target: { value: '12000' } },
      );
      fireEvent.change(
        within(feesSection).getByLabelText(/daily meal allowance per staff/i, {
          selector: 'input',
        }),
        { target: { value: '25000' } },
      );

      // Unsaved indicator is visible
      expect(screen.getByText(/unsaved changes/i)).toBeTruthy();

      // 6. Simulate transient save failure -> local draft MUST NOT be wiped
      pricingAdapter._setNextSaveError(new Error('network-request-failed'));
      const saveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      const saveChangesBtn = within(saveBar).getByRole('button', { name: /save changes/i });
      await user.click(saveChangesBtn);

      expect(await within(saveBar).findByRole('alert')).toBeTruthy();
      expect(screen.getByText(/unsaved changes/i)).toBeTruthy();
      expect(within(sessionSection).getAllByText('Podcast Recording').length).toBeGreaterThan(0);

      // 7. Retry Save Changes -> succeeds and persists settings/pricing v1
      await user.click(saveChangesBtn);
      await waitFor(() => {
        expect(within(saveBar).getByText(/tersimpan • v1/i)).toBeTruthy();
      });

      const persistedDoc = pricingAdapter._getStoredDoc();
      expect(persistedDoc).toBeTruthy();
      expect(persistedDoc.version).toBe(1);
      expect(persistedDoc.updatedByUid).toBe('owner-uid-1');
      expect(persistedDoc.fees.rehearsalStaffCommissionPerHour).toBe(12000);
      expect(persistedDoc.fees.dailyMealAllowancePerStaff).toBe(25000);
      expect(persistedDoc.packages.some((p) => p.name === 'Paket Podcast Pro 2 Jam')).toBe(true);
      expect(persistedDoc.discounts.some((d) => d.name === 'Rehearsal Promo 4H')).toBe(true);

      // 8. Delete custom Discount Preset via confirmation dialog and verify clean persistence
      const deleteDiscBtn = within(discountSection).getAllByRole('button', {
        name: /delete rehearsal promo 4h/i,
      })[0];
      await user.click(deleteDiscBtn);
      const confirmDeleteDialog = await screen.findByRole('dialog', {
        name: /hapus discount preset\?/i,
      });
      await user.click(
        within(confirmDeleteDialog).getByRole('button', { name: /hapus discount preset/i }),
      );
      await waitFor(() => {
        expect(within(discountSection).queryByText('Rehearsal Promo 4H')).toBeNull();
      });

      await user.click(within(saveBar).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(within(saveBar).getByText(/tersimpan • v2/i)).toBeTruthy();
      });
      expect(pricingAdapter._getStoredDoc().discounts).toHaveLength(0);
    });

    it('updates live UI automatically via Firestore listener when another tab updates settings/pricing', async () => {
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/settings/price-and-fee');

      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      // Simulate remote save from another browser tab
      pricingAdapter._seedRemoteDoc({
        ...DEFAULT_PRICING_SETTINGS,
        fees: {
          rehearsalStaffCommissionPerHour: 15000,
          dailyMealAllowancePerStaff: 30000,
        },
        version: 4,
        updatedByUid: 'staff-uid-2',
      });

      const saveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      expect(await within(saveBar).findByText(/tersimpan • v4/i)).toBeTruthy();
      expect(screen.getByText(/Rp\s*15\.000\/jam/)).toBeTruthy();
      expect(screen.getByText(/Rp\s*30\.000\/hari/)).toBeTruthy();
    });
  });

  describe('2. Pricing, Discount & Internal Commission Calculations', () => {
    it('calculates regular hourly, recording hourly/fixed, packages, best non-stacking discount, and internal commissions accurately without polluting customer totals', () => {
      const customSettings = {
        ...DEFAULT_PRICING_SETTINGS,
        sessionTypes: [
          ...DEFAULT_PRICING_SETTINGS.sessionTypes,
          {
            id: 'inactive-service',
            name: 'Inactive Service',
            description: 'Disabled',
            hourlyRate: 999000,
            isActive: false,
            sortOrder: 9,
          },
        ],
        packages: [
          {
            id: 'pkg-rehearsal-3h',
            name: 'Paket Rehearsal 3 Jam',
            detail: '3 Jam hemat',
            sessionTypeId: 'rehearsal',
            durationMinutes: 180,
            basePrice: 300000,
            discountAmount: 30000,
            staffCommissionAmount: 20000,
            recordingOperatorCommissionAmount: 50000,
            isActive: true,
            sortOrder: 1,
          },
        ],
        discounts: [
          {
            id: 'disc-2h',
            name: 'Promo 2H',
            sessionTypeId: 'rehearsal',
            minimumDurationMinutes: 120,
            discountAmount: 15000,
            isActive: true,
            sortOrder: 1,
          },
          {
            id: 'disc-3h-bigger',
            name: 'Promo 3H Besar',
            sessionTypeId: 'rehearsal',
            minimumDurationMinutes: 180,
            discountAmount: 40000,
            isActive: true,
            sortOrder: 2,
          },
          {
            id: 'disc-3h-inactive',
            name: 'Promo 3H Inactive',
            sessionTypeId: 'rehearsal',
            minimumDurationMinutes: 180,
            discountAmount: 90000,
            isActive: false,
            sortOrder: 3,
          },
          {
            id: 'disc-excessive',
            name: 'Promo Mixing Oversize',
            sessionTypeId: 'mixing',
            minimumDurationMinutes: 60,
            discountAmount: 500000,
            isActive: true,
            sortOrder: 4,
          },
        ],
        fees: {
          rehearsalStaffCommissionPerHour: 10000,
          dailyMealAllowancePerStaff: 25000,
        },
        version: 3,
      };

      // 1 & 6 & 7 & 9 & 10 & 12 & 14 & 15: Regular Rehearsal 3h -> picks single highest active discount (40k, ignores 90k inactive, does not stack with 15k)
      // Staff commission = 3h * 10k = 30k; dailyMealAllowance (25k) NEVER touches booking totals or commissionSnapshot!
      const regularRehearsal3h = calculateBookingPricingSnapshot({
        serviceId: 'rehearsal',
        durationMinutes: 180,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
        dpAmount: 100000,
        paymentMethod: 'transfer',
        pricingSettings: customSettings,
      });
      expect(regularRehearsal3h.subtotal).toBe(300000);
      expect(regularRehearsal3h.discountAmount).toBe(40000);
      expect(regularRehearsal3h.totalAmount).toBe(260000);
      expect(regularRehearsal3h.remainingBalance).toBe(160000);
      expect(regularRehearsal3h.commissionSnapshot).toEqual({
        staffBasis: 'rehearsal_hourly',
        staffRate: 10000,
        staffAmount: 30000,
        recordingOperatorAmount: 0,
        settingsVersion: 3,
      });

      // 2. Recording Hourly 2h (2 * 150k = 300k), non-rehearsal gets 0 rehearsal hourly commission
      const recordingHourly = calculateBookingPricingSnapshot({
        serviceId: 'recording',
        recordingTypeId: 'tracking-regular',
        durationMinutes: 120,
        pricingSettings: customSettings,
      });
      expect(recordingHourly.subtotal).toBe(300000);
      expect(recordingHourly.totalAmount).toBe(300000);
      expect(recordingHourly.commissionSnapshot).toEqual({
        staffBasis: 'none',
        staffRate: 0,
        staffAmount: 0,
        recordingOperatorAmount: 0,
        settingsVersion: 3,
      });

      // 3. Recording Fixed Shift (locks 180 mins & 420k even if durationMinutes=60 passed)
      const recordingFixed = calculateBookingPricingSnapshot({
        serviceId: 'recording',
        recordingTypeId: 'live-recording-3h',
        durationMinutes: 60,
        pricingSettings: customSettings,
      });
      expect(recordingFixed.durationMinutes).toBe(180);
      expect(recordingFixed.subtotal).toBe(420000);
      expect(recordingFixed.totalAmount).toBe(420000);

      // 4 & 5 & 9 & 11 & 13: Package booking uses ONLY package discount (30k, not 40k session promo!)
      // Staff commission = package staffCommissionAmount (20k), NOT 20k + 30k hourly; Operator fee = 50k
      // Customer total stays 270k (never includes 20k staff fee, 50k operator fee, or 25k meal allowance)
      const packageBooking = calculateBookingPricingSnapshot({
        packageId: 'pkg-rehearsal-3h',
        pricingSettings: customSettings,
      });
      expect(packageBooking.subtotal).toBe(300000);
      expect(packageBooking.discountAmount).toBe(30000);
      expect(packageBooking.totalAmount).toBe(270000);
      expect(packageBooking.commissionSnapshot).toEqual({
        staffBasis: 'package',
        staffRate: 20000,
        staffAmount: 20000,
        recordingOperatorAmount: 50000,
        settingsVersion: 3,
      });

      // 8. Discount capped at subtotal (Mixing 1h = 250k vs 500k discount preset -> discountAmount capped at 250k, totalAmount = 0)
      const cappedDiscount = calculateBookingPricingSnapshot({
        serviceId: 'mixing',
        durationMinutes: 60,
        pricingSettings: customSettings,
      });
      expect(cappedDiscount.subtotal).toBe(250000);
      expect(cappedDiscount.discountAmount).toBe(250000);
      expect(cappedDiscount.totalAmount).toBe(0);

      // Verify selectBestSessionDiscount ignores non-matching session/duration
      expect(
        selectBestSessionDiscount({
          discounts: customSettings.discounts,
          sessionTypeId: 'rehearsal',
          durationMinutes: 60,
          subtotal: 100000,
        }).discountAmount,
      ).toBe(0);
    });
  });

  describe('3. Calendar Integration & Historical Booking Snapshot Protection', () => {
    it('reflects dynamic Firestore pricing presets in Calendar Booking Form in realtime and persists commissionSnapshot on new bookings', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');

      // Persist customized pricing in settings/pricing before opening Calendar
      const v1Settings = await savePricingSettings({
        actorUid: 'owner-uid-1',
        expectedVersion: 0,
        adapter: pricingAdapter,
        settings: {
          ...DEFAULT_PRICING_SETTINGS,
          sessionTypes: [
            ...DEFAULT_PRICING_SETTINGS.sessionTypes.map((s) =>
              s.id === 'mastering' ? { ...s, isActive: false } : s,
            ),
            {
              id: 'podcast-live',
              name: 'Podcast Live',
              description: 'Sesi rekaman podcast',
              hourlyRate: 175000,
              isActive: true,
              sortOrder: 5,
            },
          ],
          packages: [
            {
              id: 'pkg-rehearsal-3h',
              name: 'Paket Rehearsal 3 Jam Hemat',
              detail: 'Paket 3 jam spesial',
              sessionTypeId: 'rehearsal',
              durationMinutes: 180,
              basePrice: 300000,
              discountAmount: 30000,
              staffCommissionAmount: 25000,
              recordingOperatorCommissionAmount: 0,
              isActive: true,
              sortOrder: 1,
            },
          ],
          discounts: [
            {
              id: 'disc-reh-2h',
              name: 'Promo Rehearsal 2H',
              sessionTypeId: 'rehearsal',
              minimumDurationMinutes: 120,
              discountAmount: 20000,
              isActive: true,
              sortOrder: 1,
            },
          ],
          fees: {
            rehearsalStaffCommissionPerHour: 10000,
            dailyMealAllowancePerStaff: 25000,
          },
        },
      });

      renderAppAt('/admin/calendar');
      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      // Open "+ New Booking" modal
      await user.click(screen.getByRole('button', { name: /new booking/i }));
      const modal = await screen.findByRole('dialog', { name: /tambah booking/i });

      // Custom session "Podcast Live" appears, while inactive "Mastering" does NOT appear!
      const serviceGroup = within(modal).getByRole('group', { name: /pilih layanan studio/i });
      expect(within(serviceGroup).getByRole('button', { name: /podcast live/i })).toBeTruthy();
      expect(within(serviceGroup).queryByRole('button', { name: /mastering/i })).toBeNull();

      // Custom Package appears with updated label
      expect(
        within(modal).getByRole('option', { name: /paket rehearsal 3 jam hemat/i }),
      ).toBeTruthy();

      // Select 2 hours Rehearsal -> subtotal 200.000, automatic discount Promo Rehearsal 2H (-20.000), TOTAL 180.000
      // Internal Fee Estimate -> Staff Commission = 2 * 10.000 = 20.000, Recording Operator = Rp 0
      await user.click(within(modal).getByRole('button', { name: '2 Jam' }));
      expect(within(modal).getByText('Promo Rehearsal 2H')).toBeTruthy();
      expect(within(modal).getByText('INTERNAL FEE ESTIMATE')).toBeTruthy();
      expect(within(modal).getAllByText(/Rp\s*180\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Rp\s*20\.000/).length).toBeGreaterThan(0);

      // Submit booking and verify persisted commissionSnapshot
      fireEvent.change(within(modal).getByLabelText(/nama customer/i), {
        target: { value: 'Andi Wijaya' },
      });
      fireEvent.change(within(modal).getByLabelText(/nomor hp \/ whatsapp/i), {
        target: { value: '081234567890' },
      });
      await user.click(within(modal).getByRole('button', { name: /simpan booking/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
      });

      const savedBookings = Array.from(bookingAdapter._inspectState().bookings.values());
      expect(savedBookings).toHaveLength(1);
      expect(savedBookings[0].totalAmount).toBe(180000);
      expect(savedBookings[0].discountAmount).toBe(20000);
      expect(savedBookings[0].commissionSnapshot).toEqual({
        staffBasis: 'rehearsal_hourly',
        staffRate: 10000,
        staffAmount: 20000,
        recordingOperatorAmount: 0,
        settingsVersion: v1Settings.version,
      });

      // Now update Settings AFTER booking exists (Rehearsal rate jumps to 200k, hourly staff commission 50k)
      const v2Settings = await savePricingSettings({
        actorUid: 'owner-uid-1',
        expectedVersion: v1Settings.version,
        adapter: pricingAdapter,
        settings: {
          ...v1Settings,
          sessionTypes: v1Settings.sessionTypes.map((s) =>
            s.id === 'rehearsal' ? { ...s, hourlyRate: 200000 } : s,
          ),
          fees: {
            rehearsalStaffCommissionPerHour: 50000,
            dailyMealAllowancePerStaff: 40000,
          },
        },
      });

      // Reschedule existing booking via service -> old price & commission snapshot MUST be preserved!
      const rescheduled = await updateOrRescheduleBooking({
        bookingId: savedBookings[0].id,
        expectedVersion: savedBookings[0].version,
        actorUid: 'owner-uid-1',
        mode: 'reschedule',
        pricingSettings: v2Settings,
        formValues: {
          customerName: savedBookings[0].customerName,
          phone: savedBookings[0].phone,
          bandName: savedBookings[0].bandName,
          serviceId: savedBookings[0].serviceId,
          packageId: savedBookings[0].packageId,
          recordingTypeId: savedBookings[0].recordingTypeId,
          studioId: 'room-b',
          date: todayIso,
          startMinute: 780,
          durationPreset: '120',
          customDurationMinutes: '120',
          notes: 'Rescheduled ke Room B',
        },
        adapter: bookingAdapter,
      });

      expect(rescheduled.studioId).toBe('room-b');
      expect(rescheduled.totalAmount).toBe(180000);
      expect(rescheduled.unitRate).toBe(100000);
      expect(rescheduled.commissionSnapshot).toEqual({
        staffBasis: 'rehearsal_hourly',
        staffRate: 10000,
        staffAmount: 20000,
        recordingOperatorAmount: 0,
        settingsVersion: v1Settings.version,
      });
    });

    it('preserves full backward compatibility with legacy Phase 5 bookings lacking commissionSnapshot', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('staff', 'staff-uid-2');

      // Seed a raw Phase 5 booking without `commissionSnapshot`
      const phase5Booking = normalizeBookingRecord('bkg-phase5-legacy', {
        id: 'bkg-phase5-legacy',
        customerName: 'Phase Five Band',
        phone: '081111222333',
        bandName: 'Classic Five',
        studioId: 'room-a',
        serviceId: 'rehearsal',
        serviceLabel: 'Rehearsal',
        packageId: '',
        packageLabel: '',
        recordingTypeId: '',
        recordingTypeLabel: '',
        date: todayIso,
        startMinute: 600,
        durationMinutes: 120,
        endMinute: 720,
        unitRate: 100000,
        subtotal: 200000,
        discountAmount: 0,
        totalAmount: 200000,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
        initialPaidAmount: 200000,
        paymentMethod: 'cash',
        sessionStatus: 'upcoming',
        notes: 'Phase 5 booking',
        createdByUid: 'owner-uid-1',
        updatedByUid: 'owner-uid-1',
        version: 1,
      });

      expect(phase5Booking.commissionSnapshot).toBeNull();

      bookingAdapter = createInMemoryBookingRepositoryAdapter([phase5Booking]);
      setBookingRepositoryAdapter(bookingAdapter);

      renderAppAt('/admin/calendar');
      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      const upcomingSection = screen.getByRole('region', { name: /upcoming bookings/i });
      await user.click(
        await within(upcomingSection).findByRole('button', {
          name: /detail booking phase five band/i,
        }),
      );

      const drawer = await screen.findByRole('dialog', { name: /phase five band/i });
      expect(within(drawer).getByText(/tidak ada snapshot komisi internal/i)).toBeTruthy();

      // Update Phase 5 booking customer note cleanly without forcing commissionSnapshot migration
      await user.click(within(drawer).getByRole('button', { name: /edit booking/i }));
      const editModal = await screen.findByRole('dialog', { name: /edit booking/i });
      fireEvent.change(within(editModal).getByLabelText(/catatan sesi/i), {
        target: { value: 'Updated phase 5 note' },
      });
      await user.click(within(editModal).getByRole('button', { name: /simpan booking/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit booking/i })).toBeNull();
      });

      const saved = bookingAdapter._inspectState().bookings.get('bkg-phase5-legacy');
      expect(saved.notes).toBe('Updated phase 5 note');
      expect(saved.totalAmount).toBe(200000);
      expect(saved.commissionSnapshot).toBeNull();
    });
  });

  describe('4. Firestore Security Rules Contract Verification', () => {
    it('secures settings/pricing and enforces commissionSnapshot validation & snapshot immutability in firestore.rules', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      expect(rulesContent).toContain('match /settings/pricing');
      expect(rulesContent).toContain('allow get: if isActiveStaff();');
      expect(rulesContent).toContain('allow list: if false;');
      expect(rulesContent).toContain('allow delete: if false;');
      expect(rulesContent).toContain('function isValidPricingSettings(data)');
      expect(rulesContent).toContain('data.updatedByUid == request.auth.uid');
      expect(rulesContent).toContain('request.resource.data.version == resource.data.version + 1');

      expect(rulesContent).toContain("'commissionSnapshot'");
      expect(rulesContent).toContain('function isValidBookingCommissionSnapshot(data)');
      expect(rulesContent).toContain('function isBookingSnapshotsUnchanged(reqData, resData)');
      expect(rulesContent).toContain(
        "reqData.get('commissionSnapshot', null) == resData.get('commissionSnapshot', null)",
      );
    });
  });
});
