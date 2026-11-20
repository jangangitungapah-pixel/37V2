import { CALENDAR_VIEW_MODES } from '../config/calendar-config';

export function CalendarViewSwitcher({ viewMode, onViewModeChange }) {
  return (
    <div
      role="group"
      aria-label="Mode tampilan kalender"
      className="sa-pill-track grid w-full grid-cols-3 sm:inline-grid sm:w-auto sm:min-w-[240px]"
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
                ? 'bg-studio-lime text-studio-ink min-h-8.5 w-full cursor-pointer rounded-[10px] px-2.5 py-1.5 text-center text-xs font-semibold shadow-xs transition-all sm:min-h-9.5'
                : 'hover:text-studio-ink min-h-8.5 w-full cursor-pointer rounded-[10px] px-2.5 py-1.5 text-center text-xs font-medium text-[#46433D] transition-all hover:bg-white/80 sm:min-h-9.5'
            }
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
