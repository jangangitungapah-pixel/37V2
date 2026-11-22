import {
  createLandingPagePlacementError,
  getLandingPagePlacementAdapter,
} from '../repositories/landing-page-placement-repository';
import { validateLandingPagePlacementInput } from '../schemas/landing-page-placement-schema';

function assertActiveOwner(actorUid, actorRole) {
  const role = String(actorRole || '')
    .trim()
    .toLowerCase();
  if (role !== 'owner' || !actorUid) {
    throw createLandingPagePlacementError(
      'placement/forbidden',
      'Owner Access Required: hanya akun Owner aktif yang dapat mengubah media Landing Page.',
    );
  }
}

export function mapLandingPagePlacementErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'permission-denied' || code === 'placement/forbidden') {
    return 'Akses ditolak: hanya Owner aktif yang dapat menyimpan penempatan Landing Page.';
  }

  if (code === 'placement/stale-version') {
    return (
      error?.message || 'Penempatan ini baru saja diubah di sesi lain. Silakan coba simpan kembali.'
    );
  }

  if (code.startsWith('placement/') && error?.message) {
    return error.message;
  }

  return error?.message || 'Gagal menyimpan perubahan penempatan Landing Page.';
}

/**
 * Validates and saves a Landing Page placement (`hero-featured`, `room-a`, `room-b`, `studio-exterior`).
 */
export async function saveLandingPagePlacement({
  placementId,
  actorUid,
  actorRole,
  photoItem,
  altText,
  copy,
  status = 'published',
  expectedVersion = null,
  expectedCloudName = '',
  adapter = null,
}) {
  assertActiveOwner(actorUid, actorRole);

  const validation = validateLandingPagePlacementInput({
    placementId,
    photoItem,
    altText,
    copy,
    status,
    expectedCloudName,
  });

  if (!validation.success) {
    throw createLandingPagePlacementError(
      'placement/validation-error',
      validation.errors[0] || 'Data penempatan Landing Page belum lengkap.',
      { fieldErrors: validation.fieldErrors, errors: validation.errors },
    );
  }

  const resolvedAdapter = adapter || getLandingPagePlacementAdapter();
  return resolvedAdapter.savePlacementTransaction({
    placementId,
    actorUid,
    expectedVersion,
    payload: validation.data,
  });
}
