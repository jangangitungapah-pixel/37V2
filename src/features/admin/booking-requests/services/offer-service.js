/**
 * Offer Revisions Domain Service (Phase 2 — Quote Revisions, Client Accept/Reject, Staff Withdraw/Expire)
 * for 37 Music Studio (`publicBookingRequests/{requestId}/offers/{offerId}`).
 *
 * Strictly enforces:
 * - Read-before-write atomic Firestore transactions
 * - Monotonic revisionNumber (`OFF-01`, `OFF-02`, ...) & deterministic Offer/Activity IDs
 * - Atomic revision superseding (`OD-13`: sending v2 marks prior `sent` Offer as `superseded`)
 * - Immutable accepted Offer & policy snapshots (`AD-02`, `AD-06`)
 * - Owner-pending ADR guard on `deposit_hold_offer` invoice timing (`deposit_hold_offer` is blocked
 *   until Owner resolves Choice A vs Choice B; `quote_only` works end to end without Client writes to
 *   `bookings`, `bookingSlots`, `invoices`, or `clientReservations`).
 */

import { getStudioRoomById } from '@/features/admin/calendar/config/calendar-config';
import { calculateBookingPricingSnapshot } from '@/features/admin/calendar/utils/booking-pricing';
import { validateBookingWindow } from '@/features/admin/calendar/utils/booking-time';
import {
  getJakartaSlotEpochMs,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { DEFAULT_BOOKING_POLICIES } from '@/features/admin/settings/booking-policies/config/booking-policies-config';
import {
  buildDepositPolicySnapshot,
  resolveBalanceDuePolicySnapshot,
} from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
  PRICING_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';

import {
  BOOKING_REQUEST_ACTIVITY_TYPES,
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import {
  createBookingRequestRepositoryError,
  getBookingRequestRepositoryAdapter,
} from '../repositories/booking-request-repository';
import {
  assertOfferModeAuthorized,
  buildActiveOfferSummary,
  formatOfferNumber,
  generateOfferId,
  isOfferExpiredByTime,
  normalizeOfferRecord,
  OFFER_MODES,
  OFFER_SCHEMA_VERSION,
  OFFER_STATUSES,
  projectClientOfferRecord,
} from '../schemas/offer-schema';
import { generateActivityId } from './booking-request-service';

const TERMINAL_UNMODIFIABLE_REQUEST_STATUSES = new Set([
  BOOKING_REQUEST_STATUS.CONFIRMED,
  BOOKING_REQUEST_STATUS.DECLINED,
  BOOKING_REQUEST_STATUS.CLOSED,
]);

function hasExplicitVersion(value) {
  return value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value));
}

function assertOfferStaffActor(actorUid) {
  const clean = String(actorUid || '').trim();
  if (!clean) {
    throw createBookingRequestRepositoryError(
      'offer/unauthenticated',
      'Sesi staff tidak valid. Silakan login kembali.',
    );
  }
  return clean;
}

function buildOfferSnapshotsAndValidation({
  scheduleInput = {},
  serviceInput = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  bookingPolicies = DEFAULT_BOOKING_POLICIES,
  customDepositPolicy = null,
  manualCustomerPrice = 0,
  offerValidHours = 24,
  offerExpiresAt = null,
  staffNoteToClient = '',
  now = new Date(),
}) {
  const studioId = String(scheduleInput.studioId || '').trim();
  if (!['room-a', 'room-b'].includes(studioId)) {
    throw createBookingRequestRepositoryError(
      'offer/invalid-schedule',
      'Pilih ruangan studio konkret (Room A atau Room B) sebelum mengirim penawaran.',
    );
  }

  const bookingDate = String(scheduleInput.date || '').trim();
  if (!isValidIsoDateString(bookingDate)) {
    throw createBookingRequestRepositoryError(
      'offer/invalid-schedule',
      'Tanggal sesi penawaran harus berformat YYYY-MM-DD.',
    );
  }

  const startMinute = Number(scheduleInput.startMinute);
  const durationMinutes = Number(scheduleInput.durationMinutes);
  const windowValidation = validateBookingWindow({ startMinute, durationMinutes });
  if (!windowValidation.isValid) {
    throw createBookingRequestRepositoryError(
      windowValidation.code || 'offer/invalid-schedule',
      windowValidation.message,
    );
  }
  const endMinute = startMinute + durationMinutes;

  const pricingResult = calculateBookingPricingSnapshot({
    serviceTypeId: serviceInput.serviceTypeId,
    serviceOptionId: serviceInput.serviceOptionId,
    durationMinutes,
    manualCustomerPrice,
    pricingSettings,
  });

  if (pricingResult.deliveryMode !== DELIVERY_MODES.STUDIO) {
    throw createBookingRequestRepositoryError(
      'offer/wfa-not-allowed',
      'Layanan Mix & Master (WFA) tidak menggunakan penawaran slot ruangan studio.',
    );
  }
  if (
    !pricingResult.serviceTypeId ||
    !pricingResult.serviceOptionId ||
    !pricingResult.pricingMode ||
    pricingResult.pricingMode === PRICING_MODES.UNCONFIGURED
  ) {
    throw createBookingRequestRepositoryError(
      'offer/invalid-service',
      'Pilih layanan dan paket studio yang aktif dari Price & Fee Settings.',
    );
  }

  const depositPolicySnapshot = buildDepositPolicySnapshot({
    policies: bookingPolicies,
    serviceTypeId: pricingResult.serviceTypeId,
    serviceOptionId: pricingResult.serviceOptionId,
    customDepositPolicy,
    totalAmount: pricingResult.totalAmount,
    subtotal: pricingResult.subtotal,
  });

  const balanceDuePolicy = resolveBalanceDuePolicySnapshot({
    policies: bookingPolicies,
    serviceTypeId: pricingResult.serviceTypeId,
    serviceOptionId: pricingResult.serviceOptionId,
    bookingDate,
    startMinute,
  });

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  let offerExpiresDate;
  if (offerExpiresAt) {
    const ms =
      offerExpiresAt instanceof Date
        ? offerExpiresAt.getTime()
        : getTimestampMillis(offerExpiresAt) || Date.parse(String(offerExpiresAt));
    if (!Number.isFinite(ms) || ms <= nowMs) {
      throw createBookingRequestRepositoryError(
        'offer/invalid-expiry',
        'Masa berlaku penawaran (Offer valid until) harus berada di masa depan.',
      );
    }
    offerExpiresDate = new Date(ms);
  } else {
    const validHours = Number(offerValidHours);
    if (!Number.isFinite(validHours) || validHours < 1 || validHours > 336) {
      throw createBookingRequestRepositoryError(
        'offer/invalid-expiry',
        'Masa berlaku penawaran harus antara 1 hingga 336 jam.',
      );
    }
    const sessionStartMs = getJakartaSlotEpochMs(bookingDate, startMinute);
    const rawOfferExpMs = nowMs + validHours * 3_600_000;
    const clampedMs = Number.isFinite(sessionStartMs)
      ? Math.min(rawOfferExpMs, sessionStartMs)
      : rawOfferExpMs;
    if (clampedMs <= nowMs) {
      throw createBookingRequestRepositoryError(
        'offer/invalid-expiry',
        'Jadwal sesi sudah berlalu atau melewati batas berlaku penawaran.',
      );
    }
    offerExpiresDate = new Date(clampedMs);
  }

  const roomMeta = getStudioRoomById(studioId);
  return {
    scheduleSnapshot: {
      studioId,
      studioName: roomMeta.label,
      date: bookingDate,
      startMinute,
      endMinute,
      durationMinutes,
      timeZone: 'Asia/Jakarta',
    },
    serviceSnapshot: {
      serviceTypeId: pricingResult.serviceTypeId,
      serviceTypeName: pricingResult.serviceTypeName,
      serviceOptionId: pricingResult.serviceOptionId,
      serviceOptionName: pricingResult.serviceOptionName,
      pricingMode: pricingResult.pricingMode,
      pricingSettingsVersion: pricingResult.pricingSettingsVersion,
    },
    financialSnapshot: {
      unitRate: pricingResult.unitRate,
      subtotal: pricingResult.subtotal,
      discountAmount: pricingResult.discountAmount,
      automaticDiscount: pricingResult.automaticDiscount ?? null,
      totalAmount: pricingResult.totalAmount,
    },
    depositPolicySnapshot,
    balanceDuePolicy,
    offerExpiresAtDate: offerExpiresDate,
    staffNoteToClient: String(staffNoteToClient || '').trim().slice(0, 500),
  };
}

/**
 * Staff sends a commercial Offer (`quote_only`) revision on a `studio_booking` request.
 * When `previousOfferId` or an active `sent` Offer already exists on the request, atomically
 * marks that previous `sent` revision as `superseded` (`OD-13`).
 */
export async function createAndSendOffer({
  requestId,
  offerId = generateOfferId(),
  activityId = generateActivityId('act'),
  previousOfferId = '',
  expectedRequestVersion = null,
  expectedPreviousOfferVersion = null,
  offerMode = OFFER_MODES.QUOTE_ONLY,
  scheduleInput = {},
  serviceInput = {},
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  bookingPolicies = DEFAULT_BOOKING_POLICIES,
  customDepositPolicy = null,
  manualCustomerPrice = 0,
  offerValidHours = 24,
  offerExpiresAt = null,
  staffNoteToClient = '',
  actorUid,
  actorName = '',
  now = new Date(),
  adapter = getBookingRequestRepositoryAdapter(),
}) {
  const cleanActorUid = assertOfferStaffActor(actorUid);
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim() || generateOfferId();
  const cleanActivityId = String(activityId || '').trim() || generateActivityId('act');

  if (!cleanRequestId) {
    throw createBookingRequestRepositoryError('booking-request/not-found', 'ID request tidak valid.');
  }

  // Enforces Section 3 ADR: blocks `deposit_hold_offer` pending Owner timing choice (A vs B).
  const validatedMode = assertOfferModeAuthorized(offerMode);

  const built = buildOfferSnapshotsAndValidation({
    scheduleInput,
    serviceInput,
    pricingSettings,
    bookingPolicies,
    customDepositPolicy,
    manualCustomerPrice,
    offerValidHours,
    offerExpiresAt,
    staffNoteToClient,
    now,
  });

  // Pre-transaction read of existing offers if caller did not pass previousOfferId cleanly,
  // allowing deterministic revision numbers even after withdrawals/rejections.
  const preExistingOffers =
    typeof adapter.listOffersByRequestId === 'function'
      ? await adapter.listOffersByRequestId(cleanRequestId, { maxLimit: 50 })
      : [];

  return adapter.runOfferTransaction({
    requestId: cleanRequestId,
    txWork: async (tx) => {
      // 1. READS FIRST
      const [currentReq, existingTargetOffer] = await Promise.all([
        tx.getRequest(cleanRequestId),
        tx.getOffer(cleanOfferId, cleanRequestId),
      ]);

      const priorCandidateId =
        String(previousOfferId || '').trim() ||
        String(currentReq?.activeOfferId || '').trim();
      const priorActiveOffer =
        priorCandidateId && priorCandidateId !== cleanOfferId
          ? await tx.getOffer(priorCandidateId, cleanRequestId)
          : null;

      // Also check any still-sent offers discovered before transaction so zero duplicate active offers remain
      const otherSentIds = Array.from(
        new Set(
          preExistingOffers
            .filter((o) => o && o.id !== cleanOfferId && o.id !== priorCandidateId && o.status === OFFER_STATUSES.SENT)
            .map((o) => o.id),
        ),
      );
      const extraSentOffers = (
        await Promise.all(otherSentIds.map((id) => tx.getOffer(id, cleanRequestId)))
      ).filter(Boolean);

      // Idempotent retry on duplicate submission of the exact same Offer ID
      if (existingTargetOffer) {
        if (existingTargetOffer.createdByUid === cleanActorUid) {
          return {
            offer: normalizeOfferRecord(cleanOfferId, existingTargetOffer),
            request: currentReq,
            idempotentReplay: true,
          };
        }
        throw createBookingRequestRepositoryError(
          'offer/duplicate-id',
          'ID Offer sudah digunakan oleh operasi lain.',
        );
      }

      if (!currentReq) {
        throw createBookingRequestRepositoryError(
          'booking-request/not-found',
          'Booking request tidak ditemukan.',
        );
      }

      if (currentReq.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
        throw createBookingRequestRepositoryError(
          'offer/not-studio-request',
          'Offer jadwal studio hanya berlaku untuk permintaan studio_booking.',
        );
      }

      if (
        TERMINAL_UNMODIFIABLE_REQUEST_STATUSES.has(currentReq.status) ||
        currentReq.linkedBookingId
      ) {
        throw createBookingRequestRepositoryError(
          'offer/request-terminal',
          `Request berstatus "${currentReq.status}" tidak dapat menerima Offer baru.`,
        );
      }

      if (
        hasExplicitVersion(expectedRequestVersion) &&
        currentReq.version !== Number(expectedRequestVersion)
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-request',
          `Request baru saja berubah (v${currentReq.version}). Muat ulang detail sebelum mengirim Offer.`,
        );
      }

      if (
        priorActiveOffer &&
        priorActiveOffer.status === OFFER_STATUSES.ACCEPTED
      ) {
        throw createBookingRequestRepositoryError(
          'offer/already-accepted',
          'Offer sebelumnya sudah disetujui Client dan bersifat immutable. Perubahan pasca-persetujuan tidak melalui revisi Offer.',
        );
      }

      if (
        priorActiveOffer &&
        hasExplicitVersion(expectedPreviousOfferVersion) &&
        priorActiveOffer.version !== Number(expectedPreviousOfferVersion)
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Status Offer sebelumnya telah berubah di sesi lain (kemungkinan baru saja direspons Client). Muat ulang sebelum merevisi.',
        );
      }

      const maxExistingRevision = Math.max(
        0,
        priorActiveOffer?.revisionNumber || 0,
        currentReq.activeOfferSummary?.revisionNumber || 0,
        ...preExistingOffers.map((o) => Number(o?.revisionNumber) || 0),
        ...extraSentOffers.map((o) => Number(o?.revisionNumber) || 0),
      );
      const nextRevision = maxExistingRevision + 1;
      const offerNumber = formatOfferNumber(nextRevision);

      // 2. WRITES AFTER ALL READS
      const nowVal = tx.nowValue();
      const offerExpiresAtTs = tx.timestampFromDate
        ? tx.timestampFromDate(built.offerExpiresAtDate)
        : built.offerExpiresAtDate;

      const toSupersede = [priorActiveOffer, ...extraSentOffers].filter(
        (item) => item && item.status === OFFER_STATUSES.SENT,
      );

      for (const oldSent of toSupersede) {
        const oldRaw = oldSent._raw || oldSent;
        tx.updateOffer(
          oldSent.id,
          {
            ...oldRaw,
            status: OFFER_STATUSES.SUPERSEDED,
            supersededByOfferId: cleanOfferId,
            withdrawalOrExpiryReason: `Digantikan oleh revisi ${offerNumber}`,
            updatedAt: nowVal,
            updatedByUid: cleanActorUid,
            version: (Number(oldSent.version) || 1) + 1,
          },
          cleanRequestId,
        );
      }

      const offerDoc = {
        schemaVersion: OFFER_SCHEMA_VERSION,
        offerId: cleanOfferId,
        offerNumber,
        revisionNumber: nextRevision,
        requestId: cleanRequestId,
        clientUid: String(currentReq.clientUid || '').trim(),
        customerId: String(currentReq.customerId || '').trim(),
        offerMode: validatedMode,
        provisionalBookingId: null,
        scheduleSnapshot: built.scheduleSnapshot,
        serviceSnapshot: built.serviceSnapshot,
        financialSnapshot: built.financialSnapshot,
        depositPolicySnapshot: built.depositPolicySnapshot,
        holdDeadline: null,
        balanceDuePolicy: built.balanceDuePolicy,
        offerExpiresAt: offerExpiresAtTs,
        staffNoteToClient: built.staffNoteToClient,
        status: OFFER_STATUSES.SENT,
        supersededByOfferId: null,
        respondedAt: null,
        respondedByUid: '',
        responseReason: '',
        withdrawalOrExpiryReason: '',
        createdAt: nowVal,
        createdByUid: cleanActorUid,
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: 1,
      };

      tx.setOffer(cleanOfferId, offerDoc, cleanRequestId);

      const summary = buildActiveOfferSummary({
        ...offerDoc,
        offerExpiresAt: built.offerExpiresAtDate.toISOString(),
      });

      const rawReq = currentReq._raw || currentReq;
      const nextRequestUpdate = {
        ...rawReq,
        status: BOOKING_REQUEST_STATUS.OFFER_SENT,
        activeOfferId: cleanOfferId,
        activeOfferSummary: {
          ...summary,
          offerExpiresAt: offerExpiresAtTs,
        },
        assignedStaffUid: currentReq.assignedStaffUid || cleanActorUid,
        assignedStaffName: currentReq.assignedStaffName || actorName || '',
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: (Number(currentReq.version) || 1) + 1,
      };
      delete nextRequestUpdate.id;
      delete nextRequestUpdate._raw;
      tx.updateRequest(nextRequestUpdate, cleanRequestId);

      const isRevision = toSupersede.length > 0 || nextRevision > 1;
      tx.setActivity(
        cleanActivityId,
        {
          eventType: isRevision
            ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REVISED
            : BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_SENT,
          fromStatus: currentReq.status,
          toStatus: BOOKING_REQUEST_STATUS.OFFER_SENT,
          linkedBookingId: null,
          note: isRevision
            ? `${offerNumber} (${validatedMode}) dikirim menggantikan revisi sebelumnya.`
            : `${offerNumber} (${validatedMode}) dikirim kepada Client.`,
          actorUid: cleanActorUid,
          actorName: String(actorName || '').trim(),
          createdAt: nowVal,
        },
        cleanRequestId,
      );

      return {
        offer: normalizeOfferRecord(cleanOfferId, {
          ...offerDoc,
          offerExpiresAt: built.offerExpiresAtDate.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
        supersededCount: toSupersede.length,
        idempotentReplay: false,
      };
    },
  });
}

export async function reviseOffer(params) {
  return createAndSendOffer(params);
}

/**
 * Client Portal explicit acceptance of an active `sent`, non-superseded, unexpired Offer (`TX-01`).
 * Strictly touches ONLY `offers/{offerId}`, `publicBookingRequests/{requestId}`, and `activities/{actId}`.
 * Clients NEVER write canonical `bookings`, `bookingSlots`, `publicAvailability`, `invoices`, or `clientReservations`.
 */
export async function acceptClientOffer({
  requestId,
  offerId,
  expectedOfferVersion = null,
  expectedRequestVersion = null,
  clientUid,
  responseReason = '',
  activityId = generateActivityId('act'),
  now = new Date(),
  adapter = getBookingRequestRepositoryAdapter(),
}) {
  const cleanClientUid = String(clientUid || '').trim();
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  const cleanActivityId = String(activityId || '').trim() || generateActivityId('act');

  if (!cleanClientUid) {
    throw createBookingRequestRepositoryError(
      'permission-denied',
      'Silakan login ke Client Portal sebelum menerima penawaran.',
    );
  }
  if (!cleanRequestId || !cleanOfferId) {
    throw createBookingRequestRepositoryError('offer/not-found', 'Offer tidak ditemukan.');
  }

  return adapter.runOfferTransaction({
    requestId: cleanRequestId,
    txWork: async (tx) => {
      const [currentReq, currentOffer] = await Promise.all([
        tx.getRequest(cleanRequestId),
        tx.getOffer(cleanOfferId, cleanRequestId),
      ]);

      if (!currentReq || !currentOffer) {
        throw createBookingRequestRepositoryError('offer/not-found', 'Penawaran tidak ditemukan.');
      }

      if (
        currentReq.source !== BOOKING_REQUEST_SOURCES.CLIENT_PORTAL ||
        currentReq.clientUid !== cleanClientUid ||
        (currentOffer.clientUid && currentOffer.clientUid !== cleanClientUid)
      ) {
        throw createBookingRequestRepositoryError(
          'permission-denied',
          'Anda tidak memiliki akses ke penawaran ini.',
        );
      }

      // Idempotent retry when this exact client already accepted this exact revision
      if (
        currentOffer.status === OFFER_STATUSES.ACCEPTED &&
        currentOffer.respondedByUid === cleanClientUid
      ) {
        return {
          offer: projectClientOfferRecord(currentOffer),
          request: currentReq,
          idempotentReplay: true,
        };
      }

      // Enforces Section 3 ADR boundary even on pre-existing deposit_hold_offer records
      assertOfferModeAuthorized(currentOffer.offerMode);

      if (
        currentOffer.status === OFFER_STATUSES.SUPERSEDED ||
        Boolean(currentOffer.supersededByOfferId) ||
        currentReq.activeOfferId !== cleanOfferId
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Revisi penawaran ini sudah digantikan oleh penawaran terbaru. Tinjau revisi terbaru sebelum menyetujui.',
        );
      }

      if (currentOffer.status !== OFFER_STATUSES.SENT) {
        throw createBookingRequestRepositoryError(
          'offer/not-actionable',
          `Penawaran berstatus "${currentOffer.status}" tidak dapat disetujui lagi.`,
        );
      }

      if (isOfferExpiredByTime(currentOffer, now)) {
        throw createBookingRequestRepositoryError(
          'offer/expired',
          'Masa berlaku penawaran ini sudah habis. Hubungi studio untuk meminta penawaran baru.',
        );
      }

      if (
        (hasExplicitVersion(expectedOfferVersion) &&
          currentOffer.version !== Number(expectedOfferVersion)) ||
        (hasExplicitVersion(expectedRequestVersion) &&
          currentReq.version !== Number(expectedRequestVersion))
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Data penawaran baru saja diperbarui. Muat ulang halaman sebelum menyetujui.',
        );
      }

      // WRITES ONLY ON OFFERS, REQUESTS & CLIENT ACTIVITY
      const nowVal = tx.nowValue();
      const rawOffer = currentOffer._raw || currentOffer;
      const updatedOfferDoc = {
        ...rawOffer,
        status: OFFER_STATUSES.ACCEPTED,
        respondedAt: nowVal,
        respondedByUid: cleanClientUid,
        responseReason: String(responseReason || '').trim().slice(0, 300),
        updatedAt: nowVal,
        updatedByUid: cleanClientUid,
        version: (Number(currentOffer.version) || 1) + 1,
      };
      delete updatedOfferDoc.id;
      delete updatedOfferDoc._raw;
      tx.updateOffer(cleanOfferId, updatedOfferDoc, cleanRequestId);

      const rawReq = currentReq._raw || currentReq;
      const nextSummary = buildActiveOfferSummary({
        ...currentOffer,
        status: OFFER_STATUSES.ACCEPTED,
      });
      const updatedReqDoc = {
        ...rawReq,
        status: BOOKING_REQUEST_STATUS.ACCEPTED,
        activeOfferSummary: nextSummary,
        updatedAt: nowVal,
        updatedByUid: cleanClientUid,
        version: (Number(currentReq.version) || 1) + 1,
      };
      delete updatedReqDoc.id;
      delete updatedReqDoc._raw;
      tx.updateRequest(updatedReqDoc, cleanRequestId);

      tx.setActivity(
        cleanActivityId,
        {
          eventType: BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_ACCEPTED,
          fromStatus: currentReq.status,
          toStatus: BOOKING_REQUEST_STATUS.ACCEPTED,
          linkedBookingId: null,
          note: `${currentOffer.offerNumber} disetujui Client via Client Portal (menunggu konversi jadwal oleh Staff).`,
          actorUid: cleanClientUid,
          actorName: currentReq.customerName || 'Client',
          createdAt: nowVal,
        },
        cleanRequestId,
      );

      return {
        offer: projectClientOfferRecord({
          ...updatedOfferDoc,
          offerId: cleanOfferId,
          respondedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
        idempotentReplay: false,
      };
    },
  });
}

/**
 * Client Portal rejection of an active `sent` Offer revision.
 * Moves request back to `in_review` so Staff may either revise (v2) or decline/close cleanly.
 */
export async function rejectClientOffer({
  requestId,
  offerId,
  expectedOfferVersion = null,
  expectedRequestVersion = null,
  clientUid,
  responseReason = '',
  activityId = generateActivityId('act'),
  now = new Date(),
  adapter = getBookingRequestRepositoryAdapter(),
}) {
  const cleanClientUid = String(clientUid || '').trim();
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  const cleanActivityId = String(activityId || '').trim() || generateActivityId('act');

  if (!cleanClientUid) {
    throw createBookingRequestRepositoryError(
      'permission-denied',
      'Silakan login ke Client Portal sebelum menolak penawaran.',
    );
  }
  if (!cleanRequestId || !cleanOfferId) {
    throw createBookingRequestRepositoryError('offer/not-found', 'Penawaran tidak ditemukan.');
  }

  return adapter.runOfferTransaction({
    requestId: cleanRequestId,
    txWork: async (tx) => {
      const [currentReq, currentOffer] = await Promise.all([
        tx.getRequest(cleanRequestId),
        tx.getOffer(cleanOfferId, cleanRequestId),
      ]);

      if (!currentReq || !currentOffer) {
        throw createBookingRequestRepositoryError('offer/not-found', 'Penawaran tidak ditemukan.');
      }

      if (
        currentReq.source !== BOOKING_REQUEST_SOURCES.CLIENT_PORTAL ||
        currentReq.clientUid !== cleanClientUid ||
        (currentOffer.clientUid && currentOffer.clientUid !== cleanClientUid)
      ) {
        throw createBookingRequestRepositoryError(
          'permission-denied',
          'Anda tidak memiliki akses ke penawaran ini.',
        );
      }

      if (
        currentOffer.status === OFFER_STATUSES.REJECTED &&
        currentOffer.respondedByUid === cleanClientUid
      ) {
        return {
          offer: projectClientOfferRecord(currentOffer),
          request: currentReq,
          idempotentReplay: true,
        };
      }

      if (
        currentOffer.status === OFFER_STATUSES.SUPERSEDED ||
        Boolean(currentOffer.supersededByOfferId) ||
        currentReq.activeOfferId !== cleanOfferId
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Revisi penawaran ini sudah tidak aktif.',
        );
      }

      if (currentOffer.status !== OFFER_STATUSES.SENT) {
        throw createBookingRequestRepositoryError(
          'offer/not-actionable',
          `Penawaran berstatus "${currentOffer.status}" tidak dapat ditolak lagi.`,
        );
      }

      if (
        (hasExplicitVersion(expectedOfferVersion) &&
          currentOffer.version !== Number(expectedOfferVersion)) ||
        (hasExplicitVersion(expectedRequestVersion) &&
          currentReq.version !== Number(expectedRequestVersion))
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Data penawaran baru saja diperbarui. Muat ulang halaman sebelum melanjutkan.',
        );
      }

      const cleanReason = String(responseReason || '').trim().slice(0, 300);
      const nowVal = tx.nowValue();
      const rawOffer = currentOffer._raw || currentOffer;
      const updatedOfferDoc = {
        ...rawOffer,
        status: OFFER_STATUSES.REJECTED,
        respondedAt: nowVal,
        respondedByUid: cleanClientUid,
        responseReason: cleanReason,
        updatedAt: nowVal,
        updatedByUid: cleanClientUid,
        version: (Number(currentOffer.version) || 1) + 1,
      };
      delete updatedOfferDoc.id;
      delete updatedOfferDoc._raw;
      tx.updateOffer(cleanOfferId, updatedOfferDoc, cleanRequestId);

      const rawReq = currentReq._raw || currentReq;
      const nextSummary = buildActiveOfferSummary({
        ...currentOffer,
        status: OFFER_STATUSES.REJECTED,
      });
      const updatedReqDoc = {
        ...rawReq,
        status: BOOKING_REQUEST_STATUS.IN_REVIEW,
        activeOfferSummary: nextSummary,
        updatedAt: nowVal,
        updatedByUid: cleanClientUid,
        version: (Number(currentReq.version) || 1) + 1,
      };
      delete updatedReqDoc.id;
      delete updatedReqDoc._raw;
      tx.updateRequest(updatedReqDoc, cleanRequestId);

      tx.setActivity(
        cleanActivityId,
        {
          eventType: BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REJECTED,
          fromStatus: currentReq.status,
          toStatus: BOOKING_REQUEST_STATUS.IN_REVIEW,
          linkedBookingId: null,
          note: cleanReason
            ? `${currentOffer.offerNumber} ditolak Client: ${cleanReason}`
            : `${currentOffer.offerNumber} ditolak Client (dapat dibuatkan revisi baru oleh Staff).`,
          actorUid: cleanClientUid,
          actorName: currentReq.customerName || 'Client',
          createdAt: nowVal,
        },
        cleanRequestId,
      );

      return {
        offer: projectClientOfferRecord({
          ...updatedOfferDoc,
          offerId: cleanOfferId,
          respondedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
        idempotentReplay: false,
      };
    },
  });
}

/**
 * Staff explicit withdrawal OR manual expiry of an active `sent` Offer.
 */
async function staffCloseSentOffer({
  requestId,
  offerId,
  targetOfferStatus,
  closeRequest = false,
  expectedOfferVersion = null,
  expectedRequestVersion = null,
  reason,
  actorUid,
  actorName = '',
  activityId = generateActivityId('act'),
  adapter = getBookingRequestRepositoryAdapter(),
}) {
  const cleanActorUid = assertOfferStaffActor(actorUid);
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  const cleanReason = String(reason || '').trim();
  const cleanActivityId = String(activityId || '').trim() || generateActivityId('act');

  if (cleanReason.length < 3 || cleanReason.length > 300) {
    throw createBookingRequestRepositoryError(
      'offer/reason-required',
      'Alasan penarikan atau kedaluwarsa penawaran wajib diisi 3–300 karakter.',
    );
  }

  return adapter.runOfferTransaction({
    requestId: cleanRequestId,
    txWork: async (tx) => {
      const [currentReq, currentOffer] = await Promise.all([
        tx.getRequest(cleanRequestId),
        tx.getOffer(cleanOfferId, cleanRequestId),
      ]);

      if (!currentReq || !currentOffer) {
        throw createBookingRequestRepositoryError('offer/not-found', 'Offer tidak ditemukan.');
      }

      if (
        currentOffer.status === targetOfferStatus &&
        currentOffer.respondedByUid === cleanActorUid
      ) {
        return { offer: currentOffer, idempotentReplay: true };
      }

      if (currentOffer.status !== OFFER_STATUSES.SENT) {
        throw createBookingRequestRepositoryError(
          'offer/not-actionable',
          `Offer berstatus "${currentOffer.status}" tidak dapat diubah ke "${targetOfferStatus}".`,
        );
      }

      if (
        (hasExplicitVersion(expectedOfferVersion) &&
          currentOffer.version !== Number(expectedOfferVersion)) ||
        (hasExplicitVersion(expectedRequestVersion) &&
          currentReq.version !== Number(expectedRequestVersion))
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Data Offer atau Request telah berubah. Muat ulang sebelum melanjutkan.',
        );
      }

      const nowVal = tx.nowValue();
      const rawOffer = currentOffer._raw || currentOffer;
      const updatedOfferDoc = {
        ...rawOffer,
        status: targetOfferStatus,
        respondedAt: nowVal,
        respondedByUid: cleanActorUid,
        withdrawalOrExpiryReason: cleanReason,
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: (Number(currentOffer.version) || 1) + 1,
      };
      delete updatedOfferDoc.id;
      delete updatedOfferDoc._raw;
      tx.updateOffer(cleanOfferId, updatedOfferDoc, cleanRequestId);

      const nextReqStatus = closeRequest
        ? BOOKING_REQUEST_STATUS.CLOSED
        : BOOKING_REQUEST_STATUS.IN_REVIEW;
      const nextSummary = buildActiveOfferSummary({
        ...currentOffer,
        status: targetOfferStatus,
      });

      const rawReq = currentReq._raw || currentReq;
      const updatedReqDoc = {
        ...rawReq,
        status: nextReqStatus,
        ...(closeRequest ? { statusReason: cleanReason } : {}),
        activeOfferSummary: nextSummary,
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: (Number(currentReq.version) || 1) + 1,
      };
      delete updatedReqDoc.id;
      delete updatedReqDoc._raw;
      tx.updateRequest(updatedReqDoc, cleanRequestId);

      const isExpiry = targetOfferStatus === OFFER_STATUSES.EXPIRED;
      tx.setActivity(
        cleanActivityId,
        {
          eventType: isExpiry
            ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_EXPIRED
            : BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_WITHDRAWN,
          fromStatus: currentReq.status,
          toStatus: nextReqStatus,
          linkedBookingId: null,
          note: `${currentOffer.offerNumber} ditandai ${targetOfferStatus}: ${cleanReason}`,
          actorUid: cleanActorUid,
          actorName: String(actorName || '').trim(),
          createdAt: nowVal,
        },
        cleanRequestId,
      );

      return {
        offer: normalizeOfferRecord(cleanOfferId, updatedOfferDoc),
        idempotentReplay: false,
      };
    },
  });
}

export async function withdrawOffer(params) {
  return staffCloseSentOffer({
    ...params,
    targetOfferStatus: OFFER_STATUSES.WITHDRAWN,
    closeRequest: false,
  });
}

export async function expireOffer(params) {
  return staffCloseSentOffer({
    ...params,
    targetOfferStatus: OFFER_STATUSES.EXPIRED,
  });
}

/**
 * Staff recording verbal/WhatsApp Client decision on a non-Client-Portal studio request Offer.
 */
export async function staffRecordOfferResponse({
  requestId,
  offerId,
  decision = OFFER_STATUSES.ACCEPTED,
  expectedOfferVersion = null,
  expectedRequestVersion = null,
  reason = '',
  actorUid,
  actorName = '',
  activityId = generateActivityId('act'),
  now = new Date(),
  adapter = getBookingRequestRepositoryAdapter(),
}) {
  const cleanActorUid = assertOfferStaffActor(actorUid);
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  const cleanActivityId = String(activityId || '').trim() || generateActivityId('act');

  if (![OFFER_STATUSES.ACCEPTED, OFFER_STATUSES.REJECTED].includes(decision)) {
    throw createBookingRequestRepositoryError(
      'offer/invalid-decision',
      'Keputusan Offer oleh Staff harus accepted atau rejected.',
    );
  }

  return adapter.runOfferTransaction({
    requestId: cleanRequestId,
    txWork: async (tx) => {
      const [currentReq, currentOffer] = await Promise.all([
        tx.getRequest(cleanRequestId),
        tx.getOffer(cleanOfferId, cleanRequestId),
      ]);

      if (!currentReq || !currentOffer) {
        throw createBookingRequestRepositoryError('offer/not-found', 'Offer tidak ditemukan.');
      }

      if (
        currentOffer.status === decision &&
        currentOffer.respondedByUid === cleanActorUid
      ) {
        return { offer: currentOffer, idempotentReplay: true };
      }

      assertOfferModeAuthorized(currentOffer.offerMode);

      if (
        currentOffer.status === OFFER_STATUSES.SUPERSEDED ||
        Boolean(currentOffer.supersededByOfferId) ||
        currentReq.activeOfferId !== cleanOfferId
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Revisi Offer ini sudah digantikan oleh revisi lebih baru.',
        );
      }

      if (currentOffer.status !== OFFER_STATUSES.SENT) {
        throw createBookingRequestRepositoryError(
          'offer/not-actionable',
          `Offer berstatus "${currentOffer.status}" tidak dapat diproses.`,
        );
      }

      if (decision === OFFER_STATUSES.ACCEPTED && isOfferExpiredByTime(currentOffer, now)) {
        throw createBookingRequestRepositoryError(
          'offer/expired',
          'Masa berlaku Offer sudah melewati batas waktu.',
        );
      }

      if (
        (hasExplicitVersion(expectedOfferVersion) &&
          currentOffer.version !== Number(expectedOfferVersion)) ||
        (hasExplicitVersion(expectedRequestVersion) &&
          currentReq.version !== Number(expectedRequestVersion))
      ) {
        throw createBookingRequestRepositoryError(
          'offer/stale-offer',
          'Data Offer atau Request baru saja berubah.',
        );
      }

      const nowVal = tx.nowValue();
      const rawOffer = currentOffer._raw || currentOffer;
      const updatedOfferDoc = {
        ...rawOffer,
        status: decision,
        respondedAt: nowVal,
        respondedByUid: cleanActorUid,
        responseReason: String(reason || '').trim().slice(0, 300),
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: (Number(currentOffer.version) || 1) + 1,
      };
      delete updatedOfferDoc.id;
      delete updatedOfferDoc._raw;
      tx.updateOffer(cleanOfferId, updatedOfferDoc, cleanRequestId);

      const nextReqStatus =
        decision === OFFER_STATUSES.ACCEPTED
          ? BOOKING_REQUEST_STATUS.ACCEPTED
          : BOOKING_REQUEST_STATUS.IN_REVIEW;
      const rawReq = currentReq._raw || currentReq;
      const updatedReqDoc = {
        ...rawReq,
        status: nextReqStatus,
        activeOfferSummary: buildActiveOfferSummary({
          ...currentOffer,
          status: decision,
        }),
        updatedAt: nowVal,
        updatedByUid: cleanActorUid,
        version: (Number(currentReq.version) || 1) + 1,
      };
      delete updatedReqDoc.id;
      delete updatedReqDoc._raw;
      tx.updateRequest(updatedReqDoc, cleanRequestId);

      tx.setActivity(
        cleanActivityId,
        {
          eventType:
            decision === OFFER_STATUSES.ACCEPTED
              ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_ACCEPTED
              : BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REJECTED,
          fromStatus: currentReq.status,
          toStatus: nextReqStatus,
          linkedBookingId: null,
          note:
            decision === OFFER_STATUSES.ACCEPTED
              ? `${currentOffer.offerNumber} dicatat disetujui via koordinasi WhatsApp/Admin.`
              : `${currentOffer.offerNumber} dicatat ditolak via koordinasi WhatsApp/Admin.`,
          actorUid: cleanActorUid,
          actorName: String(actorName || '').trim(),
          createdAt: nowVal,
        },
        cleanRequestId,
      );

      return {
        offer: normalizeOfferRecord(cleanOfferId, updatedOfferDoc),
        idempotentReplay: false,
      };
    },
  });
}
