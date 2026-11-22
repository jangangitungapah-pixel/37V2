import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Flag, MapPin, Star } from 'lucide-react';

import {
  VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
  fetchStudioGoogleReviews,
  getGoogleMapsPlacesConfig,
} from '@/lib/google-maps/places-client';

function GoogleGMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function GoogleMapsBadge() {
  return (
    <span className="border-studio-ink bg-studio-white text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase">
      <GoogleGMark />
      <span>Google Maps</span>
    </span>
  );
}

function StarRatingRow({ rating, labelPrefix = 'Rated' }) {
  const safeRating = typeof rating === 'number' && Number.isFinite(rating) ? rating : 0;
  const fullStars = Math.round(safeRating);

  return (
    <div
      className="text-studio-ink flex items-center gap-1"
      aria-label={`${labelPrefix} ${safeRating} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, starIndex) => {
        const isFilled = starIndex < fullStars;
        return (
          <Star
            key={starIndex}
            className={`h-4 w-4 ${isFilled ? 'text-studio-ink fill-current' : 'text-studio-ink/25'}`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function ReviewerAvatar({ displayName, photoURI }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initial = (displayName || 'G').trim().charAt(0).toUpperCase() || 'G';

  if (photoURI && !hasImageError) {
    return (
      <img
        src={photoURI}
        alt={`${displayName} avatar`}
        width={40}
        height={40}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasImageError(true)}
        className="border-studio-ink h-10 w-10 shrink-0 border-2 object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="border-studio-ink bg-studio-lime text-studio-ink flex h-10 w-10 shrink-0 items-center justify-center border-2 font-mono text-sm font-extrabold uppercase"
    >
      {initial}
    </span>
  );
}

function ReviewCard({ review }) {
  const {
    authorAttribution,
    rating,
    text,
    relativePublishTimeDescription,
    googleMapsURI,
    flagContentURI,
  } = review;

  return (
    <article
      data-testid="google-review-card"
      className="brutal-card bg-studio-white text-studio-ink flex min-w-0 shrink-0 basis-full snap-start flex-col justify-between p-5 sm:basis-[calc(50%-0.5rem)] sm:p-6 lg:basis-[calc(33.333%-0.8333rem)]"
    >
      <div className="min-w-0">
        {/* Author attribution header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ReviewerAvatar
              displayName={authorAttribution.displayName}
              photoURI={authorAttribution.photoURI}
            />
            <div className="min-w-0">
              {authorAttribution.uri ? (
                <a
                  href={authorAttribution.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-studio-ink block truncate text-sm font-extrabold tracking-tight hover:underline"
                >
                  {authorAttribution.displayName}
                </a>
              ) : (
                <p className="text-studio-ink truncate text-sm font-extrabold tracking-tight">
                  {authorAttribution.displayName}
                </p>
              )}

              {relativePublishTimeDescription ? (
                <p className="text-studio-muted-ink mt-0.5 truncate font-mono text-[11px] font-semibold">
                  {relativePublishTimeDescription}
                </p>
              ) : null}
            </div>
          </div>

          <GoogleGMark />
        </div>

        {/* Review star rating */}
        {typeof rating === 'number' ? (
          <div className="mt-4 flex items-center gap-2">
            <StarRatingRow rating={rating} labelPrefix="Review rated" />
            <span className="text-studio-muted-ink font-mono text-[11px] font-bold">
              {rating.toFixed(1)}
            </span>
          </div>
        ) : null}

        {/* Authentic unmodified review text */}
        {text ? (
          <p className="text-studio-ink mt-3 line-clamp-5 text-sm leading-relaxed break-words">
            {text}
          </p>
        ) : null}
      </div>

      {/* Direct source links */}
      <div className="border-studio-ink/20 mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-3.5">
        <a
          href={googleMapsURI}
          target="_blank"
          rel="noopener noreferrer"
          className="text-studio-ink hover:text-studio-orange inline-flex items-center gap-1 font-mono text-[11px] font-extrabold tracking-wide uppercase underline-offset-4 hover:underline"
        >
          <span>View original review on Google Maps</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>

        {flagContentURI ? (
          <a
            href={flagContentURI}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Report review by ${authorAttribution.displayName}`}
            className="text-studio-subtle-ink hover:text-studio-ink inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase"
          >
            <Flag className="h-3 w-3" aria-hidden="true" />
            <span>Report</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

/**
 * SECTION 06B — GOOGLE MAPS REVIEWS (PUBLIC LANDING PAGE SOCIAL PROOF)
 * Placed between Gallery and Public Availability Teaser.
 *
 * Uses `IntersectionObserver` to lazy-load Places API details once per runtime,
 * never stores review data permanently, and degrades gracefully across missing config,
 * API error, identity mismatch, and empty review states.
 */
export function GoogleReviewsSection({
  fetchReviewsFn = fetchStudioGoogleReviews,
  fallbackUrl = VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
} = {}) {
  const headingId = useId();
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const pendingFetchPromiseRef = useRef(null);

  const [reviewState, setReviewState] = useState({
    phase: 'idle',
    place: null,
    diagnosticCode: null,
    resolvedFallbackUrl: fallbackUrl,
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    const startLoad = () => {
      if (isCancelled) return;

      const config = getGoogleMapsPlacesConfig();
      if (!config.isConfigured && fetchReviewsFn === fetchStudioGoogleReviews) {
        setReviewState({
          phase: 'unconfigured',
          place: null,
          diagnosticCode: null,
          resolvedFallbackUrl: config.fallbackUrl || fallbackUrl,
        });
        return;
      }

      setReviewState((prev) => (prev.phase === 'idle' ? { ...prev, phase: 'loading' } : prev));

      if (!pendingFetchPromiseRef.current) {
        pendingFetchPromiseRef.current = Promise.resolve().then(() => fetchReviewsFn());
      }

      pendingFetchPromiseRef.current.then(
        (result) => {
          if (isCancelled) return;
          setReviewState({
            phase: result?.status || 'error',
            place: result?.place || null,
            diagnosticCode: result?.diagnosticCode || null,
            resolvedFallbackUrl: result?.fallbackUrl || fallbackUrl,
          });
        },
        () => {
          if (isCancelled) return;
          setReviewState({
            phase: 'error',
            place: null,
            diagnosticCode: 'GOOGLE_MAPS_PLACE_FETCH_FAILED',
            resolvedFallbackUrl: fallbackUrl,
          });
        },
      );
    };

    const node = sectionRef.current;
    if (typeof IntersectionObserver !== 'function' || !node) {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          startLoad();
        }
      });
      return () => {
        isCancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startLoad();
        }
      },
      {
        rootMargin: '240px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(node);
    return () => {
      isCancelled = true;
      observer.disconnect();
    };
  }, [fallbackUrl, fetchReviewsFn]);

  const place = reviewState.place;
  const reviews = place?.reviews || [];
  const hasCarouselReviews = reviewState.phase === 'loaded' && reviews.length > 0;
  const listingHref = place?.googleMapsURI || reviewState.resolvedFallbackUrl || fallbackUrl;

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scrollToReviewIndex = (nextIdx) => {
    if (!reviews.length) return;
    const boundedIndex = Math.max(0, Math.min(reviews.length - 1, nextIdx));
    setActiveIndex(boundedIndex);

    const track = trackRef.current;
    const cardNode = track?.children?.[boundedIndex];
    if (track && cardNode) {
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      if (typeof track.scrollTo === 'function') {
        track.scrollTo({
          left: cardNode.offsetLeft,
          behavior,
        });
      } else {
        track.scrollLeft = cardNode.offsetLeft;
      }
    }
  };

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track || !reviews.length) return;
    const children = Array.from(track.children || []);
    if (!children.length) return;

    const currentScroll = track.scrollLeft || 0;
    let closestIdx = 0;
    let smallestDelta = Infinity;
    children.forEach((child, idx) => {
      const delta = Math.abs((child.offsetLeft || 0) - currentScroll);
      if (delta < smallestDelta) {
        smallestDelta = delta;
        closestIdx = idx;
      }
    });
    setActiveIndex(closestIdx);
  };

  const handleTrackKeyDown = (event) => {
    if (!hasCarouselReviews) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollToReviewIndex(activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollToReviewIndex(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollToReviewIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToReviewIndex(reviews.length - 1);
    }
  };

  return (
    <section
      id="google-reviews"
      ref={sectionRef}
      aria-labelledby={headingId}
      data-testid="google-reviews-section"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 overflow-x-clip border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Section Editorial Header + Live Rating Summary */}
        <div className="border-studio-ink grid grid-cols-1 gap-6 border-b-2 pb-8 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-studio-ink text-studio-white inline-block px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
                GOOGLE MAPS REVIEWS
              </span>
              <GoogleMapsBadge />
            </div>

            <h2
              id={headingId}
              className="font-display text-studio-ink mt-3 text-4xl leading-[0.94] font-black tracking-tight uppercase sm:text-6xl"
            >
              HEAR IT FROM THE PEOPLE WHO PLAY HERE.
            </h2>

            <p className="text-studio-muted-ink mt-3 max-w-2xl text-xs leading-relaxed font-medium sm:text-sm">
              Real experiences shared by musicians and customers who have visited 37 Music Studio.
            </p>
          </div>

          {/* Summary Card — live aggregate data when verified, honest fallback CTA otherwise */}
          <div className="lg:col-span-5">
            {place && (place.rating !== null || place.userRatingCount !== null) ? (
              <div
                data-testid="google-reviews-summary-card"
                className="brutal-card bg-studio-lime text-studio-ink p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {place.rating !== null ? (
                      <span
                        data-testid="google-reviews-aggregate-rating"
                        className="font-display text-5xl leading-none font-black tracking-tight sm:text-6xl"
                      >
                        {place.rating.toFixed(1)}
                      </span>
                    ) : null}

                    <div>
                      {place.rating !== null ? (
                        <StarRatingRow
                          rating={place.rating}
                          labelPrefix="Studio aggregate rating"
                        />
                      ) : null}
                      {place.userRatingCount !== null ? (
                        <p
                          data-testid="google-reviews-total-count"
                          className="text-studio-ink mt-1.5 font-mono text-xs font-extrabold uppercase"
                        >
                          {place.userRatingCount.toLocaleString('en-US')} Google ratings
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <GoogleMapsBadge />
                </div>

                <div className="border-studio-ink/25 mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <span className="font-mono text-[10px] font-bold tracking-wider uppercase">
                    Straight from Google Maps
                  </span>
                  <a
                    href={listingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-ink hover:text-studio-white inline-flex min-h-11 items-center justify-center gap-1.5 px-4 py-2 font-mono text-xs font-extrabold tracking-wider uppercase"
                  >
                    <span>READ ALL GOOGLE REVIEWS</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : (
              <div
                data-testid="google-reviews-fallback-summary"
                className="brutal-card bg-studio-white text-studio-ink p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold uppercase">
                    <MapPin className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>37 Music Studio TANGERANG</span>
                  </span>
                  <GoogleMapsBadge />
                </div>

                <p className="text-studio-muted-ink mt-3 text-xs leading-relaxed sm:text-sm">
                  {reviewState.phase === 'unconfigured'
                    ? 'Live Google review integration is not configured yet for this environment. Open our verified Google Maps listing directly.'
                    : reviewState.phase === 'loading' || reviewState.phase === 'idle'
                      ? 'Preparing live customer reviews from Google Maps.'
                      : 'Browse live studio ratings and customer reviews directly on our official Google Maps listing.'}
                </p>

                <div className="mt-4">
                  <a
                    href={listingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-4 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase sm:w-auto"
                  >
                    <span>VIEW OUR REVIEWS ON GOOGLE MAPS</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body State 1: Loading / Pre-visibility Skeleton */}
        {reviewState.phase === 'loading' || reviewState.phase === 'idle' ? (
          <div
            data-testid="google-reviews-loading"
            aria-busy={reviewState.phase === 'loading'}
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="border-studio-ink bg-studio-white flex flex-col justify-between border-2 p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-studio-ink/10 h-10 w-10 shrink-0 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="bg-studio-ink/15 h-3 w-28 animate-pulse" />
                    <div className="bg-studio-ink/10 h-2.5 w-20 animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="bg-studio-ink/10 h-3 w-full animate-pulse" />
                  <div className="bg-studio-ink/10 h-3 w-5/6 animate-pulse" />
                  <div className="bg-studio-ink/10 h-3 w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Body State 2: Loaded Up To 5 Authentic Reviews Carousel */}
        {hasCarouselReviews ? (
          <div
            className="mt-8"
            role="region"
            aria-roledescription="carousel"
            aria-label="Google Maps customer reviews"
          >
            {/* Carousel Header Bar with Desktop/Keyboard Controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wide uppercase">
                Showing {reviews.length} review{reviews.length === 1 ? '' : 's'} in Google relevance
                order
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollToReviewIndex(activeIndex - 1)}
                  disabled={activeIndex <= 0}
                  aria-label="Previous Google reviews"
                  className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToReviewIndex(activeIndex + 1)}
                  disabled={activeIndex >= reviews.length - 1}
                  aria-label="Next Google reviews"
                  className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-10 w-10 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              ref={trackRef}
              tabIndex={0}
              onScroll={handleTrackScroll}
              onKeyDown={handleTrackKeyDown}
              data-testid="google-reviews-carousel-track"
              data-active-index={activeIndex}
              aria-label="Scrollable Google reviews track (use left and right arrow keys)"
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 focus-visible:outline-2 motion-reduce:scroll-auto"
            >
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Body State 3: Valid Place with 0 eligible review cards */}
        {reviewState.phase === 'empty' ? (
          <div
            data-testid="google-reviews-empty-state"
            className="border-studio-ink bg-studio-white mt-8 border-2 p-6 sm:p-8"
          >
            <p className="font-display text-studio-ink text-2xl font-black uppercase sm:text-3xl">
              Reviews Available on Google Maps
            </p>
            <p className="text-studio-muted-ink mt-2 max-w-2xl text-xs leading-relaxed sm:text-sm">
              No individual review cards are returned right now. View all ratings and visitor
              reviews directly on our official Google Maps listing.
            </p>
            <div className="mt-4">
              <a
                href={listingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
              >
                <span>VIEW OUR REVIEWS ON GOOGLE MAPS</span>
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        ) : null}

        {/* Mandatory Attribution, Returned Place Attributions & Relevance Disclosure */}
        <div
          data-testid="google-reviews-attribution-footer"
          className="border-studio-ink/20 text-studio-muted-ink mt-6 flex flex-col gap-2 border-t pt-4 font-mono text-[11px] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-studio-ink inline-flex items-center gap-1.5 font-bold">
              <GoogleGMark />
              <span>Powered by Google</span>
            </span>
            <span>•</span>
            <span>Displayed review order reflects Google’s returned relevance order.</span>
          </div>

          {place?.attributions?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-studio-ink font-semibold">Data attribution:</span>
              {place.attributions.map((attr, idx) =>
                attr.providerURI ? (
                  <a
                    key={`${attr.provider}-${idx}`}
                    href={attr.providerURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-studio-ink underline"
                  >
                    {attr.provider}
                  </a>
                ) : (
                  <span key={`${attr.provider}-${idx}`}>{attr.provider}</span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
