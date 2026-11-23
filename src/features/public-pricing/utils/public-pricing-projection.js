import {
  DISCOUNT_RULE_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { normalizePricingSettings } from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import {
  PUBLIC_PRICING_ALLOWED_DELIVERY_MODES,
  PUBLIC_PRICING_ALLOWED_PRICING_MODES,
  PUBLIC_PRICING_CATALOG_SCHEMA_VERSION,
  PUBLIC_PRICING_FORBIDDEN_KEYS,
} from '../config/public-pricing-config';

const ALLOWED_DELIVERY_SET = new Set(PUBLIC_PRICING_ALLOWED_DELIVERY_MODES);
const ALLOWED_PRICING_MODE_SET = new Set(PUBLIC_PRICING_ALLOWED_PRICING_MODES);
const ALLOWED_DISCOUNT_MODES = new Set(Object.values(DISCOUNT_RULE_MODES));
const FORBIDDEN_KEY_SET = new Set(PUBLIC_PRICING_FORBIDDEN_KEYS);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStrictPositiveInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function toStrictNonNegativeInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 ? num : null;
}

function cleanString(value, maxLen = 240) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

const SERVICE_OPTION_INDEX_KEYS = [
  'deliveryMode',
  'serviceLabelSnapshot',
  'serviceOptionId',
  'serviceOptionName',
  'serviceTypeId',
];

function buildServiceOptionIndex(serviceTypes) {
  return serviceTypes.flatMap((service) =>
    service.options.map((option) => ({
      serviceTypeId: service.id,
      serviceLabelSnapshot: service.name,
      serviceOptionId: option.id,
      serviceOptionName: option.name,
      deliveryMode: service.deliveryMode,
    })),
  );
}

function serviceOptionIndexEntryKey(entry) {
  return JSON.stringify([
    entry.serviceTypeId,
    entry.serviceLabelSnapshot,
    entry.serviceOptionId,
    entry.serviceOptionName,
    entry.deliveryMode,
  ]);
}

function isMatchingServiceOptionIndex(rawIndex, serviceTypes) {
  if (!Array.isArray(rawIndex) || rawIndex.length > 500) return false;

  const expectedEntries = buildServiceOptionIndex(serviceTypes);
  if (rawIndex.length !== expectedEntries.length) return false;

  const expectedKeys = new Set(expectedEntries.map(serviceOptionIndexEntryKey));
  const actualKeys = [];

  for (const entry of rawIndex) {
    if (!isPlainObject(entry)) return false;
    const keys = Object.keys(entry).sort();
    if (keys.join('|') !== SERVICE_OPTION_INDEX_KEYS.join('|')) return false;
    if (
      !SERVICE_OPTION_INDEX_KEYS.every((key) => typeof entry[key] === 'string') ||
      !entry.serviceTypeId.trim() ||
      !entry.serviceLabelSnapshot.trim() ||
      !entry.serviceOptionId.trim() ||
      !entry.serviceOptionName.trim() ||
      !ALLOWED_DELIVERY_SET.has(entry.deliveryMode)
    ) {
      return false;
    }
    actualKeys.push(serviceOptionIndexEntryKey(entry));
  }

  const actualSet = new Set(actualKeys);
  return actualSet.size === actualKeys.length && actualKeys.every((key) => expectedKeys.has(key));
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

function findForbiddenKeyRecursive(value) {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findForbiddenKeyRecursive(item);
      if (hit) return hit;
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY_SET.has(key)) {
      return key;
    }
    const nestedHit = findForbiddenKeyRecursive(value[key]);
    if (nestedHit) return nestedHit;
  }
  return null;
}

function sanitizeDiscountRules(rules, pricingMode) {
  if (pricingMode !== PRICING_MODES.HOURLY || !Array.isArray(rules)) {
    return [];
  }

  const sanitized = [];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!isPlainObject(rule) || rule.isActive === false) continue;

    const mode = cleanString(rule.mode, 40);
    const discountAmount = toStrictPositiveInt(rule.discountAmount);
    if (!ALLOWED_DISCOUNT_MODES.has(mode) || !discountAmount) continue;

    const intervalMinutes =
      mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
        ? toStrictPositiveInt(rule.intervalMinutes)
        : 0;
    const minimumDurationMinutes =
      mode === DISCOUNT_RULE_MODES.MINIMUM_DURATION
        ? toStrictPositiveInt(rule.minimumDurationMinutes)
        : 0;

    if (mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK && !intervalMinutes) continue;
    if (mode === DISCOUNT_RULE_MODES.MINIMUM_DURATION && !minimumDurationMinutes) continue;

    sanitized.push({
      id: cleanString(rule.id, 80) || `rule-${i + 1}`,
      name: cleanString(rule.name, 80) || 'Diskon Durasi',
      mode,
      intervalMinutes: intervalMinutes ?? 0,
      minimumDurationMinutes: minimumDurationMinutes ?? 0,
      discountAmount,
    });
  }

  return sanitized;
}

function sanitizePublicOption(option, index) {
  if (!isPlainObject(option) || option.isActive === false) return null;
  const pricing = option.pricing;
  if (!isPlainObject(pricing)) return null;

  const mode = cleanString(pricing.mode, 40);
  if (!ALLOWED_PRICING_MODE_SET.has(mode)) return null;

  const id = cleanString(option.id, 80);
  const name = cleanString(option.name, 100);
  if (!id || !name) return null;

  let publicPricing = null;

  if (mode === PRICING_MODES.HOURLY) {
    const hourlyRate = toStrictPositiveInt(pricing.hourlyRate);
    if (!hourlyRate) return null;
    publicPricing = {
      mode: PRICING_MODES.HOURLY,
      hourlyRate,
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice: null,
      unitLabel: cleanString(pricing.unitLabel, 40),
    };
  } else if (mode === PRICING_MODES.FIXED_SHIFT) {
    const durationMinutes = toStrictPositiveInt(pricing.durationMinutes);
    const basePrice = toStrictPositiveInt(pricing.basePrice);
    const discountAmount = toStrictNonNegativeInt(pricing.discountAmount ?? 0);
    if (
      !durationMinutes ||
      durationMinutes % 30 !== 0 ||
      !basePrice ||
      discountAmount === null ||
      discountAmount > basePrice
    ) {
      return null;
    }
    publicPricing = {
      mode: PRICING_MODES.FIXED_SHIFT,
      hourlyRate: null,
      durationMinutes,
      basePrice,
      discountAmount,
      projectPrice: null,
      unitLabel: cleanString(pricing.unitLabel, 40),
    };
  } else if (mode === PRICING_MODES.FIXED_PROJECT) {
    const projectPrice = toStrictPositiveInt(pricing.projectPrice);
    if (!projectPrice) return null;
    publicPricing = {
      mode: PRICING_MODES.FIXED_PROJECT,
      hourlyRate: null,
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice,
      unitLabel: cleanString(pricing.unitLabel, 40),
    };
  } else if (mode === PRICING_MODES.MANUAL_QUOTE) {
    publicPricing = {
      mode: PRICING_MODES.MANUAL_QUOTE,
      hourlyRate: null,
      durationMinutes: null,
      basePrice: null,
      discountAmount: 0,
      projectPrice: null,
      unitLabel: cleanString(pricing.unitLabel, 40),
    };
  }

  return {
    id,
    name,
    description: cleanString(option.description, 240),
    sortOrder: toStrictPositiveInt(option.sortOrder) ?? index + 1,
    pricing: publicPricing,
    discountRules: sanitizeDiscountRules(option.discountRules, mode),
  };
}

/**
 * Projects authoritative `settings/pricing` (Schema V2 or migrated V1) into a strictly
 * public-safe catalog document (`publicPricingCatalog/current`).
 *
 * - Strips `fees`, `operationalSettings`, `updatedByUid`, and all internal payout data.
 * - Filters out inactive services, inactive options, and `unconfigured` options.
 */
export function buildPublicPricingProjection(
  pricingSettings,
  { catalogVersion = null, updatedAt = undefined } = {},
) {
  const normalized = normalizePricingSettings(pricingSettings);
  const resolvedVersion =
    toStrictPositiveInt(catalogVersion) ?? toStrictPositiveInt(normalized.version) ?? 1;

  const sortedServices = [...(normalized.serviceTypes || [])].sort(
    (a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999),
  );

  const serviceTypes = [];
  for (let i = 0; i < sortedServices.length; i += 1) {
    const svc = sortedServices[i];
    if (!isPlainObject(svc) || svc.isActive === false) continue;

    const deliveryMode = cleanString(svc.deliveryMode, 20);
    if (!ALLOWED_DELIVERY_SET.has(deliveryMode)) continue;

    const sortedOptions = [...(svc.options || [])].sort(
      (a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999),
    );
    const options = sortedOptions.map(sanitizePublicOption).filter(Boolean);
    if (options.length === 0) continue;

    serviceTypes.push({
      id: cleanString(svc.id, 80) || `service-${i + 1}`,
      name: cleanString(svc.name, 80) || `Service ${i + 1}`,
      description: cleanString(svc.description, 240),
      deliveryMode,
      sortOrder: toStrictPositiveInt(svc.sortOrder) ?? i + 1,
      options,
    });
  }

  return {
    schemaVersion: PUBLIC_PRICING_CATALOG_SCHEMA_VERSION,
    version: resolvedVersion,
    serviceTypes,
    serviceOptionIndex: buildServiceOptionIndex(serviceTypes),
    updatedAt: updatedAt !== undefined ? updatedAt : normalized.updatedAt || null,
  };
}

function validateNormalizedOption(option) {
  if (!isPlainObject(option)) return 'invalid_option_shape';
  const id = cleanString(option.id, 80);
  const name = cleanString(option.name, 100);
  if (!id || !name) return 'missing_option_identity';
  if (!isPlainObject(option.pricing)) return 'missing_option_pricing';

  const mode = cleanString(option.pricing.mode, 40);
  if (!ALLOWED_PRICING_MODE_SET.has(mode)) return 'invalid_option_pricing_mode';

  if (mode === PRICING_MODES.HOURLY && !toStrictPositiveInt(option.pricing.hourlyRate)) {
    return 'invalid_hourly_rate';
  }
  if (mode === PRICING_MODES.FIXED_SHIFT) {
    const durationMinutes = toStrictPositiveInt(option.pricing.durationMinutes);
    const basePrice = toStrictPositiveInt(option.pricing.basePrice);
    const discountAmount = toStrictNonNegativeInt(option.pricing.discountAmount ?? 0);
    if (
      !durationMinutes ||
      durationMinutes % 30 !== 0 ||
      !basePrice ||
      discountAmount === null ||
      discountAmount > basePrice
    ) {
      return 'invalid_fixed_shift_pricing';
    }
  }
  if (mode === PRICING_MODES.FIXED_PROJECT && !toStrictPositiveInt(option.pricing.projectPrice)) {
    return 'invalid_project_price';
  }

  return '';
}

/**
 * Validates and normalizes `publicPricingCatalog/current`. Fails closed on any missing,
 * malformed, or security-boundary-violating payload so Client pages never rely on hardcoded rates.
 */
export function normalizePublicPricingCatalog(rawData) {
  if (!isPlainObject(rawData)) {
    return { isValid: false, reason: 'missing_document', catalog: null };
  }

  const forbiddenKey = findForbiddenKeyRecursive(rawData);
  if (forbiddenKey) {
    return { isValid: false, reason: `forbidden_field:${forbiddenKey}`, catalog: null };
  }

  if (Number(rawData.schemaVersion) !== PUBLIC_PRICING_CATALOG_SCHEMA_VERSION) {
    return { isValid: false, reason: 'invalid_schema_version', catalog: null };
  }

  const version = toStrictPositiveInt(rawData.version);
  if (!version) {
    return { isValid: false, reason: 'invalid_catalog_version', catalog: null };
  }

  if (!Array.isArray(rawData.serviceTypes)) {
    return { isValid: false, reason: 'invalid_service_types', catalog: null };
  }

  const normalizedServices = [];
  for (let i = 0; i < rawData.serviceTypes.length; i += 1) {
    const svc = rawData.serviceTypes[i];
    if (!isPlainObject(svc)) {
      return { isValid: false, reason: 'invalid_service_entry', catalog: null };
    }
    const id = cleanString(svc.id, 80);
    const name = cleanString(svc.name, 80);
    const deliveryMode = cleanString(svc.deliveryMode, 20);
    if (!id || !name || !ALLOWED_DELIVERY_SET.has(deliveryMode) || !Array.isArray(svc.options)) {
      return { isValid: false, reason: 'invalid_service_metadata', catalog: null };
    }

    const sanitizedOptions = [];
    for (let j = 0; j < svc.options.length; j += 1) {
      const opt = svc.options[j];
      const err = validateNormalizedOption(opt);
      if (err) {
        return { isValid: false, reason: err, catalog: null };
      }
      const cleanOpt = sanitizePublicOption(opt, j);
      if (!cleanOpt) {
        return { isValid: false, reason: 'invalid_public_option', catalog: null };
      }
      sanitizedOptions.push(cleanOpt);
    }

    if (sanitizedOptions.length > 0) {
      normalizedServices.push({
        id,
        name,
        description: cleanString(svc.description, 240),
        deliveryMode,
        sortOrder: toStrictPositiveInt(svc.sortOrder) ?? i + 1,
        options: sanitizedOptions.sort((a, b) => a.sortOrder - b.sortOrder),
      });
    }
  }

  normalizedServices.sort((a, b) => a.sortOrder - b.sortOrder);

  if (!isMatchingServiceOptionIndex(rawData.serviceOptionIndex, normalizedServices)) {
    return { isValid: false, reason: 'invalid_service_option_index', catalog: null };
  }

  return {
    isValid: true,
    reason: '',
    catalog: {
      schemaVersion: PUBLIC_PRICING_CATALOG_SCHEMA_VERSION,
      version,
      serviceTypes: normalizedServices,
      serviceOptionIndex: buildServiceOptionIndex(normalizedServices),
      updatedAt: normalizeTimestampToIso(rawData.updatedAt),
    },
  };
}
