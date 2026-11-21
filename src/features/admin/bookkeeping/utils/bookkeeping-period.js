/**
 * Bookkeeping Period & Timestamp Helpers (Asia/Jakarta Timezone)
 * Built on `date-fns` and `@date-fns/tz` for exact WIB day/month/year boundaries.
 */

import { TZDate } from '@date-fns/tz';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';

import {
  formatIndonesianDateMedium,
  INDONESIAN_MONTH_NAMES_LONG,
  isValidIsoDateString,
  parseIsoDateParts,
} from '@/features/admin/calendar/utils/calendar-date';

import { BOOKKEEPING_PERIOD_PRESETS, BOOKKEEPING_TIME_ZONE } from '../config/bookkeeping-config';

/**
 * Returns a `TZDate` anchored to `Asia/Jakarta`.
 */
export function toBookkeepingJakartaDate(now = new Date()) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return new TZDate(safeNow.getTime(), BOOKKEEPING_TIME_ZONE);
}

/**
 * Formats an active period range cleanly (e.g., `1–30 November 2026`).
 */
export function formatBookkeepingPeriodLabel(periodStart = '', periodEnd = '') {
  if (!isValidIsoDateString(periodStart) || !isValidIsoDateString(periodEnd)) {
    return '-';
  }

  const startParts = parseIsoDateParts(periodStart);
  const endParts = parseIsoDateParts(periodEnd);

  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    const monthName = INDONESIAN_MONTH_NAMES_LONG[startParts.month - 1];
    if (startParts.day === endParts.day) {
      return `${startParts.day} ${monthName} ${startParts.year}`;
    }
    return `${startParts.day}–${endParts.day} ${monthName} ${startParts.year}`;
  }

  return `${formatIndonesianDateMedium(periodStart)} – ${formatIndonesianDateMedium(periodEnd)}`;
}

/**
 * Resolves exact Asia/Jakarta epoch millisecond bounds for:
 * - `this_month` (default)
 * - `last_month`
 * - `this_year`
 * - `custom`
 */
export function resolveBookkeepingPeriodBounds({
  preset = BOOKKEEPING_PERIOD_PRESETS.THIS_MONTH,
  customStartDate = '',
  customEndDate = '',
  now = new Date(),
} = {}) {
  const jakartaNow = toBookkeepingJakartaDate(now);

  let startDateIso;
  let endDateIso;

  if (preset === BOOKKEEPING_PERIOD_PRESETS.LAST_MONTH) {
    const prevMonth = subMonths(jakartaNow, 1);
    startDateIso = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    endDateIso = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
  } else if (preset === BOOKKEEPING_PERIOD_PRESETS.THIS_YEAR) {
    startDateIso = format(startOfYear(jakartaNow), 'yyyy-MM-dd');
    endDateIso = format(endOfYear(jakartaNow), 'yyyy-MM-dd');
  } else if (preset === BOOKKEEPING_PERIOD_PRESETS.CUSTOM) {
    const fallbackToday = format(jakartaNow, 'yyyy-MM-dd');
    const cleanStart = isValidIsoDateString(customStartDate)
      ? customStartDate.trim()
      : format(startOfMonth(jakartaNow), 'yyyy-MM-dd');
    const cleanEnd = isValidIsoDateString(customEndDate) ? customEndDate.trim() : fallbackToday;

    if (cleanStart <= cleanEnd) {
      startDateIso = cleanStart;
      endDateIso = cleanEnd;
    } else {
      startDateIso = cleanEnd;
      endDateIso = cleanStart;
    }
  } else {
    startDateIso = format(startOfMonth(jakartaNow), 'yyyy-MM-dd');
    endDateIso = format(endOfMonth(jakartaNow), 'yyyy-MM-dd');
  }

  const startMs = Date.parse(`${startDateIso}T00:00:00.000+07:00`);
  const endMs = Date.parse(`${endDateIso}T23:59:59.999+07:00`);

  return {
    preset,
    timeZone: BOOKKEEPING_TIME_ZONE,
    periodStart: startDateIso,
    periodEnd: endDateIso,
    startDate: new Date(startMs),
    endDate: new Date(endMs),
    startMs,
    endMs,
    periodLabel: formatBookkeepingPeriodLabel(startDateIso, endDateIso),
  };
}

/**
 * Extracts `YYYY-MM-DD` and epoch ms in Asia/Jakarta from any Firestore Timestamp,
 * `{ seconds, nanoseconds }`, Date, epoch number, ISO string, or `YYYY-MM-DD`.
 */
export function parseJakartaTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, millis: 0, dateIso: '' };
  }

  let millis = NaN;
  if (value instanceof Date) {
    millis = value.getTime();
  } else if (typeof value?.toMillis === 'function') {
    millis = value.toMillis();
  } else if (typeof value?.toDate === 'function') {
    millis = value.toDate().getTime();
  } else if (typeof value?.seconds === 'number') {
    millis = value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6);
  } else if (typeof value === 'number') {
    millis = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isValidIsoDateString(trimmed)) {
      millis = Date.parse(`${trimmed}T12:00:00.000+07:00`);
    } else {
      millis = Date.parse(trimmed);
    }
  }

  if (!Number.isFinite(millis) || millis <= 0) {
    return { isValid: false, millis: 0, dateIso: '' };
  }

  const tzDate = new TZDate(millis, BOOKKEEPING_TIME_ZONE);
  if (Number.isNaN(tzDate.getTime())) {
    return { isValid: false, millis: 0, dateIso: '' };
  }

  return {
    isValid: true,
    millis,
    dateIso: format(tzDate, 'yyyy-MM-dd'),
  };
}

/**
 * Checks whether a timestamp falls cleanly inside `[periodBounds.startMs, periodBounds.endMs]`.
 */
export function isTimestampInPeriod(value, periodBounds) {
  if (!periodBounds) return true;
  const parsed = parseJakartaTimestamp(value);
  if (!parsed.isValid) return false;
  return parsed.millis >= periodBounds.startMs && parsed.millis <= periodBounds.endMs;
}

/**
 * Converts an explicit `YYYY-MM-DD` user input into a stable Asia/Jakarta Date object
 * (using serverTimestamp / `tx.nowValue()` if the chosen date is today WIB so intra-day ordering stays chronological).
 */
export function resolveJakartaTimestampInput(dateIso, tx, todayIso) {
  const cleanDate = String(dateIso || '').trim();
  if (!cleanDate || cleanDate === todayIso || !isValidIsoDateString(cleanDate)) {
    return tx.nowValue();
  }
  const parsed = new Date(`${cleanDate}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) {
    return tx.nowValue();
  }
  return tx.timestampFromDate(parsed);
}
