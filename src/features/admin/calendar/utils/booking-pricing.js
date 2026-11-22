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
 * Finds the active hourly add-on rate within the same `serviceType`.
 * Returns `0` when no active hourly option with a positive rate exists
 * (so fixed-shift extension is never invented).
 */
export function findServiceExtensionHourlyRate(serviceType) {
  const options = Array.isArray(serviceType?.options) ? serviceType.options : [];
  const hourlyOptions = options
    .filter(
      (opt) =>
        opt &&
        opt.isActive !== false &&
        opt.pricing?.mode === PRICING_MODES.HOURLY &&
        Number(opt.pricing.hourlyRate) > 0,
    )
    .sort((a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999));

  return hourlyOptions.length > 0 ? toNonNegativeInt(hourlyOptions[0].pricing.hourlyRate, 0) : 0;
}

function resolveCatalogServiceAndOption({
  catalog,
  serviceTypeId = '',
  serviceOptionId = '',
  serviceId = '',
  packageId = '',
  recordingTypeId = '',
} = {}) {
  const serviceTypes = Array.isArray(catalog?.serviceTypes) ? catalog.serviceTypes : [];
  if (serviceTypes.length === 0) {
    return { serviceType: null, option: null };
  }

  const directOptionId = String(serviceOptionId || packageId || recordingTypeId || '').trim();
  if (directOptionId) {
    for (const svc of serviceTypes) {
      const matchedOpt = (svc.options || []).find((opt) => opt.id === directOptionId);
      if (matchedOpt) {
        return { serviceType: svc, option: matchedOpt };
      }
    }
  }

  const targetServiceId = String(serviceTypeId || serviceId || '').trim();
  if (targetServiceId) {
    const matchedService = serviceTypes.find((svc) => svc.id === targetServiceId) || null;
    if (matchedService) {
      const activeOptions = (matchedService.options || [])
        .filter((opt) => opt.pricing?.mode && opt.pricing.mode !== PRICING_MODES.UNCONFIGURED)
        .sort((a, b) => (Number(a.sortOrder) || 999) - (Number(b.sortOrder) || 999));
      return {
        serviceType: matchedService,
        option: activeOptions[0] || null,
      };
    }
  }

  return { serviceType: null, option: null };
}

function computeCustomerPricingCore({
  serviceType,
  option,
  requestedDurationMinutes = null,
  manualCustomerPrice = 0,
} = {}) {
  const pricing = option?.pricing || { mode: PRICING_MODES.UNCONFIGURED };
  const pricingMode = pricing.mode || PRICING_MODES.UNCONFIGURED;

  const hasRequestedDuration =
    requestedDurationMinutes !== null &&
    requestedDurationMinutes !== undefined &&
    requestedDurationMinutes !== '' &&
    Number.isFinite(Number(requestedDurationMinutes)) &&
    Number(requestedDurationMinutes) > 0;

  const parsedRequestedDuration = hasRequestedDuration
    ? Math.max(SLOT_INTERVAL_MINUTES, Math.round(Number(requestedDurationMinutes)))
    : 60;

  let resolvedDurationMinutes = parsedRequestedDuration;
  let baseDurationMinutes = 0;
  let extensionHourlyRate = 0;
  let extraMinutes = 0;
  let extensionHours = 0;
  let basePrice = 0;
  let extensionAmount = 0;
  let billableHours = Math.max(1, Math.ceil(resolvedDurationMinutes / 60));
  let unitRate = 0;
  let subtotal = 0;
  let discountAmount = 0;
  let appliedDiscountName = '';
  let automaticDiscount = null;
  let durationDiscountConfig = null;

  if (pricingMode === PRICING_MODES.FIXED_SHIFT) {
    baseDurationMinutes =
      Number(pricing.durationMinutes) > 0
        ? Number(pricing.durationMinutes)
        : resolvedDurationMinutes;
    basePrice = toNonNegativeInt(pricing.basePrice, 0);
    extensionHourlyRate = findServiceExtensionHourlyRate(serviceType);

    const isExtendingShift =
      hasRequestedDuration &&
      parsedRequestedDuration > baseDurationMinutes &&
      extensionHourlyRate > 0;

    if (isExtendingShift) {
      resolvedDurationMinutes = parsedRequestedDuration;
      extraMinutes = resolvedDurationMinutes - baseDurationMinutes;
      extensionHours = Math.max(1, Math.ceil(extraMinutes / 60));
      extensionAmount = extensionHours * extensionHourlyRate;
    } else {
      resolvedDurationMinutes = baseDurationMinutes;
    }

    billableHours = Math.max(1, Math.ceil(resolvedDurationMinutes / 60));
    subtotal = basePrice + extensionAmount;
    // Fixed Shift uses ONLY its own configured discount (never stacks regular discount rules)
    discountAmount = Math.min(subtotal, toNonNegativeInt(pricing.discountAmount, 0));
    unitRate =
      resolvedDurationMinutes > 0
        ? Math.round((subtotal * 60) / resolvedDurationMinutes)
        : subtotal;
    appliedDiscountName = discountAmount > 0 ? 'Diskon Paket' : '';
  } else if (pricingMode === PRICING_MODES.HOURLY) {
    resolvedDurationMinutes = parsedRequestedDuration;
    unitRate = toNonNegativeInt(pricing.hourlyRate, 0);
    // Customer hourly billing rounds partial hours UP per studio hour (ceil)
    billableHours = Math.max(1, Math.ceil(resolvedDurationMinutes / 60));
    subtotal = billableHours * unitRate;

    const discountRules = Array.isArray(option?.discountRules) ? option.discountRules : [];
    const activeBlockRule = discountRules.find(
      (rule) =>
        rule &&
        rule.isActive !== false &&
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
      discountRules: discountRules.map((rule) =>
        rule && rule.isActive === undefined ? { ...rule, isActive: true } : rule,
      ),
      durationMinutes: resolvedDurationMinutes,
      subtotal,
    });
    discountAmount = bestDiscount.discountAmount;
    appliedDiscountName = bestDiscount.appliedDiscountName;
    automaticDiscount = bestDiscount.automaticDiscount;
  } else if (pricingMode === PRICING_MODES.FIXED_PROJECT) {
    resolvedDurationMinutes = parsedRequestedDuration;
    billableHours = 1;
    subtotal = toNonNegativeInt(pricing.projectPrice, 0);
    basePrice = subtotal;
    unitRate = subtotal;
    discountAmount = 0;
    appliedDiscountName = '';
  } else if (pricingMode === PRICING_MODES.MANUAL_QUOTE) {
    resolvedDurationMinutes = parsedRequestedDuration;
    billableHours = Math.max(1, Math.ceil(resolvedDurationMinutes / 60));
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

  return {
    pricingMode,
    resolvedDurationMinutes,
    baseDurationMinutes,
    billableHours,
    unitRate,
    basePrice,
    extensionHourlyRate,
    extraMinutes,
    extensionHours,
    extensionAmount,
    subtotal,
    discountAmount,
    appliedDiscountName,
    automaticDiscount,
    durationDiscountConfig,
    totalAmount,
    unitLabel: typeof pricing.unitLabel === 'string' ? pricing.unitLabel.trim() : '',
  };
}

/**
 * Customer-facing price estimator bound strictly to `publicPricingCatalog/current`.
 * Fail closed when catalog/service/option is absent, invalid, or unconfigured,
 * and NEVER includes internal staff/owner/operator fees.
 */
export function calculateCustomerPriceEstimate({
  catalog,
  serviceTypeId = '',
  serviceOptionId = '',
  serviceId = '',
  packageId = '',
  recordingTypeId = '',
  durationMinutes = null,
} = {}) {
  if (!catalog || !Array.isArray(catalog.serviceTypes) || catalog.serviceTypes.length === 0) {
    return null;
  }

  const { serviceType, option } = resolveCatalogServiceAndOption({
    catalog,
    serviceTypeId,
    serviceOptionId,
    serviceId,
    packageId,
    recordingTypeId,
  });

  if (!serviceType || !option || option.pricing?.mode === PRICING_MODES.UNCONFIGURED) {
    return null;
  }

  const core = computeCustomerPricingCore({
    serviceType,
    option,
    requestedDurationMinutes: durationMinutes,
    manualCustomerPrice: 0,
  });

  const isManualQuote = core.pricingMode === PRICING_MODES.MANUAL_QUOTE;

  return {
    catalogVersion: Math.max(1, Number(catalog.version) || 1),
    serviceTypeId: serviceType.id,
    serviceTypeName: serviceType.name,
    serviceOptionId: option.id,
    serviceOptionName: option.name,
    deliveryMode: serviceType.deliveryMode,
    pricingMode: core.pricingMode,
    isManualQuote,
    canExtendDuration: core.extensionHourlyRate > 0,
    baseDurationMinutes: core.baseDurationMinutes,
    durationMinutes: core.resolvedDurationMinutes,
    billableHours: core.billableHours,
    unitRate: core.unitRate,
    basePrice: core.basePrice,
    extensionHourlyRate: core.extensionHourlyRate,
    extraMinutes: core.extraMinutes,
    extensionHours: core.extensionHours,
    extensionAmount: core.extensionAmount,
    subtotal: isManualQuote ? null : core.subtotal,
    discountAmount: isManualQuote ? 0 : core.discountAmount,
    appliedDiscountName: core.appliedDiscountName,
    automaticDiscount: core.automaticDiscount,
    estimatedTotal: isManualQuote ? null : core.totalAmount,
    unitLabel: core.unitLabel,
  };
}

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

  const core = computeCustomerPricingCore({
    serviceType,
    option,
    requestedDurationMinutes: durationMinutes,
    manualCustomerPrice,
  });

  const {
    pricingMode,
    resolvedDurationMinutes,
    unitRate,
    subtotal,
    discountAmount,
    appliedDiscountName,
    automaticDiscount,
    durationDiscountConfig,
    totalAmount,
  } = core;

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
