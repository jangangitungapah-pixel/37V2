import { ensureAppCheckTokenForPublicWrite } from '@/lib/firebase/app-check';

import {
  CUSTOMER_REVIEW_CONSENT_VERSION,
  CUSTOMER_REVIEW_SCHEMA_VERSION,
  CUSTOMER_REVIEW_STATUS,
  REVIEW_INVITATION_STATUS,
} from '../config/customer-review-config';
import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';
import { validateCustomerReviewSubmissionInput } from '../schemas/customer-review-schema';
import { resolveEffectiveInvitationStatus } from '../utils/customer-review-normalize';
import { hashReviewToken, isValidReviewTokenSyntax } from '../utils/review-token';

export function createCustomerReviewSubmissionError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

/**
 * Validates raw invitation token syntax, hashes it locally via SHA-256,
 * and fetches ONLY `reviewInvitations/{tokenHash}`.
 * Uses safe generic unavailable states when invalid or blocked by security rules.
 */
export async function validateAndLoadPublicInvitation({
  rawToken,
  now = new Date(),
  adapter = getCustomerReviewRepositoryAdapter(),
} = {}) {
  if (!isValidReviewTokenSyntax(rawToken)) {
    return {
      state: 'invalid',
      tokenHash: '',
      invitation: null,
    };
  }

  const tokenHash = await hashReviewToken(rawToken);
  let invitation;
  try {
    invitation = await adapter.getPublicInvitationByTokenHash(tokenHash);
  } catch (err) {
    const code = String(err?.code || '').toLowerCase();
    if (code.includes('permission-denied')) {
      return {
        state: 'invalid',
        tokenHash,
        invitation: null,
      };
    }
    throw createCustomerReviewSubmissionError(
      err?.code || 'public-review/load-failed',
      'Gagal memuat status undangan ulasan. Periksa koneksi internet Anda lalu coba lagi.',
    );
  }

  if (!invitation) {
    return {
      state: 'invalid',
      tokenHash,
      invitation: null,
    };
  }

  const effectiveStatus = resolveEffectiveInvitationStatus(invitation, now);
  if (effectiveStatus === REVIEW_INVITATION_STATUS.SUBMITTED) {
    return {
      state: 'submitted',
      tokenHash,
      invitation: {
        bookingId: invitation.bookingId,
        serviceLabelSnapshot: invitation.serviceLabelSnapshot,
        sessionDate: invitation.sessionDate,
        studioId: invitation.studioId,
        status: invitation.status,
      },
    };
  }

  if (effectiveStatus === 'expired') {
    return {
      state: 'expired',
      tokenHash,
      invitation: null,
    };
  }

  if (effectiveStatus === REVIEW_INVITATION_STATUS.REVOKED) {
    return {
      state: 'revoked',
      tokenHash,
      invitation: null,
    };
  }

  if (!invitation.bookingId) {
    return {
      state: 'invalid',
      tokenHash,
      invitation: null,
    };
  }

  return {
    state: 'active',
    tokenHash,
    invitation,
  };
}

/**
 * Atomically submits one customer review tied to its booking and marks the invitation `submitted`.
 * Enforces App Check token retrieval (best-effort Spark posture), input validation,
 * expiry checks, and one-review-per-booking uniqueness inside a Firestore transaction.
 */
export async function submitCustomerReview({
  rawToken,
  formValues,
  honeypotValue = '',
  now = new Date(),
  adapter = getCustomerReviewRepositoryAdapter(),
} = {}) {
  // Low-cost client honeypot deterrent (documented as non-authoritative)
  if (String(honeypotValue || '').trim().length > 0) {
    throw createCustomerReviewSubmissionError(
      'public-review/spam-deterrent',
      'Pengiriman ulasan tidak dapat diproses.',
    );
  }

  if (!isValidReviewTokenSyntax(rawToken)) {
    throw createCustomerReviewSubmissionError(
      'public-review/invalid-token',
      'Tautan undangan ulasan tidak valid atau sudah kedaluwarsa.',
    );
  }

  const validation = validateCustomerReviewSubmissionInput(formValues);
  if (!validation.isValid) {
    const firstMsg =
      Object.values(validation.errors)[0] || 'Data ulasan belum lengkap atau tidak valid.';
    throw createCustomerReviewSubmissionError(
      'public-review/validation-error',
      firstMsg,
      validation.errors,
    );
  }

  const tokenHash = await hashReviewToken(rawToken);
  await ensureAppCheckTokenForPublicWrite().catch(() => ({
    initialized: false,
    state: 'unconfigured',
  }));

  const nowDate = now instanceof Date ? now : new Date(now);

  return adapter.runAtomicTransaction(async (tx) => {
    const invitation = await tx.getInvitation(tokenHash);
    if (!invitation) {
      throw createCustomerReviewSubmissionError(
        'public-review/invalid-token',
        'Tautan undangan ulasan tidak ditemukan atau sudah dicabut.',
      );
    }

    const effectiveStatus = resolveEffectiveInvitationStatus(invitation, nowDate);
    if (effectiveStatus === REVIEW_INVITATION_STATUS.SUBMITTED) {
      throw createCustomerReviewSubmissionError(
        'public-review/already-submitted',
        'Ulasan untuk undangan ini sudah pernah dikirim sebelumnya.',
      );
    }
    if (effectiveStatus === 'expired') {
      throw createCustomerReviewSubmissionError(
        'public-review/invitation-expired',
        'Masa berlaku tautan undangan ulasan ini telah berakhir.',
      );
    }
    if (effectiveStatus === REVIEW_INVITATION_STATUS.REVOKED) {
      throw createCustomerReviewSubmissionError(
        'public-review/invitation-revoked',
        'Tautan undangan ulasan ini sudah tidak aktif atau telah diganti dengan tautan baru.',
      );
    }

    const existingReview = await tx.getReview(invitation.bookingId);
    if (existingReview) {
      throw createCustomerReviewSubmissionError(
        'public-review/duplicate-booking-review',
        'Booking ini sudah memiliki ulasan pelanggan dan tidak dapat mengirim ulasan ganda.',
      );
    }

    const reviewPayload = {
      schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
      bookingId: invitation.bookingId,
      invitationId: tokenHash,
      displayName: validation.payload.displayName,
      rating: validation.payload.rating,
      reviewText: validation.payload.reviewText,
      serviceLabelSnapshot: invitation.serviceLabelSnapshot || 'Studio Session',
      sessionDate: invitation.sessionDate || '',
      consentToPublish: true,
      consentVersion: CUSTOMER_REVIEW_CONSENT_VERSION,
      status: CUSTOMER_REVIEW_STATUS.PENDING,
      publishedAt: null,
      version: 1,
    };

    const createdReview = await tx.createReview(invitation.bookingId, reviewPayload);
    const updatedInvitation = await tx.updateInvitation(tokenHash, {
      status: REVIEW_INVITATION_STATUS.SUBMITTED,
      markSubmitted: true,
      version: Number(invitation.version || 1) + 1,
    });

    return {
      review: createdReview,
      invitation: updatedInvitation,
    };
  });
}
