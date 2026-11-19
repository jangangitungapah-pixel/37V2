import { z } from 'zod';

import {
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
  PRICING_SETTINGS_SCHEMA_VERSION,
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

export const feeRuleSchema = z
  .object({
    mode: z.enum([FEE_MODES.NONE, FEE_MODES.FIXED, FEE_MODES.HOURLY, FEE_MODES.MANUAL], {
      message: 'Mode fee tidak valid.',
    }),
    amount: nonNegativeIntSchema,
  })
  .superRefine((data, ctx) => {
    if ((data.mode === FEE_MODES.NONE || data.mode === FEE_MODES.MANUAL) && data.amount !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Nominal fee preset harus Rp 0 untuk mode None atau Manual.',
      });
    }
  });

export const optionFeesSchema = z.object({
  staff: feeRuleSchema,
  owner: feeRuleSchema,
  recordingOperator: feeRuleSchema,
});

export const discountRuleItemSchema = z
  .object({
    id: z.string().trim().min(1, 'ID aturan diskon wajib ada.'),
    name: z.string().trim().max(80, 'Nama diskon maksimal 80 karakter.'),
    mode: z.enum([DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK, DISCOUNT_RULE_MODES.MINIMUM_DURATION], {
      message: 'Mode diskon tidak valid.',
    }),
    intervalMinutes: z.number().finite().int().min(0),
    minimumDurationMinutes: z.number().finite().int().min(0),
    discountAmount: positiveIntSchema,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK) {
      if (!Number.isInteger(data.intervalMinutes) || data.intervalMinutes <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['intervalMinutes'],
          message: 'Interval blok diskon harus lebih besar dari 0 menit.',
        });
      }
    } else if (data.mode === DISCOUNT_RULE_MODES.MINIMUM_DURATION) {
      if (
        !Number.isInteger(data.minimumDurationMinutes) ||
        data.minimumDurationMinutes < 30 ||
        data.minimumDurationMinutes % 30 !== 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['minimumDurationMinutes'],
          message: 'Minimum durasi wajib kelipatan 30 menit (minimal 30 menit).',
        });
      }
    }
  });

export const optionPricingSchema = z
  .object({
    mode: z.enum(
      [
        PRICING_MODES.HOURLY,
        PRICING_MODES.FIXED_SHIFT,
        PRICING_MODES.FIXED_PROJECT,
        PRICING_MODES.MANUAL_QUOTE,
        PRICING_MODES.UNCONFIGURED,
      ],
      { message: 'Model harga tidak valid.' },
    ),
    hourlyRate: z.number().finite().nullable(),
    durationMinutes: z.number().finite().nullable(),
    basePrice: z.number().finite().nullable(),
    discountAmount: nonNegativeIntSchema,
    projectPrice: z.number().finite().nullable(),
    unitLabel: z.string().trim().max(40, 'Label satuan maksimal 40 karakter.').default(''),
  })
  .superRefine((data, ctx) => {
    if (data.mode === PRICING_MODES.HOURLY) {
      if (!Number.isInteger(data.hourlyRate) || data.hourlyRate <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['hourlyRate'],
          message: 'Tarif per jam wajib berupa bilangan bulat lebih dari Rp 0.',
        });
      }
    } else if (data.mode === PRICING_MODES.FIXED_SHIFT) {
      const durCheck = durationMultiple30Schema.safeParse(data.durationMinutes);
      if (!durCheck.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: durCheck.error.issues[0]?.message || 'Durasi Fixed Shift tidak valid.',
        });
      }
      if (!Number.isInteger(data.basePrice) || data.basePrice <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['basePrice'],
          message: 'Harga dasar Fixed Shift wajib lebih dari Rp 0.',
        });
      } else if (data.discountAmount > data.basePrice) {
        ctx.addIssue({
          code: 'custom',
          path: ['discountAmount'],
          message: 'Diskon paket tidak boleh melebihi harga dasar.',
        });
      }
    } else if (data.mode === PRICING_MODES.FIXED_PROJECT) {
      if (!Number.isInteger(data.projectPrice) || data.projectPrice <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['projectPrice'],
          message: 'Harga project wajib berupa bilangan bulat lebih dari Rp 0.',
        });
      }
    }
  });

export const serviceOptionItemSchema = z
  .object({
    id: z.string().trim().min(1, 'ID subcategory wajib ada.'),
    name: z
      .string()
      .trim()
      .min(2, 'Nama subcategory minimal 2 karakter.')
      .max(80, 'Nama subcategory maksimal 80 karakter.'),
    description: z.string().trim().max(200, 'Deskripsi maksimal 200 karakter.'),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(1),
    pricing: optionPricingSchema,
    discountRules: z.array(discountRuleItemSchema),
    fees: optionFeesSchema,
  })
  .superRefine((data, ctx) => {
    if (data.pricing.mode === PRICING_MODES.UNCONFIGURED && data.isActive) {
      ctx.addIssue({
        code: 'custom',
        path: ['isActive'],
        message: 'Subcategory berstatus Belum Dikonfigurasi tidak boleh diaktifkan.',
      });
    }

    if (data.pricing.mode !== PRICING_MODES.HOURLY && data.discountRules.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountRules'],
        message: 'Aturan diskon durasi hanya berlaku untuk subcategory bertipe Hourly.',
      });
    }

    const seenRuleIds = new Set();
    for (const rule of data.discountRules) {
      if (seenRuleIds.has(rule.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['discountRules'],
          message: `Terdapat ID aturan diskon duplikat (${rule.id}).`,
        });
        break;
      }
      seenRuleIds.add(rule.id);
    }
  });

export const serviceTypeItemSchema = z
  .object({
    id: z.string().trim().min(1, 'ID service type wajib ada.'),
    name: z
      .string()
      .trim()
      .min(2, 'Nama service minimal 2 karakter.')
      .max(60, 'Nama service maksimal 60 karakter.'),
    description: z.string().trim().max(200, 'Deskripsi maksimal 200 karakter.'),
    deliveryMode: z.enum([DELIVERY_MODES.STUDIO, DELIVERY_MODES.WFA], {
      message: 'Delivery mode wajib Studio atau WFA.',
    }),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(1),
    options: z.array(serviceOptionItemSchema),
  })
  .superRefine((data, ctx) => {
    data.options.forEach((opt, idx) => {
      if (
        data.deliveryMode === DELIVERY_MODES.STUDIO &&
        opt.pricing.mode === PRICING_MODES.FIXED_PROJECT
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', idx, 'pricing', 'mode'],
          message: `Subcategory "${opt.name}" pada layanan Studio tidak boleh memakai mode Fixed Project.`,
        });
      }
      if (
        data.deliveryMode === DELIVERY_MODES.WFA &&
        opt.pricing.mode === PRICING_MODES.FIXED_SHIFT
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', idx, 'pricing', 'mode'],
          message: `Subcategory "${opt.name}" pada layanan WFA tidak boleh memakai mode Fixed Shift.`,
        });
      }
    });
  });

export const operationalSettingsSchema = z.object({
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

export function validateServiceTypeForm(values) {
  const parsed = serviceTypeItemSchema.safeParse({
    ...values,
    options: Array.isArray(values?.options) ? values.options : [],
  });
  if (parsed.success) {
    return { isValid: true, data: parsed.data, errors: {} };
  }
  return { isValid: false, data: null, errors: formatZodIssues(parsed.error.issues) };
}

export function validateServiceOptionForm(values, deliveryMode = DELIVERY_MODES.STUDIO) {
  const parsed = serviceOptionItemSchema.safeParse(values);
  const errors = parsed.success ? {} : formatZodIssues(parsed.error.issues);

  if (
    deliveryMode === DELIVERY_MODES.STUDIO &&
    values?.pricing?.mode === PRICING_MODES.FIXED_PROJECT
  ) {
    errors['pricing.mode'] = 'Mode Fixed Project hanya berlaku untuk layanan WFA.';
  }

  if (deliveryMode === DELIVERY_MODES.WFA && values?.pricing?.mode === PRICING_MODES.FIXED_SHIFT) {
    errors['pricing.mode'] = 'Mode Fixed Shift hanya berlaku untuk layanan Studio.';
  }

  if (Object.keys(errors).length === 0 && parsed.success) {
    return { isValid: true, data: parsed.data, errors: {} };
  }
  return { isValid: false, data: null, errors };
}

export function validateOperationalSettingsForm(values) {
  const parsed = operationalSettingsSchema.safeParse(values);
  if (parsed.success) {
    return { isValid: true, data: parsed.data, errors: {} };
  }
  return { isValid: false, data: null, errors: formatZodIssues(parsed.error.issues) };
}

/**
 * Checks whether a Service Type can be safely deleted without breaking active subcategories
 * or leaving the Studio Calendar with zero active services.
 */
export function canDeleteServiceType(serviceType, allServiceTypes = []) {
  if (!serviceType) {
    return { canDelete: false, message: 'Service type tidak ditemukan.' };
  }

  const activeOptions = (serviceType.options || []).filter((opt) => opt.isActive !== false);
  if (activeOptions.length > 0) {
    const names = activeOptions.map((opt) => `"${opt.name}"`).join(', ');
    return {
      canDelete: false,
      message: `Service "${serviceType.name}" masih memiliki subcategory aktif (${names}). Nonaktifkan atau hapus subcategory terkait terlebih dahulu.`,
    };
  }

  if (serviceType.deliveryMode === DELIVERY_MODES.STUDIO) {
    const otherActiveStudio = (allServiceTypes || []).filter(
      (svc) =>
        svc.id !== serviceType.id &&
        svc.deliveryMode === DELIVERY_MODES.STUDIO &&
        svc.isActive !== false &&
        (svc.options || []).some(
          (opt) => opt.isActive !== false && opt.pricing?.mode !== PRICING_MODES.UNCONFIGURED,
        ),
    );
    if (otherActiveStudio.length === 0) {
      return {
        canDelete: false,
        message:
          'Minimal satu Studio Service dengan subcategory aktif harus tetap tersedia agar Booking Form dapat digunakan.',
      };
    }
  }

  return { canDelete: true, message: '' };
}

/**
 * Checks whether a Subcategory can be safely deleted.
 */
export function canDeleteServiceOption(serviceType, option, allServiceTypes = []) {
  if (!serviceType || !option) {
    return { canDelete: false, message: 'Subcategory tidak ditemukan.' };
  }

  if (
    serviceType.deliveryMode === DELIVERY_MODES.STUDIO &&
    serviceType.isActive !== false &&
    option.isActive !== false &&
    option.pricing?.mode !== PRICING_MODES.UNCONFIGURED
  ) {
    const remainingBookableStudioOptions = (allServiceTypes || [])
      .filter((svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO && svc.isActive !== false)
      .flatMap((svc) => svc.options || [])
      .filter(
        (opt) =>
          opt.id !== option.id &&
          opt.isActive !== false &&
          opt.pricing?.mode !== PRICING_MODES.UNCONFIGURED,
      );

    if (remainingBookableStudioOptions.length === 0) {
      return {
        canDelete: false,
        message:
          'Tidak dapat menghapus subcategory terakhir yang aktif untuk Studio Calendar. Aktifkan subcategory lain terlebih dahulu.',
      };
    }
  }

  return { canDelete: true, message: '' };
}

/**
 * Validates the complete `settings/pricing` Schema V2 payload before writing to Cloud Firestore.
 */
export const pricingSettingsPayloadSchema = z
  .object({
    schemaVersion: z.literal(PRICING_SETTINGS_SCHEMA_VERSION),
    serviceTypes: z.array(serviceTypeItemSchema).min(1, 'Minimal harus ada satu Service Type.'),
    operationalSettings: operationalSettingsSchema,
  })
  .superRefine((data, ctx) => {
    const seenServiceIds = new Set();
    const seenOptionIds = new Set();

    let activeStudioBookableOptions = 0;

    data.serviceTypes.forEach((svc, svcIdx) => {
      if (seenServiceIds.has(svc.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['serviceTypes', svcIdx, 'id'],
          message: `Terdapat ID service type duplikat (${svc.id}).`,
        });
      }
      seenServiceIds.add(svc.id);

      svc.options.forEach((opt, optIdx) => {
        if (seenOptionIds.has(opt.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['serviceTypes', svcIdx, 'options', optIdx, 'id'],
            message: `Terdapat ID subcategory duplikat secara global (${opt.id}).`,
          });
        }
        seenOptionIds.add(opt.id);

        if (
          svc.deliveryMode === DELIVERY_MODES.STUDIO &&
          svc.isActive &&
          opt.isActive &&
          opt.pricing.mode !== PRICING_MODES.UNCONFIGURED &&
          opt.pricing.mode !== PRICING_MODES.FIXED_PROJECT
        ) {
          activeStudioBookableOptions += 1;
        }
      });
    });

    if (activeStudioBookableOptions === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['serviceTypes'],
        message:
          'Minimal satu Studio Service harus aktif dan memiliki minimal satu subcategory terkonfigurasi agar Calendar Booking tetap dapat digunakan.',
      });
    }
  });

export function validatePricingSettingsPayload(settings) {
  const parsed = pricingSettingsPayloadSchema.safeParse({
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    serviceTypes: settings?.serviceTypes || [],
    operationalSettings: settings?.operationalSettings || {
      dailyMealAllowancePerStaff: 0,
    },
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
    message: parsed.error.issues[0]?.message || 'Konfigurasi Price and Fee V2 tidak valid.',
  };
}
