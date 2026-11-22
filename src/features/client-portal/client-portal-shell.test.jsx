import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shellMocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  listeners: new Set(),
  signOut: vi.fn(),
  getRedirectResult: vi.fn(),
  staffLookup: null,
  firestoreCollectionSpy: vi.fn(),
  firestoreGetDocsSpy: vi.fn(),
  firestoreQuerySpy: vi.fn(),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => true,
  getFirebaseApp: () => ({ name: '[DEFAULT]' }),
}));

vi.mock('@/lib/firebase/auth', () => ({
  getFirebaseAuth: () => shellMocks.auth,
}));

vi.mock('@/lib/firebase/firestore', () => ({
  getFirebaseDb: () => ({ _mockDb: true }),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    setCustomParameters() {}
  }

  return {
    GoogleAuthProvider: MockGoogleAuthProvider,
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: (...args) => shellMocks.getRedirectResult(...args),
    sendPasswordResetEmail: vi.fn(),
    signOut: (...args) => shellMocks.signOut(...args),
    onAuthStateChanged: (_auth, callback) => {
      shellMocks.listeners.add(callback);
      queueMicrotask(() => {
        if (shellMocks.listeners.has(callback)) {
          callback(shellMocks.auth.currentUser);
        }
      });
      return () => {
        shellMocks.listeners.delete(callback);
      };
    },
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ _mockDb: true })),
  Timestamp: { fromDate: (d) => d },
  doc: (_db, col, id) => ({ col, id, path: `${col}/${id}` }),
  getDoc: async (docRef) => {
    if (docRef?.col === 'staffProfiles' && typeof shellMocks.staffLookup === 'function') {
      const result = await shellMocks.staffLookup(docRef.id);
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
  collection: (...args) => {
    shellMocks.firestoreCollectionSpy(...args);
    return { _collection: args[1] };
  },
  query: (...args) => {
    shellMocks.firestoreQuerySpy(...args);
    return { _query: true };
  },
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: async (...args) => {
    shellMocks.firestoreGetDocsSpy(...args);
    return { docs: [] };
  },
  onSnapshot: vi.fn((_q, onNext) => {
    queueMicrotask(() => onNext({ docs: [] }));
    return () => {};
  }),
}));

import { AppRoutes } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { queryClient } from '@/lib/query-client';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_PROFILE_SOURCE,
  CLIENT_ROLE,
} from './config/client-portal-config';
import {
  createInMemoryClientPortalRepositoryAdapter,
  resetClientPortalRepositoryAdapter,
  setClientPortalRepositoryAdapter,
} from './repositories/client-portal-repository';

const EXPECTED_CLIENT_NAV_LABELS = [
  'Overview',
  'Book a Session',
  'My Bookings',
  'Invoices & Payments',
  'My Profile',
];

function emitUser(user) {
  shellMocks.auth.currentUser = user;
  for (const listener of Array.from(shellMocks.listeners)) {
    listener(user);
  }
}

function makeGoogleUser({
  uid = 'client-shell-uid-99',
  email = 'nadia@gmail.com',
  displayName = 'Nadia Pratama Very Long Band Representative Name',
  photoURL = 'https://lh3.googleusercontent.com/avatar.jpg',
} = {}) {
  return {
    uid,
    email,
    displayName,
    photoURL,
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

function seedAuthenticatedClient(
  clientAdapter,
  {
    uid = 'client-shell-uid-99',
    customerId = 'cust_secret_id_99',
    email = 'nadia@gmail.com',
    displayName = 'Nadia Pratama',
    photoURL = 'https://lh3.googleusercontent.com/avatar.jpg',
    phoneDisplay = '+62 812-3456-7890',
    profileSource = CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
    status = CLIENT_ACCOUNT_STATUS.ACTIVE,
  } = {},
) {
  clientAdapter._seedClientProfile(customerId, {
    customerId,
    ownerUid: profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER ? null : uid,
    profileSource,
    displayName,
    emailNormalized: email,
    phoneDisplay,
    photoURL,
    status: 'active',
  });
  clientAdapter._seedClientCustomerLink(customerId, {
    customerId,
    ownerUid: uid,
    emailNormalized: email,
    profileSource,
  });
  clientAdapter._seedClientAccount(uid, {
    uid,
    role: CLIENT_ROLE,
    status,
    customerId,
    profileSource,
    emailNormalized: email,
    displayName,
    photoURL,
    authProvider: 'google.com',
    emailVerified: true,
  });

  const user = makeGoogleUser({ uid, email, displayName, photoURL });
  shellMocks.auth.currentUser = user;
  return user;
}

function renderClientAppAt(initialEntry = '/portal') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Client Portal Phase 2 — Spatial Ambient Shell, Responsive Drawer & Five Placeholders', () => {
  let clientAdapter;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    clientAdapter = createInMemoryClientPortalRepositoryAdapter();
    setClientPortalRepositoryAdapter(clientAdapter);

    shellMocks.staffLookup = (uid) => clientAdapter.hasStaffProfile(uid);
    shellMocks.auth.currentUser = null;
    shellMocks.listeners.clear();
    shellMocks.signOut.mockReset().mockImplementation(async () => {
      emitUser(null);
    });
    shellMocks.getRedirectResult.mockReset().mockResolvedValue(null);
    shellMocks.firestoreCollectionSpy.mockClear();
    shellMocks.firestoreGetDocsSpy.mockClear();
    shellMocks.firestoreQuerySpy.mockClear();
    queryClient.clear();
  });

  afterEach(() => {
    cleanup();
    resetClientPortalRepositoryAdapter();
    shellMocks.listeners.clear();
    shellMocks.staffLookup = null;
    queryClient.clear();
  });

  it('renders Spatial Ambient shell parity with exactly 5 nav items, brand identity, breadcrumb, topbar avatar fallback, and Sign Out -> /portal/login', async () => {
    const user = userEvent.setup();
    seedAuthenticatedClient(clientAdapter, {
      displayName: 'Nadia Pratama Very Long Band Representative Name',
      email: 'nadia.band@gmail.com',
      photoURL: 'https://invalid.example.com/broken-avatar.jpg',
    });

    const { container } = renderClientAppAt('/portal');

    const shellRoot = await screen.findByTestId('client-portal-shell');
    expect(shellRoot.getAttribute('data-client-portal')).toBe('true');
    expect(shellRoot.getAttribute('data-admin-portal')).toBeNull();
    expect(shellRoot.className).toContain('sa-canvas');

    // No Neo-Brutalist classes or Admin links inside Client Portal
    expect(container.querySelector('.brutal-card')).toBeNull();
    expect(container.querySelector('.brutal-btn')).toBeNull();
    expect(container.querySelector('a[href^="/admin"]')).toBeNull();
    expect(shellRoot.textContent).not.toMatch(/Owner & Staff/i);

    // Overview greeting rendered
    expect(
      screen.getByRole('heading', {
        name: /Welcome back, Nadia Pratama Very Long Band Representative Name/i,
      }),
    ).toBeTruthy();

    // Exact 5 Client Portal navigation items in sidebar
    const sidebarNav = screen.getByRole('navigation', { name: /client workspace navigation/i });
    const navLinks = within(sidebarNav).getAllByRole('link');
    expect(navLinks.map((link) => link.getAttribute('aria-label'))).toEqual(
      EXPECTED_CLIENT_NAV_LABELS,
    );
    expect(navLinks[0].getAttribute('aria-current')).toBe('page');

    // Breadcrumb & Topbar H1 match Overview
    const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(breadcrumb).getByText('37 Studio')).toBeTruthy();
    expect(within(breadcrumb).getByText('Overview')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy();

    // Topbar client identity + broken photo fallback to initials
    const profilePill = screen.getByLabelText(/authenticated client profile/i);
    expect(within(profilePill).getByText('CLIENT')).toBeTruthy();
    expect(within(profilePill).getByText('nadia.band@gmail.com')).toBeTruthy();
    const avatarImg = within(profilePill).getByRole('img', {
      name: /Nadia Pratama Very Long Band Representative Name/i,
    });
    fireEvent.error(avatarImg);
    expect(screen.getByTestId('client-topbar-avatar-initials').textContent).toBe('NN');

    // Desktop collapse & expand preserve accessible labels and Overview active state
    const aside = container.querySelector('aside[aria-label="Client portal sidebar"]');
    expect(aside.getAttribute('data-collapsed')).toBe('false');
    expect(container.querySelectorAll('[data-client-sidebar-label]').length).toBe(5);

    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar navigation/i });
    expect(collapseBtn.getAttribute('aria-expanded')).toBe('true');
    await user.click(collapseBtn);
    expect(aside.getAttribute('data-collapsed')).toBe('true');
    expect(container.querySelectorAll('[data-client-sidebar-label]').length).toBe(0);
    expect(
      within(sidebarNav).getByRole('link', { name: 'Overview' }).getAttribute('aria-current'),
    ).toBe('page');

    const expandBtn = screen.getByRole('button', { name: /expand sidebar navigation/i });
    await user.click(expandBtn);
    expect(aside.getAttribute('data-collapsed')).toBe('false');
    expect(container.querySelectorAll('[data-client-sidebar-label]').length).toBe(5);

    // Footer present on desktop
    expect(screen.getByText(/© 2026 37 Music Studio/i)).toBeTruthy();
    expect(screen.getByText(/Client Portal Workspace/i)).toBeTruthy();

    // Sign Out cleanly navigates to /portal/login
    await user.click(screen.getByRole('button', { name: /sign out of client portal/i }));
    await waitFor(() => {
      expect(shellMocks.signOut).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('client-login-page')).toBeTruthy();
  });

  it('supports sidebar navigation, mobile drawer open/close/Escape/backdrop/focus restoration, and all 5 direct routes + not-found state without Firestore queries or fake data', async () => {
    const user = userEvent.setup();
    seedAuthenticatedClient(clientAdapter, {
      uid: 'client-shell-uid-99',
      customerId: 'cust_secret_id_99',
      displayName: 'Raka Santoso',
      email: 'raka@gmail.com',
      phoneDisplay: '+62 813-9999-0000',
    });

    renderClientAppAt('/portal');
    expect(await screen.findByTestId('client-portal-home')).toBeTruthy();

    // Check Account Snapshot shows honest '—' values (never fake currency/counts)
    expect(screen.getByText('Upcoming Sessions')).toBeTruthy();
    expect(screen.getByText('Active Booking Requests')).toBeTruthy();
    expect(screen.getByText('Outstanding Balance')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBe(3);

    const sidebarNav = screen.getByRole('navigation', { name: /client workspace navigation/i });

    // Navigate via desktop sidebar across all sub-routes
    await user.click(within(sidebarNav).getByRole('link', { name: 'Book a Session' }));
    expect(await screen.findByTestId('client-book-session-page')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Book a Session' })).toBeTruthy();
    expect(screen.getByText('Rehearsal')).toBeTruthy();
    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('Mix & Master')).toBeTruthy();

    await user.click(within(sidebarNav).getByRole('link', { name: 'My Bookings' }));
    expect(await screen.findByTestId('client-bookings-page')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'My Bookings' })).toBeTruthy();
    expect(screen.getByText('Upcoming Sessions')).toBeTruthy();
    expect(screen.getByText('Booking Requests')).toBeTruthy();
    expect(screen.getByText('Recent Session History')).toBeTruthy();

    // Filter pill switcher operates purely in memory without touching Firestore
    await user.click(screen.getByRole('tab', { name: 'Upcoming' }));
    expect(screen.getByText('Upcoming Sessions')).toBeTruthy();
    expect(screen.queryByText('Recent Session History')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'All Groups' }));
    expect(screen.getByText('Recent Session History')).toBeTruthy();

    await user.click(within(sidebarNav).getByRole('link', { name: 'Invoices & Payments' }));
    expect(await screen.findByTestId('client-invoices-page')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices & Payments' })).toBeTruthy();
    expect(screen.getByText('Total Outstanding')).toBeTruthy();
    expect(screen.getByText('Total Paid')).toBeTruthy();
    expect(screen.getByText('Unpaid Invoices')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /pay now/i })).toBeNull();

    await user.click(within(sidebarNav).getByRole('link', { name: 'My Profile' }));
    expect(await screen.findByTestId('client-profile-page')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'My Profile' })).toBeTruthy();
    expect(screen.getByText('Studio Customer Profile')).toBeTruthy();
    expect(screen.getByText('+62 813-9999-0000')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save|edit profile/i })).toBeNull();

    // Ensure sensitive internal identifiers are NEVER leaked anywhere in rendered text
    const profileContainer = screen.getByTestId('client-profile-page');
    expect(profileContainer.textContent).not.toContain('client-shell-uid-99');
    expect(profileContainer.textContent).not.toContain('cust_secret_id_99');

    // Mobile drawer interaction: open -> close on menu select -> Escape focus restore -> backdrop close
    const drawerTrigger = screen.getByRole('button', { name: /open navigation drawer/i });
    await user.click(drawerTrigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('data-client-portal-layer')).toBe('true');

    const mobileNav = within(dialog).getByRole('navigation', {
      name: /mobile client workspace navigation/i,
    });
    expect(
      within(mobileNav)
        .getAllByRole('link')
        .map((l) => l.getAttribute('aria-label')),
    ).toEqual(EXPECTED_CLIENT_NAV_LABELS);

    await user.click(within(mobileNav).getByRole('link', { name: 'Overview' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(await screen.findByTestId('client-portal-home')).toBeTruthy();

    // Escape closes drawer and restores focus to trigger
    await user.click(drawerTrigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(drawerTrigger);

    // Backdrop click closes drawer
    await user.click(drawerTrigger);
    await screen.findByRole('dialog');
    await user.click(document.querySelector('[data-testid="client-mobile-drawer-backdrop"]'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    cleanup();

    // Direct URL navigation works for sub-routes and unknown portal route renders Client Not Found
    renderClientAppAt('/portal/invoices');
    expect(await screen.findByTestId('client-invoices-page')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices & Payments' })).toBeTruthy();
    cleanup();

    renderClientAppAt('/portal/unknown-section');
    expect(await screen.findByTestId('client-portal-not-found')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeTruthy();
    const sidebarOnNotFound = screen.getByRole('navigation', {
      name: /client workspace navigation/i,
    });
    expect(
      within(sidebarOnNotFound)
        .getAllByRole('link')
        .every((l) => l.getAttribute('aria-current') !== 'page'),
    ).toBe(true);

    // Placeholder pages perform ZERO Firestore collection queries
    expect(shellMocks.firestoreCollectionSpy).not.toHaveBeenCalled();
    expect(shellMocks.firestoreQuerySpy).not.toHaveBeenCalled();
    expect(shellMocks.firestoreGetDocsSpy).not.toHaveBeenCalled();
  });

  it('enforces security regression across nested portal routes (unauth, suspended, client->admin blocked, owner preserved)', async () => {
    // 1. Unauthenticated direct URL access to /portal/invoices redirects to /portal/login
    renderClientAppAt('/portal/invoices');
    expect(await screen.findByTestId('client-login-page')).toBeTruthy();
    expect(screen.queryByTestId('client-portal-shell')).toBeNull();
    cleanup();

    // 2. Suspended Client blocked from /portal/profile
    seedAuthenticatedClient(clientAdapter, {
      uid: 'client-suspended-99',
      customerId: 'client_client-suspended-99',
      email: 'suspended@gmail.com',
      status: CLIENT_ACCOUNT_STATUS.SUSPENDED,
      profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
    });
    renderClientAppAt('/portal/profile');
    expect(await screen.findByTestId('client-login-page')).toBeTruthy();
    expect(screen.queryByTestId('client-profile-page')).toBeNull();
    cleanup();

    // 3. Active Client blocked from /admin/dashboard
    seedAuthenticatedClient(clientAdapter, {
      uid: 'client-active-99',
      customerId: 'client_client-active-99',
      email: 'activeclient@gmail.com',
      status: CLIENT_ACCOUNT_STATUS.ACTIVE,
      profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
    });
    renderClientAppAt('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
    cleanup();

    // 4. Active Owner retains /admin/settings/danger-area access and data-admin-portal scope
    clientAdapter._seedStaffProfile('owner-uid-real', {
      displayName: 'Studio Owner',
      email: 'owner@37music.id',
      role: 'owner',
      active: true,
    });
    emitUser({ uid: 'owner-uid-real', email: 'owner@37music.id', displayName: 'Studio Owner' });
    const { container } = renderClientAppAt('/admin/settings');
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    expect(container.querySelector('[data-admin-portal="true"]')).toBeTruthy();
    expect(container.querySelector('[data-client-portal="true"]')).toBeNull();
  });
});
