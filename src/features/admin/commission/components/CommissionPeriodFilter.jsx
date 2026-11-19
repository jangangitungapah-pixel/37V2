import { CalendarRange, Filter, Search, X } from 'lucide-react';

import { COMMISSION_REVIEW_STATUS_FILTER } from '../utils/commission-calculation';
import {
  COMMISSION_PERIOD_PRESET_OPTIONS,
  COMMISSION_PERIOD_PRESETS,
} from '../utils/commission-period';

export function CommissionPeriodFilter({
  preset,
  onPresetChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  periodLabel,
  serviceFilter,
  onServiceFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  visibleCount = 0,
  onResetFilters,
}) {
  const hasSecondaryFilters =
    serviceFilter !== 'all' ||
    statusFilter !== COMMISSION_REVIEW_STATUS_FILTER.PENDING ||
    Boolean(searchQuery.trim());

  return (
    <section
      aria-label="Filter periode dan sesi selesai"
      className="cal-card bg-studio-white p-2.5 sm:p-4"
    >
      {/* Row 1: Period Presets + Active Date Range Badge */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-studio-muted-ink inline-flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
            <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Periode Selesai Aktual:</span>
          </span>

          <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-1.5">
            {COMMISSION_PERIOD_PRESET_OPTIONS.map((opt) => {
              const isSelected = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPresetChange?.(opt.id)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'border-studio-ink bg-studio-lime text-studio-ink min-h-9 cursor-pointer border-2 px-2 py-1 font-mono text-[10px] font-extrabold uppercase shadow-[1.5px_1.5px_0px_#151515] sm:min-h-9 sm:px-3 sm:text-[10.5px]'
                      : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white min-h-9 cursor-pointer border-2 px-2 py-1 font-mono text-[10px] font-bold uppercase sm:min-h-9 sm:px-3 sm:text-[10.5px]'
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-bold">
          <span className="text-studio-muted-ink uppercase">Rentang Aktif:</span>
          <span className="text-studio-ink font-extrabold">{periodLabel} (WIB)</span>
        </div>
      </div>

      {/* Custom Date Range Picker (shown when preset === 'custom') */}
      {preset === COMMISSION_PERIOD_PRESETS.CUSTOM ? (
        <div className="border-studio-ink bg-studio-ivory mt-2.5 grid grid-cols-2 gap-2 border p-2 sm:inline-grid sm:gap-3 sm:p-2.5">
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <span className="text-studio-muted-ink">Dari Tanggal</span>
            <input
              type="date"
              aria-label="Dari tanggal selesai"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange?.(e.target.value)}
              className="border-studio-ink bg-studio-white text-studio-ink h-9 w-full border-2 px-2 font-mono text-xs font-bold"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <span className="text-studio-muted-ink">Sampai Tanggal</span>
            <input
              type="date"
              aria-label="Sampai tanggal selesai"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange?.(e.target.value)}
              className="border-studio-ink bg-studio-white text-studio-ink h-9 w-full border-2 px-2 font-mono text-xs font-bold"
            />
          </label>
        </div>
      ) : null}

      {/* Row 2: Secondary Filters (Service, Posting Status, Search) */}
      <div className="mt-2.5 flex flex-col gap-2 border-t border-neutral-200 pt-2.5 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-end sm:gap-2">
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <span className="text-studio-muted-ink inline-flex items-center gap-1">
              <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Layanan</span>
            </span>
            <select
              aria-label="Filter layanan komisi"
              value={serviceFilter}
              onChange={(e) => onServiceFilterChange?.(e.target.value)}
              className="border-studio-ink bg-studio-ivory text-studio-ink h-9 w-full border-2 px-2 font-mono text-[10.5px] font-bold uppercase sm:w-40"
            >
              <option value="all">Semua Layanan</option>
              <option value="rehearsal">Rehearsal</option>
              <option value="recording">Recording</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <span className="text-studio-muted-ink">Tampilkan Status</span>
            <select
              aria-label="Filter status posting sesi"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange?.(e.target.value)}
              className="border-studio-ink bg-studio-ivory text-studio-ink h-9 w-full border-2 px-2 font-mono text-[10.5px] font-bold uppercase sm:w-44"
            >
              <option value={COMMISSION_REVIEW_STATUS_FILTER.PENDING}>Belum Diposting</option>
              <option value={COMMISSION_REVIEW_STATUS_FILTER.POSTED}>Sudah Diposting</option>
              <option value={COMMISSION_REVIEW_STATUS_FILTER.ALL_PERIOD}>Semua Periode</option>
            </select>
          </label>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-1 xl:max-w-md">
          <div className="flex items-center justify-between gap-2 font-mono text-[9.5px] font-bold uppercase">
            <span className="text-studio-muted-ink">Hasil Tampil:</span>
            <div className="flex items-center gap-1.5">
              {hasSecondaryFilters ? (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="text-studio-orange cursor-pointer font-extrabold uppercase hover:underline"
                >
                  Reset Filter
                </button>
              ) : null}
              <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-1.5 py-0.5 font-extrabold">
                {visibleCount} sesi
              </span>
            </div>
          </div>

          <div className="relative w-full min-w-0">
            <Search
              className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari booking ID, pelanggan, band, atau paket"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Cari ID booking, pelanggan, band, atau paket..."
              className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-9 w-full border-2 py-1 pr-8 pl-8 text-xs font-semibold"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange?.('')}
                aria-label="Bersihkan pencarian komisi"
                className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
