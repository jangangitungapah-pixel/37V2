import { AlertTriangle, CheckSquare, Send, ShieldAlert } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';

import { MAX_BOOKINGS_PER_COMMISSION_BATCH } from '../schemas/commission-schema';

/**
 * Live Selected Summary & Owner Approval Action Bar (Sections 6.F & 6.G).
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
    <section
      aria-label="Ringkasan item dipilih untuk posting"
      className="cal-card bg-studio-white p-3 sm:p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Live Selected Breakdown */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-studio-ink text-studio-lime inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase">
              <CheckSquare className="h-3 w-3" aria-hidden="true" />
              <span>SELECTED ITEMS</span>
            </span>
            <span className="font-mono text-[10px] font-bold text-neutral-600">
              {selectedCount > 0
                ? `${selectedCount} sesi siap direview untuk masuk ke Pembukuan`
                : 'Centang satu atau beberapa sesi selesai pada daftar di atas untuk mem-posting.'}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-1.5 font-mono text-xs sm:grid-cols-4 sm:gap-2">
            <div className="border-studio-ink bg-studio-ivory border px-2.5 py-1.5">
              <dt className="text-studio-muted-ink text-[9px] font-bold uppercase">
                Completed Sessions
              </dt>
              <dd className="text-studio-ink mt-0.5 text-sm font-black tabular-nums">
                {selectedTotals.completedSessionsCount}
              </dd>
            </div>

            <div className="border-studio-ink bg-studio-ivory border px-2.5 py-1.5">
              <dt className="text-studio-muted-ink text-[9px] font-bold uppercase">
                Staff Commission
              </dt>
              <dd className="text-studio-ink mt-0.5 truncate text-sm font-black tabular-nums">
                {formatRupiah(selectedTotals.staffCommissionTotal)}
              </dd>
            </div>

            <div className="border-studio-ink bg-studio-ivory border px-2.5 py-1.5">
              <dt className="text-studio-muted-ink text-[9px] font-bold uppercase">
                Recording Operator
              </dt>
              <dd className="text-studio-ink mt-0.5 truncate text-sm font-black tabular-nums">
                {formatRupiah(selectedTotals.recordingOperatorFeeTotal)}
              </dd>
            </div>

            <div className="border-studio-ink bg-studio-lime/45 border px-2.5 py-1.5">
              <dt className="text-studio-ink text-[9px] font-extrabold uppercase">TOTAL TO POST</dt>
              <dd className="text-studio-ink mt-0.5 truncate text-sm font-black tabular-nums">
                {formatRupiah(selectedTotals.payableTotal)}
              </dd>
            </div>
          </dl>

          {selectedTotals.ownerAllocationReferenceTotal > 0 ? (
            <p className="text-studio-muted-ink font-mono text-[10px] font-semibold">
              Owner Allocation referensi batch ini:{' '}
              <strong className="text-studio-ink">
                {formatRupiah(selectedTotals.ownerAllocationReferenceTotal)}
              </strong>{' '}
              (informasi internal saja, tidak masuk Total To Post).
            </p>
          ) : null}

          {exceedsBatchLimit ? (
            <p className="border-studio-ink bg-studio-orange/15 text-studio-orange flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10.5px] font-bold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                Maksimal {MAX_BOOKINGS_PER_COMMISSION_BATCH} booking per posting (dipilih{' '}
                {selectedCount}). Kurangi pilihan dan posting dalam beberapa batch.
              </span>
            </p>
          ) : null}
        </div>

        {/* Right: Clear & Primary Post Button */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch xl:flex-row">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onClearSelection}
              disabled={isPosting}
              className="cal-control border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white min-h-11 flex-1 cursor-pointer px-3 py-2 font-mono text-[10.5px] font-extrabold uppercase sm:flex-initial"
            >
              Clear Selection
            </button>
          ) : null}

          {isOwner ? (
            <button
              type="button"
              onClick={onOpenConfirmPost}
              disabled={!canPost || isPosting}
              className="cal-control border-studio-ink bg-studio-orange text-studio-white hover:bg-studio-ink hover:text-studio-lime inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 font-mono text-[11px] font-extrabold tracking-wide uppercase disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600 sm:flex-initial"
            >
              <Send className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Post to Pembukuan</span>
            </button>
          ) : (
            <span className="border-studio-ink bg-studio-ivory text-studio-muted-ink inline-flex min-h-11 items-center justify-center gap-1.5 border-2 px-3 py-2 font-mono text-[10px] font-extrabold uppercase">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Read Only — Owner Approval Required</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
