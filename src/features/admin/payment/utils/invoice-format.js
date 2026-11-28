/**
 * Formatting & Copy-to-WhatsApp Helpers for Invoices and Payment Receipts
 * (Phase 8 — Payment & Bill Management).
 */

import {
  getPaymentMethodLabel,
  getStudioRoomById,
} from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
  getJakartaDateTimeParts,
} from '@/features/admin/calendar/utils/calendar-date';
import { formatPhoneDisplay } from '@/features/admin/customer/utils/phone-number';

import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
} from './invoice-status';

/**
 * Extracts epoch milliseconds from Firestore Timestamp, serialized `{ seconds }`, Date, or ISO string.
 */
export function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Converts a Firestore Timestamp or Date into an Asia/Jakarta `YYYY-MM-DD` string.
 */
export function getTimestampDateIso(value) {
  const ms = getTimestampMillis(value);
  if (!ms) return '';
  return getJakartaDateTimeParts(new Date(ms)).dateIso;
}

/**
 * Builds a concise WhatsApp-ready invoice summary (plain text for clipboard copy).
 * Never exposes internal Staff/Owner/Operator fees or fabricated company data.
 */
export function buildWhatsAppInvoiceSummary(invoice) {
  if (!invoice) return '';

  const room = getStudioRoomById(invoice.bookingSnapshot?.studioId);
  const serviceDesc = [
    invoice.bookingSnapshot?.serviceTypeName,
    invoice.bookingSnapshot?.serviceOptionName,
  ]
    .filter(Boolean)
    .join(' — ');
  const dateLabel = invoice.bookingSnapshot?.bookingDate
    ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
    : '-';
  const timeRange = formatMinuteRange(
    invoice.bookingSnapshot?.startMinute ?? 600,
    invoice.bookingSnapshot?.endMinute ?? 660,
  );
  const durationLabel = formatDurationMinutes(invoice.bookingSnapshot?.durationMinutes ?? 60);

  const effectiveStatus = getEffectivePaymentStatus(invoice);
  const paymentMeta = getPaymentStatusMeta(effectiveStatus);
  const invoiceMeta = getInvoiceStatusMeta(invoice.invoiceStatus);
  const statusLine =
    invoice.invoiceStatus === 'void'
      ? `VOID (${invoice.voidReason || 'Dibatalkan'})`
      : `${paymentMeta.label.toUpperCase()} (${paymentMeta.indoLabel}) • ${invoiceMeta.label}`;

  const lines = [
    '*37 MUSIC STUDIO — INVOICE*',
    `No. Invoice : ${invoice.invoiceNumber}`,
    `Customer    : ${invoice.customerSnapshot?.name || '-'}${
      invoice.customerSnapshot?.bandName ? ` (${invoice.customerSnapshot.bandName})` : ''
    }`,
    `No. HP      : ${formatPhoneDisplay(invoice.customerSnapshot?.phone || '') || '-'}`,
    '',
    '*Detail Booking*',
    `Layanan     : ${serviceDesc || 'Studio Session'}`,
    `Ruangan     : ${room.label}`,
    `Jadwal      : ${dateLabel}, ${timeRange} (${durationLabel})`,
    '',
    '*Ringkasan Tagihan*',
    `Subtotal    : ${formatRupiah(invoice.financialSnapshot?.subtotal || 0)}`,
  ];

  if (Number(invoice.financialSnapshot?.discountAmount) > 0) {
    lines.push(`Diskon      : -${formatRupiah(invoice.financialSnapshot.discountAmount)}`);
  }

  const baseTotal = Math.max(0, Math.round(Number(invoice.financialSnapshot?.totalAmount) || 0));
  const adjustmentTotal = Math.round(Number(invoice.adjustmentTotal) || 0);
  const effectiveTotal = Math.max(
    0,
    Math.round(Number(invoice.effectiveTotalAmount ?? baseTotal) || 0),
  );
  const overpaidCreditBalance = Math.max(0, Math.round(Number(invoice.overpaidCreditBalance) || 0));

  if (adjustmentTotal !== 0) {
    lines.push(
      `Total Awal  : ${formatRupiah(baseTotal)}`,
      `Penyesuaian : ${
        adjustmentTotal > 0
          ? `+${formatRupiah(adjustmentTotal)}`
          : `-${formatRupiah(Math.abs(adjustmentTotal))}`
      }`,
      `Total Akhir : ${formatRupiah(effectiveTotal)}`,
    );
  } else {
    lines.push(`Total       : ${formatRupiah(effectiveTotal)}`);
  }

  lines.push(
    `Terbayar    : ${formatRupiah(invoice.amountPaid || 0)}`,
    `Sisa Tagihan: ${formatRupiah(invoice.balanceDue || 0)}`,
  );

  if (overpaidCreditBalance > 0) {
    lines.push(`Lebih Bayar : ${formatRupiah(overpaidCreditBalance)} (Menunggu Refund/Kredit)`);
  }

  lines.push(`Status      : ${statusLine}`);

  if (invoice.dueDate) {
    lines.push(`Jatuh Tempo : ${formatIndonesianDateMedium(invoice.dueDate)}`);
  }

  lines.push('', 'Terima kasih telah berlatih & berkarya di 37 Music Studio.');
  return lines.join('\n');
}

/**
 * Builds a concise WhatsApp-ready payment receipt summary (plain text for clipboard copy).
 */
export function buildWhatsAppReceiptSummary({ transaction, invoice }) {
  if (!transaction) return '';

  const isReversal = transaction.transactionType === 'reversal';
  const lines = [
    isReversal
      ? '*37 MUSIC STUDIO — KOREKSI TRANSAKSI (REVERSAL)*'
      : '*37 MUSIC STUDIO — PAYMENT RECEIPT*',
    `No. Transaksi : ${transaction.id}`,
    `No. Invoice   : ${transaction.invoiceNumber || invoice?.invoiceNumber || '-'}`,
    `Customer      : ${invoice?.customerSnapshot?.name || '-'}`,
    `Tanggal       : ${formatIndonesianTimestamp(transaction.receivedAt || transaction.createdAt)}`,
    `Metode        : ${getPaymentMethodLabel(transaction.paymentMethod)}`,
    `Nominal       : ${isReversal ? '-' : ''}${formatRupiah(transaction.amount || 0)}`,
  ];

  if (transaction.referenceNumber) {
    lines.push(`Referensi     : ${transaction.referenceNumber}`);
  }
  if (transaction.notes) {
    lines.push(`Catatan       : ${transaction.notes}`);
  }
  if (invoice) {
    lines.push(`Sisa Tagihan  : ${formatRupiah(invoice.balanceDue || 0)}`);
  }

  return lines.join('\n');
}
