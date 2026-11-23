import { useCallback, useEffect, useRef, useState } from 'react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import {
  backfillPublicAvailabilityProjections,
  mapPublicAvailabilityErrorToMessage,
} from '../services/public-availability-service';
import { usePublicAvailabilityMetadata } from './usePublicAvailability';

/**
 * Automatically initializes/heals `publicAvailabilityMetadata/status` and active projections
 * when an active Studio Owner opens any Admin Portal route, eliminating manual sync steps.
 */
export function useOwnerPublicAvailabilityAutoSync({
  enabled = false,
  actorUid = '',
  actorRole = '',
} = {}) {
  const cleanUid = String(actorUid || '').trim();
  const canSubscribe = Boolean(enabled);

  const {
    metadata,
    isReady,
    isLoading,
    error: metaError,
  } = usePublicAvailabilityMetadata({ enabled: canSubscribe });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');

  const inFlightRef = useRef(false);
  const attemptedAutoSyncRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (!canSubscribe || !cleanUid || inFlightRef.current) {
      return { ok: false, skipped: true };
    }

    inFlightRef.current = true;
    setIsSyncing(true);
    setSyncError('');
    setSyncSuccess('');

    try {
      const result = await backfillPublicAvailabilityProjections({
        actorUid: cleanUid,
        actorRole,
        fromDateIso: getJakartaTodayIso(),
      });
      const message = `Kalender publik (/availability) aktif & tersinkron (${result.activeProjectedCount} sesi aktif diverifikasi).`;
      setSyncSuccess(message);
      return { ok: true, result, message };
    } catch (err) {
      const errorMessage = mapPublicAvailabilityErrorToMessage(err, { isAdmin: true });
      setSyncError(errorMessage);
      return { ok: false, errorMessage };
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [actorRole, canSubscribe, cleanUid]);

  useEffect(() => {
    if (
      !canSubscribe ||
      !cleanUid ||
      isLoading ||
      metaError ||
      isReady ||
      isSyncing ||
      inFlightRef.current ||
      attemptedAutoSyncRef.current
    ) {
      return undefined;
    }

    let isCancelled = false;
    Promise.resolve().then(() => {
      if (isCancelled || inFlightRef.current || attemptedAutoSyncRef.current) return;
      attemptedAutoSyncRef.current = true;
      void triggerSync();
    });

    return () => {
      isCancelled = true;
    };
  }, [canSubscribe, cleanUid, isLoading, isReady, isSyncing, metaError, triggerSync]);

  return {
    metadata,
    isReady,
    isLoading,
    metaError,
    isSyncing,
    syncError,
    syncSuccess,
    triggerSync,
  };
}
