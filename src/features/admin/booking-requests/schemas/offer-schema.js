/**
 * Offer Revisions Domain Schema, Normalization & Validation (Phase 2)
 * Subcollection: `publicBookingRequests/{requestId}/offers/{offerId}`
 *
 * Strictly follows `BOOKING-LIFECYCLE-DATA-CONTRACTS.md` (Section 3.3)
 * and `BOOKING-LIFECYCLE-STATE-MACHINES.md` (Section 3).
 */

import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';

export const OFFER_SCHEMA_VERSION = 1;
export const BOOKING_REQUEST_OFFERS_SUBCOLLECTION = 'offers';

export const OFFER_MODES = Object.freeze({
  QUOTE_ONLY: 'quote_only',
  DEPOSIT_HOLD_OFFER: 'deposit_hold_offer',
});

export const OFFER_STATUSES = Object.freeze({
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
});

export const OFFER_TERMINAL_STATUSES = new Set([
  OFFER_STATUSES.ACCEPTED,
  OFFER_STATUSES.REJECTED,
  OFFER_STATUSES.SUPERSEDED,
  OFFER_STATUSES.WITHDRAWN,
  OFFER_STATUSES.EXPIRED,
]);

export const OFFER_STATUS_META = Object.freeze({
  [OFFER_STATUSES.SENT]: {
    id: OFFER_STATUSES.SENT,
    label: 'Sent (Active)',
    indoLabel: 'Menunggu Respons Client',
    tone: 'amber',
  },
  [OFFER_STATUSES.ACCEPTED]: {
    id: OFFER_STATUSES.ACCEPTED,
    label: 'Accepted',
    indoLabel: 'Disetujui Client',
    tone: 'emerald',
  },
  [OFFER_STATUSES.REJECTED]: {
    id: OFFER_STATUSES.REJECTED,
    label: 'Rejected',
    indoLabel: 'Ditolak Client',
    tone: 'danger',
  },
  [OFFER_STATUSES.SUPERSEDED]: {
    id: OFFER_STATUSES.SUPERSEDED,
    label: 'Superseded',
    indoLabel: 'Digantikan Revisi Baru',
    tone: 'neutral',
  },
  [OFFER_STATUSES.WITHDRAWN]: {
    id: OFFER_STATUSES.WITHDRAWN,
    label: 'Withdrawn',
    indoLabel: 'Ditarik Staff',
    tone: 'neutral',
  },
  [OFFER_STATUSES.EXPIRED]: {
    id: OFFER_STATUSES.EXPIRED,
    label: 'Expired',
    indoLabel: 'Kedaluwarsa',
    tone: 'danger',
  },
});

export const DEPOSIT_HOLD_OFFER_BLOCK_ERROR_CODE = 'offer/deposit-hold-timing-unresolved';

/**
 * Authorizes commercial Offer modes for Phase 2 under Owner ADR Option A (`2026-11-28`):
 * - `quote_only`: commercial proposal; Staff converts to booking/hold + invoice after Client acceptance.
 * - `deposit_hold_offer`: Staff atomically issues an unpaid provisional `deposit_hold` booking, slot
 *   locks, and invoice (`inv_{provisionalBookingId}`) at Offer send time (`TX-02` / Option A), while
 *   Client acceptance/rejection only mutates `offers`, `publicBookingRequests`, and `activities`.
 */
export function assertOfferModeAuthorized(offerMode) {
  const cleanMode = String(offerMode || '').trim();
  if (cleanMode === OFFER_MODES.QUOTE_ONLY || cleanMode === OFFER_MODES.DEPOSIT_HOLD_OFFER) {
    return cleanMode;
  }

  const invalid = new Error(`Mode penawaran tidak dikenal: "${cleanMode}".`);
  invalid.code = 'offer/invalid-mode';
  throw invalid;
}

/**
 * Generates deterministic-prefix hex Offer ID (`off_{20hex}`).
 */
export function generateOfferId() {
  const hex =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').toLowerCase()
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 16)}${Math.random().toString(16).slice(2, 16)}`;
  return `off_${hex.slice(0, 20).padEnd(20, '0')}`;
}

export function formatOfferNumber(revisionNumber = 1) {
  const num = Math.max(1, Math.round(Number(revisionNumber) || 1));
  return `OFF-${String(num).padStart(2, '0')}`;
}

export function isOfferExpiredByTime(offer, now = new Date()) {
  if (!offer || !offer.offerExpiresAt) return false;
  const expiresMs = getTimestampMillis(offer.offerExpiresAt);
  if (!expiresMs) return false;
  const nowMs = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  return nowMs > expiresMs;
}

export function normalizeOfferRecord(offerId, raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const cleanOfferId = String(offerId || raw.offerId || raw.id || '').trim();
  if (!cleanOfferId) return null;

  const rev = Math.max(1, Number(raw.revisionNumber) || 1);
  const status = Object.values(OFFER_STATUSES).includes(raw.status)
    ? raw.status
    : OFFER_STATUSES.SENT;
  const offerMode =
    raw.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
      ? OFFER_MODES.DEPOSIT_HOLD_OFFER
      : OFFER_MODES.QUOTE_ONLY;

  const schedule = raw.scheduleSnapshot || {};
  const service = raw.serviceSnapshot || {};
  const financial = raw.financialSnapshot || {};
  const depositPolicy = raw.depositPolicySnapshot || {};
  const balanceDue = raw.balanceDuePolicy || {};

  return {
    id: cleanOfferId,
    schemaVersion: Number(raw.schemaVersion) || OFFER_SCHEMA_VERSION,
    offerId: cleanOfferId,
    offerNumber: String(raw.offerNumber || formatOfferNumber(rev)),
    revisionNumber: rev,
    requestId: String(raw.requestId || '').trim(),
    clientUid: String(raw.clientUid || '').trim(),
    customerId: String(raw.customerId || '').trim(),
    offerMode,
    provisionalBookingId: raw.provisionalBookingId ? String(raw.provisionalBookingId).trim() : null,
    scheduleSnapshot: {
      studioId: String(schedule.studioId || 'room-a').trim(),
      studioName: String(schedule.studioName || '').trim(),
      date: String(schedule.date || '').trim(),
      startMinute: Math.round(Number(schedule.startMinute) || 600),
      endMinute: Math.round(Number(schedule.endMinute) || 660),
      durationMinutes: Math.round(Number(schedule.durationMinutes) || 60),
      timeZone: String(schedule.timeZone || 'Asia/Jakarta'),
    },
    serviceSnapshot: {
      serviceTypeId: String(service.serviceTypeId || '').trim(),
      serviceTypeName: String(service.serviceTypeName || '').trim(),
      serviceOptionId: String(service.serviceOptionId || '').trim(),
      serviceOptionName: String(service.serviceOptionName || '').trim(),
      pricingMode: String(service.pricingMode || 'hourly').trim(),
      pricingSettingsVersion: Math.max(1, Number(service.pricingSettingsVersion) || 1),
    },
    financialSnapshot: {
      unitRate: Math.max(0, Math.round(Number(financial.unitRate) || 0)),
      subtotal: Math.max(0, Math.round(Number(financial.subtotal) || 0)),
      discountAmount: Math.max(0, Math.round(Number(financial.discountAmount) || 0)),
      automaticDiscount: financial.automaticDiscount ?? null,
      totalAmount: Math.max(0, Math.round(Number(financial.totalAmount) || 0)),
    },
    depositPolicySnapshot: {
      type: String(depositPolicy.type || 'none'),
      fixedAmount: Math.max(0, Math.round(Number(depositPolicy.fixedAmount) || 0)),
      percentage: Math.max(0, Math.round(Number(depositPolicy.percentage) || 0)),
      minimumDepositAmount: Math.max(0, Math.round(Number(depositPolicy.minimumDepositAmount) || 0)),
      calculationBase: String(depositPolicy.calculationBase || 'total_amount'),
      policySource: String(depositPolicy.policySource || 'default'),
      policyVersion: Math.max(0, Number(depositPolicy.policyVersion) || 0),
    },
    holdDeadline: raw.holdDeadline ?? null,
    balanceDuePolicy: {
      trigger: String(balanceDue.trigger || 'before_session'),
      dueDate: balanceDue.dueDate ? String(balanceDue.dueDate).trim() : null,
      offsetHoursBeforeStart: Math.max(0, Math.round(Number(balanceDue.offsetHoursBeforeStart) || 0)),
    },
    offerExpiresAt: raw.offerExpiresAt ?? null,
    staffNoteToClient: String(raw.staffNoteToClient || '').trim(),
    status,
    supersededByOfferId: raw.supersededByOfferId ? String(raw.supersededByOfferId).trim() : null,
    respondedAt: raw.respondedAt ?? null,
    respondedByUid: String(raw.respondedByUid || '').trim(),
    responseReason: String(raw.responseReason || '').trim(),
    withdrawalOrExpiryReason: String(raw.withdrawalOrExpiryReason || '').trim(),
    createdAt: raw.createdAt ?? null,
    createdByUid: String(raw.createdByUid || '').trim(),
    updatedAt: raw.updatedAt ?? null,
    updatedByUid: String(raw.updatedByUid || '').trim(),
    version: Math.max(1, Number(raw.version) || 1),
  };
}

/**
 * Builds the sanitized `activeOfferSummary` stored on parent `publicBookingRequests/{id}`.
 * Explicitly omits internal staff UIDs, commissions, or policy internals.
 */
export function buildActiveOfferSummary(offer) {
  if (!offer || typeof offer !== 'object') return null;
  return {
    offerId: String(offer.offerId || offer.id || ''),
    offerNumber: String(offer.offerNumber || formatOfferNumber(offer.revisionNumber || 1)),
    revisionNumber: Math.max(1, Number(offer.revisionNumber) || 1),
    mode:
      offer.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
        ? OFFER_MODES.DEPOSIT_HOLD_OFFER
        : OFFER_MODES.QUOTE_ONLY,
    provisionalBookingId: offer.provisionalBookingId
      ? String(offer.provisionalBookingId).trim()
      : null,
    totalAmount: Math.max(0, Math.round(Number(offer.financialSnapshot?.totalAmount) || 0)),
    minimumDepositAmount: Math.max(
      0,
      Math.round(Number(offer.depositPolicySnapshot?.minimumDepositAmount) || 0),
    ),
    holdExpiresAt: offer.holdDeadline ?? null,
    offerExpiresAt: offer.offerExpiresAt ?? null,
    status: String(offer.status || OFFER_STATUSES.SENT),
  };
}

/**
 * Customer-safe Offer projection stripping `createdByUid` and `updatedByUid`.
 */
export function projectClientOfferRecord(offer) {
  const norm = normalizeOfferRecord(offer?.offerId || offer?.id, offer);
  if (!norm) return null;
  return {
    id: norm.id,
    offerId: norm.offerId,
    offerNumber: norm.offerNumber,
    revisionNumber: norm.revisionNumber,
    requestId: norm.requestId,
    offerMode: norm.offerMode,
    provisionalBookingId: norm.provisionalBookingId,
    scheduleSnapshot: { ...norm.scheduleSnapshot },
    serviceSnapshot: {
      serviceTypeId: norm.serviceSnapshot.serviceTypeId,
      serviceTypeName: norm.serviceSnapshot.serviceTypeName,
      serviceOptionId: norm.serviceSnapshot.serviceOptionId,
      serviceOptionName: norm.serviceSnapshot.serviceOptionName,
      pricingMode: norm.serviceSnapshot.pricingMode,
    },
    financialSnapshot: { ...norm.financialSnapshot },
    depositPolicySnapshot: {
      type: norm.depositPolicySnapshot.type,
      fixedAmount: norm.depositPolicySnapshot.fixedAmount,
      percentage: norm.depositPolicySnapshot.percentage,
      minimumDepositAmount: norm.depositPolicySnapshot.minimumDepositAmount,
      calculationBase: norm.depositPolicySnapshot.calculationBase,
    },
    holdDeadline: norm.holdDeadline,
    balanceDuePolicy: { ...norm.balanceDuePolicy },
    offerExpiresAt: norm.offerExpiresAt,
    staffNoteToClient: norm.staffNoteToClient,
    status: norm.status,
    supersededByOfferId: norm.supersededByOfferId,
    respondedAt: norm.respondedAt,
    responseReason: norm.responseReason,
    withdrawalOrExpiryReason: norm.withdrawalOrExpiryReason,
    createdAt: norm.createdAt,
    updatedAt: norm.updatedAt,
    version: norm.version,
  };
}
