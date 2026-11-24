import { useContext } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Clock,
  Globe,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'react-router';

import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { AuthContext } from '@/features/auth/AuthContext';

import { SettingsBreadcrumb } from '../components/SettingsBreadcrumb';
import { SettingsModuleCard } from '../components/SettingsModuleCard';

export function AdminSettingsPage() {
  const auth = useContext(AuthContext);
  const isActiveOwner = Boolean(
    auth?.profile &&
    auth.profile.active === true &&
    auth.role === 'owner' &&
    auth.profile.role === 'owner',
  );

  return (
    <div data-calendar-scoped="true" className="space-y-4 sm:space-y-7">
      <AdminPageHeader
        compactMobile
        eyebrow="Settings Center"
        icon={SlidersHorizontal}
        titleId="settings-overview-heading"
        title="Settings"
        description="Pusat konfigurasi identitas studio, tarif layanan, kebijakan operasional, serta keamanan akun admin 37 Music Studio."
        meta={
          <AdminStatusBadge tone="ivory" size="sm">
            {isActiveOwner ? '4 Modul Aktif' : '3 Modul Aktif'}
          </AdminStatusBadge>
        }
        className="[&>div:last-child]:mt-0 sm:[&>div:last-child]:mt-5"
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

      {/* Group C — Owner-Only Danger Area */}
      {isActiveOwner ? (
        <section aria-labelledby="settings-group-danger-heading" className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="settings-group-danger-heading"
                className="text-base font-bold tracking-tight text-[#151515] sm:text-lg"
              >
                Danger Zone
              </h2>
              <p className="text-xs text-[#666159]">
                Pengelolaan penghapusan permanen data operasional khusus Studio Owner.
              </p>
            </div>
            <AdminStatusBadge tone="danger" size="sm">
              OWNER ONLY
            </AdminStatusBadge>
          </div>

          <AdminSurface
            as="article"
            variant="card"
            data-testid="settings-danger-area-card"
            className="flex flex-col justify-between gap-4 border-red-200/80 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:p-6"
          >
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
                <ShieldAlert className="h-5 w-5 stroke-[1.9]" aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-[#151515] sm:text-xl">
                    Danger Area
                  </h3>
                  <AdminStatusBadge tone="danger" icon={AlertTriangle} size="sm">
                    OWNER ONLY
                  </AdminStatusBadge>
                </div>
                <p className="text-xs leading-relaxed text-[#666159] sm:text-sm">
                  Zona tindakan destruktif untuk pengelolaan dan penghapusan permanen data
                  operasional studio.
                </p>
              </div>
            </div>

            <Link
              to="/admin/settings/danger-area"
              className="inline-flex min-h-10.5 w-full shrink-0 items-center justify-center gap-2.5 rounded-[10px] border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-800 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white sm:w-auto sm:justify-between sm:gap-3"
            >
              <span>Open Danger Area</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </AdminSurface>
        </section>
      ) : null}
    </div>
  );
}

export default AdminSettingsPage;
