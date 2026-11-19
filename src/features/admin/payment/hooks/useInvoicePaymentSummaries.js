import { useEffect, useMemo, useState } from 'react';

import {
  CALENDAR_INVOICE_SUMMARY_LIMIT,
  getPaymentRepositoryAdapter,
} from '../repositories/payment-repository';
import { mapPaymentErrorToMessage } from '../services/invoice-service';

/**
 * Single shared realtime subscription for all invoices whose `bookingSnapshot.bookingDate`
 * falls within the Calendar's active `[startDate, endDate]` range.
 *
 * Strictly avoids N+1 per-booking realtime listeners while keeping Calendar badges
 * and Booking Detail Drawer synchronized with the latest Invoice Payment Ledger.
 */
export function useCalendarInvoiceSummaries({ startDate, endDate }) {
  const activeRangeKey = `${startDate || ''}:${endDate || ''}`;
  const [state, setState] = useState({
    rangeKey: '',
    invoices: [],
    error: null,
  });

  useEffect(() => {
    if (!startDate || !endDate) return undefined;

    const currentRangeKey = `${startDate}:${endDate}`;
    const adapter = getPaymentRepositoryAdapter();
    const unsubscribe = adapter.subscribeInvoicesInBookingDateRange({
      startDate,
      endDate,
      maxLimit: CALENDAR_INVOICE_SUMMARY_LIMIT,
      onData: ({ invoices }) => {
        setState({
          rangeKey: currentRangeKey,
          invoices,
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          rangeKey: currentRangeKey,
          error: mapPaymentErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [startDate, endDate]);

  const invoicesByBookingId = useMemo(() => {
    const map = new Map();
    if (state.rangeKey !== activeRangeKey) return map;
    for (const inv of state.invoices) {
      if (inv?.bookingId) {
        map.set(inv.bookingId, inv);
      }
    }
    return map;
  }, [state.invoices, state.rangeKey, activeRangeKey]);

  return {
    invoices: state.rangeKey === activeRangeKey ? state.invoices : [],
    invoicesByBookingId,
    isLoading: Boolean(startDate && endDate && state.rangeKey !== activeRangeKey),
    error: state.rangeKey === activeRangeKey ? state.error : null,
  };
}

/**
 * Loads bounded invoices across a Customer Profile and all virtual merged `historyCustomerIds`
 * using chunked `in` queries (`<= 10` IDs per query) without mutating historical links.
 */
export function useCustomerInvoices(customer) {
  const customerId = customer?.id || '';
  const historyCustomerIds = customer?.historyCustomerIds;

  const historyKey = useMemo(() => {
    if (!customerId) return '';
    const ids = Array.from(
      new Set(
        [customerId, ...(Array.isArray(historyCustomerIds) ? historyCustomerIds : [])].filter(
          Boolean,
        ),
      ),
    ).sort();
    return ids.join('|');
  }, [customerId, historyCustomerIds]);

  const [state, setState] = useState({
    loadedKey: '',
    invoices: [],
    isTruncated: false,
    error: null,
  });

  useEffect(() => {
    if (!historyKey) return undefined;
    let cancelled = false;
    const customerIds = historyKey.split('|').filter(Boolean);

    (async () => {
      try {
        const adapter = getPaymentRepositoryAdapter();
        const result = await adapter.queryInvoicesByCustomerIds({
          customerIds,
          perChunkLimit: 100,
        });
        if (cancelled) return;
        setState({
          loadedKey: historyKey,
          invoices: result.invoices || [],
          isTruncated: Boolean(result.isTruncated),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          loadedKey: historyKey,
          invoices: [],
          isTruncated: false,
          error: mapPaymentErrorToMessage(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historyKey]);

  if (!historyKey) {
    return {
      invoices: [],
      isTruncated: false,
      isLoading: false,
      error: null,
    };
  }

  return {
    invoices: state.loadedKey === historyKey ? state.invoices : [],
    isTruncated: state.loadedKey === historyKey ? state.isTruncated : false,
    isLoading: state.loadedKey !== historyKey,
    error: state.loadedKey === historyKey ? state.error : null,
  };
}
