import { STUDIO_ROOMS } from '../config/calendar-config';
import { formatIndonesianDateFull, getJakartaTodayIso } from '../utils/calendar-date';
import { CalendarTimelineGrid } from './CalendarTimelineGrid';

export function CalendarDayView({
  activeDate,
  roomFilter = 'all',
  onRoomFilterChange,
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
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-studio-ink text-base font-semibold tracking-tight sm:text-lg">
              {formatIndonesianDateFull(activeDate)}
            </span>
            {isToday ? (
              <span className="rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-2.5 py-0.5 text-[11px] font-medium text-[#243300]">
                Hari Ini
              </span>
            ) : null}
          </div>

          {onRoomFilterChange ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'room-a', label: 'Room A' },
                { id: 'room-b', label: 'Room B' },
              ].map((opt) => {
                const isSelected = roomFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onRoomFilterChange(opt.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border px-3 py-1 text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'border-[#151515] bg-[#151515] text-[#F1EEE4]'
                        : 'border-[#151515]/12 bg-white text-[#46433D] hover:border-[#151515]/25 hover:bg-[#F8F6EF]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
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
