import { useCallback, useEffect, useMemo, useState } from 'react';

import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';

import {
  loadCustomerBookingHistory,
  mapCustomerErrorToMessage,
} from '../services/customer-service';
import { extractDistinctBandNames } from '../utils/customer-history';

const HISTORY_PAGE_SIZE = 10;

/**
 * Loads deduplicated virtual merged booking history for a Customer Profile across
 * `customer.historyCustomerIds`, with bounded per-chunk queries and Load More pagination.
 */
export function useCustomerBookingHistory(customer, { pageSize = HISTORY_PAGE_SIZE } = {}) {
  const customerKey = customer
    ? `${customer.id}:${(customer.historyCustomerIds || []).join(',')}:${customer.version}`
    : '';

  const [state, setState] = useState({
    loadedKey: '',
    bookings: [],
    isTruncated: false,
    error: null,
  });
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const fetchHistory = useCallback(async () => {
    if (!customer?.id) return;
    try {
      const result = await loadCustomerBookingHistory({
        customer,
        perChunkLimit: 100,
      });
      setState({
        loadedKey: customerKey,
        bookings: result.bookings,
        isTruncated: Boolean(result.isTruncated),
        error: null,
      });
    } catch (err) {
      setState({
        loadedKey: customerKey,
        bookings: [],
        isTruncated: false,
        error: mapCustomerErrorToMessage(err),
      });
    }
  }, [customer, customerKey]);

  useEffect(() => {
    if (!customer?.id) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const result = await loadCustomerBookingHistory({
          customer,
          perChunkLimit: 100,
        });
        if (cancelled) return;
        setVisibleCount(pageSize);
        setState({
          loadedKey: customerKey,
          bookings: result.bookings,
          isTruncated: Boolean(result.isTruncated),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loadedKey: customerKey,
          bookings: [],
          isTruncated: false,
          error: mapCustomerErrorToMessage(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, customerKey, pageSize]);

  const isLoading = Boolean(customer?.id && state.loadedKey !== customerKey);
  const bookings = useMemo(
    () => (state.loadedKey === customerKey ? state.bookings : []),
    [state.loadedKey, customerKey, state.bookings],
  );

  const visibleBookings = useMemo(() => bookings.slice(0, visibleCount), [bookings, visibleCount]);

  const hasMore = visibleCount < bookings.length;
  const bandHistory = useMemo(() => extractDistinctBandNames(bookings), [bookings]);

  const activeBookingsCount = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.sessionStatus !== BOOKING_SESSION_STATUS.CANCELLED &&
          b.sessionStatus !== BOOKING_SESSION_STATUS.NO_SHOW,
      ).length,
    [bookings],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + pageSize);
  }, [pageSize]);

  return {
    bookings,
    visibleBookings,
    totalLoaded: bookings.length,
    activeBookingsCount,
    bandHistory,
    hasMore,
    isTruncated: state.isTruncated,
    isLoading,
    error: state.loadedKey === customerKey ? state.error : null,
    loadMore,
    refresh: fetchHistory,
  };
}
