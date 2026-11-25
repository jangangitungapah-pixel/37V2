import { useCallback, useEffect, useState } from 'react';

import { getClientReservationBackfillService } from '../services/client-reservation-backfill-service';

export function useClientReservationBackfill({
  actorUid,
  actorRole,
  enabled = true,
} = {}) {
  const service = getClientReservationBackfillService();
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled || String(actorRole || '').toLowerCase() !== 'owner') {
      setStatus(null);
      setIsLoading(false);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    const unsubscribe = service.subscribeStatus({
      actorUid,
      actorRole,
      onData: (nextStatus) => {
        if (cancelled) return;
        setStatus(nextStatus);
        setIsLoading(false);
        setError('');
      },
      onError: (nextError) => {
        if (cancelled) return;
        setError(nextError?.message || 'Gagal memuat status backfill.');
        setIsLoading(false);
      },
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [actorUid, actorRole, enabled, service]);

  const runNextBatch = useCallback(async () => {
    if (!enabled || String(actorRole || '').toLowerCase() !== 'owner') {
      throw new Error('Hanya Owner aktif yang boleh menjalankan identity backfill.');
    }
    setIsRunning(true);
    setError('');
    try {
      return await service.runNextBatch({ actorUid, actorRole });
    } catch (nextError) {
      setError(nextError?.message || 'Backfill gagal dijalankan.');
      throw nextError;
    } finally {
      setIsRunning(false);
    }
  }, [actorUid, actorRole, enabled, service]);

  return { status, isLoading, isRunning, error, runNextBatch };
}
