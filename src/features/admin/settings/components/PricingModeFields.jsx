import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import { DELIVERY_MODES, PRICING_MODES } from '../pricing/config/default-pricing-settings';
import {
  calculatePackageFinalPrice,
  formatRupiah,
  parseMoneyInput,
} from '../pricing/utils/calculate-pricing-settings';

const STUDIO_PRICING_MODES = [
  {
    id: PRICING_MODES.HOURLY,
    label: 'Hourly',
    hint: 'Tarif per jam × durasi',
  },
  {
    id: PRICING_MODES.FIXED_SHIFT,
    label: 'Fixed Shift',
    hint: 'Paket durasi & harga tetap',
  },
  {
    id: PRICING_MODES.MANUAL_QUOTE,
    label: 'Manual Quote',
    hint: 'Input harga saat booking',
  },
];

const WFA_PRICING_MODES = [
  {
    id: PRICING_MODES.HOURLY,
    label: 'Hourly',
    hint: 'Tarif per jam estimasi',
  },
  {
    id: PRICING_MODES.FIXED_PROJECT,
    label: 'Fixed Project',
    hint: 'Harga tetap per lagu/project',
  },
  {
    id: PRICING_MODES.MANUAL_QUOTE,
    label: 'Manual Quote',
    hint: 'Input harga saat order',
  },
];

export function PricingModeFields({
  deliveryMode = DELIVERY_MODES.STUDIO,
  pricing,
  errors = {},
  onChangePricing,
}) {
  const modeOptions =
    deliveryMode === DELIVERY_MODES.WFA ? WFA_PRICING_MODES : STUDIO_PRICING_MODES;
  const activeMode = pricing?.mode || PRICING_MODES.UNCONFIGURED;

  const handleSelectMode = (nextMode) => {
    if (nextMode === activeMode) return;
    if (nextMode === PRICING_MODES.HOURLY) {
      onChangePricing({
        mode: PRICING_MODES.HOURLY,
        hourlyRate: pricing?.hourlyRate ? String(pricing.hourlyRate) : '',
        durationMinutes: '',
        basePrice: '',
        discountAmount: '0',
        projectPrice: '',
        unitLabel: '',
      });
    } else if (nextMode === PRICING_MODES.FIXED_SHIFT) {
      onChangePricing({
        mode: PRICING_MODES.FIXED_SHIFT,
        hourlyRate: '',
        durationMinutes: pricing?.durationMinutes ? String(pricing.durationMinutes) : '180',
        basePrice: pricing?.basePrice ? String(pricing.basePrice) : '',
        discountAmount: pricing?.discountAmount ? String(pricing.discountAmount) : '0',
        projectPrice: '',
        unitLabel: '',
      });
    } else if (nextMode === PRICING_MODES.FIXED_PROJECT) {
      onChangePricing({
        mode: PRICING_MODES.FIXED_PROJECT,
        hourlyRate: '',
        durationMinutes: '',
        basePrice: '',
        discountAmount: '0',
        projectPrice: pricing?.projectPrice ? String(pricing.projectPrice) : '',
        unitLabel: pricing?.unitLabel || 'Per Lagu',
      });
    } else if (nextMode === PRICING_MODES.MANUAL_QUOTE) {
      onChangePricing({
        mode: PRICING_MODES.MANUAL_QUOTE,
        hourlyRate: '',
        durationMinutes: '',
        basePrice: '',
        discountAmount: '0',
        projectPrice: '',
        unitLabel: '',
      });
    }
  };

  const handleField = (field, value) => {
    onChangePricing({
      ...pricing,
      [field]: value,
    });
  };

  const parsedHourly = parseMoneyInput(pricing?.hourlyRate);
  const parsedDuration = parseMoneyInput(pricing?.durationMinutes);
  const parsedBasePrice = parseMoneyInput(pricing?.basePrice);
  const parsedShiftDiscount = parseMoneyInput(pricing?.discountAmount);
  const parsedProjectPrice = parseMoneyInput(pricing?.projectPrice);
  const fixedPreview = calculatePackageFinalPrice(parsedBasePrice, parsedShiftDiscount);
  const isShiftDiscountOverflow = parsedBasePrice > 0 && parsedShiftDiscount > parsedBasePrice;

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-xs font-semibold text-[#151515]">
          Pricing Model <span className="text-[#FF4B22]">*</span>
        </span>

        {activeMode === PRICING_MODES.UNCONFIGURED ? (
          <p className="mt-2 rounded-xl border border-amber-500/25 bg-[#FEF4DD] px-3.5 py-2.5 text-xs text-[#8A4B08]">
            Subcategory ini masih berstatus <strong>Belum Dikonfigurasi</strong>. Pilih salah satu
            model harga di bawah untuk mulai mengonfigurasi tarif.
          </p>
        ) : null}

        <div
          role="group"
          aria-label="Pilih model harga customer"
          className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {modeOptions.map((option) => {
            const isSelected = activeMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectMode(option.id)}
                className={`flex min-h-13 cursor-pointer flex-col justify-center rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#8BAD12]/50 bg-[#EDF8C2] text-[#151515] shadow-xs'
                    : 'border-[#151515]/12 bg-[#FAF8F3] text-[#151515] hover:bg-white'
                }`}
              >
                <span className="text-xs font-bold">{option.label}</span>
                <span className="mt-0.5 text-[11px] text-[#666159]">{option.hint}</span>
              </button>
            );
          })}
        </div>

        {errors['pricing.mode'] ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-[#B92B0C]">
            {errors['pricing.mode']}
          </p>
        ) : null}
      </div>

      {/* Mode A: HOURLY */}
      {activeMode === PRICING_MODES.HOURLY ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="opt-hourly-rate" className="block text-xs font-semibold text-[#151515]">
              Hourly Rate (IDR) <span className="text-[#FF4B22]">*</span>
            </label>
            <span className="font-mono text-xs font-semibold text-[#46433D] tabular-nums">
              {formatRupiah(parsedHourly)}/jam
            </span>
          </div>
          <input
            id="opt-hourly-rate"
            type="text"
            inputMode="numeric"
            value={pricing.hourlyRate ?? ''}
            onChange={(e) => handleField('hourlyRate', e.target.value.replace(/\D/g, ''))}
            placeholder="100000"
            className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 font-mono text-sm font-semibold tabular-nums"
          />
          <p className="mt-1.5 text-[11px] text-[#666159]">
            Dihitung proporsional akurat setiap kelipatan 30 menit (misal 2,5 jam = 2,5 &times;
            tarif per jam).
          </p>
          {errors['pricing.hourlyRate'] ? (
            <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
              {errors['pricing.hourlyRate']}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Mode B: FIXED SHIFT */}
      {activeMode === PRICING_MODES.FIXED_SHIFT ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="flex items-center justify-between gap-1">
                <label
                  htmlFor="opt-shift-duration"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Durasi (Menit) <span className="text-[#FF4B22]">*</span>
                </label>
                <span className="font-mono text-[11px] text-[#666159]">
                  {parsedDuration >= 30 ? formatDurationMinutes(parsedDuration) : '-'}
                </span>
              </div>
              <input
                id="opt-shift-duration"
                type="number"
                min={30}
                step={30}
                value={pricing.durationMinutes ?? ''}
                onChange={(e) => handleField('durationMinutes', e.target.value)}
                placeholder="180"
                className="sa-input mt-1.5 min-h-10.5 w-full px-3 py-2 font-mono text-sm font-semibold tabular-nums"
              />
              {errors['pricing.durationMinutes'] ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  {errors['pricing.durationMinutes']}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="opt-shift-base-price"
                className="block text-xs font-semibold text-[#151515]"
              >
                Base Price (IDR) <span className="text-[#FF4B22]">*</span>
              </label>
              <input
                id="opt-shift-base-price"
                type="text"
                inputMode="numeric"
                value={pricing.basePrice ?? ''}
                onChange={(e) => handleField('basePrice', e.target.value.replace(/\D/g, ''))}
                placeholder="300000"
                className="sa-input mt-1.5 min-h-10.5 w-full px-3 py-2 font-mono text-sm font-semibold tabular-nums"
              />
              {errors['pricing.basePrice'] ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  {errors['pricing.basePrice']}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="opt-shift-discount"
                className="block text-xs font-semibold text-[#151515]"
              >
                Discount (IDR)
              </label>
              <input
                id="opt-shift-discount"
                type="text"
                inputMode="numeric"
                value={pricing.discountAmount ?? '0'}
                onChange={(e) => handleField('discountAmount', e.target.value.replace(/\D/g, ''))}
                placeholder="30000"
                className="sa-input mt-1.5 min-h-10.5 w-full px-3 py-2 font-mono text-sm font-semibold tabular-nums"
              />
              {errors['pricing.discountAmount'] || isShiftDiscountOverflow ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  {errors['pricing.discountAmount'] || 'Diskon tidak boleh melebihi Base Price.'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="sa-panel-ivory p-3.5 font-mono text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-[#666159]">Base Price</span>
              <span className="font-semibold text-[#151515]">
                {formatRupiah(fixedPreview.basePrice)}
              </span>
            </div>
            {fixedPreview.discountAmount > 0 ? (
              <div className="mt-1 flex justify-between text-[#0F6246]">
                <span>Diskon Paket</span>
                <span className="font-semibold">-{formatRupiah(fixedPreview.discountAmount)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-[#151515]/10 pt-2 text-sm font-bold text-[#151515]">
              <span>Final Customer Price</span>
              <span>{formatRupiah(fixedPreview.finalPrice)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mode C: FIXED PROJECT (WFA only) */}
      {activeMode === PRICING_MODES.FIXED_PROJECT ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="opt-project-price"
                className="block text-xs font-semibold text-[#151515]"
              >
                Project Price (IDR) <span className="text-[#FF4B22]">*</span>
              </label>
              <span className="font-mono text-xs font-semibold text-[#46433D] tabular-nums">
                {formatRupiah(parsedProjectPrice)}
              </span>
            </div>
            <input
              id="opt-project-price"
              type="text"
              inputMode="numeric"
              value={pricing.projectPrice ?? ''}
              onChange={(e) => handleField('projectPrice', e.target.value.replace(/\D/g, ''))}
              placeholder="500000"
              className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 font-mono text-sm font-semibold tabular-nums"
            />
            {errors['pricing.projectPrice'] ? (
              <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                {errors['pricing.projectPrice']}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="opt-project-unit-label"
              className="block text-xs font-semibold text-[#151515]"
            >
              Unit / Scope Label <span className="font-normal text-[#666159]">(Opsional)</span>
            </label>
            <input
              id="opt-project-unit-label"
              type="text"
              value={pricing.unitLabel ?? ''}
              onChange={(e) => handleField('unitLabel', e.target.value)}
              placeholder="Contoh: Per Lagu / Per Project"
              className="sa-input mt-1.5 min-h-10.5 w-full px-3.5 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}

      {/* Mode D: MANUAL QUOTE */}
      {activeMode === PRICING_MODES.MANUAL_QUOTE ? (
        <div className="sa-panel-ivory p-3.5 text-xs leading-relaxed">
          <p className="font-semibold text-[#151515]">Mode Manual Quote (Custom Pricing)</p>
          <p className="mt-1 text-[#666159]">
            Harga customer tidak dikunci di Settings dan wajib diisi secara manual (&gt; Rp 0) pada
            saat booking dibuat. Automatic discount tidak diterapkan secara default pada Manual
            Quote.
          </p>
        </div>
      ) : null}
    </div>
  );
}
