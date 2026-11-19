import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';
import { isAllowedStaffRole } from '@/features/auth/auth-helpers';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EQUALIZER_BARS = [
  { id: 'bar-1', height: 'h-6', color: 'bg-studio-lime' },
  { id: 'bar-2', height: 'h-11', color: 'bg-studio-lime' },
  { id: 'bar-3', height: 'h-8', color: 'bg-studio-ivory' },
  { id: 'bar-4', height: 'h-14', color: 'bg-studio-orange' },
  { id: 'bar-5', height: 'h-10', color: 'bg-studio-lime' },
  { id: 'bar-6', height: 'h-5', color: 'bg-studio-ivory' },
  { id: 'bar-7', height: 'h-12', color: 'bg-studio-orange' },
  { id: 'bar-8', height: 'h-7', color: 'bg-studio-lime' },
  { id: 'bar-9', height: 'h-9', color: 'bg-studio-ivory' },
  { id: 'bar-10', height: 'h-4', color: 'bg-studio-lime' },
];

export function StaffLoginPage() {
  const { status, profile, role, authError, login, resetPassword, clearAuthError } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin'); // 'signin' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const [resetEmail, setResetEmail] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  const isAuthorizedSession =
    status === 'authenticated' &&
    Boolean(profile) &&
    profile.active === true &&
    isAllowedStaffRole(role);

  if (isAuthorizedSession) {
    return <Navigate to="/admin" replace />;
  }

  const displayedSignInError = localError || authError || '';

  const handleSignInSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setLocalError('');
    clearAuthError?.();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setLocalError('Please enter your studio email address.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(trimmedEmail, password);
      navigate('/admin', { replace: true });
    } catch (error) {
      setLocalError(error?.message || 'Unable to complete sign-in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenForgotPassword = () => {
    setLocalError('');
    clearAuthError?.();
    setResetError('');
    setResetSuccessMessage('');
    setResetEmail(email.trim());
    setMode('reset');
  };

  const handleBackToSignIn = () => {
    setResetError('');
    setResetSuccessMessage('');
    setLocalError('');
    setMode('signin');
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (isResetSubmitting) return;

    setResetError('');
    setResetSuccessMessage('');

    const trimmedResetEmail = resetEmail.trim();

    if (!trimmedResetEmail || !EMAIL_PATTERN.test(trimmedResetEmail)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    setIsResetSubmitting(true);

    try {
      const result = await resetPassword(trimmedResetEmail);
      setResetSuccessMessage(result.message);
    } catch (error) {
      setResetError(
        error?.message || 'Unable to send password reset instructions right now. Please try again.',
      );
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col justify-between">
      {/* Top Bar */}
      <header className="border-studio-ink bg-studio-ivory border-b-2">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="group flex min-h-11 items-center gap-2.5 pr-1"
            aria-label="37 Music Studio — Back to public website"
          >
            <span className="border-studio-ink bg-studio-ink text-studio-white group-hover:bg-studio-orange flex h-9 w-9 shrink-0 items-center justify-center border-2 font-mono text-sm font-extrabold transition-colors sm:h-10 sm:w-10 sm:text-base">
              37
            </span>
            <span className="flex flex-col">
              <span className="font-display text-base leading-none font-black tracking-tight uppercase sm:text-xl">
                37 MUSIC STUDIO
              </span>
              <span className="text-studio-muted-ink mt-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase sm:text-[10px]">
                STAFF &amp; OWNER PORTAL
              </span>
            </span>
          </Link>

          <Link
            to="/"
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-bold tracking-wider uppercase sm:px-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to public website</span>
          </Link>
        </div>
      </header>

      {/* Main Split Portal Layout */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14"
      >
        <div className="brutal-card-lg bg-studio-white grid grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left Panel: Editorial Brand Identity (Compact on mobile, full panel on desktop) */}
          <div className="border-studio-ink bg-studio-ink text-studio-white flex flex-col justify-between border-b-2 p-5 sm:p-8 lg:col-span-5 lg:border-r-2 lg:border-b-0 lg:p-10">
            <div>
              <span className="bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
                <Lock className="h-3 w-3" aria-hidden="true" />
                <span>STAFF &amp; OWNER ACCESS</span>
              </span>

              <h1 className="font-display text-studio-white mt-3 text-4xl leading-[0.94] font-black tracking-tight uppercase sm:mt-4 sm:text-5xl lg:text-6xl">
                <span>BEHIND THE</span> <span className="text-studio-orange block">SOUND.</span>
              </h1>

              <p className="mt-3 text-xs leading-relaxed text-neutral-300 sm:mt-4 sm:text-sm">
                Internal studio management portal for authorized 37 Music Studio owners and staff
                members. Sign in with your provisioned studio credentials.
              </p>
            </div>

            {/* Decorative Studio Equalizer & Access Policy */}
            <div className="mt-6 border-t border-neutral-800 pt-5 lg:mt-10">
              <div
                aria-hidden="true"
                className="hidden items-end gap-2 border border-neutral-800 bg-neutral-900/90 p-4 sm:flex"
              >
                {EQUALIZER_BARS.map((bar) => (
                  <span key={bar.id} className={`w-3 ${bar.height} ${bar.color}`} />
                ))}
                <span className="ml-auto font-mono text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  STUDIO OS • AUTH
                </span>
              </div>

              <div className="mt-0 flex items-start gap-2.5 sm:mt-4">
                <ShieldCheck
                  className="text-studio-lime mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="font-mono text-[11px] leading-relaxed text-neutral-300">
                  Authorized accounts only. Role permissions (Owner / Staff) are verified directly
                  against your studio profile.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: Authentication Form */}
          <div className="bg-studio-white text-studio-ink flex flex-col justify-between p-5 sm:p-8 lg:col-span-7 lg:p-10">
            {mode === 'signin' ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase">
                      INTERNAL STUDIO PORTAL
                    </p>
                    <h2 className="font-display mt-1 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      Staff &amp; Owner Sign In
                    </h2>
                  </div>
                  <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
                    EMAIL / PASSWORD
                  </span>
                </div>

                <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed font-medium sm:text-sm">
                  Use the email and password registered for your 37 Music Studio staff or owner
                  account.
                </p>

                {displayedSignInError ? (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="border-studio-ink bg-studio-ivory text-studio-error-ink mt-5 flex items-start gap-2.5 border-2 p-3.5 text-xs font-bold sm:text-sm"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{displayedSignInError}</span>
                  </div>
                ) : null}

                <form onSubmit={handleSignInSubmit} noValidate className="mt-5 space-y-4">
                  {/* Email Field */}
                  <div>
                    <label
                      htmlFor="staff-login-email"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Studio Email Address <span className="text-studio-error-ink">*</span>
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="staff-login-email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        disabled={isSubmitting}
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          if (localError) setLocalError('');
                        }}
                        placeholder="owner@37studio.com"
                        className="border-studio-ink bg-studio-ivory min-h-12 w-full border-2 py-2.5 pr-3 pl-10 text-sm font-medium placeholder:text-neutral-500 disabled:opacity-60"
                      />
                      <Mail
                        className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  {/* Password Field with Visibility Toggle */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="staff-login-password"
                        className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                      >
                        Password <span className="text-studio-error-ink">*</span>
                      </label>
                    </div>

                    <div className="relative mt-1.5 flex items-center">
                      <input
                        id="staff-login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        disabled={isSubmitting}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (localError) setLocalError('');
                        }}
                        placeholder="Enter your password"
                        className="border-studio-ink bg-studio-ivory min-h-12 w-full border-2 py-2.5 pr-12 pl-10 text-sm font-medium placeholder:text-neutral-500 disabled:opacity-60"
                      />
                      <KeyRound
                        className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        className="text-studio-ink hover:bg-studio-lime absolute right-1 inline-flex h-11 w-11 cursor-pointer items-center justify-center transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password Trigger */}
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleOpenForgotPassword}
                      className="text-studio-ink hover:text-studio-orange inline-flex min-h-11 cursor-pointer items-center px-1 font-mono text-xs font-bold underline"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* Primary Sign In CTA */}
                  <button
                    type="submit"
                    disabled={isSubmitting || status === 'loading'}
                    aria-busy={isSubmitting || status === 'loading'}
                    className="brutal-btn bg-studio-orange text-studio-white flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting || status === 'loading' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span>Verifying Studio Access...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              /* Forgot Password Flow */
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase">
                      PASSWORD RECOVERY
                    </p>
                    <h2 className="font-display mt-1 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      Forgot Password
                    </h2>
                  </div>
                  <span className="border-studio-ink bg-studio-lime border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
                    ACCOUNT RESET
                  </span>
                </div>

                <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed font-medium sm:text-sm">
                  Enter the email address associated with your studio account. We will send password
                  reset instructions if a matching account exists.
                </p>

                {resetError ? (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="border-studio-ink bg-studio-ivory text-studio-error-ink mt-5 flex items-start gap-2.5 border-2 p-3.5 text-xs font-bold sm:text-sm"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{resetError}</span>
                  </div>
                ) : null}

                {resetSuccessMessage ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="border-studio-ink bg-studio-lime text-studio-ink mt-5 flex items-start gap-2.5 border-2 p-4 text-xs font-bold sm:text-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{resetSuccessMessage}</span>
                  </div>
                ) : null}

                <form onSubmit={handleResetSubmit} noValidate className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="staff-reset-email"
                      className="block font-mono text-[11px] font-bold tracking-wider uppercase"
                    >
                      Studio Email Address <span className="text-studio-error-ink">*</span>
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="staff-reset-email"
                        name="resetEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        required
                        disabled={isResetSubmitting}
                        value={resetEmail}
                        onChange={(event) => {
                          setResetEmail(event.target.value);
                          if (resetError) setResetError('');
                        }}
                        placeholder="owner@37studio.com"
                        className="border-studio-ink bg-studio-ivory min-h-12 w-full border-2 py-2.5 pr-3 pl-10 text-sm font-medium placeholder:text-neutral-500 disabled:opacity-60"
                      />
                      <Mail
                        className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isResetSubmitting}
                      className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-3 text-xs font-extrabold tracking-wider uppercase disabled:opacity-70 sm:text-sm"
                    >
                      {isResetSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Reset Instructions</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleBackToSignIn}
                      className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-12 cursor-pointer items-center justify-center gap-1.5 px-5 py-3 text-xs font-extrabold tracking-wider uppercase sm:text-sm"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bottom Security & Public Website Notice */}
            <div className="border-studio-ink mt-8 border-t-2 pt-4">
              <p className="text-studio-muted-ink text-xs leading-relaxed">
                <strong>Note for studio visitors:</strong> This page is reserved for internal 37
                Music Studio staff and owners. Looking to book a rehearsal or recording session?{' '}
                <Link to="/" className="text-studio-ink font-bold underline hover:text-[#FF4B22]">
                  Return to the public website
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="border-studio-ink bg-studio-ink text-studio-ivory border-t-2 py-4">
        <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-2 px-4 font-mono text-[11px] text-neutral-400 sm:flex-row sm:px-6 lg:px-8">
          <p>© 2026 37 Music Studio • Internal Authentication Portal</p>
          <p>Provisioned Staff &amp; Owner Access Only</p>
        </div>
      </footer>
    </div>
  );
}

export default StaffLoginPage;
