import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Boxes, Info, Loader2, X } from 'lucide-react';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  INVENTORY_CATEGORIES,
  INVENTORY_ITEM_TYPE_OPTIONS,
  INVENTORY_ITEM_TYPES,
  INVENTORY_LOCATIONS,
  INVENTORY_UNITS,
} from '../config/inventory-config';
import {
  validateInventoryItemCreateInput,
  validateInventoryItemEditInput,
} from '../schemas/inventory-schema';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';
import { suggestNextItemCode } from '../utils/inventory-calculation';

/**
 * Reusable Create / Edit Metadata Dialog for Consumables & Equipment.
 * Edit mode strictly locks Item Type and never edits current stock quantities directly.
 */
export function InventoryItemDialog({
  open,
  mode = 'create',
  item = null,
  existingItems = [],
  onOpenChange,
  onSubmitCreate,
  onSubmitEdit,
}) {
  const isEdit = mode === 'edit' && Boolean(item);

  // Stable pre-generated IDs per dialog session for idempotent retries
  const [operationIds] = useState(() => ({
    itemId: generateOperationId('inv'),
    openingMovementId: generateOperationId('mov'),
    locationMovementId: generateOperationId('mov'),
  }));

  const [itemType, setItemType] = useState(() =>
    isEdit ? item.itemType : INVENTORY_ITEM_TYPES.CONSUMABLE,
  );
  const [name, setName] = useState(() => (isEdit ? item.name : ''));
  const [itemCode, setItemCode] = useState(() =>
    isEdit ? item.itemCode : suggestNextItemCode(existingItems),
  );
  const [categoryId, setCategoryId] = useState(() =>
    isEdit ? item.categoryId : INVENTORY_CATEGORIES[0].id,
  );
  const [unit, setUnit] = useState(() => (isEdit ? item.unit : 'pcs'));
  const [customUnitLabel, setCustomUnitLabel] = useState(() =>
    isEdit ? item.customUnitLabel || '' : '',
  );
  const [locationId, setLocationId] = useState(() => (isEdit ? item.locationId : 'storage'));
  const [customLocationLabel, setCustomLocationLabel] = useState(() =>
    isEdit && item.locationId === 'other' ? item.locationLabel || '' : '',
  );
  const [brand, setBrand] = useState(() => (isEdit ? item.brand || '' : ''));
  const [model, setModel] = useState(() => (isEdit ? item.model || '' : ''));
  const [minimumStockQuantity, setMinimumStockQuantity] = useState(() =>
    isEdit ? String(item.minimumStockQuantity ?? 0) : '5',
  );
  const [minimumAvailableQuantity, setMinimumAvailableQuantity] = useState(() =>
    isEdit ? String(item.minimumAvailableQuantity ?? 0) : '1',
  );
  const [openingQuantity, setOpeningQuantity] = useState('0');
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState(() =>
    isEdit ? item.lastMaintenanceDate || '' : '',
  );
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState(() =>
    isEdit ? item.nextMaintenanceDate || '' : '',
  );
  const [maintenanceIntervalDays, setMaintenanceIntervalDays] = useState(() =>
    isEdit && item.maintenanceIntervalDays ? String(item.maintenanceIntervalDays) : '',
  );
  const [notes, setNotes] = useState(() => (isEdit ? item.notes || '' : ''));

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEquipment = itemType === INVENTORY_ITEM_TYPES.EQUIPMENT;

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setSubmitError('');

    const payload = {
      name,
      itemCode,
      itemType,
      categoryId,
      unit,
      customUnitLabel,
      locationId,
      customLocationLabel,
      brand,
      model,
      minimumStockQuantity,
      minimumAvailableQuantity,
      openingQuantity: isEdit ? 0 : openingQuantity,
      lastMaintenanceDate,
      nextMaintenanceDate,
      maintenanceIntervalDays,
      notes,
    };

    const validation = isEdit
      ? validateInventoryItemEditInput(payload, item)
      : validateInventoryItemCreateInput(payload);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await onSubmitEdit?.({
          itemId: item.id,
          expectedVersion: item.version,
          locationMovementId: operationIds.locationMovementId,
          input: payload,
        });
      } else {
        await onSubmitCreate?.({
          itemId: operationIds.itemId,
          openingMovementId: operationIds.openingMovementId,
          input: payload,
        });
      }
      onOpenChange?.(false);
    } catch (err) {
      if (err?.details && typeof err.details === 'object') {
        setFieldErrors(err.details);
      }
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
          aria-label={isEdit ? `Edit metadata ${item.name}` : 'Tambah item inventory baru'}
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Compact Header */}
          <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AdminStatusBadge tone="lime" icon={Boxes} size="sm">
                  {isEdit ? 'Edit Metadata Barang' : 'Barang Inventory Baru'}
                </AdminStatusBadge>
              </div>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                {isEdit ? `Edit ${item.name}` : 'Tambah Barang Inventory'}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog item inventory"
              disabled={isSubmitting}
              className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] sm:h-9 sm:w-9 sm:rounded-xl"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Scrollable Form Body */}
          <form
            id="inventory-item-form"
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

            {isEdit ? (
              <div className="sa-panel-ivory flex items-start gap-2 px-3 py-2.5 text-[11px] text-[#46433D]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
                <span>
                  Form ini hanya mengubah informasi dasar &amp; jadwal. Perubahan jumlah stok wajib
                  dicatat melalui <strong className="text-[#151515]">Record Movement</strong>.
                </span>
              </div>
            ) : (
              <div>
                <span className="mb-1.5 block font-semibold text-[#151515]">
                  Item Type <span className="text-[#FF4B22]">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {INVENTORY_ITEM_TYPE_OPTIONS.map((opt) => {
                    const selected = itemType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setItemType(opt.id);
                          setUnit(opt.id === INVENTORY_ITEM_TYPES.EQUIPMENT ? 'unit' : 'pcs');
                        }}
                        className={`sa-control cursor-pointer rounded-xl p-2.5 text-left transition-all ${
                          selected
                            ? 'border-[#151515] bg-[#EDF8C2]/60 ring-1 ring-[#151515]'
                            : 'bg-[#FAF8F3] text-[#46433D]'
                        }`}
                      >
                        <p className="font-semibold text-[#151515]">{opt.label}</p>
                        <p className="mt-0.5 text-[10.5px] leading-snug text-[#666159]">
                          {opt.id === INVENTORY_ITEM_TYPES.CONSUMABLE
                            ? 'Barang habis pakai'
                            : 'Alat berulang & servis'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="inv-item-name" className="mb-1 block font-semibold text-[#151515]">
                  Item Name <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="inv-item-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isEquipment ? 'Contoh: Shure SM58 Microphone' : 'Contoh: Guitar Strings 010'
                  }
                  className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515] sm:text-sm"
                />
                {fieldErrors.name ? (
                  <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">{fieldErrors.name}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="inv-item-code" className="mb-1 block font-semibold text-[#151515]">
                  Item Code <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="inv-item-code"
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value.toUpperCase())}
                  placeholder="INV-001"
                  className="sa-input min-h-10 w-full px-3 font-mono text-xs font-semibold text-[#151515] uppercase"
                />
                {fieldErrors.itemCode ? (
                  <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                    {fieldErrors.itemCode}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-category" className="mb-1 block font-semibold text-[#151515]">
                  Category <span className="text-[#FF4B22]">*</span>
                </label>
                <select
                  id="inv-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                >
                  {INVENTORY_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.categoryId ? (
                  <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                    {fieldErrors.categoryId}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="inv-unit" className="mb-1 block font-semibold text-[#151515]">
                  Unit <span className="text-[#FF4B22]">*</span>
                </label>
                <select
                  id="inv-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                >
                  {INVENTORY_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.unit ? (
                  <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">{fieldErrors.unit}</p>
                ) : null}
              </div>
            </div>

            {unit === 'other' ? (
              <div>
                <label
                  htmlFor="inv-custom-unit"
                  className="mb-1 block font-semibold text-[#151515]"
                >
                  Custom Unit Label <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="inv-custom-unit"
                  type="text"
                  value={customUnitLabel}
                  onChange={(e) => setCustomUnitLabel(e.target.value)}
                  placeholder="Contoh: sachet, kaleng, pasang"
                  className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                />
                {fieldErrors.customUnitLabel ? (
                  <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                    {fieldErrors.customUnitLabel}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-location" className="mb-1 block font-semibold text-[#151515]">
                  Location <span className="text-[#FF4B22]">*</span>
                </label>
                <select
                  id="inv-location"
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
                    htmlFor="inv-custom-location"
                    className="mb-1 block font-semibold text-[#151515]"
                  >
                    Custom Location <span className="text-[#FF4B22]">*</span>
                  </label>
                  <input
                    id="inv-custom-location"
                    type="text"
                    value={customLocationLabel}
                    onChange={(e) => setCustomLocationLabel(e.target.value)}
                    placeholder="Contoh: Meja Resepsionis / Gudang Atas"
                    className="sa-input min-h-10 w-full px-3 text-xs font-medium text-[#151515]"
                  />
                  {fieldErrors.customLocationLabel ? (
                    <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                      {fieldErrors.customLocationLabel}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="inv-brand" className="mb-1 block font-medium text-[#46433D]">
                      Brand (Opsional)
                    </label>
                    <input
                      id="inv-brand"
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Shure, Fender..."
                      className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-model" className="mb-1 block font-medium text-[#46433D]">
                      Model (Opsional)
                    </label>
                    <input
                      id="inv-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="SM58 / 010"
                      className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                    />
                  </div>
                </div>
              )}
            </div>

            {locationId === 'other' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="inv-brand-alt" className="mb-1 block font-medium text-[#46433D]">
                    Brand (Opsional)
                  </label>
                  <input
                    id="inv-brand-alt"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Shure, Fender..."
                    className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                  />
                </div>
                <div>
                  <label htmlFor="inv-model-alt" className="mb-1 block font-medium text-[#46433D]">
                    Model (Opsional)
                  </label>
                  <input
                    id="inv-model-alt"
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="SM58 / 010"
                    className="sa-input min-h-10 w-full px-3 text-xs text-[#151515]"
                  />
                </div>
              </div>
            ) : null}

            {/* Stock / Threshold Section */}
            <div className="sa-panel space-y-3 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!isEquipment ? (
                  <div>
                    <label
                      htmlFor="inv-min-stock"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      Minimum Stock Threshold
                    </label>
                    <input
                      id="inv-min-stock"
                      type="number"
                      min="0"
                      step="0.001"
                      value={minimumStockQuantity}
                      onChange={(e) => setMinimumStockQuantity(e.target.value)}
                      className="sa-input min-h-10 w-full px-3 font-mono text-xs font-semibold text-[#151515]"
                    />
                    {fieldErrors.minimumStockQuantity ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.minimumStockQuantity}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="inv-min-avail"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      Minimum Available Quantity
                    </label>
                    <input
                      id="inv-min-avail"
                      type="number"
                      min="0"
                      step="1"
                      value={minimumAvailableQuantity}
                      onChange={(e) => setMinimumAvailableQuantity(e.target.value)}
                      className="sa-input min-h-10 w-full px-3 font-mono text-xs font-semibold text-[#151515]"
                    />
                    {fieldErrors.minimumAvailableQuantity ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.minimumAvailableQuantity}
                      </p>
                    ) : null}
                  </div>
                )}

                {!isEdit ? (
                  <div>
                    <label
                      htmlFor="inv-opening-qty"
                      className="mb-1 block font-semibold text-[#151515]"
                    >
                      {isEquipment ? 'Opening Available Quantity' : 'Opening Quantity (Opsional)'}
                    </label>
                    <input
                      id="inv-opening-qty"
                      type="number"
                      min="0"
                      step={isEquipment ? '1' : '0.001'}
                      value={openingQuantity}
                      onChange={(e) => setOpeningQuantity(e.target.value)}
                      className="sa-input min-h-10 w-full px-3 font-mono text-xs font-semibold text-[#151515]"
                    />
                    <p className="mt-1 text-[10.5px] text-[#666159]">
                      Jika &gt; 0, otomatis mencatat movement Opening Stock.
                    </p>
                    {fieldErrors.openingQuantity ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.openingQuantity}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isEquipment ? (
                <div className="grid grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="inv-last-maint"
                      className="mb-1 block font-medium text-[#46433D]"
                    >
                      Last Maintenance
                    </label>
                    <input
                      id="inv-last-maint"
                      type="date"
                      value={lastMaintenanceDate}
                      onChange={(e) => setLastMaintenanceDate(e.target.value)}
                      className="sa-input min-h-9.5 w-full px-2.5 font-mono text-xs text-[#151515]"
                    />
                    {fieldErrors.lastMaintenanceDate ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.lastMaintenanceDate}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="inv-next-maint"
                      className="mb-1 block font-medium text-[#46433D]"
                    >
                      Next Maintenance
                    </label>
                    <input
                      id="inv-next-maint"
                      type="date"
                      value={nextMaintenanceDate}
                      onChange={(e) => setNextMaintenanceDate(e.target.value)}
                      className="sa-input min-h-9.5 w-full px-2.5 font-mono text-xs text-[#151515]"
                    />
                    {fieldErrors.nextMaintenanceDate ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.nextMaintenanceDate}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="inv-maint-interval"
                      className="mb-1 block font-medium text-[#46433D]"
                    >
                      Interval (Hari)
                    </label>
                    <input
                      id="inv-maint-interval"
                      type="number"
                      min="1"
                      max="3650"
                      step="1"
                      placeholder="Misal: 90"
                      value={maintenanceIntervalDays}
                      onChange={(e) => setMaintenanceIntervalDays(e.target.value)}
                      className="sa-input min-h-9.5 w-full px-2.5 font-mono text-xs text-[#151515]"
                    />
                    {fieldErrors.maintenanceIntervalDays ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.maintenanceIntervalDays}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="inv-notes" className="mb-1 block font-medium text-[#46433D]">
                Notes (Opsional)
              </label>
              <textarea
                id="inv-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan lokasi rak, spesifikasi, atau keterangan tambahan..."
                className="sa-input w-full px-3 py-2 text-xs text-[#151515]"
              />
              {fieldErrors.notes ? (
                <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">{fieldErrors.notes}</p>
              ) : null}
            </div>
          </form>

          {/* Compact Sticky Footer */}
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
              form="inventory-item-form"
              disabled={isSubmitting}
              className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Barang'}</span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
