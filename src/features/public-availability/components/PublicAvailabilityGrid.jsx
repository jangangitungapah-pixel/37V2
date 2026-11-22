import { ArrowRight, CalendarCheck2, X } from 'lucide-react';

import { PublicAvailabilityRoom } from './PublicAvailabilityRoom';

/**
 * Renders the responsive Room A & Room B schedule grid and a thumb-reachable sticky bottom
 * Selected Slot Action Bar that carries the visitor's preferred date, time, and room
 * into the Landing Page Booking Request form (`/?date=...&room=...&time=...#booking`).
 */
export function PublicAvailabilityGrid({
  roomSchedules = [],
  viewMode,
  activeDate,
  onSelectDayInWeek,
  onNextDay,
  selectedSlot,
  onSelectSlot,
  onClearSelectedSlot,
  onContinueToInquiry,
  requestedDurationMinutes,
}) {
  const isSideBySide = roomSchedules.length > 1;

  return (
    <div className="space-y-6">
      {/* Room A & Room B Schedule Cards */}
      <div
        className={`grid grid-cols-1 gap-5 ${
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
            onNextDay={onNextDay}
            selectedSlot={selectedSlot}
            onSelectSlot={onSelectSlot}
            requestedDurationMinutes={requestedDurationMinutes}
          />
        ))}
      </div>

      {/* Selected Slot Conversion Banner (sticky at bottom edge for easy thumb access on mobile) */}
      {selectedSlot ? (
        <div
          role="region"
          aria-label="Selected preferred session time"
          data-testid="public-availability-selected-bar"
          className="brutal-card-lg bg-studio-lime text-studio-ink sticky bottom-3 z-30 p-3.5 sm:p-4"
        >
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <span className="border-studio-ink bg-studio-ink text-studio-lime flex h-9 w-9 shrink-0 items-center justify-center border-2 sm:h-10 sm:w-10">
                <CalendarCheck2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="bg-studio-ink text-studio-white px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                    Selected Slot
                  </span>
                  <span className="font-mono text-xs font-extrabold uppercase">
                    {selectedSlot.roomShortLabel || selectedSlot.roomLabel}
                  </span>
                </div>
                <p className="font-display mt-1 text-lg leading-tight font-black uppercase sm:text-2xl">
                  {selectedSlot.fullDateLabel} • {selectedSlot.startLabel} WIB
                  {selectedSlot.durationMinutes > 30 ? ` (${selectedSlot.rangeLabel} WIB)` : ''}
                </p>
                <p className="text-studio-ink/80 mt-0.5 font-mono text-[10px] font-semibold sm:text-[11px]">
                  Tentative slot — confirmed after studio team verification.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:shrink-0">
              <button
                type="button"
                onClick={() => onContinueToInquiry?.(selectedSlot)}
                className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-2 font-mono text-xs font-extrabold tracking-wider uppercase sm:flex-initial sm:px-5"
              >
                <span>Continue to Booking Request</span>
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
    </div>
  );
}
