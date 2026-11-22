import { z } from 'zod';

import {
  ALLOWED_REVIEW_MODERATION_TRANSITIONS,
  CUSTOMER_REVIEW_CONSENT_VERSION,
  CUSTOMER_REVIEW_LIMITS,
} from '../config/customer-review-config';

export const customerReviewSubmissionSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(
      CUSTOMER_REVIEW_LIMITS.displayNameMin,
      `Nama tampilan minimal ${CUSTOMER_REVIEW_LIMITS.displayNameMin} karakter.`,
    )
    .max(
      CUSTOMER_REVIEW_LIMITS.displayNameMax,
      `Nama tampilan maksimal ${CUSTOMER_REVIEW_LIMITS.displayNameMax} karakter.`,
    ),
  rating: z
    .number({ message: 'Pilih rating bintang 1 sampai 5.' })
    .int('Rating harus berupa bilangan bulat 1 sampai 5.')
    .min(CUSTOMER_REVIEW_LIMITS.ratingMin, 'Rating minimal 1 bintang.')
    .max(CUSTOMER_REVIEW_LIMITS.ratingMax, 'Rating maksimal 5 bintang.'),
  reviewText: z
    .string()
    .trim()
    .min(
      CUSTOMER_REVIEW_LIMITS.reviewTextMin,
      `Ulasan minimal ${CUSTOMER_REVIEW_LIMITS.reviewTextMin} karakter.`,
    )
    .max(
      CUSTOMER_REVIEW_LIMITS.reviewTextMax,
      `Ulasan maksimal ${CUSTOMER_REVIEW_LIMITS.reviewTextMax} karakter.`,
    ),
  consentToPublish: z.literal(true, {
    errorMap: () => ({
      message: 'Anda wajib mencentang persetujuan publikasi ulasan sebelum mengirim.',
    }),
  }),
  consentVersion: z
    .literal(CUSTOMER_REVIEW_CONSENT_VERSION)
    .default(CUSTOMER_REVIEW_CONSENT_VERSION),
});

export function validateCustomerReviewSubmissionInput(rawInput = {}) {
  const parsed = customerReviewSubmissionSchema.safeParse({
    displayName: String(rawInput?.displayName ?? ''),
    rating: Number(rawInput?.rating),
    reviewText: String(rawInput?.reviewText ?? ''),
    consentToPublish: rawInput?.consentToPublish === true,
    consentVersion: CUSTOMER_REVIEW_CONSENT_VERSION,
  });

  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || '_form');
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      isValid: false,
      errors: fieldErrors,
      payload: null,
    };
  }

  return {
    isValid: true,
    errors: {},
    payload: parsed.data,
  };
}

export function isModerationTransitionAllowed(fromStatus, toStatus) {
  const allowedTargets = ALLOWED_REVIEW_MODERATION_TRANSITIONS[fromStatus];
  return Array.isArray(allowedTargets) && allowedTargets.includes(toStatus);
}
