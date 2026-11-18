import { CALENDAR_VIEW_MODES } from '../config/calendar-config';

export function CalendarViewSwitcher({ viewMode, onViewModeChange }) {
  return (
    <div
      role="group"
      aria-label="Mode tampilan kalender"
      className="border-studio-ink bg-studio-ivory inline-flex border-2 p-0.5 shadow-[2px_2px_0px_#151515]"
    >
      {CALENDAR_VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onViewModeChange(mode.id)}
            aria-pressed={isActive}
            className={
              isActive
                ? 'border-studio-ink bg-studio-lime text-studio-ink min-h-11 cursor-pointer border px-3.5 py-1.5 font-mono text-xs font-extrabold tracking-wider uppercase transition-colors'
                : 'text-studio-ink hover:bg-studio-white min-h-11 cursor-pointer border border-transparent px-3.5 py-1.5 font-mono text-xs font-bold tracking-wider uppercase transition-colors'
            }
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
