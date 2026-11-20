import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

import { AdminStatusBadge, AdminSurface } from '../design-system';
import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';

const ACTIVE_MODULE_IDS = new Set([
  'calendar',
  'customer',
  'payment-and-bill',
  'commission-and-fee',
  'inventory',
  'settings',
]);

export function AdminDashboardPage() {
  const { profile, user, role } = useAuth();

  const displayName = profile?.displayName || user?.displayName || 'Studio Team Member';
  const email = profile?.email || user?.email || '';
  const roleLabel = (role || profile?.role || 'staff').toUpperCase();
  const isOwner = roleLabel === 'OWNER';

  const moduleShortcuts = ADMIN_NAVIGATION_ITEMS.filter((item) => item.id !== 'dashboard');

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Primary Welcome & Identity Panel */}
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="dashboard-welcome-heading"
        className="p-4 sm:p-7 lg:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <AdminStatusBadge tone="lime" dot>
            SISTEM AKTIF
          </AdminStatusBadge>

          <AdminStatusBadge tone={isOwner ? 'lime' : 'orange'} icon={ShieldCheck}>
            AKSES: {roleLabel}
          </AdminStatusBadge>
        </div>

        <h2
          id="dashboard-welcome-heading"
          className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[#151515] sm:text-3xl lg:text-4xl"
        >
          Welcome back, {displayName}.
        </h2>

        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
          Selamat datang di panel manajemen 37 Music Studio. Pilih salah satu menu di bawah atau
          dari daftar navigasi di sebelah kiri untuk mulai mengelola jadwal, pelanggan, tagihan,
          komisi, dan tarif studio.
        </p>

        {/* Verified Account Summary Row */}
        <dl
          aria-label="Ringkasan akun aktif"
          className="sa-panel mt-5 grid grid-cols-1 gap-2.5 p-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3 sm:p-3.5"
        >
          <div className="sa-subcard p-3 sm:p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#666159]">
              <UserCheck className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
              <span>Nama Pengguna</span>
            </dt>
            <dd className="mt-1.5 text-sm font-semibold break-words text-[#151515] sm:text-[15px]">
              {displayName}
            </dd>
          </div>

          <div className="sa-subcard p-3 sm:p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#666159]">
              <Mail className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
              <span>Email Akun</span>
            </dt>
            <dd className="mt-1.5 font-mono text-xs font-medium break-all text-[#151515] sm:text-[13px]">
              {email || '—'}
            </dd>
          </div>

          <div className="sa-subcard p-3 sm:p-3.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#666159]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
              <span>Peran Akun</span>
            </dt>
            <dd className="mt-1.5 flex items-center gap-2">
              <AdminStatusBadge tone="ink" size="sm" className="font-mono font-semibold uppercase">
                {roleLabel}
              </AdminStatusBadge>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6246]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Akun Aktif</span>
              </span>
            </dd>
          </div>
        </dl>
      </AdminSurface>

      {/* Module Workspace Directory */}
      <section aria-labelledby="dashboard-modules-heading" className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#151515]/[0.06] text-[#151515]">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3
                id="dashboard-modules-heading"
                className="text-sm font-semibold tracking-tight text-[#151515] sm:text-base"
              >
                Menu Operasional Studio
              </h3>
              <p className="text-[11px] text-[#666159] sm:text-xs">
                Akses cepat ke seluruh ruang kerja administrasi
              </p>
            </div>
          </div>

          <span className="font-mono text-[11px] font-medium text-[#666159]">
            {moduleShortcuts.length} Modul Terdaftar
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleShortcuts.map((item) => {
            const IconComponent = item.icon;
            const isActiveModule = ACTIVE_MODULE_IDS.has(item.id);

            return (
              <Link
                key={item.id}
                to={item.href}
                className="sa-card group flex flex-col justify-between p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#151515]/15 hover:shadow-[0_14px_30px_-10px_rgba(21,21,21,0.12)] sm:p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={
                        isActiveModule
                          ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F6F3EB] text-[#151515] transition-colors group-hover:bg-[#C8F13A]'
                          : 'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#151515]/[0.04] text-[#666159]'
                      }
                    >
                      <IconComponent className="h-5 w-5 stroke-[1.9]" aria-hidden="true" />
                    </span>

                    <AdminStatusBadge tone={isActiveModule ? 'lime' : 'neutral'} size="sm">
                      {isActiveModule ? 'Aktif' : 'Segera Hadir'}
                    </AdminStatusBadge>
                  </div>

                  <div className="mt-3.5">
                    <p className="font-mono text-[10.5px] font-medium text-[#8B857B]">
                      MENU {item.order}
                    </p>
                    <h4 className="mt-0.5 text-base font-semibold tracking-tight text-[#151515]">
                      {item.label}
                    </h4>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#666159]">
                      {item.summary}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#151515]/[0.06] pt-3 text-xs font-semibold text-[#151515]">
                  <span className="transition-colors group-hover:text-[#FF4B22]">
                    {isActiveModule ? 'Buka Ruang Kerja' : 'Lihat Rencana Modul'}
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-[#8B857B] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#FF4B22]"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bottom Spatial Dark Operational Banner */}
      <section
        aria-labelledby="shell-foundation-note-heading"
        className="rounded-2xl border border-white/10 bg-[radial-gradient(28rem_16rem_at_100%_0%,rgba(200,241,58,0.13),transparent_70%),#151515] p-5 text-white shadow-[0_18px_40px_-14px_rgba(21,21,21,0.3)] sm:p-7"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-[#FF4B22]/40 bg-[#FF4B22]/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#FF7A59] uppercase">
              Akses Tim Studio
            </span>
            <h2
              id="shell-foundation-note-heading"
              className="mt-2.5 text-lg font-bold tracking-tight text-white sm:text-2xl"
            >
              Panel Operasional Owner &amp; Staff
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-neutral-300 sm:text-sm">
              Akun <strong className="font-semibold text-white">Owner</strong> dan{' '}
              <strong className="font-semibold text-white">Staff</strong> dapat mengakses seluruh
              menu operasional studio. Pengaturan tarif dan persetujuan komisi hanya dapat dilakukan
              oleh Owner.
            </p>
          </div>

          <Link
            to="/"
            className="sa-control inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#151515] shadow-sm transition-colors hover:bg-[#C8F13A] sm:min-h-11 lg:self-auto"
          >
            <span>Lihat Website Publik</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboardPage;
