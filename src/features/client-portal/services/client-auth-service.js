import { createAuthError } from '@/features/auth/auth-helpers';
import { isFirebaseConfigured } from '@/lib/firebase/client';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ADMIN_ACCOUNT_NOTICE,
  CLIENT_ROLE,
  CLIENT_SUSPENDED_MESSAGE,
} from '../config/client-portal-config';
import { getClientPortalRepositoryAdapter } from '../repositories/client-portal-repository';
import { validateGoogleFirebaseUser } from '../utils/client-auth-helpers';

async function loadGoogleAuthDeps() {
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
 * Resolves an authenticated Google user's canonical Client authorization & profile binding.
 * When `allowProvision: true` (interactive Google login or redirect return), immediately provisions
 * an `active` Client account linked via exact verified email matching or an isolated personal profile.
 * Never approves or modifies Staff/Owner identities.
 */
export async function resolveOrProvisionClientAccount(
  firebaseUser,
  { allowProvision = false, adapter = getClientPortalRepositoryAdapter() } = {},
) {
  if (!firebaseUser?.uid) {
    throw createAuthError('client/unauthenticated', 'Sesi autentikasi Google tidak ditemukan.');
  }

  // 1. Strict role separation: never convert or overwrite an existing Staff/Owner profile
  const staffCheck = await adapter.hasStaffProfile(firebaseUser.uid);
  if (staffCheck?.exists) {
    throw createAuthError('client/staff-account-blocked', CLIENT_ADMIN_ACCOUNT_NOTICE);
  }

  // 2. Check existing account first or validate Google identity claims
  const identity = await validateGoogleFirebaseUser(firebaseUser);

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

  // 3. Exact verified email matching via Staff-maintained `customerEmailIndex/{emailNormalized}`
  let emailIndex;
  try {
    emailIndex = await adapter.getEmailIndexForOwnEmail(identity.emailNormalized);
  } catch {
    emailIndex = null;
  }

  let provisionedResult = null;
  if (emailIndex && emailIndex.status === 'active' && emailIndex.customerId) {
    try {
      provisionedResult = await adapter.provisionClientAccountLinked({
        uid: identity.uid,
        emailNormalized: identity.emailNormalized,
        displayName: identity.displayName,
        photoURL: identity.photoURL,
        matchedCustomerId: emailIndex.customerId,
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

  // 4. Ambiguous / missing / claimed match -> safely fall back to isolated client profile
  if (!provisionedResult) {
    provisionedResult = await adapter.provisionClientAccountIsolated({
      uid: identity.uid,
      emailNormalized: identity.emailNormalized,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
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

async function cleanupFailedGoogleAuthSession(auth, error, signOutFn, adapter) {
  if (error?.code === 'client/staff-account-blocked' && auth?.currentUser?.uid) {
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
  adapter = getClientPortalRepositoryAdapter(),
} = {}) {
  if (!isFirebaseConfigured()) {
    throw createAuthError('firebase/not-configured', 'Firebase configuration is incomplete.');
  }

  const { auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } =
    await loadGoogleAuthDeps();

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
    await cleanupFailedGoogleAuthSession(auth, err, signOut, adapter);
    throw err;
  }
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

  const { auth, getRedirectResult, signOut } = await loadGoogleAuthDeps();
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
    await cleanupFailedGoogleAuthSession(auth, err, signOut, adapter);
    throw err;
  }
}
