import { z } from 'zod';

import { GALLERY_UPLOAD_LIMITS } from '../config/gallery-config';
import {
  getLandingPagePlacementDefinition,
  LANDING_PAGE_PLACEMENT_ID_LIST,
  LANDING_PAGE_PLACEMENT_IDS,
  LANDING_PAGE_PLACEMENT_LIMITS,
} from '../config/landing-page-placements-config';
import { isValidCloudinaryDeliveryUrl } from '../utils/cloudinary-url';

export const heroFeaturedCopySchema = z.object({
  topSticker: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.stickerMax,
      `Sticker maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.stickerMax} karakter.`,
    ),
  captionTitle: z
    .string()
    .trim()
    .min(
      LANDING_PAGE_PLACEMENT_LIMITS.titleMin,
      `Judul foto minimal ${LANDING_PAGE_PLACEMENT_LIMITS.titleMin} karakter.`,
    )
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.titleMax,
      `Judul foto maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.titleMax} karakter.`,
    ),
  captionSubtitle: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.subtitleMax,
      `Subjudul maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.subtitleMax} karakter.`,
    ),
  floatingBadgeTitle: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.floatingTitleMax,
      `Judul badge maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.floatingTitleMax} karakter.`,
    ),
  floatingBadgeSubtitle: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.floatingSubtitleMax,
      `Subjudul badge maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.floatingSubtitleMax} karakter.`,
    ),
});

export const roomPlacementCopySchema = z.object({
  sticker: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.stickerMax,
      `Sticker ruangan maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.stickerMax} karakter.`,
    ),
  name: z
    .string()
    .trim()
    .min(
      LANDING_PAGE_PLACEMENT_LIMITS.titleMin,
      `Nama ruangan minimal ${LANDING_PAGE_PLACEMENT_LIMITS.titleMin} karakter.`,
    )
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.titleMax,
      `Nama ruangan maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.titleMax} karakter.`,
    ),
  capacityLabel: z
    .string()
    .trim()
    .min(
      LANDING_PAGE_PLACEMENT_LIMITS.capacityMin,
      `Deskripsi ruangan minimal ${LANDING_PAGE_PLACEMENT_LIMITS.capacityMin} karakter.`,
    )
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.capacityMax,
      `Deskripsi ruangan maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.capacityMax} karakter.`,
    ),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Tag tidak boleh kosong.')
        .max(
          LANDING_PAGE_PLACEMENT_LIMITS.tagMax,
          `Setiap tag maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.tagMax} karakter.`,
        ),
    )
    .min(1, 'Minimal 1 highlight tag diperlukan.')
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.maxTagsCount,
      `Maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.maxTagsCount} highlight tag.`,
    ),
  ctaLabel: z
    .string()
    .trim()
    .min(
      LANDING_PAGE_PLACEMENT_LIMITS.ctaLabelMin,
      `Teks tombol minimal ${LANDING_PAGE_PLACEMENT_LIMITS.ctaLabelMin} karakter.`,
    )
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.ctaLabelMax,
      `Teks tombol maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.ctaLabelMax} karakter.`,
    ),
});

export const studioExteriorCopySchema = z.object({
  caption: z
    .string()
    .trim()
    .max(
      LANDING_PAGE_PLACEMENT_LIMITS.exteriorCaptionMax,
      `Caption lokasi maksimal ${LANDING_PAGE_PLACEMENT_LIMITS.exteriorCaptionMax} karakter.`,
    ),
});

export function getPlacementCopySchema(placementId) {
  if (placementId === LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED) {
    return heroFeaturedCopySchema;
  }
  if (
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_A ||
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_B
  ) {
    return roomPlacementCopySchema;
  }
  if (placementId === LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR) {
    return studioExteriorCopySchema;
  }
  return null;
}

export function parseTagsInput(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  }
  if (typeof rawTags === 'string') {
    return rawTags
      .split(/[,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Validates a full Landing Page placement update payload (photo + altText + placement-specific copy).
 */
export function validateLandingPagePlacementInput({
  placementId,
  photoItem,
  altText,
  copy,
  status = 'published',
  expectedCloudName = '',
}) {
  const errors = [];
  const fieldErrors = {};

  if (!LANDING_PAGE_PLACEMENT_ID_LIST.includes(placementId)) {
    return {
      success: false,
      data: null,
      errors: [`Placement ID "${placementId || ''}" tidak valid.`],
      fieldErrors: { placementId: 'Placement ID tidak valid.' },
    };
  }

  const def = getLandingPagePlacementDefinition(placementId);

  if (!photoItem || typeof photoItem !== 'object') {
    const msg = 'Pilih foto untuk penempatan ini terlebih dahulu.';
    errors.push(msg);
    fieldErrors.photo = msg;
  } else {
    const sourceGalleryItemId =
      typeof (photoItem.sourceGalleryItemId || photoItem.id) === 'string'
        ? (photoItem.sourceGalleryItemId || photoItem.id).trim()
        : '';
    const cloudinaryPublicId =
      typeof photoItem.cloudinaryPublicId === 'string' ? photoItem.cloudinaryPublicId.trim() : '';
    const cloudinaryAssetId =
      typeof photoItem.cloudinaryAssetId === 'string' ? photoItem.cloudinaryAssetId.trim() : '';
    const secureUrl = typeof photoItem.secureUrl === 'string' ? photoItem.secureUrl.trim() : '';
    const format =
      typeof photoItem.format === 'string' ? photoItem.format.trim().toLowerCase() : '';
    const width = Number(photoItem.width);
    const height = Number(photoItem.height);
    const bytes = Number(photoItem.bytes);

    if (!sourceGalleryItemId || !cloudinaryPublicId || !cloudinaryAssetId) {
      const msg = 'Data referensi foto galeri tidak lengkap.';
      errors.push(msg);
      fieldErrors.photo = msg;
    }

    if (!isValidCloudinaryDeliveryUrl(secureUrl, expectedCloudName)) {
      const msg = 'URL gambar Cloudinary tidak valid.';
      errors.push(msg);
      fieldErrors.photo = msg;
    }

    if (
      !GALLERY_UPLOAD_LIMITS.allowedFormats.includes(format) ||
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0 ||
      !Number.isInteger(bytes) ||
      bytes <= 0
    ) {
      const msg = 'Metadata teknis gambar tidak valid.';
      errors.push(msg);
      fieldErrors.photo = msg;
    }
  }

  const resolvedAltText =
    typeof altText === 'string' && altText.trim()
      ? altText.trim()
      : typeof photoItem?.altText === 'string' && photoItem.altText.trim()
        ? photoItem.altText.trim()
        : typeof photoItem?.title === 'string' && photoItem.title.trim()
          ? photoItem.title.trim()
          : def?.defaultAltText || '';

  if (
    resolvedAltText.length < LANDING_PAGE_PLACEMENT_LIMITS.altTextMin ||
    resolvedAltText.length > LANDING_PAGE_PLACEMENT_LIMITS.altTextMax
  ) {
    const msg = `Deskripsi foto wajib antara ${LANDING_PAGE_PLACEMENT_LIMITS.altTextMin} hingga ${LANDING_PAGE_PLACEMENT_LIMITS.altTextMax} karakter.`;
    errors.push(msg);
    fieldErrors.altText = msg;
  }

  const copySchema = getPlacementCopySchema(placementId);
  const rawCopy = copy && typeof copy === 'object' ? copy : {};
  const normalizedCopyInput =
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_A ||
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_B
      ? {
          sticker: typeof rawCopy.sticker === 'string' ? rawCopy.sticker : '',
          name: typeof rawCopy.name === 'string' ? rawCopy.name : '',
          capacityLabel: typeof rawCopy.capacityLabel === 'string' ? rawCopy.capacityLabel : '',
          tags: parseTagsInput(rawCopy.tags),
          ctaLabel: typeof rawCopy.ctaLabel === 'string' ? rawCopy.ctaLabel : '',
        }
      : placementId === LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED
        ? {
            topSticker: typeof rawCopy.topSticker === 'string' ? rawCopy.topSticker : '',
            captionTitle: typeof rawCopy.captionTitle === 'string' ? rawCopy.captionTitle : '',
            captionSubtitle:
              typeof rawCopy.captionSubtitle === 'string' ? rawCopy.captionSubtitle : '',
            floatingBadgeTitle:
              typeof rawCopy.floatingBadgeTitle === 'string' ? rawCopy.floatingBadgeTitle : '',
            floatingBadgeSubtitle:
              typeof rawCopy.floatingBadgeSubtitle === 'string'
                ? rawCopy.floatingBadgeSubtitle
                : '',
          }
        : {
            caption: typeof rawCopy.caption === 'string' ? rawCopy.caption : '',
          };

  const parsedCopy = copySchema.safeParse(normalizedCopyInput);
  if (!parsedCopy.success) {
    parsedCopy.error.issues.forEach((issue) => {
      const key = issue.path?.[0] || 'copy';
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
      errors.push(issue.message);
    });
  }

  const cleanStatus = status === 'draft' ? 'draft' : 'published';

  if (errors.length > 0) {
    return {
      success: false,
      data: null,
      errors,
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      placementId,
      sourceGalleryItemId: (photoItem.sourceGalleryItemId || photoItem.id).trim(),
      cloudinaryPublicId: photoItem.cloudinaryPublicId.trim(),
      cloudinaryAssetId: photoItem.cloudinaryAssetId.trim(),
      secureUrl: photoItem.secureUrl.trim(),
      resourceType: 'image',
      format:
        photoItem.format.trim().toLowerCase() === 'jpeg'
          ? 'jpg'
          : photoItem.format.trim().toLowerCase(),
      width: Number(photoItem.width),
      height: Number(photoItem.height),
      bytes: Number(photoItem.bytes),
      altText: resolvedAltText,
      copy: parsedCopy.data,
      status: cleanStatus,
    },
    errors: [],
    fieldErrors: {},
  };
}
