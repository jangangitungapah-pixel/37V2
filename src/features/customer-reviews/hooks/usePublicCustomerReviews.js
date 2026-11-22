import { useEffect, useState } from 'react';

import { CUSTOMER_REVIEW_LIMITS } from '../config/customer-review-config';
import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';
import { buildPublicReviewStatsViewModel } from '../services/public-review-stats-service';

/**
 * Public Landing Page subscription hook reading ONLY published `customerReviews`
 * and `publicReviewStats/summary`. Never subscribes to pending/rejected/archived reviews or invitations.
 */
export function usePublicCustomerReviews({
  maxLimit = CUSTOMER_REVIEW_LIMITS.publicReviewsLimit,
  enabled = true,
} = {}) {
  const [state, setState] = useState({
    reviews: [],
    statsDoc: null,
    isLoading: Boolean(enabled),
    error: '',
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let isCancelled = false;
    let reviewsReady = false;
    let statsReady = false;
    const adapter = getCustomerReviewRepositoryAdapter();

    const unsubReviews = adapter.subscribePublishedReviews({
      maxLimit,
      onData: (items) => {
        if (isCancelled) return;
        reviewsReady = true;
        setState((prev) => ({
          ...prev,
          reviews: items || [],
          isLoading: !(reviewsReady && statsReady),
          error: '',
        }));
      },
      onError: (err) => {
        if (isCancelled) return;
        reviewsReady = true;
        setState((prev) => ({
          ...prev,
          isLoading: !(reviewsReady && statsReady),
          error: err?.message || 'Unable to load customer reviews right now.',
        }));
      },
    });

    const unsubStats = adapter.subscribePublicReviewStats({
      onData: (statsDoc) => {
        if (isCancelled) return;
        statsReady = true;
        setState((prev) => ({
          ...prev,
          statsDoc: statsDoc || null,
          isLoading: !(reviewsReady && statsReady),
        }));
      },
      onError: (err) => {
        if (isCancelled) return;
        statsReady = true;
        setState((prev) => ({
          ...prev,
          isLoading: !(reviewsReady && statsReady),
          error: prev.error || err?.message || 'Unable to load review rating summary.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubReviews?.();
      unsubStats?.();
    };
  }, [enabled, maxLimit]);

  const statsView = buildPublicReviewStatsViewModel(state.statsDoc);

  return {
    reviews: state.reviews,
    stats: statsView,
    isLoading: state.isLoading,
    error: state.error,
  };
}
