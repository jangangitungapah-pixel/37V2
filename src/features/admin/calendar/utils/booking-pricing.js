import {
  getPackageById,
  getRecordingTypeById,
  getServiceById,
  INITIAL_PAYMENT_STATUS,
  SLOT_INTERVAL_MINUTES,
} from '../config/calendar-config';

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
 * Calculates the canonical pricing snapshot for a booking based on selected service,
 * package, recording type, duration, and initial payment status.
 */
export function calculateBookingPricingSnapshot({
  serviceId = 'rehearsal',
  packageId = '',
  recordingTypeId = '',
  durationMinutes = 60,
  initialPaymentStatus = INITIAL_PAYMENT_STATUS.UNPAID,
  dpAmount = 0,
  paymentMethod = 'cash',
} = {}) {
  const pkg = getPackageById(packageId);
  const hasPackage = Boolean(pkg && pkg.id);

  let resolvedService = getServiceById(hasPackage ? pkg.serviceId : serviceId);
  let resolvedRecordingType = null;
  let resolvedDurationMinutes = Math.max(
    SLOT_INTERVAL_MINUTES,
    Math.round(Number(durationMinutes) || 60),
  );
  let unitRate = Number(resolvedService.unitRate) || 0;
  let subtotal;
  let discountAmount = 0;

  if (hasPackage) {
    resolvedDurationMinutes = Number(pkg.durationMinutes) || resolvedDurationMinutes;
    unitRate = Number(pkg.unitRate) || unitRate;
    subtotal = Number(pkg.subtotal) || Math.round((unitRate * resolvedDurationMinutes) / 60);
    discountAmount = Math.min(subtotal, Math.max(0, Number(pkg.discountAmount) || 0));
  } else if (resolvedService.id === 'recording') {
    resolvedRecordingType = getRecordingTypeById(recordingTypeId);
    if (resolvedRecordingType.priceMode === 'fixed' && resolvedRecordingType.fixedPrice > 0) {
      if (resolvedRecordingType.lockedDurationMinutes > 0) {
        resolvedDurationMinutes = resolvedRecordingType.lockedDurationMinutes;
      }
      unitRate = Number(resolvedRecordingType.unitRate) || unitRate;
      subtotal = Number(resolvedRecordingType.fixedPrice) || 0;
    } else {
      unitRate = Number(resolvedRecordingType.unitRate) || unitRate;
      subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);
    }
  } else {
    subtotal = Math.round((unitRate * resolvedDurationMinutes) / 60);
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);

  // Payment breakdown
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

  return {
    serviceId: resolvedService.id,
    serviceLabel: resolvedService.label,
    packageId: hasPackage ? pkg.id : '',
    packageLabel: hasPackage ? pkg.label : '',
    recordingTypeId:
      !hasPackage && resolvedService.id === 'recording' && resolvedRecordingType
        ? resolvedRecordingType.id
        : '',
    recordingTypeLabel:
      !hasPackage && resolvedService.id === 'recording' && resolvedRecordingType?.id
        ? resolvedRecordingType.label
        : '',
    durationMinutes: resolvedDurationMinutes,
    unitRate,
    subtotal,
    discountAmount,
    totalAmount,
    initialPaymentStatus: normalizedStatus,
    initialPaidAmount,
    remainingBalance,
    paymentMethod: normalizedPaymentMethod,
  };
}
