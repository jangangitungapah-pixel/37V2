import {
  GALLERY_DEFAULT_SORT_STEP,
  GALLERY_SCHEMA_VERSION,
  GALLERY_STATUS_LIST,
  GALLERY_STATUSES,
} from '../config/gallery-config';
import {
  getGalleryLandingCardUrl,
  getGalleryLightboxUrl,
  getGalleryThumbnailUrl,
} from './cloudinary-url';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizePositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTimestampToIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function normalizeGalleryFormat(rawFormat) {
  const lower = normalizeString(rawFormat, 'jpg').toLowerCase();
  if (lower === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'webp', 'avif'].includes(lower)) return lower;
  return lower;
}

/**
 * Normalizes a Firestore `galleryItems/{id}` document into a deterministic client record.
 */
export function normalizeGalleryItem(id, rawData = {}) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const rawStatus = normalizeString(source.status, GALLERY_STATUSES.DRAFT).toLowerCase();
  const status = GALLERY_STATUS_LIST.includes(rawStatus) ? rawStatus : GALLERY_STATUSES.DRAFT;
  const secureUrl = normalizeString(source.secureUrl, '');

  return {
    id: normalizeString(id || source.id, ''),
    schemaVersion: GALLERY_SCHEMA_VERSION,
    title: normalizeString(source.title, 'Studio Photo'),
    category: normalizeString(source.category, 'Studio'),
    altText: normalizeString(source.altText, ''),
    caption: normalizeString(source.caption, ''),
    cloudinaryPublicId: normalizeString(source.cloudinaryPublicId, ''),
    cloudinaryAssetId: normalizeString(source.cloudinaryAssetId, ''),
    secureUrl,
    thumbnailUrl: secureUrl ? getGalleryThumbnailUrl(secureUrl) : '',
    landingCardUrl: secureUrl ? getGalleryLandingCardUrl(secureUrl) : '',
    lightboxUrl: secureUrl ? getGalleryLightboxUrl(secureUrl) : '',
    resourceType: normalizeString(source.resourceType, 'image'),
    format: normalizeGalleryFormat(source.format),
    width: normalizePositiveInt(source.width, 1200),
    height: normalizePositiveInt(source.height, 900),
    bytes: normalizePositiveInt(source.bytes, 1024),
    status,
    sortOrder: normalizeNonNegativeInt(source.sortOrder, GALLERY_DEFAULT_SORT_STEP),
    uploadedAt: normalizeTimestampToIso(source.uploadedAt),
    uploadedByUid: normalizeString(source.uploadedByUid, ''),
    createdAt: normalizeTimestampToIso(source.createdAt),
    createdByUid: normalizeString(source.createdByUid, ''),
    updatedAt: normalizeTimestampToIso(source.updatedAt),
    updatedByUid: normalizeString(source.updatedByUid, ''),
    version: normalizePositiveInt(source.version, 1),
  };
}

/**
 * Maps a published `galleryItems` record into the existing Landing Page
 * `GallerySection` and `GalleryLightboxDialog` presentation contract.
 */
export function mapGalleryItemToPublicPresentation(item) {
  const normalized = item?.schemaVersion ? item : normalizeGalleryItem(item?.id, item);
  return {
    id: normalized.id,
    title: normalized.title,
    category: normalized.category,
    alt: normalized.altText || normalized.title,
    caption: normalized.caption || '',
    src: normalized.landingCardUrl || getGalleryLandingCardUrl(normalized.secureUrl),
    lightboxSrc: normalized.lightboxUrl || getGalleryLightboxUrl(normalized.secureUrl),
    width: normalized.width,
    height: normalized.height,
    sortOrder: normalized.sortOrder,
  };
}

/**
 * Sorts gallery items for Admin library display:
 * - Published items first ordered by `sortOrder ASC`, then `updatedAt DESC`
 * - Draft items next ordered by `createdAt DESC`
 * - Archived items last ordered by `updatedAt DESC`
 */
export function sortAdminGalleryItems(items = []) {
  const rank = {
    [GALLERY_STATUSES.PUBLISHED]: 0,
    [GALLERY_STATUSES.DRAFT]: 1,
    [GALLERY_STATUSES.ARCHIVED]: 2,
  };

  return [...items].sort((a, b) => {
    const rankA = rank[a.status] ?? 9;
    const rankB = rank[b.status] ?? 9;
    if (rankA !== rankB) return rankA - rankB;

    if (a.status === GALLERY_STATUSES.PUBLISHED) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    }

    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;

    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Sorts published gallery items strictly by `sortOrder ASC` (with deterministic ID tiebreaker).
 */
export function sortPublishedGalleryItems(items = []) {
  return [...items]
    .filter((item) => item && item.status === GALLERY_STATUSES.PUBLISHED)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return String(a.id).localeCompare(String(b.id));
    });
}
