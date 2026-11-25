import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import { getClientBillingRepositoryAdapter } from '../repositories/client-billing-repository';
import { mapClientBillingErrorToMessage } from '../utils/client-billing-utils';
import { useClientPaymentTransactions } from './useClientPaymentTransactions';

/**
 * Subscribes in realtime to a selected Client invoice and its customer-safe
 * payment transaction timeline (`paymentTransactions` scoped to `customerId` + `invoiceId`).
 */
export function useClientInvoiceDetail({
  invoiceId = '',
  fallbackInvoice = null,
  enabled = true,
  customAdapter = null,
} = {}) {
  const { user, accountType, clientAccount } = useAuth();

  const cleanUid = String(user?.uid || '').trim();
  const cleanCustomerId = String(clientAccount?.customerId || '').trim();
  const cleanInvoiceId = String(invoiceId || '').trim();

  const isClientReady = Boolean(
    enabled &&
      cleanUid &&
      cleanCustomerId &&
      cleanInvoiceId &&
      (accountType === 'client' || !accountType) &&
      clientAccount?.status === 'active',
  );

  const resolvedAdapter = customAdapter || getClientBillingRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const subscriptionKey = isClientReady
    ? `${cleanUid}:${cleanCustomerId}:${cleanInvoiceId}:${refreshNonce}`
    : 'disabled';

  const [invoiceState, setInvoiceState] = useState({
    resolvedAdapter: null,
    resolvedKey: '',
    invoice: null,
    error: '',
  });

  useEffect(() => {
    if (!isClientReady) {
      return undefined;
    }

    let isCancelled = false;
    const currentKey = subscriptionKey;

    const unsubscribe = resolvedAdapter.subscribeClientInvoiceById({
      customerId: cleanCustomerId,
      clientUid: cleanUid,
      invoiceId: cleanInvoiceId,
      onData: (invoice) => {
        if (isCancelled) return;
        setInvoiceState({
          resolvedAdapter,
          resolvedKey: currentKey,
          invoice,
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setInvoiceState({
          resolvedAdapter,
          resolvedKey: currentKey,
          invoice: null,
          error: mapClientBillingErrorToMessage(err),
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [cleanCustomerId, cleanInvoiceId, isClientReady, resolvedAdapter, subscriptionKey]);

  const txResult = useClientPaymentTransactions({
    invoiceId: cleanInvoiceId,
    enabled: isClientReady,
    customAdapter: resolvedAdapter,
  });

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
    txResult.retry();
  }, [txResult]);

  const isInvoiceCurrent =
    isClientReady &&
    invoiceState.resolvedAdapter === resolvedAdapter &&
    invoiceState.resolvedKey === subscriptionKey;

  const liveInvoice = isInvoiceCurrent
    ? invoiceState.invoice
    : isClientReady && fallbackInvoice?.id === cleanInvoiceId
      ? fallbackInvoice
      : null;

  return {
    invoice: liveInvoice,
    transactions: txResult.transactions,
    reversedTransactionIds: txResult.reversedTransactionIds,
    isLoading: isClientReady ? !isInvoiceCurrent || txResult.isLoading : false,
    isTransactionsLoading: txResult.isLoading,
    hasMoreTransactions: txResult.hasMore,
    isTransactionsTruncated: txResult.isTruncated,
    loadMoreTransactions: txResult.loadMore,
    error: (isInvoiceCurrent ? invoiceState.error : '') || txResult.error,
    retry,
  };
}
