import { useCallback, useEffect, useMemo, useState } from 'react';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { useAuth } from '@/features/auth/AuthContext';

import {
  CLIENT_INVOICES_INITIAL_LIMIT,
  CLIENT_INVOICES_PAGE_STEP,
  getClientBillingRepositoryAdapter,
} from '../repositories/client-billing-repository';
import {
  computeClientBillingMetrics,
  mapClientBillingErrorToMessage,
} from '../utils/client-billing-utils';

const EMPTY_METRICS = Object.freeze({
  totalOutstanding: 0,
  totalPaid: 0,
  unpaidCount: 0,
  overdueCount: 0,
  filterCounts: {
    all: 0,
    unpaid: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  },
});

/**
 * Live realtime subscription hook for the authenticated active Client's own
 * customer-visible (`issued` | `void`) studio invoices.
 *
 * Security invariants:
 * - Identity (`user.uid`, `clientAccount.customerId`, `clientAccount.status`) is read
 *   exclusively from `useAuth()`. Never accepts `customerId` via props or URL params.
 * - Immediately isolates state when UID, customerId, or active status changes.
 */
export function useClientInvoices({
  enabled = true,
  initialLimit = CLIENT_INVOICES_INITIAL_LIMIT,
  now,
  customAdapter = null,
} = {}) {
  const { user, accountType, clientAccount } = useAuth();

  const cleanUid = String(user?.uid || '').trim();
  const cleanCustomerId = String(clientAccount?.customerId || '').trim();
  const isClientReady = Boolean(
    enabled &&
      cleanUid &&
      cleanCustomerId &&
      (accountType === 'client' || !accountType) &&
      clientAccount?.status === 'active',
  );

  const resolvedAdapter = customAdapter || getClientBillingRepositoryAdapter();
  const [extraLimit, setExtraLimit] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const effectiveLimit = Math.max(1, Number(initialLimit) || CLIENT_INVOICES_INITIAL_LIMIT) + extraLimit;

  const subscriptionKey = isClientReady
    ? `${cleanUid}:${cleanCustomerId}:${effectiveLimit}:${refreshNonce}`
    : 'disabled';

  const [snapshotState, setSnapshotState] = useState({
    resolvedAdapter: null,
    resolvedKey: '',
    invoices: [],
    hasMore: false,
    isTruncated: false,
    error: '',
  });

  useEffect(() => {
    if (!isClientReady) {
      return undefined;
    }

    let isCancelled = false;
    const currentKey = subscriptionKey;

    const unsubscribe = resolvedAdapter.subscribeClientInvoices({
      customerId: cleanCustomerId,
      maxLimit: effectiveLimit,
      onData: ({ invoices, hasMore, isTruncated }) => {
        if (isCancelled) return;
        setSnapshotState({
          resolvedAdapter,
          resolvedKey: currentKey,
          invoices: Array.isArray(invoices) ? invoices : [],
          hasMore: Boolean(hasMore),
          isTruncated: Boolean(isTruncated ?? hasMore),
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setSnapshotState({
          resolvedAdapter,
          resolvedKey: currentKey,
          invoices: [],
          hasMore: false,
          isTruncated: false,
          error: mapClientBillingErrorToMessage(err),
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [cleanCustomerId, effectiveLimit, isClientReady, resolvedAdapter, subscriptionKey]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const loadMore = useCallback(() => {
    setExtraLimit((prev) => prev + CLIENT_INVOICES_PAGE_STEP);
  }, []);

  const isSnapshotCurrent =
    isClientReady &&
    snapshotState.resolvedAdapter === resolvedAdapter &&
    snapshotState.resolvedKey === subscriptionKey;

  const isLoading = isClientReady ? !isSnapshotCurrent : false;

  const activeInvoices = useMemo(
    () => (isSnapshotCurrent ? snapshotState.invoices : []),
    [isSnapshotCurrent, snapshotState.invoices],
  );

  const referenceDateIso = useMemo(() => getJakartaTodayIso(now), [now]);

  const metrics = useMemo(
    () =>
      isSnapshotCurrent
        ? computeClientBillingMetrics(activeInvoices, referenceDateIso)
        : EMPTY_METRICS,
    [activeInvoices, isSnapshotCurrent, referenceDateIso],
  );

  return {
    invoices: activeInvoices,
    metrics,
    referenceDateIso,
    isClientReady,
    isLoading,
    hasMore: Boolean(isSnapshotCurrent && snapshotState.hasMore),
    isTruncated: Boolean(isSnapshotCurrent && snapshotState.isTruncated),
    maxLimit: effectiveLimit,
    error: isSnapshotCurrent ? snapshotState.error : '',
    retry,
    loadMore,
  };
}
