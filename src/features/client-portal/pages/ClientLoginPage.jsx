import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Disc3,
  Loader2,
  LogOut,
  Music2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_ADMIN_ACCOUNT_NOTICE,
  CLIENT_PORTAL_ROUTES,
} from '../config/client-portal-config';
import { isClientRole } from '../utils/client-auth-helpers';

const AMBIENT_LEVEL_BARS = [
  { id: 'lvl-1', height: 'h-4', tone: 'bg-[#C8F13A]/75' },
  { id: 'lvl-2', height: 'h-8', tone: 'bg-[#C8F13A]' },
  { id: 'lvl-3', height: 'h-12', tone: 'bg-[#F1EEE4]/80' },
  { id: 'lvl-4', height: 'h-7', tone: 'bg-[#FF4B22]' },
  { id: 'lvl-5', height: 'h-10', tone: 'bg-[#C8F13A]/90' },
  { id: 'lvl-6', height: 'h-5', tone: 'bg-[#F1EEE4]/65' },
  { id: 'lvl-7', height: 'h-9', tone: 'bg-[#FF4B22]/85' },
];

function GoogleBrandMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

function resolveSafePortalRedirect(fromPath) {
  if (
    typeof fromPath === 'string' &&
    fromPath.startsWith(CLIENT_PORTAL_ROUTES.HOME) &&
    fromPath !== CLIENT_PORTAL_ROUTES.LOGIN
  ) {
    return fromPath;
  }
  return CLIENT_PORTAL_ROUTES.HOME;
}

export function ClientLoginPage() {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    status,
    accountType,
    user,
    profile,
    clientAccount,
    clientProfile,
    role,
    clientAuthError,
    loginWithGoogle,
    logout,
    clearClientAuthError,
  } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const targetDestination = resolveSafePortalRedirect(location.state?.from);

  const isAuthorizedClient = Boolean(
    status === 'authenticated' &&
    user?.uid &&
    accountType === 'client' &&
    profile === null &&
    isClientRole(role) &&
    clientAccount?.uid === user.uid &&
    clientAccount?.role === 'client' &&
    clientAccount?.status === CLIENT_ACCOUNT_STATUS.ACTIVE &&
    clientProfile?.customerId === clientAccount.customerId &&
    clientProfile?.status === 'active',
  );

  if (isAuthorizedClient) {
    return <Navigate to={targetDestination} replace />;
  }

  const isStaffSessionActive = Boolean(
    status === 'authenticated' && accountType === 'staff' && profile?.active === true,
  );

  const displayedError = localError || clientAuthError || '';

  const handleGoogleContinue = async () => {
    if (isSubmitting || status === 'loading') return;

    setLocalError('');
    clearClientAuthError?.();
    setIsSubmitting(true);

    try {
      const result = await loginWithGoogle();
      if (result && !result.redirected) {
        navigate(targetDestination, { replace: true });
      }
    } catch (err) {
      setLocalError(
        err?.message ||
          'Tidak dapat menyelesaikan masuk dengan Google saat ini. Silakan coba lagi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOutStaff = async () => {
    setLocalError('');
    clearClientAuthError?.();
    await logout();
  };

  return (
    <div
      data-testid="client-login-page"
      className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col overflow-x-clip"
    >
      {/* Top Studio Navigation Bar */}
      <header className="border-b border-[#151515]/10 bg-[#F1EEE4]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="group inline-flex min-h-10 items-center gap-2.5"
            aria-label="37 Music Studio — Kembali ke beranda"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#151515] font-mono text-xs font-extrabold tracking-tight text-[#C8F13A] transition-colors group-hover:bg-[#FF4B22] group-hover:text-white">
              37
            </span>
            <span className="flex flex-col">
              <span className="font-display text-base leading-none font-black tracking-tight uppercase sm:text-lg">
                37 Music Studio
              </span>
              <span className="mt-0.5 font-mono text-[9.5px] font-semibold tracking-[0.18em] text-[#666159] uppercase">
                CLIENT PORTAL
              </span>
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#151515]/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#151515] transition-colors hover:border-[#151515] hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kembali ke Website</span>
          </Link>
        </div>
      </header>

      {/* Main Asymmetric Editorial Split Workspace */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-[#151515]/12 bg-white shadow-[0_28px_70px_-24px_rgba(21,21,21,0.22)] lg:grid-cols-12"
        >
          {/* Studio Ambience & Brand Narrative Column */}
          <section
            aria-label="37 Music Studio Client Portal overview"
            className="relative flex flex-col justify-between overflow-hidden bg-[#121212] p-6 text-[#F1EEE4] sm:p-9 lg:col-span-6 lg:p-11"
          >
            {/* Atmospheric Ambient Studio Lighting */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#C8F13A]/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-[#FF4B22]/15 blur-3xl"
            />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-[#C8F13A] uppercase">
                <Disc3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CLIENT PORTAL • 37 MUSIC STUDIO</span>
              </div>

              <h1 className="font-display mt-5 text-4xl leading-[0.94] font-black tracking-tight text-white uppercase sm:text-5xl lg:text-6xl">
                Your Studio, <span className="text-[#C8F13A]">Your Space.</span>
              </h1>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-300 sm:text-base">
                Kelola pengalaman studio Anda dalam satu tempat.
              </p>
            </div>

            {/* Acoustic Studio Visual Accent (desktop / tablet) */}
            <div className="relative z-10 mt-8 hidden border-t border-white/10 pt-6 sm:block">
              <div className="flex items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs">
                <div className="flex items-end gap-1.5" aria-hidden="true">
                  {AMBIENT_LEVEL_BARS.map((bar) => (
                    <span key={bar.id} className={`w-2 rounded-full ${bar.height} ${bar.tone}`} />
                  ))}
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#C8F13A] uppercase">
                    INSTANT GOOGLE ACCESS
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-300">
                    Akses cepat dan aman tanpa proses persetujuan manual
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Focused Minimalist Google Authentication Card Column */}
          <section className="flex flex-col justify-between bg-white p-6 sm:p-9 lg:col-span-6 lg:p-11">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#FAF8F3] px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-[#46433D] uppercase">
                <Sparkles className="h-3 w-3 text-[#FF4B22]" aria-hidden="true" />
                <span>Selamat Datang</span>
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#151515] sm:text-3xl">
                Masuk ke Client Portal
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#666159]">
                Gunakan akun Google pribadi Anda untuk langsung masuk ke ruang Client Portal 37
                Music Studio.
              </p>

              {/* Calm Staff / Owner Notice if currently logged into Admin */}
              {isStaffSessionActive ? (
                <div
                  role="status"
                  data-testid="client-login-staff-notice"
                  className="mt-6 space-y-3 rounded-2xl border border-[#151515]/12 bg-[#FAF8F3] p-4 text-xs text-[#46433D]"
                >
                  <div className="flex items-start gap-2.5">
                    <Music2 className="mt-0.5 h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold text-[#151515]">Sesi Internal Studio Aktif</p>
                      <p className="leading-relaxed">{CLIENT_ADMIN_ACCOUNT_NOTICE}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/admin/dashboard"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#151515] px-3.5 py-1.5 text-xs font-semibold text-[#C8F13A]"
                    >
                      <span>Buka Admin Workspace</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOutStaff}
                      className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#151515]/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#151515] hover:bg-neutral-50"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Keluar &amp; Ganti Akun Google</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Safe Inline Authentication Feedback */}
              {displayedError ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  data-testid="client-login-error-alert"
                  className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFF4F1] p-4 text-xs leading-relaxed font-medium text-[#9A270B] sm:text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{displayedError}</span>
                </div>
              ) : null}

              {/* Primary Google Sign-In / Instant Sign-Up CTA */}
              <div className="mt-7">
                <button
                  type="button"
                  data-testid="client-google-login-button"
                  disabled={isSubmitting || status === 'loading'}
                  aria-busy={isSubmitting || status === 'loading'}
                  onClick={handleGoogleContinue}
                  className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[#151515]/15 bg-white px-5 py-3.5 text-sm font-semibold text-[#151515] shadow-[0_6px_20px_-8px_rgba(21,21,21,0.22)] transition-all hover:border-[#151515]/40 hover:bg-[#FAF8F3] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {isSubmitting || status === 'loading' ? (
                    <>
                      <Loader2
                        className="h-4.5 w-4.5 animate-spin text-[#151515]"
                        aria-hidden="true"
                      />
                      <span>Menghubungkan akun Google...</span>
                    </>
                  ) : (
                    <>
                      <GoogleBrandMark />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-xs text-[#666159]">
                  Masuk atau daftar menggunakan akun Google Anda.
                </p>
              </div>
            </div>

            {/* Subtle Footer & Legal Attribution */}
            <div className="mt-8 border-t border-[#151515]/10 pt-5 text-xs text-[#666159]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Dilindungi Firebase Google Authentication</span>
                </span>
                <Link
                  to="/privacy"
                  className="font-semibold text-[#151515] underline underline-offset-4 hover:text-[#FF4B22]"
                >
                  Privacy Notice
                </Link>
              </div>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}

export default ClientLoginPage;
