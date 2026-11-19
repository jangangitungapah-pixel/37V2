import { SlidersHorizontal } from 'lucide-react';

import { SettingsModuleCard } from '../components/SettingsModuleCard';

export function AdminSettingsPage() {
  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-6">
      <section
        aria-labelledby="settings-overview-heading"
        className="brutal-card-lg bg-studio-white p-4 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-ink text-studio-lime border px-2 py-0.5 font-mono text-[9.5px] font-extrabold tracking-widest uppercase sm:px-2.5 sm:py-1 sm:text-[10px]">
            PENGATURAN STUDIO
          </span>
          <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase sm:px-2.5 sm:py-1 sm:text-[10px]">
            TARIF &amp; KOMISI
          </span>
        </div>

        <h2
          id="settings-overview-heading"
          className="font-display text-studio-ink mt-2.5 text-2xl leading-none font-black tracking-tight uppercase sm:mt-3 sm:text-5xl"
        >
          Settings
        </h2>

        <p className="text-studio-muted-ink mt-1.5 max-w-2xl text-xs leading-relaxed font-semibold sm:mt-2 sm:text-base">
          Kelola daftar layanan, tarif sewa studio, diskon durasi, dan pembagian komisi tim.
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
          description="Atur tarif layanan studio, paket harga, diskon otomatis, dan fee operasional staff."
          icon={SlidersHorizontal}
          badge="AKTIF"
        />
      </section>
    </div>
  );
}

export default AdminSettingsPage;
