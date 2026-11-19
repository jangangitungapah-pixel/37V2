import { CalendarRange, CheckCircle2, ChevronRight } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { getBatchPeriodDisplay } from '../services/commission-review-service';

/**
 * Displays posted Commission Batches (`Posted` tab) ordered newest first with Load More pagination.
 * Clearly distinguishes "Posted to Pembukuan (Unpaid)" from actual payout (`Paid`).
 */
export function CommissionBatchHistory({
  batches = [],
  hasMore = false,
  onLoadMore,
  onSelectBatch,
  isLoading = false,
}) {
  return (
    <section
      aria-label="Riwayat batch komisi yang sudah diposting"
      className="cal-card bg-studio-white overflow-hidden"
    >
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-studio-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
            POSTED COMMISSION BATCHES
          </span>
          <span className="border-studio-ink bg-studio-white text-studio-ink border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold tabular-nums">
            {batches.length} batch
          </span>
        </div>

        <span className="text-studio-muted-ink hidden font-mono text-[9.5px] font-bold uppercase sm:inline">
          Klik batch untuk melihat rincian booking &amp; catatan Pembukuan
        </span>
      </div>

      {isLoading ? (
        <div className="text-studio-muted-ink px-4 py-10 text-center font-mono text-xs font-bold uppercase">
          Memuat riwayat posting komisi...
        </div>
      ) : batches.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-studio-ink font-mono text-xs font-extrabold uppercase">
            Belum ada batch komisi yang diposting
          </p>
          <p className="text-studio-muted-ink mt-1 text-xs">
            Setelah Anda menyetujui dan mem-posting sesi dari tab To Review, batch audit akan tampil
            di sini.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200">
          {batches.map((batch) => {
            const periodText = getBatchPeriodDisplay(batch);
            const postedText = formatIndonesianTimestamp(batch.postedAt);

            return (
              <article
                key={batch.id}
                className="hover:bg-studio-ivory/50 flex flex-col justify-between gap-3 p-3 transition-colors sm:p-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-1.5 py-0.5 font-extrabold uppercase">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Posted • Belum Dibayar di Pembukuan</span>
                    </span>
                    <span className="text-studio-ink font-extrabold">{batch.id}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-studio-ink inline-flex items-center gap-1 text-sm font-extrabold">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>Periode: {periodText}</span>
                    </p>
                    <span className="text-studio-muted-ink font-mono text-[10.5px] font-semibold">
                      • {batch.bookingCount} sesi • Diposting: {postedText}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]">
                    <span className="text-studio-muted-ink">
                      Staff:{' '}
                      <strong className="text-studio-ink">
                        {formatRupiah(batch.staffCommissionTotal)}
                      </strong>
                    </span>
                    <span className="text-studio-muted-ink">
                      Operator:{' '}
                      <strong className="text-studio-ink">
                        {formatRupiah(batch.recordingOperatorFeeTotal)}
                      </strong>
                    </span>
                    {batch.ownerAllocationReferenceTotal > 0 ? (
                      <span className="text-studio-subtle-ink">
                        Owner Ref:{' '}
                        <strong>{formatRupiah(batch.ownerAllocationReferenceTotal)}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-2.5 lg:shrink-0 lg:border-t-0 lg:pt-0">
                  <div className="font-mono lg:text-right">
                    <span className="text-studio-muted-ink block text-[9px] font-bold uppercase">
                      Total Diposting (Payable)
                    </span>
                    <span className="font-display text-studio-ink text-lg font-black tabular-nums sm:text-xl">
                      {formatRupiah(batch.payableTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectBatch?.(batch)}
                    className="cal-control border-studio-ink bg-studio-ink text-studio-white hover:bg-studio-lime hover:text-studio-ink inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase"
                  >
                    <span>Detail Batch</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore ? (
        <div className="border-studio-ink bg-studio-ivory flex justify-center border-t-2 p-3">
          <button
            type="button"
            onClick={onLoadMore}
            className="cal-control border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime min-h-9 cursor-pointer px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
          >
            Muat Batch Lebih Lama
          </button>
        </div>
      ) : null}
    </section>
  );
}
