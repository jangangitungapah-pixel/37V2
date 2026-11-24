import { AlertTriangle, CheckSquare, Send, ShieldAlert } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { MAX_BOOKINGS_PER_COMMISSION_BATCH } from '../schemas/commission-schema';

/**
 * Live Selected Summary & Owner Approval Action Bar.
 */
export function CommissionSelectedSummary({
  selectedCount = 0,
  selectedTotals,
  isOwner = false,
  canPost = false,
  isPosting = false,
  onClearSelection,
  onOpenConfirmPost,
}) {
  const exceedsBatchLimit = selectedCount > MAX_BOOKINGS_PER_COMMISSION_BATCH;

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Ringkasan item dipilih untuk posting"
      className={
        selectedCount > 0
          ? 'sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 p-3 shadow-[0_14px_34px_-10px_rgba(21,21,21,0.18)] sm:p-5 lg:static lg:shadow-[var(--sa-shadow-md)]'
          : 'p-3.5 sm:p-5'
      }
    >
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Live Selected Breakdown */}
        <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone="ink" icon={CheckSquare} size="sm" className="uppercase">
              Selected Items
            </AdminStatusBadge>
            <span className="text-xs text-[#666159]">
              {selectedCount > 0
                ? `${selectedCount} sesi siap direview untuk masuk ke Pembukuan`
                : 'Centang satu atau beberapa sesi selesai pada daftar di atas untuk mem-posting.'}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2.5">
            <div className="sa-panel-ivory p-2 sm:p-3">
              <dt className="text-[10.5px] font-medium text-[#666159] sm:text-[11px]">
                Completed Sessions
              </dt>
              <dd className="mt-0.5 font-mono text-[13px] font-bold text-[#151515] tabular-nums sm:mt-1 sm:text-base">
                {selectedTotals.completedSessionsCount}
              </dd>
            </div>

            <div className="sa-panel-ivory p-2 sm:p-3">
              <dt className="text-[10.5px] font-medium text-[#666159] sm:text-[11px]">
                Staff Commission
              </dt>
              <dd className="mt-0.5 truncate font-mono text-[13px] font-bold text-[#151515] tabular-nums sm:mt-1 sm:text-base">
                {formatRupiah(selectedTotals.staffCommissionTotal)}
              </dd>
            </div>

            <div className="sa-panel-ivory p-2 sm:p-3">
              <dt className="text-[10.5px] font-medium text-[#666159] sm:text-[11px]">
                Recording Operator
              </dt>
              <dd className="mt-0.5 truncate font-mono text-[13px] font-bold text-[#151515] tabular-nums sm:mt-1 sm:text-base">
                {formatRupiah(selectedTotals.recordingOperatorFeeTotal)}
              </dd>
            </div>

            <div className="rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] p-2 sm:p-3">
              <dt className="text-[10.5px] font-semibold text-[#243300] sm:text-[11px]">
                TOTAL TO POST
              </dt>
              <dd className="mt-0.5 truncate font-mono text-[13px] font-bold text-[#151515] tabular-nums sm:mt-1 sm:text-base">
                {formatRupiah(selectedTotals.payableTotal)}
              </dd>
            </div>
          </dl>

          {selectedTotals.ownerAllocationReferenceTotal > 0 ? (
            <p className="text-[11px] text-[#666159] sm:text-xs">
              Owner Allocation referensi batch ini:{' '}
              <strong className="font-mono font-semibold text-[#151515]">
                {formatRupiah(selectedTotals.ownerAllocationReferenceTotal)}
              </strong>{' '}
              (informasi internal saja, tidak masuk Total To Post).
            </p>
          ) : null}

          {exceedsBatchLimit ? (
            <p className="flex items-center gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] px-3 py-2 text-xs font-medium text-[#B92B0C]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Maksimal {MAX_BOOKINGS_PER_COMMISSION_BATCH} booking per posting (dipilih{' '}
                {selectedCount}). Kurangi pilihan dan posting dalam beberapa batch.
              </span>
            </p>
          ) : null}
        </div>

        {/* Right: Clear & Primary Post Button */}
        <div className="flex shrink-0 flex-col-reverse gap-2 min-[400px]:flex-row lg:flex-col lg:items-stretch xl:flex-row">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onClearSelection}
              disabled={isPosting}
              className="sa-control sa-btn-secondary min-h-11 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold disabled:opacity-50 sm:flex-initial"
            >
              Clear Selection
            </button>
          ) : null}

          {isOwner ? (
            <button
              type="button"
              onClick={onOpenConfirmPost}
              disabled={!canPost || isPosting}
              className="sa-control sa-btn-orange inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
            >
              <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Post to Pembukuan</span>
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#151515]/10 bg-[#FAF8F3] px-3.5 py-2 text-xs font-medium text-[#666159]">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Read Only — Owner Approval Required</span>
            </span>
          )}
        </div>
      </div>
    </AdminSurface>
  );
}
