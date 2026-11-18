import {
  formatIndonesianDateCompact,
  formatIndonesianDateFull,
  getCalendarViewDateRange,
  getJakartaTodayIso,
  INDONESIAN_DAY_NAMES_SHORT,
  parseIsoDateParts,
} from '../utils/calendar-date';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

export function CalendarWeekView({
  activeDate,
  roomFilter = 'all',
  bookings = [],
  onSelectEmptySlot,
  onSelectBooking,
  onOpenDayView,
}) {
  const todayIso = getJakartaTodayIso();
  const weekRange = getCalendarViewDateRange('week', activeDate);
  const defaultStudioId = roomFilter === 'all' ? 'room-a' : roomFilter;

  const columns = weekRange.days.map((dateIso) => {
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
      bookings: bookings.filter((b) => b.date === dateIso),
    };
  });

  return (
    <CalendarTimelineGrid
      ariaLabel="Tampilan jadwal mingguan 7 hari"
      bannerLeft={
        <span className="font-mono text-[10px] font-extrabold uppercase">
          Mingguan • 7 Hari (Senin – Minggu)
        </span>
      }
      bannerRight="Klik tanggal untuk Day View • Geser horizontal"
      columns={columns}
      columnTrackCss="minmax(124px, 1fr)"
      cardVariant="compact"
      onSelectEmptySlot={onSelectEmptySlot}
      onSelectBooking={onSelectBooking}
    />
  );
}
