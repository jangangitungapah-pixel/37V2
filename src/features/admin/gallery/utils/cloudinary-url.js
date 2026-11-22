import { CLOUDINARY_DELIVERY_HOST, GALLERY_FIELD_LIMITS } from '../config/gallery-config';

/**
 * Validates that a URL is an HTTPS Cloudinary image delivery URL.
 * If `expectedCloudName` is provided, also verifies the path starts with `/<expectedCloudName>/image/upload/`.
 */
export function isValidCloudinaryDeliveryUrl(url, expectedCloudName = '') {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > GALLERY_FIELD_LIMITS.secureUrlMax) return false;
  if (/\s/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== CLOUDINARY_DELIVERY_HOST) return false;

    const cleanCloud = typeof expectedCloudName === 'string' ? expectedCloudName.trim() : '';
    if (cleanCloud) {
      const prefix = `/${cleanCloud}/image/upload/`;
      if (!parsed.pathname.startsWith(prefix)) return false;
      const remainder = parsed.pathname.slice(prefix.length);
      return remainder.length > 0;
    }

    return /^\/[a-zA-Z0-9_-]+\/image\/upload\/.+$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Inserts Cloudinary on-the-fly delivery transformations (`f_auto,q_auto,c_limit,w_<width>`)
 * into a validated Cloudinary `secure_url` without modifying stored metadata or public_id.
 */
export function buildCloudinaryOptimizedUrl(
  secureUrl,
  { width = 800, crop = 'c_limit', format = 'f_auto', quality = 'q_auto' } = {},
) {
  if (!isValidCloudinaryDeliveryUrl(secureUrl)) {
    return typeof secureUrl === 'string' ? secureUrl.trim() : '';
  }

  const trimmed = secureUrl.trim();
  const marker = '/image/upload/';
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return trimmed;

  const safeWidth = Number.isInteger(width) && width > 0 ? width : 800;
  const transformTokens = [format, quality, crop, `w_${safeWidth}`].filter(Boolean).join(',');

  const before = trimmed.slice(0, markerIndex + marker.length);
  const after = trimmed.slice(markerIndex + marker.length);

  // Avoid duplicating transformation if identical prefix is already present
  if (after.startsWith(`${transformTokens}/`)) {
    return trimmed;
  }

  return `${before}${transformTokens}/${after}`;
}

export function getGalleryThumbnailUrl(secureUrl) {
  return buildCloudinaryOptimizedUrl(secureUrl, { width: 600 });
}

export function getGalleryLandingCardUrl(secureUrl) {
  return buildCloudinaryOptimizedUrl(secureUrl, { width: 900 });
}

export function getGalleryLightboxUrl(secureUrl) {
  return buildCloudinaryOptimizedUrl(secureUrl, { width: 1600 });
}
