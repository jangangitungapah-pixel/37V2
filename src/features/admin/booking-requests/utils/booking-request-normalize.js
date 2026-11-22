import {
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
} from '@/features/admin/calendar/config/calendar-config';
import {
  formatDurationMinutes,
  formatMinuteOfDay,
} from '@/features/admin/calendar/utils/booking-time';
import { isValidIsoDateString } from '@/features/admin/calendar/utils/calendar-date';
import {
  formatPhoneDisplay,
  normalizePhoneNumber,
} from '@/features/admin/customer/utils/phone-number';
import { DELIVERY_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { isOptionBookableForStudio } from '@/features/admin/settings/pricing/utils/normalize-pricing-settings';

import {
  BOOKING_REQUEST_CONSENT_VERSION,
  BOOKING_REQUEST_SCHEMA_VERSION,
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
  PUBLIC_DURATION_OPTION_VALUES,
  PUBLIC_ROOM_LABELS,
  PUBLIC_SERVICE_OPTIONS,
} from '../config/booking-request-config';

export function generateBookingRequestId() {
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').toUpperCase()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
  return `req_${randomUuid.slice(0, 20)}`;
}

/**
 * Generates a readable customer support reference strictly derived from the generated
 * Firestore document ID. Not an authorization token.
 */
export function deriveRequestReferenceFromId(requestId = '') {
  const clean = String(requestId || '')
    .replace(/^req_/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const token = (clean || '00000000').slice(0, 8).padEnd(8, '0');
  return `REQ-${token}`;
}

export function resolveRequestTypeFromPublicService(publicServiceId) {
  const matched = PUBLIC_SERVICE_OPTIONS.find((item) => item.id === publicServiceId);
  return matched?.requestType || BOOKING_REQUEST_TYPES.STUDIO_BOOKING;
}

export function getPublicServiceLabel(publicServiceId) {
  const matched = PUBLIC_SERVICE_OPTIONS.find((item) => item.id === publicServiceId);
  return matched?.label || String(publicServiceId || '').trim();
}

export function getPublicRoomLabel(roomId) {
  if (!roomId) return '';
  return PUBLIC_ROOM_LABELS[roomId] || String(roomId);
}

export function parseTimeStringToMinute(rawTime) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(rawTime || '').trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

export function parseDurationToMinutes(rawDuration) {
  if (typeof rawDuration === 'number' && Number.isInteger(rawDuration)) {
    return rawDuration;
  }
  const clean = String(rawDuration || '')
    .trim()
    .toLowerCase();
  if (!clean) return null;
  const matchedOpt = PUBLIC_DURATION_OPTION_VALUES.find((item) => item.value === clean);
  if (matchedOpt) return matchedOpt.minutes;
  if (clean === '6+ hours') return 360;
  if (/^\d+$/.test(clean)) return Number(clean);
  const hourMatch = /^(\d+)\s*hour/.exec(clean);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  return null;
}

export function formatRequestDurationLabel(minutes) {
  const num = Number(minutes);
  if (!Number.isFinite(num) || num <= 0) return '-';
  return formatDurationMinutes(num);
}

export function normalizeTimestampToIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

export function normalizeConfirmedBookingSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bookingId = String(raw.bookingId || '').trim();
  const date = String(raw.date || '').trim();
  if (!bookingId || !date) return null;

  const startMinute = Number(raw.startMinute);
  const durationMinutes = Number(raw.durationMinutes);
  const endMinute = Number(raw.endMinute) || startMinute + durationMinutes;

  return {
    bookingId,
    bookingReference: String(raw.bookingReference || bookingId.slice(0, 14).toUpperCase()),
    studioId: String(raw.studioId || 'room-a').trim(),
    studioName: String(raw.studioName || (raw.studioId === 'room-b' ? 'Room B' : 'Room A')),
    serviceTypeName: String(raw.serviceTypeName || '').trim(),
    serviceOptionName: String(raw.serviceOptionName || '').trim(),
    date,
    startMinute: Number.isInteger(startMinute) ? startMinute : 600,
    endMinute: Number.isInteger(endMinute) ? endMinute : 720,
    durationMinutes: Number.isInteger(durationMinutes) ? durationMinutes : 60,
  };
}

export function normalizeBookingRequestRecord(id, raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const requestId = String(id || raw.id || '').trim();
  const requestType =
    raw.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY
      ? BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY
      : BOOKING_REQUEST_TYPES.STUDIO_BOOKING;

  const contactPhone =
    normalizePhoneNumber(raw.contactPhone, { assumeIndonesiaLocalMobile: true }) ||
    String(raw.contactPhone || '').trim();

  const preferredStartMinute =
    raw.preferredStartMinute === null || raw.preferredStartMinute === undefined
      ? null
      : Number(raw.preferredStartMinute);
  const preferredDurationMinutes =
    raw.preferredDurationMinutes === null || raw.preferredDurationMinutes === undefined
      ? null
      : Number(raw.preferredDurationMinutes);

  const preferredDate =
    raw.preferredDate && isValidIsoDateString(String(raw.preferredDate))
      ? String(raw.preferredDate)
      : null;

  const preferredTimeLabel =
    Number.isInteger(preferredStartMinute) &&
    preferredStartMinute >= OPERATING_START_MINUTE &&
    preferredStartMinute < OPERATING_END_MINUTE &&
    preferredStartMinute % SLOT_INTERVAL_MINUTES === 0
      ? formatMinuteOfDay(preferredStartMinute)
      : '';

  return {
    id: requestId,
    schemaVersion: Number(raw.schemaVersion) || BOOKING_REQUEST_SCHEMA_VERSION,
    requestReference:
      String(raw.requestReference || '').trim() || deriveRequestReferenceFromId(requestId),
    requestType,
    status: Object.values(BOOKING_REQUEST_STATUS).includes(raw.status)
      ? raw.status
      : BOOKING_REQUEST_STATUS.NEW,
    statusReason: String(raw.statusReason || '').trim(),
    customerName: String(raw.customerName || '').trim(),
    bandName: String(raw.bandName || '').trim(),
    contactPhone,
    contactPhoneDisplay: contactPhone ? formatPhoneDisplay(contactPhone) : '',
    publicServiceId: String(raw.publicServiceId || 'rehearsal').trim(),
    serviceLabelSnapshot: String(
      raw.serviceLabelSnapshot || getPublicServiceLabel(raw.publicServiceId),
    ).trim(),
    requestedRoomId:
      requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING
        ? String(raw.requestedRoomId || 'any').trim()
        : null,
    requestedRoomLabel:
      requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING
        ? getPublicRoomLabel(raw.requestedRoomId || 'any')
        : '',
    preferredDate,
    preferredStartMinute: Number.isInteger(preferredStartMinute) ? preferredStartMinute : null,
    preferredTimeLabel,
    preferredDurationMinutes: Number.isInteger(preferredDurationMinutes)
      ? preferredDurationMinutes
      : null,
    targetDeadline:
      raw.targetDeadline && isValidIsoDateString(String(raw.targetDeadline))
        ? String(raw.targetDeadline)
        : null,
    notes: String(raw.notes || '').trim(),
    privacyConsent: raw.privacyConsent === true,
    consentVersion: String(raw.consentVersion || BOOKING_REQUEST_CONSENT_VERSION),
    source: Object.values(BOOKING_REQUEST_SOURCES).includes(raw.source)
      ? raw.source
      : BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE,
    clientUid: raw.clientUid ? String(raw.clientUid).trim() : '',
    customerId: raw.customerId ? String(raw.customerId).trim() : '',
    serviceOptionId: raw.serviceOptionId ? String(raw.serviceOptionId).trim() : '',
    serviceOptionName: raw.serviceOptionName ? String(raw.serviceOptionName).trim() : '',
    pricingVersion:
      raw.pricingVersion !== null &&
      raw.pricingVersion !== undefined &&
      raw.pricingVersion !== '' &&
      Number.isInteger(Number(raw.pricingVersion))
        ? Number(raw.pricingVersion)
        : null,
    assignedStaffUid: String(raw.assignedStaffUid || '').trim(),
    assignedStaffName: String(raw.assignedStaffName || '').trim(),
    lastCommunicationAt: raw.lastCommunicationAt ?? null,
    lastCommunicationAtIso: normalizeTimestampToIso(raw.lastCommunicationAt),
    lastCommunicationType: String(raw.lastCommunicationType || '').trim(),
    lastCommunicationStatus: String(raw.lastCommunicationStatus || '').trim(),
    linkedBookingId: raw.linkedBookingId ? String(raw.linkedBookingId).trim() : null,
    confirmedBookingSnapshot: normalizeConfirmedBookingSnapshot(raw.confirmedBookingSnapshot),
    confirmedAt: raw.confirmedAt ?? null,
    confirmedAtIso: normalizeTimestampToIso(raw.confirmedAt),
    confirmedByUid: String(raw.confirmedByUid || '').trim(),
    appCheckState: String(raw.appCheckState || 'unconfigured').trim(),
    createdAt: raw.createdAt ?? null,
    createdAtIso: normalizeTimestampToIso(raw.createdAt),
    updatedAt: raw.updatedAt ?? null,
    updatedAtIso: normalizeTimestampToIso(raw.updatedAt),
    updatedByUid: String(raw.updatedByUid || '').trim(),
    version: Number.isInteger(Number(raw.version)) ? Number(raw.version) : 1,
  };
}

export function normalizeCommunicationEvent(id, raw = {}) {
  return {
    id: String(id || raw.id || ''),
    templateId: String(raw.templateId || ''),
    templateLabel: String(raw.templateLabel || ''),
    messageBodySnapshot: String(raw.messageBodySnapshot || ''),
    eventType: String(raw.eventType || ''),
    preparedAt: raw.preparedAt ?? null,
    preparedAtIso: normalizeTimestampToIso(raw.preparedAt),
    preparedByUid: String(raw.preparedByUid || ''),
    manuallyMarkedSentAt: raw.manuallyMarkedSentAt ?? null,
    manuallyMarkedSentAtIso: normalizeTimestampToIso(raw.manuallyMarkedSentAt),
    manuallyMarkedSentByUid: String(raw.manuallyMarkedSentByUid || ''),
    createdAt: raw.createdAt ?? null,
    createdAtIso: normalizeTimestampToIso(raw.createdAt),
    actorUid: String(raw.preparedByUid || raw.manuallyMarkedSentByUid || ''),
  };
}

export function normalizeActivityEvent(id, raw = {}) {
  return {
    id: String(id || raw.id || ''),
    eventType: String(raw.eventType || ''),
    fromStatus: raw.fromStatus ? String(raw.fromStatus) : null,
    toStatus: raw.toStatus ? String(raw.toStatus) : null,
    linkedBookingId: raw.linkedBookingId ? String(raw.linkedBookingId) : null,
    note: String(raw.note || ''),
    actorUid: String(raw.actorUid || ''),
    actorName: String(raw.actorName || ''),
    createdAt: raw.createdAt ?? null,
    createdAtIso: normalizeTimestampToIso(raw.createdAt),
  };
}

/**
 * Dynamically maps a public Landing Page service (`rehearsal`, `recording`, `mix-master`)
 * against active internal Studio Pricing Settings (`deliveryMode === 'studio'`).
 * Never assumes Landing Page service IDs exist unchanged in internal pricing settings.
 */
export function mapPublicServiceToInternalPricing(
  publicServiceId,
  serviceTypes = [],
  requestedOptionId = '',
) {
  const cleanPublicId = String(publicServiceId || '')
    .trim()
    .toLowerCase();
  const cleanRequestedOptionId = String(requestedOptionId || '').trim();

  const matchingWfaService = (serviceTypes || []).find(
    (svc) =>
      svc &&
      svc.deliveryMode === DELIVERY_MODES.WFA &&
      String(svc.id || '').toLowerCase() === cleanPublicId,
  );

  const requestType = resolveRequestTypeFromPublicService(cleanPublicId);
  if (requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING || matchingWfaService) {
    return {
      isEligible: false,
      isMapped: false,
      requiresManualSelection: false,
      serviceTypeId: '',
      serviceOptionId: '',
      reason: 'Layanan Mix & Master / Post-Production (WFA) tidak membuat booking ruangan studio.',
    };
  }

  const activeStudioServices = (serviceTypes || [])
    .filter((svc) => svc && svc.deliveryMode === DELIVERY_MODES.STUDIO && svc.isActive !== false)
    .map((svc) => ({
      ...svc,
      bookableOptions: (svc.options || []).filter(isOptionBookableForStudio),
    }))
    .filter((svc) => svc.bookableOptions.length > 0);

  if (activeStudioServices.length === 0) {
    return {
      isEligible: true,
      isMapped: false,
      requiresManualSelection: true,
      serviceTypeId: '',
      serviceOptionId: '',
      reason:
        'Tidak ada layanan Studio aktif pada Price & Fee Settings. Staff harus memilih layanan secara manual.',
    };
  }

  if (cleanRequestedOptionId) {
    const preferredService =
      activeStudioServices.find((svc) => String(svc.id || '').toLowerCase() === cleanPublicId) ||
      null;
    const optionOnPreferred = preferredService?.bookableOptions?.find(
      (opt) => opt.id === cleanRequestedOptionId,
    );
    if (preferredService && optionOnPreferred) {
      return {
        isEligible: true,
        isMapped: true,
        requiresManualSelection: false,
        serviceTypeId: preferredService.id,
        serviceOptionId: optionOnPreferred.id,
        reason: '',
      };
    }

    for (const svc of activeStudioServices) {
      const matchedOpt = svc.bookableOptions.find((opt) => opt.id === cleanRequestedOptionId);
      if (matchedOpt) {
        return {
          isEligible: true,
          isMapped: true,
          requiresManualSelection: false,
          serviceTypeId: svc.id,
          serviceOptionId: matchedOpt.id,
          reason: '',
        };
      }
    }

    return {
      isEligible: true,
      isMapped: false,
      requiresManualSelection: true,
      serviceTypeId: '',
      serviceOptionId: '',
      reason:
        'Paket / opsi layanan pilihan Client sudah tidak aktif di Price & Fee Settings. Staff harus memilih layanan pengganti secara manual.',
    };
  }

  const exactIdMatch = activeStudioServices.find(
    (svc) => String(svc.id || '').toLowerCase() === cleanPublicId,
  );
  if (exactIdMatch) {
    const preferredOption =
      exactIdMatch.bookableOptions.find((opt) => opt.pricing?.mode === 'hourly') ||
      exactIdMatch.bookableOptions[0];
    return {
      isEligible: true,
      isMapped: true,
      requiresManualSelection: false,
      serviceTypeId: exactIdMatch.id,
      serviceOptionId: preferredOption?.id || '',
      reason: '',
    };
  }

  const nameMatches = activeStudioServices.filter((svc) =>
    String(svc.name || '')
      .toLowerCase()
      .includes(cleanPublicId),
  );
  if (nameMatches.length === 1) {
    const matched = nameMatches[0];
    const preferredOption =
      matched.bookableOptions.find((opt) => opt.pricing?.mode === 'hourly') ||
      matched.bookableOptions[0];
    return {
      isEligible: true,
      isMapped: true,
      requiresManualSelection: false,
      serviceTypeId: matched.id,
      serviceOptionId: preferredOption?.id || '',
      reason: '',
    };
  }

  return {
    isEligible: true,
    isMapped: false,
    requiresManualSelection: true,
    serviceTypeId: '',
    serviceOptionId: '',
    reason: `Layanan publik "${getPublicServiceLabel(publicServiceId)}" tidak memiliki pemetaan tunggal ke katalog harga internal aktif. Staff wajib memilih layanan & paket internal secara eksplisit sebelum menyimpan booking.`,
  };
}
