import { describe, expect, it } from 'vitest';

import {
  getTodayLocalDateString,
  isDateNotInPast,
  isValidBookingCalendarDate,
} from './booking-date';

describe('Booking calendar date — Asia/Jakarta', () => {
  it('derives the WIB calendar date from an absolute instant, independent of browser timezone', () => {
    const instant = new Date('2026-11-24T18:30:00.000Z');
    expect(getTodayLocalDateString(instant)).toBe('2026-11-25');
    expect(isDateNotInPast('2026-11-25', instant)).toBe(true);
    expect(isDateNotInPast('2026-11-24', instant)).toBe(false);
  });

  it('rejects invalid ISO calendar dates rather than normalizing them', () => {
    expect(isValidBookingCalendarDate('2026-11-25')).toBe(true);
    expect(isValidBookingCalendarDate('2026-02-30')).toBe(false);
    expect(isValidBookingCalendarDate('25-11-2026')).toBe(false);
  });
});
