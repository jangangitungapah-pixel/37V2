import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  DELIVERY_MODES,
  FEE_MODES,
  PRICING_MODES,
} from '../pricing/config/default-pricing-settings';
import { validateServiceOptionForm } from '../pricing/schemas/pricing-settings-schema';
import { parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';
import { generateSettingsItemId } from '../pricing/utils/normalize-pricing-settings';
import { DiscountRulesEditor } from './DiscountRulesEditor';
import { InternalFeeEditor } from './InternalFeeEditor';
import { PricingModeFields } from './PricingModeFields';

function buildInitialOptionState(initialItem, deliveryMode, nextSortOrder) {
  const defaultMode =
    deliveryMode === DELIVERY_MODES.WFA ? PRICING_MODES.FIXED_PROJECT : PRICING_MODES.HOURLY;
  const pricing = initialItem?.pricing;
  const mode = pricing?.mode || defaultMode;

  return {
    id: initialItem?.id || '',
    name: initialItem?.name || '',
    description: initialItem?.description || '',
    isActive: initialItem
      ? mode === PRICING_MODES.UNCONFIGURED
        ? false
        : initialItem.isActive !== false
      : true,
    sortOrder: initialItem?.sortOrder || nextSortOrder,
    pricing: {
      mode,
      hourlyRate: pricing?.hourlyRate ? String(pricing.hourlyRate) : '',
      durationMinutes: pricing?.durationMinutes ? String(pricing.durationMinutes) : '180',
      basePrice: pricing?.basePrice ? String(pricing.basePrice) : '',
      discountAmount:
        pricing?.discountAmount !== undefined && pricing?.discountAmount !== null
          ? String(pricing.discountAmount)
          : '0',
      projectPrice: pricing?.projectPrice ? String(pricing.projectPrice) : '',
      unitLabel: pricing?.unitLabel || '',
    },
    discountRules: Array.isArray(initialItem?.discountRules)
      ? initialItem.discountRules.map((rule) => ({ ...rule }))
      : [],
    fees: {
      staff: {
        mode: initialItem?.fees?.staff?.mode || FEE_MODES.NONE,
        amount: String(initialItem?.fees?.staff?.amount ?? 0),
      },
      owner: {
        mode: initialItem?.fees?.owner?.mode || FEE_MODES.NONE,
        amount: String(initialItem?.fees?.owner?.amount ?? 0),
      },
      recordingOperator: {
        mode: initialItem?.fees?.recordingOperator?.mode || FEE_MODES.NONE,
        amount: String(initialItem?.fees?.recordingOperator?.amount ?? 0),
      },
    },
  };
}

export function ServiceOptionDialog({
  open,
  mode = 'add',
  serviceType,
  initialItem = null,
  nextSortOrder = 1,
  onOpenChange,
  onSaveItem,
}) {
  const deliveryMode = serviceType?.deliveryMode || DELIVERY_MODES.STUDIO;
  const [formValues, setFormValues] = useState(() =>
    buildInitialOptionState(initialItem, deliveryMode, nextSortOrder),
  );
  const [errors, setErrors] = useState({});

  const handleFieldChange = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePricingChange = (nextPricing) => {
    setFormValues((prev) => ({
      ...prev,
      pricing: nextPricing,
      // Auto-enable when Owner upgrades an unconfigured draft to a configured pricing mode
      isActive:
        prev.pricing.mode === PRICING_MODES.UNCONFIGURED &&
        nextPricing.mode !== PRICING_MODES.UNCONFIGURED
          ? true
          : prev.isActive,
      // Clear hourly discount rules when leaving Hourly mode
      discountRules: nextPricing.mode === PRICING_MODES.HOURLY ? prev.discountRules : [],
    }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith('pricing') || key === 'discountRules' || key === 'isActive') {
          delete next[key];
        }
      });
      return next;
    });
  };

  const handleFeesChange = (nextFees) => {
    setFormValues((prev) => ({ ...prev, fees: nextFees }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith('fees')) delete next[key];
      });
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const p = formValues.pricing;
    const pricingMode = p.mode;

    let normalizedPricing;
    if (pricingMode === PRICING_MODES.HOURLY) {
      normalizedPricing = {
        mode: PRICING_MODES.HOURLY,
        hourlyRate: parseMoneyInput(p.hourlyRate),
        durationMinutes: null,
        basePrice: null,
        discountAmount: 0,
        projectPrice: null,
        unitLabel: '',
      };
    } else if (pricingMode === PRICING_MODES.FIXED_SHIFT) {
      normalizedPricing = {
        mode: PRICING_MODES.FIXED_SHIFT,
        hourlyRate: null,
        durationMinutes: Number(p.durationMinutes) || 0,
        basePrice: parseMoneyInput(p.basePrice),
        discountAmount: parseMoneyInput(p.discountAmount),
        projectPrice: null,
        unitLabel: '',
      };
    } else if (pricingMode === PRICING_MODES.FIXED_PROJECT) {
      normalizedPricing = {
        mode: PRICING_MODES.FIXED_PROJECT,
        hourlyRate: null,
        durationMinutes: null,
        basePrice: null,
        discountAmount: 0,
        projectPrice: parseMoneyInput(p.projectPrice),
        unitLabel: String(p.unitLabel || '').trim(),
      };
    } else if (pricingMode === PRICING_MODES.MANUAL_QUOTE) {
      normalizedPricing = {
        mode: PRICING_MODES.MANUAL_QUOTE,
        hourlyRate: null,
        durationMinutes: null,
        basePrice: null,
        discountAmount: 0,
        projectPrice: null,
        unitLabel: '',
      };
    } else {
      normalizedPricing = {
        mode: PRICING_MODES.UNCONFIGURED,
        hourlyRate: null,
        durationMinutes: p.durationMinutes ? Number(p.durationMinutes) || null : null,
        basePrice: null,
        discountAmount: 0,
        projectPrice: null,
        unitLabel: '',
      };
    }

    const buildRoleFee = (roleFee) => {
      const roleMode = roleFee?.mode || FEE_MODES.NONE;
      return {
        mode: roleMode,
        amount:
          roleMode === FEE_MODES.FIXED || roleMode === FEE_MODES.HOURLY
            ? parseMoneyInput(roleFee.amount)
            : 0,
      };
    };

    const candidate = {
      id: mode === 'edit' && formValues.id ? formValues.id : generateSettingsItemId('opt'),
      name: String(formValues.name || '').trim(),
      description: String(formValues.description || '').trim(),
      isActive: pricingMode === PRICING_MODES.UNCONFIGURED ? false : Boolean(formValues.isActive),
      sortOrder: Number(formValues.sortOrder) || nextSortOrder,
      pricing: normalizedPricing,
      discountRules:
        pricingMode === PRICING_MODES.HOURLY
          ? formValues.discountRules.map((rule, idx) => ({
              ...rule,
              sortOrder: idx + 1,
            }))
          : [],
      fees: {
        staff: buildRoleFee(formValues.fees.staff),
        owner: buildRoleFee(formValues.fees.owner),
        recordingOperator: buildRoleFee(formValues.fees.recordingOperator),
      },
    };

    const validation = validateServiceOptionForm(candidate, deliveryMode);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSaveItem(validation.data);
    onOpenChange(false);
  };

  const isHourly = formValues.pricing.mode === PRICING_MODES.HOURLY;
  const isUnconfigured = formValues.pricing.mode === PRICING_MODES.UNCONFIGURED;

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
            className="sa-dialog flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3.5 backdrop-blur-md sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone="lime" size="sm" className="font-mono uppercase">
                    {serviceType?.name || 'SERVICE'}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ink" size="sm" className="font-mono uppercase">
                    {deliveryMode === DELIVERY_MODES.WFA ? 'WFA' : 'STUDIO'}
                  </AdminStatusBadge>
                </div>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  {mode === 'edit' ? 'Edit Subcategory' : 'Add Subcategory'}
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Close subcategory dialog"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Scrollable Grouped Body */}
            <form
              id="service-option-dialog-form"
              onSubmit={handleSubmit}
              noValidate
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-[#F8F6EF]/50 p-3.5 sm:space-y-4 sm:p-5"
            >
              {/* 01. BASIC INFORMATION */}
              <section className="sa-subcard space-y-3 p-4">
                <div className="border-b border-[#151515]/[0.07] pb-2.5">
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-[#FF4B22] uppercase">
                    01 • Basic Information
                  </span>
                  <h4 className="mt-0.5 text-sm font-bold text-[#151515]">Identitas Subcategory</h4>
                </div>

                <div>
                  <label htmlFor="opt-name" className="block text-xs font-semibold text-[#151515]">
                    Subcategory Name <span className="text-[#FF4B22]">*</span>
                  </label>
                  <input
                    id="opt-name"
                    type="text"
                    value={formValues.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="Contoh: Reguler / Paket 6 Hours / Lite / Pro"
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
                    htmlFor="opt-description"
                    className="block text-xs font-semibold text-[#151515]"
                  >
                    Description
                  </label>
                  <input
                    id="opt-description"
                    type="text"
                    value={formValues.description}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Keterangan singkat subcategory..."
                    className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 text-sm"
                  />
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
                  <div>
                    <span className="block text-xs font-semibold text-[#151515]">
                      Active Status
                    </span>
                    <span className="block text-[11px] text-[#666159]">
                      {isUnconfigured
                        ? 'Pilih model harga terlebih dahulu untuk mengaktifkan subcategory ini'
                        : 'Tampilkan sebagai pilihan booking aktif'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={isUnconfigured}
                    checked={isUnconfigured ? false : formValues.isActive}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    className="accent-studio-ink h-4.5 w-4.5 cursor-pointer disabled:cursor-not-allowed"
                  />
                </label>
                {errors.isActive ? (
                  <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                    {errors.isActive}
                  </p>
                ) : null}
              </section>

              {/* 02. CUSTOMER PRICING */}
              <section className="sa-subcard space-y-3 p-4">
                <div className="border-b border-[#151515]/[0.07] pb-2.5">
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-[#FF4B22] uppercase">
                    02 • Customer Pricing
                  </span>
                  <h4 className="mt-0.5 text-sm font-bold text-[#151515]">Tarif Customer</h4>
                </div>

                <PricingModeFields
                  deliveryMode={deliveryMode}
                  pricing={formValues.pricing}
                  errors={errors}
                  onChangePricing={handlePricingChange}
                />
              </section>

              {/* 03. INTERNAL FEES */}
              <section className="sa-subcard space-y-3 p-4">
                <div className="border-b border-[#151515]/[0.07] pb-2.5">
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-[#FF4B22] uppercase">
                    03 • Internal Fees (Terpisah Dari Tagihan Customer)
                  </span>
                  <h4 className="mt-0.5 text-sm font-bold text-[#151515]">
                    Alokasi Staff, Owner &amp; Operator
                  </h4>
                </div>

                <InternalFeeEditor
                  fees={formValues.fees}
                  deliveryMode={deliveryMode}
                  serviceTypeId={serviceType?.id || ''}
                  errors={errors}
                  onChangeFees={handleFeesChange}
                />
              </section>

              {/* 04. DISCOUNT RULES (HOURLY ONLY) */}
              {isHourly ? (
                <section className="sa-subcard space-y-3 p-4">
                  <div className="border-b border-[#151515]/[0.07] pb-2.5">
                    <span className="font-mono text-[10px] font-semibold tracking-wider text-[#FF4B22] uppercase">
                      04 • Duration Discount Rules (Opsional)
                    </span>
                    <h4 className="mt-0.5 text-sm font-bold text-[#151515]">
                      Aturan Diskon Durasi
                    </h4>
                  </div>

                  <DiscountRulesEditor
                    discountRules={formValues.discountRules}
                    errors={errors}
                    onChangeRules={(nextRules) => handleFieldChange('discountRules', nextRules)}
                  />
                </section>
              ) : null}
            </form>

            {/* Sticky Footer */}
            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="sa-control sa-btn-secondary min-h-10 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="service-option-dialog-form"
                className="sa-control sa-btn-orange min-h-10 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial sm:px-5"
              >
                {mode === 'edit' ? 'Update Subcategory' : 'Add Subcategory'}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
