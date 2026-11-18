import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

export function AdminPortalPage() {
  const { profile, user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = profile?.displayName || user?.displayName || 'Studio Team Member';
  const email = profile?.email || user?.email || '';
  const roleLabel = (role || profile?.role || 'staff').toUpperCase();
  const isOwner = roleLabel === 'OWNER';

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await logout();
      navigate('/staff/login', { replace: true });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col justify-between">
      {/* Compact Internal Portal Header */}
      <header className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="border-studio-ivory bg-studio-lime text-studio-ink flex h-9 w-9 shrink-0 items-center justify-center border font-mono text-sm font-extrabold">
              37
            </span>
            <div>
              <p className="font-display text-lg leading-none font-black tracking-tight uppercase sm:text-xl">
                37 MUSIC STUDIO
              </p>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-neutral-300 uppercase">
                INTERNAL ADMIN PORTAL
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              className={
                isOwner
                  ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-9 items-center gap-1.5 border px-3 py-1 font-mono text-xs font-extrabold tracking-wider uppercase'
                  : 'border-studio-ivory bg-studio-orange text-studio-white inline-flex min-h-9 items-center gap-1.5 border px-3 py-1 font-mono text-xs font-extrabold tracking-wider uppercase'
              }
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ROLE: {roleLabel}</span>
            </span>

            <Link
              to="/"
              className="border-studio-ivory bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-11 items-center gap-1.5 border px-3.5 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Website</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="bg-studio-orange text-studio-white hover:bg-studio-lime hover:text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-neutral-800 px-4 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors disabled:opacity-60"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Authenticated Portal Content */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        {/* Welcome Banner Card */}
        <section
          aria-labelledby="admin-welcome-heading"
          className="brutal-card-lg bg-studio-white p-6 sm:p-8 lg:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-[1.5px] px-3 py-1 font-mono text-[11px] font-extrabold tracking-wider uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>AUTHENTICATED SESSION ACTIVE</span>
            </span>

            <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
              PHASE 3 FOUNDATION
            </span>
          </div>

          <h1
            id="admin-welcome-heading"
            className="font-display text-studio-ink mt-4 text-4xl leading-none font-black tracking-tight uppercase sm:text-5xl lg:text-6xl"
          >
            Welcome to 37 Studio.
          </h1>

          <p className="text-studio-muted-ink mt-3 max-w-2xl text-sm leading-relaxed font-semibold sm:text-base">
            Your studio account has been authenticated successfully.
          </p>

          {/* Verified Identity Details */}
          <dl
            aria-label="Authenticated staff identity"
            className="border-studio-ink bg-studio-ivory mt-6 grid grid-cols-1 gap-4 border-2 p-5 sm:grid-cols-3"
          >
            <div className="border-studio-ink bg-studio-white border p-3.5">
              <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Display Name</span>
              </dt>
              <dd className="text-studio-ink mt-1.5 text-base font-extrabold break-words">
                {displayName}
              </dd>
            </div>

            <div className="border-studio-ink bg-studio-white border p-3.5">
              <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Authenticated Email</span>
              </dt>
              <dd className="text-studio-ink mt-1.5 font-mono text-xs font-bold break-all sm:text-sm">
                {email}
              </dd>
            </div>

            <div className="border-studio-ink bg-studio-white border p-3.5">
              <dt className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Authorized Studio Role</span>
              </dt>
              <dd className="mt-1.5">
                <span
                  className={
                    isOwner
                      ? 'border-studio-ink bg-studio-lime text-studio-ink inline-block border px-2.5 py-0.5 font-mono text-xs font-extrabold uppercase'
                      : 'border-studio-ink bg-studio-orange text-studio-white inline-block border px-2.5 py-0.5 font-mono text-xs font-extrabold uppercase'
                  }
                >
                  {roleLabel}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Placeholder Foundation Panel */}
        <section
          aria-labelledby="portal-foundation-heading"
          className="brutal-card bg-studio-ink text-studio-white mt-7 p-6 sm:p-8"
        >
          <span className="bg-studio-orange text-studio-white inline-block px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase">
            PORTAL STATUS
          </span>

          <h2
            id="portal-foundation-heading"
            className="font-display text-studio-white mt-3 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl"
          >
            Admin Portal Foundation — operational modules will be introduced in future phases.
          </h2>

          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-neutral-300 sm:text-sm">
            Firebase Authentication, Cloud Firestore staff profile verification (
            <code className="text-studio-lime font-mono">staffProfiles/&#123;uid&#125;</code>),
            session persistence, and protected routing are active. Studio scheduling, booking
            management, and operational workflows will be added in subsequent phases.
          </p>

          <div className="mt-6 flex flex-col gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:items-center">
            <Link
              to="/"
              className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Return to public website</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out of Studio Session</span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-studio-ink bg-studio-ink text-studio-ivory border-t-2 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 font-mono text-[11px] text-neutral-400 sm:flex-row sm:px-6 lg:px-8">
          <p>© 2026 37 Music Studio • Authenticated Admin Portal Foundation</p>
          <p>Signed in as {email}</p>
        </div>
      </footer>
    </div>
  );
}

export default AdminPortalPage;
