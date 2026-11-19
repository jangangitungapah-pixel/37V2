import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import {
  INITIAL_PAYMENT_STATUS,
  PAYMENT_METHOD_OPTIONS,
  STUDIO_ROOMS,
} from '../config/calendar-config';
import { calculateBookingPricingSnapshot, parseMoneyInput } from '../utils/booking-pricing';
import {
  doesBookingConflict,
  formatMinuteRange,
  validateBookingWindow,
} from '../utils/booking-time';
import { isValidIsoDateString } from '../utils/calendar-date';

const VALID_ROOM_IDS = new Set(STUDIO_ROOMS.map((room) => room.id));
const VALID_PAYMENT_METHODS = new Set(PAYMENT_METHOD_OPTIONS.map((m) => m.id));

/**
 * Normalizes a phone / WhatsApp number string while preserving leading `+` or `08`.
 */
export function normalizeCustomerPhone(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Checks whether a normalized phone string is a valid Indonesian / international mobile number
 * (8 to 16 digits).
 */
export function isValidCustomerPhone(value) {
  const normalized = normalizeCustomerPhone(value);
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.length >= 8 && digitsOnly.length <= 16;
}

/**
 * Validates Step 1 — Customer section.
 */
export function validateCustomerStep(formValues = {}) {
  const errors = {};
  const customerName = String(formValues.customerName ?? '').trim();
  const phone = String(formValues.phone ?? '').trim();

  if (!customerName) {
    errors.customerName = 'Nama customer wajib diisi.';
  } else if (customerName.length < 2) {
    errors.customerName = 'Nama customer minimal 2 karakter.';
  } else if (customerName.length > 120) {
    errors.customerName = 'Nama customer maksimal 120 karakter.';
  }

  if (!phone) {
    errors.phone = 'Nomor HP / WhatsApp wajib diisi.';
  } else if (!isValidCustomerPhone(phone)) {
    errors.phone = 'Masukkan nomor HP / WhatsApp yang valid (8–16 digit angka).';
  }

  const bandName = String(formValues.bandName ?? '').trim();
  if (bandName.length > 120) {
    errors.bandName = 'Nama band / project maksimal 120 karakter.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates Step 2 — Layanan (Service) section against active `pricingSettings`
 * (plus any historical service/package ID already stored on an existing booking).
 */
export function validateServiceStep(
  formValues = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  options = {},
) {
  const errors = {};
  const serviceId = String(formValues.serviceId ?? '').trim();

  const sessionTypes = Array.isArray(pricingSettings?.sessionTypes)
    ? pricingSettings.sessionTypes
    : DEFAULT_PRICING_SETTINGS.sessionTypes;

  const validServiceIds = new Set(
    sessionTypes.filter((item) => item.isActive !== false).map((item) => item.id),
  );

  for (const historicalId of options.allowedHistoricalServiceIds || []) {
    if (historicalId) validServiceIds.add(historicalId);
  }

  if (!serviceId || !validServiceIds.has(serviceId)) {
    errors.serviceId = 'Pilih layanan studio yang valid dan aktif.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Resolves the effective duration in minutes from form state (taking into account
 * package or fixed recording option locks from Firestore pricingSettings, preset
 * duration, or custom duration).
 */
export function resolveFormDurationMinutes(
  formValues = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
) {
  const safeSettings = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const packages = Array.isArray(safeSettings.packages)
    ? safeSettings.packages
    : DEFAULT_PRICING_SETTINGS.packages;
  const recordingTypes = Array.isArray(safeSettings.recordingTypes)
    ? safeSettings.recordingTypes
    : DEFAULT_PRICING_SETTINGS.recordingTypes;

  if (formValues.packageId) {
    const matchedPkg = packages.find((pkg) => pkg.id === formValues.packageId);
    if (matchedPkg && Number(matchedPkg.durationMinutes) > 0) {
      return Number(matchedPkg.durationMinutes);
    }
  }

  if (formValues.serviceId === 'recording' && formValues.recordingTypeId) {
    const matchedRec = recordingTypes.find((rec) => rec.id === formValues.recordingTypeId);
    if (matchedRec && matchedRec.priceMode === 'fixed' && Number(matchedRec.durationMinutes) > 0) {
      return Number(matchedRec.durationMinutes);
    }
  }

  if (formValues.durationPreset === 'custom') {
    return Number(formValues.customDurationMinutes);
  }

  return Number(formValues.durationPreset);
}

/**
 * Validates Step 3 — Jadwal (Schedule) section including conflict detection against
 * loaded bookings.
 */
export function validateScheduleStep(
  formValues = {},
  existingBookings = [],
  editingBookingId = '',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
) {
  const errors = {};
  const studioId = String(formValues.studioId ?? '').trim();
  const date = String(formValues.date ?? '').trim();
  const startMinute = Number(formValues.startMinute);
  const durationMinutes = resolveFormDurationMinutes(formValues, pricingSettings);

  if (!VALID_ROOM_IDS.has(studioId)) {
    errors.studioId = 'Pilih ruangan studio (Room A atau Room B).';
  }

  if (!date || !isValidIsoDateString(date)) {
    errors.date = 'Pilih tanggal kalender yang valid (YYYY-MM-DD).';
  }

  const windowCheck = validateBookingWindow({
    startMinute,
    durationMinutes,
  });

  if (!windowCheck.isValid) {
    if (windowCheck.code.includes('duration')) {
      errors.durationMinutes = windowCheck.message;
    } else {
      errors.startMinute = windowCheck.message;
    }
  }

  let conflicts = [];
  if (Object.keys(errors).length === 0) {
    const candidate = {
      bookingId: editingBookingId,
      date,
      studioId,
      startMinute: windowCheck.startMinute,
      durationMinutes: windowCheck.durationMinutes,
      endMinute: windowCheck.endMinute,
    };

    conflicts = (existingBookings || []).filter((item) => doesBookingConflict(candidate, item));
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      const conflictTimeLabel = formatMinuteRange(
        firstConflict.startMinute,
        firstConflict.endMinute,
      );
      errors.scheduleConflict = `Jadwal bentrok dengan booking "${firstConflict.customerName}" pada ${conflictTimeLabel}.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    conflicts,
    resolvedWindow: windowCheck.isValid ? windowCheck : null,
  };
}

/**
 * Validates Step 4 — Pembayaran (Payment) section.
 */
export function validatePaymentStep(formValues = {}, totalAmount = 0) {
  const errors = {};
  const status = String(formValues.initialPaymentStatus || INITIAL_PAYMENT_STATUS.UNPAID);
  const validStatuses = new Set(Object.values(INITIAL_PAYMENT_STATUS));

  if (!validStatuses.has(status)) {
    errors.initialPaymentStatus = 'Pilih status pembayaran awal yang valid.';
  }

  if (status === INITIAL_PAYMENT_STATUS.PARTIAL || status === INITIAL_PAYMENT_STATUS.PAID) {
    const method = String(formValues.paymentMethod ?? '')
      .trim()
      .toLowerCase();
    if (!VALID_PAYMENT_METHODS.has(method)) {
      errors.paymentMethod = 'Pilih metode pembayaran (Cash, Transfer, QRIS, atau Other).';
    }
  }

  if (status === INITIAL_PAYMENT_STATUS.PARTIAL) {
    const dpAmount = parseMoneyInput(formValues.dpAmount);
    if (dpAmount <= 0) {
      errors.dpAmount = 'Nominal DP wajib lebih besar dari Rp 0.';
    } else if (totalAmount > 0 && dpAmount > totalAmount) {
      errors.dpAmount = 'Nominal DP tidak boleh melebihi total tagihan booking.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates the entire Booking Form against live `pricingSettings` and builds the
 * normalized payload ready for the transactional booking service.
 */
export function validateBookingFormPayload(
  formValues = {},
  existingBookings = [],
  editingBookingId = '',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  options = {},
) {
  const safeSettings = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const durationMinutes = resolveFormDurationMinutes(formValues, safeSettings);
  const pricing = calculateBookingPricingSnapshot({
    serviceId: formValues.serviceId,
    packageId: formValues.packageId,
    recordingTypeId: formValues.recordingTypeId,
    durationMinutes,
    initialPaymentStatus: formValues.initialPaymentStatus,
    dpAmount: formValues.dpAmount,
    paymentMethod: formValues.paymentMethod,
    pricingSettings: safeSettings,
  });

  const customerValidation = validateCustomerStep(formValues);
  const serviceValidation = validateServiceStep(formValues, safeSettings, options);
  const scheduleValidation = validateScheduleStep(
    formValues,
    existingBookings,
    editingBookingId,
    safeSettings,
  );
  const paymentValidation = validatePaymentStep(
    formValues,
    options.paymentTotalOverride ?? pricing.totalAmount,
  );

  const errors = {
    ...customerValidation.errors,
    ...serviceValidation.errors,
    ...scheduleValidation.errors,
    ...paymentValidation.errors,
  };

  const stepStatus = {
    customer: customerValidation.isValid,
    service: serviceValidation.isValid,
    schedule: scheduleValidation.isValid,
    payment: paymentValidation.isValid,
  };

  const isValid =
    customerValidation.isValid &&
    serviceValidation.isValid &&
    scheduleValidation.isValid &&
    paymentValidation.isValid;

  if (!isValid) {
    return {
      isValid: false,
      errors,
      stepStatus,
      conflicts: scheduleValidation.conflicts,
      payload: null,
      pricing,
    };
  }

  const startMinute = scheduleValidation.resolvedWindow.startMinute;
  const validDurationMinutes = scheduleValidation.resolvedWindow.durationMinutes;
  const endMinute = scheduleValidation.resolvedWindow.endMinute;

  return {
    isValid: true,
    errors: {},
    stepStatus,
    conflicts: [],
    pricing,
    payload: {
      customerName: String(formValues.customerName || '').trim(),
      phone: normalizeCustomerPhone(formValues.phone),
      bandName: String(formValues.bandName || '').trim(),
      studioId: String(formValues.studioId || 'room-a').trim(),
      serviceId: pricing.serviceId,
      serviceLabel: pricing.serviceLabel,
      packageId: pricing.packageId,
      packageLabel: pricing.packageLabel,
      recordingTypeId: pricing.recordingTypeId,
      recordingTypeLabel: pricing.recordingTypeLabel,
      date: String(formValues.date || '').trim(),
      startMinute,
      durationMinutes: validDurationMinutes,
      endMinute,
      timeZone: 'Asia/Jakarta',
      unitRate: pricing.unitRate,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
      automaticDiscount: pricing.automaticDiscount,
      commissionSnapshot: pricing.commissionSnapshot,
      initialPaymentStatus: pricing.initialPaymentStatus,
      initialPaidAmount: pricing.initialPaidAmount,
      paymentMethod: pricing.paymentMethod,
      notes: String(formValues.notes || '')
        .trim()
        .slice(0, 500),
    },
  };
}
