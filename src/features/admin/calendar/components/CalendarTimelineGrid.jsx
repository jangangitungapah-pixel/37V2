import { AlertCircle, Plus } from 'lucide-react';

import {
  CALENDAR_DISPLAY_END_MINUTE,
  CALENDAR_DISPLAY_START_MINUTE,
  CALENDAR_TIMELINE_ROW_HEIGHT_PX,
  getStudioRoomById,
  TIMELINE_DISPLAY_END_LABEL,
  TIMELINE_HOURLY_SLOTS,
} from '../config/calendar-config';
import {
  computeHourlyTimelineBlockMetrics,
  computeTimelineOverlapLayout,
  formatMinuteRange,
} from '../utils/booking-time';
import { formatIndonesianDateCompact } from '../utils/calendar-date';
import { CalendarBookingCard } from './CalendarBookingCard';

const TIME_COLUMN_WIDTH_PX = 52;

export function CalendarTimelineGrid({
  ariaLabel,
  bannerLeft = null,
  bannerRight = null,
  columns = [],
  columnTrackCss = 'minmax(150px, 1fr)',
  cardVariant = 'compact',
  onSelectEmptySlot,
  onSelectBooking,
}) {
  const rowHeightPx = CALENDAR_TIMELINE_ROW_HEIGHT_PX;
  const totalTimelineHeight = TIMELINE_HOURLY_SLOTS.length * rowHeightPx;

  const gridTemplateColumns = `${TIME_COLUMN_WIDTH_PX}px repeat(${Math.max(
    1,
    columns.length,
  )}, ${columnTrackCss})`;

  // Collect all bookings that extend past or begin at/after 22:00 display boundary
  const overflowBookings = columns.flatMap((col) =>
    (col.bookings || [])
      .filter((b) => Number(b.endMinute) > CALENDAR_DISPLAY_END_MINUTE)
      .map((b) => ({ booking: b, col })),
  );

  return (
      <div
        aria-label={ariaLabel}
        className="cal-card bg-studio-white relative isolate z-0 overflow-hidden"
      >
        {/* Top Info & Room Color Legend Strip */}
        <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {bannerLeft}

            <div className="flex flex-wrap items-center gap-2.5 font-mono text-[10px] font-bold">
              <span className="inline-flex items-center gap-1">
                <span
                  className="bg-studio-lime border-studio-ink h-2.5 w-2.5 border"
                  aria-hidden="true"
                />
                <span>Room A</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="bg-studio-orange border-studio-ink h-2.5 w-2.5 border"
                  aria-hidden="true"
                />
                <span>Room B</span>
              </span>
            </div>
          </div>

          {bannerRight ? (
            <div className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
              {bannerRight}
            </div>
          ) : null}
        </div>

        {/* Explicit Boundary Overflow Strip if any booking ends after 22:00 WIB */}
        {overflowBookings.length > 0 ? (
          <div
            role="region"
            aria-label="Booking melewati batas tampilan 22:00 WIB"
            className="border-studio-ink text-studio-ink flex flex-wrap items-center gap-2 border-b-2 bg-amber-100 px-3 py-2 text-[11px] font-bold sm:px-4"
          >
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
              <AlertCircle className="text-studio-orange h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Sesi lewat 22:00 WIB ({overflowBookings.length}):</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {overflowBookings.map(({ booking }) => {
                const room = getStudioRoomById(booking.studioId);
                return (
                  <button
                    key={`overflow-${booking.id}`}
                    type="button"
                    onClick={() => onSelectBooking(booking)}
                    className="border-studio-ink bg-studio-white hover:bg-studio-lime inline-flex cursor-pointer items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-extrabold"
                  >
                    <span>{formatIndonesianDateCompact(booking.date)}</span>
                    <span>• {formatMinuteRange(booking.startMinute, booking.endMinute, false)}</span>
                    <span>• {room.shortLabel}</span>
                    <span>• {booking.customerName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Unified Horizontal Scroll Container (Header + Body share the exact same CSS Grid) */}
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div
            className="grid min-w-full"
            style={{
              gridTemplateColumns,
              width: 'max-content',
            }}
          >
            {/* ROW 1: Sticky Top-Left WIB Corner + Column Headers */}
              <div className="border-studio-ink bg-studio-ink sticky left-0 z-10 flex items-center justify-center border-r-2 border-b-2 px-1.5 py-2 font-mono text-[10px] font-extrabold tracking-wider text-neutral-300 uppercase shadow-[2px_0px_0px_rgba(21,21,21,0.18)]">
                WIB
              </div>

              {columns.map((col) => {
                const sessionCount = (col.bookings || []).length;
                return (
                  <div
                    key={`header-${col.id}`}
                    data-column-today={col.isToday ? 'true' : 'false'}
                    data-column-selected={col.isSelected ? 'true' : 'false'}
                    className={`border-studio-ink flex flex-col justify-between border-r border-b-2 px-2 py-2 last:border-r-0 ${col.isToday ? 'bg-neutral-900' : col.isSelected ? 'bg-[#22201c]' : 'bg-studio-ink'
                      } ${col.isSelected ? 'border-b-studio-orange' : ''} text-studio-ivory`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-[10px] font-extrabold tracking-wider text-neutral-300 uppercase">
                        {col.eyebrow}
                      </span>

                      {col.isToday ? (
                        <span className="border-studio-ink bg-studio-lime text-studio-ink py-0.2 shrink-0 border px-1 font-mono text-[9px] font-extrabold uppercase">
                          Hari Ini
                        </span>
                      ) : (
                        <span className="shrink-0 font-mono text-[9px] font-bold text-neutral-400">
                          {sessionCount} sesi
                        </span>
                      )}
                    </div>

                    {col.onHeaderClick ? (
                      <button
                        type="button"
                        onClick={col.onHeaderClick}
                        aria-label={col.headerClickAriaLabel || `Buka Day View ${col.dateIso}`}
                        className={`mt-1 inline-flex w-full cursor-pointer items-baseline justify-between gap-1 text-left transition-colors ${col.isToday || col.isSelected
                            ? 'text-studio-lime font-extrabold'
                            : 'hover:text-studio-lime font-bold text-white'
                          }`}
                      >
                        <span className="font-display truncate text-base leading-none uppercase">
                          {col.title}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-neutral-300 underline">
                          →
                        </span>
                      </button>
                    ) : (
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {col.badgeLabel ? (
                              <span
                                className={`py-0.2 border px-1 font-mono text-[9px] font-extrabold uppercase ${col.badgeClass || ''}`}
                              >
                                {col.badgeLabel}
                              </span>
                            ) : null}
                            <span className="font-display truncate text-base leading-none font-black text-white uppercase">
                              {col.title}
                            </span>
                          </div>
                          {col.subtitle ? (
                            <p className="mt-0.5 truncate font-mono text-[9px] text-neutral-400">
                              {col.subtitle}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ROW 2: Left Sticky Time Column + Timeline Day/Room Columns (10:00 – 21:00 rows) */}
              <div
                className="border-studio-ink bg-studio-ivory sticky left-0 z-10 border-r-2 shadow-[2px_0px_0px_rgba(21,21,21,0.14)] select-none"
                style={{ height: `${totalTimelineHeight}px` }}
              >
                {TIMELINE_HOURLY_SLOTS.map((slot) => (
                  <div
                    key={`time-${slot.startMinute}`}
                    style={{ height: `${rowHeightPx}px` }}
                    className="border-studio-ink/25 text-studio-ink flex items-start justify-end border-b px-1.5 pt-1 font-mono text-[10px] font-extrabold last:border-b-0"
                  >
                    {slot.label}
                  </div>
                ))}
              </div>

              {columns.map((col) => {
                const colBookings = col.bookings || [];
                const renderableBookings = colBookings.filter(
                  (b) =>
                    computeHourlyTimelineBlockMetrics(
                      b,
                      rowHeightPx,
                      CALENDAR_DISPLAY_START_MINUTE,
                      CALENDAR_DISPLAY_END_MINUTE,
                    ).isRenderableInGrid,
                );
                const positionedBookings = computeTimelineOverlapLayout(renderableBookings);

                return (
                  <div
                    key={`track-${col.id}`}
                    data-track-date={col.dateIso}
                    className={`border-studio-ink relative border-r last:border-r-0 ${col.isToday ? 'bg-[#faf7ec]' : col.isSelected ? 'bg-[#f6f3e8]' : 'bg-studio-white'
                      }`}
                    style={{ height: `${totalTimelineHeight}px` }}
                  >
                    {/* Hourly Empty Slot Click Targets (10:00 – 21:00) */}
                    {TIMELINE_HOURLY_SLOTS.map((slot) => (
                      <button
                        key={`${col.id}-${slot.startMinute}`}
                        type="button"
                        onClick={() =>
                          onSelectEmptySlot({
                            date: col.dateIso,
                            studioId: col.studioId,
                            startMinute: slot.startMinute,
                          })
                        }
                        aria-label={`Tambah booking ${col.slotAriaTarget || col.title} tanggal ${col.dateIso} jam ${slot.label}`}
                        style={{ height: `${rowHeightPx}px` }}
                        className="group hover:bg-studio-lime/25 flex w-full cursor-pointer items-center justify-center border-b border-neutral-200 px-1.5 transition-colors last:border-b-0"
                      >
                        <span className="text-studio-ink inline-flex items-center gap-0.5 font-mono text-[9px] font-extrabold uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>{slot.label}</span>
                        </span>
                      </button>
                    ))}

                    {/* Proportionally Positioned Booking Cards */}
                    {positionedBookings.map(({ booking, columnIndex, totalColumns }) => {
                      const metrics = computeHourlyTimelineBlockMetrics(
                        booking,
                        rowHeightPx,
                        CALENDAR_DISPLAY_START_MINUTE,
                        CALENDAR_DISPLAY_END_MINUTE,
                      );

                      const widthPercent = 100 / totalColumns;
                      const leftPercent = columnIndex * widthPercent;

                      return (
                        <div
                          key={booking.id}
                          style={{
                            position: 'absolute',
                            top: `${metrics.topPx}px`,
                            height: `${metrics.heightPx}px`,
                            left: `calc(${leftPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - 4px)`,
                            zIndex: 5 + columnIndex,
                          }}
                        >
                          <CalendarBookingCard
                            booking={booking}
                            variant={cardVariant}
                            isMultiLane={totalColumns > 1}
                            endsAfterDisplay={metrics.endsAfterDisplay}
                            onSelectBooking={onSelectBooking}
                            style={{ height: '100%' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ROW 3: 22:00 WIB End Boundary Marker (non-clickable visual boundary) */}
              <div className="border-studio-ink bg-studio-ivory sticky left-0 z-10 flex items-center justify-end border-t-2 border-r-2 px-1.5 py-1 font-mono text-[10px] font-extrabold select-none">
                {TIMELINE_DISPLAY_END_LABEL}
              </div>

              {columns.map((col) => {
                const afterBoundaryBookings = (col.bookings || []).filter(
                  (b) => Number(b.startMinute) >= CALENDAR_DISPLAY_END_MINUTE,
                );

                return (
                  <div
                    key={`boundary-${col.id}`}
                    className="border-studio-ink bg-studio-ivory/75 flex items-center border-t-2 border-r px-2 py-1 last:border-r-0"
                  >
                    {afterBoundaryBookings.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {afterBoundaryBookings.map((b) => (
                          <button
                            key={`after-${b.id}`}
                            type="button"
                            onClick={() => onSelectBooking(b)}
                            className="border-studio-ink hover:bg-studio-lime cursor-pointer border bg-amber-200 px-1.5 py-0.5 font-mono text-[9px] font-extrabold"
                          >
                            {formatMinuteRange(b.startMinute, b.endMinute, false)} • {b.customerName}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-studio-muted-ink font-mono text-[9px] font-bold uppercase">
                        Batas 22:00 WIB
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        );
}
