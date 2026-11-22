import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';

import {
  CUSTOMER_REVIEW_CONSENT_VERSION,
  CUSTOMER_REVIEW_SCHEMA_VERSION,
  CUSTOMER_REVIEW_STATUS,
  REVIEW_INVITATION_STATUS,
} from '../config/customer-review-config';

const VALID_INVITATION_STATUSES = new Set(Object.values(REVIEW_INVITATION_STATUS));
const VALID_REVIEW_STATUSES = new Set(Object.values(CUSTOMER_REVIEW_STATUS));

export function normalizeReviewInvitationRecord(id, raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const cleanId = String(id || raw.id || '').trim();
  const bookingId = String(raw.bookingId || '').trim();
  if (!cleanId || !bookingId) {
    return null;
  }

  const status = VALID_INVITATION_STATUSES.has(raw.status)
    ? raw.status
    : REVIEW_INVITATION_STATUS.REVOKED;

  return {
    id: cleanId,
    schemaVersion: Number(raw.schemaVersion) || CUSTOMER_REVIEW_SCHEMA_VERSION,
    bookingId,
    serviceLabelSnapshot: String(raw.serviceLabelSnapshot || '').trim(),
    sessionDate: String(raw.sessionDate || '').trim(),
    studioId: String(raw.studioId || '').trim(),
    status,
    issuedAt: raw.issuedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    submittedAt: raw.submittedAt ?? null,
    revokedAt: raw.revokedAt ?? null,
    revokedByUid: String(raw.revokedByUid || '').trim(),
    issuedByUid: String(raw.issuedByUid || '').trim(),
    version: Math.max(1, Math.round(Number(raw.version) || 1)),
  };
}

export function normalizeReviewInvitationIndexRecord(bookingId, raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const cleanBookingId = String(bookingId || raw.bookingId || '').trim();
  const activeInvitationId = String(raw.activeInvitationId || '').trim();
  if (!cleanBookingId || !activeInvitationId) {
    return null;
  }

  return {
    id: cleanBookingId,
    schemaVersion: Number(raw.schemaVersion) || CUSTOMER_REVIEW_SCHEMA_VERSION,
    bookingId: cleanBookingId,
    activeInvitationId,
    issuedAt: raw.issuedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    version: Math.max(1, Math.round(Number(raw.version) || 1)),
  };
}

export function normalizeCustomerReviewRecord(id, raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const cleanId = String(id || raw.id || '').trim();
  const bookingId = String(raw.bookingId || cleanId).trim();
  if (!cleanId || !bookingId) {
    return null;
  }

  const status = VALID_REVIEW_STATUSES.has(raw.status)
    ? raw.status
    : CUSTOMER_REVIEW_STATUS.PENDING;

  return {
    id: cleanId,
    schemaVersion: Number(raw.schemaVersion) || CUSTOMER_REVIEW_SCHEMA_VERSION,
    bookingId,
    invitationId: String(raw.invitationId || '').trim(),
    displayName: String(raw.displayName || '').trim(),
    rating: Math.max(1, Math.min(5, Math.round(Number(raw.rating) || 1))),
    reviewText: String(raw.reviewText || '').trim(),
    serviceLabelSnapshot: String(raw.serviceLabelSnapshot || '').trim(),
    sessionDate: String(raw.sessionDate || '').trim(),
    consentToPublish: raw.consentToPublish === true,
    consentVersion: String(raw.consentVersion || CUSTOMER_REVIEW_CONSENT_VERSION).trim(),
    status,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    publishedAt: raw.publishedAt ?? null,
    version: Math.max(1, Math.round(Number(raw.version) || 1)),
  };
}

/**
 * Resolves effective public invitation state against current time without needing background expiry jobs.
 */
export function resolveEffectiveInvitationStatus(invitation, now = new Date()) {
  if (!invitation) return 'invalid';

  if (invitation.status === REVIEW_INVITATION_STATUS.SUBMITTED) {
    return REVIEW_INVITATION_STATUS.SUBMITTED;
  }

  if (invitation.status === REVIEW_INVITATION_STATUS.REVOKED) {
    return REVIEW_INVITATION_STATUS.REVOKED;
  }

  const expiresMs = getTimestampMillis(invitation.expiresAt);
  const nowMs = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  if (expiresMs > 0 && expiresMs <= nowMs) {
    return 'expired';
  }

  return REVIEW_INVITATION_STATUS.ACTIVE;
}
