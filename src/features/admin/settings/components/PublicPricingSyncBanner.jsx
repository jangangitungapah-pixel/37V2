import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';
import { useOptionalOwnerPublicPricingSync } from '@/features/public-pricing/context/OwnerPublicPricingSyncContext';
import { useOwnerPublicPricingAutoSync } from '@/features/public-pricing/hooks/useOwnerPublicPricingAutoSync';

/**
 * Owner-only operational banner on Price & Fee Settings surfacing sync status between
 * private `settings/pricing` and customer-safe `publicPricingCatalog/current`.
 * Never auto-migrates or auto-writes legacy V1 documents or unpersisted defaults.
 */
export function PublicPricingSyncBanner({
  isOwner = false,
  isPersisted = false,
  migratedFromV1 = false,
  serverVersion = 1,
}) {
  const { user, role } = useAuth();
  const contextSync = useOptionalOwnerPublicPricingSync();
  const fallbackSync = useOwnerPublicPricingAutoSync({
    enabled: !contextSync && Boolean(isOwner && !migratedFromV1),
    actorUid: user?.uid || '',
    actorRole: role || '',
  });

  const sync = contextSync || fallbackSync;
  const {
    isSyncing,
    syncError,
    syncSuccess,
    isSynced,
    needsSync,
    needsInitialSave,
    catalogVersion,
    isCatalogPersisted,
    isCatalogValid,
    isCatalogLoading,
    catalogLoadError,
    triggerSync,
  } = sync;

  if (!isOwner || migratedFromV1 || isCatalogLoading) {
    return null;
  }

  const normalizedServerVersion = Math.max(1, Number(serverVersion) || 1);

  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3.5 text-xs font-medium text-[#46433D]"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#151515]" aria-hidden="true" />
        <span>Menyinkronkan Public Pricing Catalog untuk Client Portal...</span>
      </div>
    );
  }

  if (syncSuccess && !needsSync && !syncError) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C6E82B]/45 bg-[#F2FBCC] p-3.5 text-xs text-[#2D3808]"
      >
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4F6800]" aria-hidden="true" />
          <span>{syncSuccess}</span>
        </div>
      </div>
    );
  }

  if (isSynced && !syncError) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="public-pricing-synced-banner"
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8BAD12]/35 bg-[#F4FBE0] px-3.5 py-2.5 text-xs text-[#243300]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4F6800]" aria-hidden="true" />
          <span>
            <strong>Public Pricing Catalog</strong> aktif &amp; tersinkron otomatis (v
            {normalizedServerVersion}). Diperbarui otomatis setiap kali Anda menyimpan perubahan.
          </span>
        </div>
      </div>
    );
  }

  if (needsInitialSave || (!isPersisted && !isCatalogPersisted)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 text-xs text-[#8A4B08]"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Public Pricing Catalog</strong> belum dipublikasikan ke Client Portal. Klik{' '}
          <strong>Save Changes</strong> di bawah untuk menyimpan tarif studio dan mempublikasikan
          katalog aman pelanggan.
        </span>
      </div>
    );
  }

  if (!needsSync && !syncError) {
    return null;
  }

  let reasonText = 'Public Pricing Catalog belum dipublikasikan untuk Client Portal.';
  if (catalogLoadError) {
    reasonText = `Gagal membaca Public Pricing Catalog saat ini (${catalogLoadError}). Sinkronkan ulang untuk memperbarui dokumen publik.`;
  } else if (isCatalogPersisted && !isCatalogValid) {
    reasonText =
      'Format dokumen Public Pricing Catalog tidak valid atau tertinggal. Sinkronkan ulang dari konfigurasi Owner aktif.';
  } else if (isCatalogPersisted && Number(catalogVersion) !== normalizedServerVersion) {
    reasonText = `Public Pricing Catalog (v${catalogVersion}) belum sama dengan versi Settings aktif (v${normalizedServerVersion}).`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-[#FEF4DD] p-3.5 text-xs text-[#6B3904] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" aria-hidden="true" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone="amber" size="sm">
              Public Pricing Catalog
            </AdminStatusBadge>
            <span className="font-mono text-[11px] font-semibold tracking-wide text-[#8A4B08] uppercase">
              Perlu Sinkronisasi
            </span>
          </div>
          <p className="leading-relaxed">{reasonText}</p>
          {syncError ? (
            <p className="font-medium text-[#B92B0C]" role="alert">
              {syncError}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={triggerSync}
        disabled={isSyncing}
        className="sa-control inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#151515]/15 bg-[#151515] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#2a2926] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Sync Public Catalog</span>
      </button>
    </div>
  );
}
