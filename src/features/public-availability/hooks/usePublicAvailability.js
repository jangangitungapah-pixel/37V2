import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  PUBLIC_AVAILABILITY_QUERY_LIMIT,
  PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';
import { getPublicAvailabilityRepositoryAdapter } from '../repositories/public-availability-repository';
import { mapPublicAvailabilityErrorToMessage } from '../services/public-availability-service';
import {
  buildPublicAvailabilityScheduleMatrix,
  getPublicCalendarDateRange,
} from '../utils/public-availability-calculation';

/**
 * Lightweight listener hook for ONLY `publicAvailabilityMetadata/status` (`isReady` & sync timestamps).
 * Useful in Admin screens (like AdminCalendarPage) so the Owner immediately sees whether `/availability`
 * is initialized without subscribing to the entire public slot range.
 */
export function usePublicAvailabilityMetadata({ enabled = true } = {}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const metadataKey = `${enabled ? '1' : '0'}:${refreshNonce}`;

  const [metadataState, setMetadataState] = useState({
    key: '',
    metadata: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getPublicAvailabilityRepositoryAdapter();
    const currentKey = metadataKey;

    const unsubMetadata = adapter.subscribePublicAvailabilityMetadata({
      onData: (meta) => {
        setMetadataState({
          key: currentKey,
          metadata: meta,
          error: null,
        });
      },
      onError: (err) => {
        setMetadataState({
          key: currentKey,
          metadata: null,
          error: mapPublicAvailabilityErrorToMessage(err, { isAdmin: true }),
        });
      },
    });

    return () => {
      unsubMetadata?.();
    };
  }, [enabled, metadataKey]);

  const isLoading = Boolean(enabled && metadataState.key !== metadataKey);
  const activeError = metadataState.key === metadataKey ? metadataState.error : null;
  const activeMetadata = metadataState.key === metadataKey ? metadataState.metadata : null;
  const isReady = Boolean(!isLoading && !activeError && activeMetadata?.isReady === true);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  return {
    metadata: activeMetadata,
    isReady,
    isLoading,
    error: activeError,
    retry,
  };
}

/**
 * Subscribes to sanitized `publicAvailability` projections and `publicAvailabilityMetadata/status`
 * for the selected `Asia/Jakarta` date range (`day` or `week` view).
 *
 * Fail-Closed Guarantee:
 * - Never shows all rooms as available while `isLoading`, when `error` occurs, when
 *   `metadata.isReady !== true`, or when `isTruncated === true`.
 * - Cleans up all Firestore subscriptions when navigating dates or unmounting.
 */
export function usePublicAvailability({
  viewMode = PUBLIC_VIEW_MODES.DAY,
  activeDateIso = '',
  roomFilter = 'all',
  requestedDurationMinutes = PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  maxLimit = PUBLIC_AVAILABILITY_QUERY_LIMIT,
  enabled = true,
  now,
} = {}) {
  const [refreshNonce, setRefreshNonce] = useState(0);

  const dateRange = useMemo(
    () => getPublicCalendarDateRange(viewMode, activeDateIso, now),
    [viewMode, activeDateIso, now],
  );

  const rangeKey = `${enabled ? '1' : '0'}:${dateRange.startDate}:${dateRange.endDate}:${maxLimit}:${refreshNonce}`;
  const metadataKey = `${enabled ? '1' : '0'}:${refreshNonce}`;

  const [projectionState, setProjectionState] = useState({
    key: '',
    projections: [],
    isTruncated: false,
    maxLimit,
    error: null,
  });

  const [metadataState, setMetadataState] = useState({
    key: '',
    metadata: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getPublicAvailabilityRepositoryAdapter();
    const currentKey = rangeKey;

    const unsubProjections = adapter.subscribePublicAvailabilityInRange({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      maxLimit,
      onData: ({ projections, isTruncated, maxLimit: resolvedLimit }) => {
        setProjectionState({
          key: currentKey,
          projections: projections || [],
          isTruncated: Boolean(isTruncated),
          maxLimit: resolvedLimit || maxLimit,
          error: null,
        });
      },
      onError: (err) => {
        setProjectionState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapPublicAvailabilityErrorToMessage(err, { isAdmin: false }),
        }));
      },
    });

    return () => {
      unsubProjections?.();
    };
  }, [enabled, rangeKey, dateRange.startDate, dateRange.endDate, maxLimit]);

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getPublicAvailabilityRepositoryAdapter();
    const currentMetaKey = metadataKey;

    const unsubMetadata = adapter.subscribePublicAvailabilityMetadata({
      onData: (meta) => {
        setMetadataState({
          key: currentMetaKey,
          metadata: meta,
          error: null,
        });
      },
      onError: (err) => {
        setMetadataState({
          key: currentMetaKey,
          metadata: null,
          error: mapPublicAvailabilityErrorToMessage(err, { isAdmin: false }),
        });
      },
    });

    return () => {
      unsubMetadata?.();
    };
  }, [enabled, metadataKey]);

  const isLoading = Boolean(
    enabled && (projectionState.key !== rangeKey || metadataState.key !== metadataKey),
  );
  const error =
    (projectionState.key === rangeKey ? projectionState.error : null) ||
    (metadataState.key === metadataKey ? metadataState.error : null) ||
    null;
  const isReady = Boolean(
    !isLoading &&
    !error &&
    metadataState.key === metadataKey &&
    metadataState.metadata?.isReady === true,
  );
  const isTruncated = Boolean(projectionState.key === rangeKey && projectionState.isTruncated);
  const projections = useMemo(
    () => (!isLoading && !error && isReady && !isTruncated ? projectionState.projections : []),
    [isLoading, error, isReady, isTruncated, projectionState.projections],
  );

  const roomSchedules = useMemo(() => {
    if (isLoading || error || !isReady || isTruncated) {
      return [];
    }
    return buildPublicAvailabilityScheduleMatrix({
      days: dateRange.days,
      roomFilter,
      projections,
      requestedDurationMinutes,
      now,
    });
  }, [
    isLoading,
    error,
    isReady,
    isTruncated,
    dateRange.days,
    roomFilter,
    projections,
    requestedDurationMinutes,
    now,
  ]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  return {
    dateRange,
    projections,
    roomSchedules,
    metadata: metadataState.key === metadataKey ? metadataState.metadata : null,
    isReady,
    isTruncated,
    maxLimit: projectionState.maxLimit,
    isLoading,
    error,
    retry,
  };
}
