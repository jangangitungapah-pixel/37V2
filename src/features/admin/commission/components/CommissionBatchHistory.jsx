import { CalendarRange, CheckCircle2, ChevronRight } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { getBatchPeriodDisplay } from '../services/commission-review-service';

/**
 * Displays posted Commission Batches (`Posted` tab) ordered newest first with Load More pagination.
 */
export function CommissionBatchHistory({
  batches = [],
  hasMore = false,
  onLoadMore,
  onSelectBatch,
  isLoading = false,
}) {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Riwayat batch komisi yang sudah diposting"
      className="overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
            Posted Commission Batches
          </span>
          <AdminStatusBadge tone="neutral" size="sm" className="font-mono">
            {batches.length} batch
          </AdminStatusBadge>
        </div>

        <span className="hidden text-xs text-[#666159] sm:inline">
          Klik batch untuk melihat rincian booking &amp; catatan Pembukuan
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-12 text-center text-xs font-medium text-[#666159]">
          Memuat riwayat posting komisi...
        </div>
      ) : batches.length === 0 ? (
        <div className="p-4 sm:p-6">
          <AdminEmptyState
            title="Belum ada batch komisi yang diposting"
            description="Setelah Anda menyetujui dan mem-posting sesi dari tab To Review, batch audit akan tampil di sini."
          />
        </div>
      ) : (
        <div className="divide-y divide-[#151515]/[0.06]">
          {batches.map((batch) => {
            const periodText = getBatchPeriodDisplay(batch);
            const postedText = formatIndonesianTimestamp(batch.postedAt);

            return (
              <article
                key={batch.id}
                className="flex flex-col justify-between gap-3 p-3 transition-colors hover:bg-[#FAF8F3]/70 sm:gap-3.5 sm:p-5 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusBadge tone="lime" icon={CheckCircle2} size="sm">
                      <span className="sm:hidden">Posted</span>
                      <span className="hidden sm:inline">Posted • Belum Dibayar di Pembukuan</span>
                    </AdminStatusBadge>
                    <span className="hidden font-mono text-xs font-semibold text-[#46433D] sm:inline">
                      {batch.id}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#151515]">
                      <CalendarRange
                        className="h-4 w-4 shrink-0 text-[#666159]"
                        aria-hidden="true"
                      />
                      <span>Periode: {periodText}</span>
                    </p>
                    <span className="text-xs text-[#666159]">
                      • {batch.bookingCount} sesi • Diposting: {postedText}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-[#666159]">
                    <span>
                      Staff:{' '}
                      <strong className="font-semibold text-[#151515]">
                        {formatRupiah(batch.staffCommissionTotal)}
                      </strong>
                    </span>
                    <span>
                      Operator:{' '}
                      <strong className="font-semibold text-[#151515]">
                        {formatRupiah(batch.recordingOperatorFeeTotal)}
                      </strong>
                    </span>
                    {batch.ownerAllocationReferenceTotal > 0 ? (
                      <span className="text-[#8B857B]">
                        Owner Ref:{' '}
                        <strong>{formatRupiah(batch.ownerAllocationReferenceTotal)}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-[#151515]/[0.06] pt-3 lg:shrink-0 lg:border-t-0 lg:pt-0">
                  <div className="lg:text-right">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Total Diposting (Payable)
                    </span>
                    <span className="font-mono text-base font-bold text-[#151515] tabular-nums sm:text-lg">
                      {formatRupiah(batch.payableTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectBatch?.(batch)}
                    className="sa-control sa-btn-primary inline-flex min-h-9.5 shrink-0 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                  >
                    <span>Detail Batch</span>
                    <ChevronRight className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center border-t border-[#151515]/[0.07] bg-[#FAF8F3] p-3.5">
          <button
            type="button"
            onClick={onLoadMore}
            className="sa-control sa-btn-secondary min-h-9.5 cursor-pointer px-4 py-1.5 text-xs font-semibold"
          >
            Muat Batch Lebih Lama
          </button>
        </div>
      ) : null}
    </AdminSurface>
  );
}
