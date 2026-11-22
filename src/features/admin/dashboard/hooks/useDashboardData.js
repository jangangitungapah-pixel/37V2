import { useCallback, useEffect, useMemo, useState } from 'react';

import { getBookkeepingRepositoryAdapter } from '@/features/admin/bookkeeping/repositories/bookkeeping-repository';
import { useBookingRequestAlerts } from '@/features/admin/booking-requests/hooks/useBookingRequestAlerts';
import { getBookingRepositoryAdapter } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { useCommissionReview } from '@/features/admin/commission/hooks/useCommissionReview';
import { evaluateCommissionReviewDataset } from '@/features/admin/commission/utils/commission-calculation';
import {
  COMMISSION_PERIOD_PRESETS,
  resolveCommissionPeriodBounds,
} from '@/features/admin/commission/utils/commission-period';
import { getInventoryRepositoryAdapter } from '@/features/admin/inventory/repositories/inventory-repository';
import { getPaymentRepositoryAdapter } from '@/features/admin/payment/repositories/payment-repository';

import { DASHBOARD_PERIOD_PRESETS, DASHBOARD_QUERY_LIMITS } from '../config/dashboard-config';
import {
  buildBookingTrendSeries,
  buildCashFlowTrendSeries,
  buildNeedsAttentionItems,
  buildTodayRoomSchedules,
  computeOwnerPeriodFinancialSummary,
  computeTodayOverviewMetrics,
  deduplicateRecordsById,
} from '../utils/dashboard-calculations';
import { getJakartaGreetingInfo, resolveDashboardPeriodBounds } from '../utils/dashboard-date';

/**
 * Orchestrates realtime data subscriptions and domain aggregations for the
 * Studio Operations Command Center (`/admin/dashboard`).
 *
 * Security & Role Isolation Guarantee:
 * - When `isOwner === false` (Staff), Owner-only collections (`bookkeepingEntries`,
 *   `bookkeepingSettlements`, `bookkeepingSettings`, `commissionBatches`,
 *   `commissionPostingItems`, `commissionReviewResolutions`) and financial cash
 *   streams are NEVER subscribed to or mounted.
 */
export function useDashboardData({
  isOwner = false,
  periodId = DASHBOARD_PERIOD_PRESETS.DAYS_30,
  now,
} = {}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const bookingRequestAlerts = useBookingRequestAlerts();

  const greetingInfo = useMemo(() => getJakartaGreetingInfo(now), [now]);
  const todayIso = greetingInfo.dateIso;

  const periodBounds = useMemo(
    () =>
      resolveDashboardPeriodBounds({
        periodId,
        todayIso,
        now,
      }),
    [periodId, todayIso, now],
  );

  const commissionPeriodBounds = useMemo(
    () =>
      resolveCommissionPeriodBounds({
        preset: COMMISSION_PERIOD_PRESETS.THIS_MONTH,
        now,
      }),
    [now],
  );

  // 1A. Today's Bookings (Staff & Owner)
  const todayRangeKey = `${todayIso}:${refreshNonce}`;
  const [todayBookingsState, setTodayBookingsState] = useState({
    key: '',
    bookings: [],
    isTruncated: false,
    maxLimit: DASHBOARD_QUERY_LIMITS.TODAY_BOOKINGS,
    error: null,
  });

  useEffect(() => {
    const adapter = getBookingRepositoryAdapter();
    const currentKey = todayRangeKey;

    const unsubscribe = adapter.subscribeBookingsInRange({
      startDate: todayIso,
      endDate: todayIso,
      maxLimit: DASHBOARD_QUERY_LIMITS.TODAY_BOOKINGS,
      onData: ({ bookings, isTruncated, maxLimit }) => {
        setTodayBookingsState({
          key: currentKey,
          bookings: bookings || [],
          isTruncated: Boolean(isTruncated),
          maxLimit: maxLimit || DASHBOARD_QUERY_LIMITS.TODAY_BOOKINGS,
          error: null,
        });
      },
      onError: (err) => {
        setTodayBookingsState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat jadwal booking hari ini.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [todayIso, todayRangeKey]);

  // 1B. Analytics Period Bookings (Staff & Owner)
  const periodRangeKey = `${periodBounds.periodStart}:${periodBounds.periodEnd}:${refreshNonce}`;
  const [periodBookingsState, setPeriodBookingsState] = useState({
    key: '',
    bookings: [],
    isTruncated: false,
    maxLimit: DASHBOARD_QUERY_LIMITS.PERIOD_BOOKINGS,
    error: null,
  });

  useEffect(() => {
    const adapter = getBookingRepositoryAdapter();
    const currentKey = periodRangeKey;

    const unsubscribe = adapter.subscribeBookingsInRange({
      startDate: periodBounds.periodStart,
      endDate: periodBounds.periodEnd,
      maxLimit: DASHBOARD_QUERY_LIMITS.PERIOD_BOOKINGS,
      onData: ({ bookings, isTruncated, maxLimit }) => {
        setPeriodBookingsState({
          key: currentKey,
          bookings: bookings || [],
          isTruncated: Boolean(isTruncated),
          maxLimit: maxLimit || DASHBOARD_QUERY_LIMITS.PERIOD_BOOKINGS,
          error: null,
        });
      },
      onError: (err) => {
        setPeriodBookingsState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat tren booking studio.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [periodBounds.periodStart, periodBounds.periodEnd, periodRangeKey]);

  // 2A. Today's Booking Date Invoices (Staff & Owner)
  const [todayInvoicesState, setTodayInvoicesState] = useState({
    key: '',
    invoices: [],
    isTruncated: false,
    error: null,
  });

  useEffect(() => {
    const adapter = getPaymentRepositoryAdapter();
    const currentKey = todayRangeKey;

    const unsubscribe = adapter.subscribeInvoicesInBookingDateRange({
      startDate: todayIso,
      endDate: todayIso,
      maxLimit: DASHBOARD_QUERY_LIMITS.TODAY_INVOICES,
      onData: ({ invoices, isTruncated }) => {
        setTodayInvoicesState({
          key: currentKey,
          invoices: invoices || [],
          isTruncated: Boolean(isTruncated),
          error: null,
        });
      },
      onError: (err) => {
        setTodayInvoicesState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat ringkasan tagihan hari ini.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [todayIso, todayRangeKey]);

  // 2B. Recent Studio Invoices for Needs Attention (Staff & Owner)
  const recentInvoicesKey = `recent-invoices:${refreshNonce}`;
  const [recentInvoicesState, setRecentInvoicesState] = useState({
    key: '',
    invoices: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    const adapter = getPaymentRepositoryAdapter();
    const currentKey = recentInvoicesKey;

    const unsubscribe = adapter.subscribeInvoices({
      maxLimit: DASHBOARD_QUERY_LIMITS.RECENT_INVOICES,
      onData: ({ invoices, hasMore }) => {
        setRecentInvoicesState({
          key: currentKey,
          invoices: invoices || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setRecentInvoicesState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat daftar invoice aktif.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [recentInvoicesKey]);

  // 3. Inventory Items for Operational Maintenance Attention (Staff & Owner)
  const inventoryKey = `inventory:${refreshNonce}`;
  const [inventoryState, setInventoryState] = useState({
    key: '',
    items: [],
    hasMore: false,
    error: null,
  });

  useEffect(() => {
    const adapter = getInventoryRepositoryAdapter();
    const currentKey = inventoryKey;

    const unsubscribe = adapter.subscribeInventoryItems({
      maxLimit: DASHBOARD_QUERY_LIMITS.INVENTORY_ITEMS,
      onData: ({ items, hasMore }) => {
        setInventoryState({
          key: currentKey,
          items: items || [],
          hasMore: Boolean(hasMore),
          error: null,
        });
      },
      onError: (err) => {
        setInventoryState((prev) => ({
          ...prev,
          key: currentKey,
          error: err?.message || 'Gagal memuat status peralatan inventaris.',
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [inventoryKey]);

  // 4. Owner-Only Financial & Bookkeeping Subscriptions
  const ownerSubscriptionKey = `${isOwner ? 'owner' : 'staff'}:${refreshNonce}`;
  const [ownerFinancialState, setOwnerFinancialState] = useState({
    key: '',
    paymentTransactions: [],
    hasMoreTransactions: false,
    bookkeepingEntries: [],
    hasMoreEntries: false,
    activePayables: [],
    hasMorePayables: false,
    bookkeepingSettlements: [],
    hasMoreSettlements: false,
    loadedSlices: 0,
    error: null,
  });

  useEffect(() => {
    if (!isOwner) {
      return undefined;
    }

    const paymentAdapter = getPaymentRepositoryAdapter();
    const bookkeepingAdapter = getBookkeepingRepositoryAdapter();
    const currentKey = ownerSubscriptionKey;
    const seenSlices = new Set();

    const markSlice = (sliceName, patch) => {
      seenSlices.add(sliceName);
      setOwnerFinancialState((prev) => {
        const base =
          prev.key === currentKey
            ? prev
            : {
                key: currentKey,
                paymentTransactions: [],
                hasMoreTransactions: false,
                bookkeepingEntries: [],
                hasMoreEntries: false,
                activePayables: [],
                hasMorePayables: false,
                bookkeepingSettlements: [],
                hasMoreSettlements: false,
                loadedSlices: 0,
                error: null,
              };
        return {
          ...base,
          ...patch,
          key: currentKey,
          loadedSlices: seenSlices.size,
        };
      });
    };

    const handleOwnerError = (err) => {
      setOwnerFinancialState((prev) => ({
        ...prev,
        key: currentKey,
        error: err?.message || 'Gagal memuat data keuangan Owner.',
      }));
    };

    const unsubTx = paymentAdapter.subscribePaymentTransactions({
      maxLimit: DASHBOARD_QUERY_LIMITS.PAYMENT_TRANSACTIONS,
      onData: ({ transactions, hasMore }) =>
        markSlice('tx', {
          paymentTransactions: transactions || [],
          hasMoreTransactions: Boolean(hasMore),
        }),
      onError: handleOwnerError,
    });

    const unsubEntries = bookkeepingAdapter.subscribeBookkeepingEntries({
      maxLimit: DASHBOARD_QUERY_LIMITS.BOOKKEEPING_ENTRIES,
      onData: ({ entries, hasMore }) =>
        markSlice('entries', {
          bookkeepingEntries: entries || [],
          hasMoreEntries: Boolean(hasMore),
        }),
      onError: handleOwnerError,
    });

    const unsubPayables = bookkeepingAdapter.subscribeActivePayables({
      maxLimit: DASHBOARD_QUERY_LIMITS.ACTIVE_PAYABLES,
      onData: ({ entries, hasMore }) =>
        markSlice('payables', {
          activePayables: entries || [],
          hasMorePayables: Boolean(hasMore),
        }),
      onError: handleOwnerError,
    });

    const unsubSettlements = bookkeepingAdapter.subscribeBookkeepingSettlements({
      maxLimit: DASHBOARD_QUERY_LIMITS.BOOKKEEPING_SETTLEMENTS,
      onData: ({ settlements, hasMore }) =>
        markSlice('settlements', {
          bookkeepingSettlements: settlements || [],
          hasMoreSettlements: Boolean(hasMore),
        }),
      onError: handleOwnerError,
    });

    return () => {
      unsubTx?.();
      unsubEntries?.();
      unsubPayables?.();
      unsubSettlements?.();
    };
  }, [isOwner, ownerSubscriptionKey]);

  // 5. Owner-Only Commission Review Subscription (strictly skipped when `enabled: false`)
  const {
    bookings: commissionBookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    isLoading: isCommissionLoading,
    error: commissionError,
  } = useCommissionReview({
    enabled: isOwner,
    periodBounds: commissionPeriodBounds,
    maxLimit: DASHBOARD_QUERY_LIMITS.COMMISSION_REVIEW,
  });

  const commissionReviewSummary = useMemo(() => {
    if (!isOwner) return null;
    const dataset = evaluateCommissionReviewDataset({
      bookings: commissionBookings,
      postingItemsByBookingId,
      resolutionsByBookingId,
      periodBounds: commissionPeriodBounds,
    });
    return {
      pendingCount: dataset.pendingItems.length,
      needsReviewCount: dataset.needsReviewItems.length,
      payableTotal: dataset.summary.payableTotal,
    };
  }, [
    isOwner,
    commissionBookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    commissionPeriodBounds,
  ]);

  // Merged Invoice Lookup Maps
  const allLoadedInvoices = useMemo(() => {
    const todayList = todayInvoicesState.key === todayRangeKey ? todayInvoicesState.invoices : [];
    const recentList =
      recentInvoicesState.key === recentInvoicesKey ? recentInvoicesState.invoices : [];
    return deduplicateRecordsById([...todayList, ...recentList]);
  }, [
    todayInvoicesState.key,
    todayInvoicesState.invoices,
    todayRangeKey,
    recentInvoicesState.key,
    recentInvoicesState.invoices,
    recentInvoicesKey,
  ]);

  const invoicesByBookingId = useMemo(() => {
    const map = new Map();
    for (const inv of allLoadedInvoices) {
      if (inv?.bookingId) {
        map.set(inv.bookingId, inv);
      }
    }
    return map;
  }, [allLoadedInvoices]);

  const todayBookings = useMemo(
    () => (todayBookingsState.key === todayRangeKey ? todayBookingsState.bookings : []),
    [todayBookingsState.key, todayBookingsState.bookings, todayRangeKey],
  );

  const periodBookings = useMemo(
    () => (periodBookingsState.key === periodRangeKey ? periodBookingsState.bookings : []),
    [periodBookingsState.key, periodBookingsState.bookings, periodRangeKey],
  );

  const inventoryItems = useMemo(
    () => (inventoryState.key === inventoryKey ? inventoryState.items : []),
    [inventoryState.key, inventoryState.items, inventoryKey],
  );

  const ownerDataReady = isOwner && ownerFinancialState.key === ownerSubscriptionKey;
  const ownerTransactions = useMemo(
    () => (ownerDataReady ? ownerFinancialState.paymentTransactions : []),
    [ownerDataReady, ownerFinancialState.paymentTransactions],
  );
  const ownerEntries = useMemo(
    () => (ownerDataReady ? ownerFinancialState.bookkeepingEntries : []),
    [ownerDataReady, ownerFinancialState.bookkeepingEntries],
  );
  const ownerPayables = useMemo(
    () => (ownerDataReady ? ownerFinancialState.activePayables : []),
    [ownerDataReady, ownerFinancialState.activePayables],
  );
  const ownerSettlements = useMemo(
    () => (ownerDataReady ? ownerFinancialState.bookkeepingSettlements : []),
    [ownerDataReady, ownerFinancialState.bookkeepingSettlements],
  );

  // Section B — Today's Overview
  const todayOverview = useMemo(
    () =>
      computeTodayOverviewMetrics({
        todayBookings,
        invoicesByBookingId,
        isInvoicesTruncated:
          todayInvoicesState.key === todayRangeKey ? todayInvoicesState.isTruncated : false,
        paymentTransactions: ownerTransactions,
        isOwner,
        todayIso,
      }),
    [
      todayBookings,
      invoicesByBookingId,
      todayInvoicesState.key,
      todayInvoicesState.isTruncated,
      todayRangeKey,
      ownerTransactions,
      isOwner,
      todayIso,
    ],
  );

  // Section C — Today's Studio Schedule
  const todaySchedule = useMemo(
    () =>
      buildTodayRoomSchedules({
        todayBookings,
        invoicesByBookingId,
        todayIso,
        currentMinuteOfDay: greetingInfo.minuteOfDay,
      }),
    [todayBookings, invoicesByBookingId, todayIso, greetingInfo.minuteOfDay],
  );

  // Section D — Needs Attention
  const needsAttentionItems = useMemo(
    () =>
      buildNeedsAttentionItems({
        invoices: allLoadedInvoices,
        todayBookings,
        activePayables: ownerPayables,
        commissionReviewSummary,
        inventoryItems,
        newBookingRequests: bookingRequestAlerts.newRequests,
        hasMoreNewBookingRequests: bookingRequestAlerts.hasMoreNew,
        isOwner,
        todayIso,
        currentMinuteOfDay: greetingInfo.minuteOfDay,
      }),
    [
      allLoadedInvoices,
      todayBookings,
      ownerPayables,
      commissionReviewSummary,
      inventoryItems,
      bookingRequestAlerts.newRequests,
      bookingRequestAlerts.hasMoreNew,
      isOwner,
      todayIso,
      greetingInfo.minuteOfDay,
    ],
  );

  // Section E — Owner Financial Overview & Cash Flow Trend (Strictly Owner-Only)
  const ownerFinancialSummary = useMemo(() => {
    if (!isOwner) return null;
    return computeOwnerPeriodFinancialSummary({
      invoices: allLoadedInvoices,
      outstandingInvoices: allLoadedInvoices,
      paymentTransactions: ownerTransactions,
      bookkeepingEntries: ownerEntries,
      activePayables: ownerPayables,
      bookkeepingSettlements: ownerSettlements,
      periodBounds,
      todayIso,
    });
  }, [
    isOwner,
    allLoadedInvoices,
    ownerTransactions,
    ownerEntries,
    ownerPayables,
    ownerSettlements,
    periodBounds,
    todayIso,
  ]);

  const cashFlowCoverageDetails = useMemo(() => {
    if (!isOwner) return [];
    const notices = [];
    if (ownerFinancialState.hasMoreTransactions) {
      notices.push(
        `Transaksi pembayaran dibatasi hingga ${DASHBOARD_QUERY_LIMITS.PAYMENT_TRANSACTIONS} dokumen terbaru`,
      );
    }
    if (ownerFinancialState.hasMoreSettlements) {
      notices.push(
        `Pelunasan pengeluaran dibatasi hingga ${DASHBOARD_QUERY_LIMITS.BOOKKEEPING_SETTLEMENTS} dokumen terbaru`,
      );
    }
    if (ownerFinancialState.hasMoreEntries) {
      notices.push(
        `Entri pembukuan dibatasi hingga ${DASHBOARD_QUERY_LIMITS.BOOKKEEPING_ENTRIES} dokumen terbaru`,
      );
    }
    if (ownerFinancialState.hasMorePayables) {
      notices.push(
        `Kewajiban terbuka dibatasi hingga ${DASHBOARD_QUERY_LIMITS.ACTIVE_PAYABLES} dokumen`,
      );
    }
    return notices;
  }, [
    isOwner,
    ownerFinancialState.hasMoreTransactions,
    ownerFinancialState.hasMoreSettlements,
    ownerFinancialState.hasMoreEntries,
    ownerFinancialState.hasMorePayables,
  ]);

  const cashFlowTrend = useMemo(() => {
    if (!isOwner) return null;
    return buildCashFlowTrendSeries({
      paymentTransactions: ownerTransactions,
      bookkeepingEntries: ownerEntries,
      bookkeepingSettlements: ownerSettlements,
      periodBounds,
      hasPartialCoverage: cashFlowCoverageDetails.length > 0,
      coverageDetails: cashFlowCoverageDetails,
    });
  }, [
    isOwner,
    ownerTransactions,
    ownerEntries,
    ownerSettlements,
    periodBounds,
    cashFlowCoverageDetails,
  ]);

  // Section F — Booking Trend
  const bookingTrend = useMemo(
    () =>
      buildBookingTrendSeries({
        bookings: periodBookings,
        periodBounds,
        isTruncated:
          periodBookingsState.key === periodRangeKey ? periodBookingsState.isTruncated : false,
        maxLimit:
          periodBookingsState.key === periodRangeKey
            ? periodBookingsState.maxLimit
            : DASHBOARD_QUERY_LIMITS.PERIOD_BOOKINGS,
      }),
    [
      periodBookings,
      periodBounds,
      periodBookingsState.key,
      periodBookingsState.isTruncated,
      periodBookingsState.maxLimit,
      periodRangeKey,
    ],
  );

  const isTodayLoading =
    todayBookingsState.key !== todayRangeKey || todayInvoicesState.key !== todayRangeKey;
  const isPeriodBookingsLoading = periodBookingsState.key !== periodRangeKey;
  const isAttentionLoading =
    isTodayLoading ||
    recentInvoicesState.key !== recentInvoicesKey ||
    inventoryState.key !== inventoryKey ||
    (isOwner && (ownerFinancialState.loadedSlices < 4 || isCommissionLoading));
  const isOwnerFinancialLoading =
    isOwner &&
    (ownerFinancialState.key !== ownerSubscriptionKey || ownerFinancialState.loadedSlices < 4);

  const todayError = todayBookingsState.error || todayInvoicesState.error || null;
  const periodBookingsError = periodBookingsState.error || null;
  const attentionError =
    recentInvoicesState.error ||
    inventoryState.error ||
    (isOwner ? ownerFinancialState.error || commissionError : null) ||
    null;
  const ownerFinancialError = isOwner ? ownerFinancialState.error : null;

  const retryDashboard = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  return {
    greetingInfo,
    todayIso,
    periodBounds,
    todayOverview,
    todaySchedule,
    isTodayScheduleTruncated:
      todayBookingsState.key === todayRangeKey ? todayBookingsState.isTruncated : false,
    todayScheduleMaxLimit:
      todayBookingsState.key === todayRangeKey
        ? todayBookingsState.maxLimit
        : DASHBOARD_QUERY_LIMITS.TODAY_BOOKINGS,
    needsAttentionItems,
    recentBookingRequests: bookingRequestAlerts.recentNewRequests,
    hasMoreNewBookingRequests: bookingRequestAlerts.hasMoreNew,
    ownerFinancialSummary,
    cashFlowTrend,
    bookingTrend,
    loading: {
      today: isTodayLoading,
      periodBookings: isPeriodBookingsLoading,
      attention: isAttentionLoading,
      ownerFinancial: isOwnerFinancialLoading,
    },
    errors: {
      today: todayError,
      periodBookings: periodBookingsError,
      attention: attentionError,
      ownerFinancial: ownerFinancialError,
    },
    retryDashboard,
  };
}
