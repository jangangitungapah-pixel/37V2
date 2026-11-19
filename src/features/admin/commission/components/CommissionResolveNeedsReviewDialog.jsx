import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCheck, Info, Loader2, X } from 'lucide-react';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { validateCommissionResolutionReason } from '../schemas/commission-schema';

const QUICK_REASON_PRESETS = [
  'Booking lama sebelum sistem komisi aktif',
  'Komisi sudah diselesaikan di luar sistem',
  'Tidak ada pembagian komisi untuk sesi ini',
];

/**
 * Dialog allowing active Owner to explicitly mark a Needs Review session resolved
 * (dismissed with reason, zero changes to historical booking data or Pembukuan).
 */
export function CommissionResolveNeedsReviewDialog({
  item,
  open,
  errorMessage = '',
  onOpenChange,
  onConfirmResolve,
}) {
  const [reason, setReason] = useState(QUICK_REASON_PRESETS[0]);
  const [fieldError, setFieldError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !item) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateCommissionResolutionReason(reason);
    if (!validation.isValid) {
      setFieldError(validation.error);
      return;
    }

    setFieldError('');
    setIsSubmitting(true);
    try {
      await onConfirmResolve?.({
        item,
        reason: validation.reason,
      });
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
          aria-label="Tandai selesai item Needs Review"
          data-commission-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                <CheckCheck className="h-3 w-3" aria-hidden="true" />
                <span>PENYELESAIAN NEEDS REVIEW</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase sm:text-2xl">
                Tandai Selesai Diperiksa
              </Dialog.Title>
              <Dialog.Description className="mt-1 truncate font-mono text-[11px] text-neutral-300">
                {item.booking.customerName} • {item.bookingId}
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog selesai Needs Review"
              disabled={isSubmitting}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {/* Target Session Info */}
              <div className="border-studio-ink bg-studio-white border-2 p-3 font-mono text-xs">
                <p className="text-studio-ink font-extrabold">
                  {item.booking.customerName}
                  {item.booking.bandName ? ` (${item.booking.bandName})` : ''}
                </p>
                <p className="text-studio-muted-ink mt-0.5 text-[11px]">
                  {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName} •
                  Selesai: {formatIndonesianTimestamp(item.booking.actualCompletedAt)}
                </p>
              </div>

              <div className="border-studio-ink flex items-start gap-2 border-2 bg-amber-100 p-2.5 text-xs">
                <Info className="text-studio-orange mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-studio-ink leading-relaxed font-semibold">
                  Tindakan ini menandai sesi lama sebagai sudah diperiksa dan menyembunyikannya dari
                  daftar Needs Review tanpa mengubah data historis booking atau membuat tagihan ke
                  Pembukuan.
                </p>
              </div>

              {/* Quick Reason Chips */}
              <div className="space-y-1.5">
                <span className="text-studio-muted-ink block font-mono text-[10px] font-extrabold uppercase">
                  Pilih Alasan Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASON_PRESETS.map((presetText) => (
                    <button
                      key={presetText}
                      type="button"
                      onClick={() => {
                        setReason(presetText);
                        setFieldError('');
                      }}
                      className={`border-studio-ink cursor-pointer border px-2 py-1 text-left font-mono text-[10px] font-bold transition-colors ${
                        reason === presetText
                          ? 'bg-studio-lime text-studio-ink'
                          : 'bg-studio-white text-studio-muted-ink hover:bg-studio-ivory'
                      }`}
                    >
                      {presetText}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase">
                  Catatan / Alasan Penyelesaian *
                </span>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFieldError('');
                  }}
                  placeholder="Contoh: Booking lama sebelum sistem komisi aktif"
                  className="border-studio-ink bg-studio-white text-studio-ink w-full border-2 p-2.5 text-xs font-semibold"
                />
                {fieldError ? (
                  <p className="text-studio-orange font-mono text-[10.5px] font-bold">
                    {fieldError}
                  </p>
                ) : null}
              </label>

              {errorMessage ? (
                <div
                  role="alert"
                  className="border-studio-ink bg-studio-orange/15 text-studio-ink flex items-start gap-2 border-2 p-2.5 font-mono text-xs font-bold"
                >
                  <AlertTriangle
                    className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{errorMessage}</span>
                </div>
              ) : null}
            </div>

            <div className="border-studio-ink bg-studio-white flex shrink-0 flex-col-reverse gap-2 border-t-2 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="cal-control border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="cal-control border-studio-ink bg-studio-lime text-studio-ink hover:bg-studio-ink hover:text-studio-lime inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tandai Selesai</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
