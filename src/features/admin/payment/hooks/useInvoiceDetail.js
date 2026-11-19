import { useEffect, useMemo, useState } from 'react';

import { getPaymentRepositoryAdapter } from '../repositories/payment-repository';
import { mapPaymentErrorToMessage } from '../services/invoice-service';
import { TRANSACTION_TYPE } from '../utils/invoice-status';

/**
 * Subscribes in realtime to a single `invoices/{invoiceId}` document and its bounded
 * `paymentTransactions` history, exposing a lookup set of already-reversed transaction IDs.
 */
export function useInvoiceDetail(invoiceId) {
  const cleanInvoiceId = String(invoiceId || '').trim();

  const [invoiceState, setInvoiceState] = useState({
    loadedId: '',
    invoice: null,
    error: null,
  });

  const [txState, setTxState] = useState({
    loadedId: '',
    transactions: [],
    error: null,
  });

  useEffect(() => {
    if (!cleanInvoiceId) return undefined;

    const adapter = getPaymentRepositoryAdapter();
    const unsubInv = adapter.subscribeInvoiceById({
      invoiceId: cleanInvoiceId,
      onData: (invoice) => {
        setInvoiceState({
          loadedId: cleanInvoiceId,
          invoice,
          error: null,
        });
      },
      onError: (err) => {
        setInvoiceState({
          loadedId: cleanInvoiceId,
          invoice: null,
          error: mapPaymentErrorToMessage(err),
        });
      },
    });

    const unsubTx = adapter.subscribeInvoiceTransactions({
      invoiceId: cleanInvoiceId,
      maxLimit: 200,
      onData: (transactions) => {
        setTxState({
          loadedId: cleanInvoiceId,
          transactions,
          error: null,
        });
      },
      onError: (err) => {
        setTxState({
          loadedId: cleanInvoiceId,
          transactions: [],
          error: mapPaymentErrorToMessage(err),
        });
      },
    });

    return () => {
      unsubInv?.();
      unsubTx?.();
    };
  }, [cleanInvoiceId]);

  const activeTransactions = useMemo(() => {
    if (!cleanInvoiceId || txState.loadedId !== cleanInvoiceId) return [];
    return txState.transactions;
  }, [cleanInvoiceId, txState.loadedId, txState.transactions]);

  const reversedTransactionIds = useMemo(() => {
    const ids = new Set();
    for (const tx of activeTransactions) {
      if (tx.transactionType === TRANSACTION_TYPE.REVERSAL && tx.reversalOfTransactionId) {
        ids.add(tx.reversalOfTransactionId);
      }
    }
    return ids;
  }, [activeTransactions]);

  if (!cleanInvoiceId) {
    return {
      invoice: null,
      transactions: [],
      reversedTransactionIds,
      isLoading: false,
      error: null,
    };
  }

  return {
    invoice: invoiceState.loadedId === cleanInvoiceId ? invoiceState.invoice : null,
    transactions: activeTransactions,
    reversedTransactionIds,
    isLoading: invoiceState.loadedId !== cleanInvoiceId || txState.loadedId !== cleanInvoiceId,
    error:
      (invoiceState.loadedId === cleanInvoiceId ? invoiceState.error : null) ||
      (txState.loadedId === cleanInvoiceId ? txState.error : null),
  };
}
