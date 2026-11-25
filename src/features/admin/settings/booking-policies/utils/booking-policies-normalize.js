import {
  BALANCE_DUE_TRIGGERS,
  BOOKING_POLICIES_SCHEMA_VERSION,
  DEFAULT_BOOKING_POLICIES,
  DEPOSIT_CALCULATION_BASES,
  DEPOSIT_POLICY_TYPES,
} from '../config/booking-policies-config';

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
};

function normalizeDepositPolicy(input = {}, fallback = DEFAULT_BOOKING_POLICIES.defaultDepositPolicy) {
  const source = isPlainObject(input) ? input : {};
  const type = DEPOSIT_POLICY_TYPES.includes(source.type) ? source.type : fallback.type;
  const calculationBase = DEPOSIT_CALCULATION_BASES.includes(source.calculationBase)
    ? source.calculationBase
    : fallback.calculationBase;
  return {
    type,
    fixedAmount: Math.max(0, toInteger(source.fixedAmount, fallback.fixedAmount)),
    percentage: Math.max(0, Math.min(100, toInteger(source.percentage, fallback.percentage))),
    calculationBase,
  };
}

function normalizeHoldPolicy(input = {}, fallback = DEFAULT_BOOKING_POLICIES.defaultHoldPolicy) {
  const source = isPlainObject(input) ? input : {};
  const defaultHours =
    source.defaultHours === null || source.defaultHours === ''
      ? null
      : Number.isSafeInteger(Number(source.defaultHours))
        ? Number(source.defaultHours)
        : fallback.defaultHours;
  return {
    defaultHours:
      defaultHours === null ? null : Math.max(1, Math.min(168, defaultHours)),
    minMinutesBeforeSessionStart: Math.max(
      0,
      Math.min(1440, toInteger(source.minMinutesBeforeSessionStart, fallback.minMinutesBeforeSessionStart)),
    ),
    allowPerBookingOverride:
      typeof source.allowPerBookingOverride === 'boolean'
        ? source.allowPerBookingOverride
        : fallback.allowPerBookingOverride,
  };
}

function normalizeBalanceDuePolicy(input = {}, fallback = DEFAULT_BOOKING_POLICIES.defaultBalanceDuePolicy) {
  const source = isPlainObject(input) ? input : {};
  return {
    trigger: BALANCE_DUE_TRIGGERS.includes(source.trigger) ? source.trigger : fallback.trigger,
    offsetHoursBeforeStart: Math.max(
      0,
      Math.min(168, toInteger(source.offsetHoursBeforeStart, fallback.offsetHoursBeforeStart)),
    ),
  };
}

function normalizeOverrideMap(input, limit = 100) {
  if (!isPlainObject(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => String(key).trim() && isPlainObject(value))
      .slice(0, limit)
      .map(([key, value]) => [
        String(key).trim(),
        {
          ...(isPlainObject(value.depositPolicy)
            ? { depositPolicy: normalizeDepositPolicy(value.depositPolicy) }
            : {}),
          ...(isPlainObject(value.holdPolicy)
            ? { holdPolicy: normalizeHoldPolicy(value.holdPolicy) }
            : {}),
          ...(isPlainObject(value.balanceDuePolicy)
            ? { balanceDuePolicy: normalizeBalanceDuePolicy(value.balanceDuePolicy) }
            : {}),
        },
      ]),
  );
}

export function normalizeBookingPolicies(raw = {}) {
  const source = isPlainObject(raw) ? raw : {};
  return {
    schemaVersion: BOOKING_POLICIES_SCHEMA_VERSION,
    defaultDepositPolicy: normalizeDepositPolicy(
      source.defaultDepositPolicy,
      DEFAULT_BOOKING_POLICIES.defaultDepositPolicy,
    ),
    defaultHoldPolicy: normalizeHoldPolicy(
      source.defaultHoldPolicy,
      DEFAULT_BOOKING_POLICIES.defaultHoldPolicy,
    ),
    defaultBalanceDuePolicy: normalizeBalanceDuePolicy(
      source.defaultBalanceDuePolicy,
      DEFAULT_BOOKING_POLICIES.defaultBalanceDuePolicy,
    ),
    serviceOverrides: normalizeOverrideMap(source.serviceOverrides, 20),
    optionOverrides: normalizeOverrideMap(source.optionOverrides, 100),
    version: Math.max(0, toInteger(source.version, 0)),
    updatedAt: source.updatedAt ?? null,
    updatedByUid: String(source.updatedByUid || ''),
  };
}

export function validateBookingPolicies(input) {
  const value = normalizeBookingPolicies(input);
  const errors = {};
  const validateDeposit = (policy, label) => {
    if (!DEPOSIT_POLICY_TYPES.includes(policy.type)) errors[label] = 'Jenis DP tidak valid.';
    if (!DEPOSIT_CALCULATION_BASES.includes(policy.calculationBase)) errors[label] = 'Basis perhitungan DP tidak valid.';
    if (policy.type === 'fixed' && policy.fixedAmount <= 0) errors[label] = 'Nominal DP tetap harus lebih dari Rp0.';
    if (policy.type === 'percentage' && (policy.percentage < 1 || policy.percentage > 100)) errors[label] = 'Persentase DP harus berada di antara 1–100%.';
  };
  validateDeposit(value.defaultDepositPolicy, 'defaultDepositPolicy');

  if (
    value.defaultHoldPolicy.defaultHours !== null &&
    (!Number.isInteger(value.defaultHoldPolicy.defaultHours) ||
      value.defaultHoldPolicy.defaultHours < 1 ||
      value.defaultHoldPolicy.defaultHours > 168)
  ) {
    errors.defaultHoldPolicy = 'Durasi hold default harus 1–168 jam atau dibiarkan belum dikonfigurasi.';
  }
  if (
    !Number.isInteger(value.defaultHoldPolicy.minMinutesBeforeSessionStart) ||
    value.defaultHoldPolicy.minMinutesBeforeSessionStart < 0 ||
    value.defaultHoldPolicy.minMinutesBeforeSessionStart > 1440
  ) {
    errors.defaultHoldPolicy = 'Minimal jarak waktu sebelum sesi harus 0–1.440 menit.';
  }
  if (!BALANCE_DUE_TRIGGERS.includes(value.defaultBalanceDuePolicy.trigger)) {
    errors.defaultBalanceDuePolicy = 'Pemicu pelunasan tidak valid.';
  }
  if (
    !Number.isInteger(value.defaultBalanceDuePolicy.offsetHoursBeforeStart) ||
    value.defaultBalanceDuePolicy.offsetHoursBeforeStart < 0 ||
    value.defaultBalanceDuePolicy.offsetHoursBeforeStart > 168
  ) {
    errors.defaultBalanceDuePolicy = 'Offset tenggat pelunasan harus 0–168 jam.';
  }
  if (Object.keys(value.serviceOverrides).length > 20) errors.serviceOverrides = 'Maksimal 20 service override.';
  if (Object.keys(value.optionOverrides).length > 100) errors.optionOverrides = 'Maksimal 100 option override.';

  for (const [key, override] of Object.entries(value.serviceOverrides)) {
    if (override.depositPolicy) validateDeposit(override.depositPolicy, `serviceOverrides.${key}.depositPolicy`);
  }
  for (const [key, override] of Object.entries(value.optionOverrides)) {
    if (override.depositPolicy) validateDeposit(override.depositPolicy, `optionOverrides.${key}.depositPolicy`);
  }

  return { isValid: Object.keys(errors).length === 0, errors, data: value };
}

export function resolveBookingPolicyForService(policiesInput, serviceTypeId, serviceOptionId = '') {
  const policies = normalizeBookingPolicies(policiesInput);
  const service = policies.serviceOverrides[String(serviceTypeId || '').trim()] || {};
  const option = policies.optionOverrides[String(serviceOptionId || '').trim()] || {};
  return {
    depositPolicy: option.depositPolicy || service.depositPolicy || policies.defaultDepositPolicy,
    holdPolicy: option.holdPolicy || service.holdPolicy || policies.defaultHoldPolicy,
    balanceDuePolicy:
      option.balanceDuePolicy || service.balanceDuePolicy || policies.defaultBalanceDuePolicy,
    isHoldTtlConfigured:
      (option.holdPolicy || service.holdPolicy || policies.defaultHoldPolicy).defaultHours !== null,
    policyVersion: policies.version,
  };
}
