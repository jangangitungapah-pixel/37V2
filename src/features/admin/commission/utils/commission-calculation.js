/**
 * Pure Domain Eligibility Classifier, Payable Aggregation & Deterministic ID Helpers
 * for Phase 9 — Commission & Fee Management.
 */

import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import { DELIVERY_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import { parseJakartaTimestamp } from './commission-period';
import { buildCommissionSnapshotSignature, parseCommissionSnapshot } from './commission-snapshot';

export const COMMISSION_ELIGIBLE_SERVICE_IDS = ['rehearsal', 'recording'];

export const COMMISSION_ITEM_STATUS = {
  PENDING: 'pending',
  POSTED: 'posted',
  NEEDS_REVIEW: 'needs_review',
  RESOLVED_NO_COMMISSION: 'resolved_no_commission',
  ZERO_PAYABLE: 'zero_payable',
  NOT_ELIGIBLE: 'not_eligible',
};

export const COMMISSION_REVIEW_STATUS_FILTER = {
  PENDING: 'pending',
  POSTED: 'posted',
  ALL_PERIOD: 'all_period',
};

/**
 * Resolves the canonical booking service identifier and labels for commission matching.
 */
export function resolveCommissionServiceInfo(booking = {}) {
  const serviceTypeId = String(booking.serviceTypeId || booking.serviceId || '')
    .trim()
    .toLowerCase();
  const serviceTypeName = String(
    booking.serviceTypeName ||
      booking.serviceLabel ||
      booking.serviceTypeId ||
      booking.serviceId ||
      '',
  ).trim();
  const serviceOptionName = String(
    booking.serviceOptionName ||
      booking.packageLabel ||
      booking.recordingTypeLabel ||
      booking.packageId ||
      booking.recordingTypeId ||
      'Reguler',
  ).trim();

  const deliveryMode =
    'deliveryMode' in booking && booking.deliveryMode !== undefined
      ? String(booking.deliveryMode || '')
          .trim()
          .toLowerCase()
      : COMMISSION_ELIGIBLE_SERVICE_IDS.includes(serviceTypeId)
        ? DELIVERY_MODES.STUDIO
        : '';

  return {
    serviceTypeId,
    serviceTypeName: serviceTypeName || (serviceTypeId === 'recording' ? 'Recording' : 'Rehearsal'),
    serviceOptionName,
    deliveryMode,
  };
}

/**
 * Classifies a booking record strictly according to Phase 9 eligibility rules:
 * - Only `sessionStatus === 'completed'`
 * - Valid `actualCompletedAt` timestamp (used for period membership, never `booking.date`)
 * - Studio Rehearsal or Recording service (`deliveryMode === 'studio'`)
 * - Already posted if `commissionPostingItems/{bookingId}` exists
 * - Missing/invalid `commissionSnapshot` -> `needs_review` (cannot be selected/posted)
 * - `payableTotal === 0` (including Owner-allocation-only sessions) -> `zero_payable`
 */
export function classifyBookingForCommission(
  booking,
  { postingItem = null, resolutionItem = null, periodBounds = null } = {},
) {
  if (!booking || !booking.id) {
    return {
      status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      selectable: false,
      reason: 'Data booking tidak lengkap.',
    };
  }

  if (booking.sessionStatus !== BOOKING_SESSION_STATUS.COMPLETED) {
    return {
      status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      selectable: false,
      reason: `Status sesi saat ini adalah "${booking.sessionStatus}", belum Completed.`,
    };
  }

  const serviceInfo = resolveCommissionServiceInfo(booking);

  if (serviceInfo.deliveryMode !== DELIVERY_MODES.STUDIO) {
    return {
      status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      selectable: false,
      reason: 'Layanan luar studio (WFA) tidak termasuk rekap komisi sesi studio.',
    };
  }

  if (!COMMISSION_ELIGIBLE_SERVICE_IDS.includes(serviceInfo.serviceTypeId)) {
    return {
      status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      selectable: false,
      reason: 'Hanya layanan Rehearsal dan Recording yang masuk rekap komisi sesi.',
    };
  }

  const completedTs = parseJakartaTimestamp(booking.actualCompletedAt);
  if (!completedTs.isValid) {
    return {
      status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
      selectable: false,
      reason: 'Waktu selesai aktual sesi (actualCompletedAt) belum tercatat secara valid.',
    };
  }

  if (periodBounds) {
    if (completedTs.millis < periodBounds.startMs || completedTs.millis > periodBounds.endMs) {
      return {
        status: COMMISSION_ITEM_STATUS.NOT_ELIGIBLE,
        selectable: false,
        reason: 'Waktu selesai aktual sesi berada di luar rentang periode aktif.',
      };
    }
  }

  const rawSnapshot =
    'rawCommissionSnapshot' in booking ? booking.rawCommissionSnapshot : booking.commissionSnapshot;
  const parsedSnapshot = parseCommissionSnapshot(rawSnapshot);

  if (postingItem && postingItem.id) {
    const staffPayableAmount =
      Number(postingItem.staffPayableAmount) || parsedSnapshot.staffPayableAmount || 0;
    const recordingOperatorPayableAmount =
      Number(postingItem.recordingOperatorPayableAmount) ||
      parsedSnapshot.recordingOperatorPayableAmount ||
      0;
    const ownerAllocationReference =
      Number(postingItem.ownerAllocationReference) || parsedSnapshot.ownerAllocationReference || 0;

    return {
      status: COMMISSION_ITEM_STATUS.POSTED,
      selectable: false,
      booking,
      bookingId: booking.id,
      serviceInfo,
      completedAtMillis: completedTs.millis,
      completedDateIso: completedTs.dateIso,
      snapshot: parsedSnapshot,
      snapshotSignature: buildCommissionSnapshotSignature(rawSnapshot),
      staffPayableAmount,
      recordingOperatorPayableAmount,
      ownerAllocationReference,
      payableTotal: staffPayableAmount + recordingOperatorPayableAmount,
      postingItem,
      reason: `Sudah diposting ke Pembukuan (${postingItem.batchId}).`,
    };
  }

  if (!parsedSnapshot.isValid) {
    if (resolutionItem && resolutionItem.id) {
      return {
        status: COMMISSION_ITEM_STATUS.RESOLVED_NO_COMMISSION,
        selectable: false,
        booking,
        bookingId: booking.id,
        serviceInfo,
        completedAtMillis: completedTs.millis,
        completedDateIso: completedTs.dateIso,
        snapshot: parsedSnapshot,
        snapshotSignature: 'invalid',
        staffPayableAmount: 0,
        recordingOperatorPayableAmount: 0,
        ownerAllocationReference: 0,
        payableTotal: 0,
        postingItem: null,
        resolutionItem,
        reason: resolutionItem.reason || 'Sudah ditandai selesai oleh Owner.',
      };
    }

    return {
      status: COMMISSION_ITEM_STATUS.NEEDS_REVIEW,
      selectable: false,
      booking,
      bookingId: booking.id,
      serviceInfo,
      completedAtMillis: completedTs.millis,
      completedDateIso: completedTs.dateIso,
      snapshot: parsedSnapshot,
      snapshotSignature: 'invalid',
      staffPayableAmount: 0,
      recordingOperatorPayableAmount: 0,
      ownerAllocationReference: 0,
      payableTotal: 0,
      postingItem: null,
      resolutionItem: null,
      reason: parsedSnapshot.reason || 'Commission snapshot tidak valid atau belum tersedia.',
    };
  }

  if (parsedSnapshot.payableTotal <= 0) {
    return {
      status: COMMISSION_ITEM_STATUS.ZERO_PAYABLE,
      selectable: false,
      booking,
      bookingId: booking.id,
      serviceInfo,
      completedAtMillis: completedTs.millis,
      completedDateIso: completedTs.dateIso,
      snapshot: parsedSnapshot,
      snapshotSignature: buildCommissionSnapshotSignature(rawSnapshot),
      staffPayableAmount: 0,
      recordingOperatorPayableAmount: 0,
      ownerAllocationReference: parsedSnapshot.ownerAllocationReference,
      payableTotal: 0,
      postingItem: null,
      reason:
        parsedSnapshot.ownerAllocationReference > 0
          ? 'Hanya memiliki Owner Allocation (bukan biaya dibayar ke Staff/Operator).'
          : 'Tidak ada fee Staff atau Recording Operator yang perlu dibayar (Rp 0).',
    };
  }

  return {
    status: COMMISSION_ITEM_STATUS.PENDING,
    selectable: true,
    booking,
    bookingId: booking.id,
    serviceInfo,
    completedAtMillis: completedTs.millis,
    completedDateIso: completedTs.dateIso,
    snapshot: parsedSnapshot,
    snapshotSignature: buildCommissionSnapshotSignature(rawSnapshot),
    staffPayableAmount: parsedSnapshot.staffPayableAmount,
    recordingOperatorPayableAmount: parsedSnapshot.recordingOperatorPayableAmount,
    ownerAllocationReference: parsedSnapshot.ownerAllocationReference,
    payableTotal: parsedSnapshot.payableTotal,
    postingItem: null,
    reason: '',
  };
}

/**
 * Classifies a list of bookings in one pass and computes filtered metrics.
 * Guarantees Owner Allocation NEVER enters `totalToPay` (`payableTotal`).
 */
export function evaluateCommissionReviewDataset({
  bookings = [],
  postingItemsByBookingId = new Map(),
  resolutionsByBookingId = new Map(),
  periodBounds = null,
  serviceFilter = 'all',
  searchQuery = '',
  statusFilter = COMMISSION_REVIEW_STATUS_FILTER.PENDING,
} = {}) {
  const cleanSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();

  const pendingItems = [];
  const postedItems = [];
  const needsReviewItems = [];
  const resolvedNeedsReviewItems = [];
  const zeroPayableItems = [];

  for (const booking of bookings) {
    const postingItem = postingItemsByBookingId.get?.(booking?.id) || null;
    const resolutionItem = resolutionsByBookingId.get?.(booking?.id) || null;
    const item = classifyBookingForCommission(booking, {
      postingItem,
      resolutionItem,
      periodBounds,
    });

    if (item.status === COMMISSION_ITEM_STATUS.NOT_ELIGIBLE) {
      continue;
    }

    if (serviceFilter !== 'all' && item.serviceInfo.serviceTypeId !== serviceFilter) {
      continue;
    }

    if (cleanSearch) {
      const haystacks = [
        item.bookingId,
        item.booking.customerName,
        item.booking.bandName,
        item.booking.phone,
        item.serviceInfo.serviceTypeName,
        item.serviceInfo.serviceOptionName,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      if (!haystacks.some((h) => h.includes(cleanSearch))) {
        continue;
      }
    }

    if (item.status === COMMISSION_ITEM_STATUS.PENDING) {
      pendingItems.push(item);
    } else if (item.status === COMMISSION_ITEM_STATUS.POSTED) {
      postedItems.push(item);
    } else if (item.status === COMMISSION_ITEM_STATUS.NEEDS_REVIEW) {
      needsReviewItems.push(item);
    } else if (item.status === COMMISSION_ITEM_STATUS.RESOLVED_NO_COMMISSION) {
      resolvedNeedsReviewItems.push(item);
    } else if (item.status === COMMISSION_ITEM_STATUS.ZERO_PAYABLE) {
      zeroPayableItems.push(item);
    }
  }

  let visibleTableItems = pendingItems;
  if (statusFilter === COMMISSION_REVIEW_STATUS_FILTER.POSTED) {
    visibleTableItems = postedItems;
  } else if (statusFilter === COMMISSION_REVIEW_STATUS_FILTER.ALL_PERIOD) {
    visibleTableItems = [...pendingItems, ...postedItems].sort(
      (a, b) => a.completedAtMillis - b.completedAtMillis,
    );
  }

  const summary = computeCommissionAggregateTotals(pendingItems);

  return {
    pendingItems,
    postedItems,
    needsReviewItems,
    resolvedNeedsReviewItems,
    zeroPayableItems,
    visibleTableItems,
    summary,
  };
}

/**
 * Computes exact integer Rupiah totals across a collection of commission review items.
 * Formula locked per spec: `payableTotal = staffCommissionTotal + recordingOperatorFeeTotal`
 * (Owner Allocation strictly tracked separately as reference only).
 */
export function computeCommissionAggregateTotals(items = []) {
  let completedSessionsCount = 0;
  let staffCommissionTotal = 0;
  let recordingOperatorFeeTotal = 0;
  let ownerAllocationReferenceTotal = 0;

  for (const item of items) {
    if (!item) continue;
    completedSessionsCount += 1;
    staffCommissionTotal += Math.max(0, Math.round(Number(item.staffPayableAmount) || 0));
    recordingOperatorFeeTotal += Math.max(
      0,
      Math.round(Number(item.recordingOperatorPayableAmount) || 0),
    );
    ownerAllocationReferenceTotal += Math.max(
      0,
      Math.round(Number(item.ownerAllocationReference) || 0),
    );
  }

  return {
    completedSessionsCount,
    staffCommissionTotal,
    recordingOperatorFeeTotal,
    payableTotal: staffCommissionTotal + recordingOperatorFeeTotal,
    ownerAllocationReferenceTotal,
  };
}

/**
 * Builds deterministic `bookkeepingEntries` document IDs for a commission batch.
 */
export function buildCommissionBookkeepingEntryId(batchId, roleKey) {
  const cleanBatchId = String(batchId || '').trim();
  const suffix = roleKey === 'staff' ? 'staff' : 'operator';
  return `bk_commission_${cleanBatchId}_${suffix}`;
}
