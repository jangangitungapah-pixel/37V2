import { useEffect, useRef } from 'react';
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
  focusDateIso = '',
  focusRequestKey = 0,
  onSelectEmptySlot,
  onSelectBooking,
}) {
  const scrollContainerRef = useRef(null);
  const rowHeightPx = CALENDAR_TIMELINE_ROW_HEIGHT_PX;
  const totalTimelineHeight = TIMELINE_HOURLY_SLOTS.length * rowHeightPx;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;

    const targetEl =
      (focusDateIso ? container.querySelector(`[data-column-date="${focusDateIso}"]`) : null) ||
      container.querySelector('[data-column-today="true"]');

    if (!targetEl) return undefined;

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    if (maxScrollLeft > 0) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetOffsetWithinScroll = targetRect.left - containerRect.left + container.scrollLeft;
      const colWidth = targetRect.width || 118;
      const leftContextPx =
        container.clientWidth >= TIME_COLUMN_WIDTH_PX + colWidth * 3 ? colWidth : 0;
      const targetScrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, Math.round(targetOffsetWithinScroll - TIME_COLUMN_WIDTH_PX - leftContextPx)),
      );

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: targetScrollLeft,
          behavior: focusRequestKey > 0 ? 'smooth' : 'auto',
        });
      } else {
        container.scrollLeft = targetScrollLeft;
      }
    }

    if (focusRequestKey > 0) {
      const pulseClasses = ['ring-2', 'ring-inset', 'ring-studio-lime'];
      targetEl.classList.add(...pulseClasses);
      const timerId = window.setTimeout(() => {
        targetEl.classList.remove(...pulseClasses);
      }, 900);

      return () => {
        window.clearTimeout(timerId);
        targetEl.classList.remove(...pulseClasses);
      };
    }

    return undefined;
  }, [focusDateIso, focusRequestKey]);

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
    <div aria-label={ariaLabel} className="sa-card relative isolate z-0 overflow-hidden">
      {/* Top Info & Room Color Legend Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/8 bg-[#FAF8F1] px-3.5 py-2.5 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
          {bannerLeft}

          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[#46433D]">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="bg-studio-lime h-2.5 w-2.5 rounded-full border border-[#658800]/60"
                aria-hidden="true"
              />
              <span>Room A</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-studio-orange h-2.5 w-2.5 rounded-full" aria-hidden="true" />
              <span>Room B</span>
            </span>
          </div>
        </div>

        {bannerRight ? (
          <div className="text-xs font-medium text-[#666159]">{bannerRight}</div>
        ) : null}
      </div>

      {/* Explicit Boundary Overflow Strip if any booking ends after 22:00 WIB */}
      {overflowBookings.length > 0 ? (
        <div
          role="region"
          aria-label="Booking melewati batas tampilan 22:00 WIB"
          className="flex flex-wrap items-center gap-2 border-b border-amber-500/20 bg-[#FEF4DD] px-3.5 py-2.5 text-xs font-medium text-[#8A4B08] sm:px-4"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
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
                  className="hover:bg-studio-lime text-studio-ink inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500/30 bg-white px-2.5 py-0.5 font-mono text-[10.5px] font-medium transition-colors"
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
      <div ref={scrollContainerRef} className="w-full overflow-x-auto overscroll-x-contain">
        <div
          className="grid min-w-full"
          style={{
            gridTemplateColumns,
            width: 'max-content',
          }}
        >
          {/* ROW 1: Sticky Top-Left WIB Corner + Column Headers */}
          <div className="sticky left-0 z-10 flex items-center justify-center border-r border-b border-white/10 bg-[#151515] px-1.5 py-2.5 font-mono text-[10.5px] font-semibold tracking-wide text-neutral-300 shadow-[2px_0_12px_-4px_rgba(21,21,21,0.3)]">
            WIB
          </div>

          {columns.map((col) => {
            const sessionCount = (col.bookings || []).length;
            return (
              <div
                key={`header-${col.id}`}
                data-column-date={col.dateIso}
                data-column-today={col.isToday ? 'true' : 'false'}
                data-column-selected={col.isSelected ? 'true' : 'false'}
                className={`flex flex-col justify-between border-r border-b border-white/10 px-2.5 py-2.5 text-[#F1EEE4] last:border-r-0 ${
                  col.isToday ? 'bg-[#1D2114]' : col.isSelected ? 'bg-[#22201C]' : 'bg-[#151515]'
                } ${col.isSelected ? 'border-b-studio-orange border-b-2' : col.isToday ? 'border-b-studio-lime border-b-2' : ''}`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[10.5px] font-medium text-neutral-300">
                    {col.eyebrow}
                  </span>

                  {col.isToday ? (
                    <span className="bg-studio-lime text-studio-ink shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold">
                      Hari Ini
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[10px] font-medium text-neutral-400 tabular-nums">
                      {sessionCount} sesi
                    </span>
                  )}
                </div>

                {col.onHeaderClick ? (
                  <button
                    type="button"
                    onClick={col.onHeaderClick}
                    aria-label={col.headerClickAriaLabel || `Buka Day View ${col.dateIso}`}
                    className={`mt-1.5 inline-flex w-full cursor-pointer items-baseline justify-between gap-1 text-left transition-colors ${
                      col.isToday || col.isSelected
                        ? 'text-studio-lime font-semibold'
                        : 'hover:text-studio-lime font-semibold text-white'
                    }`}
                  >
                    <span className="truncate text-sm tracking-tight">{col.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-neutral-400">→</span>
                  </button>
                ) : (
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {col.badgeLabel ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${col.badgeClass || ''}`}
                          >
                            {col.badgeLabel}
                          </span>
                        ) : null}
                        <span className="truncate text-sm font-semibold tracking-tight text-white">
                          {col.title}
                        </span>
                      </div>
                      {col.subtitle ? (
                        <p className="mt-0.5 truncate text-[10.5px] text-neutral-400">
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
            className="sticky left-0 z-10 border-r border-[#151515]/10 bg-[#FAF8F1] shadow-[2px_0_12px_-6px_rgba(21,21,21,0.08)] select-none"
            style={{ height: `${totalTimelineHeight}px` }}
          >
            {TIMELINE_HOURLY_SLOTS.map((slot) => (
              <div
                key={`time-${slot.startMinute}`}
                style={{ height: `${rowHeightPx}px` }}
                className="flex items-start justify-end border-b border-[#151515]/6 px-2 pt-1.5 font-mono text-[10.5px] font-medium text-[#666159] tabular-nums last:border-b-0"
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
                className={`relative border-r border-[#151515]/8 last:border-r-0 ${
                  col.isToday ? 'bg-[#FAF9EE]' : col.isSelected ? 'bg-[#F7F4EC]' : 'bg-white'
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
                    className="group flex w-full cursor-pointer items-center justify-center border-b border-[#151515]/6 px-1.5 transition-colors last:border-b-0 hover:bg-[#EDF8C2]/55"
                  >
                    <span className="text-studio-ink inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-0.5 font-mono text-[10px] font-medium opacity-0 shadow-xs transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
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
          <div className="sticky left-0 z-10 flex items-center justify-end border-t border-r border-[#151515]/10 bg-[#FAF8F1] px-2 py-1.5 font-mono text-[10px] font-medium text-[#666159] select-none">
            {TIMELINE_DISPLAY_END_LABEL}
          </div>

          {columns.map((col) => {
            const afterBoundaryBookings = (col.bookings || []).filter(
              (b) => Number(b.startMinute) >= CALENDAR_DISPLAY_END_MINUTE,
            );

            return (
              <div
                key={`boundary-${col.id}`}
                className="flex items-center border-t border-r border-[#151515]/8 bg-[#FAF8F1]/80 px-2 py-1.5 last:border-r-0"
              >
                {afterBoundaryBookings.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {afterBoundaryBookings.map((b) => (
                      <button
                        key={`after-${b.id}`}
                        type="button"
                        onClick={() => onSelectBooking(b)}
                        className="hover:bg-studio-lime text-studio-ink cursor-pointer rounded-full border border-amber-500/30 bg-[#FEF4DD] px-2 py-0.5 font-mono text-[9.5px] font-medium transition-colors"
                      >
                        {formatMinuteRange(b.startMinute, b.endMinute, false)} • {b.customerName}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="font-mono text-[10px] font-medium text-[#8B857B]">
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
