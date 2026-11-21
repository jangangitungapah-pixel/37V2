import {
  DEFAULT_EMPTY_FEES,
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  calculateBookingCommissionSnapshotV2,
  formatRupiah,
  parseMoneyInput,
  selectBestOptionDiscountRule,
} from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';
import {
  findServiceOptionById,
  findServiceTypeById,
  normalizePricingSettings,
  toNonNegativeInt,
} from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import { INITIAL_PAYMENT_STATUS, SLOT_INTERVAL_MINUTES } from '../config/calendar-config';

export { formatRupiah, parseMoneyInput };

/**
 * Resolves the active `(serviceType, option)` pair from Schema V2 `pricingSettings`
 * using either V2 identifiers (`serviceTypeId` / `serviceOptionId`) or legacy V1
 * identifiers (`serviceId` / `packageId` / `recordingTypeId`).
 */
export function resolveServiceAndOption({
  serviceTypeId = '',
  serviceOptionId = '',
  serviceId = '',
  packageId = '',
  recordingTypeId = '',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
} = {}) {
  const normalizedSettings = normalizePricingSettings(pricingSettings);
  const serviceTypes = normalizedSettings.serviceTypes || [];

  // 1. Direct option lookup (V2 optionId or legacy packageId / recordingTypeId)
  const directOptionId = String(serviceOptionId || packageId || recordingTypeId || '').trim();
  if (directOptionId) {
    const found = findServiceOptionById(normalizedSettings, directOptionId);
    if (found) {
      return {
        normalizedSettings,
        serviceType: found.serviceType,
        option: found.option,
      };
    }
  }

  // 2. Service type lookup + default option selection
  const targetServiceId = String(serviceTypeId || serviceId || 'rehearsal').trim();
  const serviceType =
    findServiceTypeById(normalizedSettings, targetServiceId) ||
    serviceTypes.find(
      (svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO && svc.isActive !== false,
    ) ||
    serviceTypes[0] ||
    null;

  if (!serviceType) {
    return { normalizedSettings, serviceType: null, option: null };
  }

  const options = serviceType.options || [];
  const defaultOption =
    options.find((opt) => opt.isActive !== false && opt.pricing?.mode === PRICING_MODES.HOURLY) ||
    options.find(
      (opt) => opt.isActive !== false && opt.pricing?.mode !== PRICING_MODES.UNCONFIGURED,
    ) ||
    options[0] ||
    null;

  return {
    normalizedSettings,
    serviceType,
    option: defaultOption,
  };
}

/**
 * Extracts canonical financial figures directly from a persisted booking record's snapshot
 * so Booking Detail Drawer and Owner Finance / Pembukuan always consume the exact same
 * historical subtotal, automatic discount, and final total without recalculating live rates.
 */
export function extractBookingFinancialSnapshot(booking = null) {
  if (!booking || typeof booking !== 'object') {
    return {
      subtotal: 0,
      discountAmount: 0,
      automaticDiscount: null,
      totalAmount: 0,
      finalPrice: 0,
      initialPaidAmount: 0,
      remainingBalance: 0,
    };
  }

  const subtotal = toNonNegativeInt(booking.subtotal, 0);
  const discountAmount = Math.min(subtotal, toNonNegativeInt(booking.discountAmount, 0));
  const totalAmount = toNonNegativeInt(booking.totalAmount, 0);
  const initialPaidAmount = toNonNegativeInt(booking.initialPaidAmount, 0);

  return {
    subtotal,
    discountAmount,
    automaticDiscount: booking.automaticDiscount ?? null,
    totalAmount,
    finalPrice: totalAmount,
    initialPaidAmount,
    remainingBalance: Math.max(0, totalAmount - initialPaidAmount),
  };
}

/**
 * Normalizes display values for BOTH legacy V1 `commissionSnapshot` and Schema V2
 * `commissionSnapshot` (Staff, Owner, Recording Operator) so UI never crashes on old bookings.
 */
export function getCommissionSnapshotDisplay(commissionSnapshot = null) {
  if (!commissionSnapshot || typeof commissionSnapshot !== 'object') {
    return null;
  }

  if (
    commissionSnapshot.schemaVersion === 2 ||
    (commissionSnapshot.staff && typeof commissionSnapshot.staff === 'object')
  ) {
    return {
      schemaVersion: 2,
      settingsVersion: Math.max(1, toNonNegativeInt(commissionSnapshot.settingsVersion, 1) || 1),
      staff: {
        basis: commissionSnapshot.staff?.basis || FEE_MODES.NONE,
        rate: toNonNegativeInt(commissionSnapshot.staff?.rate, 0),
        amount: toNonNegativeInt(commissionSnapshot.staff?.amount, 0),
      },
      owner: {
        basis: commissionSnapshot.owner?.basis || FEE_MODES.NONE,
        rate: toNonNegativeInt(commissionSnapshot.owner?.rate, 0),
        amount: toNonNegativeInt(commissionSnapshot.owner?.amount, 0),
      },
      recordingOperator: {
        basis: commissionSnapshot.recordingOperator?.basis || FEE_MODES.NONE,
        rate: toNonNegativeInt(commissionSnapshot.recordingOperator?.rate, 0),
        amount: toNonNegativeInt(commissionSnapshot.recordingOperator?.amount, 0),
      },
    };
  }

  // Legacy V1 shape
  return {
    schemaVersion: 1,
    settingsVersion: Math.max(1, toNonNegativeInt(commissionSnapshot.settingsVersion, 1) || 1),
    staff: {
      basis: commissionSnapshot.staffBasis || FEE_MODES.NONE,
      rate: toNonNegativeInt(commissionSnapshot.staffRate, 0),
      amount: toNonNegativeInt(commissionSnapshot.staffAmount, 0),
    },
    owner: null,
    recordingOperator: {
      basis: toNonNegativeInt(commissionSnapshot.recordingOperatorAmount, 0) > 0 ? 'fixed' : 'none',
      rate: toNonNegativeInt(commissionSnapshot.recordingOperatorAmount, 0),
      amount: toNonNegativeInt(commissionSnapshot.recordingOperatorAmount, 0),
    },
  };
}

/**
 * Calculates the canonical pricing & internal fee snapshot (Schema V2) for a booking based on
 * live Firestore `pricingSettings` (`settings/pricing`), selected Service Type, Subcategory,
 * duration, manual quote inputs (if applicable), and initial payment status.
 */
export function calculateBookingPricingSnapshot({
  serviceTypeId = '',
  serviceOptionId = '',
  serviceId = 'rehearsal',
  packageId = '',
  recordingTypeId = '',
  durationMinutes = 60,
  estimatedWorkMinutes = null,
  manualCustomerPrice = 0,
  manualStaffFee = 0,
  manualOwnerFee = 0,
  manualRecordingOperatorFee = 0,
  initialPaymentStatus = INITIAL_PAYMENT_STATUS.UNPAID,
  dpAmount = 0,
  paymentMethod = 'cash',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
} = {}) {
  const { normalizedSettings, serviceType, option } = resolveServiceAndOption({
    serviceTypeId,
    serviceOptionId,
    serviceId,
    packageId,
    recordingTypeId,
    pricingSettings,
  });

  const settingsVersion = Math.max(1, Number(normalizedSettings.version) || 1);
  const resolvedServiceTypeId =
    serviceType?.id || String(serviceTypeId || serviceId || 'rehearsal');
  const resolvedServiceTypeName = serviceType?.name || resolvedServiceTypeId;
  const deliveryMode = serviceType?.deliveryMode || DELIVERY_MODES.STUDIO;
  const resolvedOptionId = option?.id || '';
  const resolvedOptionName = option?.name || '';
  const pricing = option?.pricing || { mode: PRICING_MODES.UNCONFIGURED };
  const pricingMode = pricing.mode || PRICING_MODES.UNCONFIGURED;

  let resolvedDurationMinutes = Math.max(
    SLOT_INTERVAL_MINUTES,
    Math.round(Number(durationMinutes) || 60),
  );
  let unitRate = 0;
  let subtotal = 0;
  let discountAmount = 0;
  let appliedDiscountName = '';
  let automaticDiscount = null;
  let durationDiscountConfig = null;

  if (pricingMode === PRICING_MODES.FIXED_SHIFT) {
    if (Number(pricing.durationMinutes) > 0) {
      resolvedDurationMinutes = Number(pricing.durationMinutes);
    }
    subtotal = toNonNegativeInt(pricing.basePrice, 0);
    // Fixed Shift uses ONLY its own configured discount (never stacks regular discount rules)
    discountAmount = Math.min(subtotal, toNonNegativeInt(pricing.discountAmount, 0));
    unitRate =
      resolvedDurationMinutes > 0
        ? Math.round((subtotal * 60) / resolvedDurationMinutes)
        : subtotal;
    appliedDiscountName = discountAmount > 0 ? 'Diskon Paket' : '';
  } else if (pricingMode === PRICING_MODES.HOURLY) {
    unitRate = toNonNegativeInt(pricing.hourlyRate, 0);
    // Exact 30-minute proportion without rounding up 2.5h -> 3h
    subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);

    const discountRules = Array.isArray(option?.discountRules) ? option.discountRules : [];
    const activeBlockRule = discountRules.find(
      (rule) =>
        rule &&
        rule.isActive === true &&
        rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK &&
        rule.intervalMinutes > 0 &&
        rule.discountAmount > 0,
    );
    if (activeBlockRule) {
      durationDiscountConfig = {
        enabled: true,
        intervalMinutes: activeBlockRule.intervalMinutes,
        discountAmount: activeBlockRule.discountAmount,
      };
    }

    const bestDiscount = selectBestOptionDiscountRule({
      discountRules,
      durationMinutes: resolvedDurationMinutes,
      subtotal,
    });
    discountAmount = bestDiscount.discountAmount;
    appliedDiscountName = bestDiscount.appliedDiscountName;
    automaticDiscount = bestDiscount.automaticDiscount;
  } else if (pricingMode === PRICING_MODES.FIXED_PROJECT) {
    subtotal = toNonNegativeInt(pricing.projectPrice, 0);
    unitRate = subtotal;
    discountAmount = 0;
    appliedDiscountName = '';
  } else if (pricingMode === PRICING_MODES.MANUAL_QUOTE) {
    subtotal = parseMoneyInput(manualCustomerPrice);
    unitRate =
      resolvedDurationMinutes > 0
        ? Math.round((subtotal * 60) / resolvedDurationMinutes)
        : subtotal;
    discountAmount = 0;
    appliedDiscountName = '';
  }

  // Customer total NEVER includes internal staff, owner, recording operator fees, or meal allowance
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const normalizedStatus = Object.values(INITIAL_PAYMENT_STATUS).includes(initialPaymentStatus)
    ? initialPaymentStatus
    : INITIAL_PAYMENT_STATUS.UNPAID;

  const parsedDp = parseMoneyInput(dpAmount);

  let initialPaidAmount;
  let normalizedPaymentMethod;

  if (normalizedStatus === INITIAL_PAYMENT_STATUS.PAID) {
    initialPaidAmount = totalAmount;
    normalizedPaymentMethod =
      String(paymentMethod || 'cash')
        .trim()
        .toLowerCase() || 'cash';
  } else if (normalizedStatus === INITIAL_PAYMENT_STATUS.PARTIAL) {
    initialPaidAmount = Math.min(totalAmount, Math.max(0, parsedDp));
    normalizedPaymentMethod =
      String(paymentMethod || 'cash')
        .trim()
        .toLowerCase() || 'cash';
  } else {
    initialPaidAmount = 0;
    normalizedPaymentMethod = '';
  }

  const remainingBalance = Math.max(0, totalAmount - initialPaidAmount);

  const optionFees = option?.fees || DEFAULT_EMPTY_FEES;
  const commissionSnapshot = calculateBookingCommissionSnapshotV2({
    fees: optionFees,
    deliveryMode,
    durationMinutes: resolvedDurationMinutes,
    estimatedWorkMinutes,
    manualFees: {
      staff: manualStaffFee,
      owner: manualOwnerFee,
      recordingOperator: manualRecordingOperatorFee,
    },
    settingsVersion,
  });

  // Legacy-compatible identifiers for existing timeline/card views
  const isLegacyPackage =
    pricingMode === PRICING_MODES.FIXED_SHIFT && resolvedServiceTypeId !== 'recording';
  const legacyPackageId = isLegacyPackage ? resolvedOptionId : '';
  const legacyPackageLabel = isLegacyPackage ? resolvedOptionName : '';
  const legacyRecordingTypeId = resolvedServiceTypeId === 'recording' ? resolvedOptionId : '';
  const legacyRecordingTypeLabel = resolvedServiceTypeId === 'recording' ? resolvedOptionName : '';

  return {
    // V2 hierarchical identifiers
    serviceTypeId: resolvedServiceTypeId,
    serviceTypeName: resolvedServiceTypeName,
    serviceOptionId: resolvedOptionId,
    serviceOptionName: resolvedOptionName,
    deliveryMode,
    pricingMode,
    pricingSettingsVersion: settingsVersion,
    // Legacy-compatible identifiers
    serviceId: resolvedServiceTypeId,
    serviceLabel: resolvedServiceTypeName,
    packageId: legacyPackageId,
    packageLabel: legacyPackageLabel,
    recordingTypeId: legacyRecordingTypeId,
    recordingTypeLabel: legacyRecordingTypeLabel,
    // Pricing & payment breakdown
    durationMinutes: resolvedDurationMinutes,
    unitRate,
    subtotal,
    discountAmount,
    appliedDiscountName,
    automaticDiscount,
    durationDiscountConfig,
    totalAmount,
    initialPaymentStatus: normalizedStatus,
    initialPaidAmount,
    remainingBalance,
    paymentMethod: normalizedPaymentMethod,
    // Internal fee snapshot V2 & config metadata
    commissionSnapshot,
    optionFeesConfig: optionFees,
  };
}
