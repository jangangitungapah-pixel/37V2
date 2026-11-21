export const STUDIO_SETTINGS_TIME_ZONE = 'Asia/Jakarta';
export const STUDIO_SETTINGS_LOCALE = 'id-ID';

/**
 * Formats a Firestore Timestamp, Date, ISO string, or RFC timestamp
 * into Indonesian 24-hour presentation in Asia/Jakarta (WIB).
 */
export function formatSettingsTimestamp(value, fallback = 'Belum tersedia') {
  if (!value) return fallback;

  let dateObj = null;
  if (typeof value?.toDate === 'function') {
    dateObj = value.toDate();
  } else if (value instanceof Date) {
    dateObj = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    dateObj = new Date(value);
  }

  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) {
    return fallback;
  }

  const formatted = new Intl.DateTimeFormat(STUDIO_SETTINGS_LOCALE, {
    timeZone: STUDIO_SETTINGS_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(dateObj);

  return `${formatted} WIB`;
}
