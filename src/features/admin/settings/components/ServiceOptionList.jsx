import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { AdminStatusBadge } from '@/features/admin/design-system';

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
      <div className="sa-panel border-dashed p-5 text-center text-xs text-[#666159]">
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
            className={`rounded-xl border border-[#151515]/[0.085] p-3 transition-colors sm:p-4 ${
              option.isActive && !isUnconfigured
                ? 'bg-white shadow-[0_1px_2px_rgba(21,21,21,0.03)]'
                : 'bg-[#F8F6EF]/70 opacity-85'
            }`}
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[15px] font-semibold tracking-tight text-[#151515]">
                    {option.name}
                  </h4>

                  {option.pricing?.mode === PRICING_MODES.FIXED_SHIFT &&
                  option.pricing?.durationMinutes ? (
                    <AdminStatusBadge tone="ivory" size="sm" className="font-mono">
                      {formatDurationMinutes(option.pricing.durationMinutes)}
                    </AdminStatusBadge>
                  ) : null}

                  {isUnconfigured ? (
                    <AdminStatusBadge tone="amber" size="sm">
                      Draft • Belum Dikonfigurasi
                    </AdminStatusBadge>
                  ) : null}
                </div>

                {option.description ? (
                  <p className="mt-1 hidden text-xs leading-relaxed text-[#666159] sm:block">
                    {option.description}
                  </p>
                ) : null}

                {/* Concise Fee & Discount Metadata Tags */}
                {feeBadges.length > 0 || activeDiscounts.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {activeDiscounts.map((rule) => (
                      <AdminStatusBadge
                        key={rule.id}
                        tone="emerald"
                        size="sm"
                        className="font-mono"
                      >
                        {rule.mode === DISCOUNT_RULE_MODES.PER_COMPLETED_BLOCK
                          ? `Diskon -${formatRupiah(rule.discountAmount)} / ${formatDurationMinutes(rule.intervalMinutes)}`
                          : `${rule.name}: -${formatRupiah(rule.discountAmount)} (min. ${formatDurationMinutes(rule.minimumDurationMinutes)})`}
                      </AdminStatusBadge>
                    ))}

                    {feeBadges.map((badge) => (
                      <AdminStatusBadge key={badge} tone="ivory" size="sm" className="font-mono">
                        {badge}
                      </AdminStatusBadge>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Price Summary & Controls */}
              <div className="flex flex-col items-start gap-2.5 sm:items-end">
                <div className="sm:text-right">
                  <span
                    className={`inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-bold whitespace-nowrap tabular-nums ${
                      isUnconfigured
                        ? 'border-amber-500/25 bg-[#FEF4DD] text-[#8A4B08]'
                        : option.pricing?.mode === PRICING_MODES.MANUAL_QUOTE
                          ? 'border-[#151515] bg-[#151515] text-[#C8F13A]'
                          : 'border-[#151515]/10 bg-[#F8F6EF] text-[#151515]'
                    }`}
                  >
                    {priceSummary.primary}
                  </span>
                  {priceSummary.secondary ? (
                    <span className="mt-1 block font-mono text-[10.5px] text-[#666159]">
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
