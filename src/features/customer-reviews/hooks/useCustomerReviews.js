import { useEffect, useState } from 'react';

import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';

/**
 * Owner subscription hook for all customer reviews and public review stats summary.
 */
export function useCustomerReviews({ enabled = true } = {}) {
  const [state, setState] = useState({
    reviews: [],
    stats: null,
    isLoading: Boolean(enabled),
    error: '',
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let isCancelled = false;
    let reviewsReady = false;
    let statsReady = false;
    const adapter = getCustomerReviewRepositoryAdapter();

    const unsubReviews = adapter.subscribeAllCustomerReviews({
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
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err?.message || 'Gagal memuat daftar ulasan pelanggan.',
        }));
      },
    });

    const unsubStats = adapter.subscribePublicReviewStats({
      onData: (statsDoc) => {
        if (isCancelled) return;
        statsReady = true;
        setState((prev) => ({
          ...prev,
          stats: statsDoc || null,
          isLoading: !(reviewsReady && statsReady),
        }));
      },
      onError: (err) => {
        if (isCancelled) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: prev.error || err?.message || 'Gagal memuat ringkasan statistik ulasan.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubReviews?.();
      unsubStats?.();
    };
  }, [enabled]);

  return state;
}
