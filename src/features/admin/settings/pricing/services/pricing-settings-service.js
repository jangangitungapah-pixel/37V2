import {
  createPricingSettingsRepositoryError,
  getPricingSettingsRepositoryAdapter,
} from '../repositories/pricing-settings-repository';
import { validatePricingSettingsPayload } from '../schemas/pricing-settings-schema';
import { normalizePricingSettings } from '../utils/normalize-pricing-settings';

export function mapPricingSettingsErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'pricing/owner-only') {
    return (
      error.message ||
      'Hanya Owner yang berwenang mengubah dan menyimpan konfigurasi harga serta fee internal.'
    );
  }

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Perubahan Price and Fee Settings hanya diizinkan untuk akun Owner yang aktif.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi ke Firestore terputus. Perubahan lokal Anda tetap dipertahankan—coba simpan ulang.';
  }

  if (code === 'pricing/stale-version') {
    return (
      error.message ||
      'Konfigurasi telah diperbarui di sesi lain. Muat versi terbaru sebelum menyimpan.'
    );
  }

  if (code.startsWith('pricing/') && error?.message) {
    return error.message;
  }

  return 'Gagal menyimpan Price and Fee Settings. Perubahan lokal Anda tetap dipertahankan.';
}

/**
 * Validates and atomically saves the unified `settings/pricing` Schema V2 document to Cloud Firestore.
 */
export async function savePricingSettings({
  actorUid,
  actorRole,
  settings,
  expectedVersion,
  adapter = getPricingSettingsRepositoryAdapter(),
}) {
  const cleanActorUid = String(actorUid || '').trim();
  if (!cleanActorUid) {
    throw createPricingSettingsRepositoryError(
      'pricing/missing-actor',
      'Sesi autentikasi tidak ditemukan. Silakan login kembali sebelum menyimpan.',
    );
  }

  if (actorRole !== undefined && String(actorRole).trim().toLowerCase() !== 'owner') {
    throw createPricingSettingsRepositoryError(
      'pricing/owner-only',
      'Hanya Owner yang berwenang mengubah dan menyimpan konfigurasi harga serta fee internal.',
    );
  }

  const normalizedInput = normalizePricingSettings(settings, { preserveInvalid: true });
  const validation = validatePricingSettingsPayload(normalizedInput);

  if (!validation.isValid) {
    throw createPricingSettingsRepositoryError(
      'pricing/validation-error',
      validation.message || 'Data Price and Fee Settings belum valid.',
      validation.errors,
    );
  }

  return adapter.savePricingSettingsTransaction({
    actorUid: cleanActorUid,
    payload: validation.data,
    expectedVersion,
  });
}

/**
 * Owner-only one-time/manual backfill that projects persisted `settings/pricing`
 * into `publicPricingCatalog/current` without altering internal pricing or fees.
 */
export async function syncPublicPricingCatalog({
  actorUid,
  actorRole,
  adapter = getPricingSettingsRepositoryAdapter(),
}) {
  const cleanActorUid = String(actorUid || '').trim();
  if (!cleanActorUid) {
    throw createPricingSettingsRepositoryError(
      'pricing/missing-actor',
      'Sesi autentikasi tidak ditemukan. Silakan login kembali sebelum menyinkronkan katalog.',
    );
  }

  if (actorRole !== undefined && String(actorRole).trim().toLowerCase() !== 'owner') {
    throw createPricingSettingsRepositoryError(
      'pricing/owner-only',
      'Hanya Owner yang berwenang mempublikasikan atau menyinkronkan Public Pricing Catalog.',
    );
  }

  if (typeof adapter?.syncPublicPricingCatalogTransaction !== 'function') {
    throw createPricingSettingsRepositoryError(
      'pricing/sync-unsupported',
      'Adapter penyimpanan harga tidak mendukung sinkronisasi Public Pricing Catalog.',
    );
  }

  return adapter.syncPublicPricingCatalogTransaction({
    actorUid: cleanActorUid,
  });
}
