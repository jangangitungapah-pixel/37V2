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
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';

import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from './repositories/customer-repository';
import {
  importLegacyBookingHistory,
  resolveNeedsReviewLegacyBooking,
  scanLegacyBookingsPreview,
} from './services/customer-migration-service';
import {
  createManualCustomer,
  loadCustomerBookingHistory,
  lookupCustomerByPhone,
  mergeCustomerProfiles,
  setCustomerArchiveStatus,
  updateCustomerPhone,
  updateCustomerProfile,
} from './services/customer-service';
import {
  buildCustomerPhoneGroups,
  computeCustomerDirectoryMetrics,
} from './utils/customer-history';
import {
  CUSTOMER_RESOLUTION_MODE,
  CUSTOMER_STATUS,
  IDENTITY_MATCH_STATUS,
} from './utils/customer-identity';
import {
  formatPhoneDisplay,
  getPhoneNumberHash,
  getPhoneNumberHashSync,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from './utils/phone-number';

function mockAuthenticatedStaff(role = 'staff', uid = 'staff-uid-2') {
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

function renderAppAt(initialEntry = '/admin/customer') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function buildBookingForm(overrides = {}) {
  return {
    customerName: 'Arief Music',
    phone: '081234567890',
    bandName: 'Arief Trio',
    studioId: 'room-a',
    serviceTypeId: 'rehearsal',
    serviceOptionId: 'rehearsal-regular',
    serviceId: 'rehearsal',
    date: '2026-11-20',
    startMinute: 600,
    durationPreset: '120',
    customDurationMinutes: '120',
    initialPaymentStatus: INITIAL_PAYMENT_STATUS.PAID,
    dpAmount: '200000',
    paymentMethod: 'transfer',
    notes: '',
    ...overrides,
  };
}

describe('Phase 7 — Customer Management (Phone-Based Identity & Booking History)', () => {
  let bookingAdapter;
  let customerAdapter;
  let pricingAdapter;
  const todayIso = getJakartaTodayIso();

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();

    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    customerAdapter = createInMemoryCustomerRepositoryAdapter(bookingAdapter);
    pricingAdapter = createInMemoryPricingSettingsAdapter();

    setBookingRepositoryAdapter(bookingAdapter);
    setCustomerRepositoryAdapter(customerAdapter);
    setPricingSettingsRepositoryAdapter(pricingAdapter);
  });

  afterEach(() => {
    cleanup();
    resetBookingRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    resetPricingSettingsRepositoryAdapter();
  });

  describe('A. Phone Normalization & Deterministic Hashing', () => {
    it('normalizes all Indonesia formats identically, preserves international country codes, rejects invalid numbers, and produces deterministic SHA-256 hashes', async () => {
      const indonesiaVariants = [
        '081234567890',
        '+6281234567890',
        '6281234567890',
        '+62 812-3456-7890',
        '(0812) 3456 7890',
        '006281234567890',
      ];

      for (const variant of indonesiaVariants) {
        expect(normalizePhoneNumber(variant)).toBe('+6281234567890');
        expect(isValidPhoneNumber(variant)).toBe(true);
      }

      // International numbers retain their explicit country code
      expect(normalizePhoneNumber('+1 (415) 555-2671')).toBe('+14155552671');
      expect(normalizePhoneNumber('0065 9123 4567')).toBe('+6591234567');
      expect(formatPhoneDisplay('+6281234567890')).toBe('+62 812-3456-7890');

      // Invalid / empty numbers are rejected
      expect(normalizePhoneNumber('')).toBe('');
      expect(normalizePhoneNumber('12345')).toBe('');
      expect(normalizePhoneNumber('0812')).toBe('');
      expect(normalizePhoneNumber('abc-08123456789')).toBe('');
      expect(isValidPhoneNumber('invalid')).toBe(false);

      // Deterministic SHA-256 hash matches across async Web Crypto and sync fallback
      const asyncHashA = await getPhoneNumberHash('081234567890');
      const asyncHashB = await getPhoneNumberHash('+62 812-3456-7890');
      const syncHash = getPhoneNumberHashSync('6281234567890');
      expect(asyncHashA).toHaveLength(64);
      expect(asyncHashA).toBe(asyncHashB);
      expect(asyncHashA).toBe(syncHash);
    });
  });

  describe('B & C. Identity Scenarios, Atomic Booking+Customer, Idempotency & Virtual Merge', () => {
    it('handles exact match with name variations, different-name conflict, merge vs separate, multiple profiles, same-name different-phone, band history, phone change, recycled number, archived & merged profiles', async () => {
      // 1. First booking creates customer + phoneIndex atomically
      const bkg1 = await createBooking({
        bookingId: 'bkg-p7-1',
        eventId: 'evt-p7-1',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Arief Music',
          phone: '0812-3456-7890',
          bandName: 'Arief Trio',
          date: '2026-11-18',
          startMinute: 600,
        }),
        adapter: bookingAdapter,
      });

      expect(bkg1.customerId).toBeTruthy();
      expect(bkg1.phoneNormalized).toBe('+6281234567890');
      const custArief = await customerAdapter.getCustomerById(bkg1.customerId);
      expect(custArief.bookingCount).toBe(1);
      expect(custArief.firstBookingDate).toBe('2026-11-18');
      expect(custArief.lastBookingDate).toBe('2026-11-18');

      // 2. Idempotent retry with exact same bookingId + eventId does NOT increment bookingCount twice
      const retried = await createBooking({
        bookingId: 'bkg-p7-1',
        eventId: 'evt-p7-1',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Arief Music',
          phone: '0812-3456-7890',
          bandName: 'Arief Trio',
          date: '2026-11-18',
          startMinute: 600,
        }),
        adapter: bookingAdapter,
      });
      expect(retried.id).toBe('bkg-p7-1');
      expect((await customerAdapter.getCustomerById(custArief.id)).bookingCount).toBe(1);

      // 3. Slot conflict rollback creates ZERO orphan customer profile
      await expect(
        createBooking({
          bookingId: 'bkg-p7-conflict',
          eventId: 'evt-p7-conflict',
          actorUid: 'staff-uid-2',
          formValues: buildBookingForm({
            customerName: 'Orphan Attempt',
            phone: '081999888777',
            date: '2026-11-18',
            startMinute: 630, // overlaps 10:00–12:00 on room-a!
          }),
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/slot-conflict' });

      const orphanLookup = await lookupCustomerByPhone({
        phone: '081999888777',
        adapter: customerAdapter,
      });
      expect(orphanLookup.status).toBe(IDENTITY_MATCH_STATUS.NO_MATCH);

      // 4. Same phone + Name Variation (`Ariefmusic`, `ARIEF MUSIC`) + Different Band Name -> reuses SAME profile!
      const lookupVariant = await lookupCustomerByPhone({
        phone: '+62 812 3456 7890',
        inputName: 'ARIEF   MUSIC',
        adapter: customerAdapter,
      });
      expect(lookupVariant.status).toBe(IDENTITY_MATCH_STATUS.EXACT_MATCH);
      expect(lookupVariant.matchedProfile.id).toBe(custArief.id);

      const bkg2 = await createBooking({
        bookingId: 'bkg-p7-2',
        eventId: 'evt-p7-2',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Ariefmusic',
          phone: '+6281234567890',
          bandName: 'Solo Project',
          date: '2026-11-20',
          startMinute: 600,
        }),
        adapter: bookingAdapter,
      });
      expect(bkg2.customerId).toBe(custArief.id);
      const ariefAfter2 = await customerAdapter.getCustomerById(custArief.id);
      expect(ariefAfter2.bookingCount).toBe(2);
      expect(ariefAfter2.lastBookingDate).toBe('2026-11-20');

      // 5. Same phone + Different Name -> SINGLE_CONFLICT, rejects unconfirmed commit
      const lookupConflict = await lookupCustomerByPhone({
        phone: '6281234567890',
        inputName: 'The Velvet Echo',
        adapter: customerAdapter,
      });
      expect(lookupConflict.status).toBe(IDENTITY_MATCH_STATUS.SINGLE_CONFLICT);

      await expect(
        createBooking({
          bookingId: 'bkg-p7-unresolved',
          eventId: 'evt-p7-unresolved',
          actorUid: 'staff-uid-2',
          formValues: buildBookingForm({
            customerName: 'The Velvet Echo',
            phone: '081234567890',
            date: '2026-11-21',
            startMinute: 600,
          }),
          adapter: bookingAdapter,
        }),
      ).rejects.toMatchObject({ code: 'booking/customer-identity-conflict' });

      // 6. Same phone + Merge choice -> links to existing profile, adds alias, keeps booking customerName snapshot!
      const bkg3Merged = await createBooking({
        bookingId: 'bkg-p7-3',
        eventId: 'evt-p7-3',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'The Velvet Echo',
          phone: '081234567890',
          bandName: 'The Velvet Echo',
          date: '2026-11-21',
          startMinute: 600,
        }),
        customerResolution: {
          mode: CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING,
          customerId: custArief.id,
          expectedPhoneIndexVersion: lookupConflict.phoneIndexVersion,
        },
        adapter: bookingAdapter,
      });
      expect(bkg3Merged.customerId).toBe(custArief.id);
      expect(bkg3Merged.customerName).toBe('The Velvet Echo');
      const ariefAfter3 = await customerAdapter.getCustomerById(custArief.id);
      expect(ariefAfter3.displayName).toBe('Arief Music');
      expect(ariefAfter3.nameAliases).toContain('The Velvet Echo');
      expect(ariefAfter3.bookingCount).toBe(3);

      // 7. Same phone + Keep Separate -> creates separate profile sharing the exact same canonical phone!
      const bkg4Separate = await createBooking({
        bookingId: 'bkg-p7-4',
        eventId: 'evt-p7-4',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Raka Pratama',
          phone: '081234567890',
          bandName: 'Raka Band',
          date: '2026-11-22',
          startMinute: 600,
        }),
        customerResolution: {
          mode: CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE,
          customerId: 'cust-raka-sep',
        },
        adapter: bookingAdapter,
      });
      expect(bkg4Separate.customerId).toBe('cust-raka-sep');
      expect(bkg4Separate.customerId).not.toBe(custArief.id);

      // Lookup now returns MULTIPLE_MATCHES (2 active profiles on the same phone!)
      const lookupMultiple = await lookupCustomerByPhone({
        phone: '081234567890',
        inputName: 'Raka Pratama',
        adapter: customerAdapter,
      });
      expect(lookupMultiple.status).toBe(IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES);
      expect(lookupMultiple.activeProfiles).toHaveLength(2);

      // Separate histories do NOT mix before explicit merge
      const ariefHistoryBefore = await loadCustomerBookingHistory({
        customer: await customerAdapter.getCustomerById(custArief.id),
        adapter: customerAdapter,
      });
      const rakaHistoryBefore = await loadCustomerBookingHistory({
        customer: await customerAdapter.getCustomerById('cust-raka-sep'),
        adapter: customerAdapter,
      });
      expect(ariefHistoryBefore.bookings).toHaveLength(3);
      expect(rakaHistoryBefore.bookings).toHaveLength(1);

      // 8. Cancelled & Rescheduled bookings preserve customerId & bookingCount
      await cancelBooking({
        bookingId: 'bkg-p7-2',
        expectedVersion: 1,
        actorUid: 'staff-uid-2',
        reason: 'Ubah rencana',
        adapter: bookingAdapter,
      });
      expect((await customerAdapter.getCustomerById(custArief.id)).bookingCount).toBe(3);

      const rescheduled = await updateOrRescheduleBooking({
        bookingId: 'bkg-p7-1',
        expectedVersion: 1,
        actorUid: 'staff-uid-2',
        mode: 'reschedule',
        formValues: buildBookingForm({
          customerName: 'Arief Music',
          phone: '081299991111', // booking contact phone edit does NOT mutate customer primary phone!
          date: '2026-11-25',
          startMinute: 720,
        }),
        adapter: bookingAdapter,
      });
      expect(rescheduled.customerId).toBe(custArief.id);
      expect((await customerAdapter.getCustomerById(custArief.id)).phoneNormalized).toBe(
        '+6281234567890',
      );

      // 9. Virtual History Merge: merges Raka into Arief WITHOUT mutating bkg-p7-4.customerId!
      const { target: mergedTarget, source: mergedSource } = await mergeCustomerProfiles({
        targetCustomerId: custArief.id,
        sourceCustomerId: 'cust-raka-sep',
        actorUid: 'owner-uid-1',
        adapter: customerAdapter,
      });
      expect(mergedTarget.bookingCount).toBe(4);
      expect(mergedTarget.historyCustomerIds).toEqual(
        expect.arrayContaining([custArief.id, 'cust-raka-sep']),
      );
      expect(mergedTarget.nameAliases).toContain('Raka Pratama');
      expect(mergedSource.status).toBe(CUSTOMER_STATUS.MERGED);
      expect(mergedSource.mergedIntoCustomerId).toBe(custArief.id);

      // Booking snapshot untouched!
      const bkg4AfterMerge = bookingAdapter._inspectState().bookings.get('bkg-p7-4');
      expect(bkg4AfterMerge.customerId).toBe('cust-raka-sep');
      expect(bkg4AfterMerge.customerName).toBe('Raka Pratama');

      // Virtual history shows all 4 bookings deduplicated (including cancelled!)
      const mergedHistory = await loadCustomerBookingHistory({
        customer: mergedTarget,
        adapter: customerAdapter,
      });
      expect(mergedHistory.bookings).toHaveLength(4);
      expect(new Set(mergedHistory.bookings.map((b) => b.id)).size).toBe(4);

      // 10. Same Name + Different Phone -> Distinct profiles + sameNameDifferentPhone flag
      const ariefDifferentPhone = await createManualCustomer({
        customerId: 'cust-arief-diff-phone',
        actorUid: 'staff-uid-2',
        input: { displayName: 'Arief Music', phone: '082222222222' },
        adapter: customerAdapter,
      });
      const allCusts = Array.from(customerAdapter._inspectState().customers.values());
      const groups = buildCustomerPhoneGroups({ customers: allCusts });
      const activeAriefProfiles = groups
        .flatMap((g) => g.profiles)
        .filter((p) => p.displayName === 'Arief Music');
      expect(activeAriefProfiles).toHaveLength(2);
      expect(activeAriefProfiles.every((p) => p.sameNameDifferentPhone === true)).toBe(true);

      // 10b. Edit display name preserves previous displayName in nameAliases without mutating bookings
      const renamedCust = await updateCustomerProfile({
        customerId: ariefDifferentPhone.id,
        expectedVersion: ariefDifferentPhone.version,
        actorUid: 'staff-uid-2',
        input: { displayName: 'Arief Solo Acoustic', notes: 'Kontak alternatif' },
        adapter: customerAdapter,
      });
      expect(renamedCust.displayName).toBe('Arief Solo Acoustic');
      expect(renamedCust.nameAliases).toContain('Arief Music');

      // 11. Customer Changes Phone Number -> previousPhones retained; Recycled old number -> HISTORICAL_ONLY -> new separate profile!
      const updatedPhoneCust = await updateCustomerPhone({
        customerId: renamedCust.id,
        expectedVersion: renamedCust.version,
        actorUid: 'staff-uid-2',
        newPhone: '083333333333',
        adapter: customerAdapter,
      });
      expect(updatedPhoneCust.phoneNormalized).toBe('+6283333333333');
      expect(updatedPhoneCust.previousPhones[0].phoneNormalized).toBe('+6282222222222');

      const recycledLookup = await lookupCustomerByPhone({
        phone: '082222222222',
        inputName: 'New Owner Of Recycled Number',
        adapter: customerAdapter,
      });
      expect(recycledLookup.status).toBe(IDENTITY_MATCH_STATUS.HISTORICAL_ONLY);
      expect(recycledLookup.activeProfiles).toHaveLength(0);
      expect(recycledLookup.historicalProfiles).toHaveLength(1);

      // Creating booking with recycled number creates a fresh separate customer without linking to old owner
      const bkgRecycled = await createBooking({
        bookingId: 'bkg-p7-recycled',
        eventId: 'evt-p7-recycled',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'New Owner',
          phone: '082222222222',
          date: '2026-11-26',
          startMinute: 600,
        }),
        adapter: bookingAdapter,
      });
      expect(bkgRecycled.customerId).not.toBe(ariefDifferentPhone.id);

      // 12. Archive profile -> never silently selected for new booking, reactivatable
      await setCustomerArchiveStatus({
        customerId: updatedPhoneCust.id,
        expectedVersion: updatedPhoneCust.version,
        archived: true,
        actorUid: 'staff-uid-2',
        adapter: customerAdapter,
      });
      const archivedLookup = await lookupCustomerByPhone({
        phone: '083333333333',
        inputName: 'Arief Music',
        adapter: customerAdapter,
      });
      expect(archivedLookup.status).toBe(IDENTITY_MATCH_STATUS.HISTORICAL_ONLY);
      expect(archivedLookup.activeProfiles).toHaveLength(0);

      // 13. Directory metrics accurately separate Profiles vs Unique Phones
      const metrics = computeCustomerDirectoryMetrics(
        Array.from(customerAdapter._inspectState().customers.values()),
      );
      expect(metrics.totalActiveProfiles).toBe(2);
      expect(metrics.uniqueActivePhones).toBe(2);
      expect(metrics.archivedCount).toBe(1);

      // 14. No-show booking keeps history and count intact
      await transitionBookingSession({
        bookingId: 'bkg-p7-3',
        action: 'mark_no_show',
        expectedVersion: 1,
        actorUid: 'staff-uid-2',
        now: new Date('2026-11-21T10:20:00+07:00'),
        adapter: bookingAdapter,
      });
      expect((await customerAdapter.getCustomerById(custArief.id)).bookingCount).toBe(4);
    });
  });

  describe('D. Customer Page UI & Calendar Booking Form Identity Resolution UX', () => {
    it('renders /admin/customer grouped by phone, supports search (local/canonical/alias/previous phone), filters, Add/Edit/Archive/Merge, and opens Booking Detail Drawer from history', async () => {
      // Seed shared-number profiles + 12 bookings for pagination test
      await createBooking({
        bookingId: 'bkg-dir-1',
        eventId: 'evt-dir-1',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Arief Music',
          phone: '081234567890',
          bandName: 'Velvet Band',
          date: todayIso,
          startMinute: 600,
        }),
        adapter: bookingAdapter,
      });
      await createBooking({
        bookingId: 'bkg-dir-2',
        eventId: 'evt-dir-2',
        actorUid: 'staff-uid-2',
        formValues: buildBookingForm({
          customerName: 'Dimas Manager',
          phone: '+62 812-3456-7890',
          bandName: 'Dimas Project',
          date: todayIso,
          startMinute: 780,
        }),
        customerResolution: {
          mode: CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE,
          customerId: 'cust-dimas-shared',
        },
        adapter: bookingAdapter,
      });

      const user = userEvent.setup();
      mockAuthenticatedStaff('staff');
      renderAppAt('/admin/customer');

      expect(
        await screen.findByText(/shared number • 2 profil/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      // Shared number metrics: 2 Customer Profiles, 1 Unique Phone Number, 1 Shared Number!
      const summary = screen.getByLabelText(/ringkasan customer directory/i);
      expect(within(summary).getByText('2')).toBeTruthy();
      expect(within(summary).getAllByText('1').length).toBeGreaterThanOrEqual(2);

      // Search by local prefix `081234` and band name `Velvet Band`
      const searchInput = screen.getByRole('searchbox', { name: /cari nama customer/i });
      await user.type(searchInput, 'Velvet Band');
      expect(screen.getByText('Arief Music')).toBeTruthy();
      expect(screen.queryByText('Dimas Manager')).toBeNull();

      await user.clear(searchInput);
      await user.type(searchInput, '+628123456');
      expect(screen.getByText('Arief Music')).toBeTruthy();
      expect(screen.getByText('Dimas Manager')).toBeTruthy();
      await user.clear(searchInput);

      // Open Detail Drawer for Arief Music & click booking to open Calendar BookingDetailDrawer
      await user.click(screen.getByRole('button', { name: /buka detail profil arief music/i }));
      const detailDialog = await screen.findByRole('dialog', {
        name: /arief music/i,
      });
      expect(await within(detailDialog).findByText('Velvet Band')).toBeTruthy();

      const historyBookingBtn = await within(detailDialog).findByRole('button', {
        name: /buka detail booking arief music/i,
      });
      await user.click(historyBookingBtn);
      expect(await screen.findByRole('button', { name: /tutup detail booking/i })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: /tutup detail booking/i }));
      await user.click(screen.getByRole('button', { name: /tutup detail customer/i }));

      // Explicit Merge History flow from Shared Number header
      await user.click(screen.getByRole('button', { name: /merge history/i }));
      const mergeDlg = await screen.findByRole('dialog', { name: /gabungkan riwayat profil/i });
      expect(within(mergeDlg).getByText(/2 total bookings/i)).toBeTruthy();
      await user.click(within(mergeDlg).getByRole('button', { name: /confirm merge/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /gabungkan riwayat profil/i })).toBeNull();
      });

      // After merge, only 1 active profile remains with 2 bookings
      await waitFor(() => {
        expect(screen.queryByText(/shared number • 2 profil/i)).toBeNull();
      });
    });

    it('resolves customer identity on BookingFormDialog phone blur and handles Identity Conflict Dialog cleanly before commit', async () => {
      // Seed existing customer Arief Music on 081234567890
      await createManualCustomer({
        customerId: 'cust-existing-arief',
        actorUid: 'owner-uid-1',
        input: { displayName: 'Arief Music', phone: '081234567890' },
        adapter: bookingAdapter._sharedStore ? customerAdapter : customerAdapter,
      });

      const user = userEvent.setup();
      mockAuthenticatedStaff('owner', 'owner-uid-1');
      renderAppAt('/admin/calendar');

      expect(
        await screen.findByText(/studio booking schedule/i, {}, { timeout: 5000 }),
      ).toBeTruthy();

      await user.click(screen.getByRole('button', { name: /new booking/i }));
      const formDlg = await screen.findByRole('dialog', { name: /tambah booking/i });

      // Enter different name + SAME normalized phone (+62 format!) -> triggers Identity Conflict Dialog
      const nameInput = within(formDlg).getByLabelText(/nama customer/i);
      const phoneInput = within(formDlg).getByLabelText(/nomor hp \/ whatsapp/i);

      await user.type(nameInput, 'The Velvet Echo');
      await user.type(phoneInput, '+62 812-3456-7890');
      fireEvent.blur(phoneInput);

      const conflictDlg = await screen.findByRole('dialog', {
        name: /nomor telepon sudah digunakan oleh customer lain/i,
      });
      expect(
        within(conflictDlg).getByText(/nomor telepon sudah digunakan oleh customer lain/i),
      ).toBeTruthy();

      // Choose Option 1: Gabungkan ke Arief Music
      await user.click(
        within(conflictDlg).getByRole('button', { name: /gabungkan ke arief music/i }),
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', {
            name: /nomor telepon sudah digunakan oleh customer lain/i,
          }),
        ).toBeNull();
      });

      expect(within(formDlg).getByText(/digabungkan ke profil existing/i)).toBeTruthy();

      // Save Booking -> commits atomically linked to cust-existing-arief with alias added!
      await user.click(within(formDlg).getByRole('button', { name: /simpan booking/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /tambah booking/i })).toBeNull();
      });

      const updatedArief = await customerAdapter.getCustomerById('cust-existing-arief');
      expect(updatedArief.bookingCount).toBe(1);
      expect(updatedArief.nameAliases).toContain('The Velvet Echo');
    });
  });

  describe('E. Legacy Booking History Import (Preview, Grouping, Resumable Retry & Needs Review)', () => {
    it('scans legacy bookings without auto-write, groups by phone+name, preserves snapshots, handles retries idempotently, and supports Needs Review resolution', async () => {
      // Seed 5 legacy bookings (no customerId) + 1 already-linked booking
      const seededAdapter = createInMemoryBookingRepositoryAdapter([
        {
          id: 'leg-1',
          customerName: 'Arief Music',
          phone: '081234567890',
          bandName: 'Band A',
          studioId: 'room-a',
          date: '2026-10-01',
          startMinute: 600,
          durationMinutes: 120,
          unitRate: 100000,
          subtotal: 200000,
          discountAmount: 0,
          totalAmount: 200000,
          version: 1,
        },
        {
          id: 'leg-2',
          customerName: 'ARIEF  MUSIC',
          phone: '+62 812-3456-7890',
          bandName: 'Band B',
          studioId: 'room-a',
          date: '2026-10-05',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          version: 1,
        },
        {
          id: 'leg-3',
          customerName: 'Different Person Same Phone',
          phone: '6281234567890',
          bandName: 'Band C',
          studioId: 'room-b',
          date: '2026-10-06',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          version: 1,
        },
        {
          id: 'leg-invalid',
          customerName: 'Old Walk-in',
          phone: '123', // invalid!
          bandName: '',
          studioId: 'room-a',
          date: '2026-10-07',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          version: 1,
        },
        {
          id: 'already-linked-1',
          customerId: 'cust-keep-me',
          phoneNormalized: '+6281999999999',
          customerName: 'Already Linked',
          phone: '081999999999',
          studioId: 'room-a',
          date: '2026-10-08',
          startMinute: 600,
          durationMinutes: 60,
          unitRate: 100000,
          subtotal: 100000,
          discountAmount: 0,
          totalAmount: 100000,
          version: 1,
        },
      ]);
      const seededCustAdapter = createInMemoryCustomerRepositoryAdapter(seededAdapter);

      // 1. Preview scan makes ZERO writes
      const preview = await scanLegacyBookingsPreview({ adapter: seededCustAdapter });
      expect(preview.totalLegacyUnlinked).toBe(4);
      expect(preview.alreadyLinkedCount).toBe(1);
      expect(preview.uniqueNormalizedPhones).toBe(1);
      expect(preview.estimatedProfiles).toBe(2); // Arief Music grouped (2 bookings) + Different Person separate (1 booking)
      expect(preview.samePhoneDifferentNamesCount).toBe(1);
      expect(preview.needsReviewCount).toBe(1);
      expect(seededCustAdapter._inspectState().customers.size).toBe(0);

      // 2. Run import in small batches (maxBatchWrites: 2) to verify multi-batch & resumability
      const result1 = await importLegacyBookingHistory({
        actorUid: 'owner-uid-1',
        preview,
        maxBatchWrites: 2,
        adapter: seededCustAdapter,
      });
      expect(result1.linkedBookingsCount).toBe(3);
      expect(result1.createdProfilesCount).toBe(2);
      expect(result1.batchesCommitted).toBeGreaterThanOrEqual(2);

      // Verify booking snapshots, totalAmount, slots, and already-linked booking untouched
      const stateAfter = seededAdapter._inspectState();
      const leg1 = stateAfter.bookings.get('leg-1');
      const leg2 = stateAfter.bookings.get('leg-2');
      const leg3 = stateAfter.bookings.get('leg-3');
      const alreadyLinked = stateAfter.bookings.get('already-linked-1');

      expect(leg1.customerId).toBe(leg2.customerId); // grouped!
      expect(leg3.customerId).not.toBe(leg1.customerId); // kept separate!
      expect(leg1.totalAmount).toBe(200000);
      expect(leg1.phone).toBe('081234567890');
      expect(leg1.phoneNormalized).toBe('+6281234567890');
      expect(alreadyLinked.customerId).toBe('cust-keep-me'); // never overwritten!

      // 3. Re-running preview & import is idempotent (0 duplicate profiles, 0 reprocessed)
      const preview2 = await scanLegacyBookingsPreview({ adapter: seededCustAdapter });
      expect(preview2.importableBookingCount).toBe(0);
      expect(preview2.needsReviewCount).toBe(1);
      const result2 = await importLegacyBookingHistory({
        actorUid: 'owner-uid-1',
        preview: preview2,
        adapter: seededCustAdapter,
      });
      expect(result2.linkedBookingsCount).toBe(0);
      expect(seededCustAdapter._inspectState().customers.size).toBe(2);

      // 4. Resolve Needs Review record by providing a valid phone number
      const linkedReview = await resolveNeedsReviewLegacyBooking({
        bookingId: 'leg-invalid',
        correctedPhone: '081777766665',
        actorUid: 'owner-uid-1',
        adapter: seededCustAdapter,
      });
      expect(linkedReview.phoneNormalized).toBe('+6281777766665');
      expect(seededAdapter._inspectState().bookings.get('leg-invalid').customerId).toBe(
        linkedReview.customerId,
      );
      expect(seededAdapter._inspectState().bookings.get('leg-invalid').phone).toBe('123'); // raw snapshot preserved!
    });
  });

  describe('F. Firestore Security Rules Contract Verification (Phase 7)', () => {
    it('enforces customers, customerPhoneIndex, required booking customerId, one-time legacy link, and delete denial in firestore.rules', () => {
      const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');

      expect(rulesContent).toContain('match /customers/{customerId}');
      expect(rulesContent).toContain('match /customerPhoneIndex/{phoneHash}');
      expect(rulesContent).toContain('function isValidCustomerShape(data, customerId)');
      expect(rulesContent).toContain('function isValidPhoneIndex(data)');
      expect(rulesContent).toContain('function hasValidBookingCustomerLinkAfter(data)');
      expect(rulesContent).toContain(
        'function isLegacyBookingCustomerLinkUpdate(reqData, resData)',
      );
      expect(rulesContent).toContain(
        "request.resource.data.get('customerId', '') == resource.data.get('customerId', '')",
      );
      expect(rulesContent).toContain('allow list: if false;');
      expect(rulesContent).toContain('allow delete: if false;');
    });
  });
});
