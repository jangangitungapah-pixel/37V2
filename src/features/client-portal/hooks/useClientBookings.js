import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBookingRequestRepositoryAdapter } from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { mapBookingRequestErrorToMessage } from '@/features/admin/booking-requests/services/booking-request-service';
import { useAuth } from '@/features/auth/AuthContext';

import { classifyClientBookings } from '../utils/client-bookings-utils';

/**
 * Live realtime subscription hook for the authenticated active Client's own
 * Client Portal booking requests & confirmed sessions (`publicBookingRequests`
 * where `source == 'client_portal' && clientUid == uid`).
 */
export function useClientBookings({
  enabled = true,
  maxLimit = 100,
  now,
  customAdapter = null,
} = {}) {
  const { user, clientAccount } = useAuth();
  const cleanClientUid = String(user?.uid || '').trim();
  const isClientReady = Boolean(enabled && cleanClientUid && clientAccount?.status === 'active');

  const resolvedAdapter = customAdapter || getBookingRequestRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const subscriptionKey = isClientReady
    ? `${cleanClientUid}:${maxLimit}:${refreshNonce}`
    : 'disabled';

  const [snapshotState, setSnapshotState] = useState({
    resolvedAdapter: null,
    resolvedKey: '',
    records: [],
    isTruncated: false,
    error: '',
  });

  useEffect(() => {
    if (!isClientReady) {
      return undefined;
    }

    let isCancelled = false;
    const currentKey = subscriptionKey;

    const unsubscribe = resolvedAdapter.subscribeClientBookingRequests({
      clientUid: cleanClientUid,
      maxLimit,
      onData: ({ requests, isTruncated }) => {
        if (isCancelled) return;
        setSnapshotState({
          resolvedAdapter,
          resolvedKey: currentKey,
          records: Array.isArray(requests) ? requests : [],
          isTruncated: Boolean(isTruncated),
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        const mapped = mapBookingRequestErrorToMessage(err);
        const friendlyError =
          mapped && !mapped.includes('could not be submitted')
            ? mapped
            : 'Unable to load your bookings right now. Please check your connection and try again.';
        setSnapshotState({
          resolvedAdapter,
          resolvedKey: currentKey,
          records: [],
          isTruncated: false,
          error: friendlyError,
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [cleanClientUid, isClientReady, maxLimit, resolvedAdapter, subscriptionKey]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const isLoading = isClientReady
    ? snapshotState.resolvedAdapter !== resolvedAdapter ||
      snapshotState.resolvedKey !== subscriptionKey
    : false;

  const activeRecords = useMemo(
    () =>
      isClientReady &&
      snapshotState.resolvedAdapter === resolvedAdapter &&
      snapshotState.resolvedKey === subscriptionKey
        ? snapshotState.records
        : [],
    [
      isClientReady,
      resolvedAdapter,
      snapshotState.records,
      snapshotState.resolvedAdapter,
      snapshotState.resolvedKey,
      subscriptionKey,
    ],
  );

  const classified = useMemo(
    () => classifyClientBookings(activeRecords, now),
    [activeRecords, now],
  );

  return {
    ...classified,
    isLoading,
    isTruncated: Boolean(isClientReady && snapshotState.isTruncated),
    error:
      isClientReady && snapshotState.resolvedKey === subscriptionKey ? snapshotState.error : '',
    retry,
  };
}
