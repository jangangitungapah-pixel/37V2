import { CalendarClock, Wrench } from 'lucide-react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { INVENTORY_ITEM_TYPES, INVENTORY_MOVEMENT_TYPES } from '../config/inventory-config';
import { formatInventoryDate } from '../utils/inventory-format';
import { deriveEquipmentMaintenanceMeta } from '../utils/inventory-status';

export function InventoryMaintenancePanel({ item, onTriggerMovement }) {
  if (!item || item.itemType !== INVENTORY_ITEM_TYPES.EQUIPMENT) {
    return null;
  }

  const todayIso = getJakartaTodayIso();
  const maintMeta = deriveEquipmentMaintenanceMeta(item, todayIso);
  const availableQty = Number(item.equipmentStock?.availableQuantity || 0);
  const maintenanceQty = Number(item.equipmentStock?.maintenanceQuantity || 0);
  const canActionsRun = item.isActive !== false;

  return (
    <AdminSurface variant="ivory" className="space-y-3 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
          <h3 className="text-xs font-semibold tracking-tight text-[#151515]">
            Maintenance Overview
          </h3>
        </div>

        <AdminStatusBadge tone={maintMeta.tone} dot size="sm">
          {maintMeta.label}
        </AdminStatusBadge>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sa-subcard p-2.5">
          <dt className="text-[10.5px] font-medium text-[#666159]">Last Maintenance</dt>
          <dd className="mt-1 font-mono text-xs font-semibold text-[#151515]">
            {formatInventoryDate(item.lastMaintenanceDate)}
          </dd>
        </div>

        <div className="sa-subcard p-2.5">
          <dt className="text-[10.5px] font-medium text-[#666159]">Next Maintenance</dt>
          <dd className="mt-1 font-mono text-xs font-semibold text-[#151515]">
            {formatInventoryDate(item.nextMaintenanceDate)}
          </dd>
        </div>

        <div className="sa-subcard p-2.5">
          <dt className="text-[10.5px] font-medium text-[#666159]">Maintenance Interval</dt>
          <dd className="mt-1 font-mono text-xs font-semibold text-[#151515]">
            {item.maintenanceIntervalDays ? `${item.maintenanceIntervalDays} hari` : '—'}
          </dd>
        </div>
      </dl>

      {canActionsRun && (availableQty > 0 || maintenanceQty > 0) ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#151515]/[0.07] pt-2.5">
          {availableQty > 0 ? (
            <button
              type="button"
              onClick={() => onTriggerMovement?.(INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE)}
              className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold"
            >
              <Wrench className="h-3.5 w-3.5 text-[#8A4B08]" aria-hidden="true" />
              <span>Send to Maintenance</span>
            </button>
          ) : null}

          {maintenanceQty > 0 ? (
            <button
              type="button"
              onClick={() => onTriggerMovement?.(INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE)}
              className="sa-control sa-btn-lime inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold"
            >
              <span>Return from Maintenance ({maintenanceQty})</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </AdminSurface>
  );
}
