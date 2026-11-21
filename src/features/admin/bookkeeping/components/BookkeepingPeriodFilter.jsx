import { Calendar } from 'lucide-react';

import {
  BOOKKEEPING_PERIOD_PRESET_OPTIONS,
  BOOKKEEPING_PERIOD_PRESETS,
} from '../config/bookkeeping-config';

export function BookkeepingPeriodFilter({
  preset,
  onPresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  periodLabel,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
        {BOOKKEEPING_PERIOD_PRESET_OPTIONS.map((option) => {
          const isActive = preset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPresetChange?.(option.id)}
              aria-pressed={isActive}
              className={
                isActive
                  ? 'sa-control inline-flex min-h-8.5 cursor-pointer items-center justify-center rounded-xl border-[#151515] bg-[#151515] px-1.5 py-1 text-[11px] font-semibold text-white sm:min-h-9 sm:px-3 sm:py-1.5 sm:text-xs'
                  : 'sa-control inline-flex min-h-8.5 cursor-pointer items-center justify-center rounded-xl bg-white px-1.5 py-1 text-[11px] font-medium text-[#46433D] hover:text-[#151515] sm:min-h-9 sm:px-3 sm:py-1.5 sm:text-xs'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {preset === BOOKKEEPING_PERIOD_PRESETS.CUSTOM ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-xs text-[#666159]">
              <span className="sr-only">Dari tanggal</span>
              <input
                type="date"
                aria-label="Dari tanggal periode"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange?.(e.target.value)}
                className="sa-input min-h-9 px-2.5 py-1 font-mono text-xs text-[#151515]"
              />
            </label>
            <span className="text-xs text-[#666159]">–</span>
            <label className="flex items-center gap-1.5 text-xs text-[#666159]">
              <span className="sr-only">Sampai tanggal</span>
              <input
                type="date"
                aria-label="Sampai tanggal periode"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange?.(e.target.value)}
                className="sa-input min-h-9 px-2.5 py-1 font-mono text-xs text-[#151515]"
              />
            </label>
          </div>
        ) : null}

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-1 text-[11px] font-medium text-[#46433D]">
          <Calendar className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
          <span className="hidden sm:inline">Periode WIB:</span>
          <strong className="font-mono text-[#151515]">{periodLabel}</strong>
        </span>
      </div>
    </div>
  );
}
