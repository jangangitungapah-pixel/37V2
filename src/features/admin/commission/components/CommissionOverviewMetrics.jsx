import { AlertTriangle, Banknote, CalendarCheck2, Info, Mic2, UsersRound } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminMetricCard, AdminStatusBadge } from '@/features/admin/design-system';

/**
 * Top 4 Commission Summary Metrics + Separate Reference-Only Owner Allocation Strip.
 * Formula locked: Total To Pay = Staff Commission + Recording Operator Fee (Owner Allocation excluded).
 */
export function CommissionOverviewMetrics({
  metrics,
  periodLabel = '',
  hasMoreSessions = false,
  onLoadMoreSessions,
  zeroPayableCount = 0,
}) {
  const scopeNote = hasMoreSessions
    ? 'Sebagian periode termuat (ada sesi lain)'
    : periodLabel || 'Periode aktif';

  return (
    <div className="mt-3 space-y-2.5 border-t border-[#151515]/[0.07] pt-3 sm:mt-5 sm:space-y-3.5 sm:pt-5">
      <dl
        aria-label="Ringkasan Commission and Fee"
        className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4"
      >
        <AdminMetricCard
          label="Completed Sessions"
          value={metrics.completedSessionsCount}
          hint={`Sesi selesai siap posting (${scopeNote})`}
          icon={CalendarCheck2}
          tone="neutral"
          compactMobile
        />

        <AdminMetricCard
          label="Staff Commission"
          value={formatRupiah(metrics.staffCommissionTotal)}
          hint="Staff / penjaga studio"
          icon={UsersRound}
          tone="neutral"
          compactMobile
        />

        <AdminMetricCard
          label="Recording Operator Fee"
          value={formatRupiah(metrics.recordingOperatorFeeTotal)}
          hint="Recording Operator / External PIC"
          icon={Mic2}
          tone="neutral"
          compactMobile
        />

        <AdminMetricCard
          label="Total To Pay"
          value={formatRupiah(metrics.payableTotal)}
          hint="Total dibayar ke Staff & Operator"
          icon={Banknote}
          tone="lime"
          compactMobile
        />
      </dl>

      {/* Separate Reference-Only Owner Allocation Strip */}
      <div className="sa-panel-ivory flex flex-col gap-1.5 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-3.5 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
          <span className="font-semibold text-[#151515]">Owner Allocation:</span>
          <AdminStatusBadge tone="neutral" className="font-mono font-bold tabular-nums">
            {formatRupiah(metrics.ownerAllocationReferenceTotal)}
          </AdminStatusBadge>
          <span className="hidden text-[11px] text-[#666159] sm:inline">
            (Referensi internal saja — tidak masuk Total To Pay &amp; tidak diposting sebagai hutang
            biaya)
          </span>
        </div>

        {zeroPayableCount > 0 ? (
          <span className="shrink-0 font-mono text-[11px] font-medium text-[#666159]">
            +{zeroPayableCount} sesi fee Rp 0 dilewati
          </span>
        ) : null}
      </div>

      {/* Partial Period Loading Indicator */}
      {hasMoreSessions ? (
        <div
          role="status"
          className="flex flex-col gap-2.5 rounded-2xl border border-amber-500/25 bg-[#FEF4DD] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-[#8A4B08]">More sessions available</p>
              <p className="mt-0.5 text-[11px] text-[#8A4B08]/90">
                Masih ada sesi selesai lain pada periode ini. Angka ringkasan di atas hanya
                menghitung sesi yang sudah dimuat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadMoreSessions}
            className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center px-3.5 py-1.5 text-xs font-semibold"
          >
            Load More Sessions
          </button>
        </div>
      ) : null}
    </div>
  );
}
