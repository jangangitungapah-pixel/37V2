import { isFirebaseConfigured } from '@/lib/firebase/client';

import { createAuthError, PASSWORD_RESET_GENERIC_CONFIRMATION } from './auth-helpers';
import { fetchAndValidateStaffProfile } from './staff-profile-service';

async function loadFirebaseAuthDeps() {
  const [authSdk, { getFirebaseAuth }] = await Promise.all([
    import('firebase/auth'),
    import('@/lib/firebase/auth'),
  ]);

  return {
    ...authSdk,
    auth: getFirebaseAuth(),
  };
}

/**
 * Authenticates a Staff or Owner user with Email/Password and verifies their Firestore profile.
 * If the Firestore profile is missing, inactive, or has an invalid role, the Firebase Auth
 * session is immediately signed out and an authorization error is thrown.
 */
export async function signInStaffWithEmailPassword(email, password) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const normalizedEmail = String(email ?? '').trim();
  const rawPassword = String(password ?? '');
  const { auth, signInWithEmailAndPassword, signOut } = await loadFirebaseAuthDeps();

  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, rawPassword);
  const authenticatedUser = credential?.user;

  try {
    const profile = await fetchAndValidateStaffProfile(authenticatedUser);
    return {
      user: authenticatedUser,
      profile,
    };
  } catch (profileError) {
    await signOut(auth).catch(() => {});
    throw profileError;
  }
}

/**
 * Sends a password reset email via Firebase Authentication.
 * Returns a generic confirmation message so account existence is never disclosed.
 */
export async function requestStaffPasswordReset(email) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const normalizedEmail = String(email ?? '').trim();
  const { auth, sendPasswordResetEmail } = await loadFirebaseAuthDeps();

  try {
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error) {
    // Do not reveal whether a specific email address is registered
    if (error?.code === 'auth/user-not-found') {
      return {
        message: PASSWORD_RESET_GENERIC_CONFIRMATION,
      };
    }
    throw error;
  }

  return {
    message: PASSWORD_RESET_GENERIC_CONFIRMATION,
  };
}

/**
 * Re-authenticates the currently signed-in Firebase Authentication user with their current
 * Email/Password credential and re-verifies `staffProfiles/{uid}`.
 *
 * Never persists, logs, or trims the password.
 */
export async function reauthenticateCurrentStaff(password) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const rawPassword = typeof password === 'string' ? password : '';
  if (!rawPassword) {
    throw createAuthError(
      'auth/missing-password',
      'Masukkan password akun Anda saat ini untuk melanjutkan.',
    );
  }

  const { auth, EmailAuthProvider, reauthenticateWithCredential, signOut } =
    await loadFirebaseAuthDeps();
  const currentUser = auth?.currentUser;

  if (!currentUser || !currentUser.uid || !currentUser.email) {
    throw createAuthError(
      'auth/no-current-user',
      'Tidak ada sesi Firebase Auth aktif dengan alamat email yang valid.',
    );
  }

  const credential = EmailAuthProvider.credential(currentUser.email, rawPassword);
  await reauthenticateWithCredential(currentUser, credential);

  try {
    const profile = await fetchAndValidateStaffProfile(currentUser);
    return {
      user: currentUser,
      profile,
      reauthenticatedAt: Date.now(),
    };
  } catch (profileError) {
    await signOut(auth).catch(() => {});
    throw profileError;
  }
}

/**
 * Signs out the active Firebase Authentication session.
 */
export async function signOutStaff() {
  if (!isFirebaseConfigured()) {
    return;
  }

  const { auth, signOut } = await loadFirebaseAuthDeps();
  await signOut(auth);
}

/**
 * Subscribes to Firebase Authentication state changes.
 */
export function subscribeToStaffAuthChanges(listener) {
  if (!isFirebaseConfigured()) {
    queueMicrotask(() => listener(null));
    return () => {};
  }

  let isUnsubscribed = false;
  let unsubscribeAuth = null;

  loadFirebaseAuthDeps()
    .then(({ auth, onAuthStateChanged }) => {
      if (isUnsubscribed) return;
      unsubscribeAuth = onAuthStateChanged(auth, listener);
    })
    .catch(() => {
      if (!isUnsubscribed) {
        listener(null);
      }
    });

  return () => {
    isUnsubscribed = true;
    unsubscribeAuth?.();
  };
}
