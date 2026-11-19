import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  calculateBookingCommissionSnapshot,
  calculateDurationAutomaticDiscount,
  formatRupiah,
  parseMoneyInput,
  selectBestSessionDiscount,
} from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';
import {
  normalizeDurationDiscountConfig,
  toNonNegativeInt,
} from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import { INITIAL_PAYMENT_STATUS, SLOT_INTERVAL_MINUTES } from '../config/calendar-config';

export { formatRupiah, parseMoneyInput };

function resolveRecordingOption(recordingTypes = [], recordingTypeId = '') {
  const cleanId = String(recordingTypeId || '').trim();
  if (!cleanId) {
    return (
      recordingTypes.find((item) => item.priceMode === 'hourly' && item.isActive !== false) ||
      recordingTypes.find((item) => item.priceMode === 'hourly') ||
      recordingTypes[0] ||
      null
    );
  }

  return recordingTypes.find((item) => item.id === cleanId) || recordingTypes[0] || null;
}

/**
 * Selects the single highest non-stacking regular session discount between
 * the service's duration-based automatic multiple discount and legacy discount presets.
 */
function resolveRegularSessionDiscount({
  service = null,
  discounts = [],
  sessionTypeId = '',
  durationMinutes = 0,
  subtotal = 0,
}) {
  const durationResult = calculateDurationAutomaticDiscount({
    durationMinutes,
    subtotal,
    durationDiscount: service?.durationDiscount,
  });

  const presetResult = selectBestSessionDiscount({
    discounts,
    sessionTypeId,
    durationMinutes,
    subtotal,
  });

  if (
    durationResult.discountAmount > 0 &&
    durationResult.discountAmount >= presetResult.discountAmount
  ) {
    return {
      discountAmount: durationResult.discountAmount,
      appliedDiscountName: durationResult.appliedDiscountName,
      automaticDiscount: durationResult.automaticDiscount,
    };
  }

  if (presetResult.discountAmount > 0) {
    return {
      discountAmount: presetResult.discountAmount,
      appliedDiscountName: presetResult.discountName,
      automaticDiscount: null,
    };
  }

  return {
    discountAmount: 0,
    appliedDiscountName: '',
    automaticDiscount: null,
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
 * Calculates the canonical pricing & internal commission snapshot for a booking based on
 * live Firestore `pricingSettings` (`settings/pricing`), selected service, package,
 * recording option, duration, and initial payment status.
 */
export function calculateBookingPricingSnapshot({
  serviceId = 'rehearsal',
  packageId = '',
  recordingTypeId = '',
  durationMinutes = 60,
  initialPaymentStatus = INITIAL_PAYMENT_STATUS.UNPAID,
  dpAmount = 0,
  paymentMethod = 'cash',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
} = {}) {
  const safeSettings = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const sessionTypes = Array.isArray(safeSettings.sessionTypes)
    ? safeSettings.sessionTypes
    : DEFAULT_PRICING_SETTINGS.sessionTypes;
  const recordingTypes = Array.isArray(safeSettings.recordingTypes)
    ? safeSettings.recordingTypes
    : DEFAULT_PRICING_SETTINGS.recordingTypes;
  const packages = Array.isArray(safeSettings.packages)
    ? safeSettings.packages
    : DEFAULT_PRICING_SETTINGS.packages;
  const discounts = Array.isArray(safeSettings.discounts)
    ? safeSettings.discounts
    : DEFAULT_PRICING_SETTINGS.discounts;
  const fees = safeSettings.fees || DEFAULT_PRICING_SETTINGS.fees;
  const settingsVersion = Math.max(1, Number(safeSettings.version) || 1);

  const pkg = packageId ? packages.find((item) => item.id === packageId) || null : null;
  const hasPackage = Boolean(pkg && pkg.id);

  const targetServiceId = hasPackage ? pkg.sessionTypeId : serviceId;
  const matchedService = sessionTypes.find((item) => item.id === targetServiceId) ||
    sessionTypes.find((item) => item.isActive !== false) ||
    sessionTypes[0] || {
    id: targetServiceId || 'rehearsal',
    name: 'Rehearsal',
    hourlyRate: 100000,
  };

  const resolvedServiceId = matchedService.id;
  const resolvedServiceLabel = matchedService.name || matchedService.label || resolvedServiceId;
  const normalizedServiceDurationDiscount = normalizeDurationDiscountConfig(
    matchedService.durationDiscount,
  );

  let resolvedRecordingType = null;
  let resolvedDurationMinutes = Math.max(
    SLOT_INTERVAL_MINUTES,
    Math.round(Number(durationMinutes) || 60),
  );
  let unitRate = toNonNegativeInt(matchedService.hourlyRate ?? matchedService.unitRate, 0);
  let subtotal;
  let discountAmount;
  let appliedDiscountName;
  let automaticDiscount = null;
  let durationDiscountConfig = null;

  if (hasPackage) {
    resolvedDurationMinutes = Number(pkg.durationMinutes) || resolvedDurationMinutes;
    subtotal = toNonNegativeInt(pkg.basePrice ?? pkg.subtotal, 0);
    unitRate =
      resolvedDurationMinutes > 0
        ? Math.round((subtotal * 60) / resolvedDurationMinutes)
        : unitRate;
    // Packages use only their own configured package discount (never stack regular discounts)
    discountAmount = Math.min(subtotal, toNonNegativeInt(pkg.discountAmount, 0));
    appliedDiscountName = discountAmount > 0 ? 'Diskon Paket' : '';
  } else if (resolvedServiceId === 'recording') {
    resolvedRecordingType = resolveRecordingOption(recordingTypes, recordingTypeId);
    const isFixedRecording = Boolean(
      resolvedRecordingType &&
      resolvedRecordingType.priceMode === 'fixed' &&
      Number(resolvedRecordingType.price) > 0,
    );

    if (isFixedRecording) {
      if (Number(resolvedRecordingType.durationMinutes) > 0) {
        resolvedDurationMinutes = Number(resolvedRecordingType.durationMinutes);
      }
      subtotal = toNonNegativeInt(resolvedRecordingType.price, 0);
      unitRate =
        resolvedDurationMinutes > 0
          ? Math.round((subtotal * 60) / resolvedDurationMinutes)
          : subtotal;

      // Preserve existing fixed-session pricing without stacking duration-multiple discounts
      const bestDiscount = selectBestSessionDiscount({
        discounts,
        sessionTypeId: resolvedServiceId,
        durationMinutes: resolvedDurationMinutes,
        subtotal,
      });
      discountAmount = bestDiscount.discountAmount;
      appliedDiscountName = bestDiscount.discountName;
    } else {
      const recordingHourlyPrice = Number(resolvedRecordingType?.price);
      if (Number.isFinite(recordingHourlyPrice) && recordingHourlyPrice > 0) {
        unitRate = toNonNegativeInt(recordingHourlyPrice, unitRate);
      }
      subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);

      if (normalizedServiceDurationDiscount.enabled) {
        durationDiscountConfig = normalizedServiceDurationDiscount;
      }

      const regularDiscount = resolveRegularSessionDiscount({
        service: matchedService,
        discounts,
        sessionTypeId: resolvedServiceId,
        durationMinutes: resolvedDurationMinutes,
        subtotal,
      });
      discountAmount = regularDiscount.discountAmount;
      appliedDiscountName = regularDiscount.appliedDiscountName;
      automaticDiscount = regularDiscount.automaticDiscount;
    }
  } else {
    subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);

      if(normalizedServiceDurationDiscount.enabled) {
        durationDiscountConfig = normalizedServiceDurationDiscount;
  }

  const regularDiscount = resolveRegularSessionDiscount({
    service: matchedService,
    discounts,
    sessionTypeId: resolvedServiceId,
    durationMinutes: resolvedDurationMinutes,
    subtotal,
  });
  discountAmount = regularDiscount.discountAmount;
  appliedDiscountName = regularDiscount.appliedDiscountName;
  automaticDiscount = regularDiscount.automaticDiscount;
}

// Customer total NEVER includes internal staff commissions or daily meal allowance
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

const commissionSnapshot = calculateBookingCommissionSnapshot({
  hasPackage,
  pkg,
  serviceId: resolvedServiceId,
  durationMinutes: resolvedDurationMinutes,
  fees,
  settingsVersion,
});

const cleanRecordingTypeId = String(recordingTypeId || '').trim();
const resolvedRecordingId =
  !hasPackage && resolvedServiceId === 'recording' ? cleanRecordingTypeId : '';

const resolvedRecordingLabel =
  !hasPackage && resolvedServiceId === 'recording' && resolvedRecordingId
    ? resolvedRecordingType?.name || ''
    : '';

return {
  serviceId: resolvedServiceId,
  serviceLabel: resolvedServiceLabel,
  packageId: hasPackage ? pkg.id : '',
  packageLabel: hasPackage ? pkg.name || pkg.label || '' : '',
  recordingTypeId: resolvedRecordingId,
  recordingTypeLabel: resolvedRecordingLabel,
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
  commissionSnapshot,
};
}
