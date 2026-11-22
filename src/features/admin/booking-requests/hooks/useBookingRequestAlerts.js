import { useContext, useEffect, useMemo, useState } from 'react';

import { BOOKING_REQUEST_NEW_BADGE_LIMIT } from '../config/booking-request-config';
import {
  BookingRequestAlertsContext,
  computeBookingRequestAlertsSummary,
} from '../context/booking-request-alerts-context';
import { getBookingRequestRepositoryAdapter } from '../repositories/booking-request-repository';

/**
 * Reads shared bounded new booking request alerts when inside `BookingRequestAlertsProvider`,
 * or maintains a single standalone subscription when mounted in isolated components/tests.
 */
export function useBookingRequestAlerts() {
  const contextValue = useContext(BookingRequestAlertsContext);
  const adapter = getBookingRequestRepositoryAdapter();
  const [standaloneState, setStandaloneState] = useState({
    loadedAdapter: null,
    requests: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    if (contextValue) {
      return undefined;
    }

    let isCancelled = false;
    const unsubscribe = adapter.subscribeNewBookingRequests({
      maxLimit: BOOKING_REQUEST_NEW_BADGE_LIMIT,
      onData: ({ requests, hasMore }) => {
        if (isCancelled) return;
        setStandaloneState({
          loadedAdapter: adapter,
          requests: requests || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setStandaloneState((prev) => ({
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
  }, [contextValue, adapter]);

  return useMemo(() => {
    if (contextValue) {
      return contextValue;
    }
    return {
      ...computeBookingRequestAlertsSummary({
        requests: standaloneState.requests,
        hasMore: standaloneState.hasMore,
        isLoading: standaloneState.loadedAdapter !== adapter && !standaloneState.error,
        error: standaloneState.error,
      }),
      retry: () => {},
    };
  }, [contextValue, standaloneState, adapter]);
}
