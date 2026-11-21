import {
  formatPhoneDisplay,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';

import {
  DEFAULT_STUDIO_PROFILE,
  STUDIO_PROFILE_SCHEMA_VERSION,
} from '../config/default-studio-profile';

function normalizeStringField(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function normalizeTimestampValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function normalizeWhatsappInput(rawValue) {
  const trimmed = normalizeStringField(rawValue, '');
  if (!trimmed) return '';
  const canonical = normalizePhoneNumber(trimmed, { assumeIndonesiaLocalMobile: true });
  return canonical || trimmed;
}

export function formatStudioWhatsappDisplay(value) {
  const trimmed = normalizeStringField(value, '');
  if (!trimmed) return '';
  return formatPhoneDisplay(trimmed);
}

/**
 * Normalizes the 7 editable Studio Profile fields into canonical trimmed form
 * before persistence or equality checks.
 */
export function normalizeStudioProfileFormValues(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const studioName = normalizeStringField(source.studioName, '');
  const tagline = normalizeStringField(source.tagline, '');
  const whatsappNumber = normalizeWhatsappInput(source.whatsappNumber);
  const email = normalizeStringField(source.email, '').toLowerCase();
  const address = normalizeStringField(source.address, '');
  const city = normalizeStringField(source.city, '');
  const mapsUrl = normalizeStringField(source.mapsUrl, '');

  return {
    studioName,
    tagline,
    whatsappNumber,
    email,
    address,
    city,
    mapsUrl,
  };
}

/**
 * Normalizes a persisted or default `settings/studioProfile` document into a
 * complete deterministic shape.
 */
export function normalizeStudioProfile(rawDoc = null) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return cloneStudioProfile(DEFAULT_STUDIO_PROFILE);
  }

  const formFields = normalizeStudioProfileFormValues({
    studioName:
      typeof rawDoc.studioName === 'string' && rawDoc.studioName.trim()
        ? rawDoc.studioName
        : DEFAULT_STUDIO_PROFILE.studioName,
    tagline: typeof rawDoc.tagline === 'string' ? rawDoc.tagline : DEFAULT_STUDIO_PROFILE.tagline,
    whatsappNumber:
      typeof rawDoc.whatsappNumber === 'string'
        ? rawDoc.whatsappNumber
        : DEFAULT_STUDIO_PROFILE.whatsappNumber,
    email: typeof rawDoc.email === 'string' ? rawDoc.email : DEFAULT_STUDIO_PROFILE.email,
    address: typeof rawDoc.address === 'string' ? rawDoc.address : DEFAULT_STUDIO_PROFILE.address,
    city: typeof rawDoc.city === 'string' ? rawDoc.city : DEFAULT_STUDIO_PROFILE.city,
    mapsUrl: typeof rawDoc.mapsUrl === 'string' ? rawDoc.mapsUrl : DEFAULT_STUDIO_PROFILE.mapsUrl,
  });

  const parsedVersion = Number(rawDoc.version);
  const version = Number.isInteger(parsedVersion) && parsedVersion >= 0 ? parsedVersion : 0;

  return {
    schemaVersion: STUDIO_PROFILE_SCHEMA_VERSION,
    ...formFields,
    version,
    updatedAt: normalizeTimestampValue(rawDoc.updatedAt),
    updatedByUid: normalizeStringField(rawDoc.updatedByUid, ''),
  };
}

export function extractStudioProfileFormValues(profile) {
  const normalized = normalizeStudioProfile(profile);
  return {
    studioName: normalized.studioName,
    tagline: normalized.tagline,
    whatsappNumber: normalized.whatsappNumber,
    email: normalized.email,
    address: normalized.address,
    city: normalized.city,
    mapsUrl: normalized.mapsUrl,
  };
}

export function areStudioProfileValuesEqual(a, b) {
  const left = normalizeStudioProfileFormValues(a);
  const right = normalizeStudioProfileFormValues(b);

  return (
    left.studioName === right.studioName &&
    left.tagline === right.tagline &&
    left.whatsappNumber === right.whatsappNumber &&
    left.email === right.email &&
    left.address === right.address &&
    left.city === right.city &&
    left.mapsUrl === right.mapsUrl
  );
}

export function cloneStudioProfile(profile) {
  return structuredClone(profile);
}
