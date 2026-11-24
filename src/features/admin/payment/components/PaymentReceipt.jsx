import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@base-ui/react/dialog';
import { Check, Copy, Printer, ReceiptText, X } from 'lucide-react';
import { toast } from 'sonner';

import { getPaymentMethodLabel } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { buildWhatsAppReceiptSummary } from '../utils/invoice-format';
import {
  getPaymentSourceMeta,
  getTransactionTypeMeta,
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

export function PaymentReceiptSheet({ transaction, invoice }) {
  if (!transaction) return null;

  const isReversal = transaction.transactionType === TRANSACTION_TYPE.REVERSAL;
  const typeMeta = getTransactionTypeMeta(transaction.transactionType);
  const sourceMeta = getPaymentSourceMeta(transaction.source);

  return (
    <article className="border-studio-ink bg-studio-white text-studio-ink mx-auto w-full max-w-md border-2 p-5 print:max-w-[440px] print:border">
      <header className="border-studio-ink flex items-start justify-between gap-3 border-b-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="border-studio-ink bg-studio-lime text-studio-ink font-display flex h-9 w-9 shrink-0 items-center justify-center border-2 text-lg leading-none font-black">
            37
          </div>
          <div>
            <p className="font-display text-lg leading-none font-black uppercase">
              37 MUSIC STUDIO
            </p>
            <p className="text-studio-muted-ink font-mono text-[9px] font-bold uppercase">
              {isReversal ? 'BUKTI KOREKSI PEMBAYARAN' : 'BUKTI PEMBAYARAN (KWITANSI)'}
            </p>
          </div>
        </div>
        <span
          className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${typeMeta.badgeClass}`}
        >
          {typeMeta.label}
        </span>
      </header>

      <div className="border-studio-ink bg-studio-ivory mt-4 border-2 p-3 text-center">
        <p className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
          {isReversal ? 'Nominal Pembatalan Catatan' : 'Jumlah Pembayaran Diterima'}
        </p>
        <p
          className={`font-display mt-1 text-3xl leading-none font-black tabular-nums ${
            isReversal ? 'text-studio-orange' : 'text-studio-ink'
          }`}
        >
          {isReversal ? '-' : ''}
          {formatRupiah(transaction.amount)}
        </p>
      </div>

      <dl className="mt-4 space-y-2 font-mono text-[11px]">
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">No. Transaksi</dt>
          <dd className="text-right font-extrabold break-all">{transaction.id}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">Nomor Invoice</dt>
          <dd className="text-right font-extrabold">
            {transaction.invoiceNumber || invoice?.invoiceNumber || '-'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">Pelanggan</dt>
          <dd className="text-right font-bold">{invoice?.customerSnapshot?.name || '-'}</dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">Tanggal Bayar</dt>
          <dd className="text-right font-bold">
            {formatIndonesianTimestamp(transaction.receivedAt || transaction.createdAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">Metode</dt>
          <dd className="text-right font-extrabold">
            {getPaymentMethodLabel(transaction.paymentMethod)}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
          <dt className="text-studio-muted-ink">Keterangan</dt>
          <dd className="text-right font-bold">{sourceMeta.label}</dd>
        </div>
        {transaction.referenceNumber ? (
          <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
            <dt className="text-studio-muted-ink">No. Referensi</dt>
            <dd className="text-right font-bold">{transaction.referenceNumber}</dd>
          </div>
        ) : null}
        {transaction.reversalOfTransactionId ? (
          <div className="flex justify-between gap-2 border-b border-neutral-200 pb-1.5">
            <dt className="text-studio-muted-ink">Koreksi Dari</dt>
            <dd className="text-right font-bold break-all">
              {transaction.reversalOfTransactionId}
            </dd>
          </div>
        ) : null}
        {transaction.notes ? (
          <div className="pt-1">
            <dt className="text-studio-muted-ink text-[9.5px] uppercase">Catatan</dt>
            <dd className="mt-0.5 font-sans text-xs font-medium">{transaction.notes}</dd>
          </div>
        ) : null}
      </dl>

      <footer className="border-studio-ink mt-5 border-t pt-2.5 text-center font-mono text-[9.5px] text-neutral-600">
        37 MUSIC STUDIO • Bukti Pembayaran Resmi Studio
      </footer>
    </article>
  );
}

export function PaymentReceipt({ open, transaction, invoice, onOpenChange }) {
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

  if (!transaction) return null;

  const portalRoot = open ? getOrCreatePrintPortalElement() : null;

  const handlePrint = () => {
    document.body.setAttribute('data-studio-print-mode', 'true');
    window.print();
    window.setTimeout(() => {
      document.body.removeAttribute('data-studio-print-mode');
    }, 800);
  };

  const handleCopy = async () => {
    const text = buildWhatsAppReceiptSummary({ transaction, invoice });
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      toast.success('Ringkasan receipt berhasil disalin.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Tidak dapat mengakses clipboard browser.');
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop
            data-admin-portal-layer="true"
            className="no-print sa-overlay-backdrop fixed inset-0 z-[70]"
          />

          <Dialog.Viewport className="no-print fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
            <Dialog.Popup
              data-admin-portal-layer="true"
              aria-label={`Receipt transaksi ${transaction.id}`}
              data-payment-scoped="true"
              className="no-print sa-dialog flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDF8C2] text-[#243300]">
                    <ReceiptText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <Dialog.Title className="truncate text-base font-bold text-[#151515]">
                    Bukti Pembayaran
                  </Dialog.Title>
                </div>

                <Dialog.Close
                  aria-label="Tutup receipt pembayaran"
                  className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3]/80 text-[#46433D] transition-colors hover:bg-[#151515]/[0.06] hover:text-[#151515]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Dialog.Close>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#EBE7DC]/70 p-4">
                <PaymentReceiptSheet transaction={transaction} invoice={invoice} />
              </div>

              <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold sm:flex-initial"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[#0F6246]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                  )}
                  <span>{copied ? 'Disalin' : 'Salin ke WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="sa-control sa-btn-lime inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold sm:flex-initial"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cetak Bukti</span>
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {portalRoot
        ? createPortal(
            <PaymentReceiptSheet transaction={transaction} invoice={invoice} />,
            portalRoot,
          )
        : null}
    </>
  );
}
