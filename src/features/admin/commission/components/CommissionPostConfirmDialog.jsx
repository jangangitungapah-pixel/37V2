import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Info, Loader2, Send, X } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';

/**
 * Confirmation Dialog before executing atomic Firestore Commission Posting (Section 7).
 * Prevents double click, keeps state while retrying on transient failures, and clearly
 * explains accrual semantics (posting records an obligation in Pembukuan, not payout).
 */
export function CommissionPostConfirmDialog({
  open,
  batchId,
  periodLabel,
  summary,
  errorMessage = '',
  onOpenChange,
  onConfirmPost,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmPost?.(batchId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(true))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Konfirmasi posting komisi ke Pembukuan"
          data-commission-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                <Send className="h-3 w-3" aria-hidden="true" />
                <span>OWNER APPROVAL</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase sm:text-2xl">
                Confirm Commission Posting
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-mono text-[11px] text-neutral-300">
                Periksa kembali rincian biaya sebelum masuk ke Pembukuan studio.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog konfirmasi posting"
              disabled={isSubmitting}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Summary Body */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            <section className="border-studio-ink bg-studio-white border-2 p-3.5 font-mono text-xs shadow-[3px_3px_0px_#151515]">
              <p className="text-studio-muted-ink text-[10px] font-extrabold tracking-wider uppercase">
                COMMISSION SUMMARY
              </p>

              <dl className="mt-2.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-studio-muted-ink">Period</dt>
                  <dd className="text-right font-extrabold">{periodLabel}</dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-studio-muted-ink">Completed Sessions</dt>
                  <dd className="font-extrabold tabular-nums">{summary.completedSessionsCount}</dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-studio-muted-ink">Staff Commission</dt>
                  <dd className="font-extrabold tabular-nums">
                    {formatRupiah(summary.staffCommissionTotal)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-studio-muted-ink">Recording Operator Fee</dt>
                  <dd className="font-extrabold tabular-nums">
                    {formatRupiah(summary.recordingOperatorFeeTotal)}
                  </dd>
                </div>

                <div className="border-studio-ink flex items-center justify-between gap-3 border-t-2 pt-2 text-sm font-black">
                  <dt>TOTAL TO PAY</dt>
                  <dd className="text-studio-orange tabular-nums">
                    {formatRupiah(summary.payableTotal)}
                  </dd>
                </div>

                <div className="border-studio-ink bg-studio-ivory flex items-start justify-between gap-3 border border-dashed p-2 text-[11px]">
                  <dt className="text-studio-muted-ink">
                    <span className="block font-bold">Owner Allocation</span>
                    <span className="text-[9.5px] font-semibold">(Informational only)</span>
                  </dt>
                  <dd className="text-studio-muted-ink font-extrabold tabular-nums">
                    {formatRupiah(summary.ownerAllocationReferenceTotal)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Required Non-Payment Accrual Notice */}
            <div className="border-studio-ink flex items-start gap-2 border-2 bg-amber-100 p-3 text-xs">
              <Info className="text-studio-orange mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-studio-ink leading-relaxed font-semibold">
                Fee yang diposting akan menjadi catatan kewajiban biaya di Pembukuan. Posting ini
                belum berarti pembayaran kepada Staff atau Operator sudah dilakukan.
              </p>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange/15 text-studio-ink flex items-start gap-2 border-2 p-3 font-mono text-xs font-bold"
              >
                <AlertTriangle
                  className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{errorMessage}</span>
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="border-studio-ink bg-studio-white flex shrink-0 flex-col-reverse gap-2 border-t-2 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="cal-control border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="cal-control border-studio-ink bg-studio-orange text-studio-white hover:bg-studio-ink hover:text-studio-lime inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Mem-posting...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Confirm &amp; Post</span>
                </>
              )}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
