import { UtensilsCrossed } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';

export function DailyMealAllowanceForm({
  operationalSettings,
  readOnly = false,
  onChangeOperationalSettings,
}) {
  const dailyMealAllowance = operationalSettings?.dailyMealAllowancePerStaff ?? 0;

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="section-global-operational-heading"
      className="p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#151515]/[0.07] pb-4">
        <div>
          <AdminStatusBadge tone="ink" size="sm" className="font-mono uppercase">
            Global Operational Settings
          </AdminStatusBadge>
          <h3
            id="section-global-operational-heading"
            className="mt-2 text-lg font-bold tracking-tight text-[#151515] sm:text-xl"
          >
            Daily Meal Allowance per Staff
          </h3>
        </div>

        <AdminStatusBadge tone="lime" className="font-mono font-bold tabular-nums">
          {formatRupiah(dailyMealAllowance)} / hari
        </AdminStatusBadge>
      </div>

      <div className="sa-panel-ivory mt-4 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#151515]/10 bg-white text-[#151515]">
            <UtensilsCrossed className="h-4.5 w-4.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <label
              htmlFor="global-daily-meal-allowance"
              className="block text-xs font-semibold text-[#151515] sm:text-[13px]"
            >
              Daily Meal Allowance per Staff (IDR)
            </label>
            <input
              id="global-daily-meal-allowance"
              type="text"
              inputMode="numeric"
              disabled={readOnly}
              value={String(dailyMealAllowance)}
              onChange={(e) =>
                onChangeOperationalSettings({
                  ...operationalSettings,
                  dailyMealAllowancePerStaff: parseMoneyInput(e.target.value),
                })
              }
              placeholder="0"
              className="sa-input mt-2 min-h-10.5 w-full max-w-sm px-3.5 py-2 font-mono text-sm font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs leading-relaxed text-[#666159]">
              Preset nominal uang makan harian per satu Staff yang bertugas. Nilai ini tidak
              memengaruhi total tagihan customer dan tidak otomatis membuat data absensi atau
              payroll.
            </p>
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
