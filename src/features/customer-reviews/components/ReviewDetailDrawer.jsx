import { Dialog } from '@base-ui/react/dialog';
import { CalendarDays, ExternalLink, ShieldCheck, Star, X } from 'lucide-react';
import { Link } from 'react-router';

import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton } from '@/features/admin/design-system';

import {
  ALLOWED_REVIEW_MODERATION_TRANSITIONS,
  CUSTOMER_REVIEW_STATUS,
} from '../config/customer-review-config';
import { ReviewStatusBadge } from './ReviewStatusBadge';

export function ReviewDetailDrawer({ open, onOpenChange, review, onRequestModeration }) {
  if (!review) {
    return null;
  }

  const allowedTransitions = ALLOWED_REVIEW_MODERATION_TRANSITIONS[review.status] || [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />
        <Dialog.Popup
          data-admin-portal-layer="true"
          data-testid="review-detail-drawer"
          aria-label={`Detail ulasan ${review.displayName}`}
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col"
        >
          {/* Sticky Header */}
          <div className="shrink-0 border-b border-white/10 bg-[#151515] px-5 py-4 text-[#F1EEE4] sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewStatusBadge status={review.status} kind="review" />
                  <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                    BOOKING-LINKED REVIEW
                  </span>
                </div>
                <Dialog.Title className="mt-2 truncate text-lg font-bold text-white sm:text-xl">
                  {review.displayName}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-neutral-400">
                  Booking ID: {review.bookingId} • Revisi v{review.version}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail ulasan"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
            {/* Rating + Immutable Written Content */}
            <section className="sa-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-[#151515]/10 pb-3">
                <div className="flex items-center gap-1 text-[#151515]">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-4 w-4 ${idx < review.rating ? 'fill-current text-[#151515]' : 'text-[#151515]/20'}`}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="ml-1.5 font-mono text-xs font-bold">{review.rating}/5</span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#666159] uppercase">
                  Konten Asli (Immutable)
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[#151515]">{review.reviewText}</p>
            </section>

            {/* Associated Booking & Consent Metadata */}
            <section className="sa-card space-y-3 p-4 text-xs sm:p-5">
              <h3 className="text-sm font-bold text-[#151515]">
                Konteks Booking &amp; Persetujuan
              </h3>
              <dl className="grid grid-cols-1 gap-3 border-t border-[#151515]/10 pt-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Layanan Sesi</dt>
                  <dd className="mt-0.5 font-semibold text-[#151515]">
                    {review.serviceLabelSnapshot || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Tanggal Sesi</dt>
                  <dd className="mt-0.5 font-semibold text-[#151515]">
                    {review.sessionDate ? formatIndonesianDateFull(review.sessionDate) : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Waktu Kirim</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                    {formatIndonesianTimestamp(review.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Waktu Publikasi</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                    {review.publishedAt ? formatIndonesianTimestamp(review.publishedAt) : '-'}
                  </dd>
                </div>
              </dl>

              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-[#E6F6EC] p-3 text-[#0F6246]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">Persetujuan Publikasi Pelanggan</p>
                  <p className="mt-0.5 text-[11px]">
                    Status: {review.consentToPublish ? 'Disetujui' : 'Belum'} • Versi:{' '}
                    {review.consentVersion}
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <Link
                  to={`/admin/calendar?bookingId=${encodeURIComponent(review.bookingId)}`}
                  className="sa-control sa-btn-secondary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                >
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Lihat Booking di Calendar</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </section>

            {/* Owner Moderation Actions */}
            <section className="sa-card p-4 sm:p-5">
              <h3 className="text-sm font-bold text-[#151515]">Aksi Moderasi Owner</h3>
              <p className="mt-0.5 text-xs text-[#666159]">
                Perubahan status memperbarui statistik rating publik secara atomik.
              </p>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {allowedTransitions.includes(CUSTOMER_REVIEW_STATUS.PUBLISHED) ? (
                  <AdminButton
                    variant="primary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.PUBLISHED)}
                  >
                    Publish to Website
                  </AdminButton>
                ) : null}

                {allowedTransitions.includes(CUSTOMER_REVIEW_STATUS.ARCHIVED) ? (
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.ARCHIVED)}
                  >
                    Archive Review
                  </AdminButton>
                ) : null}

                {allowedTransitions.includes(CUSTOMER_REVIEW_STATUS.PENDING) ? (
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.PENDING)}
                  >
                    Restore to Pending
                  </AdminButton>
                ) : null}

                {allowedTransitions.includes(CUSTOMER_REVIEW_STATUS.REJECTED) ? (
                  <AdminButton
                    variant="danger"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.REJECTED)}
                  >
                    Reject Review
                  </AdminButton>
                ) : null}
              </div>
            </section>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
