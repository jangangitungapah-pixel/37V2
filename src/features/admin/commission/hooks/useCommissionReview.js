import { useEffect, useMemo, useState } from 'react';

import {
  COMMISSION_REVIEW_PAGE_SIZE,
  getCommissionRepositoryAdapter,
} from '../repositories/commission-repository';

/**
 * Subscribes to completed studio bookings within the selected `actualCompletedAt`
 * period bounds and cross-references `commissionPostingItems/{bookingId}` in realtime.
 *
 * Strictly skips all Firestore subscriptions when `enabled === false` (e.g. non-Owner role).
 */
export function useCommissionReview({
  enabled = true,
  periodBounds,
  maxLimit = COMMISSION_REVIEW_PAGE_SIZE,
} = {}) {
  const periodKey = `${enabled ? '1' : '0'}:${periodBounds?.startMs || 0}:${periodBounds?.endMs || 0}:${maxLimit}`;

  const [periodState, setPeriodState] = useState({
    key: '',
    bookings: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !periodBounds?.startDate || !periodBounds?.endDate) {
      return undefined;
    }

    const adapter = getCommissionRepositoryAdapter();
    const currentKey = periodKey;

    const unsubscribe = adapter.subscribePeriodCompletedBookings({
      startDate: periodBounds.startDate,
      endDate: periodBounds.endDate,
      maxLimit,
      onData: ({ bookings, hasMore }) => {
        setPeriodState({
          key: currentKey,
          bookings: bookings || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setPeriodState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat daftar sesi selesai pada periode yang dipilih.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [enabled, periodKey, periodBounds?.startDate, periodBounds?.endDate, maxLimit]);

  const loadedBookings = useMemo(() => {
    if (!enabled) return [];
    return periodState.key === periodKey ? periodState.bookings : [];
  }, [enabled, periodState.key, periodState.bookings, periodKey]);

  const bookingIdsKey = useMemo(
    () =>
      loadedBookings
        .map((b) => b.id)
        .filter(Boolean)
        .join(','),
    [loadedBookings],
  );

  const [postingState, setPostingState] = useState({
    key: '',
    map: new Map(),
    error: null,
  });

  const [resolutionState, setResolutionState] = useState({
    key: '',
    map: new Map(),
    error: null,
  });

  useEffect(() => {
    if (!enabled || !bookingIdsKey) {
      return undefined;
    }

    const adapter = getCommissionRepositoryAdapter();
    const bookingIds = bookingIdsKey.split(',').filter(Boolean);
    const currentKey = bookingIdsKey;

    const unsubPostings = adapter.subscribePostingItemsForBookingIds({
      bookingIds,
      onData: (itemsMap) => {
        setPostingState({
          key: currentKey,
          map: itemsMap || new Map(),
          error: null,
        });
      },
      onError: (err) => {
        setPostingState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memeriksa status posting item komisi.',
        }));
      },
    });

    const unsubResolutions = adapter.subscribeReviewResolutionsForBookingIds({
      bookingIds,
      onData: (resMap) => {
        setResolutionState({
          key: currentKey,
          map: resMap || new Map(),
          error: null,
        });
      },
      onError: (err) => {
        setResolutionState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memeriksa status penyelesaian Needs Review.',
        }));
      },
    });

    return () => {
      unsubPostings?.();
      unsubResolutions?.();
    };
  }, [enabled, bookingIdsKey]);

  const postingItemsByBookingId = useMemo(() => {
    if (!enabled || !bookingIdsKey) return new Map();
    return postingState.key === bookingIdsKey ? postingState.map : new Map();
  }, [enabled, bookingIdsKey, postingState.key, postingState.map]);

  const resolutionsByBookingId = useMemo(() => {
    if (!enabled || !bookingIdsKey) return new Map();
    return resolutionState.key === bookingIdsKey ? resolutionState.map : new Map();
  }, [enabled, bookingIdsKey, resolutionState.key, resolutionState.map]);

  const isPeriodLoading = Boolean(enabled && periodState.key !== periodKey);
  const isPostingLookupLoading = Boolean(
    enabled &&
    bookingIdsKey &&
    (postingState.key !== bookingIdsKey || resolutionState.key !== bookingIdsKey),
  );

  return {
    bookings: loadedBookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    hasMore: enabled && periodState.key === periodKey ? periodState.hasMore : false,
    isLoading: isPeriodLoading || isPostingLookupLoading,
    error: periodState.error || postingState.error || resolutionState.error || null,
  };
}
