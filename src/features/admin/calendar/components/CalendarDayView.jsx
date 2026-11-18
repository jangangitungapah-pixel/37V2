import { STUDIO_ROOMS } from '../config/calendar-config';
import { formatIndonesianDateFull, getJakartaTodayIso } from '../utils/calendar-date';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

export function CalendarDayView({
  activeDate,
  roomFilter = 'all',
  bookings = [],
  onSelectEmptySlot,
  onSelectBooking,
}) {
  const todayIso = getJakartaTodayIso();
  const isToday = activeDate === todayIso;

  const visibleRooms =
    roomFilter === 'all' ? STUDIO_ROOMS : STUDIO_ROOMS.filter((room) => room.id === roomFilter);

  const dayBookings = bookings.filter((b) => b.date === activeDate);

  const columns = visibleRooms.map((room) => ({
    id: room.id,
    dateIso: activeDate,
    studioId: room.id,
    eyebrow: room.shortLabel,
    title: room.label,
    subtitle: room.subtitle,
    badgeLabel: room.shortLabel,
    badgeClass: room.badgeClass,
    slotAriaTarget: room.label,
    isToday,
    isSelected: false,
    bookings: dayBookings.filter((b) => b.studioId === room.id),
  }));

  return (
    <CalendarTimelineGrid
      ariaLabel={`Tampilan jadwal harian ${formatIndonesianDateFull(activeDate)}`}
      bannerLeft={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-studio-ink text-lg leading-none font-black tracking-tight uppercase sm:text-xl">
            {formatIndonesianDateFull(activeDate)}
          </span>
          {isToday ? (
            <span className="border-studio-ink bg-studio-lime text-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
              Hari Ini
            </span>
          ) : null}
        </div>
      }
      bannerRight="Klik slot jam untuk tambah booking"
      columns={columns}
      columnTrackCss="minmax(160px, 1fr)"
      cardVariant="timeline"
      onSelectEmptySlot={onSelectEmptySlot}
      onSelectBooking={onSelectBooking}
    />
  );
}
