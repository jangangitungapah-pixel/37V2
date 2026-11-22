import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import {
  PUBLIC_ROOM_FILTER_OPTIONS,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';

const DURATION_FILTER_CHOICES = [
  { minutes: 30, label: 'Any (30m+)' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
];

/**
 * Compact Responsive Toolbar for the Public Availability Calendar (`/availability`).
 * Row 1: Period heading + Day / Week toggle.
 * Row 2: Date stepper + native date picker, Room filter tabs, and Session Duration filter.
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
  const isAtEarliestDay = viewMode === PUBLIC_VIEW_MODES.DAY && activeDate <= todayIso;

  return (
    <section
      aria-label="Availability calendar controls"
      className="border-studio-ink bg-studio-white border-b-2 py-3 sm:py-3.5"
    >
      <div className="mx-auto max-w-[1680px] space-y-2.5 px-3 sm:px-6 lg:px-8">
        {/* Row 1: Active Period Heading + Day / Week View Switcher */}
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center justify-between gap-2">
            <h2
              data-testid="public-availability-period-label"
              className="font-display text-studio-ink text-xl leading-none font-black tracking-tight uppercase sm:text-2xl"
            >
              {dateRangeLabel}
            </h2>
          </div>

          <div
            role="group"
            aria-label="Calendar view mode"
            className="border-studio-ink bg-studio-ivory grid w-full grid-cols-2 border-2 p-0.5 sm:inline-flex sm:w-auto"
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

        {/* Row 2: Date Controls + Room Selector + Session Duration Filter */}
        <div className="border-studio-ink/15 flex flex-col justify-between gap-2.5 border-t pt-2.5 lg:flex-row lg:items-center">
          {/* Date Stepper + Clean Native Date Input */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="inline-flex shrink-0 items-center">
              <button
                type="button"
                onClick={onPreviousPeriod}
                disabled={isAtEarliestDay}
                aria-label={viewMode === PUBLIC_VIEW_MODES.WEEK ? 'Previous week' : 'Previous day'}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onSelectToday}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime -ml-0.5 inline-flex min-h-10 cursor-pointer items-center px-3 py-1.5 font-mono text-xs font-extrabold tracking-wider uppercase"
              >
                Today
              </button>

              <button
                type="button"
                onClick={onNextPeriod}
                aria-label={viewMode === PUBLIC_VIEW_MODES.WEEK ? 'Next week' : 'Next day'}
                className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-lime -ml-0.5 inline-flex h-10 w-10 cursor-pointer items-center justify-center"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="min-w-0 flex-1 sm:flex-initial">
              <label htmlFor="public-availability-date-picker" className="sr-only">
                Select preferred date
              </label>
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
                className="border-studio-ink bg-studio-ivory h-10 w-full border-2 px-3 font-mono text-xs font-bold sm:w-44"
              />
            </div>
          </div>

          {/* Room Tabs + Session Duration Select */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <div
              role="group"
              aria-label="Filter by studio room"
              className="grid w-full grid-cols-3 gap-1.5 sm:inline-flex sm:w-auto"
            >
              {PUBLIC_ROOM_FILTER_OPTIONS.map((option) => {
                const isActive = roomFilter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onRoomFilterChange(option.id)}
                    className={`min-h-10 cursor-pointer border-2 px-2.5 py-1 text-center font-mono text-[11px] font-extrabold tracking-wider uppercase transition-colors sm:px-3 sm:text-xs ${
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

            <div className="flex items-center gap-2">
              <label
                htmlFor="public-availability-duration-select"
                className="text-studio-muted-ink inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-extrabold tracking-wider uppercase"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Duration:</span>
              </label>
              <select
                id="public-availability-duration-select"
                value={requestedDurationMinutes}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                className={`border-studio-ink h-10 flex-1 border-2 px-2.5 font-mono text-xs font-bold sm:w-40 sm:flex-initial ${
                  requestedDurationMinutes > 30 ? 'bg-studio-lime/35' : 'bg-studio-ivory'
                }`}
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
      </div>
    </section>
  );
}
