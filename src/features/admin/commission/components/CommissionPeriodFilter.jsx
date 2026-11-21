import { useState } from 'react';
import { CalendarRange, Filter, Search, SlidersHorizontal, X } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { COMMISSION_REVIEW_STATUS_FILTER } from '../utils/commission-calculation';
import {
  COMMISSION_PERIOD_PRESET_OPTIONS,
  COMMISSION_PERIOD_PRESETS,
} from '../utils/commission-period';

export function CommissionPeriodFilter({
  preset,
  onPresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const dropdownFilterCount =
    (serviceFilter !== 'all' ? 1 : 0) +
    (statusFilter !== COMMISSION_REVIEW_STATUS_FILTER.PENDING ? 1 : 0);
  const hasSecondaryFilters = dropdownFilterCount > 0 || Boolean(searchQuery.trim());

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Filter periode dan sesi selesai"
      className="p-3 sm:p-5"
    >
      {/* Row 1: Period Presets + Active Date Range Badge */}
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs font-medium text-[#666159] sm:inline-flex">
            <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Periode Selesai Aktual:</span>
          </span>

          <div className="sa-pill-track grid w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto">
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
                      ? 'min-h-8.5 cursor-pointer rounded-[10px] bg-white px-2.5 py-1 text-xs font-semibold text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:min-h-9 sm:px-3 sm:py-1.5'
                      : 'min-h-8.5 cursor-pointer rounded-[10px] px-2.5 py-1 text-xs font-medium text-[#666159] transition-colors hover:text-[#151515] sm:min-h-9 sm:px-3 sm:py-1.5'
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sa-panel-ivory flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 text-xs sm:px-3 sm:py-1.5">
          <span className="hidden text-[#666159] sm:inline">Rentang Aktif:</span>
          <span className="font-mono font-semibold text-[#151515]">{periodLabel} (WIB)</span>
        </div>
      </div>

      {/* Custom Date Range Picker (shown when preset === 'custom') */}
      {preset === COMMISSION_PERIOD_PRESETS.CUSTOM ? (
        <div className="sa-panel-ivory mt-2.5 grid grid-cols-1 gap-2.5 p-2.5 sm:mt-3 sm:inline-grid sm:grid-cols-2 sm:gap-3 sm:p-3">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#46433D]">
            <span>Dari Tanggal</span>
            <input
              type="date"
              aria-label="Dari tanggal selesai"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange?.(e.target.value)}
              className="sa-input h-9.5 w-full px-3 font-mono text-xs font-semibold"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#46433D]">
            <span>Sampai Tanggal</span>
            <input
              type="date"
              aria-label="Sampai tanggal selesai"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange?.(e.target.value)}
              className="sa-input h-9.5 w-full px-3 font-mono text-xs font-semibold"
            />
          </label>
        </div>
      ) : null}

      {/* Row 2: Secondary Filters (Service, Posting Status) + Search (First on Mobile) */}
      <div className="mt-2.5 flex flex-col gap-2.5 border-t border-[#151515]/[0.07] pt-2.5 sm:mt-4 sm:gap-3 sm:pt-4 xl:flex-row xl:items-end xl:justify-between">
        <div
          className={`${mobileFiltersOpen ? 'grid' : 'hidden sm:flex'} order-2 grid-cols-1 gap-2.5 sm:flex-wrap sm:items-end sm:gap-3 xl:order-1`}
        >
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#46433D]">
            <span className="inline-flex items-center gap-1.5 text-[#666159]">
              <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Layanan</span>
            </span>
            <select
              aria-label="Filter layanan komisi"
              value={serviceFilter}
              onChange={(e) => onServiceFilterChange?.(e.target.value)}
              className="sa-input h-9.5 w-full px-3 text-xs font-medium sm:h-10 sm:w-44"
            >
              <option value="all">Semua Layanan</option>
              <option value="rehearsal">Rehearsal</option>
              <option value="recording">Recording</option>
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#46433D]">
            <span className="text-[#666159]">Tampilkan Status</span>
            <select
              aria-label="Filter status posting sesi"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange?.(e.target.value)}
              className="sa-input h-9.5 w-full px-3 text-xs font-medium sm:h-10 sm:w-48"
            >
              <option value={COMMISSION_REVIEW_STATUS_FILTER.PENDING}>Belum Diposting</option>
              <option value={COMMISSION_REVIEW_STATUS_FILTER.POSTED}>Sudah Diposting</option>
              <option value={COMMISSION_REVIEW_STATUS_FILTER.ALL_PERIOD}>Semua Periode</option>
            </select>
          </label>
        </div>

        <div className="order-1 flex w-full min-w-0 flex-1 flex-col gap-1.5 xl:order-2 xl:max-w-md">
          <div className="hidden items-center justify-between gap-2 text-xs sm:flex">
            <span className="text-[#666159]">Hasil Tampil:</span>
            <div className="flex items-center gap-2">
              {hasSecondaryFilters ? (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="cursor-pointer font-semibold text-[#FF4B22] hover:underline"
                >
                  Reset Filter
                </button>
              ) : null}
              <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
                {visibleCount} sesi
              </AdminStatusBadge>
            </div>
          </div>

          <div className="flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Cari booking ID, pelanggan, band, atau paket"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                placeholder="Cari ID booking, pelanggan, band, atau paket..."
                className="sa-input h-9.5 w-full py-2 pr-9 pl-9.5 text-xs font-medium sm:h-10 sm:text-[13px]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange?.('')}
                  aria-label="Bersihkan pencarian komisi"
                  className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.05] hover:text-[#151515]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="sa-control sa-btn-secondary inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 px-2.5 text-xs font-semibold sm:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter</span>
              {dropdownFilterCount > 0 ? (
                <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                  {dropdownFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
