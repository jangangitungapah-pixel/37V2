import { useState } from 'react';
import { Activity, ArrowRight, Filter, RotateCcw, Search } from 'lucide-react';

import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import {
  getMovementMeta,
  INVENTORY_CATEGORIES,
  INVENTORY_ITEM_TYPE_OPTIONS,
  INVENTORY_MOVEMENT_META,
} from '../config/inventory-config';
import {
  formatInventoryTimestamp,
  formatMovementBalanceSummary,
  formatMovementDeltaText,
} from '../utils/inventory-format';

const MOVEMENT_FILTER_OPTIONS = Object.values(INVENTORY_MOVEMENT_META);

/**
 * Global immutable Inventory Activity feed (`Activity` tab) with bounded pagination
 * and responsive desktop table + mobile stacked cards.
 */
export function InventoryActivityList({
  movements = [],
  itemsById = new Map(),
  searchQuery = '',
  onSearchQueryChange,
  dateFrom = '',
  onDateFromChange,
  dateTo = '',
  onDateToChange,
  itemTypeFilter = 'all',
  onItemTypeFilterChange,
  movementTypeFilter = 'all',
  onMovementTypeFilterChange,
  categoryFilter = 'all',
  onCategoryFilterChange,
  hasActiveFilters = false,
  onClearFilters,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  onSelectItemById,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount = [
    dateFrom,
    dateTo,
    itemTypeFilter !== 'all',
    movementTypeFilter !== 'all',
    categoryFilter !== 'all',
  ].filter(Boolean).length;
  const showMobileFilterGrid = mobileFiltersOpen || activeFilterCount > 0;

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Filter riwayat aktivitas inventory"
        className="space-y-2.5 p-3 sm:space-y-3 sm:p-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari aktivitas pergerakan inventory"
              placeholder="Cari nama barang, kode, alasan, atau pencatat..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              className="sa-input min-h-10 w-full pr-3 pl-9 text-xs font-medium text-[#151515]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                aria-expanded={showMobileFilterGrid}
                className={`sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold sm:hidden ${
                  showMobileFilterGrid
                    ? 'border-[#8BAD12]/40 bg-[#EDF8C2] text-[#243300]'
                    : 'sa-btn-secondary text-[#46433D]'
                }`}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Filter</span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[9.5px] leading-none font-bold text-[#F1EEE4]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-[#FF4B22]/25 bg-[#FFEDE8] px-3 py-1 text-xs font-semibold text-[#B92B0C]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>

            <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
              {movements.length} aktivitas
            </AdminStatusBadge>
          </div>
        </div>

        <div
          className={`grid-cols-2 gap-2 border-t border-[#151515]/[0.07] pt-2.5 sm:grid sm:gap-2.5 sm:border-t-0 sm:pt-0 lg:grid-cols-5 ${
            showMobileFilterGrid ? 'grid' : 'hidden sm:grid'
          }`}
        >
          <div className="col-span-2 min-w-0 min-[420px]:col-span-1">
            <label
              htmlFor="act-date-from"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Dari Tanggal
            </label>
            <input
              id="act-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange?.(e.target.value)}
              className="sa-input min-h-10 w-full px-2.5 font-mono text-xs text-[#151515]"
            />
          </div>

          <div className="col-span-2 min-w-0 min-[420px]:col-span-1">
            <label
              htmlFor="act-date-to"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Sampai Tanggal
            </label>
            <input
              id="act-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange?.(e.target.value)}
              className="sa-input min-h-10 w-full px-2.5 font-mono text-xs text-[#151515]"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="act-item-type"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Item Type
            </label>
            <select
              id="act-item-type"
              value={itemTypeFilter}
              onChange={(e) => onItemTypeFilterChange?.(e.target.value)}
              className="sa-input min-h-10 w-full px-2.5 text-xs font-medium text-[#151515]"
            >
              <option value="all">All Types</option>
              {INVENTORY_ITEM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="act-mov-type"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Movement Type
            </label>
            <select
              id="act-mov-type"
              value={movementTypeFilter}
              onChange={(e) => onMovementTypeFilterChange?.(e.target.value)}
              className="sa-input min-h-10 w-full px-2.5 text-xs font-medium text-[#151515]"
            >
              <option value="all">All Movements</option>
              {MOVEMENT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2 min-w-0 lg:col-span-1">
            <label
              htmlFor="act-category"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Category
            </label>
            <select
              id="act-category"
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange?.(e.target.value)}
              className="sa-input min-h-10 w-full px-2.5 text-xs font-medium text-[#151515]"
            >
              <option value="all">All Categories</option>
              {INVENTORY_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminSurface>

      {movements.length === 0 ? (
        <AdminEmptyState
          icon={Activity}
          title={isLoading ? 'Memuat aktivitas...' : 'Belum ada aktivitas tercatat'}
          description="Seluruh pergerakan stok masuk, pemakaian, maintenance, dan penyesuaian stok akan tampil permanen di sini."
          className="!px-3.5 !py-5 sm:!px-6 sm:!py-10"
        />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {/* Mobile Stacked Activity Cards */}
          <div className="space-y-2 md:hidden">
            {movements.map((mov) => {
              const meta = getMovementMeta(mov.movementType);
              const balanceSummary = formatMovementBalanceSummary(mov);
              const linkedItem = itemsById.get(mov.itemId);
              return (
                <AdminSurface key={mov.id} variant="card" className="p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        disabled={!linkedItem}
                        onClick={() => linkedItem && onSelectItemById?.(mov.itemId)}
                        className="block max-w-full cursor-pointer truncate text-left font-semibold text-[#151515] hover:text-[#FF4B22] disabled:cursor-default"
                      >
                        {mov.itemNameSnapshot}
                      </button>
                      <p className="mt-0.5 font-mono text-[10.5px] text-[#666159]">
                        {mov.itemCode} • {formatInventoryTimestamp(mov.occurredAt || mov.createdAt)}
                      </p>
                    </div>

                    <AdminStatusBadge tone={meta.tone} size="sm" className="shrink-0">
                      {meta.shortLabel}
                    </AdminStatusBadge>
                  </div>

                  <div className="sa-panel-ivory mt-2.5 flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
                    <span className="font-mono font-bold text-[#151515]">
                      {formatMovementDeltaText(mov)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-[#46433D]">
                      <span>{balanceSummary.before}</span>
                      <ArrowRight className="h-3 w-3 text-[#8B857B]" aria-hidden="true" />
                      <strong className="text-[#151515]">{balanceSummary.after}</strong>
                    </span>
                  </div>

                  {mov.reason || mov.notes ? (
                    <p className="mt-2 text-[11px] text-[#46433D]">
                      {mov.reason ? <strong className="text-[#151515]">{mov.reason}</strong> : null}
                      {mov.reason && mov.notes ? ' — ' : ''}
                      {mov.notes}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-[10.5px] text-[#8B857B]">
                    Oleh: {mov.recordedByNameSnapshot || mov.recordedByUid}
                  </p>
                </AdminSurface>
              );
            })}
          </div>

          {/* Desktop Activity Table */}
          <AdminSurface
            as="section"
            variant="card"
            aria-label="Ringkasan tabel aktivitas inventory"
            className="hidden overflow-hidden md:block"
          >
            <div className="overflow-x-auto">
              <table
                aria-label="Tabel aktivitas inventory"
                className="w-full border-collapse text-left"
              >
                <thead className="border-b border-[#151515]/[0.08] bg-[#FAF8F3] text-[11px] font-semibold tracking-wide text-[#666159]">
                  <tr>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                      Timestamp
                    </th>
                    <th scope="col" className="px-3.5 py-2.5">
                      Item Name
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                      Movement Type
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                      Quantity Change
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                      Before / After
                    </th>
                    <th scope="col" className="px-3.5 py-2.5">
                      Reason
                    </th>
                    <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                      Actor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]/[0.06] text-xs">
                  {movements.map((mov) => {
                    const meta = getMovementMeta(mov.movementType);
                    const balanceSummary = formatMovementBalanceSummary(mov);
                    const linkedItem = itemsById.get(mov.itemId);
                    return (
                      <tr key={mov.id} className="bg-white hover:bg-[#FAF8F3]/80">
                        <td className="px-3.5 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-[#666159]">
                          {formatInventoryTimestamp(mov.occurredAt || mov.createdAt)}
                        </td>
                        <td className="px-3.5 py-3 align-middle">
                          <button
                            type="button"
                            disabled={!linkedItem}
                            onClick={() => linkedItem && onSelectItemById?.(mov.itemId)}
                            className="block max-w-[200px] cursor-pointer truncate text-left font-semibold text-[#151515] hover:text-[#FF4B22] disabled:cursor-default"
                          >
                            {mov.itemNameSnapshot}
                          </button>
                          <p className="font-mono text-[10.5px] text-[#666159]">{mov.itemCode}</p>
                        </td>
                        <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                          <AdminStatusBadge tone={meta.tone} size="sm">
                            {meta.label}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-3.5 py-3 align-middle font-mono font-bold whitespace-nowrap text-[#151515]">
                          {formatMovementDeltaText(mov)}
                        </td>
                        <td className="px-3.5 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-[#46433D]">
                          <span>{balanceSummary.before}</span>
                          <span className="mx-1 text-[#8B857B]">→</span>
                          <strong className="text-[#151515]">{balanceSummary.after}</strong>
                        </td>
                        <td className="px-3.5 py-3 align-middle text-[#46433D]">
                          <p className="max-w-[220px] truncate font-medium text-[#151515]">
                            {mov.reason || '—'}
                          </p>
                          {mov.notes ? (
                            <p className="max-w-[220px] truncate text-[11px] text-[#666159]">
                              {mov.notes}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-3 align-middle text-[11px] font-medium whitespace-nowrap text-[#46433D]">
                          {mov.recordedByNameSnapshot || mov.recordedByUid}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminSurface>

          {hasMore && onLoadMore ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={onLoadMore}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-5 py-2 text-xs font-semibold"
              >
                Load More Activity
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
