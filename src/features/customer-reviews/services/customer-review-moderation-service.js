import { CUSTOMER_REVIEW_STATUS } from '../config/customer-review-config';
import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';
import { isModerationTransitionAllowed } from '../schemas/customer-review-schema';
import { applyReviewStatsTransition } from '../utils/customer-review-stats';

export function createCustomerReviewModerationError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function assertActiveOwnerActor(actor = {}) {
  const uid = String(actor?.uid || '').trim();
  const role = String(actor?.role || '')
    .trim()
    .toLowerCase();
  const active = actor?.active === true;

  if (!uid || !active || role !== 'owner') {
    throw createCustomerReviewModerationError(
      'customer-review/owner-required',
      'Hanya Owner studio aktif yang berwenang memoderasi atau mempublikasikan ulasan pelanggan.',
    );
  }

  return { uid, role: 'owner' };
}

/**
 * Atomically applies an approved Owner moderation transition on `customerReviews/{bookingId}`
 * and updates `publicReviewStats/summary` inside the same Firestore transaction whenever
 * public visibility changes. Customer content and consent fields are strictly immutable.
 */
export async function moderateCustomerReview({
  bookingId,
  targetStatus,
  expectedVersion = null,
  actor,
  adapter = getCustomerReviewRepositoryAdapter(),
} = {}) {
  assertActiveOwnerActor(actor);

  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) {
    throw createCustomerReviewModerationError(
      'customer-review/missing-booking-id',
      'ID ulasan / booking tidak valid.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingReview, existingStats] = await Promise.all([
      tx.getReview(cleanBookingId),
      tx.getReviewStats(),
    ]);

    if (!existingReview) {
      throw createCustomerReviewModerationError(
        'customer-review/not-found',
        'Data ulasan pelanggan tidak ditemukan.',
      );
    }

    if (
      typeof expectedVersion === 'number' &&
      Number(existingReview.version || 1) !== expectedVersion
    ) {
      throw createCustomerReviewModerationError(
        'customer-review/stale-version',
        'Status ulasan telah berubah di sesi lain. Muat ulang daftar ulasan terlebih dahulu.',
      );
    }

    if (!isModerationTransitionAllowed(existingReview.status, targetStatus)) {
      throw createCustomerReviewModerationError(
        'customer-review/invalid-transition',
        `Transisi moderasi dari "${existingReview.status}" ke "${targetStatus}" tidak diperbolehkan.`,
      );
    }

    const statsUpdate = applyReviewStatsTransition({
      currentStats: existingStats,
      fromStatus: existingReview.status,
      toStatus: targetStatus,
      rating: existingReview.rating,
    });

    const isPublishing = targetStatus === CUSTOMER_REVIEW_STATUS.PUBLISHED;
    const isUnpublishing =
      existingReview.status === CUSTOMER_REVIEW_STATUS.PUBLISHED && !isPublishing;

    const updatedReview = await tx.updateReview(cleanBookingId, {
      status: targetStatus,
      markPublished: isPublishing,
      publishedAt: isPublishing ? null : isUnpublishing ? null : existingReview.publishedAt,
      version: Number(existingReview.version || 1) + 1,
    });

    let updatedStats = existingStats;
    if (statsUpdate.changed) {
      updatedStats = await tx.setReviewStats(statsUpdate.stats);
    }

    return {
      review: updatedReview,
      stats: updatedStats,
    };
  });
}
