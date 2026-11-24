import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT,
  PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
  PAYMENT_EVIDENCE_STATUSES,
} from '../config/payment-evidence-config';
import { getPaymentEvidenceRepositoryAdapter } from '../repositories/payment-evidence-repository';
import { mapPaymentEvidenceErrorToMessage } from '../services/payment-evidence-service';

/**
 * Staff/Owner realtime hook for `paymentEvidence`.
 * - Pass `invoiceId` to scope to one invoice (`InvoiceDetailDrawer`).
 * - Omit `invoiceId` to subscribe to the bounded Admin Payment Evidence review queue.
 */
export function useAdminPaymentEvidence({
  invoiceId = '',
  enabled = true,
  initialLimit = null,
  customAdapter = null,
} = {}) {
  const cleanInvoiceId = String(invoiceId || '').trim();
  const baseLimit =
    Number(initialLimit) ||
    (cleanInvoiceId ? PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT : PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT);

  const resolvedAdapter = customAdapter || getPaymentEvidenceRepositoryAdapter();
  const [extraLimit, setExtraLimit] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const effectiveLimit = baseLimit + extraLimit;
  const subscriptionKey = enabled
    ? `${cleanInvoiceId || 'queue'}:${effectiveLimit}:${refreshNonce}`
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
    if (!enabled) return undefined;

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
        error: mapPaymentEvidenceErrorToMessage(err, { locale: 'id' }),
      });
    };

    const unsubscribe = cleanInvoiceId
      ? resolvedAdapter.subscribeAdminInvoiceEvidence({
          invoiceId: cleanInvoiceId,
          maxLimit: effectiveLimit,
          onData: handleData,
          onError: handleError,
        })
      : resolvedAdapter.subscribeAdminPaymentEvidence({
          maxLimit: effectiveLimit,
          onData: handleData,
          onError: handleError,
        });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [cleanInvoiceId, effectiveLimit, enabled, resolvedAdapter, subscriptionKey]);

  const retry = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const loadMore = useCallback(() => {
    setExtraLimit((prev) => prev + PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT);
  }, []);

  const isSnapshotCurrent =
    enabled &&
    snapshotState.resolvedAdapter === resolvedAdapter &&
    snapshotState.resolvedKey === subscriptionKey;

  const items = useMemo(
    () => (isSnapshotCurrent ? snapshotState.items : []),
    [isSnapshotCurrent, snapshotState.items],
  );

  const counts = useMemo(() => {
    let pending = 0;
    let verified = 0;
    let rejected = 0;
    let attached = 0;
    for (const item of items) {
      if (item.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW) pending += 1;
      else if (item.status === PAYMENT_EVIDENCE_STATUSES.VERIFIED) verified += 1;
      else if (item.status === PAYMENT_EVIDENCE_STATUSES.REJECTED) rejected += 1;
      else if (item.status === PAYMENT_EVIDENCE_STATUSES.ATTACHED) attached += 1;
    }
    return {
      all: items.length,
      total: items.length,
      pending,
      pendingReview: pending,
      verified,
      rejected,
      attached,
    };
  }, [items]);

  const evidenceByInvoiceId = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!item?.invoiceId) continue;
      const list = map.get(item.invoiceId) || [];
      list.push(item);
      map.set(item.invoiceId, list);
    }
    return map;
  }, [items]);

  return {
    items,
    evidenceByInvoiceId,
    counts,
    pendingCount: counts.pending,
    pendingReviewCount: counts.pending,
    isLoading: enabled ? !isSnapshotCurrent : false,
    hasMore: Boolean(isSnapshotCurrent && snapshotState.hasMore),
    isTruncated: Boolean(isSnapshotCurrent && snapshotState.isTruncated),
    error: isSnapshotCurrent ? snapshotState.error : '',
    retry,
    loadMore,
  };
}
