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

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';

export function AdminDashboardPage() {
  const { profile, user, role } = useAuth();

  const displayName = profile?.displayName || user?.displayName || 'Studio Team Member';
  const email = profile?.email || user?.email || '';
  const roleLabel = (role || profile?.role || 'staff').toUpperCase();
  const isOwner = roleLabel === 'OWNER';

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Primary Welcome & Identity Panel */}
      <section
        aria-labelledby="dashboard-welcome-heading"
        className="brutal-card-lg bg-studio-white p-3.5 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-[1.5px] px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:px-3 sm:py-1 sm:text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SISTEM AKTIF</span>
          </span>

          <span
            className={
              isOwner
                ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:px-2.5 sm:py-1 sm:text-xs'
                : 'border-studio-ink bg-studio-orange text-studio-white inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:px-2.5 sm:py-1 sm:text-xs'
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>AKSES: {roleLabel}</span>
          </span>
        </div>

        <h2
          id="dashboard-welcome-heading"
          className="font-display text-studio-ink mt-3 text-2xl leading-none font-black tracking-tight uppercase sm:mt-4 sm:text-5xl"
        >
          Welcome back, {displayName}.
        </h2>

        <p className="text-studio-muted-ink mt-2 max-w-2xl text-xs leading-relaxed font-semibold sm:mt-2.5 sm:text-base">
          Selamat datang di panel manajemen 37 Music Studio. Pilih salah satu menu di bawah atau
          dari daftar navigasi di sebelah kiri untuk mulai mengelola jadwal, pelanggan, tagihan, dan
          tarif studio.
        </p>

        {/* Verified Account Summary Row */}
        <dl
          aria-label="Ringkasan akun aktif"
          className="border-studio-ink bg-studio-ivory mt-4 grid grid-cols-1 gap-2 border-2 p-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3.5 sm:p-5"
        >
          <div className="border-studio-ink bg-studio-white border p-2.5 sm:p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nama Pengguna</span>
            </dt>
            <dd className="text-studio-ink mt-1 text-sm font-extrabold break-words sm:text-base">
              {displayName}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-white border p-2.5 sm:p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Email Akun</span>
            </dt>
            <dd className="text-studio-ink mt-1 font-mono text-xs font-bold break-all sm:text-sm">
              {email}
            </dd>
          </div>

          <div className="border-studio-ink bg-studio-white border p-2.5 sm:p-3.5">
            <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Peran Akun</span>
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="border-studio-ink bg-studio-ivory inline-block border px-2 py-0.5 font-mono text-xs font-extrabold uppercase">
                {roleLabel}
              </span>
              <span className="text-studio-muted-ink font-mono text-[10px] font-semibold">
                Akun Aktif
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Module Shortcuts Grid */}
      <section aria-labelledby="dashboard-modules-heading">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div>
            <span className="bg-studio-ink text-studio-white inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Layers className="h-3 w-3" aria-hidden="true" />
              <span>DAFTAR MENU STUDIO (08)</span>
            </span>
            <h2
              id="dashboard-modules-heading"
              className="font-display text-studio-ink mt-2 text-xl leading-none font-black tracking-tight uppercase sm:mt-2.5 sm:text-3xl"
            >
              Menu Operasional
            </h2>
          </div>

          <p className="text-studio-muted-ink max-w-md text-xs leading-relaxed font-medium">
            Akses langsung ke seluruh menu pengelolaan 37 Music Studio dari jadwal harian hingga
            pengaturan tarif.
          </p>
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {ADMIN_NAVIGATION_ITEMS.map((item) => {
            const IconComponent = item.icon;
            const isCurrentDashboard = item.id === 'dashboard';
            const isActiveModule = [
              'dashboard',
              'calendar',
              'customer',
              'payment-and-bill',
              'settings',
            ].includes(item.id);

            return (
              <article
                key={item.id}
                className="brutal-card bg-studio-white flex flex-col justify-between p-3.5 sm:p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-neutral-500">
                      {item.order}
                    </span>
                    <span
                      className={
                        isCurrentDashboard
                          ? 'border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase'
                          : isActiveModule
                            ? 'border-studio-ink bg-studio-lime/40 text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase'
                            : 'border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-bold uppercase'
                      }
                    >
                      {isCurrentDashboard
                        ? 'HALAMAN AKTIF'
                        : isActiveModule
                          ? 'SIAP DIPAKAI'
                          : 'SEGERA HADIR'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="border-studio-ink bg-studio-ivory flex h-9 w-9 shrink-0 items-center justify-center border-2 sm:h-10 sm:w-10">
                      <IconComponent className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-lg leading-none font-black tracking-tight uppercase sm:text-xl">
                      {item.label}
                    </h3>
                  </div>

                  <p className="text-studio-muted-ink mt-2.5 text-xs leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="border-studio-ink mt-3.5 border-t pt-2.5 sm:mt-5 sm:pt-3.5">
                  <Link
                    to={item.href}
                    className="group text-studio-ink hover:bg-studio-lime flex min-h-10 w-full items-center justify-between px-2.5 py-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase transition-colors sm:min-h-11 sm:py-2"
                  >
                    <span>{isCurrentDashboard ? 'Halaman Ini' : `Buka ${item.label}`}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Studio Access Info Card */}
      <section
        aria-labelledby="shell-foundation-note-heading"
        className="brutal-card bg-studio-ink text-studio-white p-4 sm:p-7"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="bg-studio-orange text-studio-white inline-block px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase">
              AKSES TIM STUDIO
            </span>
            <h2
              id="shell-foundation-note-heading"
              className="font-display text-studio-white mt-2 text-xl leading-none font-black tracking-tight uppercase sm:mt-2.5 sm:text-3xl"
            >
              Panel Operasional Owner &amp; Staff
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-neutral-300 sm:text-sm">
              Akun <strong>Owner</strong> dan <strong>Staff</strong> dapat mengakses seluruh menu
              operasional studio. Pengaturan tarif dan daftar harga hanya dapat diubah oleh Owner.
            </p>
          </div>

          <Link
            to="/"
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start px-4 py-2 text-xs font-extrabold tracking-wider uppercase sm:min-h-11 lg:self-auto"
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
