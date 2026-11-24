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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-studio-ink text-base font-bold tracking-tight sm:text-lg">
            {formatIndonesianDateFull(activeDate)}
          </span>
          {isToday ? (
            <span className="rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-2.5 py-0.5 text-[11px] font-medium text-[#243300]">
              Hari Ini
            </span>
          ) : null}
        </div>
      }
      bannerRight="Klik slot jam untuk tambah booking"
      columns={columns}
      columnTrackCss={visibleRooms.length === 1 ? 'minmax(200px, 1fr)' : 'minmax(145px, 1fr)'}
      cardVariant="timeline"
      onSelectEmptySlot={onSelectEmptySlot}
      onSelectBooking={onSelectBooking}
    />
  );
}
