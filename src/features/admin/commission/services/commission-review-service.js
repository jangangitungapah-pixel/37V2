/**
 * Commission Review & Batch Audit Query Helpers (Phase 9)
 */

import { getCommissionRepositoryAdapter } from '../repositories/commission-repository';
import {
  COMMISSION_REVIEW_STATUS_FILTER,
  evaluateCommissionReviewDataset,
} from '../utils/commission-calculation';
import { formatCommissionPeriodLabel } from '../utils/commission-period';

/**
 * Loads detailed `commissionPostingItems` and linked `bookkeepingEntries`
 * for an immutable posted Commission Batch.
 */
export async function fetchCommissionBatchDetails(
  batchId,
  adapter = getCommissionRepositoryAdapter(),
) {
  return adapter.getCommissionBatchDetails(batchId);
}

/**
 * Pure wrapper over dataset evaluation for review screen filters and summaries.
 */
export function buildCommissionReviewView({
  bookings = [],
  postingItemsByBookingId = new Map(),
  resolutionsByBookingId = new Map(),
  periodBounds = null,
  serviceFilter = 'all',
  searchQuery = '',
  statusFilter = COMMISSION_REVIEW_STATUS_FILTER.PENDING,
} = {}) {
  return evaluateCommissionReviewDataset({
    bookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    periodBounds,
    serviceFilter,
    searchQuery,
    statusFilter,
  });
}

export function getBatchPeriodDisplay(batch) {
  if (!batch) return '-';
  return formatCommissionPeriodLabel(batch.periodStart, batch.periodEnd);
}
