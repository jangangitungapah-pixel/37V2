import { CalendarDays, Eye, Star } from 'lucide-react';
import { Link } from 'react-router';

import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton, AdminEmptyState, AdminSurface } from '@/features/admin/design-system';

import {
  ALLOWED_REVIEW_MODERATION_TRANSITIONS,
  CUSTOMER_REVIEW_STATUS,
} from '../config/customer-review-config';
import { ReviewStatusBadge } from './ReviewStatusBadge';

export function ReviewInboxTable({
  reviews = [],
  emptyTitle = 'Belum Ada Ulasan',
  emptyDescription = 'Belum ada data ulasan pada kategori ini.',
  onInspectReview,
  onRequestModeration,
}) {
  if (!reviews.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3" data-testid="admin-reviews-list">
      {reviews.map((review) => {
        const allowed = ALLOWED_REVIEW_MODERATION_TRANSITIONS[review.status] || [];

        return (
          <AdminSurface
            key={review.bookingId}
            variant="card"
            data-testid={`admin-review-row-${review.bookingId}`}
            className="p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewStatusBadge status={review.status} kind="review" />
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#151515]/12 bg-[#FAF8F3] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#151515]">
                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                    <span>{review.rating}/5</span>
                  </span>
                  <span className="font-mono text-[11px] text-[#666159]">
                    Booking: {review.bookingId}
                  </span>
                </div>

                <h3 className="mt-2 text-base font-bold text-[#151515]">{review.displayName}</h3>

                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[#46433D]">
                  {review.reviewText}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#666159]">
                  <span>
                    Layanan: <strong>{review.serviceLabelSnapshot || '-'}</strong>
                  </span>
                  <span>
                    Sesi:{' '}
                    <strong>
                      {review.sessionDate ? formatIndonesianDateFull(review.sessionDate) : '-'}
                    </strong>
                  </span>
                  <span>Dikirim: {formatIndonesianTimestamp(review.createdAt)}</span>
                  {review.publishedAt ? (
                    <span>Dipublikasi: {formatIndonesianTimestamp(review.publishedAt)}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onInspectReview?.(review)}
                  className="min-h-10"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Detail</span>
                </AdminButton>

                {allowed.includes(CUSTOMER_REVIEW_STATUS.PUBLISHED) ? (
                  <AdminButton
                    variant="primary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.PUBLISHED)}
                    className="min-h-10"
                  >
                    Publish
                  </AdminButton>
                ) : null}

                {allowed.includes(CUSTOMER_REVIEW_STATUS.ARCHIVED) ? (
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.ARCHIVED)}
                    className="min-h-10"
                  >
                    Archive
                  </AdminButton>
                ) : null}

                {allowed.includes(CUSTOMER_REVIEW_STATUS.PENDING) ? (
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.PENDING)}
                    className="min-h-10"
                  >
                    Restore Pending
                  </AdminButton>
                ) : null}

                {allowed.includes(CUSTOMER_REVIEW_STATUS.REJECTED) ? (
                  <AdminButton
                    variant="danger"
                    size="sm"
                    onClick={() => onRequestModeration?.(review, CUSTOMER_REVIEW_STATUS.REJECTED)}
                    className="min-h-10"
                  >
                    Reject
                  </AdminButton>
                ) : null}

                <Link
                  to={`/admin/calendar?bookingId=${encodeURIComponent(review.bookingId)}`}
                  aria-label={`Buka booking ${review.bookingId} di Calendar`}
                  className="sa-control inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-3 text-xs font-semibold text-[#151515] hover:bg-[#C8F13A]"
                >
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Booking</span>
                </Link>
              </div>
            </div>
          </AdminSurface>
        );
      })}
    </div>
  );
}
