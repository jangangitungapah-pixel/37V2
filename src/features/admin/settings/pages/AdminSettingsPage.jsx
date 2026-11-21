import { Bell, Building2, Clock, Globe, ShieldCheck, SlidersHorizontal } from 'lucide-react';

import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { SettingsBreadcrumb } from '../components/SettingsBreadcrumb';
import { SettingsModuleCard } from '../components/SettingsModuleCard';

export function AdminSettingsPage() {
  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-7">
      <AdminPageHeader
        eyebrow="Settings Center"
        icon={SlidersHorizontal}
        titleId="settings-overview-heading"
        title="Settings"
        description="Pusat konfigurasi identitas studio, tarif layanan, kebijakan operasional, serta keamanan akun admin 37 Music Studio."
        meta={
          <AdminStatusBadge tone="ivory" size="sm">
            3 Modul Aktif
          </AdminStatusBadge>
        }
      >
        <SettingsBreadcrumb
          items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Settings' }]}
        />
      </AdminPageHeader>

      {/* Group A — Studio Configuration */}
      <section aria-labelledby="settings-group-studio-heading" className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="settings-group-studio-heading"
              className="text-base font-bold tracking-tight text-[#151515] sm:text-lg"
            >
              Studio Configuration
            </h2>
            <p className="text-xs text-[#666159]">
              Identitas studio, struktur harga, dan modul kebijakan operasional bersama.
            </p>
          </div>
          <AdminStatusBadge tone="neutral" size="sm">
            Owner Kelola · Staff Baca Saja
          </AdminStatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsModuleCard
            to="/admin/settings/studio-profile"
            order="01"
            title="Studio Profile"
            description="Kelola nama studio, tagline, nomor WhatsApp, email kontak, alamat, kota, dan tautan Google Maps."
            icon={Building2}
            badge="AKTIF"
            statusNote="Owner ubah · Staff lihat baca saja"
            actionLabel="Open Studio Profile"
          />

          <SettingsModuleCard
            to="/admin/settings/price-and-fee"
            order="02"
            title="Price and Fee Settings"
            description="Atur tarif layanan studio, paket harga, diskon otomatis, dan fee operasional staff."
            icon={SlidersHorizontal}
            badge="AKTIF"
            statusNote="Owner ubah · Staff lihat baca saja"
            actionLabel="Open Price and Fee Settings"
          />

          <SettingsModuleCard
            planned
            order="03"
            title="Operations & Booking Rules"
            description="Jam operasional studio, aturan penjadwalan booking, masa tenggang, dan kebijakan pembatalan."
            icon={Clock}
            badge="PLANNED"
            statusNote="PLANNED · Hadir pada fase berikutnya"
          />
        </div>
      </section>

      {/* Group B — Personal Settings */}
      <section aria-labelledby="settings-group-personal-heading" className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="settings-group-personal-heading"
              className="text-base font-bold tracking-tight text-[#151515] sm:text-lg"
            >
              Personal Settings
            </h2>
            <p className="text-xs text-[#666159]">
              Informasi akun login pribadi, keamanan autentikasi, dan preferensi perangkat.
            </p>
          </div>
          <AdminStatusBadge tone="ivory" size="sm">
            Owner &amp; Staff
          </AdminStatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SettingsModuleCard
            to="/admin/settings/account-security"
            order="04"
            title="Account & Security"
            description="Tinjau identitas akun yang sedang masuk, peran, status aktif, waktu masuk terakhir, serta kirim email reset password."
            icon={ShieldCheck}
            badge="AKTIF"
            statusNote="Tersedia untuk Owner & Staff"
            actionLabel="Open Account & Security"
          />

          <SettingsModuleCard
            planned
            order="05"
            title="Notifications & Devices"
            description="Preferensi notifikasi operasional studio dan ringkasan perangkat admin yang terhubung."
            icon={Bell}
            badge="PLANNED"
            statusNote="PLANNED · Hadir pada fase berikutnya"
          />
        </div>
      </section>

      {/* System Baseline (Read-Only Reference) */}
      <AdminSurface
        as="section"
        variant="ivory"
        aria-labelledby="settings-system-baseline-heading"
        className="p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
            <h2
              id="settings-system-baseline-heading"
              className="text-sm font-bold tracking-tight text-[#151515] sm:text-base"
            >
              System Baseline
            </h2>
          </div>
          <AdminStatusBadge tone="neutral" size="sm">
            Read-Only
          </AdminStatusBadge>
        </div>

        <dl className="mt-3.5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-3">
            <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
              Currency
            </dt>
            <dd className="mt-1 font-semibold text-[#151515]">IDR (Indonesian Rupiah)</dd>
          </div>

          <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-3">
            <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
              Timezone
            </dt>
            <dd className="mt-1 font-semibold text-[#151515]">Asia/Jakarta (WIB)</dd>
          </div>

          <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-3">
            <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
              Date &amp; Time Presentation
            </dt>
            <dd className="mt-1 font-semibold text-[#151515]">Indonesian locale, 24-hour format</dd>
          </div>

          <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-3">
            <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
              Backend
            </dt>
            <dd className="mt-1 font-semibold text-[#151515]">
              Firebase Authentication + Cloud Firestore
            </dd>
          </div>
        </dl>
      </AdminSurface>
    </div>
  );
}

export default AdminSettingsPage;
