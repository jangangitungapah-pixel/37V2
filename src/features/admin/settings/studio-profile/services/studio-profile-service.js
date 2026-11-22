import {
  createStudioProfileRepositoryError,
  getStudioProfileRepositoryAdapter,
} from '../repositories/studio-profile-repository';
import { validateStudioProfile } from '../schemas/studio-profile-schema';

export function mapStudioProfileErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'permission-denied' || code === 'studio-profile/forbidden') {
    return 'Akses ditolak: hanya akun dengan peran Owner yang aktif yang dapat menyimpan perubahan Studio Profile.';
  }

  if (code === 'studio-profile/stale-version') {
    return (
      error?.message ||
      'Profil studio telah diperbarui di sesi lain. Muat data terbaru sebelum menyimpan ulang.'
    );
  }

  if (code === 'studio-profile/validation-error') {
    return error?.message || 'Data profil studio belum memenuhi syarat validasi.';
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Koneksi ke Cloud Firestore sedang terganggu. Periksa koneksi lalu coba simpan kembali.';
  }

  if (code === 'unauthenticated') {
    return 'Sesi autentikasi berakhir. Silakan login kembali sebagai Owner.';
  }

  return error?.message || 'Terjadi kendala saat menyimpan Studio Profile ke Firestore.';
}

/**
 * Validates Studio Profile input, verifies Owner privilege, and commits to
 * `settings/studioProfile` via optimistic concurrency transaction.
 */
export async function saveStudioProfile({
  actorUid,
  actorRole,
  input,
  expectedVersion,
  publicSiteSettingsInput = null,
  adapter = null,
}) {
  const normalizedRole = String(actorRole || '')
    .trim()
    .toLowerCase();
  if (normalizedRole !== 'owner' || !actorUid) {
    throw createStudioProfileRepositoryError(
      'studio-profile/forbidden',
      'Hanya akun Owner yang aktif yang berhak menyimpan perubahan Studio Profile.',
    );
  }

  const validation = validateStudioProfile(input);
  if (!validation.success) {
    throw createStudioProfileRepositoryError(
      'studio-profile/validation-error',
      validation.errors[0] || 'Data profil studio tidak valid.',
      {
        fieldErrors: validation.fieldErrors,
        errors: validation.errors,
      },
    );
  }

  const resolvedAdapter = adapter || getStudioProfileRepositoryAdapter();
  return resolvedAdapter.saveStudioProfileTransaction({
    actorUid,
    payload: validation.data,
    expectedVersion,
    publicSiteSettingsInput,
  });
}
