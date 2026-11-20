import { useCallback, useEffect, useState } from 'react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import { INVENTORY_ITEMS_PAGE_SIZE } from '../config/inventory-config';
import { getInventoryRepositoryAdapter } from '../repositories/inventory-repository';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';

/**
 * Bounded paginated subscription to `inventoryItems`, plus separate archived loader
 * and server-aggregated summary counters (`count()` + bounded due-maintenance check)
 * so KPI metrics remain accurate even when directory pagination hasn't loaded every record.
 */
export function useInventoryItems({
  initialLimit = INVENTORY_ITEMS_PAGE_SIZE,
  loadArchived = false,
} = {}) {
  const [maxLimit, setMaxLimit] = useState(initialLimit);
  const [archivedLimit, setArchivedLimit] = useState(INVENTORY_ITEMS_PAGE_SIZE);
  const [state, setState] = useState({
    items: [],
    hasMore: false,
    isLoading: true,
    error: null,
  });

  const [archivedState, setArchivedState] = useState({
    items: [],
    hasMore: false,
    isLoading: false,
  });

  const [summary, setSummary] = useState({
    activeItemsCount: 0,
    archivedItemsCount: 0,
    lowStockCount: 0,
    maintenanceCount: 0,
    damagedRetiredCount: 0,
    maintenanceBoundedExceeded: false,
    isServerAggregated: false,
  });

  const refreshSummary = useCallback(async () => {
    try {
      const adapter = getInventoryRepositoryAdapter();
      const todayIso = getJakartaTodayIso();
      const result = await adapter.fetchInventorySummary({ todayIso });
      setSummary(result);
    } catch {
      // Keep local metrics fallback without throwing noisy secondary error
    }
  }, []);

  const refreshArchived = useCallback(async () => {
    setArchivedState((prev) => ({ ...prev, isLoading: true }));
    try {
      const adapter = getInventoryRepositoryAdapter();
      const result = await adapter.listArchivedInventoryItems({ maxLimit: archivedLimit });
      setArchivedState({
        items: result.items || [],
        hasMore: Boolean(result.hasMore),
        isLoading: false,
      });
    } catch {
      setArchivedState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [archivedLimit]);

  useEffect(() => {
    const adapter = getInventoryRepositoryAdapter();
    const unsubscribe = adapter.subscribeInventoryItems({
      maxLimit,
      onData: ({ items, hasMore }) => {
        setState({
          items,
          hasMore: Boolean(hasMore),
          isLoading: false,
          error: null,
        });
        refreshSummary();
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: mapInventoryErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [maxLimit, refreshSummary]);

  useEffect(() => {
    if (!loadArchived) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refreshArchived();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadArchived, refreshArchived, state.items]);

  const loadMoreItems = useCallback(() => {
    setMaxLimit((prev) => prev + INVENTORY_ITEMS_PAGE_SIZE);
  }, []);

  const loadMoreArchived = useCallback(() => {
    setArchivedLimit((prev) => prev + INVENTORY_ITEMS_PAGE_SIZE);
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshSummary();
    if (loadArchived) {
      await refreshArchived();
    }
  }, [refreshSummary, refreshArchived, loadArchived]);

  return {
    items: state.items,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreItems,
    archivedItems: archivedState.items,
    hasMoreArchived: archivedState.hasMore,
    isArchivedLoading: archivedState.isLoading,
    loadMoreArchived,
    summary,
    refreshSummary,
    refreshAll,
  };
}
