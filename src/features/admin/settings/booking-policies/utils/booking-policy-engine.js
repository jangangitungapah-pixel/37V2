/**
 * Runtime Booking Policy Resolution Engine (OD-01, OD-02, OD-03, OD-04, OD-07)
 * for 37 Music Studio (Phase 2).
 *
 * All money values are safe integer IDR.
 * All business dates and hold deadlines operate strictly in Asia/Jakarta (WIB, UTC+7).
 */

import {
  formatIndonesianTimestamp,
  getJakartaDateTimeParts,
  getJakartaSlotEpochMs,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  DEFAULT_BOOKING_POLICIES,
  DEPOSIT_CALCULATION_BASES,
  DEPOSIT_POLICY_TYPES,
} from '../config/booking-policies-config';
import {
  normalizeBookingPolicies,
  resolveBookingPolicyForService,
} from './booking-policies-normalize';

export const DEPOSIT_STATUS = Object.freeze({
  NOT_REQUIRED: 'not_required',
  AWAITING_DEPOSIT: 'awaiting_deposit',
  PARTIAL_BELOW_MINIMUM: 'partial_below_minimum',
  MET: 'met',
});

export function createBookingPolicyEngineError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

function toSafeNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.max(0, fallback);
  return Math.round(numeric);
}

/**
 * Resolves exact precedence tier ('option_override' | 'service_override' | 'default')
 * for a given policy section key (`depositPolicy` | `holdPolicy` | `balanceDuePolicy`).
 */
export function resolvePolicySourceTier(policiesInput, serviceTypeId, serviceOptionId = '', section = 'depositPolicy') {
  const policies = normalizeBookingPolicies(policiesInput);
  const serviceKey = String(serviceTypeId || '').trim();
  const optionKey = String(serviceOptionId || '').trim();
  if (optionKey && policies.optionOverrides?.[optionKey]?.[section]) {
    return 'option_override';
  }
  if (serviceKey && policies.serviceOverrides?.[serviceKey]?.[section]) {
    return 'service_override';
  }
  return 'default';
}

/**
 * Computes exact minimum deposit in integer IDR from a deposit policy and financial base.
 */
export function computeMinimumDepositAmount({
  totalAmount = 0,
  subtotal = totalAmount,
  depositPolicy = DEFAULT_BOOKING_POLICIES.defaultDepositPolicy,
} = {}) {
  const safeTotal = toSafeNonNegativeInt(totalAmount, 0);
  const safeSubtotal = Math.max(safeTotal, toSafeNonNegativeInt(subtotal, safeTotal));
  const type = DEPOSIT_POLICY_TYPES.includes(depositPolicy?.type) ? depositPolicy.type : 'none';

  if (type === 'none') return 0;

  if (type === 'fixed') {
    const fixed = toSafeNonNegativeInt(depositPolicy?.fixedAmount, 0);
    return Math.min(safeTotal, fixed);
  }

  const calculationBase = DEPOSIT_CALCULATION_BASES.includes(depositPolicy?.calculationBase)
    ? depositPolicy.calculationBase
    : 'total_amount';
  const baseAmount = calculationBase === 'subtotal' ? safeSubtotal : safeTotal;
  const pct = Math.max(0, Math.min(100, Math.round(Number(depositPolicy?.percentage) || 0)));
  if (pct <= 0 || baseAmount <= 0) return 0;

  const computed = Math.round((baseAmount * pct) / 100);
  return Math.min(safeTotal, Math.max(0, computed));
}

/**
 * Computes the persisted `depositStatus` enum from frozen minimum deposit requirement
 * and cumulative verified net `amountPaid`.
 * Unverified pending evidence MUST NOT be included in `amountPaid`.
 */
export function computeDepositStatus({
  depositType = 'none',
  minimumDepositAmount = 0,
  amountPaid = 0,
} = {}) {
  const cleanType = String(depositType || 'none').trim();
  const minDeposit = toSafeNonNegativeInt(minimumDepositAmount, 0);
  const safePaid = toSafeNonNegativeInt(amountPaid, 0);

  if (cleanType === 'none' || minDeposit <= 0) {
    return DEPOSIT_STATUS.NOT_REQUIRED;
  }
  if (safePaid >= minDeposit) {
    return DEPOSIT_STATUS.MET;
  }
  if (safePaid > 0) {
    return DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM;
  }
  return DEPOSIT_STATUS.AWAITING_DEPOSIT;
}

/**
 * Builds the immutable `depositPolicySnapshot` stored on Offers, Bookings, and Invoices.
 */
export function buildDepositPolicySnapshot({
  policies = null,
  serviceTypeId = '',
  serviceOptionId = '',
  customDepositPolicy = null,
  totalAmount = 0,
  subtotal = totalAmount,
} = {}) {
  const normalizedPolicies = normalizeBookingPolicies(policies || DEFAULT_BOOKING_POLICIES);
  const resolved = resolveBookingPolicyForService(normalizedPolicies, serviceTypeId, serviceOptionId);

  let effectivePolicy = resolved.depositPolicy;
  let policySource = resolvePolicySourceTier(
    normalizedPolicies,
    serviceTypeId,
    serviceOptionId,
    'depositPolicy',
  );

  if (customDepositPolicy && typeof customDepositPolicy === 'object') {
    const customType = DEPOSIT_POLICY_TYPES.includes(customDepositPolicy.type)
      ? customDepositPolicy.type
      : effectivePolicy.type;
    effectivePolicy = {
      type: customType,
      fixedAmount:
        customType === 'fixed'
          ? toSafeNonNegativeInt(customDepositPolicy.fixedAmount, 0)
          : 0,
      percentage:
        customType === 'percentage'
          ? Math.max(0, Math.min(100, Math.round(Number(customDepositPolicy.percentage) || 0)))
          : 0,
      calculationBase: DEPOSIT_CALCULATION_BASES.includes(customDepositPolicy.calculationBase)
        ? customDepositPolicy.calculationBase
        : 'total_amount',
    };
    policySource = 'custom_offer';
  }

  const minimumDepositAmount = computeMinimumDepositAmount({
    totalAmount,
    subtotal,
    depositPolicy: effectivePolicy,
  });

  return {
    type: effectivePolicy.type,
    fixedAmount: effectivePolicy.type === 'fixed' ? toSafeNonNegativeInt(effectivePolicy.fixedAmount, 0) : 0,
    percentage: effectivePolicy.type === 'percentage' ? Math.max(0, Math.min(100, Math.round(Number(effectivePolicy.percentage) || 0))) : 0,
    minimumDepositAmount,
    calculationBase: effectivePolicy.calculationBase || 'total_amount',
    policySource,
    policyVersion: normalizedPolicies.version,
  };
}

function toEpochMs(value) {
  if (!value) return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && Number.isFinite(Number(value.seconds))) {
    return Number(value.seconds) * 1000 + Math.round((Number(value.nanoseconds) || 0) / 1e6);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return parsed.getTime();
  }
  return Number.NaN;
}

/**
 * Resolves the effective `holdExpiresAt` deadline (OD-02) clamped strictly before
 * the scheduled session start safety cutoff in `Asia/Jakarta`.
 *
 * FAIL-CLOSED RULE:
 * If `holdPolicy.defaultHours == null` and no permitted Staff/Owner override is supplied,
 * this throws `hold/ttl-not-configured` and NEVER invents a fallback TTL.
 */
export function resolveEffectiveHoldDeadline({
  policies = null,
  serviceTypeId = '',
  serviceOptionId = '',
  bookingDate = '',
  startMinute = null,
  baseDate = new Date(),
  overrideHoldHours = null,
  overrideHoldExpiresAt = null,
  overrideReason = '',
} = {}) {
  if (!isValidIsoDateString(String(bookingDate || '').trim()) || !Number.isInteger(Number(startMinute))) {
    throw createBookingPolicyEngineError(
      'hold/invalid-session-schedule',
      'Tanggal dan jam mulai sesi harus valid sebelum menghitung batas waktu deposit hold.',
    );
  }

  const baseMs = toEpochMs(baseDate);
  if (!Number.isFinite(baseMs)) {
    throw createBookingPolicyEngineError('hold/invalid-base-time', 'Waktu acuan hold tidak valid.');
  }

  const normalizedPolicies = normalizeBookingPolicies(policies || DEFAULT_BOOKING_POLICIES);
  const resolved = resolveBookingPolicyForService(normalizedPolicies, serviceTypeId, serviceOptionId);
  const holdPolicy = resolved.holdPolicy || normalizedPolicies.defaultHoldPolicy;
  const policySource = resolvePolicySourceTier(
    normalizedPolicies,
    serviceTypeId,
    serviceOptionId,
    'holdPolicy',
  );

  const hasExplicitHoursOverride =
    overrideHoldHours !== null && overrideHoldHours !== undefined && overrideHoldHours !== '';
  const hasExplicitTimestampOverride =
    overrideHoldExpiresAt !== null && overrideHoldExpiresAt !== undefined && overrideHoldExpiresAt !== '';
  const isOverride = hasExplicitHoursOverride || hasExplicitTimestampOverride;
  const cleanOverrideReason = String(overrideReason || '').trim();

  if (isOverride) {
    if (!holdPolicy.allowPerBookingOverride) {
      throw createBookingPolicyEngineError(
        'hold/override-not-permitted',
        'Kebijakan Booking Policies saat ini tidak mengizinkan override durasi hold per booking.',
      );
    }
    if (cleanOverrideReason.length < 3) {
      throw createBookingPolicyEngineError(
        'hold/override-reason-required',
        'Alasan override durasi hold wajib diisi minimal 3 karakter.',
      );
    }
  } else if (
    !Number.isInteger(holdPolicy?.defaultHours) ||
    holdPolicy.defaultHours < 1
  ) {
    throw createBookingPolicyEngineError(
      'hold/ttl-not-configured',
      'Durasi hold (TTL) pada Booking Policies belum dikonfigurasi. Owner harus mengatur Default Hold TTL atau Staff menyertakan override dengan alasan.',
    );
  }

  const sessionStartMs = getJakartaSlotEpochMs(String(bookingDate).trim(), Number(startMinute));
  if (!Number.isFinite(sessionStartMs)) {
    throw createBookingPolicyEngineError(
      'hold/invalid-session-schedule',
      'Waktu mulai sesi di zona Asia/Jakarta tidak valid.',
    );
  }

  const minMinutesBeforeStart = Math.max(0, Math.min(1440, Number(holdPolicy?.minMinutesBeforeSessionStart) || 0));
  const cutoffMs = sessionStartMs - minMinutesBeforeStart * 60_000;

  if (cutoffMs <= baseMs) {
    throw createBookingPolicyEngineError(
      'hold/session-inside-cutoff',
      `Waktu sesi sudah terlalu dekat atau telah melewati batas aman ${minMinutesBeforeStart} menit sebelum sesi dimulai (${formatIndonesianTimestamp(new Date(cutoffMs))}). Hold tidak dapat dibuat.`,
    );
  }

  let rawDeadlineMs;
  let ttlHours = holdPolicy?.defaultHours ?? null;

  if (hasExplicitTimestampOverride) {
    rawDeadlineMs = toEpochMs(overrideHoldExpiresAt);
    if (!Number.isFinite(rawDeadlineMs) || rawDeadlineMs <= baseMs) {
      throw createBookingPolicyEngineError(
        'hold/invalid-override-deadline',
        'Batas waktu override hold harus berada di masa depan dalam zona waktu WIB.',
      );
    }
    ttlHours = Math.max(1, Math.round((rawDeadlineMs - baseMs) / 3_600_000));
  } else {
    if (hasExplicitHoursOverride) {
      const parsedHours = Number(overrideHoldHours);
      if (!Number.isInteger(parsedHours) || parsedHours < 1 || parsedHours > 168) {
        throw createBookingPolicyEngineError(
          'hold/invalid-ttl-hours',
          'Durasi override hold harus bilangan bulat antara 1 hingga 168 jam.',
        );
      }
      ttlHours = parsedHours;
    }
    rawDeadlineMs = baseMs + ttlHours * 3_600_000;
  }

  const clampedDeadlineMs = Math.min(rawDeadlineMs, cutoffMs);
  if (clampedDeadlineMs <= baseMs) {
    throw createBookingPolicyEngineError(
      'hold/window-already-elapsed',
      'Batas waktu hold efektif jatuh di masa lalu setelah disesuaikan batas sebelum sesi dimulai.',
    );
  }

  const clampedDate = new Date(clampedDeadlineMs);
  return {
    holdExpiresAtDate: clampedDate,
    holdExpiresAtIso: clampedDate.toISOString(),
    rawDeadlineDate: new Date(rawDeadlineMs),
    cutoffDate: new Date(cutoffMs),
    wasClamped: clampedDeadlineMs < rawDeadlineMs,
    isOverride,
    overrideReason: isOverride ? cleanOverrideReason : '',
    ttlHours,
    minMinutesBeforeSessionStart: minMinutesBeforeStart,
    policyVersion: normalizedPolicies.version,
    policySource: isOverride ? 'staff_override' : policySource,
  };
}

/**
 * Resolves `balanceDuePolicy` snapshot and deterministic Asia/Jakarta `dueDate` (`YYYY-MM-DD` | null) (OD-03).
 */
export function resolveBalanceDuePolicySnapshot({
  policies = null,
  serviceTypeId = '',
  serviceOptionId = '',
  bookingDate = '',
  startMinute = null,
  overrideDueDate = null,
} = {}) {
  const normalizedPolicies = normalizeBookingPolicies(policies || DEFAULT_BOOKING_POLICIES);
  const resolved = resolveBookingPolicyForService(normalizedPolicies, serviceTypeId, serviceOptionId);
  const balanceDuePolicy = resolved.balanceDuePolicy || normalizedPolicies.defaultBalanceDuePolicy;
  const trigger = balanceDuePolicy.trigger || 'before_session';
  const offsetHoursBeforeStart = Math.max(0, Math.min(168, Number(balanceDuePolicy.offsetHoursBeforeStart) || 0));

  let computedDueDate = null;
  if (overrideDueDate && isValidIsoDateString(String(overrideDueDate).trim())) {
    computedDueDate = String(overrideDueDate).trim();
  } else if (isValidIsoDateString(String(bookingDate || '').trim())) {
    if (trigger === 'at_check_in') {
      computedDueDate = String(bookingDate).trim();
    } else if (trigger === 'before_session' && Number.isInteger(Number(startMinute))) {
      const startMs = getJakartaSlotEpochMs(String(bookingDate).trim(), Number(startMinute));
      if (Number.isFinite(startMs)) {
        const dueMs = startMs - offsetHoursBeforeStart * 3_600_000;
        computedDueDate = getJakartaDateTimeParts(new Date(dueMs)).dateIso;
      } else {
        computedDueDate = String(bookingDate).trim();
      }
    }
  }

  return {
    trigger,
    offsetHoursBeforeStart,
    dueDate: computedDueDate,
    policySource: resolvePolicySourceTier(
      normalizedPolicies,
      serviceTypeId,
      serviceOptionId,
      'balanceDuePolicy',
    ),
    policyVersion: normalizedPolicies.version,
  };
}
