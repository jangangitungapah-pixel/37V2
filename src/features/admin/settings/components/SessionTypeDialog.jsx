import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import {
  DEFAULT_DURATION_DISCOUNT_AMOUNT,
  DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
} from '../pricing/config/default-pricing-settings';
import { validateSessionTypeForm } from '../pricing/schemas/pricing-settings-schema';
import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';
import {
  generateSettingsItemId,
  normalizeDurationDiscountConfig,
} from '../pricing/utils/normalize-pricing-settings';

export function SessionTypeDialog({
  open,
  mode = 'add',
  initialItem = null,
  nextSortOrder = 1,
  onOpenChange,
  onSaveItem,
}) {
  const initialDurationDiscount = normalizeDurationDiscountConfig(initialItem?.durationDiscount);

  const [formValues, setFormValues] = useState(() => ({
    id: initialItem?.id || '',
    name: initialItem?.name || '',
    description: initialItem?.description || '',
    hourlyRate: initialItem?.hourlyRate ? String(initialItem.hourlyRate) : '',
    durationDiscountEnabled: initialDurationDiscount.enabled,
    durationDiscountIntervalMinutes: String(
      initialDurationDiscount.intervalMinutes || DEFAULT_DURATION_DISCOUNT_INTERVAL_MINUTES,
    ),
    durationDiscountAmount: String(
      initialItem?.durationDiscount
        ? initialDurationDiscount.discountAmount
        : DEFAULT_DURATION_DISCOUNT_AMOUNT,
    ),
    isActive: initialItem ? initialItem.isActive !== false : true,
    sortOrder: initialItem?.sortOrder || nextSortOrder,
  }));

  const [errors, setErrors] = useState({});

  const clearFieldError = (...keys) => {
    setErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const handleChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
      if (field === 'durationDiscountIntervalMinutes') {
        clearFieldError(field, 'durationDiscount.intervalMinutes', 'durationDiscount');
      } else if (field === 'durationDiscountAmount') {
        clearFieldError(field, 'durationDiscount.discountAmount', 'durationDiscount');
      } else if (field === 'durationDiscountEnabled') {
        clearFieldError(
          'durationDiscount',
          'durationDiscount.intervalMinutes',
          'durationDiscount.discountAmount',
        );
      } else {
        clearFieldError(field);
      }
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      const rawInterval = String(formValues.durationDiscountIntervalMinutes ?? '').trim();
      const rawDiscountAmount = String(formValues.durationDiscountAmount ?? '').trim();

      const parsedInterval = rawInterval ? Number(rawInterval) : 0;
      const parsedDiscountAmount = rawDiscountAmount ? parseMoneyInput(rawDiscountAmount) : 0;

      const candidate = {
        id: mode === 'edit' && formValues.id ? formValues.id : generateSettingsItemId('session'),
        name: String(formValues.name || '').trim(),
        description: String(formValues.description || '').trim(),
        hourlyRate: parseMoneyInput(formValues.hourlyRate),
        durationDiscount: {
          enabled: Boolean(formValues.durationDiscountEnabled),
          intervalMinutes: parsedInterval,
          discountAmount: parsedDiscountAmount,
        },
        isActive: Boolean(formValues.isActive),
        sortOrder: Number(formValues.sortOrder) || nextSortOrder,
      };

      const validation = validateSessionTypeForm(candidate);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      onSaveItem(validation.data);
      onOpenChange(false);
    };

    const parsedRate = parseMoneyInput(formValues.hourlyRate);
    const parsedIntervalPreview = Number(formValues.durationDiscountIntervalMinutes) || 0;
    const parsedDiscountPreview = parseMoneyInput(formValues.durationDiscountAmount);

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
                  {mode === 'edit' ? 'EDIT SESSION TYPE' : 'NEW SESSION TYPE'}
                </span>
                <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase">
                  {mode === 'edit' ? 'Edit Session Type' : 'Add Session Type'}
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Close session type dialog"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="session-type-dialog-form"
              onSubmit={handleSubmit}
              noValidate
              className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
            >
              <div>
                <label
                  htmlFor="session-type-name"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Session Name <span className="text-studio-orange">*</span>
                </label>
                <input
                  id="session-type-name"
                  type="text"
                  value={formValues.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Contoh: Podcast / Vocal Overdub"
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
                  htmlFor="session-type-description"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Description
                </label>
                <input
                  id="session-type-description"
                  type="text"
                  value={formValues.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Deskripsi singkat layanan studio..."
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium"
                />
                {errors.description ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.description}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="session-type-rate"
                    className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                  >
                    Hourly Rate (IDR) <span className="text-studio-orange">*</span>
                  </label>
                  <span className="font-mono text-xs font-extrabold">
                    {formatRupiah(parsedRate)}/jam
                  </span>
                </div>
                <input
                  id="session-type-rate"
                  type="text"
                  inputMode="numeric"
                  value={formValues.hourlyRate}
                  onChange={(e) => handleChange('hourlyRate', e.target.value.replace(/\D/g, ''))}
                  placeholder="100000"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                />
                {errors.hourlyRate ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.hourlyRate}
                  </p>
                ) : null}
              </div>

              {/* Duration-Based Automatic Discount Configuration (Owner Only) */}
              <div className="border-studio-ink bg-studio-white border-2 p-3.5">
                <label
                  htmlFor="session-type-duration-discount-enabled"
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <div>
                    <span className="block font-mono text-xs font-extrabold uppercase">
                      Enable Duration Discount
                    </span>
                    <span className="text-studio-muted-ink block text-xs">
                      Potongan otomatis setiap kelipatan durasi sesi reguler (tanpa kode promo/paket).
                    </span>
                  </div>
                  <input
                    id="session-type-duration-discount-enabled"
                    type="checkbox"
                    checked={formValues.durationDiscountEnabled}
                    onChange={(e) => handleChange('durationDiscountEnabled', e.target.checked)}
                    className="accent-studio-ink h-5 w-5 shrink-0 cursor-pointer"
                  />
                </label>

                {formValues.durationDiscountEnabled ? (
                  <div className="mt-3.5 space-y-3 border-t border-neutral-200 pt-3.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="session-type-duration-discount-interval"
                            className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                          >
                            Discount Interval (Menit) <span className="text-studio-orange">*</span>
                          </label>
                          <span className="font-mono text-[11px] font-bold">
                            {parsedIntervalPreview > 0
                              ? formatDurationMinutes(parsedIntervalPreview)
                              : '-'}
                          </span>
                        </div>
                        <input
                          id="session-type-duration-discount-interval"
                          type="number"
                          min={1}
                          step={30}
                          value={formValues.durationDiscountIntervalMinutes}
                          onChange={(e) =>
                            handleChange('durationDiscountIntervalMinutes', e.target.value)
                          }
                          placeholder="180"
                          className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                        />
                        {errors['durationDiscount.intervalMinutes'] ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors['durationDiscount.intervalMinutes']}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor="session-type-duration-discount-amount"
                            className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                          >
                            Discount Amount (IDR) <span className="text-studio-orange">*</span>
                          </label>
                          <span className="font-mono text-[11px] font-extrabold text-emerald-800">
                            -{formatRupiah(parsedDiscountPreview)}
                          </span>
                        </div>
                        <input
                          id="session-type-duration-discount-amount"
                          type="text"
                          inputMode="numeric"
                          value={formValues.durationDiscountAmount}
                          onChange={(e) =>
                            handleChange('durationDiscountAmount', e.target.value.replace(/\D/g, ''))
                          }
                          placeholder="30000"
                          className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
                        />
                        {errors['durationDiscount.discountAmount'] ? (
                          <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                            {errors['durationDiscount.discountAmount']}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {parsedIntervalPreview > 0 && parsedDiscountPreview > 0 ? (
                      <p className="border-studio-ink bg-studio-ivory text-studio-ink border px-2.5 py-2 font-mono text-[11px] font-semibold">
                        Aturan aktif: setiap kelipatan{' '}
                        <strong>{formatDurationMinutes(parsedIntervalPreview)}</strong> hemat{' '}
                        <strong className="text-emerald-800">
                          {formatRupiah(parsedDiscountPreview)}
                        </strong>{' '}
                        (misal {formatDurationMinutes(parsedIntervalPreview * 2)} hemat{' '}
                        {formatRupiah(parsedDiscountPreview * 2)}).
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <label className="border-studio-ink bg-studio-white flex cursor-pointer items-center justify-between border-2 p-3">
                <div>
                  <span className="block font-mono text-xs font-extrabold uppercase">
                    Active Status
                  </span>
                  <span className="text-studio-muted-ink block text-xs">
                    Tampilkan sebagai pilihan booking baru di Calendar
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
                form="session-type-dialog-form"
                className="brutal-btn bg-studio-orange text-studio-white min-h-11 cursor-pointer px-5 py-2 font-mono text-xs font-extrabold uppercase"
              >
                {mode === 'edit' ? 'Update Session' : 'Add Session'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }
