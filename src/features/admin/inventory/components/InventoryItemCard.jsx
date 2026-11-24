import { ArrowLeftRight, ChevronRight, MapPin } from 'lucide-react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { INVENTORY_ITEM_TYPES } from '../config/inventory-config';
import {
  formatEquipmentBucketSummary,
  formatInventoryQuantity,
  resolveUnitDisplayLabel,
} from '../utils/inventory-format';
import { deriveInventoryItemStatusMeta } from '../utils/inventory-status';

export function InventoryItemCard({ item, onSelectItem, onQuickMovement }) {
  if (!item) return null;
  const todayIso = getJakartaTodayIso();
  const statusMeta = deriveInventoryItemStatusMeta(item, todayIso);
  const unitLabel = resolveUnitDisplayLabel(item.unit, item.customUnitLabel);
  const isEquipment = item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;

  return (
    <AdminSurface
      as="article"
      variant="card"
      className={`p-3 ${item.isActive === false ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onSelectItem?.(item)}
            className="block max-w-full cursor-pointer text-left text-[13px] leading-snug font-semibold break-words text-[#151515] hover:text-[#FF4B22]"
          >
            {item.name}
          </button>
          <p className="mt-0.5 font-mono text-[10.5px] font-medium text-[#666159]">
            {item.itemCode}
            {item.brand ? ` • ${item.brand}` : ''}
          </p>
        </div>

        <AdminStatusBadge tone={statusMeta.tone} dot size="sm" className="shrink-0">
          {statusMeta.label}
        </AdminStatusBadge>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px] text-[#46433D]">
        <AdminStatusBadge tone={isEquipment ? 'ink' : 'ivory'} size="sm">
          {isEquipment ? 'Equipment' : 'Consumable'}
        </AdminStatusBadge>
        <span className="rounded-md bg-[#F6F3EB] px-1.5 py-0.5 font-medium text-[#46433D]">
          {item.categoryLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-[#F6F3EB] px-1.5 py-0.5 font-medium text-[#46433D]">
          <MapPin className="h-3 w-3 text-[#666159]" aria-hidden="true" />
          <span>{item.locationLabel}</span>
        </span>
      </div>

      <div className="sa-panel-ivory mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-bold text-[#151515] tabular-nums">
            {isEquipment
              ? `${formatInventoryQuantity(item.equipmentStock?.availableQuantity || 0, item.itemType)} ${unitLabel} avail`
              : `${formatInventoryQuantity(item.consumableStock?.onHandQuantity || 0)} ${unitLabel}`}
          </p>
          <p className="text-[10.5px] text-[#666159]">
            {isEquipment
              ? formatEquipmentBucketSummary(item.equipmentStock)
              : `Min: ${formatInventoryQuantity(item.minimumStockQuantity || 0)} ${unitLabel}`}
          </p>
        </div>

        {isEquipment && statusMeta.maintMeta?.isSoon && !statusMeta.maintMeta?.isDue ? (
          <AdminStatusBadge tone="amber" size="sm">
            Maint Soon
          </AdminStatusBadge>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.isActive !== false ? (
          <button
            type="button"
            onClick={() => onQuickMovement?.(item)}
            className="sa-control sa-btn-lime inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Catat</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onSelectItem?.(item)}
          className="sa-control sa-btn-primary inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold"
        >
          <span>Detail</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </AdminSurface>
  );
}
