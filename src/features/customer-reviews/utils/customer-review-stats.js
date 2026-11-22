import {
  CUSTOMER_REVIEW_SCHEMA_VERSION,
  CUSTOMER_REVIEW_STATUS,
} from '../config/customer-review-config';

export function createEmptyReviewDistribution() {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

export function createEmptyPublicReviewStats() {
  return {
    schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
    publishedCount: 0,
    ratingSum: 0,
    ratingDistribution: createEmptyReviewDistribution(),
    updatedAt: null,
  };
}

export function normalizePublicReviewStats(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return createEmptyPublicReviewStats();
  }

  const rawDist =
    raw.ratingDistribution && typeof raw.ratingDistribution === 'object'
      ? raw.ratingDistribution
      : {};
  const ratingDistribution = {
    1: Math.max(0, Math.round(Number(rawDist['1']) || 0)),
    2: Math.max(0, Math.round(Number(rawDist['2']) || 0)),
    3: Math.max(0, Math.round(Number(rawDist['3']) || 0)),
    4: Math.max(0, Math.round(Number(rawDist['4']) || 0)),
    5: Math.max(0, Math.round(Number(rawDist['5']) || 0)),
  };

  const publishedCount = Math.max(0, Math.round(Number(raw.publishedCount) || 0));
  const ratingSum = Math.max(0, Math.round(Number(raw.ratingSum) || 0));

  return {
    schemaVersion: Number(raw.schemaVersion) || CUSTOMER_REVIEW_SCHEMA_VERSION,
    publishedCount,
    ratingSum,
    ratingDistribution,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Calculates average rating dynamically from `ratingSum / publishedCount`.
 */
export function calculateAverageRating(stats = null) {
  const norm = normalizePublicReviewStats(stats);
  if (norm.publishedCount <= 0) {
    return 0;
  }
  return norm.ratingSum / norm.publishedCount;
}

/**
 * Applies a visibility-aware moderation transition to `publicReviewStats/summary`.
 * Ensures non-negative counters, exact integer accuracy, and idempotent no-op changes
 * for transitions between two non-published states.
 */
export function applyReviewStatsTransition({
  currentStats = null,
  fromStatus,
  toStatus,
  rating,
} = {}) {
  const base = normalizePublicReviewStats(currentStats);
  const starRating = Math.round(Number(rating) || 0);
  if (starRating < 1 || starRating > 5) {
    throw new Error(`Invalid star rating ${rating} for review stats transition.`);
  }

  const wasPublished = fromStatus === CUSTOMER_REVIEW_STATUS.PUBLISHED;
  const willBePublished = toStatus === CUSTOMER_REVIEW_STATUS.PUBLISHED;

  // No public visibility change -> no change to public aggregate counters
  if (wasPublished === willBePublished) {
    return {
      changed: false,
      stats: base,
    };
  }

  const nextDist = { ...base.ratingDistribution };
  const starKey = String(starRating);

  if (!wasPublished && willBePublished) {
    nextDist[starKey] = Math.max(0, (nextDist[starKey] || 0) + 1);
  } else if (wasPublished && !willBePublished) {
    nextDist[starKey] = Math.max(0, (nextDist[starKey] || 0) - 1);
  }

  const publishedCount = ['1', '2', '3', '4', '5'].reduce((sum, k) => sum + nextDist[k], 0);
  const ratingSum = ['1', '2', '3', '4', '5'].reduce((sum, k) => sum + Number(k) * nextDist[k], 0);

  return {
    changed: true,
    stats: {
      schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
      publishedCount,
      ratingSum,
      ratingDistribution: nextDist,
      updatedAt: base.updatedAt,
    },
  };
}
