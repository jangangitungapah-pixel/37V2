import {
  BOOKING_REQUEST_ACTIVITY_TYPES,
  BOOKING_REQUEST_CONSENT_VERSION,
  BOOKING_REQUEST_SCHEMA_VERSION,
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  PUBLIC_MIN_ELAPSED_MS,
  PUBLIC_SUBMIT_COOLDOWN_MS,
} from '../config/booking-request-config';
import {
  createBookingRequestRepositoryError,
  getBookingRequestRepositoryAdapter,
} from '../repositories/booking-request-repository';
import {
  deriveRequestReferenceFromId,
  generateBookingRequestId,
} from '../utils/booking-request-normalize';
import {
  canTransitionBookingRequestStatus,
  validatePublicBookingRequestInput,
} from '../utils/booking-request-validation';

let lastSuccessfulPublicSubmitAtMs = 0;

export function generateActivityId(prefix = 'act') {
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomUuid}`;
}

export function resetPublicSubmissionCooldownForTests() {
  lastSuccessfulPublicSubmitAtMs = 0;
}

/**
 * Evaluates lightweight client-side anti-spam protections (honeypot, form render dwell time,
 * and client submission cooldown). Documented honestly as UI abuse friction only — real enforcement
 * rests on Firestore Rules + App Check.
 */
export function evaluateSubmissionAbuseGuards({
  honeypotValue = '',
  formOpenedAtMs = 0,
  minElapsedMs = PUBLIC_MIN_ELAPSED_MS,
  cooldownMs = PUBLIC_SUBMIT_COOLDOWN_MS,
  nowMs = Date.now(),
} = {}) {
  if (String(honeypotValue || '').trim().length > 0) {
    return {
      allowed: false,
      code: 'booking-request/spam-detected',
      message: 'Unable to process request. Please reload the page and try submitting manually.',
    };
  }

  if (minElapsedMs > 0 && formOpenedAtMs > 0 && nowMs - formOpenedAtMs < minElapsedMs) {
    return {
      allowed: false,
      code: 'booking-request/submitted-too-fast',
      message: 'Please take a moment to review your request before submitting.',
    };
  }

  if (
    cooldownMs > 0 &&
    lastSuccessfulPublicSubmitAtMs > 0 &&
    nowMs - lastSuccessfulPublicSubmitAtMs < cooldownMs
  ) {
    const remainingSeconds = Math.max(
      1,
      Math.ceil((cooldownMs - (nowMs - lastSuccessfulPublicSubmitAtMs)) / 1000),
    );
    return {
      allowed: false,
      code: 'booking-request/cooldown-active',
      message: `Please wait ${remainingSeconds} seconds before sending another request.`,
    };
  }

  return { allowed: true, code: '', message: '' };
}

export function mapBookingRequestErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'permission-denied' || code === 'unauthenticated') {
    return 'Request could not be submitted due to security verification or permissions. Please refresh the page and try again.';
  }

  if (code === 'unavailable' || code === 'network-request-failed') {
    return 'Network connection interrupted. Please check your internet connection and retry.';
  }

  if (code === 'booking-request/stale-update') {
    return (
      error?.message ||
      'Request telah diperbarui di sesi lain. Muat ulang data terbaru sebelum mencoba lagi.'
    );
  }

  if (code.startsWith('booking-request/') && error?.message) {
    return error.message;
  }

  return 'Unable to save your booking request right now. Please try again.';
}

/**
 * Validates, normalizes, and persists an unauthenticated public booking request
 * (`studio_booking` or `post_production_inquiry`) to `publicBookingRequests/{requestId}`.
 * Never fabricates confirmation or creates canonical Calendar bookings.
 */
export async function submitPublicBookingRequest({
  input,
  requestId = generateBookingRequestId(),
  source = BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE,
  honeypotValue = '',
  formOpenedAtMs = 0,
  minElapsedMs = PUBLIC_MIN_ELAPSED_MS,
  cooldownMs = PUBLIC_SUBMIT_COOLDOWN_MS,
  now = new Date(),
  adapter = null,
}) {
  const guardResult = evaluateSubmissionAbuseGuards({
    honeypotValue,
    formOpenedAtMs,
    minElapsedMs,
    cooldownMs,
    nowMs: now.getTime(),
  });
  if (!guardResult.allowed) {
    throw createBookingRequestRepositoryError(guardResult.code, guardResult.message);
  }

  const validation = validatePublicBookingRequestInput(input, { now });
  if (!validation.isValid) {
    const firstMsg =
      Object.values(validation.errors)[0] || 'Please review the highlighted request fields.';
    throw createBookingRequestRepositoryError('booking-request/validation-error', firstMsg, {
      errors: validation.errors,
    });
  }

  const resolvedSource = Object.values(BOOKING_REQUEST_SOURCES).includes(source)
    ? source
    : BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE;

  const v = validation.data;
  const payload = {
    schemaVersion: BOOKING_REQUEST_SCHEMA_VERSION,
    requestReference: deriveRequestReferenceFromId(requestId),
    requestType: v.requestType,
    status: BOOKING_REQUEST_STATUS.NEW,
    statusReason: '',
    customerName: v.customerName,
    bandName: v.bandName,
    contactPhone: v.contactPhone,
    publicServiceId: v.publicServiceId,
    serviceLabelSnapshot: v.serviceLabelSnapshot,
    requestedRoomId: v.requestedRoomId,
    preferredDate: v.preferredDate,
    preferredStartMinute: v.preferredStartMinute,
    preferredDurationMinutes: v.preferredDurationMinutes,
    targetDeadline: v.targetDeadline,
    notes: v.notes,
    privacyConsent: true,
    consentVersion: BOOKING_REQUEST_CONSENT_VERSION,
    source: resolvedSource,
    assignedStaffUid: '',
    assignedStaffName: '',
    lastCommunicationAt: null,
    lastCommunicationType: '',
    lastCommunicationStatus: '',
    linkedBookingId: null,
    confirmedBookingSnapshot: null,
    confirmedAt: null,
    confirmedByUid: '',
    appCheckState: 'unconfigured',
    updatedByUid: '',
    version: 1,
  };

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const created = await resolvedAdapter.createPublicBookingRequest({ requestId, payload });
  lastSuccessfulPublicSubmitAtMs = Date.now();
  return created;
}

/**
 * Transitions a booking request through its controlled Admin Inbox lifecycle
 * with optimistic concurrency (`expectedVersion`) and immutable activity logging.
 */
export async function transitionBookingRequestStatus({
  requestId,
  expectedVersion,
  nextStatus,
  reason = '',
  actorUid,
  actorName = '',
  adapter = null,
}) {
  if (!actorUid) {
    throw createBookingRequestRepositoryError(
      'booking-request/unauthenticated',
      'Sesi staff tidak valid. Silakan login kembali.',
    );
  }

  const cleanReason = String(reason || '').trim();
  if (
    (nextStatus === BOOKING_REQUEST_STATUS.DECLINED ||
      nextStatus === BOOKING_REQUEST_STATUS.CLOSED) &&
    cleanReason.length < 3
  ) {
    throw createBookingRequestRepositoryError(
      'booking-request/reason-required',
      'Alasan penolakan atau penutupan wajib diisi minimal 3 karakter.',
    );
  }

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const activityId = generateActivityId('act');

  return resolvedAdapter.runWorkflowUpdateTransaction({
    requestId,
    expectedVersion,
    actorUid,
    activityId,
    buildNextState: ({ current }) => {
      const eligibility = canTransitionBookingRequestStatus({
        request: current,
        nextStatus,
        viaCanonicalBookingTransaction: false,
      });
      if (!eligibility.allowed) {
        throw createBookingRequestRepositoryError(
          'booking-request/invalid-transition',
          eligibility.reason,
        );
      }

      return {
        parentPatch: {
          status: nextStatus,
          statusReason: cleanReason || current.statusReason || '',
          assignedStaffUid: current.assignedStaffUid || actorUid,
          assignedStaffName: current.assignedStaffName || actorName || '',
        },
        activityDoc: {
          eventType: BOOKING_REQUEST_ACTIVITY_TYPES.STATUS_CHANGED,
          fromStatus: current.status,
          toStatus: nextStatus,
          linkedBookingId: null,
          note: cleanReason
            ? `Status diubah ke ${nextStatus}: ${cleanReason}`
            : `Status diubah dari ${current.status} ke ${nextStatus}.`,
          actorUid,
          actorName: actorName || '',
        },
      };
    },
  });
}

export async function assignBookingRequestStaff({
  requestId,
  expectedVersion,
  actorUid,
  actorName = '',
  adapter = null,
}) {
  if (!actorUid) {
    throw createBookingRequestRepositoryError(
      'booking-request/unauthenticated',
      'Sesi staff tidak valid.',
    );
  }

  const resolvedAdapter = adapter || getBookingRequestRepositoryAdapter();
  const activityId = generateActivityId('act');

  return resolvedAdapter.runWorkflowUpdateTransaction({
    requestId,
    expectedVersion,
    actorUid,
    activityId,
    buildNextState: () => ({
      parentPatch: {
        assignedStaffUid: actorUid,
        assignedStaffName: actorName || '',
      },
      activityDoc: {
        eventType: BOOKING_REQUEST_ACTIVITY_TYPES.STAFF_ASSIGNED,
        fromStatus: null,
        toStatus: null,
        linkedBookingId: null,
        note: `Ditangani oleh ${actorName || actorUid}.`,
        actorUid,
        actorName: actorName || '',
      },
    }),
  });
}
