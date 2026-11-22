import {
  formatDurationMinutes,
  formatMinuteOfDay,
} from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianDateFull } from '@/features/admin/calendar/utils/calendar-date';

import { BOOKING_REQUEST_STATUS } from '../config/booking-request-config';
import { ALLOWLISTED_TEMPLATE_VARIABLES } from '../config/default-whatsapp-templates';

const ALLOWLIST_SET = new Set(ALLOWLISTED_TEMPLATE_VARIABLES);
const VARIABLE_PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

/**
 * Builds the strict allowlisted variable lookup map from a booking request record.
 * Confirmed variables (`confirmedDate`, `confirmedTime`, `confirmedEndTime`, `bookingReference`)
 * are populated ONLY from canonical `confirmedBookingSnapshot` when status === 'confirmed'.
 */
export function buildTemplateVariableMap({ request, studioName = '37 Music Studio' } = {}) {
  if (!request) {
    return Object.fromEntries(ALLOWLISTED_TEMPLATE_VARIABLES.map((key) => [key, '']));
  }

  const isConfirmed =
    request.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
    Boolean(request.linkedBookingId) &&
    Boolean(request.confirmedBookingSnapshot);

  const snapshot = isConfirmed ? request.confirmedBookingSnapshot : null;

  const preferredDateFormatted = request.preferredDate
    ? formatIndonesianDateFull(request.preferredDate)
    : '';
  const preferredDurationFormatted = request.preferredDurationMinutes
    ? formatDurationMinutes(request.preferredDurationMinutes)
    : '';

  const confirmedDateFormatted = snapshot?.date ? formatIndonesianDateFull(snapshot.date) : '';
  const confirmedTimeFormatted = Number.isInteger(snapshot?.startMinute)
    ? formatMinuteOfDay(snapshot.startMinute)
    : '';
  const confirmedEndTimeFormatted = Number.isInteger(snapshot?.endMinute)
    ? formatMinuteOfDay(snapshot.endMinute)
    : '';
  const confirmedDurationFormatted = snapshot?.durationMinutes
    ? formatDurationMinutes(snapshot.durationMinutes)
    : '';

  const serviceName = snapshot
    ? [snapshot.serviceTypeName, snapshot.serviceOptionName].filter(Boolean).join(' • ') ||
      request.serviceLabelSnapshot
    : request.serviceLabelSnapshot || '';

  const roomName = snapshot
    ? snapshot.studioName ||
      (snapshot.studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room')
    : request.requestedRoomLabel || '';

  return {
    customerName: String(request.customerName || '').trim(),
    bandName: String(request.bandName || '').trim(),
    requestReference: String(request.requestReference || '').trim(),
    serviceName,
    roomName,
    preferredDate: preferredDateFormatted,
    preferredTime: String(request.preferredTimeLabel || '').trim(),
    duration: confirmedDurationFormatted || preferredDurationFormatted,
    confirmedDate: confirmedDateFormatted,
    confirmedTime: confirmedTimeFormatted,
    confirmedEndTime: confirmedEndTimeFormatted,
    bookingReference: snapshot?.bookingReference || '',
    studioName: String(studioName || '37 Music Studio').trim(),
  };
}

/**
 * Inspects any text string (after template rendering or manual staff edits) for
 * unresolved `{variable}` placeholders.
 */
export function findUnresolvedPlaceholders(text = '') {
  const unresolved = [];
  const matches = String(text || '').matchAll(VARIABLE_PLACEHOLDER_PATTERN);
  for (const match of matches) {
    const token = match[1];
    if (!unresolved.includes(token)) {
      unresolved.push(token);
    }
  }
  return unresolved;
}

/**
 * Pure, safe string substitution engine (zero `eval()`).
 * Substitutes ONLY allowlisted variables that have non-empty values; leaves missing variables
 * highlighted in `missingVariables` so callers disable WhatsApp sending rather than shipping raw tokens.
 */
export function renderWhatsAppTemplate(templateBody = '', variablesMap = {}) {
  const missingVariables = [];
  const unknownVariables = [];
  const safeBody = String(templateBody || '');

  const renderedText = safeBody.replace(VARIABLE_PLACEHOLDER_PATTERN, (fullMatch, varName) => {
    if (!ALLOWLIST_SET.has(varName)) {
      if (!unknownVariables.includes(varName)) {
        unknownVariables.push(varName);
      }
      return fullMatch;
    }

    const replacement = variablesMap?.[varName];
    if (typeof replacement !== 'string' || replacement.trim().length === 0) {
      if (!missingVariables.includes(varName)) {
        missingVariables.push(varName);
      }
      return fullMatch;
    }

    return replacement;
  });

  const unresolvedVariables = Array.from(new Set([...missingVariables, ...unknownVariables]));

  return {
    renderedText,
    missingVariables,
    unknownVariables,
    unresolvedVariables,
    hasUnresolvedVariables: unresolvedVariables.length > 0,
  };
}
