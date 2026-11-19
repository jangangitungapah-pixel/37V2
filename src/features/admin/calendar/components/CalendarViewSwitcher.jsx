import { CALENDAR_VIEW_MODES } from '../config/calendar-config';

export function CalendarViewSwitcher({ viewMode, onViewModeChange }) {
  return (
    <div
      role="group"
      aria-label="Mode tampilan kalender"
      className="border-studio-ink bg-studio-ivory grid w-full grid-cols-3 border-2 p-0.5 shadow-[2px_2px_0px_#151515] sm:inline-grid sm:w-auto sm:min-w-[234px]"
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
                ? 'border-studio-ink bg-studio-lime text-studio-ink min-h-8.5 w-full cursor-pointer border px-2 py-1 text-center font-mono text-[10px] font-extrabold tracking-wider uppercase transition-colors sm:min-h-11 sm:text-[11px]'
                : 'text-studio-ink hover:bg-studio-white min-h-8.5 w-full cursor-pointer border border-transparent px-2 py-1 text-center font-mono text-[10px] font-bold tracking-wider uppercase transition-colors sm:min-h-11 sm:text-[11px]'
            }
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
