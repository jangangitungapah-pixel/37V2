import {
  DEFAULT_DISCOUNT_PRESETS,
  DEFAULT_OPERATIONAL_FEES,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_RECORDING_TYPES,
  DEFAULT_SESSION_TYPES,
  DEFAULT_STUDIO_PACKAGES,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '../config/default-pricing-settings';

/**
 * Generates an opaque unique ID for custom settings entries (independent of display name
 * and never relying on mutable array indexes).
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

export function normalizeSessionTypeItem(raw = {}, index = 0) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('session');
  return {
    id,
    name: String(raw.name || raw.label || 'Session').trim(),
    description: String(raw.description || '').trim(),
    hourlyRate: toNonNegativeInt(raw.hourlyRate ?? raw.unitRate, 0),
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
  };
}

export function normalizeRecordingOptionItem(raw = {}, index = 0) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('rec');
  const priceMode = raw.priceMode === 'fixed' ? 'fixed' : 'hourly';
  const durationMinutes =
    priceMode === 'fixed'
      ? Math.max(30, toNonNegativeInt(raw.durationMinutes ?? raw.lockedDurationMinutes, 180))
      : 0;

  return {
    id,
    name: String(raw.name || raw.label || 'Recording Option').trim(),
    description: String(raw.description || '').trim(),
    priceMode,
    durationMinutes,
    price: toNonNegativeInt(
      raw.price ?? (priceMode === 'fixed' ? raw.fixedPrice : raw.unitRate),
      0,
    ),
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
  };
}

export function normalizeStudioPackageItem(raw = {}, index = 0) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('pkg');
  const basePrice = toNonNegativeInt(raw.basePrice ?? raw.subtotal, 0);
  const discountAmount = Math.min(basePrice, toNonNegativeInt(raw.discountAmount, 0));

  return {
    id,
    name: String(raw.name || raw.label || 'Paket Studio').trim(),
    detail: String(raw.detail ?? raw.description ?? '').trim(),
    sessionTypeId: String(raw.sessionTypeId ?? raw.serviceId ?? 'rehearsal').trim() || 'rehearsal',
    durationMinutes: Math.max(30, toNonNegativeInt(raw.durationMinutes, 60)),
    basePrice,
    discountAmount,
    staffCommissionAmount: toNonNegativeInt(raw.staffCommissionAmount, 0),
    recordingOperatorCommissionAmount: toNonNegativeInt(raw.recordingOperatorCommissionAmount, 0),
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
  };
}

export function normalizeDiscountPresetItem(raw = {}, index = 0) {
  const id = String(raw.id || '').trim() || generateSettingsItemId('disc');
  return {
    id,
    name: String(raw.name || 'Promo Diskon').trim(),
    sessionTypeId: String(raw.sessionTypeId || 'rehearsal').trim() || 'rehearsal',
    minimumDurationMinutes: Math.max(30, toNonNegativeInt(raw.minimumDurationMinutes, 60)),
    discountAmount: toNonNegativeInt(raw.discountAmount, 0),
    isActive: raw.isActive !== false,
    sortOrder: toNonNegativeInt(raw.sortOrder, index + 1) || index + 1,
  };
}

export function normalizeOperationalFees(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : DEFAULT_OPERATIONAL_FEES;
  return {
    rehearsalStaffCommissionPerHour: toNonNegativeInt(source.rehearsalStaffCommissionPerHour, 0),
    dailyMealAllowancePerStaff: toNonNegativeInt(source.dailyMealAllowancePerStaff, 0),
  };
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function clonePricingSettings(settings = DEFAULT_PRICING_SETTINGS) {
  return {
    schemaVersion: Number(settings.schemaVersion) || PRICING_SETTINGS_SCHEMA_VERSION,
    sessionTypes: (settings.sessionTypes || []).map((item) => ({ ...item })),
    recordingTypes: (settings.recordingTypes || []).map((item) => ({ ...item })),
    packages: (settings.packages || []).map((item) => ({ ...item })),
    discounts: (settings.discounts || []).map((item) => ({ ...item })),
    fees: normalizeOperationalFees(settings.fees),
    version: toNonNegativeInt(settings.version, 0),
    updatedAt: settings.updatedAt ?? null,
    updatedByUid: String(settings.updatedByUid || ''),
  };
}

/**
 * Normalizes a raw Firestore `settings/pricing` document into a complete domain object.
 * Falls back cleanly to `DEFAULT_PRICING_SETTINGS` if any optional sections are missing.
 */
export function normalizePricingSettings(rawData = null) {
  if (!rawData || typeof rawData !== 'object') {
    return clonePricingSettings(DEFAULT_PRICING_SETTINGS);
  }

  const rawSessionTypes = Array.isArray(rawData.sessionTypes)
    ? rawData.sessionTypes
    : DEFAULT_SESSION_TYPES;
  const rawRecordingTypes = Array.isArray(rawData.recordingTypes)
    ? rawData.recordingTypes
    : DEFAULT_RECORDING_TYPES;
  const rawPackages = Array.isArray(rawData.packages) ? rawData.packages : DEFAULT_STUDIO_PACKAGES;
  const rawDiscounts = Array.isArray(rawData.discounts)
    ? rawData.discounts
    : DEFAULT_DISCOUNT_PRESETS;

  return {
    schemaVersion:
      toNonNegativeInt(rawData.schemaVersion, PRICING_SETTINGS_SCHEMA_VERSION) ||
      PRICING_SETTINGS_SCHEMA_VERSION,
    sessionTypes: sortByOrder(
      rawSessionTypes.map((item, idx) => normalizeSessionTypeItem(item, idx)),
    ),
    recordingTypes: sortByOrder(
      rawRecordingTypes.map((item, idx) => normalizeRecordingOptionItem(item, idx)),
    ),
    packages: sortByOrder(rawPackages.map((item, idx) => normalizeStudioPackageItem(item, idx))),
    discounts: sortByOrder(rawDiscounts.map((item, idx) => normalizeDiscountPresetItem(item, idx))),
    fees: normalizeOperationalFees(rawData.fees),
    version: toNonNegativeInt(rawData.version, 0),
    updatedAt: rawData.updatedAt ?? null,
    updatedByUid: String(rawData.updatedByUid || ''),
  };
}

/**
 * Strips metadata (`version`, `updatedAt`, `updatedByUid`) so UI dirty state checks
 * only actual configuration differences.
 */
export function serializeConfigurablePricingState(settings = DEFAULT_PRICING_SETTINGS) {
  const normalized = normalizePricingSettings(settings);
  return JSON.stringify({
    sessionTypes: normalized.sessionTypes,
    recordingTypes: normalized.recordingTypes,
    packages: normalized.packages,
    discounts: normalized.discounts,
    fees: normalized.fees,
  });
}

export function arePricingSettingsEqual(left, right) {
  return serializeConfigurablePricingState(left) === serializeConfigurablePricingState(right);
}
