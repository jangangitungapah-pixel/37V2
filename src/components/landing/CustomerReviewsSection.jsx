import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { formatIndonesianDateFull } from '@/features/admin/calendar/utils/calendar-date';
import { usePublicCustomerReviews } from '@/features/customer-reviews/hooks/usePublicCustomerReviews';

function getViewportCardsCount() {
  if (typeof window === 'undefined') {
    return 3;
  }
  if (window.innerWidth >= 1024) {
    return 3;
  }
  if (window.innerWidth >= 640) {
    return 2;
  }
  return 1;
}

function formatReviewDateLabel(review) {
  if (review?.sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(review.sessionDate)) {
    return formatIndonesianDateFull(review.sessionDate);
  }
  return 'Sesi Studio';
}

function renderStarRow(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const filledCount = Math.round(safeRating);

  return Array.from({ length: 5 }).map((_, index) => {
    const isFilled = index < filledCount;
    return (
      <Star
        key={index}
        className={`h-4 w-4 ${isFilled ? 'fill-studio-ink text-studio-ink' : 'text-studio-ink/25'}`}
        aria-hidden="true"
      />
    );
  });
}

/**
 * SECTION — CUSTOMER REVIEWS (FIRST-PARTY BOOKING-LINKED SOCIAL PROOF)
 * Displays ONLY Owner-approved (`status == 'published'`) customer reviews
 * and real aggregate counts/averages from `publicReviewStats/summary`.
 */
export function CustomerReviewsSection() {
  const prefersReducedMotion = useReducedMotion();
  const { reviews, stats, isLoading, error } = usePublicCustomerReviews();
  const [cardsPerView, setCardsPerView] = useState(getViewportCardsCount);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setCardsPerView(getViewportCardsCount());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasPublishedReviews =
    !isLoading &&
    !error &&
    stats.hasPublishedReviews &&
    Array.isArray(reviews) &&
    reviews.length > 0;

  const visibleCount = Math.max(1, Math.min(cardsPerView, reviews.length || 1));
  const maxStartIndex = Math.max(0, reviews.length - visibleCount);
  const clampedStartIndex = Math.min(startIndex, maxStartIndex);

  const visibleReviews = useMemo(() => {
    if (!hasPublishedReviews) return [];
    return reviews.slice(clampedStartIndex, clampedStartIndex + visibleCount);
  }, [hasPublishedReviews, reviews, clampedStartIndex, visibleCount]);

  const canGoPrev = clampedStartIndex > 0;
  const canGoNext = clampedStartIndex < maxStartIndex;

  const handlePrev = () => {
    setStartIndex((prev) => Math.max(0, Math.min(prev, maxStartIndex) - 1));
  };

  const handleNext = () => {
    setStartIndex((prev) => Math.min(maxStartIndex, prev + 1));
  };

  const handleCarouselKeyDown = (event) => {
    if (!hasPublishedReviews || reviews.length <= visibleCount) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handlePrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleNext();
    }
  };

  return (
    <section
      id="customer-reviews"
      data-testid="customer-reviews-section"
      aria-labelledby="customer-reviews-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Section Header + Verified Real Stats Summary */}
        <div className="border-studio-ink grid grid-cols-1 gap-6 border-b-2 pb-6 sm:pb-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
                <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
                <span>REAL STORIES FROM OUR CUSTOMERS</span>
              </span>
              <span className="border-studio-ink bg-studio-white text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>BOOKING-LINKED REVIEWS</span>
              </span>
            </div>

            <h2
              id="customer-reviews-heading"
              className="font-display text-studio-ink mt-4 text-4xl leading-[0.92] font-black tracking-tight uppercase sm:text-6xl"
            >
              THE SOUND OF GOOD EXPERIENCES.
            </h2>
          </div>

          <div className="lg:col-span-5">
            {hasPublishedReviews ? (
              <div
                data-testid="customer-reviews-aggregate-card"
                className="border-studio-ink bg-studio-white flex flex-wrap items-center justify-between gap-4 border-2 p-4 shadow-[4px_4px_0_0_#151515]"
              >
                <div>
                  <p className="text-studio-muted-ink font-mono text-[10px] font-bold tracking-wider uppercase">
                    AVERAGE RATING
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      data-testid="customer-reviews-average-rating"
                      className="font-display text-studio-ink text-4xl leading-none font-black tabular-nums"
                    >
                      {stats.averageRatingLabel}
                    </span>
                    <span className="text-studio-muted-ink font-mono text-xs font-bold">/ 5.0</span>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    aria-label={`Average rating ${stats.averageRatingLabel} out of 5`}
                  >
                    {renderStarRow(stats.averageRating)}
                  </div>
                  <p
                    data-testid="customer-reviews-published-count"
                    className="text-studio-ink mt-1.5 font-mono text-xs font-bold uppercase tabular-nums"
                  >
                    {stats.publishedCount}{' '}
                    {stats.publishedCount === 1 ? 'published review' : 'published reviews'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-studio-ink/40 bg-studio-white border-2 border-dashed p-4">
                <p className="text-studio-ink font-mono text-xs font-bold uppercase">
                  BOOKING-LINKED MODERATION
                </p>
                <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed">
                  Only approved customer reviews tied to completed studio bookings appear on this
                  page.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Body Content: Loading / Honest Empty State / Published Reviews Carousel */}
        {isLoading ? (
          <div
            data-testid="customer-reviews-loading"
            className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((skeletonIdx) => (
              <div
                key={skeletonIdx}
                className="border-studio-ink/20 bg-studio-white h-56 animate-pulse border-2 p-5"
              />
            ))}
          </div>
        ) : !hasPublishedReviews ? (
          <div
            data-testid="customer-reviews-empty-state"
            className="border-studio-ink bg-studio-white mt-8 border-2 p-6 sm:p-8"
          >
            <p className="text-studio-ink font-display text-xl font-black uppercase sm:text-2xl">
              {error
                ? 'CUSTOMER REVIEWS ARE TEMPORARILY UNAVAILABLE.'
                : 'FIRST PUBLISHED SESSION REVIEWS ARRIVING SOON.'}
            </p>
            <p className="text-studio-muted-ink mt-2 max-w-2xl text-sm leading-relaxed">
              {error
                ? 'Ulasan pelanggan belum dapat dimuat saat ini. Silakan muat ulang beberapa saat lagi.'
                : 'No published customer reviews yet. Every review shown here is submitted directly by musicians after completing a real session at 37 Music Studio.'}
            </p>
          </div>
        ) : (
          <div
            className="mt-8"
            role="region"
            aria-label="Published customer reviews carousel"
            tabIndex={reviews.length > visibleCount ? 0 : undefined}
            onKeyDown={handleCarouselKeyDown}
          >
            {/* Carousel Controls & Visible Range Indicator */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-studio-muted-ink font-mono text-xs font-bold uppercase tabular-nums">
                Showing {clampedStartIndex + 1}–{clampedStartIndex + visibleReviews.length} of{' '}
                {reviews.length}
              </p>

              {reviews.length > visibleCount ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    aria-label="Previous customer reviews"
                    className="border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canGoNext}
                    aria-label="Next customer reviews"
                    className="border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>

            {/* Cards Grid */}
            <motion.div
              key={clampedStartIndex}
              initial={prefersReducedMotion ? false : { opacity: 0.92, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visibleReviews.map((review) => (
                <article
                  key={review.id}
                  data-testid="public-customer-review-card"
                  className="border-studio-ink bg-studio-white flex min-w-0 flex-col justify-between border-2 p-5 shadow-[4px_4px_0_0_#151515]"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        className="flex items-center gap-1"
                        aria-label={`Rated ${review.rating} out of 5`}
                      >
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <Star
                            key={starIndex}
                            className={`h-4 w-4 ${
                              starIndex < review.rating
                                ? 'fill-studio-orange text-studio-orange'
                                : 'text-studio-ink/20'
                            }`}
                            aria-hidden="true"
                          />
                        ))}
                        <span className="text-studio-ink ml-1 font-mono text-xs font-extrabold tabular-nums">
                          {review.rating}.0
                        </span>
                      </div>

                      <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                        BOOKING-LINKED REVIEW
                      </span>
                    </div>

                    <p className="text-studio-ink mt-4 text-sm leading-relaxed font-medium break-words sm:text-base">
                      “{review.reviewText}”
                    </p>
                  </div>

                  <div className="border-studio-ink/15 mt-5 flex items-center justify-between gap-3 border-t pt-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="border-studio-ink bg-studio-ink text-studio-lime flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-[11px] font-extrabold"
                        aria-hidden="true"
                      >
                        {String(review.displayName || '37')
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-studio-ink truncate text-xs font-extrabold uppercase">
                          {review.displayName}
                        </p>
                        <p className="text-studio-muted-ink truncate font-mono text-[10px]">
                          {review.serviceLabelSnapshot || 'Studio Session'}
                        </p>
                      </div>
                    </div>

                    <span className="text-studio-muted-ink shrink-0 font-mono text-[10px]">
                      {formatReviewDateLabel(review)}
                    </span>
                  </div>
                </article>
              ))}
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}
