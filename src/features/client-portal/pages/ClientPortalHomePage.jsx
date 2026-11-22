import { CalendarClock, CheckCircle2, Disc3, LogOut, Sparkles, UserCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Toaster } from 'sonner';

import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_PORTAL_ROUTES, CLIENT_PROFILE_SOURCE } from '../config/client-portal-config';

export function ClientPortalHomePage() {
  const { clientAccount, clientProfile, logout } = useAuth();
  const navigate = useNavigate();

  const isLinkedCustomer = clientAccount?.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER;

  const handleSignOut = async () => {
    await logout();
    navigate(CLIENT_PORTAL_ROUTES.LOGIN, { replace: true });
  };

  return (
    <div
      data-testid="client-portal-home"
      className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col"
    >
      <header className="border-b border-[#151515]/10 bg-white/90 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#151515] font-mono text-xs font-extrabold text-[#C8F13A]">
              37
            </span>
            <div className="flex flex-col">
              <span className="font-display text-base leading-none font-black tracking-tight uppercase">
                37 Music Studio
              </span>
              <span className="mt-0.5 font-mono text-[9.5px] font-semibold tracking-[0.16em] text-[#666159] uppercase">
                CLIENT PORTAL
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              to="/availability"
              className="hidden items-center gap-1.5 rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-3 py-2 text-xs font-semibold text-[#151515] hover:border-[#151515] sm:inline-flex"
            >
              <CalendarClock className="h-3.5 w-3.5 text-[#FF4B22]" aria-hidden="true" />
              <span>Cek Jadwal Studio</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 rounded-xl border border-[#151515]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#151515] hover:bg-[#FAF8F3]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-[#151515]/12 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(21,21,21,0.18)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF8C2] px-3 py-1 font-mono text-[10.5px] font-bold text-[#243300] uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Akun Client Aktif</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/12 bg-[#FAF8F3] px-3 py-1 font-mono text-[10.5px] font-semibold text-[#46433D]">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isLinkedCustomer
                  ? 'Terhubung ke Profil Pelanggan Studio'
                  : 'Profil Client Pribadi'}
              </span>
            </span>
          </div>

          <h1 className="font-display mt-4 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl">
            Halo, {clientProfile?.displayName || clientAccount?.displayName || 'Musisi'}.
          </h1>

          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[#666159]">
            Selamat datang di Client Portal 37 Music Studio. Akun Google Anda (
            <span className="font-mono text-xs font-semibold text-[#151515]">
              {clientAccount?.emailNormalized}
            </span>
            ) sudah aktif dan siap digunakan.
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-[#151515]/10 bg-[#FAF8F3] p-4 text-xs sm:grid-cols-3">
            <div>
              <dt className="font-medium text-[#666159]">Nama Tampilan</dt>
              <dd className="mt-1 font-semibold text-[#151515]">
                {clientProfile?.displayName || '-'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[#666159]">Email Terverifikasi</dt>
              <dd className="mt-1 font-mono font-semibold text-[#151515]">
                {clientAccount?.emailNormalized || '-'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[#666159]">Status Portal</dt>
              <dd className="mt-1 font-semibold text-emerald-700">Aktif • Siap Digunakan</dd>
            </div>
          </dl>

          <div
            data-testid="client-portal-empty-space"
            className="mt-6 rounded-2xl border border-dashed border-[#151515]/20 bg-[#FAF8F3]/60 p-6 text-center sm:p-8"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#151515] text-[#C8F13A]">
              <Disc3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-base font-bold text-[#151515]">Ruang Client Portal Siap</h2>
            <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[#666159] sm:text-sm">
              {isLinkedCustomer
                ? 'Profil Anda sudah terhubung dengan data pelanggan resmi 37 Music Studio. Fitur riwayat sesi, tagihan, dan pemesanan akan hadir pada pembaruan portal berikutnya.'
                : 'Belum ada riwayat sesi yang terhubung pada akun baru Anda. Anda tetap dapat menjelajahi jadwal studio yang tersedia sambil menunggu fitur lengkap portal.'}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/availability"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#151515] px-4 py-2 text-xs font-bold text-[#C8F13A]"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Lihat Jadwal Studio</span>
              </Link>
              <Link
                to="/"
                className="inline-flex min-h-10 items-center rounded-xl border border-[#151515]/15 bg-white px-4 py-2 text-xs font-semibold text-[#151515]"
              >
                Kembali ke Halaman Utama
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

export default ClientPortalHomePage;
