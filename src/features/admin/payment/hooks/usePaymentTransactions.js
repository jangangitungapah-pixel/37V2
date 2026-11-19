import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getPaymentRepositoryAdapter,
  TRANSACTIONS_DEFAULT_QUERY_LIMIT,
} from '../repositories/payment-repository';
import { mapPaymentErrorToMessage } from '../services/invoice-service';
import { TRANSACTION_TYPE } from '../utils/invoice-status';

/**
 * Subscribes in realtime to bounded `paymentTransactions` ordered by `receivedAt desc`
 * with explicit pagination (`loadMoreTransactions`).
 */
export function usePaymentTransactions() {
  const [queryLimit, setQueryLimit] = useState(TRANSACTIONS_DEFAULT_QUERY_LIMIT);
  const [state, setState] = useState({
    transactions: [],
    hasMore: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const adapter = getPaymentRepositoryAdapter();
    const unsubscribe = adapter.subscribePaymentTransactions({
      maxLimit: queryLimit,
      onData: ({ transactions, hasMore }) => {
        setState({
          transactions,
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

  const reversedTransactionIds = useMemo(() => {
    const ids = new Set();
    for (const tx of state.transactions) {
      if (tx.transactionType === TRANSACTION_TYPE.REVERSAL && tx.reversalOfTransactionId) {
        ids.add(tx.reversalOfTransactionId);
      }
    }
    return ids;
  }, [state.transactions]);

  const loadMoreTransactions = useCallback(() => {
    setQueryLimit((prev) => prev + TRANSACTIONS_DEFAULT_QUERY_LIMIT);
  }, []);

  return {
    transactions: state.transactions,
    reversedTransactionIds,
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    loadMoreTransactions,
  };
}
