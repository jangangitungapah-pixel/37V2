import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import { validateStudioPackageForm } from '../pricing/schemas/pricing-settings-schema';
import {
  calculatePackageFinalPrice,
  formatRupiah,
  parseMoneyInput,
} from '../pricing/utils/calculate-pricing-settings';
import { generateSettingsItemId } from '../pricing/utils/normalize-pricing-settings';

export function StudioPackageDialog({
  open,
  mode = 'add',
  initialItem = null,
  sessionTypes = [],
  nextSortOrder = 1,
  onOpenChange,
  onSaveItem,
}) {
  const defaultSessionId = sessionTypes[0]?.id || 'rehearsal';

  const [formValues, setFormValues] = useState(() => ({
    id: initialItem?.id || '',
    name: initialItem?.name || '',
    detail: initialItem?.detail || '',
    sessionTypeId: initialItem?.sessionTypeId || defaultSessionId,
    durationMinutes: initialItem?.durationMinutes ? String(initialItem.durationMinutes) : '180',
    basePrice: initialItem?.basePrice ? String(initialItem.basePrice) : '',
    discountAmount:
      initialItem?.discountAmount !== undefined ? String(initialItem.discountAmount) : '0',
    staffCommissionAmount:
      initialItem?.staffCommissionAmount !== undefined
        ? String(initialItem.staffCommissionAmount)
        : '0',
    recordingOperatorCommissionAmount:
      initialItem?.recordingOperatorCommissionAmount !== undefined
        ? String(initialItem.recordingOperatorCommissionAmount)
        : '0',
    isActive: initialItem ? initialItem.isActive !== false : true,
    sortOrder: initialItem?.sortOrder || nextSortOrder,
  }));

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const candidate = {
      id: mode === 'edit' && formValues.id ? formValues.id : generateSettingsItemId('pkg'),
      name: String(formValues.name || '').trim(),
      detail: String(formValues.detail || '').trim(),
      sessionTypeId: String(formValues.sessionTypeId || '').trim(),
      durationMinutes: parseMoneyInput(formValues.durationMinutes),
      basePrice: parseMoneyInput(formValues.basePrice),
      discountAmount: parseMoneyInput(formValues.discountAmount),
      staffCommissionAmount: parseMoneyInput(formValues.staffCommissionAmount),
      recordingOperatorCommissionAmount: parseMoneyInput(
        formValues.recordingOperatorCommissionAmount,
      ),
      isActive: Boolean(formValues.isActive),
      sortOrder: Number(formValues.sortOrder) || nextSortOrder,
    };

    const validation = validateStudioPackageForm(candidate, sessionTypes);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSaveItem(validation.data);
    onOpenChange(false);
  };

  const parsedDuration = parseMoneyInput(formValues.durationMinutes);
  const parsedBasePrice = parseMoneyInput(formValues.basePrice);
  const parsedDiscount = parseMoneyInput(formValues.discountAmount);
  const preview = calculatePackageFinalPrice(parsedBasePrice, parsedDiscount);
  const isDiscountOverflow = parsedBasePrice > 0 && parsedDiscount > parsedBasePrice;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl -translate-y-1/2 flex-col border-2 shadow-[6px_6px_0px_#151515]"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-5 py-4">
            <div>
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                {mode === 'edit' ? 'EDIT STUDIO PACKAGE' : 'NEW STUDIO PACKAGE'}
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase">
                {mode === 'edit' ? 'Edit Studio Package' : 'Add Studio Package'}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close studio package dialog"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="studio-package-dialog-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          >
            <div>
              <label
                htmlFor="pkg-name"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Package Name <span className="text-studio-orange">*</span>
              </label>
              <input
                id="pkg-name"
                type="text"
                value={formValues.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Contoh: Paket Rehearsal 3 Jam"
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
              />
              {errors.name ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="pkg-detail"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Description / Detail
              </label>
              <input
                id="pkg-detail"
                type="text"
                value={formValues.detail}
                onChange={(e) => handleChange('detail', e.target.value)}
                placeholder="Contoh: Latihan 3 jam hemat Rp 30.000"
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="pkg-session-type"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Session Type <span className="text-studio-orange">*</span>
                </label>
                <select
                  id="pkg-session-type"
                  value={formValues.sessionTypeId}
                  onChange={(e) => handleChange('sessionTypeId', e.target.value)}
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-bold"
                >
                  {sessionTypes.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                      {session.isActive === false ? ' (Inactive)' : ''}
                    </option>
                  ))}
                </select>
                {errors.sessionTypeId ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.sessionTypeId}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="pkg-duration"
                    className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                  >
                    Duration (Menit) <span className="text-studio-orange">*</span>
                  </label>
                  <span className="font-mono text-xs font-bold">
                    {parsedDuration >= 30 ? formatDurationMinutes(parsedDuration) : '-'}
                  </span>
                </div>
                <input
                  id="pkg-duration"
                  type="number"
                  min={30}
                  step={30}
                  value={formValues.durationMinutes}
                  onChange={(e) => handleChange('durationMinutes', e.target.value)}
                  placeholder="180"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                />
                {errors.durationMinutes ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.durationMinutes}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="pkg-base-price"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Base Price / Subtotal (IDR) <span className="text-studio-orange">*</span>
                </label>
                <input
                  id="pkg-base-price"
                  type="text"
                  inputMode="numeric"
                  value={formValues.basePrice}
                  onChange={(e) => handleChange('basePrice', e.target.value.replace(/\D/g, ''))}
                  placeholder="300000"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                />
                {errors.basePrice ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.basePrice}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="pkg-discount-amount"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Package Discount (IDR)
                </label>
                <input
                  id="pkg-discount-amount"
                  type="text"
                  inputMode="numeric"
                  value={formValues.discountAmount}
                  onChange={(e) =>
                    handleChange('discountAmount', e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="30000"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                />
                {errors.discountAmount || isDiscountOverflow ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.discountAmount || 'Diskon paket tidak boleh melebihi harga paket.'}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Live Automatic Customer Price Preview */}
            <div className="border-studio-ink bg-studio-white border-2 p-3.5 font-mono text-xs">
              <p className="font-extrabold uppercase">Live Customer Price Preview</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-studio-muted-ink">Harga Paket</span>
                  <span className="font-bold">{formatRupiah(preview.basePrice)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Diskon</span>
                  <span className="font-bold">- {formatRupiah(preview.discountAmount)}</span>
                </div>
                <div className="border-studio-ink flex justify-between border-t pt-1.5 text-sm font-extrabold">
                  <span>Harga Akhir</span>
                  <span>{formatRupiah(preview.finalPrice)}</span>
                </div>
              </div>
            </div>

            {/* Internal Commission Configuration */}
            <div className="border-studio-ink bg-studio-white border-2 p-3.5">
              <p className="font-mono text-xs font-extrabold uppercase">
                Internal Package Commissions (Tidak Masuk Tagihan Customer)
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pkg-staff-commission"
                    className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                  >
                    Staff Commission (IDR)
                  </label>
                  <input
                    id="pkg-staff-commission"
                    type="text"
                    inputMode="numeric"
                    value={formValues.staffCommissionAmount}
                    onChange={(e) =>
                      handleChange('staffCommissionAmount', e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="0"
                    className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                  />
                  {errors.staffCommissionAmount ? (
                    <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                      {errors.staffCommissionAmount}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="pkg-operator-commission"
                    className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                  >
                    Recording Operator Commission (IDR)
                  </label>
                  <input
                    id="pkg-operator-commission"
                    type="text"
                    inputMode="numeric"
                    value={formValues.recordingOperatorCommissionAmount}
                    onChange={(e) =>
                      handleChange(
                        'recordingOperatorCommissionAmount',
                        e.target.value.replace(/\D/g, ''),
                      )
                    }
                    placeholder="0"
                    className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                  />
                  {errors.recordingOperatorCommissionAmount ? (
                    <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                      {errors.recordingOperatorCommissionAmount}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="border-studio-ink bg-studio-white flex cursor-pointer items-center justify-between border-2 p-3">
              <div>
                <span className="block font-mono text-xs font-extrabold uppercase">
                  Active Status
                </span>
                <span className="text-studio-muted-ink block text-xs">
                  Hanya paket aktif yang ditampilkan di Booking Form
                </span>
              </div>
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="accent-studio-ink h-5 w-5 cursor-pointer"
              />
            </label>
          </form>

          <div className="border-studio-ink bg-studio-white flex shrink-0 items-center justify-end gap-2.5 border-t-2 px-5 py-3.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="brutal-btn bg-studio-ivory text-studio-ink min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="studio-package-dialog-form"
              className="brutal-btn bg-studio-orange text-studio-white min-h-11 cursor-pointer px-5 py-2 font-mono text-xs font-extrabold uppercase"
            >
              {mode === 'edit' ? 'Update Package' : 'Add Package'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
