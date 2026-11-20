import { useCallback, useEffect, useState } from 'react';

import { INVENTORY_ITEM_HISTORY_PAGE_SIZE } from '../config/inventory-config';
import { getInventoryRepositoryAdapter } from '../repositories/inventory-repository';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';

/**
 * Controlled paginated loader for a single item's Movement History inside Detail Drawer.
 * Re-fetches cleanly whenever `itemId`, `itemVersion`, or `maxLimit` updates.
 */
export function useInventoryItemDetail({
  itemId = '',
  itemVersion = 0,
  enabled = false,
  initialLimit = INVENTORY_ITEM_HISTORY_PAGE_SIZE,
} = {}) {
  const [limitByItemKey, setLimitByItemKey] = useState({ itemId: '', maxLimit: initialLimit });
  const maxLimit = limitByItemKey.itemId === itemId ? limitByItemKey.maxLimit : initialLimit;

  const [state, setState] = useState({
    movements: [],
    hasMore: false,
    totalLoaded: 0,
    isLoading: false,
    error: null,
  });

  const loadHistory = useCallback(async () => {
    if (!enabled || !itemId) {
      setState({
        movements: [],
        hasMore: false,
        totalLoaded: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const adapter = getInventoryRepositoryAdapter();
      const result = await adapter.listItemMovements({ itemId, maxLimit });
      setState({
        movements: result.movements || [],
        hasMore: Boolean(result.hasMore),
        totalLoaded: result.totalLoaded || result.movements?.length || 0,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: mapInventoryErrorToMessage(err),
      }));
    }
  }, [enabled, itemId, maxLimit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadHistory();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadHistory, itemVersion]);

  const loadMoreHistory = useCallback(() => {
    setLimitByItemKey((prev) => ({
      itemId,
      maxLimit:
        (prev.itemId === itemId ? prev.maxLimit : initialLimit) + INVENTORY_ITEM_HISTORY_PAGE_SIZE,
    }));
  }, [itemId, initialLimit]);

  return {
    movements: state.movements,
    hasMore: state.hasMore,
    totalLoaded: state.totalLoaded,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreHistory,
    refreshHistory: loadHistory,
  };
}
