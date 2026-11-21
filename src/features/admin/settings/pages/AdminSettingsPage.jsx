import { SlidersHorizontal } from 'lucide-react';

import { AdminPageHeader, AdminStatusBadge } from '@/features/admin/design-system';

import { SettingsModuleCard } from '../components/SettingsModuleCard';

export function AdminSettingsPage() {
  return (
    <div data-calendar-scoped="true" className="space-y-3 sm:space-y-6">
      <AdminPageHeader
        eyebrow="Pengaturan Studio"
        icon={SlidersHorizontal}
        titleId="settings-overview-heading"
        title="Settings"
        description="Kelola daftar layanan, tarif sewa studio, diskon durasi, dan pembagian komisi tim."
        meta={
          <AdminStatusBadge tone="ivory" size="sm">
            Tarif &amp; Komisi
          </AdminStatusBadge>
        }
      />

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
