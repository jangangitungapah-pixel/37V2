import { ArrowLeftRight, ChevronRight, MapPin } from 'lucide-react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { INVENTORY_ITEM_TYPES } from '../config/inventory-config';
import {
  formatEquipmentBucketSummary,
  formatInventoryQuantity,
  formatInventoryTimestamp,
  resolveUnitDisplayLabel,
} from '../utils/inventory-format';
import { deriveInventoryItemStatusMeta } from '../utils/inventory-status';
import { InventoryItemCard } from './InventoryItemCard';

/**
 * Responsive Inventory Directory:
 * - Desktop (`md+`): Compact 8-column spatial table
 * - Mobile (`< md`): Stacked cards via `InventoryItemCard` (zero horizontal overflow)
 */
export function InventoryItemTable({
  items = [],
  onSelectItem,
  onQuickMovement,
  hasMore = false,
  onLoadMore,
  totalSummaryLabel = '',
}) {
  const todayIso = getJakartaTodayIso();

  return (
    <div className="space-y-2.5 sm:space-y-3.5">
      {/* Mobile Stacked Cards */}
      <div className="space-y-2 md:hidden">
        {items.map((item) => (
          <InventoryItemCard
            key={item.id}
            item={item}
            onSelectItem={onSelectItem}
            onQuickMovement={onQuickMovement}
          />
        ))}
      </div>

      {/* Desktop Data Table */}
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Tabel daftar inventory studio"
        className="hidden overflow-hidden md:block"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-4 py-3">
          <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
            Daftar Perlengkapan &amp; Stok
          </span>
          <span className="text-xs text-[#666159]">
            Klik nama item atau Detail untuk melihat riwayat &amp; pergerakan stok
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-[#151515]/[0.08] bg-[#FAF8F3] text-[11px] font-semibold tracking-wide text-[#666159]">
              <tr>
                <th scope="col" className="px-3.5 py-2.5">
                  Item
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Type
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Category
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Location
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Quantity
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Status
                </th>
                <th scope="col" className="hidden px-3.5 py-2.5 whitespace-nowrap xl:table-cell">
                  Updated
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#151515]/[0.06]">
              {items.map((item) => {
                const statusMeta = deriveInventoryItemStatusMeta(item, todayIso);
                const unitLabel = resolveUnitDisplayLabel(item.unit, item.customUnitLabel);
                const isEquipment = item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      item.isActive === false
                        ? 'bg-[#FAF8F3]/70 opacity-75'
                        : 'bg-white hover:bg-[#FAF8F3]/80'
                    }`}
                  >
                    <td className="px-3.5 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => onSelectItem?.(item)}
                        className="block max-w-[240px] cursor-pointer truncate text-left text-xs font-semibold text-[#151515] hover:text-[#FF4B22] sm:text-[13px]"
                      >
                        {item.name}
                      </button>
                      <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                        {item.itemCode}
                        {item.brand ? ` • ${item.brand}` : ''}
                      </p>
                    </td>

                    <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                      <AdminStatusBadge tone={isEquipment ? 'ink' : 'ivory'} size="sm">
                        {isEquipment ? 'Equipment' : 'Consumable'}
                      </AdminStatusBadge>
                    </td>

                    <td className="px-3.5 py-3 align-middle text-xs font-medium text-[#46433D]">
                      {item.categoryLabel}
                    </td>

                    <td className="px-3.5 py-3 align-middle text-xs font-medium whitespace-nowrap text-[#46433D]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#8B857B]" aria-hidden="true" />
                        <span>{item.locationLabel}</span>
                      </span>
                    </td>

                    <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                      <p className="font-mono text-xs font-bold text-[#151515] tabular-nums">
                        {isEquipment
                          ? `${formatInventoryQuantity(item.equipmentStock?.availableQuantity || 0, item.itemType)} ${unitLabel}`
                          : `${formatInventoryQuantity(item.consumableStock?.onHandQuantity || 0)} ${unitLabel}`}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[#666159]">
                        {isEquipment
                          ? formatEquipmentBucketSummary(item.equipmentStock)
                          : `Min: ${formatInventoryQuantity(item.minimumStockQuantity || 0)} ${unitLabel}`}
                      </p>
                    </td>

                    <td className="px-3.5 py-3 align-middle whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <AdminStatusBadge tone={statusMeta.tone} dot size="sm">
                          {statusMeta.label}
                        </AdminStatusBadge>
                        {isEquipment &&
                        statusMeta.maintMeta?.isSoon &&
                        !statusMeta.maintMeta?.isDue ? (
                          <span className="text-[10px] font-semibold text-[#8A4B08]">
                            Maint Soon
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="hidden px-3.5 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-[#666159] xl:table-cell">
                      {formatInventoryTimestamp(item.lastMovementAt || item.updatedAt)}
                    </td>

                    <td className="px-3.5 py-3 text-right align-middle whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {item.isActive !== false ? (
                          <button
                            type="button"
                            onClick={() => onQuickMovement?.(item)}
                            className="sa-control sa-btn-lime inline-flex min-h-8.5 cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                          >
                            <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                            <span>Catat</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onSelectItem?.(item)}
                          className="sa-control sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminSurface>

      {/* Pagination Footer */}
      {hasMore || totalSummaryLabel ? (
        <div className="flex flex-col items-center justify-between gap-2.5 px-1 sm:flex-row">
          <span className="text-xs text-[#666159]">{totalSummaryLabel}</span>
          {hasMore && onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-2 text-xs font-semibold"
            >
              Load More Items
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
