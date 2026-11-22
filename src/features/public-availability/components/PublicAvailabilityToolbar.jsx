import { Calendar, ChevronLeft, ChevronRight, Clock, DoorOpen } from 'lucide-react';

import {
  PUBLIC_ROOM_FILTER_OPTIONS,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';

const DURATION_FILTER_CHOICES = [
  { minutes: 30, label: '30m (Any start)' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
];

/**
 * Navigation & Filter Toolbar for the Public Availability Calendar (`/availability`).
 * Supports Date navigation (Prev, Today, Next, Date Picker), Room filter (All, Room A, Room B),
 * Duration filter (30m..240m), and Day / Week view switcher.
 */
export function PublicAvailabilityToolbar({
  viewMode,
  onViewModeChange,
  activeDate,
  todayIso,
  dateRangeLabel,
  onPreviousPeriod,
  onNextPeriod,
  onSelectToday,
  onSelectDate,
  roomFilter,
  onRoomFilterChange,
  requestedDurationMinutes,
  onDurationChange,
}) {
  return (
    <section
      aria-label="Availability calendar controls"
      className="border-studio-ink bg-studio-white border-b-2 py-4"
    >
      <div className="mx-auto max-w-[1680px] space-y-3.5 px-3 sm:px-6 lg:px-8">
        {/* Top Row: Date Navigation + Day/Week Switcher */}
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center">
              <button
                type="button"
                onClick={onPreviousPeriod}
                aria-label={viewMode === PUBLIC_VIEW_MODES.WEEK ? 'Previous week' : 'Previous day'}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex h-11 w-11 cursor-pointer items-center justify-center"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onSelectToday}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime -ml-0.5 inline-flex min-h-11 cursor-pointer items-center px-3.5 py-2 font-mono text-xs font-extrabold tracking-wider uppercase"
              >
                Today
              </button>

              <button
                type="button"
                onClick={onNextPeriod}
                aria-label={viewMode === PUBLIC_VIEW_MODES.WEEK ? 'Next week' : 'Next day'}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime -ml-0.5 inline-flex h-11 w-11 cursor-pointer items-center justify-center"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="public-availability-date-picker" className="sr-only">
                Select preferred date
              </label>
              <div className="relative flex items-center">
                <Calendar
                  className="text-studio-ink pointer-events-none absolute left-3 h-4 w-4"
                  aria-hidden="true"
                />
                <input
                  id="public-availability-date-picker"
                  type="date"
                  value={activeDate}
                  min={todayIso}
                  onChange={(e) => {
                    if (e.target.value) {
                      onSelectDate(e.target.value);
                    }
                  }}
                  className="border-studio-ink bg-studio-ivory min-h-11 border-2 py-1.5 pr-3 pl-9 font-mono text-xs font-bold"
                />
              </div>
            </div>

            <span
              data-testid="public-availability-period-label"
              className="font-display text-studio-ink text-xl leading-none font-black tracking-tight uppercase sm:text-2xl"
            >
              {dateRangeLabel}
            </span>
          </div>

          {/* Day / Week View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Calendar view mode"
              className="border-studio-ink bg-studio-ivory inline-flex border-2 p-0.5"
            >
              <button
                type="button"
                aria-pressed={viewMode === PUBLIC_VIEW_MODES.DAY}
                onClick={() => onViewModeChange(PUBLIC_VIEW_MODES.DAY)}
                className={`min-h-10 cursor-pointer px-3.5 py-1.5 font-mono text-xs font-extrabold tracking-wider uppercase transition-colors ${
                  viewMode === PUBLIC_VIEW_MODES.DAY
                    ? 'bg-studio-ink text-studio-white'
                    : 'text-studio-ink hover:bg-studio-lime'
                }`}
              >
                Day View
              </button>
              <button
                type="button"
                aria-pressed={viewMode === PUBLIC_VIEW_MODES.WEEK}
                onClick={() => onViewModeChange(PUBLIC_VIEW_MODES.WEEK)}
                className={`min-h-10 cursor-pointer px-3.5 py-1.5 font-mono text-xs font-extrabold tracking-wider uppercase transition-colors ${
                  viewMode === PUBLIC_VIEW_MODES.WEEK
                    ? 'bg-studio-ink text-studio-white'
                    : 'text-studio-ink hover:bg-studio-lime'
                }`}
              >
                Week View
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row: Room Selector + Target Session Duration */}
        <div className="border-studio-ink/15 flex flex-col justify-between gap-3 border-t pt-3 sm:flex-row sm:items-center">
          {/* Room Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-studio-muted-ink inline-flex items-center gap-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase">
              <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Studio Room:</span>
            </span>

            <div
              role="group"
              aria-label="Filter by studio room"
              className="flex flex-wrap items-center gap-1.5"
            >
              {PUBLIC_ROOM_FILTER_OPTIONS.map((option) => {
                const isActive = roomFilter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onRoomFilterChange(option.id)}
                    className={`min-h-10 cursor-pointer border-2 px-3 py-1 font-mono text-xs font-extrabold tracking-wider uppercase transition-colors ${
                      isActive
                        ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                        : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-ivory'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Session Duration Check */}
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="public-availability-duration-select"
              className="text-studio-muted-ink inline-flex items-center gap-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Check Duration Fit:</span>
            </label>
            <select
              id="public-availability-duration-select"
              value={requestedDurationMinutes}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="border-studio-ink bg-studio-ivory min-h-10 border-2 px-3 py-1 font-mono text-xs font-bold"
            >
              {DURATION_FILTER_CHOICES.map((opt) => (
                <option key={opt.minutes} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
