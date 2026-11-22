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
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  normalizeBookingRecord,
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { validateBookingFormPayload } from '@/features/admin/calendar/schemas/booking-schema';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  updateOrRescheduleBooking,
} from '@/features/admin/calendar/services/calendar-booking-service';
import { calculateBookingPricingSnapshot } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
} from './pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from './pricing/repositories/pricing-settings-repository';
import { savePricingSettings } from './pricing/services/pricing-settings-service';
import { selectBestOptionDiscountRule } from './pricing/utils/calculate-pricing-settings';
import {
  isLegacyV1PricingSettings,
  migratePricingSettingsV1ToV2,
} from './pricing/utils/migrate-pricing-settings';
import {
  clonePricingSettings,
  normalizePricingSettings,
} from './pricing/utils/normalize-pricing-settings';

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

describe('Phase 6 V2 — Service Catalog & Tariff Model Redesign', () => {
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
    setPaymentRepositoryAdapter(createInMemoryPaymentRepositoryAdapter(bookingAdapter));
  });

  afterEach(() => {
    cleanup();
    resetPricingSettingsRepositoryAdapter();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPaymentRepositoryAdapter();
  });

  describe('A. Catalog Management, Navigation, Owner Authorization & Save Behavior', () => {
    it('renders hierarchical Studio & WFA catalog, supports Service/Subcategory CRUD, preserves immutable IDs on rename, protects active references, handles transient save failure, and syncs live', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/settings');

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Settings' }, { timeout: 5000 }),
      ).toBeTruthy();

      const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
      expect(within(sidebarNav).getAllByRole('link')).toHaveLength(11);
      expect(
        within(sidebarNav).getByRole('link', { name: 'Settings' }).getAttribute('aria-current'),
      ).toBe('page');

      // Navigate to /admin/settings/price-and-fee
      await user.click(screen.getByRole('link', { name: /open price and fee settings/i }));
      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();

      // Did not auto-write settings/pricing on load
      expect(pricingAdapter._getStoredDoc()).toBeNull();
      expect(screen.getByText(/default presets • belum disimpan/i)).toBeTruthy();

      // Studio Sessions & WFA Services sections are separated clearly
      const studioSection = screen.getByRole('region', { name: /layanan ruangan studio/i });
      const wfaSection = screen.getByRole('region', { name: /layanan work from anywhere/i });
      expect(within(studioSection).getByRole('heading', { name: 'Rehearsal' })).toBeTruthy();
      expect(within(studioSection).getByRole('heading', { name: 'Recording' })).toBeTruthy();
      expect(within(wfaSection).getByRole('heading', { name: 'Mixing' })).toBeTruthy();
      expect(within(wfaSection).getByRole('heading', { name: 'Mastering' })).toBeTruthy();

      // Unconfigured requested presets show "Belum Dikonfigurasi" and cannot be toggled active
      expect(
        within(studioSection).getAllByText(/belum dikonfigurasi/i).length,
      ).toBeGreaterThanOrEqual(4);

      // Safe Delete Check: Deleting Rehearsal while active subcategories exist is blocked
      await user.click(
        within(studioSection).getByRole('button', { name: /delete service rehearsal/i }),
      );
      const blockedDialog = await screen.findByRole('dialog', {
        name: /service type tidak dapat dihapus/i,
      });
      expect(within(blockedDialog).getByText(/masih memiliki subcategory aktif/i)).toBeTruthy();
      await user.click(within(blockedDialog).getByRole('button', { name: /mengerti/i }));

      // 1. Add new Studio Service Type ("Podcast Booth")
      await user.click(within(studioSection).getByRole('button', { name: /add studio service/i }));
      const addSvcDialog = await screen.findByRole('dialog', { name: /add service type/i });
      fireEvent.change(within(addSvcDialog).getByLabelText(/service name/i), {
        target: { value: 'Podcast Booth' },
      });
      await user.click(within(addSvcDialog).getByRole('button', { name: /add service/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add service type/i })).toBeNull();
      });
      expect(within(studioSection).getByRole('heading', { name: 'Podcast Booth' })).toBeTruthy();

      // 2. Rename "Podcast Booth" -> "Podcast Studio" (immutable ID preserved!)
      await user.click(
        within(studioSection).getByRole('button', { name: /edit service podcast booth/i }),
      );
      const editSvcDialog = await screen.findByRole('dialog', { name: /edit service type/i });
      fireEvent.change(within(editSvcDialog).getByLabelText(/service name/i), {
        target: { value: 'Podcast Studio' },
      });
      await user.click(within(editSvcDialog).getByRole('button', { name: /update service/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit service type/i })).toBeNull();
      });
      expect(within(studioSection).getByRole('heading', { name: 'Podcast Studio' })).toBeTruthy();

      // 3. Configure "Paket 6 Hours" from unconfigured draft -> Fixed Shift with Staff & Owner fees
      await user.click(within(studioSection).getByRole('button', { name: /edit paket 6 hours/i }));
      const optDialog = await screen.findByRole('dialog', { name: /edit subcategory/i });
      await user.click(within(optDialog).getByRole('button', { name: /fixed shift/i }));
      fireEvent.change(within(optDialog).getByLabelText(/base price \(idr\)/i), {
        target: { value: '600000' },
      });
      fireEvent.change(within(optDialog).getByLabelText(/discount \(idr\)/i), {
        target: { value: '60000' },
      });
      // Configure Staff Fixed Fee = 25000
      const staffFeeModeGroup = within(optDialog).getByRole('group', { name: /mode staff fee/i });
      await user.click(within(staffFeeModeGroup).getByRole('button', { name: 'Fixed' }));
      fireEvent.change(within(optDialog).getByLabelText(/staff fee fixed/i), {
        target: { value: '25000' },
      });
      await user.click(within(optDialog).getByRole('button', { name: /update subcategory/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit subcategory/i })).toBeNull();
      });

      // 4. Add a Fixed Project subcategory under WFA Mixing
      await user.click(
        within(wfaSection).getByRole('button', { name: /add subcategory \(mixing\)/i }),
      );
      const wfaOptDialog = await screen.findByRole('dialog', { name: /add subcategory/i });
      fireEvent.change(within(wfaOptDialog).getByLabelText(/subcategory name/i), {
        target: { value: 'Single Track Mixing' },
      });
      fireEvent.change(within(wfaOptDialog).getByLabelText(/project price \(idr\)/i), {
        target: { value: '650000' },
      });
      await user.click(within(wfaOptDialog).getByRole('button', { name: /^add subcategory$/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /add subcategory/i })).toBeNull();
      });

      // 5. Update Global Daily Meal Allowance
      fireEvent.change(screen.getByLabelText(/daily meal allowance per staff \(idr\)/i), {
        target: { value: '25000' },
      });

      expect(screen.getByText(/unsaved changes/i)).toBeTruthy();

      // 6. Transient save failure preserves local draft
      pricingAdapter._setNextSaveError(new Error('network-request-failed'));
      const saveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      await user.click(within(saveBar).getByRole('button', { name: /save changes/i }));
      expect(await within(saveBar).findByRole('alert')).toBeTruthy();
      expect(within(studioSection).getByRole('heading', { name: 'Podcast Studio' })).toBeTruthy();

      // 7. Retry Save Changes -> persists Schema V2 v1 cleanly
      await user.click(within(saveBar).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(within(saveBar).getByText(/tersimpan • v1/i)).toBeTruthy();
      });

      const persisted = pricingAdapter._getStoredDoc();
      expect(persisted.schemaVersion).toBe(2);
      expect(persisted.version).toBe(1);
      expect(persisted.operationalSettings.dailyMealAllowancePerStaff).toBe(25000);
      const savedPkg6h = persisted.serviceTypes
        .find((s) => s.id === 'rehearsal')
        .options.find((o) => o.id === 'rehearsal-pkg-6h');
      expect(savedPkg6h.isActive).toBe(true);
      expect(savedPkg6h.pricing).toMatchObject({
        mode: PRICING_MODES.FIXED_SHIFT,
        durationMinutes: 360,
        basePrice: 600000,
        discountAmount: 60000,
      });
      expect(savedPkg6h.fees.staff).toEqual({ mode: FEE_MODES.FIXED, amount: 25000 });

      const savedPodcastSvc = persisted.serviceTypes.find((s) => s.name === 'Podcast Studio');
      expect(savedPodcastSvc.id).toMatch(/^svc-/);
      expect(
        persisted.serviceTypes
          .find((s) => s.id === 'mixing')
          .options.some(
            (o) =>
              o.name === 'Single Track Mixing' &&
              o.pricing.mode === PRICING_MODES.FIXED_PROJECT &&
              o.pricing.projectPrice === 650000,
          ),
      ).toBe(true);
    });

    it('restricts Staff/Operator to read-only in Settings UI and rejects non-owner savePricingSettings', async () => {
      await expect(
        savePricingSettings({
          actorUid: 'staff-uid-2',
          actorRole: 'staff',
          expectedVersion: 0,
          adapter: pricingAdapter,
          settings: DEFAULT_PRICING_SETTINGS,
        }),
      ).rejects.toMatchObject({ code: 'pricing/owner-only' });

      mockAuthenticatedStaff('staff', 'staff-uid-2');
      renderAppAt('/admin/settings/price-and-fee');

      expect(
        await screen.findByRole('heading', { level: 2, name: /price and fee settings/i }),
      ).toBeTruthy();
      expect(screen.getByText(/mode baca saja \(staff \/ operator\)/i)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /add studio service/i })).toBeNull();
      expect(screen.getByRole('button', { name: /edit service rehearsal/i }).disabled).toBe(true);
      expect(screen.getByRole('button', { name: /save changes/i }).disabled).toBe(true);
    });
  });

  describe('B & C. Pricing Models, Discounts & Three-Role Internal Fees', () => {
    it('calculates Hourly (exact 30m proportion), Fixed Shift, Fixed Project, Manual Quote, non-stacking Discounts, and Staff/Owner/Operator Fees with strict separation from customer totals', () => {
      const customV2 = clonePricingSettings(DEFAULT_PRICING_SETTINGS);
      customV2.version = 4;
      customV2.operationalSettings.dailyMealAllowancePerStaff = 35000;

      // Configure Rehearsal Reguler with both per_completed_block & minimum_duration rules + Staff hourly + Owner fixed
      const rehearsalSvc = customV2.serviceTypes.find((s) => s.id === 'rehearsal');
      const regularOpt = rehearsalSvc.options.find((o) => o.id === 'rehearsal-regular');
      regularOpt.discountRules = [
        {
          id: 'rule-block-3h',
          name: 'Diskon Durasi',
          mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
          intervalMinutes: 180,
          minimumDurationMinutes: 0,
          discountAmount: 30000,
          isActive: true,
        },
        {
          id: 'rule-min-5h',
          name: 'Promo 5 Jam',
          mode: DISCOUNT_RULE_MODES.MINIMUM_DURATION,
          intervalMinutes: 0,
          minimumDurationMinutes: 300,
          discountAmount: 50000,
          isActive: true,
        },
      ];
      regularOpt.fees = {
        staff: { mode: FEE_MODES.HOURLY, amount: 10000 },
        owner: { mode: FEE_MODES.FIXED, amount: 20000 },
        recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
      };

      // Configure Paket 6 Hours as active Fixed Shift with Fixed Staff & Operator fees
      const pkg6hOpt = rehearsalSvc.options.find((o) => o.id === 'rehearsal-pkg-6h');
      pkg6hOpt.isActive = true;
      pkg6hOpt.pricing = {
        mode: PRICING_MODES.FIXED_SHIFT,
        hourlyRate: null,
        durationMinutes: 360,
        basePrice: 600000,
        discountAmount: 60000,
        projectPrice: null,
        unitLabel: '',
      };
      pkg6hOpt.fees = {
        staff: { mode: FEE_MODES.FIXED, amount: 40000 },
        owner: { mode: FEE_MODES.HOURLY, amount: 15000 },
        recordingOperator: { mode: FEE_MODES.FIXED, amount: 50000 },
      };

      // Configure Mixing WFA Fixed Project with hourly owner fee
      const mixingSvc = customV2.serviceTypes.find((s) => s.id === 'mixing');
      mixingSvc.options.push({
        id: 'mixing-single-proj',
        name: 'Mixing Per Lagu',
        description: 'Fixed project per lagu',
        isActive: true,
        sortOrder: 2,
        pricing: {
          mode: PRICING_MODES.FIXED_PROJECT,
          hourlyRate: null,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: 750000,
          unitLabel: 'Per Lagu',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.HOURLY, amount: 50000 },
          recordingOperator: { mode: FEE_MODES.FIXED, amount: 200000 },
        },
      });

      // 1. Hourly ceiling billing: 2.5 hours (150m) rounds up to 3 billable hours * 100k = 300k
      //    (discount rules still evaluate against actual studio duration of 150m -> discountAmount 0;
      //    staff hourly commission still pays for actual 2.5h studio time -> 25k)
      const rehearsal2_5h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 150,
        pricingSettings: customV2,
      });
      expect(rehearsal2_5h.subtotal).toBe(300000);
      expect(rehearsal2_5h.discountAmount).toBe(0);
      expect(rehearsal2_5h.totalAmount).toBe(300000);
      expect(rehearsal2_5h.commissionSnapshot).toEqual({
        schemaVersion: 2,
        staff: { basis: 'hourly', rate: 10000, amount: 25000 },
        owner: { basis: 'fixed', rate: 20000, amount: 20000 },
        recordingOperator: { basis: 'none', rate: 0, amount: 0 },
        settingsVersion: 4,
      });

      // 2. Non-stacking highest discount rule:
      //    At 5h (300m): block rule = 30k vs min-5h rule = 50k -> picks 50k (NOT 80k!)
      const rehearsal5h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 300,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PARTIAL,
        dpAmount: 100000,
        paymentMethod: 'transfer',
        pricingSettings: customV2,
      });
      expect(rehearsal5h.subtotal).toBe(500000);
      expect(rehearsal5h.discountAmount).toBe(50000);
      expect(rehearsal5h.totalAmount).toBe(450000);
      expect(rehearsal5h.remainingBalance).toBe(350000); // Internal fees + meal allowance NEVER pollute customer total/balance!

      //    At 6h (360m): block rule = 60k vs min-5h rule = 50k -> picks 60k (automaticDiscount set!)
      const rehearsal6h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        durationMinutes: 360,
        pricingSettings: customV2,
      });
      expect(rehearsal6h.discountAmount).toBe(60000);
      expect(rehearsal6h.automaticDiscount).toEqual({
        type: 'duration_multiple',
        intervalMinutes: 180,
        eligibleBlocks: 2,
        discountPerBlock: 30000,
        totalDiscount: 60000,
      });

      // 3. Fixed Shift (Paket 6 Hours): locked 360m, 600k - 60k = 540k, never stacks regular discounts, no double-count fees
      const pkg6h = calculateBookingPricingSnapshot({
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-pkg-6h',
        durationMinutes: 60, // ignored because Fixed Shift locks 360m!
        pricingSettings: customV2,
      });
      expect(pkg6h.durationMinutes).toBe(360);
      expect(pkg6h.subtotal).toBe(600000);
      expect(pkg6h.discountAmount).toBe(60000);
      expect(pkg6h.totalAmount).toBe(540000);
      expect(pkg6h.commissionSnapshot).toEqual({
        schemaVersion: 2,
        staff: { basis: 'fixed', rate: 40000, amount: 40000 },
        owner: { basis: 'hourly', rate: 15000, amount: 90000 },
        recordingOperator: { basis: 'fixed', rate: 50000, amount: 50000 },
        settingsVersion: 4,
      });

      // 4. WFA Fixed Project: hourly owner fee requires explicit estimatedWorkMinutes (0 if omitted!)
      const wfaWithoutEstimate = calculateBookingPricingSnapshot({
        serviceTypeId: 'mixing',
        serviceOptionId: 'mixing-single-proj',
        durationMinutes: 180, // studio duration MUST NOT be assumed for WFA!
        pricingSettings: customV2,
      });
      expect(wfaWithoutEstimate.subtotal).toBe(750000);
      expect(wfaWithoutEstimate.totalAmount).toBe(750000);
      expect(wfaWithoutEstimate.commissionSnapshot.owner).toEqual({
        basis: 'hourly',
        rate: 50000,
        amount: 0,
      });
      expect(wfaWithoutEstimate.commissionSnapshot.recordingOperator.amount).toBe(200000);

      const wfaWithEstimate = calculateBookingPricingSnapshot({
        serviceTypeId: 'mixing',
        serviceOptionId: 'mixing-single-proj',
        estimatedWorkMinutes: 240, // 4 hours estimated work
        pricingSettings: customV2,
      });
      expect(wfaWithEstimate.commissionSnapshot.owner.amount).toBe(200000);

      // 5. Recording Others (Manual Quote): uses manual price & manual Staff/Operator fees, no automatic discount
      const othersQuote = calculateBookingPricingSnapshot({
        serviceTypeId: 'recording',
        serviceOptionId: 'rec-others',
        durationMinutes: 180,
        manualCustomerPrice: 480000,
        manualStaffFee: 30000,
        manualRecordingOperatorFee: 120000,
        pricingSettings: customV2,
      });
      expect(othersQuote.subtotal).toBe(480000);
      expect(othersQuote.discountAmount).toBe(0);
      expect(othersQuote.totalAmount).toBe(480000);
      expect(othersQuote.commissionSnapshot).toEqual({
        schemaVersion: 2,
        staff: { basis: 'manual', rate: 30000, amount: 30000 },
        owner: { basis: 'none', rate: 0, amount: 0 },
        recordingOperator: { basis: 'manual', rate: 120000, amount: 120000 },
        settingsVersion: 4,
      });

      // 6. Unconfigured & inactive options & empty Manual Quote rejected by booking schema
      const unconfiguredValidation = validateBookingFormPayload(
        {
          customerName: 'Test User',
          phone: '081234567890',
          serviceTypeId: 'recording',
          serviceOptionId: 'rec-lite', // unconfigured!
          studioId: 'room-a',
          date: todayIso,
          startMinute: 600,
          durationPreset: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        },
        [],
        '',
        DEFAULT_PRICING_SETTINGS,
      );
      expect(unconfiguredValidation.isValid).toBe(false);
      expect(unconfiguredValidation.errors.serviceOptionId).toBeTruthy();

      const emptyManualValidation = validateBookingFormPayload(
        {
          customerName: 'Test User',
          phone: '081234567890',
          serviceTypeId: 'recording',
          serviceOptionId: 'rec-others',
          manualCustomerPrice: '0',
          studioId: 'room-a',
          date: todayIso,
          startMinute: 600,
          durationPreset: '60',
          initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        },
        [],
        '',
        DEFAULT_PRICING_SETTINGS,
      );
      expect(emptyManualValidation.isValid).toBe(false);
      expect(emptyManualValidation.errors.manualCustomerPrice).toBeTruthy();

      // 7. Discount capped at subtotal via selectBestOptionDiscountRule
      expect(
        selectBestOptionDiscountRule({
          discountRules: [
            {
              id: 'big',
              name: 'Big Promo',
              mode: DISCOUNT_RULE_MODES.MINIMUM_DURATION,
              intervalMinutes: 0,
              minimumDurationMinutes: 60,
              discountAmount: 500000,
              isActive: true,
            },
          ],
          durationMinutes: 60,
          subtotal: 100000,
        }).discountAmount,
      ).toBe(100000);
    });
  });

  describe('D. Schema V1 -> V2 Migration Safety & Idempotence', () => {
    it('migrates legacy V1 settings losslessly without auto-writing to Firestore and remains idempotent across repeated normalizations', async () => {
      const legacyV1Doc = {
        schemaVersion: 1,
        sessionTypes: [
          {
            id: 'rehearsal',
            name: 'Rehearsal',
            description: 'Latihan studio reguler',
            hourlyRate: 100000,
            durationDiscount: { enabled: true, intervalMinutes: 180, discountAmount: 30000 },
            isActive: true,
            sortOrder: 1,
          },
          {
            id: 'recording',
            name: 'Recording',
            description: 'Tracking rekaman',
            hourlyRate: 150000,
            durationDiscount: { enabled: false, intervalMinutes: 180, discountAmount: 30000 },
            isActive: true,
            sortOrder: 2,
          },
          {
            id: 'mixing',
            name: 'Mixing',
            description: 'Mixing audio',
            hourlyRate: 250000,
            isActive: true,
            sortOrder: 3,
          },
          {
            id: 'mastering',
            name: 'Mastering',
            description: 'Mastering audio',
            hourlyRate: 300000,
            isActive: false,
            sortOrder: 4,
          },
        ],
        recordingTypes: [
          {
            id: 'tracking-regular',
            name: 'Tracking Reguler',
            description: 'Per jam',
            priceMode: 'hourly',
            durationMinutes: 0,
            price: 150000,
            isActive: true,
            sortOrder: 1,
          },
          {
            id: 'live-recording-3h',
            name: 'Live Recording Session',
            description: 'Live 3 jam',
            priceMode: 'fixed',
            durationMinutes: 180,
            price: 420000,
            isActive: true,
            sortOrder: 2,
          },
          {
            id: 'multitrack-shift-6h',
            name: 'Multitrack Shift',
            description: 'Shift 6 jam',
            priceMode: 'fixed',
            durationMinutes: 360,
            price: 800000,
            isActive: true,
            sortOrder: 3,
          },
        ],
        packages: [
          {
            id: 'pkg-rehearsal-3h',
            name: 'Paket Rehearsal 3 Jam',
            detail: 'Hemat 30k',
            sessionTypeId: 'rehearsal',
            durationMinutes: 180,
            basePrice: 300000,
            discountAmount: 30000,
            staffCommissionAmount: 20000,
            recordingOperatorCommissionAmount: 5000,
            isActive: true,
            sortOrder: 1,
          },
          {
            id: 'pkg-rehearsal-5h',
            name: 'Paket Rehearsal 5 Jam',
            detail: 'Hemat 50k',
            sessionTypeId: 'rehearsal',
            durationMinutes: 300,
            basePrice: 500000,
            discountAmount: 50000,
            staffCommissionAmount: 35000,
            recordingOperatorCommissionAmount: 0,
            isActive: true,
            sortOrder: 2,
          },
        ],
        discounts: [
          {
            id: 'disc-reh-4h',
            name: 'Promo 4H',
            sessionTypeId: 'rehearsal',
            minimumDurationMinutes: 240,
            discountAmount: 45000,
            isActive: true,
            sortOrder: 1,
          },
        ],
        fees: {
          rehearsalStaffCommissionPerHour: 12000,
          dailyMealAllowancePerStaff: 28000,
        },
        version: 3,
        updatedAt: '2026-11-18T10:00:00Z',
        updatedByUid: 'owner-uid-1',
      };

      expect(isLegacyV1PricingSettings(legacyV1Doc)).toBe(true);
      const migrated = migratePricingSettingsV1ToV2(legacyV1Doc);
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.version).toBe(3);
      expect(migrated.updatedByUid).toBe('owner-uid-1');
      expect(migrated.operationalSettings.dailyMealAllowancePerStaff).toBe(28000);

      // Rehearsal preserved: Reguler (100k + 12k/h staff + both discount rules), Paket 3h, Paket 5h, draft Paket 6h
      const reh = migrated.serviceTypes.find((s) => s.id === 'rehearsal');
      expect(reh.deliveryMode).toBe(DELIVERY_MODES.STUDIO);
      const rehReg = reh.options.find((o) => o.id === 'rehearsal-regular');
      expect(rehReg.pricing.hourlyRate).toBe(100000);
      expect(rehReg.fees.staff).toEqual({ mode: FEE_MODES.HOURLY, amount: 12000 });
      expect(rehReg.discountRules).toHaveLength(2);
      const pkg3h = reh.options.find((o) => o.id === 'pkg-rehearsal-3h');
      expect(pkg3h.pricing).toMatchObject({
        mode: PRICING_MODES.FIXED_SHIFT,
        basePrice: 300000,
        discountAmount: 30000,
        durationMinutes: 180,
      });
      expect(pkg3h.fees.staff).toEqual({ mode: FEE_MODES.FIXED, amount: 20000 });
      expect(pkg3h.fees.recordingOperator).toEqual({ mode: FEE_MODES.FIXED, amount: 5000 });
      expect(reh.options.find((o) => o.id === 'pkg-rehearsal-5h').pricing.basePrice).toBe(500000);
      expect(reh.options.find((o) => o.id === 'rehearsal-pkg-6h')).toMatchObject({
        isActive: false,
        pricing: expect.objectContaining({ mode: PRICING_MODES.UNCONFIGURED }),
      });

      // Recording preserved: Tracking 150k, Live 420k/3h, Multitrack 800k/6h + drafts Lite/Pro/Drum Only + manual Others
      const rec = migrated.serviceTypes.find((s) => s.id === 'recording');
      expect(rec.options.find((o) => o.id === 'tracking-regular').pricing.hourlyRate).toBe(150000);
      expect(rec.options.find((o) => o.id === 'live-recording-3h')).toMatchObject({
        name: 'Live',
        pricing: expect.objectContaining({ basePrice: 420000, durationMinutes: 180 }),
      });
      expect(rec.options.find((o) => o.id === 'multitrack-shift-6h').pricing.basePrice).toBe(
        800000,
      );
      expect(rec.options.find((o) => o.id === 'rec-others').pricing.mode).toBe(
        PRICING_MODES.MANUAL_QUOTE,
      );

      // Mixing & Mastering preserved as WFA hourly (NOT silently changed to fixed_project), Mastering stays inactive!
      const mix = migrated.serviceTypes.find((s) => s.id === 'mixing');
      expect(mix.deliveryMode).toBe(DELIVERY_MODES.WFA);
      expect(mix.options[0].pricing).toMatchObject({
        mode: PRICING_MODES.HOURLY,
        hourlyRate: 250000,
      });
      const mast = migrated.serviceTypes.find((s) => s.id === 'mastering');
      expect(mast.deliveryMode).toBe(DELIVERY_MODES.WFA);
      expect(mast.isActive).toBe(false);
      expect(mast.options[0].pricing.hourlyRate).toBe(300000);

      // Repeated normalization is strictly idempotent
      const normOnce = normalizePricingSettings(legacyV1Doc);
      const normTwice = normalizePricingSettings(normOnce);
      expect(normTwice).toEqual(normOnce);

      // UI opens legacy V1 without auto-writing Firestore, shows migration banner, and upgrades to v4 on explicit Save
      const user = userEvent.setup();
      pricingAdapter = createInMemoryPricingSettingsAdapter(legacyV1Doc);
      setPricingSettingsRepositoryAdapter(pricingAdapter);
      mockAuthenticatedStaff('owner');
      renderAppAt('/admin/settings/price-and-fee');

      expect(await screen.findByText(/migrasi v1 → v2 • siap disimpan/i)).toBeTruthy();
      // Stored doc in adapter is STILL legacy Schema V1 (zero auto-write!)
      expect(pricingAdapter._getStoredDoc().schemaVersion).toBe(1);

      const saveBar = screen.getByRole('region', {
        name: /kontrol penyimpanan price and fee settings/i,
      });
      await user.click(within(saveBar).getByRole('button', { name: /save changes/i }));
      await waitFor(() => {
        expect(within(saveBar).getByText(/tersimpan • v4/i)).toBeTruthy();
      });
      expect(pricingAdapter._getStoredDoc().schemaVersion).toBe(2);
      expect(pricingAdapter._getStoredDoc().version).toBe(4);
    });
  });

  describe('E. Calendar Integration, Manual Quote (Others), WFA Boundary & Legacy Compatibility', () => {
    it('supports sequential Studio Service -> Recording Others Manual Quote in Calendar UI, persists V2 snapshot, and rejects WFA bookings', async () => {
      const user = userEvent.setup();
      mockAuthenticatedStaff('owner');

      // 1. WFA service MUST NOT create studio room booking or bookingSlots
      await expect(
        createBooking({
          bookingId: 'bkg-wfa-blocked',
          actorUid: 'owner-uid-1',
          pricingSettings: DEFAULT_PRICING_SETTINGS,
          formValues: {
            customerName: 'WFA Band',
            phone: '081234567890',
            serviceTypeId: 'mixing',
            serviceOptionId: 'mixing-regular',
            studioId: 'room-a',
            date: todayIso,
            startMinute: 600,
            durationPreset: '120',
            initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
          },
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/validation-error' });
      expect(bookingAdapter._inspectState().slots.size).toBe(0);

      // 2. Open Calendar Booking Form -> select Recording -> Others -> enter manual price & fees
      renderAppAt('/admin/calendar');
      expect(await screen.findByText(/jadwal studio/i, {}, { timeout: 5000 })).toBeTruthy();

      await user.click(screen.getByRole('button', { name: /new booking/i }));
      const modal = await screen.findByRole('dialog', { name: /tambah booking/i });

      const serviceGroup = within(modal).getByRole('group', { name: /pilih layanan studio/i });
      // WFA services never appear in Studio Booking Form
      expect(within(serviceGroup).queryByRole('button', { name: /mixing/i })).toBeNull();
      expect(within(serviceGroup).queryByRole('button', { name: /mastering/i })).toBeNull();

      await user.click(within(serviceGroup).getByRole('button', { name: /recording/i }));

      const subGroup = within(modal).getByRole('group', { name: /pilih subcategory layanan/i });
      // Unconfigured Recording options (Lite, Pro, Drum Only) MUST NOT appear!
      expect(within(subGroup).queryByRole('button', { name: /^lite/i })).toBeNull();
      expect(within(subGroup).queryByRole('button', { name: /^pro/i })).toBeNull();
      expect(within(subGroup).queryByRole('button', { name: /drum only/i })).toBeNull();

      await user.click(within(subGroup).getByRole('button', { name: /others/i }));

      // Fill customer + manual price + manual Staff & Recording Operator fees
      fireEvent.change(within(modal).getByLabelText(/nama customer/i), {
        target: { value: 'Nadia Custom Rec' },
      });
      fireEvent.change(within(modal).getByLabelText(/nomor hp \/ whatsapp/i), {
        target: { value: '081355551234' },
      });
      fireEvent.change(within(modal).getByLabelText(/harga manual \(idr\)/i), {
        target: { value: '450000' },
      });
      fireEvent.change(within(modal).getByLabelText(/^staff fee \(idr\)/i), {
        target: { value: '35000' },
      });
      fireEvent.change(within(modal).getByLabelText(/recording operator fee \(idr\)/i), {
        target: { value: '150000' },
      });

      // Live summary separates CUSTOMER BILL (Rp 450.000) from INTERNAL FEE ESTIMATE (Staff 35k, Owner 0, Operator 150k)
      expect(within(modal).getByText('CUSTOMER BILL')).toBeTruthy();
      expect(within(modal).getByText('INTERNAL FEE ESTIMATE')).toBeTruthy();
      expect(within(modal).getAllByText(/Rp\s*450\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Rp\s*35\.000/).length).toBeGreaterThan(0);
      expect(within(modal).getAllByText(/Rp\s*150\.000/).length).toBeGreaterThan(0);

      await user.click(within(modal).getByRole('button', { name: /simpan booking/i }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
      });

      const saved = Array.from(bookingAdapter._inspectState().bookings.values())[0];
      expect(saved.serviceTypeId).toBe('recording');
      expect(saved.serviceOptionId).toBe('rec-others');
      expect(saved.serviceOptionName).toBe('Others');
      expect(saved.deliveryMode).toBe(DELIVERY_MODES.STUDIO);
      expect(saved.pricingMode).toBe(PRICING_MODES.MANUAL_QUOTE);
      expect(saved.totalAmount).toBe(450000);
      expect(saved.commissionSnapshot).toEqual({
        schemaVersion: 2,
        staff: { basis: 'manual', rate: 35000, amount: 35000 },
        owner: { basis: 'none', rate: 0, amount: 0 },
        recordingOperator: { basis: 'manual', rate: 150000, amount: 150000 },
        settingsVersion: 1,
      });
    });

    it('preserves full backward compatibility with legacy Phase 5 (null commission) and Phase 6 V1 bookings', async () => {
      const legacyV1Booking = normalizeBookingRecord('bkg-legacy-v1', {
        id: 'bkg-legacy-v1',
        customerName: 'Legacy V1 Band',
        phone: '081111222333',
        bandName: 'V1 Rock',
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
        commissionSnapshot: {
          staffBasis: 'rehearsal_hourly',
          staffRate: 10000,
          staffAmount: 20000,
          recordingOperatorAmount: 0,
          settingsVersion: 1,
        },
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
        initialPaidAmount: 200000,
        paymentMethod: 'cash',
        sessionStatus: 'upcoming',
        notes: 'Phase 6 V1 booking',
        createdByUid: 'owner-uid-1',
        updatedByUid: 'owner-uid-1',
        version: 1,
      });

      const phase5Booking = normalizeBookingRecord('bkg-legacy-p5', {
        id: 'bkg-legacy-p5',
        customerName: 'Phase 5 Band',
        phone: '081122334455',
        studioId: 'room-b',
        serviceId: 'rehearsal',
        serviceLabel: 'Rehearsal',
        date: todayIso,
        startMinute: 720,
        durationMinutes: 60,
        endMinute: 780,
        unitRate: 100000,
        subtotal: 100000,
        discountAmount: 0,
        totalAmount: 100000,
        initialPaymentStatus: INITIAL_PAYMENT_STATUS.UNPAID,
        initialPaidAmount: 0,
        sessionStatus: 'upcoming',
        version: 1,
      });

      expect(legacyV1Booking.commissionSnapshot.staffBasis).toBe('rehearsal_hourly');
      expect(phase5Booking.commissionSnapshot).toBeNull();

      bookingAdapter = createInMemoryBookingRepositoryAdapter([legacyV1Booking, phase5Booking]);
      setBookingRepositoryAdapter(bookingAdapter);

      // Rescheduling legacy V1 booking against updated V2 Settings preserves V1 commissionSnapshot & price
      const rescheduled = await updateOrRescheduleBooking({
        bookingId: legacyV1Booking.id,
        expectedVersion: 1,
        actorUid: 'owner-uid-1',
        mode: 'reschedule',
        pricingSettings: DEFAULT_PRICING_SETTINGS,
        formValues: {
          customerName: legacyV1Booking.customerName,
          phone: legacyV1Booking.phone,
          bandName: legacyV1Booking.bandName,
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'rehearsal-regular',
          studioId: 'room-a',
          date: todayIso,
          startMinute: 840,
          durationPreset: '120',
          customDurationMinutes: '120',
          notes: 'Rescheduled safely',
        },
        adapter: bookingAdapter,
      });

      expect(rescheduled.startMinute).toBe(840);
      expect(rescheduled.totalAmount).toBe(200000);
      expect(rescheduled.commissionSnapshot).toEqual(legacyV1Booking.commissionSnapshot);
    });
  });

  describe('F. Firestore Security Rules V2 Contract Verification', () => {
    it('enforces Schema V2 Owner-only writes on settings/pricing, Studio-only deliveryMode on bookings, and V1+V2 commissionSnapshot compatibility', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      expect(rulesContent).toContain('match /settings/pricing');
      expect(rulesContent).toContain('allow get: if isActiveStaff();');
      expect(rulesContent).toContain('allow create: if isActiveOwner()');
      expect(rulesContent).toContain('allow update: if isActiveOwner()');
      expect(rulesContent).toContain('allow list: if false;');
      expect(rulesContent).toContain('allow delete: if false;');
      expect(rulesContent).toContain('data.schemaVersion == 2');
      expect(rulesContent).toContain('data.serviceTypes is list');
      expect(rulesContent).toContain('function isValidOperationalSettingsV2(settings)');

      expect(rulesContent).toContain('function isValidBookingV2ServiceFields(data)');
      expect(rulesContent).toContain("data.deliveryMode == 'studio'");
      expect(rulesContent).toContain('function isValidBookingCommissionSnapshotV1(snap)');
      expect(rulesContent).toContain('function isValidBookingCommissionSnapshotV2(snap)');
      expect(rulesContent).toContain(
        "reqData.get('serviceOptionId', '') == resData.get('serviceOptionId', '')",
      );
    });
  });
});
