import { SlidersHorizontal } from 'lucide-react';

import { SettingsModuleCard } from '../components/SettingsModuleCard';

export function AdminSettingsPage() {
  return (
    <div data-calendar-scoped="true" className="space-y-6">
      <section
        aria-labelledby="settings-overview-heading"
        className="brutal-card-lg bg-studio-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-ink text-studio-lime border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-widest uppercase">
            MODULE 08 • STUDIO CONFIGURATION
          </span>
          <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
            FIRESTORE: settings/pricing
          </span>
        </div>

        <h2
          id="settings-overview-heading"
          className="font-display text-studio-ink mt-3 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl"
        >
          Settings
        </h2>

        <p className="text-studio-muted-ink mt-2 max-w-2xl text-sm leading-relaxed font-semibold sm:text-base">
          Studio configuration and operational presets
        </p>
      </section>

      <section
        aria-label="Settings configuration modules"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <SettingsModuleCard
          to="/admin/settings/price-and-fee"
          order="01"
          title="Price and Fee Settings"
          description="Manage studio session rates, packages, discounts, and operational staff fees."
          icon={SlidersHorizontal}
          badge="ACTIVE SUBPAGE"
        />
      </section>
    </div>
  );
}

export default AdminSettingsPage;
