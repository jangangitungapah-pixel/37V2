import { DEFAULT_BOOKING_POLICIES } from '../config/booking-policies-config';
import { getBookingPoliciesRepositoryAdapter } from '../repositories/booking-policies-repository';
import { normalizeBookingPolicies, validateBookingPolicies } from '../utils/booking-policies-normalize';

export function createBookingPoliciesServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function assertOwner(actorUid, actorRole) {
  const uid = String(actorUid || '').trim();
  const role = String(actorRole || '').trim().toLowerCase();
  if (!uid || role !== 'owner') {
    throw createBookingPoliciesServiceError(
      'booking-policies/owner-only',
      'Hanya Owner aktif yang dapat menyimpan Booking Policies.',
    );
  }
  return uid;
}

export function mapBookingPoliciesErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('owner-only') || code.includes('permission-denied')) {
    return 'Akses ditolak. Pastikan akun Anda adalah Owner aktif.';
  }
  if (code.includes('stale-update')) {
    return error.message || 'Policy sudah berubah di sesi lain. Muat ulang sebelum menyimpan.';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Koneksi ke penyimpanan Booking Policies gagal. Periksa koneksi lalu coba lagi.';
  }
  return error?.message || 'Booking Policies gagal disimpan.';
}

export async function saveBookingPolicies({
  actorUid,
  actorRole,
  policies,
  expectedVersion,
  adapter = getBookingPoliciesRepositoryAdapter(),
}) {
  const cleanActorUid = assertOwner(actorUid, actorRole);
  const normalized = normalizeBookingPolicies(policies || DEFAULT_BOOKING_POLICIES);
  const validation = validateBookingPolicies(normalized);
  if (!validation.isValid) {
    const details = validation.errors;
    const firstError = Object.values(details)[0] || 'Konfigurasi Booking Policies tidak valid.';
    throw createBookingPoliciesServiceError(
      'booking-policies/validation-error',
      firstError,
      details,
    );
  }
  return adapter.saveBookingPolicies({
    actorUid: cleanActorUid,
    policies: validation.data,
    expectedVersion,
  });
}
