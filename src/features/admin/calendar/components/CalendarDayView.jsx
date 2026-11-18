import { Plus } from 'lucide-react';

import {
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
  STUDIO_ROOMS,
  TIMELINE_HALF_HOUR_SLOTS,
} from '../config/calendar-config';
import { computeTimelineOverlapLayout } from '../utils/booking-time';
import { formatIndonesianDateFull, getJakartaTodayIso } from '../utils/calendar-date';
import { CalendarBookingCard } from './CalendarBookingCard';

const HALF_HOUR_ROW_HEIGHT_PX = 52;

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
  const totalTimelineHeight = TIMELINE_HALF_HOUR_SLOTS.length * HALF_HOUR_ROW_HEIGHT_PX;

  return (
    <div
      aria-label={`Tampilan jadwal harian ${formatIndonesianDateFull(activeDate)}`}
      className="brutal-card bg-studio-white overflow-hidden"
    >
      {/* Day Header Banner */}
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-studio-ink text-xl font-black tracking-tight uppercase sm:text-2xl">
            {formatIndonesianDateFull(activeDate)}
          </span>
          {isToday ? (
            <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
              Hari Ini
            </span>
          ) : null}
        </div>

        <span className="text-studio-muted-ink font-mono text-[11px] font-bold uppercase">
          Klik slot kosong untuk tambah booking
        </span>
      </div>

      {/* Scrollable Timeline Container (Horizontal scroll confined inside grid) */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[540px]">
          {/* Sticky Room Columns Header */}
          <div
            className="border-studio-ink bg-studio-ink text-studio-ivory grid border-b-2"
            style={{
              gridTemplateColumns: `76px repeat(${visibleRooms.length}, minmax(220px, 1fr))`,
            }}
          >
            <div className="border-r border-neutral-800 px-2.5 py-3 font-mono text-[10px] font-extrabold tracking-wider text-neutral-400 uppercase">
              WIB
            </div>

            {visibleRooms.map((room) => {
              const roomCount = dayBookings.filter((b) => b.studioId === room.id).length;
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-2 border-r border-neutral-800 px-3.5 py-3 last:border-r-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase ${room.badgeClass}`}
                      >
                        {room.shortLabel}
                      </span>
                      <span className="font-display truncate text-base font-black tracking-wide uppercase">
                        {room.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-400">
                      {room.subtitle}
                    </p>
                  </div>

                  <span className="border border-neutral-700 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                    {roomCount} sesi
                  </span>
                </div>
              );
            })}
          </div>

          {/* 30-Minute Timeline Body */}
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `76px repeat(${visibleRooms.length}, minmax(220px, 1fr))`,
              height: `${totalTimelineHeight}px`,
            }}
          >
            {/* Left Sticky Time Labels Column */}
            <div className="border-studio-ink bg-studio-ivory sticky left-0 z-10 border-r-2">
              {TIMELINE_HALF_HOUR_SLOTS.map((slot) => (
                <div
                  key={slot.startMinute}
                  style={{ height: `${HALF_HOUR_ROW_HEIGHT_PX}px` }}
                  className={`flex items-start justify-end px-2.5 pt-1.5 font-mono text-[11px] ${
                    slot.isFullHour
                      ? 'border-studio-ink text-studio-ink border-b font-extrabold'
                      : 'text-studio-muted-ink border-b border-dashed border-neutral-300 font-semibold'
                  }`}
                >
                  {slot.label}
                </div>
              ))}
            </div>

            {/* Room Tracks */}
            {visibleRooms.map((room) => {
              const roomBookings = dayBookings.filter((b) => b.studioId === room.id);
              const positionedBookings = computeTimelineOverlapLayout(roomBookings);

              return (
                <div
                  key={room.id}
                  className="border-studio-ink relative border-r last:border-r-0"
                  style={{ height: `${totalTimelineHeight}px` }}
                >
                  {/* Interactive 30-Minute Background Slot Cells */}
                  {TIMELINE_HALF_HOUR_SLOTS.map((slot) => (
                    <button
                      key={`${room.id}-${slot.startMinute}`}
                      type="button"
                      onClick={() =>
                        onSelectEmptySlot({
                          date: activeDate,
                          studioId: room.id,
                          startMinute: slot.startMinute,
                        })
                      }
                      aria-label={`Tambah booking ${room.label} tanggal ${activeDate} jam ${slot.label}`}
                      style={{ height: `${HALF_HOUR_ROW_HEIGHT_PX}px` }}
                      className={`group hover:bg-studio-lime/25 flex w-full cursor-pointer items-center justify-between px-3 text-left transition-colors ${
                        slot.isFullHour
                          ? 'border-b border-neutral-300'
                          : 'border-b border-dashed border-neutral-200'
                      }`}
                    >
                      <span className="text-studio-ink inline-flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>
                          + Booking {slot.label} • {room.label}
                        </span>
                      </span>
                    </button>
                  ))}

                  {/* Positioned Booking Blocks */}
                  {positionedBookings.map(({ booking, columnIndex, totalColumns }) => {
                    const topOffset =
                      ((Math.max(OPERATING_START_MINUTE, booking.startMinute) -
                        OPERATING_START_MINUTE) /
                        SLOT_INTERVAL_MINUTES) *
                      HALF_HOUR_ROW_HEIGHT_PX;
                    const blockHeight = Math.max(
                      HALF_HOUR_ROW_HEIGHT_PX - 4,
                      (booking.durationMinutes / SLOT_INTERVAL_MINUTES) * HALF_HOUR_ROW_HEIGHT_PX -
                        4,
                    );
                    const widthPercent = 100 / totalColumns;
                    const leftPercent = columnIndex * widthPercent;

                    return (
                      <div
                        key={booking.id}
                        style={{
                          position: 'absolute',
                          top: `${topOffset + 2}px`,
                          height: `${blockHeight}px`,
                          left: `calc(${leftPercent}% + 4px)`,
                          width: `calc(${widthPercent}% - 8px)`,
                          zIndex: 5 + columnIndex,
                        }}
                      >
                        <CalendarBookingCard
                          booking={booking}
                          onSelectBooking={onSelectBooking}
                          style={{ height: '100%' }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
