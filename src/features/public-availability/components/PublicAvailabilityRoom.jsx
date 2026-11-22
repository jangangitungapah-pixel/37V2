import { Check, Clock, Lock, Sliders, Volume2 } from 'lucide-react';

import {
  PUBLIC_SLOT_INTERVAL_MINUTES,
  PUBLIC_SLOT_STATES,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';

/**
 * Renders the public availability schedule for a single studio room (`Room A` or `Room B`).
 *
 * Privacy Guarantee:
 * - Displays ONLY time ranges, room identity, and availability status labels.
 * - Never renders customer names, band names, phones, booking IDs, service types, or notes.
 */
export function PublicAvailabilityRoom({
  room,
  viewMode = PUBLIC_VIEW_MODES.DAY,
  activeDate,
  onSelectDayInWeek,
  selectedSlot,
  onSelectSlot,
  requestedDurationMinutes = PUBLIC_SLOT_INTERVAL_MINUTES,
}) {
  const daySchedules = room.daySchedules || [];
  const activeDaySchedule =
    daySchedules.find((d) => d.dateIso === activeDate) || daySchedules[0] || null;

  const isRoomA = room.id === 'room-a';
  const RoomIcon = isRoomA ? Volume2 : Sliders;

  return (
    <article
      data-testid={`public-availability-room-${room.id}`}
      className="brutal-card-lg bg-studio-white flex flex-col justify-between overflow-hidden"
    >
      {/* Room Header Banner */}
      <div
        className={`border-studio-ink flex flex-col justify-between gap-3 border-b-2 p-4 sm:flex-row sm:items-center sm:p-5 ${
          isRoomA ? 'bg-studio-ink text-studio-ivory' : 'bg-studio-ivory text-studio-ink'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`border-studio-ink flex h-10 w-10 shrink-0 items-center justify-center border-2 ${
              isRoomA ? 'bg-studio-lime text-studio-ink' : 'bg-studio-orange text-studio-white'
            }`}
          >
            <RoomIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase ${
                  isRoomA ? 'bg-studio-lime text-studio-ink' : 'bg-studio-ink text-studio-ivory'
                }`}
              >
                {room.badge}
              </span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  isRoomA ? 'text-neutral-300' : 'text-studio-muted-ink'
                }`}
              >
                10:00 – 23:00 WIB
              </span>
            </div>
            <h2 className="font-display mt-1 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl">
              {room.label}
            </h2>
            <p className={`mt-1 text-xs ${isRoomA ? 'text-neutral-300' : 'text-studio-muted-ink'}`}>
              {room.description}
            </p>
          </div>
        </div>

        {activeDaySchedule ? (
          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
            <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2.5 py-1 font-mono text-xs font-extrabold uppercase">
              {activeDaySchedule.selectableStartCount} Open Start Times
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                isRoomA ? 'text-neutral-300' : 'text-studio-muted-ink'
              }`}
            >
              {activeDaySchedule.occupiedSlotsCount} / {activeDaySchedule.totalSlotsCount} blocks
              occupied
            </span>
          </div>
        ) : null}
      </div>

      {/* Week View 7-Day Selector Strip (when in Week View) */}
      {viewMode === PUBLIC_VIEW_MODES.WEEK && daySchedules.length > 1 ? (
        <div
          aria-label={`${room.shortLabel} week summary`}
          className="border-studio-ink bg-studio-ivory border-b-2 p-3"
        >
          <p className="text-studio-muted-ink mb-2 font-mono text-[10px] font-extrabold tracking-wider uppercase">
            7-Day Overview — Tap a day to inspect 30-minute time blocks:
          </p>
          <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4 sm:grid-cols-7">
            {daySchedules.map((day) => {
              const isSelectedDay = day.dateIso === activeDaySchedule?.dateIso;
              return (
                <button
                  key={day.dateIso}
                  type="button"
                  aria-pressed={isSelectedDay}
                  onClick={() => onSelectDayInWeek?.(day.dateIso)}
                  className={`flex cursor-pointer flex-col justify-between border-2 p-2 text-left transition-colors ${
                    isSelectedDay
                      ? 'border-studio-ink bg-studio-ink text-studio-white shadow-[2px_2px_0px_#C8F13A]'
                      : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[11px] font-extrabold uppercase">
                      {day.compactLabel}
                    </span>
                    {day.isToday ? (
                      <span className="bg-studio-orange px-1 font-mono text-[9px] font-bold text-white uppercase">
                        Today
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] font-bold">
                    <span
                      className={
                        isSelectedDay
                          ? 'text-[#C8F13A]'
                          : day.selectableStartCount > 0
                            ? 'text-studio-ink'
                            : 'text-studio-error-ink'
                      }
                    >
                      {day.selectableStartCount} open
                    </span>
                    <span className="opacity-75"> • {day.occupiedSlotsCount} busy</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Active Day Occupied Intervals Summary Bar */}
      {activeDaySchedule ? (
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-studio-ink text-lg leading-none font-black uppercase sm:text-xl">
                {activeDaySchedule.fullLabel}
              </h3>
              <p className="text-studio-muted-ink mt-0.5 font-mono text-[11px]">
                {requestedDurationMinutes > PUBLIC_SLOT_INTERVAL_MINUTES
                  ? `Showing start times that can fit a ${requestedDurationMinutes}-minute session`
                  : 'Tap any available 30-minute start time to prefill your booking inquiry'}
              </p>
            </div>

            {activeDaySchedule.occupiedIntervals.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                  Occupied blocks:
                </span>
                {activeDaySchedule.occupiedIntervals.map((interval) => (
                  <span
                    key={`${interval.startMinute}-${interval.endMinute}`}
                    className="bg-studio-ink text-studio-ivory inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-bold"
                  >
                    <Lock className="text-studio-orange h-2.5 w-2.5" aria-hidden="true" />
                    <span>{interval.rangeLabel} WIB</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                No occupied sessions on this date
              </span>
            )}
          </div>

          {/* 26 Half-Hour Slots Grid (10:00 - 23:00 WIB) */}
          <div
            role="list"
            aria-label={`${room.shortLabel} 30-minute availability slots for ${activeDaySchedule.dateIso}`}
            className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4"
          >
            {activeDaySchedule.slots.map((slot) => {
              const isSelected =
                selectedSlot &&
                selectedSlot.dateIso === slot.dateIso &&
                selectedSlot.studioId === slot.studioId &&
                selectedSlot.startMinute === slot.startMinute;

              if (slot.state === PUBLIC_SLOT_STATES.OCCUPIED) {
                return (
                  <div
                    key={slot.startMinute}
                    role="listitem"
                    data-testid={`slot-${room.id}-${slot.dateIso}-${slot.startLabel}`}
                    data-slot-state="occupied"
                    aria-label={`${slot.rangeLabel} WIB — Occupied`}
                    className="border-studio-ink bg-studio-ink text-studio-ivory flex min-h-14 flex-col justify-between border-2 p-2.5 opacity-95"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-extrabold">{slot.rangeLabel}</span>
                      <Lock
                        className="text-studio-orange h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-studio-orange mt-1 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                      Occupied
                    </span>
                  </div>
                );
              }

              if (slot.state === PUBLIC_SLOT_STATES.PAST) {
                return (
                  <div
                    key={slot.startMinute}
                    role="listitem"
                    data-testid={`slot-${room.id}-${slot.dateIso}-${slot.startLabel}`}
                    data-slot-state="past"
                    aria-label={`${slot.rangeLabel} WIB — Past time`}
                    className="border-studio-ink/30 bg-studio-ivory/70 text-studio-muted-ink flex min-h-14 flex-col justify-between border p-2.5 opacity-65"
                  >
                    <span className="font-mono text-xs font-bold">{slot.rangeLabel}</span>
                    <span className="mt-1 font-mono text-[10px] font-semibold uppercase">Past</span>
                  </div>
                );
              }

              if (slot.state === PUBLIC_SLOT_STATES.DURATION_TOO_SHORT) {
                return (
                  <div
                    key={slot.startMinute}
                    role="listitem"
                    data-testid={`slot-${room.id}-${slot.dateIso}-${slot.startLabel}`}
                    data-slot-state="duration_too_short"
                    aria-label={`${slot.rangeLabel} WIB — Limited window (cannot fit ${requestedDurationMinutes} minutes)`}
                    className="border-studio-ink bg-studio-orange/10 text-studio-ink flex min-h-14 flex-col justify-between border-[1.5px] border-dashed p-2.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold">{slot.rangeLabel}</span>
                      <Clock className="text-studio-orange h-3 w-3 shrink-0" aria-hidden="true" />
                    </div>
                    <span className="text-studio-error-ink mt-1 font-mono text-[10px] font-bold uppercase">
                      Limited window
                    </span>
                  </div>
                );
              }

              return (
                <div key={slot.startMinute} role="listitem">
                  <button
                    type="button"
                    data-testid={`slot-${room.id}-${slot.dateIso}-${slot.startLabel}`}
                    data-slot-state="available"
                    aria-pressed={Boolean(isSelected)}
                    aria-label={`Select ${room.shortLabel} on ${slot.dateIso} at ${slot.startLabel} WIB (Available)`}
                    onClick={() =>
                      onSelectSlot?.({
                        dateIso: slot.dateIso,
                        fullDateLabel: activeDaySchedule.fullLabel,
                        studioId: room.id,
                        roomLabel: room.label,
                        roomShortLabel: room.shortLabel,
                        defaultService: room.defaultService,
                        startMinute: slot.startMinute,
                        endMinute: slot.requestedEndMinute || slot.endMinute,
                        startLabel: slot.startLabel,
                        rangeLabel: slot.requestedRangeLabel || slot.rangeLabel,
                        durationMinutes: requestedDurationMinutes,
                      })
                    }
                    className={`flex min-h-14 w-full cursor-pointer flex-col justify-between border-2 p-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-studio-ink bg-studio-orange text-studio-white shadow-[3px_3px_0px_#151515]'
                        : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime shadow-[2px_2px_0px_#151515]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-xs font-extrabold">{slot.rangeLabel}</span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <span
                          className="bg-studio-lime border-studio-ink inline-block h-2.5 w-2.5 shrink-0 border"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <span
                      className={`mt-1 font-mono text-[10px] font-extrabold tracking-wider uppercase ${
                        isSelected ? 'text-white' : 'text-studio-ink'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Available'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
}
