import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCheck, Info, Loader2, X } from 'lucide-react';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import { validateCommissionResolutionReason } from '../schemas/commission-schema';

const QUICK_REASON_PRESETS = [
  'Booking lama sebelum sistem komisi aktif',
  'Komisi sudah diselesaikan di luar sistem',
  'Tidak ada pembagian komisi untuk sesi ini',
];

/**
 * Dialog allowing active Owner to explicitly mark a Needs Review session resolved.
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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label="Tandai selesai item Needs Review"
          data-commission-scoped="true"
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <AdminStatusBadge tone="lime" icon={CheckCheck} size="sm">
                Penyelesaian Needs Review
              </AdminStatusBadge>
              <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                Tandai Selesai Diperiksa
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-[#666159] sm:text-xs">
                {item.booking.customerName} • {item.bookingId}
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog selesai Needs Review"
              disabled={isSubmitting}
              className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515] disabled:opacity-50 sm:h-9 sm:w-9 sm:rounded-xl"
            >
              <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden bg-white">
            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:space-y-3.5 sm:p-5">
              {/* Target Session Info */}
              <div className="sa-panel-ivory p-3.5 text-xs">
                <p className="font-semibold text-[#151515]">
                  {item.booking.customerName}
                  {item.booking.bandName ? ` (${item.booking.bandName})` : ''}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                  {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName} •
                  Selesai: {formatIndonesianTimestamp(item.booking.actualCompletedAt)}
                </p>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3 text-xs text-[#8A4B08]">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
                <p className="leading-relaxed">
                  Tindakan ini menandai sesi lama sebagai sudah diperiksa dan menyembunyikannya dari
                  daftar Needs Review tanpa mengubah data historis booking atau membuat tagihan ke
                  Pembukuan.
                </p>
              </div>

              {/* Quick Reason Chips */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#151515]">
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
                      className={`cursor-pointer rounded-full border px-3 py-1 text-left text-xs font-medium transition-colors ${
                        reason === presetText
                          ? 'border-[#8BAD12]/40 bg-[#EDF8C2] font-semibold text-[#243300]'
                          : 'border-[#151515]/12 bg-[#FAF8F3] text-[#46433D] hover:bg-white'
                      }`}
                    >
                      {presetText}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="block text-xs font-semibold text-[#151515]">
                  Catatan / Alasan Penyelesaian <span className="text-[#FF4B22]">*</span>
                </span>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFieldError('');
                  }}
                  placeholder="Contoh: Booking lama sebelum sistem komisi aktif"
                  className="sa-input w-full p-3 text-xs font-medium"
                />
                {fieldError ? (
                  <p className="text-xs font-medium text-[#B92B0C]">{fieldError}</p>
                ) : null}
              </label>

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

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-3.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:opacity-70"
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
