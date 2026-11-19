import { UtensilsCrossed } from 'lucide-react';

import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';

export function DailyMealAllowanceForm({
  operationalSettings,
  readOnly = false,
  onChangeOperationalSettings,
}) {
  const dailyMealAllowance = operationalSettings?.dailyMealAllowancePerStaff ?? 0;

  return (
    <section
      aria-labelledby="section-global-operational-heading"
      className="brutal-card bg-studio-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-neutral-200 pb-3.5">
        <div>
          <span className="border-studio-ink bg-studio-ink text-studio-lime inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
            GLOBAL OPERATIONAL SETTINGS
          </span>
          <h3
            id="section-global-operational-heading"
            className="font-display text-studio-ink mt-2 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
          >
            Daily Meal Allowance per Staff
          </h3>
        </div>

        <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2.5 py-1 font-mono text-xs font-extrabold whitespace-nowrap">
          {formatRupiah(dailyMealAllowance)} / hari
        </span>
      </div>

      <div className="border-studio-ink bg-studio-ivory mt-4 border-2 p-4">
        <div className="flex items-start gap-3">
          <span className="border-studio-ink bg-studio-white flex h-10 w-10 shrink-0 items-center justify-center border-2">
            <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <label
              htmlFor="global-daily-meal-allowance"
              className="text-studio-ink block font-mono text-xs font-extrabold uppercase"
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
              className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full max-w-sm border-2 px-3 py-2 font-mono text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed">
              Preset nominal uang makan harian per satu Staff yang bertugas. Nilai ini tidak
              memengaruhi total tagihan customer dan tidak otomatis membuat data absensi atau
              payroll.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
