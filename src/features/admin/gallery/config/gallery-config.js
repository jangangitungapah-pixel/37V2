export const GALLERY_COLLECTION = 'galleryItems';
export const GALLERY_SCHEMA_VERSION = 1;
export const GALLERY_DEFAULT_SORT_STEP = 1000;
export const GALLERY_BOUNDED_QUERY_LIMIT = 100;
export const GALLERY_MAX_CONCURRENT_UPLOADS = 2;

export const GALLERY_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const GALLERY_STATUS_LIST = Object.freeze([
  GALLERY_STATUSES.DRAFT,
  GALLERY_STATUSES.PUBLISHED,
  GALLERY_STATUSES.ARCHIVED,
]);

export const GALLERY_FILTER_TABS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: GALLERY_STATUSES.PUBLISHED, label: 'Published' },
  { id: GALLERY_STATUSES.DRAFT, label: 'Draft' },
  { id: GALLERY_STATUSES.ARCHIVED, label: 'Archived' },
]);

export const GALLERY_CATEGORY_SUGGESTIONS = Object.freeze([
  'Recording',
  'Rehearsal',
  'Live Room (Room A)',
  'Control Room (Room B)',
  'Equipment & Backline',
  'Mix & Master',
  'Studio Atmosphere',
]);

export const GALLERY_UPLOAD_LIMITS = Object.freeze({
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB client safeguard
  maxDimensionPx: 6000,
  minDimensionPx: 1,
  allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  allowedFormats: Object.freeze(['jpg', 'jpeg', 'png', 'webp', 'avif']),
  forbiddenExtensions: Object.freeze([
    'svg',
    'gif',
    'mp4',
    'mov',
    'avi',
    'mkv',
    'webm',
    'pdf',
    'exe',
    'bat',
    'cmd',
    'sh',
    'msi',
    'js',
    'html',
  ]),
});

export const GALLERY_FIELD_LIMITS = Object.freeze({
  titleMin: 2,
  titleMax: 120,
  categoryMin: 2,
  categoryMax: 60,
  altTextMinPublished: 3,
  altTextMax: 220,
  captionMax: 400,
  publicIdMax: 240,
  assetIdMax: 120,
  secureUrlMax: 600,
});

export const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';
export const CLOUDINARY_API_HOST = 'api.cloudinary.com';

let runtimeCloudinaryConfigOverride = null;

export function setCloudinaryConfigOverride(overrideConfig = null) {
  runtimeCloudinaryConfigOverride = overrideConfig;
}

export function resetCloudinaryConfigOverride() {
  runtimeCloudinaryConfigOverride = null;
}

/**
 * Reads only the two public unsigned-upload Cloudinary environment variables:
 * - VITE_CLOUDINARY_CLOUD_NAME
 * - VITE_CLOUDINARY_UPLOAD_PRESET
 *
 * Never reads or exposes any Cloudinary API Key or API Secret.
 * Never silently falls back to fake defaults when unconfigured.
 */
export function getCloudinaryConfig(envSource = null) {
  const source =
    runtimeCloudinaryConfigOverride ||
    envSource ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

  const cloudName =
    typeof source?.VITE_CLOUDINARY_CLOUD_NAME === 'string'
      ? source.VITE_CLOUDINARY_CLOUD_NAME.trim()
      : '';
  const uploadPreset =
    typeof source?.VITE_CLOUDINARY_UPLOAD_PRESET === 'string'
      ? source.VITE_CLOUDINARY_UPLOAD_PRESET.trim()
      : '';

  const missingKeys = [];
  if (!cloudName) missingKeys.push('VITE_CLOUDINARY_CLOUD_NAME');
  if (!uploadPreset) missingKeys.push('VITE_CLOUDINARY_UPLOAD_PRESET');

  const isConfigured = missingKeys.length === 0;
  const uploadEndpoint = isConfigured
    ? `https://${CLOUDINARY_API_HOST}/v1_1/${encodeURIComponent(cloudName)}/image/upload`
    : '';

  const statusMessage = isConfigured
    ? `Cloudinary unsigned upload ready (${cloudName} / preset: ${uploadPreset}).`
    : `Cloudinary configuration incomplete. Missing environment variable(s): ${missingKeys.join(', ')}.`;

  return {
    cloudName,
    uploadPreset,
    isConfigured,
    missingKeys,
    uploadEndpoint,
    statusMessage,
  };
}
