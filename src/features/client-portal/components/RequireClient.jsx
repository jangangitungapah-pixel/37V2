import { Loader2, ShieldCheck } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_ACCOUNT_STATUS, CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';
import { isClientRole } from '../utils/client-auth-helpers';

/**
 * Resolves full Client Portal authorization before rendering any protected portal route:
 * 1. Firebase Auth state settled (`status === 'authenticated'` with `user.uid`)
 * 2. Canonical `accountType === 'client'` (and strictly `profile === null`)
 * 3. Active `clientAccount` (`role === 'client'`, `status === 'active'`, `uid` match)
 * 4. Valid bound `clientProfile` (`customerId` match and `status === 'active'`)
 */
export function RequireClient({ children }) {
  const { status, accountType, user, profile, clientAccount, clientProfile, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="require-client-loading"
        className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-[#151515]/15 bg-white p-6 text-center shadow-[0_24px_60px_-20px_rgba(21,21,21,0.18)] sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#151515] text-[#C8F13A]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
          <p className="mt-4 font-mono text-[10.5px] font-bold tracking-[0.18em] text-[#666159] uppercase">
            37 Music Studio • Client Portal
          </p>
          <h1 className="font-display mt-2 text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl">
            Memverifikasi Sesi Anda
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#666159] sm:text-sm">
            Memeriksa akun Client dan profil studio Anda secara aman...
          </p>
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#FAF8F3] px-3 py-1 font-mono text-[10px] font-semibold text-[#46433D] uppercase">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
            <span>Protected Client Session</span>
          </div>
        </div>
      </div>
    );
  }

  const isAuthorizedClient = Boolean(
    status === 'authenticated' &&
    user?.uid &&
    accountType === 'client' &&
    profile === null &&
    isClientRole(role) &&
    clientAccount &&
    clientAccount.uid === user.uid &&
    clientAccount.role === 'client' &&
    clientAccount.status === CLIENT_ACCOUNT_STATUS.ACTIVE &&
    clientAccount.customerId &&
    clientProfile &&
    clientProfile.customerId === clientAccount.customerId &&
    clientProfile.status === 'active',
  );

  if (!isAuthorizedClient) {
    return <Navigate to={CLIENT_PORTAL_ROUTES.LOGIN} replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default RequireClient;
