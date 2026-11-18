import { format, isBefore, isValid, parse, startOfDay } from 'date-fns';

const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE_DATE = new Date(2000, 0, 1);

/**
 * Formats the local calendar date as YYYY-MM-DD without UTC conversion drift.
 */
export function getTodayLocalDateString(now = new Date()) {
  return format(now, 'yyyy-MM-dd');
}

/**
 * Verifies YYYY-MM-DD format and strict calendar validity (rejects e.g. 2026-02-30).
 */
export function isValidBookingCalendarDate(value) {
  if (typeof value !== 'string' || !ISO_CALENDAR_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = parse(value, 'yyyy-MM-dd', REFERENCE_DATE);
  if (!isValid(parsed)) {
    return false;
  }

  return format(parsed, 'yyyy-MM-dd') === value;
}

/**
 * Checks whether a YYYY-MM-DD date string is today or in the future in local calendar time.
 */
export function isDateNotInPast(value, now = new Date()) {
  if (!isValidBookingCalendarDate(value)) {
    return false;
  }

  const parsed = parse(value, 'yyyy-MM-dd', REFERENCE_DATE);
  return !isBefore(startOfDay(parsed), startOfDay(now));
}
