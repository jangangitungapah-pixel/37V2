import {
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import { formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateMedium,
  getJakartaDateTimeParts,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';

const PENDING_REQUEST_STATUSES = new Set([
  BOOKING_REQUEST_STATUS.NEW,
  BOOKING_REQUEST_STATUS.IN_REVIEW,
  BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
  BOOKING_REQUEST_STATUS.ACCEPTED,
]);

/**
 * Resolves the authoritative customer-visible schedule from a Client Portal request record.
 * Confirmed requests use `confirmedBookingSnapshot` written atomically by `createBooking()`;
 * unconfirmed requests fall back to their requested studio preferences or project timeline.
 */
export function getEffectiveClientBookingSchedule(record) {
  if (!record || typeof record !== 'object') {
    return {
      isConfirmedSnapshot: false,
      isPostProduction: false,
      bookingReference: '',
      date: '',
      startMinute: null,
      endMinute: null,
      durationMinutes: null,
      targetDeadline: '',
      studioId: '',
      studioName: '',
      serviceTypeName: '',
      serviceOptionName: '',
    };
  }

  const reservation = record.clientReservation;
  if (reservation && isValidIsoDateString(reservation.date)) {
    const startMinute = Number.isInteger(Number(reservation.startMinute))
      ? Number(reservation.startMinute)
      : null;
    const durationMinutes = Number.isInteger(Number(reservation.durationMinutes))
      ? Number(reservation.durationMinutes)
      : null;
    const endMinute = Number.isInteger(Number(reservation.endMinute))
      ? Number(reservation.endMinute)
      : (
        startMinute !== null && durationMinutes !== null
          ? startMinute + durationMinutes
          : null
      );

    return {
      isConfirmedSnapshot: true,
      isPostProduction: false,
      bookingReference: String(reservation.bookingReference || '').trim(),
      date: reservation.date,
      startMinute,
      endMinute,
      durationMinutes,
      targetDeadline: '',
      studioId: String(reservation.studioId || '').trim(),
      studioName: String(reservation.studioName || '').trim(),
      serviceTypeName: String(reservation.serviceTypeName || '').trim(),
      serviceOptionName: String(reservation.serviceOptionName || '').trim(),
    };
  }

  const snap = record.confirmedBookingSnapshot;
  if (
    record.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
    snap &&
    isValidIsoDateString(snap.date)
  ) {
    const startMinute = Number.isInteger(Number(snap.startMinute)) ? Number(snap.startMinute) : 600;
    const durationMinutes = Number.isInteger(Number(snap.durationMinutes))
      ? Number(snap.durationMinutes)
      : 60;
    const endMinute = Number.isInteger(Number(snap.endMinute))
      ? Number(snap.endMinute)
      : startMinute + durationMinutes;

    return {
      isConfirmedSnapshot: true,
      isPostProduction: false,
      bookingReference: String(snap.bookingReference || '').trim(),
      date: snap.date,
      startMinute,
      endMinute,
      durationMinutes,
      targetDeadline: '',
      studioId: String(snap.studioId || 'room-a').trim(),
      studioName: String(
        snap.studioName ||
          (snap.studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room'),
      ).trim(),
      serviceTypeName: String(snap.serviceTypeName || record.serviceLabelSnapshot || '').trim(),
      serviceOptionName: String(snap.serviceOptionName || record.serviceOptionName || '').trim(),
    };
  }

  if (record.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY) {
    return {
      isConfirmedSnapshot: false,
      isPostProduction: true,
      bookingReference: '',
      date: '',
      startMinute: null,
      endMinute: null,
      durationMinutes: null,
      targetDeadline: isValidIsoDateString(record.targetDeadline) ? record.targetDeadline : '',
      studioId: '',
      studioName: '',
      serviceTypeName: String(record.serviceLabelSnapshot || '').trim(),
      serviceOptionName: String(record.serviceOptionName || '').trim(),
    };
  }

  const startMinute = Number.isInteger(Number(record.preferredStartMinute))
    ? Number(record.preferredStartMinute)
    : null;
  const durationMinutes = Number.isInteger(Number(record.preferredDurationMinutes))
    ? Number(record.preferredDurationMinutes)
    : null;
  const endMinute =
    startMinute !== null && durationMinutes !== null ? startMinute + durationMinutes : null;

  return {
    isConfirmedSnapshot: false,
    isPostProduction: false,
    bookingReference: '',
    date: isValidIsoDateString(record.preferredDate) ? record.preferredDate : '',
    startMinute,
    endMinute,
    durationMinutes,
    targetDeadline: '',
    studioId: String(record.requestedRoomId || 'any').trim(),
    studioName: String(record.requestedRoomLabel || 'No preference / Studio recommends').trim(),
    serviceTypeName: String(record.serviceLabelSnapshot || '').trim(),
    serviceOptionName: String(record.serviceOptionName || '').trim(),
  };
}

/**
 * Maps internal request workflow states to calm, customer-clear status badges and copy.
 */
export function getClientBookingStatusMeta(
  record,
  { isPastConfirmed = false, isInProgressWindow = false } = {},
) {
  const reservation = record?.clientReservation;
  if (reservation) {
    const reservationStatus = String(reservation.reservationStatus || 'confirmed');
    const sessionStatus = String(reservation.sessionStatus || 'upcoming');

    if (reservationStatus === 'expired') {
      return {
        label: 'Reservation Expired',
        tone: 'danger',
        helperText: 'This reservation hold expired and no longer occupies a studio slot.',
      };
    }
    if (reservationStatus === 'cancelled' || sessionStatus === 'cancelled') {
      return {
        label: 'Cancelled',
        tone: 'danger',
        helperText: 'This studio booking was cancelled.',
      };
    }
    if (sessionStatus === 'no_show') {
      return {
        label: 'No Show',
        tone: 'danger',
        helperText: 'The session was closed as a No Show.',
      };
    }
    if (sessionStatus === 'completed') {
      return {
        label: 'Completed',
        tone: 'neutral',
        helperText: 'Your studio session has been completed.',
      };
    }
    if (sessionStatus === 'in_progress') {
      return {
        label: 'In Session',
        tone: 'lime',
        helperText: 'Your studio session is currently in progress.',
      };
    }
    if (reservationStatus === 'deposit_hold') {
      return {
        label: 'Deposit Pending',
        tone: 'orange',
        helperText: 'Your time slot is temporarily held while the required deposit is pending.',
      };
    }
    if (isPastConfirmed) {
      return {
        label: 'Completed',
        tone: 'neutral',
        helperText: 'Confirmed studio session completed.',
      };
    }
    return {
      label: 'Confirmed',
      tone: 'emerald',
      helperText: 'Your studio room and time slot are confirmed.',
    };
  }

  const status = String(record?.status || BOOKING_REQUEST_STATUS.NEW).trim();

  if (status === BOOKING_REQUEST_STATUS.CONFIRMED) {
    if (isInProgressWindow) {
      return {
        label: 'In Session',
        tone: 'lime',
        helperText: 'Your studio session is currently in progress.',
      };
    }
    if (isPastConfirmed) {
      return {
        label: 'Completed',
        tone: 'neutral',
        helperText: 'Confirmed studio session completed.',
      };
    }
    return {
      label: 'Confirmed',
      tone: 'emerald',
      helperText: 'Your studio room and time slot are confirmed.',
    };
  }

  if (status === BOOKING_REQUEST_STATUS.IN_REVIEW) {
    return {
      label: 'In Review',
      tone: 'amber',
      helperText: 'Our team is currently reviewing your schedule or project details.',
    };
  }

  if (status === BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER) {
    return {
      label: 'Awaiting Reply',
      tone: 'ivory',
      helperText: 'Our team reached out via WhatsApp to finalize your details.',
    };
  }

  if (status === BOOKING_REQUEST_STATUS.ACCEPTED) {
    return {
      label: 'Approved · Finalizing',
      tone: 'lime',
      helperText: 'Request approved. Final calendar confirmation is being completed.',
    };
  }

  if (status === BOOKING_REQUEST_STATUS.DECLINED) {
    return {
      label: 'Declined',
      tone: 'danger',
      helperText:
        String(record?.statusReason || '').trim() || 'This request could not be accommodated.',
    };
  }

  if (status === BOOKING_REQUEST_STATUS.CLOSED) {
    return {
      label: 'Closed',
      tone: 'neutral',
      helperText: String(record?.statusReason || '').trim() || 'This request has been closed.',
    };
  }

  return {
    label: 'Pending Review',
    tone: 'orange',
    helperText: 'Received by our studio desk. We will verify availability shortly.',
  };
}

function getRecentActivityActionLabel(item, _view) {
  const status = String(item?.status || BOOKING_REQUEST_STATUS.NEW).trim();

  if (status === BOOKING_REQUEST_STATUS.CONFIRMED) {
    if (_view?.isInProgressWindow) return 'Session in progress';
    if (_view?.isPastConfirmed) return 'Session completed';
    return 'Session confirmed';
  }

  if (status === BOOKING_REQUEST_STATUS.IN_REVIEW) {
    return 'Request under review';
  }
  if (status === BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER) {
    return 'Waiting for your reply';
  }
  if (status === BOOKING_REQUEST_STATUS.ACCEPTED) {
    return 'Request approved · Finalizing schedule';
  }
  if (status === BOOKING_REQUEST_STATUS.DECLINED) {
    return 'Booking request declined';
  }
  if (status === BOOKING_REQUEST_STATUS.CLOSED) {
    return 'Booking request closed';
  }

  return 'Booking request sent';
}

function getLatestActivityMillis(record) {
  return Math.max(
    getTimestampMillis(record?.confirmedAt),
    getTimestampMillis(record?.updatedAt),
    getTimestampMillis(record?.createdAt),
  );
}

/**
 * Merges pending request workflow records with the canonical Client reservation projection.
 * A confirmed request is suppressed only after its matching reservation projection is present;
 * older confirmed requests remain visible as a backwards-compatible fallback.
 */
export function mergeClientBookingRecords({
  requests = [],
  reservations = [],
  maxLimit = 100,
} = {}) {
  const requestRecords = Array.isArray(requests) ? requests.filter(Boolean) : [];
  const reservationRecords = Array.isArray(reservations) ? reservations.filter(Boolean) : [];
  const requestsById = new Map(requestRecords.map((item) => [item.id, item]));
  const requestsByBookingId = new Map(
    requestRecords
      .filter((item) => item.linkedBookingId)
      .map((item) => [item.linkedBookingId, item]),
  );
  const consumedRequestIds = new Set();

  const projectedRecords = reservationRecords.map((reservation) => {
    const bookingId = String(reservation.bookingId || reservation.id || '').trim();
    const sourceRequestId = String(reservation.sourceRequestId || '').trim();
    const linkedRequest =
      (sourceRequestId ? requestsById.get(sourceRequestId) : null) ||
      requestsByBookingId.get(bookingId) ||
      null;

    if (linkedRequest?.id) consumedRequestIds.add(linkedRequest.id);

    return {
      ...(linkedRequest || {}),
      id: bookingId,
      source: 'client_reservation',
      requestReference: String(linkedRequest?.requestReference || '').trim(),
      requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
      status: BOOKING_REQUEST_STATUS.CONFIRMED,
      serviceLabelSnapshot: String(
        reservation.serviceTypeName || linkedRequest?.serviceLabelSnapshot || '',
      ).trim(),
      serviceOptionName: String(
        reservation.serviceOptionName || linkedRequest?.serviceOptionName || '',
      ).trim(),
      createdAt: reservation.createdAt || linkedRequest?.createdAt || null,
      confirmedAt: linkedRequest?.confirmedAt || reservation.createdAt || null,
      updatedAt: reservation.updatedAt || linkedRequest?.updatedAt || reservation.createdAt || null,
      linkedBookingId: bookingId,
      confirmedBookingSnapshot: {
        bookingId,
        bookingReference: String(reservation.bookingReference || '').trim(),
        studioId: String(reservation.studioId || '').trim(),
        studioName: String(reservation.studioName || '').trim(),
        serviceTypeName: String(reservation.serviceTypeName || '').trim(),
        serviceOptionName: String(reservation.serviceOptionName || '').trim(),
        date: String(reservation.date || ''),
        startMinute: reservation.startMinute,
        endMinute: reservation.endMinute,
        durationMinutes: reservation.durationMinutes,
      },
      clientReservation: reservation,
    };
  }).filter((record) => record.id);

  const unprojectedRequests = requestRecords.filter((record) => !consumedRequestIds.has(record.id));
  const merged = [...projectedRecords, ...unprojectedRequests].sort((a, b) => {
    const activityDiff = getLatestActivityMillis(b) - getLatestActivityMillis(a);
    if (activityDiff !== 0) return activityDiff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  const safeLimit = Math.max(1, Number(maxLimit) || 100);
  return {
    records: merged.slice(0, safeLimit),
    isTruncated: merged.length > safeLimit,
  };
}

/**
 * Classifies client portal booking records into Upcoming Sessions, Booking Requests,
 * History, Next Session spotlight, and Recent Activity feed using Asia/Jakarta time.
 */
export function classifyClientBookings(records = [], now = new Date()) {
  const { dateIso: todayIso, minuteOfDay } = getJakartaDateTimeParts(now);

  const items = [];
  const upcoming = [];
  const requests = [];
  const history = [];

  for (const record of records || []) {
    if (!record || typeof record !== 'object' || !record.id) continue;

    const schedule = getEffectiveClientBookingSchedule(record);
    const status = String(record.status || BOOKING_REQUEST_STATUS.NEW).trim();

    if (record.clientReservation) {
      const reservationStatus = String(record.clientReservation.reservationStatus || 'confirmed');
      const sessionStatus = String(record.clientReservation.sessionStatus || 'upcoming');
      const isTerminal =
        ['expired', 'cancelled'].includes(reservationStatus) ||
        ['completed', 'no_show', 'cancelled'].includes(sessionStatus);
      const hasValidConfirmedWindow =
        Boolean(schedule.date) &&
        Number.isInteger(schedule.startMinute) &&
        Number.isInteger(schedule.endMinute);
      const isUpcoming =
        !isTerminal &&
        hasValidConfirmedWindow &&
        (
          schedule.date > todayIso ||
          (schedule.date === todayIso && schedule.endMinute > minuteOfDay)
        );

      if (isUpcoming) {
        const isToday = schedule.date === todayIso;
        const isInProgressWindow =
          sessionStatus === 'in_progress' ||
          (isToday && minuteOfDay >= schedule.startMinute && minuteOfDay < schedule.endMinute);
        const enriched = {
          ...record,
          _view: {
            group: 'upcoming',
            schedule,
            isPastConfirmed: false,
            isToday,
            isInProgressWindow,
            statusMeta: getClientBookingStatusMeta(record, {
              isPastConfirmed: false,
              isInProgressWindow,
            }),
          },
        };
        items.push(enriched);
        upcoming.push(enriched);
      } else {
        const enriched = {
          ...record,
          _view: {
            group: 'history',
            schedule,
            isPastConfirmed: sessionStatus === 'completed' || schedule.date < todayIso,
            isToday: false,
            isInProgressWindow: false,
            statusMeta: getClientBookingStatusMeta(record, {
              isPastConfirmed: sessionStatus === 'completed' || schedule.date < todayIso,
              isInProgressWindow: false,
            }),
          },
        };
        items.push(enriched);
        history.push(enriched);
      }
      continue;
    }

    if (status === BOOKING_REQUEST_STATUS.CONFIRMED) {
      const hasValidConfirmedWindow =
        Boolean(schedule.date) &&
        Number.isInteger(schedule.startMinute) &&
        Number.isInteger(schedule.endMinute);

      const isUpcoming =
        hasValidConfirmedWindow &&
        (schedule.date > todayIso ||
          (schedule.date === todayIso && schedule.endMinute > minuteOfDay));

      if (isUpcoming) {
        const isToday = schedule.date === todayIso;
        const isInProgressWindow =
          isToday && minuteOfDay >= schedule.startMinute && minuteOfDay < schedule.endMinute;
        const statusMeta = getClientBookingStatusMeta(record, {
          isPastConfirmed: false,
          isInProgressWindow,
        });
        const enriched = {
          ...record,
          _view: {
            group: 'upcoming',
            schedule,
            isPastConfirmed: false,
            isToday,
            isInProgressWindow,
            statusMeta,
          },
        };
        items.push(enriched);
        upcoming.push(enriched);
      } else {
        const statusMeta = getClientBookingStatusMeta(record, {
          isPastConfirmed: true,
          isInProgressWindow: false,
        });
        const enriched = {
          ...record,
          _view: {
            group: 'history',
            schedule,
            isPastConfirmed: true,
            isToday: false,
            isInProgressWindow: false,
            statusMeta,
          },
        };
        items.push(enriched);
        history.push(enriched);
      }
      continue;
    }

    if (PENDING_REQUEST_STATUSES.has(status)) {
      const statusMeta = getClientBookingStatusMeta(record);
      const enriched = {
        ...record,
        _view: {
          group: 'requests',
          schedule,
          isPastConfirmed: false,
          isToday: false,
          isInProgressWindow: false,
          statusMeta,
        },
      };
      items.push(enriched);
      requests.push(enriched);
      continue;
    }

    const statusMeta = getClientBookingStatusMeta(record);
    const enriched = {
      ...record,
      _view: {
        group: 'history',
        schedule,
        isPastConfirmed: false,
        isToday: false,
        isInProgressWindow: false,
        statusMeta,
      },
    };
    items.push(enriched);
    history.push(enriched);
  }

  upcoming.sort((a, b) => {
    const dateCmp = String(a._view.schedule.date).localeCompare(String(b._view.schedule.date));
    if (dateCmp !== 0) return dateCmp;
    const minDiff =
      (Number(a._view.schedule.startMinute) || 0) - (Number(b._view.schedule.startMinute) || 0);
    if (minDiff !== 0) return minDiff;
    return String(a.requestReference || a.id).localeCompare(String(b.requestReference || b.id));
  });

  requests.sort((a, b) => {
    const diff =
      getTimestampMillis(b.createdAt || b.updatedAt) -
      getTimestampMillis(a.createdAt || a.updatedAt);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });

  history.sort((a, b) => {
    const timeDiff = getLatestActivityMillis(b) - getLatestActivityMillis(a);
    if (timeDiff !== 0) return timeDiff;
    const dateCmp = String(b._view.schedule.date || '').localeCompare(
      String(a._view.schedule.date || ''),
    );
    if (dateCmp !== 0) return dateCmp;
    return String(b.id).localeCompare(String(a.id));
  });

  const nextSession = upcoming[0] || null;

  const recentActivity = [...items]
    .sort((a, b) => {
      const timeDiff = getLatestActivityMillis(b) - getLatestActivityMillis(a);
      if (timeDiff !== 0) return timeDiff;
      return String(b.id).localeCompare(String(a.id));
    })
    .slice(0, 5)
    .map((item) => {
      const { schedule, statusMeta, group } = item._view;
      const serviceTitle = schedule.serviceOptionName
        ? `${schedule.serviceTypeName || item.serviceLabelSnapshot} · ${schedule.serviceOptionName}`
        : schedule.serviceTypeName || item.serviceLabelSnapshot || 'Studio Session';

      let subtitle = statusMeta.label;
      if (item.status === BOOKING_REQUEST_STATUS.CONFIRMED && schedule.date) {
        const dateLabel = formatIndonesianDateMedium(schedule.date) || schedule.date;
        const timeRangeLabel =
          Number.isInteger(schedule.startMinute) && Number.isInteger(schedule.endMinute)
            ? formatMinuteRange(schedule.startMinute, schedule.endMinute)
            : '';
        subtitle = [dateLabel, timeRangeLabel, schedule.studioName].filter(Boolean).join(' · ');
      } else if (schedule.isPostProduction) {
        subtitle = schedule.targetDeadline
          ? `Mix & Master project · Target ${formatIndonesianDateMedium(schedule.targetDeadline) || schedule.targetDeadline}`
          : 'Mix & Master project inquiry';
      } else if (schedule.date) {
        const requestedDateLabel = formatIndonesianDateMedium(schedule.date) || schedule.date;
        subtitle = schedule.studioName
          ? `Requested for ${requestedDateLabel} · ${schedule.studioName}`
          : `Requested for ${requestedDateLabel}`;
      }

      const isConfirmed = item.status === BOOKING_REQUEST_STATUS.CONFIRMED;
      const timestampValue = isConfirmed
        ? item.confirmedAt || item.updatedAt || item.createdAt
        : item.updatedAt || item.createdAt;

      return {
        id: item.id,
        requestReference: item.requestReference,
        bookingReference: schedule.bookingReference || '',
        bandName: String(item.bandName || '').trim(),
        actionLabel: getRecentActivityActionLabel(item, item._view),
        title: serviceTitle,
        subtitle,
        statusMeta,
        timestampPrefix: isConfirmed ? 'Confirmed' : 'Updated',
        timestampValue,
        group,
      };
    });

  return {
    items,
    upcoming,
    requests,
    history,
    nextSession,
    recentActivity,
    counts: {
      all: items.length,
      upcoming: upcoming.length,
      requests: requests.length,
      history: history.length,
    },
  };
}
