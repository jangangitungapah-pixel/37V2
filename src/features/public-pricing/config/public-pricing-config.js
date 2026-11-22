import {
  DELIVERY_MODES,
  PRICING_MODES,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';

export const PUBLIC_PRICING_CATALOG_COLLECTION = 'publicPricingCatalog';
export const PUBLIC_PRICING_CATALOG_DOC_ID = 'current';
export const PUBLIC_PRICING_CATALOG_SCHEMA_VERSION = PRICING_SETTINGS_SCHEMA_VERSION;

export const PUBLIC_PRICING_ALLOWED_DELIVERY_MODES = Object.freeze([
  DELIVERY_MODES.STUDIO,
  DELIVERY_MODES.WFA,
]);

export const PUBLIC_PRICING_ALLOWED_PRICING_MODES = Object.freeze([
  PRICING_MODES.HOURLY,
  PRICING_MODES.FIXED_SHIFT,
  PRICING_MODES.FIXED_PROJECT,
  PRICING_MODES.MANUAL_QUOTE,
]);

/**
 * Internal keys that MUST NEVER appear anywhere inside `publicPricingCatalog/current`.
 */
export const PUBLIC_PRICING_FORBIDDEN_KEYS = Object.freeze([
  'fees',
  'operationalSettings',
  'updatedByUid',
  'defaultStaffCommission',
  'defaultOwnerCommission',
  'staffCommissionAmount',
  'recordingOperatorCommissionAmount',
  'rehearsalStaffCommissionPerHour',
  'dailyMealAllowancePerStaff',
]);
