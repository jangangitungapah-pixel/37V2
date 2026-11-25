import { format, isValid, parse } from 'date-fns';
import { TZDate } from '@date-fns/tz';

const STUDIO_TIME_ZONE = 'Asia/Jakarta';
const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE_DATE = new TZDate(2000, 0, 1, STUDIO_TIME_ZONE);

/**
 * Formats the studio calendar date in WIB regardless of the browser's timezone.
 */
export function getTodayLocalDateString(now = new Date()) {
  const instant = now instanceof Date ? now.getTime() : Number(now);
  const jakartaNow = new TZDate(Number.isFinite(instant) ? instant : Date.now(), STUDIO_TIME_ZONE);
  return format(jakartaNow, 'yyyy-MM-dd');
}

/**
 * Verifies YYYY-MM-DD format and strict calendar validity.
 */
export function isValidBookingCalendarDate(value) {
  if (typeof value !== 'string' || !ISO_CALENDAR_DATE_PATTERN.test(value)) return false;
  const parsed = parse(value, 'yyyy-MM-dd', REFERENCE_DATE);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

/**
 * Checks whether a date is today or later on the Asia/Jakarta calendar.
 */
export function isDateNotInPast(value, now = new Date()) {
  return isValidBookingCalendarDate(value) && value >= getTodayLocalDateString(now);
}
