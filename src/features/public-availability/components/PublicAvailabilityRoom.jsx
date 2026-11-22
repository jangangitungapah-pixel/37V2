import { ArrowRight, Check, Clock, Lock, Sliders, Volume2 } from 'lucide-react';

import {
  PUBLIC_SLOT_INTERVAL_MINUTES,
  PUBLIC_SLOT_STATES,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';

const SLOT_PERIOD_GROUPS = [
  {
    id: 'morning',
    label: 'Morning',
    windowLabel: '10:00–12:00',
    match: (startMinute) => startMinute < 720,
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    windowLabel: '12:00–18:00',
    match: (startMinute) => startMinute >= 720 && startMinute < 1080,
  },
  {
    id: 'evening',
    label: 'Evening',
    windowLabel: '18:00–23:00',
    match: (startMinute) => startMinute >= 1080,
  },
];

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
  onNextDay,
  selectedSlot,
  onSelectSlot,
  requestedDurationMinutes = PUBLIC_SLOT_INTERVAL_MINUTES,
}) {
  const daySchedules = room.daySchedules || [];
  const activeDaySchedule =
    daySchedules.find((d) => d.dateIso === activeDate) || daySchedules[0] || null;

  const isRoomA = room.id === 'room-a';
  const RoomIcon = isRoomA ? Volume2 : Sliders;

  const groupedSlots = activeDaySchedule
    ? SLOT_PERIOD_GROUPS.map((group) => {
        const slots = activeDaySchedule.slots.filter((s) => group.match(s.startMinute));
        const openCount = slots.filter((s) => s.state === PUBLIC_SLOT_STATES.AVAILABLE).length;
        return {
          ...group,
          slots,
          openCount,
        };
      })
    : [];

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
              {activeDaySchedule.selectableStartCount} Open
            </span>
            <span
              className={`font-mono text-[11px] font-bold ${
                isRoomA ? 'text-neutral-300' : 'text-studio-muted-ink'
              }`}
            >
              {activeDaySchedule.occupiedSlotsCount} / {activeDaySchedule.totalSlotsCount} booked
            </span>
          </div>
        ) : null}
      </div>

      {/* Week View 7-Day Selector Strip */}
      {viewMode === PUBLIC_VIEW_MODES.WEEK && daySchedules.length > 1 ? (
        <div
          aria-label={`${room.shortLabel} week summary`}
          className="border-studio-ink bg-studio-ivory border-b-2 p-3"
        >
          <p className="text-studio-muted-ink mb-2 font-mono text-[10px] font-extrabold tracking-wider uppercase">
            7-Day Overview — Tap a day to inspect slots:
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0">
            {daySchedules.map((day) => {
              const isSelectedDay = day.dateIso === activeDaySchedule?.dateIso;
              return (
                <button
                  key={day.dateIso}
                  type="button"
                  aria-pressed={isSelectedDay}
                  onClick={() => onSelectDayInWeek?.(day.dateIso)}
                  className={`flex min-w-[110px] shrink-0 cursor-pointer flex-col justify-between border-2 p-2 text-left transition-colors sm:min-w-0 ${
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

      {/* Active Day Schedule + Grouped 30-Minute Slots */}
      {activeDaySchedule ? (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-studio-ink text-lg leading-none font-black uppercase sm:text-xl">
                {activeDaySchedule.fullLabel}
              </h3>
              <p className="text-studio-muted-ink mt-0.5 font-mono text-[11px]">
                {requestedDurationMinutes > PUBLIC_SLOT_INTERVAL_MINUTES
                  ? `Showing start times fitting a ${requestedDurationMinutes}-minute session`
                  : 'Tap an open start time to prefill your booking request'}
              </p>
            </div>

            {activeDaySchedule.occupiedIntervals.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                  Booked:
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
            ) : null}
          </div>

          {activeDaySchedule.selectableStartCount === 0 ? (
            <div className="border-studio-ink/30 bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border p-3">
              <span className="text-studio-ink font-mono text-xs font-bold">
                No open slots available on this date
                {requestedDurationMinutes > PUBLIC_SLOT_INTERVAL_MINUTES
                  ? ' for this duration'
                  : ''}
                .
              </span>
              {onNextDay ? (
                <button
                  type="button"
                  onClick={onNextDay}
                  className="text-studio-ink hover:text-studio-orange inline-flex cursor-pointer items-center gap-1 font-mono text-xs font-extrabold uppercase underline"
                >
                  <span>Check Next Day</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            {groupedSlots.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="border-studio-ink/15 flex items-center justify-between border-b pb-1">
                  <span className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
                    {group.label}{' '}
                    <span className="text-studio-muted-ink font-semibold">
                      ({group.windowLabel})
                    </span>
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold uppercase ${
                      group.openCount > 0 ? 'text-studio-ink' : 'text-studio-muted-ink'
                    }`}
                  >
                    {group.openCount} open
                  </span>
                </div>

                <div
                  role="list"
                  aria-label={`${room.shortLabel} ${group.label} slots for ${activeDaySchedule.dateIso}`}
                  className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4"
                >
                  {group.slots.map((slot) => {
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
                          aria-label={`${slot.rangeLabel} WIB — Booked`}
                          className="border-studio-ink bg-studio-ink text-studio-ivory flex min-h-14 flex-col justify-between border-2 p-2.5 opacity-95"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-sm leading-none font-extrabold">
                              {slot.startLabel}
                            </span>
                            <Lock
                              className="text-studio-orange h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          <span className="text-studio-orange mt-1 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                            Booked
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
                          className="border-studio-ink/25 bg-studio-ivory/70 text-studio-muted-ink flex min-h-14 flex-col justify-between border p-2.5 opacity-60"
                        >
                          <span className="font-mono text-sm leading-none font-bold">
                            {slot.startLabel}
                          </span>
                          <span className="mt-1 font-mono text-[10px] font-semibold uppercase">
                            Past
                          </span>
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
                          aria-label={`${slot.rangeLabel} WIB — Too short for ${requestedDurationMinutes} minutes`}
                          className="border-studio-ink/60 bg-studio-orange/10 text-studio-ink flex min-h-14 flex-col justify-between border-[1.5px] border-dashed p-2.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-sm leading-none font-bold">
                              {slot.startLabel}
                            </span>
                            <Clock
                              className="text-studio-orange h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          <span className="text-studio-error-ink mt-1 font-mono text-[10px] font-bold uppercase">
                            Too short
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
                            <span className="font-mono text-sm leading-none font-extrabold">
                              {slot.startLabel}
                            </span>
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
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
