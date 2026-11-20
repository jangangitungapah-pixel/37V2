import { useCallback, useEffect, useState } from 'react';

import { INVENTORY_MOVEMENTS_PAGE_SIZE } from '../config/inventory-config';
import { getInventoryRepositoryAdapter } from '../repositories/inventory-repository';
import { mapInventoryErrorToMessage } from '../services/inventory-item-service';

/**
 * Bounded paginated subscription to global `inventoryMovements` ordered newest first.
 */
export function useInventoryMovements({ initialLimit = INVENTORY_MOVEMENTS_PAGE_SIZE } = {}) {
  const [maxLimit, setMaxLimit] = useState(initialLimit);
  const [state, setState] = useState({
    movements: [],
    hasMore: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const adapter = getInventoryRepositoryAdapter();
    const unsubscribe = adapter.subscribeInventoryMovements({
      maxLimit,
      onData: ({ movements, hasMore }) => {
        setState({
          movements,
          hasMore: Boolean(hasMore),
          isLoading: false,
          error: null,
        });
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
  }, [maxLimit]);

  const loadMoreMovements = useCallback(() => {
    setMaxLimit((prev) => prev + INVENTORY_MOVEMENTS_PAGE_SIZE);
  }, []);

  return {
    movements: state.movements,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreMovements,
  };
}
