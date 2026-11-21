import { useCallback, useEffect, useState } from 'react';

import {
  BOOKKEEPING_ENTRIES_PAGE_SIZE,
  BOOKKEEPING_PAYABLES_LIMIT,
} from '../config/bookkeeping-config';
import { getBookkeepingRepositoryAdapter } from '../repositories/bookkeeping-repository';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';

/**
 * Owner-only realtime subscriptions to bounded `bookkeepingEntries` (`occurredAt desc`)
 * and active payable obligations (`settlementStatus in ['unpaid', 'partially_paid']`).
 * Skips Firestore listeners completely when `enabled === false`.
 */
export function useBookkeepingEntries({ enabled = true } = {}) {
  const [entriesLimit, setEntriesLimit] = useState(BOOKKEEPING_ENTRIES_PAGE_SIZE);
  const [payablesLimit, setPayablesLimit] = useState(BOOKKEEPING_PAYABLES_LIMIT);

  const entriesKey = `${enabled ? '1' : '0'}:${entriesLimit}`;
  const payablesKey = `${enabled ? '1' : '0'}:${payablesLimit}`;

  const [entriesState, setEntriesState] = useState({
    key: '',
    entries: [],
    hasMore: false,
    error: null,
  });

  const [payablesState, setPayablesState] = useState({
    key: '',
    payables: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getBookkeepingRepositoryAdapter();
    const currentKey = entriesKey;
    const unsubscribe = adapter.subscribeBookkeepingEntries({
      maxLimit: entriesLimit,
      onData: ({ entries, hasMore }) => {
        setEntriesState({
          key: currentKey,
          entries: entries || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setEntriesState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, entriesKey, entriesLimit]);

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getBookkeepingRepositoryAdapter();
    const currentKey = payablesKey;
    const unsubscribe = adapter.subscribeActivePayables({
      maxLimit: payablesLimit,
      onData: ({ payables, hasMore }) => {
        setPayablesState({
          key: currentKey,
          payables: payables || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setPayablesState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, payablesKey, payablesLimit]);

  const loadMoreEntries = useCallback(() => {
    setEntriesLimit((prev) => prev + BOOKKEEPING_ENTRIES_PAGE_SIZE);
  }, []);

  const loadMorePayables = useCallback(() => {
    setPayablesLimit((prev) => prev + BOOKKEEPING_PAYABLES_LIMIT);
  }, []);

  return {
    entries: enabled && entriesState.key === entriesKey ? entriesState.entries : [],
    hasMoreEntries: enabled && entriesState.key === entriesKey ? entriesState.hasMore : false,
    isEntriesLoading: Boolean(enabled && entriesState.key !== entriesKey),
    entriesError: enabled ? entriesState.error : null,
    loadMoreEntries,
    activePayables: enabled && payablesState.key === payablesKey ? payablesState.payables : [],
    hasMorePayables: enabled && payablesState.key === payablesKey ? payablesState.hasMore : false,
    isPayablesLoading: Boolean(enabled && payablesState.key !== payablesKey),
    payablesError: enabled ? payablesState.error : null,
    loadMorePayables,
  };
}
