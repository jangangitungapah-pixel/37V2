import { useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck, X } from 'lucide-react';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  EQUIPMENT_ADJUSTMENT_BUCKETS,
  INVENTORY_ITEM_TYPES,
  INVENTORY_MOVEMENT_TYPES,
} from '../config/inventory-config';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';
import { computeInventoryMovementTransition } from '../utils/inventory-calculation';
import {
  formatEquipmentBucketSummary,
  formatInventoryQuantity,
  resolveUnitDisplayLabel,
  roundInventoryQuantity,
} from '../utils/inventory-format';

/**
 * Owner-only Stock Adjustment (Stock Opname) confirmation dialog.
 * Computes exact signed difference and requires explicit adjustment reason.
 */
export function InventoryAdjustmentDialog({
  open,
  item,
  isOwner = false,
  onOpenChange,
  onSubmitAdjustment,
}) {
  const [movementId] = useState(() => generateOperationId('mov'));
  const isEquipment = item?.itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;
  const [adjustmentBucket, setAdjustmentBucket] = useState('available');
  const [actualCountedQuantity, setActualCountedQuantity] = useState(() => {
    if (!item) return '0';
    return isEquipment
      ? String(item.equipmentStock?.availableQuantity ?? 0)
      : String(item.consumableStock?.onHandQuantity ?? 0);
  });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitLabel = item ? resolveUnitDisplayLabel(item.unit, item.customUnitLabel) : 'pcs';

  const currentQuantity = useMemo(() => {
    if (!item) return 0;
    if (!isEquipment) return roundInventoryQuantity(item.consumableStock?.onHandQuantity || 0);
    const eq = item.equipmentStock || {};
    if (adjustmentBucket === 'maintenance') return eq.maintenanceQuantity || 0;
    if (adjustmentBucket === 'damaged') return eq.damagedQuantity || 0;
    return eq.availableQuantity || 0;
  }, [item, isEquipment, adjustmentBucket]);

  const preview = useMemo(() => {
    if (!item) return { ok: false, error: '' };
    try {
      const transition = computeInventoryMovementTransition({
        item,
        movementType: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
        adjustmentBucket,
        actualCountedQuantity,
        reason,
      });
      const countedNum = Number(actualCountedQuantity);
      const signedDelta = isEquipment
        ? Math.round(countedNum - currentQuantity)
        : roundInventoryQuantity(countedNum - currentQuantity);
      return { ok: true, transition, signedDelta, error: '' };
    } catch (err) {
      return { ok: false, error: err?.message || 'Periksa kembali jumlah hitung fisik & alasan.' };
    }
  }, [item, adjustmentBucket, actualCountedQuantity, reason, isEquipment, currentQuantity]);

  if (!item) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleBucketChange = (nextBucket) => {
    setAdjustmentBucket(nextBucket);
    const eq = item.equipmentStock || {};
    const val =
      nextBucket === 'maintenance'
        ? eq.maintenanceQuantity || 0
        : nextBucket === 'damaged'
          ? eq.damagedQuantity || 0
          : eq.availableQuantity || 0;
    setActualCountedQuantity(String(val));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !isOwner) return;
    setSubmitError('');

    setIsSubmitting(true);
    try {
      await onSubmitAdjustment?.({
        itemId: item.id,
        movementId,
        expectedVersion: item.version,
        movementType: INVENTORY_MOVEMENT_TYPES.STOCK_ADJUSTMENT,
        adjustmentBucket,
        actualCountedQuantity: Number(actualCountedQuantity),
        reason,
        notes,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapInventoryErrorToMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          aria-label={`Stock adjustment ${item.name}`}
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-[22px]"
        >
          <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <AdminStatusBadge tone="ink" icon={ShieldCheck} size="sm">
                Owner Only • Stock Adjustment
              </AdminStatusBadge>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                Koreksi Stok Fisik ({item.name})
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog stock adjustment"
              disabled={isSubmitting}
              className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="inventory-adjustment-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 text-xs sm:px-5 sm:py-4"
          >
            {!isOwner ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Hanya Owner aktif yang diizinkan melakukan koreksi jumlah stok (Stock Adjustment).
                </span>
              </div>
            ) : null}

            {submitError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {isEquipment ? (
              <div>
                <label htmlFor="adj-bucket" className="mb-1 block font-semibold text-[#151515]">
                  Bucket yang Dikoreksi
                </label>
                <select
                  id="adj-bucket"
                  value={adjustmentBucket}
                  onChange={(e) => handleBucketChange(e.target.value)}
                  className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                >
                  {EQUIPMENT_ADJUSTMENT_BUCKETS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sa-panel p-3">
                <p className="text-[11px] font-medium text-[#666159]">Catatan Aplikasi Saat Ini</p>
                <p className="mt-1 font-mono text-base font-bold text-[#151515]">
                  {formatInventoryQuantity(currentQuantity, item.itemType)} {unitLabel}
                </p>
              </div>

              <div>
                <label htmlFor="adj-counted" className="mb-1 block font-semibold text-[#151515]">
                  Actual Counted Quantity <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="adj-counted"
                  type="number"
                  min="0"
                  step={isEquipment ? '1' : '0.001'}
                  value={actualCountedQuantity}
                  onChange={(e) => setActualCountedQuantity(e.target.value)}
                  className="sa-input min-h-10 w-full px-3 font-mono text-sm font-bold text-[#151515]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adj-reason" className="mb-1 block font-semibold text-[#151515]">
                Alasan Koreksi (Reason) <span className="text-[#FF4B22]">*</span>
              </label>
              <input
                id="adj-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Stock opname bulanan ditemukan selisih fisik"
                className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
              />
            </div>

            <div>
              <label htmlFor="adj-notes" className="mb-1 block font-medium text-[#46433D]">
                Notes Tambahan (Opsional)
              </label>
              <textarea
                id="adj-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detail pemeriksaan opname..."
                className="sa-input w-full px-3 py-2 text-xs text-[#151515]"
              />
            </div>

            <div className="sa-panel-ivory space-y-1.5 p-3">
              <p className="text-[11px] font-semibold text-[#46433D]">Before / After Preview</p>
              {preview.ok ? (
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
                  <span className="rounded-md bg-white px-2 py-1 text-[#151515] ring-1 ring-[#151515]/10">
                    {isEquipment
                      ? formatEquipmentBucketSummary(preview.transition.balanceBefore)
                      : `${formatInventoryQuantity(preview.transition.balanceBefore.onHandQuantity)} ${unitLabel}`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#FF4B22]" aria-hidden="true" />
                  <span className="rounded-md bg-[#EDF8C2] px-2 py-1 text-[#243300] ring-1 ring-[#8BAD12]/35">
                    {isEquipment
                      ? formatEquipmentBucketSummary(preview.transition.balanceAfter)
                      : `${formatInventoryQuantity(preview.transition.balanceAfter.onHandQuantity)} ${unitLabel}`}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 ${
                      preview.signedDelta > 0
                        ? 'bg-[#E6F6EC] text-[#0F6246]'
                        : 'bg-[#FFEDE8] text-[#B92B0C]'
                    }`}
                  >
                    Selisih: {preview.signedDelta > 0 ? '+' : '-'}
                    {formatInventoryQuantity(Math.abs(preview.signedDelta), item.itemType)}{' '}
                    {unitLabel}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-[#B92B0C]">{preview.error}</p>
              )}
            </div>
          </form>

          <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="sa-control sa-btn-secondary min-h-10 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial"
            >
              Batal
            </button>
            <button
              type="submit"
              form="inventory-adjustment-form"
              disabled={!isOwner || isSubmitting || !preview.ok}
              className="sa-control sa-btn-orange inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50 sm:flex-initial"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>Konfirmasi Adjustment</span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
