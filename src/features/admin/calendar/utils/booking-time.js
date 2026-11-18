import {
  BOOKING_SESSION_STATUS,
  NO_SHOW_GRACE_MINUTES,
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
} from '../config/calendar-config';
import { getJakartaSlotEpochMs, isValidIsoDateString } from './calendar-date';

/**
 * Formats a minute-of-day integer (e.g. `600`, `630`) into `HH:MM` (e.g. `10:00`, `10:30`).
 */
export function formatMinuteOfDay(minuteOfDay) {
  const numeric = Number(minuteOfDay);
  if (!Number.isFinite(numeric) || numeric < 0) return '--:--';

  const rounded = Math.round(numeric);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Formats a start and end minute into `10:00 – 12:00 WIB`.
 */
export function formatMinuteRange(startMinute, endMinute, includeZone = true) {
  const startLabel = formatMinuteOfDay(startMinute);
  const endLabel = formatMinuteOfDay(endMinute);
  return includeZone ? `${startLabel} – ${endLabel} WIB` : `${startLabel} – ${endLabel}`;
}

/**
 * Formats a duration in minutes into a human-friendly Indonesian label.
 */
export function formatDurationMinutes(durationMinutes) {
  const mins = Number(durationMinutes);
  if (!Number.isFinite(mins) || mins <= 0) return '0 menit';

  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;

  if (hours > 0 && remainder === 0) {
    return `${hours} jam`;
  }

  if (hours === 0) {
    return `${remainder} menit`;
  }

  return `${hours} jam ${remainder} mnt`;
}

/**
 * Validates that a booking's start time and duration obey studio operating rules:
 * - Start >= 10:00 (600)
 * - End <= 23:00 (1380)
 * - Duration > 0 and a multiple of 30 minutes
 * - Start is aligned on a 30-minute boundary
 */
export function validateBookingWindow({ startMinute, durationMinutes }) {
  const start = Number(startMinute);
  const duration = Number(durationMinutes);

  if (!Number.isInteger(start)) {
    return {
      isValid: false,
      code: 'booking/invalid-start-time',
      message: 'Jam mulai harus berupa waktu yang valid dalam kelipatan 30 menit.',
    };
  }

  if (!Number.isInteger(duration) || duration <= 0) {
    return {
      isValid: false,
      code: 'booking/invalid-duration',
      message: 'Durasi sesi harus lebih dari 0 menit.',
    };
  }

  if (duration % SLOT_INTERVAL_MINUTES !== 0) {
    return {
      isValid: false,
      code: 'booking/invalid-duration-step',
      message: 'Durasi sesi wajib menggunakan kelipatan 30 menit (contoh: 60, 90, 120 menit).',
    };
  }

  if (start % SLOT_INTERVAL_MINUTES !== 0) {
    return {
      isValid: false,
      code: 'booking/invalid-start-step',
      message: 'Jam mulai wajib berada pada interval 30 menit (contoh: 10:00 atau 10:30).',
    };
  }

  if (start < OPERATING_START_MINUTE) {
    return {
      isValid: false,
      code: 'booking/before-operating-hours',
      message: `Jam mulai tidak boleh sebelum jam operasional studio (${formatMinuteOfDay(OPERATING_START_MINUTE)} WIB).`,
    };
  }

  const end = start + duration;
  if (end > OPERATING_END_MINUTE) {
    return {
      isValid: false,
      code: 'booking/after-operating-hours',
      message: `Waktu selesai (${formatMinuteOfDay(end)} WIB) melewati jam tutup operasional (${formatMinuteOfDay(OPERATING_END_MINUTE)} WIB).`,
    };
  }

  return {
    isValid: true,
    startMinute: start,
    durationMinutes: duration,
    endMinute: end,
  };
}

/**
 * Canonical interval overlap formula:
 * Two half-open intervals [start1, end1) and [start2, end2) overlap iff:
 * `max(start1, start2) < min(end1, end2)`
 *
 * Adjacent bookings (e.g. 10:00–12:00 and 12:00–14:00) do NOT overlap.
 */
export function doTimeIntervalsOverlap(start1, end1, start2, end2) {
  const s1 = Number(start1);
  const e1 = Number(end1);
  const s2 = Number(start2);
  const e2 = Number(end2);

  if (
    !Number.isFinite(s1) ||
    !Number.isFinite(e1) ||
    !Number.isFinite(s2) ||
    !Number.isFinite(e2)
  ) {
    return false;
  }

  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Single domain source of truth for checking whether a candidate booking conflicts
 * with an existing booking record.
 */
export function doesBookingConflict(candidate, existingBooking) {
  if (!candidate || !existingBooking) return false;

  // Cancelled or no-show released bookings do not block new bookings
  if (
    existingBooking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
    existingBooking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
  ) {
    return false;
  }

  // Exclude self when editing or rescheduling an existing booking
  const candidateId = candidate.bookingId || candidate.id || '';
  const existingId = existingBooking.id || existingBooking.bookingId || '';
  if (candidateId && existingId && candidateId === existingId) {
    return false;
  }

  // Conflicts only occur on the exact same date and exact same studio room
  if (String(candidate.date || '') !== String(existingBooking.date || '')) {
    return false;
  }

  if (String(candidate.studioId || '') !== String(existingBooking.studioId || '')) {
    return false;
  }

  const candidateStart = Number(candidate.startMinute);
  const candidateEnd = Number.isFinite(Number(candidate.endMinute))
    ? Number(candidate.endMinute)
    : candidateStart + Number(candidate.durationMinutes || 0);

  const existingStart = Number(existingBooking.startMinute);
  const existingEnd = Number.isFinite(Number(existingBooking.endMinute))
    ? Number(existingBooking.endMinute)
    : existingStart + Number(existingBooking.durationMinutes || 0);

  return doTimeIntervalsOverlap(candidateStart, candidateEnd, existingStart, existingEnd);
}

/**
 * Finds all active bookings that conflict with the candidate schedule.
 */
export function findConflictingBookings(candidate, existingBookings = []) {
  if (!Array.isArray(existingBookings) || existingBookings.length === 0) {
    return [];
  }

  return existingBookings
    .filter((existing) => doesBookingConflict(candidate, existing))
    .sort((a, b) => Number(a.startMinute) - Number(b.startMinute));
}

/**
 * Generates deterministic 30-minute slot start minutes for a booking window.
 * Example: startMinute=600 (10:00), durationMinutes=120 (2h) -> [600, 630, 660, 690]
 */
export function buildSlotStartMinutes(startMinute, durationMinutes) {
  const validation = validateBookingWindow({ startMinute, durationMinutes });
  if (!validation.isValid) {
    return [];
  }

  const slots = [];
  for (
    let cursor = validation.startMinute;
    cursor < validation.endMinute;
    cursor += SLOT_INTERVAL_MINUTES
  ) {
    slots.push(cursor);
  }
  return slots;
}

/**
 * Builds the deterministic document ID for `bookingSlots/{slotId}`:
 * `{date}__{studioId}__{slotStartMinute}`
 */
export function buildDeterministicSlotId(date, studioId, slotStartMinute) {
  return `${String(date).trim()}__${String(studioId).trim()}__${Number(slotStartMinute)}`;
}

/**
 * Builds the full array of deterministic slot lock records for a booking.
 */
export function buildBookingSlotRecords({
  bookingId,
  date,
  studioId,
  startMinute,
  durationMinutes,
}) {
  const slotMinutes = buildSlotStartMinutes(startMinute, durationMinutes);
  return slotMinutes.map((slotStartMinute) => ({
    id: buildDeterministicSlotId(date, studioId, slotStartMinute),
    bookingId: String(bookingId).trim(),
    date: String(date).trim(),
    studioId: String(studioId).trim(),
    slotStartMinute,
  }));
}

/**
 * Computes non-overlapping side-by-side layout columns (`columnIndex`, `totalColumns`)
 * for bookings within a single day/room track so historical or overlapping records
 * are always visible and never obscure each other.
 */
export function computeTimelineOverlapLayout(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return [];
  }

  const sorted = [...bookings].sort((a, b) => {
    const startDiff = Number(a.startMinute) - Number(b.startMinute);
    if (startDiff !== 0) return startDiff;
    const durDiff = Number(b.durationMinutes) - Number(a.durationMinutes);
    if (durDiff !== 0) return durDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  // Partition into connected overlap clusters
  const clusters = [];
  let currentCluster = [];
  let clusterMaxEnd = -1;

  for (const item of sorted) {
    const start = Number(item.startMinute) || OPERATING_START_MINUTE;
    const end = Number.isFinite(Number(item.endMinute))
      ? Number(item.endMinute)
      : start + (Number(item.durationMinutes) || SLOT_INTERVAL_MINUTES);

    if (currentCluster.length === 0 || start < clusterMaxEnd) {
      currentCluster.push({ item, start, end });
      clusterMaxEnd = Math.max(clusterMaxEnd, end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [{ item, start, end }];
      clusterMaxEnd = end;
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const positioned = [];

  for (const cluster of clusters) {
    const columnsEndMinute = [];
    const clusterAssignments = [];

    for (const entry of cluster) {
      let assignedCol = -1;
      for (let colIdx = 0; colIdx < columnsEndMinute.length; colIdx++) {
        if (columnsEndMinute[colIdx] <= entry.start) {
          assignedCol = colIdx;
          columnsEndMinute[colIdx] = entry.end;
          break;
        }
      }

      if (assignedCol === -1) {
        assignedCol = columnsEndMinute.length;
        columnsEndMinute.push(entry.end);
      }

      clusterAssignments.push({
        booking: entry.item,
        columnIndex: assignedCol,
      });
    }

    const totalColumns = Math.max(1, columnsEndMinute.length);
    for (const assigned of clusterAssignments) {
      positioned.push({
        booking: assigned.booking,
        columnIndex: assigned.columnIndex,
        totalColumns,
      });
    }
  }

  return positioned;
}

/**
 * Determines whether a booking is eligible to be marked as `no_show`.
 * Requirements:
 * - Current `sessionStatus` is `upcoming`
 * - Customer has NOT checked in (`!booking.checkedInAt`)
 * - Scheduled start time in Asia/Jakarta + 15-minute grace period has passed
 */
export function isBookingNoShowEligible(booking, now = new Date()) {
  if (!booking || booking.sessionStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
    return false;
  }

  if (booking.checkedInAt) {
    return false;
  }

  if (!isValidIsoDateString(booking.date) || !Number.isFinite(Number(booking.startMinute))) {
    return false;
  }

  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const scheduledStartMs = getJakartaSlotEpochMs(booking.date, Number(booking.startMinute));
  if (Number.isNaN(scheduledStartMs)) {
    return false;
  }

  return safeNow.getTime() >= scheduledStartMs + NO_SHOW_GRACE_MINUTES * 60_000;
}

/**
 * Evaluates which session lifecycle actions are currently allowed for a booking.
 */
export function getBookingLifecycleCapabilities(booking, now = new Date()) {
  if (!booking) {
    return {
      canCheckIn: false,
      canStart: false,
      canComplete: false,
      canMarkNoShow: false,
      canCancel: false,
      canEditOrReschedule: false,
      noShowReason: 'Booking tidak ditemukan.',
    };
  }

  const status = booking.sessionStatus || BOOKING_SESSION_STATUS.UPCOMING;
  const hasCheckedIn = Boolean(booking.checkedInAt);
  const noShowEligible = isBookingNoShowEligible(booking, now);

  let noShowReason = '';
  if (status !== BOOKING_SESSION_STATUS.UPCOMING) {
    noShowReason = 'No Show hanya berlaku untuk booking dengan status Upcoming.';
  } else if (hasCheckedIn) {
    noShowReason = 'Customer sudah melakukan check-in sehingga tidak dapat ditandai No Show.';
  } else if (!noShowEligible) {
    noShowReason = `No Show baru dapat dilakukan setelah melewati waktu mulai + grace period ${NO_SHOW_GRACE_MINUTES} menit tanpa check-in.`;
  }

  return {
    canCheckIn: status === BOOKING_SESSION_STATUS.UPCOMING && !hasCheckedIn,
    canStart: status === BOOKING_SESSION_STATUS.UPCOMING,
    canComplete: status === BOOKING_SESSION_STATUS.IN_PROGRESS,
    canMarkNoShow: noShowEligible,
    canCancel:
      status === BOOKING_SESSION_STATUS.UPCOMING || status === BOOKING_SESSION_STATUS.IN_PROGRESS,
    canEditOrReschedule:
      status === BOOKING_SESSION_STATUS.UPCOMING || status === BOOKING_SESSION_STATUS.IN_PROGRESS,
    noShowReason,
  };
}
