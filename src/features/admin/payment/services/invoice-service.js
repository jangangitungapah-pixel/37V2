/**
 * Invoice Lifecycle Service (Void Invoice, Due Date Updates, Error Mapping)
 * for 37 Music Studio (Phase 8 — Payment & Bill Management).
 */

import { isValidIsoDateString } from '@/features/admin/calendar/utils/calendar-date';

import { getPaymentRepositoryAdapter } from '../repositories/payment-repository';
import { normalizeInvoiceRecord, validateVoidInvoiceInput } from '../schemas/payment-schema';
import { INVOICE_STATUS } from '../utils/invoice-status';

export function createPaymentServiceError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

export function mapPaymentErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner atau Staff.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi jaringan tidak tersedia. Periksa koneksi internet Anda lalu coba kembali.';
  }

  if (
    (code.startsWith('payment/') || code.startsWith('invoice/')) &&
    typeof error?.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return 'Gagal memproses operasi invoice atau pembayaran. Silakan periksa data lalu coba lagi.';
}

export function assertAuthenticatedPaymentActor(actorUid) {
  const cleanUid = String(actorUid || '').trim();
  if (!cleanUid) {
    throw createPaymentServiceError(
      'payment/missing-actor',
      'Sesi pengguna tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return cleanUid;
}

/**
 * Voids an issued invoice atomically ONLY if net `amountPaid === 0` and a valid reason is provided.
 * Never deletes invoices or triggers automatic refunds.
 */
export async function voidInvoice({
  invoiceId,
  expectedVersion,
  reason,
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  if (!cleanInvoiceId) {
    throw createPaymentServiceError('invoice/not-found', 'ID invoice tidak valid.');
  }

  const validation = validateVoidInvoiceInput({ reason });
  if (!validation.isValid) {
    throw createPaymentServiceError(
      'invoice/validation-error',
      validation.errors.reason,
      validation.errors,
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const existing = await tx.getInvoice(cleanInvoiceId);
    if (!existing) {
      throw createPaymentServiceError('invoice/not-found', 'Dokumen invoice tidak ditemukan.');
    }

    if (existing.invoiceStatus === INVOICE_STATUS.VOID) {
      return existing;
    }

    if (Number.isInteger(Number(expectedVersion)) && existing.version !== Number(expectedVersion)) {
      throw createPaymentServiceError(
        'invoice/stale-update',
        'Invoice telah diperbarui di sesi lain. Muat ulang detail invoice sebelum melanjutkan.',
      );
    }

    if (existing.invoiceStatus !== INVOICE_STATUS.ISSUED) {
      throw createPaymentServiceError(
        'invoice/invalid-status',
        'Hanya invoice berstatus Issued yang dapat di-void.',
      );
    }

    if (existing.amountPaid > 0) {
      throw createPaymentServiceError(
        'invoice/has-payments',
        'Invoice yang sudah memiliki pembayaran bersih tidak dapat di-void langsung. Koreksi/reverse transaksi pembayaran terlebih dahulu bila diperlukan.',
      );
    }

    const now = tx.nowValue();
    const updatedDoc = {
      invoiceNumber: existing.invoiceNumber,
      bookingId: existing.bookingId,
      customerId: existing.customerId,
      invoiceStatus: INVOICE_STATUS.VOID,
      currency: existing.currency,
      customerSnapshot: existing.customerSnapshot,
      bookingSnapshot: existing.bookingSnapshot,
      financialSnapshot: existing.financialSnapshot,
      amountPaid: 0,
      balanceDue: existing.balanceDue,
      paymentStatus: existing.paymentStatus,
      invoiceDate: existing.invoiceDate,
      dueDate: existing.dueDate,
      lastPaymentTransactionId: existing.lastPaymentTransactionId,
      voidReason: validation.data.reason,
      createdAt: existing.createdAt,
      createdByUid: existing.createdByUid,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existing.version + 1,
    };

    tx.updateInvoice(cleanInvoiceId, updatedDoc);
    return normalizeInvoiceRecord(cleanInvoiceId, updatedDoc);
  });
}

/**
 * Sets or clears an explicit `dueDate` (`YYYY-MM-DD` or `null`) on an issued invoice
 * without altering any financial snapshot or payment aggregate.
 */
export async function updateInvoiceDueDate({
  invoiceId,
  expectedVersion,
  dueDate = null,
  actorUid,
  adapter = getPaymentRepositoryAdapter(),
}) {
  const cleanActorUid = assertAuthenticatedPaymentActor(actorUid);
  const cleanInvoiceId = String(invoiceId || '').trim();
  const cleanDueDate = dueDate ? String(dueDate).trim() : null;

  if (cleanDueDate && !isValidIsoDateString(cleanDueDate)) {
    throw createPaymentServiceError(
      'invoice/invalid-due-date',
      'Format tanggal jatuh tempo harus YYYY-MM-DD.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const existing = await tx.getInvoice(cleanInvoiceId);
    if (!existing) {
      throw createPaymentServiceError('invoice/not-found', 'Dokumen invoice tidak ditemukan.');
    }

    if (existing.invoiceStatus !== INVOICE_STATUS.ISSUED) {
      throw createPaymentServiceError(
        'invoice/invalid-status',
        'Jatuh tempo hanya dapat diubah pada invoice berstatus Issued.',
      );
    }

    if (Number.isInteger(Number(expectedVersion)) && existing.version !== Number(expectedVersion)) {
      throw createPaymentServiceError(
        'invoice/stale-update',
        'Invoice telah diperbarui di sesi lain. Muat ulang detail invoice lalu coba kembali.',
      );
    }

    const now = tx.nowValue();
    const updatedDoc = {
      invoiceNumber: existing.invoiceNumber,
      bookingId: existing.bookingId,
      customerId: existing.customerId,
      invoiceStatus: existing.invoiceStatus,
      currency: existing.currency,
      customerSnapshot: existing.customerSnapshot,
      bookingSnapshot: existing.bookingSnapshot,
      financialSnapshot: existing.financialSnapshot,
      amountPaid: existing.amountPaid,
      balanceDue: existing.balanceDue,
      paymentStatus: existing.paymentStatus,
      invoiceDate: existing.invoiceDate,
      dueDate: cleanDueDate,
      lastPaymentTransactionId: existing.lastPaymentTransactionId,
      voidReason: existing.voidReason,
      createdAt: existing.createdAt,
      createdByUid: existing.createdByUid,
      updatedAt: now,
      updatedByUid: cleanActorUid,
      version: existing.version + 1,
    };

    tx.updateInvoice(cleanInvoiceId, updatedDoc);
    return normalizeInvoiceRecord(cleanInvoiceId, updatedDoc);
  });
}
