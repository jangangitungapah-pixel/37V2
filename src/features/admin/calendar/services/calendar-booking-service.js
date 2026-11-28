import {
  BOOKING_REQUEST_ACTIVITY_TYPES,
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  normalizeActivityEvent,
  normalizeBookingRequestRecord,
} from '@/features/admin/booking-requests/utils/booking-request-normalize';
import {
  normalizeCustomerRecord,
  normalizePhoneIndexRecord,
} from '@/features/admin/customer/schemas/customer-schema';
import {
  appendUniqueNameAlias,
  CUSTOMER_RESOLUTION_MODE,
  CUSTOMER_STATUS,
  IDENTITY_MATCH_STATUS,
  normalizeCustomerName,
  resolveCustomerIdentityCandidates,
} from '@/features/admin/customer/utils/customer-identity';
import {
  formatPhoneDisplay,
  getPhoneNumberHash,
} from '@/features/admin/customer/utils/phone-number';
import {
  buildInvoiceDocumentFromBooking,
  generateAdjustmentId,
  normalizeInvoiceAdjustmentRecord,
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';
import { applyInvoiceAdjustmentInTransaction } from '@/features/admin/payment/services/adjustment-service';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import {
  buildInitialPaymentId,
  buildInvoiceId,
} from '@/features/admin/payment/utils/invoice-number';
import {
  PAYMENT_SOURCE,
  INVOICE_STATUS,
  SUPPORTED_PAYMENT_METHODS,
  TRANSACTION_TYPE,
  computeStoredPaymentStatus,
} from '@/features/admin/payment/utils/invoice-status';
import {
  PAYMENT_EVIDENCE_SCHEMA_VERSION,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '@/features/payment-evidence/config/payment-evidence-config';
import {
  normalizePaymentEvidenceRecord,
  validatePaymentEvidenceAsset,
} from '@/features/payment-evidence/schemas/payment-evidence-schema';
import { generatePaymentEvidenceId } from '@/features/payment-evidence/utils/payment-evidence-utils';
import {
  assertOfferModeAuthorized,
  buildActiveOfferSummary,
  formatOfferNumber,
  normalizeOfferRecord,
  OFFER_MODES,
  OFFER_SCHEMA_VERSION,
  OFFER_STATUSES,
} from '@/features/admin/booking-requests/schemas/offer-schema';
import {
  DEFAULT_BOOKING_POLICIES,
} from '@/features/admin/settings/booking-policies/config/booking-policies-config';
import {
  normalizeBookingPolicies,
} from '@/features/admin/settings/booking-policies/utils/booking-policies-normalize';
import {
  buildDepositPolicySnapshot,
  computeDepositStatus,
  resolveBalanceDuePolicySnapshot,
  resolveEffectiveHoldDeadline,
} from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
} from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  buildPublicAvailabilityProjectionFromBooking,
  normalizePublicAvailabilityRecord,
} from '@/features/public-availability/utils/public-availability-calculation';

import {
  BOOKING_EVENT_TYPES,
  BOOKING_SESSION_STATUS,
  CALENDAR_BOOKINGS_QUERY_LIMIT,
  CANCELLATION_TYPES,
  CONFIRMATION_SOURCES,
  RESERVATION_STATUS,
  STUDIO_TIME_ZONE,
} from '../config/calendar-config';
import {
  generateOperationId,
  getBookingRepositoryAdapter,
  normalizeBookingEventRecord,
  normalizeBookingRecord,
} from '../repositories/calendar-booking-repository';
import { validateBookingFormPayload } from '../schemas/booking-schema';
import {
  buildBookingSlotRecords,
  formatMinuteOfDay,
  formatMinuteRange,
  isBookingNoShowEligible,
  normalizeBookingReservationStatus,
} from '../utils/booking-time';
import { getJakartaTodayIso } from '../utils/calendar-date';

/**
 * Builds the strict schema v2 customer-safe reservation projection for a canonical
 * CRM-owned booking. Client Portal UID ownership is optional when an explicit CRM
 * customerId exists (for example, an Admin-created walk-in).
 */
export function buildClientReservationProjection(booking, invoice = null, timestamp = null) {
  const bookingId = String(booking?.id || '').trim();
  const clientUid = String(booking?.clientUid || '').trim();
  const customerId = String(booking?.customerId || '').trim();
  if (!bookingId || (!clientUid && !customerId)) return null;

  const studioId = String(booking.studioId || '');
  const startMinute = Number(booking.startMinute);
  const durationMinutes = Number(booking.durationMinutes);
  const endMinute = Number(booking.endMinute);
  if (
    !['room-a', 'room-b'].includes(studioId) ||
    !Number.isInteger(startMinute) ||
    !Number.isInteger(durationMinutes) ||
    !Number.isInteger(endMinute) ||
    endMinute !== startMinute + durationMinutes
  ) return null;

  return {
    schemaVersion: 2,
    bookingId,
    bookingReference: String(
      booking.bookingReference || booking.bookingCode || bookingId.slice(0, 14).toUpperCase(),
    ),
    customerId: String(booking.customerId || ''),
    clientUid,
    sourceRequestId: String(booking.sourceRequestId || ''),
    acceptedOfferId: String(booking.acceptedOfferId || ''),
    invoiceId: `inv_${bookingId}`,
    studioId,
    studioName: String(
      booking.studioName ||
      (studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room'),
    ),
    serviceTypeName: String(booking.serviceTypeName || booking.serviceTypeId || booking.serviceLabel || ''),
    serviceOptionName: String(booking.serviceOptionName || booking.packageLabel || ''),
    date: String(booking.date || ''),
    startMinute,
    endMinute,
    durationMinutes,
    timeZone: String(booking.timeZone || STUDIO_TIME_ZONE),
    reservationStatus:
      booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED
        ? 'cancelled'
        : String(booking.reservationStatus || 'confirmed'),
    sessionStatus: String(booking.sessionStatus || BOOKING_SESSION_STATUS.UPCOMING),
    holdExpiresAt: booking.holdExpiresAt || null,
    effectiveTotalAmount: Math.max(
      0,
      Math.round(Number(invoice?.effectiveTotalAmount ?? invoice?.financialSnapshot?.totalAmount ?? invoice?.totalAmount ?? booking.totalAmount) || 0),
    ),
    minimumDepositAmount:
      Number.isInteger(invoice?.minimumDepositAmount)
        ? invoice.minimumDepositAmount
        : Number.isInteger(booking.minimumDepositAmount)
          ? booking.minimumDepositAmount
          : null,
    depositStatus:
      typeof invoice?.depositStatus === 'string'
        ? invoice.depositStatus
        : typeof booking.depositStatus === 'string'
          ? booking.depositStatus
          : null,
    paymentStatus: String(
      invoice?.paymentStatus ||
      computeStoredPaymentStatus(
        invoice?.effectiveTotalAmount ??
        invoice?.financialSnapshot?.totalAmount ??
        invoice?.totalAmount ??
        booking.totalAmount,
        invoice?.amountPaid ?? booking.initialPaidAmount,
      ),
    ),
    createdAt: booking.createdAt || timestamp || booking.updatedAt,
    updatedAt: timestamp || booking.updatedAt || booking.createdAt,
    version: Number(booking.version) || 1,
  };
}

export function createBookingServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Maps internal or Firestore errors into safe, clear Indonesian operational messages.
 */
export function mapBookingErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner atau Staff.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi jaringan tidak tersedia. Periksa koneksi internet Anda lalu coba kembali.';
  }

  if (code === 'booking/slot-conflict') {
    return (
      error.message ||
      'Slot jadwal yang dipilih sudah digunakan oleh booking lain pada ruangan dan waktu tersebut.'
    );
  }

  if (code === 'booking/stale-update') {
    return (
      error.message ||
      'Data booking telah diperbarui di sesi lain. Silakan tutup dan buka kembali detail booking.'
    );
  }

  if (code === 'booking/not-found') {
    return 'Data booking tidak ditemukan di database.';
  }

  if (code === 'booking/request-not-found') {
    return 'Data booking request sumber tidak ditemukan di inbox.';
  }

  if (code === 'booking/request-already-confirmed') {
    return 'Booking request ini sudah dikonfirmasi menjadi booking resmi sebelumnya dan tidak bisa dikonversi ganda.';
  }

  if (code === 'booking/request-ineligible' || code === 'booking/request-not-studio') {
    return (
      error.message ||
      'Booking request ini tidak memenuhi syarat untuk dikonversi menjadi booking ruangan Calendar.'
    );
  }

  if (
    (code.startsWith('booking/') || code.startsWith('hold/') || code.startsWith('offer/')) &&
    typeof error?.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return 'Gagal memproses transaksi booking. Silakan periksa kembali data jadwal dan coba lagi.';
}

/**
 * Validates that the caller is an authenticated active staff/owner before starting a transaction.
 */
function assertAuthenticatedStaffActor(actorUid) {
  const cleanUid = String(actorUid || '').trim();
  if (!cleanUid) {
    throw createBookingServiceError(
      'booking/missing-actor',
      'Sesi pengguna tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return cleanUid;
}

export function finalizeBookingRequestInTx(
  tx,
  {
    existingBookingRequest,
    existingOffer = null,
    bookingId,
    bookingDoc,
    acceptedOfferId = '',
    timestamp,
    actorUid,
    actorName = '',
    activityEventId = generateOperationId('reqact'),
    activityNote = '',
  },
) {
  if (!existingBookingRequest || typeof tx.updateBookingRequest !== 'function') {
    return false;
  }

  if (
    existingBookingRequest.linkedBookingId ||
    [
      BOOKING_REQUEST_STATUS.CONFIRMED,
      BOOKING_REQUEST_STATUS.DECLINED,
      BOOKING_REQUEST_STATUS.CLOSED,
    ].includes(existingBookingRequest.status)
  ) {
    return false;
  }

  const confirmedBookingSnapshot = {
    bookingId,
    bookingReference: bookingId.slice(0, 14).toUpperCase(),
    studioId: bookingDoc.studioId,
    studioName:
      bookingDoc.studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room',
    serviceTypeName: bookingDoc.serviceTypeName,
    serviceOptionName: bookingDoc.serviceOptionName || bookingDoc.serviceTypeName,
    date: bookingDoc.date,
    startMinute: bookingDoc.startMinute,
    endMinute: bookingDoc.endMinute,
    durationMinutes: bookingDoc.durationMinutes,
  };

  const effectiveAcceptedOfferId = String(
    acceptedOfferId ||
      existingBookingRequest.acceptedOfferId ||
      existingOffer?.offerId ||
      existingOffer?.id ||
      '',
  ).trim();

  let updatedOfferSummary = null;
  if (
    existingOffer &&
    existingOffer.status === OFFER_STATUSES.SENT &&
    existingOffer.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
  ) {
    const rawOffer = existingOffer._raw || existingOffer;
    if (typeof tx.updateBookingRequestOffer === 'function') {
      const nextOfferDoc = {
        ...rawOffer,
        status: OFFER_STATUSES.ACCEPTED,
        respondedAt: timestamp,
        respondedByUid: actorUid,
        responseReason: String(existingOffer.responseReason || '').trim(),
        updatedAt: timestamp,
        updatedByUid: actorUid,
        version: (Number(existingOffer.version) || 1) + 1,
      };
      delete nextOfferDoc.id;
      delete nextOfferDoc._raw;
      tx.updateBookingRequestOffer(existingBookingRequest.id, existingOffer.id, nextOfferDoc);
    }
    const baseSummary = buildActiveOfferSummary({
      ...existingOffer,
      status: OFFER_STATUSES.ACCEPTED,
    });
    if (baseSummary) {
      updatedOfferSummary = {
        ...baseSummary,
        holdExpiresAt: rawOffer.holdDeadline ?? existingOffer.holdDeadline ?? null,
        offerExpiresAt: rawOffer.offerExpiresAt ?? existingOffer.offerExpiresAt ?? null,
      };
    }
  }

  tx.updateBookingRequest(existingBookingRequest.id, {
    status: BOOKING_REQUEST_STATUS.CONFIRMED,
    linkedBookingId: bookingId,
    confirmedBookingSnapshot,
    acceptedOfferId: effectiveAcceptedOfferId,
    ...(updatedOfferSummary ? { activeOfferSummary: updatedOfferSummary } : {}),
    convertedAt: existingBookingRequest.convertedAt || timestamp,
    convertedByUid: existingBookingRequest.convertedByUid || actorUid,
    confirmedAt: timestamp,
    confirmedByUid: actorUid,
    assignedStaffUid: existingBookingRequest.assignedStaffUid || actorUid,
    updatedAt: timestamp,
    updatedByUid: actorUid,
    version: (Number(existingBookingRequest.version) || 1) + 1,
  });

  if (typeof tx.setBookingRequestActivity === 'function') {
    const reservationStatus = normalizeBookingReservationStatus(bookingDoc);
    tx.setBookingRequestActivity(existingBookingRequest.id, activityEventId, {
      eventType: BOOKING_REQUEST_ACTIVITY_TYPES.BOOKING_CONFIRMED,
      fromStatus: existingBookingRequest.status,
      toStatus: BOOKING_REQUEST_STATUS.CONFIRMED,
      linkedBookingId: bookingId,
      note:
        activityNote ||
        (reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD
          ? `Dikonversi menjadi Deposit Hold ${confirmedBookingSnapshot.bookingReference} (${bookingDoc.date} ${formatMinuteRange(bookingDoc.startMinute, bookingDoc.endMinute)})`
          : `Dikonfirmasi ke booking ${confirmedBookingSnapshot.bookingReference} (${bookingDoc.date} ${formatMinuteRange(bookingDoc.startMinute, bookingDoc.endMinute)})`),
      actorUid,
      actorName: String(actorName || '').trim(),
      createdAt: timestamp,
    });
  }

  return true;
}

/**
 * Shared atomic hold expiry writes reused by `expireReservationHold` and Option A Offer release.
 */
export function executeExpireHoldWritesInTx(
  tx,
  {
    bookingId,
    existingBooking,
    existingInvoice = null,
    existingRefundCase = null,
    ownedSlots = [],
    slotLocks = [],
    preTransactions = [],
    skippedSlotIds = null,
    reason,
    actorUid,
    timestamp,
    eventId = generateOperationId('evt'),
    refundId = '',
    note = '',
  },
) {
  const deterministicInvoiceId = `inv_${bookingId}`;
  const deterministicRefundId = String(refundId || '').trim() || `ref_${bookingId}_expired`;

  ownedSlots.forEach((slot, idx) => {
    if (skippedSlotIds && skippedSlotIds.has(slot.id)) {
      return;
    }
    const lock = slotLocks[idx];
    if (lock && lock.bookingId === bookingId) {
      tx.deleteSlot(slot.id);
    }
  });
  tx.deletePublicAvailability?.(bookingId);

  const nextVersion = (Number(existingBooking.version) || 1) + 1;
  const expirePatch = {
    reservationStatus: RESERVATION_STATUS.EXPIRED,
    sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
    expiredAt: timestamp,
    expiredByUid: actorUid,
    expiryReason: reason,
    cancelledAt: timestamp,
    cancelledByUid: actorUid,
    cancellationType: CANCELLATION_TYPES.HOLD_EXPIRED,
    cancellationReason: reason,
    updatedAt: timestamp,
    updatedByUid: actorUid,
    version: nextVersion,
  };

  const nextBookingState = { ...existingBooking, ...expirePatch };
  delete nextBookingState.id;

  tx.updateBooking(bookingId, expirePatch);

  let updatedInvoiceForProjection = existingInvoice;
  if (existingInvoice && existingInvoice.invoiceStatus === INVOICE_STATUS.ISSUED) {
    if (existingInvoice.amountPaid === 0 && typeof tx.updateInvoice === 'function') {
      const invVoidDoc = {
        ...existingInvoice,
        invoiceStatus: INVOICE_STATUS.VOID,
        voidReason: `Hold expired: ${reason}`.slice(0, 300),
        updatedAt: timestamp,
        updatedByUid: actorUid,
        version: (Number(existingInvoice.version) || 1) + 1,
      };
      delete invVoidDoc.id;
      tx.updateInvoice(deterministicInvoiceId, invVoidDoc);
      updatedInvoiceForProjection = normalizeInvoiceRecord(deterministicInvoiceId, invVoidDoc);
    } else if (
      existingInvoice.amountPaid > 0 &&
      !existingRefundCase &&
      typeof tx.setRefundCase === 'function'
    ) {
      const reversedIds = new Set(
        preTransactions
          .filter((t) => t.transactionType === 'reversal' && t.reversalOfTransactionId)
          .map((t) => t.reversalOfTransactionId),
      );
      const sourceTxIds = preTransactions
        .filter((t) => t.transactionType === 'payment' && !reversedIds.has(t.id))
        .slice(0, 20)
        .map((t) => t.id);

      tx.setRefundCase(deterministicRefundId, {
        schemaVersion: 1,
        refundId: deterministicRefundId,
        targetType: 'booking',
        bookingId,
        projectId: null,
        invoiceId: deterministicInvoiceId,
        customerId: String(existingInvoice.customerId || existingBooking.customerId || ''),
        clientUid: String(existingInvoice.clientUid || existingBooking.clientUid || ''),
        triggerCategory: 'hold_expired_partial_paid',
        sourcePaymentTransactionIds: sourceTxIds,
        maxRefundableAmount: existingInvoice.amountPaid,
        requestedAmount: existingInvoice.amountPaid,
        approvedAmount: null,
        forfeitedAmount: null,
        resolutionMethod: null,
        status: 'under_review',
        requestReason: `Deposit hold kedaluwarsa dengan dana terbayar: ${reason}`.slice(0, 400),
        decisionReason: '',
        creditRemainingAmount: 0,
        settlementInfo: null,
        reviewedByUid: '',
        reviewedAt: null,
        createdAt: timestamp,
        createdByUid: actorUid,
        updatedAt: timestamp,
        updatedByUid: actorUid,
        version: 1,
      });
    }
  }

  const projection = buildClientReservationProjection(
    { ...nextBookingState, id: bookingId },
    updatedInvoiceForProjection,
    timestamp,
  );
  if (projection) {
    tx.setClientReservation?.(bookingId, projection);
  }

  tx.setEvent(eventId, {
    bookingId,
    eventType: BOOKING_EVENT_TYPES.HOLD_EXPIRED,
    actorUid,
    createdAt: timestamp,
    previousValue: {
      reservationStatus: existingBooking.reservationStatus,
      sessionStatus: existingBooking.sessionStatus,
      holdExpiresAt: existingBooking.holdExpiresAt ?? null,
    },
    newValue: {
      reservationStatus: RESERVATION_STATUS.EXPIRED,
      sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      invoiceAction:
        existingInvoice?.amountPaid === 0
          ? 'invoice_voided'
          : existingInvoice?.amountPaid > 0
            ? 'refund_case_opened'
            : 'none',
    },
    note: note || `Hold diakhiri secara manual: ${reason}`,
  });

  return normalizeBookingRecord(bookingId, nextBookingState);
}

/**
 * Creates a new booking atomically using a Firestore transaction:
 * 1. Validates input & operating hours
 * 2. Reads booking document & event document for idempotency on retry
 * 3. Reads all required 30-minute `bookingSlots/{date__studioId__slotStartMinute}` documents
 * 4. Rejects if any slot is already locked by another booking
 * 5. Writes `bookings/{bookingId}`, all `bookingSlots/{slotId}`, and `bookingEvents/{eventId}`
 */
export async function createBooking({
  bookingId = generateOperationId('bkg'),
  eventId = generateOperationId('evt'),
  actorUid,
  formValues,
  customerResolution = null,
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  bookingPolicies = null,
  acceptedOfferId = '',
  holdMode = '', // '' (auto from policy/initial payment) | 'deposit_hold' | 'confirmed'
  holdOverrideHours = null,
  holdOverrideExpiresAt = null,
  holdOverrideReason = '',
  now = new Date(),
  bookingRequestId = '',
  requestActivityEventId = generateOperationId('reqact'),
  optionalInitialPaymentEvidence = null,
  initialEvidenceId = '',
  expectedCloudName = '',
  provisionalOfferConfig = null,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim() || generateOperationId('bkg');
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanBookingRequestId = String(bookingRequestId || '').trim();
  const cleanAcceptedOfferId = String(acceptedOfferId || '').trim();
  const cleanRequestActivityEventId =
    String(requestActivityEventId || '').trim() || generateOperationId('reqact');
  const isOfferIssueMode = Boolean(provisionalOfferConfig && cleanBookingRequestId);
  const cleanOfferTargetId = String(provisionalOfferConfig?.offerId || '').trim();

  const validation = validateBookingFormPayload(formValues, [], '', pricingSettings);
  if (!validation.isValid) {
    const firstErrorMessage =
      Object.values(validation.errors)[0] || 'Data form booking belum lengkap atau tidak valid.';
    throw createBookingServiceError(
      'booking/validation-error',
      firstErrorMessage,
      validation.errors,
    );
  }

  const payload = validation.payload;
  if (payload.deliveryMode !== DELIVERY_MODES.STUDIO) {
    throw createBookingServiceError(
      'booking/wfa-not-allowed',
      'Layanan WFA (Mixing / Mastering) tidak boleh membuat booking atau mengunci slot ruangan studio.',
    );
  }

  if (!payload.phoneNormalized) {
    throw createBookingServiceError(
      'booking/invalid-phone',
      'Nomor HP / WhatsApp tidak valid untuk pencatatan profil customer.',
    );
  }

  const requiredSlots = buildBookingSlotRecords({
    bookingId: cleanBookingId,
    date: payload.date,
    studioId: payload.studioId,
    startMinute: payload.startMinute,
    durationMinutes: payload.durationMinutes,
  });

  if (requiredSlots.length === 0) {
    throw createBookingServiceError(
      'booking/invalid-duration',
      'Rentang waktu booking tidak menghasilkan slot 30 menit yang valid.',
    );
  }

  const phoneHash = await getPhoneNumberHash(payload.phoneNormalized);
  // Pre-generate a stable Customer ID before starting the transaction so retries remain idempotent
  const preGeneratedCustomerId =
    String(customerResolution?.customerId || '').trim() || generateOperationId('cust');
  const deterministicInvoiceId = buildInvoiceId(cleanBookingId);
  const deterministicInitialPaymentId = buildInitialPaymentId(cleanBookingId);

  let validatedInitialEvidence = null;
  if (optionalInitialPaymentEvidence) {
    const assetCheck = validatePaymentEvidenceAsset(
      optionalInitialPaymentEvidence,
      expectedCloudName,
    );
    if (!assetCheck.isValid) {
      throw createBookingServiceError(
        'booking/invalid-payment-evidence',
        assetCheck.error || 'Lampiran bukti pembayaran awal tidak valid.',
      );
    }
    validatedInitialEvidence = assetCheck.data;
  }
  const cleanInitialEvidenceId = validatedInitialEvidence
    ? String(initialEvidenceId || '').trim() || generatePaymentEvidenceId('ev_init')
    : '';

  if (
    isOfferIssueMode &&
    Array.isArray(provisionalOfferConfig?.priorHoldBookingIds) &&
    provisionalOfferConfig.priorHoldBookingIds.length > 0 &&
    typeof adapter.listPendingPaymentEvidenceForInvoice === 'function'
  ) {
    const pendingLists = await Promise.all(
      provisionalOfferConfig.priorHoldBookingIds.map((priorId) =>
        adapter.listPendingPaymentEvidenceForInvoice(`inv_${priorId}`),
      ),
    );
    const totalPending = pendingLists.reduce((acc, list) => acc + (list?.length || 0), 0);
    if (totalPending > 0) {
      throw createBookingServiceError(
        'hold/pending-evidence-exists',
        'Offer sebelumnya masih memiliki bukti pembayaran DP berstatus "pending_review". Verifikasi atau tolak bukti pembayaran terlebih dahulu sebelum merevisi Offer.',
      );
    }
  }

  const requiredSlotIdSet = new Set(requiredSlots.map((slot) => slot.id));

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST (Booking, Event, PhoneIndex, Invoice, Initial Payment, Request, Offer, Policies, and Slots)
    const [
      existingBooking,
      existingEvent,
      existingPhoneIndex,
      existingInvoice,
      existingInitialPayment,
      existingBookingRequest,
      explicitAcceptedOffer,
      existingTargetOffer,
      remoteBookingPolicies,
      ...slotSnapshots
    ] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getPhoneIndex(phoneHash),
      tx.getInvoice(deterministicInvoiceId),
      tx.getPaymentTransaction(deterministicInitialPaymentId),
      cleanBookingRequestId && typeof tx.getBookingRequest === 'function'
        ? tx.getBookingRequest(cleanBookingRequestId)
        : Promise.resolve(null),
      cleanBookingRequestId &&
        cleanAcceptedOfferId &&
        typeof tx.getBookingRequestOffer === 'function'
        ? tx.getBookingRequestOffer(cleanBookingRequestId, cleanAcceptedOfferId)
        : Promise.resolve(null),
      isOfferIssueMode &&
      cleanOfferTargetId &&
      typeof tx.getBookingRequestOffer === 'function'
        ? tx.getBookingRequestOffer(cleanBookingRequestId, cleanOfferTargetId)
        : Promise.resolve(null),
      !bookingPolicies && typeof tx.getBookingPolicies === 'function'
        ? tx.getBookingPolicies()
        : Promise.resolve(null),
      ...requiredSlots.map((slot) => tx.getSlot(slot.id)),
    ]);

    const fallbackActiveOffer =
      cleanBookingRequestId &&
      !cleanAcceptedOfferId &&
      !isOfferIssueMode &&
      existingBookingRequest?.activeOfferId &&
      typeof tx.getBookingRequestOffer === 'function'
        ? await tx.getBookingRequestOffer(
          cleanBookingRequestId,
          existingBookingRequest.activeOfferId,
        )
        : null;

    const priorOfferIdsToInspect = isOfferIssueMode
      ? Array.from(
          new Set(
            [
              provisionalOfferConfig.previousOfferId,
              existingBookingRequest?.activeOfferId,
              ...(provisionalOfferConfig.otherSentOfferIds || []),
            ]
              .map((id) => String(id || '').trim())
              .filter((id) => id && id !== cleanOfferTargetId),
          ),
        )
      : [];

    const priorLoadedOffers =
      priorOfferIdsToInspect.length > 0 && typeof tx.getBookingRequestOffer === 'function'
        ? (
            await Promise.all(
              priorOfferIdsToInspect.map((id) =>
                tx.getBookingRequestOffer(cleanBookingRequestId, id),
              ),
            )
          ).filter(Boolean)
        : [];

    const priorSentOffers = priorLoadedOffers.filter(
      (item) => item && item.status === OFFER_STATUSES.SENT,
    );
    const priorSentWithHold = priorLoadedOffers.filter(
      (item) =>
        item &&
        (item.status === OFFER_STATUSES.SENT || item.status === OFFER_STATUSES.REJECTED) &&
        item.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER &&
        item.provisionalBookingId,
    );

    const priorHoldStates = await Promise.all(
      priorSentWithHold.map(async (sentOffer) => {
        const priorProvId = String(sentOffer.provisionalBookingId || '').trim();
        const priorInvId = `inv_${priorProvId}`;
        const [priorBooking, priorInvoice, priorLock] = await Promise.all([
          tx.getBooking(priorProvId),
          typeof tx.getInvoice === 'function' ? tx.getInvoice(priorInvId) : Promise.resolve(null),
          typeof tx.getPaymentEvidenceLock === 'function'
            ? tx.getPaymentEvidenceLock(priorInvId)
            : Promise.resolve(null),
        ]);
        const priorOwnedSlots = priorBooking
          ? buildBookingSlotRecords({
              bookingId: priorProvId,
              date: priorBooking.date,
              studioId: priorBooking.studioId,
              startMinute: priorBooking.startMinute,
              durationMinutes: priorBooking.durationMinutes,
            })
          : [];
        const priorSlotLocks =
          priorOwnedSlots.length > 0
            ? await Promise.all(priorOwnedSlots.map((s) => tx.getSlot(s.id)))
            : [];
        return {
          offer: sentOffer,
          priorProvId,
          priorBooking,
          priorInvoice,
          priorLock,
          priorOwnedSlots,
          priorSlotLocks,
        };
      }),
    );

    // Idempotent retry: if this exact Offer / Booking + Event already committed, return safely
    if (isOfferIssueMode && existingTargetOffer) {
      if (existingTargetOffer.createdByUid === cleanActorUid) {
        return {
          offer: normalizeOfferRecord(cleanOfferTargetId, existingTargetOffer),
          booking: existingBooking || null,
          invoice: existingInvoice || null,
          request: existingBookingRequest,
          supersededCount: 0,
          idempotentReplay: true,
        };
      }
      throw createBookingServiceError('offer/duplicate-id', 'ID Offer sudah digunakan oleh operasi lain.');
    }

    if (!isOfferIssueMode && existingBooking && existingEvent) {
      return existingBooking;
    }

    if (cleanAcceptedOfferId && !cleanBookingRequestId) {
      throw createBookingServiceError(
        'offer/not-found',
        'Offer harus terhubung dengan booking request sumber yang valid.',
      );
    }

    if (cleanBookingRequestId) {
      if (!existingBookingRequest) {
        throw createBookingServiceError(
          'booking/request-not-found',
          'Booking request sumber tidak ditemukan.',
        );
      }
      if (existingBookingRequest.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
        throw createBookingServiceError(
          'booking/request-not-studio',
          'Inquiry Mix & Master bersifat Post-Production dan tidak boleh dikonversi menjadi booking ruangan Calendar.',
        );
      }
      if (
        existingBookingRequest.status === BOOKING_REQUEST_STATUS.CONFIRMED ||
        existingBookingRequest.linkedBookingId
      ) {
        throw createBookingServiceError(
          'booking/request-already-confirmed',
          'Booking request ini sudah dikonfirmasi menjadi booking resmi sebelumnya.',
        );
      }
      if (
        existingBookingRequest.status === BOOKING_REQUEST_STATUS.DECLINED ||
        existingBookingRequest.status === BOOKING_REQUEST_STATUS.CLOSED
      ) {
        throw createBookingServiceError(
          'booking/request-ineligible',
          `Booking request berstatus "${existingBookingRequest.status}" sehingga tidak dapat dikonversi menjadi booking Calendar.`,
        );
      }
    }

    const priorActiveOffer = isOfferIssueMode
      ? priorLoadedOffers.find(
          (o) =>
            o &&
            o.id ===
              (String(provisionalOfferConfig.previousOfferId || '').trim() ||
                String(existingBookingRequest?.activeOfferId || '').trim()),
        ) || null
      : null;

    if (isOfferIssueMode) {
      if (
        provisionalOfferConfig.expectedRequestVersion !== null &&
        provisionalOfferConfig.expectedRequestVersion !== undefined &&
        provisionalOfferConfig.expectedRequestVersion !== '' &&
        Number.isInteger(Number(provisionalOfferConfig.expectedRequestVersion)) &&
        existingBookingRequest.version !== Number(provisionalOfferConfig.expectedRequestVersion)
      ) {
        throw createBookingServiceError(
          'offer/stale-request',
          `Request baru saja berubah (v${existingBookingRequest.version}). Muat ulang detail sebelum mengirim Offer.`,
        );
      }
      if (priorActiveOffer && priorActiveOffer.status === OFFER_STATUSES.ACCEPTED) {
        throw createBookingServiceError(
          'offer/already-accepted',
          'Offer sebelumnya sudah disetujui Client dan bersifat immutable. Perubahan pasca-persetujuan tidak melalui revisi Offer.',
        );
      }
      if (
        priorActiveOffer &&
        provisionalOfferConfig.expectedPreviousOfferVersion !== null &&
        provisionalOfferConfig.expectedPreviousOfferVersion !== undefined &&
        provisionalOfferConfig.expectedPreviousOfferVersion !== '' &&
        Number.isInteger(Number(provisionalOfferConfig.expectedPreviousOfferVersion)) &&
        priorActiveOffer.version !== Number(provisionalOfferConfig.expectedPreviousOfferVersion)
      ) {
        throw createBookingServiceError(
          'offer/stale-offer',
          'Status Offer sebelumnya telah berubah di sesi lain (kemungkinan baru saja direspons Client). Muat ulang sebelum merevisi.',
        );
      }

      for (const holdState of priorHoldStates) {
        const { priorBooking, priorInvoice, priorLock } = holdState;
        const lockCount = Number(priorLock?.pendingCount) || 0;
        const lockIds = priorLock?.pendingEvidenceIds || priorLock?.pendingIds || [];
        if (lockCount > 0 || lockIds.length > 0) {
          throw createBookingServiceError(
            'hold/pending-evidence-exists',
            'Offer sebelumnya masih memiliki bukti pembayaran DP yang menunggu verifikasi. Verifikasi atau tolak bukti sebelum merevisi Offer.',
          );
        }
        if (priorInvoice && priorInvoice.amountPaid > 0) {
          throw createBookingServiceError(
            'offer/provisional-hold-has-payment',
            'Offer sebelumnya memiliki Deposit Hold dengan pembayaran DP tercatat. Kelola penyelesaian atau refund hold dari Admin Calendar sebelum membuat penawaran baru.',
          );
        }
        if (priorBooking && priorBooking.reservationStatus === RESERVATION_STATUS.CONFIRMED) {
          throw createBookingServiceError(
            'hold/already-confirmed',
            'Deposit Hold provisional dari Offer sebelumnya sudah terkonfirmasi.',
          );
        }
      }
    }

    const resolvedOffer = isOfferIssueMode
      ? null
      : explicitAcceptedOffer ||
        (fallbackActiveOffer?.status === OFFER_STATUSES.ACCEPTED ? fallbackActiveOffer : null);

    if (!isOfferIssueMode && cleanAcceptedOfferId) {
      if (!explicitAcceptedOffer) {
        throw createBookingServiceError(
          'offer/not-found',
          'Offer revisi yang dipilih tidak ditemukan pada request ini.',
        );
      }
      assertOfferModeAuthorized(explicitAcceptedOffer.offerMode);
      if (explicitAcceptedOffer.status !== OFFER_STATUSES.ACCEPTED) {
        throw createBookingServiceError(
          'offer/not-accepted',
          `Offer berstatus "${explicitAcceptedOffer.status}" dan belum disetujui Client untuk dikonversi menjadi reservasi.`,
        );
      }
    } else if (!isOfferIssueMode && fallbackActiveOffer && fallbackActiveOffer.status === OFFER_STATUSES.SENT) {
      throw createBookingServiceError(
        'offer/pending-client-response',
        'Request masih memiliki penawaran aktif yang menunggu respons Client. Catat respons Client atau tarik penawaran sebelum membuat reservasi.',
      );
    }

    if (resolvedOffer) {
      assertOfferModeAuthorized(resolvedOffer.offerMode);
      if (
        resolvedOffer.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER &&
        resolvedOffer.provisionalBookingId
      ) {
        throw createBookingServiceError(
          'offer/provisional-booking-exists',
          `Offer Deposit Hold ini sudah memiliki booking provisional aktif (${resolvedOffer.provisionalBookingId}). Kelola konfirmasi atau perpanjangan langsung melalui Deposit Hold di Calendar.`,
        );
      }
      const sched = resolvedOffer.scheduleSnapshot || {};
      const svc = resolvedOffer.serviceSnapshot || {};
      const fin = resolvedOffer.financialSnapshot || {};
      const offerMatchesPayload =
        sched.studioId === payload.studioId &&
        sched.date === payload.date &&
        Number(sched.startMinute) === payload.startMinute &&
        Number(sched.endMinute) === payload.endMinute &&
        svc.serviceTypeId === payload.serviceTypeId &&
        svc.serviceOptionId === payload.serviceOptionId &&
        Number(fin.totalAmount) === payload.totalAmount;
      if (!offerMatchesPayload) {
        throw createBookingServiceError(
          'offer/payload-mismatch',
          'Jadwal, layanan, atau total harga reservasi harus sesuai dengan Offer yang telah disetujui Client.',
        );
      }
    }

    const isClientPortalOrigin = Boolean(
      existingBookingRequest?.source === BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
    );
    const requestedClientUid = String(existingBookingRequest?.clientUid || '').trim();
    if (isClientPortalOrigin && !requestedClientUid) {
      throw createBookingServiceError(
        'booking/client-identity-missing',
        'Request Client Portal tidak memiliki clientUid yang valid. Hubungkan identitas Client secara eksplisit sebelum mengonversi request.',
      );
    }

    if (existingBooking && existingBooking.createdByUid !== cleanActorUid) {
      throw createBookingServiceError(
        'booking/duplicate-id',
        'ID operasi booking sudah digunakan.',
      );
    }

    if (existingInvoice && existingInvoice.bookingId !== cleanBookingId) {
      throw createBookingServiceError(
        'booking/duplicate-invoice',
        'ID invoice untuk booking ini sudah digunakan oleh transaksi lain.',
      );
    }

    // Read all candidate customer profiles referenced by the phone index + explicit resolution target
    const candidateCustomerIds = isClientPortalOrigin
      ? []
      : Array.from(
        new Set([
          ...(existingPhoneIndex?.activeCustomerIds || []),
          ...(existingPhoneIndex?.historicalCustomerIds || []),
          ...(customerResolution?.customerId ? [customerResolution.customerId] : []),
        ]),
      );
    const loadedCandidates =
      candidateCustomerIds.length > 0
        ? await Promise.all(candidateCustomerIds.map((id) => tx.getCustomer(id)))
        : [];
    const profilesById = new Map(
      loadedCandidates.filter(Boolean).map((profile) => [profile.id, profile]),
    );

    const supersededPriorBookingIds = new Set(
      priorHoldStates
        .filter((h) => h.priorBooking?.reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD)
        .map((h) => h.priorProvId),
    );

    // Check slot locks BEFORE customer resolution errors so slot conflicts always rollback cleanly
    for (let i = 0; i < requiredSlots.length; i++) {
      const targetSlot = requiredSlots[i];
      const existingSlotLock = slotSnapshots[i];

      if (
        existingSlotLock &&
        existingSlotLock.bookingId !== cleanBookingId &&
        !supersededPriorBookingIds.has(existingSlotLock.bookingId)
      ) {
        const slotEnd = targetSlot.slotStartMinute + 30;
        throw createBookingServiceError(
          'booking/slot-conflict',
          `Jadwal bentrok pada slot ${formatMinuteOfDay(targetSlot.slotStartMinute)}–${formatMinuteOfDay(slotEnd)} WIB. Pilih jam atau ruangan lain.`,
          {
            slotId: targetSlot.id,
            slotStartMinute: targetSlot.slotStartMinute,
            conflictingBookingId: existingSlotLock.bookingId,
          },
        );
      }
    }

    // Resolve and validate customer identity against current transactional Phone Index state
    const currentIndexVersion = Number(existingPhoneIndex?.version) || 0;
    if (
      customerResolution &&
      Number.isInteger(Number(customerResolution.expectedPhoneIndexVersion)) &&
      currentIndexVersion !== Number(customerResolution.expectedPhoneIndexVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-customer-identity',
        'Data profil customer untuk nomor HP ini baru saja berubah. Muat ulang pilihan customer lalu coba simpan kembali.',
      );
    }

    const identityResolution = resolveCustomerIdentityCandidates({
      inputName: payload.customerName,
      phoneNormalized: payload.phoneNormalized,
      phoneIndex: existingPhoneIndex,
      profilesById,
    });

    let effectiveMode = customerResolution?.mode || '';
    let resolvedCustomerId = preGeneratedCustomerId;
    let targetExistingProfile = null;

    if (isClientPortalOrigin) {
      // Client Portal UID is authoritative. Do not resolve or auto-merge a CRM profile by phone/name.
      effectiveMode = 'client_portal_uid';
      resolvedCustomerId =
        String(existingBookingRequest.customerId || '').trim() || `client_${requestedClientUid}`;
    } else if (!effectiveMode) {
      if (
        identityResolution.status === IDENTITY_MATCH_STATUS.NO_MATCH ||
        identityResolution.status === IDENTITY_MATCH_STATUS.HISTORICAL_ONLY
      ) {
        effectiveMode = CUSTOMER_RESOLUTION_MODE.CREATE_NEW;
      } else if (
        identityResolution.status === IDENTITY_MATCH_STATUS.EXACT_MATCH &&
        identityResolution.matchedProfile
      ) {
        effectiveMode = CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING;
        resolvedCustomerId = identityResolution.matchedProfile.id;
        targetExistingProfile = identityResolution.matchedProfile;
      } else {
        throw createBookingServiceError(
          'booking/customer-identity-conflict',
          'Nomor telepon sudah digunakan oleh profil customer lain. Pilih gabungkan riwayat atau buat profil terpisah terlebih dahulu.',
          {
            status: identityResolution.status,
            activeProfiles: identityResolution.activeProfiles,
          },
        );
      }
    } else if (
      effectiveMode === CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING ||
      effectiveMode === CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING
    ) {
      const targetId = String(customerResolution?.customerId || '').trim();
      const targetProfile = profilesById.get(targetId) || null;
      if (!targetProfile || targetProfile.status !== CUSTOMER_STATUS.ACTIVE) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Profil customer yang dipilih tidak aktif atau sudah berubah. Silakan muat ulang pilihan customer.',
        );
      }
      if (targetProfile.phoneNormalized !== payload.phoneNormalized) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Nomor telepon pada profil customer yang dipilih sudah tidak cocok. Silakan periksa kembali nomor HP.',
        );
      }
      resolvedCustomerId = targetProfile.id;
      targetExistingProfile = targetProfile;
    } else if (effectiveMode === CUSTOMER_RESOLUTION_MODE.CREATE_NEW) {
      if (identityResolution.activeProfiles.length > 0) {
        throw createBookingServiceError(
          'booking/stale-customer-identity',
          'Nomor telepon baru saja terdaftar pada profil lain. Muat ulang pencarian customer untuk menentukan pilihan profil.',
        );
      }
    } else if (effectiveMode !== CUSTOMER_RESOLUTION_MODE.CREATE_SEPARATE) {
      throw createBookingServiceError(
        'booking/invalid-customer-resolution',
        'Mode resolusi identitas customer tidak valid.',
      );
    }

    // Policy, Deposit Confirmation Gate, Balance Due & Hold Deadline Evaluation (before any writes)
    const initialPaidInt = Math.max(0, Math.round(Number(payload.initialPaidAmount) || 0));
    if (isClientPortalOrigin && initialPaidInt > 0) {
      throw createBookingServiceError(
        'booking/client-evidence-required',
        'Booking dari Client Portal wajib melalui alur unggah dan verifikasi bukti pembayaran di Client Portal setelah invoice diterbitkan. Pilih status awal Belum Bayar.',
      );
    }

    const effectivePolicies = normalizeBookingPolicies(
      bookingPolicies || remoteBookingPolicies || DEFAULT_BOOKING_POLICIES,
    );
    const depositPolicySnapshot = resolvedOffer?.depositPolicySnapshot
      ? {
        ...resolvedOffer.depositPolicySnapshot,
      }
      : buildDepositPolicySnapshot({
          policies: effectivePolicies,
          serviceTypeId: payload.serviceTypeId,
          serviceOptionId: payload.serviceOptionId,
          customDepositPolicy: provisionalOfferConfig?.customDepositPolicy || null,
          totalAmount: payload.totalAmount,
          subtotal: payload.subtotal,
        });
    const balanceDuePolicy = resolvedOffer?.balanceDuePolicy
      ? {
        ...resolvedOffer.balanceDuePolicy,
      }
      : resolveBalanceDuePolicySnapshot({
        policies: effectivePolicies,
        serviceTypeId: payload.serviceTypeId,
        serviceOptionId: payload.serviceOptionId,
        bookingDate: payload.date,
        startMinute: payload.startMinute,
      });

    const minimumDepositAmount = Math.max(
      0,
      Math.round(Number(depositPolicySnapshot?.minimumDepositAmount) || 0),
    );
    const verifiedInitialPaid =
      isClientPortalOrigin || isOfferIssueMode ? 0 : initialPaidInt;
    const depositStatus = computeDepositStatus({
      depositType: depositPolicySnapshot.type,
      minimumDepositAmount,
      amountPaid: verifiedInitialPaid,
    });
    const isNoDepositPolicy =
      depositPolicySnapshot.type === 'none' || minimumDepositAmount <= 0;
    const isDepositMetAtCreation = !isNoDepositPolicy && verifiedInitialPaid >= minimumDepositAmount;
    const cleanHoldMode = isOfferIssueMode
      ? RESERVATION_STATUS.DEPOSIT_HOLD
      : String(holdMode || '').trim();
    const cleanHoldOverrideReason = String(holdOverrideReason || '').trim();

    if (isOfferIssueMode && isNoDepositPolicy) {
      throw createBookingServiceError(
        'offer/deposit-not-required',
        'Kebijakan layanan ini tidak mewajibkan Deposit (DP), sehingga tidak dapat menggunakan Deposit Hold Offer. Gunakan mode Quote Only agar permintaan langsung dikonfirmasi tanpa Deposit Hold.',
      );
    }

    if (cleanHoldMode === RESERVATION_STATUS.DEPOSIT_HOLD && isNoDepositPolicy) {
      throw createBookingServiceError(
        'hold/deposit-not-required',
        'Kebijakan layanan ini tidak mewajibkan Deposit (DP), sehingga reservasi langsung berstatus Confirmed tanpa Deposit Hold.',
      );
    }

    let reservationStatus;
    let sessionStatus;
    let confirmationSource;
    let resolvedHoldDeadline = null;

    if (isNoDepositPolicy) {
      reservationStatus = RESERVATION_STATUS.CONFIRMED;
      sessionStatus = BOOKING_SESSION_STATUS.UPCOMING;
      confirmationSource = CONFIRMATION_SOURCES.NO_DEPOSIT_POLICY;
    } else if (isDepositMetAtCreation) {
      reservationStatus = RESERVATION_STATUS.CONFIRMED;
      sessionStatus = BOOKING_SESSION_STATUS.UPCOMING;
      confirmationSource = CONFIRMATION_SOURCES.DEPOSIT_VERIFIED;
    } else if (cleanHoldMode === RESERVATION_STATUS.CONFIRMED) {
      if (cleanHoldOverrideReason.length < 5) {
        throw createBookingServiceError(
          'hold/override-reason-required',
          'Mengonfirmasi reservasi tanpa memenuhi minimum DP wajib menyertakan alasan override minimal 5 karakter.',
        );
      }
      reservationStatus = RESERVATION_STATUS.CONFIRMED;
      sessionStatus = BOOKING_SESSION_STATUS.UPCOMING;
      confirmationSource = CONFIRMATION_SOURCES.STAFF_OVERRIDE;
    } else {
      resolvedHoldDeadline = resolveEffectiveHoldDeadline({
        policies: effectivePolicies,
        serviceTypeId: payload.serviceTypeId,
        serviceOptionId: payload.serviceOptionId,
        bookingDate: payload.date,
        startMinute: payload.startMinute,
        baseDate: now instanceof Date ? now : new Date(now),
        overrideHoldHours: holdOverrideHours,
        overrideHoldExpiresAt: holdOverrideExpiresAt,
        overrideReason: cleanHoldOverrideReason,
      });
      reservationStatus = RESERVATION_STATUS.DEPOSIT_HOLD;
      sessionStatus = BOOKING_SESSION_STATUS.PENDING_CONFIRMATION;
      confirmationSource = '';
    }

    // 2. ALL WRITES AFTER ALL READS
    const timestamp = tx.nowValue();
    const holdExpiresAtVal = resolvedHoldDeadline
      ? typeof tx.timestampFromDate === 'function'
        ? tx.timestampFromDate(resolvedHoldDeadline.holdExpiresAtDate)
        : resolvedHoldDeadline.holdExpiresAtDate
      : null;

    if (!isClientPortalOrigin && targetExistingProfile) {
      const nextAliases =
        effectiveMode === CUSTOMER_RESOLUTION_MODE.MERGE_INTO_EXISTING
          ? appendUniqueNameAlias(
            targetExistingProfile.displayName,
            targetExistingProfile.nameAliases,
            payload.customerName,
          )
          : targetExistingProfile.nameAliases;

      const firstDate =
        [targetExistingProfile.firstBookingDate, payload.date].filter(Boolean).sort()[0] ||
        payload.date;
      const lastDates = [targetExistingProfile.lastBookingDate, payload.date]
        .filter(Boolean)
        .sort();
      const lastDate = lastDates[lastDates.length - 1] || payload.date;

      tx.updateCustomer(resolvedCustomerId, {
        displayName: targetExistingProfile.displayName,
        normalizedName:
          targetExistingProfile.normalizedName ||
          normalizeCustomerName(targetExistingProfile.displayName),
        phoneDisplay: targetExistingProfile.phoneDisplay,
        phoneNormalized: targetExistingProfile.phoneNormalized,
        nameAliases: nextAliases,
        previousPhones: targetExistingProfile.previousPhones,
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: Array.from(
          new Set([resolvedCustomerId, ...(targetExistingProfile.historyCustomerIds || [])]),
        ),
        bookingCount: (Number(targetExistingProfile.bookingCount) || 0) + 1,
        firstBookingDate: firstDate,
        lastBookingDate: lastDate,
        notes: targetExistingProfile.notes,
        createdAt: targetExistingProfile.createdAt,
        createdByUid: targetExistingProfile.createdByUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(targetExistingProfile.version) || 1) + 1,
        ...(targetExistingProfile.emailNormalized
          ? {
            email: targetExistingProfile.email || targetExistingProfile.emailNormalized,
            emailNormalized: targetExistingProfile.emailNormalized,
          }
          : {}),
      });

      // Ensure active index contains resolvedCustomerId
      if (!(existingPhoneIndex?.activeCustomerIds || []).includes(resolvedCustomerId)) {
        tx.setPhoneIndex(phoneHash, {
          phoneNormalized: payload.phoneNormalized,
          activeCustomerIds: Array.from(
            new Set([...(existingPhoneIndex?.activeCustomerIds || []), resolvedCustomerId]),
          ),
          historicalCustomerIds: (existingPhoneIndex?.historicalCustomerIds || []).filter(
            (id) => id !== resolvedCustomerId,
          ),
          version: currentIndexVersion + 1,
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
        });
      }
    } else if (!isClientPortalOrigin) {
      // Create or reuse a CRM Customer Profile only for Staff-created bookings.
      tx.setCustomer(resolvedCustomerId, {
        displayName: payload.customerName,
        normalizedName: normalizeCustomerName(payload.customerName),
        phoneDisplay: formatPhoneDisplay(payload.phoneNormalized),
        phoneNormalized: payload.phoneNormalized,
        nameAliases: [],
        previousPhones: [],
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: [resolvedCustomerId],
        bookingCount: 1,
        firstBookingDate: payload.date,
        lastBookingDate: payload.date,
        notes: '',
        createdAt: timestamp,
        createdByUid: cleanActorUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      });

      tx.setPhoneIndex(phoneHash, {
        phoneNormalized: payload.phoneNormalized,
        activeCustomerIds: Array.from(
          new Set([...(existingPhoneIndex?.activeCustomerIds || []), resolvedCustomerId]),
        ),
        historicalCustomerIds: (existingPhoneIndex?.historicalCustomerIds || []).filter(
          (id) => id !== resolvedCustomerId,
        ),
        version: currentIndexVersion + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    }

    const acceptedOfferIdValue =
      cleanOfferTargetId ||
      resolvedOffer?.offerId ||
      cleanAcceptedOfferId ||
      String(existingBookingRequest?.acceptedOfferId || '');

    const bookingDoc = {
      schemaVersion: 2,
      customerId: resolvedCustomerId,
      clientUid: isClientPortalOrigin ? requestedClientUid : '',
      source: isClientPortalOrigin ? 'client_portal' : 'staff_created',
      sourceRequestId: cleanBookingRequestId || '',
      acceptedOfferId: acceptedOfferIdValue,
      invoiceId: deterministicInvoiceId,
      customerName: payload.customerName,
      phone: payload.phone,
      phoneNormalized: payload.phoneNormalized,
      bandName: payload.bandName,
      studioId: payload.studioId,
      serviceTypeId: payload.serviceTypeId,
      serviceTypeName: payload.serviceTypeName,
      serviceOptionId: payload.serviceOptionId,
      serviceOptionName: payload.serviceOptionName,
      deliveryMode: payload.deliveryMode,
      pricingMode: payload.pricingMode,
      pricingSettingsVersion: payload.pricingSettingsVersion,
      serviceId: payload.serviceId,
      serviceLabel: payload.serviceLabel,
      packageId: payload.packageId,
      packageLabel: payload.packageLabel,
      recordingTypeId: payload.recordingTypeId,
      recordingTypeLabel: payload.recordingTypeLabel,
      date: payload.date,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
      endMinute: payload.endMinute,
      timeZone: STUDIO_TIME_ZONE,
      unitRate: payload.unitRate,
      subtotal: payload.subtotal,
      discountAmount: payload.discountAmount,
      totalAmount: payload.totalAmount,
      automaticDiscount: payload.automaticDiscount ?? null,
      commissionSnapshot: payload.commissionSnapshot,
      initialPaymentStatus: payload.initialPaymentStatus,
      initialPaidAmount: payload.initialPaidAmount,
      paymentMethod: payload.paymentMethod,
      reservationStatus,
      sessionStatus,
      depositPolicySnapshot,
      minimumDepositAmount,
      depositStatus,
      depositIntegrityAlert: false,
      balanceDuePolicy,
      holdExpiresAt: holdExpiresAtVal,
      holdExtensionCount: 0,
      holdLastExtendedAt: null,
      holdLastExtendedByUid: '',
      holdLastExtensionReason: '',
      expiredAt: null,
      expiredByUid: '',
      expiryReason: '',
      restoredAt: null,
      restoredByUid: '',
      restorationReason: '',
      confirmedAt: reservationStatus === RESERVATION_STATUS.CONFIRMED ? timestamp : null,
      confirmedByUid: reservationStatus === RESERVATION_STATUS.CONFIRMED ? cleanActorUid : '',
      confirmationSource,
      confirmationOverrideReason:
        confirmationSource === CONFIRMATION_SOURCES.STAFF_OVERRIDE ? cleanHoldOverrideReason : '',
      cancelledAt: null,
      cancelledByUid: '',
      cancellationType: '',
      cancellationReason: '',
      checkedInAt: null,
      checkedInByUid: '',
      actualStartedAt: null,
      actualCompletedAt: null,
      notes: payload.notes,
      createdAt: timestamp,
      createdByUid: cleanActorUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: 1,
    };

    tx.setBooking(cleanBookingId, bookingDoc);

    const publicProjection = buildPublicAvailabilityProjectionFromBooking(bookingDoc, timestamp);
    if (publicProjection) {
      tx.setPublicAvailability?.(cleanBookingId, publicProjection);
    }

    for (const slot of requiredSlots) {
      tx.setSlot(slot.id, {
        bookingId: cleanBookingId,
        date: slot.date,
        studioId: slot.studioId,
        slotStartMinute: slot.slotStartMinute,
        createdAt: timestamp,
      });
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType:
        reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD
          ? BOOKING_EVENT_TYPES.HOLD_CREATED
          : BOOKING_EVENT_TYPES.CREATED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: null,
      newValue: {
        date: payload.date,
        studioId: payload.studioId,
        startMinute: payload.startMinute,
        endMinute: payload.endMinute,
        durationMinutes: payload.durationMinutes,
        serviceLabel: payload.serviceLabel,
        reservationStatus,
        sessionStatus,
        depositStatus,
      },
      note:
        reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD
          ? `Deposit Hold dibuat untuk ${payload.customerName} (${formatMinuteRange(payload.startMinute, payload.endMinute)}), minimum DP Rp ${minimumDepositAmount.toLocaleString('id-ID')}`
          : `Booking dibuat untuk ${payload.customerName} (${formatMinuteRange(payload.startMinute, payload.endMinute)})`,
    });

    // 3. Automatic Invoice & Optional Initial Payment Transaction (Phase 8 + Phase 2 Policy Snapshots)
    const hasInitialPayment = !isClientPortalOrigin && initialPaidInt > 0;
    const { invoiceId, invoiceNumber, invoiceDoc } = buildInvoiceDocumentFromBooking({
      bookingId: cleanBookingId,
      booking: bookingDoc,
      customerId: resolvedCustomerId,
      actorUid: cleanActorUid,
      timestamp,
      invoiceDate: timestamp,
      dueDate:
        effectivePolicies.version >= 1 || resolvedOffer ? balanceDuePolicy?.dueDate || null : null,
      initialPaymentTransactionId: hasInitialPayment ? deterministicInitialPaymentId : null,
      initialPaidAmount: hasInitialPayment ? initialPaidInt : 0,
      clientPaymentEvidenceRequired: isClientPortalOrigin,
      depositPolicySnapshot,
      minimumDepositAmount,
      depositStatus,
      balanceDuePolicy,
    });
    const canonicalInvoiceDoc = isClientPortalOrigin
      ? { ...invoiceDoc, clientUid: requestedClientUid }
      : invoiceDoc;

    if (!existingInvoice) {
      tx.setInvoice(invoiceId, canonicalInvoiceDoc);
    }

    const clientReservationProjection = buildClientReservationProjection(
      { ...bookingDoc, id: cleanBookingId },
      canonicalInvoiceDoc,
      timestamp,
    );
    if (clientReservationProjection) {
      tx.setClientReservation?.(cleanBookingId, clientReservationProjection);
    }

    if (hasInitialPayment && !existingInitialPayment) {
      const normalizedPaymentMethod = SUPPORTED_PAYMENT_METHODS.includes(payload.paymentMethod)
        ? payload.paymentMethod
        : 'cash';

      tx.setPaymentTransaction(deterministicInitialPaymentId, {
        invoiceId,
        invoiceNumber,
        bookingId: cleanBookingId,
        customerId: resolvedCustomerId,
        transactionType: TRANSACTION_TYPE.PAYMENT,
        amount: initialPaidInt,
        currency: 'IDR',
        paymentMethod: normalizedPaymentMethod,
        receivedAt: timestamp,
        referenceNumber: '',
        notes:
          initialPaidInt >= canonicalInvoiceDoc.financialSnapshot.totalAmount
            ? 'Pembayaran lunas saat pembuatan booking'
            : 'Pembayaran DP awal saat pembuatan booking',
        source: PAYMENT_SOURCE.BOOKING_INITIAL_PAYMENT,
        reversalOfTransactionId: null,
        recordedByUid: cleanActorUid,
        createdAt: timestamp,
      });

      if (
        validatedInitialEvidence &&
        cleanInitialEvidenceId &&
        typeof tx.setPaymentEvidence === 'function'
      ) {
        tx.setPaymentEvidence(cleanInitialEvidenceId, {
          schemaVersion: PAYMENT_EVIDENCE_SCHEMA_VERSION,
          invoiceId,
          invoiceNumber,
          bookingId: cleanBookingId,
          customerId: resolvedCustomerId,
          clientUid: '',
          evidenceSource: PAYMENT_EVIDENCE_SOURCES.ADMIN_MANUAL,
          status: PAYMENT_EVIDENCE_STATUSES.ATTACHED,
          claimedAmount: initialPaidInt,
          paymentMethod: normalizedPaymentMethod,
          claimedPaidAt: getJakartaTodayIso(),
          referenceNumber: '',
          evidence: validatedInitialEvidence,
          submittedByUid: cleanActorUid,
          submittedAt: timestamp,
          reviewedAt: null,
          reviewedByUid: '',
          rejectionReason: '',
          verifiedAmount: initialPaidInt,
          linkedTransactionId: deterministicInitialPaymentId,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        });
      }
    }

    // 4. Atomic Offer + Provisional Hold OR Booking Request Confirmation (all writes after reads)
    if (isOfferIssueMode && existingBookingRequest) {
      const maxExistingRevision = Math.max(
        0,
        Number(provisionalOfferConfig.minNextRevisionHint) || 0,
        Number(existingBookingRequest.activeOfferSummary?.revisionNumber) || 0,
        ...priorLoadedOffers.map((o) => Number(o?.revisionNumber) || 0),
      );
      const nextRevision = maxExistingRevision + 1;
      const offerNumber = formatOfferNumber(nextRevision);

      const rawBaseNow = now instanceof Date ? now : new Date(now);
      const rawExpDate =
        provisionalOfferConfig.offerExpiresAtDate instanceof Date
          ? provisionalOfferConfig.offerExpiresAtDate
          : new Date(provisionalOfferConfig.offerExpiresAtDate);
      const effectiveOfferExpMs =
        !provisionalOfferConfig.hasExplicitOfferExpiresAt && resolvedHoldDeadline?.holdExpiresAtDate
          ? Math.min(rawExpDate.getTime(), resolvedHoldDeadline.holdExpiresAtDate.getTime())
          : rawExpDate.getTime();
      const effectiveOfferExpDate = new Date(
        Math.max(rawBaseNow.getTime() + 60_000, effectiveOfferExpMs),
      );
      const offerExpiresAtTs =
        typeof tx.timestampFromDate === 'function'
          ? tx.timestampFromDate(effectiveOfferExpDate)
          : effectiveOfferExpDate;

      const releasedPriorIds = new Set();
      for (const priorHold of priorHoldStates) {
        if (
          priorHold.priorBooking &&
          priorHold.priorBooking.reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD &&
          !releasedPriorIds.has(priorHold.priorProvId)
        ) {
          releasedPriorIds.add(priorHold.priorProvId);
          executeExpireHoldWritesInTx(tx, {
            bookingId: priorHold.priorProvId,
            existingBooking: priorHold.priorBooking,
            existingInvoice: priorHold.priorInvoice,
            ownedSlots: priorHold.priorOwnedSlots,
            slotLocks: priorHold.priorSlotLocks,
            skippedSlotIds: requiredSlotIdSet,
            reason: `Digantikan revisi ${offerNumber}`.slice(0, 300),
            actorUid: cleanActorUid,
            timestamp,
            eventId: `evt_sup_${priorHold.priorProvId}`,
            note: `Provisional hold ${priorHold.offer.offerNumber} dilepas karena digantikan ${offerNumber}.`,
          });
        }
      }

      for (const priorSent of priorSentOffers) {
        const oldRaw = priorSent._raw || priorSent;
        const supersededDoc = {
          ...oldRaw,
          status: OFFER_STATUSES.SUPERSEDED,
          supersededByOfferId: cleanOfferTargetId,
          withdrawalOrExpiryReason: `Digantikan oleh revisi ${offerNumber}`,
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
          version: (Number(priorSent.version) || 1) + 1,
        };
        delete supersededDoc.id;
        delete supersededDoc._raw;
        tx.updateBookingRequestOffer?.(cleanBookingRequestId, priorSent.id, supersededDoc);
      }

      const offerDoc = {
        schemaVersion: OFFER_SCHEMA_VERSION,
        offerId: cleanOfferTargetId,
        offerNumber,
        revisionNumber: nextRevision,
        requestId: cleanBookingRequestId,
        clientUid: isClientPortalOrigin ? requestedClientUid : '',
        customerId: resolvedCustomerId,
        offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
        provisionalBookingId: cleanBookingId,
        scheduleSnapshot: {
          studioId: bookingDoc.studioId,
          studioName:
            bookingDoc.studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room',
          date: bookingDoc.date,
          startMinute: bookingDoc.startMinute,
          endMinute: bookingDoc.endMinute,
          durationMinutes: bookingDoc.durationMinutes,
          timeZone: STUDIO_TIME_ZONE,
        },
        serviceSnapshot: {
          serviceTypeId: bookingDoc.serviceTypeId,
          serviceTypeName: bookingDoc.serviceTypeName,
          serviceOptionId: bookingDoc.serviceOptionId,
          serviceOptionName: bookingDoc.serviceOptionName,
          pricingMode: bookingDoc.pricingMode,
          pricingSettingsVersion: bookingDoc.pricingSettingsVersion,
        },
        financialSnapshot: {
          unitRate: bookingDoc.unitRate,
          subtotal: bookingDoc.subtotal,
          discountAmount: bookingDoc.discountAmount,
          automaticDiscount: bookingDoc.automaticDiscount ?? null,
          totalAmount: bookingDoc.totalAmount,
        },
        depositPolicySnapshot,
        holdDeadline: holdExpiresAtVal,
        balanceDuePolicy,
        offerExpiresAt: offerExpiresAtTs,
        staffNoteToClient: String(provisionalOfferConfig.staffNoteToClient || '').trim().slice(0, 500),
        status: OFFER_STATUSES.SENT,
        supersededByOfferId: null,
        respondedAt: null,
        respondedByUid: '',
        responseReason: '',
        withdrawalOrExpiryReason: '',
        createdAt: timestamp,
        createdByUid: cleanActorUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      };

      tx.setBookingRequestOffer?.(cleanBookingRequestId, cleanOfferTargetId, offerDoc);

      const summary = buildActiveOfferSummary({
        ...offerDoc,
        holdDeadline: resolvedHoldDeadline?.holdExpiresAtIso || null,
        offerExpiresAt: effectiveOfferExpDate.toISOString(),
      });

      tx.updateBookingRequest?.(cleanBookingRequestId, {
        status: BOOKING_REQUEST_STATUS.OFFER_SENT,
        activeOfferId: cleanOfferTargetId,
        activeOfferSummary: {
          ...summary,
          holdExpiresAt: holdExpiresAtVal,
          offerExpiresAt: offerExpiresAtTs,
        },
        assignedStaffUid: existingBookingRequest.assignedStaffUid || cleanActorUid,
        assignedStaffName:
          existingBookingRequest.assignedStaffName || String(provisionalOfferConfig.actorName || ''),
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingBookingRequest.version) || 1) + 1,
      });

      const isRevision = priorSentOffers.length > 0 || nextRevision > 1;
      tx.setBookingRequestActivity?.(cleanBookingRequestId, cleanRequestActivityEventId, {
        eventType: isRevision
          ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REVISED
          : BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_SENT,
        fromStatus: existingBookingRequest.status,
        toStatus: BOOKING_REQUEST_STATUS.OFFER_SENT,
        linkedBookingId: null,
        note: isRevision
          ? `${offerNumber} (deposit_hold_offer · ${cleanBookingId}) dikirim menggantikan revisi sebelumnya.`
          : `${offerNumber} (deposit_hold_offer · ${cleanBookingId}) dikirim dengan Deposit Hold & Invoice belum lunas.`,
        actorUid: cleanActorUid,
        actorName: String(provisionalOfferConfig.actorName || '').trim(),
        createdAt: timestamp,
      });

      return {
        offer: normalizeOfferRecord(cleanOfferTargetId, {
          ...offerDoc,
          holdDeadline: resolvedHoldDeadline?.holdExpiresAtIso || null,
          offerExpiresAt: effectiveOfferExpDate.toISOString(),
          createdAt: rawBaseNow.toISOString(),
          updatedAt: rawBaseNow.toISOString(),
        }),
        booking: normalizeBookingRecord(cleanBookingId, bookingDoc),
        invoice: normalizeInvoiceRecord(invoiceId, canonicalInvoiceDoc),
        supersededCount: priorSentOffers.length,
        idempotentReplay: false,
      };
    }

    if (
      cleanBookingRequestId &&
      existingBookingRequest &&
      typeof tx.updateBookingRequest === 'function'
    ) {
      finalizeBookingRequestInTx(tx, {
        existingBookingRequest,
        existingOffer: resolvedOffer,
        bookingId: cleanBookingId,
        bookingDoc,
        acceptedOfferId: acceptedOfferIdValue,
        timestamp,
        actorUid: cleanActorUid,
        activityEventId: cleanRequestActivityEventId,
      });
    }

    return normalizeBookingRecord(cleanBookingId, bookingDoc);
  });
}

/**
 * Releases any unpaid, unlocked provisional `deposit_hold` booking linked to a `deposit_hold_offer`
 * when withdrawing, expiring, staff-rejecting, or superseding it with a `quote_only` Offer revision.
 */
export async function closeOrSupersedeOfferWithProvisionalHold({
  mode = 'close', // 'close' | 'staff_reject' | 'supersede_with_quote'
  requestId,
  offerId,
  targetOfferStatus = OFFER_STATUSES.WITHDRAWN,
  closeRequest = false,
  expectedOfferVersion = null,
  expectedRequestVersion = null,
  reason = '',
  newQuoteOfferConfig = null,
  actorUid,
  actorName = '',
  activityId = generateOperationId('reqact'),
  now = new Date(),
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  const cleanReason = String(reason || '').trim();
  const cleanActivityId = String(activityId || '').trim() || generateOperationId('reqact');

  const candidateHoldCheckIds = Array.from(
    new Set(newQuoteOfferConfig?.priorHoldBookingIds || []),
  ).filter(Boolean);

  if (
    candidateHoldCheckIds.length > 0 &&
    typeof adapter.listPendingPaymentEvidenceForInvoice === 'function'
  ) {
    const pendingLists = await Promise.all(
      candidateHoldCheckIds.map((bId) => adapter.listPendingPaymentEvidenceForInvoice(`inv_${bId}`)),
    );
    if (pendingLists.some((l) => (l?.length || 0) > 0)) {
      throw createBookingServiceError(
        'hold/pending-evidence-exists',
        'Terdapat bukti pembayaran berstatus "pending_review" yang belum ditinjau pada Hold ini.',
      );
    }
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const currentReq = await tx.getBookingRequest?.(cleanRequestId);
    const targetOffer =
      mode === 'supersede_with_quote' && newQuoteOfferConfig?.offerId
        ? await tx.getBookingRequestOffer?.(cleanRequestId, newQuoteOfferConfig.offerId)
        : await tx.getBookingRequestOffer?.(cleanRequestId, cleanOfferId);

    if (mode === 'supersede_with_quote') {
      if (targetOffer) {
        if (targetOffer.createdByUid === cleanActorUid) {
          return {
            offer: normalizeOfferRecord(newQuoteOfferConfig.offerId, targetOffer),
            request: currentReq,
            supersededCount: 0,
            idempotentReplay: true,
          };
        }
        throw createBookingServiceError('offer/duplicate-id', 'ID Offer sudah digunakan oleh operasi lain.');
      }
      if (!currentReq) {
        throw createBookingServiceError('booking-request/not-found', 'Booking request tidak ditemukan.');
      }

      const candidatePriorIds = Array.from(
        new Set(
          [
            newQuoteOfferConfig.previousOfferId,
            currentReq.activeOfferId,
            ...(newQuoteOfferConfig.otherSentOfferIds || []),
          ]
            .map((id) => String(id || '').trim())
            .filter((id) => id && id !== newQuoteOfferConfig.offerId),
        ),
      );
      const priorOffers = (
        await Promise.all(
          candidatePriorIds.map((id) => tx.getBookingRequestOffer?.(cleanRequestId, id)),
        )
      ).filter(Boolean);

      const priorActive = priorOffers.find(
        (o) =>
          o.id ===
          (String(newQuoteOfferConfig.previousOfferId || '').trim() ||
            String(currentReq.activeOfferId || '').trim()),
      );
      if (
        newQuoteOfferConfig.expectedRequestVersion !== null &&
        newQuoteOfferConfig.expectedRequestVersion !== undefined &&
        newQuoteOfferConfig.expectedRequestVersion !== '' &&
        currentReq.version !== Number(newQuoteOfferConfig.expectedRequestVersion)
      ) {
        throw createBookingServiceError(
          'offer/stale-request',
          `Request baru saja berubah (v${currentReq.version}). Muat ulang detail sebelum mengirim Offer.`,
        );
      }
      if (priorActive?.status === OFFER_STATUSES.ACCEPTED) {
        throw createBookingServiceError(
          'offer/already-accepted',
          'Offer sebelumnya sudah disetujui Client dan bersifat immutable.',
        );
      }
      if (
        priorActive &&
        newQuoteOfferConfig.expectedPreviousOfferVersion !== null &&
        newQuoteOfferConfig.expectedPreviousOfferVersion !== undefined &&
        newQuoteOfferConfig.expectedPreviousOfferVersion !== '' &&
        priorActive.version !== Number(newQuoteOfferConfig.expectedPreviousOfferVersion)
      ) {
        throw createBookingServiceError(
          'offer/stale-offer',
          'Status Offer sebelumnya telah berubah. Muat ulang sebelum merevisi.',
        );
      }

      const sentOffers = priorOffers.filter((o) => o.status === OFFER_STATUSES.SENT);
      const holdEntries = await Promise.all(
        priorOffers
          .filter(
            (o) =>
              (o.status === OFFER_STATUSES.SENT || o.status === OFFER_STATUSES.REJECTED) &&
              o.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER &&
              o.provisionalBookingId,
          )
          .map(async (sentOffer) => {
            const bId = String(sentOffer.provisionalBookingId || '').trim();
            const invId = `inv_${bId}`;
            const [booking, invoice, lock] = await Promise.all([
              tx.getBooking(bId),
              tx.getInvoice?.(invId),
              tx.getPaymentEvidenceLock?.(invId),
            ]);
            const ownedSlots = booking
              ? buildBookingSlotRecords({
                  bookingId: bId,
                  date: booking.date,
                  studioId: booking.studioId,
                  startMinute: booking.startMinute,
                  durationMinutes: booking.durationMinutes,
                })
              : [];
            const slotLocks =
              ownedSlots.length > 0 ? await Promise.all(ownedSlots.map((s) => tx.getSlot(s.id))) : [];
            return { offer: sentOffer, bId, booking, invoice, lock, ownedSlots, slotLocks };
          }),
      );

      for (const h of holdEntries) {
        const lockCount = Number(h.lock?.pendingCount) || 0;
        const lockIds = h.lock?.pendingEvidenceIds || h.lock?.pendingIds || [];
        if (lockCount > 0 || lockIds.length > 0) {
          throw createBookingServiceError(
            'hold/pending-evidence-exists',
            'Offer sebelumnya memiliki bukti pembayaran DP pending_review. Verifikasi atau tolak bukti sebelum merevisi Offer.',
          );
        }
        if (h.invoice && h.invoice.amountPaid > 0) {
          throw createBookingServiceError(
            'offer/provisional-hold-has-payment',
            'Offer sebelumnya memiliki Deposit Hold dengan pembayaran DP tercatat.',
          );
        }
      }

      const timestamp = tx.nowValue();
      const maxRev = Math.max(
        0,
        Number(newQuoteOfferConfig.minNextRevisionHint) || 0,
        Number(currentReq.activeOfferSummary?.revisionNumber) || 0,
        ...priorOffers.map((o) => Number(o?.revisionNumber) || 0),
      );
      const nextRevision = maxRev + 1;
      const offerNumber = formatOfferNumber(nextRevision);

      const releasedQuotePriorIds = new Set();
      for (const h of holdEntries) {
        if (
          h.booking &&
          h.booking.reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD &&
          !releasedQuotePriorIds.has(h.bId)
        ) {
          releasedQuotePriorIds.add(h.bId);
          executeExpireHoldWritesInTx(tx, {
            bookingId: h.bId,
            existingBooking: h.booking,
            existingInvoice: h.invoice,
            ownedSlots: h.ownedSlots,
            slotLocks: h.slotLocks,
            reason: `Digantikan revisi ${offerNumber}`.slice(0, 300),
            actorUid: cleanActorUid,
            timestamp,
            eventId: `evt_sup_${h.bId}`,
          });
        }
      }

      for (const sentOffer of sentOffers) {
        const oldRaw = sentOffer._raw || sentOffer;
        const supDoc = {
          ...oldRaw,
          status: OFFER_STATUSES.SUPERSEDED,
          supersededByOfferId: newQuoteOfferConfig.offerId,
          withdrawalOrExpiryReason: `Digantikan oleh revisi ${offerNumber}`,
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
          version: (Number(sentOffer.version) || 1) + 1,
        };
        delete supDoc.id;
        delete supDoc._raw;
        tx.updateBookingRequestOffer?.(cleanRequestId, sentOffer.id, supDoc);
      }

      const offerExpDate = newQuoteOfferConfig.offerExpiresAtDate;
      const offerExpiresAtTs =
        typeof tx.timestampFromDate === 'function' ? tx.timestampFromDate(offerExpDate) : offerExpDate;
      const quoteOfferDoc = {
        schemaVersion: OFFER_SCHEMA_VERSION,
        offerId: newQuoteOfferConfig.offerId,
        offerNumber,
        revisionNumber: nextRevision,
        requestId: cleanRequestId,
        clientUid: String(currentReq.clientUid || '').trim(),
        customerId: String(currentReq.customerId || '').trim(),
        offerMode: OFFER_MODES.QUOTE_ONLY,
        provisionalBookingId: null,
        scheduleSnapshot: newQuoteOfferConfig.scheduleSnapshot,
        serviceSnapshot: newQuoteOfferConfig.serviceSnapshot,
        financialSnapshot: newQuoteOfferConfig.financialSnapshot,
        depositPolicySnapshot: newQuoteOfferConfig.depositPolicySnapshot,
        holdDeadline: null,
        balanceDuePolicy: newQuoteOfferConfig.balanceDuePolicy,
        offerExpiresAt: offerExpiresAtTs,
        staffNoteToClient: newQuoteOfferConfig.staffNoteToClient,
        status: OFFER_STATUSES.SENT,
        supersededByOfferId: null,
        respondedAt: null,
        respondedByUid: '',
        responseReason: '',
        withdrawalOrExpiryReason: '',
        createdAt: timestamp,
        createdByUid: cleanActorUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      };
      tx.setBookingRequestOffer?.(cleanRequestId, newQuoteOfferConfig.offerId, quoteOfferDoc);

      const summary = buildActiveOfferSummary({
        ...quoteOfferDoc,
        offerExpiresAt: offerExpDate.toISOString(),
      });
      tx.updateBookingRequest?.(cleanRequestId, {
        status: BOOKING_REQUEST_STATUS.OFFER_SENT,
        activeOfferId: newQuoteOfferConfig.offerId,
        activeOfferSummary: { ...summary, offerExpiresAt: offerExpiresAtTs },
        assignedStaffUid: currentReq.assignedStaffUid || cleanActorUid,
        assignedStaffName: currentReq.assignedStaffName || actorName || '',
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(currentReq.version) || 1) + 1,
      });

      tx.setBookingRequestActivity?.(cleanRequestId, cleanActivityId, {
        eventType: BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REVISED,
        fromStatus: currentReq.status,
        toStatus: BOOKING_REQUEST_STATUS.OFFER_SENT,
        linkedBookingId: null,
        note: `${offerNumber} (quote_only) dikirim menggantikan revisi Deposit Hold sebelumnya.`,
        actorUid: cleanActorUid,
        actorName: String(actorName || '').trim(),
        createdAt: timestamp,
      });

      return {
        offer: normalizeOfferRecord(newQuoteOfferConfig.offerId, {
          ...quoteOfferDoc,
          offerExpiresAt: offerExpDate.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
        supersededCount: sentOffers.length,
        idempotentReplay: false,
      };
    }

    // Close (withdraw / expire) or staff_reject of an active `sent` `deposit_hold_offer`
    if (!currentReq || !targetOffer) {
      throw createBookingServiceError('offer/not-found', 'Offer tidak ditemukan.');
    }
    if (targetOffer.status === targetOfferStatus && targetOffer.respondedByUid === cleanActorUid) {
      return { offer: targetOffer, idempotentReplay: true };
    }
    if (targetOffer.status !== OFFER_STATUSES.SENT) {
      throw createBookingServiceError(
        'offer/not-actionable',
        `Offer berstatus "${targetOffer.status}" tidak dapat diubah ke "${targetOfferStatus}".`,
      );
    }
    if (
      (expectedOfferVersion !== null &&
        expectedOfferVersion !== undefined &&
        expectedOfferVersion !== '' &&
        targetOffer.version !== Number(expectedOfferVersion)) ||
      (expectedRequestVersion !== null &&
        expectedRequestVersion !== undefined &&
        expectedRequestVersion !== '' &&
        currentReq.version !== Number(expectedRequestVersion))
    ) {
      throw createBookingServiceError(
        'offer/stale-offer',
        'Data Offer atau Request telah berubah. Muat ulang sebelum melanjutkan.',
      );
    }

    const provBookingId = String(targetOffer.provisionalBookingId || '').trim();
    const provInvId = provBookingId ? `inv_${provBookingId}` : '';
    const [provBooking, provInvoice, provLock] = provBookingId
      ? await Promise.all([
          tx.getBooking(provBookingId),
          tx.getInvoice?.(provInvId),
          tx.getPaymentEvidenceLock?.(provInvId),
        ])
      : [null, null, null];
    const ownedSlots = provBooking
      ? buildBookingSlotRecords({
          bookingId: provBookingId,
          date: provBooking.date,
          studioId: provBooking.studioId,
          startMinute: provBooking.startMinute,
          durationMinutes: provBooking.durationMinutes,
        })
      : [];
    const slotLocks =
      ownedSlots.length > 0 ? await Promise.all(ownedSlots.map((s) => tx.getSlot(s.id))) : [];

    const lockCount = Number(provLock?.pendingCount) || 0;
    const lockIds = provLock?.pendingEvidenceIds || provLock?.pendingIds || [];
    if (lockCount > 0 || lockIds.length > 0) {
      throw createBookingServiceError(
        'hold/pending-evidence-exists',
        'Deposit Hold pada Offer ini memiliki bukti pembayaran pending_review. Tinjau bukti tersebut terlebih dahulu.',
      );
    }
    if (provInvoice && provInvoice.amountPaid > 0) {
      throw createBookingServiceError(
        'offer/provisional-hold-has-payment',
        'Deposit Hold pada Offer ini sudah menerima pembayaran DP. Kelola pengakhiran & refund melalui Calendar Hold Ledger.',
      );
    }

    const timestamp = tx.nowValue();
    if (provBooking && provBooking.reservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD) {
      executeExpireHoldWritesInTx(tx, {
        bookingId: provBookingId,
        existingBooking: provBooking,
        existingInvoice: provInvoice,
        ownedSlots,
        slotLocks,
        reason: (cleanReason || `Offer ${targetOffer.offerNumber} ${targetOfferStatus}`).slice(0, 300),
        actorUid: cleanActorUid,
        timestamp,
        eventId: `evt_rel_${provBookingId}`,
      });
    }

    const rawOffer = targetOffer._raw || targetOffer;
    const isReject = mode === 'staff_reject' || targetOfferStatus === OFFER_STATUSES.REJECTED;
    const updatedOfferDoc = {
      ...rawOffer,
      status: targetOfferStatus,
      respondedAt: timestamp,
      respondedByUid: cleanActorUid,
      ...(isReject
        ? { responseReason: cleanReason.slice(0, 300) }
        : { withdrawalOrExpiryReason: cleanReason }),
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(targetOffer.version) || 1) + 1,
    };
    delete updatedOfferDoc.id;
    delete updatedOfferDoc._raw;
    tx.updateBookingRequestOffer?.(cleanRequestId, cleanOfferId, updatedOfferDoc);

    const nextReqStatus = closeRequest
      ? BOOKING_REQUEST_STATUS.CLOSED
      : BOOKING_REQUEST_STATUS.IN_REVIEW;
    const baseSummary = buildActiveOfferSummary({
      ...targetOffer,
      status: targetOfferStatus,
    });
    tx.updateBookingRequest?.(cleanRequestId, {
      status: nextReqStatus,
      ...(closeRequest ? { statusReason: cleanReason } : {}),
      activeOfferSummary: {
        ...baseSummary,
        holdExpiresAt: rawOffer.holdDeadline ?? targetOffer.holdDeadline ?? null,
        offerExpiresAt: rawOffer.offerExpiresAt ?? targetOffer.offerExpiresAt ?? null,
      },
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(currentReq.version) || 1) + 1,
    });

    const activityType = isReject
      ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_REJECTED
      : targetOfferStatus === OFFER_STATUSES.EXPIRED
        ? BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_EXPIRED
        : BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_WITHDRAWN;

    tx.setBookingRequestActivity?.(cleanRequestId, cleanActivityId, {
      eventType: activityType,
      fromStatus: currentReq.status,
      toStatus: nextReqStatus,
      linkedBookingId: null,
      note: provBooking
        ? `${targetOffer.offerNumber} ditandai ${targetOfferStatus} & Deposit Hold ${provBookingId} dilepaskan: ${cleanReason}`.slice(0, 500)
        : `${targetOffer.offerNumber} ditandai ${targetOfferStatus}: ${cleanReason}`.slice(0, 500),
      actorUid: cleanActorUid,
      actorName: String(actorName || '').trim(),
      createdAt: timestamp,
    });

    return {
      offer: normalizeOfferRecord(cleanOfferId, updatedOfferDoc),
      idempotentReplay: false,
    };
  });
}

export const createReservation = createBooking;

export async function createReservationFromOffer({
  requestId,
  offerId,
  ...rest
}) {
  const cleanRequestId = String(requestId || '').trim();
  const cleanOfferId = String(offerId || '').trim();
  if (!cleanRequestId || !cleanOfferId) {
    throw createBookingServiceError(
      'offer/not-found',
      'Request ID dan Accepted Offer ID wajib disertakan untuk membuat reservasi dari Offer.',
    );
  }
  return createBooking({
    ...rest,
    bookingRequestId: cleanRequestId,
    acceptedOfferId: cleanOfferId,
  });
}

/**
 * Updates or reschedules an existing booking atomically:
 * - Reads existing booking and verifies `expectedVersion` (prevents stale overwrites)
 * - Reads all old slot locks and all target slot locks before writing
 * - Verifies target slots are not locked by another booking
 * - Releases old slot locks no longer used and creates new slot locks
 * - Preserves the immutable initial payment snapshot (`initialPaymentStatus`, `initialPaidAmount`, `paymentMethod`)
 * - Records `booking_rescheduled` (if schedule changed) or `booking_edited` in `bookingEvents`
 */
export async function updateOrRescheduleBooking({
  bookingId,
  expectedVersion,
  eventId = generateOperationId('evt'),
  adjustmentId = generateAdjustmentId(),
  actorUid,
  formValues,
  mode = 'edit',
  pricingSettings = DEFAULT_PRICING_SETTINGS,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanAdjustmentId = String(adjustmentId || '').trim() || generateAdjustmentId();

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking wajib disertakan.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READ EXISTING BOOKING & EVENT FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);
    const existingInvoice = existingBooking
      ? await tx.getInvoice?.(`inv_${cleanBookingId}`)
      : null;

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    // Idempotent retry check
    if (existingEvent) {
      return existingBooking;
    }

    if (
      normalizeBookingReservationStatus(existingBooking) === RESERVATION_STATUS.EXPIRED ||
      existingBooking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
      existingBooking.sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
    ) {
      throw createBookingServiceError(
        'booking/cancelled-immutable',
        'Booking yang sudah kedaluwarsa (Expired), dibatalkan, atau No Show tidak dapat diubah jadwalnya.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah sejak form dibuka. Muat ulang detail booking sebelum menyimpan.',
      );
    }

    // Validate form values while preserving the existing initial payment snapshot
    const mergedFormValues = {
      ...formValues,
      initialPaymentStatus: existingBooking.initialPaymentStatus,
      dpAmount: existingBooking.initialPaidAmount,
      paymentMethod: existingBooking.paymentMethod || 'cash',
    };

    const historicalOptionId =
      existingBooking.serviceOptionId ||
      existingBooking.packageId ||
      existingBooking.recordingTypeId ||
      '';

    const validation = validateBookingFormPayload(
      mergedFormValues,
      [],
      cleanBookingId,
      pricingSettings,
      {
        allowedHistoricalServiceIds: [
          existingBooking.serviceId,
          existingBooking.serviceTypeId,
        ].filter(Boolean),
        allowedHistoricalOptionIds: [historicalOptionId].filter(Boolean),
        skipManualQuoteValidation: !formValues?.applyUpdatedPricing,
        paymentTotalOverride: formValues?.applyUpdatedPricing
          ? undefined
          : existingBooking.totalAmount,
      },
    );
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0] || 'Data perubahan booking tidak valid.';
      throw createBookingServiceError(
        'booking/validation-error',
        firstErrorMessage,
        validation.errors,
      );
    }

    const payload = validation.payload;

    const oldSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });

    const newSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: payload.date,
      studioId: payload.studioId,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
    });

    // Read union of old and new slot IDs before any writes
    const allSlotIds = Array.from(
      new Set([...oldSlots.map((s) => s.id), ...newSlots.map((s) => s.id)]),
    );
    const slotMap = new Map();
    const readSlots = await Promise.all(allSlotIds.map((id) => tx.getSlot(id)));
    allSlotIds.forEach((id, idx) => {
      slotMap.set(id, readSlots[idx]);
    });

    // Verify old slots are not hijacked by another booking
    for (const oldSlot of oldSlots) {
      const currentLock = slotMap.get(oldSlot.id);
      if (currentLock && currentLock.bookingId !== cleanBookingId) {
        throw createBookingServiceError(
          'booking/slot-ownership-mismatch',
          'Kepemilikan slot lama sudah tidak sesuai. Silakan muat ulang kalender.',
        );
      }
    }

    // Verify all new slots are either free or already owned by this booking
    for (const newSlot of newSlots) {
      const currentLock = slotMap.get(newSlot.id);
      if (currentLock && currentLock.bookingId !== cleanBookingId) {
        const slotEnd = newSlot.slotStartMinute + 30;
        throw createBookingServiceError(
          'booking/slot-conflict',
          `Jadwal tujuan bentrok pada slot ${formatMinuteOfDay(newSlot.slotStartMinute)}–${formatMinuteOfDay(slotEnd)} WIB. Jadwal awal tetap dipertahankan.`,
          {
            slotId: newSlot.id,
            slotStartMinute: newSlot.slotStartMinute,
            conflictingBookingId: currentLock.bookingId,
          },
        );
      }
    }

    const scheduleChanged =
      existingBooking.date !== payload.date ||
      existingBooking.studioId !== payload.studioId ||
      existingBooking.startMinute !== payload.startMinute ||
      existingBooking.durationMinutes !== payload.durationMinutes;

    const existingEffectiveOptionId =
      existingBooking.serviceOptionId ||
      existingBooking.packageId ||
      existingBooking.recordingTypeId ||
      '';
    const nextEffectiveOptionId =
      payload.serviceOptionId || payload.packageId || payload.recordingTypeId || '';

    const isServiceScopeChanged =
      existingBooking.serviceId !== payload.serviceId ||
      existingBooking.packageId !== payload.packageId ||
      existingBooking.recordingTypeId !== payload.recordingTypeId ||
      (Boolean(existingBooking.serviceOptionId) &&
        existingEffectiveOptionId !== nextEffectiveOptionId) ||
      existingBooking.durationMinutes !== payload.durationMinutes;

    const shouldApplyNewSnapshot =
      isServiceScopeChanged && Boolean(formValues?.applyUpdatedPricing);

    const prevInvoiceEffectiveTotal = existingInvoice
      ? Math.max(
          0,
          Math.round(
            Number(
              existingInvoice.effectiveTotalAmount ??
                existingInvoice.financialSnapshot?.totalAmount ??
                0,
            ) || 0,
          ),
        )
      : 0;
    const pricingDeltaAmount =
      shouldApplyNewSnapshot && existingInvoice ? payload.totalAmount - prevInvoiceEffectiveTotal : 0;

    let existingAdjustment = null;
    if (shouldApplyNewSnapshot && existingInvoice && pricingDeltaAmount !== 0) {
      if (existingInvoice.invoiceStatus !== INVOICE_STATUS.ISSUED) {
        throw createBookingServiceError(
          'booking/invoice-not-issued-for-adjustment',
          'Tarif booking tidak dapat diterapkan ke invoice karena status invoice tidak Issued (Draft/Void).',
        );
      }
      const cleanPricingReason = String(formValues?.pricingAdjustmentReason || '').trim();
      if (cleanPricingReason.length < 3 || cleanPricingReason.length > 300) {
        throw createBookingServiceError(
          'booking/adjustment-reason-required',
          'Alasan penyesuaian tagihan invoice wajib diisi (3–300 karakter) saat mengubah tarif pada booking yang memiliki invoice.',
        );
      }
      existingAdjustment =
        typeof tx.getInvoiceAdjustment === 'function'
          ? await tx.getInvoiceAdjustment(existingInvoice.id, cleanAdjustmentId)
          : null;
    }

    // 2. ALL WRITES AFTER READS
    const timestamp = tx.nowValue();
    const newSlotIdSet = new Set(newSlots.map((s) => s.id));
    const oldSlotIdSet = new Set(oldSlots.map((s) => s.id));

    // Delete old slots that are no longer needed
    for (const oldSlot of oldSlots) {
      if (!newSlotIdSet.has(oldSlot.id) && slotMap.get(oldSlot.id)) {
        tx.deleteSlot(oldSlot.id);
      }
    }

    // Create/update new slots
    for (const newSlot of newSlots) {
      if (!oldSlotIdSet.has(newSlot.id) || !slotMap.get(newSlot.id)) {
        tx.setSlot(newSlot.id, {
          bookingId: cleanBookingId,
          date: newSlot.date,
          studioId: newSlot.studioId,
          slotStartMinute: newSlot.slotStartMinute,
          createdAt: timestamp,
        });
      }
    }

    const nextVersion = (Number(existingBooking.version) || 1) + 1;

    // Preserve immutable initial payment snapshot fields AND historical price/commission/option snapshots
    // unless service/subcategory/duration changed and user explicitly confirmed applying current pricing.
    const preservedV2ServiceFields = shouldApplyNewSnapshot
      ? {
        serviceTypeId: payload.serviceTypeId,
        serviceTypeName: payload.serviceTypeName,
        serviceOptionId: payload.serviceOptionId,
        serviceOptionName: payload.serviceOptionName,
        deliveryMode: payload.deliveryMode,
        pricingMode: payload.pricingMode,
        pricingSettingsVersion: payload.pricingSettingsVersion,
      }
      : existingBooking.serviceTypeId
        ? {
          serviceTypeId: existingBooking.serviceTypeId,
          serviceTypeName: existingBooking.serviceTypeName,
          serviceOptionId: existingBooking.serviceOptionId,
          serviceOptionName: existingBooking.serviceOptionName,
          deliveryMode: existingBooking.deliveryMode,
          pricingMode: existingBooking.pricingMode,
          pricingSettingsVersion: existingBooking.pricingSettingsVersion,
        }
        : {};

    const preservedCustomerLinkFields = {};
    if (existingBooking.customerId) {
      preservedCustomerLinkFields.customerId = existingBooking.customerId;
    }
    if (existingBooking.phoneNormalized) {
      preservedCustomerLinkFields.phoneNormalized = existingBooking.phoneNormalized;
    }

    const updatedFields = {
      ...preservedCustomerLinkFields,
      customerName: payload.customerName,
      phone: payload.phone,
      bandName: payload.bandName,
      studioId: payload.studioId,
      ...preservedV2ServiceFields,
      serviceId: shouldApplyNewSnapshot ? payload.serviceId : existingBooking.serviceId,
      serviceLabel: shouldApplyNewSnapshot ? payload.serviceLabel : existingBooking.serviceLabel,
      packageId: shouldApplyNewSnapshot ? payload.packageId : existingBooking.packageId,
      packageLabel: shouldApplyNewSnapshot ? payload.packageLabel : existingBooking.packageLabel,
      recordingTypeId: shouldApplyNewSnapshot
        ? payload.recordingTypeId
        : existingBooking.recordingTypeId,
      recordingTypeLabel: shouldApplyNewSnapshot
        ? payload.recordingTypeLabel
        : existingBooking.recordingTypeLabel,
      date: payload.date,
      startMinute: payload.startMinute,
      durationMinutes: payload.durationMinutes,
      endMinute: payload.endMinute,
      timeZone: STUDIO_TIME_ZONE,
      unitRate: shouldApplyNewSnapshot ? payload.unitRate : existingBooking.unitRate,
      subtotal: shouldApplyNewSnapshot ? payload.subtotal : existingBooking.subtotal,
      discountAmount: shouldApplyNewSnapshot
        ? payload.discountAmount
        : existingBooking.discountAmount,
      totalAmount: shouldApplyNewSnapshot ? payload.totalAmount : existingBooking.totalAmount,
      automaticDiscount: shouldApplyNewSnapshot
        ? (payload.automaticDiscount ?? null)
        : (existingBooking.automaticDiscount ?? null),
      commissionSnapshot: shouldApplyNewSnapshot
        ? payload.commissionSnapshot
        : (existingBooking.commissionSnapshot ?? null),
      schemaVersion: Math.max(2, Number(existingBooking.schemaVersion) || 2),
      clientUid: existingBooking.clientUid || '',
      source: existingBooking.source || 'staff_created',
      sourceRequestId: existingBooking.sourceRequestId || '',
      acceptedOfferId: existingBooking.acceptedOfferId || '',
      invoiceId: existingBooking.invoiceId || `inv_${cleanBookingId}`,
      reservationStatus: normalizeBookingReservationStatus(existingBooking),
      depositPolicySnapshot: existingBooking.depositPolicySnapshot ?? null,
      minimumDepositAmount: existingBooking.minimumDepositAmount ?? 0,
      depositStatus: existingBooking.depositStatus ?? null,
      depositIntegrityAlert: Boolean(existingBooking.depositIntegrityAlert),
      balanceDuePolicy: existingBooking.balanceDuePolicy ?? null,
      holdExpiresAt: existingBooking.holdExpiresAt ?? null,
      holdExtensionCount: existingBooking.holdExtensionCount || 0,
      holdLastExtendedAt: existingBooking.holdLastExtendedAt ?? null,
      holdLastExtendedByUid: existingBooking.holdLastExtendedByUid || '',
      holdLastExtensionReason: existingBooking.holdLastExtensionReason || '',
      expiredAt: existingBooking.expiredAt ?? null,
      expiredByUid: existingBooking.expiredByUid || '',
      expiryReason: existingBooking.expiryReason || '',
      restoredAt: existingBooking.restoredAt ?? null,
      restoredByUid: existingBooking.restoredByUid || '',
      restorationReason: existingBooking.restorationReason || '',
      confirmedAt: existingBooking.confirmedAt ?? null,
      confirmedByUid: existingBooking.confirmedByUid || '',
      confirmationSource: existingBooking.confirmationSource || '',
      confirmationOverrideReason: existingBooking.confirmationOverrideReason || '',
      cancelledAt: existingBooking.cancelledAt ?? null,
      cancelledByUid: existingBooking.cancelledByUid || '',
      cancellationType: existingBooking.cancellationType || '',
      cancellationReason: existingBooking.cancellationReason || '',
      initialPaymentStatus: existingBooking.initialPaymentStatus,
      initialPaidAmount: existingBooking.initialPaidAmount,
      paymentMethod: existingBooking.paymentMethod,
      sessionStatus: existingBooking.sessionStatus,
      checkedInAt: existingBooking.checkedInAt,
      checkedInByUid: existingBooking.checkedInByUid,
      actualStartedAt: existingBooking.actualStartedAt,
      actualCompletedAt: existingBooking.actualCompletedAt,
      notes: payload.notes,
      createdAt: existingBooking.createdAt,
      createdByUid: existingBooking.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };

    tx.updateBooking(cleanBookingId, updatedFields);

    let invoiceForProjection = existingInvoice;
    if (shouldApplyNewSnapshot && existingInvoice && pricingDeltaAmount !== 0) {
      const cleanPricingReason = String(formValues?.pricingAdjustmentReason || '').trim();
      const adjCategory =
        existingBooking.serviceTypeId === payload.serviceTypeId &&
        existingEffectiveOptionId === nextEffectiveOptionId &&
        existingBooking.durationMinutes !== payload.durationMinutes
          ? 'duration_change'
          : 'service_change';
      const adjResult = applyInvoiceAdjustmentInTransaction(tx, {
        adjustmentId: cleanAdjustmentId,
        existingInvoice,
        existingAdjustment,
        // `setClientReservation` immediately below writes the unified booking + invoice projection
        existingClientReservation: null,
        expectedVersion: existingInvoice.version,
        category: adjCategory,
        deltaAmount: pricingDeltaAmount,
        reason: cleanPricingReason,
        actorUid: cleanActorUid,
        now: timestamp,
      });
      invoiceForProjection = adjResult.invoice;
    }

    const clientReservationProjection = buildClientReservationProjection(
      { ...existingBooking, ...updatedFields, id: cleanBookingId },
      invoiceForProjection,
      timestamp,
    );
    if (clientReservationProjection) {
      tx.setClientReservation?.(cleanBookingId, clientReservationProjection);
    }

    const nextPublicProjection = buildPublicAvailabilityProjectionFromBooking(
      updatedFields,
      timestamp,
    );
    if (nextPublicProjection) {
      tx.setPublicAvailability?.(cleanBookingId, nextPublicProjection);
    } else {
      tx.deletePublicAvailability?.(cleanBookingId);
    }

    const eventType =
      mode === 'reschedule' || scheduleChanged
        ? BOOKING_EVENT_TYPES.RESCHEDULED
        : BOOKING_EVENT_TYPES.EDITED;

    const eventNote = scheduleChanged
      ? `Jadwal dipindahkan dari ${existingBooking.date} (${formatMinuteRange(existingBooking.startMinute, existingBooking.endMinute, false)}, ${existingBooking.studioId.toUpperCase()}) ke ${payload.date} (${formatMinuteRange(payload.startMinute, payload.endMinute, false)}, ${payload.studioId.toUpperCase()})`
      : `Detail booking diperbarui untuk ${payload.customerName}`;

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        customerName: existingBooking.customerName,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        endMinute: existingBooking.endMinute,
        durationMinutes: existingBooking.durationMinutes,
        serviceLabel: existingBooking.serviceLabel,
      },
      newValue: {
        customerName: payload.customerName,
        date: payload.date,
        studioId: payload.studioId,
        startMinute: payload.startMinute,
        endMinute: payload.endMinute,
        durationMinutes: payload.durationMinutes,
        serviceLabel: payload.serviceLabel,
      },
      note: eventNote,
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * Cancels a booking atomically without deleting the booking record:
 * - Transitions `sessionStatus` to `cancelled`
 * - Releases all `bookingSlots` locks owned by the booking
 * - Appends an immutable `booking_cancelled` event
 */
export async function cancelBooking({
  bookingId,
  expectedVersion,
  eventId = generateOperationId('evt'),
  actorUid,
  reason = '',
  cancellationType = CANCELLATION_TYPES.STUDIO_CANCEL,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking wajib disertakan.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READS FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);
    const existingInvoice = existingBooking
      ? await tx.getInvoice?.(`inv_${cleanBookingId}`)
      : null;

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (existingBooking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED) {
      return existingBooking;
    }

    if (normalizeBookingReservationStatus(existingBooking) === RESERVATION_STATUS.EXPIRED) {
      throw createBookingServiceError(
        'hold/already-expired',
        'Reservasi sudah berstatus Expired dan slot telah dilepaskan.',
      );
    }

    if (existingBooking.sessionStatus === BOOKING_SESSION_STATUS.COMPLETED) {
      throw createBookingServiceError(
        'booking/invalid-transition',
        'Sesi yang sudah selesai (Completed) tidak dapat dibatalkan.',
      );
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah di sesi lain. Muat ulang sebelum membatalkan.',
      );
    }

    const oldSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });

    const slotLocks = await Promise.all(oldSlots.map((slot) => tx.getSlot(slot.id)));

    // 2. WRITES AFTER READS
    const timestamp = tx.nowValue();

    oldSlots.forEach((slot, idx) => {
      const lock = slotLocks[idx];
      if (lock && lock.bookingId === cleanBookingId) {
        tx.deleteSlot(slot.id);
      }
    });

    const cleanReason = String(reason || '').trim();
    const resolvedCancellationType = Object.values(CANCELLATION_TYPES).includes(cancellationType)
      ? cancellationType
      : CANCELLATION_TYPES.STUDIO_CANCEL;
    const nextVersion = (Number(existingBooking.version) || 1) + 1;
    const cancelPatch = {
      reservationStatus: RESERVATION_STATUS.CANCELLED,
      sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      cancelledAt: timestamp,
      cancelledByUid: cleanActorUid,
      cancellationType: resolvedCancellationType,
      cancellationReason: cleanReason,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };
    const updatedFields = {
      ...existingBooking,
      ...cancelPatch,
    };
    delete updatedFields.id;

    tx.updateBooking(cleanBookingId, cancelPatch);
    const clientReservationProjection = buildClientReservationProjection(
      { ...existingBooking, ...updatedFields, id: cleanBookingId },
      existingInvoice,
      timestamp,
    );
    if (clientReservationProjection) {
      tx.setClientReservation?.(cleanBookingId, clientReservationProjection);
    }

    const nextPublicProjection = buildPublicAvailabilityProjectionFromBooking(
      updatedFields,
      timestamp,
    );
    if (nextPublicProjection) {
      tx.setPublicAvailability?.(cleanBookingId, nextPublicProjection);
    } else {
      tx.deletePublicAvailability?.(cleanBookingId);
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.CANCELLED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        sessionStatus: existingBooking.sessionStatus,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        endMinute: existingBooking.endMinute,
      },
      newValue: {
        sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      },
      note: cleanReason
        ? `Booking dibatalkan: ${cleanReason}`
        : 'Booking dibatalkan dan slot jadwal telah dilepaskan.',
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * Performs an atomic session lifecycle transition:
 * - `check_in`: records `checkedInAt` & `checkedInByUid` on an `upcoming` booking
 * - `start_session`: transitions `upcoming` -> `in_progress`, recording `actualStartedAt`
 * - `complete_session`: transitions `in_progress` -> `completed`, recording `actualCompletedAt`
 * - `mark_no_show`: transitions `upcoming` -> `no_show` ONLY after 15-min grace period without check-in, releasing slot locks
 * - `cancel_session`: delegates to atomic cancellation
 */
export async function transitionBookingSession({
  bookingId,
  action,
  expectedVersion,
  eventId = generateOperationId('evt'),
  actorUid,
  note = '',
  now = new Date(),
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');

  if (action === 'cancel_session') {
    return cancelBooking({
      bookingId: cleanBookingId,
      expectedVersion,
      eventId: cleanEventId,
      actorUid: cleanActorUid,
      reason: note,
      adapter,
    });
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READS FIRST
    const existingBooking = await tx.getBooking(cleanBookingId);
    const existingEvent = await tx.getEvent(cleanEventId);
    const existingInvoice = existingBooking
      ? await tx.getInvoice?.(`inv_${cleanBookingId}`)
      : null;

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (
      Number.isInteger(Number(expectedVersion)) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data booking sudah berubah di sesi lain. Muat ulang detail booking.',
      );
    }

    let oldSlots = [];
    let slotLocks = [];
    if (action === 'mark_no_show') {
      oldSlots = buildBookingSlotRecords({
        bookingId: cleanBookingId,
        date: existingBooking.date,
        studioId: existingBooking.studioId,
        startMinute: existingBooking.startMinute,
        durationMinutes: existingBooking.durationMinutes,
      });
      slotLocks = await Promise.all(oldSlots.map((slot) => tx.getSlot(slot.id)));
    }

    const currentStatus = existingBooking.sessionStatus;
    const currentReservationStatus = normalizeBookingReservationStatus(existingBooking);
    const timestamp = tx.nowValue();
    const nextVersion = (Number(existingBooking.version) || 1) + 1;
    const cleanNote = String(note || '').trim();

    if (
      ['check_in', 'start_session', 'complete_session', 'mark_no_show'].includes(action) &&
      (currentReservationStatus !== RESERVATION_STATUS.CONFIRMED ||
        currentStatus === BOOKING_SESSION_STATUS.PENDING_CONFIRMATION)
    ) {
      throw createBookingServiceError(
        'booking/deposit-hold-not-confirmed',
        currentReservationStatus === RESERVATION_STATUS.DEPOSIT_HOLD
          ? 'Reservasi masih berstatus Deposit Hold (Pending Confirmation). Konfirmasi reservasi atau verifikasi minimum DP sebelum check-in atau memulai sesi.'
          : `Sesi tidak dapat dijalankan pada reservasi berstatus "${currentReservationStatus}".`,
      );
    }

    const lifecyclePatch = {
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };

    let eventType;
    let eventNote;
    let nextStatus = currentStatus;

    if (action === 'check_in') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Check-in hanya dapat dilakukan pada booking berstatus Upcoming.',
        );
      }
      if (existingBooking.checkedInAt) {
        return existingBooking;
      }

      lifecyclePatch.checkedInAt = timestamp;
      lifecyclePatch.checkedInByUid = cleanActorUid;
      eventType = BOOKING_EVENT_TYPES.CHECKED_IN;
      eventNote = cleanNote || `Customer ${existingBooking.customerName} telah check-in di studio.`;
    } else if (action === 'start_session') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Sesi hanya dapat dimulai dari status Upcoming.',
        );
      }

      nextStatus = BOOKING_SESSION_STATUS.IN_PROGRESS;
      lifecyclePatch.sessionStatus = nextStatus;
      lifecyclePatch.actualStartedAt = timestamp;
      if (!existingBooking.checkedInAt) {
        lifecyclePatch.checkedInAt = timestamp;
        lifecyclePatch.checkedInByUid = cleanActorUid;
      }
      eventType = BOOKING_EVENT_TYPES.STARTED;
      eventNote = cleanNote || 'Sesi studio dimulai.';
    } else if (action === 'complete_session') {
      if (currentStatus !== BOOKING_SESSION_STATUS.IN_PROGRESS) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'Sesi hanya dapat diselesaikan setelah status sesi berjalan (In Progress).',
        );
      }

      nextStatus = BOOKING_SESSION_STATUS.COMPLETED;
      lifecyclePatch.sessionStatus = nextStatus;
      lifecyclePatch.actualCompletedAt = timestamp;
      eventType = BOOKING_EVENT_TYPES.COMPLETED;
      eventNote = cleanNote || 'Sesi studio telah selesai.';
    } else if (action === 'mark_no_show') {
      if (currentStatus !== BOOKING_SESSION_STATUS.UPCOMING) {
        throw createBookingServiceError(
          'booking/invalid-transition',
          'No Show hanya dapat diterapkan pada booking berstatus Upcoming.',
        );
      }
      if (existingBooking.checkedInAt) {
        throw createBookingServiceError(
          'booking/no-show-not-eligible',
          'Customer sudah check-in sehingga tidak dapat ditandai No Show.',
        );
      }
      if (!isBookingNoShowEligible(existingBooking, now)) {
        throw createBookingServiceError(
          'booking/no-show-not-eligible',
          'No Show baru dapat dilakukan setelah waktu mulai melewati grace period 15 menit tanpa check-in.',
        );
      }

      // Release slot locks so the studio room can be used
      oldSlots.forEach((slot, idx) => {
        const lock = slotLocks[idx];
        if (lock && lock.bookingId === cleanBookingId) {
          tx.deleteSlot(slot.id);
        }
      });

      nextStatus = BOOKING_SESSION_STATUS.NO_SHOW;
      lifecyclePatch.sessionStatus = nextStatus;
      eventType = BOOKING_EVENT_TYPES.NO_SHOW;
      eventNote = cleanNote
        ? `Customer ditandai No Show: ${cleanNote}`
        : 'Customer tidak hadir melewati grace period 15 menit (No Show).';
    } else {
      throw createBookingServiceError(
        'booking/unknown-action',
        `Aksi lifecycle "${action}" tidak dikenali.`,
      );
    }

    const updatedFields = {
      ...existingBooking,
      ...lifecyclePatch,
    };
    delete updatedFields.id;

    // 2. WRITES AFTER READS
    tx.updateBooking(cleanBookingId, lifecyclePatch);
    const clientReservationProjection = buildClientReservationProjection(
      { ...existingBooking, ...updatedFields, id: cleanBookingId },
      existingInvoice,
      timestamp,
    );
    if (clientReservationProjection) {
      tx.setClientReservation?.(cleanBookingId, clientReservationProjection);
    }

    const nextPublicProjection = buildPublicAvailabilityProjectionFromBooking(
      updatedFields,
      timestamp,
    );
    if (nextPublicProjection) {
      tx.setPublicAvailability?.(cleanBookingId, nextPublicProjection);
    } else {
      tx.deletePublicAvailability?.(cleanBookingId);
    }
    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        sessionStatus: currentStatus,
        checkedInAt: Boolean(existingBooking.checkedInAt),
      },
      newValue: {
        sessionStatus: nextStatus,
        checkedInAt: Boolean(updatedFields.checkedInAt),
      },
      note: eventNote,
    });

    return normalizeBookingRecord(cleanBookingId, updatedFields);
  });
}

/**
 * In-memory transactional repository adapter for deterministic automated testing
 * of concurrency, slot locks, atomic rollback, stale updates, and realtime subscriptions.
 */
export function createInMemoryBookingRepositoryAdapter(
  initialBookings = [],
  initialCustomers = [],
  initialPhoneIndex = [],
  initialInvoices = [],
  initialPaymentTransactions = [],
) {
  const bookings = new Map();
  const rawBookings = new Map();
  const rawCommissionSnapshots = new Map();
  const slots = new Map();
  const publicAvailability = new Map();
  const publicAvailabilityMetadata = new Map();
  const events = new Map();
  const customers = new Map();
  const phoneIndex = new Map();
  const invoices = new Map();
  const invoiceAdjustments = new Map();
  const paymentTransactions = new Map();
  const paymentEvidence = new Map();
  const paymentEvidenceLocks = new Map();
  const refundCases = new Map();
  let bookingPolicies = null;
  const clientReservations = new Map();
  const commissionBatches = new Map();
  const commissionPostingItems = new Map();
  const commissionReviewResolutions = new Map();
  const bookkeepingEntries = new Map();
  const bookkeepingSettlements = new Map();
  const bookkeepingSettings = new Map();
  const bookingRequests = new Map();
  const bookingRequestActivities = new Map();
  const bookingRequestCommunications = new Map();
  const bookingRequestOffers = new Map();
  const rangeSubscribers = new Set();
  const depositHoldSubscribers = new Set();
  const publicAvailabilitySubscribers = new Set();
  const publicAvailabilityMetadataSubscribers = new Set();
  const eventSubscribers = new Map();
  const customerSubscribers = new Set();
  const invoiceSubscribers = new Set();
  const invoiceDocSubscribers = new Map();
  const invoiceRangeSubscribers = new Set();
  const invoiceAdjustmentSubscribers = new Map();
  const transactionSubscribers = new Set();
  const invoiceTransactionSubscribers = new Map();
  const paymentEvidenceSubscribers = new Set();
  const commissionSubscribers = new Set();
  const bookkeepingSubscribers = new Set();
  const bookingRequestNewSubscribers = new Set();
  const bookingRequestListSubscribers = new Set();
  const bookingRequestClientSubscribers = new Set();
  const clientReservationSubscribers = new Set();
  const bookingRequestDocSubscribers = new Map();
  const bookingRequestActivitySubscribers = new Map();
  const bookingRequestCommSubscribers = new Map();
  const bookingRequestOfferSubscribers = new Map();
  let transactionQueue = Promise.resolve();

  function notifyBookingOffers(targetRequestId = '') {
    if (!targetRequestId) return;
    const list = Array.from(bookingRequestOffers.values())
      .filter((o) => o.requestId === targetRequestId)
      .sort((a, b) => (Number(b.revisionNumber) || 1) - (Number(a.revisionNumber) || 1));
    bookingRequestOfferSubscribers.get(targetRequestId)?.forEach((sub) => {
      sub.onData?.(list.map((o) => ({ ...o })));
    });
  }

  function notifyDepositHolds() {
    const holds = Array.from(bookings.values())
      .filter((b) => normalizeBookingReservationStatus(b) === RESERVATION_STATUS.DEPOSIT_HOLD)
      .sort((a, b) => getTimestampMillis(a.holdExpiresAt) - getTimestampMillis(b.holdExpiresAt));
    for (const sub of depositHoldSubscribers) {
      const limited = holds.slice(0, sub.maxLimit);
      sub.onData?.({
        holds: limited.map((h) => ({ ...h })),
        isTruncated: holds.length > sub.maxLimit,
      });
    }
  }

  function notifyBookingRequests(targetRequestId = '') {
    const allSorted = Array.from(bookingRequests.values()).sort((a, b) => {
      const diff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      if (diff !== 0) return diff;
      return String(b.id).localeCompare(String(a.id));
    });
    const newOnly = allSorted.filter((r) => r.status === BOOKING_REQUEST_STATUS.NEW);

    for (const sub of bookingRequestNewSubscribers) {
      const hasMore = newOnly.length > sub.maxLimit;
      sub.onData?.({
        requests: hasMore ? newOnly.slice(0, sub.maxLimit) : newOnly,
        hasMore,
        maxLimit: sub.maxLimit,
      });
    }

    for (const sub of bookingRequestListSubscribers) {
      const hasMore = allSorted.length > sub.maxLimit;
      const visible = hasMore ? allSorted.slice(0, sub.maxLimit) : allSorted;
      sub.onData?.({
        requests: visible,
        hasMore,
        isTruncated: hasMore,
        lastCursor: visible.length > 0 ? visible[visible.length - 1].id : null,
        maxLimit: sub.maxLimit,
      });
    }

    for (const sub of bookingRequestClientSubscribers) {
      const ownOnly = allSorted.filter(
        (r) => r.source === BOOKING_REQUEST_SOURCES.CLIENT_PORTAL && r.clientUid === sub.clientUid,
      );
      const hasMore = ownOnly.length > sub.maxLimit;
      sub.onData?.({
        requests: hasMore ? ownOnly.slice(0, sub.maxLimit) : ownOnly,
        hasMore,
        isTruncated: hasMore,
        maxLimit: sub.maxLimit,
      });
    }

    if (targetRequestId) {
      const targetDoc = bookingRequests.get(targetRequestId) || null;
      bookingRequestDocSubscribers
        .get(targetRequestId)
        ?.forEach((cb) => cb(targetDoc ? { ...targetDoc } : null));

      const acts = Array.from(bookingRequestActivities.values())
        .filter((a) => a.requestId === targetRequestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      bookingRequestActivitySubscribers.get(targetRequestId)?.forEach((cb) => cb([...acts]));

      const comms = Array.from(bookingRequestCommunications.values())
        .filter((c) => c.requestId === targetRequestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      bookingRequestCommSubscribers.get(targetRequestId)?.forEach((cb) => cb([...comms]));
    }
  }

  function notifyClientReservations() {
    for (const sub of clientReservationSubscribers) {
      const matches = Array.from(clientReservations.values())
        .filter((reservation) =>
          (sub.clientUid && reservation.clientUid === sub.clientUid) ||
          (sub.customerId && reservation.customerId === sub.customerId),
        )
        .sort((a, b) => {
          const activityDiff = getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt);
          if (activityDiff !== 0) return activityDiff;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
      const limited = matches.slice(0, sub.maxLimit);
      sub.onData?.({
        reservations: limited.map((reservation) => ({ ...reservation })),
        isTruncated: matches.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyBookkeepingSubscribers() {
    for (const cb of bookkeepingSubscribers) {
      cb?.();
    }
  }

  function notifyCommissionSubscribers() {
    for (const cb of commissionSubscribers) {
      cb?.();
    }
    notifyBookkeepingSubscribers();
  }

  function notifyPublicAvailabilitySubscribers() {
    for (const sub of publicAvailabilitySubscribers) {
      const matching = Array.from(publicAvailability.values())
        .filter((p) => p.date >= sub.startDate && p.date <= sub.endDate)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
          return a.studioId.localeCompare(b.studioId);
        });

      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        projections: limited.map((p) => ({ ...p })),
        isTruncated: matching.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyPublicAvailabilityMetadataSubscribers() {
    const statusDoc = publicAvailabilityMetadata.get('status') || null;
    for (const cb of publicAvailabilityMetadataSubscribers) {
      cb?.(statusDoc ? { ...statusDoc } : null);
    }
  }

  function notifyRangeSubscribers() {
    for (const sub of rangeSubscribers) {
      const matching = Array.from(bookings.values())
        .filter((b) => b.date >= sub.startDate && b.date <= sub.endDate)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
          return a.studioId.localeCompare(b.studioId);
        });

      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        bookings: limited.map((b) => ({ ...b })),
        isTruncated: matching.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyCustomerSubscribers() {
    const sorted = Array.from(customers.values()).sort(
      (a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt),
    );
    for (const sub of customerSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        customers: limited.map((c) => ({ ...c })),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function notifyInvoiceSubscribers() {
    const sorted = Array.from(invoices.values()).sort((a, b) => {
      const diff = getTimestampMillis(b.invoiceDate) - getTimestampMillis(a.invoiceDate);
      if (diff !== 0) return diff;
      return String(b.invoiceNumber || '').localeCompare(String(a.invoiceNumber || ''));
    });

    for (const sub of invoiceSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        invoices: limited.map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceDocSubscribers.entries()) {
      const target = invoices.get(invoiceId);
      const normalized = target ? normalizeInvoiceRecord(invoiceId, target) : null;
      for (const cb of listeners) {
        cb(normalized);
      }
    }

    for (const sub of invoiceRangeSubscribers) {
      const matching = Array.from(invoices.values())
        .filter((inv) => {
          const d = inv.bookingSnapshot?.bookingDate || '';
          return d >= sub.startDate && d <= sub.endDate;
        })
        .sort((a, b) =>
          String(a.bookingSnapshot?.bookingDate || '').localeCompare(
            String(b.bookingSnapshot?.bookingDate || ''),
          ),
        );
      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        invoices: limited.map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        isTruncated: matching.length > sub.maxLimit,
      });
    }
  }

  function notifyTransactionSubscribers() {
    const sorted = Array.from(paymentTransactions.values()).sort((a, b) => {
      const diff =
        getTimestampMillis(b.receivedAt || b.createdAt) -
        getTimestampMillis(a.receivedAt || a.createdAt);
      if (diff !== 0) return diff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    for (const sub of transactionSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        transactions: limited.map((tx) => normalizePaymentTransactionRecord(tx.id, tx)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceTransactionSubscribers.entries()) {
      const matching = sorted
        .filter((tx) => tx.invoiceId === invoiceId)
        .map((tx) => normalizePaymentTransactionRecord(tx.id, tx));
      for (const cb of listeners) {
        cb(matching);
      }
    }
  }

  function notifyEventSubscribers(bookingId) {
    const subs = eventSubscribers.get(bookingId);
    if (!subs) return;
    const matching = Array.from(events.values())
      .filter((e) => e.bookingId === bookingId)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    for (const cb of subs) {
      cb(matching.map((e) => ({ ...e })));
    }
  }

  // Seed initial customers & phone index if provided
  for (const seedCust of initialCustomers) {
    const normCust = normalizeCustomerRecord(seedCust.id || generateOperationId('cust'), seedCust);
    customers.set(normCust.id, normCust);
  }
  for (const seedIdx of initialPhoneIndex) {
    const normIdx = normalizePhoneIndexRecord(seedIdx.phoneHash || seedIdx.id, seedIdx);
    if (normIdx.phoneHash) {
      phoneIndex.set(normIdx.phoneHash, normIdx);
    }
  }
  for (const seedInv of initialInvoices) {
    const normInv = normalizeInvoiceRecord(
      seedInv.id || buildInvoiceId(seedInv.bookingId),
      seedInv,
    );
    if (normInv.id) {
      invoices.set(normInv.id, normInv);
    }
  }
  for (const seedTx of initialPaymentTransactions) {
    const normTx = normalizePaymentTransactionRecord(
      seedTx.id || generateOperationId('pay'),
      seedTx,
    );
    if (normTx.id) {
      paymentTransactions.set(normTx.id, normTx);
    }
  }

  // Seed initial bookings and their slot locks if provided
  for (const seed of initialBookings) {
    const seedId = seed.id || generateOperationId('bkg');
    rawBookings.set(seedId, { id: seedId, ...seed });
    const normalized = normalizeBookingRecord(seedId, seed);
    bookings.set(normalized.id, normalized);
    rawCommissionSnapshots.set(
      normalized.id,
      'commissionSnapshot' in seed ? (seed.commissionSnapshot ?? null) : null,
    );
    if (
      normalized.sessionStatus !== BOOKING_SESSION_STATUS.CANCELLED &&
      normalized.sessionStatus !== BOOKING_SESSION_STATUS.NO_SHOW &&
      normalizeBookingReservationStatus(normalized) !== RESERVATION_STATUS.EXPIRED
    ) {
      const seedSlots = buildBookingSlotRecords({
        bookingId: normalized.id,
        date: normalized.date,
        studioId: normalized.studioId,
        startMinute: normalized.startMinute,
        durationMinutes: normalized.durationMinutes,
      });
      for (const s of seedSlots) {
        slots.set(s.id, {
          id: s.id,
          bookingId: normalized.id,
          date: s.date,
          studioId: s.studioId,
          slotStartMinute: s.slotStartMinute,
          createdAt: { seconds: Math.floor(Date.now() / 1000) },
        });
      }
      const seedProjection = buildPublicAvailabilityProjectionFromBooking(normalized, {
        seconds: Math.floor(Date.now() / 1000),
      });
      if (seedProjection) {
        publicAvailability.set(
          normalized.id,
          normalizePublicAvailabilityRecord(normalized.id, seedProjection),
        );
      }
    }
  }

  function enqueueTransaction(work) {
    const runNext = transactionQueue.then(work);
    transactionQueue = runNext.catch(() => { });
    return runNext;
  }

  return {
    _sharedStore: {
      bookings,
      rawBookings,
      rawCommissionSnapshots,
      slots,
      publicAvailability,
      publicAvailabilityMetadata,
      events,
      customers,
      phoneIndex,
      invoices,
      invoiceAdjustments,
      paymentTransactions,
      paymentEvidence,
      paymentEvidenceLocks,
      refundCases,
      getBookingPoliciesSnapshot: () => bookingPolicies,
      commissionBatches,
      commissionPostingItems,
      commissionReviewResolutions,
      bookkeepingEntries,
      bookkeepingSettlements,
      bookkeepingSettings,
      bookingRequests,
      bookingRequestActivities,
      bookingRequestCommunications,
      bookingRequestOffers,
      publicAvailabilitySubscribers,
      publicAvailabilityMetadataSubscribers,
      customerSubscribers,
      invoiceSubscribers,
      invoiceDocSubscribers,
      invoiceRangeSubscribers,
      invoiceAdjustmentSubscribers,
      transactionSubscribers,
      invoiceTransactionSubscribers,
      paymentEvidenceSubscribers,
      clientReservations,
      clientReservationSubscribers,
      commissionSubscribers,
      bookkeepingSubscribers,
      bookingRequestNewSubscribers,
      bookingRequestListSubscribers,
      bookingRequestClientSubscribers,
      bookingRequestDocSubscribers,
      bookingRequestActivitySubscribers,
      bookingRequestCommSubscribers,
      bookingRequestOfferSubscribers,
      enqueueTransaction,
      notifyBookings: () => {
        notifyRangeSubscribers();
        notifyDepositHolds();
      },
      notifyEvents: notifyEventSubscribers,
      notifyPublicAvailability: notifyPublicAvailabilitySubscribers,
      notifyPublicAvailabilityMetadata: notifyPublicAvailabilityMetadataSubscribers,
      notifyCustomers: notifyCustomerSubscribers,
      notifyInvoices: notifyInvoiceSubscribers,
      notifyInvoiceAdjustments(targetInvoiceId = null) {
        const keys = targetInvoiceId
          ? [targetInvoiceId]
          : Array.from(invoiceAdjustmentSubscribers.keys());
        for (const invId of keys) {
          const listeners = invoiceAdjustmentSubscribers.get(invId);
          if (!listeners || listeners.size === 0) continue;
          const items = Array.from(invoiceAdjustments.values())
            .filter((adj) => adj && adj.invoiceId === invId)
            .map((adj) => normalizeInvoiceAdjustmentRecord(adj.id, adj))
            .sort((a, b) => {
              const diff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
              if (diff !== 0) return diff;
              return String(b.id || '').localeCompare(String(a.id || ''));
            });
          for (const cb of listeners) {
            cb?.(items);
          }
        }
      },
      notifyTransactions: notifyTransactionSubscribers,
      notifyPaymentEvidence() {
        for (const listener of paymentEvidenceSubscribers) {
          listener();
        }
      },
      notifyCommissions: notifyCommissionSubscribers,
      notifyBookkeeping: notifyBookkeepingSubscribers,
      notifyBookingRequests,
      notifyBookingOffers,
      notifyClientReservations,
    },

    _seedBookingPolicies(policies = null) {
      bookingPolicies = policies ? normalizeBookingPolicies(policies) : null;
    },

    _seedOffer(requestId, offerId, data = {}) {
      const cleanReqId = String(requestId || data.requestId || '').trim();
      const cleanOfferId = String(offerId || data.offerId || data.id || '').trim();
      if (!cleanReqId || !cleanOfferId) return;
      const norm = normalizeOfferRecord(cleanOfferId, { ...data, requestId: cleanReqId });
      if (norm) {
        bookingRequestOffers.set(cleanOfferId, norm);
        notifyBookingOffers(cleanReqId);
      }
    },

    _seedPaymentEvidence(evidenceId, data = {}) {
      const cleanId = String(evidenceId || data.id || '').trim();
      if (!cleanId) return;
      const norm = normalizePaymentEvidenceRecord(cleanId, data);
      if (norm) {
        paymentEvidence.set(cleanId, norm);
        for (const listener of paymentEvidenceSubscribers) listener();
      }
    },

    _seedBookingRequest(requestId, data = {}) {
      const cleanId = String(requestId || data.id || '').trim();
      if (!cleanId) return;
      const norm = normalizeBookingRequestRecord(cleanId, data);
      if (norm) {
        bookingRequests.set(cleanId, norm);
        notifyBookingRequests(cleanId);
      }
    },

    _seedClientReservation(id, data = {}) {
      const cleanId = String(id || data.bookingId || '').trim();
      if (!cleanId) return;
      clientReservations.set(cleanId, { id: cleanId, ...data, bookingId: cleanId });
      notifyClientReservations();
    },

    _inspectState() {
      return {
        bookings: new Map(bookings),
        rawBookings: new Map(rawBookings),
        slots: new Map(slots),
        publicAvailability: new Map(publicAvailability),
        publicAvailabilityMetadata: new Map(publicAvailabilityMetadata),
        events: new Map(events),
        customers: new Map(customers),
        phoneIndex: new Map(phoneIndex),
        invoices: new Map(invoices),
        invoiceAdjustments: new Map(invoiceAdjustments),
        paymentTransactions: new Map(paymentTransactions),
        paymentEvidence: new Map(paymentEvidence),
        paymentEvidenceLocks: new Map(paymentEvidenceLocks),
        refundCases: new Map(refundCases),
        bookingPolicies: bookingPolicies ? { ...bookingPolicies } : null,
        clientReservations: new Map(clientReservations),
        bookingRequests: new Map(bookingRequests),
        bookingRequestActivities: new Map(bookingRequestActivities),
        bookingRequestCommunications: new Map(bookingRequestCommunications),
        bookingRequestOffers: new Map(bookingRequestOffers),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueueTransaction(async () => {
        // Work on staged copies so any thrown error leaves the store untouched (atomic rollback)
        const stagedBookings = new Map(bookings);
        const stagedRawBookings = new Map(rawBookings);
        const stagedRawCommissionSnapshots = new Map(rawCommissionSnapshots);
        const stagedSlots = new Map(slots);
        const stagedPublicAvailability = new Map(publicAvailability);
        const stagedEvents = new Map(events);
        const stagedCustomers = new Map(customers);
        const stagedPhoneIndex = new Map(phoneIndex);
        const stagedInvoices = new Map(invoices);
        const stagedInvoiceAdjustments = new Map(invoiceAdjustments);
        const stagedPaymentTransactions = new Map(paymentTransactions);
        const stagedPaymentEvidence = new Map(paymentEvidence);
        const stagedPaymentEvidenceLocks = new Map(paymentEvidenceLocks);
        const stagedRefundCases = new Map(refundCases);
        const stagedClientReservations = new Map(clientReservations);
        const stagedBookingRequests = new Map(bookingRequests);
        const stagedBookingRequestActivities = new Map(bookingRequestActivities);
        const stagedBookingRequestOffers = new Map(bookingRequestOffers);
        const touchedBookingIds = new Set();
        const touchedRequestIds = new Set();
        const touchedOfferRequestIds = new Set();
        let writeStarted = false;

        const txContext = {
          nowValue: () => {
            const ms = Date.now();
            return {
              seconds: Math.floor(ms / 1000),
              nanoseconds: (ms % 1000) * 1_000_000,
              toDate: () => new Date(ms),
            };
          },
          timestampFromDate: (date) => {
            const d = date instanceof Date ? date : new Date(date);
            const ms = d.getTime();
            return {
              seconds: Math.floor(ms / 1000),
              nanoseconds: (ms % 1000) * 1_000_000,
              toDate: () => new Date(ms),
            };
          },
          async getBooking(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookings.get(id);
            return item ? { ...item } : null;
          },
          async getBookingRaw(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedRawBookings.get(id) || stagedBookings.get(id);
            return item ? { ...item } : null;
          },
          async getSlot(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedSlots.get(id);
            return item ? { ...item } : null;
          },
          async getEvent(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEvents.get(id);
            return item ? { ...item } : null;
          },
          async getCustomer(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedCustomers.get(id);
            return item ? normalizeCustomerRecord(id, item) : null;
          },
          async getPhoneIndex(hash) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPhoneIndex.get(hash);
            return item ? normalizePhoneIndexRecord(hash, item) : null;
          },
          async getInvoice(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedInvoices.get(id);
            return item ? normalizeInvoiceRecord(id, item) : null;
          },
          async getClientReservation(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedClientReservations.get(id);
            return item ? { ...item } : null;
          },
          setClientReservation(id, data) {
            writeStarted = true;
            stagedClientReservations.set(id, { id, ...data });
          },
          updateClientReservation(id, data) {
            writeStarted = true;
            const prev = stagedClientReservations.get(id) || {};
            stagedClientReservations.set(id, { id, ...prev, ...data });
          },
          async getPaymentTransaction(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPaymentTransactions.get(id);
            return item ? normalizePaymentTransactionRecord(id, item) : null;
          },
          async getBookingRequest(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookingRequests.get(id);
            return item ? normalizeBookingRequestRecord(id, item) : null;
          },
          async getBookingRequestOffer(requestId, offerId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookingRequestOffers.get(String(offerId || '').trim());
            if (!item || item.requestId !== requestId) return null;
            return { ...item };
          },
          async getPaymentEvidenceLock(invoiceId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPaymentEvidenceLocks.get(invoiceId);
            return item ? { ...item } : null;
          },
          async getPaymentEvidence(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPaymentEvidence.get(id);
            return item ? normalizePaymentEvidenceRecord(id, item) : null;
          },
          async getRefundCase(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedRefundCases.get(id);
            return item ? { ...item } : null;
          },
          async getInvoiceAdjustment(invoiceId, adjustmentId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedInvoiceAdjustments.get(`${invoiceId}__${adjustmentId}`);
            return item ? normalizeInvoiceAdjustmentRecord(adjustmentId, item) : null;
          },
          async getBookingPolicies() {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            return bookingPolicies ? { ...bookingPolicies } : null;
          },
          async listPendingPaymentEvidenceForInvoice(invoiceId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            return Array.from(stagedPaymentEvidence.values())
              .filter((ev) => ev && ev.invoiceId === invoiceId && ev.status === 'pending_review')
              .map((ev) => ({ ...ev }));
          },
          async listTransactionsForInvoice(invoiceId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            return Array.from(stagedPaymentTransactions.values())
              .filter((t) => t && t.invoiceId === invoiceId)
              .map((t) => normalizePaymentTransactionRecord(t.id, t));
          },
          setBooking(id, data) {
            writeStarted = true;
            touchedBookingIds.add(id);
            stagedRawCommissionSnapshots.set(
              id,
              'commissionSnapshot' in data ? (data.commissionSnapshot ?? null) : null,
            );
            stagedRawBookings.set(id, { id, ...data });
            stagedBookings.set(id, normalizeBookingRecord(id, data));
          },
          updateBooking(id, data) {
            writeStarted = true;
            touchedBookingIds.add(id);
            const prevBooking = stagedBookings.get(id) || stagedRawBookings.get(id) || {};
            const prevRaw = stagedRawBookings.get(id) || {};
            if ('commissionSnapshot' in data) {
              stagedRawCommissionSnapshots.set(id, data.commissionSnapshot ?? null);
            }
            stagedRawBookings.set(id, { id, ...prevRaw, ...data });
            stagedBookings.set(id, normalizeBookingRecord(id, { ...prevBooking, ...data }));
          },
          setSlot(id, data) {
            writeStarted = true;
            stagedSlots.set(id, { id, ...data });
          },
          deleteSlot(id) {
            writeStarted = true;
            stagedSlots.delete(id);
          },
          setEvent(id, data) {
            writeStarted = true;
            touchedBookingIds.add(data.bookingId);
            stagedEvents.set(id, normalizeBookingEventRecord(id, data));
          },
          setCustomer(id, data) {
            writeStarted = true;
            stagedCustomers.set(id, normalizeCustomerRecord(id, data));
          },
          updateCustomer(id, data) {
            writeStarted = true;
            const prev = stagedCustomers.get(id) || {};
            stagedCustomers.set(id, normalizeCustomerRecord(id, { ...prev, ...data }));
          },
          setPhoneIndex(hash, data) {
            writeStarted = true;
            stagedPhoneIndex.set(hash, normalizePhoneIndexRecord(hash, data));
          },
          setInvoice(id, data) {
            writeStarted = true;
            stagedInvoices.set(id, normalizeInvoiceRecord(id, data));
          },
          updateInvoice(id, data) {
            writeStarted = true;
            const prev = stagedInvoices.get(id) || {};
            stagedInvoices.set(id, normalizeInvoiceRecord(id, { ...prev, ...data }));
          },
          setInvoiceAdjustment(invoiceId, adjustmentId, data) {
            writeStarted = true;
            stagedInvoiceAdjustments.set(
              `${invoiceId}__${adjustmentId}`,
              normalizeInvoiceAdjustmentRecord(adjustmentId, data),
            );
          },
          setPaymentTransaction(id, data) {
            writeStarted = true;
            stagedPaymentTransactions.set(id, normalizePaymentTransactionRecord(id, data));
          },
          setPaymentEvidence(id, data) {
            writeStarted = true;
            stagedPaymentEvidence.set(id, normalizePaymentEvidenceRecord(id, data));
          },
          setPublicAvailability(id, data) {
            writeStarted = true;
            const norm = normalizePublicAvailabilityRecord(id, data);
            if (norm) {
              const cleanPayload = {
                schemaVersion: norm.schemaVersion,
                date: norm.date,
                studioId: norm.studioId,
                startMinute: norm.startMinute,
                endMinute: norm.endMinute,
                updatedAt: norm.updatedAt,
              };
              stagedPublicAvailability.set(id, { id, ...cleanPayload });
            }
          },
          deletePublicAvailability(id) {
            writeStarted = true;
            stagedPublicAvailability.delete(id);
          },
          updateBookingRequest(id, data) {
            writeStarted = true;
            touchedRequestIds.add(id);
            const prev = stagedBookingRequests.get(id) || {};
            const nowIso = new Date().toISOString();
            stagedBookingRequests.set(
              id,
              normalizeBookingRequestRecord(id, {
                ...prev,
                ...data,
                confirmedAt: data.confirmedAt ? nowIso : prev.confirmedAt,
                updatedAt: nowIso,
              }),
            );
          },
          setBookingRequestActivity(requestId, eventId, data) {
            writeStarted = true;
            touchedRequestIds.add(requestId);
            const nowIso = new Date().toISOString();
            stagedBookingRequestActivities.set(eventId, {
              requestId,
              ...normalizeActivityEvent(eventId, { ...data, createdAt: nowIso }),
            });
          },
          setBookingRequestOffer(requestId, offerId, data) {
            writeStarted = true;
            touchedRequestIds.add(requestId);
            touchedOfferRequestIds.add(requestId);
            const nowIso = new Date().toISOString();
            stagedBookingRequestOffers.set(
              offerId,
              normalizeOfferRecord(offerId, {
                ...data,
                requestId,
                createdAt: data.createdAt?.seconds ? data.createdAt : nowIso,
                updatedAt: nowIso,
              }),
            );
          },
          updateBookingRequestOffer(requestId, offerId, data) {
            writeStarted = true;
            touchedRequestIds.add(requestId);
            touchedOfferRequestIds.add(requestId);
            const prev = stagedBookingRequestOffers.get(offerId) || {};
            const nowIso = new Date().toISOString();
            stagedBookingRequestOffers.set(
              offerId,
              normalizeOfferRecord(offerId, {
                ...prev,
                ...data,
                requestId,
                updatedAt: nowIso,
              }),
            );
          },
          setPaymentEvidenceLock(invoiceId, data) {
            writeStarted = true;
            stagedPaymentEvidenceLocks.set(invoiceId, { id: invoiceId, ...data });
          },
          setRefundCase(refundId, data) {
            writeStarted = true;
            stagedRefundCases.set(refundId, { id: refundId, ...data });
          },
        };

        const result = await transactionWork(txContext);

        // Commit staged changes atomically
        bookings.clear();
        for (const [k, v] of stagedBookings) bookings.set(k, v);
        rawBookings.clear();
        for (const [k, v] of stagedRawBookings) rawBookings.set(k, v);
        rawCommissionSnapshots.clear();
        for (const [k, v] of stagedRawCommissionSnapshots) rawCommissionSnapshots.set(k, v);
        slots.clear();
        for (const [k, v] of stagedSlots) slots.set(k, v);
        publicAvailability.clear();
        for (const [k, v] of stagedPublicAvailability) publicAvailability.set(k, v);
        events.clear();
        for (const [k, v] of stagedEvents) events.set(k, v);
        customers.clear();
        for (const [k, v] of stagedCustomers) customers.set(k, v);
        phoneIndex.clear();
        for (const [k, v] of stagedPhoneIndex) phoneIndex.set(k, v);
        invoices.clear();
        for (const [k, v] of stagedInvoices) invoices.set(k, v);
        invoiceAdjustments.clear();
        for (const [k, v] of stagedInvoiceAdjustments) invoiceAdjustments.set(k, v);
        paymentTransactions.clear();
        for (const [k, v] of stagedPaymentTransactions) paymentTransactions.set(k, v);
        paymentEvidence.clear();
        for (const [k, v] of stagedPaymentEvidence) paymentEvidence.set(k, v);
        paymentEvidenceLocks.clear();
        for (const [k, v] of stagedPaymentEvidenceLocks) paymentEvidenceLocks.set(k, v);
        refundCases.clear();
        for (const [k, v] of stagedRefundCases) refundCases.set(k, v);
        clientReservations.clear();
        for (const [k, v] of stagedClientReservations) clientReservations.set(k, v);
        bookingRequests.clear();
        for (const [k, v] of stagedBookingRequests) bookingRequests.set(k, v);
        bookingRequestActivities.clear();
        for (const [k, v] of stagedBookingRequestActivities) bookingRequestActivities.set(k, v);
        bookingRequestOffers.clear();
        for (const [k, v] of stagedBookingRequestOffers) bookingRequestOffers.set(k, v);

        notifyRangeSubscribers();
        notifyDepositHolds();
        notifyPublicAvailabilitySubscribers();
        notifyCustomerSubscribers();
        notifyInvoiceSubscribers();
        for (const [invId, listeners] of invoiceAdjustmentSubscribers.entries()) {
          const items = Array.from(invoiceAdjustments.values())
            .filter((adj) => adj && adj.invoiceId === invId)
            .map((adj) => normalizeInvoiceAdjustmentRecord(adj.id, adj))
            .sort((a, b) => {
              const diff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
              if (diff !== 0) return diff;
              return String(b.id || '').localeCompare(String(a.id || ''));
            });
          for (const cb of listeners) {
            cb?.(items);
          }
        }
        notifyTransactionSubscribers();
        notifyClientReservations();
        for (const listener of paymentEvidenceSubscribers) {
          listener();
        }
        notifyCommissionSubscribers();
        notifyBookkeepingSubscribers();
        for (const bId of touchedBookingIds) {
          notifyEventSubscribers(bId);
        }
        if (touchedRequestIds.size > 0) {
          for (const reqId of touchedRequestIds) {
            notifyBookingRequests(reqId);
          }
        }
        if (touchedOfferRequestIds.size > 0) {
          for (const reqId of touchedOfferRequestIds) {
            notifyBookingOffers(reqId);
          }
        }

        return result;
      });
    },

    subscribeClientReservations({
      clientUid = '',
      customerId = '',
      maxLimit = 100,
      onData,
      onError,
    }) {
      const cleanClientUid = String(clientUid || '').trim();
      const cleanCustomerId = String(customerId || '').trim();
      if (!cleanClientUid && !cleanCustomerId) {
        queueMicrotask(() => onError?.(new Error('Missing Client identity for reservation subscription.')));
        return () => { };
      }

      const sub = {
        clientUid: cleanClientUid,
        customerId: cleanCustomerId,
        maxLimit: Math.max(1, Number(maxLimit) || 100),
        onData,
      };
      clientReservationSubscribers.add(sub);
      notifyClientReservations();
      return () => {
        clientReservationSubscribers.delete(sub);
      };
    },

    subscribeBookingsInRange({
      startDate,
      endDate,
      maxLimit = CALENDAR_BOOKINGS_QUERY_LIMIT,
      onData,
    }) {
      const sub = { startDate, endDate, maxLimit, onData };
      rangeSubscribers.add(sub);
      notifyRangeSubscribers();
      return () => {
        rangeSubscribers.delete(sub);
      };
    },

    subscribeBookingEvents({ bookingId, onData }) {
      if (!bookingId) {
        onData?.([]);
        return () => { };
      }
      if (!eventSubscribers.has(bookingId)) {
        eventSubscribers.set(bookingId, new Set());
      }
      const set = eventSubscribers.get(bookingId);
      set.add(onData);
      notifyEventSubscribers(bookingId);
      return () => {
        set.delete(onData);
      };
    },

    async getBookingPolicies() {
      return bookingPolicies ? { ...bookingPolicies } : null;
    },

    async listPendingPaymentEvidenceForInvoice(invoiceId) {
      return Array.from(paymentEvidence.values())
        .filter((ev) => ev && ev.invoiceId === invoiceId && ev.status === 'pending_review')
        .map((ev) => ({ ...ev }));
    },

    async listTransactionsForInvoice(invoiceId) {
      return Array.from(paymentTransactions.values())
        .filter((t) => t && t.invoiceId === invoiceId)
        .map((t) => normalizePaymentTransactionRecord(t.id, t));
    },

    subscribeDepositHoldBookings({ maxLimit = 100, onData }) {
      const sub = { maxLimit: Math.max(1, Number(maxLimit) || 100), onData };
      depositHoldSubscribers.add(sub);
      notifyDepositHolds();
      return () => {
        depositHoldSubscribers.delete(sub);
      };
    },
  };
}
