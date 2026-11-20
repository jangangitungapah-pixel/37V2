import { Filter, RotateCcw } from 'lucide-react';

import {
  INVENTORY_CATEGORIES,
  INVENTORY_CONSUMABLE_STATUS,
  INVENTORY_EQUIPMENT_STATUS,
  INVENTORY_ITEM_TYPE_OPTIONS,
  INVENTORY_ITEM_TYPES,
  INVENTORY_LOCATIONS,
} from '../config/inventory-config';

export function InventoryFilters({
  workspaceTab = 'all',
  typeFilter = 'all',
  onTypeFilterChange,
  categoryFilter = 'all',
  onCategoryFilterChange,
  locationFilter = 'all',
  onLocationFilterChange,
  statusFilter = 'all',
  onStatusFilterChange,
  hasActiveFilters = false,
  mobileExpanded = false,
  onClearFilters,
}) {
  const effectiveType =
    workspaceTab === 'consumables'
      ? INVENTORY_ITEM_TYPES.CONSUMABLE
      : workspaceTab === 'equipment'
        ? INVENTORY_ITEM_TYPES.EQUIPMENT
        : typeFilter;

  const statusOptions = [];
  if (effectiveType !== INVENTORY_ITEM_TYPES.EQUIPMENT) {
    statusOptions.push(
      { id: INVENTORY_CONSUMABLE_STATUS.IN_STOCK, label: 'In Stock (Consumable)' },
      { id: INVENTORY_CONSUMABLE_STATUS.LOW_STOCK, label: 'Low Stock (Consumable)' },
      { id: INVENTORY_CONSUMABLE_STATUS.OUT_OF_STOCK, label: 'Out of Stock (Consumable)' },
    );
  }
  if (effectiveType !== INVENTORY_ITEM_TYPES.CONSUMABLE) {
    statusOptions.push(
      { id: INVENTORY_EQUIPMENT_STATUS.AVAILABLE, label: 'Available (Equipment)' },
      { id: INVENTORY_EQUIPMENT_STATUS.MAINTENANCE, label: 'Maintenance (Equipment)' },
      { id: INVENTORY_EQUIPMENT_STATUS.DAMAGED, label: 'Damaged (Equipment)' },
      { id: INVENTORY_EQUIPMENT_STATUS.RETIRED, label: 'Retired / Lost (Equipment)' },
      { id: INVENTORY_EQUIPMENT_STATUS.MAINTENANCE_DUE, label: 'Maintenance Due (Equipment)' },
    );
  }
  statusOptions.push({ id: 'archived', label: 'Archived' });

  const hasSelectFilter =
    (workspaceTab === 'all' && typeFilter !== 'all') ||
    categoryFilter !== 'all' ||
    locationFilter !== 'all' ||
    (statusFilter !== 'all' && statusFilter !== 'archived');

  return (
    <div
      className={`space-y-2 border-t border-[#151515]/[0.07] pt-2.5 sm:space-y-2.5 sm:pt-3 ${
        mobileExpanded || hasSelectFilter ? 'block' : 'hidden sm:block'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#666159] sm:text-xs">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filter Daftar Barang</span>
        </span>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="sa-control inline-flex min-h-7.5 cursor-pointer items-center gap-1 border-[#FF4B22]/25 bg-[#FFEDE8] px-2.5 py-0.5 text-[11px] font-semibold text-[#B92B0C] hover:bg-[#ffdfd6] sm:min-h-8 sm:gap-1.5 sm:py-1"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Clear Filters</span>
          </button>
        ) : null}
      </div>

      <div
        className={`grid grid-cols-2 gap-2 sm:gap-2.5 ${
          workspaceTab === 'all' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        {workspaceTab === 'all' ? (
          <div className="min-w-0">
            <label
              htmlFor="inv-filter-type"
              className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
            >
              Item Type
            </label>
            <select
              id="inv-filter-type"
              value={typeFilter}
              onChange={(e) => onTypeFilterChange?.(e.target.value)}
              className="sa-input min-h-9 w-full px-2.5 text-xs font-medium text-[#151515] sm:min-h-10 sm:px-3"
            >
              <option value="all">All Types</option>
              {INVENTORY_ITEM_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="min-w-0">
          <label
            htmlFor="inv-filter-category"
            className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
          >
            Category
          </label>
          <select
            id="inv-filter-category"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange?.(e.target.value)}
            className="sa-input min-h-9 w-full px-2.5 text-xs font-medium text-[#151515] sm:min-h-10 sm:px-3"
          >
            <option value="all">All Categories</option>
            {INVENTORY_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="inv-filter-location"
            className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
          >
            Location
          </label>
          <select
            id="inv-filter-location"
            value={locationFilter}
            onChange={(e) => onLocationFilterChange?.(e.target.value)}
            className="sa-input min-h-9 w-full px-2.5 text-xs font-medium text-[#151515] sm:min-h-10 sm:px-3"
          >
            <option value="all">All Locations</option>
            {INVENTORY_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="inv-filter-status"
            className="mb-0.5 block text-[10.5px] font-medium text-[#666159] sm:mb-1 sm:text-[11px]"
          >
            Status
          </label>
          <select
            id="inv-filter-status"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange?.(e.target.value)}
            className="sa-input min-h-9 w-full px-2.5 text-xs font-medium text-[#151515] sm:min-h-10 sm:px-3"
          >
            <option value="all">All Active Status</option>
            {statusOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
