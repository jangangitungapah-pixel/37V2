import {
  DEFAULT_EMPTY_FEES,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  DURATION_DISCOUNT_TYPE,
  FEE_MODES,
  PRICING_MODES,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '../config/default-pricing-settings';
import { toNonNegativeInt } from './normalize-pricing-settings';

/**
 * Formats a numeric value in Indonesian Rupiah (`Rp 100.000`).
 */
export function formatRupiah(value) {
  const safeNumber = Math.max(0, Math.round(Number(value) || 0));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safeNumber);
}

/**
 * Parses a numeric/string Rupiah input into a non-negative integer.
 */
export function parseMoneyInput(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

/**
 * Calculates the final price of a fixed-shift / studio package option while guaranteeing
 * the discount never exceeds `basePrice` and the final price is never negative.
 */
export function calculatePackageFinalPrice(basePrice = 0, discountAmount = 0) {
  const safeBasePrice = toNonNegativeInt(basePrice, 0);
  const cappedDiscount = Math.min(safeBasePrice, toNonNegativeInt(discountAmount, 0));
  return {
    basePrice: safeBasePrice,
    discountAmount: cappedDiscount,
    finalPrice: Math.max(0, safeBasePrice - cappedDiscount),
  };
}

/**
 * Pure domain calculator for a single per-completed-block duration automatic discount rule.
 * Preserved as an exported domain primitive for unit tests and direct calls.
 */
export function calculateDurationAutomaticDiscount({
  durationMinutes = 0,
  subtotal = 0,
  durationDiscount = null,
} = {}) {
  const safeDuration = Number(durationMinutes);
  const safeSubtotal = toNonNegativeInt(subtotal, 0);

  if (
    !durationDiscount ||
    durationDiscount.enabled !== true ||
    !Number.isInteger(safeDuration) ||
    safeDuration <= 0 ||
    safeSubtotal <= 0
  ) {
    return {
      applied: false,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  const intervalMinutes = Number(durationDiscount.intervalMinutes);
  const discountPerBlock = Number(durationDiscount.discountAmount);

  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0 ||
    !Number.isInteger(discountPerBlock) ||
    discountPerBlock <= 0
  ) {
    return {
      applied: false,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  const eligibleBlocks = Math.floor(safeDuration / intervalMinutes);
  if (eligibleBlocks <= 0) {
    return {
      applied: false,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  const rawDiscount = eligibleBlocks * discountPerBlock;
  const totalDiscount = Math.min(safeSubtotal, Math.max(0, rawDiscount));

  if (totalDiscount <= 0) {
    return {
      applied: false,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  return {
    applied: true,
    discountAmount: totalDiscount,
    appliedDiscountName: 'Diskon Durasi',
    automaticDiscount: {
      type: DURATION_DISCOUNT_TYPE,
      intervalMinutes,
      eligibleBlocks,
      discountPerBlock,
      totalDiscount,
    },
  };
}

/**
 * Evaluates all active `discountRules` on an Hourly subcategory and selects the SINGLE
 * rule producing the highest valid discount (never stacks multiple rules, caps at subtotal).
 *
 * Supports:
 * - `per_completed_block`: `floor(durationMinutes / intervalMinutes) * discountAmount`
 * - `minimum_duration`: `durationMinutes >= minimumDurationMinutes ? discountAmount : 0`
 */
export function selectBestOptionDiscountRule({
  discountRules = [],
  durationMinutes = 0,
  subtotal = 0,
} = {}) {
  const safeDuration = Number(durationMinutes);
  const safeSubtotal = toNonNegativeInt(subtotal, 0);

  if (
    !Array.isArray(discountRules) ||
    discountRules.length === 0 ||
    !Number.isInteger(safeDuration) ||
    safeDuration <= 0 ||
    safeSubtotal <= 0
  ) {
    return {
      applied: false,
      rule: null,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  let bestCandidate = null;

  for (const rule of discountRules) {
    if (!rule || rule.isActive !== true) continue;

    if (rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK) {
      const result = calculateDurationAutomaticDiscount({
        durationMinutes: safeDuration,
        subtotal: safeSubtotal,
        durationDiscount: {
          enabled: true,
          intervalMinutes: rule.intervalMinutes,
          discountAmount: rule.discountAmount,
        },
      });
      if (!result.applied || result.discountAmount <= 0) continue;

      const candidate = {
        applied: true,
        rule,
        priority: 2, // prefer per_completed_block on exact tie
        discountAmount: result.discountAmount,
        appliedDiscountName: rule.name?.trim() || 'Diskon Durasi',
        automaticDiscount: result.automaticDiscount,
      };

      if (
        !bestCandidate ||
        candidate.discountAmount > bestCandidate.discountAmount ||
        (candidate.discountAmount === bestCandidate.discountAmount &&
          candidate.priority > bestCandidate.priority)
      ) {
        bestCandidate = candidate;
      }
    } else if (rule.mode === DISCOUNT_RULE_MODES.MINIMUM_DURATION) {
      const minDur = Number(rule.minimumDurationMinutes);
      const discAmt = Number(rule.discountAmount);
      if (!Number.isInteger(minDur) || minDur <= 0 || !Number.isInteger(discAmt) || discAmt <= 0) {
        continue;
      }
      if (safeDuration < minDur) continue;

      const appliedAmount = Math.min(safeSubtotal, discAmt);
      if (appliedAmount <= 0) continue;

      const candidate = {
        applied: true,
        rule,
        priority: 1,
        discountAmount: appliedAmount,
        appliedDiscountName: rule.name?.trim() || 'Diskon Durasi',
        automaticDiscount: null,
      };

      if (
        !bestCandidate ||
        candidate.discountAmount > bestCandidate.discountAmount ||
        (candidate.discountAmount === bestCandidate.discountAmount &&
          candidate.priority > bestCandidate.priority)
      ) {
        bestCandidate = candidate;
      }
    }
  }

  if (!bestCandidate) {
    return {
      applied: false,
      rule: null,
      discountAmount: 0,
      appliedDiscountName: '',
      automaticDiscount: null,
    };
  }

  return {
    applied: true,
    rule: bestCandidate.rule,
    discountAmount: bestCandidate.discountAmount,
    appliedDiscountName: bestCandidate.appliedDiscountName,
    automaticDiscount: bestCandidate.automaticDiscount,
  };
}

/**
 * Computes a single internal fee recipient (`staff`, `owner`, or `recordingOperator`).
 *
 * Scope rules:
 * - `none`: `{ basis: 'none', rate: 0, amount: 0 }`
 * - `fixed`: `{ basis: 'fixed', rate: fixedAmount, amount: fixedAmount }`
 * - `hourly`:
 *    - Studio service uses `durationMinutes` (exact 30-min proportions, integer Rupiah).
 *    - WFA service requires explicit positive `estimatedWorkMinutes` (never assumes studio duration).
 * - `manual`: uses explicit manual input entered during booking (non-negative integer, 0 allowed).
 */
export function calculateSingleRoleFee({
  rule = { mode: FEE_MODES.NONE, amount: 0 },
  deliveryMode = DELIVERY_MODES.STUDIO,
  durationMinutes = 0,
  estimatedWorkMinutes = null,
  manualAmount = 0,
} = {}) {
  const mode = rule?.mode || FEE_MODES.NONE;

  if (mode === FEE_MODES.FIXED) {
    const fixed = toNonNegativeInt(rule.amount, 0);
    return {
      basis: FEE_MODES.FIXED,
      rate: fixed,
      amount: fixed,
    };
  }

  if (mode === FEE_MODES.HOURLY) {
    const rate = toNonNegativeInt(rule.amount, 0);
    const effectiveMinutes =
      deliveryMode === DELIVERY_MODES.WFA
        ? Number.isFinite(Number(estimatedWorkMinutes)) && Number(estimatedWorkMinutes) > 0
          ? Number(estimatedWorkMinutes)
          : 0
        : Math.max(0, Number(durationMinutes) || 0);

    const amount =
      effectiveMinutes > 0 ? Math.max(0, Math.round((rate * effectiveMinutes) / 60)) : 0;
    return {
      basis: FEE_MODES.HOURLY,
      rate,
      amount,
    };
  }

  if (mode === FEE_MODES.MANUAL) {
    const manual = parseMoneyInput(manualAmount);
    return {
      basis: FEE_MODES.MANUAL,
      rate: manual,
      amount: manual,
    };
  }

  return {
    basis: FEE_MODES.NONE,
    rate: 0,
    amount: 0,
  };
}

/**
 * Computes the Schema V2 internal commission snapshot across Staff, Owner, and Recording Operator.
 *
 * Strict separation:
 * - Internal fees NEVER affect customer `totalAmount`, DP, or remaining balance.
 * - `dailyMealAllowancePerStaff` is NEVER included in booking calculations.
 */
export function calculateBookingCommissionSnapshotV2({
  fees = DEFAULT_EMPTY_FEES,
  deliveryMode = DELIVERY_MODES.STUDIO,
  durationMinutes = 60,
  estimatedWorkMinutes = null,
  manualFees = {},
  settingsVersion = 1,
} = {}) {
  const safeFees = fees || DEFAULT_EMPTY_FEES;
  const safeVersion = Math.max(1, toNonNegativeInt(settingsVersion, 1) || 1);

  return {
    schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
    staff: calculateSingleRoleFee({
      rule: safeFees.staff,
      deliveryMode,
      durationMinutes,
      estimatedWorkMinutes,
      manualAmount: manualFees?.staff,
    }),
    owner: calculateSingleRoleFee({
      rule: safeFees.owner,
      deliveryMode,
      durationMinutes,
      estimatedWorkMinutes,
      manualAmount: manualFees?.owner,
    }),
    recordingOperator: calculateSingleRoleFee({
      rule: safeFees.recordingOperator,
      deliveryMode,
      durationMinutes,
      estimatedWorkMinutes,
      manualAmount: manualFees?.recordingOperator,
    }),
    settingsVersion: safeVersion,
  };
}

/**
 * Formats a concise human-readable tariff summary for a Service Option card in Settings.
 */
export function formatOptionPricingSummary(option) {
  const pricing = option?.pricing;
  if (!pricing || pricing.mode === PRICING_MODES.UNCONFIGURED) {
    return {
      primary: 'Belum Dikonfigurasi',
      secondary: '',
      isUnconfigured: true,
    };
  }

  if (pricing.mode === PRICING_MODES.HOURLY) {
    return {
      primary: `${formatRupiah(pricing.hourlyRate)} / Jam`,
      secondary: 'Hourly',
      isUnconfigured: false,
    };
  }

  if (pricing.mode === PRICING_MODES.FIXED_SHIFT) {
    const calc = calculatePackageFinalPrice(pricing.basePrice, pricing.discountAmount);
    return {
      primary: `${formatRupiah(calc.finalPrice)} / Shift`,
      secondary:
        calc.discountAmount > 0
          ? `Base ${formatRupiah(calc.basePrice)} - ${formatRupiah(calc.discountAmount)}`
          : 'Fixed Shift',
      isUnconfigured: false,
    };
  }

  if (pricing.mode === PRICING_MODES.FIXED_PROJECT) {
    return {
      primary: `${formatRupiah(pricing.projectPrice)}${pricing.unitLabel ? ` / ${pricing.unitLabel}` : ' / Project'}`,
      secondary: 'Fixed Project',
      isUnconfigured: false,
    };
  }

  if (pricing.mode === PRICING_MODES.MANUAL_QUOTE) {
    return {
      primary: 'Manual Quote',
      secondary: 'Input harga saat booking',
      isUnconfigured: false,
    };
  }

  return {
    primary: 'Belum Dikonfigurasi',
    secondary: '',
    isUnconfigured: true,
  };
}
