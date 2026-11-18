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
      className="brutal-card bg-studio-white p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Room Filter Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-studio-muted-ink inline-flex items-center gap-1 font-mono text-[11px] font-extrabold uppercase">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ruangan:</span>
          </span>

          <div
            role="group"
            aria-label="Filter ruangan studio"
            className="flex flex-wrap items-center gap-1.5"
          >
            {ROOM_FILTER_OPTIONS.map((room) => {
              const isSelected = roomFilter === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onRoomFilterChange(room.id)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'border-studio-ink bg-studio-ink text-studio-lime inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-xs font-extrabold uppercase shadow-[2px_2px_0px_#151515]'
                      : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-bold uppercase'
                  }
                >
                  {room.id === 'room-a' ? (
                    <span
                      className="bg-studio-lime border-studio-ink h-2.5 w-2.5 border"
                      aria-hidden="true"
                    />
                  ) : null}
                  {room.id === 'room-b' ? (
                    <span
                      className="bg-studio-orange border-studio-ink h-2.5 w-2.5 border"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{room.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input + Cancelled Toggle */}
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center lg:max-w-lg lg:justify-end">
          <div className="relative flex-1">
            <Search
              className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              aria-label="Cari customer, band, atau project"
              placeholder="Cari customer / band / project..."
              className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink min-h-11 w-full border-2 py-2 pr-9 pl-9 text-xs font-semibold"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Bersihkan pencarian"
                className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggleShowCancelled}
            aria-pressed={showCancelled}
            className={
              showCancelled
                ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[11px] font-extrabold uppercase'
                : 'border-studio-ink bg-studio-ivory text-studio-muted-ink hover:text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 border px-3 py-1.5 font-mono text-[11px] font-bold uppercase'
            }
          >
            {showCancelled ? (
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Cancelled</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Payment Status Filter Pills + Visible Count */}
      <div className="mt-3.5 flex flex-col gap-2.5 border-t border-neutral-200 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter status pembayaran"
          className="flex flex-wrap items-center gap-1.5"
        >
          <span className="text-studio-muted-ink mr-1 font-mono text-[11px] font-extrabold uppercase">
            Pembayaran:
          </span>

          {PAYMENT_FILTER_OPTIONS.map((option) => {
            const isSelected = paymentFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onPaymentFilterChange(option.id)}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center border-2 px-3 py-1 font-mono text-[11px] font-extrabold uppercase shadow-[2px_2px_0px_#151515]'
                    : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-10 cursor-pointer items-center border px-3 py-1 font-mono text-[11px] font-bold uppercase'
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <p className="text-studio-muted-ink font-mono text-[11px] font-bold uppercase">
          Menampilkan <span className="text-studio-ink font-extrabold">{totalVisibleCount}</span>{' '}
          booking
        </p>
      </div>
    </section>
  );
}
