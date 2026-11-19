/**
 * Customer Validation Schemas & Domain Normalization (Phase 7 — Customer Management).
 */

import { z } from 'zod';

import {
  CUSTOMER_RESOLUTION_MODE,
  CUSTOMER_STATUS,
  normalizeCustomerName,
} from '../utils/customer-identity';
import {
  formatPhoneDisplay,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../utils/phone-number';

export const customerCreateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Nama customer minimal 2 karakter.')
    .max(120, 'Nama customer maksimal 120 karakter.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor HP / WhatsApp wajib diisi.')
    .refine((val) => isValidPhoneNumber(val), {
      message:
        'Masukkan nomor HP / WhatsApp yang valid (contoh: 081234567890 atau +6281234567890).',
    }),
  notes: z.string().trim().max(1000, 'Catatan maksimal 1000 karakter.').optional().default(''),
});

export const customerEditSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Nama customer minimal 2 karakter.')
    .max(120, 'Nama customer maksimal 120 karakter.'),
  notes: z.string().trim().max(1000, 'Catatan maksimal 1000 karakter.').optional().default(''),
});

export const customerPhoneUpdateSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor HP / WhatsApp baru wajib diisi.')
    .refine((val) => isValidPhoneNumber(val), {
      message: 'Masukkan nomor HP / WhatsApp baru yang valid.',
    }),
});

export const customerResolutionSchema = z.object({
  mode: z.enum([
    CUSTOMER_RESOLUTION_MODE.CREATE_NEW,
    CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING,
    CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING,
    CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE,
  ]),
  customerId: z.string().trim().min(1),
  expectedPhoneIndexVersion: z.number().int().min(0).optional(),
});

/**
 * Validates customer creation form input and returns normalized values or field errors.
 */
export function validateCustomerCreateInput(input = {}) {
  const parsed = customerCreateSchema.safeParse({
    displayName: String(input.displayName ?? ''),
    phone: String(input.phone ?? ''),
    notes: String(input.notes ?? ''),
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  const phoneNormalized = normalizePhoneNumber(parsed.data.phone);
  return {
    isValid: true,
    errors: {},
    data: {
      displayName: parsed.data.displayName,
      normalizedName: normalizeCustomerName(parsed.data.displayName),
      phoneDisplay: formatPhoneDisplay(phoneNormalized),
      phoneNormalized,
      notes: parsed.data.notes,
    },
  };
}

/**
 * Validates customer edit form input (displayName + notes).
 */
export function validateCustomerEditInput(input = {}) {
  const parsed = customerEditSchema.safeParse({
    displayName: String(input.displayName ?? ''),
    notes: String(input.notes ?? ''),
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  return {
    isValid: true,
    errors: {},
    data: {
      displayName: parsed.data.displayName,
      normalizedName: normalizeCustomerName(parsed.data.displayName),
      notes: parsed.data.notes,
    },
  };
}

/**
 * Validates customer phone update input.
 */
export function validateCustomerPhoneUpdateInput(input = {}) {
  const parsed = customerPhoneUpdateSchema.safeParse({
    phone: String(input.phone ?? ''),
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'phone');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  const phoneNormalized = normalizePhoneNumber(parsed.data.phone);
  return {
    isValid: true,
    errors: {},
    data: {
      phoneNormalized,
      phoneDisplay: formatPhoneDisplay(phoneNormalized),
    },
  };
}

/**
 * Normalizes a raw Firestore `customers/{customerId}` document into a safe domain record.
 */
export function normalizeCustomerRecord(id, data = {}) {
  const cleanId = String(id || data.id || '').trim();
  const displayName = String(data.displayName || '').trim();
  const phoneNormalized =
    normalizePhoneNumber(data.phoneNormalized || data.phoneDisplay || '') ||
    String(data.phoneNormalized || '').trim();
  const phoneDisplay =
    String(data.phoneDisplay || '').trim() || formatPhoneDisplay(phoneNormalized);
  const validStatuses = new Set(Object.values(CUSTOMER_STATUS));
  const status = validStatuses.has(data.status) ? data.status : CUSTOMER_STATUS.ACTIVE;

  const rawHistoryIds = Array.isArray(data.historyCustomerIds)
    ? data.historyCustomerIds.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const historyCustomerIds = cleanId
    ? Array.from(new Set([cleanId, ...rawHistoryIds]))
    : Array.from(new Set(rawHistoryIds));

  const previousPhones = Array.isArray(data.previousPhones)
    ? data.previousPhones
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const prevNorm =
            normalizePhoneNumber(item.phoneNormalized || item.phoneDisplay || '') ||
            String(item.phoneNormalized || '').trim();
          return {
            phoneDisplay: String(item.phoneDisplay || '').trim() || formatPhoneDisplay(prevNorm),
            phoneNormalized: prevNorm,
            changedAt: item.changedAt ?? null,
          };
        })
        .filter((item) => Boolean(item.phoneNormalized))
    : [];

  const nameAliases = Array.isArray(data.nameAliases)
    ? Array.from(
        new Set(data.nameAliases.map((alias) => String(alias || '').trim()).filter(Boolean)),
      )
    : [];

  return {
    id: cleanId,
    displayName,
    normalizedName: String(data.normalizedName || normalizeCustomerName(displayName)).trim(),
    phoneDisplay,
    phoneNormalized,
    nameAliases,
    previousPhones,
    status,
    mergedIntoCustomerId:
      status === CUSTOMER_STATUS.MERGED && data.mergedIntoCustomerId
        ? String(data.mergedIntoCustomerId).trim()
        : null,
    historyCustomerIds,
    bookingCount: Math.max(0, Math.round(Number(data.bookingCount) || 0)),
    firstBookingDate: String(data.firstBookingDate || '').trim(),
    lastBookingDate: String(data.lastBookingDate || '').trim(),
    notes: String(data.notes || ''),
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || ''),
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || ''),
    version:
      Number.isInteger(Number(data.version)) && Number(data.version) >= 1
        ? Number(data.version)
        : 1,
  };
}

/**
 * Normalizes a raw Firestore `customerPhoneIndex/{phoneHash}` document.
 */
export function normalizePhoneIndexRecord(phoneHash, data = {}) {
  return {
    phoneHash: String(phoneHash || data.phoneHash || '').trim(),
    phoneNormalized: String(data.phoneNormalized || '').trim(),
    activeCustomerIds: Array.isArray(data.activeCustomerIds)
      ? Array.from(
          new Set(data.activeCustomerIds.map((id) => String(id || '').trim()).filter(Boolean)),
        )
      : [],
    historicalCustomerIds: Array.isArray(data.historicalCustomerIds)
      ? Array.from(
          new Set(data.historicalCustomerIds.map((id) => String(id || '').trim()).filter(Boolean)),
        )
      : [],
    version:
      Number.isInteger(Number(data.version)) && Number(data.version) >= 1
        ? Number(data.version)
        : 1,
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || ''),
  };
}
