import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
} from '@/features/admin/customer/utils/customer-email';
import { createAuthError } from '@/features/auth/auth-helpers';
import { isFirebaseConfigured } from '@/lib/firebase/client';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ADMIN_ACCOUNT_NOTICE,
  CLIENT_ROLE,
  CLIENT_SUSPENDED_MESSAGE,
} from '../config/client-portal-config';
import { getClientPortalRepositoryAdapter } from '../repositories/client-portal-repository';
import {
  CLIENT_PASSWORD_RESET_CONFIRMATION,
  validateClientFirebaseUser,
} from '../utils/client-auth-helpers';

async function loadClientAuthDeps() {
  const [authSdk, { getFirebaseAuth }] = await Promise.all([
    import('firebase/auth'),
    import('@/lib/firebase/auth'),
  ]);

  return {
    ...authSdk,
    auth: getFirebaseAuth(),
  };
}

function isLinkConflictError(err) {
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'client/link-conflict' ||
    code.includes('permission-denied') ||
    code.includes('already-exists')
  );
}

/**
 * Resolves an authenticated Client user's canonical authorization & profile binding.
 * Supports both verified Google (`google.com`) and manual Email/Password (`password`) accounts:
 * - Only verified Google accounts may look up and bind to existing `customerEmailIndex` records.
 * - Unverified/password accounts always provision safely into isolated `client_{uid}` profiles.
 * - Never approves or modifies Staff/Owner identities.
 */
export async function resolveOrProvisionClientAccount(
  firebaseUser,
  {
    allowProvision = false,
    preferredDisplayName = '',
    adapter = getClientPortalRepositoryAdapter(),
  } = {},
) {
  if (!firebaseUser?.uid) {
    throw createAuthError('client/unauthenticated', 'Sesi autentikasi tidak ditemukan.');
  }

  // 1. Strict role separation: never convert or overwrite an existing Staff/Owner profile
  const staffCheck = await adapter.hasStaffProfile(firebaseUser.uid);
  if (staffCheck?.exists) {
    throw createAuthError('client/staff-account-blocked', CLIENT_ADMIN_ACCOUNT_NOTICE);
  }

  // 2. Validate supported Client auth provider & email identity claims
  const identity = await validateClientFirebaseUser(firebaseUser, {
    fallbackDisplayName: preferredDisplayName,
  });

  const existingAccount = await adapter.getClientAccount(identity.uid);
  if (existingAccount) {
    if (existingAccount.uid !== identity.uid || existingAccount.role !== CLIENT_ROLE) {
      throw createAuthError('client/invalid-binding', 'Akun Client tidak valid.');
    }

    if (existingAccount.status === CLIENT_ACCOUNT_STATUS.SUSPENDED) {
      throw createAuthError('client/account-suspended', CLIENT_SUSPENDED_MESSAGE);
    }

    if (existingAccount.status !== CLIENT_ACCOUNT_STATUS.ACTIVE || !existingAccount.customerId) {
      throw createAuthError('client/invalid-binding', 'Status akun Client tidak valid.');
    }

    const clientProfile = await adapter.getClientProfile(existingAccount.customerId);
    if (
      !clientProfile ||
      clientProfile.customerId !== existingAccount.customerId ||
      clientProfile.status !== 'active'
    ) {
      throw createAuthError(
        'client/invalid-binding',
        'Profil customer Client tidak tersedia atau tidak aktif.',
      );
    }

    return {
      user: firebaseUser,
      clientAccount: existingAccount,
      clientProfile,
      isNewAccount: false,
    };
  }

  if (!allowProvision) {
    throw createAuthError(
      'client/account-missing',
      'Akun Client belum terdaftar. Silakan masuk melalui halaman Client Portal.',
    );
  }

  // 3. Exact verified Google email matching via Staff-maintained `customerEmailIndex/{emailNormalized}`
  //    Password accounts never claim studio customer records before email verification.
  const canLinkExistingCustomer =
    identity.authProvider === 'google.com' && identity.emailVerified === true;

  let emailIndex = null;
  if (canLinkExistingCustomer) {
    try {
      emailIndex = await adapter.getEmailIndexForOwnEmail(identity.emailNormalized);
    } catch {
      emailIndex = null;
    }
  }

  let provisionedResult = null;
  if (canLinkExistingCustomer && emailIndex && emailIndex.status === 'active' && emailIndex.customerId) {
    try {
      provisionedResult = await adapter.provisionClientAccountLinked({
        uid: identity.uid,
        emailNormalized: identity.emailNormalized,
        displayName: identity.displayName,
        photoURL: identity.photoURL,
        matchedCustomerId: emailIndex.customerId,
        authProvider: identity.authProvider,
        emailVerified: identity.emailVerified,
      });
    } catch (linkErr) {
      if (linkErr?.code === 'client/staff-account-blocked') {
        throw createAuthError('client/staff-account-blocked', CLIENT_ADMIN_ACCOUNT_NOTICE);
      }
      if (!isLinkConflictError(linkErr)) {
        throw linkErr;
      }
    }
  }

  // 4. Ambiguous / missing / password-based -> safely provision isolated client profile
  if (!provisionedResult) {
    provisionedResult = await adapter.provisionClientAccountIsolated({
      uid: identity.uid,
      emailNormalized: identity.emailNormalized,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
      authProvider: identity.authProvider,
      emailVerified: identity.emailVerified,
    });
  }

  const resolvedAccount = provisionedResult?.account;
  if (!resolvedAccount || resolvedAccount.role !== CLIENT_ROLE) {
    throw createAuthError('client/invalid-binding', 'Gagal memverifikasi akun Client baru.');
  }

  if (resolvedAccount.status === CLIENT_ACCOUNT_STATUS.SUSPENDED) {
    throw createAuthError('client/account-suspended', CLIENT_SUSPENDED_MESSAGE);
  }

  if (resolvedAccount.status !== CLIENT_ACCOUNT_STATUS.ACTIVE || !resolvedAccount.customerId) {
    throw createAuthError('client/invalid-binding', 'Akun Client baru belum berstatus aktif.');
  }

  const resolvedProfile = await adapter.getClientProfile(resolvedAccount.customerId);
  if (
    !resolvedProfile ||
    resolvedProfile.customerId !== resolvedAccount.customerId ||
    resolvedProfile.status !== 'active'
  ) {
    throw createAuthError('client/invalid-binding', 'Gagal memuat profil Client yang baru dibuat.');
  }

  return {
    user: firebaseUser,
    clientAccount: resolvedAccount,
    clientProfile: resolvedProfile,
    isNewAccount: !provisionedResult?.alreadyExisted,
  };
}

async function cleanupFailedClientAuthSession(
  auth,
  error,
  signOutFn,
  adapter,
  { preserveExistingStaffSession = false, previousStaffUid = '' } = {},
) {
  if (
    preserveExistingStaffSession &&
    error?.code === 'client/staff-account-blocked' &&
    auth?.currentUser?.uid &&
    (!previousStaffUid || previousStaffUid === auth.currentUser.uid)
  ) {
    try {
      const staff = await adapter.hasStaffProfile(auth.currentUser.uid);
      if (staff?.active) {
        return;
      }
    } catch {
      // Fall through to sign out
    }
  }
  if (typeof signOutFn === 'function' && auth) {
    await signOutFn(auth).catch(() => {});
  }
}

/**
 * Initiates Google Sign-In / Sign-Up for the Client Portal using popup first,
 * falling back to `signInWithRedirect` only if popup is blocked or unsupported.
 */
export async function signInClientWithGoogle({
  preserveExistingStaffSession = false,
  previousStaffUid = '',
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const { auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } =
    await loadClientAuthDeps();

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters?.({ prompt: 'select_account' });

  let credential;
  try {
    credential = await signInWithPopup(auth, provider);
  } catch (error) {
    const code = String(error?.code || '');
    if (
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment') &&
      typeof signInWithRedirect === 'function'
    ) {
      await signInWithRedirect(auth, provider);
      return { redirected: true };
    }
    throw error;
  }

  const authenticatedUser = credential?.user;
  try {
    return await resolveOrProvisionClientAccount(authenticatedUser, {
      allowProvision: true,
      adapter,
    });
  } catch (err) {
    await cleanupFailedClientAuthSession(auth, err, signOut, adapter, {
      preserveExistingStaffSession,
      previousStaffUid,
    });
    throw err;
  }
}

/**
 * Creates a new Client account manually with Email & Password and immediately activates
 * an isolated Client profile (`client_{uid}`) without requiring email verification upfront.
 */
export async function signUpClientWithEmailPassword({
  displayName,
  email,
  password,
  preserveExistingStaffSession = false,
  previousStaffUid = '',
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const cleanName = String(displayName ?? '').trim();
  if (cleanName.length < 2 || cleanName.length > 120) {
    throw createAuthError(
      'client/missing-name',
      'Masukkan nama lengkap atau nama band Anda (minimal 2 karakter).',
    );
  }

  const emailNormalized = normalizeCustomerEmail(email ?? '');
  if (!emailNormalized || !isValidCustomerEmail(emailNormalized)) {
    throw createAuthError('client/invalid-email', 'Masukkan alamat email yang valid.');
  }

  const rawPassword = typeof password === 'string' ? password : '';
  if (rawPassword.length < 6) {
    throw createAuthError('client/weak-password', 'Password minimal terdiri dari 6 karakter.');
  }

  const { auth, createUserWithEmailAndPassword, updateProfile, signOut } =
    await loadClientAuthDeps();

  const credential = await createUserWithEmailAndPassword(auth, emailNormalized, rawPassword);
  const createdUser = credential?.user;

  if (createdUser && typeof updateProfile === 'function') {
    await updateProfile(createdUser, { displayName: cleanName }).catch(() => {});
  }

  try {
    return await resolveOrProvisionClientAccount(createdUser, {
      allowProvision: true,
      preferredDisplayName: cleanName,
      adapter,
    });
  } catch (err) {
    await cleanupFailedClientAuthSession(auth, err, signOut, adapter, {
      preserveExistingStaffSession,
      previousStaffUid,
    });
    throw err;
  }
}

/**
 * Authenticates a Client user manually using Email & Password.
 */
export async function signInClientWithEmailPassword({
  email,
  password,
  preserveExistingStaffSession = false,
  previousStaffUid = '',
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const emailNormalized = normalizeCustomerEmail(email ?? '');
  if (!emailNormalized || !isValidCustomerEmail(emailNormalized)) {
    throw createAuthError('client/invalid-email', 'Masukkan alamat email yang valid.');
  }

  const rawPassword = typeof password === 'string' ? password : '';
  if (!rawPassword) {
    throw createAuthError('client/missing-password', 'Masukkan password Anda.');
  }

  const { auth, signInWithEmailAndPassword, signOut } = await loadClientAuthDeps();

  const credential = await signInWithEmailAndPassword(auth, emailNormalized, rawPassword);
  const authenticatedUser = credential?.user;

  try {
    return await resolveOrProvisionClientAccount(authenticatedUser, {
      allowProvision: true,
      adapter,
    });
  } catch (err) {
    await cleanupFailedClientAuthSession(auth, err, signOut, adapter, {
      preserveExistingStaffSession,
      previousStaffUid,
    });
    throw err;
  }
}

/**
 * Sends a Firebase password reset email for Client Portal users without disclosing
 * whether a specific email exists.
 */
export async function requestClientPasswordReset(email) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const emailNormalized = normalizeCustomerEmail(email ?? '');
  if (!emailNormalized || !isValidCustomerEmail(emailNormalized)) {
    throw createAuthError('client/invalid-email', 'Masukkan alamat email yang valid.');
  }

  const { auth, sendPasswordResetEmail } = await loadClientAuthDeps();

  try {
    await sendPasswordResetEmail(auth, emailNormalized);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return {
        message: CLIENT_PASSWORD_RESET_CONFIRMATION,
      };
    }
    throw error;
  }

  return {
    message: CLIENT_PASSWORD_RESET_CONFIRMATION,
  };
}

/**
 * Completes a pending Google redirect sign-in on app initialization if present.
 */
export async function completeGoogleRedirectIfPresent({
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const { auth, getRedirectResult, signOut } = await loadClientAuthDeps();
  if (typeof getRedirectResult !== 'function') {
    return null;
  }

  const result = await getRedirectResult(auth);
  if (!result?.user) {
    return null;
  }

  try {
    return await resolveOrProvisionClientAccount(result.user, {
      allowProvision: true,
      adapter,
    });
  } catch (err) {
    await cleanupFailedClientAuthSession(auth, err, signOut, adapter);
    throw err;
  }
}
