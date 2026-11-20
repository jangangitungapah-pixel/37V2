import { Dialog } from '@base-ui/react/dialog';
import {
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  Edit3,
  MapPin,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { INVENTORY_ITEM_TYPES, INVENTORY_MOVEMENT_TYPES } from '../config/inventory-config';
import { useInventoryItemDetail } from '../hooks/useInventoryItemDetail';
import { formatInventoryQuantity, resolveUnitDisplayLabel } from '../utils/inventory-format';
import {
  computeEquipmentRegisteredTotal,
  deriveInventoryItemStatusMeta,
} from '../utils/inventory-status';
import { InventoryMaintenancePanel } from './InventoryMaintenancePanel';
import { InventoryMovementHistory } from './InventoryMovementHistory';

export function InventoryItemDetailDrawer({
  item,
  open,
  isOwner = false,
  onOpenChange,
  onEditMetadata,
  onOpenMovement,
  onOpenAdjustment,
  onOpenArchive,
}) {
  const {
    movements,
    hasMore,
    isLoading: isHistoryLoading,
    error: historyError,
    loadMoreHistory,
  } = useInventoryItemDetail({
    itemId: item?.id || '',
    itemVersion: item?.version || 0,
    enabled: open && Boolean(item?.id),
  });

  if (!item) return null;

  const todayIso = getJakartaTodayIso();
  const statusMeta = deriveInventoryItemStatusMeta(item, todayIso);
  const isEquipment = item.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
  const isArchived = item.isActive === false;
  const unitLabel = resolveUnitDisplayLabel(item.unit, item.customUnitLabel);

  const onHand = Number(item.consumableStock?.onHandQuantity || 0);
  const eq = item.equipmentStock || {};
  const availableQty = Number(eq.availableQuantity || 0);
  const maintenanceQty = Number(eq.maintenanceQuantity || 0);
  const damagedQty = Number(eq.damagedQuantity || 0);
  const retiredQty = Number(eq.retiredQuantity || 0);
  const registeredTotal = isEquipment ? computeEquipmentRegisteredTotal(eq) : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={`Detail inventory ${item.name}`}
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="shrink-0 border-b border-[#151515]/[0.08] bg-white px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone={statusMeta.tone} dot size="sm">
                    {statusMeta.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={isEquipment ? 'ink' : 'ivory'} size="sm">
                    {isEquipment ? 'Equipment' : 'Consumable'}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="neutral" icon={MapPin} size="sm">
                    {item.locationLabel}
                  </AdminStatusBadge>
                </div>

                <Dialog.Title className="mt-1.5 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  {item.name}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[#666159] sm:text-xs">
                  <span className="font-semibold text-[#151515]">{item.itemCode}</span>
                  <span>• {item.categoryLabel}</span>
                  {item.brand || item.model ? (
                    <span>• {[item.brand, item.model].filter(Boolean).join(' ')}</span>
                  ) : null}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail barang"
                className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515] sm:h-9 sm:w-9 sm:rounded-xl"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Metadata / Archive Top Actions */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#151515]/[0.07] pt-2.5 sm:mt-3 sm:gap-2 sm:pt-3">
              {!isArchived ? (
                <>
                  <button
                    type="button"
                    onClick={() => onEditMetadata?.(item)}
                    className="sa-control sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                    <span>Edit Metadata</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenArchive?.(item)}
                    className="sa-control sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#B92B0C]"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Archive</span>
                  </button>
                </>
              ) : isOwner ? (
                <button
                  type="button"
                  onClick={() => onOpenArchive?.(item)}
                  className="sa-control sa-btn-lime inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reactivate Item</span>
                </button>
              ) : (
                <span className="text-[11px] font-medium text-[#666159]">
                  Item diarsipkan (hanya Owner dapat mengaktifkan kembali).
                </span>
              )}
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {/* B. Stock Overview */}
            <AdminSurface variant="card" className="space-y-3 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-tight text-[#151515]">
                  Stock Overview
                </h3>
                <span className="font-mono text-[11px] text-[#666159]">Satuan: {unitLabel}</span>
              </div>

              {!isEquipment ? (
                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="sa-panel p-2.5">
                    <dt className="text-[10.5px] font-medium text-[#666159]">Quantity On Hand</dt>
                    <dd className="mt-1 font-mono text-lg font-bold text-[#151515] tabular-nums">
                      {formatInventoryQuantity(onHand)} {unitLabel}
                    </dd>
                  </div>

                  <div className="sa-panel p-2.5">
                    <dt className="text-[10.5px] font-medium text-[#666159]">Minimum Stock</dt>
                    <dd className="mt-1 font-mono text-lg font-bold text-[#46433D] tabular-nums">
                      {formatInventoryQuantity(item.minimumStockQuantity || 0)} {unitLabel}
                    </dd>
                  </div>

                  <div className="sa-panel col-span-2 p-2.5 sm:col-span-1">
                    <dt className="text-[10.5px] font-medium text-[#666159]">Stock Status</dt>
                    <dd className="mt-1.5">
                      <AdminStatusBadge tone={statusMeta.tone} dot size="sm">
                        {statusMeta.label}
                      </AdminStatusBadge>
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="sa-panel-ivory p-2.5">
                    <dt className="text-[10px] font-medium text-[#666159]">Available</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#243300] tabular-nums">
                      {availableQty}
                    </dd>
                  </div>
                  <div className="sa-panel p-2.5">
                    <dt className="text-[10px] font-medium text-[#666159]">Maintenance</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#8A4B08] tabular-nums">
                      {maintenanceQty}
                    </dd>
                  </div>
                  <div className="sa-panel p-2.5">
                    <dt className="text-[10px] font-medium text-[#666159]">Damaged</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#B92B0C] tabular-nums">
                      {damagedQty}
                    </dd>
                  </div>
                  <div className="sa-panel p-2.5">
                    <dt className="text-[10px] font-medium text-[#666159]">Retired / Lost</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#46433D] tabular-nums">
                      {retiredQty}
                    </dd>
                  </div>
                  <div className="sa-panel col-span-2 bg-[#151515]/[0.06] p-2.5 sm:col-span-1">
                    <dt className="text-[10px] font-medium text-[#46433D]">Registered</dt>
                    <dd className="mt-1 font-mono text-base font-bold text-[#151515] tabular-nums">
                      {registeredTotal}
                    </dd>
                  </div>
                </dl>
              )}

              {item.notes ? (
                <p className="border-t border-[#151515]/[0.07] pt-2.5 text-xs leading-relaxed text-[#46433D]">
                  <strong className="text-[#151515]">Notes:</strong> {item.notes}
                </p>
              ) : null}
            </AdminSurface>

            {/* C. Equipment Maintenance Overview */}
            {isEquipment ? (
              <InventoryMaintenancePanel
                item={item}
                onTriggerMovement={(type) => onOpenMovement?.(item, type)}
              />
            ) : null}

            {/* D. Quick Actions */}
            {!isArchived ? (
              <AdminSurface variant="card" className="space-y-2.5 p-3.5 sm:p-4">
                <h3 className="text-xs font-semibold tracking-tight text-[#151515]">
                  Quick Actions
                </h3>

                <div className="flex flex-wrap gap-2">
                  {!isEquipment ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.STOCK_IN)}
                        className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Stock In</span>
                      </button>

                      {onHand > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.CONSUME)}
                          className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Record Usage</span>
                        </button>
                      ) : null}

                      {onHand > 0 ? (
                        <button
                          type="button"
                          onClick={() => onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.WRITE_OFF)}
                          className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B92B0C]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Write Off</span>
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.STOCK_IN)}
                        className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Add Equipment</span>
                      </button>

                      {availableQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE)
                          }
                          className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <Wrench className="h-3.5 w-3.5 text-[#8A4B08]" aria-hidden="true" />
                          <span>Send to Maintenance</span>
                        </button>
                      ) : null}

                      {maintenanceQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE)
                          }
                          className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <span>Return from Maintenance</span>
                        </button>
                      ) : null}

                      {availableQty > 0 || maintenanceQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED)
                          }
                          className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#B92B0C]"
                        >
                          <span>Mark Damaged</span>
                        </button>
                      ) : null}

                      {damagedQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED)
                          }
                          className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <span>Mark Repaired</span>
                        </button>
                      ) : null}

                      {availableQty > 0 || damagedQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.MARK_RETIRED)
                          }
                          className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                        >
                          <span>Mark Lost / Retired</span>
                        </button>
                      ) : null}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onOpenMovement?.(item, INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED)
                    }
                    className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit Location</span>
                  </button>

                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => onOpenAdjustment?.(item)}
                      className="sa-control sa-btn-primary inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                      <span>Stock Adjustment</span>
                    </button>
                  ) : null}
                </div>
              </AdminSurface>
            ) : null}

            {/* E. Movement History */}
            <InventoryMovementHistory
              movements={movements}
              hasMore={hasMore}
              isLoading={isHistoryLoading}
              error={historyError}
              onLoadMore={loadMoreHistory}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
