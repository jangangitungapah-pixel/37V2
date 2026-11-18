import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: (...args) => mockSignOut(...args),
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

const EXPECTED_MENU_LABELS = [
  'Dashboard',
  'Calendar',
  'Customer',
  'Payment and Bill',
  'Commission and Fee',
  'Inventory',
  'Pembukuan',
  'Settings',
];

function mockAuthenticatedRole(role = 'owner') {
  const uid = role === 'owner' ? 'owner-uid-1' : 'staff-uid-2';
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

function renderAdminAt(initialEntry = '/admin') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Phase 4 — Admin Shell, Sidebar, Mobile Drawer & Eight Nested Routes', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects /admin to /admin/dashboard and renders all 8 navigation items in exact order', async () => {
    mockAuthenticatedRole('owner');
    renderAdminAt('/admin');

    expect(
      await screen.findByRole(
        'heading',
        { name: /welcome back, 37 music studio owner\./i },
        { timeout: 5000 },
      ),
    ).toBeTruthy();

    const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
    const navLinks = within(sidebarNav).getAllByRole('link');
    expect(navLinks.map((link) => link.getAttribute('aria-label'))).toEqual(EXPECTED_MENU_LABELS);

    // Dashboard is active by default
    expect(navLinks[0].getAttribute('aria-current')).toBe('page');

    // Breadcrumb & topbar page heading reflect Dashboard
    const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(breadcrumbNav).getByText('37 Studio')).toBeTruthy();
    expect(within(breadcrumbNav).getByText('Dashboard')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
  });

  it('navigates across all 8 routes and updates active menu state, breadcrumb, and placeholder content', async () => {
    const user = userEvent.setup();
    mockAuthenticatedRole('owner');
    renderAdminAt('/admin/dashboard');

    await screen.findByRole('heading', { name: /welcome back, 37 music studio owner\./i });

    const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });

    const nonDashboardModules = [
      { label: 'Calendar', path: '/admin/calendar' },
      { label: 'Customer', path: '/admin/customer' },
      { label: 'Payment and Bill', path: '/admin/payment-and-bill' },
      { label: 'Commission and Fee', path: '/admin/commission-and-fee' },
      { label: 'Inventory', path: '/admin/inventory' },
      { label: 'Pembukuan', path: '/admin/pembukuan' },
      { label: 'Settings', path: '/admin/settings' },
    ];

    for (const mod of nonDashboardModules) {
      const link = within(sidebarNav).getByRole('link', { name: mod.label });
      await user.click(link);

      expect(link.getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('heading', { level: 1, name: mod.label })).toBeTruthy();
      expect(screen.getByText(`ROUTE: ${mod.path}`)).toBeTruthy();
      expect(
        screen.getByText(
          /this workspace is ready\. the module's operational features will be implemented in its dedicated development phase\./i,
        ),
      ).toBeTruthy();
    }
  });

  it('expands and collapses the desktop sidebar while preserving accessible icon names and active state', async () => {
    const user = userEvent.setup();
    mockAuthenticatedRole('owner');
    const { container } = renderAdminAt('/admin/calendar');

    await screen.findByRole('heading', { level: 1, name: 'Calendar' });

    const aside = container.querySelector('aside[aria-label="Studio administration sidebar"]');
    expect(aside.getAttribute('data-collapsed')).toBe('false');
    expect(container.querySelectorAll('[data-sidebar-label]').length).toBe(8);

    // Collapse sidebar
    const collapseButton = screen.getByRole('button', { name: /collapse sidebar navigation/i });
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true');
    await user.click(collapseButton);

    expect(aside.getAttribute('data-collapsed')).toBe('true');
    expect(container.querySelectorAll('[data-sidebar-label]').length).toBe(0);

    // Icons and accessible link names remain intact and Calendar stays active
    const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
    const calendarLink = within(sidebarNav).getByRole('link', { name: 'Calendar' });
    expect(calendarLink.getAttribute('aria-current')).toBe('page');

    // Expand sidebar back
    const expandButton = screen.getByRole('button', { name: /expand sidebar navigation/i });
    expect(expandButton.getAttribute('aria-expanded')).toBe('false');
    await user.click(expandButton);

    expect(aside.getAttribute('data-collapsed')).toBe('false');
    expect(container.querySelectorAll('[data-sidebar-label]').length).toBe(8);
  });

  it('opens and closes the mobile navigation drawer via menu selection, backdrop, and Escape with focus restoration', async () => {
    const user = userEvent.setup();
    mockAuthenticatedRole('staff');
    renderAdminAt('/admin/dashboard');

    await screen.findByRole('heading', { name: /welcome back, rina studio staff\./i });

    const drawerTrigger = screen.getByRole('button', { name: /open navigation drawer/i });
    await user.click(drawerTrigger);

    const dialog = await screen.findByRole('dialog');
    const mobileNav = within(dialog).getByRole('navigation', {
      name: /mobile admin workspace navigation/i,
    });
    const mobileLinks = within(mobileNav).getAllByRole('link');
    expect(mobileLinks.map((l) => l.getAttribute('aria-label'))).toEqual(EXPECTED_MENU_LABELS);

    // Selecting an item navigates and closes the drawer
    await user.click(within(mobileNav).getByRole('link', { name: 'Inventory' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Inventory' })).toBeTruthy();

    // Reopen and close with Escape -> focus returns to trigger
    await user.click(drawerTrigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(drawerTrigger);

    // Reopen and close via backdrop click
    await user.click(drawerTrigger);
    await screen.findByRole('dialog');
    const backdrop = document.querySelector('[data-testid="admin-mobile-drawer-backdrop"]');
    await user.click(backdrop);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('protects all nested admin routes from unauthenticated access and provides identical menu access to Owner and Staff', async () => {
    // 1. Unauthenticated visitor blocked from /admin/dashboard and /admin/settings
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      queueMicrotask(() => callback(null));
      return () => {};
    });

    renderAdminAt('/admin/settings');
    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
    cleanup();

    // 2. Staff sees all 8 menu items and can sign out from topbar
    const user = userEvent.setup();
    mockAuthenticatedRole('staff');
    renderAdminAt('/admin/settings');

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    const sidebarNav = screen.getByRole('navigation', { name: /admin workspace navigation/i });
    expect(
      within(sidebarNav)
        .getAllByRole('link')
        .map((l) => l.getAttribute('aria-label')),
    ).toEqual(EXPECTED_MENU_LABELS);

    const signOutBtn = screen.getByRole('button', { name: /sign out of studio session/i });
    await user.click(signOutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
  });
});
