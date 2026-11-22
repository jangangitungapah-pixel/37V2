import { z } from 'zod';

import {
  formatPhoneDisplay,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';
import { isValidHttpUrl } from '@/lib/external-links';

import {
  CANONICAL_OPERATING_HOURS_LABEL,
  DEFAULT_PUBLIC_SITE_SETTINGS,
  DEFAULT_PUBLIC_SOCIAL_LINKS,
  DEFAULT_PUBLISHED_ROOMS,
  DEFAULT_PUBLISHED_SERVICES,
  PUBLIC_SITE_SETTINGS_LIMITS,
  PUBLIC_SITE_SETTINGS_SCHEMA_VERSION,
} from '../config/public-site-settings-config';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_WHATSAPP_PATTERN = /^\+[1-9][0-9]{7,14}$/;

function cleanString(value, fallback = '', maxLen = 400) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLen);
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
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

export function normalizePublicWhatsapp(rawValue) {
  const trimmed = cleanString(rawValue, '', 30);
  if (!trimmed) return '';
  const normalized = normalizePhoneNumber(trimmed, { assumeIndonesiaLocalMobile: true });
  return normalized && E164_WHATSAPP_PATTERN.test(normalized) ? normalized : '';
}

export function normalizePublishedServices(rawList) {
  const byId = new Map();
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (item && typeof item.id === 'string' && item.id.trim()) {
        byId.set(item.id.trim(), item);
      }
    }
  }

  return DEFAULT_PUBLISHED_SERVICES.map((def) => {
    const incoming = byId.get(def.id);
    if (!incoming) {
      return structuredClone(def);
    }

    const rawHighlights = Array.isArray(incoming.highlights)
      ? incoming.highlights.map((h) => cleanString(h, '', 80)).filter(Boolean)
      : def.highlights;

    return {
      id: def.id,
      isVisible: incoming.isVisible !== false,
      label: cleanString(incoming.label, def.label, 60) || def.label,
      summary: cleanString(incoming.summary, def.summary, 280) || def.summary,
      highlights: rawHighlights.length > 0 ? rawHighlights.slice(0, 5) : [...def.highlights],
      publicPriceLabel: cleanString(incoming.publicPriceLabel, '', 80),
    };
  });
}

export function normalizePublishedRooms(rawList) {
  const byId = new Map();
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (item && typeof item.id === 'string' && item.id.trim()) {
        byId.set(item.id.trim(), item);
      }
    }
  }

  return DEFAULT_PUBLISHED_ROOMS.map((def) => {
    const incoming = byId.get(def.id);
    if (!incoming) {
      return structuredClone(def);
    }

    const rawTags = Array.isArray(incoming.tags)
      ? incoming.tags.map((t) => cleanString(t, '', 60)).filter(Boolean)
      : def.tags;

    return {
      id: def.id,
      name: cleanString(incoming.name, def.name, 100) || def.name,
      summary: cleanString(incoming.summary, def.summary, 220) || def.summary,
      tags: rawTags.length > 0 ? rawTags.slice(0, 6) : [...def.tags],
    };
  });
}

export function normalizeSocialLinks(rawList) {
  const byId = new Map();
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      if (item && typeof item.id === 'string' && item.id.trim()) {
        byId.set(item.id.trim(), item);
      }
    }
  }

  return DEFAULT_PUBLIC_SOCIAL_LINKS.map((def) => {
    const incoming = byId.get(def.id);
    const rawUrl = cleanString(incoming?.url || '', '', 300);
    return {
      id: def.id,
      label: cleanString(incoming?.label, def.label, 40) || def.label,
      url: isValidHttpUrl(rawUrl) ? rawUrl : '',
    };
  });
}

export function normalizeVerifiedTestimonials(rawList) {
  if (!Array.isArray(rawList)) return [];
  const normalized = [];

  for (
    let i = 0;
    i < rawList.length && normalized.length < PUBLIC_SITE_SETTINGS_LIMITS.maxTestimonials;
    i++
  ) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') continue;
    const quote = cleanString(item.quote, '', 400);
    const author = cleanString(item.author, '', 80);
    const role = cleanString(item.role, '', 80);
    if (!quote || !author) continue;

    const rawRating = Number(item.rating);
    const rating =
      Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : null;

    normalized.push({
      id: cleanString(item.id, `testimonial-${i + 1}`, 60) || `testimonial-${i + 1}`,
      badge: cleanString(item.badge, 'VERIFIED ARTIST', 40) || 'VERIFIED ARTIST',
      quote,
      author,
      role: role || 'Studio Client',
      rating,
    });
  }

  return normalized;
}

/**
 * Normalizes a persisted or fallback `publicSiteSettings/site` document into a complete,
 * strictly sanitized public configuration object (never exposing staff/internal data).
 */
export function normalizePublicSiteSettings(rawDoc = null) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return structuredClone(DEFAULT_PUBLIC_SITE_SETTINGS);
  }

  const rawMapsUrl = cleanString(rawDoc.mapsUrl, '', PUBLIC_SITE_SETTINGS_LIMITS.mapsUrlMax);
  const rawEmail = cleanString(
    rawDoc.publicEmail,
    '',
    PUBLIC_SITE_SETTINGS_LIMITS.emailMax,
  ).toLowerCase();

  return {
    schemaVersion: PUBLIC_SITE_SETTINGS_SCHEMA_VERSION,
    studioName:
      cleanString(
        rawDoc.studioName,
        DEFAULT_PUBLIC_SITE_SETTINGS.studioName,
        PUBLIC_SITE_SETTINGS_LIMITS.studioNameMax,
      ) || DEFAULT_PUBLIC_SITE_SETTINGS.studioName,
    tagline: cleanString(
      rawDoc.tagline,
      DEFAULT_PUBLIC_SITE_SETTINGS.tagline,
      PUBLIC_SITE_SETTINGS_LIMITS.taglineMax,
    ),
    publicWhatsappNumber: normalizePublicWhatsapp(rawDoc.publicWhatsappNumber),
    publicEmail: EMAIL_PATTERN.test(rawEmail) ? rawEmail : '',
    publicAddress: cleanString(rawDoc.publicAddress, '', PUBLIC_SITE_SETTINGS_LIMITS.addressMax),
    city: cleanString(rawDoc.city, '', PUBLIC_SITE_SETTINGS_LIMITS.cityMax),
    mapsUrl: isValidHttpUrl(rawMapsUrl) ? rawMapsUrl : '',
    operatingHours:
      cleanString(
        rawDoc.operatingHours,
        CANONICAL_OPERATING_HOURS_LABEL,
        PUBLIC_SITE_SETTINGS_LIMITS.operatingHoursMax,
      ) || CANONICAL_OPERATING_HOURS_LABEL,
    publishedServices: normalizePublishedServices(rawDoc.publishedServices),
    publishedRooms: normalizePublishedRooms(rawDoc.publishedRooms),
    socialLinks: normalizeSocialLinks(rawDoc.socialLinks),
    verifiedTestimonials: normalizeVerifiedTestimonials(rawDoc.verifiedTestimonials),
    seoTitle:
      cleanString(
        rawDoc.seoTitle,
        DEFAULT_PUBLIC_SITE_SETTINGS.seoTitle,
        PUBLIC_SITE_SETTINGS_LIMITS.seoTitleMax,
      ) || DEFAULT_PUBLIC_SITE_SETTINGS.seoTitle,
    seoDescription:
      cleanString(
        rawDoc.seoDescription,
        DEFAULT_PUBLIC_SITE_SETTINGS.seoDescription,
        PUBLIC_SITE_SETTINGS_LIMITS.seoDescriptionMax,
      ) || DEFAULT_PUBLIC_SITE_SETTINGS.seoDescription,
    isPublished: rawDoc.isPublished !== false,
    updatedAt: normalizeTimestampToIso(rawDoc.updatedAt),
  };
}

export function extractPublicSiteSettingsEditableValues(settings) {
  const norm = normalizePublicSiteSettings(settings);
  return {
    operatingHours: norm.operatingHours,
    publishedServices: structuredClone(norm.publishedServices),
    publishedRooms: structuredClone(norm.publishedRooms),
    socialLinks: structuredClone(norm.socialLinks),
    verifiedTestimonials: structuredClone(norm.verifiedTestimonials),
    seoTitle: norm.seoTitle,
    seoDescription: norm.seoDescription,
    isPublished: norm.isPublished,
  };
}

export function arePublicSiteEditableValuesEqual(a, b) {
  const left = normalizePublicSiteSettings(a);
  const right = normalizePublicSiteSettings(b);
  return (
    JSON.stringify(extractPublicSiteSettingsEditableValues(left)) ===
    JSON.stringify(extractPublicSiteSettingsEditableValues(right))
  );
}

const publicSocialLinkSchema = z.object({
  id: z.string().trim().min(1).max(30),
  label: z.string().trim().min(1).max(40),
  url: z
    .string()
    .trim()
    .max(300)
    .refine(
      (val) => val === '' || isValidHttpUrl(val),
      'URL media sosial harus diawali http:// atau https://.',
    ),
});

const publicServiceSchema = z.object({
  id: z.string().trim().min(1).max(40),
  isVisible: z.boolean(),
  label: z.string().trim().min(2).max(60),
  summary: z.string().trim().min(2).max(280),
  highlights: z.array(z.string().trim().min(1).max(80)).max(5),
  publicPriceLabel: z.string().trim().max(80),
});

const publicRoomSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(100),
  summary: z.string().trim().min(2).max(220),
  tags: z.array(z.string().trim().min(1).max(60)).min(1).max(6),
});

const verifiedTestimonialSchema = z.object({
  id: z.string().trim().min(1).max(60),
  badge: z.string().trim().min(1).max(40),
  quote: z.string().trim().min(5, 'Kutipan testimoni minimal 5 karakter.').max(400),
  author: z.string().trim().min(2, 'Nama pemberi testimoni wajib diisi.').max(80),
  role: z.string().trim().max(80),
  rating: z.number().int().min(1).max(5).nullable(),
});

export const publicSiteSettingsSchema = z.object({
  operatingHours: z.string().trim().min(2, 'Jam operasional wajib diisi.').max(80),
  publishedServices: z.array(publicServiceSchema).min(1).max(6),
  publishedRooms: z.array(publicRoomSchema).min(1).max(4),
  socialLinks: z.array(publicSocialLinkSchema).max(6),
  verifiedTestimonials: z.array(verifiedTestimonialSchema).max(12),
  seoTitle: z.string().trim().min(5, 'SEO Title minimal 5 karakter.').max(120),
  seoDescription: z.string().trim().min(10, 'SEO Description minimal 10 karakter.').max(260),
  isPublished: z.boolean(),
});

/**
 * Validates and builds the exact 17-key Firestore write payload for `publicSiteSettings/site`
 * from validated private Studio Profile identity + Owner public website settings.
 */
export function buildSanitizedPublicSiteSettingsWriteDoc({
  studioProfilePayload,
  publicSettingsInput = null,
  fallbackPublicSettings = DEFAULT_PUBLIC_SITE_SETTINGS,
  timestampValue,
}) {
  const merged = normalizePublicSiteSettings({
    ...fallbackPublicSettings,
    ...(publicSettingsInput && typeof publicSettingsInput === 'object' ? publicSettingsInput : {}),
    studioName: studioProfilePayload?.studioName ?? fallbackPublicSettings?.studioName,
    tagline: studioProfilePayload?.tagline ?? fallbackPublicSettings?.tagline,
    publicWhatsappNumber:
      studioProfilePayload?.whatsappNumber ?? fallbackPublicSettings?.publicWhatsappNumber,
    publicEmail: studioProfilePayload?.email ?? fallbackPublicSettings?.publicEmail,
    publicAddress: studioProfilePayload?.address ?? fallbackPublicSettings?.publicAddress,
    city: studioProfilePayload?.city ?? fallbackPublicSettings?.city,
    mapsUrl: studioProfilePayload?.mapsUrl ?? fallbackPublicSettings?.mapsUrl,
  });

  const parsed = publicSiteSettingsSchema.safeParse(
    extractPublicSiteSettingsEditableValues(merged),
  );
  if (!parsed.success) {
    const firstIssue = parsed.error.issues?.[0];
    const error = new Error(firstIssue?.message || 'Konfigurasi website publik tidak valid.');
    error.code = 'public-site-settings/validation-error';
    throw error;
  }

  return {
    schemaVersion: PUBLIC_SITE_SETTINGS_SCHEMA_VERSION,
    studioName: merged.studioName,
    tagline: merged.tagline,
    publicWhatsappNumber: merged.publicWhatsappNumber,
    publicEmail: merged.publicEmail,
    publicAddress: merged.publicAddress,
    city: merged.city,
    mapsUrl: merged.mapsUrl,
    operatingHours: parsed.data.operatingHours,
    publishedServices: parsed.data.publishedServices,
    publishedRooms: parsed.data.publishedRooms,
    socialLinks: parsed.data.socialLinks,
    verifiedTestimonials: parsed.data.verifiedTestimonials,
    seoTitle: parsed.data.seoTitle,
    seoDescription: parsed.data.seoDescription,
    isPublished: parsed.data.isPublished,
    updatedAt: timestampValue,
  };
}

/**
 * Merges verified Owner-managed `publicSiteSettings/site` into Landing Page content.
 * Preserves authentic studio defaults while eliminating any demo/placeholder artifacts.
 */
export function mergeLandingPageContentWithSiteSettings(baseContent, rawPublicSiteSettings) {
  if (!baseContent || typeof baseContent !== 'object') {
    return baseContent;
  }

  const settings = normalizePublicSiteSettings(rawPublicSiteSettings);
  const fullAddress = [settings.publicAddress, settings.city].filter(Boolean).join(', ');
  const hasVerifiedAddress = Boolean(fullAddress);
  const hasVerifiedMapsUrl = isValidHttpUrl(settings.mapsUrl);
  const formattedPhone = settings.publicWhatsappNumber
    ? formatPhoneDisplay(settings.publicWhatsappNumber)
    : '';
  const hasVerifiedWhatsapp = Boolean(settings.publicWhatsappNumber);
  const directWhatsappUrl = hasVerifiedWhatsapp
    ? `https://wa.me/${settings.publicWhatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Halo ${settings.studioName}, saya ingin bertanya mengenai booking studio.`,
      )}`
    : '';

  const serviceById = new Map(settings.publishedServices.map((s) => [s.id, s]));
  const visibleServiceItems = (baseContent.services?.items || [])
    .map((baseItem) => {
      const configured = serviceById.get(baseItem.id);
      if (configured && configured.isVisible === false) {
        return null;
      }
      if (!configured) {
        return baseItem;
      }
      return {
        ...baseItem,
        title: configured.label || baseItem.title,
        description: configured.summary || baseItem.description,
        features:
          Array.isArray(configured.highlights) && configured.highlights.length > 0
            ? configured.highlights
            : baseItem.features,
        publicPriceLabel: configured.publicPriceLabel || '',
      };
    })
    .filter(Boolean);

  const roomById = new Map(settings.publishedRooms.map((r) => [r.id, r]));
  const mergedRoomsItems = (baseContent.rooms?.items || []).map((room) => {
    const configured = roomById.get(room.id);
    if (!configured) return room;
    return {
      ...room,
      name: configured.name || room.name,
      capacityLabel: configured.summary || room.capacityLabel,
      tags:
        Array.isArray(configured.tags) && configured.tags.length > 0 ? configured.tags : room.tags,
    };
  });

  const verifiedSocialLinks = (settings.socialLinks || [])
    .filter((link) => isValidHttpUrl(link.url))
    .map((link) => ({
      id: link.id,
      label: link.label,
      isConfirmed: true,
      href: link.url,
    }));

  const verifiedTestimonials = settings.verifiedTestimonials || [];

  return {
    ...baseContent,
    meta: {
      ...baseContent.meta,
      studioName: settings.studioName,
      seoTitle: settings.seoTitle,
      seoDescription: settings.seoDescription,
      isPublished: settings.isPublished,
      isDemoContent: false,
    },
    utilityStrip: {
      ...baseContent.utilityStrip,
      descriptor: `${settings.studioName.toUpperCase()} • ${settings.tagline.toUpperCase()}`,
      isHoursConfirmed: true,
      hoursText: settings.operatingHours,
    },
    header: {
      ...baseContent.header,
      brandName: settings.studioName.toUpperCase(),
      brandTagline: settings.tagline.toUpperCase(),
    },
    hero: {
      ...baseContent.hero,
      badges: [
        {
          id: 'badge-studio',
          label: `${settings.studioName.toUpperCase()} • LIVE BOOKING REQUESTS`,
          variant: 'white',
          hasDot: true,
        },
        {
          id: 'badge-sessions',
          label: settings.operatingHours.toUpperCase(),
          variant: 'lime',
          hasDot: false,
        },
      ],
    },
    services: {
      ...baseContent.services,
      items: visibleServiceItems,
    },
    rooms: {
      ...baseContent.rooms,
      items: mergedRoomsItems,
    },
    testimonialsAndContact: {
      ...baseContent.testimonialsAndContact,
      testimonials: {
        ...baseContent.testimonialsAndContact?.testimonials,
        isVerified: verifiedTestimonials.length > 0,
        items: verifiedTestimonials,
      },
      contact: {
        ...baseContent.testimonialsAndContact?.contact,
        isAddressConfirmed: hasVerifiedAddress || hasVerifiedMapsUrl,
        addressText: fullAddress,
        mapsUrl: settings.mapsUrl,
        isHoursConfirmed: true,
        hoursText: settings.operatingHours,
        isContactConfirmed: Boolean(formattedPhone || settings.publicEmail),
        contactText: [formattedPhone, settings.publicEmail].filter(Boolean).join(' • '),
        whatsappNumber: settings.publicWhatsappNumber,
        email: settings.publicEmail,
        city: settings.city,
      },
    },
    finalCta: {
      ...baseContent.finalCta,
      secondaryCta: {
        ...baseContent.finalCta?.secondaryCta,
        isConfirmed: hasVerifiedWhatsapp && Boolean(directWhatsappUrl),
        whatsappNumber: settings.publicWhatsappNumber,
        whatsappUrl: directWhatsappUrl,
        prefilledMessage: '',
      },
    },
    footer: {
      ...baseContent.footer,
      brandName: settings.studioName.toUpperCase(),
      description: `${settings.studioName} — ${settings.tagline}.`,
      socialLinks: verifiedSocialLinks,
      copyright: `© ${new Date().getFullYear()} ${settings.studioName}. All rights reserved.`,
      phaseNote: settings.city
        ? `${settings.city} • ${settings.operatingHours}`
        : settings.operatingHours,
    },
  };
}
