import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[100dvh] w-full max-w-2xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[92dvh] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Sticky Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                  {serviceType?.name || 'SERVICE'}
                </span>
                <span className="inline-block border border-neutral-600 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-200 uppercase">
                  {deliveryMode === DELIVERY_MODES.WFA ? 'WFA' : 'STUDIO'}
                </span>
              </div>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black tracking-tight text-white uppercase">
                {mode === 'edit' ? 'Edit Subcategory' : 'Add Subcategory'}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close subcategory dialog"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Scrollable Grouped Body */}
          <form
            id="service-option-dialog-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
          >
            {/* 01. BASIC INFORMATION */}
            <section className="border-studio-ink bg-studio-white space-y-3 border-2 p-3.5 sm:p-4">
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                  01 • BASIC INFORMATION
                </span>
                <h4 className="font-display text-studio-ink text-xl font-black uppercase">
                  Identitas Subcategory
                </h4>
              </div>

              <div>
                <label
                  htmlFor="opt-name"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Subcategory Name <span className="text-studio-orange">*</span>
                </label>
                <input
                  id="opt-name"
                  type="text"
                  value={formValues.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Contoh: Reguler / Paket 6 Hours / Lite / Pro"
                  className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
                />
                {errors.name ? (
                  <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="opt-description"
                  className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
                >
                  Description
                </label>
                <input
                  id="opt-description"
                  type="text"
                  value={formValues.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Keterangan singkat subcategory..."
                  className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-medium"
                />
              </div>

              <label className="border-studio-ink bg-studio-ivory flex cursor-pointer items-center justify-between border p-2.5">
                <div>
                  <span className="block font-mono text-xs font-extrabold uppercase">
                    Active Status
                  </span>
                  <span className="text-studio-muted-ink block text-[11px]">
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
                  className="accent-studio-ink h-5 w-5 cursor-pointer disabled:cursor-not-allowed"
                />
              </label>
              {errors.isActive ? (
                <p role="alert" className="text-studio-error-ink text-xs font-bold">
                  {errors.isActive}
                </p>
              ) : null}
            </section>

            {/* 02. CUSTOMER PRICING */}
            <section className="border-studio-ink bg-studio-white space-y-3 border-2 p-3.5 sm:p-4">
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                  02 • CUSTOMER PRICING
                </span>
                <h4 className="font-display text-studio-ink text-xl font-black uppercase">
                  Tarif Customer
                </h4>
              </div>

              <PricingModeFields
                deliveryMode={deliveryMode}
                pricing={formValues.pricing}
                errors={errors}
                onChangePricing={handlePricingChange}
              />
            </section>

            {/* 03. INTERNAL FEES */}
            <section className="border-studio-ink bg-studio-white space-y-3 border-2 p-3.5 sm:p-4">
              <div className="border-b border-neutral-200 pb-2">
                <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                  03 • INTERNAL FEES (TERPISAH DARI TAGIHAN CUSTOMER)
                </span>
                <h4 className="font-display text-studio-ink text-xl font-black uppercase">
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
              <section className="border-studio-ink bg-studio-white space-y-3 border-2 p-3.5 sm:p-4">
                <div className="border-b border-neutral-200 pb-2">
                  <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                    04 • DURATION DISCOUNT RULES (OPSIONAL)
                  </span>
                  <h4 className="font-display text-studio-ink text-xl font-black uppercase">
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
          <div className="border-studio-ink bg-studio-white flex shrink-0 items-center justify-end gap-2.5 border-t-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="brutal-btn bg-studio-ivory text-studio-ink min-h-11 flex-1 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase sm:flex-initial"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="service-option-dialog-form"
              className="brutal-btn bg-studio-orange text-studio-white min-h-11 flex-1 cursor-pointer px-5 py-2 font-mono text-xs font-extrabold uppercase sm:flex-initial"
            >
              {mode === 'edit' ? 'Update Subcategory' : 'Add Subcategory'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
