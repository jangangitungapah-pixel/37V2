import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  calculateBookingCommissionSnapshot,
  formatRupiah,
  parseMoneyInput,
  selectBestSessionDiscount,
} from '@/features/admin/settings/pricing/utils/calculate-pricing-settings';

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

  let resolvedRecordingType = null;
  let resolvedDurationMinutes = Math.max(
    SLOT_INTERVAL_MINUTES,
    Math.round(Number(durationMinutes) || 60),
  );
  let unitRate = Number(matchedService.hourlyRate ?? matchedService.unitRate) || 0;
  let subtotal;
  let discountAmount;
  let appliedDiscountName;

  if (hasPackage) {
    resolvedDurationMinutes = Number(pkg.durationMinutes) || resolvedDurationMinutes;
    subtotal = Number(pkg.basePrice ?? pkg.subtotal) || 0;
    unitRate =
      resolvedDurationMinutes > 0
        ? Math.round((subtotal * 60) / resolvedDurationMinutes)
        : unitRate;
    // Packages use only their own configured package discount (never stack regular discounts)
    discountAmount = Math.min(subtotal, Math.max(0, Number(pkg.discountAmount) || 0));
    appliedDiscountName = discountAmount > 0 ? 'Diskon Paket' : '';
  } else if (resolvedServiceId === 'recording') {
    resolvedRecordingType = resolveRecordingOption(recordingTypes, recordingTypeId);
    if (
      resolvedRecordingType &&
      resolvedRecordingType.priceMode === 'fixed' &&
      Number(resolvedRecordingType.price) > 0
    ) {
      if (Number(resolvedRecordingType.durationMinutes) > 0) {
        resolvedDurationMinutes = Number(resolvedRecordingType.durationMinutes);
      }
      subtotal = Math.max(0, Number(resolvedRecordingType.price) || 0);
      unitRate =
        resolvedDurationMinutes > 0
          ? Math.round((subtotal * 60) / resolvedDurationMinutes)
          : subtotal;
    } else {
      const recordingHourlyPrice = Number(resolvedRecordingType?.price);
      if (Number.isFinite(recordingHourlyPrice) && recordingHourlyPrice > 0) {
        unitRate = recordingHourlyPrice;
      }
      subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);
    }

    const bestDiscount = selectBestSessionDiscount({
      discounts,
      sessionTypeId: resolvedServiceId,
      durationMinutes: resolvedDurationMinutes,
      subtotal,
    });
    discountAmount = bestDiscount.discountAmount;
    appliedDiscountName = bestDiscount.discountName;
  } else {
    subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);
    const bestDiscount = selectBestSessionDiscount({
      discounts,
      sessionTypeId: resolvedServiceId,
      durationMinutes: resolvedDurationMinutes,
      subtotal,
    });
    discountAmount = bestDiscount.discountAmount;
    appliedDiscountName = bestDiscount.discountName;
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
    totalAmount,
    initialPaymentStatus: normalizedStatus,
    initialPaidAmount,
    remainingBalance,
    paymentMethod: normalizedPaymentMethod,
    commissionSnapshot,
  };
}
