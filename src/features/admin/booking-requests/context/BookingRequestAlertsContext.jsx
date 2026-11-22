import { useCallback, useEffect, useMemo, useState } from 'react';

import { BOOKING_REQUEST_NEW_BADGE_LIMIT } from '../config/booking-request-config';
import { getBookingRequestRepositoryAdapter } from '../repositories/booking-request-repository';
import {
  BookingRequestAlertsContext,
  computeBookingRequestAlertsSummary,
} from './booking-request-alerts-context';

/**
 * Single shared bounded subscription (`status == 'new'`, limit 20) mounted in `AdminLayout`
 * to power both the sidebar badge and Dashboard Needs Attention without duplicate listeners.
 */
export function BookingRequestAlertsProvider({ children }) {
  const adapter = getBookingRequestRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState({
    loadedAdapter: null,
    requests: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = adapter.subscribeNewBookingRequests({
      maxLimit: BOOKING_REQUEST_NEW_BADGE_LIMIT,
      onData: ({ requests, hasMore }) => {
        if (isCancelled) return;
        setState({
          loadedAdapter: adapter,
          requests: requests || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState((prev) => ({
          ...prev,
          loadedAdapter: adapter,
          error: err?.message || 'Gagal memuat notifikasi booking request.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [adapter, refreshNonce]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const value = useMemo(() => {
    const isLoading = state.loadedAdapter !== adapter && !state.error;
    return {
      ...computeBookingRequestAlertsSummary({
        requests: state.requests,
        hasMore: state.hasMore,
        isLoading,
        error: state.error,
      }),
      retry,
    };
  }, [state, adapter, retry]);

  return (
    <BookingRequestAlertsContext.Provider value={value}>
      {children}
    </BookingRequestAlertsContext.Provider>
  );
}
