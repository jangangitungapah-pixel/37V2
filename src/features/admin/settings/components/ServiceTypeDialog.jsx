import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { DELIVERY_MODES } from '../pricing/config/default-pricing-settings';
import { validateServiceTypeForm } from '../pricing/schemas/pricing-settings-schema';
import { generateSettingsItemId } from '../pricing/utils/normalize-pricing-settings';

export function ServiceTypeDialog({
  open,
  mode = 'add',
  initialItem = null,
  defaultDeliveryMode = DELIVERY_MODES.STUDIO,
  nextSortOrder = 1,
  onOpenChange,
  onSaveItem,
}) {
  const [formValues, setFormValues] = useState(() => ({
    id: initialItem?.id || '',
    name: initialItem?.name || '',
    description: initialItem?.description || '',
    deliveryMode: initialItem?.deliveryMode || defaultDeliveryMode,
    isActive: initialItem ? initialItem.isActive !== false : true,
    sortOrder: initialItem?.sortOrder || nextSortOrder,
    options: Array.isArray(initialItem?.options) ? initialItem.options : [],
  }));

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field] || errors.form) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        delete next.form;
        return next;
      });
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const candidate = {
      id: mode === 'edit' && formValues.id ? formValues.id : generateSettingsItemId('svc'),
      name: String(formValues.name || '').trim(),
      description: String(formValues.description || '').trim(),
      deliveryMode: formValues.deliveryMode,
      isActive: Boolean(formValues.isActive),
      sortOrder: Number(formValues.sortOrder) || nextSortOrder,
      options: formValues.options,
    };

    const validation = validateServiceTypeForm(candidate);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSaveItem(validation.data);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[100dvh] w-full max-w-lg flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[92dvh] sm:-translate-y-1/2 sm:border-2"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-5 py-4">
            <div>
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                {mode === 'edit' ? 'EDIT SERVICE TYPE' : 'NEW SERVICE TYPE'}
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase">
                {mode === 'edit' ? 'Edit Service Type' : 'Add Service Type'}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close service type dialog"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="service-type-dialog-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          >
            <div>
              <label
                htmlFor="service-type-name"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Service Name <span className="text-studio-orange">*</span>
              </label>
              <input
                id="service-type-name"
                type="text"
                value={formValues.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Contoh: Podcast / Vocal Booth / Mixing"
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
                htmlFor="service-type-description"
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Description
              </label>
              <input
                id="service-type-description"
                type="text"
                value={formValues.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Deskripsi singkat layanan..."
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium"
              />
              {errors.description ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors.description}
                </p>
              ) : null}
            </div>

            <div>
              <span className="text-studio-ink block font-mono text-xs font-extrabold uppercase">
                Delivery Mode <span className="text-studio-orange">*</span>
              </span>
              <div
                role="group"
                aria-label="Pilih delivery mode"
                className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <button
                  type="button"
                  aria-pressed={formValues.deliveryMode === DELIVERY_MODES.STUDIO}
                  onClick={() => handleChange('deliveryMode', DELIVERY_MODES.STUDIO)}
                  className={`flex min-h-14 cursor-pointer flex-col justify-center border-2 p-3 text-left transition-colors ${
                    formValues.deliveryMode === DELIVERY_MODES.STUDIO
                      ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                      : 'border-studio-ink bg-studio-white text-studio-ink'
                  }`}
                >
                  <span className="font-mono text-xs font-extrabold uppercase">Studio Session</span>
                  <span className="text-studio-muted-ink mt-0.5 text-[11px]">
                    Memakai ruangan &amp; jadwal Room A / Room B
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={formValues.deliveryMode === DELIVERY_MODES.WFA}
                  onClick={() => handleChange('deliveryMode', DELIVERY_MODES.WFA)}
                  className={`flex min-h-14 cursor-pointer flex-col justify-center border-2 p-3 text-left transition-colors ${
                    formValues.deliveryMode === DELIVERY_MODES.WFA
                      ? 'border-studio-ink bg-studio-ink text-studio-lime shadow-[2px_2px_0px_#151515]'
                      : 'border-studio-ink bg-studio-white text-studio-ink'
                  }`}
                >
                  <span className="font-mono text-xs font-extrabold uppercase">WFA Service</span>
                  <span
                    className={`mt-0.5 text-[11px] ${
                      formValues.deliveryMode === DELIVERY_MODES.WFA
                        ? 'text-neutral-300'
                        : 'text-studio-muted-ink'
                    }`}
                  >
                    Work From Anywhere (tidak mengunci jadwal studio)
                  </span>
                </button>
              </div>
              {errors.options || errors.deliveryMode ? (
                <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
                  {errors.options || errors.deliveryMode}
                </p>
              ) : null}
            </div>

            <label className="border-studio-ink bg-studio-white flex cursor-pointer items-center justify-between border-2 p-3">
              <div>
                <span className="block font-mono text-xs font-extrabold uppercase">
                  Active Status
                </span>
                <span className="text-studio-muted-ink block text-xs">
                  Hanya layanan Studio aktif yang tampil di Calendar Booking Form
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
              form="service-type-dialog-form"
              className="brutal-btn bg-studio-orange text-studio-white min-h-11 cursor-pointer px-5 py-2 font-mono text-xs font-extrabold uppercase"
            >
              {mode === 'edit' ? 'Update Service' : 'Add Service'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
