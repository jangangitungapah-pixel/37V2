import { AlertTriangle, Banknote, CalendarCheck2, Info, Mic2, UsersRound } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';

/**
 * Top 4 Commission Summary Metrics + Separate Reference-Only Owner Allocation Strip (Section 6.C).
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
    <div className="mt-2.5 space-y-2 border-t border-neutral-200 pt-2 sm:mt-3 sm:pt-2.5">
      <dl
        aria-label="Ringkasan Commission and Fee"
        className="grid grid-cols-2 gap-1.5 sm:gap-2 xl:grid-cols-4"
      >
        {/* 1. Completed Sessions */}
        <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-1.5 border-2 px-2.5 py-2 shadow-[2px_2px_0px_#151515] sm:px-3">
          <div className="min-w-0">
            <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
              <CalendarCheck2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Completed Sessions</span>
            </dt>
            <dd className="font-display text-studio-ink mt-0.5 text-lg leading-tight font-black tabular-nums sm:mt-1 sm:text-2xl">
              {metrics.completedSessionsCount}
            </dd>
            <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
              <span className="sm:hidden">Sesi siap posting</span>
              <span className="hidden sm:inline">Sesi selesai siap diposting ({scopeNote})</span>
            </p>
          </div>
        </div>

        {/* 2. Staff Commission */}
        <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-1.5 border-2 px-2.5 py-2 shadow-[2px_2px_0px_#151515] sm:px-3">
          <div className="min-w-0">
            <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
              <UsersRound className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Staff Commission</span>
            </dt>
            <dd className="font-display text-studio-ink mt-0.5 truncate text-lg leading-tight font-black tabular-nums sm:mt-1 sm:text-2xl">
              {formatRupiah(metrics.staffCommissionTotal)}
            </dd>
            <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
              Staff / Studio Guard
            </p>
          </div>
        </div>

        {/* 3. Recording Operator Fee */}
        <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-1.5 border-2 px-2.5 py-2 shadow-[2px_2px_0px_#151515] sm:px-3">
          <div className="min-w-0">
            <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
              <Mic2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="sm:hidden">Operator Fee</span>
                <span className="hidden sm:inline">Recording Operator Fee</span>
              </span>
            </dt>
            <dd className="font-display text-studio-ink mt-0.5 truncate text-lg leading-tight font-black tabular-nums sm:mt-1 sm:text-2xl">
              {formatRupiah(metrics.recordingOperatorFeeTotal)}
            </dd>
            <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
              <span className="sm:hidden">Operator / External PIC</span>
              <span className="hidden sm:inline">Recording Operator / External PIC</span>
            </p>
          </div>
        </div>

        {/* 4. Total To Pay (Staff + Operator ONLY) */}
        <div className="border-studio-ink bg-studio-lime/40 flex items-center justify-between gap-1.5 border-2 px-2.5 py-2 shadow-[2px_2px_0px_#151515] sm:px-3">
          <div className="min-w-0">
            <dt className="text-studio-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
              <Banknote className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">Total To Pay</span>
            </dt>
            <dd className="font-display text-studio-ink mt-0.5 truncate text-lg leading-tight font-black tabular-nums sm:mt-1 sm:text-2xl">
              {formatRupiah(metrics.payableTotal)}
            </dd>
            <p className="text-studio-ink mt-0.5 truncate font-mono text-[8.5px] font-bold sm:text-[9px]">
              <span className="sm:hidden">Staff + Operator</span>
              <span className="hidden sm:inline">Total dibayar ke Staff &amp; Operator</span>
            </p>
          </div>
        </div>
      </dl>

      {/* Separate Reference-Only Owner Allocation Strip */}
      <div className="border-studio-ink bg-studio-ivory/80 flex flex-col gap-1 border border-dashed px-2.5 py-1.5 font-mono text-[10px] sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Info className="text-studio-muted-ink h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-studio-ink font-extrabold uppercase">Owner Allocation:</span>
          <span className="border-studio-ink bg-studio-white text-studio-ink border px-1.5 py-0.5 font-black tabular-nums">
            {formatRupiah(metrics.ownerAllocationReferenceTotal)}
          </span>
          <span className="text-studio-muted-ink font-semibold">
            (Referensi internal saja — tidak masuk Total To Pay &amp; tidak diposting sebagai hutang
            biaya)
          </span>
        </div>

        {zeroPayableCount > 0 ? (
          <span className="text-studio-subtle-ink shrink-0 font-bold">
            +{zeroPayableCount} sesi fee Rp 0 dilewati
          </span>
        ) : null}
      </div>

      {/* Partial Period Loading Indicator */}
      {hasMoreSessions ? (
        <div
          role="status"
          className="border-studio-ink flex flex-col gap-2 border-2 bg-amber-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 font-mono text-[10.5px]">
              <p className="text-studio-ink font-extrabold uppercase">More sessions available</p>
              <p className="text-studio-muted-ink mt-0.5 text-[10px] font-semibold">
                Masih ada sesi selesai lain pada periode ini. Angka ringkasan di atas hanya
                menghitung sesi yang sudah dimuat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLoadMoreSessions}
            className="cal-control border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center px-3 py-1 font-mono text-[10px] font-extrabold uppercase"
          >
            Load More Sessions
          </button>
        </div>
      ) : null}
    </div>
  );
}
