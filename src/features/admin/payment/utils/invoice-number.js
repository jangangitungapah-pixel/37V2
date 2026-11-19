/**
 * Deterministic Invoice & Payment Transaction ID and Invoice Number Utilities
 * for 37 Music Studio (Phase 8 — Payment & Bill Management).
 *
 * Guarantees:
 * - Strictly 1 booking -> 1 deterministic invoice ID (`inv_{bookingId}`)
 * - Strictly 1 initial payment per booking (`pay_initial_{bookingId}`)
 * - Strictly 1 reversal per original payment (`pay_rev_{originalTransactionId}`)
 * - Stable, human-readable, collision-resistant Invoice Number (`37MS-YYYYMMDD-XXXXXXXXXXXX`)
 */

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { sha256HexSync } from '@/features/admin/customer/utils/phone-number';

export const INVOICE_NUMBER_PREFIX = '37MS';
export const INVOICE_NUMBER_REGEX = /^37MS-\d{8}-[A-Z0-9]{12}$/;

/**
 * Deterministic Firestore document ID for a booking's single invoice.
 */
export function buildInvoiceId(bookingId) {
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) return '';
  return cleanBookingId.startsWith('inv_') ? cleanBookingId : `inv_${cleanBookingId}`;
}

/**
 * Deterministic Firestore document ID for a booking's initial payment transaction.
 */
export function buildInitialPaymentId(bookingId) {
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) return '';
  return `pay_initial_${cleanBookingId}`;
}

/**
 * Deterministic Firestore document ID for a compensating reversal transaction.
 * Enforces strictly at most one reversal per original payment transaction.
 */
export function buildReversalPaymentId(originalTransactionId) {
  const cleanTxId = String(originalTransactionId || '').trim();
  if (!cleanTxId) return '';
  return `pay_rev_${cleanTxId}`;
}

/**
 * Generates a deterministic, human-readable Invoice Number:
 * `37MS-YYYYMMDD-XXXXXXXXXXXX`
 *
 * Uses the booking date (`YYYY-MM-DD`) and the first 12 uppercase hex characters
 * of SHA-256(bookingId) so retries always yield the exact same invoice number
 * without requiring a mutable sequence counter document.
 */
export function buildInvoiceNumber({ bookingId, bookingDate }) {
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanBookingId) return '';

  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate || '').trim())
    ? String(bookingDate).trim()
    : getJakartaTodayIso();
  const compactDate = isoDate.replace(/-/g, '');
  const stableSuffix = sha256HexSync(`37ms:invoice:${cleanBookingId}`).slice(0, 12).toUpperCase();

  return `${INVOICE_NUMBER_PREFIX}-${compactDate}-${stableSuffix}`;
}

/**
 * Validates that an invoice number follows the canonical `37MS-YYYYMMDD-XXXXXXXXXXXX` format.
 */
export function isValidInvoiceNumber(value) {
  return INVOICE_NUMBER_REGEX.test(String(value || '').trim());
}
