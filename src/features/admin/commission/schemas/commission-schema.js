/**
 * Firestore Normalizers & Record Builders for Phase 9 — Commission & Fee Management:
 * - `commissionBatches/{batchId}` (15 fields)
 * - `commissionPostingItems/{bookingId}` (15 fields)
 * - `bookkeepingEntries/{entryId}` (13 fields, expense accrual integration contract)
 */

import { COMMISSION_TIME_ZONE } from '../utils/commission-period';
import { parseCommissionSnapshot } from '../utils/commission-snapshot';

export const COMMISSION_BATCH_STATUS = {
  POSTED: 'posted',
};

export const COMMISSION_POSTING_ITEM_STATUS = {
  POSTED: 'posted',
};

export const COMMISSION_REVIEW_RESOLUTION_STATUS = {
  DISMISSED_NO_COMMISSION: 'dismissed_no_commission',
};

export const BOOKKEEPING_SOURCE_MODULE = 'commission-and-fee';
export const BOOKKEEPING_SOURCE_TYPE = 'commission_batch';
export const BOOKKEEPING_ENTRY_TYPE = {
  EXPENSE_ACCRUAL: 'expense_accrual',
};
export const BOOKKEEPING_CATEGORY = {
  STAFF_COMMISSION: 'staff_commission',
  RECORDING_OPERATOR_FEE: 'recording_operator_fee',
};
export const BOOKKEEPING_SETTLEMENT_STATUS = {
  UNPAID: 'unpaid',
};

export const MAX_BOOKINGS_PER_COMMISSION_BATCH = 5;

/**
 * Normalizes a `commissionBatches/{batchId}` Firestore document.
 */
export function normalizeCommissionBatchRecord(id, data = {}) {
  const staffCommissionTotal = Math.max(0, Math.round(Number(data.staffCommissionTotal) || 0));
  const recordingOperatorFeeTotal = Math.max(
    0,
    Math.round(Number(data.recordingOperatorFeeTotal) || 0),
  );
  const payableTotal = staffCommissionTotal + recordingOperatorFeeTotal;

  return {
    id: String(id || data.id || ''),
    periodStart: String(data.periodStart || '').trim(),
    periodEnd: String(data.periodEnd || '').trim(),
    completionTimeZone: String(data.completionTimeZone || COMMISSION_TIME_ZONE).trim(),
    bookingCount: Math.max(0, Math.round(Number(data.bookingCount) || 0)),
    staffCommissionTotal,
    recordingOperatorFeeTotal,
    payableTotal,
    ownerAllocationReferenceTotal: Math.max(
      0,
      Math.round(Number(data.ownerAllocationReferenceTotal) || 0),
    ),
    currency: String(data.currency || 'IDR').trim(),
    status: String(data.status || COMMISSION_BATCH_STATUS.POSTED).trim(),
    bookkeepingEntryIds: Array.isArray(data.bookkeepingEntryIds)
      ? data.bookkeepingEntryIds.map((entryId) => String(entryId || '').trim()).filter(Boolean)
      : [],
    postedAt: data.postedAt ?? null,
    postedByUid: String(data.postedByUid || '').trim(),
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || '').trim(),
  };
}

/**
 * Normalizes a `commissionPostingItems/{bookingId}` Firestore document.
 */
export function normalizeCommissionPostingItemRecord(id, data = {}) {
  const bookingId = String(id || data.bookingId || '').trim();
  const parsedSnapshot = parseCommissionSnapshot(data.commissionSnapshot);

  const staffPayableAmount = Math.max(
    0,
    Math.round(Number(data.staffPayableAmount ?? parsedSnapshot.staffPayableAmount) || 0),
  );
  const recordingOperatorPayableAmount = Math.max(
    0,
    Math.round(
      Number(
        data.recordingOperatorPayableAmount ?? parsedSnapshot.recordingOperatorPayableAmount,
      ) || 0,
    ),
  );

  return {
    id: bookingId,
    batchId: String(data.batchId || '').trim(),
    bookingId,
    customerSnapshot: {
      name: String(data.customerSnapshot?.name || '').trim(),
      bandName: String(data.customerSnapshot?.bandName || '').trim(),
    },
    completedAt: data.completedAt ?? null,
    serviceSnapshot: {
      serviceTypeId: String(data.serviceSnapshot?.serviceTypeId || 'rehearsal').trim(),
      serviceTypeName: String(data.serviceSnapshot?.serviceTypeName || 'Rehearsal').trim(),
      serviceOptionName: String(data.serviceSnapshot?.serviceOptionName || 'Reguler').trim(),
    },
    commissionSnapshot: data.commissionSnapshot ?? null,
    parsedCommission: parsedSnapshot,
    staffPayableAmount,
    recordingOperatorPayableAmount,
    ownerAllocationReference: Math.max(
      0,
      Math.round(
        Number(data.ownerAllocationReference ?? parsedSnapshot.ownerAllocationReference) || 0,
      ),
    ),
    payableTotal: staffPayableAmount + recordingOperatorPayableAmount,
    currency: String(data.currency || 'IDR').trim(),
    status: String(data.status || COMMISSION_POSTING_ITEM_STATUS.POSTED).trim(),
    postedAt: data.postedAt ?? null,
    postedByUid: String(data.postedByUid || '').trim(),
    createdAt: data.createdAt ?? null,
  };
}

/**
 * Normalizes a `bookkeepingEntries/{entryId}` Firestore document.
 */
export function normalizeBookkeepingEntryRecord(id, data = {}) {
  return {
    id: String(id || data.id || ''),
    sourceModule: String(data.sourceModule || BOOKKEEPING_SOURCE_MODULE).trim(),
    sourceType: String(data.sourceType || BOOKKEEPING_SOURCE_TYPE).trim(),
    sourceId: String(data.sourceId || '').trim(),
    entryType: String(data.entryType || BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL).trim(),
    category: String(data.category || '').trim(),
    description: String(data.description || '').trim(),
    amount: Math.max(0, Math.round(Number(data.amount) || 0)),
    currency: String(data.currency || 'IDR').trim(),
    settlementStatus: String(data.settlementStatus || BOOKKEEPING_SETTLEMENT_STATUS.UNPAID).trim(),
    occurredAt: data.occurredAt ?? null,
    postedAt: data.postedAt ?? null,
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || '').trim(),
  };
}

/**
 * Preserves the exact raw `commissionSnapshot` field from Firestore (`rawCommissionSnapshot`)
 * alongside canonical normalized booking properties so invalid/negative/incomplete snapshots
 * are never masked before entering Needs Review.
 */
export function normalizeCommissionReviewBookingRecord(id, rawData = {}, fallbackNormalizeBooking) {
  const base = fallbackNormalizeBooking(id, rawData);
  return {
    ...base,
    rawCommissionSnapshot:
      'rawCommissionSnapshot' in rawData
        ? rawData.rawCommissionSnapshot
        : (rawData.commissionSnapshot ?? null),
  };
}

/**
 * Normalizes a `commissionReviewResolutions/{bookingId}` Firestore document.
 */
export function normalizeCommissionReviewResolutionRecord(id, data = {}) {
  const bookingId = String(id || data.bookingId || '').trim();
  return {
    id: bookingId,
    bookingId,
    status: String(
      data.status || COMMISSION_REVIEW_RESOLUTION_STATUS.DISMISSED_NO_COMMISSION,
    ).trim(),
    reason: String(data.reason || '').trim(),
    snapshotIssue: String(data.snapshotIssue || '').trim(),
    customerSnapshot: {
      name: String(data.customerSnapshot?.name || '').trim(),
      bandName: String(data.customerSnapshot?.bandName || '').trim(),
    },
    completedAt: data.completedAt ?? null,
    resolvedAt: data.resolvedAt ?? null,
    resolvedByUid: String(data.resolvedByUid || '').trim(),
    createdAt: data.createdAt ?? null,
  };
}

export function validateCommissionResolutionReason(reason = '') {
  const clean = String(reason || '').trim();
  if (!clean || clean.length < 3) {
    return { isValid: false, error: 'Tulis alasan singkat minimal 3 karakter.' };
  }
  if (clean.length > 300) {
    return { isValid: false, error: 'Alasan maksimal 300 karakter.' };
  }
  return { isValid: true, reason: clean, error: '' };
}
