import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';

import {
  PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT,
  PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
} from '../config/payment-evidence-config';
import { getPaymentEvidenceRepositoryAdapter } from '../repositories/payment-evidence-repository';
import { mapPaymentEvidenceErrorToMessage } from '../services/payment-evidence-service';

/**
 * Customer-scoped realtime hook for `paymentEvidence`.
 * - Pass `invoiceId` to scope to one invoice (`ClientInvoiceDetailDrawer`).
 * - Omit `invoiceId` to subscribe once across all customer evidence (`ClientInvoicesPage`)
 *   and group by `invoiceId` without N+1 listeners.
 */
export function useClientPaymentEvidence({
  invoiceId = '',
  enabled = true,
  maxLimit = null,
  customAdapter = null,
} = {}) {
  const { user, accountType, clientAccount } = useAuth();

  const cleanUid = String(user?.uid || '').trim();
  const cleanCustomerId = String(clientAccount?.customerId || '').trim();
  const cleanInvoiceId = String(invoiceId || '').trim();
  const effectiveLimit =
    Number(maxLimit) ||
    (cleanInvoiceId ? PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT : PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT);

  const isClientReady = Boolean(
    enabled &&
      cleanUid &&
      cleanCustomerId &&
      (accountType === 'client' || !accountType) &&
      clientAccount?.status === 'active',
  );

  const resolvedAdapter = customAdapter || getPaymentEvidenceRepositoryAdapter();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const subscriptionKey = isClientReady
    ? `${cleanUid}:${cleanCustomerId}:${cleanInvoiceId || 'all'}:${effectiveLimit}:${refreshNonce}`
    : 'disabled';

  const [snapshotState, setSnapshotState] = useState({
    resolvedAdapter: null,
    resolvedKey: '',
    items: [],
    hasMore: false,
    isTruncated: false,
    error: '',
  });

  useEffect(() => {
    if (!isClientReady) return undefined;

    let isCancelled = false;
    const currentKey = subscriptionKey;

    const handleData = ({ items, hasMore, isTruncated }) => {
      if (isCancelled) return;
      setSnapshotState({
        resolvedAdapter,
        resolvedKey: currentKey,
        items: Array.isArray(items) ? items : [],
        hasMore: Boolean(hasMore),
        isTruncated: Boolean(isTruncated ?? hasMore),
        error: '',
      });
    };

    const handleError = (err) => {
      if (isCancelled) return;
      setSnapshotState({
        resolvedAdapter,
        resolvedKey: currentKey,
        items: [],
        hasMore: false,
        isTruncated: false,
        error: mapPaymentEvidenceErrorToMessage(err, { locale: 'en' }),
      });
    };

    const unsubscribe = cleanInvoiceId
      ? resolvedAdapter.subscribeClientInvoiceEvidence({
          customerId: cleanCustomerId,
          clientUid: cleanUid,
          invoiceId: cleanInvoiceId,
          maxLimit: effectiveLimit,
          onData: handleData,
          onError: handleError,
        })
      : resolvedAdapter.subscribeClientCustomerEvidence({
          customerId: cleanCustomerId,
          clientUid: cleanUid,
          maxLimit: effectiveLimit,
          onData: handleData,
          onError: handleError,
        });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [
    cleanCustomerId,
    cleanInvoiceId,
    effectiveLimit,
    isClientReady,
    resolvedAdapter,
    subscriptionKey,
  ]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const isSnapshotCurrent =
    isClientReady &&
    snapshotState.resolvedAdapter === resolvedAdapter &&
    snapshotState.resolvedKey === subscriptionKey;

  const items = useMemo(
    () => (isSnapshotCurrent ? snapshotState.items : []),
    [isSnapshotCurrent, snapshotState.items],
  );

  const evidenceByInvoiceId = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!item?.invoiceId) continue;
      if (!map.has(item.invoiceId)) map.set(item.invoiceId, []);
      map.get(item.invoiceId).push(item);
    }
    return map;
  }, [items]);

  return {
    items,
    evidenceByInvoiceId,
    isLoading: isClientReady ? !isSnapshotCurrent : false,
    hasMore: Boolean(isSnapshotCurrent && snapshotState.hasMore),
    isTruncated: Boolean(isSnapshotCurrent && snapshotState.isTruncated),
    error: isSnapshotCurrent ? snapshotState.error : '',
    retry,
  };
}
