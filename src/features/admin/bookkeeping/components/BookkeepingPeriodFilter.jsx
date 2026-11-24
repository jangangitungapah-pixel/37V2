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
      <div className="grid grid-cols-2 gap-1.5 min-[440px]:grid-cols-4 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
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
                  ? 'sa-control inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border-[#151515] bg-[#151515] px-2.5 py-1.5 text-xs font-semibold text-white sm:px-3'
                  : 'sa-control inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-white px-2.5 py-1.5 text-xs font-medium text-[#46433D] hover:text-[#151515] sm:px-3'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        {preset === BOOKKEEPING_PERIOD_PRESETS.CUSTOM ? (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[#666159] sm:flex-row sm:items-center">
              <span className="sm:sr-only">Dari tanggal</span>
              <input
                type="date"
                aria-label="Dari tanggal periode"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange?.(e.target.value)}
                className="sa-input min-h-10 w-full px-2.5 py-1 font-mono text-xs text-[#151515] sm:w-auto"
              />
            </label>
            <span className="hidden text-xs text-[#666159] sm:inline">–</span>
            <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[#666159] sm:flex-row sm:items-center">
              <span className="sm:sr-only">Sampai tanggal</span>
              <input
                type="date"
                aria-label="Sampai tanggal periode"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange?.(e.target.value)}
                className="sa-input min-h-10 w-full px-2.5 py-1 font-mono text-xs text-[#151515] sm:w-auto"
              />
            </label>
          </div>
        ) : null}

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-1 text-[11px] font-medium text-[#46433D]">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
          <span className="hidden sm:inline">Periode WIB:</span>
          <strong className="font-mono text-[#151515]">{periodLabel}</strong>
        </span>
      </div>
    </div>
  );
}
