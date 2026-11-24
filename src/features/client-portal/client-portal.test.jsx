import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMockState = vi.hoisted(() => ({
  auth: { currentUser: null },
  listeners: new Set(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  staffLookup: null,
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: () => ({ name: '[DEFAULT]' }),
}));

vi.mock('@/lib/firebase/auth', () => ({
  getFirebaseAuth: () => authMockState.auth,
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getFirebaseDb: () => ({ _mockDb: true }),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    constructor() {
      this.providerId = 'google.com';
      this.customParams = {};
    }
    setCustomParameters(params) {
      this.customParams = { ...params };
    }
  }

  return {
    GoogleAuthProvider: MockGoogleAuthProvider,
    signInWithPopup: (...args) => authMockState.signInWithPopup(...args),
    signInWithRedirect: (...args) => authMockState.signInWithRedirect(...args),
    getRedirectResult: (...args) => authMockState.getRedirectResult(...args),
    signInWithEmailAndPassword: (...args) => authMockState.signInWithEmailAndPassword(...args),
    signOut: (...args) => authMockState.signOut(...args),
    onAuthStateChanged: (_auth, callback) => {
      authMockState.listeners.add(callback);
      queueMicrotask(() => {
        if (authMockState.listeners.has(callback)) {
          callback(authMockState.auth.currentUser);
        }
      });
      return () => {
        authMockState.listeners.delete(callback);
      };
    },
  };
});

vi.mock('firebase/firestore', () => ({
  doc: (_db, col, id) => ({ col, id }),
  getDoc: async (docRef) => {
    if (docRef?.col === 'staffProfiles' && typeof authMockState.staffLookup === 'function') {
      const result = await authMockState.staffLookup(docRef.id);
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
}));

import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import {
  createInMemoryCustomerRepositoryAdapter,
  resetCustomerRepositoryAdapter,
  setCustomerRepositoryAdapter,
} from '@/features/admin/customer/repositories/customer-repository';
import {
  createManualCustomer,
  mergeCustomerProfiles,
  setCustomerArchiveStatus,
  updateCustomerProfile,
} from '@/features/admin/customer/services/customer-service';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireOwner } from '@/features/auth/RequireOwner';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { queryClient } from '@/lib/query-client';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { RequireClient } from './components/RequireClient';
import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ADMIN_ACCOUNT_NOTICE,
  CLIENT_PROFILE_SOURCE,
  CLIENT_SUSPENDED_MESSAGE,
} from './config/client-portal-config';
import { ClientPortalLayout } from './layout/ClientPortalLayout';
import { ClientBookSessionPage } from './pages/ClientBookSessionPage';
import { ClientBookingsPage } from './pages/ClientBookingsPage';
import { ClientInvoicesPage } from './pages/ClientInvoicesPage';
import { ClientLoginPage } from './pages/ClientLoginPage';
import { ClientPortalHomePage } from './pages/ClientPortalHomePage';
import { ClientPortalNotFoundPage } from './pages/ClientPortalNotFoundPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
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
import { resolveOrProvisionClientAccount } from './services/client-auth-service';

function makeMockGoogleUser({
  uid = 'google-uid-1',
  email = 'musician@gmail.com',
  displayName = 'Nadia Pratama',
  photoURL = 'https://lh3.googleusercontent.com/nadia.jpg',
  emailVerified = true,
  providerId = 'google.com',
  claimProviderId = 'google.com',
} = {}) {
  return {
    uid,
    email,
    displayName,
    photoURL,
    emailVerified,
    providerId,
    providerData: providerId ? [{ providerId }] : [],
    getIdTokenResult: async () => ({
      claims: {
        email_verified: emailVerified,
        firebase: {
          sign_in_provider: claimProviderId,
        },
      },
    }),
  };
}

function emitFirebaseUser(user) {
  authMockState.auth.currentUser = user;
  for (const listener of Array.from(authMockState.listeners)) {
    listener(user);
  }
}

function renderPortalRouter({ initialEntries = ['/portal/login'] } = {}) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<div data-testid="landing-stub">Landing</div>} />
          <Route path="/availability" element={<div data-testid="availability-stub">Avail</div>} />
          <Route path="/privacy" element={<div data-testid="privacy-stub">Privacy</div>} />
          <Route
            path="/staff/login"
            element={<div data-testid="staff-login-stub">StaffLogin</div>}
          />
          <Route path="/portal/login" element={<ClientLoginPage />} />
          <Route
            path="/portal"
            element={
              <RequireClient>
                <ClientPortalLayout />
              </RequireClient>
            }
          >
            <Route index element={<ClientPortalHomePage />} />
            <Route path="book" element={<ClientBookSessionPage />} />
            <Route path="bookings" element={<ClientBookingsPage />} />
            <Route path="invoices" element={<ClientInvoicesPage />} />
            <Route path="profile" element={<ClientProfilePage />} />
            <Route path="*" element={<ClientPortalNotFoundPage />} />
          </Route>
          <Route
            path="/admin/dashboard"
            element={
              <RequireStaff>
                <div data-testid="admin-dashboard-stub">AdminDashboard</div>
              </RequireStaff>
            }
          />
          <Route
            path="/admin/settings/danger-area"
            element={
              <RequireOwner>
                <div data-testid="admin-danger-stub">AdminDanger</div>
              </RequireOwner>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Client Portal Phase 1 — Google Auth, Instant Provisioning & Security Boundary', () => {
  let customerAdapter;
  let clientAdapter;

  beforeEach(() => {
    customerAdapter = createInMemoryCustomerRepositoryAdapter();
    clientAdapter = createInMemoryClientPortalRepositoryAdapter(customerAdapter);
    setCustomerRepositoryAdapter(customerAdapter);
    setClientPortalRepositoryAdapter(clientAdapter);
    setBookingRequestRepositoryAdapter(createInMemoryBookingRequestRepositoryAdapter());
    setClientBillingRepositoryAdapter(createInMemoryClientBillingRepositoryAdapter());

    authMockState.staffLookup = (uid) => clientAdapter.hasStaffProfile(uid);
    authMockState.auth.currentUser = null;
    authMockState.listeners.clear();
    authMockState.signInWithPopup.mockReset();
    authMockState.signInWithRedirect.mockReset();
    authMockState.getRedirectResult.mockReset();
    authMockState.signInWithEmailAndPassword.mockReset();
    authMockState.signOut.mockReset();

    authMockState.getRedirectResult.mockResolvedValue(null);
    authMockState.signOut.mockImplementation(async () => {
      emitFirebaseUser(null);
    });
    queryClient.clear();
  });

  afterEach(() => {
    cleanup();
    resetClientPortalRepositoryAdapter();
    resetClientBillingRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
    resetCustomerRepositoryAdapter();
    authMockState.listeners.clear();
    authMockState.staffLookup = null;
    queryClient.clear();
  });

  it('renders focused editorial Google login page with required copy and zero pending/staff chrome', async () => {
    renderPortalRouter({ initialEntries: ['/portal/login'] });

    expect(await screen.findByTestId('client-login-page')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Your Studio, Your Space\./i })).toBeTruthy();
    expect(screen.getByText(/Kelola pengalaman studio Anda dalam satu tempat\./i)).toBeTruthy();
    expect(screen.getByTestId('client-google-login-button').textContent).toMatch(
      /Continue with Google/i,
    );
    expect(screen.getByText(/Masuk atau daftar menggunakan akun Google Anda\./i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Kembali ke Website/i }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: /Privacy Notice/i }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.queryByPlaceholderText(/staff@37music\.id/i)).toBeNull();
  });

  it('immediately provisions an active isolated Client account on Google popup sign-up with zero pending approval', async () => {
    const newGoogleUser = makeMockGoogleUser({
      uid: 'client-brand-new-1',
      email: 'StudioFan@Gmail.com',
      displayName: 'Raka Studio',
    });

    authMockState.signInWithPopup.mockImplementation(async () => {
      emitFirebaseUser(newGoogleUser);
      return { user: newGoogleUser };
    });

    renderPortalRouter({ initialEntries: ['/portal/login'] });

    const btn = await screen.findByTestId('client-google-login-button');
    fireEvent.click(btn);

    expect(await screen.findByTestId('client-portal-shell')).toBeTruthy();
    expect(screen.getByTestId('client-portal-home')).toBeTruthy();
    expect(screen.getByText(/Welcome back, Raka Studio/i)).toBeTruthy();
    expect(screen.getByText(/Active Client/i)).toBeTruthy();
    expect(screen.getAllByText('studiofan@gmail.com').length).toBeGreaterThanOrEqual(1);

    const state = clientAdapter._inspectState();
    const account = state.clientAccounts.get('client-brand-new-1');
    expect(account).toBeTruthy();
    expect(account.status).toBe(CLIENT_ACCOUNT_STATUS.ACTIVE);
    expect(account.role).toBe('client');
    expect(account.profileSource).toBe(CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE);
    expect(account.customerId).toBe('client_client-brand-new-1');
  });

  it('falls back to signInWithRedirect when popup is blocked and completes instant provisioning on redirect return', async () => {
    const blockedErr = Object.assign(new Error('Popup blocked'), { code: 'auth/popup-blocked' });
    authMockState.signInWithPopup.mockRejectedValueOnce(blockedErr);
    authMockState.signInWithRedirect.mockResolvedValueOnce(undefined);

    renderPortalRouter({ initialEntries: ['/portal/login'] });
    const btn = await screen.findByTestId('client-google-login-button');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(authMockState.signInWithRedirect).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('client-portal-home')).toBeNull();
    cleanup();

    const redirectUser = makeMockGoogleUser({
      uid: 'client-redirect-1',
      email: 'redirectband@gmail.com',
      displayName: 'Redirect Band',
    });
    authMockState.auth.currentUser = redirectUser;
    authMockState.getRedirectResult.mockResolvedValueOnce({ user: redirectUser });

    renderPortalRouter({ initialEntries: ['/portal/login'] });
    expect(await screen.findByTestId('client-portal-home')).toBeTruthy();
    expect(screen.getAllByText('redirectband@gmail.com').length).toBeGreaterThanOrEqual(1);
  });

  it('handles popup cancellation, network errors, disabled user, and provider conflict calmly without creating an account', async () => {
    renderPortalRouter({ initialEntries: ['/portal/login'] });

    const btn = await screen.findByTestId('client-google-login-button');

    authMockState.signInWithPopup.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    fireEvent.click(btn);
    expect((await screen.findByTestId('client-login-error-alert')).textContent).toMatch(
      /dibatalkan/i,
    );

    authMockState.signInWithPopup.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    fireEvent.click(btn);
    expect((await screen.findByTestId('client-login-error-alert')).textContent).toMatch(
      /jaringan bermasalah/i,
    );

    authMockState.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/account-exists-with-different-credential',
    });
    fireEvent.click(btn);
    expect((await screen.findByTestId('client-login-error-alert')).textContent).toMatch(
      /metode masuk lain/i,
    );

    authMockState.signInWithPopup.mockRejectedValueOnce({ code: 'auth/user-disabled' });
    fireEvent.click(btn);
    expect((await screen.findByTestId('client-login-error-alert')).textContent).toContain(
      CLIENT_SUSPENDED_MESSAGE,
    );

    expect(clientAdapter._inspectState().clientAccounts).toHaveLength(0);
  });

  it('rejects unverified Google email users before provisioning a client account', async () => {
    const unverifiedUser = makeMockGoogleUser({
      uid: 'client-unverified-1',
      email: 'unverified@gmail.com',
      emailVerified: false,
    });

    await expect(
      resolveOrProvisionClientAccount(unverifiedUser, {
        allowProvision: true,
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client/email-unverified' });

    expect(clientAdapter._inspectState().clientAccounts).toHaveLength(0);
  });

  it('matches verified Google email deterministically against customerEmailIndex and prevents hijack by another user', async () => {
    const createdCustomer = await createManualCustomer({
      actorUid: 'staff-1',
      input: {
        displayName: 'The Vultures Band',
        phone: '081234500999',
        email: 'Booking.Vultures@Gmail.com',
        notes: 'Internal note: check guitar amp #2',
      },
      adapter: customerAdapter,
    });

    expect(createdCustomer.emailNormalized).toBe('booking.vultures@gmail.com');

    // Exact match -> linked_customer with 1:1 ownership lock
    const matchedUser = makeMockGoogleUser({
      uid: 'client-vultures-uid',
      email: 'booking.vultures@gmail.com',
      displayName: 'Vultures Vocalist',
    });

    const firstLogin = await resolveOrProvisionClientAccount(matchedUser, {
      allowProvision: true,
      adapter: clientAdapter,
    });

    expect(firstLogin.isNewAccount).toBe(true);
    expect(firstLogin.clientAccount.status).toBe('active');
    expect(firstLogin.clientAccount.profileSource).toBe(CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER);
    expect(firstLogin.clientAccount.customerId).toBe(createdCustomer.id);
    expect(firstLogin.clientProfile.displayName).toBe('The Vultures Band');
    expect(firstLogin.clientProfile).not.toHaveProperty('notes');

    // Re-login preserves the exact same account & binding cleanly
    const repeatLogin = await resolveOrProvisionClientAccount(matchedUser, {
      allowProvision: false,
      adapter: clientAdapter,
    });
    expect(repeatLogin.isNewAccount).toBe(false);
    expect(repeatLogin.clientAccount.customerId).toBe(createdCustomer.id);

    // Another Google user with same/spoofed email cannot take over already claimed customerId;
    // falls back safely to an isolated client profile instead of sharing/hijacking
    const secondUid = makeMockGoogleUser({
      uid: 'client-intruder-uid',
      email: 'booking.vultures@gmail.com',
      displayName: 'Another Account',
    });

    const conflictFallback = await resolveOrProvisionClientAccount(secondUid, {
      allowProvision: true,
      adapter: clientAdapter,
    });

    expect(conflictFallback.clientAccount.profileSource).toBe(
      CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
    );
    expect(conflictFallback.clientAccount.customerId).toBe('client_client-intruder-uid');
    expect(conflictFallback.clientAccount.customerId).not.toBe(createdCustomer.id);
  });

  it('maintains customerEmailIndex uniqueness, updates, archiving, merging, and ambiguous fallback safety', async () => {
    const custA = await createManualCustomer({
      actorUid: 'owner-1',
      input: {
        displayName: 'Band Alpha',
        phone: '081111111111',
        email: 'alpha@gmail.com',
        notes: '',
      },
      adapter: customerAdapter,
    });

    // Duplicate email rejected for active customers
    await expect(
      createManualCustomer({
        actorUid: 'owner-1',
        input: {
          displayName: 'Band Alpha 2',
          phone: '081222222222',
          email: 'ALPHA@gmail.com',
          notes: '',
        },
        adapter: customerAdapter,
      }),
    ).rejects.toMatchObject({ code: 'customer/email-conflict' });

    // Updating customer email removes old index and writes new index + syncs clientProfile
    const updated = await updateCustomerProfile({
      customerId: custA.id,
      expectedVersion: custA.version,
      actorUid: 'owner-1',
      input: {
        displayName: 'Band Alpha Updated',
        email: 'alpha.new@gmail.com',
        notes: '',
      },
      adapter: customerAdapter,
    });
    expect(updated.emailNormalized).toBe('alpha.new@gmail.com');
    expect(await clientAdapter.getEmailIndexForOwnEmail('alpha@gmail.com')).toBeNull();
    expect((await clientAdapter.getEmailIndexForOwnEmail('alpha.new@gmail.com')).customerId).toBe(
      custA.id,
    );

    // Archiving removes email index so new sign-ins don't link to archived profiles
    await setCustomerArchiveStatus({
      customerId: custA.id,
      expectedVersion: updated.version,
      archived: true,
      actorUid: 'owner-1',
      adapter: customerAdapter,
    });
    expect(await clientAdapter.getEmailIndexForOwnEmail('alpha.new@gmail.com')).toBeNull();
    expect((await clientAdapter.getClientProfile(custA.id)).status).toBe('archived');

    // Ambiguous index entry forces safe isolated profile fallback
    clientAdapter._seedEmailIndex('shared.band@gmail.com', {
      schemaVersion: 1,
      emailNormalized: 'shared.band@gmail.com',
      customerId: '',
      status: 'ambiguous',
      version: 1,
    });
    const ambigUser = makeMockGoogleUser({
      uid: 'client-ambig-1',
      email: 'shared.band@gmail.com',
      displayName: 'Shared Email User',
    });
    const ambigResult = await resolveOrProvisionClientAccount(ambigUser, {
      allowProvision: true,
      adapter: clientAdapter,
    });
    expect(ambigResult.clientAccount.profileSource).toBe(
      CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
    );
    expect(ambigResult.clientAccount.customerId).toBe('client_client-ambig-1');

    // Merge transfers email index safely when target has no email and archives source projection
    const mergeSource = await createManualCustomer({
      actorUid: 'owner-1',
      input: {
        displayName: 'Merge Source',
        phone: '081333333333',
        email: 'merged.user@gmail.com',
        notes: '',
      },
      adapter: customerAdapter,
    });
    const mergeTarget = await createManualCustomer({
      actorUid: 'owner-1',
      input: {
        displayName: 'Merge Target',
        phone: '081444444444',
        email: '',
        notes: '',
      },
      adapter: customerAdapter,
    });
    const merged = await mergeCustomerProfiles({
      targetCustomerId: mergeTarget.id,
      sourceCustomerId: mergeSource.id,
      actorUid: 'owner-1',
      allowCrossPhoneMerge: true,
      adapter: customerAdapter,
    });
    expect(merged.target.emailNormalized).toBe('merged.user@gmail.com');
    expect((await clientAdapter.getEmailIndexForOwnEmail('merged.user@gmail.com')).customerId).toBe(
      mergeTarget.id,
    );
    expect((await clientAdapter.getClientProfile(mergeSource.id)).status).toBe('archived');
  });

  it('prevents Owner/Staff from being converted to Client and displays calm internal-session notice on /portal/login', async () => {
    clientAdapter._seedStaffProfile('owner-uid-1', {
      displayName: 'Studio Owner',
      email: 'owner@37music.id',
      role: 'owner',
      active: true,
    });

    const staffGoogleAttempt = makeMockGoogleUser({
      uid: 'owner-uid-1',
      email: 'owner@37music.id',
      displayName: 'Studio Owner',
    });

    await expect(
      resolveOrProvisionClientAccount(staffGoogleAttempt, {
        allowProvision: true,
        adapter: clientAdapter,
      }),
    ).rejects.toMatchObject({ code: 'client/staff-account-blocked' });

    expect(clientAdapter._inspectState().clientAccounts).toHaveLength(0);

    // Active Staff session visiting /portal/login sees calm notice instead of converting
    authMockState.auth.currentUser = { uid: 'owner-uid-1', email: 'owner@37music.id' };
    renderPortalRouter({ initialEntries: ['/portal/login'] });

    const notice = await screen.findByTestId('client-login-staff-notice');
    expect(notice.textContent).toContain(CLIENT_ADMIN_ACCOUNT_NOTICE);
    expect(screen.getByRole('link', { name: /Buka Admin Workspace/i }).getAttribute('href')).toBe(
      '/admin/dashboard',
    );
  });

  it('isolates Client accounts from /admin/* routes, revokes access immediately when suspended, and clears QueryClient cache across UID changes', async () => {
    const clientUser1 = makeMockGoogleUser({
      uid: 'client-live-1',
      email: 'liveclient1@gmail.com',
      displayName: 'Live Client 1',
    });
    const clientUser2 = makeMockGoogleUser({
      uid: 'client-live-2',
      email: 'liveclient2@gmail.com',
      displayName: 'Live Client 2',
    });
    await resolveOrProvisionClientAccount(clientUser1, {
      allowProvision: true,
      adapter: clientAdapter,
    });
    await resolveOrProvisionClientAccount(clientUser2, {
      allowProvision: true,
      adapter: clientAdapter,
    });

    // Attempting to visit /admin/dashboard as Client MUST fail-closed to /staff/login
    authMockState.auth.currentUser = clientUser1;
    renderPortalRouter({ initialEntries: ['/admin/dashboard'] });
    expect(await screen.findByTestId('staff-login-stub')).toBeTruthy();
    expect(screen.queryByTestId('admin-dashboard-stub')).toBeNull();
    cleanup();

    // Visiting /admin/settings/danger-area as Client MUST also fail-closed
    renderPortalRouter({ initialEntries: ['/admin/settings/danger-area'] });
    expect(await screen.findByTestId('staff-login-stub')).toBeTruthy();
    expect(screen.queryByTestId('admin-danger-stub')).toBeNull();
    cleanup();

    // Verify UID-switching session isolation clears QueryClient cache
    renderPortalRouter({ initialEntries: ['/portal'] });
    expect(await screen.findByTestId('client-portal-home')).toBeTruthy();
    queryClient.setQueryData(['portal-user-cache'], { owner: 'client-live-1' });
    emitFirebaseUser(clientUser2);
    await waitFor(() => {
      expect(screen.getAllByText('liveclient2@gmail.com').length).toBeGreaterThanOrEqual(1);
    });
    expect(queryClient.getQueryData(['portal-user-cache'])).toBeUndefined();

    // Seed cache again for client 2 and suspend live -> immediate signOut + cache clear + redirect
    queryClient.setQueryData(['portal-test-key'], { secret: true });
    clientAdapter._setClientAccountStatus('client-live-2', CLIENT_ACCOUNT_STATUS.SUSPENDED);

    await waitFor(() => {
      expect(screen.getByTestId('client-login-page')).toBeTruthy();
    });
    expect(screen.getByTestId('client-login-error-alert').textContent).toContain(
      CLIENT_SUSPENDED_MESSAGE,
    );
    expect(queryClient.getQueryData(['portal-test-key'])).toBeUndefined();
    expect(authMockState.signOut).toHaveBeenCalled();
  });

  it('keeps /client/login as 404 and exposes subtle Client Portal footer link without adding a Client Login button', () => {
    renderPortalRouter({ initialEntries: ['/client/login'] });
    expect(screen.getByText(/Page Not Found/i)).toBeTruthy();
    cleanup();

    render(
      <MemoryRouter>
        <SiteFooter
          footer={{
            brandMark: '37',
            brandName: '37 Music Studio',
            description: 'Editorial rehearsal & recording studio.',
            socialLinks: [],
            visitHeading: 'Visit',
            hoursHeading: 'Hours',
            ctaHeading: 'Booking',
            ctaHref: '#booking',
            ctaLabel: 'Book Session',
            copyright: '© 37 Music Studio',
            phaseNote: 'Client Portal Phase 1',
          }}
          contact={{}}
          navLinks={[]}
          onNavigate={vi.fn()}
        />
      </MemoryRouter>,
    );
    const portalLink = screen.getByRole('link', { name: /Client Portal/i });
    expect(portalLink.getAttribute('href')).toBe('/portal/login');
    expect(screen.queryByRole('link', { name: /Client Login/i })).toBeNull();
  });

  it('navigates from Landing Page SiteHeader Login button and mobile menu drawer to /portal/login', async () => {
    const headerProps = {
      utilityStrip: {
        descriptor: '37 MUSIC STUDIO',
        hoursText: '10:00 – 23:00 WIB',
        ctaLabel: 'BOOK A SESSION →',
        ctaHref: '#booking',
      },
      header: {
        brandMark: '37',
        brandName: '37 MUSIC STUDIO',
        brandTagline: 'REHEARSAL • RECORDING • MIX',
        navLinks: [{ label: 'Availability', href: '/availability', isRoute: true }],
        loginCta: { label: 'Login', href: '/portal/login' },
        primaryCta: { label: 'Book a session', href: '#booking' },
      },
      onNavigate: vi.fn(),
    };

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<SiteHeader {...headerProps} />} />
            <Route path="/portal/login" element={<ClientLoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    // Mobile drawer includes mobile-menu-login-link pointing to /portal/login
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const mobileLoginLink = await screen.findByTestId('mobile-menu-login-link');
    expect(mobileLoginLink.getAttribute('href')).toBe('/portal/login');

    // Clicking desktop header Login link navigates directly to /portal/login
    const headerLoginLink = screen.getByTestId('header-login-link');
    expect(headerLoginLink.getAttribute('href')).toBe('/portal/login');
    fireEvent.click(headerLoginLink);

    expect(await screen.findByTestId('client-login-page')).toBeTruthy();
  });
});
