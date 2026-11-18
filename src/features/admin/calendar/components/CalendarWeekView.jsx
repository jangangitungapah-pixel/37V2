import { Plus } from 'lucide-react';

import {
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
  TIMELINE_HALF_HOUR_SLOTS,
} from '../config/calendar-config';
import { computeTimelineOverlapLayout } from '../utils/booking-time';
import {
  formatIndonesianDateCompact,
  getCalendarViewDateRange,
  getJakartaTodayIso,
  INDONESIAN_DAY_NAMES_SHORT,
  parseIsoDateParts,
} from '../utils/calendar-date';
import { CalendarBookingCard } from './CalendarBookingCard';

const WEEK_HALF_HOUR_ROW_PX = 46;

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
  const totalTimelineHeight = TIMELINE_HALF_HOUR_SLOTS.length * WEEK_HALF_HOUR_ROW_PX;

  return (
    <div
      aria-label="Tampilan jadwal mingguan 7 hari"
      className="brutal-card bg-studio-white overflow-hidden"
    >
      {/* Top Info Strip */}
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-studio-lime border-studio-ink h-2.5 w-2.5 border" />
            <span>Room A</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-studio-orange border-studio-ink h-2.5 w-2.5 border" />
            <span>Room B</span>
          </span>
        </div>

        <span className="text-studio-muted-ink font-mono text-[11px] font-bold uppercase">
          Geser tabel untuk melihat 7 hari • Klik tanggal untuk detail harian
        </span>
      </div>

      {/* Horizontal Scroll Container (Confined inside Week Grid) */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[920px]">
          {/* 7-Day Column Headers */}
          <div
            className="border-studio-ink bg-studio-ink text-studio-ivory grid border-b-2"
            style={{
              gridTemplateColumns: '72px repeat(7, minmax(120px, 1fr))',
            }}
          >
            <div className="border-r border-neutral-800 px-2 py-3 font-mono text-[10px] font-extrabold text-neutral-400 uppercase">
              WIB
            </div>

            {weekRange.days.map((dateIso) => {
              const parts = parseIsoDateParts(dateIso);
              const dayShort = parts ? INDONESIAN_DAY_NAMES_SHORT[parts.dayOfWeek] : '';
              const isToday = dateIso === todayIso;
              const isSelected = dateIso === activeDate;
              const dayCount = bookings.filter((b) => b.date === dateIso).length;

              return (
                <div
                  key={dateIso}
                  className={`flex flex-col justify-between border-r border-neutral-800 px-2.5 py-2.5 last:border-r-0 ${
                    isToday ? 'bg-neutral-900' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] font-extrabold tracking-wider text-neutral-300 uppercase">
                      {dayShort}
                    </span>

                    {isToday ? (
                      <span className="bg-studio-lime text-studio-ink px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                        Hari Ini
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-neutral-400">
                        {dayCount} sesi
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenDayView?.(dateIso)}
                    aria-label={`Buka jadwal harian ${dateIso}`}
                    className={`mt-1 inline-flex cursor-pointer items-center justify-between text-left transition-colors ${
                      isToday || isSelected
                        ? 'text-studio-lime font-extrabold'
                        : 'hover:text-studio-lime font-bold text-white'
                    }`}
                  >
                    <span className="font-display text-lg leading-none uppercase">
                      {formatIndonesianDateCompact(dateIso)}
                    </span>
                    <span className="font-mono text-[9px] underline">Detail →</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* 30-Minute Timeline Body across 7 Days */}
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: '72px repeat(7, minmax(120px, 1fr))',
              height: `${totalTimelineHeight}px`,
            }}
          >
            {/* Sticky Time Column */}
            <div className="border-studio-ink bg-studio-ivory sticky left-0 z-10 border-r-2">
              {TIMELINE_HALF_HOUR_SLOTS.map((slot) => (
                <div
                  key={slot.startMinute}
                  style={{ height: `${WEEK_HALF_HOUR_ROW_PX}px` }}
                  className={`flex items-start justify-end px-2 pt-1 font-mono text-[10px] ${
                    slot.isFullHour
                      ? 'border-studio-ink text-studio-ink border-b font-extrabold'
                      : 'text-studio-muted-ink border-b border-dashed border-neutral-300 font-semibold'
                  }`}
                >
                  {slot.label}
                </div>
              ))}
            </div>

            {/* 7 Day Columns */}
            {weekRange.days.map((dateIso) => {
              const isToday = dateIso === todayIso;
              const dayBookings = bookings.filter((b) => b.date === dateIso);
              const positionedBookings = computeTimelineOverlapLayout(dayBookings);

              return (
                <div
                  key={dateIso}
                  className={`border-studio-ink relative border-r last:border-r-0 ${
                    isToday ? 'bg-[#faf7ec]' : 'bg-studio-white'
                  }`}
                  style={{ height: `${totalTimelineHeight}px` }}
                >
                  {TIMELINE_HALF_HOUR_SLOTS.map((slot) => (
                    <button
                      key={`${dateIso}-${slot.startMinute}`}
                      type="button"
                      onClick={() =>
                        onSelectEmptySlot({
                          date: dateIso,
                          studioId: defaultStudioId,
                          startMinute: slot.startMinute,
                        })
                      }
                      aria-label={`Tambah booking tanggal ${dateIso} jam ${slot.label}`}
                      style={{ height: `${WEEK_HALF_HOUR_ROW_PX}px` }}
                      className={`group hover:bg-studio-lime/25 flex w-full cursor-pointer items-center justify-center px-1.5 transition-colors ${
                        slot.isFullHour
                          ? 'border-b border-neutral-300'
                          : 'border-b border-dashed border-neutral-200'
                      }`}
                    >
                      <span className="text-studio-ink inline-flex items-center gap-0.5 font-mono text-[9px] font-extrabold uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>{slot.label}</span>
                      </span>
                    </button>
                  ))}

                  {positionedBookings.map(({ booking, columnIndex, totalColumns }) => {
                    const topOffset =
                      ((Math.max(OPERATING_START_MINUTE, booking.startMinute) -
                        OPERATING_START_MINUTE) /
                        SLOT_INTERVAL_MINUTES) *
                      WEEK_HALF_HOUR_ROW_PX;
                    const blockHeight = Math.max(
                      WEEK_HALF_HOUR_ROW_PX - 2,
                      (booking.durationMinutes / SLOT_INTERVAL_MINUTES) * WEEK_HALF_HOUR_ROW_PX - 2,
                    );
                    const widthPercent = 100 / totalColumns;
                    const leftPercent = columnIndex * widthPercent;

                    return (
                      <div
                        key={booking.id}
                        style={{
                          position: 'absolute',
                          top: `${topOffset + 1}px`,
                          height: `${blockHeight}px`,
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
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
