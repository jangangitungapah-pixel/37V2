import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { normalizePhoneNumber } from '@/features/admin/customer/utils/phone-number';
import { buildWhatsAppClickToChatUrl } from '@/features/admin/booking-requests/services/whatsapp-message-service';
import { DELIVERY_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import {
  CUSTOMER_REVIEW_SCHEMA_VERSION,
  REVIEW_INVITATION_STATUS,
  REVIEW_INVITATION_VALIDITY_MS,
} from '../config/customer-review-config';
import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';
import { resolveEffectiveInvitationStatus } from '../utils/customer-review-normalize';
import {
  buildReviewInvitationUrl,
  generateReviewToken,
  hashReviewToken,
} from '../utils/review-token';

export function createReviewInvitationError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

function assertStaffOrOwnerActor(actor = {}) {
  const uid = String(actor?.uid || '').trim();
  const role = String(actor?.role || '')
    .trim()
    .toLowerCase();
  const active = actor?.active !== false;

  if (!uid || !active || !['owner', 'staff'].includes(role)) {
    throw createReviewInvitationError(
      'review-invitation/unauthorized',
      'Hanya Owner atau Staff studio aktif yang dapat mengelola undangan ulasan pelanggan.',
    );
  }
  return { uid, role };
}

/**
 * Verifies strictly that a booking satisfies every operational & security prerequisite
 * for receiving a review invitation.
 */
export function evaluateBookingReviewEligibility(booking) {
  if (!booking || typeof booking !== 'object') {
    return {
      isEligible: false,
      code: 'review-invitation/booking-not-found',
      reason: 'Data booking tidak ditemukan.',
    };
  }

  if (booking.sessionStatus !== BOOKING_SESSION_STATUS.COMPLETED) {
    return {
      isEligible: false,
      code: 'review-invitation/booking-not-completed',
      reason: 'Undangan ulasan hanya dapat dibuat untuk sesi studio yang berstatus Completed.',
    };
  }

  const completedMs = getTimestampMillis(booking.actualCompletedAt);
  if (completedMs <= 0) {
    return {
      isEligible: false,
      code: 'review-invitation/missing-completed-timestamp',
      reason:
        'Timestamp penyelesaian sesi (actualCompletedAt) wajib tersedia sebelum undangan dibuat.',
    };
  }

  const deliveryMode = String(booking.deliveryMode || DELIVERY_MODES.STUDIO).trim();
  if (deliveryMode !== DELIVERY_MODES.STUDIO) {
    return {
      isEligible: false,
      code: 'review-invitation/not-studio-booking',
      reason: 'Undangan ulasan hanya berlaku untuk booking sesi studio tatap muka yang selesai.',
    };
  }

  const customerId = String(booking.customerId || '').trim();
  if (!customerId) {
    return {
      isEligible: false,
      code: 'review-invitation/missing-customer',
      reason: 'Booking belum terhubung dengan data pelanggan yang valid.',
    };
  }

  const normalizedPhone = normalizePhoneNumber(booking.phoneNormalized || booking.phone, {
    assumeIndonesiaLocalMobile: true,
  });
  if (!normalizedPhone) {
    return {
      isEligible: false,
      code: 'review-invitation/missing-whatsapp-contact',
      reason: 'Booking belum memiliki nomor HP/WhatsApp yang valid untuk pengiriman undangan.',
    };
  }

  return {
    isEligible: true,
    code: null,
    reason: '',
    normalizedPhone,
  };
}

/**
 * Generates and stores a booking-linked SHA-256 hashed review invitation inside one transaction.
 * Any prior active invitation for the same booking is revoked atomically on rotation.
 * The raw random bearer token is returned ONLY transiently to the caller and never stored.
 */
export async function issueReviewInvitation({
  bookingId,
  actor,
  origin = '',
  now = new Date(),
  adapter = getCustomerReviewRepositoryAdapter(),
} = {}) {
  const cleanActor = assertStaffOrOwnerActor(actor);
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) {
    throw createReviewInvitationError(
      'review-invitation/missing-booking-id',
      'ID booking wajib dipilih untuk membuat undangan ulasan.',
    );
  }

  const rawToken = generateReviewToken();
  const tokenHash = await hashReviewToken(rawToken);
  const nowDate = now instanceof Date ? now : new Date(now);
  const expiresAtDate = new Date(nowDate.getTime() + REVIEW_INVITATION_VALIDITY_MS);

  const txResult = await adapter.runAtomicTransaction(async (tx) => {
    const [booking, existingIndex, existingReview] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getInvitationIndex(cleanBookingId),
      tx.getReview(cleanBookingId),
    ]);

    const eligibility = evaluateBookingReviewEligibility(booking);
    if (!eligibility.isEligible) {
      throw createReviewInvitationError(eligibility.code, eligibility.reason);
    }

    if (existingReview) {
      throw createReviewInvitationError(
        'review-invitation/review-already-submitted',
        'Ulasan untuk booking ini sudah pernah dikirim oleh pelanggan dan tidak dapat dibuat undangan baru.',
      );
    }

    let previousInvitation = null;
    if (existingIndex?.activeInvitationId) {
      previousInvitation = await tx.getInvitation(existingIndex.activeInvitationId);
      if (previousInvitation?.status === REVIEW_INVITATION_STATUS.SUBMITTED) {
        throw createReviewInvitationError(
          'review-invitation/review-already-submitted',
          'Undangan ulasan sebelumnya sudah digunakan oleh pelanggan.',
        );
      }
    }

    // Revoke previous active invitation atomically during rotation
    if (previousInvitation && previousInvitation.status === REVIEW_INVITATION_STATUS.ACTIVE) {
      await tx.updateInvitation(previousInvitation.id, {
        status: REVIEW_INVITATION_STATUS.REVOKED,
        revokedByUid: cleanActor.uid,
        markRevoked: true,
        version: Number(previousInvitation.version || 1) + 1,
      });
    }

    const serviceLabelSnapshot =
      String(booking.serviceTypeName || booking.serviceLabel || 'Studio Session').trim() ||
      'Studio Session';
    const sessionDate = String(booking.date || '').trim();
    const studioId = String(booking.studioId || '').trim();

    const createdInvitation = await tx.createInvitation(tokenHash, {
      schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
      bookingId: cleanBookingId,
      serviceLabelSnapshot,
      sessionDate,
      studioId,
      status: REVIEW_INVITATION_STATUS.ACTIVE,
      issuedByUid: cleanActor.uid,
      expiresAt: expiresAtDate,
      submittedAt: null,
      revokedAt: null,
      revokedByUid: '',
      version: 1,
    });

    const nextIndexVersion = existingIndex ? Number(existingIndex.version || 1) + 1 : 1;
    const updatedIndex = await tx.setInvitationIndex(cleanBookingId, {
      schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
      bookingId: cleanBookingId,
      activeInvitationId: tokenHash,
      expiresAt: expiresAtDate,
      version: nextIndexVersion,
    });

    return {
      invitation: createdInvitation,
      invitationIndex: updatedIndex,
      booking,
      normalizedPhone: eligibility.normalizedPhone,
    };
  });

  const invitationUrl = buildReviewInvitationUrl(rawToken, origin);

  return {
    ...txResult,
    rawToken,
    invitationUrl,
  };
}

/**
 * Revokes an active invitation for a booking so its bearer link can no longer submit a review.
 */
export async function revokeReviewInvitation({
  bookingId,
  actor,
  adapter = getCustomerReviewRepositoryAdapter(),
} = {}) {
  const cleanActor = assertStaffOrOwnerActor(actor);
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) {
    throw createReviewInvitationError(
      'review-invitation/missing-booking-id',
      'ID booking tidak valid.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingIndex, existingReview] = await Promise.all([
      tx.getInvitationIndex(cleanBookingId),
      tx.getReview(cleanBookingId),
    ]);

    if (existingReview) {
      throw createReviewInvitationError(
        'review-invitation/review-already-submitted',
        'Ulasan sudah dikirim; undangan tidak perlu dicabut.',
      );
    }

    if (!existingIndex?.activeInvitationId) {
      return null;
    }

    const activeInv = await tx.getInvitation(existingIndex.activeInvitationId);
    if (!activeInv || activeInv.status !== REVIEW_INVITATION_STATUS.ACTIVE) {
      return activeInv;
    }

    return tx.updateInvitation(activeInv.id, {
      status: REVIEW_INVITATION_STATUS.REVOKED,
      revokedByUid: cleanActor.uid,
      markRevoked: true,
      version: Number(activeInv.version || 1) + 1,
    });
  });
}

/**
 * Builds the suggested Indonesian WhatsApp message with transient invitation link.
 */
export function buildReviewInvitationWhatsAppMessage({ customerName, reviewUrl }) {
  const safeName = String(customerName || 'Sobat Musisi').trim() || 'Sobat Musisi';
  const safeUrl = String(reviewUrl || '').trim();

  return [
    `Halo ${safeName}!`,
    '',
    'Terima kasih sudah menggunakan layanan 37 Music Studio.',
    '',
    'Kami ingin mendengar pengalaman Anda selama menggunakan studio kami.',
    '',
    'Boleh bantu berikan rating dan ulasan singkat melalui link berikut?',
    '',
    safeUrl,
    '',
    'Terima kasih sudah menjadi bagian dari 37 Music Studio!',
  ].join('\n');
}

/**
 * Builds a manual Click-to-Chat `wa.me` URL targeting the completed booking's verified phone number.
 * Staff must manually click Send inside WhatsApp.
 */
export function buildReviewInvitationWhatsAppUrl({ phone, customerName, reviewUrl }) {
  const message = buildReviewInvitationWhatsAppMessage({ customerName, reviewUrl });
  return buildWhatsAppClickToChatUrl({
    phone,
    message,
  });
}

/**
 * Computes human-readable booking review status summary for BookingDetailDrawer.
 */
export function resolveBookingReviewPanelState({
  booking,
  invitation,
  review,
  now = new Date(),
} = {}) {
  const eligibility = evaluateBookingReviewEligibility(booking);

  if (review) {
    return {
      key: `review_${review.status}`,
      canGenerate: false,
      eligibility,
      review,
      invitation,
    };
  }

  if (!eligibility.isEligible) {
    return {
      key: 'ineligible',
      canGenerate: false,
      eligibility,
      review: null,
      invitation: null,
    };
  }

  if (!invitation) {
    return {
      key: 'not_invited',
      canGenerate: true,
      eligibility,
      review: null,
      invitation: null,
    };
  }

  const effectiveInvStatus = resolveEffectiveInvitationStatus(invitation, now);
  return {
    key: `invitation_${effectiveInvStatus}`,
    canGenerate: effectiveInvStatus !== REVIEW_INVITATION_STATUS.SUBMITTED,
    eligibility,
    review: null,
    invitation,
  };
}
