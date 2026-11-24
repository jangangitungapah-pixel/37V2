import { motion, useReducedMotion } from 'motion/react';

import { CALENDAR_VIEW_MODES } from '../config/calendar-config';

export function CalendarViewSwitcher({ viewMode, onViewModeChange }) {
  const prefersReducedMotion = useReducedMotion();

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
                ? 'text-studio-ink relative min-h-9 w-full cursor-pointer rounded-[10px] px-2.5 py-1.5 text-center text-xs font-semibold transition-colors'
                : 'hover:text-studio-ink relative min-h-9 w-full cursor-pointer rounded-[10px] px-2.5 py-1.5 text-center text-xs font-medium text-[#46433D] transition-colors hover:bg-white/70'
            }
          >
            {isActive ? (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : 'calendar-view-mode-pill'}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 460, damping: 34 }
                }
                className="bg-studio-lime absolute inset-0 rounded-[10px] shadow-[0_2px_8px_-2px_rgba(139,173,18,0.45),0_0_0_1px_rgba(122,158,12,0.22)]"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
