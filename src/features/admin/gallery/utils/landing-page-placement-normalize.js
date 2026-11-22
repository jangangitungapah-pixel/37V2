import {
  getLandingPagePlacementDefinition,
  LANDING_PAGE_PLACEMENT_IDS,
  LANDING_PAGE_PLACEMENT_SCHEMA_VERSION,
  LANDING_PAGE_PLACEMENT_STATUSES,
} from '../config/landing-page-placements-config';
import {
  getGalleryLandingCardUrl,
  getGalleryLightboxUrl,
  getGalleryThumbnailUrl,
} from './cloudinary-url';
import { normalizeGalleryFormat } from './gallery-normalize';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizePositiveInt(value, fallback = 1) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
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

export function normalizePlacementCopy(placementId, rawCopy = {}) {
  const def = getLandingPagePlacementDefinition(placementId);
  const defaults = def?.defaultCopy || {};
  const source = rawCopy && typeof rawCopy === 'object' ? rawCopy : {};

  if (placementId === LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED) {
    return {
      topSticker:
        typeof source.topSticker === 'string' ? source.topSticker.trim() : defaults.topSticker,
      captionTitle:
        typeof source.captionTitle === 'string' && source.captionTitle.trim()
          ? source.captionTitle.trim()
          : defaults.captionTitle,
      captionSubtitle:
        typeof source.captionSubtitle === 'string'
          ? source.captionSubtitle.trim()
          : defaults.captionSubtitle,
      floatingBadgeTitle:
        typeof source.floatingBadgeTitle === 'string'
          ? source.floatingBadgeTitle.trim()
          : defaults.floatingBadgeTitle,
      floatingBadgeSubtitle:
        typeof source.floatingBadgeSubtitle === 'string'
          ? source.floatingBadgeSubtitle.trim()
          : defaults.floatingBadgeSubtitle,
    };
  }

  if (
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_A ||
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_B
  ) {
    const rawTags = Array.isArray(source.tags)
      ? source.tags.map((t) => normalizeString(t)).filter(Boolean)
      : [];
    return {
      sticker: typeof source.sticker === 'string' ? source.sticker.trim() : defaults.sticker,
      name:
        typeof source.name === 'string' && source.name.trim() ? source.name.trim() : defaults.name,
      capacityLabel:
        typeof source.capacityLabel === 'string' && source.capacityLabel.trim()
          ? source.capacityLabel.trim()
          : defaults.capacityLabel,
      tags: rawTags.length > 0 ? rawTags.slice(0, 6) : [...(defaults.tags || [])],
      ctaLabel:
        typeof source.ctaLabel === 'string' && source.ctaLabel.trim()
          ? source.ctaLabel.trim()
          : defaults.ctaLabel,
    };
  }

  return {
    caption: typeof source.caption === 'string' ? source.caption.trim() : defaults.caption || '',
  };
}

export function normalizeLandingPagePlacement(placementId, rawData = {}) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const resolvedId = normalizeString(placementId || source.placementId, '');
  const def = getLandingPagePlacementDefinition(resolvedId);
  const secureUrl = normalizeString(source.secureUrl, '');
  const rawStatus = normalizeString(source.status, 'published').toLowerCase();
  const status =
    rawStatus === LANDING_PAGE_PLACEMENT_STATUSES.DRAFT
      ? LANDING_PAGE_PLACEMENT_STATUSES.DRAFT
      : LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED;

  return {
    id: resolvedId,
    placementId: resolvedId,
    schemaVersion: LANDING_PAGE_PLACEMENT_SCHEMA_VERSION,
    sourceGalleryItemId: normalizeString(source.sourceGalleryItemId, ''),
    cloudinaryPublicId: normalizeString(source.cloudinaryPublicId, ''),
    cloudinaryAssetId: normalizeString(source.cloudinaryAssetId, ''),
    secureUrl,
    thumbnailUrl: secureUrl ? getGalleryThumbnailUrl(secureUrl) : '',
    deliveryUrl: secureUrl ? getGalleryLandingCardUrl(secureUrl) : '',
    heroDeliveryUrl: secureUrl ? getGalleryLightboxUrl(secureUrl) : '',
    resourceType: 'image',
    format: normalizeGalleryFormat(source.format),
    width: normalizePositiveInt(source.width, 1600),
    height: normalizePositiveInt(source.height, 1100),
    bytes: normalizePositiveInt(source.bytes, 1024),
    altText: normalizeString(source.altText, def?.defaultAltText || '37 Music Studio photo'),
    copy: normalizePlacementCopy(resolvedId, source.copy),
    status,
    version: normalizePositiveInt(source.version, 1),
    createdAt: normalizeTimestampToIso(source.createdAt),
    createdByUid: normalizeString(source.createdByUid, ''),
    updatedAt: normalizeTimestampToIso(source.updatedAt),
    updatedByUid: normalizeString(source.updatedByUid, ''),
  };
}

function isLegacyDummySvgUrl(url) {
  if (typeof url !== 'string') return false;
  return /\/images\/demo\/.+\.svg$/i.test(url.trim());
}

/**
 * Merges published `landingPagePlacements` into the public Landing Page content contract.
 * - Never renders the 4 old dummy SVG sources.
 * - Preserves room IDs, default service mappings, and booking behavior.
 * - Hides DEMO PREVIEW / DEMO ASSET markers when a real photo is configured.
 */
export function mergeLandingPageContentWithPlacements(baseContent, placementsById = {}) {
  if (!baseContent || typeof baseContent !== 'object') {
    return baseContent;
  }

  const lookup =
    placementsById instanceof Map
      ? Object.fromEntries(placementsById.entries())
      : Array.isArray(placementsById)
        ? Object.fromEntries(
            placementsById
              .filter((item) => item && item.placementId)
              .map((item) => [item.placementId, item]),
          )
        : placementsById || {};

  // 1. Hero Featured Photo
  const heroPlacement = lookup[LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED];
  const hasPublishedHero =
    heroPlacement &&
    heroPlacement.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED &&
    Boolean(heroPlacement.secureUrl);

  const baseHeroPhoto = baseContent.hero?.featuredPhoto || {};
  const cleanBaseHeroSrc = isLegacyDummySvgUrl(baseHeroPhoto.src) ? '' : baseHeroPhoto.src || '';

  const mergedHeroFeaturedPhoto = hasPublishedHero
    ? {
        ...baseHeroPhoto,
        src: heroPlacement.heroDeliveryUrl || heroPlacement.deliveryUrl || heroPlacement.secureUrl,
        alt: heroPlacement.altText || baseHeroPhoto.alt,
        width: heroPlacement.width || baseHeroPhoto.width || 1600,
        height: heroPlacement.height || baseHeroPhoto.height || 1100,
        topSticker: heroPlacement.copy?.topSticker ?? '',
        captionTitle: heroPlacement.copy?.captionTitle || baseHeroPhoto.captionTitle,
        captionSubtitle: heroPlacement.copy?.captionSubtitle ?? baseHeroPhoto.captionSubtitle,
        demoTagLabel: '',
        floatingBadgeTitle:
          heroPlacement.copy?.floatingBadgeTitle ?? baseHeroPhoto.floatingBadgeTitle,
        floatingBadgeSubtitle:
          heroPlacement.copy?.floatingBadgeSubtitle ?? baseHeroPhoto.floatingBadgeSubtitle,
        isDemoAsset: false,
      }
    : {
        ...baseHeroPhoto,
        src: cleanBaseHeroSrc,
        isDemoAsset: Boolean(baseHeroPhoto.isDemoAsset && cleanBaseHeroSrc),
      };

  // 2. Room A & Room B
  const baseRooms = Array.isArray(baseContent.rooms?.items) ? baseContent.rooms.items : [];
  const mergedRoomsItems = baseRooms.map((room) => {
    const placement =
      room.id === 'room-a'
        ? lookup[LANDING_PAGE_PLACEMENT_IDS.ROOM_A]
        : room.id === 'room-b'
          ? lookup[LANDING_PAGE_PLACEMENT_IDS.ROOM_B]
          : null;

    const hasPublishedRoom =
      placement &&
      placement.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED &&
      Boolean(placement.secureUrl);

    const baseRoomImage = room.image || {};
    const cleanBaseRoomSrc = isLegacyDummySvgUrl(baseRoomImage.src) ? '' : baseRoomImage.src || '';

    if (!hasPublishedRoom) {
      return {
        ...room,
        image: {
          ...baseRoomImage,
          src: cleanBaseRoomSrc,
          isDemoAsset: Boolean(baseRoomImage.isDemoAsset && cleanBaseRoomSrc),
        },
      };
    }

    return {
      ...room,
      // Immutable internal identifiers & booking mappings
      id: room.id,
      defaultService: room.defaultService,
      // Editable copywriting & real photograph
      name: placement.copy?.name || room.name,
      sticker: placement.copy?.sticker ?? room.sticker,
      capacityLabel: placement.copy?.capacityLabel || room.capacityLabel,
      tags:
        Array.isArray(placement.copy?.tags) && placement.copy.tags.length > 0
          ? placement.copy.tags
          : room.tags,
      ctaLabel: placement.copy?.ctaLabel || room.ctaLabel,
      image: {
        ...baseRoomImage,
        src: placement.deliveryUrl || placement.secureUrl,
        alt: placement.altText || baseRoomImage.alt,
        width: placement.width || baseRoomImage.width || 1600,
        height: placement.height || baseRoomImage.height || 1000,
        isDemoAsset: false,
      },
    };
  });

  // 3. Studio Exterior / Location Photo
  const exteriorPlacement = lookup[LANDING_PAGE_PLACEMENT_IDS.STUDIO_EXTERIOR];
  const hasPublishedExterior =
    exteriorPlacement &&
    exteriorPlacement.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED &&
    Boolean(exteriorPlacement.secureUrl);

  const baseContact = baseContent.testimonialsAndContact?.contact || {};
  const baseContactImage = baseContact.image || {};
  const cleanBaseExteriorSrc = isLegacyDummySvgUrl(baseContactImage.src)
    ? ''
    : baseContactImage.src || '';

  const mergedContactImage = hasPublishedExterior
    ? {
        ...baseContactImage,
        src: exteriorPlacement.deliveryUrl || exteriorPlacement.secureUrl,
        alt: exteriorPlacement.altText || baseContactImage.alt,
        width: exteriorPlacement.width || baseContactImage.width || 1600,
        height: exteriorPlacement.height || baseContactImage.height || 900,
        caption: exteriorPlacement.copy?.caption || '',
        isDemoAsset: false,
      }
    : {
        ...baseContactImage,
        src: cleanBaseExteriorSrc,
        caption: baseContactImage.caption || '',
        isDemoAsset: Boolean(baseContactImage.isDemoAsset && cleanBaseExteriorSrc),
      };

  return {
    ...baseContent,
    hero: {
      ...baseContent.hero,
      featuredPhoto: mergedHeroFeaturedPhoto,
    },
    rooms: {
      ...baseContent.rooms,
      items: mergedRoomsItems,
    },
    testimonialsAndContact: {
      ...baseContent.testimonialsAndContact,
      contact: {
        ...baseContact,
        image: mergedContactImage,
      },
    },
  };
}
