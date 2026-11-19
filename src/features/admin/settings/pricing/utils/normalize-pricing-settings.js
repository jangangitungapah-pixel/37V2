import {
  DEFAULT_OPERATIONAL_SETTINGS,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_SERVICE_TYPES,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '../config/default-pricing-settings';
import {
  isLegacyV1PricingSettings,
  migratePricingSettingsV1ToV2,
} from './migrate-pricing-settings';

const VALID_DELIVERY_MODES = new Set(Object.values(DELIVERY_MODES));
const VALID_PRICING_MODES = new Set(Object.values(PRICING_MODES));
const VALID_FEE_MODES = new Set(Object.values(FEE_MODES));
const VALID_DISCOUNT_RULE_MODES = new Set(Object.values(DISCOUNT_RULE_MODES));

/**
 * Generates an opaque unique ID for service types, subcategories, and discount rules
 * (independent of display name and never relying on mutable array indexes).
 */
export function generateSettingsItemId(prefix = 'item') {
  const cleanPrefix = String(prefix || 'item')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return cleanPrefix ? `${cleanPrefix}-${uuid}` : uuid;
}

export function toNonNegativeInt(value, fallback = 0) {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return Math.max(0, Math.round(Number(fallback) || 0));
  }
  const num = Number(value);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return Math.max(0, Math.round(Number(fallback) || 0));
  }
  return Math.max(0, Math.round(num));
}

function toNullableInt(value, { preserveInvalid = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (preserveInvalid) {
    return num;
  }
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return null;
  }
  return Math.max(0, Math.round(num));
}

export function normalizeFeeRule(raw = null, { preserveInvalid = false } = {}) {
  if (!raw || typeof raw !== 'object') {
    return { mode: FEE_MODES.NONE, amount: 0 };
  }

  const mode = VALID_FEE_MODES.has(raw.mode) ? raw.mode : FEE_MODES.NONE;
  if (mode === FEE_MODES.NONE || mode === FEE_MODES.MANUAL) {
    return { mode, amount: 0 };
  }

  if (preserveInvalid) {
    return {
      mode,
      amount: raw.amount === '' || raw.amount === undefined ? 0 : Number(raw.amount),
    };
  }

  return {
    mode,
    amount: toNonNegativeInt(raw.amount, 0),
  };
}

export function normalizeOptionFees(raw = null, options = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    staff: normalizeFeeRule(source.staff, options),
    owner: normalizeFeeRule(source.owner, options),
    recordingOperator: normalizeFeeRule(source.recordingOperator, options),
  };
}

export function normalizeOptionPricing(raw = null, { preserveInvalid = false } = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mode = VALID_PRICING_MODES.has(source.mode) ? source.mode : PRICING_MODES.UNCONFIGURED;

  if (mode === PRICING_MODES.HOURLY) {
    return {
      mode,
      hourlyRate: preserveInvalid
        ? Number(source.hourlyRate ?? 0)
        : toNonNegativeInt(source.hourlyRate, 0),
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice: null,
      unitLabel: '',
    };
  }

  if (mode === PRICING_MODES.FIXED_SHIFT) {
    const basePrice = preserveInvalid
      ? Number(source.basePrice ?? 0)
      : toNonNegativeInt(source.basePrice, 0);
    const rawDiscount = preserveInvalid
      ? Number(source.discountAmount ?? 0)
      : toNonNegativeInt(source.discountAmount, 0);

    return {
      mode,
      hourlyRate: null,
      durationMinutes: preserveInvalid
        ? Number(source.durationMinutes ?? 0)
        : Math.max(30, toNonNegativeInt(source.durationMinutes, 180)),
      basePrice,
      discountAmount: preserveInvalid ? rawDiscount : Math.min(basePrice, rawDiscount),
      projectPrice: null,
      unitLabel: '',
    };
  }

  if (mode === PRICING_MODES.FIXED_PROJECT) {
    return {
      mode,
      hourlyRate: null,
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice: preserveInvalid
        ? Number(source.projectPrice ?? 0)
        : toNonNegativeInt(source.projectPrice, 0),
      unitLabel: String(source.unitLabel || '').trim(),
    };
  }

  if (mode === PRICING_MODES.MANUAL_QUOTE) {
    return {
      mode,
      hourlyRate: null,
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice: null,
      unitLabel: '',
    };
  }

  // PRICING_MODES.UNCONFIGURED
  return {
    mode: PRICING_MODES.UNCONFIGURED,
    hourlyRate: null,
    durationMinutes: toNullableInt(source.durationMinutes, { preserveInvalid }),
    basePrice: null,
    discountAmount: 0,
    projectPrice: null,
    unitLabel: '',
  };
}

export function normalizeDiscountRuleItem(raw = {}, index = 0, { preserveInvalid = false } = {}) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('disc');
  const mode = VALID_DISCOUNT_RULE_MODES.has(raw.mode)
    ? raw.mode
    : DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK;

  const isPerBlock = mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK;
  const defaultName = isPerBlock ? 'Diskon Durasi' : 'Promo Durasi';

  return {
    id,
    name: String(raw.name || defaultName).trim() || defaultName,
    mode,
    intervalMinutes: isPerBlock
      ? preserveInvalid
        ? Number(raw.intervalMinutes ?? 0)
        : toNonNegativeInt(raw.intervalMinutes, 180)
      : 0,
    minimumDurationMinutes: !isPerBlock
      ? preserveInvalid
        ? Number(raw.minimumDurationMinutes ?? 0)
        : toNonNegativeInt(raw.minimumDurationMinutes, 180)
      : 0,
    discountAmount: preserveInvalid
      ? Number(raw.discountAmount ?? 0)
      : toNonNegativeInt(raw.discountAmount, 0),
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
  };
}

export function normalizeServiceOptionItem(raw = {}, index = 0, options = {}) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('opt');
  const pricing = normalizeOptionPricing(raw.pricing, options);
  const rawRules =
    pricing.mode === PRICING_MODES.HOURLY && Array.isArray(raw.discountRules)
      ? raw.discountRules
      : [];

  // Unconfigured draft options MUST stay inactive unless preserveInvalid is active for validation
  const isActive =
    pricing.mode === PRICING_MODES.UNCONFIGURED && !options.preserveInvalid
      ? false
      : raw.isActive !== false;

  return {
    id,
    name: String(raw.name || raw.label || 'Subcategory').trim(),
    description: String(raw.description ?? raw.detail ?? '').trim(),
    isActive,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
    pricing,
    discountRules: rawRules.map((rule, idx) => normalizeDiscountRuleItem(rule, idx, options)),
    fees: normalizeOptionFees(raw.fees, options),
  };
}

export function normalizeServiceTypeItem(raw = {}, index = 0, options = {}) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('svc');
  const deliveryMode = VALID_DELIVERY_MODES.has(raw.deliveryMode)
    ? raw.deliveryMode
    : DELIVERY_MODES.STUDIO;
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];

  return {
    id,
    name: String(raw.name || raw.label || 'Service').trim(),
    description: String(raw.description || '').trim(),
    deliveryMode,
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
    options: sortByOrder(
      rawOptions.map((opt, idx) => normalizeServiceOptionItem(opt, idx, options)),
    ),
  };
}

export function normalizeOperationalSettings(raw = null, { preserveInvalid = false } = {}) {
  const source = raw && typeof raw === 'object' ? raw : DEFAULT_OPERATIONAL_SETTINGS;
  return {
    dailyMealAllowancePerStaff: preserveInvalid
      ? Number(source.dailyMealAllowancePerStaff ?? 0)
      : toNonNegativeInt(source.dailyMealAllowancePerStaff, 0),
  };
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function clonePricingSettings(settings = DEFAULT_PRICING_SETTINGS) {
  const normalized = normalizePricingSettings(settings);
  return {
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    serviceTypes: normalized.serviceTypes.map((svc) => ({
      ...svc,
      options: svc.options.map((opt) => ({
        ...opt,
        pricing: { ...opt.pricing },
        discountRules: opt.discountRules.map((rule) => ({ ...rule })),
        fees: {
          staff: { ...opt.fees.staff },
          owner: { ...opt.fees.owner },
          recordingOperator: { ...opt.fees.recordingOperator },
        },
      })),
    })),
    operationalSettings: { ...normalized.operationalSettings },
    version: normalized.version,
    updatedAt: normalized.updatedAt ?? null,
    updatedByUid: normalized.updatedByUid,
  };
}

/**
 * Normalizes any raw Firestore `settings/pricing` document (either legacy Schema V1
 * or Schema V2) into a complete, deterministic V2 domain object.
 */
export function normalizePricingSettings(rawData = null, options = {}) {
  if (!rawData || typeof rawData !== 'object') {
    return normalizePricingSettings(DEFAULT_PRICING_SETTINGS, options);
  }

  const v2Source = isLegacyV1PricingSettings(rawData)
    ? migratePricingSettingsV1ToV2(rawData)
    : rawData;

  const rawServiceTypes = Array.isArray(v2Source.serviceTypes)
    ? v2Source.serviceTypes
    : DEFAULT_SERVICE_TYPES;

  return {
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    serviceTypes: sortByOrder(
      rawServiceTypes.map((item, idx) => normalizeServiceTypeItem(item, idx, options)),
    ),
    operationalSettings: normalizeOperationalSettings(v2Source.operationalSettings, options),
    version: toNonNegativeInt(v2Source.version, 0),
    updatedAt: v2Source.updatedAt ?? null,
    updatedByUid: String(v2Source.updatedByUid || ''),
  };
}

/**
 * Strips metadata (`version`, `updatedAt`, `updatedByUid`) so UI dirty state compares
 * only actual configurable catalog and operational settings.
 */
export function serializeConfigurablePricingState(settings = DEFAULT_PRICING_SETTINGS) {
  const normalized = normalizePricingSettings(settings);
  return JSON.stringify({
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    serviceTypes: normalized.serviceTypes,
    operationalSettings: normalized.operationalSettings,
  });
}

export function arePricingSettingsEqual(left, right) {
  return serializeConfigurablePricingState(left) === serializeConfigurablePricingState(right);
}

/**
 * Lookup helpers across the hierarchical V2 catalog.
 */
export function findServiceTypeById(pricingSettings, serviceTypeId) {
  const cleanId = String(serviceTypeId || '').trim();
  if (!cleanId) return null;
  const serviceTypes = pricingSettings?.serviceTypes || DEFAULT_SERVICE_TYPES;
  return serviceTypes.find((svc) => svc.id === cleanId) || null;
}

export function findServiceOptionById(pricingSettings, optionId) {
  const cleanId = String(optionId || '').trim();
  if (!cleanId) return null;
  const serviceTypes = pricingSettings?.serviceTypes || DEFAULT_SERVICE_TYPES;
  for (const serviceType of serviceTypes) {
    const matched = (serviceType.options || []).find((opt) => opt.id === cleanId);
    if (matched) {
      return { serviceType, option: matched };
    }
  }
  return null;
}

export function isOptionBookableForStudio(option) {
  return Boolean(
    option &&
    option.isActive !== false &&
    option.pricing &&
    option.pricing.mode !== PRICING_MODES.UNCONFIGURED &&
    option.pricing.mode !== PRICING_MODES.FIXED_PROJECT,
  );
}
