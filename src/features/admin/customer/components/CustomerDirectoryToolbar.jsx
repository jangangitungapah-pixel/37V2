import { ArrowUpDown, Filter, Search, X } from 'lucide-react';

import { CUSTOMER_FILTER_OPTIONS, CUSTOMER_SORT_OPTIONS } from '../utils/customer-history';

export function CustomerDirectoryToolbar({
  searchQuery,
  onSearchQueryChange,
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  visibleGroupsCount = 0,
  visibleProfilesCount = 0,
  sharedCount = 0,
  archivedCount = 0,
}) {
  return (
    <section
      aria-label="Pencarian dan filter daftar pelanggan"
      className="cal-card bg-studio-white p-2.5 sm:p-4"
    >
      {/* Unified Filter + Search + Sort Bar */}
      <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-3 xl:gap-y-2.5">
        {/* Left Cluster: Customer Category Filter Pills */}
        <div className="min-w-0">
          <div className="mb-1 flex min-h-4 items-center justify-between gap-2 sm:min-h-5">
            <span className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase sm:text-[10px]">
              <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Filter Pelanggan</span>
            </span>
            <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold whitespace-nowrap uppercase xl:hidden">
              {visibleProfilesCount} orang • {visibleGroupsCount} no
            </span>
          </div>

          <div
            role="group"
            aria-label="Filter kategori customer"
            className="flex flex-wrap gap-1 sm:inline-flex sm:w-auto sm:gap-1.5"
          >
            {CUSTOMER_FILTER_OPTIONS.map((option) => {
              const isSelected = activeFilter === option.id;
              const badgeCount =
                option.id === 'shared'
                  ? sharedCount
                  : option.id === 'archived'
                    ? archivedCount
                    : null;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onFilterChange(option.id)}
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] sm:min-h-10 sm:gap-1.5 sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                      : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-bold whitespace-nowrap uppercase sm:min-h-10 sm:gap-1.5 sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                  }
                >
                  <span className="sm:hidden">{option.compactLabel || option.label}</span>
                  <span className="hidden sm:inline">{option.label}</span>
                  {badgeCount !== null && badgeCount > 0 ? (
                    <span
                      className={`border-studio-ink border px-1 py-0 text-[8.5px] font-extrabold sm:text-[9px] ${
                        option.id === 'shared'
                          ? 'bg-studio-orange text-studio-white'
                          : 'bg-studio-white text-studio-ink'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Cluster: Visible Indicator (Desktop Strip) + Search Input + Sort Selector */}
        <div className="flex w-full min-w-0 flex-col xl:min-w-[340px] xl:flex-1">
          <div className="mb-1 hidden min-h-5 items-center justify-end gap-2 font-mono text-[10px] font-bold uppercase xl:flex">
            <span className="text-studio-muted-ink">Hasil Tampil:</span>
            <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
              {visibleProfilesCount} orang • {visibleGroupsCount} nomor
            </span>
          </div>

          <div className="flex w-full flex-col gap-1.5 min-[400px]:flex-row min-[400px]:items-center sm:gap-2">
            <div className="relative w-full min-w-0 flex-1">
              <Search
                className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Cari nama customer, nomor HP / WhatsApp, atau band"
                placeholder="Cari nama, no. HP / WA, atau band..."
                className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-9 w-full border-2 py-1 pr-8 pl-8 text-xs font-semibold sm:h-10 sm:py-1.5"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian pelanggan"
                  className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center sm:h-8 sm:w-8"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="flex w-full items-center gap-1.5 min-[400px]:w-40 min-[400px]:shrink-0 sm:w-48">
              <label
                htmlFor="customer-sort-select"
                className="text-studio-muted-ink sr-only inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-extrabold uppercase"
              >
                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                <span>Urutkan</span>
              </label>
              <select
                id="customer-sort-select"
                aria-label="Urutkan daftar customer"
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                className="border-studio-ink bg-studio-ivory text-studio-ink h-9 w-full cursor-pointer border-2 px-2 font-mono text-[9.5px] font-extrabold uppercase sm:h-10 sm:px-2.5 sm:text-[10px] md:text-[10.5px]"
              >
                {CUSTOMER_SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
