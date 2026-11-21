import { z } from 'zod';

import { normalizePhoneNumber } from '@/features/admin/customer/utils/phone-number';

import { STUDIO_PROFILE_LIMITS } from '../config/default-studio-profile';
import { normalizeStudioProfileFormValues } from '../utils/normalize-studio-profile';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_WHATSAPP_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export function isValidStudioEmail(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return true;
  return trimmed.length <= STUDIO_PROFILE_LIMITS.emailMax && EMAIL_PATTERN.test(trimmed);
}

export function isValidStudioWhatsapp(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return true;
  const canonical = normalizePhoneNumber(trimmed, { assumeIndonesiaLocalMobile: true });
  return (
    Boolean(canonical) &&
    canonical.length <= STUDIO_PROFILE_LIMITS.whatsappMax &&
    E164_WHATSAPP_PATTERN.test(canonical)
  );
}

export function isValidStudioMapsUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return true;
  if (trimmed.length > STUDIO_PROFILE_LIMITS.mapsUrlMax) return false;
  if (/\s/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const studioProfileFormSchema = z.object({
  studioName: z
    .string()
    .trim()
    .min(
      STUDIO_PROFILE_LIMITS.studioNameMin,
      `Nama studio minimal ${STUDIO_PROFILE_LIMITS.studioNameMin} karakter.`,
    )
    .max(
      STUDIO_PROFILE_LIMITS.studioNameMax,
      `Nama studio maksimal ${STUDIO_PROFILE_LIMITS.studioNameMax} karakter.`,
    ),
  tagline: z
    .string()
    .trim()
    .max(
      STUDIO_PROFILE_LIMITS.taglineMax,
      `Tagline maksimal ${STUDIO_PROFILE_LIMITS.taglineMax} karakter.`,
    ),
  whatsappNumber: z
    .string()
    .trim()
    .max(40, 'Nomor WhatsApp terlalu panjang.')
    .refine(
      isValidStudioWhatsapp,
      'Format nomor WhatsApp tidak valid. Gunakan format Indonesia (0812...) atau internasional (+62...).',
    ),
  email: z
    .string()
    .trim()
    .max(
      STUDIO_PROFILE_LIMITS.emailMax,
      `Email studio maksimal ${STUDIO_PROFILE_LIMITS.emailMax} karakter.`,
    )
    .refine(isValidStudioEmail, 'Format email studio tidak valid.'),
  address: z
    .string()
    .trim()
    .max(
      STUDIO_PROFILE_LIMITS.addressMax,
      `Alamat studio maksimal ${STUDIO_PROFILE_LIMITS.addressMax} karakter.`,
    ),
  city: z
    .string()
    .trim()
    .max(
      STUDIO_PROFILE_LIMITS.cityMax,
      `Nama kota maksimal ${STUDIO_PROFILE_LIMITS.cityMax} karakter.`,
    ),
  mapsUrl: z
    .string()
    .trim()
    .max(
      STUDIO_PROFILE_LIMITS.mapsUrlMax,
      `URL Google Maps maksimal ${STUDIO_PROFILE_LIMITS.mapsUrlMax} karakter.`,
    )
    .refine(
      isValidStudioMapsUrl,
      'URL Google Maps harus diawali http:// atau https:// dan tidak mengandung spasi.',
    ),
});

/**
 * Validates and normalizes a Studio Profile form payload prior to persistence.
 */
export function validateStudioProfile(rawInput) {
  const safeInput = {
    studioName: typeof rawInput?.studioName === 'string' ? rawInput.studioName : '',
    tagline: typeof rawInput?.tagline === 'string' ? rawInput.tagline : '',
    whatsappNumber: typeof rawInput?.whatsappNumber === 'string' ? rawInput.whatsappNumber : '',
    email: typeof rawInput?.email === 'string' ? rawInput.email : '',
    address: typeof rawInput?.address === 'string' ? rawInput.address : '',
    city: typeof rawInput?.city === 'string' ? rawInput.city : '',
    mapsUrl: typeof rawInput?.mapsUrl === 'string' ? rawInput.mapsUrl : '',
  };

  const result = studioProfileFormSchema.safeParse(safeInput);
  if (!result.success) {
    const fieldErrors = {};
    const errors = [];

    result.error.issues.forEach((issue) => {
      const fieldName = issue.path?.[0] || 'form';
      if (!fieldErrors[fieldName]) {
        fieldErrors[fieldName] = issue.message;
      }
      errors.push(issue.message);
    });

    return {
      success: false,
      data: null,
      fieldErrors,
      errors,
    };
  }

  return {
    success: true,
    data: normalizeStudioProfileFormValues(result.data),
    fieldErrors: {},
    errors: [],
  };
}
