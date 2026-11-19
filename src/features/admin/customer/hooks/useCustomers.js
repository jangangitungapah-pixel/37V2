import { useCallback, useEffect, useState } from 'react';

import {
  CUSTOMERS_DEFAULT_QUERY_LIMIT,
  getCustomerRepositoryAdapter,
} from '../repositories/customer-repository';
import { scanLegacyBookingsPreview } from '../services/customer-migration-service';
import { mapCustomerErrorToMessage } from '../services/customer-service';

/**
 * Realtime bounded subscription to `customers` plus lightweight paginated legacy scan
 * to detect unlinked pre-Phase-7 bookings and build an optional band-name search map.
 */
export function useCustomers({ initialLimit = CUSTOMERS_DEFAULT_QUERY_LIMIT } = {}) {
  const [maxLimit, setMaxLimit] = useState(initialLimit);
  const [state, setState] = useState({
    customers: [],
    hasMore: false,
    isLoading: true,
    error: null,
  });

  const [legacyStatus, setLegacyStatus] = useState({
    isChecking: true,
    unlinkedCount: 0,
    needsReviewCount: 0,
    bandNamesByCustomerId: new Map(),
  });

  useEffect(() => {
    const adapter = getCustomerRepositoryAdapter();
    const unsubscribe = adapter.subscribeCustomers({
      maxLimit,
      onData: ({ customers, hasMore }) => {
        setState({
          customers,
          hasMore: Boolean(hasMore),
          isLoading: false,
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: mapCustomerErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [maxLimit]);

  const refreshLegacyOverview = useCallback(async () => {
    try {
      const adapter = getCustomerRepositoryAdapter();
      const preview = await scanLegacyBookingsPreview({ pageSize: 200, maxPages: 3, adapter });

      // Build lightweight band-name index from scanned bookings for Customer Directory search
      const bandMap = new Map();
      const page = await adapter.listBookingsPage({ pageSize: 200 });
      for (const booking of page.bookings) {
        if (booking.customerId && booking.bandName) {
          if (!bandMap.has(booking.customerId)) {
            bandMap.set(booking.customerId, []);
          }
          bandMap.get(booking.customerId).push(booking.bandName);
        }
      }

      setLegacyStatus({
        isChecking: false,
        unlinkedCount: preview.totalLegacyUnlinked,
        needsReviewCount: preview.needsReviewCount,
        bandNamesByCustomerId: bandMap,
      });
    } catch {
      setLegacyStatus((prev) => ({
        ...prev,
        isChecking: false,
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await refreshLegacyOverview();
    })();
    return () => {
      active = false;
    };
  }, [refreshLegacyOverview]);

  const loadMoreCustomers = useCallback(() => {
    setMaxLimit((prev) => prev + CUSTOMERS_DEFAULT_QUERY_LIMIT);
  }, []);

  return {
    customers: state.customers,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreCustomers,
    legacyUnlinkedCount: legacyStatus.unlinkedCount,
    legacyNeedsReviewCount: legacyStatus.needsReviewCount,
    bandNamesByCustomerId: legacyStatus.bandNamesByCustomerId,
    refreshLegacyOverview,
  };
}
