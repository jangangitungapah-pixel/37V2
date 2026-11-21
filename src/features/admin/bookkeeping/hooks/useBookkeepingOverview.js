import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPaymentRepositoryAdapter } from '@/features/admin/payment/repositories/payment-repository';

import {
  BOOKKEEPING_INVOICES_PAGE_SIZE,
  BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT,
  BOOKKEEPING_PAYMENTS_PAGE_SIZE,
} from '../config/bookkeeping-config';
import { getBookkeepingRepositoryAdapter } from '../repositories/bookkeeping-repository';
import { normalizeBookkeepingSettingsRecord } from '../schemas/bookkeeping-schema';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';
import {
  buildCashMovementItems,
  buildUnifiedLedgerItems,
  calculateBookkeepingMetrics,
} from '../utils/bookkeeping-calculation';
import { useBookkeepingEntries } from './useBookkeepingEntries';
import { useBookkeepingSettlements } from './useBookkeepingSettlements';

/**
 * Orchestrates Owner-only bounded reads across Invoices, PaymentTransactions,
 * BookkeepingEntries, BookkeepingSettlements, and BookkeepingSettings, producing
 * consistent anti-double-counted KPIs, Unified Ledger items, and Cash Movement rows.
 */
export function useBookkeepingOverview({ enabled = true, periodBounds = null } = {}) {
  const [invoicesLimit, setInvoicesLimit] = useState(BOOKKEEPING_INVOICES_PAGE_SIZE);
  const [paymentsLimit, setPaymentsLimit] = useState(BOOKKEEPING_PAYMENTS_PAGE_SIZE);

  const invoicesKey = `${enabled ? '1' : '0'}:${invoicesLimit}`;
  const outstandingKey = enabled ? '1' : '0';
  const paymentsKey = `${enabled ? '1' : '0'}:${paymentsLimit}`;
  const settingsKey = enabled ? '1' : '0';

  const [invoicesState, setInvoicesState] = useState({
    key: '',
    invoices: [],
    hasMore: false,
    error: null,
  });
  const [outstandingState, setOutstandingState] = useState({
    key: '',
    invoices: [],
    hasMore: false,
    error: null,
  });
  const [paymentsState, setPaymentsState] = useState({
    key: '',
    transactions: [],
    hasMore: false,
    error: null,
  });
  const [settingsState, setSettingsState] = useState({
    key: '',
    settings: normalizeBookkeepingSettingsRecord('default', {}),
    error: null,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const paymentAdapter = getPaymentRepositoryAdapter();
    const currentKey = invoicesKey;

    const unsubscribe = paymentAdapter.subscribeInvoices({
      maxLimit: invoicesLimit,
      onData: ({ invoices, hasMore }) => {
        setInvoicesState({
          key: currentKey,
          invoices: invoices || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setInvoicesState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, invoicesKey, invoicesLimit]);

  useEffect(() => {
    if (!enabled) return undefined;
    const bookkeepingAdapter = getBookkeepingRepositoryAdapter();
    const currentKey = outstandingKey;

    const unsubscribe = bookkeepingAdapter.subscribeOutstandingInvoices({
      maxLimit: BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT,
      onData: ({ invoices, hasMore }) => {
        setOutstandingState({
          key: currentKey,
          invoices: invoices || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setOutstandingState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, outstandingKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const paymentAdapter = getPaymentRepositoryAdapter();
    const currentKey = paymentsKey;

    const unsubscribe = paymentAdapter.subscribePaymentTransactions({
      maxLimit: paymentsLimit,
      onData: ({ transactions, hasMore }) => {
        setPaymentsState({
          key: currentKey,
          transactions: transactions || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setPaymentsState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, paymentsKey, paymentsLimit]);

  useEffect(() => {
    if (!enabled) return undefined;
    const bookkeepingAdapter = getBookkeepingRepositoryAdapter();
    const currentKey = settingsKey;

    const unsubscribe = bookkeepingAdapter.subscribeBookkeepingSettings({
      onData: (settings) => {
        setSettingsState({
          key: currentKey,
          settings: settings || normalizeBookkeepingSettingsRecord('default', {}),
          error: null,
        });
      },
      onError: (err) => {
        setSettingsState((prev) => ({
          ...prev,
          key: currentKey,
          error: mapBookkeepingErrorToMessage(err),
        }));
      },
    });

    return () => unsubscribe?.();
  }, [enabled, settingsKey]);

  const {
    entries,
    hasMoreEntries,
    isEntriesLoading,
    entriesError,
    loadMoreEntries,
    activePayables,
    hasMorePayables,
    isPayablesLoading,
    payablesError,
    loadMorePayables,
  } = useBookkeepingEntries({ enabled });

  const {
    settlements,
    hasMoreSettlements,
    isSettlementsLoading,
    settlementsError,
    loadMoreSettlements,
  } = useBookkeepingSettlements({ enabled });

  const invoices = useMemo(
    () => (enabled && invoicesState.key === invoicesKey ? invoicesState.invoices : []),
    [enabled, invoicesState.key, invoicesState.invoices, invoicesKey],
  );
  const outstandingInvoices = useMemo(
    () => (enabled && outstandingState.key === outstandingKey ? outstandingState.invoices : []),
    [enabled, outstandingState.key, outstandingState.invoices, outstandingKey],
  );
  const paymentTransactions = useMemo(
    () => (enabled && paymentsState.key === paymentsKey ? paymentsState.transactions : []),
    [enabled, paymentsState.key, paymentsState.transactions, paymentsKey],
  );
  const settings = useMemo(
    () =>
      enabled && settingsState.key === settingsKey
        ? settingsState.settings
        : normalizeBookkeepingSettingsRecord('default', {}),
    [enabled, settingsState.key, settingsState.settings, settingsKey],
  );

  const metrics = useMemo(
    () =>
      calculateBookkeepingMetrics({
        invoices,
        outstandingInvoices,
        paymentTransactions,
        bookkeepingEntries: entries,
        activePayables,
        bookkeepingSettlements: settlements,
        periodBounds,
        settings,
      }),
    [
      invoices,
      outstandingInvoices,
      paymentTransactions,
      entries,
      activePayables,
      settlements,
      periodBounds,
      settings,
    ],
  );

  const ledgerItems = useMemo(
    () =>
      buildUnifiedLedgerItems({
        invoices,
        outstandingInvoices,
        paymentTransactions,
        bookkeepingEntries: entries,
        activePayables,
        bookkeepingSettlements: settlements,
      }),
    [invoices, outstandingInvoices, paymentTransactions, entries, activePayables, settlements],
  );

  const cashMovementItems = useMemo(
    () =>
      buildCashMovementItems({
        invoices,
        outstandingInvoices,
        paymentTransactions,
        bookkeepingEntries: entries,
        activePayables,
        bookkeepingSettlements: settlements,
        periodBounds,
      }),
    [
      invoices,
      outstandingInvoices,
      paymentTransactions,
      entries,
      activePayables,
      settlements,
      periodBounds,
    ],
  );

  const loadMoreLedgerSources = useCallback(() => {
    setInvoicesLimit((prev) => prev + BOOKKEEPING_INVOICES_PAGE_SIZE);
    setPaymentsLimit((prev) => prev + BOOKKEEPING_PAYMENTS_PAGE_SIZE);
    loadMoreEntries();
    loadMoreSettlements();
  }, [loadMoreEntries, loadMoreSettlements]);

  const isLoading = Boolean(
    enabled &&
    (invoicesState.key !== invoicesKey ||
      paymentsState.key !== paymentsKey ||
      isEntriesLoading ||
      isPayablesLoading ||
      isSettlementsLoading),
  );

  const error =
    entriesError ||
    payablesError ||
    settlementsError ||
    invoicesState.error ||
    outstandingState.error ||
    paymentsState.error ||
    settingsState.error ||
    null;

  return {
    invoices,
    outstandingInvoices,
    paymentTransactions,
    entries,
    activePayables,
    settlements,
    settings,
    metrics,
    ledgerItems,
    cashMovementItems,
    recentActivity: ledgerItems.slice(0, 8),
    hasMoreEntries,
    hasMoreSettlements,
    hasMorePayables,
    hasMoreInvoices: enabled && invoicesState.key === invoicesKey ? invoicesState.hasMore : false,
    hasMorePayments: enabled && paymentsState.key === paymentsKey ? paymentsState.hasMore : false,
    isLoading,
    error,
    loadMoreEntries,
    loadMoreSettlements,
    loadMorePayables,
    loadMoreLedgerSources,
  };
}
