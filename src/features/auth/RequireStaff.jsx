import { Loader2, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from './AuthContext';
import { isAllowedStaffRole } from './auth-helpers';

export function RequireStaff({ children }) {
  const { status, accountType, profile, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col items-center justify-center p-4"
      >
        <div className="brutal-card-lg bg-studio-white w-full max-w-md p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-[#151515] bg-[#C8F13A]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
          <p className="mt-4 font-mono text-[11px] font-bold tracking-wider uppercase">
            37 MUSIC STUDIO • SECURITY CHECK
          </p>
          <h1 className="font-display mt-2 text-2xl leading-none font-black uppercase sm:text-3xl">
            Verifying Studio Access
          </h1>
          <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed font-medium sm:text-sm">
            Checking your authenticated session and studio staff profile...
          </p>
          <div className="border-studio-ink bg-studio-ivory mt-4 inline-flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] font-bold uppercase">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Protected Route</span>
          </div>
        </div>
      </div>
    );
  }

  const isAuthorized =
    status === 'authenticated' &&
    accountType !== 'client' &&
    Boolean(profile) &&
    profile.active === true &&
    isAllowedStaffRole(role) &&
    isAllowedStaffRole(profile.role);

  if (!isAuthorized) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
