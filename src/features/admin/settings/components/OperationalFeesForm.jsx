import { Coins, UtensilsCrossed } from 'lucide-react';

import { formatRupiah, parseMoneyInput } from '../pricing/utils/calculate-pricing-settings';
import { SettingsSectionCard } from './SettingsSectionCard';

  export function OperationalFeesForm({ fees, readOnly = false, onChangeFees }) {
    const safeFees = fees || {
      rehearsalStaffCommissionPerHour: 0,
      dailyMealAllowancePerStaff: 0,
    };

    return (
      <SettingsSectionCard
        sectionId="section-operational-fees-heading"
        order="05"
        title="Staff and Operational Fees"
        description="Preset biaya operasional internal studio: komisi Staff penjaga studio per jam untuk session Rehearsal reguler dan nominal preset uang makan harian per Staff."
        countLabel="2 Global Presets"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Card A: Rehearsal Staff Commission per Hour */}
          <div className="border-studio-ink bg-studio-ivory flex flex-col justify-between border-2 p-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="border-studio-ink bg-studio-white flex h-9 w-9 shrink-0 items-center justify-center border">
                    <Coins className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor="fee-rehearsal-staff-per-hour"
                      className="font-display text-studio-ink block text-xl leading-none font-black uppercase"
                    >
                      Rehearsal Staff Commission per Hour
                    </label>
                    <span className="text-studio-muted-ink mt-1 block font-mono text-[10px] font-bold uppercase">
                      Komisi Staff / Penjaga Studio (Reguler)
                    </span>
                  </div>
                </div>

                <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[11px] font-extrabold whitespace-nowrap">
                  {formatRupiah(safeFees.rehearsalStaffCommissionPerHour)}/jam
                </span>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="fee-rehearsal-staff-per-hour"
                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                >
                  Nominal per Jam (IDR)
                </label>
                <input
                  id="fee-rehearsal-staff-per-hour"
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={String(safeFees.rehearsalStaffCommissionPerHour ?? 0)}
                  onChange={(e) =>
                    onChangeFees({
                      ...safeFees,
                      rehearsalStaffCommissionPerHour: parseMoneyInput(e.target.value),
                    })
                  }
                  placeholder="0"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <p className="text-studio-muted-ink mt-3 border-t border-neutral-300 pt-2.5 text-xs leading-relaxed">
              Hanya berlaku untuk session <strong>Rehearsal reguler (tanpa paket)</strong>: durasi jam
              &times; tarif per jam. Booking paket memakai komisi paket sendiri, dan internal
              commission tidak memengaruhi tagihan customer.
            </p>
          </div>

          {/* Card B: Daily Meal Allowance per Staff */}
          <div className="border-studio-ink bg-studio-ivory flex flex-col justify-between border-2 p-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="border-studio-ink bg-studio-white flex h-9 w-9 shrink-0 items-center justify-center border">
                    <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <label
                      htmlFor="fee-daily-meal-allowance"
                      className="font-display text-studio-ink block text-xl leading-none font-black uppercase"
                    >
                      Daily Meal Allowance per Staff
                    </label>
                    <span className="text-studio-muted-ink mt-1 block font-mono text-[10px] font-bold uppercase">
                      Preset Uang Makan Harian
                    </span>
                  </div>
                </div>

                <span className="border-studio-ink bg-studio-white text-studio-ink border px-2 py-0.5 font-mono text-[11px] font-extrabold whitespace-nowrap">
                  {formatRupiah(safeFees.dailyMealAllowancePerStaff)}/hari
                </span>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="fee-daily-meal-allowance"
                  className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                >
                  Nominal per Staff per Hari (IDR)
                </label>
                <input
                  id="fee-daily-meal-allowance"
                  type="text"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={String(safeFees.dailyMealAllowancePerStaff ?? 0)}
                  onChange={(e) =>
                    onChangeFees({
                      ...safeFees,
                      dailyMealAllowancePerStaff: parseMoneyInput(e.target.value),
                    })
                  }
                  placeholder="0"
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 min-h-11 w-full border-2 px-3 py-2 font-mono text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <p className="text-studio-muted-ink mt-3 border-t border-neutral-300 pt-2.5 text-xs leading-relaxed">
              Disimpan sebagai preset operasional harian per satu Staff. Nilai ini tidak dihitung pada
              biaya booking dan tidak otomatis membuat transaksi atau absensi.
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    );
  }
