/**
 * Pure Domain Calculations for 37 Music Studio — Studio Operations Command Center.
 *
 * Composes authoritative domain calculators from Calendar, Payment, Bookkeeping,
 * Commission, and Inventory modules without duplicating or contradicting business rules.
 */

import { BOOKKEEPING_SETTLEMENT_TYPES } from '@/features/admin/bookkeeping/config/bookkeeping-config';
import {
  calculateBookkeepingMetrics,
  isActiveManualIncomeEntry,
  isActivePayableEntry,
} from '@/features/admin/bookkeeping/utils/bookkeeping-calculation';
import { formatBookkeepingRupiah } from '@/features/admin/bookkeeping/utils/bookkeeping-format';
import { parseJakartaTimestamp } from '@/features/admin/bookkeeping/utils/bookkeeping-period';
import {
  BOOKING_SESSION_STATUS,
  SESSION_STATUS_META,
} from '@/features/admin/calendar/config/calendar-config';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { INVENTORY_ITEM_TYPES } from '@/features/admin/inventory/config/inventory-config';
import { deriveEquipmentStatusMeta } from '@/features/admin/inventory/utils/inventory-status';
import {
  getEffectivePaymentStatus,
  isInvoiceOverdue,
} from '@/features/admin/payment/utils/invoice-status';
import {
  resolveBookingLatestPaymentView,
  toNonNegativeRupiahInt,
} from '@/features/admin/payment/utils/payment-calculation';

import {
  DASHBOARD_ATTENTION_PRIORITY,
  DASHBOARD_ATTENTION_TYPES,
  DASHBOARD_ROOMS,
} from '../config/dashboard-config';
import { formatBookingTimeRange } from './dashboard-date';

export function formatDashboardRupiah(amount) {
  return formatBookkeepingRupiah(amount);
}

/**
 * Deduplicates an array of domain records by `.id`.
 */
export function deduplicateRecordsById(records = []) {
  const map = new Map();
  for (const item of records || []) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Resolves a human-readable service & package label for a studio booking record.
 */
export function resolveDashboardBookingServiceLabel(booking = {}) {
  const serviceName = String(
    booking.serviceTypeName || booking.serviceLabel || booking.serviceId || 'Sesi Studio',
  ).trim();
  const optionName = String(
    booking.serviceOptionName || booking.packageLabel || booking.recordingTypeLabel || '',
  ).trim();

  if (
    optionName &&
    optionName.toLowerCase() !== serviceName.toLowerCase() &&
    optionName.toLowerCase() !== 'reguler'
  ) {
    return `${serviceName} • ${optionName}`;
  }
  return serviceName;
}

/**
 * Resolves the authoritative payment status badge metadata for a booking row.
 * Never treats a booking with an unloaded/missing invoice as authoritative paid or unpaid.
 */
export function resolveDashboardBookingPaymentBadge(paymentView) {
  const isAuthoritative = Boolean(
    paymentView && paymentView.hasInvoice && paymentView.invoiceStatus !== 'void',
  );
  if (!isAuthoritative) {
    return {
      status: 'unverified',
      label: 'Invoice Belum Terverifikasi',
      shortLabel: 'Belum Terverifikasi',
      tone: 'neutral',
      isAuthoritative: false,
    };
  }

  const status = paymentView.paymentStatus;
  if (status === 'paid') {
    return {
      status: 'paid',
      label: 'Lunas',
      shortLabel: 'Lunas',
      tone: 'emerald',
      isAuthoritative: true,
    };
  }
  if (status === 'partial') {
    return {
      status: 'partial',
      label: 'DP / Sebagian',
      shortLabel: 'DP / Sebagian',
      tone: 'amber',
      isAuthoritative: true,
    };
  }
  if (status === 'overdue') {
    return {
      status: 'overdue',
      label: 'Lewat Tempo',
      shortLabel: 'Lewat Tempo',
      tone: 'orange',
      isAuthoritative: true,
    };
  }
  return {
    status: 'unpaid',
    label: 'Belum Bayar',
    shortLabel: 'Belum Bayar',
    tone: 'orange',
    isAuthoritative: true,
  };
}

/**
 * Calculates today's net Cash In strictly from valid `paymentTransactions` minus reversals
 * within today's Jakarta calendar-day interval (`todayIso`).
 *
 * Anti-double-counting guarantee: never sums `invoice.amountPaid` with `paymentTransactions`.
 */
export function computeTodayCashIn({
  paymentTransactions = [],
  todayIso = getJakartaTodayIso(),
} = {}) {
  const uniqueTransactions = deduplicateRecordsById(paymentTransactions);
  let grossPayments = 0;
  let reversalsTotal = 0;
  let paymentCount = 0;
  let reversalCount = 0;

  for (const tx of uniqueTransactions) {
    const parsed = parseJakartaTimestamp(tx.receivedAt ?? tx.createdAt);
    if (!parsed.isValid || parsed.dateIso !== todayIso) {
      continue;
    }

    const amount = toNonNegativeRupiahInt(tx.amount);
    if (tx.transactionType === 'reversal') {
      reversalsTotal += amount;
      reversalCount += 1;
    } else if (tx.transactionType === 'payment') {
      grossPayments += amount;
      paymentCount += 1;
    }
  }

  return {
    grossPayments,
    reversalsTotal,
    netCashIn: grossPayments - reversalsTotal,
    paymentCount,
    reversalCount,
  };
}

/**
 * Computes Section B — Today's Overview (4 Primary Metrics) for Owner and Staff.
 *
 * Rules enforced:
 * 1. `Booking Hari Ini`: Active bookings for today's Jakarta date (`sessionStatus` not `cancelled` and not `no_show`).
 * 2. `Sesi Berlangsung`: Today's bookings with `sessionStatus === 'in_progress'`.
 * 3. `Booking Belum Lunas`: Active valid bookings for today whose authoritative invoice status is not `paid`.
 *    Bookings without a loaded authoritative invoice are counted in `unverifiedInvoiceBookingsCount` and
 *    never falsely classified as authoritative paid or unpaid.
 * 4. 4th Tile:
 *    - Owner: `Kas Masuk Hari Ini` = `SUM(valid payment transactions) - SUM(valid reversals)` today in WIB.
 *    - Staff: `Sesi Akan Datang` (`sessionStatus === 'upcoming'` today) — never exposes Owner cash figures.
 */
export function computeTodayOverviewMetrics({
  todayBookings = [],
  invoicesByBookingId = new Map(),
  isInvoicesTruncated = false,
  paymentTransactions = [],
  isOwner = false,
  todayIso = getJakartaTodayIso(),
} = {}) {
  const uniqueBookings = deduplicateRecordsById(todayBookings).filter(
    (booking) => booking.date === todayIso,
  );

  const activeBookings = [];
  let inProgressSessionsCount = 0;
  let upcomingSessionsCount = 0;
  let completedSessionsCount = 0;
  let cancelledSessionsCount = 0;
  let noShowSessionsCount = 0;

  for (const booking of uniqueBookings) {
    if (booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED) {
      cancelledSessionsCount += 1;
      continue;
    }
    if (booking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW) {
      noShowSessionsCount += 1;
      continue;
    }

    activeBookings.push(booking);

    if (booking.sessionStatus === BOOKING_SESSION_STATUS.IN_PROGRESS) {
      inProgressSessionsCount += 1;
    } else if (booking.sessionStatus === BOOKING_SESSION_STATUS.UPCOMING) {
      upcomingSessionsCount += 1;
    } else if (booking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED) {
      completedSessionsCount += 1;
    }
  }

  let unpaidBookingsCount = 0;
  let unpaidBookingsBalanceDue = 0;
  let paidBookingsCount = 0;
  let unverifiedInvoiceBookingsCount = 0;

  for (const booking of activeBookings) {
    const invoice = invoicesByBookingId?.get?.(booking.id) || null;
    const paymentView = resolveBookingLatestPaymentView(booking, invoice);
    const isAuthoritative = Boolean(
      paymentView && paymentView.hasInvoice && paymentView.invoiceStatus !== 'void',
    );

    if (!isAuthoritative) {
      unverifiedInvoiceBookingsCount += 1;
      continue;
    }

    const effectiveStatus = getEffectivePaymentStatus(invoice, todayIso);
    if (effectiveStatus === 'paid') {
      paidBookingsCount += 1;
    } else {
      unpaidBookingsCount += 1;
      unpaidBookingsBalanceDue += toNonNegativeRupiahInt(paymentView.balanceDue);
    }
  }

  const todayCashIn = isOwner
    ? computeTodayCashIn({
        paymentTransactions,
        todayIso,
      })
    : null;

  return {
    todayIso,
    todayActiveBookingsCount: activeBookings.length,
    inProgressSessionsCount,
    upcomingSessionsCount,
    completedSessionsCount,
    cancelledSessionsCount,
    noShowSessionsCount,
    unpaidBookingsCount,
    unpaidBookingsBalanceDue,
    paidBookingsCount,
    unverifiedInvoiceBookingsCount,
    isInvoicesTruncated: Boolean(isInvoicesTruncated),
    todayCashIn,
  };
}

/**
 * Builds Section C — Today's Studio Schedule grouped by studio room (`Room A`, `Room B`)
 * and sorted chronologically by `startMinute ASC`.
 * Excludes `cancelled` bookings from active room schedules while tracking `cancelledCount`.
 */
export function buildTodayRoomSchedules({
  todayBookings = [],
  invoicesByBookingId = new Map(),
  todayIso = getJakartaTodayIso(),
  currentMinuteOfDay = null,
} = {}) {
  const uniqueBookings = deduplicateRecordsById(todayBookings).filter(
    (booking) => booking.date === todayIso,
  );

  const byRoomId = new Map(
    DASHBOARD_ROOMS.map((room) => [
      room.id,
      {
        ...room,
        sessions: [],
        cancelledCount: 0,
        inProgressCount: 0,
        upcomingCount: 0,
        completedCount: 0,
      },
    ]),
  );

  let totalActiveSessions = 0;
  let totalCancelledSessions = 0;

  for (const booking of uniqueBookings) {
    const roomId = booking.studioId === 'room-b' ? 'room-b' : 'room-a';
    const roomGroup = byRoomId.get(roomId);

    if (booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED) {
      roomGroup.cancelledCount += 1;
      totalCancelledSessions += 1;
      continue;
    }

    const invoice = invoicesByBookingId?.get?.(booking.id) || null;
    const paymentView = resolveBookingLatestPaymentView(booking, invoice, todayIso);
    const paymentBadge = resolveDashboardBookingPaymentBadge(paymentView);
    const sessionMeta = SESSION_STATUS_META[booking.sessionStatus] || {
      label: booking.sessionStatus || 'Upcoming',
      tone: 'neutral',
    };

    const isCheckInDue =
      booking.sessionStatus === BOOKING_SESSION_STATUS.UPCOMING &&
      typeof currentMinuteOfDay === 'number' &&
      currentMinuteOfDay >= Number(booking.startMinute);

    if (booking.sessionStatus === BOOKING_SESSION_STATUS.IN_PROGRESS) {
      roomGroup.inProgressCount += 1;
    } else if (booking.sessionStatus === BOOKING_SESSION_STATUS.UPCOMING) {
      roomGroup.upcomingCount += 1;
    } else if (booking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED) {
      roomGroup.completedCount += 1;
    }

    totalActiveSessions += 1;

    roomGroup.sessions.push({
      id: booking.id,
      booking,
      studioId: roomId,
      roomLabel: roomGroup.label,
      date: booking.date,
      startMinute: Number(booking.startMinute) || 0,
      endMinute: Number(booking.endMinute) || 0,
      durationMinutes: Number(booking.durationMinutes) || 0,
      timeRangeLabel: formatBookingTimeRange(booking.startMinute, booking.endMinute),
      customerName: booking.customerName || 'Pelanggan Studio',
      bandName: String(booking.bandName || '').trim(),
      serviceLabel: resolveDashboardBookingServiceLabel(booking),
      sessionStatus: booking.sessionStatus,
      sessionStatusLabel: sessionMeta.label,
      sessionStatusTone:
        booking.sessionStatus === BOOKING_SESSION_STATUS.IN_PROGRESS
          ? 'lime'
          : booking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED
            ? 'emerald'
            : booking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
              ? 'orange'
              : 'ivory',
      paymentView,
      paymentBadge,
      isCheckInDue,
      calendarHref: `/admin/calendar?date=${encodeURIComponent(booking.date)}&bookingId=${encodeURIComponent(booking.id)}`,
    });
  }

  const rooms = DASHBOARD_ROOMS.map((room) => {
    const group = byRoomId.get(room.id);
    group.sessions.sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      if (a.endMinute !== b.endMinute) return a.endMinute - b.endMinute;
      return String(a.id).localeCompare(String(b.id));
    });
    return group;
  });

  return {
    todayIso,
    rooms,
    totalActiveSessions,
    totalCancelledSessions,
  };
}

/**
 * Evaluates active inventory equipment items requiring inspection, maintenance, or repair.
 */
export function evaluateInventoryAttentionItems({
  inventoryItems = [],
  todayIso = getJakartaTodayIso(),
} = {}) {
  const uniqueItems = deduplicateRecordsById(inventoryItems);
  const attentionEquipment = [];

  for (const item of uniqueItems) {
    if (item.isActive === false || item.itemType !== INVENTORY_ITEM_TYPES.EQUIPMENT) {
      continue;
    }

    const eqMeta = deriveEquipmentStatusMeta(item, todayIso);
    const damagedQty = Math.max(0, Math.round(Number(item?.equipmentStock?.damagedQuantity) || 0));
    const maintQty = Math.max(
      0,
      Math.round(Number(item?.equipmentStock?.maintenanceQuantity) || 0),
    );

    if (eqMeta.hasMaintenanceAttention || damagedQty > 0) {
      attentionEquipment.push({
        id: item.id,
        name: item.name || item.code || item.id,
        code: item.code || '',
        statusLabel: eqMeta.label,
        tone: eqMeta.tone,
        maintenanceQuantity: maintQty,
        damagedQuantity: damagedQty,
        isMaintenanceDue: Boolean(eqMeta.maintMeta?.isDue),
      });
    }
  }

  return {
    count: attentionEquipment.length,
    items: attentionEquipment,
  };
}

/**
 * Builds Section D — Needs Attention list ordered strictly by business urgency:
 * 1. Overdue invoices (Owner & Staff)
 * 2. Active sessions needing immediate check-in / operational attention (Owner & Staff)
 * 3. Commission review awaiting Owner (Owner-only)
 * 4. Outstanding payables awaiting settlement (Owner-only)
 * 5. Equipment requiring inspection or maintenance (Owner & Staff)
 * 6. Unpaid / partial active invoices not yet overdue (Owner & Staff)
 */
export function buildNeedsAttentionItems({
  invoices = [],
  todayBookings = [],
  activePayables = [],
  commissionReviewSummary = null,
  inventoryItems = [],
  isOwner = false,
  todayIso = getJakartaTodayIso(),
  currentMinuteOfDay = null,
} = {}) {
  const items = [];
  const uniqueInvoices = deduplicateRecordsById(invoices);

  // 1. Overdue Invoices & 6. Unpaid/Partial Invoices
  const overdueInvoices = [];
  const unpaidPartialInvoices = [];
  let overdueTotalAmount = 0;
  let unpaidPartialTotalAmount = 0;

  for (const inv of uniqueInvoices) {
    if (!inv || inv.invoiceStatus !== 'issued') {
      continue;
    }
    const balanceDue = toNonNegativeRupiahInt(inv.balanceDue);
    if (balanceDue <= 0) {
      continue;
    }

    if (isInvoiceOverdue(inv, todayIso)) {
      overdueInvoices.push(inv);
      overdueTotalAmount += balanceDue;
    } else {
      const effectiveStatus = getEffectivePaymentStatus(inv, todayIso);
      if (effectiveStatus === 'unpaid' || effectiveStatus === 'partial') {
        unpaidPartialInvoices.push(inv);
        unpaidPartialTotalAmount += balanceDue;
      }
    }
  }

  if (overdueInvoices.length > 0) {
    items.push({
      id: DASHBOARD_ATTENTION_TYPES.OVERDUE_INVOICES,
      type: DASHBOARD_ATTENTION_TYPES.OVERDUE_INVOICES,
      priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.OVERDUE_INVOICES],
      severity: 'critical',
      badgeLabel: 'Prioritas Utama',
      badgeTone: 'orange',
      title: `${overdueInvoices.length} Invoice Lewat Jatuh Tempo`,
      description: `Total tagihan jatuh tempo sebesar ${formatDashboardRupiah(overdueTotalAmount)} memerlukan tindak lanjut penagihan segera.`,
      count: overdueInvoices.length,
      amount: overdueTotalAmount,
      actionLabel: 'Buka Tagihan',
      href: '/admin/payment-and-bill',
      ownerOnly: false,
    });
  }

  // 2. Active sessions needing immediate check-in / action today
  const uniqueTodayBookings = deduplicateRecordsById(todayBookings).filter(
    (b) => b.date === todayIso,
  );
  const checkInDueBookings = uniqueTodayBookings.filter(
    (b) =>
      b.sessionStatus === BOOKING_SESSION_STATUS.UPCOMING &&
      typeof currentMinuteOfDay === 'number' &&
      currentMinuteOfDay >= Number(b.startMinute),
  );

  if (checkInDueBookings.length > 0) {
    const sampleNames = checkInDueBookings
      .slice(0, 2)
      .map((b) => b.customerName)
      .filter(Boolean)
      .join(', ');
    items.push({
      id: DASHBOARD_ATTENTION_TYPES.ACTIVE_SESSION_ACTION,
      type: DASHBOARD_ATTENTION_TYPES.ACTIVE_SESSION_ACTION,
      priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.ACTIVE_SESSION_ACTION],
      severity: 'high',
      badgeLabel: 'Operasional',
      badgeTone: 'orange',
      title: `${checkInDueBookings.length} Sesi Hari Ini Menunggu Check-In`,
      description: `Jadwal sesi (${sampleNames}) telah memasuki jam mulai dan menunggu konfirmasi check-in atau perubahan status.`,
      count: checkInDueBookings.length,
      amount: null,
      actionLabel: 'Kelola Sesi',
      href: `/admin/calendar?date=${encodeURIComponent(todayIso)}`,
      ownerOnly: false,
    });
  }

  // 3. Commission Review Awaiting Owner (Strictly Owner-Only)
  if (isOwner && commissionReviewSummary) {
    const pendingCount = Number(commissionReviewSummary.pendingCount) || 0;
    const needsReviewCount = Number(commissionReviewSummary.needsReviewCount) || 0;
    const totalAwaiting = pendingCount + needsReviewCount;
    const payableTotal = toNonNegativeRupiahInt(commissionReviewSummary.payableTotal);

    if (totalAwaiting > 0) {
      const detailParts = [];
      if (pendingCount > 0) {
        detailParts.push(
          `${pendingCount} sesi siap posting (${formatDashboardRupiah(payableTotal)})`,
        );
      }
      if (needsReviewCount > 0) {
        detailParts.push(`${needsReviewCount} sesi butuh verifikasi snapshot`);
      }

      items.push({
        id: DASHBOARD_ATTENTION_TYPES.COMMISSION_REVIEW,
        type: DASHBOARD_ATTENTION_TYPES.COMMISSION_REVIEW,
        priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.COMMISSION_REVIEW],
        severity: 'warning',
        badgeLabel: 'Owner • Komisi',
        badgeTone: 'amber',
        title: `${totalAwaiting} Sesi Selesai Menunggu Review Komisi`,
        description: `${detailParts.join(' dan ')} sebelum diposting ke Pembukuan.`,
        count: totalAwaiting,
        amount: payableTotal,
        actionLabel: 'Review Komisi',
        href: '/admin/commission-and-fee',
        ownerOnly: true,
      });
    }
  }

  // 4. Outstanding Payables Awaiting Settlement (Strictly Owner-Only)
  if (isOwner) {
    const uniquePayables = deduplicateRecordsById(activePayables).filter(isActivePayableEntry);
    let totalPayableRemaining = 0;
    const validOpenPayables = [];

    for (const entry of uniquePayables) {
      const rawAmount = toNonNegativeRupiahInt(entry.amount);
      const rawSettled =
        entry.amountSettled !== undefined && entry.amountSettled !== null
          ? toNonNegativeRupiahInt(entry.amountSettled)
          : 0;
      const remaining =
        entry.remainingAmount !== undefined && entry.remainingAmount !== null
          ? toNonNegativeRupiahInt(entry.remainingAmount)
          : Math.max(0, rawAmount - rawSettled);

      if (remaining > 0) {
        validOpenPayables.push(entry);
        totalPayableRemaining += remaining;
      }
    }

    if (validOpenPayables.length > 0) {
      items.push({
        id: DASHBOARD_ATTENTION_TYPES.OUTSTANDING_PAYABLES,
        type: DASHBOARD_ATTENTION_TYPES.OUTSTANDING_PAYABLES,
        priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.OUTSTANDING_PAYABLES],
        severity: 'warning',
        badgeLabel: 'Owner • Kewajiban',
        badgeTone: 'amber',
        title: `${validOpenPayables.length} Kewajiban Pembukuan Belum Dilunasi`,
        description: `Total saldo utang operasional & komisi sebesar ${formatDashboardRupiah(totalPayableRemaining)} menunggu pelunasan kas.`,
        count: validOpenPayables.length,
        amount: totalPayableRemaining,
        actionLabel: 'Lunasi Kewajiban',
        href: '/admin/pembukuan?tab=settlement',
        ownerOnly: true,
      });
    }
  }

  // 5. Equipment Requiring Inspection or Maintenance (Owner & Staff)
  const equipmentAttention = evaluateInventoryAttentionItems({
    inventoryItems,
    todayIso,
  });

  if (equipmentAttention.count > 0) {
    const sampleEquipment = equipmentAttention.items
      .slice(0, 2)
      .map((item) => item.name)
      .join(', ');
    items.push({
      id: DASHBOARD_ATTENTION_TYPES.EQUIPMENT_MAINTENANCE,
      type: DASHBOARD_ATTENTION_TYPES.EQUIPMENT_MAINTENANCE,
      priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.EQUIPMENT_MAINTENANCE],
      severity: 'warning',
      badgeLabel: 'Inventaris',
      badgeTone: 'amber',
      title: `${equipmentAttention.count} Peralatan Studio Perlu Perhatian`,
      description: `Peralatan (${sampleEquipment}) berstatus jadwal maintenance jatuh tempo, sedang servis, atau terdapat unit rusak.`,
      count: equipmentAttention.count,
      amount: null,
      actionLabel: 'Cek Inventaris',
      href: '/admin/inventory',
      ownerOnly: false,
    });
  }

  // 6. Unpaid / Partial Active Invoices (Owner & Staff)
  if (unpaidPartialInvoices.length > 0) {
    items.push({
      id: DASHBOARD_ATTENTION_TYPES.UNPAID_INVOICES,
      type: DASHBOARD_ATTENTION_TYPES.UNPAID_INVOICES,
      priority: DASHBOARD_ATTENTION_PRIORITY[DASHBOARD_ATTENTION_TYPES.UNPAID_INVOICES],
      severity: 'normal',
      badgeLabel: 'Tagihan Aktif',
      badgeTone: 'ivory',
      title: `${unpaidPartialInvoices.length} Invoice Belum Lunas / DP`,
      description: `Sisa piutang pelanggan aktif sebesar ${formatDashboardRupiah(unpaidPartialTotalAmount)} belum dilunasi penuh.`,
      count: unpaidPartialInvoices.length,
      amount: unpaidPartialTotalAmount,
      actionLabel: 'Lihat Pembayaran',
      href: '/admin/payment-and-bill',
      ownerOnly: false,
    });
  }

  items.sort((a, b) => a.priority - b.priority);

  return items;
}

/**
 * Computes Section E — Owner Financial Overview KPIs for the selected analytics period.
 *
 * Strictly delegates to `calculateBookkeepingMetrics` so Dashboard numbers match
 * Pembukuan 100% and obey all anti-double-counting rules:
 * - Cash In = net customer `paymentTransactions` (payments minus reversals) + paid manual income
 * - Cash Out = actual `bookkeepingSettlements` only (never unpaid expense accruals)
 * - Net Cash Movement = `Cash In - Cash Out` (never labeled as Profit / Laba Bersih)
 * - Outstanding Payables = current open payable obligations from `bookkeepingEntries`
 */
export function computeOwnerPeriodFinancialSummary({
  invoices = [],
  outstandingInvoices = [],
  paymentTransactions = [],
  bookkeepingEntries = [],
  activePayables = [],
  bookkeepingSettlements = [],
  periodBounds,
  todayIso = getJakartaTodayIso(),
} = {}) {
  const metrics = calculateBookkeepingMetrics({
    invoices,
    outstandingInvoices,
    paymentTransactions,
    bookkeepingEntries,
    activePayables,
    bookkeepingSettlements,
    periodBounds,
    todayIso,
  });

  return {
    cashIn: metrics.totalIncomeReceived,
    customerCashReceived: metrics.customerCashReceived,
    grossCustomerPayments: metrics.grossCustomerPayments,
    customerPaymentReversals: metrics.customerPaymentReversals,
    manualIncomeTotal: metrics.manualIncomeTotal,
    cashOut: metrics.totalOperatingCashOut,
    commissionCashOut: metrics.commissionCashOut,
    manualExpenseCashOut: metrics.manualExpenseCashOut,
    netCashMovement: metrics.netCashMovement,
    outstandingPayables: metrics.outstandingPayables,
    openPayablesCount: metrics.openPayablesCount,
    totalExpenseAccrued: metrics.totalExpenseAccrued,
    settlementCountInPeriod: metrics.settlementCountInPeriod,
    customerPaymentCount: metrics.customerPaymentCount,
    customerReversalCount: metrics.customerReversalCount,
  };
}

/**
 * Builds daily ECharts series for Section E — Cash Flow Trend (`Cash In` vs `Cash Out`)
 * over the selected `Asia/Jakarta` period (`7d`, `30d`, `90d`).
 *
 * Strict integrity guarantees:
 * - `Cash In` comes from valid `paymentTransactions` (`payment` minus `reversal`) plus
 *   paid non-reversed manual income `bookkeepingEntries`. Never `invoice.amountPaid`.
 * - `Cash Out` comes strictly from `bookkeepingSettlements` (`expense_payment`).
 *   Unpaid `expense_accrual` entries in `bookkeepingEntries` are NEVER included in `Cash Out`.
 * - Zero fabricated or interpolated days: every date bucket in `periodBounds.dateBuckets`
 *   reflects actual records for that Jakarta calendar day.
 */
export function buildCashFlowTrendSeries({
  paymentTransactions = [],
  bookkeepingEntries = [],
  bookkeepingSettlements = [],
  periodBounds,
  hasPartialCoverage = false,
  coverageDetails = [],
} = {}) {
  const dateBuckets = periodBounds?.dateBuckets || [];
  const bucketMap = new Map(
    dateBuckets.map((b) => [
      b.dateIso,
      {
        dateIso: b.dateIso,
        label: b.shortLabel,
        mediumLabel: b.mediumLabel,
        fullLabel: b.fullLabel,
        cashIn: 0,
        cashOut: 0,
        netMovement: 0,
        paymentCount: 0,
        reversalCount: 0,
        manualIncomeCount: 0,
        settlementCount: 0,
      },
    ]),
  );

  // 1. Customer Payment Transactions (Payments minus Reversals)
  const uniqueTransactions = deduplicateRecordsById(paymentTransactions);
  for (const tx of uniqueTransactions) {
    const parsed = parseJakartaTimestamp(tx.receivedAt ?? tx.createdAt);
    if (!parsed.isValid) continue;
    const bucket = bucketMap.get(parsed.dateIso);
    if (!bucket) continue;

    const amount = toNonNegativeRupiahInt(tx.amount);
    if (tx.transactionType === 'reversal') {
      bucket.cashIn -= amount;
      bucket.reversalCount += 1;
    } else if (tx.transactionType === 'payment') {
      bucket.cashIn += amount;
      bucket.paymentCount += 1;
    }
  }

  // 2. Paid Non-Reversed Manual Income from `bookkeepingEntries`
  const uniqueEntries = deduplicateRecordsById(bookkeepingEntries);

  for (const entry of uniqueEntries) {
    if (!isActiveManualIncomeEntry(entry)) {
      continue;
    }
    const parsed = parseJakartaTimestamp(entry.occurredAt ?? entry.createdAt);
    if (!parsed.isValid) continue;
    const bucket = bucketMap.get(parsed.dateIso);
    if (!bucket) continue;

    bucket.cashIn += toNonNegativeRupiahInt(entry.amount);
    bucket.manualIncomeCount += 1;
  }

  // 3. Actual Operating Cash Out strictly from `bookkeepingSettlements`
  const uniqueSettlements = deduplicateRecordsById(bookkeepingSettlements);
  for (const settlement of uniqueSettlements) {
    if (!settlement || settlement.settlementType !== BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT) {
      continue;
    }
    const parsed = parseJakartaTimestamp(settlement.paidAt ?? settlement.createdAt);
    if (!parsed.isValid) continue;
    const bucket = bucketMap.get(parsed.dateIso);
    if (!bucket) continue;

    bucket.cashOut += toNonNegativeRupiahInt(settlement.amount);
    bucket.settlementCount += 1;
  }

  let totalCashIn = 0;
  let totalCashOut = 0;
  let hasActivity = false;

  const points = dateBuckets.map((b) => {
    const bucket = bucketMap.get(b.dateIso);
    bucket.netMovement = bucket.cashIn - bucket.cashOut;
    totalCashIn += bucket.cashIn;
    totalCashOut += bucket.cashOut;
    if (
      bucket.cashIn !== 0 ||
      bucket.cashOut !== 0 ||
      bucket.paymentCount > 0 ||
      bucket.reversalCount > 0 ||
      bucket.manualIncomeCount > 0 ||
      bucket.settlementCount > 0
    ) {
      hasActivity = true;
    }
    return bucket;
  });

  return {
    periodId: periodBounds?.periodId || '30d',
    periodLabel: periodBounds?.fullLabel || '30 Hari Terakhir',
    periodRangeLabel: periodBounds?.periodRangeLabel || '',
    points,
    totalCashIn,
    totalCashOut,
    totalNetMovement: totalCashIn - totalCashOut,
    hasActivity,
    hasPartialCoverage: Boolean(hasPartialCoverage),
    coverageDetails,
  };
}

/**
 * Builds daily ECharts series for Section F — Booking Trend over the selected
 * `Asia/Jakarta` period (`7d`, `30d`, `90d`).
 *
 * Definition: Active Studio Bookings (`sessionStatus` in `['upcoming', 'in_progress', 'completed']`,
 * excluding `cancelled` and `no_show`).
 */
export function buildBookingTrendSeries({
  bookings = [],
  periodBounds,
  isTruncated = false,
  maxLimit = 300,
} = {}) {
  const dateBuckets = periodBounds?.dateBuckets || [];
  const bucketMap = new Map(
    dateBuckets.map((b) => [
      b.dateIso,
      {
        dateIso: b.dateIso,
        label: b.shortLabel,
        mediumLabel: b.mediumLabel,
        fullLabel: b.fullLabel,
        activeCount: 0,
        roomACount: 0,
        roomBCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        upcomingCount: 0,
        cancelledOrNoShowCount: 0,
        totalDurationMinutes: 0,
      },
    ]),
  );

  const uniqueBookings = deduplicateRecordsById(bookings);
  for (const booking of uniqueBookings) {
    const bucket = bucketMap.get(booking.date);
    if (!bucket) continue;

    if (
      booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
      booking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
    ) {
      bucket.cancelledOrNoShowCount += 1;
      continue;
    }

    bucket.activeCount += 1;
    bucket.totalDurationMinutes += Math.max(0, Number(booking.durationMinutes) || 0);

    if (booking.studioId === 'room-b') {
      bucket.roomBCount += 1;
    } else {
      bucket.roomACount += 1;
    }

    if (booking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED) {
      bucket.completedCount += 1;
    } else if (booking.sessionStatus === BOOKING_SESSION_STATUS.IN_PROGRESS) {
      bucket.inProgressCount += 1;
    } else {
      bucket.upcomingCount += 1;
    }
  }

  let totalActiveBookings = 0;
  let totalRoomABookings = 0;
  let totalRoomBBookings = 0;
  let totalCompletedBookings = 0;
  let totalCancelledOrNoShow = 0;
  let totalDurationMinutes = 0;

  const points = dateBuckets.map((b) => {
    const bucket = bucketMap.get(b.dateIso);
    totalActiveBookings += bucket.activeCount;
    totalRoomABookings += bucket.roomACount;
    totalRoomBBookings += bucket.roomBCount;
    totalCompletedBookings += bucket.completedCount;
    totalCancelledOrNoShow += bucket.cancelledOrNoShowCount;
    totalDurationMinutes += bucket.totalDurationMinutes;
    return bucket;
  });

  return {
    periodId: periodBounds?.periodId || '30d',
    periodLabel: periodBounds?.fullLabel || '30 Hari Terakhir',
    periodRangeLabel: periodBounds?.periodRangeLabel || '',
    points,
    totalActiveBookings,
    totalRoomABookings,
    totalRoomBBookings,
    totalCompletedBookings,
    totalCancelledOrNoShow,
    totalHoursBooked: Math.round((totalDurationMinutes / 60) * 10) / 10,
    hasActivity: totalActiveBookings > 0,
    isTruncated: Boolean(isTruncated),
    maxLimit,
    definitionLabel:
      'Sesi operasional aktif (Upcoming, In Progress, Completed — tidak termasuk Cancelled & No Show)',
  };
}
