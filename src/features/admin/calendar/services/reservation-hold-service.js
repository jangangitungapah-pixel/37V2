/**
 * Reservation Hold Lifecycle Service (Phase 2 — Confirm Override, Extend Hold, Manual Expiry,
 * Pending-Evidence Shield, Late Restoration & Refund Case Handoff)
 * for 37 Music Studio.
 *
 * Strictly enforces:
 * - OD-01: Verified DP or authorized Staff/Owner confirmation override (with reason + audit)
 * - OD-02: Configurable TTL fail-closed, clamped before session start in Asia/Jakarta
 * - OD-04: No-deposit direct confirmation path
 * - OD-08: Hold extension Staff/Owner-only (reason, version guard, extensionCount increment)
 * - OD-09: Manual expiry blocked whenever payment evidence is `pending_review`
 * - OD-10: Late payment after expiry never silently resurrects; restores iff all slots free
 * - AD-05: Manual expiry only (zero Cloud Functions / cron / automatic expiry)
 */

import {
  BOOKING_REQUEST_ACTIVITY_TYPES,
  BOOKING_REQUEST_STATUS,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  buildActiveOfferSummary,
  OFFER_MODES,
  OFFER_STATUSES,
} from '@/features/admin/booking-requests/schemas/offer-schema';
import { computeInvoicePaymentTotals } from '@/features/admin/payment/utils/payment-calculation';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';
import { normalizeInvoiceRecord } from '@/features/admin/payment/schemas/payment-schema';
import { DEFAULT_BOOKING_POLICIES } from '@/features/admin/settings/booking-policies/config/booking-policies-config';
import {
  computeDepositStatus,
  DEPOSIT_STATUS,
  resolveEffectiveHoldDeadline,
} from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import { buildPublicAvailabilityProjectionFromBooking } from '@/features/public-availability/utils/public-availability-calculation';

import {
  BOOKING_EVENT_TYPES,
  BOOKING_SESSION_STATUS,
  CONFIRMATION_SOURCES,
  RESERVATION_STATUS,
} from '../config/calendar-config';
import {
  generateOperationId,
  getBookingRepositoryAdapter,
  normalizeBookingRecord,
} from '../repositories/calendar-booking-repository';
import { buildBookingSlotRecords } from '../utils/booking-time';
import {
  buildClientReservationProjection,
  createBookingServiceError,
  executeExpireHoldWritesInTx,
  finalizeBookingRequestInTx,
} from './calendar-booking-service';

function hasExplicitVersion(value) {
  return value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value));
}

function assertStaffActor(actorUid) {
  const cleanUid = String(actorUid || '').trim();
  if (!cleanUid) {
    throw createBookingServiceError(
      'booking/missing-actor',
      'Sesi staff tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return cleanUid;
}

function resolveBookingDepositMinimum(booking, invoice) {
  if (Number.isInteger(booking?.minimumDepositAmount)) {
    return booking.minimumDepositAmount;
  }
  if (Number.isInteger(invoice?.minimumDepositAmount)) {
    return invoice.minimumDepositAmount;
  }
  if (Number.isInteger(booking?.depositPolicySnapshot?.minimumDepositAmount)) {
    return booking.depositPolicySnapshot.minimumDepositAmount;
  }
  return 0;
}

function resolveBookingDepositType(booking, invoice) {
  return String(
    booking?.depositPolicySnapshot?.type ||
    invoice?.depositPolicySnapshot?.type ||
    (resolveBookingDepositMinimum(booking, invoice) > 0 ? 'fixed' : 'none'),
  );
}

/**
 * Explicitly confirms a `deposit_hold` booking (either under No-Deposit policy or via
 * authorized Staff/Owner below-minimum override with mandatory reason). (`TX-05`, `OD-01`, `OD-04`)
 */
export async function confirmReservation({
  bookingId,
  expectedVersion = null,
  confirmSource = CONFIRMATION_SOURCES.STAFF_OVERRIDE,
  reason = '',
  eventId = generateOperationId('evt'),
  actorUid,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanReason = String(reason || '').trim();

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking tidak valid.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingBooking, existingEvent, existingInvoice] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getInvoice?.(`inv_${cleanBookingId}`),
    ]);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    const requiredSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });
    const [existingBookingRequest, existingOffer, ...slotLocks] = await Promise.all([
      existingBooking.sourceRequestId && typeof tx.getBookingRequest === 'function'
        ? tx.getBookingRequest(existingBooking.sourceRequestId)
        : Promise.resolve(null),
      existingBooking.sourceRequestId &&
        existingBooking.acceptedOfferId &&
        typeof tx.getBookingRequestOffer === 'function'
        ? tx.getBookingRequestOffer(existingBooking.sourceRequestId, existingBooking.acceptedOfferId)
        : Promise.resolve(null),
      ...requiredSlots.map((slot) => tx.getSlot(slot.id)),
    ]);

    if (existingBooking.reservationStatus === RESERVATION_STATUS.CONFIRMED) {
      return existingBooking;
    }

    if (existingBooking.reservationStatus !== RESERVATION_STATUS.DEPOSIT_HOLD) {
      throw createBookingServiceError(
        'hold/not-in-hold',
        `Reservasi berstatus "${existingBooking.reservationStatus}" tidak dapat dikonfirmasi sebagai hold aktif.`,
      );
    }

    if (
      hasExplicitVersion(expectedVersion) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data reservasi baru saja berubah di sesi lain. Muat ulang sebelum mengonfirmasi.',
      );
    }

    const slotsIntact = slotLocks.every((lock) => lock && lock.bookingId === cleanBookingId);
    if (!slotsIntact) {
      throw createBookingServiceError(
        'hold/slot-integrity-error',
        'Kunci slot untuk deposit hold ini tidak lengkap atau telah dilepaskan.',
      );
    }

    const depositType = resolveBookingDepositType(existingBooking, existingInvoice);
    const minDeposit = resolveBookingDepositMinimum(existingBooking, existingInvoice);
    const netPaid = Math.max(0, Number(existingInvoice?.amountPaid ?? existingBooking.initialPaidAmount) || 0);
    const isDepositMet = depositType === 'none' || netPaid >= minDeposit;

    let effectiveSource = confirmSource;
    if (depositType === 'none') {
      effectiveSource = CONFIRMATION_SOURCES.NO_DEPOSIT_POLICY;
    } else if (netPaid >= minDeposit && confirmSource !== CONFIRMATION_SOURCES.STAFF_OVERRIDE) {
      effectiveSource = CONFIRMATION_SOURCES.DEPOSIT_VERIFIED;
    } else if (!isDepositMet) {
      effectiveSource = CONFIRMATION_SOURCES.STAFF_OVERRIDE;
      if (cleanReason.length < 5) {
        throw createBookingServiceError(
          'hold/override-reason-required',
          'Konfirmasi manual di bawah minimum DP wajib menyertakan alasan tertulis minimal 5 karakter.',
        );
      }
    }

    const nextDepositStatus =
      depositType === 'none'
        ? DEPOSIT_STATUS.NOT_REQUIRED
        : computeDepositStatus({
          depositType,
          minimumDepositAmount: minDeposit,
          amountPaid: netPaid,
        });

    const timestamp = tx.nowValue();
    const nextVersion = (Number(existingBooking.version) || 1) + 1;
    const confirmPatch = {
      reservationStatus: RESERVATION_STATUS.CONFIRMED,
      sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      holdExpiresAt: null,
      depositStatus: nextDepositStatus,
      confirmedAt: timestamp,
      confirmedByUid: cleanActorUid,
      confirmationSource: effectiveSource,
      confirmationOverrideReason:
        effectiveSource === CONFIRMATION_SOURCES.STAFF_OVERRIDE ? cleanReason : '',
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };

    const nextBookingState = { ...existingBooking, ...confirmPatch };
    delete nextBookingState.id;

    tx.updateBooking(cleanBookingId, confirmPatch);

    let latestInvoice = existingInvoice;
    if (existingInvoice && existingInvoice.depositStatus !== nextDepositStatus && typeof tx.updateInvoice === 'function') {
      const nextInv = {
        ...existingInvoice,
        depositStatus: nextDepositStatus,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingInvoice.version) || 1) + 1,
      };
      delete nextInv.id;
      tx.updateInvoice(existingInvoice.id, nextInv);
      latestInvoice = normalizeInvoiceRecord(existingInvoice.id, nextInv);
    }

    const projection = buildClientReservationProjection(
      { ...nextBookingState, id: cleanBookingId },
      latestInvoice,
      timestamp,
    );
    if (projection) {
      tx.setClientReservation?.(cleanBookingId, projection);
    }

    const pubProj = buildPublicAvailabilityProjectionFromBooking(nextBookingState, timestamp);
    if (pubProj) {
      tx.setPublicAvailability?.(cleanBookingId, pubProj);
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.RESERVATION_CONFIRMED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        reservationStatus: existingBooking.reservationStatus,
        sessionStatus: existingBooking.sessionStatus,
        depositStatus: existingBooking.depositStatus,
      },
      newValue: {
        reservationStatus: RESERVATION_STATUS.CONFIRMED,
        sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
        depositStatus: nextDepositStatus,
        confirmationSource: effectiveSource,
      },
      note:
        effectiveSource === CONFIRMATION_SOURCES.STAFF_OVERRIDE
          ? `Hold dikonfirmasi via Staff/Owner Override: ${cleanReason}`
          : effectiveSource === CONFIRMATION_SOURCES.NO_DEPOSIT_POLICY
            ? 'Reservasi dikonfirmasi langsung (kebijakan Tanpa DP).'
            : 'Reservasi terkonfirmasi otomatis setelah minimum DP terpenuhi.',
    });

    if (existingBookingRequest) {
      finalizeBookingRequestInTx(tx, {
        existingBookingRequest,
        existingOffer,
        bookingId: cleanBookingId,
        bookingDoc: nextBookingState,
        acceptedOfferId: existingBooking.acceptedOfferId || '',
        timestamp,
        actorUid: cleanActorUid,
        activityEventId: `reqact_conf_${cleanEventId}`,
      });
    }

    return normalizeBookingRecord(cleanBookingId, nextBookingState);
  });
}

/**
 * Staff/Owner-only hold deadline extension (`OD-08`, clamped strictly before session start in WIB).
 */
export async function extendReservationHold({
  bookingId,
  expectedVersion = null,
  extensionHours = null,
  newHoldExpiresAt = null,
  reason = '',
  bookingPolicies = null,
  eventId = generateOperationId('evt'),
  actorUid,
  now = new Date(),
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanReason = String(reason || '').trim();

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking tidak valid.');
  }
  if (cleanReason.length < 5 || cleanReason.length > 300) {
    throw createBookingServiceError(
      'hold/extension-reason-required',
      'Alasan perpanjangan masa hold wajib diisi 5–300 karakter.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingBooking, existingEvent, existingInvoice, remotePolicies] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getInvoice?.(`inv_${cleanBookingId}`),
      bookingPolicies
        ? Promise.resolve(bookingPolicies)
        : typeof tx.getBookingPolicies === 'function'
          ? tx.getBookingPolicies()
          : Promise.resolve(null),
    ]);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (existingBooking.reservationStatus !== RESERVATION_STATUS.DEPOSIT_HOLD) {
      throw createBookingServiceError(
        'hold/cannot-extend-terminal',
        `Masa hold hanya dapat diperpanjang saat berstatus deposit_hold (status saat ini: "${existingBooking.reservationStatus}").`,
      );
    }

    if (
      hasExplicitVersion(expectedVersion) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data reservasi telah berubah di sesi lain. Muat ulang sebelum memperpanjang hold.',
      );
    }

    const basePolicies = remotePolicies || DEFAULT_BOOKING_POLICIES;
    const deadlineResult = resolveEffectiveHoldDeadline({
      policies: {
        ...basePolicies,
        defaultHoldPolicy: {
          ...basePolicies.defaultHoldPolicy,
          allowPerBookingOverride: true,
        },
      },
      serviceTypeId: existingBooking.serviceTypeId || existingBooking.serviceId,
      serviceOptionId: existingBooking.serviceOptionId || '',
      bookingDate: existingBooking.date,
      startMinute: existingBooking.startMinute,
      baseDate: now,
      overrideHoldHours: extensionHours,
      overrideHoldExpiresAt: newHoldExpiresAt,
      overrideReason: cleanReason,
    });

    const timestamp = tx.nowValue();
    const holdExpiresTs = tx.timestampFromDate
      ? tx.timestampFromDate(deadlineResult.holdExpiresAtDate)
      : deadlineResult.holdExpiresAtIso;

    const nextExtensionCount = (Number(existingBooking.holdExtensionCount) || 0) + 1;
    const nextVersion = (Number(existingBooking.version) || 1) + 1;

    const extendPatch = {
      holdExpiresAt: holdExpiresTs,
      holdExtensionCount: nextExtensionCount,
      holdLastExtendedAt: timestamp,
      holdLastExtendedByUid: cleanActorUid,
      holdLastExtensionReason: cleanReason,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: nextVersion,
    };

    const nextBookingState = { ...existingBooking, ...extendPatch };
    delete nextBookingState.id;

    tx.updateBooking(cleanBookingId, extendPatch);

    const projection = buildClientReservationProjection(
      { ...nextBookingState, id: cleanBookingId },
      existingInvoice,
      timestamp,
    );
    if (projection) {
      tx.setClientReservation?.(cleanBookingId, projection);
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.HOLD_EXTENDED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        holdExpiresAt: existingBooking.holdExpiresAt ?? null,
        holdExtensionCount: existingBooking.holdExtensionCount || 0,
      },
      newValue: {
        holdExpiresAt: deadlineResult.holdExpiresAtIso,
        holdExtensionCount: nextExtensionCount,
        wasClamped: deadlineResult.wasClamped,
      },
      note: `Hold diperpanjang (#${nextExtensionCount}) hingga ${deadlineResult.holdExpiresAtIso}: ${cleanReason}`,
    });

    return normalizeBookingRecord(cleanBookingId, nextBookingState);
  });
}

/**
 * Staff/Owner manual Hold Expiry (`TX-06`, `OD-09`, `AD-05`).
 *
 * Strictly enforces:
 * - Zero pending_review payment evidence (`OD-09`: checked pre-tx + tx lock doc)
 * - Releases ALL 30m `bookingSlots` & removes `publicAvailability`
 * - If unpaid (`amountPaid === 0`): atomically voids `inv_{bookingId}`
 * - If paid/partially paid (`amountPaid > 0`): preserves ledger/evidence untouched & opens
 *   minimal `refundCases/{refundId}` review handoff (never auto-forfeits or auto-refunds).
 */
export async function expireReservationHold({
  bookingId,
  expectedVersion = null,
  reason = '',
  eventId = generateOperationId('evt'),
  refundId = '',
  actorUid,
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanReason = String(reason || '').trim();
  const deterministicInvoiceId = `inv_${cleanBookingId}`;
  const deterministicRefundId = String(refundId || '').trim() || `ref_${cleanBookingId}_expired`;

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking tidak valid.');
  }
  if (cleanReason.length < 5 || cleanReason.length > 300) {
    throw createBookingServiceError(
      'hold/expiry-reason-required',
      'Alasan manual expiry hold wajib diisi 5–300 karakter.',
    );
  }

  // Pre-tx query for any unreviewed Client Portal payment proof (`OD-09`) & payment history
  const [prePendingEvidence, preTransactions] = await Promise.all([
    typeof adapter.listPendingPaymentEvidenceForInvoice === 'function'
      ? adapter.listPendingPaymentEvidenceForInvoice(deterministicInvoiceId)
      : Promise.resolve([]),
    typeof adapter.listTransactionsForInvoice === 'function'
      ? adapter.listTransactionsForInvoice(deterministicInvoiceId)
      : Promise.resolve([]),
  ]);

  if (prePendingEvidence.length > 0) {
    throw createBookingServiceError(
      'hold/pending-evidence-exists',
      `Terdapat ${prePendingEvidence.length} bukti pembayaran berstatus "pending_review" yang belum ditinjau. Verifikasi atau tolak bukti pembayaran terlebih dahulu sebelum mengakhiri hold.`,
      {
        invoiceId: deterministicInvoiceId,
        pendingCount: prePendingEvidence.length,
        pendingEvidenceIds: prePendingEvidence.map((e) => e.id),
      },
    );
  }

  const candidateEvidenceIds = prePendingEvidence.map((e) => e.id).filter(Boolean);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [
      existingBooking,
      existingEvent,
      existingInvoice,
      existingLock,
      existingRefundCase,
      ...extraEvidenceSnaps
    ] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getInvoice?.(deterministicInvoiceId),
      typeof tx.getPaymentEvidenceLock === 'function'
        ? tx.getPaymentEvidenceLock(deterministicInvoiceId)
        : Promise.resolve(null),
      typeof tx.getRefundCase === 'function'
        ? tx.getRefundCase(deterministicRefundId)
        : Promise.resolve(null),
      ...candidateEvidenceIds.map((evId) =>
        typeof tx.getPaymentEvidence === 'function' ? tx.getPaymentEvidence(evId) : Promise.resolve(null),
      ),
    ]);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent || existingBooking.reservationStatus === RESERVATION_STATUS.EXPIRED) {
      return existingBooking;
    }

    if (existingBooking.reservationStatus === RESERVATION_STATUS.CONFIRMED) {
      throw createBookingServiceError(
        'hold/already-confirmed',
        'Reservasi ini sudah berstatus Confirmed dan tidak dapat di-expire.',
      );
    }

    if (existingBooking.reservationStatus !== RESERVATION_STATUS.DEPOSIT_HOLD) {
      throw createBookingServiceError(
        'hold/not-in-hold',
        `Reservasi berstatus "${existingBooking.reservationStatus}" tidak berada dalam masa hold aktif.`,
      );
    }

    if (
      hasExplicitVersion(expectedVersion) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data reservasi telah berubah di sesi lain. Muat ulang detail booking sebelum menandai expired.',
      );
    }

    // Re-check pending-evidence shield atomically inside transaction (`OD-09`)
    const lockPendingCount = Number(existingLock?.pendingCount) || 0;
    const lockIds = existingLock?.pendingEvidenceIds || existingLock?.pendingIds || [];
    const anySnapStillPending = extraEvidenceSnaps.some((ev) => ev && ev.status === 'pending_review');
    if (lockPendingCount > 0 || lockIds.length > 0 || anySnapStillPending) {
      throw createBookingServiceError(
        'hold/pending-evidence-exists',
        'Masih ada bukti pembayaran yang menunggu review pada invoice ini. Verifikasi atau tolak bukti terlebih dahulu.',
        {
          invoiceId: deterministicInvoiceId,
          pendingCount: Math.max(lockPendingCount, (existingLock?.pendingIds || []).length, 1),
        },
      );
    }

    const ownedSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });
    const [existingBookingRequest, existingOffer, ...slotLocks] = await Promise.all([
      existingBooking.sourceRequestId && typeof tx.getBookingRequest === 'function'
        ? tx.getBookingRequest(existingBooking.sourceRequestId)
        : Promise.resolve(null),
      existingBooking.sourceRequestId &&
        existingBooking.acceptedOfferId &&
        typeof tx.getBookingRequestOffer === 'function'
        ? tx.getBookingRequestOffer(existingBooking.sourceRequestId, existingBooking.acceptedOfferId)
        : Promise.resolve(null),
      ...ownedSlots.map((s) => tx.getSlot(s.id)),
    ]);

    // 2. ALL WRITES AFTER READS
    const timestamp = tx.nowValue();
    const expiredRecord = executeExpireHoldWritesInTx(tx, {
      bookingId: cleanBookingId,
      existingBooking,
      existingInvoice,
      existingRefundCase,
      ownedSlots,
      slotLocks,
      preTransactions,
      reason: cleanReason,
      actorUid: cleanActorUid,
      timestamp,
      eventId: cleanEventId,
      refundId: deterministicRefundId,
    });

    if (
      existingBookingRequest &&
      !existingBookingRequest.linkedBookingId &&
      existingOffer &&
      existingOffer.status === OFFER_STATUSES.SENT &&
      existingOffer.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
    ) {
      const rawOffer = existingOffer._raw || existingOffer;
      const updatedOfferDoc = {
        ...rawOffer,
        status: OFFER_STATUSES.EXPIRED,
        respondedAt: timestamp,
        respondedByUid: cleanActorUid,
        withdrawalOrExpiryReason: cleanReason,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingOffer.version) || 1) + 1,
      };
      delete updatedOfferDoc.id;
      delete updatedOfferDoc._raw;
      tx.updateBookingRequestOffer?.(existingBookingRequest.id, existingOffer.id, updatedOfferDoc);

      const baseSummary = buildActiveOfferSummary({
        ...existingOffer,
        status: OFFER_STATUSES.EXPIRED,
      });
      if (existingBookingRequest.status === BOOKING_REQUEST_STATUS.OFFER_SENT) {
        tx.updateBookingRequest?.(existingBookingRequest.id, {
          status: BOOKING_REQUEST_STATUS.IN_REVIEW,
          activeOfferSummary: {
            ...baseSummary,
            holdExpiresAt: rawOffer.holdDeadline ?? existingOffer.holdDeadline ?? null,
            offerExpiresAt: rawOffer.offerExpiresAt ?? existingOffer.offerExpiresAt ?? null,
          },
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
          version: (Number(existingBookingRequest.version) || 1) + 1,
        });
      }

      tx.setBookingRequestActivity?.(existingBookingRequest.id, `reqact_exp_${cleanEventId}`, {
        eventType: BOOKING_REQUEST_ACTIVITY_TYPES.OFFER_EXPIRED,
        fromStatus: existingBookingRequest.status,
        toStatus: BOOKING_REQUEST_STATUS.IN_REVIEW,
        linkedBookingId: null,
        note: `${existingOffer.offerNumber} & Deposit Hold berakhir: ${cleanReason}`.slice(0, 500),
        actorUid: cleanActorUid,
        actorName: '',
        createdAt: timestamp,
      });
    }

    return expiredRecord;
  });
}

/**
 * Staff/Owner explicit restoration of an `expired` reservation (`OD-10`).
 * Performs a live atomic check across EVERY target 30-minute `bookingSlots` document
 * BEFORE committing any writes; aborts cleanly on conflict without silent resurrection.
 */
export async function restoreExpiredReservation({
  bookingId,
  expectedVersion = null,
  reason = '',
  extensionHours = null,
  newHoldExpiresAt = null,
  bookingPolicies = null,
  eventId = generateOperationId('evt'),
  actorUid,
  now = new Date(),
  adapter = getBookingRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  const cleanEventId = String(eventId || '').trim() || generateOperationId('evt');
  const cleanReason = String(reason || '').trim();

  if (!cleanBookingId) {
    throw createBookingServiceError('booking/not-found', 'ID booking tidak valid.');
  }
  if (cleanReason.length < 5 || cleanReason.length > 300) {
    throw createBookingServiceError(
      'hold/restore-reason-required',
      'Alasan pemulihan reservasi expired wajib diisi 5–300 karakter.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const requiredSlotsBase = [];
    // Read canonical doc, event, invoice, and policies first
    const [existingBooking, existingEvent, existingInvoice, remotePolicies] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getEvent(cleanEventId),
      tx.getInvoice?.(`inv_${cleanBookingId}`),
      bookingPolicies
        ? Promise.resolve(bookingPolicies)
        : typeof tx.getBookingPolicies === 'function'
          ? tx.getBookingPolicies()
          : Promise.resolve(null),
    ]);

    if (!existingBooking) {
      throw createBookingServiceError('booking/not-found', 'Data booking tidak ditemukan.');
    }

    if (existingEvent) {
      return existingBooking;
    }

    if (existingBooking.reservationStatus !== RESERVATION_STATUS.EXPIRED) {
      throw createBookingServiceError(
        'hold/not-expired',
        `Pemulihan hanya berlaku untuk reservasi berstatus expired (status saat ini: "${existingBooking.reservationStatus}").`,
      );
    }

    if (
      hasExplicitVersion(expectedVersion) &&
      existingBooking.version !== Number(expectedVersion)
    ) {
      throw createBookingServiceError(
        'booking/stale-update',
        'Data reservasi telah berubah di sesi lain. Muat ulang sebelum memulihkan.',
      );
    }

    const requiredSlots = buildBookingSlotRecords({
      bookingId: cleanBookingId,
      date: existingBooking.date,
      studioId: existingBooking.studioId,
      startMinute: existingBooking.startMinute,
      durationMinutes: existingBooking.durationMinutes,
    });
    requiredSlotsBase.push(...requiredSlots);

    const slotLocks = await Promise.all(requiredSlots.map((slot) => tx.getSlot(slot.id)));

    // Strict live slot verification (`OD-10`): if ANY slot taken -> ABORT!
    for (let i = 0; i < requiredSlots.length; i += 1) {
      const lock = slotLocks[i];
      if (lock && lock.bookingId !== cleanBookingId) {
        throw createBookingServiceError(
          'hold/restore-slot-conflict',
          'Slot jadwal sudah terpakai oleh booking lain. Pemulihan dibatalkan — arahkan pembayaran ke alur Refund / Credit.',
          {
            slotId: requiredSlots[i].id,
            conflictingBookingId: lock.bookingId,
          },
        );
      }
    }

    const depositType = resolveBookingDepositType(existingBooking, existingInvoice);
    const minDeposit = resolveBookingDepositMinimum(existingBooking, existingInvoice);
    const netPaid = Math.max(0, Number(existingInvoice?.amountPaid ?? existingBooking.initialPaidAmount) || 0);
    const isDepositSatisfied = depositType === 'none' || netPaid >= minDeposit;

    let restoredHoldTs = null;
    let deadlineMeta = null;
    if (!isDepositSatisfied) {
      const basePolicies = remotePolicies || DEFAULT_BOOKING_POLICIES;
      deadlineMeta = resolveEffectiveHoldDeadline({
        policies: {
          ...basePolicies,
          defaultHoldPolicy: {
            ...basePolicies.defaultHoldPolicy,
            allowPerBookingOverride: true,
          },
        },
        serviceTypeId: existingBooking.serviceTypeId || existingBooking.serviceId,
        serviceOptionId: existingBooking.serviceOptionId || '',
        bookingDate: existingBooking.date,
        startMinute: existingBooking.startMinute,
        baseDate: now,
        overrideHoldHours: extensionHours,
        overrideHoldExpiresAt: newHoldExpiresAt,
        overrideReason: extensionHours || newHoldExpiresAt ? cleanReason : '',
      });
    }

    // 2. WRITES AFTER ALL READS
    const timestamp = tx.nowValue();
    if (deadlineMeta) {
      restoredHoldTs = tx.timestampFromDate
        ? tx.timestampFromDate(deadlineMeta.holdExpiresAtDate)
        : deadlineMeta.holdExpiresAtIso;
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

    const nextReservationStatus = isDepositSatisfied
      ? RESERVATION_STATUS.CONFIRMED
      : RESERVATION_STATUS.DEPOSIT_HOLD;
    const nextSessionStatus = isDepositSatisfied
      ? BOOKING_SESSION_STATUS.UPCOMING
      : BOOKING_SESSION_STATUS.PENDING_CONFIRMATION;
    const nextDepositStatus =
      depositType === 'none'
        ? DEPOSIT_STATUS.NOT_REQUIRED
        : computeDepositStatus({
          depositType,
          minimumDepositAmount: minDeposit,
          amountPaid: netPaid,
        });

    const restorePatch = {
      reservationStatus: nextReservationStatus,
      sessionStatus: nextSessionStatus,
      holdExpiresAt: restoredHoldTs,
      depositStatus: nextDepositStatus,
      restoredAt: timestamp,
      restoredByUid: cleanActorUid,
      restorationReason: cleanReason,
      ...(isDepositSatisfied
        ? {
          confirmedAt: timestamp,
          confirmedByUid: cleanActorUid,
          confirmationSource:
            depositType === 'none'
              ? CONFIRMATION_SOURCES.NO_DEPOSIT_POLICY
              : CONFIRMATION_SOURCES.DEPOSIT_VERIFIED,
        }
        : {}),
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(existingBooking.version) || 1) + 1,
    };

    const nextBookingState = { ...existingBooking, ...restorePatch };
    delete nextBookingState.id;

    tx.updateBooking(cleanBookingId, restorePatch);

    const pubProj = buildPublicAvailabilityProjectionFromBooking(nextBookingState, timestamp);
    if (pubProj) {
      tx.setPublicAvailability?.(cleanBookingId, pubProj);
    }

    let latestInvoice = existingInvoice;
    if (existingInvoice && typeof tx.updateInvoice === 'function') {
      const shouldUnvoid = existingInvoice.invoiceStatus === INVOICE_STATUS.VOID && existingInvoice.amountPaid === 0;
      const totals = computeInvoicePaymentTotals({
        totalAmount: existingInvoice.financialSnapshot.totalAmount,
        currentAmountPaid: existingInvoice.amountPaid,
        deltaAmount: 0,
      });
      if (shouldUnvoid || existingInvoice.depositStatus !== nextDepositStatus) {
        const nextInvDoc = {
          ...existingInvoice,
          invoiceStatus: shouldUnvoid ? INVOICE_STATUS.ISSUED : existingInvoice.invoiceStatus,
          voidReason: shouldUnvoid ? '' : existingInvoice.voidReason,
          depositStatus: nextDepositStatus,
          paymentStatus: totals.paymentStatus,
          updatedAt: timestamp,
          updatedByUid: cleanActorUid,
          version: (Number(existingInvoice.version) || 1) + 1,
        };
        delete nextInvDoc.id;
        tx.updateInvoice(existingInvoice.id, nextInvDoc);
        latestInvoice = normalizeInvoiceRecord(existingInvoice.id, nextInvDoc);
      }
    }

    const projection = buildClientReservationProjection(
      { ...nextBookingState, id: cleanBookingId },
      latestInvoice,
      timestamp,
    );
    if (projection) {
      tx.setClientReservation?.(cleanBookingId, projection);
    }

    tx.setEvent(cleanEventId, {
      bookingId: cleanBookingId,
      eventType: BOOKING_EVENT_TYPES.RESERVATION_RESTORED,
      actorUid: cleanActorUid,
      createdAt: timestamp,
      previousValue: {
        reservationStatus: RESERVATION_STATUS.EXPIRED,
        sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
      },
      newValue: {
        reservationStatus: nextReservationStatus,
        sessionStatus: nextSessionStatus,
        holdExpiresAt: deadlineMeta?.holdExpiresAtIso || null,
      },
      note: `Reservasi dipulihkan dari expired (${nextReservationStatus}): ${cleanReason}`,
    });

    return normalizeBookingRecord(cleanBookingId, nextBookingState);
  });
}
