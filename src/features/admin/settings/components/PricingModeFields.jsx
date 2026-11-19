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
    <div className="space-y-3.5">
      <div>
        <span className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase">
          Pricing Model <span className="text-studio-orange">*</span>
        </span>

        {activeMode === PRICING_MODES.UNCONFIGURED ? (
          <p className="border-studio-ink mt-1.5 border bg-amber-100 px-3 py-2 text-xs font-bold">
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
                className={`flex min-h-12 cursor-pointer flex-col justify-center border-2 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'border-studio-ink bg-studio-lime text-studio-ink shadow-[2px_2px_0px_#151515]'
                    : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white'
                }`}
              >
                <span className="font-mono text-xs font-extrabold uppercase">{option.label}</span>
                <span className="text-studio-muted-ink mt-0.5 text-[11px] font-medium">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>

        {errors['pricing.mode'] ? (
          <p role="alert" className="text-studio-error-ink mt-1.5 text-xs font-bold">
            {errors['pricing.mode']}
          </p>
        ) : null}
      </div>

      {/* Mode A: HOURLY */}
      {activeMode === PRICING_MODES.HOURLY ? (
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="opt-hourly-rate"
              className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
            >
              Hourly Rate (IDR) <span className="text-studio-orange">*</span>
            </label>
            <span className="font-mono text-xs font-extrabold">
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
            className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
          />
          <p className="text-studio-muted-ink mt-1 text-[11px] font-medium">
            Dihitung proporsional akurat setiap kelipatan 30 menit (misal 2,5 jam = 2,5 &times;
            tarif per jam).
          </p>
          {errors['pricing.hourlyRate'] ? (
            <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
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
                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                >
                  Durasi (Menit) <span className="text-studio-orange">*</span>
                </label>
                <span className="font-mono text-[11px] font-bold">
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
                className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
              />
              {errors['pricing.durationMinutes'] ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors['pricing.durationMinutes']}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="opt-shift-base-price"
                className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
              >
                Base Price (IDR) <span className="text-studio-orange">*</span>
              </label>
              <input
                id="opt-shift-base-price"
                type="text"
                inputMode="numeric"
                value={pricing.basePrice ?? ''}
                onChange={(e) => handleField('basePrice', e.target.value.replace(/\D/g, ''))}
                placeholder="300000"
                className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
              />
              {errors['pricing.basePrice'] ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors['pricing.basePrice']}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="opt-shift-discount"
                className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
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
                className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
              />
              {errors['pricing.discountAmount'] || isShiftDiscountOverflow ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {errors['pricing.discountAmount'] || 'Diskon tidak boleh melebihi Base Price.'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="border-studio-ink bg-studio-ivory border p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-studio-muted-ink">Base Price</span>
              <span className="font-bold">{formatRupiah(fixedPreview.basePrice)}</span>
            </div>
            {fixedPreview.discountAmount > 0 ? (
              <div className="mt-1 flex justify-between text-emerald-800">
                <span>Diskon Paket</span>
                <span className="font-bold">-{formatRupiah(fixedPreview.discountAmount)}</span>
              </div>
            ) : null}
            <div className="border-studio-ink mt-1.5 flex justify-between border-t pt-1.5 text-sm font-extrabold">
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
                className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
              >
                Project Price (IDR) <span className="text-studio-orange">*</span>
              </label>
              <span className="font-mono text-xs font-extrabold">
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
              className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold"
            />
            {errors['pricing.projectPrice'] ? (
              <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                {errors['pricing.projectPrice']}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="opt-project-unit-label"
              className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
            >
              Unit / Scope Label <span className="text-studio-muted-ink">(Opsional)</span>
            </label>
            <input
              id="opt-project-unit-label"
              type="text"
              value={pricing.unitLabel ?? ''}
              onChange={(e) => handleField('unitLabel', e.target.value)}
              placeholder="Contoh: Per Lagu / Per Project"
              className="border-studio-ink bg-studio-ivory text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 text-sm font-semibold"
            />
          </div>
        </div>
      ) : null}

      {/* Mode D: MANUAL QUOTE */}
      {activeMode === PRICING_MODES.MANUAL_QUOTE ? (
        <div className="border-studio-ink bg-studio-ivory border p-3 text-xs leading-relaxed font-medium">
          <p className="font-mono text-[11px] font-extrabold uppercase">
            Mode Manual Quote (Custom Pricing)
          </p>
          <p className="text-studio-muted-ink mt-1">
            Harga customer tidak dikunci di Settings dan wajib diisi secara manual (&gt; Rp 0) pada
            saat booking dibuat. Automatic discount tidak diterapkan secara default pada Manual
            Quote.
          </p>
        </div>
      ) : null}
    </div>
  );
}
