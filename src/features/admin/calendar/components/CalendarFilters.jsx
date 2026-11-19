import { Eye, EyeOff, Filter, Search, X } from 'lucide-react';

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
  return (
    <section
      aria-label="Filter dan pencarian booking kalender"
      className="cal-card bg-studio-white p-3 sm:p-4"
    >
      {/* Unified Filter Bar: Room Filter + Payment Status Filter + Visible Count & Search/Cancelled */}
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-3 xl:gap-y-2.5">
        {/* Left Cluster: Room Filter + Payment Status Filter */}
        <div className="flex min-w-0 flex-col gap-2.5 md:flex-row md:flex-wrap md:items-end md:gap-x-3 md:gap-y-2.5">
          {/* Room Filter Selector */}
          <div className="min-w-0">
            <span className="text-studio-muted-ink mb-1 flex min-h-5 items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
              <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Ruangan</span>
            </span>

            <div
              role="group"
              aria-label="Filter ruangan studio"
              className="grid w-full grid-cols-3 gap-1.5 md:inline-flex md:w-auto md:flex-nowrap"
            >
              {ROOM_FILTER_OPTIONS.map((room) => {
                const isSelected = roomFilter === room.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onRoomFilterChange(room.id)}
                    aria-label={room.label}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'border-studio-ink bg-studio-ink text-studio-lime inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 overflow-hidden border-2 px-1 py-1 font-sans text-[10px] font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] min-[340px]:font-mono md:w-auto md:px-2.5 md:text-[10.5px]'
                        : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1 overflow-hidden border-2 px-1 py-1 font-sans text-[10px] font-bold whitespace-nowrap uppercase min-[340px]:font-mono md:w-auto md:px-2.5 md:text-[10.5px]'
                    }
                  >
                    {room.id === 'room-a' ? (
                      <span
                        className="bg-studio-lime border-studio-ink h-2 w-2 shrink-0 border"
                        aria-hidden="true"
                      />
                    ) : null}
                    {room.id === 'room-b' ? (
                      <span
                        className="bg-studio-orange border-studio-ink h-2 w-2 shrink-0 border"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>{room.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Status Filter */}
          <div className="min-w-0">
            <span className="text-studio-muted-ink mb-1 flex min-h-5 items-center font-mono text-[10px] font-extrabold uppercase">
              Status Pembayaran
            </span>

            <div
              role="group"
              aria-label="Filter status pembayaran"
              className="grid w-full auto-rows-fr grid-cols-2 gap-1.5 sm:grid-cols-4 md:inline-flex md:w-auto md:flex-nowrap"
            >
              {PAYMENT_FILTER_OPTIONS.map((option) => {
                const isSelected = paymentFilter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onPaymentFilterChange(option.id)}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-11 w-full cursor-pointer items-center justify-center border-2 px-2 py-1 text-center font-sans text-[10px] leading-none font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] min-[340px]:font-mono md:w-auto md:px-2.5 md:text-[10.5px]'
                        : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-11 w-full cursor-pointer items-center justify-center border-2 px-2 py-1 text-center font-sans text-[10px] leading-none font-bold whitespace-nowrap uppercase min-[340px]:font-mono md:w-auto md:px-2.5 md:text-[10.5px]'
                    }
                  >
                    <span className="sm:hidden">{option.compactLabel || option.label}</span>
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Cluster: Visible Booking Indicator (Top Strip) + Search Input + Cancelled Toggle */}
        <div className="flex w-full min-w-0 flex-col xl:min-w-[290px] xl:flex-1">
          <div className="mb-1 flex min-h-5 items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase sm:justify-end">
            <span className="text-studio-muted-ink">Hasil Tampil:</span>
            <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
              {totalVisibleCount} booking
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full min-w-0 sm:flex-1">
              <Search
                className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Cari customer, band, atau project"
                placeholder="Cari customer / band / project..."
                className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-11 w-full border-2 py-1.5 pr-8 pl-8 text-xs font-semibold"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian"
                  className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1.5 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onToggleShowCancelled}
              aria-pressed={showCancelled}
              className={
                showCancelled
                  ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-between gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] sm:w-auto sm:justify-center sm:text-[10.5px]'
                  : 'border-studio-ink bg-studio-ivory text-studio-muted-ink hover:text-studio-ink inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-between gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] font-bold whitespace-nowrap uppercase sm:w-auto sm:justify-center sm:text-[10.5px]'
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {showCancelled ? (
                  <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>Show Cancelled</span>
              </span>
              <span className="border-studio-ink bg-studio-white text-studio-ink py-0.2 border px-1.5 font-mono text-[9px] font-extrabold sm:hidden">
                {showCancelled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
