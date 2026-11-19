/**
 * Default Price and Fee Settings (Schema V2) for 37 Music Studio.
 *
 * Hierarchical Service Catalog structure:
 *   Service Type (Studio / WFA) -> Service Option / Subcategory -> Customer Price + Internal Fees + Discount Rules
 *
 * All existing V1/V2 numeric presets are preserved without inventing unconfirmed rates:
 * options requested by the studio that do not yet have confirmed tariffs (Rehearsal Paket 6 Hours,
 * Recording Lite, Pro, Drum Only) start as `pricing.mode = 'unconfigured'` and `isActive = false`
 * until configured by the Owner.
 */

export const PRICING_SETTINGS_COLLECTION = 'settings';
export const PRICING_SETTINGS_DOC_ID = 'pricing';
export const PRICING_SETTINGS_SCHEMA_VERSION = 2;
export const PRICING_SETTINGS_LEGACY_SCHEMA_VERSION = 1;

export const DELIVERY_MODES = {
  STUDIO: 'studio',
  WFA: 'wfa',
};

export const PRICING_MODES = {
  HOURLY: 'hourly',
  FIXED_SHIFT: 'fixed_shift',
  FIXED_PROJECT: 'fixed_project',
  MANUAL_QUOTE: 'manual_quote',
  UNCONFIGURED: 'unconfigured',
};

export const FEE_MODES = {
  NONE: 'none',
  FIXED: 'fixed',
  HOURLY: 'hourly',
  MANUAL: 'manual',
};

export const DISCOUNT_RULE_MODES = {
  PER_COMPLETED_BLOCK: 'per_completed_block',
  MINIMUM_DURATION: 'minimum_duration',
};

export const DURATION_DISCOUNT_TYPE = 'duration_multiple';
export const DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES = 180;
export const DEFAULT_DURATION_DISCOUNT_AMOUNT = 30000;

export const DEFAULT_EMPTY_FEES = {
  staff: { mode: FEE_MODES.NONE, amount: 0 },
  owner: { mode: FEE_MODES.NONE, amount: 0 },
  recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
};

export const DEFAULT_OPERATIONAL_SETTINGS = {
  dailyMealAllowancePerStaff: 0,
};

export const DEFAULT_SERVICE_TYPES = [
  {
    id: 'rehearsal',
    name: 'Rehearsal',
    description: 'Latihan studio reguler dan paket latihan',
    deliveryMode: DELIVERY_MODES.STUDIO,
    isActive: true,
    sortOrder: 1,
    options: [
      {
        id: 'rehearsal-regular',
        name: 'Reguler',
        description: 'Sewa studio latihan per jam',
        isActive: true,
        sortOrder: 1,
        pricing: {
          mode: PRICING_MODES.HOURLY,
          hourlyRate: 100000,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [
          {
            id: 'disc-rehearsal-regular-3h',
            name: 'Diskon Durasi',
            mode: DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK,
            intervalMinutes: DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
            minimumDurationMinutes: 0,
            discountAmount: DEFAULT_DURATION_DISCOUNT_AMOUNT,
            isActive: true,
          },
        ],
        fees: {
          staff: { mode: FEE_MODES.HOURLY, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'pkg-rehearsal-3h',
        name: 'Paket 3 Hours',
        description: 'Latihan 3 jam hemat Rp 30.000',
        isActive: true,
        sortOrder: 2,
        pricing: {
          mode: PRICING_MODES.FIXED_SHIFT,
          hourlyRate: null,
          durationMinutes: 180,
          basePrice: 300000,
          discountAmount: 30000,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.FIXED, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'pkg-rehearsal-5h',
        name: 'Paket 5 Hours',
        description: 'Latihan 5 jam hemat Rp 50.000 (preset eksisting)',
        isActive: true,
        sortOrder: 3,
        pricing: {
          mode: PRICING_MODES.FIXED_SHIFT,
          hourlyRate: null,
          durationMinutes: 300,
          basePrice: 500000,
          discountAmount: 50000,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.FIXED, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'rehearsal-pkg-6h',
        name: 'Paket 6 Hours',
        description: 'Paket latihan 6 jam (isi tarif untuk mengaktifkan)',
        isActive: false,
        sortOrder: 4,
        pricing: {
          mode: PRICING_MODES.UNCONFIGURED,
          hourlyRate: null,
          durationMinutes: 360,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
    ],
  },
  {
    id: 'recording',
    name: 'Recording',
    description: 'Tracking rekaman instrumen, vokal, dan sesi khusus',
    deliveryMode: DELIVERY_MODES.STUDIO,
    isActive: true,
    sortOrder: 2,
    options: [
      {
        id: 'rec-lite',
        name: 'Lite',
        description: 'Opsi recording Lite (isi tarif untuk mengaktifkan)',
        isActive: false,
        sortOrder: 1,
        pricing: {
          mode: PRICING_MODES.UNCONFIGURED,
          hourlyRate: null,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'rec-pro',
        name: 'Pro',
        description: 'Opsi recording Pro (isi tarif untuk mengaktifkan)',
        isActive: false,
        sortOrder: 2,
        pricing: {
          mode: PRICING_MODES.UNCONFIGURED,
          hourlyRate: null,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'live-recording-3h',
        name: 'Live',
        description: 'Sesi rekaman live 3 jam (Rp 420.000)',
        isActive: true,
        sortOrder: 3,
        pricing: {
          mode: PRICING_MODES.FIXED_SHIFT,
          hourlyRate: null,
          durationMinutes: 180,
          basePrice: 420000,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'rec-drum-only',
        name: 'Drum Only',
        description: 'Rekaman drum khusus (isi tarif untuk mengaktifkan)',
        isActive: false,
        sortOrder: 4,
        pricing: {
          mode: PRICING_MODES.UNCONFIGURED,
          hourlyRate: null,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'rec-others',
        name: 'Others',
        description: 'Recording khusus / custom instrumen dengan input harga dan fee manual',
        isActive: true,
        sortOrder: 5,
        pricing: {
          mode: PRICING_MODES.MANUAL_QUOTE,
          hourlyRate: null,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.MANUAL, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.MANUAL, amount: 0 },
        },
      },
      {
        id: 'tracking-regular',
        name: 'Tracking Reguler',
        description: 'Tarif per jam mengikuti durasi sesi (Rp 150.000/jam)',
        isActive: true,
        sortOrder: 6,
        pricing: {
          mode: PRICING_MODES.HOURLY,
          hourlyRate: 150000,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
      {
        id: 'multitrack-shift-6h',
        name: 'Multitrack Shift',
        description: 'Shift rekaman 6 jam penuh (Rp 800.000)',
        isActive: true,
        sortOrder: 7,
        pricing: {
          mode: PRICING_MODES.FIXED_SHIFT,
          hourlyRate: null,
          durationMinutes: 360,
          basePrice: 800000,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
    ],
  },
  {
    id: 'mixing',
    name: 'Mixing',
    description: 'Layanan mixing lagu / project audio (Work From Anywhere)',
    deliveryMode: DELIVERY_MODES.WFA,
    isActive: true,
    sortOrder: 3,
    options: [
      {
        id: 'mixing-regular',
        name: 'Mixing Reguler',
        description: 'Mixing audio multi-track (Rp 250.000/jam)',
        isActive: true,
        sortOrder: 1,
        pricing: {
          mode: PRICING_MODES.HOURLY,
          hourlyRate: 250000,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
    ],
  },
  {
    id: 'mastering',
    name: 'Mastering',
    description: 'Layanan final mastering siap rilis (Work From Anywhere)',
    deliveryMode: DELIVERY_MODES.WFA,
    isActive: true,
    sortOrder: 4,
    options: [
      {
        id: 'mastering-regular',
        name: 'Mastering Reguler',
        description: 'Final mastering siap rilis (Rp 300.000/jam)',
        isActive: true,
        sortOrder: 1,
        pricing: {
          mode: PRICING_MODES.HOURLY,
          hourlyRate: 300000,
          durationMinutes: null,
          basePrice: null,
          discountAmount: 0,
          projectPrice: null,
          unitLabel: '',
        },
        discountRules: [],
        fees: {
          staff: { mode: FEE_MODES.NONE, amount: 0 },
          owner: { mode: FEE_MODES.NONE, amount: 0 },
          recordingOperator: { mode: FEE_MODES.NONE, amount: 0 },
        },
      },
    ],
  },
];

export const DEFAULT_PRICING_SETTINGS = {
  schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
  serviceTypes: DEFAULT_SERVICE_TYPES,
  operationalSettings: { ...DEFAULT_OPERATIONAL_SETTINGS },
  version: 0,
  updatedAt: null,
  updatedByUid: '',
};
