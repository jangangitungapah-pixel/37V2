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
      className="brutal-card bg-studio-white space-y-3 p-3.5 sm:p-4"
    >
      {/* Row 1: Primary Search + Sort Selector */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            aria-label="Cari nama customer, nomor HP / WhatsApp, atau band"
            placeholder="Cari nama customer, nomor HP / WhatsApp, atau band..."
            className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-11 w-full border-2 py-2 pr-9 pl-9 text-xs font-semibold sm:text-sm"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              aria-label="Bersihkan pencarian customer"
              className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1.5 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          <label
            htmlFor="customer-sort-select"
            className="text-studio-muted-ink inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-extrabold uppercase"
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Urutkan</span>
          </label>
          <select
            id="customer-sort-select"
            aria-label="Urutkan daftar customer"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value)}
            className="border-studio-ink bg-studio-ivory text-studio-ink h-11 min-w-0 flex-1 cursor-pointer border-2 px-2.5 font-mono text-xs font-extrabold uppercase sm:w-48 sm:flex-initial"
          >
            {CUSTOMER_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Simple Filter Pills + Visible Directory Counter */}
      <div className="flex flex-col gap-2.5 border-t border-neutral-200 pt-2.5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1 font-mono text-[10px] font-extrabold text-neutral-600 uppercase md:hidden">
            <Filter className="h-3 w-3" aria-hidden="true" />
            <span>Filter</span>
          </div>
          <div
            role="group"
            aria-label="Filter kategori customer"
            className="grid grid-cols-2 gap-1.5 sm:inline-flex sm:flex-wrap"
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
                      ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase shadow-[2px_2px_0px_#151515] sm:text-[11px]'
                      : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase sm:text-[11px]'
                  }
                >
                  <span className="truncate">{option.label}</span>
                  {badgeCount !== null && badgeCount > 0 ? (
                    <span
                      className={`border-studio-ink border px-1 py-0 text-[9px] font-extrabold ${
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

        <div className="flex shrink-0 items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase sm:text-[11px] md:justify-end">
          <span className="text-studio-muted-ink">Tampil:</span>
          <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
            {visibleProfilesCount} profil • {visibleGroupsCount} nomor
          </span>
        </div>
      </div>
    </section>
  );
}
