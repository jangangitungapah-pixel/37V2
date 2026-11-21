import { useState } from 'react';
import { Eye, EyeOff, Filter, Search, SlidersHorizontal, X } from 'lucide-react';

import { PAYMENT_FILTER_OPTIONS, ROOM_FILTER_OPTIONS } from '../config/calendar-config';

export function CalendarFilters({
  roomFilter,
  onRoomFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  searchQuery,
  onSearchQueryChange,
  showCancelled,
  onToggleShowCancelled,
  totalVisibleCount = 0,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount =
    (roomFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0) + (showCancelled ? 1 : 0);

  return (
    <section aria-label="Filter dan pencarian booking kalender" className="sa-card p-3 sm:p-5">
      {/* Unified Filter Bar: Search & Mobile Toggle first on mobile; Room/Payment first on desktop */}
      <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-4 xl:gap-y-3">
        {/* Left Cluster (Desktop) / Collapsible Panel (Mobile): Room + Payment Status */}
        <div
          className={`${mobileFiltersOpen ? 'flex border-t border-[#151515]/[0.07] pt-2.5 sm:border-t-0 sm:pt-0' : 'hidden sm:flex'} order-2 min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-x-4 md:gap-y-3 xl:order-1`}
        >
          {/* Room Filter Selector */}
          <div className="min-w-0">
            <div className="mb-1.5 flex min-h-4 items-center justify-between gap-2 sm:min-h-5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#666159]">
                <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Ruangan</span>
              </span>
              <span className="rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap text-[#46433D] tabular-nums xl:hidden">
                {totalVisibleCount} booking
              </span>
            </div>

            <div
              role="group"
              aria-label="Filter ruangan studio"
              className="grid w-full grid-cols-3 gap-1.5 md:inline-flex md:w-auto md:flex-nowrap"
            >
              {ROOM_FILTER_OPTIONS.map((room) => {
                const isSelected = roomFilter === room.id;
                const mobileRoomLabel = room.id === 'all' ? 'Semua' : room.label;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onRoomFilterChange(room.id)}
                    aria-label={room.label}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'bg-studio-ink border-studio-ink inline-flex min-h-9.5 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#F1EEE4] shadow-xs transition-all md:w-auto'
                        : 'hover:text-studio-ink inline-flex min-h-9.5 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-[#151515]/12 bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#46433D] transition-all hover:border-[#151515]/25 hover:bg-[#F8F6EF] md:w-auto'
                    }
                  >
                    {room.id === 'room-a' ? (
                      <span
                        className="bg-studio-lime h-2 w-2 shrink-0 rounded-full border border-[#658800]/60"
                        aria-hidden="true"
                      />
                    ) : null}
                    {room.id === 'room-b' ? (
                      <span
                        className="bg-studio-orange h-2 w-2 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="sm:hidden">{mobileRoomLabel}</span>
                    <span className="hidden sm:inline">{room.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Status Filter */}
          <div className="min-w-0">
            <span className="mb-1.5 flex min-h-4 items-center text-xs font-medium text-[#666159] sm:min-h-5">
              Status Pembayaran
            </span>

            <div
              role="group"
              aria-label="Filter status pembayaran"
              className="flex flex-wrap gap-1.5 md:inline-flex md:w-auto md:flex-nowrap"
            >
              {PAYMENT_FILTER_OPTIONS.map((option) => {
                const isSelected = paymentFilter === option.id;
                const mobileLabel = option.id === 'all' ? 'Semua' : option.label;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onPaymentFilterChange(option.id)}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'inline-flex min-h-9.5 cursor-pointer items-center justify-center rounded-xl border border-[#8BAD12]/45 bg-[#EDF8C2] px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-[#243300] shadow-xs transition-all'
                        : 'hover:text-studio-ink inline-flex min-h-9.5 cursor-pointer items-center justify-center rounded-xl border border-[#151515]/12 bg-white px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap text-[#46433D] transition-all hover:border-[#151515]/25 hover:bg-[#F8F6EF]'
                    }
                  >
                    <span className="sm:hidden">{mobileLabel}</span>
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Cluster (Desktop) / Primary Compact Row (Mobile): Search + Cancelled Toggle + Mobile Filter */}
        <div className="order-1 flex w-full min-w-0 flex-col xl:order-2 xl:min-w-[290px] xl:flex-1">
          <div className="mb-1.5 hidden min-h-5 items-center justify-end gap-2 text-xs xl:flex">
            <span className="text-[#666159]">Hasil tampil</span>
            <span className="rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap text-[#46433D] tabular-nums">
              {totalVisibleCount} booking
            </span>
          </div>

          <div className="flex w-full items-center gap-1.5 sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Cari customer, band, atau project"
                placeholder="Cari nama, band, atau acara..."
                className="sa-input h-9.5 w-full rounded-xl py-1.5 pr-8 pl-9 text-xs font-medium sm:h-10"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian"
                  className="hover:text-studio-orange absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] transition-colors sm:h-8 sm:w-8"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onToggleShowCancelled}
              aria-label="Show Cancelled"
              aria-pressed={showCancelled}
              className={
                showCancelled
                  ? 'inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#8BAD12]/45 bg-[#EDF8C2] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#243300] shadow-xs transition-all sm:min-h-10 sm:px-3.5'
                  : 'sa-control sa-btn-secondary inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-[#46433D] sm:min-h-10 sm:px-3.5'
              }
            >
              {showCancelled ? (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden min-[360px]:inline sm:hidden">Batal</span>
              <span className="hidden sm:inline">Tampilkan Batal</span>
            </button>

            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="sa-control sa-btn-secondary inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 px-2.5 text-xs font-semibold sm:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
