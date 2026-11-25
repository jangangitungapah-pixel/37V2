/**
 * Legacy Booking Invoice & Initial Payment Reconciliation Service
 * for 37 Music Studio (Phase 8 — Payment & Bill Management).
 *
 * Strictly guarantees:
 * - Zero writes during preview scan (`scanLegacyBookingsForInvoicesPreview`)
 * - Bounded paginated scanning (`pageSize <= 200`, never unbounded full-collection fetch)
 * - Deterministic IDs (`inv_{bookingId}`, `pay_initial_{bookingId}`) -> 100% idempotent & resumable
 * - Zero double-counting of `booking.initialPaidAmount`
 * - Zero mutations to historical `bookings`, `bookingSlots`, `bookingEvents`, or `customers`
 * - Explicit `Needs Review` queue for inconsistent payment amounts or cancelled/no-show legacy bookings
 */

import {
  BOOKING_SESSION_STATUS,
  INITIAL_PAYMENT_STATUS,
} from '@/features/admin/calendar/config/calendar-config';
import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  getPaymentRepositoryAdapter,
  LEGACY_INVOICE_SCAN_PAGE_SIZE,
  MAX_PAYMENT_BATCH_WRITES,
} from '../repositories/payment-repository';
import { buildInvoiceDocumentFromBooking, normalizeInvoiceRecord } from '../schemas/payment-schema';
import { buildInitialPaymentId, buildInvoiceId } from '../utils/invoice-number';
import {
  PAYMENT_SOURCE,
  SUPPORTED_PAYMENT_METHODS,
  TRANSACTION_TYPE,
} from '../utils/invoice-status';
import { toNonNegativeRupiahInt } from '../utils/payment-calculation';
import { assertAuthenticatedPaymentActor, createPaymentServiceError } from './invoice-service';

export const LEGACY_RECONCILIATION_ISSUE = {
  CANCELLED_OR_NO_SHOW: 'cancelled_or_no_show',
  PAYMENT_AMOUNT_MISMATCH: 'payment_amount_mismatch',
};

/**
 * Classifies a legacy booking that has no invoice yet into either safely auto-importable
 * or explicit `Needs Review` (inconsistent initialPaymentStatus/amount OR cancelled/no-show).
 */
export function classifyLegacyBookingForInvoice(booking) {
  const totalAmount = toNonNegativeRupiahInt(booking?.totalAmount);
  const initialPaidAmount = toNonNegativeRupiahInt(booking?.initialPaidAmount);
  const status = String(booking?.initialPaymentStatus || INITIAL_PAYMENT_STATUS.UNPAID).trim();
  const sessionStatus = String(booking?.sessionStatus || BOOKING_SESSION_STATUS.UPCOMING).trim();

  const reasons = [];

  if (
    sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
    sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW
  ) {
    reasons.push({
      code: LEGACY_RECONCILIATION_ISSUE.CANCELLED_OR_NO_SHOW,
      message: `Status sesi booking adalah ${sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ? 'Cancelled' : 'No Show'} — tinjau apakah invoice perlu diterbitkan.`,
    });
  }

  let hasPaymentInconsistency = false;
  if (initialPaidAmount > totalAmount) {
    hasPaymentInconsistency = true;
    reasons.push({
      code: LEGACY_RECONCILIATION_ISSUE.PAYMENT_AMOUNT_MISMATCH,
      message: 'Nominal initialPaidAmount melebihi total tagihan booking.',
    });
  } else if (
    status === INITIAL_PAYMENT_STATUS.PAID &&
    totalAmount > 0 &&
    initialPaidAmount !== totalAmount
  ) {
    hasPaymentInconsistency = true;
    reasons.push({
      code: LEGACY_RECONCILIATION_ISSUE.PAYMENT_AMOUNT_MISMATCH,
      message: 'Status awal Paid tetapi initialPaidAmount tidak sama dengan total tagihan.',
    });
  } else if (
    status === INITIAL_PAYMENT_STATUS.PARTIAL &&
    (initialPaidAmount <= 0 || (totalAmount > 0 && initialPaidAmount >= totalAmount))
  ) {
    hasPaymentInconsistency = true;
    reasons.push({
      code: LEGACY_RECONCILIATION_ISSUE.PAYMENT_AMOUNT_MISMATCH,
      message:
        'Status awal Partial/DP tetapi initialPaidAmount tidak berada di antara Rp 0 dan total.',
    });
  } else if (status === INITIAL_PAYMENT_STATUS.UNPAID && initialPaidAmount > 0) {
    hasPaymentInconsistency = true;
    reasons.push({
      code: LEGACY_RECONCILIATION_ISSUE.PAYMENT_AMOUNT_MISMATCH,
      message: 'Status awal Unpaid tetapi initialPaidAmount lebih dari Rp 0.',
    });
  }

  return {
    isCancelledOrNoShow:
      sessionStatus === BOOKING_SESSION_STATUS.CANCELLED ||
      sessionStatus === BOOKING_SESSION_STATUS.NO_SHOW,
    hasPaymentInconsistency,
    needsReview: reasons.length > 0,
    reasons,
    totalAmount,
    initialPaidAmount,
    initialPaymentStatus: status,
  };
}

/**
 * Read-only paginated scan of historical bookings without an invoice.
 * Performs ZERO writes to Firestore.
 */
export async function scanLegacyBookingsForInvoicesPreview({
  pageSize = LEGACY_INVOICE_SCAN_PAGE_SIZE,
  maxPages = 20,
  adapter = getPaymentRepositoryAdapter(),
} = {}) {
  const allBookings = [];
  let cursor = null;
  let pagesScanned = 0;
  let truncatedScan = false;

  while (pagesScanned < maxPages) {
    const page = await adapter.listBookingsPage({ pageSize, cursor });
    allBookings.push(...(page.bookings || []));
    pagesScanned += 1;

    if (!page.hasMore || !page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
    if (pagesScanned >= maxPages) {
      truncatedScan = true;
    }
  }

  // Check existing invoices via deterministic document lookups in bounded chunks
  const candidateInvoiceIds = allBookings.map((b) => buildInvoiceId(b.id)).filter(Boolean);
  const existingInvoices = await adapter.getInvoicesByIds(candidateInvoiceIds);
  const existingInvoiceIdSet = new Set(existingInvoices.map((inv) => inv.id));

  let alreadyHasInvoiceCount = 0;
  let withInitialPaymentCount = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let paidCount = 0;
  let cancelledOrNoShowCount = 0;

  const importableBookings = [];
  const needsReviewItems = [];

  for (const booking of allBookings) {
    const invId = buildInvoiceId(booking.id);
    if (existingInvoiceIdSet.has(invId)) {
      alreadyHasInvoiceCount += 1;
      continue;
    }

    const classification = classifyLegacyBookingForInvoice(booking);

    if (classification.initialPaidAmount > 0) {
      withInitialPaymentCount += 1;
    }
    if (classification.initialPaymentStatus === INITIAL_PAYMENT_STATUS.PAID) {
      paidCount += 1;
    } else if (classification.initialPaymentStatus === INITIAL_PAYMENT_STATUS.PARTIAL) {
      partialCount += 1;
    } else {
      unpaidCount += 1;
    }

    if (classification.isCancelledOrNoShow) {
      cancelledOrNoShowCount += 1;
    }

    if (classification.needsReview) {
      needsReviewItems.push({
        booking,
        ...classification,
      });
    } else {
      importableBookings.push({
        booking,
        ...classification,
      });
    }
  }

  return {
    totalBookingsScanned: allBookings.length,
    alreadyHasInvoiceCount,
    totalWithoutInvoice: importableBookings.length + needsReviewItems.length,
    importableCount: importableBookings.length,
    withInitialPaymentCount,
    unpaidCount,
    partialCount,
    paidCount,
    cancelledOrNoShowCount,
    needsReviewCount: needsReviewItems.length,
    importableBookings,
    needsReviewItems,
    truncatedScan,
  };
}

/**
 * Creates deterministic invoices (and `legacy_initial_snapshot` payment transactions when `initialPaidAmount > 0`)
 * for all safely importable legacy bookings in resumable batches of at most `maxBatchWrites` (`<= 5`).
 *
 * Strictly never mutates `bookings`, `bookingSlots`, `bookingEvents`, or `customers`.
 */
export async function importLegacyBookingInvoices({
  actorUid,
  preview = null,
  maxBatchWrites = MAX_PAYMENT_BATCH_WRITES,
  onProgress = null,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const safeBatchSize = Math.max(
    2,
    Math.min(MAX_PAYMENT_BATCH_WRITES, Number(maxBatchWrites) || 5),
  );

  const activePreview = preview || (await scanLegacyBookingsForInvoicesPreview({ adapter }));
  const candidates = activePreview.importableBookings || [];

  if (candidates.length === 0) {
    return {
      createdInvoicesCount: 0,
      createdInitialPaymentsCount: 0,
      skippedAlreadyExistsCount: 0,
      batchesCommitted: 0,
    };
  }

  // Re-verify existence right before writing to guarantee strict idempotency on retry/resume
  const candidateIds = candidates.map((item) => buildInvoiceId(item.booking.id));
  const existingNow = await adapter.getInvoicesByIds(candidateIds);
  const existingSet = new Set(existingNow.map((inv) => inv.id));

  const operations = [];
  let createdInvoicesCount = 0;
  let createdInitialPaymentsCount = 0;
  let skippedAlreadyExistsCount = 0;

  for (const item of candidates) {
    const booking = item.booking;
    const invoiceId = buildInvoiceId(booking.id);
    if (existingSet.has(invoiceId)) {
      skippedAlreadyExistsCount += 1;
      continue;
    }

    const initialPaidInt = item.initialPaidAmount;
    const hasInitialPayment = initialPaidInt > 0;
    const initialPaymentId = buildInitialPaymentId(booking.id);
    const paymentMethod = SUPPORTED_PAYMENT_METHODS.includes(booking.paymentMethod)
      ? booking.paymentMethod
      : 'cash';

    const buildInvoiceOpData = ({ now }) => {
      const legacyTimestamp = booking.createdAt || now;
      const { invoiceDoc } = buildInvoiceDocumentFromBooking({
        bookingId: booking.id,
        booking,
        customerId: booking.customerId || '',
        actorUid: cleanActorUid,
        timestamp: now,
        invoiceDate: legacyTimestamp,
        dueDate: null,
        initialPaymentTransactionId: hasInitialPayment ? initialPaymentId : null,
        initialPaidAmount: initialPaidInt,
      });
      return invoiceDoc;
    };

    operations.push({
      type: 'set',
      collection: FIRESTORE_COLLECTIONS.INVOICES,
      id: invoiceId,
      buildData: buildInvoiceOpData,
    });
    createdInvoicesCount += 1;

    if (hasInitialPayment) {
      const { invoiceNumber } = buildInvoiceDocumentFromBooking({
        bookingId: booking.id,
        booking,
        customerId: booking.customerId || '',
        actorUid: cleanActorUid,
        timestamp: null,
      });

      operations.push({
        type: 'set',
        collection: FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS,
        id: initialPaymentId,
        buildData: ({ now }) => ({
          invoiceId,
          invoiceNumber,
          bookingId: booking.id,
          customerId: String(booking.customerId || '').trim(),
          transactionType: TRANSACTION_TYPE.PAYMENT,
          amount: initialPaidInt,
          currency: 'IDR',
          paymentMethod,
          receivedAt: booking.createdAt || now,
          referenceNumber: '',
          notes: 'Legacy Initial Payment (rekonsiliasi snapshot pembayaran awal booking)',
          source: PAYMENT_SOURCE.LEGACY_INITIAL_SNAPSHOT,
          reversalOfTransactionId: null,
          recordedByUid: cleanActorUid,
          createdAt: now,
        }),
      });
      createdInitialPaymentsCount += 1;
    }
  }

  // Keep invoice + its initial payment inside the same batch boundary (never split an invoice/payment pair!)
  const batches = [];
  let currentBatch = [];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const nextOp = operations[i + 1];
    const isPairedWithNext =
      op.collection === FIRESTORE_COLLECTIONS.INVOICES &&
      nextOp &&
      nextOp.collection === FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS &&
      nextOp.id === buildInitialPaymentId(op.id.replace(/^inv_/, ''));

    const requiredSlots = isPairedWithNext ? 2 : 1;
    if (currentBatch.length + requiredSlots > safeBatchSize && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
    }

    currentBatch.push(op);
    if (isPairedWithNext) {
      currentBatch.push(nextOp);
      i += 1;
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  let processedOperations = 0;
  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const slice = batches[bIdx];
    await adapter.commitBatchWrites(slice);
    processedOperations += slice.length;
    onProgress?.({
      processedOperations,
      totalOperations: operations.length,
      batchesCommitted: bIdx + 1,
      totalBatches: batches.length,
    });
  }

  return {
    createdInvoicesCount,
    createdInitialPaymentsCount,
    skippedAlreadyExistsCount,
    batchesCommitted: batches.length,
  };
}

/**
 * Explicitly reconciles a single `Needs Review` legacy booking (e.g., inconsistent initial payment
 * or cancelled/no-show booking) inside an atomic transaction after Staff verifies the exact
 * historical paid amount (`verifiedPaidAmount`). Never mutates the booking document.
 */
export async function reconcileNeedsReviewLegacyBooking({
  bookingId,
  verifiedPaidAmount = 0,
  paymentMethod = 'cash',
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) {
    throw createPaymentServiceError('invoice/invalid-booking', 'ID booking legacy tidak valid.');
  }

  const safePaidInt = toNonNegativeRupiahInt(verifiedPaidAmount);
  const safeMethod = SUPPORTED_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'cash';
  const invoiceId = buildInvoiceId(cleanBookingId);
  const initialPaymentId = buildInitialPaymentId(cleanBookingId);

  return adapter.runAtomicTransaction(async (tx) => {
    const [booking, existingInvoice, existingInitialPayment] = await Promise.all([
      tx.getBooking(cleanBookingId),
      tx.getInvoice(invoiceId),
      tx.getPaymentTransaction(initialPaymentId),
    ]);

    if (!booking) {
      throw createPaymentServiceError(
        'invoice/booking-not-found',
        'Booking legacy tidak ditemukan.',
      );
    }

    if (existingInvoice) {
      return existingInvoice;
    }

    const totalAmount = toNonNegativeRupiahInt(booking.totalAmount);
    if (safePaidInt > totalAmount) {
      throw createPaymentServiceError(
        'payment/overpayment-not-allowed',
        'Nominal pembayaran awal yang diverifikasi tidak boleh melebihi total tagihan booking.',
      );
    }

    const now = tx.nowValue();
    const legacyTimestamp = booking.createdAt || now;
    const hasInitialPayment = safePaidInt > 0;

    const { invoiceNumber, invoiceDoc } = buildInvoiceDocumentFromBooking({
      bookingId: cleanBookingId,
      booking,
      customerId: booking.customerId || '',
      actorUid: cleanActorUid,
      timestamp: now,
      invoiceDate: legacyTimestamp,
      dueDate: null,
      initialPaymentTransactionId: hasInitialPayment ? initialPaymentId : null,
      initialPaidAmount: safePaidInt,
    });

    tx.setInvoice(invoiceId, invoiceDoc);

    if (hasInitialPayment && !existingInitialPayment) {
      tx.setPaymentTransaction(initialPaymentId, {
        invoiceId,
        invoiceNumber,
        bookingId: cleanBookingId,
        customerId: String(booking.customerId || '').trim(),
        transactionType: TRANSACTION_TYPE.PAYMENT,
        amount: safePaidInt,
        currency: 'IDR',
        paymentMethod: safeMethod,
        receivedAt: legacyTimestamp,
        referenceNumber: '',
        notes: 'Legacy Initial Payment (rekonsiliasi manual setelah review)',
        source: PAYMENT_SOURCE.LEGACY_INITIAL_SNAPSHOT,
        reversalOfTransactionId: null,
        recordedByUid: cleanActorUid,
        createdAt: now,
      });
    }

    return normalizeInvoiceRecord(invoiceId, invoiceDoc);
  });
}
