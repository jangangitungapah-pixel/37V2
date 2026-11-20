import { useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, ArrowLeftRight, ArrowRight, Loader2, X } from 'lucide-react';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  addDaysToIsoDate,
  getJakartaTodayIso,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  CONSUMABLE_USAGE_REASONS,
  CONSUMABLE_WRITE_OFF_REASONS,
  EQUIPMENT_DAMAGE_SOURCE_BUCKETS,
  EQUIPMENT_RETIRE_REASONS,
  EQUIPMENT_RETIRE_SOURCE_BUCKETS,
  getMovementMeta,
  INVENTORY_ITEM_TYPES,
  INVENTORY_LOCATIONS,
  INVENTORY_MOVEMENT_TYPES,
} from '../config/inventory-config';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';
import { computeInventoryMovementTransition } from '../utils/inventory-calculation';
import {
  formatEquipmentBucketSummary,
  formatInventoryQuantity,
  resolveUnitDisplayLabel,
} from '../utils/inventory-format';

function getAllowedOperationalMovementTypes(item) {
  if (!item) return [];
  if (item.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
    const onHand = Number(item.consumableStock?.onHandQuantity) || 0;
    const list = [
      { id: INVENTORY_MOVEMENT_TYPES.STOCK_IN, label: 'Stock In (Barang Masuk)', disabled: false },
      {
        id: INVENTORY_MOVEMENT_TYPES.CONSUME,
        label: 'Record Usage (Pemakaian)',
        disabled: onHand <= 0,
      },
      {
        id: INVENTORY_MOVEMENT_TYPES.WRITE_OFF,
        label: 'Write Off (Rusak / Hilang / Kedaluwarsa)',
        disabled: onHand <= 0,
      },
      {
        id: INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED,
        label: 'Edit Location (Pindah Lokasi)',
        disabled: false,
      },
    ];
    return list;
  }

  const eq = item.equipmentStock || {};
  const available = Number(eq.availableQuantity) || 0;
  const maintenance = Number(eq.maintenanceQuantity) || 0;
  const damaged = Number(eq.damagedQuantity) || 0;

  return [
    {
      id: INVENTORY_MOVEMENT_TYPES.STOCK_IN,
      label: 'Add Equipment (Tambah Unit)',
      disabled: false,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE,
      label: 'Send to Maintenance',
      disabled: available <= 0,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE,
      label: 'Return from Maintenance',
      disabled: maintenance <= 0,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED,
      label: 'Mark Damaged',
      disabled: available <= 0 && maintenance <= 0,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED,
      label: 'Mark Repaired',
      disabled: damaged <= 0,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.MARK_RETIRED,
      label: 'Mark Lost / Retired',
      disabled: available <= 0 && damaged <= 0,
    },
    {
      id: INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED,
      label: 'Edit Location (Pindah Lokasi)',
      disabled: false,
    },
  ];
}

function resolveDefaultMovementType(item, initialType) {
  const options = getAllowedOperationalMovementTypes(item);
  if (initialType) {
    const matched = options.find((opt) => opt.id === initialType && !opt.disabled);
    if (matched) return matched.id;
  }
  if (item?.itemType === INVENTORY_ITEM_TYPES.CONSUMABLE) {
    return (item.consumableStock?.onHandQuantity || 0) > 0
      ? INVENTORY_MOVEMENT_TYPES.CONSUME
      : INVENTORY_MOVEMENT_TYPES.STOCK_IN;
  }
  const eq = item?.equipmentStock || {};
  if ((eq.availableQuantity || 0) > 0) return INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE;
  if ((eq.maintenanceQuantity || 0) > 0) return INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE;
  return INVENTORY_MOVEMENT_TYPES.STOCK_IN;
}

/**
 * Operational Record Movement Dialog for both Consumables & Equipment
 * (including Location Change), with live Before/After preview and stable operationId.
 */
export function InventoryMovementDialog({
  open,
  item,
  initialMovementType = '',
  onOpenChange,
  onSubmitMovement,
}) {
  const todayIso = getJakartaTodayIso();
  const [movementId] = useState(() => generateOperationId('mov'));
  const [movementType, setMovementType] = useState(() =>
    resolveDefaultMovementType(item, initialMovementType),
  );
  const [quantity, setQuantity] = useState('1');
  const [sourceBucket, setSourceBucket] = useState(() => {
    const eq = item?.equipmentStock || {};
    if (initialMovementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED) {
      return (eq.availableQuantity || 0) > 0 ? 'available' : 'maintenance';
    }
    if (initialMovementType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED) {
      return (eq.availableQuantity || 0) > 0 ? 'available' : 'damaged';
    }
    return 'available';
  });
  const [reasonSelect, setReasonSelect] = useState(() => {
    const t = resolveDefaultMovementType(item, initialMovementType);
    if (t === INVENTORY_MOVEMENT_TYPES.CONSUME) return CONSUMABLE_USAGE_REASONS[0].id;
    if (t === INVENTORY_MOVEMENT_TYPES.WRITE_OFF) return CONSUMABLE_WRITE_OFF_REASONS[0].id;
    if (t === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED) return EQUIPMENT_RETIRE_REASONS[0].id;
    return '';
  });
  const [reasonText, setReasonText] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredDate, setOccurredDate] = useState(todayIso);
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState(() =>
    item?.maintenanceIntervalDays > 0
      ? addDaysToIsoDate(todayIso, item.maintenanceIntervalDays)
      : item?.nextMaintenanceDate || '',
  );
  const [locationId, setLocationId] = useState(() => item?.locationId || 'storage');
  const [customLocationLabel, setCustomLocationLabel] = useState(() =>
    item?.locationId === 'other' ? item?.locationLabel || '' : '',
  );

  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEquipment = item?.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
  const unitLabel = item ? resolveUnitDisplayLabel(item.unit, item.customUnitLabel) : 'pcs';
  const movementOptions = useMemo(() => getAllowedOperationalMovementTypes(item), [item]);
  const movementMeta = getMovementMeta(movementType);

  const effectiveReason = useMemo(() => {
    if (
      movementType === INVENTORY_MOVEMENT_TYPES.CONSUME ||
      movementType === INVENTORY_MOVEMENT_TYPES.WRITE_OFF ||
      movementType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED
    ) {
      return reasonSelect === 'Other' ? reasonText.trim() || 'Other' : reasonSelect;
    }
    return reasonText.trim();
  }, [movementType, reasonSelect, reasonText]);

  const previewResult = useMemo(() => {
    if (!item) return { ok: false, error: '' };
    try {
      const transition = computeInventoryMovementTransition({
        item,
        movementType,
        quantity,
        sourceBucket,
        reason: effectiveReason,
        notes: movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED ? notes || 'preview' : notes,
        locationId,
        customLocationLabel,
      });
      return { ok: true, transition, error: '' };
    } catch (err) {
      return { ok: false, error: err?.message || 'Input pergerakan belum valid.' };
    }
  }, [
    item,
    movementType,
    quantity,
    sourceBucket,
    effectiveReason,
    notes,
    locationId,
    customLocationLabel,
  ]);

  if (!item) return null;

  const handleChangeMovementType = (nextType) => {
    setMovementType(nextType);
    setSubmitError('');
    if (nextType === INVENTORY_MOVEMENT_TYPES.CONSUME) {
      setReasonSelect(CONSUMABLE_USAGE_REASONS[0].id);
    } else if (nextType === INVENTORY_MOVEMENT_TYPES.WRITE_OFF) {
      setReasonSelect(CONSUMABLE_WRITE_OFF_REASONS[0].id);
    } else if (nextType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED) {
      setReasonSelect(EQUIPMENT_RETIRE_REASONS[0].id);
    }
    const eq = item.equipmentStock || {};
    if (nextType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED) {
      setSourceBucket((eq.availableQuantity || 0) > 0 ? 'available' : 'maintenance');
    } else if (nextType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED) {
      setSourceBucket((eq.availableQuantity || 0) > 0 ? 'available' : 'damaged');
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');

    if (
      (movementType === INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE ||
        movementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED) &&
      effectiveReason.length < 2
    ) {
      setSubmitError('Isi alasan maintenance / kerusakan minimal 2 karakter.');
      return;
    }

    if (movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED && notes.trim().length < 3) {
      setSubmitError('Catatan perbaikan (Repair Note) wajib diisi minimal 3 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitMovement?.({
        itemId: item.id,
        movementId,
        expectedVersion: item.version,
        movementType,
        quantity,
        sourceBucket,
        reason: effectiveReason,
        notes,
        occurredDate,
        nextMaintenanceDate:
          movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE
            ? nextMaintenanceDate
            : undefined,
        locationId,
        customLocationLabel,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapInventoryErrorToMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLocationChange = movementType === INVENTORY_MOVEMENT_TYPES.LOCATION_CHANGED;
  const usesPresetReason =
    movementType === INVENTORY_MOVEMENT_TYPES.CONSUME ||
    movementType === INVENTORY_MOVEMENT_TYPES.WRITE_OFF ||
    movementType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED;

  const reasonPresetOptions =
    movementType === INVENTORY_MOVEMENT_TYPES.CONSUME
      ? CONSUMABLE_USAGE_REASONS
      : movementType === INVENTORY_MOVEMENT_TYPES.WRITE_OFF
        ? CONSUMABLE_WRITE_OFF_REASONS
        : EQUIPMENT_RETIRE_REASONS;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(true))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={`Record movement ${item.name}`}
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Compact Header */}
          <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <AdminStatusBadge tone={movementMeta.tone} icon={ArrowLeftRight} size="sm">
                Record Movement
              </AdminStatusBadge>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                Catat Pergerakan • {item.name}
              </Dialog.Title>
              <Dialog.Description className="truncate font-mono text-[11px] text-[#666159]">
                {item.itemCode} • {item.locationLabel}
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog catat pergerakan"
              disabled={isSubmitting}
              className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] sm:h-9 sm:w-9 sm:rounded-xl"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="inventory-movement-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 text-xs sm:px-5 sm:py-4"
          >
            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            <div>
              <label htmlFor="mov-type" className="mb-1 block font-semibold text-[#151515]">
                Jenis Pergerakan <span className="text-[#FF4B22]">*</span>
              </label>
              <select
                id="mov-type"
                value={movementType}
                onChange={(e) => handleChangeMovementType(e.target.value)}
                className="sa-input min-h-10 w-full px-3 text-xs font-semibold text-[#151515]"
              >
                {movementOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                    {opt.label}
                    {opt.disabled ? ' (Stok 0)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {isLocationChange ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mov-loc-id" className="mb-1 block font-semibold text-[#151515]">
                    Lokasi Baru <span className="text-[#FF4B22]">*</span>
                  </label>
                  <select
                    id="mov-loc-id"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                  >
                    {INVENTORY_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {locationId === 'other' ? (
                  <div>
                    <label
                      htmlFor="mov-custom-loc"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      Nama Lokasi Custom <span className="text-[#FF4B22]">*</span>
                    </label>
                    <input
                      id="mov-custom-loc"
                      type="text"
                      value={customLocationLabel}
                      onChange={(e) => setCustomLocationLabel(e.target.value)}
                      placeholder="Contoh: Rak Aksesoris"
                      className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mov-qty" className="mb-1 block font-semibold text-[#151515]">
                    Quantity ({unitLabel}) <span className="text-[#FF4B22]">*</span>
                  </label>
                  <input
                    id="mov-qty"
                    type="number"
                    min={isEquipment ? '1' : '0.001'}
                    step={isEquipment ? '1' : '0.001'}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="sa-input min-h-10 w-full px-3 font-mono text-sm font-bold text-[#151515]"
                  />
                </div>

                {movementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED ? (
                  <div>
                    <label
                      htmlFor="mov-src-dmg"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      Source Bucket
                    </label>
                    <select
                      id="mov-src-dmg"
                      value={sourceBucket}
                      onChange={(e) => setSourceBucket(e.target.value)}
                      className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                    >
                      {EQUIPMENT_DAMAGE_SOURCE_BUCKETS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label} (
                          {b.id === 'available'
                            ? item.equipmentStock?.availableQuantity || 0
                            : item.equipmentStock?.maintenanceQuantity || 0}
                          )
                        </option>
                      ))}
                    </select>
                  </div>
                ) : movementType === INVENTORY_MOVEMENT_TYPES.MARK_RETIRED ? (
                  <div>
                    <label
                      htmlFor="mov-src-ret"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      Source Bucket
                    </label>
                    <select
                      id="mov-src-ret"
                      value={sourceBucket}
                      onChange={(e) => setSourceBucket(e.target.value)}
                      className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                    >
                      {EQUIPMENT_RETIRE_SOURCE_BUCKETS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label} (
                          {b.id === 'available'
                            ? item.equipmentStock?.availableQuantity || 0
                            : item.equipmentStock?.damagedQuantity || 0}
                          )
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="mov-date" className="mb-1 block font-medium text-[#46433D]">
                      {movementType === INVENTORY_MOVEMENT_TYPES.STOCK_IN
                        ? 'Received Date'
                        : movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE
                          ? 'Completion Date'
                          : 'Tanggal Kejadian'}
                    </label>
                    <input
                      id="mov-date"
                      type="date"
                      value={occurredDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOccurredDate(val);
                        if (
                          movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE &&
                          item.maintenanceIntervalDays > 0 &&
                          val
                        ) {
                          setNextMaintenanceDate(
                            addDaysToIsoDate(val, item.maintenanceIntervalDays),
                          );
                        }
                      }}
                      className="sa-input min-h-10 w-full px-3 font-mono text-xs text-[#151515]"
                    />
                  </div>
                )}
              </div>
            )}

            {movementType === INVENTORY_MOVEMENT_TYPES.RETURN_FROM_MAINTENANCE ? (
              <div>
                <label htmlFor="mov-next-maint" className="mb-1 block font-medium text-[#46433D]">
                  Next Maintenance Date (Opsional)
                </label>
                <input
                  id="mov-next-maint"
                  type="date"
                  value={nextMaintenanceDate}
                  onChange={(e) => setNextMaintenanceDate(e.target.value)}
                  className="sa-input min-h-10 w-full px-3 font-mono text-xs text-[#151515]"
                />
              </div>
            ) : null}

            {usesPresetReason ? (
              <div className="space-y-2">
                <div>
                  <label
                    htmlFor="mov-reason-sel"
                    className="mb-1 block font-semibold text-[#151515]"
                  >
                    Reason <span className="text-[#FF4B22]">*</span>
                  </label>
                  <select
                    id="mov-reason-sel"
                    value={reasonSelect}
                    onChange={(e) => setReasonSelect(e.target.value)}
                    className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                  >
                    {reasonPresetOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {reasonSelect === 'Other' ? (
                  <input
                    type="text"
                    aria-label="Keterangan reason lainnya"
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Tuliskan alasan detail..."
                    className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                  />
                ) : null}
              </div>
            ) : !isLocationChange && movementType !== INVENTORY_MOVEMENT_TYPES.STOCK_IN ? (
              <div>
                <label htmlFor="mov-reason-txt" className="mb-1 block font-semibold text-[#151515]">
                  {movementType === INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE
                    ? 'Maintenance Reason'
                    : movementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED
                      ? 'Damage Reason'
                      : 'Alasan (Opsional)'}
                  {movementType === INVENTORY_MOVEMENT_TYPES.SEND_TO_MAINTENANCE ||
                  movementType === INVENTORY_MOVEMENT_TYPES.MARK_DAMAGED ? (
                    <span className="text-[#FF4B22]"> *</span>
                  ) : null}
                </label>
                <input
                  id="mov-reason-txt"
                  type="text"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder="Contoh: Kabel putus / suara serak / ganti switch"
                  className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="mov-notes" className="mb-1 block font-semibold text-[#151515]">
                {movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED
                  ? 'Repair Note (Wajib)'
                  : movementType === INVENTORY_MOVEMENT_TYPES.STOCK_IN
                    ? 'Notes / Reference (Opsional)'
                    : 'Notes (Opsional)'}
                {movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED ? (
                  <span className="text-[#FF4B22]"> *</span>
                ) : null}
              </label>
              <textarea
                id="mov-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  movementType === INVENTORY_MOVEMENT_TYPES.MARK_REPAIRED
                    ? 'Jelaskan tindakan perbaikan yang telah dilakukan...'
                    : 'Catatan sesi/band, nomor nota restock, atau keterangan tambahan...'
                }
                className="sa-input w-full px-3 py-2 text-xs text-[#151515]"
              />
            </div>

            {/* Live Before / After Balance Preview */}
            <div className="sa-panel-ivory space-y-1.5 p-3">
              <p className="text-[11px] font-semibold text-[#46433D]">
                Pratinjau Perubahan ({isLocationChange ? 'Lokasi' : 'Saldo Stok'})
              </p>
              {previewResult.ok ? (
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold text-[#151515]">
                  <span className="rounded-md bg-white px-2 py-1 ring-1 ring-[#151515]/10">
                    {isLocationChange
                      ? previewResult.transition.locationBefore?.locationLabel
                      : isEquipment
                        ? formatEquipmentBucketSummary(previewResult.transition.balanceBefore)
                        : `${formatInventoryQuantity(previewResult.transition.balanceBefore.onHandQuantity)} ${unitLabel}`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#FF4B22]" aria-hidden="true" />
                  <span className="rounded-md bg-[#EDF8C2] px-2 py-1 text-[#243300] ring-1 ring-[#8BAD12]/35">
                    {isLocationChange
                      ? previewResult.transition.locationAfter?.locationLabel
                      : isEquipment
                        ? formatEquipmentBucketSummary(previewResult.transition.balanceAfter)
                        : `${formatInventoryQuantity(previewResult.transition.balanceAfter.onHandQuantity)} ${unitLabel}`}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-[#B92B0C]">{previewResult.error}</p>
              )}
            </div>
          </form>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:px-5 sm:py-3.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              form="inventory-movement-form"
              disabled={isSubmitting || !previewResult.ok}
              className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Simpan Pergerakan</span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
