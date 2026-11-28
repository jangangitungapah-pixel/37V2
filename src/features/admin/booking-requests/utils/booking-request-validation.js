import {
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
} from '@/features/admin/calendar/config/calendar-config';
import {
  formatMinuteOfDay,
  validateBookingWindow,
} from '@/features/admin/calendar/utils/booking-time';
import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';

import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
  PUBLIC_SERVICE_OPTIONS,
} from '../config/booking-request-config';
import {
  getPublicServiceLabel,
  parseDurationToMinutes,
  parseTimeStringToMinute,
  resolveRequestTypeFromPublicService,
} from './booking-request-normalize';

const ALLOWED_PUBLIC_SERVICE_IDS = new Set(PUBLIC_SERVICE_OPTIONS.map((item) => item.id));
const ALLOWED_ROOM_IDS = new Set(['room-a', 'room-b', 'any']);
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

/**
 * Validates and normalizes an incoming public booking request or post-production inquiry
 * before persisting to `publicBookingRequests/{requestId}`.
 */
export function validatePublicBookingRequestInput(
  rawInput = {},
  {
    now = new Date(),
    allowedPublicServiceIds = ALLOWED_PUBLIC_SERVICE_IDS,
    resolvedRequestType = null,
    serviceLabelOverride = '',
    requireClientProjectDetails = false,
  } = {},
) {
  const errors = {};
  const todayIso = getJakartaTodayIso(now);

  const customerName = String(rawInput?.customerName ?? rawInput?.clientName ?? '').trim();
  const bandName = String(rawInput?.bandName ?? '').trim();
  const rawPhone = String(rawInput?.contactPhone ?? rawInput?.contactNumber ?? '').trim();
  const rawServiceId = String(rawInput?.publicServiceId ?? rawInput?.service ?? '').trim();
  const publicServiceIdLower = rawServiceId.toLowerCase();
  const notes = String(rawInput?.notes ?? '').trim();
  const privacyConsent = rawInput?.privacyConsent === true;

  if (!customerName || customerName.length < 2) {
    errors.customerName = 'Please enter your name (at least 2 characters).';
  } else if (customerName.length > 100) {
    errors.customerName = 'Name must be 100 characters or fewer.';
  }

  if (bandName.length > 100) {
    errors.bandName = 'Band or project name must be 100 characters or fewer.';
  }

  const normalizedPhone = normalizePhoneNumber(rawPhone, { assumeIndonesiaLocalMobile: true });
  if (
    !rawPhone ||
    !isValidPhoneNumber(rawPhone) ||
    !normalizedPhone ||
    !E164_PATTERN.test(normalizedPhone)
  ) {
    errors.contactPhone = 'Please enter a valid WhatsApp or phone number (8–15 digits).';
  }

  const allowedServiceSet =
    allowedPublicServiceIds instanceof Set ? allowedPublicServiceIds : ALLOWED_PUBLIC_SERVICE_IDS;
  const matchedServiceAllowed =
    allowedServiceSet.has(rawServiceId) || allowedServiceSet.has(publicServiceIdLower);

  if (!rawServiceId || !matchedServiceAllowed) {
    errors.publicServiceId = 'Please select a valid session category.';
  }

  if (notes.length > 600) {
    errors.notes = 'Notes must be 600 characters or fewer.';
  }

  if (!privacyConsent) {
    errors.privacyConsent =
      'Please agree to let 37 Music Studio use your contact details to respond to this request.';
  }

  const requestType =
    resolvedRequestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ||
    resolvedRequestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING
      ? resolvedRequestType
      : resolveRequestTypeFromPublicService(publicServiceIdLower);

  if (
    requireClientProjectDetails &&
    requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY
  ) {
    const projectBrief = String(rawInput?.projectBrief || '').replace(/\s+/g, ' ').trim();
    const storedBrief = notes.match(/(?:^|\s)Project Brief:\s*(.*)$/i)?.[1]?.trim() || '';

    if (bandName.length < 2) {
      errors.bandName = 'Please enter your project or artist name (at least 2 characters).';
    }
    if (projectBrief.length < 10) {
      errors.projectBrief = 'Please add a short project brief (at least 10 characters).';
    }
    if (storedBrief !== projectBrief || storedBrief.length < 10) {
      errors.notes = 'Project brief details are incomplete. Please review your project brief.';
    }
  }

  const publicServiceId =
    allowedPublicServiceIds === ALLOWED_PUBLIC_SERVICE_IDS ? publicServiceIdLower : rawServiceId;

  let requestedRoomId = null;
  let preferredDate = null;
  let preferredStartMinute = null;
  let preferredDurationMinutes = null;
  let targetDeadline = null;

  if (requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
    const rawRoom = String(rawInput?.requestedRoomId ?? rawInput?.room ?? 'room-a')
      .trim()
      .toLowerCase();
    if (!ALLOWED_ROOM_IDS.has(rawRoom)) {
      errors.requestedRoomId = 'Please select a studio room preference.';
    } else {
      requestedRoomId = rawRoom;
    }

    const rawDate = String(rawInput?.preferredDate ?? '').trim();
    if (!rawDate || !isValidIsoDateString(rawDate)) {
      errors.preferredDate = 'Please select a valid calendar date (YYYY-MM-DD).';
    } else if (rawDate < todayIso) {
      errors.preferredDate = 'Preferred date cannot be in the past.';
    } else {
      preferredDate = rawDate;
    }

    const startMinute =
      typeof rawInput?.preferredStartMinute === 'number'
        ? rawInput.preferredStartMinute
        : parseTimeStringToMinute(rawInput?.preferredTime);

    const durationMinutes =
      typeof rawInput?.preferredDurationMinutes === 'number'
        ? rawInput.preferredDurationMinutes
        : parseDurationToMinutes(rawInput?.duration);

    if (
      !Number.isInteger(startMinute) ||
      startMinute < OPERATING_START_MINUTE ||
      startMinute >= OPERATING_END_MINUTE ||
      startMinute % SLOT_INTERVAL_MINUTES !== 0
    ) {
      errors.preferredStartMinute =
        'Please select a valid 30-minute start time within studio hours.';
    } else {
      preferredStartMinute = startMinute;
    }

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 60 ||
      durationMinutes > 780 ||
      durationMinutes % SLOT_INTERVAL_MINUTES !== 0
    ) {
      errors.preferredDurationMinutes = 'Please select a valid session duration (1 hour minimum).';
    } else {
      preferredDurationMinutes = durationMinutes;
    }

    if (preferredStartMinute !== null && preferredDurationMinutes !== null) {
      const windowCheck = validateBookingWindow({
        startMinute: preferredStartMinute,
        durationMinutes: preferredDurationMinutes,
      });
      if (!windowCheck.isValid) {
        errors.preferredDurationMinutes = `Selected duration ends after studio closing time (${formatMinuteOfDay(OPERATING_END_MINUTE)} WIB).`;
      }
    }
  } else {
    const rawDeadline = String(rawInput?.targetDeadline ?? '').trim();
    if (rawDeadline) {
      if (!isValidIsoDateString(rawDeadline)) {
        errors.targetDeadline = 'Please enter a valid target deadline date (YYYY-MM-DD).';
      } else if (rawDeadline < todayIso) {
        errors.targetDeadline = 'Target deadline cannot be in the past.';
      } else {
        targetDeadline = rawDeadline;
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    data: isValid
      ? {
          requestType,
          customerName,
          bandName,
          contactPhone: normalizedPhone,
          publicServiceId,
          serviceLabelSnapshot:
            String(serviceLabelOverride || '').trim() || getPublicServiceLabel(publicServiceId),
          requestedRoomId,
          preferredDate,
          preferredStartMinute,
          preferredDurationMinutes,
          targetDeadline,
          notes,
          privacyConsent: true,
        }
      : null,
  };
}

/**
 * Checks whether an Admin workflow transition is permitted for the given request.
 */
export function canTransitionBookingRequestStatus({
  request,
  nextStatus,
  viaCanonicalBookingTransaction = false,
}) {
  if (!request) {
    return { allowed: false, reason: 'Request tidak ditemukan.' };
  }

  const currentStatus = request.status;

  if (nextStatus === BOOKING_REQUEST_STATUS.CONFIRMED) {
    if (request.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
      return {
        allowed: false,
        reason:
          'Post-production inquiry (Mix & Master) tidak dapat dikonfirmasi menjadi Calendar booking ruangan.',
      };
    }
    if (!viaCanonicalBookingTransaction) {
      return {
        allowed: false,
        reason:
          'Status Confirmed hanya dapat terjadi otomatis saat booking resmi berhasil disimpan di Admin Calendar.',
      };
    }
    if (
      currentStatus === BOOKING_REQUEST_STATUS.CONFIRMED ||
      currentStatus === BOOKING_REQUEST_STATUS.DECLINED ||
      currentStatus === BOOKING_REQUEST_STATUS.CLOSED ||
      request.linkedBookingId
    ) {
      return {
        allowed: false,
        reason:
          'Request ini sudah dikonfirmasi atau telah ditutup sehingga tidak bisa dikonversi ulang.',
      };
    }
    return { allowed: true, reason: '' };
  }

  if (nextStatus === BOOKING_REQUEST_STATUS.OFFER_SENT) {
    return {
      allowed: false,
      reason: 'Status Offer Sent hanya dapat terjadi melalui transaksi pengiriman Offer resmi.',
    };
  }

  const allowedTargets = ALLOWED_MANUAL_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedTargets.includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Transisi status dari "${currentStatus}" ke "${nextStatus}" tidak diizinkan.`,
    };
  }

  return { allowed: true, reason: '' };
}
