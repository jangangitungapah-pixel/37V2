import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '@/App';
import { ADMIN_NAVIGATION_ITEMS } from '@/features/admin/navigation/admin-navigation';
import { AuthContext } from '@/features/auth/AuthContext';

import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { StudioProfilePage } from './pages/StudioProfilePage';
import {
  DEFAULT_STUDIO_PROFILE,
  STUDIO_PROFILE_SCHEMA_VERSION,
} from './studio-profile/config/default-studio-profile';
import {
  createInMemoryStudioProfileAdapter,
  resetStudioProfileRepositoryAdapter,
  setStudioProfileRepositoryAdapter,
} from './studio-profile/repositories/studio-profile-repository';
import { validateStudioProfile } from './studio-profile/schemas/studio-profile-schema';
import { saveStudioProfile } from './studio-profile/services/studio-profile-service';
import { formatStudioWhatsappDisplay } from './studio-profile/utils/normalize-studio-profile';
import { formatSettingsTimestamp } from './utils/settings-formatters';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-pathname">{location.pathname}</div>;
}

function buildAuthValue({
  uid = 'owner-uid-1',
  role = 'owner',
  displayName = 'Owner Studio 37',
  email = 'owner@37music.id',
  active = true,
  lastSignInTime = '2026-11-22T01:30:00.000Z',
  includeProfile = true,
  resetPassword = vi.fn().mockResolvedValue({
    message:
      'Jika alamat email tersebut terdaftar dan aktif, tautan reset password akan dikirim melalui Firebase Authentication.',
  }),
} = {}) {
  return {
    user: {
      uid,
      email,
      displayName,
      metadata: {
        lastSignInTime,
      },
    },
    profile: includeProfile
      ? {
          uid,
          role,
          displayName,
          email,
          active,
        }
      : null,
    role,
    status: 'authenticated',
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
    resetPassword,
    clearAuthError: vi.fn(),
  };
}

function renderWithAuth(ui, { route = '/admin/settings', authValue = buildAuthValue() } = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  resetStudioProfileRepositoryAdapter();
});

describe('Settings Center Overview (/admin/settings)', () => {
  it('renders Studio Configuration, Personal Settings, active + non-interactive planned cards, and System Baseline', () => {
    renderWithAuth(<AdminSettingsPage />, { route: '/admin/settings' });

    expect(screen.getByRole('heading', { level: 2, name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Studio Configuration' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Personal Settings' })).toBeTruthy();

    // Active module cards
    expect(screen.getByRole('link', { name: /open studio profile/i }).getAttribute('href')).toBe(
      '/admin/settings/studio-profile',
    );
    expect(
      screen.getByRole('link', { name: /open price and fee settings/i }).getAttribute('href'),
    ).toBe('/admin/settings/price-and-fee');
    expect(
      screen.getByRole('link', { name: /open account & security/i }).getAttribute('href'),
    ).toBe('/admin/settings/account-security');

    // Strictly non-interactive planned cards
    const operationsHeading = screen.getByRole('heading', {
      level: 3,
      name: 'Operations & Booking Rules',
    });
    const operationsCard = operationsHeading.closest('article');
    expect(operationsCard.getAttribute('aria-disabled')).toBe('true');
    expect(within(operationsCard).getByText('PLANNED')).toBeTruthy();
    expect(within(operationsCard).queryAllByRole('link')).toHaveLength(0);
    expect(within(operationsCard).queryAllByRole('button')).toHaveLength(0);

    const notificationsHeading = screen.getByRole('heading', {
      level: 3,
      name: 'Notifications & Devices',
    });
    const notificationsCard = notificationsHeading.closest('article');
    expect(notificationsCard.getAttribute('aria-disabled')).toBe('true');
    expect(within(notificationsCard).getByText('PLANNED')).toBeTruthy();
    expect(within(notificationsCard).queryAllByRole('link')).toHaveLength(0);
    expect(within(notificationsCard).queryAllByRole('button')).toHaveLength(0);

    // Read-only System Baseline panel
    expect(screen.getByRole('heading', { level: 2, name: 'System Baseline' })).toBeTruthy();
    expect(screen.getByText('IDR (Indonesian Rupiah)')).toBeTruthy();
    expect(screen.getByText('Asia/Jakarta (WIB)')).toBeTruthy();
    expect(screen.getByText('Indonesian locale, 24-hour format')).toBeTruthy();
    expect(screen.getByText('Firebase Authentication + Cloud Firestore')).toBeTruthy();
  });

  it('navigates between /admin/settings and sub-pages inside AppRoutes while keeping 8 top-level sidebar links', async () => {
    const adapter = createInMemoryStudioProfileAdapter(null);
    setStudioProfileRepositoryAdapter(adapter);
    const user = userEvent.setup();

    renderWithAuth(<AppRoutes />, { route: '/admin/settings' });

    expect(ADMIN_NAVIGATION_ITEMS).toHaveLength(8);
    const nav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
    expect(within(nav).getAllByRole('link')).toHaveLength(8);

    await user.click(screen.getByRole('link', { name: /open studio profile/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-pathname').textContent).toBe(
        '/admin/settings/studio-profile',
      );
    });
    expect(
      screen.getByRole('heading', { level: 2, name: /studio profile & contact/i }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /back to settings/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-pathname').textContent).toBe('/admin/settings');
    });

    await user.click(screen.getByRole('link', { name: /open account & security/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-pathname').textContent).toBe(
        '/admin/settings/account-security',
      );
    });
    expect(screen.getByRole('heading', { level: 2, name: /account & security/i })).toBeTruthy();
  });
});

describe('Studio Profile domain, validation, versioning & concurrency', () => {
  it('validates fields cleanly, normalizes Indonesian WhatsApp numbers, and blocks unsafe URLs', () => {
    const valid = validateStudioProfile({
      studioName: '  37 Music Studio Kemang  ',
      tagline: '  Rekaman & Mixing Berkualitas  ',
      whatsappNumber: '0812-3456-7890',
      email: 'Studio@37Music.ID ',
      address: 'Jl. Kemang Raya No. 37',
      city: 'Jakarta Selatan',
      mapsUrl: 'https://maps.google.com/?q=37+Music+Studio',
    });

    expect(valid.success).toBe(true);
    expect(valid.data).toEqual({
      studioName: '37 Music Studio Kemang',
      tagline: 'Rekaman & Mixing Berkualitas',
      whatsappNumber: '+6281234567890',
      email: 'studio@37music.id',
      address: 'Jl. Kemang Raya No. 37',
      city: 'Jakarta Selatan',
      mapsUrl: 'https://maps.google.com/?q=37+Music+Studio',
    });
    expect(formatStudioWhatsappDisplay(valid.data.whatsappNumber)).toBe('+62 812-3456-7890');

    const invalid = validateStudioProfile({
      studioName: '   ',
      tagline: '',
      whatsappNumber: 'not-a-phone',
      email: 'invalid-email',
      address: '',
      city: '',
      mapsUrl: 'javascript:alert(1)',
    });

    expect(invalid.success).toBe(false);
    expect(invalid.fieldErrors.studioName).toBeDefined();
    expect(invalid.fieldErrors.whatsappNumber).toBeDefined();
    expect(invalid.fieldErrors.email).toBeDefined();
    expect(invalid.fieldErrors.mapsUrl).toBeDefined();
  });

  it('persists v1 then v2, blocks non-owner saves, and detects stale expectedVersion conflicts', async () => {
    const adapter = createInMemoryStudioProfileAdapter(null);

    await expect(
      saveStudioProfile({
        actorUid: 'staff-1',
        actorRole: 'staff',
        input: DEFAULT_STUDIO_PROFILE,
        expectedVersion: 0,
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'studio-profile/forbidden' });

    const savedV1 = await saveStudioProfile({
      actorUid: 'owner-1',
      actorRole: 'owner',
      input: {
        studioName: '37 Music Studio Jakarta',
        tagline: 'Rehearsal & Recording',
        whatsappNumber: '081299988877',
        email: 'hello@37music.id',
        address: 'Jl. Studio No. 1',
        city: 'Jakarta',
        mapsUrl: 'https://maps.google.com/?q=37',
      },
      expectedVersion: 0,
      adapter,
    });

    expect(savedV1.schemaVersion).toBe(STUDIO_PROFILE_SCHEMA_VERSION);
    expect(savedV1.version).toBe(1);
    expect(savedV1.whatsappNumber).toBe('+6281299988877');
    expect(savedV1.updatedByUid).toBe('owner-1');

    // Simulate another session updating doc to v2
    adapter._seedRemoteDoc({
      ...savedV1,
      city: 'Bandung',
      version: 2,
    });

    await expect(
      saveStudioProfile({
        actorUid: 'owner-1',
        actorRole: 'owner',
        input: { ...savedV1, city: 'Surabaya' },
        expectedVersion: 1,
        adapter,
      }),
    ).rejects.toMatchObject({ code: 'studio-profile/stale-version' });

    expect(adapter._getStoredDoc().city).toBe('Bandung');
  });
});

describe('Studio Profile & Contact UI (/admin/settings/studio-profile)', () => {
  it('allows Owner to edit, updates live preview, saves to adapter, and resets dirty state', async () => {
    const adapter = createInMemoryStudioProfileAdapter(null);
    setStudioProfileRepositoryAdapter(adapter);
    const user = userEvent.setup();

    renderWithAuth(<StudioProfilePage />, { route: '/admin/settings/studio-profile' });

    const nameInput = await screen.findByLabelText(/nama studio/i);
    await user.clear(nameInput);
    await user.type(nameInput, '37 Studio Selatan');

    const waInput = screen.getByLabelText(/nomor whatsapp studio/i);
    await user.type(waInput, '081234567890');

    // Preview reflects unsaved typing immediately
    const preview = screen.getByRole('complementary', { name: /37 studio selatan/i });
    expect(within(preview).getByText('+62 812-3456-7890')).toBeTruthy();

    const saveBtn = screen.getByRole('button', { name: /simpan profil studio/i });
    expect(saveBtn.disabled).toBe(false);
    await user.click(saveBtn);

    await waitFor(() => {
      expect(adapter._getStoredDoc()?.version).toBe(1);
    });
    expect(adapter._getStoredDoc().studioName).toBe('37 Studio Selatan');
    expect(adapter._getStoredDoc().whatsappNumber).toBe('+6281234567890');
    expect(within(preview).getByText('Tersimpan · v1')).toBeTruthy();
  });

  it('guards dirty navigation via confirmation modal and surfaces stale remote updates with Reload Latest', async () => {
    const adapter = createInMemoryStudioProfileAdapter({
      schemaVersion: 1,
      studioName: '37 Studio Lama',
      tagline: 'Tagline Lama',
      whatsappNumber: '+628111111111',
      email: 'info@37studio.id',
      address: 'Jl. Lama',
      city: 'Jakarta',
      mapsUrl: '',
      version: 1,
      updatedAt: '2026-11-22T02:00:00.000Z',
      updatedByUid: 'owner-1',
    });
    setStudioProfileRepositoryAdapter(adapter);
    const user = userEvent.setup();

    renderWithAuth(<StudioProfilePage />, { route: '/admin/settings/studio-profile' });

    const cityInput = await screen.findByLabelText(/kota \/ wilayah/i);
    await user.clear(cityInput);
    await user.type(cityInput, 'Yogyakarta Draft');

    // Back button opens leave guard when dirty
    await user.click(screen.getByRole('button', { name: /back to settings/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Perubahan Belum Disimpan')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /tetap di sini/i }));
    expect(screen.getByTestId('current-pathname').textContent).toBe(
      '/admin/settings/studio-profile',
    );

    // Concurrent remote save increments server version to v2 while draft is dirty
    adapter._seedRemoteDoc({
      schemaVersion: 1,
      studioName: '37 Studio Terkini',
      tagline: 'Tagline Baru',
      whatsappNumber: '+628111111111',
      email: 'info@37studio.id',
      address: 'Jl. Baru',
      city: 'Bandung Remote',
      mapsUrl: '',
      version: 2,
      updatedAt: '2026-11-22T03:00:00.000Z',
      updatedByUid: 'owner-2',
    });

    const reloadBtn = await screen.findByRole('button', { name: /muat data terbaru/i });
    await user.click(reloadBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/kota \/ wilayah/i).value).toBe('Bandung Remote');
    });
  });

  it('renders Staff read-only view with no mutating save or discard actions', async () => {
    const adapter = createInMemoryStudioProfileAdapter({
      schemaVersion: 1,
      studioName: '37 Studio Production',
      tagline: 'Studio Audio',
      whatsappNumber: '+6281234567890',
      email: 'studio@37.id',
      address: 'Jl. Musik 37',
      city: 'Jakarta',
      mapsUrl: 'https://maps.google.com/?q=37',
      version: 1,
      updatedAt: '2026-11-22T02:00:00.000Z',
      updatedByUid: 'owner-1',
    });
    setStudioProfileRepositoryAdapter(adapter);

    renderWithAuth(<StudioProfilePage />, {
      route: '/admin/settings/studio-profile',
      authValue: buildAuthValue({ uid: 'staff-1', role: 'staff', email: 'staff@37music.id' }),
    });

    expect(await screen.findByText(/akses baca saja \(staff\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/nama studio/i).readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: /simpan profil studio/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /batalkan perubahan/i })).toBeNull();
  });
});

describe('Account & Security UI (/admin/settings/account-security)', () => {
  it('displays signed-in user fields accurately, formats last sign-in in Asia/Jakarta WIB, and guards account status', () => {
    const lastSignInTime = '2026-11-22T01:30:00.000Z';
    const expectedTimestamp = formatSettingsTimestamp(lastSignInTime);

    renderWithAuth(<AccountSecurityPage />, {
      route: '/admin/settings/account-security',
      authValue: buildAuthValue({
        role: 'staff',
        displayName: 'Budi Operator',
        email: 'budi@37music.id',
        active: true,
        lastSignInTime,
      }),
    });

    expect(screen.getByText('Budi Operator')).toBeTruthy();
    expect(screen.getByText('budi@37music.id')).toBeTruthy();
    expect(screen.getByText('Staff')).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(expectedTimestamp)).toBeTruthy();

    // Must not expose editable account/profile fields or staff management controls
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();

    cleanup();

    // Never fabricate "Active" when profile is inactive or missing
    renderWithAuth(<AccountSecurityPage />, {
      route: '/admin/settings/account-security',
      authValue: buildAuthValue({ includeProfile: false }),
    });
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.getAllByText('Tidak diketahui').length).toBeGreaterThanOrEqual(1);
  });

  it('requires confirmation before calling resetPassword, prevents duplicate in-flight submits, and renders mapped result', async () => {
    let resolveReset;
    const resetPassword = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
    );
    const user = userEvent.setup();

    renderWithAuth(<AccountSecurityPage />, {
      route: '/admin/settings/account-security',
      authValue: buildAuthValue({
        email: 'owner@37music.id',
        resetPassword,
      }),
    });

    const triggerBtn = screen.getByRole('button', { name: /send password reset email/i });
    await user.click(triggerBtn);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/owner@37music\.id/i)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /kirim email reset/i }));

    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(resetPassword).toHaveBeenCalledWith('owner@37music.id');
    expect(screen.getByRole('button', { name: /mengirim email reset/i }).disabled).toBe(true);

    resolveReset({
      message:
        'Jika alamat email tersebut terdaftar dan aktif, tautan reset password akan dikirim melalui Firebase Authentication.',
    });

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/tautan reset password akan dikirim/i);
    });
    expect(screen.getByRole('button', { name: /send password reset email/i }).disabled).toBe(false);
  });
});
