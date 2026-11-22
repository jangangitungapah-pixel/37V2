import { AlertTriangle, Database, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function FactoryResetPreview({
  preflight = null,
  isLoading = false,
  error = '',
  isLocked = false,
  onRefresh,
  onRequestStartReset,
}) {
  const canStartDestructive = Boolean(
    !isLoading && preflight?.isComplete === true && !isLocked && !error,
  );

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="factory-reset-preview-heading"
      data-testid="factory-reset-preview-section"
      className="p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#151515]/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#151515]/10 bg-[#FAF8F3] text-[#151515]">
            <Database className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="factory-reset-preview-heading"
              className="text-sm font-bold tracking-tight text-[#151515] sm:text-base"
            >
              Pratinjau Data Operasional yang Akan Dihapus (Dry Run)
            </h2>
            <p className="text-xs text-[#666159]">
              Jumlah dokumen dihitung langsung dari Cloud Firestore tanpa melakukan mutasi data.
            </p>
          </div>
        </div>

        <AdminButton variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isLoading ? 'Menghitung...' : 'Hitung Ulang'}</span>
        </AdminButton>
      </div>

      {isLoading && !preflight ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="factory-reset-preview-loading"
          className="mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#151515]/10 bg-[#FAF8F3] px-4 py-10 text-center"
        >
          <Loader2 className="h-6 w-6 animate-spin text-[#151515]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#151515]">
            Menghitung jumlah dokumen pada 18 target operasional...
          </p>
          <p className="text-xs text-[#666159]">
            Sedang melakukan agregasi jumlah koleksi utama dan subkoleksi Booking Request.
          </p>
        </div>
      ) : null}

      {error || (preflight && !preflight.isComplete) ? (
        <div
          role="alert"
          data-testid="factory-reset-preview-error"
          className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            <div className="space-y-1.5">
              <p className="font-bold">
                Pratinjau belum lengkap — tombol Factory Reset dinonaktifkan demi keamanan.
              </p>
              <p>{error || 'Beberapa koleksi tidak dapat dihitung jumlahnya.'}</p>
              {preflight?.failedTargets?.length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-4 font-mono text-[11px]">
                  {preflight.failedTargets.map((target) => (
                    <li key={target.key}>
                      {target.pathPattern}: {target.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {preflight ? (
        <>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-red-200/80 bg-red-50/40 p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-red-800 uppercase">
                Koleksi Utama Dihapus
              </dt>
              <dd className="mt-1 text-xl font-bold text-[#151515]">
                {typeof preflight.topLevelDocumentCount === 'number'
                  ? preflight.topLevelDocumentCount
                  : 'Error'}
              </dd>
            </div>

            <div className="rounded-xl border border-red-200/80 bg-red-50/40 p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-red-800 uppercase">
                Subkoleksi Request
              </dt>
              <dd className="mt-1 text-xl font-bold text-[#151515]">
                {typeof preflight.subcollectionDocumentCount === 'number'
                  ? preflight.subcollectionDocumentCount
                  : 'Error'}
              </dd>
            </div>

            <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
                Estimasi Total Hapus
              </dt>
              <dd className="mt-1 text-xl font-bold text-[#151515]">
                {typeof preflight.totalDeleteOperations === 'number'
                  ? `${preflight.totalDeleteOperations} dok`
                  : 'Tidak lengkap'}
              </dd>
              {typeof preflight.estimatedBatchCommits === 'number' ? (
                <p className="mt-0.5 font-mono text-[10.5px] text-[#666159]">
                  ~{preflight.estimatedBatchCommits} batch commit
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#8BAD12]/35 bg-[#F4FBE0] p-3.5">
              <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#243300] uppercase">
                Konfigurasi &amp; Aset Dijaga
              </dt>
              <dd className="mt-1 text-xl font-bold text-[#151515]">
                {preflight.preservedDetectedCount} item terdeteksi
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {preflight.groupedItems.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-[#151515]/10 bg-[#FAF8F3]/75 p-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                  <h3 className="text-xs font-bold tracking-tight text-[#151515] sm:text-sm">
                    {group.label}
                  </h3>
                  <AdminStatusBadge tone={group.hasError ? 'danger' : 'ivory'} size="sm">
                    {group.hasError ? 'Incomplete' : `${group.totalCount} dokumen`}
                  </AdminStatusBadge>
                </div>

                <ul className="mt-2.5 divide-y divide-[#151515]/[0.06] text-xs">
                  {group.targets.map((target) => (
                    <li key={target.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#151515]">{target.label}</p>
                        <p className="truncate font-mono text-[10.5px] text-[#756F65]">
                          {target.pathPattern}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-xs font-bold ${
                          target.ok ? 'text-[#151515]' : 'text-red-700'
                        }`}
                      >
                        {target.ok ? target.count : 'ERR'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#151515]/[0.08] pt-4">
            <p className="text-xs text-[#666159]">
              {preflight.totalDeleteOperations === 0 && preflight.isComplete
                ? 'Seluruh koleksi operasional sudah kosong (0 dokumen). Anda tetap dapat menjalankan verifikasi & re-inisialisasi bersih bila diperlukan.'
                : 'Pastikan Anda telah mencadangkan laporan penting sebelum memulai penghapusan permanen.'}
            </p>

            <AdminButton
              variant="danger"
              size="md"
              disabled={!canStartDestructive}
              onClick={onRequestStartReset}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Mulai Factory Reset</span>
            </AdminButton>
          </div>
        </>
      ) : null}
    </AdminSurface>
  );
}
