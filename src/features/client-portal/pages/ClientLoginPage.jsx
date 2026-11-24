import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Disc3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Music2,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
} from '@/features/admin/customer/utils/customer-email';
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
    loginClientWithEmailPassword,
    registerClientWithEmailPassword,
    resetClientPassword,
    logout,
    clearClientAuthError,
  } = useAuth();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [activeAction, setActiveAction] = useState(''); // '' | 'email' | 'google' | 'reset'
  const [localError, setLocalError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

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

  const isBusy = Boolean(activeAction) || status === 'loading';
  const displayedError = localError || clientAuthError || '';

  const handleModeSwitch = (nextMode) => {
    if (isBusy) return;
    setLocalError('');
    setResetSuccessMessage('');
    clearClientAuthError?.();
    setMode(nextMode);
  };

  const handleOpenForgotPassword = () => {
    if (isBusy) return;
    setLocalError('');
    setResetSuccessMessage('');
    clearClientAuthError?.();
    setResetEmail(email.trim());
    setMode('reset');
  };

  const handleEmailAuthSubmit = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    setLocalError('');
    clearClientAuthError?.();

    const normalizedEmail = normalizeCustomerEmail(email);

    if (mode === 'signup') {
      const cleanName = displayName.trim();
      if (cleanName.length < 2) {
        setLocalError('Masukkan nama lengkap atau nama band Anda (minimal 2 karakter).');
        return;
      }
      if (!normalizedEmail || !isValidCustomerEmail(normalizedEmail)) {
        setLocalError('Masukkan alamat email yang valid.');
        return;
      }
      if (!password || password.length < 6) {
        setLocalError('Password minimal terdiri dari 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Konfirmasi password belum sama dengan password yang dimasukkan.');
        return;
      }

      setActiveAction('email');
      try {
        await registerClientWithEmailPassword({
          displayName: cleanName,
          email: normalizedEmail,
          password,
        });
        navigate(targetDestination, { replace: true });
      } catch (err) {
        setLocalError(
          err?.message || 'Tidak dapat menyelesaikan pendaftaran saat ini. Silakan coba lagi.',
        );
      } finally {
        setActiveAction('');
      }
      return;
    }

    if (!normalizedEmail || !isValidCustomerEmail(normalizedEmail)) {
      setLocalError('Masukkan alamat email yang valid.');
      return;
    }
    if (!password) {
      setLocalError('Masukkan password Anda.');
      return;
    }

    setActiveAction('email');
    try {
      await loginClientWithEmailPassword(normalizedEmail, password);
      navigate(targetDestination, { replace: true });
    } catch (err) {
      setLocalError(err?.message || 'Tidak dapat menyelesaikan masuk saat ini. Silakan coba lagi.');
    } finally {
      setActiveAction('');
    }
  };

  const handleResetPasswordSubmit = async (event) => {
    event.preventDefault();
    if (isBusy) return;

    setLocalError('');
    setResetSuccessMessage('');
    clearClientAuthError?.();

    const normalizedResetEmail = normalizeCustomerEmail(resetEmail);
    if (!normalizedResetEmail || !isValidCustomerEmail(normalizedResetEmail)) {
      setLocalError('Masukkan alamat email yang valid.');
      return;
    }

    setActiveAction('reset');
    try {
      const result = await resetClientPassword(normalizedResetEmail);
      setResetSuccessMessage(result?.message || '');
    } catch (err) {
      setLocalError(
        err?.message || 'Tidak dapat mengirim instruksi reset password saat ini. Silakan coba lagi.',
      );
    } finally {
      setActiveAction('');
    }
  };

  const handleGoogleContinue = async () => {
    if (isBusy) return;

    setLocalError('');
    clearClientAuthError?.();
    setActiveAction('google');

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
      setActiveAction('');
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

            <div className="relative z-10 mt-8 hidden border-t border-white/10 pt-6 sm:block">
              <div className="flex items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs">
                <div className="flex items-end gap-1.5" aria-hidden="true">
                  {AMBIENT_LEVEL_BARS.map((bar) => (
                    <span key={bar.id} className={`w-2 rounded-full ${bar.height} ${bar.tone}`} />
                  ))}
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] font-bold tracking-[0.16em] text-[#C8F13A] uppercase">
                    INSTANT PORTAL ACCESS
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-300">
                    Akses cepat dengan Email &amp; Password atau Google tanpa persetujuan manual
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Authentication Column (Email/Password Sign-In / Sign-Up + Reset + Google) */}
          <section className="flex flex-col justify-between bg-white p-6 sm:p-9 lg:col-span-6 lg:p-11">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#FAF8F3] px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-[#46433D] uppercase">
                <Sparkles className="h-3 w-3 text-[#FF4B22]" aria-hidden="true" />
                <span>
                  {mode === 'reset'
                    ? 'Pemulihan Akses'
                    : mode === 'signup'
                      ? 'Buat Akun Baru'
                      : 'Selamat Datang'}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#151515] sm:text-3xl">
                {mode === 'reset'
                  ? 'Reset Password Akun'
                  : mode === 'signup'
                    ? 'Daftar Client Portal'
                    : 'Masuk ke Client Portal'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#666159]">
                {mode === 'reset'
                  ? 'Masukkan alamat email akun Client Portal Anda untuk menerima tautan pengaturan ulang password.'
                  : mode === 'signup'
                    ? 'Buat akun menggunakan email & password untuk langsung memesan sesi dan memantau tagihan studio.'
                    : 'Masuk dengan email & password Anda atau gunakan akun Google pribadi Anda.'}
              </p>

              {/* Calm Staff / Owner Notice if currently logged into Admin */}
              {isStaffSessionActive ? (
                <div
                  role="status"
                  data-testid="client-login-staff-notice"
                  className="mt-5 space-y-3 rounded-2xl border border-[#151515]/12 bg-[#FAF8F3] p-4 text-xs text-[#46433D]"
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
                      <span>Keluar &amp; Ganti Akun</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Safe Inline Authentication Error */}
              {displayedError ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  data-testid="client-login-error-alert"
                  className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFF4F1] p-4 text-xs leading-relaxed font-medium text-[#9A270B] sm:text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{displayedError}</span>
                </div>
              ) : null}

              {/* Safe Password Reset Confirmation */}
              {resetSuccessMessage ? (
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="client-reset-success-alert"
                  className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/25 bg-[#E6F6EC] p-4 text-xs leading-relaxed font-medium text-[#0F6246] sm:text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{resetSuccessMessage}</span>
                </div>
              ) : null}

              {mode === 'reset' ? (
                <form
                  onSubmit={handleResetPasswordSubmit}
                  noValidate
                  data-testid="client-reset-password-form"
                  className="mt-6 space-y-4"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="client-reset-email"
                      className="block text-xs font-semibold tracking-wide text-[#151515]"
                    >
                      Alamat Email Terdaftar
                    </label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#666159]"
                        aria-hidden="true"
                      />
                      <input
                        id="client-reset-email"
                        data-testid="client-reset-email-input"
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          setLocalError('');
                          clearClientAuthError?.();
                        }}
                        placeholder="nama@email.com"
                        disabled={isBusy}
                        className="min-h-11 w-full rounded-xl border border-[#151515]/15 bg-white pr-4 pl-10 text-sm text-[#151515] transition-colors placeholder:text-[#8B857B] focus:border-[#151515] focus:ring-3 focus:ring-[#C8F13A]/45 focus:outline-none disabled:bg-neutral-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-testid="client-reset-submit-button"
                    disabled={isBusy}
                    aria-busy={activeAction === 'reset'}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#151515] px-5 py-3 text-sm font-semibold text-[#C8F13A] shadow-[0_8px_20px_-8px_rgba(21,21,21,0.35)] transition-all hover:bg-[#262521] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {activeAction === 'reset' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Mengirim tautan...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                        <span>Kirim Link Reset Password</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    data-testid="client-back-to-signin-button"
                    disabled={isBusy}
                    onClick={() => handleModeSwitch('signin')}
                    className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-4 py-2 text-xs font-semibold text-[#151515] hover:border-[#151515]/30"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kembali ke Masuk</span>
                  </button>
                </form>
              ) : (
                <>
                  {/* Mode Switcher Tabs */}
                  <div
                    role="tablist"
                    aria-label="Pilih mode masuk atau pendaftaran Client Portal"
                    data-testid="client-auth-mode-tabs"
                    className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-[#151515]/10 bg-[#F4F1E8] p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'signin'}
                      data-testid="client-auth-tab-signin"
                      disabled={isBusy}
                      onClick={() => handleModeSwitch('signin')}
                      className={`min-h-10 cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                        mode === 'signin'
                          ? 'bg-[#151515] text-[#C8F13A] shadow-xs'
                          : 'text-[#46433D] hover:text-[#151515]'
                      }`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'signup'}
                      data-testid="client-auth-tab-signup"
                      disabled={isBusy}
                      onClick={() => handleModeSwitch('signup')}
                      className={`min-h-10 cursor-pointer rounded-xl px-3 py-2 text-xs font-bold transition-all sm:text-sm ${
                        mode === 'signup'
                          ? 'bg-[#151515] text-[#C8F13A] shadow-xs'
                          : 'text-[#46433D] hover:text-[#151515]'
                      }`}
                    >
                      Daftar Akun
                    </button>
                  </div>

                  {/* Manual Email & Password Form */}
                  <form
                    onSubmit={handleEmailAuthSubmit}
                    noValidate
                    data-testid="client-email-auth-form"
                    className="mt-5 space-y-3.5"
                  >
                    {mode === 'signup' ? (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="client-signup-name"
                          className="block text-xs font-semibold tracking-wide text-[#151515]"
                        >
                          Nama Lengkap / Band
                        </label>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#666159]"
                            aria-hidden="true"
                          />
                          <input
                            id="client-signup-name"
                            data-testid="client-signup-name-input"
                            type="text"
                            autoComplete="name"
                            maxLength={120}
                            value={displayName}
                            onChange={(e) => {
                              setDisplayName(e.target.value);
                              setLocalError('');
                              clearClientAuthError?.();
                            }}
                            placeholder="Contoh: Nadia Pratama / Midnight Echo"
                            disabled={isBusy}
                            className="min-h-11 w-full rounded-xl border border-[#151515]/15 bg-white pr-4 pl-10 text-sm text-[#151515] transition-colors placeholder:text-[#8B857B] focus:border-[#151515] focus:ring-3 focus:ring-[#C8F13A]/45 focus:outline-none disabled:bg-neutral-50"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <label
                        htmlFor="client-auth-email"
                        className="block text-xs font-semibold tracking-wide text-[#151515]"
                      >
                        Alamat Email
                      </label>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#666159]"
                          aria-hidden="true"
                        />
                        <input
                          id="client-auth-email"
                          data-testid="client-auth-email-input"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setLocalError('');
                            clearClientAuthError?.();
                          }}
                          placeholder="nama@email.com"
                          disabled={isBusy}
                          className="min-h-11 w-full rounded-xl border border-[#151515]/15 bg-white pr-4 pl-10 text-sm text-[#151515] transition-colors placeholder:text-[#8B857B] focus:border-[#151515] focus:ring-3 focus:ring-[#C8F13A]/45 focus:outline-none disabled:bg-neutral-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="client-auth-password"
                          className="block text-xs font-semibold tracking-wide text-[#151515]"
                        >
                          Password
                        </label>
                        {mode === 'signin' ? (
                          <button
                            type="button"
                            data-testid="client-forgot-password-trigger"
                            disabled={isBusy}
                            onClick={handleOpenForgotPassword}
                            className="cursor-pointer text-xs font-semibold text-[#46433D] underline underline-offset-4 hover:text-[#FF4B22] disabled:cursor-not-allowed"
                          >
                            Lupa password?
                          </button>
                        ) : null}
                      </div>
                      <div className="relative">
                        <Lock
                          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#666159]"
                          aria-hidden="true"
                        />
                        <input
                          id="client-auth-password"
                          data-testid="client-auth-password-input"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setLocalError('');
                            clearClientAuthError?.();
                          }}
                          placeholder={
                            mode === 'signup' ? 'Minimal 6 karakter' : 'Masukkan password Anda'
                          }
                          disabled={isBusy}
                          className="min-h-11 w-full rounded-xl border border-[#151515]/15 bg-white pr-11 pl-10 text-sm text-[#151515] transition-colors placeholder:text-[#8B857B] focus:border-[#151515] focus:ring-3 focus:ring-[#C8F13A]/45 focus:outline-none disabled:bg-neutral-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                          className="absolute top-1/2 right-2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.06] hover:text-[#151515]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {mode === 'signup' ? (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="client-signup-confirm-password"
                          className="block text-xs font-semibold tracking-wide text-[#151515]"
                        >
                          Konfirmasi Password
                        </label>
                        <div className="relative">
                          <Lock
                            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#666159]"
                            aria-hidden="true"
                          />
                          <input
                            id="client-signup-confirm-password"
                            data-testid="client-signup-confirm-password-input"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setLocalError('');
                              clearClientAuthError?.();
                            }}
                            placeholder="Ulangi password Anda"
                            disabled={isBusy}
                            className="min-h-11 w-full rounded-xl border border-[#151515]/15 bg-white pr-4 pl-10 text-sm text-[#151515] transition-colors placeholder:text-[#8B857B] focus:border-[#151515] focus:ring-3 focus:ring-[#C8F13A]/45 focus:outline-none disabled:bg-neutral-50"
                          />
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      data-testid="client-email-submit-button"
                      disabled={isBusy}
                      aria-busy={activeAction === 'email'}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#151515] px-5 py-3 text-sm font-semibold text-[#C8F13A] shadow-[0_8px_20px_-8px_rgba(21,21,21,0.35)] transition-all hover:bg-[#262521] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      {activeAction === 'email' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>
                            {mode === 'signup' ? 'Mendaftarkan akun...' : 'Memeriksa akses...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{mode === 'signup' ? 'Daftar & Masuk' : 'Masuk dengan Email'}</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#151515]/10" aria-hidden="true" />
                    <span className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#8B857B] uppercase">
                      ATAU
                    </span>
                    <span className="h-px flex-1 bg-[#151515]/10" aria-hidden="true" />
                  </div>

                  {/* Secondary / Instant Google Sign-In / Sign-Up CTA */}
                  <div>
                    <button
                      type="button"
                      data-testid="client-google-login-button"
                      disabled={isBusy}
                      aria-busy={activeAction === 'google' || status === 'loading'}
                      onClick={handleGoogleContinue}
                      className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-[#151515]/15 bg-white px-5 py-3 text-sm font-semibold text-[#151515] shadow-[0_6px_20px_-8px_rgba(21,21,21,0.18)] transition-all hover:border-[#151515]/40 hover:bg-[#FAF8F3] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      {activeAction === 'google' || status === 'loading' ? (
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

                    <p className="mt-2.5 text-center text-xs text-[#666159]">
                      Masuk atau daftar menggunakan akun Google Anda.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Subtle Footer & Legal Attribution */}
            <div className="mt-8 border-t border-[#151515]/10 pt-5 text-xs text-[#666159]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Dilindungi Firebase Authentication</span>
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
