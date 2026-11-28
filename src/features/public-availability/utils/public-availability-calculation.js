/**
 * Pure Sanitization, Time-Slot & Availability Calculation Engine for `/availability`.
 *
 * Uses `Asia/Jakarta` (`WIB`, UTC+7), 30-minute slot granularity, and the full
 * `10:00`–`23:00` studio operating window (`600`–`1380`).
 */

import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import {
  doTimeIntervalsOverlap,
  formatMinuteOfDay,
  formatMinuteRange,
  validateBookingWindow,
} from '@/features/admin/calendar/utils/booking-time';
import {
  addDaysToIsoDate,
  formatIndonesianDateCompact,
  formatIndonesianDateFull,
  getJakartaDateTimeParts,
  getJakartaTodayIso,
  getWeekStartIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  PUBLIC_AVAILABILITY_ALLOWED_KEYS,
  PUBLIC_AVAILABILITY_SCHEMA_VERSION,
  PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  PUBLIC_OPERATING_END_MINUTE,
  PUBLIC_OPERATING_START_MINUTE,
  PUBLIC_SLOT_INTERVAL_MINUTES,
  PUBLIC_SLOT_STATES,
  PUBLIC_STUDIO_ROOMS,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';

/**
 * Checks whether a canonical booking record currently holds active room occupancy locks.
 * Cancelled and no-show bookings release their locks and must NOT project as occupied.
 */
export function isBookingOccupyingPublicRoom(booking) {
  if (!booking || typeof booking !== 'object') return false;
  if (
    booking.reservationStatus === 'expired' ||
    booking.reservationStatus === 'cancelled' ||
    booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
    booking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
  ) {
    return false;
  }

  const studioId = String(booking.studioId || '').trim();
  if (studioId !== 'room-a' && studioId !== 'room-b') {
    return false;
  }

  if (!isValidIsoDateString(String(booking.date || '').trim())) {
    return false;
  }

  const startMinute = Number(booking.startMinute);
  const endMinute = Number.isFinite(Number(booking.endMinute))
    ? Number(booking.endMinute)
    : startMinute + Number(booking.durationMinutes || 0);

  return (
    Number.isInteger(startMinute) &&
    Number.isInteger(endMinute) &&
    startMinute >= PUBLIC_OPERATING_START_MINUTE &&
    endMinute <= PUBLIC_OPERATING_END_MINUTE &&
    endMinute > startMinute &&
    startMinute % PUBLIC_SLOT_INTERVAL_MINUTES === 0 &&
    endMinute % PUBLIC_SLOT_INTERVAL_MINUTES === 0
  );
}

/**
 * Builds a strictly sanitized 6-field `publicAvailability` document payload from a
 * canonical booking record.
 *
 * Security guarantee:
 * - Contains ONLY `schemaVersion`, `date`, `studioId`, `startMinute`, `endMinute`, `updatedAt`.
 * - Never includes `bookingId`, `customerName`, `bandName`, `phone`, `customerId`, `notes`,
 *   `serviceId`, pricing, invoice, payment, or staff metadata.
 */
export function buildPublicAvailabilityProjectionFromBooking(booking, updatedAtValue = null) {
  if (!isBookingOccupyingPublicRoom(booking)) {
    return null;
  }

  const startMinute = Number(booking.startMinute);
  const endMinute = Number.isFinite(Number(booking.endMinute))
    ? Number(booking.endMinute)
    : startMinute + Number(booking.durationMinutes || 0);

  return {
    schemaVersion: PUBLIC_AVAILABILITY_SCHEMA_VERSION,
    date: String(booking.date).trim(),
    studioId: String(booking.studioId).trim(),
    startMinute,
    endMinute,
    updatedAt: updatedAtValue,
  };
}

/**
 * Validates and normalizes a raw `publicAvailability` projection document read from Firestore.
 * Strips any unexpected fields and returns `null` if the record violates interval boundaries.
 */
export function normalizePublicAvailabilityRecord(docId, raw = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const date = String(raw.date || '').trim();
  const studioId = String(raw.studioId || '').trim();
  const startMinute = Number(raw.startMinute);
  const endMinute = Number(raw.endMinute);

  if (!isValidIsoDateString(date)) return null;
  if (studioId !== 'room-a' && studioId !== 'room-b') return null;
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < PUBLIC_OPERATING_START_MINUTE ||
    endMinute > PUBLIC_OPERATING_END_MINUTE ||
    endMinute <= startMinute ||
    startMinute % PUBLIC_SLOT_INTERVAL_MINUTES !== 0 ||
    endMinute % PUBLIC_SLOT_INTERVAL_MINUTES !== 0
  ) {
    return null;
  }

  return {
    id: String(docId || ''),
    schemaVersion: PUBLIC_AVAILABILITY_SCHEMA_VERSION,
    date,
    studioId,
    startMinute,
    endMinute,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Verifies that a raw projection payload contains ONLY the 6 allowed keys.
 */
export function hasOnlySanitizedPublicAvailabilityKeys(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const keys = Object.keys(payload);
  if (keys.length !== PUBLIC_AVAILABILITY_ALLOWED_KEYS.length) return false;
  return keys.every((k) => PUBLIC_AVAILABILITY_ALLOWED_KEYS.includes(k));
}

/**
 * Normalizes the `publicAvailabilityMetadata/status` readiness document.
 */
export function normalizePublicAvailabilityMetadata(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return {
      exists: false,
      schemaVersion: PUBLIC_AVAILABILITY_SCHEMA_VERSION,
      isReady: false,
      backfilledFromDate: '',
      backfillCompletedAt: null,
      updatedAt: null,
    };
  }

  return {
    exists: true,
    schemaVersion: Number(raw.schemaVersion) || PUBLIC_AVAILABILITY_SCHEMA_VERSION,
    isReady: raw.isReady === true,
    backfilledFromDate: isValidIsoDateString(String(raw.backfilledFromDate || '').trim())
      ? String(raw.backfilledFromDate).trim()
      : '',
    backfillCompletedAt: raw.backfillCompletedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Generates all 26 30-minute time slot start minutes between `10:00` (600) and `23:00` (1380):
 * `[600, 630, 660, ..., 1350]`.
 */
export function buildOperatingHalfHourSlots() {
  const slots = [];
  for (
    let startMinute = PUBLIC_OPERATING_START_MINUTE;
    startMinute < PUBLIC_OPERATING_END_MINUTE;
    startMinute += PUBLIC_SLOT_INTERVAL_MINUTES
  ) {
    const endMinute = startMinute + PUBLIC_SLOT_INTERVAL_MINUTES;
    slots.push({
      startMinute,
      endMinute,
      startLabel: formatMinuteOfDay(startMinute),
      endLabel: formatMinuteOfDay(endMinute),
      rangeLabel: formatMinuteRange(startMinute, endMinute, false),
      isHourStart: startMinute % 60 === 0,
    });
  }
  return slots;
}

export const OPERATING_HALF_HOUR_SLOTS = buildOperatingHalfHourSlots();

/**
 * Generates all 13 1-hour public display slots between `10:00` (600) and `23:00` (1380):
 * `[600, 660, 720, ..., 1320]` (`10:00–11:00` through `22:00–23:00`).
 */
export function buildOperatingHourlySlots() {
  const slots = [];
  for (
    let startMinute = PUBLIC_OPERATING_START_MINUTE;
    startMinute < PUBLIC_OPERATING_END_MINUTE;
    startMinute += PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES
  ) {
    const endMinute = startMinute + PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES;
    slots.push({
      startMinute,
      endMinute,
      startLabel: formatMinuteOfDay(startMinute),
      endLabel: formatMinuteOfDay(endMinute),
      rangeLabel: formatMinuteRange(startMinute, endMinute, false),
      isHourStart: true,
    });
  }
  return slots;
}

export const OPERATING_HOURLY_SLOTS = buildOperatingHourlySlots();

/**
 * Resolves the active date range (`startDate`, `endDate`, `days`) for Day or Week view
 * in `Asia/Jakarta`.
 */
export function getPublicCalendarDateRange(
  viewMode = PUBLIC_VIEW_MODES.DAY,
  activeDateIso = '',
  now = new Date(),
) {
  const todayIso = getJakartaTodayIso(now);
  const safeDate = isValidIsoDateString(activeDateIso) ? activeDateIso.trim() : todayIso;

  if (viewMode === PUBLIC_VIEW_MODES.WEEK) {
    const startDate = getWeekStartIso(safeDate);
    const days = Array.from({ length: 7 }, (_, idx) => {
      const dateIso = addDaysToIsoDate(startDate, idx);
      return {
        dateIso,
        compactLabel: formatIndonesianDateCompact(dateIso),
        fullLabel: formatIndonesianDateFull(dateIso),
        isToday: dateIso === todayIso,
        isPastDate: dateIso < todayIso,
      };
    });
    return {
      viewMode: PUBLIC_VIEW_MODES.WEEK,
      startDate,
      endDate: days[6].dateIso,
      activeDate: safeDate,
      todayIso,
      days,
    };
  }

  return {
    viewMode: PUBLIC_VIEW_MODES.DAY,
    startDate: safeDate,
    endDate: safeDate,
    activeDate: safeDate,
    todayIso,
    days: [
      {
        dateIso: safeDate,
        compactLabel: formatIndonesianDateCompact(safeDate),
        fullLabel: formatIndonesianDateFull(safeDate),
        isToday: safeDate === todayIso,
        isPastDate: safeDate < todayIso,
      },
    ],
  };
}

/**
 * Checks whether a candidate interval `[startMinute, startMinute + durationMinutes)`
 * is completely free of occupied blocks and within operating hours (`10:00`–`23:00`)
 * and not in the past relative to `Asia/Jakarta` `now`.
 */
export function evaluatePublicIntervalAvailability({
  dateIso,
  studioId,
  startMinute,
  durationMinutes = PUBLIC_SLOT_INTERVAL_MINUTES,
  projections = [],
  now = new Date(),
} = {}) {
  if (!isValidIsoDateString(dateIso)) {
    return {
      isAvailable: false,
      state: PUBLIC_SLOT_STATES.OUTSIDE_HOURS,
      reason: 'Invalid calendar date.',
    };
  }

  if (studioId !== 'room-a' && studioId !== 'room-b') {
    return {
      isAvailable: false,
      state: PUBLIC_SLOT_STATES.OUTSIDE_HOURS,
      reason: 'Invalid studio room.',
    };
  }

  const windowCheck = validateBookingWindow({ startMinute, durationMinutes });
  if (!windowCheck.isValid) {
    return {
      isAvailable: false,
      state: PUBLIC_SLOT_STATES.OUTSIDE_HOURS,
      reason: windowCheck.message,
    };
  }

  const jakartaNow = getJakartaDateTimeParts(now);
  const endMinute = startMinute + durationMinutes;

  // Check if date or slot start time is in the past in Asia/Jakarta
  if (
    dateIso < jakartaNow.dateIso ||
    (dateIso === jakartaNow.dateIso && startMinute < jakartaNow.minuteOfDay)
  ) {
    return {
      isAvailable: false,
      state: PUBLIC_SLOT_STATES.PAST,
      reason: 'Past time block cannot be selected.',
    };
  }

  // Check overlap against occupied projections for the same date and room
  for (const proj of projections || []) {
    if (!proj || proj.date !== dateIso || proj.studioId !== studioId) {
      continue;
    }
    if (doTimeIntervalsOverlap(startMinute, endMinute, proj.startMinute, proj.endMinute)) {
      return {
        isAvailable: false,
        state: PUBLIC_SLOT_STATES.OCCUPIED,
        reason: 'Interval overlaps with an occupied studio session.',
      };
    }
  }

  return {
    isAvailable: true,
    state: PUBLIC_SLOT_STATES.AVAILABLE,
    startMinute,
    endMinute,
    durationMinutes,
  };
}

/**
 * Builds the 1-hour public slot schedule (13 slots/day) for a single room (`room-a` or `room-b`) on a given `dateIso`.
 *
 * Canonical projections remain at 30-minute resolution so any overlapping booking (including legacy HH:30 sessions)
 * marks the corresponding 1-hour block as `occupied` (fail-closed).
 */
export function buildRoomDayAvailabilitySlots({
  dateIso,
  studioId,
  projections = [],
  requestedDurationMinutes = PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  now = new Date(),
} = {}) {
  const jakartaNow = getJakartaDateTimeParts(now);
  const safeDuration =
    Number.isInteger(Number(requestedDurationMinutes)) &&
    Number(requestedDurationMinutes) >= PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES &&
    Number(requestedDurationMinutes) % PUBLIC_SLOT_INTERVAL_MINUTES === 0
      ? Number(requestedDurationMinutes)
      : PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES;

  const roomProjections = (projections || []).filter(
    (p) => p && p.date === dateIso && p.studioId === studioId,
  );

  let availableSlotsCount = 0;
  let occupiedSlotsCount = 0;
  let pastSlotsCount = 0;
  let selectableStartCount = 0;

  const slots = OPERATING_HOURLY_SLOTS.map((baseSlot) => {
    const isBlockOccupied = roomProjections.some((proj) =>
      doTimeIntervalsOverlap(
        baseSlot.startMinute,
        baseSlot.endMinute,
        proj.startMinute,
        proj.endMinute,
      ),
    );

    const isBlockPast =
      dateIso < jakartaNow.dateIso ||
      (dateIso === jakartaNow.dateIso && baseSlot.startMinute < jakartaNow.minuteOfDay);

    if (isBlockOccupied) {
      occupiedSlotsCount += 1;
      return {
        ...baseSlot,
        dateIso,
        studioId,
        state: PUBLIC_SLOT_STATES.OCCUPIED,
        statusLabel: 'Occupied',
        isSelectable: false,
        canFitRequestedDuration: false,
      };
    }

    if (isBlockPast) {
      pastSlotsCount += 1;
      return {
        ...baseSlot,
        dateIso,
        studioId,
        state: PUBLIC_SLOT_STATES.PAST,
        statusLabel: 'Past',
        isSelectable: false,
        canFitRequestedDuration: false,
      };
    }

    availableSlotsCount += 1;

    // Evaluate whether the full requested duration fits starting at this 30-min block
    const durationEval = evaluatePublicIntervalAvailability({
      dateIso,
      studioId,
      startMinute: baseSlot.startMinute,
      durationMinutes: safeDuration,
      projections: roomProjections,
      now,
    });

    if (!durationEval.isAvailable) {
      return {
        ...baseSlot,
        dateIso,
        studioId,
        state: PUBLIC_SLOT_STATES.DURATION_TOO_SHORT,
        statusLabel: 'Limited window',
        isSelectable: false,
        canFitRequestedDuration: false,
      };
    }

    selectableStartCount += 1;
    return {
      ...baseSlot,
      dateIso,
      studioId,
      state: PUBLIC_SLOT_STATES.AVAILABLE,
      statusLabel: 'Available',
      isSelectable: true,
      canFitRequestedDuration: true,
      requestedEndMinute: baseSlot.startMinute + safeDuration,
      requestedRangeLabel: formatMinuteRange(
        baseSlot.startMinute,
        baseSlot.startMinute + safeDuration,
        false,
      ),
    };
  });

  // Also build contiguous occupied intervals for visual summary / block display
  const occupiedIntervals = [...roomProjections]
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((p) => ({
      startMinute: p.startMinute,
      endMinute: p.endMinute,
      rangeLabel: formatMinuteRange(p.startMinute, p.endMinute, false),
    }));

  return {
    dateIso,
    studioId,
    slots,
    occupiedIntervals,
    availableSlotsCount,
    occupiedSlotsCount,
    pastSlotsCount,
    selectableStartCount,
    totalSlotsCount: OPERATING_HOURLY_SLOTS.length,
  };
}

/**
 * Builds the full matrix of room schedules across a date range (`days`) and room filter.
 */
export function buildPublicAvailabilityScheduleMatrix({
  days = [],
  roomFilter = 'all',
  projections = [],
  requestedDurationMinutes = PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  now = new Date(),
} = {}) {
  const visibleRooms =
    roomFilter === 'room-a' || roomFilter === 'room-b'
      ? PUBLIC_STUDIO_ROOMS.filter((r) => r.id === roomFilter)
      : PUBLIC_STUDIO_ROOMS;

  return visibleRooms.map((room) => {
    const daySchedules = days.map((day) => ({
      ...day,
      ...buildRoomDayAvailabilitySlots({
        dateIso: day.dateIso,
        studioId: room.id,
        projections,
        requestedDurationMinutes,
        now,
      }),
    }));

    const totalSelectableStarts = daySchedules.reduce((sum, d) => sum + d.selectableStartCount, 0);
    const totalOccupiedSlots = daySchedules.reduce((sum, d) => sum + d.occupiedSlotsCount, 0);

    return {
      ...room,
      daySchedules,
      totalSelectableStarts,
      totalOccupiedSlots,
    };
  });
}

/**
 * Normalizes and validates incoming URL search parameters for the Landing Page
 * booking inquiry prefill (`/?date=2026-11-25&room=room-a&time=19:00&service=recording&duration=2+hours#booking`).
 */
export function parseAndValidateInquiryPrefillParams(searchParams, now = new Date()) {
  if (!searchParams) {
    return { hasValidPrefill: false, hasInvalidParams: false };
  }

  const getParam = (key) =>
    typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key];

  const rawDate = String(getParam('date') || '').trim();
  const rawRoom = String(getParam('room') || '')
    .trim()
    .toLowerCase();
  const rawTime = String(getParam('time') || '').trim();
  const rawService = String(getParam('service') || '')
    .trim()
    .toLowerCase();
  const rawDuration = String(getParam('duration') || '').trim();

  const todayIso = getJakartaTodayIso(now);
  let hasInvalidParams = false;
  const result = {};

  if (rawDate) {
    if (isValidIsoDateString(rawDate) && rawDate >= todayIso) {
      result.preferredDate = rawDate;
    } else {
      hasInvalidParams = true;
    }
  }

  if (rawRoom) {
    if (['room-a', 'room-b', 'any'].includes(rawRoom)) {
      result.room = rawRoom;
    } else {
      hasInvalidParams = true;
    }
  }

  if (rawTime) {
    const match = /^(\d{2}):(\d{2})$/.exec(rawTime);
    if (match) {
      const hh = Number(match[1]);
      const mm = Number(match[2]);
      const totalMin = hh * 60 + mm;
      if (
        totalMin >= PUBLIC_OPERATING_START_MINUTE &&
        totalMin < PUBLIC_OPERATING_END_MINUTE &&
        totalMin % PUBLIC_SLOT_INTERVAL_MINUTES === 0
      ) {
        result.preferredTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      } else {
        hasInvalidParams = true;
      }
    } else {
      hasInvalidParams = true;
    }
  }

  if (rawService) {
    if (['rehearsal', 'recording', 'mix-master'].includes(rawService)) {
      result.service = rawService;
    } else {
      hasInvalidParams = true;
    }
  }

  if (rawDuration) {
    const validDurations = ['1 hour', '2 hours', '3 hours', '4 hours', '6+ hours'];
    if (validDurations.includes(rawDuration)) {
      result.duration = rawDuration === '1 hour' ? '2 hours' : rawDuration;
    } else if (/^\d+$/.test(rawDuration)) {
      const mins = Number(rawDuration);
      if (mins === 180) result.duration = '3 hours';
      else if (mins === 240) result.duration = '4 hours';
      else if (mins > 240) result.duration = '6+ hours';
      else if (mins >= 30 && mins <= 120) result.duration = '2 hours';
      else hasInvalidParams = true;
    } else {
      hasInvalidParams = true;
    }
  }

  return {
    hasValidPrefill: Object.keys(result).length > 0,
    hasInvalidParams,
    ...result,
  };
}
