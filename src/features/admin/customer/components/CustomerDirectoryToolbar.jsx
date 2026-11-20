import { ArrowUpDown, Filter, Search, X } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

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
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Pencarian dan filter daftar pelanggan"
      className="p-4 sm:p-5"
    >
      {/* Unified Filter + Search + Sort Bar */}
      <div className="flex flex-col gap-3.5 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
        {/* Left Cluster: Customer Category Filter Pills */}
        <div className="min-w-0">
          <div className="mb-1.5 flex min-h-5 items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#666159]">
              <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Filter Pelanggan</span>
            </span>
            <AdminStatusBadge tone="ivory" size="sm" className="font-mono xl:hidden">
              {visibleProfilesCount} orang • {visibleGroupsCount} no
            </AdminStatusBadge>
          </div>

          <div
            role="group"
            aria-label="Filter kategori customer"
            className="sa-pill-track flex flex-wrap gap-1 sm:inline-flex sm:w-auto"
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
                      ? 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:min-h-9.5 sm:px-3.5'
                      : 'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#666159] transition-colors hover:text-[#151515] sm:min-h-9.5 sm:px-3.5'
                  }
                >
                  <span className="sm:hidden">{option.compactLabel || option.label}</span>
                  <span className="hidden sm:inline">{option.label}</span>
                  {badgeCount !== null && badgeCount > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${
                        option.id === 'shared'
                          ? 'bg-[#FF4B22] text-white'
                          : isSelected
                            ? 'bg-[#C8F13A] text-[#151515]'
                            : 'bg-[#151515]/[0.07] text-[#46433D]'
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
          <div className="mb-1.5 hidden min-h-5 items-center justify-end gap-2 text-xs xl:flex">
            <span className="text-[#666159]">Hasil Tampil:</span>
            <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
              {visibleProfilesCount} orang • {visibleGroupsCount} nomor
            </AdminStatusBadge>
          </div>

          <div className="flex w-full flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center">
            <div className="relative w-full min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Cari nama customer, nomor HP / WhatsApp, atau band"
                placeholder="Cari nama, no. HP / WA, atau band..."
                className="sa-input h-10 w-full py-2 pr-9 pl-9.5 text-xs font-medium sm:text-[13px]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian pelanggan"
                  className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.05] hover:text-[#151515]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="flex w-full items-center gap-1.5 min-[400px]:w-44 min-[400px]:shrink-0 sm:w-48">
              <label
                htmlFor="customer-sort-select"
                className="sr-only inline-flex shrink-0 items-center gap-1"
              >
                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                <span>Urutkan</span>
              </label>
              <select
                id="customer-sort-select"
                aria-label="Urutkan daftar customer"
                value={sortBy}
                onChange={(event) => onSortChange(event.target.value)}
                className="sa-input h-10 w-full cursor-pointer px-3 text-xs font-medium"
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
    </AdminSurface>
  );
}
