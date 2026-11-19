/**
 * Atomic Commission Posting Transaction Service for 37 Music Studio (Phase 9)
 *
 * Guarantees:
 * - Active Owner authorization enforced in service AND Firestore Rules
 * - All reads (`commissionBatch`, `bookkeepingEntries`, `bookings`, `commissionPostingItems`) before any writes
 * - Deterministic `commissionPostingItems/{bookingId}` prevents double posting across concurrent tabs/sessions
 * - Deterministic `bookkeepingEntries` (`bk_commission_{batchId}_staff`, `bk_commission_{batchId}_operator`)
 * - Strictly excludes Owner Allocation from payable expense accrual totals & entries
 * - Never modifies historical booking `commissionSnapshot`, invoices, payments, or customer records
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';

import { getCommissionRepositoryAdapter } from '../repositories/commission-repository';
import {
  BOOKKEEPING_CATEGORY,
  BOOKKEEPING_ENTRY_TYPE,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SOURCE_MODULE,
  BOOKKEEPING_SOURCE_TYPE,
  COMMISSION_BATCH_STATUS,
  COMMISSION_POSTING_ITEM_STATUS,
  COMMISSION_REVIEW_RESOLUTION_STATUS,
  MAX_BOOKINGS_PER_COMMISSION_BATCH,
  normalizeBookkeepingEntryRecord,
  normalizeCommissionBatchRecord,
  normalizeCommissionPostingItemRecord,
  normalizeCommissionReviewResolutionRecord,
  validateCommissionResolutionReason,
} from '../schemas/commission-schema';
import {
  buildCommissionBookkeepingEntryId,
  classifyBookingForCommission,
  COMMISSION_ITEM_STATUS,
} from '../utils/commission-calculation';
import { formatCommissionPeriodLabel, parseJakartaTimestamp } from '../utils/commission-period';

export function createCommissionServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

export function mapCommissionErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'commission/owner-only') {
    return error.message || 'Akses ditolak. Hanya Owner aktif yang dapat mem-posting komisi.';
  }

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi internet terputus. Periksa koneksi Anda lalu coba kembali dengan pilihan yang sama.';
  }

  if (
    code.startsWith('commission/') &&
    typeof error?.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return 'Gagal memproses posting komisi ke Pembukuan. Muat ulang halaman lalu coba kembali.';
}

function assertActiveOwnerActor({ actorUid, actorRole }) {
  const cleanUid = String(actorUid || '').trim();
  const cleanRole = String(actorRole || '')
    .trim()
    .toLowerCase();

  if (!cleanUid) {
    throw createCommissionServiceError(
      'commission/missing-actor',
      'Sesi login tidak valid. Silakan login kembali sebagai Owner.',
    );
  }

  if (cleanRole !== 'owner') {
    throw createCommissionServiceError(
      'commission/owner-only',
      'Owner Access Required — hanya Owner aktif yang dapat melakukan posting komisi ke Pembukuan.',
    );
  }

  return cleanUid;
}

/**
 * Posts one batch of reviewed completed studio sessions into:
 * - `commissionBatches/{batchId}`
 * - `commissionPostingItems/{bookingId}` (deterministic per booking)
 * - `bookkeepingEntries/bk_commission_{batchId}_staff` (when staff payable > 0)
 * - `bookkeepingEntries/bk_commission_{batchId}_operator` (when operator payable > 0)
 */
export async function postCommissionBatch({
  batchId = generateOperationId('cbt'),
  actorUid,
  actorRole,
  periodStart,
  periodEnd,
  periodLabel = '',
  selectedBookings = [],
  adapter = getCommissionRepositoryAdapter(),
}) {
  const cleanActorUid = assertActiveOwnerActor({ actorUid, actorRole });
  const cleanBatchId = String(batchId || '').trim() || generateOperationId('cbt');
  const cleanPeriodStart = String(periodStart || '').trim();
  const cleanPeriodEnd = String(periodEnd || '').trim();

  if (!cleanPeriodStart || !cleanPeriodEnd) {
    throw createCommissionServiceError(
      'commission/invalid-period',
      'Periode review komisi wajib ditentukan sebelum posting.',
    );
  }

  if (!Array.isArray(selectedBookings) || selectedBookings.length === 0) {
    throw createCommissionServiceError(
      'commission/empty-selection',
      'Pilih minimal satu sesi selesai yang siap diposting.',
    );
  }

  if (selectedBookings.length > MAX_BOOKINGS_PER_COMMISSION_BATCH) {
    throw createCommissionServiceError(
      'commission/batch-limit-exceeded',
      `Maksimal ${MAX_BOOKINGS_PER_COMMISSION_BATCH} sesi per sekali posting. Bagi ke dalam beberapa batch agar transaksi tetap aman.`,
    );
  }

  const cleanSelections = selectedBookings.map((item) => ({
    bookingId: String(item?.bookingId || item?.id || '').trim(),
    expectedVersion: item?.expectedVersion !== undefined ? Number(item.expectedVersion) : undefined,
    expectedSnapshotSignature: String(item?.expectedSnapshotSignature || '').trim(),
  }));

  const bookingIds = cleanSelections.map((s) => s.bookingId);
  if (bookingIds.some((id) => !id)) {
    throw createCommissionServiceError(
      'commission/invalid-selection',
      'Terdapat ID booking yang tidak valid dalam pilihan.',
    );
  }

  if (new Set(bookingIds).size !== bookingIds.length) {
    throw createCommissionServiceError(
      'commission/duplicate-selection',
      'Terdapat booking ganda dalam satu batch posting.',
    );
  }

  const staffEntryId = buildCommissionBookkeepingEntryId(cleanBatchId, 'staff');
  const operatorEntryId = buildCommissionBookkeepingEntryId(cleanBatchId, 'operator');
  const resolvedPeriodLabel =
    String(periodLabel || '').trim() ||
    formatCommissionPeriodLabel(cleanPeriodStart, cleanPeriodEnd);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS BEFORE ANY WRITES
    const [existingBatch, existingStaffEntry, existingOperatorEntry, ...bookingAndPostingReads] =
      await Promise.all([
        tx.getCommissionBatch(cleanBatchId),
        tx.getBookkeepingEntry(staffEntryId),
        tx.getBookkeepingEntry(operatorEntryId),
        ...bookingIds.map((id) => tx.getBooking(id)),
        ...bookingIds.map((id) => tx.getCommissionPostingItem(id)),
      ]);

    const bookingCountInput = bookingIds.length;
    const loadedBookings = bookingAndPostingReads.slice(0, bookingCountInput);
    const loadedPostingItems = bookingAndPostingReads.slice(bookingCountInput);

    // Strict Idempotency Replay check for retry with the exact same pre-generated batchId
    if (existingBatch) {
      const allItemsMatchBatch = loadedPostingItems.every(
        (item) => item && item.batchId === cleanBatchId,
      );

      if (
        existingBatch.postedByUid === cleanActorUid &&
        existingBatch.bookingCount === bookingCountInput &&
        allItemsMatchBatch
      ) {
        const createdEntries = [existingStaffEntry, existingOperatorEntry].filter(Boolean);
        return {
          batch: existingBatch,
          postingItems: loadedPostingItems,
          bookkeepingEntries: createdEntries,
          idempotentReplay: true,
        };
      }

      throw createCommissionServiceError(
        'commission/batch-conflict',
        'ID batch posting ini sudah dipakai oleh transaksi lain. Silakan muat ulang dan buat konfirmasi baru.',
      );
    }

    if (existingStaffEntry || existingOperatorEntry) {
      throw createCommissionServiceError(
        'commission/bookkeeping-entry-conflict',
        'ID catatan pembukuan untuk batch ini sudah dipakai. Silakan coba ulang konfirmasi posting.',
      );
    }

    // 2. VALIDATION PHASE
    let staffCommissionTotal = 0;
    let recordingOperatorFeeTotal = 0;
    let ownerAllocationReferenceTotal = 0;
    let latestCompletedMillis = 0;
    let latestCompletedTimestamp = null;

    const preparedItems = [];

    for (let i = 0; i < bookingCountInput; i++) {
      const sel = cleanSelections[i];
      const booking = loadedBookings[i];
      const existingPosting = loadedPostingItems[i];

      if (!booking) {
        throw createCommissionServiceError(
          'commission/booking-not-found',
          `Booking ${sel.bookingId} tidak ditemukan di database.`,
        );
      }

      if (existingPosting) {
        throw createCommissionServiceError(
          'commission/already-posted',
          `Sebagian booking yang dipilih (${booking.customerName || booking.id}) sudah diposting oleh sesi lain. Data review perlu dimuat ulang.`,
        );
      }

      if (booking.sessionStatus !== BOOKING_SESSION_STATUS.COMPLETED) {
        throw createCommissionServiceError(
          'commission/booking-not-completed',
          `Sesi booking ${booking.customerName || booking.id} tidak lagi berstatus Completed (${booking.sessionStatus}). Muat ulang review sebelum mem-posting.`,
        );
      }

      if (
        sel.expectedVersion !== undefined &&
        Number.isInteger(sel.expectedVersion) &&
        Number(booking.version) !== sel.expectedVersion
      ) {
        throw createCommissionServiceError(
          'commission/stale-review',
          `Data booking ${booking.customerName || booking.id} telah berubah sejak review dibuka. Muat ulang review sebelum mem-posting.`,
        );
      }

      const classified = classifyBookingForCommission(booking, {
        postingItem: null,
        periodBounds: null,
      });

      if (classified.status !== COMMISSION_ITEM_STATUS.PENDING) {
        throw createCommissionServiceError(
          'commission/not-eligible',
          classified.reason ||
            `Booking ${booking.customerName || booking.id} tidak memenuhi syarat posting.`,
        );
      }

      if (
        sel.expectedSnapshotSignature &&
        classified.snapshotSignature !== sel.expectedSnapshotSignature
      ) {
        throw createCommissionServiceError(
          'commission/stale-review',
          `Rincian komisi untuk ${booking.customerName || booking.id} telah berubah. Muat ulang review terlebih dahulu.`,
        );
      }

      const tsInfo = parseJakartaTimestamp(booking.actualCompletedAt);
      if (tsInfo.millis >= latestCompletedMillis) {
        latestCompletedMillis = tsInfo.millis;
        latestCompletedTimestamp = booking.actualCompletedAt;
      }

      staffCommissionTotal += classified.staffPayableAmount;
      recordingOperatorFeeTotal += classified.recordingOperatorPayableAmount;
      ownerAllocationReferenceTotal += classified.ownerAllocationReference;

      const rawSnapshot =
        'rawCommissionSnapshot' in booking
          ? booking.rawCommissionSnapshot
          : booking.commissionSnapshot;

      preparedItems.push({
        bookingId: booking.id,
        customerSnapshot: {
          name: String(booking.customerName || 'Pelanggan Studio').trim() || 'Pelanggan Studio',
          bandName: String(booking.bandName || '').trim(),
        },
        completedAt: booking.actualCompletedAt,
        serviceSnapshot: {
          serviceTypeId: classified.serviceInfo.serviceTypeId,
          serviceTypeName: classified.serviceInfo.serviceTypeName,
          serviceOptionName: classified.serviceInfo.serviceOptionName,
        },
        // Exact historical snapshot matching booking document (V1 or V2)
        commissionSnapshot: rawSnapshot,
        staffPayableAmount: classified.staffPayableAmount,
        recordingOperatorPayableAmount: classified.recordingOperatorPayableAmount,
        ownerAllocationReference: classified.ownerAllocationReference,
        payableTotal: classified.payableTotal,
      });
    }

    const payableTotal = staffCommissionTotal + recordingOperatorFeeTotal;
    if (payableTotal <= 0) {
      throw createCommissionServiceError(
        'commission/zero-payable',
        'Total komisi yang harus dibayarkan ke Staff atau Operator bernilai Rp 0 sehingga tidak perlu diposting ke Pembukuan.',
      );
    }

    // 3. ALL WRITES AFTER ALL READS
    const now = tx.nowValue();
    const bookkeepingEntryIds = [];
    if (staffCommissionTotal > 0) {
      bookkeepingEntryIds.push(staffEntryId);
    }
    if (recordingOperatorFeeTotal > 0) {
      bookkeepingEntryIds.push(operatorEntryId);
    }

    const batchDoc = {
      periodStart: cleanPeriodStart,
      periodEnd: cleanPeriodEnd,
      completionTimeZone: 'Asia/Jakarta',
      bookingCount: preparedItems.length,
      staffCommissionTotal,
      recordingOperatorFeeTotal,
      payableTotal,
      ownerAllocationReferenceTotal,
      currency: 'IDR',
      status: COMMISSION_BATCH_STATUS.POSTED,
      bookkeepingEntryIds,
      postedAt: now,
      postedByUid: cleanActorUid,
      createdAt: now,
      createdByUid: cleanActorUid,
    };

    tx.setCommissionBatch(cleanBatchId, batchDoc);

    const committedPostingItems = preparedItems.map((item) => {
      const itemDoc = {
        batchId: cleanBatchId,
        bookingId: item.bookingId,
        customerSnapshot: item.customerSnapshot,
        completedAt: item.completedAt,
        serviceSnapshot: item.serviceSnapshot,
        commissionSnapshot: item.commissionSnapshot,
        staffPayableAmount: item.staffPayableAmount,
        recordingOperatorPayableAmount: item.recordingOperatorPayableAmount,
        ownerAllocationReference: item.ownerAllocationReference,
        payableTotal: item.payableTotal,
        currency: 'IDR',
        status: COMMISSION_POSTING_ITEM_STATUS.POSTED,
        postedAt: now,
        postedByUid: cleanActorUid,
        createdAt: now,
      };
      tx.setCommissionPostingItem(item.bookingId, itemDoc);
      return normalizeCommissionPostingItemRecord(item.bookingId, itemDoc);
    });

    const committedBookkeepingEntries = [];
    const occurredAt = latestCompletedTimestamp || now;

    if (staffCommissionTotal > 0) {
      const staffEntryDoc = {
        sourceModule: BOOKKEEPING_SOURCE_MODULE,
        sourceType: BOOKKEEPING_SOURCE_TYPE,
        sourceId: cleanBatchId,
        entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
        category: BOOKKEEPING_CATEGORY.STAFF_COMMISSION,
        description: `Staff Commission — ${resolvedPeriodLabel}`.slice(0, 200),
        amount: staffCommissionTotal,
        currency: 'IDR',
        settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
        occurredAt,
        postedAt: now,
        createdAt: now,
        createdByUid: cleanActorUid,
      };
      tx.setBookkeepingEntry(staffEntryId, staffEntryDoc);
      committedBookkeepingEntries.push(
        normalizeBookkeepingEntryRecord(staffEntryId, staffEntryDoc),
      );
    }

    if (recordingOperatorFeeTotal > 0) {
      const operatorEntryDoc = {
        sourceModule: BOOKKEEPING_SOURCE_MODULE,
        sourceType: BOOKKEEPING_SOURCE_TYPE,
        sourceId: cleanBatchId,
        entryType: BOOKKEEPING_ENTRY_TYPE.EXPENSE_ACCRUAL,
        category: BOOKKEEPING_CATEGORY.RECORDING_OPERATOR_FEE,
        description: `Recording Operator Fee — ${resolvedPeriodLabel}`.slice(0, 200),
        amount: recordingOperatorFeeTotal,
        currency: 'IDR',
        settlementStatus: BOOKKEEPING_SETTLEMENT_STATUS.UNPAID,
        occurredAt,
        postedAt: now,
        createdAt: now,
        createdByUid: cleanActorUid,
      };
      tx.setBookkeepingEntry(operatorEntryId, operatorEntryDoc);
      committedBookkeepingEntries.push(
        normalizeBookkeepingEntryRecord(operatorEntryId, operatorEntryDoc),
      );
    }

    return {
      batch: normalizeCommissionBatchRecord(cleanBatchId, batchDoc),
      postingItems: committedPostingItems,
      bookkeepingEntries: committedBookkeepingEntries,
      idempotentReplay: false,
    };
  });
}

/**
 * Explicitly acknowledges and dismisses a completed Needs Review booking (e.g. legacy Phase 5
 * bookings without a commission snapshot) into an immutable `commissionReviewResolutions/{bookingId}`
 * audit record without mutating historical booking data or generating fake bookkeeping entries.
 */
export async function resolveNeedsReviewBooking({
  bookingId,
  expectedVersion,
  reason,
  actorUid,
  actorRole,
  adapter = getCommissionRepositoryAdapter(),
}) {
  const cleanActorUid = assertActiveOwnerActor({ actorUid, actorRole });
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) {
    throw createCommissionServiceError('commission/booking-not-found', 'ID booking tidak valid.');
  }

  const reasonValidation = validateCommissionResolutionReason(reason);
  if (!reasonValidation.isValid) {
    throw createCommissionServiceError('commission/validation-error', reasonValidation.error, {
      reason: reasonValidation.error,
    });
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingBooking, existingPosting, existingResolution] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getCommissionPostingItem(cleanBookingId),
      tx.getCommissionReviewResolution(cleanBookingId),
    ]);

    if (existingResolution) {
      return {
        resolution: existingResolution,
        idempotentReplay: true,
      };
    }

    if (!existingBooking) {
      throw createCommissionServiceError(
        'commission/booking-not-found',
        'Data booking tidak ditemukan di database.',
      );
    }

    if (existingPosting) {
      throw createCommissionServiceError(
        'commission/already-posted',
        'Booking ini sudah masuk daftar posting Pembukuan.',
      );
    }

    if (existingBooking.sessionStatus !== BOOKING_SESSION_STATUS.COMPLETED) {
      throw createCommissionServiceError(
        'commission/booking-not-completed',
        'Hanya booking yang sudah selesai (Completed) yang dapat diselesaikan dari Needs Review.',
      );
    }

    if (
      expectedVersion !== undefined &&
      Number.isInteger(Number(expectedVersion)) &&
      Number(existingBooking.version) !== Number(expectedVersion)
    ) {
      throw createCommissionServiceError(
        'commission/stale-review',
        'Data booking telah berubah sejak halaman dibuka. Muat ulang halaman sebelum menyimpan.',
      );
    }

    const classified = classifyBookingForCommission(existingBooking, {
      postingItem: null,
      resolutionItem: null,
      periodBounds: null,
    });

    if (classified.status !== COMMISSION_ITEM_STATUS.NEEDS_REVIEW) {
      throw createCommissionServiceError(
        'commission/not-needs-review',
        'Booking ini sudah memiliki status komisi yang valid dan tidak lagi berada di Needs Review.',
      );
    }

    const now = tx.nowValue();
    const resolutionDoc = {
      bookingId: cleanBookingId,
      status: COMMISSION_REVIEW_RESOLUTION_STATUS.DISMISSED_NO_COMMISSION,
      reason: reasonValidation.reason,
      snapshotIssue: String(classified.reason || '').slice(0, 200),
      customerSnapshot: {
        name:
          String(existingBooking.customerName || 'Pelanggan Studio').trim() || 'Pelanggan Studio',
        bandName: String(existingBooking.bandName || '').trim(),
      },
      completedAt: existingBooking.actualCompletedAt,
      resolvedAt: now,
      resolvedByUid: cleanActorUid,
      createdAt: now,
    };

    tx.setCommissionReviewResolution(cleanBookingId, resolutionDoc);

    return {
      resolution: normalizeCommissionReviewResolutionRecord(cleanBookingId, resolutionDoc),
      idempotentReplay: false,
    };
  });
}
