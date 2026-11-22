import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  findServiceOptionById,
  findServiceTypeById,
  normalizePricingSettings,
} from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import {
  INITIAL_PAYMENT_STATUS,
  PAYMENT_METHOD_OPTIONS,
  STUDIO_ROOMS,
} from '../config/calendar-config';
import {
  calculateBookingPricingSnapshot,
  findServiceExtensionHourlyRate,
  parseMoneyInput,
  resolveServiceAndOption,
} from '../utils/booking-pricing';
import {
  doesBookingConflict,
  formatMinuteRange,
  validateBookingWindow,
} from '../utils/booking-time';
import { isValidIsoDateString } from '../utils/calendar-date';

const VALID_ROOM_IDS = new Set(STUDIO_ROOMS.map((room) => room.id));
const VALID_PAYMENT_METHODS = new Set(PAYMENT_METHOD_OPTIONS.map((m) => m.id));

/**
 * Normalizes a phone / WhatsApp number into canonical E.164 format (`+62...` for Indonesia)
 * using the single shared phone utility.
 */
export function normalizeCustomerPhone(value) {
  return normalizePhoneNumber(value);
}

/**
 * Checks whether a phone string normalizes into a valid Indonesian / international number.
 */
export function isValidCustomerPhone(value) {
  return isValidPhoneNumber(value);
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
 * Validates Step 2 — Layanan & Subcategory against Schema V2 `pricingSettings`.
 *
 * Enforcement:
 * - Only Studio services (`deliveryMode === 'studio'`) can be booked on Studio Calendar
 *   (unless preserving a historical booking's legacy service ID during non-repricing edit).
 * - Unconfigured or inactive options cannot be selected for new bookings.
 * - `manual_quote` options (e.g. Recording Others) require a valid positive customer price;
 *   manual internal fees allow Rp 0 and must be non-negative integers.
 */
export function validateServiceStep(
  formValues = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  options = {},
) {
  const errors = {};
  const normalizedSettings = normalizePricingSettings(pricingSettings);
  const allowedHistoricalServices = new Set(options.allowedHistoricalServiceIds || []);
  const allowedHistoricalOptions = new Set(options.allowedHistoricalOptionIds || []);

  const requestedServiceId = String(formValues.serviceTypeId || formValues.serviceId || '').trim();
  const requestedOptionId = String(
    formValues.serviceOptionId || formValues.packageId || formValues.recordingTypeId || '',
  ).trim();

  // Check if direct option lookup provides the parent service
  let matchedService = requestedServiceId
    ? findServiceTypeById(normalizedSettings, requestedServiceId)
    : null;
  let matchedOption = null;

  if (requestedOptionId) {
    const foundByOption = findServiceOptionById(normalizedSettings, requestedOptionId);
    if (foundByOption) {
      matchedOption = foundByOption.option;
      if (!matchedService) {
        matchedService = foundByOption.serviceType;
      }
    }
  }

  const isHistoricalService = Boolean(
    requestedServiceId && allowedHistoricalServices.has(requestedServiceId),
  );
  const isHistoricalOption = Boolean(
    requestedOptionId && allowedHistoricalOptions.has(requestedOptionId),
  );

  if (!matchedService) {
    if (!isHistoricalService) {
      errors.serviceId = 'Pilih layanan studio yang valid dan aktif.';
    }
  } else {
    if (matchedService.deliveryMode !== DELIVERY_MODES.STUDIO && !isHistoricalService) {
      errors.serviceId =
        'Layanan WFA (Mixing / Mastering) tidak dapat menggunakan jadwal ruangan Studio Calendar.';
    } else if (matchedService.isActive === false && !isHistoricalService) {
      errors.serviceId = 'Layanan studio yang dipilih sedang non-aktif.';
    }
  }

  // Resolve option if user did not explicitly specify one (legacy caller compatibility)
  if (!errors.serviceId && matchedService) {
    if (requestedOptionId) {
      const optionBelongsToService = (matchedService.options || []).some(
        (opt) => opt.id === requestedOptionId,
      );
      if (!optionBelongsToService && !isHistoricalOption) {
        errors.serviceOptionId = 'Subcategory tidak sesuai dengan jenis layanan yang dipilih.';
      }
    } else {
      matchedOption =
        (matchedService.options || []).find(
          (opt) => opt.isActive !== false && opt.pricing?.mode === PRICING_MODES.HOURLY,
        ) ||
        (matchedService.options || []).find(
          (opt) => opt.isActive !== false && opt.pricing?.mode !== PRICING_MODES.UNCONFIGURED,
        ) ||
        null;
    }

    if (!errors.serviceOptionId) {
      if (!matchedOption && !isHistoricalOption) {
        errors.serviceOptionId = 'Pilih subcategory layanan yang valid dan sudah dikonfigurasi.';
      } else if (matchedOption && !isHistoricalOption) {
        if (matchedOption.pricing?.mode === PRICING_MODES.UNCONFIGURED) {
          errors.serviceOptionId =
            'Subcategory ini belum dikonfigurasi tarifnya dan tidak dapat dibooking.';
        } else if (matchedOption.pricing?.mode === PRICING_MODES.FIXED_PROJECT) {
          errors.serviceOptionId =
            'Subcategory Fixed Project tidak berlaku untuk booking ruangan studio.';
        } else if (matchedOption.isActive === false) {
          errors.serviceOptionId = 'Subcategory yang dipilih sedang berstatus non-aktif.';
        }
      }
    }
  }

  // Validate manual quote customer price when applicable (and not preserving historical snapshot)
  if (
    !errors.serviceId &&
    !errors.serviceOptionId &&
    matchedOption?.pricing?.mode === PRICING_MODES.MANUAL_QUOTE &&
    !options.skipManualQuoteValidation
  ) {
    const manualPrice = parseMoneyInput(formValues.manualCustomerPrice);
    if (manualPrice <= 0) {
      errors.manualCustomerPrice = 'Harga customer manual wajib diisi dan lebih besar dari Rp 0.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Resolves the effective duration in minutes from form state (allowing hourly extension
 * beyond Fixed Shift duration ONLY when an active hourly rate exists for that service type,
 * otherwise locking to Fixed Shift duration).
 */
export function resolveFormDurationMinutes(
  formValues = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
) {
  const { serviceType, option } = resolveServiceAndOption({
    serviceTypeId: formValues.serviceTypeId,
    serviceOptionId: formValues.serviceOptionId,
    serviceId: formValues.serviceId,
    packageId: formValues.packageId,
    recordingTypeId: formValues.recordingTypeId,
    pricingSettings,
  });

  const requestedDuration =
    formValues.durationPreset === 'custom'
      ? Number(formValues.customDurationMinutes)
      : Number(formValues.durationPreset);

  if (
    option?.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
    Number(option.pricing.durationMinutes) > 0
  ) {
    const baseDuration = Number(option.pricing.durationMinutes);
    const extensionHourlyRate = findServiceExtensionHourlyRate(serviceType);
    if (
      extensionHourlyRate > 0 &&
      Number.isFinite(requestedDuration) &&
      requestedDuration > baseDuration
    ) {
      return requestedDuration;
    }
    return baseDuration;
  }

  return requestedDuration;
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
 * Validates the entire Booking Form against live `pricingSettings` (Schema V2) and builds the
 * normalized payload ready for the transactional booking service.
 */
export function validateBookingFormPayload(
  formValues = {},
  existingBookings = [],
  editingBookingId = '',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  options = {},
) {
  const safeSettings = normalizePricingSettings(pricingSettings);
  const durationMinutes = resolveFormDurationMinutes(formValues, safeSettings);
  const pricing = calculateBookingPricingSnapshot({
    serviceTypeId: formValues.serviceTypeId,
    serviceOptionId: formValues.serviceOptionId,
    serviceId: formValues.serviceId,
    packageId: formValues.packageId,
    recordingTypeId: formValues.recordingTypeId,
    durationMinutes,
    manualCustomerPrice: formValues.manualCustomerPrice,
    manualStaffFee: formValues.manualStaffFee,
    manualOwnerFee: formValues.manualOwnerFee,
    manualRecordingOperatorFee: formValues.manualRecordingOperatorFee,
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
      phone: String(formValues.phone || '').trim(),
      phoneNormalized: normalizeCustomerPhone(formValues.phone),
      bandName: String(formValues.bandName || '').trim(),
      studioId: String(formValues.studioId || 'room-a').trim(),
      // V2 hierarchical snapshot fields
      serviceTypeId: pricing.serviceTypeId,
      serviceTypeName: pricing.serviceTypeName,
      serviceOptionId: pricing.serviceOptionId,
      serviceOptionName: pricing.serviceOptionName,
      deliveryMode: pricing.deliveryMode,
      pricingMode: pricing.pricingMode,
      pricingSettingsVersion: pricing.pricingSettingsVersion,
      // Legacy-compatible identifiers
      serviceId: pricing.serviceId,
      serviceLabel: pricing.serviceLabel,
      packageId: pricing.packageId,
      packageLabel: pricing.packageLabel,
      recordingTypeId: pricing.recordingTypeId,
      recordingTypeLabel: pricing.recordingTypeLabel,
      // Schedule
      date: String(formValues.date || '').trim(),
      startMinute,
      durationMinutes: validDurationMinutes,
      endMinute,
      timeZone: 'Asia/Jakarta',
      // Customer price & discount snapshot
      unitRate: pricing.unitRate,
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      totalAmount: pricing.totalAmount,
      automaticDiscount: pricing.automaticDiscount,
      // Internal fee snapshot V2
      commissionSnapshot: pricing.commissionSnapshot,
      // Initial payment snapshot
      initialPaymentStatus: pricing.initialPaymentStatus,
      initialPaidAmount: pricing.initialPaidAmount,
      paymentMethod: pricing.paymentMethod,
      notes: String(formValues.notes || '')
        .trim()
        .slice(0, 500),
    },
  };
}
