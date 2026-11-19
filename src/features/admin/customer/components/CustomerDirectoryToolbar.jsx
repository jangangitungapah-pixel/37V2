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
      aria-label="Pencarian dan filter customer directory"
      className="cal-card bg-studio-white p-3 sm:p-4"
    >
        {/* Unified Filter + Search + Sort Bar (mirrors CalendarFilters.jsx scale & alignment) */}
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-3 xl:gap-y-2.5">
          {/* Left Cluster: Customer Category Filter Pills */}
          <div className="min-w-0">
            <span className="text-studio-muted-ink mb-1 flex min-h-5 items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
              <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Filter Customer</span>
            </span>

              <div
                role="group"
                aria-label="Filter kategori customer"
                className="grid w-full grid-cols-2 gap-1.5 sm:inline-flex sm:w-auto sm:flex-wrap"
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
                      aria-pressed={isSelected}
                      className={
                        isSelected
                            ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[10px] leading-none font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] sm:w-auto md:text-[10.5px]'
                            : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 border-2 px-2.5 py-1 font-mono text-[10px] leading-none font-bold whitespace-nowrap uppercase sm:w-auto md:text-[10.5px]'
                      }
                    >
                      <span className="truncate">{option.label}</span>
                      {badgeCount !== null && badgeCount > 0 ? (
                        <span
                          className={`border-studio-ink border px-1 py-0 text-[9px] font-extrabold ${option.id === 'shared'
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

              {/* Right Cluster: Visible Indicator (Top Strip) + Search Input + Sort Selector */}
              <div className="flex w-full min-w-0 flex-col xl:min-w-[340px] xl:flex-1">
                <div className="mb-1 flex min-h-5 items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase sm:justify-end">
                  <span className="text-studio-muted-ink">Hasil Tampil:</span>
                  <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
                    {visibleProfilesCount} profil • {visibleGroupsCount} nomor
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
                      aria-label="Cari nama customer, nomor HP / WhatsApp, atau band"
                      placeholder="Cari nama customer, nomor HP / WhatsApp, atau band..."
                      className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-10 w-full border-2 py-1.5 pr-8 pl-8 text-xs font-semibold"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => onSearchQueryChange('')}
                        aria-label="Bersihkan pencarian customer"
                        className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex w-full items-center gap-1.5 sm:w-auto sm:shrink-0">
                    <label
                      htmlFor="customer-sort-select"
                      className="text-studio-muted-ink inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-extrabold uppercase sm:sr-only"
                    >
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      <span>Urutkan</span>
                    </label>
                    <select
                      id="customer-sort-select"
                      aria-label="Urutkan daftar customer"
                      value={sortBy}
                      onChange={(event) => onSortChange(event.target.value)}
                      className="border-studio-ink bg-studio-ivory text-studio-ink h-10 min-w-0 flex-1 cursor-pointer border-2 px-2.5 font-mono text-[10px] font-extrabold uppercase sm:w-44 sm:flex-initial md:text-[10.5px]"
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
