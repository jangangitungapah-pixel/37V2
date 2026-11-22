/**
 * Asia/Jakarta (WIB, UTC+7) Date, Greeting, Time Slot & Analytics Period Builders
 * for the Studio Operations Command Center.
 */

import {
  addDaysToIsoDate,
  formatIndonesianDateCompact,
  formatIndonesianDateFull,
  formatIndonesianDateMedium,
  getJakartaDateTimeParts,
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';

import {
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_PERIOD_PRESETS,
  DASHBOARD_TIME_ZONE,
} from '../config/dashboard-config';

/**
 * Resolves a time-sensitive Indonesian greeting and formatted current date in `Asia/Jakarta`.
 *
 * Greeting windows (WIB):
 * - 04:00–10:59 -> `Selamat pagi`
 * - 11:00–14:59 -> `Selamat siang`
 * - 15:00–17:59 -> `Selamat sore`
 * - 18:00–03:59 -> `Selamat malam`
 */
export function getJakartaGreetingInfo(now = new Date()) {
  const parts = getJakartaDateTimeParts(now);
  const { hour, minute, minuteOfDay, dateIso } = parts;

  let greeting = 'Selamat malam';
  let periodKey = 'night';

  if (hour >= 4 && hour < 11) {
    greeting = 'Selamat pagi';
    periodKey = 'morning';
  } else if (hour >= 11 && hour < 15) {
    greeting = 'Selamat siang';
    periodKey = 'afternoon';
  } else if (hour >= 15 && hour < 18) {
    greeting = 'Selamat sore';
    periodKey = 'evening';
  }

  return {
    greeting,
    periodKey,
    dateIso,
    formattedDateFull: formatIndonesianDateFull(dateIso),
    formattedDateMedium: formatIndonesianDateMedium(dateIso),
    hour,
    minute,
    minuteOfDay,
    timeZone: DASHBOARD_TIME_ZONE,
  };
}

/**
 * Formats integer minutes from midnight (e.g. `600`) to `HH:mm` (`10:00`).
 */
export function formatMinuteOfDayToHHmm(minuteOfDay) {
  const safe = Math.max(0, Math.min(1440, Math.round(Number(minuteOfDay) || 0)));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Formats a studio session start and end minute range (`10:00 – 12:00`).
 */
export function formatBookingTimeRange(startMinute, endMinute, { includeWib = false } = {}) {
  const startStr = formatMinuteOfDayToHHmm(startMinute);
  const endStr = formatMinuteOfDayToHHmm(endMinute);
  return includeWib ? `${startStr} – ${endStr} WIB` : `${startStr} – ${endStr}`;
}

/**
 * Resolves exact `Asia/Jakarta` calendar dates and epoch bounds for the selected
 * dashboard analytics period (`7d`, `30d`, `90d`).
 */
export function resolveDashboardPeriodBounds({
  periodId = DASHBOARD_PERIOD_PRESETS.DAYS_30,
  todayIso: explicitTodayIso = '',
  now = new Date(),
} = {}) {
  const option =
    DASHBOARD_PERIOD_OPTIONS.find((opt) => opt.id === periodId) ||
    DASHBOARD_PERIOD_OPTIONS.find((opt) => opt.id === DASHBOARD_PERIOD_PRESETS.DAYS_30) ||
    DASHBOARD_PERIOD_OPTIONS[1];

  const endDateIso = isValidIsoDateString(explicitTodayIso)
    ? explicitTodayIso.trim()
    : getJakartaTodayIso(now);

  const days = option.days;
  const startDateIso = addDaysToIsoDate(endDateIso, -(days - 1));

  const dateBuckets = Array.from({ length: days }, (_, index) => {
    const dateIso = addDaysToIsoDate(startDateIso, index);
    return {
      dateIso,
      shortLabel: formatIndonesianDateCompact(dateIso),
      mediumLabel: formatIndonesianDateMedium(dateIso),
      fullLabel: formatIndonesianDateFull(dateIso),
    };
  });

  const startMs = Date.parse(`${startDateIso}T00:00:00.000+07:00`);
  const endMs = Date.parse(`${endDateIso}T23:59:59.999+07:00`);
  const todayStartMs = Date.parse(`${endDateIso}T00:00:00.000+07:00`);
  const todayEndMs = Date.parse(`${endDateIso}T23:59:59.999+07:00`);

  return {
    periodId: option.id,
    days,
    label: option.label,
    fullLabel: option.fullLabel,
    timeZone: DASHBOARD_TIME_ZONE,
    periodStart: startDateIso,
    periodEnd: endDateIso,
    startDate: new Date(startMs),
    endDate: new Date(endMs),
    startMs,
    endMs,
    todayIso: endDateIso,
    todayStartMs,
    todayEndMs,
    periodRangeLabel: `${formatIndonesianDateCompact(startDateIso)} – ${formatIndonesianDateMedium(endDateIso)}`,
    dateBuckets,
  };
}
