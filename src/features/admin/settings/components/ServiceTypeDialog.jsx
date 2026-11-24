import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-calendar-scoped="true"
            className="sa-dialog flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="lime" size="sm" className="font-mono uppercase">
                  {mode === 'edit' ? 'Edit Service Type' : 'New Service Type'}
                </AdminStatusBadge>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  {mode === 'edit' ? 'Edit Service Type' : 'Add Service Type'}
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Close service type dialog"
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="service-type-dialog-form"
              onSubmit={handleSubmit}
              noValidate
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white p-4 sm:space-y-4 sm:p-5"
            >
              <div>
                <label
                  htmlFor="service-type-name"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Service Name <span className="text-[#FF4B22]">*</span>
                </label>
                <input
                  id="service-type-name"
                  type="text"
                  value={formValues.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Contoh: Podcast / Vocal Booth / Mixing"
                  className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 text-sm font-medium"
                />
                {errors.name ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="service-type-description"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Description
                </label>
                <input
                  id="service-type-description"
                  type="text"
                  value={formValues.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Deskripsi singkat layanan..."
                  className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 text-sm"
                />
                {errors.description ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {errors.description}
                  </p>
                ) : null}
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#151515]">
                  Delivery Mode <span className="text-[#FF4B22]">*</span>
                </span>
                <div
                  role="group"
                  aria-label="Pilih delivery mode"
                  className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                >
                  <button
                    type="button"
                    aria-pressed={formValues.deliveryMode === DELIVERY_MODES.STUDIO}
                    onClick={() => handleChange('deliveryMode', DELIVERY_MODES.STUDIO)}
                    className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border p-3 text-left transition-all ${
                      formValues.deliveryMode === DELIVERY_MODES.STUDIO
                        ? 'border-[#8BAD12]/50 bg-[#EDF8C2] text-[#151515] shadow-xs'
                        : 'border-[#151515]/12 bg-[#FAF8F3] text-[#151515] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold">Studio Session</span>
                    <span className="mt-0.5 text-[11px] text-[#666159]">
                      Memakai ruangan &amp; jadwal Room A / Room B
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={formValues.deliveryMode === DELIVERY_MODES.WFA}
                    onClick={() => handleChange('deliveryMode', DELIVERY_MODES.WFA)}
                    className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border p-3 text-left transition-all ${
                      formValues.deliveryMode === DELIVERY_MODES.WFA
                        ? 'border-[#151515] bg-[#151515] text-white shadow-sm'
                        : 'border-[#151515]/12 bg-[#FAF8F3] text-[#151515] hover:bg-white'
                    }`}
                  >
                    <span className="text-xs font-bold">WFA Service</span>
                    <span
                      className={`mt-0.5 text-[11px] ${
                        formValues.deliveryMode === DELIVERY_MODES.WFA
                          ? 'text-neutral-300'
                          : 'text-[#666159]'
                      }`}
                    >
                      Work From Anywhere (tidak mengunci jadwal studio)
                    </span>
                  </button>
                </div>
                {errors.options || errors.deliveryMode ? (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-[#B92B0C]">
                    {errors.options || errors.deliveryMode}
                  </p>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3.5">
                <div>
                  <span className="block text-xs font-semibold text-[#151515]">Active Status</span>
                  <span className="block text-xs text-[#666159]">
                    Hanya layanan Studio aktif yang tampil di Calendar Booking Form
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formValues.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="accent-studio-ink h-4.5 w-4.5 cursor-pointer"
                />
              </label>
            </form>

            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:px-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="sa-control sa-btn-secondary min-h-11 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="service-type-dialog-form"
                className="sa-control sa-btn-orange min-h-11 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial sm:px-5"
              >
                {mode === 'edit' ? 'Update Service' : 'Add Service'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
