import { ArrowUpRight, Plus } from 'lucide-react';

import {
  formatIndonesianDateFull,
  getCalendarViewDateRange,
  getJakartaTodayIso,
  INDONESIAN_WEEKDAY_HEADERS_MONDAY_START,
  parseIsoDateParts,
} from '../utils/calendar-date';
import { CalendarBookingCard } from './CalendarBookingCard';

export function CalendarMonthView({
  activeDate,
  roomFilter = 'all',
  bookings = [],
  onSelectEmptySlot,
  onSelectBooking,
  onOpenDayView,
}) {
  const todayIso = getJakartaTodayIso();
  const monthRange = getCalendarViewDateRange('month', activeDate);
  const activeParts = parseIsoDateParts(activeDate);
  const defaultStudioId = roomFilter === 'all' ? 'room-a' : roomFilter;

  const bookingsByDate = new Map();
  for (const booking of bookings) {
    if (!bookingsByDate.has(booking.date)) {
      bookingsByDate.set(booking.date, []);
    }
    bookingsByDate.get(booking.date).push(booking);
  }

  return (
    <div
      aria-label="Tampilan jadwal bulanan"
      className="brutal-card bg-studio-white overflow-hidden"
    >
      {/* Top Info Banner */}
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-2.5 sm:px-5">
        <span className="font-mono text-[11px] font-extrabold uppercase">
          Klik angka tanggal untuk membuka Day View tanggal tersebut
        </span>

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
      </div>

      {/* Scrollable Month Grid Container on very narrow viewports */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[680px]">
          {/* Weekday Headers */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory grid grid-cols-7 border-b-2">
            {INDONESIAN_WEEKDAY_HEADERS_MONDAY_START.map((weekday) => (
              <div
                key={weekday.short}
                className="border-r border-neutral-800 px-3 py-2.5 text-center font-mono text-xs font-extrabold tracking-wider uppercase last:border-r-0"
              >
                <span className="hidden sm:inline">{weekday.long}</span>
                <span className="sm:hidden">{weekday.short}</span>
              </div>
            ))}
          </div>

          {/* Month Calendar Cells */}
          <div className="grid grid-cols-7">
            {monthRange.days.map((dateIso) => {
              const cellParts = parseIsoDateParts(dateIso);
              const isCurrentMonth =
                cellParts && activeParts && cellParts.month === activeParts.month;
              const isToday = dateIso === todayIso;
              const isSelected = dateIso === activeDate;
              const dayBookings = bookingsByDate.get(dateIso) || [];
              const visibleSlice = dayBookings.slice(0, 3);
              const hiddenCount = Math.max(0, dayBookings.length - visibleSlice.length);

              return (
                <div
                  key={dateIso}
                  className={`border-studio-ink flex min-h-[136px] flex-col justify-between border-r border-b p-2 transition-colors ${
                    !isCurrentMonth
                      ? 'bg-neutral-100/80 text-neutral-500'
                      : isToday
                        ? 'bg-[#faf7ec]'
                        : 'bg-studio-white'
                  } ${isSelected ? 'ring-studio-orange ring-2 ring-inset' : ''}`}
                >
                  <div>
                    {/* Cell Top Row: Date Number Button (opens Day View) + Quick Add Button */}
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenDayView?.(dateIso)}
                        aria-label={`Buka jadwal harian ${formatIndonesianDateFull(dateIso)}`}
                        className={
                          isToday
                            ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-8 cursor-pointer items-center gap-1 border px-2 py-0.5 font-mono text-xs font-extrabold uppercase shadow-[1px_1px_0px_#151515]'
                            : 'text-studio-ink hover:bg-studio-ivory inline-flex min-h-8 cursor-pointer items-center gap-1 px-1.5 py-0.5 font-mono text-xs font-extrabold'
                        }
                      >
                        <span>{cellParts?.day}</span>
                        {isToday ? <span className="text-[9px]">Hari Ini</span> : null}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onSelectEmptySlot({
                            date: dateIso,
                            studioId: defaultStudioId,
                            startMinute: 600,
                          })
                        }
                        aria-label={`Tambah booking tanggal ${dateIso}`}
                        title={`Tambah booking tanggal ${dateIso}`}
                        className="border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex h-7 w-7 cursor-pointer items-center justify-center border transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Booking Cards List */}
                    <div className="mt-2 space-y-1.5">
                      {visibleSlice.map((booking) => (
                        <CalendarBookingCard
                          key={booking.id}
                          booking={booking}
                          variant="compact"
                          onSelectBooking={onSelectBooking}
                        />
                      ))}

                      {hiddenCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenDayView?.(dateIso)}
                          className="border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-lime flex w-full cursor-pointer items-center justify-between border px-2 py-1 font-mono text-[10px] font-extrabold uppercase"
                        >
                          <span>+{hiddenCount} booking lainnya</span>
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
