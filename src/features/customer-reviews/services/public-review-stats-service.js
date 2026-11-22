import {
  calculateAverageRating,
  createEmptyPublicReviewStats,
  normalizePublicReviewStats,
} from '../utils/customer-review-stats';

/**
 * Pure presentation helper deriving display metrics from `publicReviewStats/summary`
 * and optional full admin review list. Never fabricates ratings or counts.
 */
export function buildPublicReviewStatsViewModel(rawStats = null) {
  const stats = rawStats ? normalizePublicReviewStats(rawStats) : createEmptyPublicReviewStats();
  const averageRating = calculateAverageRating(stats);

  return {
    publishedCount: stats.publishedCount,
    ratingSum: stats.ratingSum,
    averageRating,
    averageRatingLabel: stats.publishedCount > 0 ? averageRating.toFixed(1) : '0.0',
    ratingDistribution: stats.ratingDistribution,
    hasPublishedReviews: stats.publishedCount > 0,
    updatedAt: stats.updatedAt,
  };
}

export function buildAdminReviewsOverview(reviews = [], publicStats = null) {
  const counts = {
    total: 0,
    pending: 0,
    published: 0,
    rejected: 0,
    archived: 0,
  };

  for (const review of reviews || []) {
    counts.total += 1;
    if (review?.status && Object.prototype.hasOwnProperty.call(counts, review.status)) {
      counts[review.status] += 1;
    }
  }

  const publicSummary = buildPublicReviewStatsViewModel(publicStats);

  return {
    ...counts,
    averageRating: publicSummary.averageRating,
    averageRatingLabel: publicSummary.averageRatingLabel,
    statsPublishedCount: publicSummary.publishedCount,
    ratingDistribution: publicSummary.ratingDistribution,
  };
}
