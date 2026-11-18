import {
  DEFAULT_OPERATIONAL_FEES,
  DEFAULT_PRICING_SETTINGS,
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
 * Calculates the final price of a studio package while guaranteeing the discount
 * never exceeds `basePrice` and the final price is never negative.
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
 * Selects the single highest active discount preset matching a regular (non-package)
 * booking's `sessionTypeId` and `durationMinutes`.
 *
 * Rules:
 * - Only active discounts (`isActive === true`) are eligible.
 * - Matches exact `sessionTypeId` and requires `durationMinutes >= minimumDurationMinutes`.
 * - Picks the single preset with the highest `discountAmount` (discounts never stack).
 * - Capped so applied discount never exceeds `subtotal`.
 */
export function selectBestSessionDiscount({
  discounts = [],
  sessionTypeId = '',
  durationMinutes = 0,
  subtotal = 0,
} = {}) {
  const safeDuration = toNonNegativeInt(durationMinutes, 0);
  const safeSubtotal = toNonNegativeInt(subtotal, 0);
  const cleanSessionId = String(sessionTypeId || '').trim();

  if (!cleanSessionId || safeDuration <= 0 || safeSubtotal <= 0 || !Array.isArray(discounts)) {
    return {
      discountPreset: null,
      discountId: '',
      discountName: '',
      discountAmount: 0,
    };
  }

  let bestPreset = null;
  let bestAmount = -1;

  for (const preset of discounts) {
    if (!preset || preset.isActive !== true) continue;
    if (String(preset.sessionTypeId || '').trim() !== cleanSessionId) continue;

    const minDuration = toNonNegativeInt(preset.minimumDurationMinutes, 0);
    if (safeDuration < minDuration) continue;

    const candidateAmount = toNonNegativeInt(preset.discountAmount, 0);
    if (candidateAmount <= 0) continue;

    if (candidateAmount > bestAmount) {
      bestAmount = candidateAmount;
      bestPreset = preset;
    }
  }

  if (!bestPreset) {
    return {
      discountPreset: null,
      discountId: '',
      discountName: '',
      discountAmount: 0,
    };
  }

  return {
    discountPreset: bestPreset,
    discountId: bestPreset.id,
    discountName: bestPreset.name,
    discountAmount: Math.min(safeSubtotal, Math.max(0, bestAmount)),
  };
}

/**
 * Computes the internal staff & recording operator commission snapshot for a booking.
 *
 * Rules:
 * - Package booking: uses package `staffCommissionAmount` & `recordingOperatorCommissionAmount`
 *   and `staffBasis: 'package'`. Never double-counts rehearsal hourly commission.
 * - Regular Rehearsal (without package): uses `fees.rehearsalStaffCommissionPerHour * durationHours`
 *   and `staffBasis: 'rehearsal_hourly'`. Recording operator commission = 0.
 * - Regular non-Rehearsal (without package): `staffBasis: 'none'`, all internal booking commissions = 0.
 * - `dailyMealAllowancePerStaff` is NEVER included in booking calculations.
 * - Internal commissions NEVER affect customer `totalAmount`.
 */
export function calculateBookingCommissionSnapshot({
  hasPackage = false,
  pkg = null,
  serviceId = 'rehearsal',
  durationMinutes = 60,
  fees = DEFAULT_OPERATIONAL_FEES,
  settingsVersion = DEFAULT_PRICING_SETTINGS.version,
} = {}) {
  const safeDurationMinutes = Math.max(0, Number(durationMinutes) || 0);
  const safeVersion = Math.max(1, toNonNegativeInt(settingsVersion, 1) || 1);
  const safeFees = fees || DEFAULT_OPERATIONAL_FEES;

  if (hasPackage && pkg) {
    const packageStaffFee = toNonNegativeInt(pkg.staffCommissionAmount, 0);
    const packageOperatorFee = toNonNegativeInt(pkg.recordingOperatorCommissionAmount, 0);
    return {
      staffBasis: 'package',
      staffRate: packageStaffFee,
      staffAmount: packageStaffFee,
      recordingOperatorAmount: packageOperatorFee,
      settingsVersion: safeVersion,
    };
  }

  if (String(serviceId || '').trim() === 'rehearsal') {
    const hourlyRate = toNonNegativeInt(safeFees.rehearsalStaffCommissionPerHour, 0);
    const staffAmount = Math.max(0, Math.round((hourlyRate * safeDurationMinutes) / 60));
    return {
      staffBasis: 'rehearsal_hourly',
      staffRate: hourlyRate,
      staffAmount,
      recordingOperatorAmount: 0,
      settingsVersion: safeVersion,
    };
  }

  return {
    staffBasis: 'none',
    staffRate: 0,
    staffAmount: 0,
    recordingOperatorAmount: 0,
    settingsVersion: safeVersion,
  };
}
