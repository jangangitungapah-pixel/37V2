/**
 * Payment Evidence & Atomic Verification Service (Payment Evidence & Verification v1).
 *
 * Operations:
 * 1. `submitClientPaymentEvidence()`  — Client submits mandatory proof (`pending_review`). Never mutates invoice totals.
 * 2. `verifyClientPaymentEvidence()`  — Staff/Owner atomically verifies proof, creates canonical
 *    `paymentTransactions/pay_evidence_{evidenceId}`, updates invoice aggregates via shared
 *    `applyValidatedPaymentInTransaction()`, and marks evidence `verified` in ONE transaction.
 * 3. `rejectClientPaymentEvidence()`  — Staff/Owner rejects proof with mandatory reason (3..300 chars).
 *    Preserves evidence metadata without modifying invoices or creating transactions.
 * 4. `attachAdminPaymentEvidence()`   — Staff/Owner attaches an optional Cloudinary proof image to an
 *    existing official payment transaction (`status: 'attached'`).
 */

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  assertAuthenticatedPaymentActor,
  createPaymentServiceError,
} from '@/features/admin/payment/services/invoice-service';
import { applyValidatedPaymentInTransaction } from '@/features/admin/payment/services/payment-service';
import { INVOICE_STATUS, PAYMENT_SOURCE } from '@/features/admin/payment/utils/invoice-status';

import {
  getPaymentEvidenceCloudinaryConfig,
  PAYMENT_EVIDENCE_SCHEMA_VERSION,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '../config/payment-evidence-config';
import { getPaymentEvidenceRepositoryAdapter } from '../repositories/payment-evidence-repository';
import {
  normalizePaymentEvidenceRecord,
  projectClientPaymentEvidenceRecord,
  validateClientEvidenceSubmissionInput,
  validatePaymentEvidenceAsset,
  validateRejectEvidenceInput,
  validateVerifyEvidenceInput,
} from '../schemas/payment-evidence-schema';
import {
  buildEvidencePaymentId,
  generatePaymentEvidenceId,
} from '../utils/payment-evidence-utils';

export function mapPaymentEvidenceErrorToMessage(error, { locale = 'en' } = {}) {
  const isId = locale === 'id';
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return isId
      ? 'Akses ditolak oleh Firestore. Pastikan sesi login dan izin akun Anda aktif.'
      : 'Permission denied. Please sign in again with an active account to continue.';
  }

  if (code.includes('unavailable') || code.includes('network')) {
    return isId
      ? 'Koneksi jaringan tidak tersedia. Periksa koneksi internet lalu coba kembali.'
      : 'Unable to reach the studio ledger right now. Please check your connection and try again.';
  }

  if (
    (code.startsWith('payment-evidence/') ||
      code.startsWith('payment/') ||
      code.startsWith('invoice/')) &&
    typeof error?.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return isId
    ? 'Gagal memproses bukti pembayaran. Silakan periksa data lalu coba lagi.'
    : 'Unable to process your payment proof right now. Please try again.';
}

/**
 * Client Portal submission of mandatory payment evidence.
 * Strictly NEVER modifies `invoices` or writes `paymentTransactions`.
 */
export async function submitClientPaymentEvidence({
  evidenceId = generatePaymentEvidenceId('ev'),
  invoiceId,
  claimedAmount,
  paymentMethod = 'transfer',
  claimedPaidAt = getJakartaTodayIso(),
  referenceNumber = '',
  evidenceAsset,
  actorUid,
  customerId,
  expectedCloudName = '',
  adapter = getPaymentEvidenceRepositoryAdapter(),
}) {
  const cleanUid = String(actorUid || '').trim();
  const cleanCustomerId = String(customerId || '').trim();
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanEvidenceId = String(evidenceId || '').trim() || generatePaymentEvidenceId('ev');

  if (!cleanUid || !cleanCustomerId) {
    throw createPaymentServiceError(
      'payment-evidence/unauthenticated',
      'Your client session is not active. Please sign in again before submitting payment proof.',
    );
  }

  if (!cleanInvoiceId) {
    throw createPaymentServiceError('payment-evidence/invalid-invoice', 'Invoice reference is missing.');
  }

  const resolvedExpectedCloud =
    String(expectedCloudName || '').trim() || getPaymentEvidenceCloudinaryConfig().cloudName;
  const assetValidation = validatePaymentEvidenceAsset(evidenceAsset, resolvedExpectedCloud);
  if (!assetValidation.isValid) {
    throw createPaymentServiceError(
      'payment-evidence/invalid-asset',
      assetValidation.error || 'A valid payment proof image is required.',
    );
  }

  const inputValidation = validateClientEvidenceSubmissionInput({
    claimedAmount,
    paymentMethod,
    claimedPaidAt,
    referenceNumber,
  });

  if (!inputValidation.isValid) {
    const firstMsg =
      Object.values(inputValidation.errors)[0] || 'Please check your payment details and try again.';
    throw createPaymentServiceError(
      'payment-evidence/validation-error',
      firstMsg,
      inputValidation.errors,
    );
  }

  try {
    return await adapter.runAtomicTransaction(async (tx) => {
      // 1. Read the parent invoice and any existing pending lock before writes.
      const [existingInvoice, existingLock] = await Promise.all([
        tx.getInvoice(cleanInvoiceId),
        typeof tx.getPaymentEvidenceLock === 'function'
          ? tx.getPaymentEvidenceLock(cleanInvoiceId)
          : Promise.resolve(null),
      ]);

      if (!existingInvoice) {
        throw createPaymentServiceError(
          'payment-evidence/invoice-not-found',
          'Invoice could not be found.',
        );
      }

      const invoiceClientUid = String(existingInvoice.clientUid || '').trim();
      const ownsInvoice = invoiceClientUid
        ? invoiceClientUid === cleanUid && existingInvoice.customerId === cleanCustomerId
        : existingInvoice.customerId === cleanCustomerId;
      if (!ownsInvoice) {
        throw createPaymentServiceError(
          'permission-denied',
          'You do not have permission to submit payment proof for this invoice.',
        );
      }

      if (existingInvoice.invoiceStatus !== INVOICE_STATUS.ISSUED) {
        throw createPaymentServiceError(
          'payment-evidence/invoice-not-eligible',
          'Payment proof can only be submitted for active issued invoices.',
        );
      }

      if (!existingInvoice.clientPaymentEvidenceRequired) {
        throw createPaymentServiceError(
          'payment-evidence/not-required',
          'This invoice does not use Client Portal payment proof submission. Please contact the studio team directly.',
        );
      }

      if (existingInvoice.balanceDue <= 0) {
        throw createPaymentServiceError(
          'payment-evidence/already-paid',
          'This invoice is already paid in full.',
        );
      }

      if (inputValidation.data.claimedAmount > existingInvoice.balanceDue) {
        throw createPaymentServiceError(
          'payment-evidence/amount-exceeds-balance',
          'Payment amount cannot exceed the current remaining balance.',
          { claimedAmount: 'Payment amount cannot exceed the current remaining balance.' },
        );
      }

      // 2. WRITE ONLY `paymentEvidence/{evidenceId}` — NEVER touch `invoices` or `paymentTransactions`
      const now = tx.nowValue();
      const docData = {
        schemaVersion: PAYMENT_EVIDENCE_SCHEMA_VERSION,
        invoiceId: cleanInvoiceId,
        invoiceNumber: existingInvoice.invoiceNumber,
        bookingId: existingInvoice.bookingId,
        customerId: String(existingInvoice.customerId || cleanCustomerId),
        clientUid: cleanUid,
        evidenceSource: PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL,
        status: PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
        claimedAmount: inputValidation.data.claimedAmount,
        paymentMethod: inputValidation.data.paymentMethod,
        claimedPaidAt: inputValidation.data.claimedPaidAt,
        referenceNumber: inputValidation.data.referenceNumber,
        evidence: assetValidation.data,
        submittedByUid: cleanUid,
        submittedAt: now,
        reviewedAt: null,
        reviewedByUid: '',
        rejectionReason: '',
        verifiedAmount: null,
        linkedTransactionId: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      tx.setPaymentEvidence(cleanEvidenceId, docData);

      if (typeof tx.setPaymentEvidenceLock === 'function') {
        const prevIds = Array.isArray(existingLock?.pendingEvidenceIds)
          ? existingLock.pendingEvidenceIds.map((v) => String(v || '').trim()).filter(Boolean)
          : [];
        const nextIds = Array.from(new Set([...prevIds, cleanEvidenceId]));
        tx.setPaymentEvidenceLock(cleanInvoiceId, {
          schemaVersion: 1,
          invoiceId: cleanInvoiceId,
          bookingId: existingInvoice.bookingId,
          customerId: String(existingInvoice.customerId || cleanCustomerId),
          clientUid: cleanUid,
          pendingEvidenceIds: nextIds,
          pendingCount: nextIds.length,
          updatedAt: now,
          updatedByUid: cleanUid,
          version: (Number(existingLock?.version) || 0) + 1,
        });
      }

      return {
        evidence: projectClientPaymentEvidenceRecord(cleanEvidenceId, docData),
        idempotentReplay: false,
      };
    });
  } catch (err) {
    // Safe idempotent replay recovery: if a retry arrives after the first commit succeeded,
    // Firestore routes `tx.set()` on an existing doc to `allow update` -> `permission-denied`
    // (or `already-exists` in-memory). Reading the now-existing document passes `resource != null`
    // strictly for its owning client.
    const errCode = String(err?.code || '').toLowerCase();
    if (
      (errCode.includes('permission-denied') || errCode.includes('already-exists')) &&
      typeof adapter.getPaymentEvidenceById === 'function'
    ) {
      let existingEvidence = null;
      try {
        existingEvidence = await adapter.getPaymentEvidenceById(cleanEvidenceId);
      } catch {
        // Leave existingEvidence as null and rethrow the original error below.
      }

      if (existingEvidence) {
        if (existingEvidence.invoiceId !== cleanInvoiceId || existingEvidence.clientUid !== cleanUid) {
          throw createPaymentServiceError(
            'payment-evidence/duplicate-id',
            'This submission reference has already been used.',
          );
        }
        return {
          evidence: projectClientPaymentEvidenceRecord(existingEvidence.id, existingEvidence),
          idempotentReplay: true,
        };
      }
    }
    throw err;
  }
}

/**
 * Staff/Owner atomic verification of a `pending_review` Client Portal payment proof.
 *
 * Inside ONE Firestore transaction:
 * - Reads `paymentEvidence/{evidenceId}`, `invoices/{invoiceId}`, and `paymentTransactions/pay_evidence_{evidenceId}`
 * - Validates eligibility, fresh balance due, version, and idempotency
 * - Atomically writes canonical `paymentTransactions/pay_evidence_{evidenceId}`, updates invoice
 *   aggregates via `applyValidatedPaymentInTransaction()`, and marks evidence `verified`.
 */
export async function verifyClientPaymentEvidence({
  evidenceId,
  expectedInvoiceVersion,
  expectedEvidenceVersion,
  verifiedAmount,
  notes = '',
  actorUid,
  adapter = getPaymentEvidenceRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanEvidenceId = String(evidenceId || '').trim();

  if (!cleanEvidenceId) {
    throw createPaymentServiceError(
      'payment-evidence/not-found',
      'ID bukti pembayaran tidak valid.',
    );
  }

  const amountValidation = validateVerifyEvidenceInput({ verifiedAmount });
  if (!amountValidation.isValid) {
    throw createPaymentServiceError(
      'payment-evidence/validation-error',
      amountValidation.errors.verifiedAmount,
      amountValidation.errors,
    );
  }

  const deterministicTxId = buildEvidencePaymentId(cleanEvidenceId);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const existingEvidence = await tx.getPaymentEvidence(cleanEvidenceId);
    if (!existingEvidence) {
      throw createPaymentServiceError(
        'payment-evidence/not-found',
        'Dokumen bukti pembayaran tidak ditemukan.',
      );
    }

    const [existingInvoice, existingTransaction, existingLock] = await Promise.all([
      tx.getInvoice(existingEvidence.invoiceId),
      tx.getPaymentTransaction(deterministicTxId),
      typeof tx.getPaymentEvidenceLock === 'function'
        ? tx.getPaymentEvidenceLock(existingEvidence.invoiceId)
        : Promise.resolve(null),
    ]);
    const [existingClientReservation, existingBooking] = await Promise.all([
      existingInvoice?.bookingId && typeof tx.getClientReservation === 'function'
        ? tx.getClientReservation(existingInvoice.bookingId)
        : Promise.resolve(null),
      existingInvoice?.bookingId && typeof tx.getBooking === 'function'
        ? tx.getBooking(existingInvoice.bookingId)
        : Promise.resolve(null),
    ]);
    const [existingBookingRequest, existingOffer] = await Promise.all([
      existingBooking?.sourceRequestId && typeof tx.getBookingRequest === 'function'
        ? tx.getBookingRequest(existingBooking.sourceRequestId)
        : Promise.resolve(null),
      existingBooking?.sourceRequestId &&
      existingBooking?.acceptedOfferId &&
      typeof tx.getBookingRequestOffer === 'function'
        ? tx.getBookingRequestOffer(existingBooking.sourceRequestId, existingBooking.acceptedOfferId)
        : Promise.resolve(null),
    ]);

    // Strict Idempotency: repeated verification of already-verified evidence NEVER double-counts
    if (
      existingEvidence.status === PAYMENT_EVIDENCE_STATUSES.VERIFIED &&
      existingEvidence.linkedTransactionId === deterministicTxId &&
      existingTransaction &&
      existingInvoice
    ) {
      return {
        invoice: existingInvoice,
        transaction: existingTransaction,
        evidence: existingEvidence,
        idempotentReplay: true,
      };
    }

    if (existingEvidence.evidenceSource !== PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL) {
      throw createPaymentServiceError(
        'payment-evidence/invalid-source',
        'Hanya bukti pembayaran kiriman Client Portal yang dapat melalui alur verifikasi.',
      );
    }

    if (existingEvidence.status !== PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW) {
      throw createPaymentServiceError(
        'payment-evidence/already-reviewed',
        `Bukti pembayaran ini sudah berstatus "${existingEvidence.status}" dan tidak dapat diverifikasi ulang.`,
      );
    }

    if (
      expectedEvidenceVersion !== null &&
      expectedEvidenceVersion !== undefined &&
      expectedEvidenceVersion !== '' &&
      Number.isInteger(Number(expectedEvidenceVersion)) &&
      existingEvidence.version !== Number(expectedEvidenceVersion)
    ) {
      throw createPaymentServiceError(
        'payment-evidence/stale-evidence',
        'Status bukti pembayaran baru saja berubah di sesi lain. Muat ulang antrean lalu coba lagi.',
      );
    }

    if (!existingInvoice) {
      throw createPaymentServiceError(
        'invoice/not-found',
        'Invoice terkait bukti pembayaran ini tidak ditemukan.',
      );
    }

    if (!existingInvoice.clientPaymentEvidenceRequired) {
      throw createPaymentServiceError(
        'payment-evidence/invoice-not-eligible',
        'Invoice ini tidak ditandai sebagai invoice Client Portal yang memerlukan verifikasi bukti.',
      );
    }

    if (
      existingInvoice.customerId !== existingEvidence.customerId ||
      existingInvoice.bookingId !== existingEvidence.bookingId ||
      existingInvoice.invoiceNumber !== existingEvidence.invoiceNumber
    ) {
      throw createPaymentServiceError(
        'payment-evidence/invoice-mismatch',
        'Referensi invoice atau customer pada bukti pembayaran tidak cocok dengan dokumen invoice.',
      );
    }

    // 2. ALL WRITES AFTER ALL READS (reusing canonical payment-service transaction helper!)
    const now = tx.nowValue();
    const applied = applyValidatedPaymentInTransaction(tx, {
      transactionId: deterministicTxId,
      existingInvoice,
      existingTransaction,
      existingClientReservation,
      existingBooking,
      existingBookingRequest,
      existingOffer,
      expectedVersion: expectedInvoiceVersion,
      amount: amountValidation.data.verifiedAmount,
      paymentMethod: existingEvidence.paymentMethod,
      receivedDate: existingEvidence.claimedPaidAt,
      referenceNumber: existingEvidence.referenceNumber,
      notes: String(notes || '').trim().slice(0, 400) || 'Terverifikasi dari bukti pembayaran Client Portal',
      source: PAYMENT_SOURCE.CLIENT_EVIDENCE_VERIFIED,
      actorUid: cleanActorUid,
      allowClientEvidenceInvoice: true,
      now,
    });

    const updatedEvidenceDoc = {
      schemaVersion: existingEvidence.schemaVersion,
      invoiceId: existingEvidence.invoiceId,
      invoiceNumber: existingEvidence.invoiceNumber,
      bookingId: existingEvidence.bookingId,
      customerId: existingEvidence.customerId,
      clientUid: existingEvidence.clientUid,
      evidenceSource: existingEvidence.evidenceSource,
      status: PAYMENT_EVIDENCE_STATUSES.VERIFIED,
      claimedAmount: existingEvidence.claimedAmount,
      paymentMethod: existingEvidence.paymentMethod,
      claimedPaidAt: existingEvidence.claimedPaidAt,
      referenceNumber: existingEvidence.referenceNumber,
      evidence: existingEvidence.evidence,
      submittedByUid: existingEvidence.submittedByUid,
      submittedAt: existingEvidence.submittedAt,
      reviewedAt: now,
      reviewedByUid: cleanActorUid,
      rejectionReason: '',
      verifiedAmount: amountValidation.data.verifiedAmount,
      linkedTransactionId: deterministicTxId,
      createdAt: existingEvidence.createdAt,
      updatedAt: now,
      version: existingEvidence.version + 1,
    };

    tx.updatePaymentEvidence(cleanEvidenceId, updatedEvidenceDoc);

    if (typeof tx.setPaymentEvidenceLock === 'function') {
      const prevIds = Array.isArray(existingLock?.pendingEvidenceIds)
        ? existingLock.pendingEvidenceIds.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      const nextIds = prevIds.filter((id) => id !== cleanEvidenceId);
      tx.setPaymentEvidenceLock(existingEvidence.invoiceId, {
        schemaVersion: 1,
        invoiceId: existingEvidence.invoiceId,
        bookingId: existingEvidence.bookingId,
        customerId: existingEvidence.customerId,
        clientUid: String(existingLock?.clientUid || existingEvidence.clientUid || ''),
        pendingEvidenceIds: nextIds,
        pendingCount: nextIds.length,
        updatedAt: now,
        updatedByUid: cleanActorUid,
        version: (Number(existingLock?.version) || 0) + 1,
      });
    }

    return {
      invoice: applied.invoice,
      transaction: applied.transaction,
      evidence: normalizePaymentEvidenceRecord(cleanEvidenceId, updatedEvidenceDoc),
      idempotentReplay: false,
    };
  });
}

/**
 * Staff/Owner rejection of a `pending_review` Client Portal payment proof.
 * Preserves Cloudinary evidence metadata and NEVER touches `invoices` or `paymentTransactions`.
 */
export async function rejectClientPaymentEvidence({
  evidenceId,
  expectedEvidenceVersion,
  rejectionReason,
  actorUid,
  adapter = getPaymentEvidenceRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanEvidenceId = String(evidenceId || '').trim();

  if (!cleanEvidenceId) {
    throw createPaymentServiceError(
      'payment-evidence/not-found',
      'ID bukti pembayaran tidak valid.',
    );
  }

  const validation = validateRejectEvidenceInput({ rejectionReason });
  if (!validation.isValid) {
    throw createPaymentServiceError(
      'payment-evidence/validation-error',
      validation.errors.rejectionReason,
      validation.errors,
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const existingEvidence = await tx.getPaymentEvidence(cleanEvidenceId);
    if (!existingEvidence) {
      throw createPaymentServiceError(
        'payment-evidence/not-found',
        'Dokumen bukti pembayaran tidak ditemukan.',
      );
    }
    const existingLock =
      typeof tx.getPaymentEvidenceLock === 'function'
        ? await tx.getPaymentEvidenceLock(existingEvidence.invoiceId)
        : null;

    if (existingEvidence.evidenceSource !== PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL) {
      throw createPaymentServiceError(
        'payment-evidence/invalid-source',
        'Lampiran manual Admin tidak menggunakan alur penolakan.',
      );
    }

    if (existingEvidence.status !== PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW) {
      throw createPaymentServiceError(
        'payment-evidence/already-reviewed',
        `Bukti pembayaran ini sudah berstatus "${existingEvidence.status}" sehingga tidak dapat ditolak.`,
      );
    }

    if (
      expectedEvidenceVersion !== null &&
      expectedEvidenceVersion !== undefined &&
      expectedEvidenceVersion !== '' &&
      Number.isInteger(Number(expectedEvidenceVersion)) &&
      existingEvidence.version !== Number(expectedEvidenceVersion)
    ) {
      throw createPaymentServiceError(
        'payment-evidence/stale-evidence',
        'Data bukti pembayaran telah berubah di sesi lain. Muat ulang halaman lalu coba kembali.',
      );
    }

    const now = tx.nowValue();
    const updatedEvidenceDoc = {
      schemaVersion: existingEvidence.schemaVersion,
      invoiceId: existingEvidence.invoiceId,
      invoiceNumber: existingEvidence.invoiceNumber,
      bookingId: existingEvidence.bookingId,
      customerId: existingEvidence.customerId,
      clientUid: existingEvidence.clientUid,
      evidenceSource: existingEvidence.evidenceSource,
      status: PAYMENT_EVIDENCE_STATUSES.REJECTED,
      claimedAmount: existingEvidence.claimedAmount,
      paymentMethod: existingEvidence.paymentMethod,
      claimedPaidAt: existingEvidence.claimedPaidAt,
      referenceNumber: existingEvidence.referenceNumber,
      evidence: existingEvidence.evidence,
      submittedByUid: existingEvidence.submittedByUid,
      submittedAt: existingEvidence.submittedAt,
      reviewedAt: now,
      reviewedByUid: cleanActorUid,
      rejectionReason: validation.data.rejectionReason,
      verifiedAmount: null,
      linkedTransactionId: null,
      createdAt: existingEvidence.createdAt,
      updatedAt: now,
      version: existingEvidence.version + 1,
    };

    tx.updatePaymentEvidence(cleanEvidenceId, updatedEvidenceDoc);

    if (typeof tx.setPaymentEvidenceLock === 'function') {
      const prevIds = Array.isArray(existingLock?.pendingEvidenceIds)
        ? existingLock.pendingEvidenceIds.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      const nextIds = prevIds.filter((id) => id !== cleanEvidenceId);
      tx.setPaymentEvidenceLock(existingEvidence.invoiceId, {
        schemaVersion: 1,
        invoiceId: existingEvidence.invoiceId,
        bookingId: existingEvidence.bookingId,
        customerId: existingEvidence.customerId,
        clientUid: String(existingLock?.clientUid || existingEvidence.clientUid || ''),
        pendingEvidenceIds: nextIds,
        pendingCount: nextIds.length,
        updatedAt: now,
        updatedByUid: cleanActorUid,
        version: (Number(existingLock?.version) || 0) + 1,
      });
    }
    return normalizePaymentEvidenceRecord(cleanEvidenceId, updatedEvidenceDoc);
  });
}

/**
 * Staff/Owner optional attachment of a validated Cloudinary proof image to an
 * already recorded official `paymentTransactions` record (`status: 'attached'`).
 */
export async function attachAdminPaymentEvidence({
  evidenceId = generatePaymentEvidenceId('ev_adm'),
  invoiceId,
  transactionId,
  evidenceAsset,
  claimedPaidAt = '',
  expectedCloudName = '',
  actorUid,
  adapter = getPaymentEvidenceRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanTxId = String(transactionId || '').trim();
  const cleanEvidenceId = String(evidenceId || '').trim() || generatePaymentEvidenceId('ev_adm');

  if (!cleanInvoiceId || !cleanTxId) {
    throw createPaymentServiceError(
      'payment-evidence/invalid-target',
      'ID invoice dan ID transaksi pembayaran wajib tersedia untuk melampirkan bukti.',
    );
  }

  const resolvedExpectedCloud =
    String(expectedCloudName || '').trim() || getPaymentEvidenceCloudinaryConfig().cloudName;
  const assetValidation = validatePaymentEvidenceAsset(evidenceAsset, resolvedExpectedCloud);
  if (!assetValidation.isValid) {
    throw createPaymentServiceError(
      'payment-evidence/invalid-asset',
      assetValidation.error || 'Metadata gambar bukti pembayaran tidak valid.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const [existingInvoice, existingTx, existingEvidence] = await Promise.all([
      tx.getInvoice(cleanInvoiceId),
      tx.getPaymentTransaction(cleanTxId),
      tx.getPaymentEvidence(cleanEvidenceId),
    ]);

    if (existingEvidence) {
      return existingEvidence;
    }

    if (!existingInvoice || !existingTx || existingTx.invoiceId !== cleanInvoiceId) {
      throw createPaymentServiceError(
        'payment-evidence/transaction-not-found',
        'Transaksi pembayaran resmi untuk lampiran ini tidak ditemukan.',
      );
    }

    if (existingTx.transactionType !== 'payment') {
      throw createPaymentServiceError(
        'payment-evidence/invalid-transaction-type',
        'Lampiran bukti pembayaran hanya dapat dikaitkan ke transaksi pembayaran masuk.',
      );
    }

    const now = tx.nowValue();
    const paidDateIso = String(claimedPaidAt || '').trim() || getJakartaTodayIso();
    const evidenceDoc = {
      schemaVersion: PAYMENT_EVIDENCE_SCHEMA_VERSION,
      invoiceId: cleanInvoiceId,
      invoiceNumber: existingInvoice.invoiceNumber,
      bookingId: existingInvoice.bookingId,
      customerId: existingInvoice.customerId,
      clientUid: String(existingInvoice.clientUid || ''),
      evidenceSource: PAYMENT_EVIDENCE_SOURCES.ADMIN_MANUAL,
      status: PAYMENT_EVIDENCE_STATUSES.ATTACHED,
      claimedAmount: existingTx.amount,
      paymentMethod: existingTx.paymentMethod,
      claimedPaidAt: paidDateIso,
      referenceNumber: existingTx.referenceNumber || '',
      evidence: assetValidation.data,
      submittedByUid: cleanActorUid,
      submittedAt: now,
      reviewedAt: null,
      reviewedByUid: '',
      rejectionReason: '',
      verifiedAmount: existingTx.amount,
      linkedTransactionId: cleanTxId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    tx.setPaymentEvidence(cleanEvidenceId, evidenceDoc);
    return normalizePaymentEvidenceRecord(cleanEvidenceId, evidenceDoc);
  });
}
