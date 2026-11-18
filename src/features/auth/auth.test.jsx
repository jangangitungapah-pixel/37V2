import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignInWithEmailAndPassword = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db, collectionName, docId) => ({
  path: `${collectionName}/${docId}`,
  id: docId,
}));
const mockIsFirebaseConfigured = vi.fn(() => true);

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  signOut: (...args) => mockSignOut(...args),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ app: { name: '[DEFAULT]' } })),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => mockIsFirebaseConfigured(),
  getFirebaseApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

import { AppRoutes } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';

function renderWithRouter(initialEntries = ['/']) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}

function createSnapshot(id, data, exists = true) {
  return {
    id,
    exists: () => exists,
    data: () => data,
  };
}

describe('Phase 3 — Staff & Owner Authentication, Authorization & Admin Portal', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    mockIsFirebaseConfigured.mockReturnValue(true);
    mockSignInWithEmailAndPassword.mockReset();
    mockSendPasswordResetEmail.mockReset();
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockGetDoc.mockReset();
    mockOnAuthStateChanged.mockReset().mockImplementation((_auth, callback) => {
      queueMicrotask(() => callback(null));
      return () => {};
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('separates header Client Login (coming soon dialog) from footer Staff / Owner Login (/staff/login route)', async () => {
    const user = userEvent.setup();
    renderWithRouter(['/']);

    // 1. Header Client Login opens Client Login Coming Soon dialog and stays on "/"
    const clientLoginBtn = screen.getByRole('button', {
      name: /client login portal \(coming soon\)/i,
    });
    await user.click(clientLoginBtn);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/client login coming soon/i)).toBeTruthy();
    expect(
      within(dialog).getByText(
        /the client portal is not available yet\. you can still explore our services and submit a booking inquiry from the public website\./i,
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: /back to website/i }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // 2. Mobile menu also preserves Client Login dialog behavior
    const mobileMenuTrigger = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(mobileMenuTrigger);
    const mobileDrawer = await screen.findByRole('dialog');
    const mobileClientLoginBtn = within(mobileDrawer).getByRole('button', {
      name: /^client login$/i,
    });
    await user.click(mobileClientLoginBtn);

    const reopenedClientDialog = await screen.findByRole('dialog');
    expect(within(reopenedClientDialog).getByText(/client login coming soon/i)).toBeTruthy();
    await user.click(
      within(reopenedClientDialog).getByRole('button', { name: /back to website/i }),
    );

    // 3. Footer Staff / Owner Login navigates to /staff/login
    const footerStaffLink = screen.getByRole('link', { name: /staff \/ owner login/i });
    await user.click(footerStaffLink);

    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
  });

  it('does not expose a /client/login route (renders Not Found fallback)', async () => {
    renderWithRouter(['/client/login']);
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeTruthy();
  });

  it('authenticates a valid Owner account, verifies staffProfiles/{uid}, and redirects to /admin with real identity', async () => {
    const user = userEvent.setup();
    const ownerUser = {
      uid: 'owner-uid-001',
      email: 'owner@37musicstudio.com',
      displayName: 'Studio Owner',
    };

    mockSignInWithEmailAndPassword.mockResolvedValue({ user: ownerUser });
    mockGetDoc.mockResolvedValue(
      createSnapshot('owner-uid-001', {
        displayName: 'Raka Pratama (Owner)',
        email: 'owner@37musicstudio.com',
        role: 'owner',
        active: true,
      }),
    );

    renderWithRouter(['/staff/login']);

    const emailInput = await screen.findByLabelText(/studio email address/i);
    const passwordInput = screen.getByLabelText(/^password/i);

    // Verify password visibility toggle works
    expect(passwordInput.getAttribute('type')).toBe('password');
    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleBtn);
    expect(passwordInput.getAttribute('type')).toBe('text');

    // Type email with surrounding spaces to verify trimming while preserving password
    await user.type(emailInput, '  owner@37musicstudio.com  ');
    await user.type(passwordInput, 'SecretPass!37');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'owner@37musicstudio.com',
      'SecretPass!37',
    );

    expect(
      await screen.findByRole('heading', { name: /welcome back, raka pratama \(owner\)\./i }),
    ).toBeTruthy();
    expect(screen.getAllByText('Raka Pratama (Owner)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('owner@37musicstudio.com').length).toBeGreaterThan(0);
    expect(screen.getByText('ROLE: OWNER')).toBeTruthy();

    // Ensure no fake operational dashboard metrics appear
    expect(screen.queryByText(/total revenue|occupancy rate|monthly bookings/i)).toBeNull();
  });

  it('authenticates a valid Staff account and displays STAFF role badge in /admin', async () => {
    const user = userEvent.setup();
    const staffUser = {
      uid: 'staff-uid-002',
      email: 'staff@37musicstudio.com',
    };

    mockSignInWithEmailAndPassword.mockResolvedValue({ user: staffUser });
    mockGetDoc.mockResolvedValue(
      createSnapshot('staff-uid-002', {
        displayName: 'Dina Audio Engineer',
        email: 'staff@37musicstudio.com',
        role: 'staff',
        active: true,
      }),
    );

    renderWithRouter(['/staff/login']);

    await user.type(
      await screen.findByLabelText(/studio email address/i),
      'staff@37musicstudio.com',
    );
    await user.type(screen.getByLabelText(/^password/i), 'StaffPass!37');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(
      await screen.findByRole('heading', { name: /welcome back, dina audio engineer\./i }),
    ).toBeTruthy();
    expect(screen.getAllByText('Dina Audio Engineer').length).toBeGreaterThan(0);
    expect(screen.getByText('ROLE: STAFF')).toBeTruthy();
  });

  it('rejects invalid credentials with a safe user-facing error message', async () => {
    const user = userEvent.setup();
    const invalidCredError = new Error('Firebase: Error (auth/invalid-credential).');
    invalidCredError.code = 'auth/invalid-credential';
    mockSignInWithEmailAndPassword.mockRejectedValue(invalidCredError);

    renderWithRouter(['/staff/login']);

    await user.type(
      await screen.findByLabelText(/studio email address/i),
      'wrong@37musicstudio.com',
    );
    await user.type(screen.getByLabelText(/^password/i), 'WrongPassword');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/invalid email or password\./i);
    expect(screen.queryByRole('heading', { name: /welcome to 37 studio\./i })).toBeNull();
  });

  it('denies login and signs out when Firestore staffProfiles/{uid} document is missing', async () => {
    const user = userEvent.setup();
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'unprovisioned-uid', email: 'unprovisioned@example.com' },
    });
    mockGetDoc.mockResolvedValue(createSnapshot('unprovisioned-uid', null, false));

    renderWithRouter(['/staff/login']);

    await user.type(
      await screen.findByLabelText(/studio email address/i),
      'unprovisioned@example.com',
    );
    await user.type(screen.getByLabelText(/^password/i), 'Pass1234!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/account is not authorized for staff access\./i);
    expect(mockSignOut).toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /welcome to 37 studio\./i })).toBeNull();
  });

  it('denies login and signs out when role is not owner or staff', async () => {
    const user = userEvent.setup();
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'bad-role-uid', email: 'visitor@example.com' },
    });
    mockGetDoc.mockResolvedValue(
      createSnapshot('bad-role-uid', {
        displayName: 'Visitor User',
        email: 'visitor@example.com',
        role: 'customer',
        active: true,
      }),
    );

    renderWithRouter(['/staff/login']);

    await user.type(await screen.findByLabelText(/studio email address/i), 'visitor@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Pass1234!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/access denied\./i);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('denies login and signs out when staff profile has active=false', async () => {
    const user = userEvent.setup();
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'inactive-uid', email: 'former@37musicstudio.com' },
    });
    mockGetDoc.mockResolvedValue(
      createSnapshot('inactive-uid', {
        displayName: 'Former Staff',
        email: 'former@37musicstudio.com',
        role: 'staff',
        active: false,
      }),
    );

    renderWithRouter(['/staff/login']);

    await user.type(
      await screen.findByLabelText(/studio email address/i),
      'former@37musicstudio.com',
    );
    await user.type(screen.getByLabelText(/^password/i), 'Pass1234!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/account inactive\./i);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('handles missing Firebase configuration gracefully without crashing', async () => {
    const user = userEvent.setup();
    mockIsFirebaseConfigured.mockReturnValue(false);

    renderWithRouter(['/staff/login']);

    await user.type(
      await screen.findByLabelText(/studio email address/i),
      'owner@37musicstudio.com',
    );
    await user.type(screen.getByLabelText(/^password/i), 'Pass1234!');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/firebase configuration is incomplete\./i);
  });

  it('protects /admin from unauthenticated access and does not flash protected content while loading', async () => {
    let resolveAuthCallback;
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      resolveAuthCallback = callback;
      return () => {};
    });

    renderWithRouter(['/admin']);

    // While auth state is still resolving, loading screen is shown and protected content is hidden
    expect(screen.getByRole('heading', { name: /verifying studio access/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /welcome to 37 studio\./i })).toBeNull();

    // Once resolved as unauthenticated (null), user is redirected to /staff/login
    await waitFor(() => {
      expect(typeof resolveAuthCallback).toBe('function');
    });
    resolveAuthCallback(null);

    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
  });

  it('restores an existing valid session on /admin refresh, redirects /staff/login to /admin, and supports Sign Out', async () => {
    const user = userEvent.setup();
    const persistedUser = {
      uid: 'owner-uid-999',
      email: 'owner@37musicstudio.com',
    };

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      queueMicrotask(() => callback(persistedUser));
      return () => {};
    });
    mockGetDoc.mockResolvedValue(
      createSnapshot('owner-uid-999', {
        displayName: 'Studio Owner Persisted',
        email: 'owner@37musicstudio.com',
        role: 'owner',
        active: true,
      }),
    );

    // Opening /staff/login while already authenticated redirects to /admin/dashboard
    renderWithRouter(['/staff/login']);

    expect(
      await screen.findByRole('heading', { name: /welcome back, studio owner persisted\./i }),
    ).toBeTruthy();
    expect(screen.getAllByText('Studio Owner Persisted').length).toBeGreaterThan(0);

    // Clicking Sign Out calls Firebase signOut and redirects back to /staff/login
    const signOutButtons = screen.getAllByRole('button', { name: /sign out/i });
    await user.click(signOutButtons[0]);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    expect(await screen.findByRole('heading', { name: /staff & owner sign in/i })).toBeTruthy();
  });

  it('validates Forgot Password email format, calls sendPasswordResetEmail, shows generic confirmation, and handles rate limits', async () => {
    const user = userEvent.setup();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    renderWithRouter(['/staff/login']);

    await user.click(await screen.findByRole('button', { name: /forgot password\?/i }));
    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeTruthy();

    // 1. Reject invalid email format
    const resetInput = screen.getByLabelText(/studio email address/i);
    await user.type(resetInput, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /please enter a valid email address\./i,
    );
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();

    // 2. Valid email sends reset request and shows generic confirmation message
    await user.clear(resetInput);
    await user.type(resetInput, '  staff@37musicstudio.com  ');
    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'staff@37musicstudio.com',
    );
    expect(
      await screen.findByText(
        /if an account matches this email address, password reset instructions will be sent\./i,
      ),
    ).toBeTruthy();

    // 3. Rate limit error handling
    const rateLimitErr = new Error('Too many requests');
    rateLimitErr.code = 'auth/too-many-requests';
    mockSendPasswordResetEmail.mockRejectedValueOnce(rateLimitErr);

    await user.click(screen.getByRole('button', { name: /send reset instructions/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /too many attempts; try again later\./i,
    );
  });
});
