import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';

import { AdminButton } from '@/features/admin/design-system';

import { CUSTOMER_REVIEW_STATUS } from '../config/customer-review-config';

const ACTION_COPY = {
  [CUSTOMER_REVIEW_STATUS.PUBLISHED]: {
    title: 'Publikasikan Ulasan ke Landing Page?',
    description:
      'Ulasan ini akan langsung ditampilkan pada halaman publik 37 Music Studio dan statistik rating publik akan diperbarui secara atomik. Isi tulisan pelanggan tidak akan diubah.',
    confirmLabel: 'Ya, Publikasikan Ulasan',
    variant: 'primary',
  },
  [CUSTOMER_REVIEW_STATUS.ARCHIVED]: {
    title: 'Arsipkan Ulasan Terpublikasi?',
    description:
      'Ulasan akan diturunkan dari tampilan publik Landing Page dan statistik rating akan dikurangi secara atomik. Data ulasan tetap tersimpan di arsip.',
    confirmLabel: 'Ya, Arsipkan Ulasan',
    variant: 'secondary',
  },
  [CUSTOMER_REVIEW_STATUS.REJECTED]: {
    title: 'Tolak Ulasan Pelanggan?',
    description:
      'Ulasan tidak akan ditampilkan secara publik. Hanya tolak jika ulasan melanggar kebijakan (spam, pelecehan, data pribadi sensitif, atau tidak relevan), bukan semata karena skor rendah.',
    confirmLabel: 'Ya, Tolak Ulasan',
    variant: 'danger',
  },
  [CUSTOMER_REVIEW_STATUS.PENDING]: {
    title: 'Kembalikan Ulasan ke Inbox Pending?',
    description:
      'Ulasan akan dipindahkan kembali ke antrean Review Inbox (Pending) untuk ditinjau ulang.',
    confirmLabel: 'Kembalikan ke Pending',
    variant: 'secondary',
  },
};

export function ReviewModerationDialog({
  open,
  onOpenChange,
  review,
  targetStatus,
  isSubmitting = false,
  error = '',
  onConfirm,
}) {
  if (!review || !targetStatus) {
    return null;
  }

  const meta = ACTION_COPY[targetStatus] || ACTION_COPY[CUSTOMER_REVIEW_STATUS.PENDING];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[70]"
        />
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-testid="review-moderation-dialog"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] rounded-b-none border border-[#151515]/12 bg-white p-0 text-[#151515] shadow-2xl outline-none sm:rounded-[22px]"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6 sm:py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-bold tracking-tight">
                  {meta.title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-relaxed text-[#666159]">
                  {meta.description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Tutup dialog moderasi"
                disabled={isSubmitting}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
              <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#151515]">{review.displayName}</span>
                  <span className="font-mono font-bold text-[#151515]">{review.rating}/5 ★</span>
                </div>
                <p className="mt-2 leading-relaxed text-[#46433D]">{review.reviewText}</p>
              </div>

              {targetStatus === CUSTOMER_REVIEW_STATUS.PUBLISHED ? (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-[#E6F6EC] p-3 text-xs text-[#0F6246]">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Persetujuan publikasi pelanggan terverifikasi:{' '}
                    <strong>{review.consentToPublish ? 'Disetujui (true)' : 'Tidak Ada'}</strong> (
                    {review.consentVersion}).
                  </span>
                </div>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>

            {/* Sticky Footer */}
            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
              <AdminButton
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-10 flex-1 sm:flex-initial"
              >
                Batal
              </AdminButton>
              <AdminButton
                variant={meta.variant}
                disabled={
                  isSubmitting ||
                  (targetStatus === CUSTOMER_REVIEW_STATUS.PUBLISHED && !review.consentToPublish)
                }
                onClick={onConfirm}
                className="h-10 flex-1 sm:flex-initial"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>{meta.confirmLabel}</span>
                  </>
                )}
              </AdminButton>
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
