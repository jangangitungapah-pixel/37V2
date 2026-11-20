import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Info, Loader2, Send, X } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminStatusBadge } from '@/features/admin/design-system';

/**
 * Confirmation Dialog before executing atomic Firestore Commission Posting.
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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label="Konfirmasi posting komisi ke Pembukuan"
          data-commission-scoped="true"
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <AdminStatusBadge tone="lime" icon={Send} size="sm">
                Owner Approval
              </AdminStatusBadge>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                Confirm Commission Posting
              </Dialog.Title>
              <Dialog.Description className="sr-only sm:not-sr-only sm:mt-0.5 sm:block sm:text-xs sm:text-[#666159]">
                Periksa kembali rincian biaya sebelum masuk ke Pembukuan studio.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog konfirmasi posting"
              disabled={isSubmitting}
              className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] disabled:opacity-50 sm:h-9 sm:w-9 sm:rounded-xl"
            >
              <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Summary Body */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-white p-4 sm:space-y-3.5 sm:p-5">
            <section className="sa-panel-ivory p-4 text-xs">
              <p className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                Commission Summary
              </p>

              <dl className="mt-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-[#666159]">Period</dt>
                  <dd className="text-right font-semibold text-[#151515]">{periodLabel}</dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#666159]">Completed Sessions</dt>
                  <dd className="font-mono font-bold text-[#151515] tabular-nums">
                    {summary.completedSessionsCount}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#666159]">Staff Commission</dt>
                  <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(summary.staffCommissionTotal)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#666159]">Recording Operator Fee</dt>
                  <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(summary.recordingOperatorFeeTotal)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[#151515]/10 pt-2.5 text-sm font-bold">
                  <dt className="text-[#151515]">TOTAL TO PAY</dt>
                  <dd className="font-mono text-[#FF4B22] tabular-nums">
                    {formatRupiah(summary.payableTotal)}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-[#151515]/15 bg-white p-2.5 text-[11px]">
                  <dt className="text-[#666159]">
                    <span className="block font-semibold text-[#46433D]">Owner Allocation</span>
                    <span className="text-[10px]">(Informational only)</span>
                  </dt>
                  <dd className="font-mono font-semibold text-[#666159] tabular-nums">
                    {formatRupiah(summary.ownerAllocationReferenceTotal)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Required Non-Payment Accrual Notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 text-xs text-[#8A4B08]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
              <p className="leading-relaxed">
                Fee yang diposting akan menjadi catatan kewajiban biaya di Pembukuan. Posting ini
                belum berarti pembayaran kepada Staff atau Operator sudah dilakukan.
              </p>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:py-3.5 sm:pb-[max(0.875rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirm}
              className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
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
