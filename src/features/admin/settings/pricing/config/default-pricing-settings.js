/**
 * Default Price and Fee Settings for 37 Music Studio.
 *
 * All default values match the existing Phase 5/5A studio pricing configuration
 * (`calendar-config.js`) so behavior remains identical until Owner/Staff saves
 * custom presets into Cloud Firestore (`settings/pricing`).
 */

export const PRICING_SETTINGS_COLLECTION = 'settings';
export const PRICING_SETTINGS_DOC_ID = 'pricing';
export const PRICING_SETTINGS_SCHEMA_VERSION = 1;

export const DURATION_DISCOUNT_TYPE = 'duration_multiple';
export const DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES = 180;
export const DEFAULT_DURATION_DISCOUNT_AMOUNT = 30000;

export const DEFAULT_ENABLED_DURATION_DISCOUNT = {
  enabled: true,
  intervalMinutes: DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
  discountAmount: DEFAULT_DURATION_DISCOUNT_AMOUNT,
};

export const DEFAULT_DISABLED_DURATION_DISCOUNT = {
  enabled: false,
  intervalMinutes: DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
  discountAmount: DEFAULT_DURATION_DISCOUNT_AMOUNT,
};

export const DEFAULT_SESSION_TYPES = [
  {
    id: 'rehearsal',
    name: 'Rehearsal',
    description: 'Latihan studio reguler',
    hourlyRate: 100000,
    durationDiscount: { ...DEFAULT_ENABLED_DURATION_DISCOUNT },
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'recording',
    name: 'Recording',
    description: 'Tracking rekaman instrumen & vokal',
    hourlyRate: 150000,
    durationDiscount: { ...DEFAULT_DISABLED_DURATION_DISCOUNT },
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'mixing',
    name: 'Mixing',
    description: 'Mixing audio multi-track',
    hourlyRate: 250000,
    durationDiscount: { ...DEFAULT_DISABLED_DURATION_DISCOUNT },
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'mastering',
    name: 'Mastering',
    description: 'Final mastering siap rilis',
    hourlyRate: 300000,
    durationDiscount: { ...DEFAULT_DISABLED_DURATION_DISCOUNT },
    isActive: true,
    sortOrder: 4,
  },
];

export const DEFAULT_RECORDING_TYPES = [
  {
    id: 'tracking-regular',
    name: 'Tracking Reguler',
    description: 'Tarif per jam mengikuti durasi sesi (Rp 150.000/jam)',
    priceMode: 'hourly',
    durationMinutes: 0,
    price: 150000,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'live-recording-3h',
    name: 'Live Recording Session',
    description: 'Sesi rekaman live 3 jam (Rp 420.000)',
    priceMode: 'fixed',
    durationMinutes: 180,
    price: 420000,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'multitrack-shift-6h',
    name: 'Multitrack Shift',
    description: 'Shift rekaman 6 jam penuh (Rp 800.000)',
    priceMode: 'fixed',
    durationMinutes: 360,
    price: 800000,
    isActive: true,
    sortOrder: 3,
  },
];

export const DEFAULT_STUDIO_PACKAGES = [
  {
    id: 'pkg-rehearsal-3h',
    name: 'Paket Rehearsal 3 Jam',
    detail: 'Latihan 3 jam hemat Rp 30.000',
    sessionTypeId: 'rehearsal',
    durationMinutes: 180,
    basePrice: 300000,
    discountAmount: 30000,
    staffCommissionAmount: 0,
    recordingOperatorCommissionAmount: 0,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'pkg-rehearsal-5h',
    name: 'Paket Rehearsal 5 Jam',
    detail: 'Latihan 5 jam hemat Rp 50.000',
    sessionTypeId: 'rehearsal',
    durationMinutes: 300,
    basePrice: 500000,
    discountAmount: 50000,
    staffCommissionAmount: 0,
    recordingOperatorCommissionAmount: 0,
    isActive: true,
    sortOrder: 2,
  },
];

export const DEFAULT_DISCOUNT_PRESETS = [];

export const DEFAULT_OPERATIONAL_FEES = {
  rehearsalStaffCommissionPerHour: 0,
  dailyMealAllowancePerStaff: 0,
};

export const DEFAULT_PRICING_SETTINGS = {
  schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
  sessionTypes: DEFAULT_SESSION_TYPES,
  recordingTypes: DEFAULT_RECORDING_TYPES,
  packages: DEFAULT_STUDIO_PACKAGES,
  discounts: DEFAULT_DISCOUNT_PRESETS,
  fees: DEFAULT_OPERATIONAL_FEES,
  version: 0,
  updatedAt: null,
  updatedByUid: '',
};
