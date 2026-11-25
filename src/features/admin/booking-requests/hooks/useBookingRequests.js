import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  BOOKING_REQUEST_INBOX_PAGE_SIZE,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import { getBookingRequestRepositoryAdapter } from '../repositories/booking-request-repository';

export function useBookingRequests({
  statusFilter = 'all',
  requestTypeFilter = 'all',
  serviceFilter = 'all',
  preferredDateFilter = '',
  searchQuery = '',
  pageSize = BOOKING_REQUEST_INBOX_PAGE_SIZE,
} = {}) {
  const adapter = getBookingRequestRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [subscriptionState, setSubscriptionState] = useState({
    loadedAdapter: null,
    requests: [],
    hasMore: false,
    isTruncated: false,
    lastCursor: null,
    error: null,
  });
  const [extraRequests, setExtraRequests] = useState([]);
  const [paginationState, setPaginationState] = useState({
    hasMore: false,
    lastCursor: null,
    isLoadingMore: false,
    loadMoreError: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = adapter.subscribeBookingRequests({
      maxLimit: pageSize,
      onData: ({ requests, hasMore, isTruncated, lastCursor }) => {
        if (isCancelled) return;
        setSubscriptionState({
          loadedAdapter: adapter,
          requests: requests || [],
          hasMore: Boolean(hasMore),
          isTruncated: Boolean(isTruncated),
          lastCursor: lastCursor ?? null,
          error: null,
        });
        setPaginationState((prev) => ({
          ...prev,
          hasMore: Boolean(hasMore),
          lastCursor: lastCursor ?? null,
        }));
      },
      onError: (err) => {
        if (isCancelled) return;
        setSubscriptionState((prev) => ({
          ...prev,
          loadedAdapter: adapter,
          error: err?.message || 'Gagal memuat daftar booking request dari Firestore.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [adapter, pageSize, refreshNonce]);

  const allLoadedRequests = useMemo(() => {
    const byId = new Map();
    for (const item of subscriptionState.requests) {
      if (item?.id) byId.set(item.id, item);
    }
    for (const item of extraRequests) {
      if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }, [subscriptionState.requests, extraRequests]);

  const summaryCounts = useMemo(() => {
    const counts = {
      totalLoaded: allLoadedRequests.length,
      newCount: 0,
      inReviewCount: 0,
      awaitingCustomerCount: 0,
      acceptedCount: 0,
      confirmedCount: 0,
      declinedCount: 0,
      closedCount: 0,
      postProductionCount: 0,
    };

    for (const item of allLoadedRequests) {
      if (item.status === BOOKING_REQUEST_STATUS.NEW) counts.newCount += 1;
      else if (item.status === BOOKING_REQUEST_STATUS.IN_REVIEW) counts.inReviewCount += 1;
      else if (item.status === BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER) {
        counts.awaitingCustomerCount += 1;
      } else if (item.status === BOOKING_REQUEST_STATUS.ACCEPTED) counts.acceptedCount += 1;
      else if (item.status === BOOKING_REQUEST_STATUS.CONFIRMED) counts.confirmedCount += 1;
      else if (item.status === BOOKING_REQUEST_STATUS.DECLINED) counts.declinedCount += 1;
      else if (item.status === BOOKING_REQUEST_STATUS.CLOSED) counts.closedCount += 1;

      if (item.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY) {
        counts.postProductionCount += 1;
      }
    }

    return counts;
  }, [allLoadedRequests]);

  const filteredRequests = useMemo(() => {
    const cleanSearch = String(searchQuery || '')
      .trim()
      .toLowerCase();

    return allLoadedRequests.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (requestTypeFilter !== 'all' && item.requestType !== requestTypeFilter) return false;
      if (serviceFilter !== 'all') {
        const serviceId = String(item.publicServiceId || '').trim().toLowerCase();
        const selectedService = String(serviceFilter || '').trim().toLowerCase();
        const isMixMasterFilter =
          selectedService === 'mix-master' &&
          ['mix-master', 'mixing', 'mastering'].includes(serviceId);
        if (!isMixMasterFilter && serviceId !== selectedService) return false;
      }
      if (preferredDateFilter && item.preferredDate !== preferredDateFilter) return false;

      if (cleanSearch) {
        const haystack = [
          item.requestReference,
          item.customerName,
          item.bandName,
          item.contactPhone,
          item.serviceLabelSnapshot,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(cleanSearch)) return false;
      }

      return true;
    });
  }, [
    allLoadedRequests,
    statusFilter,
    requestTypeFilter,
    serviceFilter,
    preferredDateFilter,
    searchQuery,
  ]);

  const loadMore = useCallback(async () => {
    if (paginationState.isLoadingMore || !paginationState.hasMore || !paginationState.lastCursor) {
      return;
    }

    setPaginationState((prev) => ({
      ...prev,
      isLoadingMore: true,
      loadMoreError: '',
    }));

    try {
      const result = await adapter.fetchMoreBookingRequests({
        cursor: paginationState.lastCursor,
        pageSize,
      });
      setExtraRequests((prev) => [...prev, ...(result.requests || [])]);
      setPaginationState({
        hasMore: Boolean(result.hasMore),
        lastCursor: result.lastCursor ?? null,
        isLoadingMore: false,
        loadMoreError: '',
      });
    } catch (err) {
      setPaginationState((prev) => ({
        ...prev,
        isLoadingMore: false,
        loadMoreError: err?.message || 'Gagal memuat request berikutnya.',
      }));
    }
  }, [adapter, pageSize, paginationState]);

  const retry = useCallback(() => {
    setExtraRequests([]);
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const isLoading = subscriptionState.loadedAdapter !== adapter && !subscriptionState.error;

  return {
    allLoadedRequests,
    filteredRequests,
    summaryCounts,
    isLoading,
    error: subscriptionState.error,
    isTruncated:
      subscriptionState.isTruncated && extraRequests.length === 0 ? true : paginationState.hasMore,
    hasMore: paginationState.hasMore,
    isLoadingMore: paginationState.isLoadingMore,
    loadMoreError: paginationState.loadMoreError,
    maxLimit: pageSize,
    loadMore,
    retry,
  };
}
