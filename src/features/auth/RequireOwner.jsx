import { ArrowLeft, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import { useAuth } from './AuthContext';

export function RequireOwner({ children }) {
  const { status, user, profile, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-studio-ivory text-studio-ink flex min-h-[60vh] flex-col items-center justify-center p-4"
      >
        <div className="brutal-card-lg bg-studio-white w-full max-w-md p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-[#151515] bg-[#C8F13A]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
          <p className="mt-4 font-mono text-[11px] font-bold tracking-wider uppercase">
            37 MUSIC STUDIO • OWNER SECURITY CHECK
          </p>
          <h1 className="font-display mt-2 text-2xl leading-none font-black uppercase sm:text-3xl">
            Verifying Owner Access
          </h1>
          <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed font-medium sm:text-sm">
            Memeriksa profil Owner aktif untuk mengakses halaman sensitif ini...
          </p>
          <div className="border-studio-ink bg-studio-ivory mt-4 inline-flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] font-bold uppercase">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Owner Only Route</span>
          </div>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated' || !user?.uid) {
    return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  }

  const isAuthorizedOwner = Boolean(
    profile && profile.active === true && role === 'owner' && profile.role === 'owner',
  );

  if (!isAuthorizedOwner) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <AdminSurface
          as="section"
          variant="card"
          role="alert"
          data-testid="require-owner-denied"
          className="border-red-200 bg-white p-6 text-center sm:p-8"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-4 font-mono text-[11px] font-semibold tracking-wider text-red-700 uppercase">
            Owner Access Required
          </p>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#151515] sm:text-2xl">
            Akses Ditolak — Khusus Owner Studio
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#666159] sm:text-sm">
            Danger Area dan operasi Factory Reset hanya dapat diakses oleh akun dengan peran Owner
            aktif. Akun Staff tidak diizinkan membuka atau menjalankan tindakan penghapusan data
            operasional.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/admin/settings">
              <AdminButton variant="secondary" size="md">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Kembali ke Settings</span>
              </AdminButton>
            </Link>
          </div>
        </AdminSurface>
      </div>
    );
  }

  return children;
}

export default RequireOwner;
