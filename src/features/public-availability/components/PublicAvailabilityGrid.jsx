import { ArrowRight, CalendarCheck2, X } from 'lucide-react';

import { PublicAvailabilityRoom } from './PublicAvailabilityRoom';

/**
 * Renders the responsive Room A & Room B schedule grid and the sticky/floating
 * Selected Slot Action Bar that carries the visitor's preferred date, time, and room
 * into the Landing Page Booking Inquiry form (`/?date=...&room=...&time=...#booking`).
 */
export function PublicAvailabilityGrid({
  roomSchedules = [],
  viewMode,
  activeDate,
  onSelectDayInWeek,
  selectedSlot,
  onSelectSlot,
  onClearSelectedSlot,
  onContinueToInquiry,
  requestedDurationMinutes,
}) {
  const isSideBySide = roomSchedules.length > 1;

  return (
    <div className="space-y-6">
      {/* Selected Slot Conversion Banner */}
      {selectedSlot ? (
        <div
          role="region"
          aria-label="Selected preferred session time"
          data-testid="public-availability-selected-bar"
          className="brutal-card-lg bg-studio-lime text-studio-ink sticky top-3 z-30 p-4 sm:p-5"
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <span className="border-studio-ink bg-studio-ink text-studio-lime flex h-10 w-10 shrink-0 items-center justify-center border-2">
                <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-studio-ink text-studio-white px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                    PREFERRED INQUIRY SLOT SELECTED
                  </span>
                  <span className="font-mono text-xs font-extrabold uppercase">
                    {selectedSlot.roomLabel}
                  </span>
                </div>
                <p className="font-display mt-1 text-xl leading-none font-black uppercase sm:text-2xl">
                  {selectedSlot.fullDateLabel} • {selectedSlot.startLabel} WIB (
                  {selectedSlot.rangeLabel} WIB)
                </p>
                <p className="text-studio-ink/85 mt-1 font-mono text-[11px] font-semibold">
                  Selecting a time does not lock or reserve the room. Final confirmation is subject
                  to studio verification.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0">
              <button
                type="button"
                onClick={() => onContinueToInquiry?.(selectedSlot)}
                className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase sm:flex-initial"
              >
                <span>Continue to Booking Inquiry</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onClearSelectedSlot}
                aria-label="Clear selected time slot"
                className="brutal-btn bg-studio-white text-studio-ink inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Room A & Room B Schedule Cards */}
      <div
        className={`grid grid-cols-1 gap-6 ${
          isSideBySide ? 'lg:grid-cols-2' : 'mx-auto max-w-4xl'
        }`}
      >
        {roomSchedules.map((room) => (
          <PublicAvailabilityRoom
            key={room.id}
            room={room}
            viewMode={viewMode}
            activeDate={activeDate}
            onSelectDayInWeek={onSelectDayInWeek}
            selectedSlot={selectedSlot}
            onSelectSlot={onSelectSlot}
            requestedDurationMinutes={requestedDurationMinutes}
          />
        ))}
      </div>
    </div>
  );
}
