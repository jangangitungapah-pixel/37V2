import { useCallback, useEffect, useState } from 'react';

import {
  getPaymentRepositoryAdapter,
  INVOICES_DEFAULT_QUERY_LIMIT,
} from '../repositories/payment-repository';
import { mapPaymentErrorToMessage } from '../services/invoice-service';
import { scanLegacyBookingsForInvoicesPreview } from '../services/legacy-invoice-service';

/**
 * Subscribes in realtime to bounded `invoices` collection ordered by `invoiceDate desc`
 * with explicit pagination (`loadMoreInvoices`), and performs a lightweight read-only
 * legacy reconciliation check without any auto-writes.
 */
export function useInvoices() {
  const [queryLimit, setQueryLimit] = useState(INVOICES_DEFAULT_QUERY_LIMIT);
  const [state, setState] = useState({
    invoices: [],
    hasMore: false,
    isLoading: true,
    error: null,
  });
  const [legacyOverview, setLegacyOverview] = useState({
    totalWithoutInvoice: 0,
    needsReviewCount: 0,
    importableCount: 0,
  });

  const refreshLegacyOverview = useCallback(async () => {
    try {
      const preview = await scanLegacyBookingsForInvoicesPreview({ maxPages: 3 });
      setLegacyOverview({
        totalWithoutInvoice: preview.totalWithoutInvoice,
        needsReviewCount: preview.needsReviewCount,
        importableCount: preview.importableCount,
      });
    } catch {
      // Non-blocking overview probe; errors surface inside LegacyInvoiceImportDialog if opened
    }
  }, []);

  useEffect(() => {
    const adapter = getPaymentRepositoryAdapter();
    const unsubscribe = adapter.subscribeInvoices({
      maxLimit: queryLimit,
      onData: ({ invoices, hasMore }) => {
        setState({
          invoices,
          hasMore: Boolean(hasMore),
          isLoading: false,
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: mapPaymentErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [queryLimit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preview = await scanLegacyBookingsForInvoicesPreview({ maxPages: 3 });
        if (cancelled) return;
        setLegacyOverview({
          totalWithoutInvoice: preview.totalWithoutInvoice,
          needsReviewCount: preview.needsReviewCount,
          importableCount: preview.importableCount,
        });
      } catch {
        // Ignore non-fatal background probe
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMoreInvoices = useCallback(() => {
    setQueryLimit((prev) => prev + INVOICES_DEFAULT_QUERY_LIMIT);
  }, []);

  return {
    invoices: state.invoices,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreInvoices,
    legacyWithoutInvoiceCount: legacyOverview.totalWithoutInvoice,
    legacyNeedsReviewCount: legacyOverview.needsReviewCount,
    legacyImportableCount: legacyOverview.importableCount,
    refreshLegacyOverview,
  };
}
