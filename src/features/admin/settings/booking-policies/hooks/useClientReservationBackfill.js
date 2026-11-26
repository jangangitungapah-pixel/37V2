import { useCallback, useEffect, useState } from 'react';

import { getClientReservationBackfillService } from '../services/client-reservation-backfill-service';

export function useClientReservationBackfill({
  actorUid,
  actorRole,
  enabled = true,
} = {}) {
  const service = getClientReservationBackfillService();
  const normalizedActorRole = String(actorRole || '').toLowerCase();
  const canSubscribe = Boolean(enabled && normalizedActorRole === 'owner');
  const subscriptionKey = canSubscribe ? `${actorUid || ''}:${normalizedActorRole}` : 'disabled';
  const [subscriptionState, setSubscriptionState] = useState({
    key: '',
    status: null,
    isLoading: true,
    error: '',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState({ key: '', message: '' });

  useEffect(() => {
    if (!canSubscribe) return undefined;

    let cancelled = false;
    const currentKey = subscriptionKey;
    const unsubscribe = service.subscribeStatus({
      actorUid,
      actorRole: normalizedActorRole,
      onData: (nextStatus) => {
        if (cancelled) return;
        setSubscriptionState({
          key: currentKey,
          status: nextStatus,
          isLoading: false,
          error: '',
        });
      },
      onError: (nextError) => {
        if (cancelled) return;
        setSubscriptionState({
          key: currentKey,
          status: null,
          isLoading: false,
          error: nextError?.message || 'Gagal memuat status backfill.',
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [actorUid, canSubscribe, normalizedActorRole, service, subscriptionKey]);

  const hasCurrentSubscription =
    canSubscribe && subscriptionState.key === subscriptionKey;
  const status = hasCurrentSubscription ? subscriptionState.status : null;
  const isLoading = canSubscribe && (!hasCurrentSubscription || subscriptionState.isLoading);
  const error = hasCurrentSubscription
    ? subscriptionState.error || (runError.key === subscriptionKey ? runError.message : '')
    : '';

  const runNextBatch = useCallback(async () => {
    if (!canSubscribe) {
      throw new Error('Hanya Owner aktif yang boleh menjalankan identity backfill.');
    }
    setIsRunning(true);
    setRunError({ key: subscriptionKey, message: '' });
    try {
      return await service.runNextBatch({ actorUid, actorRole: normalizedActorRole });
    } catch (nextError) {
      setRunError({
        key: subscriptionKey,
        message: nextError?.message || 'Backfill gagal dijalankan.',
      });
      throw nextError;
    } finally {
      setIsRunning(false);
    }
  }, [actorUid, canSubscribe, normalizedActorRole, service, subscriptionKey]);

  return { status, isLoading, isRunning, error, runNextBatch };
}
