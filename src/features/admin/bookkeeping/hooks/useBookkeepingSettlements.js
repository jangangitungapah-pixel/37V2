import { useCallback, useEffect, useState } from 'react';

import { BOOKKEEPING_SETTLEMENTS_PAGE_SIZE } from '../config/bookkeeping-config';
import { getBookkeepingRepositoryAdapter } from '../repositories/bookkeeping-repository';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';

/**
 * Owner-only realtime subscription to append-only `bookkeepingSettlements` (`paidAt desc`).
 */
export function useBookkeepingSettlements({ enabled = true } = {}) {
  const [settlementsLimit, setSettlementsLimit] = useState(BOOKKEEPING_SETTLEMENTS_PAGE_SIZE);
  const activeKey = `${enabled ? '1' : '0'}:${settlementsLimit}`;

  const [state, setState] = useState({
    key: '',
    settlements: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const adapter = getBookkeepingRepositoryAdapter();
    const currentKey = activeKey;
    const unsubscribe = adapter.subscribeBookkeepingSettlements({
      maxLimit: settlementsLimit,
      onData: ({ settlements, hasMore }) => {
        setState({
          key: currentKey,
          settlements: settlements || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, activeKey, settlementsLimit]);

  const loadMoreSettlements = useCallback(() => {
    setSettlementsLimit((prev) => prev + BOOKKEEPING_SETTLEMENTS_PAGE_SIZE);
  }, []);

  return {
    settlements: enabled && state.key === activeKey ? state.settlements : [],
    hasMoreSettlements: enabled && state.key === activeKey ? state.hasMore : false,
    isSettlementsLoading: Boolean(enabled && state.key !== activeKey),
    settlementsError: enabled ? state.error : null,
    loadMoreSettlements,
  };
}

/**
 * Subscribes to all settlement records for a single payable entry inside Detail Drawer.
 */
export function useEntrySettlementHistory({ entryId = '', enabled = true } = {}) {
  const activeKey = enabled && entryId ? `1:${entryId}` : '';

  const [state, setState] = useState({
    key: '',
    items: [],
    error: null,
  });

  useEffect(() => {
    if (!enabled || !entryId) return undefined;

    const adapter = getBookkeepingRepositoryAdapter();
    const currentKey = activeKey;
    const unsubscribe = adapter.subscribeEntrySettlements({
      entryId,
      maxLimit: 100,
      onData: (items) => {
        setState({
          key: currentKey,
          items: items || [],
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, entryId, activeKey]);

  return {
    settlements: activeKey && state.key === activeKey ? state.items : [],
    isLoading: Boolean(activeKey && state.key !== activeKey),
    error: activeKey ? state.error : null,
  };
}
