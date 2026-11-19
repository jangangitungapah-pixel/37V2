import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';

import {
  DISCOUNT_RULE_MODES,
  FEE_MODES,
  PRICING_MODES,
} from '../pricing/config/default-pricing-settings';
import {
  formatOptionPricingSummary,
  formatRupiah,
} from '../pricing/utils/calculate-pricing-settings';
import { SettingsItemActions, SettingsStatusToggle } from './SettingsSectionCard';

function buildFeeBadges(fees = {}) {
  const badges = [];
  const entries = [
    { key: 'staff', label: 'Staff' },
    { key: 'owner', label: 'Owner' },
    { key: 'recordingOperator', label: 'Operator' },
  ];

  for (const entry of entries) {
    const rule = fees?.[entry.key];
    if (!rule || rule.mode === FEE_MODES.NONE) continue;
    if (rule.mode === FEE_MODES.MANUAL) {
      badges.push(`${entry.label}: Manual`);
    } else if (rule.mode === FEE_MODES.FIXED && rule.amount > 0) {
      badges.push(`${entry.label}: ${formatRupiah(rule.amount)}`);
    } else if (rule.mode === FEE_MODES.HOURLY && rule.amount > 0) {
      badges.push(`${entry.label}: ${formatRupiah(rule.amount)}/jam`);
    }
  }
  return badges;
}

export function ServiceOptionList({
  options = [],
  readOnly = false,
  onEditOption,
  onToggleOptionActive,
  onRequestDeleteOption,
}) {
  if (options.length === 0) {
    return (
      <div className="border-studio-ink bg-studio-ivory border border-dashed p-4 text-center font-mono text-xs">
        Belum ada subcategory pada layanan ini.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {options.map((option) => {
        const priceSummary = formatOptionPricingSummary(option);
        const isUnconfigured = option.pricing?.mode === PRICING_MODES.UNCONFIGURED;
        const feeBadges = buildFeeBadges(option.fees);
        const activeDiscounts = (option.discountRules || []).filter((r) => r.isActive !== false);

        return (
          <article
            key={option.id}
            className={`border-studio-ink border-2 p-3 sm:p-3.5 ${
              option.isActive && !isUnconfigured
                ? 'bg-studio-white'
                : 'bg-studio-ivory/70 opacity-90'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="font-display text-studio-ink text-xl leading-none font-black uppercase">
                    {option.name}
                  </h4>

                  {option.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
                  option.pricing?.durationMinutes ? (
                    <span className="border-studio-ink bg-studio-ivory border px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                      {formatDurationMinutes(option.pricing.durationMinutes)}
                    </span>
                  ) : null}

                  {isUnconfigured ? (
                    <span className="border-studio-ink text-studio-ink border bg-amber-200 px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                      Draft • Belum Dikonfigurasi
                    </span>
                  ) : null}
                </div>

                {option.description ? (
                  <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed font-medium">
                    {option.description}
                  </p>
                ) : null}

                {/* Concise Fee & Discount Metadata Tags */}
                {feeBadges.length > 0 || activeDiscounts.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    {activeDiscounts.map((rule) => (
                      <span
                        key={rule.id}
                        className="border-studio-ink border bg-emerald-100 px-1.5 py-0.5 font-extrabold text-emerald-900"
                      >
                        {rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
                          ? `Diskon -${formatRupiah(rule.discountAmount)} / ${formatDurationMinutes(rule.intervalMinutes)}`
                          : `${rule.name}: -${formatRupiah(rule.discountAmount)} (min. ${formatDurationMinutes(rule.minimumDurationMinutes)})`}
                      </span>
                    ))}

                    {feeBadges.map((badge) => (
                      <span
                        key={badge}
                        className="border-studio-ink bg-studio-ivory text-studio-ink border px-1.5 py-0.5 font-bold"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Price Summary & Controls */}
              <div className="flex flex-col items-start gap-2.5 sm:items-end">
                <div className="sm:text-right">
                  <span
                    className={`inline-block border px-2.5 py-1 font-mono text-xs font-extrabold whitespace-nowrap ${
                      isUnconfigured
                        ? 'border-studio-ink text-studio-ink bg-amber-100'
                        : option.pricing?.mode === PRICING_MODES.MANUAL_QUOTE
                          ? 'border-studio-ink bg-studio-ink text-studio-lime'
                          : 'border-studio-ink bg-studio-ivory text-studio-ink'
                    }`}
                  >
                    {priceSummary.primary}
                  </span>
                  {priceSummary.secondary ? (
                    <span className="text-studio-muted-ink mt-1 block font-mono text-[10px] font-semibold">
                      {priceSummary.secondary}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SettingsStatusToggle
                    isActive={option.isActive}
                    label={option.name}
                    disabled={readOnly || isUnconfigured}
                    onToggle={() => onToggleOptionActive(option)}
                  />
                  <SettingsItemActions
                    itemName={option.name}
                    readOnly={readOnly}
                    onEdit={() => onEditOption(option)}
                    onDelete={() => onRequestDeleteOption(option)}
                  />
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
