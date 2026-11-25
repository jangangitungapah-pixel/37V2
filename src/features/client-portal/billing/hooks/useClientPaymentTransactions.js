import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import {
  CLIENT_TRANSACTIONS_INITIAL_LIMIT,
  CLIENT_TRANSACTIONS_PAGE_STEP,
  getClientBillingRepositoryAdapter,
} from '../repositories/client-billing-repository';
import { mapClientBillingErrorToMessage } from '../utils/client-billing-utils';

const EMPTY_REVERSED_SET = new Set();

/**
 * Live realtime subscription hook for the authenticated active Client's own
 * customer-safe payment & correction transactions scoped to `invoiceId` (or `invoiceIds`).
 */
export function useClientPaymentTransactions({
  invoiceId = '',
  invoiceIds = [],
  enabled = true,
  initialLimit = CLIENT_TRANSACTIONS_INITIAL_LIMIT,
  customAdapter = null,
} = {}) {
  const { user, accountType, clientAccount } = useAuth();

  const cleanUid = String(user?.uid || '').trim();
  const cleanCustomerId = String(clientAccount?.customerId || '').trim();
  const cleanSingleInvoiceId = String(invoiceId || '').trim();

  const normalizedInvoiceIdsKey = useMemo(() => {
    if (cleanSingleInvoiceId) return cleanSingleInvoiceId;
    return Array.from(
      new Set(
        (Array.isArray(invoiceIds) ? invoiceIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    )
      .sort()
      .join(',');
  }, [cleanSingleInvoiceId, invoiceIds]);

  const targetIdsList = useMemo(
    () => (normalizedInvoiceIdsKey ? normalizedInvoiceIdsKey.split(',').filter(Boolean) : []),
    [normalizedInvoiceIdsKey],
  );

  const isClientReady = Boolean(
    enabled &&
      cleanUid &&
      cleanCustomerId &&
      targetIdsList.length > 0 &&
      (accountType === 'client' || !accountType) &&
      clientAccount?.status === 'active',
  );

  const resolvedAdapter = customAdapter || getClientBillingRepositoryAdapter();
  const [extraLimit, setExtraLimit] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const effectiveLimit =
    Math.max(1, Number(initialLimit) || CLIENT_TRANSACTIONS_INITIAL_LIMIT) + extraLimit;

  const subscriptionKey = isClientReady
    ? `${cleanUid}:${cleanCustomerId}:${normalizedInvoiceIdsKey}:${effectiveLimit}:${refreshNonce}`
    : 'disabled';

  const [snapshotState, setSnapshotState] = useState({
    resolvedAdapter: null,
    resolvedKey: '',
    transactions: [],
    reversedTransactionIds: EMPTY_REVERSED_SET,
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

    const unsubscribe = resolvedAdapter.subscribeClientPaymentTransactions({
      customerId: cleanCustomerId,
      clientUid: cleanUid,
      invoiceId: cleanSingleInvoiceId,
      invoiceIds: cleanSingleInvoiceId ? [] : targetIdsList,
      maxLimit: effectiveLimit,
      onData: ({ transactions, reversedTransactionIds, hasMore, isTruncated }) => {
        if (isCancelled) return;
        setSnapshotState({
          resolvedAdapter,
          resolvedKey: currentKey,
          transactions: Array.isArray(transactions) ? transactions : [],
          reversedTransactionIds:
            reversedTransactionIds instanceof Set ? reversedTransactionIds : EMPTY_REVERSED_SET,
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
          transactions: [],
          reversedTransactionIds: EMPTY_REVERSED_SET,
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
  }, [
    cleanCustomerId,
    cleanSingleInvoiceId,
    effectiveLimit,
    isClientReady,
    resolvedAdapter,
    subscriptionKey,
    targetIdsList,
  ]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const loadMore = useCallback(() => {
    setExtraLimit((prev) => prev + CLIENT_TRANSACTIONS_PAGE_STEP);
  }, []);

  const isSnapshotCurrent =
    isClientReady &&
    snapshotState.resolvedAdapter === resolvedAdapter &&
    snapshotState.resolvedKey === subscriptionKey;

  return {
    transactions: isSnapshotCurrent ? snapshotState.transactions : [],
    reversedTransactionIds: isSnapshotCurrent
      ? snapshotState.reversedTransactionIds
      : EMPTY_REVERSED_SET,
    isLoading: isClientReady ? !isSnapshotCurrent : false,
    hasMore: Boolean(isSnapshotCurrent && snapshotState.hasMore),
    isTruncated: Boolean(isSnapshotCurrent && snapshotState.isTruncated),
    error: isSnapshotCurrent ? snapshotState.error : '',
    retry,
    loadMore,
  };
}
