import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBookingRequestRepositoryAdapter } from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { mapBookingRequestErrorToMessage } from '@/features/admin/booking-requests/services/booking-request-service';
import { getBookingRepositoryAdapter } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { useAuth } from '@/features/auth/AuthContext';

import { classifyClientBookings, mergeClientBookingRecords } from '../utils/client-bookings-utils';

/**
 * Subscribes to both request workflow records and the canonical customer-safe reservation
 * projection. Requests remain the source for unconfirmed inquiries; clientReservations is
 * authoritative for every confirmed / operational booking, including CRM-linked walk-ins.
 */
export function useClientBookings({
  enabled = true,
  maxLimit = 100,
  now,
  customAdapter = null,
} = {}) {
  const { user, clientAccount } = useAuth();
  const cleanClientUid = String(user?.uid || '').trim();
  const cleanCustomerId = String(clientAccount?.customerId || '').trim();
  const isClientReady = Boolean(
    enabled && cleanClientUid && clientAccount?.status === 'active',
  );

  const requestAdapter = customAdapter || getBookingRequestRepositoryAdapter();
  const reservationAdapter = getBookingRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const subscriptionKey = isClientReady
    ? `${cleanClientUid}:${cleanCustomerId}:${maxLimit}:${refreshNonce}`
    : 'disabled';

  const [streamState, setStreamState] = useState({
    requestAdapter: null,
    reservationAdapter: null,
    key: '',
    requests: null,
    reservations: null,
    requestsTruncated: false,
    reservationsTruncated: false,
    requestError: '',
    reservationError: '',
  });

  useEffect(() => {
    if (!isClientReady) return undefined;

    let cancelled = false;
    const currentKey = subscriptionKey;
    const publish = (patch) => {
      if (cancelled) return;
      setStreamState((previous) => ({
        ...previous,
        requestAdapter,
        reservationAdapter,
        key: currentKey,
        ...patch,
      }));
    };

    const unsubscribeRequests = requestAdapter.subscribeClientBookingRequests({
      clientUid: cleanClientUid,
      maxLimit,
      onData: ({ requests, isTruncated }) => {
        publish({
          requests: Array.isArray(requests) ? requests : [],
          requestsTruncated: Boolean(isTruncated),
          requestError: '',
        });
      },
      onError: (error) => {
        const mapped = mapBookingRequestErrorToMessage(error);
        publish({
          requests: [],
          requestsTruncated: false,
          requestError:
            mapped && !mapped.includes('could not be submitted')
              ? mapped
              : 'Unable to load your booking requests. Please check your connection and try again.',
        });
      },
    });

    const unsubscribeReservations = reservationAdapter.subscribeClientReservations({
      clientUid: cleanClientUid,
      customerId: cleanCustomerId,
      maxLimit,
      onData: ({ reservations, isTruncated }) => {
        publish({
          reservations: Array.isArray(reservations) ? reservations : [],
          reservationsTruncated: Boolean(isTruncated),
          reservationError: '',
        });
      },
      onError: (error) => {
        publish({
          reservations: [],
          reservationsTruncated: false,
          reservationError:
            error?.message ||
            'Unable to load your confirmed studio sessions. Please try again.',
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribeRequests?.();
      unsubscribeReservations?.();
    };
  }, [
    cleanClientUid,
    cleanCustomerId,
    isClientReady,
    maxLimit,
    requestAdapter,
    reservationAdapter,
    subscriptionKey,
  ]);

  const retry = useCallback(() => {
    setRefreshNonce((previous) => previous + 1);
  }, []);

  const hasCurrentSubscription =
    isClientReady &&
    streamState.requestAdapter === requestAdapter &&
    streamState.reservationAdapter === reservationAdapter &&
    streamState.key === subscriptionKey;

  const isLoading =
    isClientReady &&
    (!hasCurrentSubscription ||
      streamState.requests === null ||
      streamState.reservations === null);

  const merged = useMemo(() => {
    if (!hasCurrentSubscription) {
      return { records: [], isTruncated: false };
    }
    return mergeClientBookingRecords({
      requests: streamState.requests || [],
      reservations: streamState.reservations || [],
      maxLimit,
    });
  }, [
    hasCurrentSubscription,
    maxLimit,
    streamState.requests,
    streamState.reservations,
  ]);

  const classified = useMemo(
    () => classifyClientBookings(merged.records, now),
    [merged.records, now],
  );

  const error = hasCurrentSubscription
    ? streamState.requestError || streamState.reservationError
    : '';

  return {
    ...classified,
    isLoading,
    isTruncated: Boolean(
      isClientReady &&
      hasCurrentSubscription &&
      (
        streamState.requestsTruncated ||
        streamState.reservationsTruncated ||
        merged.isTruncated
      ),
    ),
    error,
    retry,
  };
}
