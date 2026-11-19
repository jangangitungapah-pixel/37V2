import { z } from 'zod';

import {
  DEFAULT_DURATION_DISCOUNT_AMOUNT,
  DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
} from '../config/default-pricing-settings';

const nonNegativeIntSchema = z
  .number({ message: 'Nilai nominal wajib berupa angka.' })
  .finite('Nilai tidak valid.')
  .int('Nominal harus berupa bilangan bulat Rupiah.')
  .min(0, 'Nominal tidak boleh negatif.');

const positiveIntSchema = nonNegativeIntSchema.min(1, 'Nominal harus lebih dari Rp 0.');

const durationMultiple30Schema = z
  .number({ message: 'Durasi wajib berupa angka menit.' })
  .finite('Durasi tidak valid.')
  .int('Durasi harus bilangan bulat menit.')
  .min(30, 'Durasi minimal 30 menit.')
  .refine((val) => val % 30 === 0, 'Durasi harus kelipatan 30 menit.');

export const durationDiscountConfigSchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z
      .number({ message: 'Interval diskon wajib berupa angka menit.' })
      .finite('Interval diskon tidak valid.')
      .int('Interval diskon harus bilangan bulat menit.')
      .min(1, 'Interval diskon harus lebih besar dari 0 menit.'),
    discountAmount: nonNegativeIntSchema,
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.discountAmount <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountAmount'],
        message: 'Nominal diskon durasi harus lebih dari Rp 0 saat diaktifkan.',
      });
    }
  });

export const sessionTypeItemSchema = z.object({
  id: z.string().trim().min(1, 'ID session wajib ada.'),
  name: z
    .string()
    .trim()
    .min(2, 'Nama session minimal 2 karakter.')
    .max(60, 'Nama session maksimal 60 karakter.'),
  description: z.string().trim().max(160, 'Deskripsi maksimal 160 karakter.'),
  hourlyRate: positiveIntSchema,
  durationDiscount: durationDiscountConfigSchema.default({
    enabled: false,
    intervalMinutes: DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
    discountAmount: DEFAULT_DURATION_DISCOUNT_AMOUNT,
  }),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(1),
});

export const recordingOptionItemSchema = z
  .object({
    id: z.string().trim().min(1, 'ID opsi recording wajib ada.'),
    name: z
      .string()
      .trim()
      .min(2, 'Nama opsi recording minimal 2 karakter.')
      .max(80, 'Nama opsi recording maksimal 80 karakter.'),
    description: z.string().trim().max(200, 'Deskripsi maksimal 200 karakter.'),
    priceMode: z.enum(['hourly', 'fixed'], {
      message: 'Model harga harus Hourly atau Fixed.',
    }),
    durationMinutes: z.number().int().min(0),
    price: positiveIntSchema,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.priceMode === 'fixed') {
      if (data.durationMinutes < 30 || data.durationMinutes % 30 !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: 'Durasi fixed minimal 30 menit dan kelipatan 30 menit.',
        });
      }
    }
  });

export const studioPackageItemSchema = z
  .object({
    id: z.string().trim().min(1, 'ID paket wajib ada.'),
    name: z
      .string()
      .trim()
      .min(2, 'Nama paket minimal 2 karakter.')
      .max(80, 'Nama paket maksimal 80 karakter.'),
    detail: z.string().trim().max(200, 'Detail paket maksimal 200 karakter.'),
    sessionTypeId: z.string().trim().min(1, 'Session type wajib dipilih.'),
    durationMinutes: durationMultiple30Schema,
    basePrice: positiveIntSchema,
    discountAmount: nonNegativeIntSchema,
    staffCommissionAmount: nonNegativeIntSchema,
    recordingOperatorCommissionAmount: nonNegativeIntSchema,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.discountAmount > data.basePrice) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountAmount'],
        message: 'Diskon paket tidak boleh melebihi harga paket.',
      });
    }
  });

export const discountPresetItemSchema = z.object({
  id: z.string().trim().min(1, 'ID diskon wajib ada.'),
  name: z
    .string()
    .trim()
    .min(2, 'Nama diskon minimal 2 karakter.')
    .max(80, 'Nama diskon maksimal 80 karakter.'),
  sessionTypeId: z.string().trim().min(1, 'Session type wajib dipilih.'),
  minimumDurationMinutes: durationMultiple30Schema,
  discountAmount: positiveIntSchema,
  isActive: z.boolean(),
  sortOrder: z.number().int().min(1),
});

export const operationalFeesSchema = z.object({
  rehearsalStaffCommissionPerHour: nonNegativeIntSchema,
  dailyMealAllowancePerStaff: nonNegativeIntSchema,
});

function formatZodIssues(issues = []) {
  const fieldErrors = {};
  for (const issue of issues) {
      const dottedKey = issue.path?.length ? issue.path.map(String).join('.') : 'form';
      const rootKey = issue.path?.[0] ? String(issue.path[0]) : 'form';
      if (!fieldErrors[dottedKey]) {
        fieldErrors[dottedKey] = issue.message;
      }
      if (!fieldErrors[rootKey]) {
        fieldErrors[rootKey] = issue.message;
      }
    }
    return fieldErrors;
  }

  export function validateSessionTypeForm(values) {
    const parsed = sessionTypeItemSchema.safeParse(values);
    if (parsed.success) {
      return { isValid: true, data: parsed.data, errors: {} };
    }
    return { isValid: false, data: null, errors: formatZodIssues(parsed.error.issues) };
  }

  export function validateRecordingOptionForm(values) {
    const parsed = recordingOptionItemSchema.safeParse(values);
    if (parsed.success) {
      return { isValid: true, data: parsed.data, errors: {} };
    }
    return { isValid: false, data: null, errors: formatZodIssues(parsed.error.issues) };
  }

  export function validateStudioPackageForm(values, sessionTypes = []) {
    const parsed = studioPackageItemSchema.safeParse(values);
    const errors = parsed.success ? {} : formatZodIssues(parsed.error.issues);

    const validSessionIds = new Set((sessionTypes || []).map((item) => item.id));
    if (
      values?.sessionTypeId &&
      validSessionIds.size > 0 &&
      !validSessionIds.has(values.sessionTypeId)
    ) {
      errors.sessionTypeId = 'Session type yang dipilih tidak ditemukan.';
    }

    if (Object.keys(errors).length === 0 && parsed.success) {
      return { isValid: true, data: parsed.data, errors: {} };
    }
    return { isValid: false, data: null, errors };
  }

  export function validateDiscountPresetForm(values, sessionTypes = []) {
    const parsed = discountPresetItemSchema.safeParse(values);
    const errors = parsed.success ? {} : formatZodIssues(parsed.error.issues);

    const validSessionIds = new Set((sessionTypes || []).map((item) => item.id));
    if (
      values?.sessionTypeId &&
      validSessionIds.size > 0 &&
      !validSessionIds.has(values.sessionTypeId)
    ) {
      errors.sessionTypeId = 'Session type yang dipilih tidak ditemukan.';
    }

    if (Object.keys(errors).length === 0 && parsed.success) {
      return { isValid: true, data: parsed.data, errors: {} };
    }
    return { isValid: false, data: null, errors };
  }

  export function validateOperationalFeesForm(values) {
    const parsed = operationalFeesSchema.safeParse(values);
    if (parsed.success) {
      return { isValid: true, data: parsed.data, errors: {} };
    }
    return { isValid: false, data: null, errors: formatZodIssues(parsed.error.issues) };
  }

  /**
   * Checks whether a Session Type can be safely deleted.
   * Prevents orphan references from any active Studio Package.
   */
  export function canDeleteSessionType(sessionTypeId, packages = []) {
    const cleanId = String(sessionTypeId || '').trim();
    const blockingPackages = (packages || []).filter(
      (pkg) => pkg && pkg.isActive !== false && pkg.sessionTypeId === cleanId,
    );

    if (blockingPackages.length > 0) {
      const names = blockingPackages.map((pkg) => `"${pkg.name}"`).join(', ');
      return {
        canDelete: false,
        blockingPackages,
        message: `Session type ini masih digunakan oleh paket aktif (${names}). Nonaktifkan atau ubah session type paket terkait terlebih dahulu.`,
      };
    }

    return {
      canDelete: true,
      blockingPackages: [],
      message: '',
    };
  }

  function hasDuplicateIds(items = []) {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.id)) return item.id;
      seen.add(item.id);
    }
    return null;
  }

  /**
   * Validates the entire `settings/pricing` payload before writing to Cloud Firestore.
   */
  export const pricingSettingsPayloadSchema = z
    .object({
      schemaVersion: z.literal(1),
      sessionTypes: z.array(sessionTypeItemSchema).min(1, 'Minimal harus ada satu session type.'),
      recordingTypes: z.array(recordingOptionItemSchema),
      packages: z.array(studioPackageItemSchema),
      discounts: z.array(discountPresetItemSchema),
      fees: operationalFeesSchema,
    })
    .superRefine((data, ctx) => {
      const activeSessions = data.sessionTypes.filter((item) => item.isActive);
      if (activeSessions.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sessionTypes'],
          message: 'Minimal satu Session Type harus berstatus Aktif agar Booking Form dapat dipakai.',
        });
      }

      const dupSession = hasDuplicateIds(data.sessionTypes);
      if (dupSession) {
        ctx.addIssue({
          code: 'custom',
          path: ['sessionTypes'],
          message: `Terdapat ID session type duplikat (${dupSession}).`,
        });
      }

      const dupRec = hasDuplicateIds(data.recordingTypes);
      if (dupRec) {
        ctx.addIssue({
          code: 'custom',
          path: ['recordingTypes'],
          message: `Terdapat ID opsi recording duplikat (${dupRec}).`,
        });
      }

      const dupPkg = hasDuplicateIds(data.packages);
      if (dupPkg) {
        ctx.addIssue({
          code: 'custom',
          path: ['packages'],
          message: `Terdapat ID paket studio duplikat (${dupPkg}).`,
        });
      }

      const dupDisc = hasDuplicateIds(data.discounts);
      if (dupDisc) {
        ctx.addIssue({
          code: 'custom',
          path: ['discounts'],
          message: `Terdapat ID preset diskon duplikat (${dupDisc}).`,
        });
      }

      const validSessionIdSet = new Set(data.sessionTypes.map((s) => s.id));
      data.packages.forEach((pkg, index) => {
        if (!validSessionIdSet.has(pkg.sessionTypeId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['packages', index, 'sessionTypeId'],
            message: `Paket "${pkg.name}" merujuk ke session type "${pkg.sessionTypeId}" yang tidak ada.`,
          });
        }
      });

      data.discounts.forEach((disc, index) => {
        if (!validSessionIdSet.has(disc.sessionTypeId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['discounts', index, 'sessionTypeId'],
            message: `Diskon "${disc.name}" merujuk ke session type "${disc.sessionTypeId}" yang tidak ada.`,
          });
        }
      });
    });

  export function validatePricingSettingsPayload(settings) {
    const parsed = pricingSettingsPayloadSchema.safeParse({
      schemaVersion: 1,
      sessionTypes: settings?.sessionTypes || [],
      recordingTypes: settings?.recordingTypes || [],
      packages: settings?.packages || [],
      discounts: settings?.discounts || [],
      fees: settings?.fees || { rehearsalStaffCommissionPerHour: 0, dailyMealAllowancePerStaff: 0 },
    });

    if (parsed.success) {
      return {
        isValid: true,
        data: parsed.data,
        errors: [],
        message: '',
      };
    }

    return {
      isValid: false,
      data: null,
      errors: parsed.error.issues,
      message: parsed.error.issues[0]?.message || 'Konfigurasi Price and Fee tidak valid.',
    };
  }
