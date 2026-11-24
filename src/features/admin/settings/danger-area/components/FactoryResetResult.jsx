import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { FACTORY_RESET_DELETION_MANIFEST } from '../config/factory-reset-config';

export function FactoryResetResult({ operation, onDoneResetView }) {
  const nestedKeys = new Set([
    'publicBookingRequests_communications',
    'publicBookingRequests_activities',
  ]);
  const counts = operation?.deletedDocumentCounts || {};
  const nestedDeletedTotal = Object.entries(counts).reduce(
    (sum, [key, count]) => (nestedKeys.has(key) ? sum + Number(count || 0) : sum),
    0,
  );

  return (
    <AdminSurface
      as="section"
      variant="card"
      data-testid="factory-reset-result-section"
      aria-labelledby="factory-reset-result-heading"
      className="border-[#8BAD12]/50 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151515]/[0.08] pb-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#8BAD12]/40 bg-[#C8F13A] text-[#151515]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="factory-reset-result-heading"
                className="text-lg font-bold tracking-tight text-[#151515] sm:text-xl"
              >
                Factory Reset Completed
              </h2>
              <AdminStatusBadge tone="emerald" dot size="sm">
                Terverifikasi Kosong (
                {operation?.verificationSummary?.checkedCollectionsCount || 20} Target)
              </AdminStatusBadge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#46433D] sm:text-sm">
              All operational data has been removed. Your Owner account, studio settings, pricing
              configuration, templates, Gallery, and published website assets remain intact.
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
            Operation Reference
          </dt>
          <dd className="mt-1 truncate font-mono font-bold text-[#151515]">
            {operation?.operationId}
          </dd>
        </div>

        <div className="min-w-0 rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
            Waktu Mulai — Selesai (WIB)
          </dt>
          <dd className="mt-1 font-semibold break-words text-[#151515]">
            {formatIndonesianTimestamp(operation?.startedAt)} →{' '}
            {formatIndonesianTimestamp(operation?.completedAt)}
          </dd>
        </div>

        <div className="min-w-0 rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
            Total Dokumen Dihapus
          </dt>
          <dd className="mt-1 text-base font-bold break-words text-[#151515]">
            {operation?.totalDeletedCount || 0} dokumen ({nestedDeletedTotal} subkoleksi)
          </dd>
        </div>

        <div className="min-w-0 rounded-xl border border-[#8BAD12]/35 bg-[#F4FBE0] p-3">
          <dt className="font-mono text-[10px] font-semibold text-[#243300] uppercase">
            Status Kalender Publik
          </dt>
          <dd className="mt-1 font-bold break-words text-[#151515]">
            Siap &amp; Kosong (isReady: true)
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <h3 className="text-xs font-bold tracking-wide text-[#46433D] uppercase">
          Rincian Penghapusan per Koleksi &amp; Subkoleksi
        </h3>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FACTORY_RESET_DELETION_MANIFEST.map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-xl border border-[#151515]/10 bg-[#FAF8F3]/70 px-3 py-2 text-xs"
            >
              <span className="truncate font-medium text-[#151515]">{step.label}</span>
              <span className="font-mono font-bold text-[#151515]">{counts[step.key] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#151515]/[0.08] pt-4">
        <Link to="/availability" className="text-xs font-semibold text-[#151515] underline">
          Periksa Kalender Publik (/availability) →
        </Link>

        <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
          <Link to="/admin/settings" className="flex-1 sm:flex-initial">
            <AdminButton
              variant="secondary"
              size="md"
              className="min-h-10 w-full justify-center sm:w-auto"
            >
              Kembali ke Settings
            </AdminButton>
          </Link>
          {onDoneResetView ? (
            <AdminButton
              variant="primary"
              size="md"
              onClick={onDoneResetView}
              className="min-h-10 flex-1 justify-center sm:flex-initial"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Muat Pratinjau Baru</span>
            </AdminButton>
          ) : null}
        </div>
      </div>
    </AdminSurface>
  );
}
