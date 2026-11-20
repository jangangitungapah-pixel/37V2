import {
  formatIndonesianDateCompact,
  formatIndonesianDateFull,
  formatIndonesianPeriodLabel,
  getCalendarViewDateRange,
  getJakartaTodayIso,
  INDONESIAN_DAY_NAMES_SHORT,
  parseIsoDateParts,
} from '../utils/calendar-date';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

export function CalendarMonthView({
  activeDate,
  focusRequestKey = 0,
  roomFilter = 'all',
  bookings = [],
  onSelectEmptySlot,
  onSelectBooking,
  onOpenDayView,
}) {
  const todayIso = getJakartaTodayIso();
  const monthRange = getCalendarViewDateRange('month', activeDate);
  const monthTitle = formatIndonesianPeriodLabel('month', activeDate);
  const defaultStudioId = roomFilter === 'all' ? 'room-a' : roomFilter;

  const bookingsByDate = new Map();
  for (const booking of bookings) {
    if (!bookingsByDate.has(booking.date)) {
      bookingsByDate.set(booking.date, []);
    }
    bookingsByDate.get(booking.date).push(booking);
  }

  const columns = monthRange.days.map((dateIso) => {
    const parts = parseIsoDateParts(dateIso);
    const dayShort = parts ? INDONESIAN_DAY_NAMES_SHORT[parts.dayOfWeek] : '';
    const isToday = dateIso === todayIso;
    const isSelected = dateIso === activeDate;

    return {
      id: dateIso,
      dateIso,
      studioId: defaultStudioId,
      eyebrow: dayShort,
      title: formatIndonesianDateCompact(dateIso),
      slotAriaTarget: `${dayShort} ${formatIndonesianDateCompact(dateIso)}`,
      isToday,
      isSelected,
      onHeaderClick: () => onOpenDayView?.(dateIso),
      headerClickAriaLabel: `Buka Day View ${formatIndonesianDateFull(dateIso)}`,
      bookings: bookingsByDate.get(dateIso) || [],
    };
  });

  return (
    <CalendarTimelineGrid
      ariaLabel={`Tampilan timeline bulanan ${monthTitle} (${monthRange.days.length} hari)`}
      bannerLeft={
        <span className="text-studio-ink text-xs font-semibold">
          Bulanan · {monthTitle} ({monthRange.days.length} Hari)
        </span>
      }
      bannerRight="Geser horizontal untuk seluruh tanggal • Klik tanggal untuk Day View"
      columns={columns}
      columnTrackCss="118px"
      cardVariant="compact"
      focusDateIso={activeDate}
      focusRequestKey={focusRequestKey}
      onSelectEmptySlot={onSelectEmptySlot}
      onSelectBooking={onSelectBooking}
    />
  );
}
