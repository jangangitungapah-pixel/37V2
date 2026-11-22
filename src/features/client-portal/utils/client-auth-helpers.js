import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
} from '@/features/admin/customer/utils/customer-email';
import { createAuthError } from '@/features/auth/auth-helpers';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ADMIN_ACCOUNT_NOTICE,
  CLIENT_PORTAL_SCHEMA_VERSION,
  CLIENT_PROFILE_SOURCE,
  CLIENT_ROLE,
  CLIENT_SUSPENDED_MESSAGE,
} from '../config/client-portal-config';

export function isClientRole(role) {
  return role === CLIENT_ROLE;
}

export function buildIsolatedClientCustomerId(uid = '') {
  const cleanUid = String(uid || '').trim();
  return cleanUid ? `client_${cleanUid}` : '';
}

function sanitizeDisplayName(rawName, emailNormalized = '') {
  const trimmed = String(rawName || '').trim();
  if (trimmed.length >= 1) {
    return trimmed.slice(0, 120);
  }
  const emailPrefix = String(emailNormalized || '').split('@')[0] || 'Client Studio';
  return emailPrefix.slice(0, 120);
}

function sanitizePhotoUrl(rawUrl = '') {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (!/^https:\/\//i.test(url)) return '';
  return url.slice(0, 500);
}

/**
 * Validates Firebase Authentication user & Google provider claims before Client provisioning or access.
 * Never trusts client form inputs or arbitrary profile claims.
 */
export async function validateGoogleFirebaseUser(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw createAuthError('client/unauthenticated', 'Sesi autentikasi Google tidak ditemukan.');
  }

  const providerList = Array.isArray(firebaseUser.providerData) ? firebaseUser.providerData : [];
  const hasGoogleProviderData = providerList.some(
    (entry) => entry && entry.providerId === 'google.com',
  );
  const directProviderId = String(firebaseUser.providerId || '').trim();
  const isGoogleProvider = hasGoogleProviderData || directProviderId === 'google.com';

  if (!isGoogleProvider) {
    throw createAuthError('client/invalid-provider', 'Silakan masuk menggunakan akun Google Anda.');
  }

  const emailNormalized = normalizeCustomerEmail(firebaseUser.email || '');
  if (!emailNormalized || !isValidCustomerEmail(emailNormalized)) {
    throw createAuthError(
      'client/missing-email',
      'Akun Google tidak menyertakan alamat email yang valid.',
    );
  }

  if (firebaseUser.emailVerified !== true) {
    throw createAuthError(
      'client/email-unverified',
      'Alamat email Google Anda harus terverifikasi sebelum menggunakan Client Portal.',
    );
  }

  if (typeof firebaseUser.getIdTokenResult === 'function') {
    const tokenResult = await firebaseUser.getIdTokenResult();
    const claims = tokenResult?.claims;
    if (claims) {
      const claimSignInProvider = claims?.firebase?.sign_in_provider;
      if (claimSignInProvider && claimSignInProvider !== 'google.com') {
        throw createAuthError(
          'client/invalid-provider',
          'Silakan masuk menggunakan metode Google Authentication.',
        );
      }
      if (claims.email_verified !== true) {
        throw createAuthError(
          'client/email-unverified',
          'Alamat email Google Anda harus terverifikasi sebelum menggunakan Client Portal.',
        );
      }
    }
  }

  return {
    uid: String(firebaseUser.uid).trim(),
    emailNormalized,
    displayName: sanitizeDisplayName(firebaseUser.displayName, emailNormalized),
    photoURL: sanitizePhotoUrl(firebaseUser.photoURL),
    authProvider: 'google.com',
    emailVerified: true,
  };
}

export function normalizeClientAccountRecord(uid, raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const resolvedUid = String(raw.uid || uid || '').trim();
  if (!resolvedUid || (uid && resolvedUid !== uid)) {
    return null;
  }

  const validStatuses = new Set(Object.values(CLIENT_ACCOUNT_STATUS));
  const status = validStatuses.has(raw.status) ? raw.status : CLIENT_ACCOUNT_STATUS.SUSPENDED;
  const validSources = new Set(Object.values(CLIENT_PROFILE_SOURCE));
  const profileSource = validSources.has(raw.profileSource)
    ? raw.profileSource
    : CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE;

  return {
    schemaVersion: Number(raw.schemaVersion) || CLIENT_PORTAL_SCHEMA_VERSION,
    uid: resolvedUid,
    role: raw.role === CLIENT_ROLE ? CLIENT_ROLE : '',
    status,
    customerId: String(raw.customerId || '').trim(),
    profileSource,
    emailNormalized: normalizeCustomerEmail(raw.emailNormalized || ''),
    displayName: String(raw.displayName || '').trim(),
    photoURL: String(raw.photoURL || '').trim(),
    authProvider: String(raw.authProvider || '').trim(),
    emailVerified: raw.emailVerified === true,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    version:
      Number.isInteger(Number(raw.version)) && Number(raw.version) >= 1 ? Number(raw.version) : 1,
  };
}

export function normalizeClientProfileRecord(customerId, raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const resolvedCustomerId = String(raw.customerId || customerId || '').trim();
  if (!resolvedCustomerId || (customerId && resolvedCustomerId !== customerId)) {
    return null;
  }

  const validSources = new Set(Object.values(CLIENT_PROFILE_SOURCE));
  const profileSource = validSources.has(raw.profileSource)
    ? raw.profileSource
    : CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE;

  return {
    schemaVersion: Number(raw.schemaVersion) || CLIENT_PORTAL_SCHEMA_VERSION,
    customerId: resolvedCustomerId,
    ownerUid: raw.ownerUid ? String(raw.ownerUid).trim() : null,
    profileSource,
    displayName: String(raw.displayName || '').trim(),
    emailNormalized: normalizeCustomerEmail(raw.emailNormalized || ''),
    phoneDisplay: String(raw.phoneDisplay || '').trim(),
    photoURL: String(raw.photoURL || '').trim(),
    status: String(raw.status || 'active').trim(),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    version:
      Number.isInteger(Number(raw.version)) && Number(raw.version) >= 1 ? Number(raw.version) : 1,
  };
}

/**
 * Maps Firebase Auth & Client Portal provisioning errors into calm, safe user-facing copy.
 * Never reveals raw Firebase errors, stack traces, or internal Firestore document paths.
 */
export function mapClientAuthErrorToMessage(error) {
  const code = String(error?.code || '').trim();

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Proses masuk dengan Google dibatalkan. Klik tombol di bawah jika ingin mencoba kembali.';
    case 'auth/popup-blocked':
      return 'Pop-up Google diblokir oleh browser Anda. Izinkan pop-up atau gunakan pengalihan halaman.';
    case 'auth/network-request-failed':
      return 'Koneksi jaringan bermasalah. Periksa internet Anda lalu coba masuk kembali.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan masuk. Tunggu beberapa saat lalu coba kembali.';
    case 'auth/user-disabled':
    case 'client/account-suspended':
      return CLIENT_SUSPENDED_MESSAGE;
    case 'auth/account-exists-with-different-credential':
    case 'auth/credential-already-in-use':
      return 'Email Google ini terhubung dengan metode masuk lain. Silakan hubungi tim 37 Music Studio.';
    case 'client/staff-account-blocked':
      return CLIENT_ADMIN_ACCOUNT_NOTICE;
    case 'client/email-unverified':
      return 'Email Google Anda belum terverifikasi. Gunakan akun Google dengan email terverifikasi.';
    case 'client/invalid-provider':
    case 'client/missing-email':
      return 'Tidak dapat memverifikasi akun Google Anda. Pastikan Anda menggunakan akun Google yang aktif.';
    case 'client/invalid-binding':
    case 'client/account-missing':
      return 'Data akun Client belum dapat diverifikasi. Silakan coba masuk ulang dengan Google.';
    case 'firebase/not-configured':
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Layanan autentikasi belum siap saat ini. Silakan coba lagi beberapa saat.';
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Akses akun tidak dapat diverifikasi saat ini. Silakan hubungi tim 37 Music Studio.';
    default:
      return 'Tidak dapat menyelesaikan masuk dengan Google saat ini. Silakan coba lagi.';
  }
}
