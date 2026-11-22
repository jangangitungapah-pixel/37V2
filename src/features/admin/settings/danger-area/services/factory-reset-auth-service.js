import { FACTORY_RESET_REAUTH_WINDOW_MS } from '../config/factory-reset-config';

export function createFactoryResetError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) {
    err.details = details;
  }
  return err;
}

/**
 * Strictly validates that the caller is an authenticated, active Studio Owner.
 * Staff accounts, inactive accounts, missing profiles, and unauthenticated sessions
 * are always rejected before any preview, start, resume, or cancel executes.
 */
export function assertActiveOwnerActor(actor = {}) {
  const user = actor?.user || null;
  const profile = actor?.profile || null;
  const uid = String(actor?.uid || user?.uid || profile?.uid || '').trim();
  const role = String(actor?.role || profile?.role || '')
    .trim()
    .toLowerCase();
  const profileRole = String(profile?.role || role || '')
    .trim()
    .toLowerCase();
  const isActive = profile ? profile.active === true : actor?.active === true;

  if (!uid || !isActive || role !== 'owner' || profileRole !== 'owner') {
    throw createFactoryResetError(
      'factory-reset/owner-required',
      'Hanya akun Owner Studio aktif yang diizinkan mengakses atau menjalankan Factory Reset.',
    );
  }

  return {
    uid,
    email: String(user?.email || profile?.email || '').trim(),
    role: 'owner',
    active: true,
  };
}

/**
 * Enforces a fresh Firebase Authentication password verification within the approved window.
 */
export function assertFreshReauthentication(reauthenticatedAt, now = Date.now()) {
  const ts = Number(reauthenticatedAt);
  const currentMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(ts) || ts <= 0 || currentMs - ts > FACTORY_RESET_REAUTH_WINDOW_MS) {
    throw createFactoryResetError(
      'factory-reset/reauth-required',
      'Verifikasi password Owner terbaru diperlukan sebelum menjalankan atau melanjutkan Factory Reset.',
    );
  }
  return ts;
}

/**
 * Runs current-password re-authentication through AuthProvider/auth-service without ever
 * logging, persisting, or exposing the raw password.
 */
export async function reauthenticateOwnerForFactoryReset({ actor, password, reauthenticate }) {
  assertActiveOwnerActor(actor);

  if (typeof reauthenticate !== 'function') {
    throw createFactoryResetError(
      'factory-reset/reauth-unavailable',
      'Layanan re-autentikasi Firebase tidak tersedia pada sesi ini.',
    );
  }

  const rawPassword = typeof password === 'string' ? password : '';
  if (!rawPassword) {
    throw createFactoryResetError(
      'auth/missing-password',
      'Masukkan password akun Owner Anda saat ini.',
    );
  }

  const res = await reauthenticate(rawPassword);
  assertActiveOwnerActor({
    user: res?.user || actor?.user,
    profile: res?.profile || actor?.profile,
    role: res?.profile?.role || actor?.role,
  });

  return Number(res?.reauthenticatedAt) || Date.now();
}
