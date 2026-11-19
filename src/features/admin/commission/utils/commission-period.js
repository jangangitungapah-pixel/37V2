/**
 * Commission Review Period Helpers (Asia/Jakarta Timezone)
 * Built cleanly on `date-fns` and `@date-fns/tz`.
 */

import { TZDate } from '@date-fns/tz';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

import {
  formatIndonesianDateMedium,
  INDONESIAN_MONTH_NAMES_LONG,
  isValidIsoDateString,
  parseIsoDateParts,
} from '@/features/admin/calendar/utils/calendar-date';

export const COMMISSION_TIME_ZONE = 'Asia/Jakarta';

export const COMMISSION_PERIOD_PRESETS = {
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  CUSTOM: 'custom',
};

export const COMMISSION_PERIOD_PRESET_OPTIONS = [
  { id: COMMISSION_PERIOD_PRESETS.THIS_MONTH, label: 'This Month', indoLabel: 'Bulan Ini' },
  { id: COMMISSION_PERIOD_PRESETS.LAST_MONTH, label: 'Last Month', indoLabel: 'Bulan Lalu' },
  { id: COMMISSION_PERIOD_PRESETS.CUSTOM, label: 'Custom Date Range', indoLabel: 'Pilih Tanggal' },
];

/**
 * Returns a `TZDate` anchored to `Asia/Jakarta`.
 */
export function toJakartaTzDate(now = new Date()) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return new TZDate(safeNow.getTime(), COMMISSION_TIME_ZONE);
}

/**
 * Resolves exact Jakarta start/end boundaries (`YYYY-MM-DD` and epoch ms)
 * for `this_month`, `last_month`, or `custom`.
 */
export function resolveCommissionPeriodBounds({
  preset = COMMISSION_PERIOD_PRESETS.THIS_MONTH,
  customStartDate = '',
  customEndDate = '',
  now = new Date(),
} = {}) {
  const jakartaNow = toJakartaTzDate(now);

  let startDateIso;
  let endDateIso;

  if (preset === COMMISSION_PERIOD_PRESETS.LAST_MONTH) {
    const prevMonth = subMonths(jakartaNow, 1);
    startDateIso = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    endDateIso = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
  } else if (preset === COMMISSION_PERIOD_PRESETS.CUSTOM) {
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
    timeZone: COMMISSION_TIME_ZONE,
    periodStart: startDateIso,
    periodEnd: endDateIso,
    startDate: new Date(startMs),
    endDate: new Date(endMs),
    startMs,
    endMs,
    periodLabel: formatCommissionPeriodLabel(startDateIso, endDateIso),
  };
}

/**
 * Formats an active period range for clear Owner summary & confirmation readability
 * (e.g., `1–30 November 2026`).
 */
export function formatCommissionPeriodLabel(periodStart = '', periodEnd = '') {
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
 * Extracts `YYYY-MM-DD` and epoch ms in Asia/Jakarta from any Firestore Timestamp, Date, or ISO string.
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
    millis = Date.parse(value);
  }

  if (!Number.isFinite(millis) || millis <= 0) {
    return { isValid: false, millis: 0, dateIso: '' };
  }

  const tzDate = new TZDate(millis, COMMISSION_TIME_ZONE);
  if (Number.isNaN(tzDate.getTime())) {
    return { isValid: false, millis: 0, dateIso: '' };
  }

  return {
    isValid: true,
    millis,
    dateIso: format(tzDate, 'yyyy-MM-dd'),
  };
}
