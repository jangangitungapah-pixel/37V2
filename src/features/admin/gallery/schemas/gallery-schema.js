import { z } from 'zod';

import {
  GALLERY_FIELD_LIMITS,
  GALLERY_STATUS_LIST,
  GALLERY_STATUSES,
  GALLERY_UPLOAD_LIMITS,
} from '../config/gallery-config';
import { isValidCloudinaryDeliveryUrl } from '../utils/cloudinary-url';

export const galleryMetadataEditorSchema = z.object({
  title: z
    .string()
    .trim()
    .min(
      GALLERY_FIELD_LIMITS.titleMin,
      `Title must be at least ${GALLERY_FIELD_LIMITS.titleMin} characters.`,
    )
    .max(
      GALLERY_FIELD_LIMITS.titleMax,
      `Title must be at most ${GALLERY_FIELD_LIMITS.titleMax} characters.`,
    ),
  category: z
    .string()
    .trim()
    .min(
      GALLERY_FIELD_LIMITS.categoryMin,
      `Category must be at least ${GALLERY_FIELD_LIMITS.categoryMin} characters.`,
    )
    .max(
      GALLERY_FIELD_LIMITS.categoryMax,
      `Category must be at most ${GALLERY_FIELD_LIMITS.categoryMax} characters.`,
    ),
  altText: z
    .string()
    .trim()
    .max(
      GALLERY_FIELD_LIMITS.altTextMax,
      `Alternative text must be at most ${GALLERY_FIELD_LIMITS.altTextMax} characters.`,
    ),
  caption: z
    .string()
    .trim()
    .max(
      GALLERY_FIELD_LIMITS.captionMax,
      `Caption must be at most ${GALLERY_FIELD_LIMITS.captionMax} characters.`,
    ),
});

export function validateGalleryMetadataInput(rawInput, { requirePublishableAltText = false } = {}) {
  const safeInput = {
    title: typeof rawInput?.title === 'string' ? rawInput.title : '',
    category: typeof rawInput?.category === 'string' ? rawInput.category : '',
    altText: typeof rawInput?.altText === 'string' ? rawInput.altText : '',
    caption: typeof rawInput?.caption === 'string' ? rawInput.caption : '',
  };

  const parsed = galleryMetadataEditorSchema.safeParse(safeInput);
  const fieldErrors = {};
  const errors = [];

  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const field = issue.path?.[0] || 'form';
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      errors.push(issue.message);
    });
  }

  const trimmedAlt = safeInput.altText.trim();
  if (requirePublishableAltText && trimmedAlt.length < GALLERY_FIELD_LIMITS.altTextMinPublished) {
    const msg = `Alternative text is required (at least ${GALLERY_FIELD_LIMITS.altTextMinPublished} characters) before a photograph can be published.`;
    fieldErrors.altText = msg;
    errors.push(msg);
  }

  if (errors.length > 0) {
    return {
      success: false,
      data: null,
      fieldErrors,
      errors,
    };
  }

  return {
    success: true,
    data: {
      title: parsed.data.title.trim(),
      category: parsed.data.category.trim(),
      altText: parsed.data.altText.trim(),
      caption: parsed.data.caption.trim(),
    },
    fieldErrors: {},
    errors: [],
  };
}

/**
 * Validates that a gallery item meets all requirements for public publication.
 */
export function validateGalleryItemPublishable(item, { expectedCloudName = '' } = {}) {
  const errors = [];
  if (!item || typeof item !== 'object') {
    return { canPublish: false, errors: ['Gallery item record is missing.'] };
  }

  if (item.status === GALLERY_STATUSES.ARCHIVED) {
    errors.push('Archived photographs cannot be published directly. Restore to Draft first.');
  }

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (
    title.length < GALLERY_FIELD_LIMITS.titleMin ||
    title.length > GALLERY_FIELD_LIMITS.titleMax
  ) {
    errors.push('A valid photo title (2–120 characters) is required before publishing.');
  }

  const category = typeof item.category === 'string' ? item.category.trim() : '';
  if (
    category.length < GALLERY_FIELD_LIMITS.categoryMin ||
    category.length > GALLERY_FIELD_LIMITS.categoryMax
  ) {
    errors.push('A valid category (2–60 characters) is required before publishing.');
  }

  const altText = typeof item.altText === 'string' ? item.altText.trim() : '';
  if (
    altText.length < GALLERY_FIELD_LIMITS.altTextMinPublished ||
    altText.length > GALLERY_FIELD_LIMITS.altTextMax
  ) {
    errors.push('Valid alternative text (at least 3 characters) is required before publishing.');
  }

  if (
    typeof item.cloudinaryPublicId !== 'string' ||
    !item.cloudinaryPublicId.trim() ||
    typeof item.cloudinaryAssetId !== 'string' ||
    !item.cloudinaryAssetId.trim()
  ) {
    errors.push('Required Cloudinary asset identifiers are missing.');
  }

  if (!isValidCloudinaryDeliveryUrl(item.secureUrl, expectedCloudName)) {
    errors.push('A valid HTTPS Cloudinary image delivery URL is required.');
  }

  if (item.resourceType !== 'image') {
    errors.push('Only image resources can be published to the gallery.');
  }

  const format = typeof item.format === 'string' ? item.format.trim().toLowerCase() : '';
  if (!GALLERY_UPLOAD_LIMITS.allowedFormats.includes(format)) {
    errors.push('Unsupported image format.');
  }

  if (
    !Number.isInteger(item.width) ||
    item.width <= 0 ||
    !Number.isInteger(item.height) ||
    item.height <= 0 ||
    !Number.isInteger(item.bytes) ||
    item.bytes <= 0
  ) {
    errors.push('Valid positive image dimensions and file size metadata are required.');
  }

  if (!GALLERY_STATUS_LIST.includes(item.status)) {
    errors.push('Invalid gallery status value.');
  }

  return {
    canPublish: errors.length === 0,
    errors,
  };
}
