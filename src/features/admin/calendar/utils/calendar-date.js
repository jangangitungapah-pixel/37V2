import { STUDIO_TIME_ZONE } from '../config/calendar-config';

export const INDONESIAN_DAY_NAMES_LONG = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const INDONESIAN_DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const INDONESIAN_WEEKDAY_HEADERS_MONDAY_START = [
  { index: 1, short: 'Sen', long: 'Senin' },
  { index: 2, short: 'Sel', long: 'Selasa' },
  { index: 3, short: 'Rab', long: 'Rabu' },
  { index: 4, short: 'Kam', long: 'Kamis' },
  { index: 5, short: 'Jum', long: 'Jumat' },
  { index: 6, short: 'Sab', long: 'Sabtu' },
  { index: 0, short: 'Min', long: 'Minggu' },
];

export const INDONESIAN_MONTH_NAMES_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const INDONESIAN_MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/**
 * Returns the current date & time components in Asia/Jakarta timezone.
 */
export function getJakartaDateTimeParts(now = new Date()) {
  const safeDate = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: STUDIO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(safeDate).map((part) => [part.type, part.value]),
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);

  return {
    dateIso: `${parts.year}-${parts.month}-${parts.day}`,
    year,
    month,
    day,
    hour,
    minute,
    minuteOfDay: hour * 60 + minute,
    timestamp: safeDate.getTime(),
  };
}

/**
 * Returns today's canonical `YYYY-MM-DD` string in Asia/Jakarta.
 */
export function getJakartaTodayIso(now = new Date()) {
  return getJakartaDateTimeParts(now).dateIso;
}

/**
 * Strictly validates a calendar date string `YYYY-MM-DD`, rejecting impossible dates
 * such as `2026-02-30` or `2026-13-01`.
 */
export function isValidIsoDateString(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Parses a valid `YYYY-MM-DD` string into `{ year, month, day, dayOfWeek }` without
 * local timezone drift.
 */
export function parseIsoDateParts(dateIso) {
  if (!isValidIsoDateString(dateIso)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = dateIso.trim().split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return {
    year,
    month,
    day,
    dayOfWeek: utcDate.getUTCDay(), // 0 = Sunday .. 6 = Saturday
  };
}

/**
 * Converts a UTC Date object back to `YYYY-MM-DD`.
 */
function formatUtcDateToIso(utcDate) {
  const y = String(utcDate.getUTCFullYear()).padStart(4, '0');
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds a signed number of days to a `YYYY-MM-DD` string safely.
 */
export function addDaysToIsoDate(dateIso, deltaDays) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return getJakartaTodayIso();

  const utcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + Number(deltaDays || 0)),
  );
  return formatUtcDateToIso(utcDate);
}

/**
 * Adds a signed number of months to a `YYYY-MM-DD` string, clamping the day to the
 * target month's last valid day.
 */
export function addMonthsToIsoDate(dateIso, deltaMonths) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return getJakartaTodayIso();

  const targetMonthDate = new Date(
    Date.UTC(parts.year, parts.month - 1 + Number(deltaMonths || 0), 1),
  );
  const targetYear = targetMonthDate.getUTCFullYear();
  const targetMonthIndex = targetMonthDate.getUTCMonth();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(parts.day, lastDayOfTargetMonth);

  return formatUtcDateToIso(new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay)));
}

/**
 * Returns the Monday-anchored week start (`YYYY-MM-DD`) for the given `dateIso`.
 */
export function getWeekStartIso(dateIso) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return getJakartaTodayIso();

  // Convert Sunday (0) -> 6, Monday (1) -> 0, ..., Saturday (6) -> 5
  const mondayOffset = (parts.dayOfWeek + 6) % 7;
  return addDaysToIsoDate(dateIso, -mondayOffset);
}

/**
 * Computes the date range and day cells for Day, Week, or Month view.
 */
export function getCalendarViewDateRange(viewMode, activeDateIso) {
  const safeDate = isValidIsoDateString(activeDateIso) ? activeDateIso : getJakartaTodayIso();
  const parts = parseIsoDateParts(safeDate);

  if (viewMode === 'day') {
    return {
      viewMode: 'day',
      startDate: safeDate,
      endDate: safeDate,
      monthStart: safeDate,
      monthEnd: safeDate,
      days: [safeDate],
    };
  }

  if (viewMode === 'week') {
    const startDate = getWeekStartIso(safeDate);
    const days = Array.from({ length: 7 }, (_, idx) => addDaysToIsoDate(startDate, idx));
    return {
      viewMode: 'week',
      startDate,
      endDate: days[6],
      monthStart: startDate,
      monthEnd: days[6],
      days,
    };
  }

  // Month view: ONLY actual days of the active month (28, 29, 30, or 31 days — no filler dates)
  const monthStart = formatUtcDateToIso(new Date(Date.UTC(parts.year, parts.month - 1, 1)));
  const monthEnd = formatUtcDateToIso(new Date(Date.UTC(parts.year, parts.month, 0)));
  const totalDays = parseIsoDateParts(monthEnd).day;
  const days = Array.from({ length: totalDays }, (_, idx) => addDaysToIsoDate(monthStart, idx));

  return {
    viewMode: 'month',
    startDate: monthStart,
    endDate: monthEnd,
    monthStart,
    monthEnd,
    days,
  };
}

/**
 * Shifts the active date backward (`direction = -1`) or forward (`direction = 1`)
 * according to the current viewMode (`day`, `week`, `month`).
 */
export function shiftCalendarDate(viewMode, activeDateIso, direction) {
  const step = Number(direction) < 0 ? -1 : 1;
  const safeDate = isValidIsoDateString(activeDateIso) ? activeDateIso : getJakartaTodayIso();

  if (viewMode === 'day') {
    return addDaysToIsoDate(safeDate, step);
  }

  if (viewMode === 'week') {
    return addDaysToIsoDate(safeDate, step * 7);
  }

  return addMonthsToIsoDate(safeDate, step);
}

/**
 * Formats a `YYYY-MM-DD` date in Indonesian long format: e.g. `Rabu, 18 November 2026`.
 */
export function formatIndonesianDateFull(dateIso) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return String(dateIso || '-');

  const dayName = INDONESIAN_DAY_NAMES_LONG[parts.dayOfWeek];
  const monthName = INDONESIAN_MONTH_NAMES_LONG[parts.month - 1];
  return `${dayName}, ${parts.day} ${monthName} ${parts.year}`;
}

/**
 * Formats a `YYYY-MM-DD` date in Indonesian medium format: e.g. `Rab, 18 Nov 2026`.
 */
export function formatIndonesianDateMedium(dateIso) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return String(dateIso || '-');

  const dayName = INDONESIAN_DAY_NAMES_SHORT[parts.dayOfWeek];
  const monthName = INDONESIAN_MONTH_NAMES_SHORT[parts.month - 1];
  return `${dayName}, ${parts.day} ${monthName} ${parts.year}`;
}

/**
 * Formats a `YYYY-MM-DD` date in Indonesian compact format: e.g. `18 Nov`.
 */
export function formatIndonesianDateCompact(dateIso) {
  const parts = parseIsoDateParts(dateIso);
  if (!parts) return String(dateIso || '-');

  const monthName = INDONESIAN_MONTH_NAMES_SHORT[parts.month - 1];
  return `${parts.day} ${monthName}`;
}

/**
 * Formats the active period heading for the Calendar toolbar based on viewMode.
 */
export function formatIndonesianPeriodLabel(viewMode, activeDateIso) {
  const safeDate = isValidIsoDateString(activeDateIso) ? activeDateIso : getJakartaTodayIso();
  const parts = parseIsoDateParts(safeDate);
  if (!parts) return safeDate;

  if (viewMode === 'day') {
    return formatIndonesianDateFull(safeDate);
  }

  if (viewMode === 'week') {
    const range = getCalendarViewDateRange('week', safeDate);
    const startParts = parseIsoDateParts(range.startDate);
    const endParts = parseIsoDateParts(range.endDate);

    if (startParts.month === endParts.month && startParts.year === endParts.year) {
      return `${startParts.day} – ${endParts.day} ${INDONESIAN_MONTH_NAMES_LONG[startParts.month - 1]} ${startParts.year}`;
    }

    if (startParts.year === endParts.year) {
      return `${startParts.day} ${INDONESIAN_MONTH_NAMES_SHORT[startParts.month - 1]} – ${endParts.day} ${INDONESIAN_MONTH_NAMES_SHORT[endParts.month - 1]} ${startParts.year}`;
    }

    return `${startParts.day} ${INDONESIAN_MONTH_NAMES_SHORT[startParts.month - 1]} ${startParts.year} – ${endParts.day} ${INDONESIAN_MONTH_NAMES_SHORT[endParts.month - 1]} ${endParts.year}`;
  }

  return `${INDONESIAN_MONTH_NAMES_LONG[parts.month - 1]} ${parts.year}`;
}

/**
 * Converts a `YYYY-MM-DD` and `minuteOfDay` in Asia/Jakarta (+07:00) into an epoch timestamp (ms).
 */
export function getJakartaSlotEpochMs(dateIso, minuteOfDay = 0) {
  if (!isValidIsoDateString(dateIso)) return NaN;
  const safeMinute = Math.max(0, Math.round(Number(minuteOfDay) || 0));
  const baseEpoch = Date.parse(`${dateIso}T00:00:00+07:00`);
  if (Number.isNaN(baseEpoch)) return NaN;
  return baseEpoch + safeMinute * 60_000;
}

/**
 * Formats a Firestore Timestamp, Date, or epoch ms in Indonesian date-time (`18 Nov 2026, 14:30 WIB`).
 */
export function formatIndonesianTimestamp(value) {
  if (!value) return '-';

  let dateObj = null;
  if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value?.toDate === 'function') {
    dateObj = value.toDate();
  } else if (typeof value?.seconds === 'number') {
    dateObj = new Date(value.seconds * 1000);
  } else if (typeof value === 'number' || typeof value === 'string') {
    dateObj = new Date(value);
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) {
    return '-';
  }

  const parts = getJakartaDateTimeParts(dateObj);
  const monthShort = INDONESIAN_MONTH_NAMES_SHORT[parts.month - 1] || '';
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  return `${parts.day} ${monthShort} ${parts.year}, ${hh}:${mm} WIB`;
}
