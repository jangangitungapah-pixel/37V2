import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import { validateRecordingOptionForm } from '../pricing/schemas/pricing-settings-schema';
import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';
import { generateSettingsItemId } from '../pricing/utils/normalize-pricing-settings';

export function RecordingOptionDialog({
  open,
  mode = 'add',
  initialItem = null,
  nextSortOrder = 1,
  onOpenChange,
  onSaveItem,
}) {
  const [formValues, setFormValues] = useState(() => ({
    id: initialItem?.id || '',
    name: initialItem?.name || '',
    description: initialItem?.description || '',
    priceMode: initialItem?.priceMode === 'fixed' ? 'fixed' : 'hourly',
    durationMinutes: initialItem?.durationMinutes > 0 ? String(initialItem.durationMinutes) : '180',
    price: initialItem?.price ? String(initialItem.price) : '',
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
    const isFixed = formValues.priceMode === 'fixed';
    const candidate = {
      id: mode === 'edit' && formValues.id ? formValues.id : generateSettingsItemId('rec'),
      name: String(formValues.name || '').trim(),
      description: String(formValues.description || '').trim(),
      priceMode: isFixed ? 'fixed' : 'hourly',
      durationMinutes: isFixed ? parseMoneyInput(formValues.durationMinutes) : 0,
      price: parseMoneyInput(formValues.price),
      isActive: Boolean(formValues.isActive),
      sortOrder: Number(formValues.sortOrder) || nextSortOrder,
    };

    const validation = validateRecordingOptionForm(candidate);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSaveItem(validation.data);
    onOpenChange(false);
  };

  const isFixedMode = formValues.priceMode === 'fixed';
  const parsedPrice = parseMoneyInput(formValues.price);
  const parsedDuration = parseMoneyInput(formValues.durationMinutes);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg -translate-y-1/2 flex-col border-2 shadow-[6px_6px_0px_#151515]"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-5 py-4">
            <div>
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                {mode === 'edit' ? 'EDIT RECORDING OPTION' : 'NEW RECORDING OPTION'}
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase">
                {mode === 'edit' ? 'Edit Recording Option' : 'Add Recording Option'}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close recording option dialog"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="recording-option-dialog-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          >
            <div>
              <label
                htmlFor="recording-option-name"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Recording Option Name <span className="text-studio-orange">*</span>
              </label>
              <input
                id="recording-option-name"
                type="text"
                value={formValues.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Contoh: Live Recording Full Band"
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
                htmlFor="recording-option-description"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Description
              </label>
              <input
                id="recording-option-description"
                type="text"
                value={formValues.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Keterangan singkat opsi recording..."
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                Pricing Mode <span className="text-studio-orange">*</span>
              </span>
              <div
                role="group"
                aria-label="Pilih model harga recording"
                className="mt-1.5 grid grid-cols-2 gap-2.5"
              >
                <button
                  type="button"
                  aria-pressed={!isFixedMode}
                  onClick={() => handleChange('priceMode', 'hourly')}
                  className={`min-h-11 cursor-pointer border-2 px-3 py-2 font-mono text-xs font-extrabold uppercase ${
                    !isFixedMode
                      ? 'border-studio-ink bg-studio-lime text-studio-ink'
                      : 'border-studio-ink bg-studio-white text-studio-ink'
                  }`}
                >
                  Hourly (Per Jam)
                </button>
                <button
                  type="button"
                  aria-pressed={isFixedMode}
                  onClick={() => handleChange('priceMode', 'fixed')}
                  className={`min-h-11 cursor-pointer border-2 px-3 py-2 font-mono text-xs font-extrabold uppercase ${
                    isFixedMode
                      ? 'border-studio-ink bg-studio-lime text-studio-ink'
                      : 'border-studio-ink bg-studio-white text-studio-ink'
                  }`}
                >
                  Fixed Shift
                </button>
              </div>
            </div>

            {isFixedMode ? (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="recording-option-duration"
                    className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                  >
                    Fixed Duration (Menit) <span className="text-studio-orange">*</span>
                  </label>
                  <span className="font-mono text-xs font-bold">
                    {parsedDuration >= 30 ? formatDurationMinutes(parsedDuration) : '-'}
                  </span>
                </div>
                <input
                  id="recording-option-duration"
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
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="recording-option-price"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  {isFixedMode ? 'Fixed Price (IDR)' : 'Hourly Rate (IDR)'}{' '}
                  <span className="text-studio-orange">*</span>
                </label>
                <span className="font-mono text-xs font-extrabold">
                  {isFixedMode ? formatRupiah(parsedPrice) : `${formatRupiah(parsedPrice)}/jam`}
                </span>
              </div>
              <input
                id="recording-option-price"
                type="text"
                inputMode="numeric"
                value={formValues.price}
                onChange={(e) => handleChange('price', e.target.value.replace(/\D/g, ''))}
                placeholder="150000"
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
              />
              {errors.price ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors.price}
                </p>
              ) : null}
            </div>

            <label className="border-studio-ink bg-studio-white flex cursor-pointer items-center justify-between border-2 p-3">
              <div>
                <span className="block font-mono text-xs font-extrabold uppercase">
                  Active Status
                </span>
                <span className="text-studio-muted-ink block text-xs">
                  Tampilkan saat user memilih layanan Recording
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
              form="recording-option-dialog-form"
              className="brutal-btn bg-studio-orange text-studio-white min-h-11 cursor-pointer px-5 py-2 font-mono text-xs font-extrabold uppercase"
            >
              {mode === 'edit' ? 'Update Option' : 'Add Option'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
