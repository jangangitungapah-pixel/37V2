import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@base-ui/react/dialog';
import { Check, Copy, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

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
} from '@/features/admin/calendar/utils/calendar-date';
import { formatPhoneDisplay } from '@/features/admin/customer/utils/phone-number';

import { buildWhatsAppInvoiceSummary } from '../utils/invoice-format';
import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentSourceMeta,
  getPaymentStatusMeta,
  INVOICE_STATUS,
  TRANSACTION_TYPE,
} from '../utils/invoice-status';

function getOrCreatePrintPortalElement() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('studio-print-portal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'studio-print-portal';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Pure editorial A4 Invoice Sheet rendered both inside the preview dialog
 * and inside `#studio-print-portal` for clean browser Print / Save as PDF.
 * Never displays fabricated legal addresses, tax IDs, bank accounts, or internal fees.
 */
export function InvoiceDocumentSheet({ invoice, transactions = [] }) {
  if (!invoice) return null;

  const isVoid = invoice.invoiceStatus === INVOICE_STATUS.VOID;
  const effectiveStatus = getEffectivePaymentStatus(invoice);
  const paymentMeta = getPaymentStatusMeta(effectiveStatus);
  const invoiceMeta = getInvoiceStatusMeta(invoice.invoiceStatus);
  const room = getStudioRoomById(invoice.bookingSnapshot?.studioId);

  const serviceTitle = invoice.bookingSnapshot?.serviceTypeName || 'Studio Session';
  const serviceOption = invoice.bookingSnapshot?.serviceOptionName || '';
  const timeRange = formatMinuteRange(
    invoice.bookingSnapshot?.startMinute ?? 600,
    invoice.bookingSnapshot?.endMinute ?? 660,
  );
  const durationLabel = formatDurationMinutes(invoice.bookingSnapshot?.durationMinutes ?? 60);

  return (
    <article className="border-studio-ink bg-studio-white text-studio-ink mx-auto w-full max-w-[740px] border-2 p-5 sm:p-8 print:max-w-none print:border print:p-6">
      {/* 1. Studio Brand Header & Invoice Identity */}
      <header className="border-studio-ink flex flex-col justify-between gap-4 border-b-2 pb-5 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="border-studio-ink bg-studio-lime text-studio-ink font-display flex h-12 w-12 shrink-0 items-center justify-center border-2 text-2xl leading-none font-black shadow-[2px_2px_0px_#151515] print:shadow-none">
            37
          </div>
          <div>
            <p className="font-display text-2xl leading-none font-black tracking-tight uppercase">
              37 MUSIC STUDIO
            </p>
            <p className="text-studio-muted-ink mt-1 font-mono text-[10px] font-bold tracking-wider uppercase">
              REHEARSAL • RECORDING • STUDIO MUSIK
            </p>
          </div>
        </div>

        <div className="sm:text-right">
          <div className="inline-flex flex-wrap items-center gap-1.5 sm:justify-end">
            <span
              className={`border px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${invoiceMeta.badgeClass}`}
            >
              {invoiceMeta.label}
            </span>
            {!isVoid ? (
              <span
                className={`border px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
              >
                {paymentMeta.indoLabel || paymentMeta.label}
              </span>
            ) : null}
          </div>
          <p className="font-display mt-2 text-xl leading-none font-black tracking-tight uppercase">
            INVOICE
          </p>
          <p className="text-studio-ink mt-1 font-mono text-xs font-extrabold">
            {invoice.invoiceNumber}
          </p>
        </div>
      </header>

      {isVoid ? (
        <div className="border-studio-ink text-studio-white mt-4 border-2 bg-neutral-900 px-3.5 py-2.5 text-xs">
          <p className="font-mono text-[10px] font-extrabold tracking-wider text-amber-300 uppercase">
            INVOICE DIBATALKAN — TIDAK BERLAKU UNTUK PEMBAYARAN
          </p>
          {invoice.voidReason ? (
            <p className="mt-0.5 text-neutral-200">Alasan: {invoice.voidReason}</p>
          ) : null}
        </div>
      ) : null}

      {/* 2. Bill To & Invoice Dates */}
      <section className="mt-5 grid grid-cols-1 gap-4 border-b border-neutral-300 pb-5 sm:grid-cols-2">
        <div>
          <p className="text-studio-muted-ink font-mono text-[9.5px] font-extrabold tracking-wider uppercase">
            Tagihan Kepada
          </p>
          <p className="mt-1 text-base font-extrabold">{invoice.customerSnapshot?.name || '-'}</p>
          {invoice.customerSnapshot?.bandName ? (
            <p className="text-studio-muted-ink text-xs font-semibold">
              Band / Project: {invoice.customerSnapshot.bandName}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-xs font-bold">
            {formatPhoneDisplay(invoice.customerSnapshot?.phone || '') || '-'}
          </p>
        </div>

        <dl className="space-y-1.5 font-mono text-xs sm:text-right">
          <div>
            <dt className="text-studio-muted-ink text-[9.5px] font-bold uppercase">
              Tanggal Invoice
            </dt>
            <dd className="font-extrabold">{formatIndonesianTimestamp(invoice.invoiceDate)}</dd>
          </div>
          {invoice.dueDate ? (
            <div>
              <dt className="text-studio-muted-ink text-[9.5px] font-bold uppercase">
                Jatuh Tempo
              </dt>
              <dd className="text-studio-orange font-extrabold">
                {formatIndonesianDateMedium(invoice.dueDate)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-studio-muted-ink text-[9.5px] font-bold uppercase">Kode Booking</dt>
            <dd className="font-bold">{invoice.bookingId}</dd>
          </div>
        </dl>
      </section>

      {/* 3. Service Description & Booking Details */}
      <section className="mt-5">
        <p className="text-studio-muted-ink font-mono text-[9.5px] font-extrabold tracking-wider uppercase">
          Rincian Layanan &amp; Jadwal
        </p>

        <div className="border-studio-ink mt-2 border-2">
          <div className="bg-studio-ink text-studio-ivory grid grid-cols-12 gap-2 px-3 py-2 font-mono text-[9.5px] font-extrabold uppercase">
            <span className="col-span-7">Layanan &amp; Jadwal Sesi</span>
            <span className="col-span-2 text-center">Durasi</span>
            <span className="col-span-3 text-right">Subtotal</span>
          </div>

          <div className="bg-studio-ivory/40 grid grid-cols-12 items-start gap-2 px-3 py-3 text-xs">
            <div className="col-span-7 min-w-0">
              <p className="font-extrabold">
                {serviceTitle}
                {serviceOption ? ` — ${serviceOption}` : ''}
              </p>
              <p className="text-studio-muted-ink mt-1 font-mono text-[10.5px] font-semibold">
                {room.label} •{' '}
                {invoice.bookingSnapshot?.bookingDate
                  ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
                  : '-'}
              </p>
              <p className="text-studio-muted-ink font-mono text-[10.5px] font-semibold">
                {timeRange}
              </p>
            </div>

            <div className="col-span-2 text-center font-mono text-[11px] font-bold">
              {durationLabel}
            </div>

            <div className="col-span-3 text-right font-mono text-xs font-extrabold tabular-nums">
              {formatRupiah(invoice.financialSnapshot?.subtotal || 0)}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Financial Summary (Avoid Page Break) */}
      <section className="print-avoid-break mt-5 flex justify-end">
        <div className="border-studio-ink bg-studio-ivory w-full border-2 p-4 sm:max-w-sm">
          <dl className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-studio-muted-ink">Subtotal</dt>
              <dd className="font-bold tabular-nums">
                {formatRupiah(invoice.financialSnapshot?.subtotal || 0)}
              </dd>
            </div>

            {Number(invoice.financialSnapshot?.discountAmount) > 0 ? (
              <div className="flex justify-between gap-3 text-emerald-800">
                <dt>Diskon</dt>
                <dd className="font-bold tabular-nums">
                  -{formatRupiah(invoice.financialSnapshot.discountAmount)}
                </dd>
              </div>
            ) : null}

            <div className="border-studio-ink flex justify-between gap-3 border-t-2 pt-2 text-sm font-extrabold">
              <dt>Total Invoice</dt>
              <dd className="tabular-nums">
                {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
              </dd>
            </div>

            <div className="flex justify-between gap-3 text-emerald-800">
              <dt>Sudah Dibayar</dt>
              <dd className="font-extrabold tabular-nums">
                {formatRupiah(invoice.amountPaid || 0)}
              </dd>
            </div>

            <div className="border-studio-ink flex justify-between gap-3 border-t pt-2 text-sm font-extrabold">
              <dt className={invoice.balanceDue > 0 && !isVoid ? 'text-studio-orange' : ''}>
                Sisa Tagihan
              </dt>
              <dd
                className={`tabular-nums ${
                  invoice.balanceDue > 0 && !isVoid ? 'text-studio-orange' : 'text-emerald-800'
                }`}
              >
                {formatRupiah(invoice.balanceDue || 0)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 5. Payment History Summary */}
      {transactions.length > 0 ? (
        <section className="print-avoid-break mt-5 border-t border-neutral-300 pt-4">
          <p className="text-studio-muted-ink font-mono text-[9.5px] font-extrabold tracking-wider uppercase">
            Riwayat Pembayaran ({transactions.length})
          </p>
          <div className="mt-2 space-y-1.5">
            {transactions.map((tx) => {
              const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
              const sourceMeta = getPaymentSourceMeta(tx.source);
              return (
                <div
                  key={tx.id}
                  className="border-studio-ink/40 flex flex-wrap items-center justify-between gap-2 border px-2.5 py-1.5 font-mono text-[10.5px]"
                >
                  <div className="min-w-0">
                    <span className="font-extrabold">
                      {formatIndonesianTimestamp(tx.receivedAt || tx.createdAt)}
                    </span>
                    <span className="text-studio-muted-ink">
                      {' '}
                      • {getPaymentMethodLabel(tx.paymentMethod)} • {sourceMeta.shortLabel}
                    </span>
                    {tx.referenceNumber ? (
                      <span className="text-studio-subtle-ink"> • Ref: {tx.referenceNumber}</span>
                    ) : null}
                  </div>
                  <span
                    className={`font-extrabold tabular-nums ${
                      isReversal ? 'text-studio-orange' : 'text-emerald-800'
                    }`}
                  >
                    {isReversal ? '-' : '+'}
                    {formatRupiah(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 6. Simple Authentic Brand Footer (No fabricated legal/tax/bank fields) */}
      <footer className="border-studio-ink mt-6 flex flex-wrap items-center justify-between gap-2 border-t-2 pt-3 font-mono text-[10px] text-neutral-600">
        <span className="text-studio-ink font-extrabold uppercase">37 MUSIC STUDIO</span>
        <span>Dokumen tagihan resmi booking studio • Mata uang: IDR (Rupiah)</span>
      </footer>
    </article>
  );
}

/**
 * Interactive Print / Save as PDF & Copy-to-WhatsApp Preview Modal for an Invoice.
 */
export function InvoicePrintable({ open, invoice, transactions = [], onOpenChange }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const handleAfterPrint = () => {
      document.body.removeAttribute('data-studio-print-mode');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.removeAttribute('data-studio-print-mode');
    };
  }, [open]);

  if (!invoice) return null;

  const portalRoot = open ? getOrCreatePrintPortalElement() : null;

  const handlePrint = () => {
    document.body.setAttribute('data-studio-print-mode', 'true');
    window.print();
    window.setTimeout(() => {
      document.body.removeAttribute('data-studio-print-mode');
    }, 800);
  };

  const handleCopySummary = async () => {
    const summaryText = buildWhatsAppInvoiceSummary(invoice);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      }
      setCopied(true);
      toast.success('Ringkasan invoice berhasil disalin (siap kirim ke WhatsApp).');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Tidak dapat mengakses clipboard browser.');
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="no-print fixed inset-0 z-[70] bg-black/75 backdrop-blur-[1px]" />

          <Dialog.Popup
            aria-label={`Preview cetak invoice ${invoice.invoiceNumber}`}
            data-payment-scoped="true"
            className="no-print border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[80] mx-auto flex h-[94dvh] w-full max-w-4xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[92dvh] sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
          >
            {/* Preview Action Header */}
            <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <Dialog.Title className="font-display text-lg leading-none font-black text-white uppercase sm:text-xl">
                  Preview Cetak &amp; PDF — {invoice.invoiceNumber}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 font-mono text-[10px] text-neutral-300">
                  Siap dicetak atau disimpan sebagai PDF melalui dialog cetak browser.
                </Dialog.Description>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="border-studio-ivory bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-9 cursor-pointer items-center gap-1.5 border px-2.5 font-mono text-[10px] font-extrabold uppercase"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copied ? 'Disalin' : 'Salin ke WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex h-9 cursor-pointer items-center gap-1.5 border px-3 font-mono text-[10px] font-extrabold uppercase"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cetak / Simpan PDF</span>
                </button>

                <Dialog.Close
                  aria-label="Tutup preview cetak invoice"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Dialog.Close>
              </div>
            </div>

            {/* Scrollable Preview Canvas */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-200/80 p-3 sm:p-6">
              <InvoiceDocumentSheet invoice={invoice} transactions={transactions} />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Isolated A4 Print Portal (visible ONLY inside @media print) */}
      {portalRoot
        ? createPortal(
            <InvoiceDocumentSheet invoice={invoice} transactions={transactions} />,
            portalRoot,
          )
        : null}
    </>
  );
}
