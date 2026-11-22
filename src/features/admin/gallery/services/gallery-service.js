import { GALLERY_DEFAULT_SORT_STEP, GALLERY_STATUSES } from '../config/gallery-config';
import {
  createGalleryRepositoryError,
  generateGalleryItemId,
  getGalleryRepositoryAdapter,
} from '../repositories/gallery-repository';
import {
  validateGalleryItemPublishable,
  validateGalleryMetadataInput,
} from '../schemas/gallery-schema';
import { sortPublishedGalleryItems } from '../utils/gallery-normalize';
import { validateCloudinaryUploadResponse } from './cloudinary-upload-service';

function assertActiveOwner(actorUid, actorRole) {
  const role = String(actorRole || '')
    .trim()
    .toLowerCase();
  if (role !== 'owner' || !actorUid) {
    throw createGalleryRepositoryError(
      'gallery/forbidden',
      'Owner Access Required: hanya akun Owner aktif yang dapat mengelola galeri studio.',
    );
  }
}

export function mapGalleryServiceErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'permission-denied' || code === 'gallery/forbidden') {
    return 'Akses ditolak: hanya akun dengan peran Owner aktif yang dapat mengubah data galeri.';
  }

  if (code === 'gallery/stale-version') {
    return (
      error?.message ||
      'Data foto telah diperbarui di sesi lain. Muat ulang data terbaru sebelum menyimpan perubahan.'
    );
  }

  if (code.startsWith('gallery/') && typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  if (code === 'unavailable' || code === 'failed-precondition') {
    return 'Koneksi ke Cloud Firestore sedang terganggu. Periksa jaringan lalu coba kembali.';
  }

  return error?.message || 'Terjadi kendala saat menyimpan perubahan galeri ke Firestore.';
}

export function computeNextSortOrder(existingItems = []) {
  if (!Array.isArray(existingItems) || existingItems.length === 0) {
    return GALLERY_DEFAULT_SORT_STEP;
  }
  const maxOrder = existingItems.reduce((acc, item) => {
    const val = Number(item?.sortOrder);
    return Number.isInteger(val) && val > acc ? val : acc;
  }, 0);
  return maxOrder + GALLERY_DEFAULT_SORT_STEP;
}

/**
 * Persists a validated Cloudinary upload response into `galleryItems/{itemId}` as a `draft`.
 * If Firestore creation fails after Cloudinary succeeds, callers can re-invoke this function
 * with the same `itemId` and `cloudinaryResponse` without re-uploading the image file.
 */
export async function createGalleryMetadataFromUpload({
  itemId = '',
  actorUid,
  actorRole,
  cloudinaryResponse,
  initialMetadata = {},
  existingItems = [],
  expectedCloudName = '',
  adapter = null,
}) {
  assertActiveOwner(actorUid, actorRole);

  const resolvedItemId =
    typeof itemId === 'string' && itemId.trim() ? itemId.trim() : generateGalleryItemId();

  // Accept either raw Cloudinary upload JSON (`public_id`) or already validated asset shape (`cloudinaryPublicId`)
  const validatedAsset = cloudinaryResponse?.cloudinaryPublicId
    ? validateCloudinaryUploadResponse(
        {
          public_id: cloudinaryResponse.cloudinaryPublicId,
          asset_id: cloudinaryResponse.cloudinaryAssetId,
          secure_url: cloudinaryResponse.secureUrl,
          resource_type: cloudinaryResponse.resourceType,
          format: cloudinaryResponse.format,
          width: cloudinaryResponse.width,
          height: cloudinaryResponse.height,
          bytes: cloudinaryResponse.bytes,
        },
        { expectedCloudName },
      )
    : validateCloudinaryUploadResponse(cloudinaryResponse, { expectedCloudName });

  const metaValidation = validateGalleryMetadataInput(
    {
      title: initialMetadata.title || 'Studio Photo',
      category: initialMetadata.category || 'Recording',
      altText: initialMetadata.altText || '',
      caption: initialMetadata.caption || '',
    },
    { requirePublishableAltText: false },
  );

  if (!metaValidation.success) {
    throw createGalleryRepositoryError(
      'gallery/validation-error',
      metaValidation.errors[0] || 'Metadata foto tidak valid.',
      { fieldErrors: metaValidation.fieldErrors },
    );
  }

  const sortOrder =
    Number.isInteger(initialMetadata.sortOrder) && initialMetadata.sortOrder >= 0
      ? initialMetadata.sortOrder
      : computeNextSortOrder(existingItems);

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.createGalleryItemTransaction({
    itemId: resolvedItemId,
    actorUid,
    payload: {
      ...metaValidation.data,
      ...validatedAsset,
      sortOrder,
    },
  });
}

/**
 * Updates editable metadata (`title`, `category`, `altText`, `caption`) for a gallery item.
 * If the item is currently `published`, enforces non-empty valid `altText`.
 */
export async function updateGalleryItemMetadata({
  item,
  actorUid,
  actorRole,
  input,
  adapter = null,
}) {
  assertActiveOwner(actorUid, actorRole);

  if (!item?.id) {
    throw createGalleryRepositoryError('gallery/not-found', 'Item galeri tidak ditemukan.');
  }

  const isCurrentlyPublished = item.status === GALLERY_STATUSES.PUBLISHED;
  const validation = validateGalleryMetadataInput(input, {
    requirePublishableAltText: isCurrentlyPublished,
  });

  if (!validation.success) {
    throw createGalleryRepositoryError(
      'gallery/validation-error',
      validation.errors[0] || 'Metadata foto belum memenuhi syarat validasi.',
      { fieldErrors: validation.fieldErrors },
    );
  }

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.updateGalleryItemTransaction({
    itemId: item.id,
    actorUid,
    expectedVersion: item.version,
    patch: validation.data,
  });
}

/**
 * Publishes a draft gallery item so it appears on the public Landing Page.
 * Rejects archived items or items missing valid `altText`.
 */
export async function publishGalleryItem({
  item,
  actorUid,
  actorRole,
  existingItems = [],
  expectedCloudName = '',
  adapter = null,
}) {
  assertActiveOwner(actorUid, actorRole);

  const check = validateGalleryItemPublishable(item, { expectedCloudName });
  if (!check.canPublish) {
    throw createGalleryRepositoryError(
      'gallery/publish-validation-failed',
      check.errors[0] || 'Foto belum memenuhi syarat untuk dipublikasikan.',
      { errors: check.errors },
    );
  }

  const publishedItems = sortPublishedGalleryItems(existingItems);
  const hasDistinctSortOrder =
    Number.isInteger(item.sortOrder) &&
    item.sortOrder >= 0 &&
    !publishedItems.some((other) => other.id !== item.id && other.sortOrder === item.sortOrder);

  const nextSortOrder = hasDistinctSortOrder
    ? item.sortOrder
    : computeNextSortOrder(publishedItems);

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.updateGalleryItemTransaction({
    itemId: item.id,
    actorUid,
    expectedVersion: item.version,
    patch: {
      status: GALLERY_STATUSES.PUBLISHED,
      sortOrder: nextSortOrder,
    },
  });
}

/**
 * Unpublishes a published gallery item back to `draft` status.
 */
export async function unpublishGalleryItem({ item, actorUid, actorRole, adapter = null }) {
  assertActiveOwner(actorUid, actorRole);

  if (!item?.id) {
    throw createGalleryRepositoryError('gallery/not-found', 'Item galeri tidak ditemukan.');
  }

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.updateGalleryItemTransaction({
    itemId: item.id,
    actorUid,
    expectedVersion: item.version,
    patch: {
      status: GALLERY_STATUSES.DRAFT,
    },
  });
}

/**
 * Moves a gallery item to `archived` status (removed from public display without deleting Cloudinary binary).
 */
export async function archiveGalleryItem({ item, actorUid, actorRole, adapter = null }) {
  assertActiveOwner(actorUid, actorRole);

  if (!item?.id) {
    throw createGalleryRepositoryError('gallery/not-found', 'Item galeri tidak ditemukan.');
  }

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.updateGalleryItemTransaction({
    itemId: item.id,
    actorUid,
    expectedVersion: item.version,
    patch: {
      status: GALLERY_STATUSES.ARCHIVED,
    },
  });
}

/**
 * Restores an `archived` gallery item to `draft` status (never directly to `published`).
 */
export async function restoreGalleryItem({ item, actorUid, actorRole, adapter = null }) {
  assertActiveOwner(actorUid, actorRole);

  if (!item?.id) {
    throw createGalleryRepositoryError('gallery/not-found', 'Item galeri tidak ditemukan.');
  }

  if (item.status !== GALLERY_STATUSES.ARCHIVED) {
    throw createGalleryRepositoryError(
      'gallery/not-archived',
      'Hanya foto berstatus Archived yang dapat dipulihkan ke Draft.',
    );
  }

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.updateGalleryItemTransaction({
    itemId: item.id,
    actorUid,
    expectedVersion: item.version,
    patch: {
      status: GALLERY_STATUSES.DRAFT,
    },
  });
}

/**
 * Moves a published gallery item up (`direction = 'up'`) or down (`direction = 'down'`)
 * by swapping its `sortOrder` with the adjacent published item inside a single transaction.
 */
export async function reorderPublishedGalleryItem({
  itemId,
  direction,
  publishedItems = [],
  actorUid,
  actorRole,
  adapter = null,
}) {
  assertActiveOwner(actorUid, actorRole);

  const ordered = sortPublishedGalleryItems(publishedItems);
  const currentIndex = ordered.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) {
    throw createGalleryRepositoryError(
      'gallery/reorder-not-published',
      'Foto tidak ditemukan pada daftar foto yang dipublikasikan.',
    );
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return null;
  }

  const currentItem = ordered[currentIndex];
  const adjacentItem = ordered[targetIndex];

  const resolvedAdapter = adapter || getGalleryRepositoryAdapter();
  return resolvedAdapter.swapGallerySortOrderTransaction({
    firstItemId: currentItem.id,
    firstExpectedVersion: currentItem.version,
    secondItemId: adjacentItem.id,
    secondExpectedVersion: adjacentItem.version,
    actorUid,
  });
}
