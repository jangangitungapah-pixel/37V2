import { createAuthError, isAllowedStaffRole } from './auth-helpers';

export const STAFF_PROFILES_COLLECTION = 'staffProfiles';

/**
 * Fetches and validates `staffProfiles/{authenticatedUser.uid}` from Cloud Firestore.
 *
 * Dynamically imports Firestore when an authenticated user session is present so
 * unauthenticated visitors on the public landing page do not download the Firestore SDK.
 *
 * Authorization requires:
 * 1. Document exists at `staffProfiles/{uid}`.
 * 2. Document ID matches `authenticatedUser.uid`.
 * 3. `active === true`.
 * 4. `role === 'owner' || role === 'staff'`.
 */
export async function fetchAndValidateStaffProfile(authenticatedUser) {
  if (!authenticatedUser?.uid) {
    throw createAuthError('staff/profile-missing', 'Account is not authorized for staff access.');
  }

  let snapshot;
  try {
    const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
      import('firebase/firestore'),
      import('@/lib/firebase/firestore'),
    ]);
    const profileRef = doc(getFirebaseDb(), STAFF_PROFILES_COLLECTION, authenticatedUser.uid);
    snapshot = await getDoc(profileRef);
  } catch (error) {
    if (
      error?.code === 'permission-denied' ||
      error?.code === 'firestore/permission-denied' ||
      error?.code === 'staff/permission-denied'
    ) {
      throw createAuthError(
        'staff/permission-denied',
        'Cannot verify studio access; contact administrator.',
      );
    }
    throw error;
  }

  if (!snapshot || !snapshot.exists()) {
    throw createAuthError('staff/profile-missing', 'Account is not authorized for staff access.');
  }

  if (snapshot.id && snapshot.id !== authenticatedUser.uid) {
    throw createAuthError('staff/profile-missing', 'Account is not authorized for staff access.');
  }

  const data = snapshot.data() || {};

  if (data.active !== true) {
    throw createAuthError('staff/account-inactive', 'Account inactive.');
  }

  if (!isAllowedStaffRole(data.role)) {
    throw createAuthError('staff/invalid-role', 'Access denied.');
  }

  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : authenticatedUser.displayName || 'Studio Staff';

  const email =
    typeof data.email === 'string' && data.email.trim()
      ? data.email.trim()
      : authenticatedUser.email || '';

  return {
    uid: authenticatedUser.uid,
    displayName,
    email,
    role: data.role,
    active: true,
    createdAt: data.createdAt ?? null,
  };
}
