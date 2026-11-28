import { Dialog } from '@base-ui/react/dialog';
import { Printer, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { TRANSACTION_TYPE } from '@/features/admin/payment/utils/invoice-status';

import {
  formatClientRupiah,
  formatClientStudioRoom,
  getClientInvoiceStatusDisplay,
} from '../utils/client-billing-utils';

/**
 * Ensures `#studio-print-portal` exists as a direct child of `document.body`
 * so `@media print` in `src/styles/index.css` isolates the A4 document cleanly
 * while hiding Sidebar, Topbar, dialogs, backdrops, and interactive controls.
 */
function getOrCreateStudioPrintPortal() {
  if (typeof document === 'undefined') return null;
  let portal = document.getElementById('studio-print-portal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'studio-print-portal';
    document.body.appendChild(portal);
  }
  return portal;
}

/**
 * Module E — Customer-Safe A4 Invoice Document Sheet.
 *
 * Security & Content Guarantees:
 * - Never fabricates legal studio addresses, NPWP, bank accounts, or tax details.
 * - Uses only public studio name + immutable invoice snapshots.
 * - Strips all internal UIDs, commission allocations, transaction sources, and staff notes.
 */
export function ClientInvoiceDocumentSheet({
  invoice,
  transactions = [],
  adjustments = [],
  studioName = '37 Music Studio',
  referenceDateIso,
}) {
  if (!invoice) return null;

  const baseTotalAmount = invoice.financialSnapshot?.totalAmount || 0;
  const adjustmentTotal = Number(invoice.adjustmentTotal) || 0;
  const effectiveTotalAmount = invoice.effectiveTotalAmount ?? baseTotalAmount;
  const overpaidCreditBalance = Number(invoice.overpaidCreditBalance) || 0;

  const statusDisplay = getClientInvoiceStatusDisplay(invoice, referenceDateIso);
  const cleanStudioName = String(studioName || '37 Music Studio').trim() || '37 Music Studio';
  const invoiceDateLabel = formatIndonesianTimestamp(invoice.invoiceDate || invoice.createdAt);
  const dueDateLabel = invoice.dueDate ? formatIndonesianDateFull(invoice.dueDate) : '';
  const bookingDateLabel = invoice.bookingSnapshot?.bookingDate
    ? formatIndonesianDateFull(invoice.bookingSnapshot.bookingDate)
    : '—';
  const roomLabel = formatClientStudioRoom(invoice.bookingSnapshot?.studioId);

  return (
    <article
      data-testid="client-invoice-document-sheet"
      className="mx-auto w-full max-w-[780px] bg-white p-6 text-[#151515] sm:p-8 print:max-w-none print:p-0"
    >
      {/* Document Header */}
      <header className="flex flex-col justify-between gap-4 border-b-2 border-[#151515] pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10.5px] font-semibold tracking-widest text-[#666159] uppercase">
            Official Customer Invoice
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#151515]">
            {cleanStudioName}
          </h1>
        </div>

        <div className="sm:text-right">
          <p className="font-mono text-xs font-semibold text-[#666159] uppercase">Invoice Number</p>
          <p className="mt-0.5 font-mono text-sm font-bold text-[#151515]">
            {invoice.invoiceNumber}
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#151515]/20 bg-[#F8F6EF] px-3 py-0.5 text-xs font-bold text-[#151515]">
            <span>{statusDisplay.label}</span>
          </div>
        </div>
      </header>

      {/* Metadata & Customer Grid */}
      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#151515]/15 p-4">
          <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
            Billed To
          </h2>
          <p className="mt-1.5 text-sm font-bold text-[#151515]">
            {invoice.customerSnapshot?.name || 'Studio Client'}
          </p>
          {invoice.customerSnapshot?.bandName ? (
            <p className="mt-0.5 text-xs font-medium text-[#46433D]">
              Band / Artist: {invoice.customerSnapshot.bandName}
            </p>
          ) : null}
          {invoice.customerSnapshot?.phone ? (
            <p className="mt-0.5 font-mono text-xs text-[#46433D]">
              {invoice.customerSnapshot.phone}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#151515]/15 p-4 text-xs">
          <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
            Invoice Details
          </h2>
          <dl className="mt-1.5 space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-[#666159]">Invoice Date</dt>
              <dd className="font-medium text-[#151515]">{invoiceDateLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#666159]">Invoice Status</dt>
              <dd className="font-semibold text-[#151515]">{statusDisplay.invoiceStatusLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#666159]">Payment Status</dt>
              <dd className="font-semibold text-[#151515]">{statusDisplay.label}</dd>
            </div>
            {dueDateLabel ? (
              <div className="flex justify-between gap-2">
                <dt className="text-[#666159]">Due Date</dt>
                <dd className="font-semibold text-[#151515]">{dueDateLabel}</dd>
              </div>
            ) : null}
            {invoice.bookingId ? (
              <div className="flex justify-between gap-2">
                <dt className="text-[#666159]">Booking Reference</dt>
                <dd className="font-mono font-semibold text-[#151515]">{invoice.bookingId}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {/* Immutable Booking / Service Snapshot */}
      <section className="print-avoid-break mt-5 rounded-xl border border-[#151515]/15 p-4">
        <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
          Session & Service Snapshot
        </h2>
        <div className="mt-2.5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[#666159]">Service Type</p>
            <p className="mt-0.5 font-bold text-[#151515]">
              {invoice.bookingSnapshot?.serviceTypeName || 'Studio Session'}
            </p>
            {invoice.bookingSnapshot?.serviceOptionName ? (
              <p className="mt-0.5 text-[#46433D]">
                Package: {invoice.bookingSnapshot.serviceOptionName}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-[#666159]">Schedule (Asia/Jakarta)</p>
            <p className="mt-0.5 font-semibold text-[#151515]">{bookingDateLabel}</p>
            <p className="mt-0.5 font-mono text-[#46433D]">
              {formatMinuteRange(
                invoice.bookingSnapshot?.startMinute,
                invoice.bookingSnapshot?.endMinute,
              )}{' '}
              ({formatDurationMinutes(invoice.bookingSnapshot?.durationMinutes)}) · {roomLabel}
            </p>
          </div>
        </div>
      </section>

      {/* Financial Breakdown */}
      <section className="print-avoid-break mt-5 rounded-xl border-2 border-[#151515] p-4">
        <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
          Financial Breakdown (IDR)
        </h2>

        <dl className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#46433D]">Subtotal</dt>
            <dd className="font-mono font-semibold text-[#151515] tabular-nums">
              {formatClientRupiah(invoice.financialSnapshot?.subtotal)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#46433D]">Discount</dt>
            <dd className="font-mono font-semibold text-[#151515] tabular-nums">
              {invoice.financialSnapshot?.discountAmount > 0
                ? `- ${formatClientRupiah(invoice.financialSnapshot.discountAmount)}`
                : formatClientRupiah(0)}
            </dd>
          </div>

          {adjustmentTotal !== 0 ? (
            <>
              <div className="flex items-center justify-between gap-4 border-t border-[#151515]/10 pt-2">
                <dt className="text-[#46433D]">Original Total</dt>
                <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                  {formatClientRupiah(baseTotalAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#46433D]">Price Adjustments</dt>
                <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                  {adjustmentTotal > 0
                    ? `+ ${formatClientRupiah(adjustmentTotal)}`
                    : `- ${formatClientRupiah(Math.abs(adjustmentTotal))}`}
                </dd>
              </div>
            </>
          ) : null}

          <div className="flex items-center justify-between gap-4 border-t border-[#151515]/15 pt-2 text-sm font-bold">
            <dt className="text-[#151515]">
              {adjustmentTotal !== 0 ? 'Effective Total Invoice' : 'Total Invoice'}
            </dt>
            <dd className="font-mono text-[#151515] tabular-nums">
              {formatClientRupiah(effectiveTotalAmount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#46433D]">Amount Paid</dt>
            <dd className="font-mono font-semibold text-[#0F6246] tabular-nums">
              {formatClientRupiah(invoice.amountPaid)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#151515]/15 pt-2 text-sm font-extrabold">
            <dt className="text-[#151515]">Balance Due</dt>
            <dd className="font-mono text-[#151515] tabular-nums">
              {statusDisplay.isCancelled
                ? formatClientRupiah(0)
                : formatClientRupiah(invoice.balanceDue)}
            </dd>
          </div>

          {overpaidCreditBalance > 0 ? (
            <div className="flex items-center justify-between gap-4 border-t border-amber-500/30 pt-2 text-xs font-bold text-[#6A3B00]">
              <dt>Overpaid Credit Balance</dt>
              <dd className="font-mono tabular-nums">
                {formatClientRupiah(overpaidCreditBalance)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {Array.isArray(adjustments) && adjustments.length > 0 ? (
        <section className="print-avoid-break mt-5">
          <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
            Price Adjustments ({adjustments.length})
          </h2>
          <div className="mt-2 space-y-1.5 rounded-xl border border-[#151515]/15 p-3 text-xs">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between gap-3">
                <span className="text-[#151515]">{adj.reason}</span>
                <span className="font-mono font-semibold text-[#151515] tabular-nums">
                  {adj.deltaAmount >= 0
                    ? `+ ${formatClientRupiah(adj.deltaAmount)}`
                    : `- ${formatClientRupiah(Math.abs(adj.deltaAmount))}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Customer-Safe Payment Summary */}
      <section className="print-avoid-break mt-5">
        <h2 className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
          Recorded Payment History
        </h2>
        {Array.isArray(transactions) && transactions.length > 0 ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-[#151515]/15">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#151515]/15 bg-[#F8F6EF] font-mono text-[10px] uppercase">
                  <th className="px-3 py-2">Received Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]/10">
                {transactions.map((tx) => {
                  const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
                  return (
                    <tr key={tx.id}>
                      <td className="px-3 py-2">{formatIndonesianTimestamp(tx.receivedAt)}</td>
                      <td className="px-3 py-2 font-semibold">{tx.transactionTypeLabel}</td>
                      <td className="px-3 py-2">{tx.paymentMethodLabel}</td>
                      <td className="px-3 py-2 font-mono">{tx.referenceNumber || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                        {isReversal
                          ? `- ${formatClientRupiah(tx.amount)}`
                          : formatClientRupiah(tx.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-[#666159]">No payment records yet.</p>
        )}
      </section>
    </article>
  );
}

/**
 * Module E4 — Customer-Safe Payment Receipt Sheet (read-only proof of recorded payment).
 * Never exposes `notes`, `source`, `recordedByUid`, or internal transaction IDs.
 */
export function ClientPaymentReceiptSheet({
  invoice,
  transaction,
  studioName = '37 Music Studio',
  referenceDateIso,
}) {
  if (!invoice || !transaction) return null;

  const statusDisplay = getClientInvoiceStatusDisplay(invoice, referenceDateIso);
  const cleanStudioName = String(studioName || '37 Music Studio').trim() || '37 Music Studio';

  return (
    <article
      data-testid="client-payment-receipt-sheet"
      className="mx-auto w-full max-w-[680px] bg-white p-6 text-[#151515] sm:p-8 print:max-w-none print:p-0"
    >
      <header className="flex flex-col justify-between gap-3 border-b-2 border-[#151515] pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono text-[10.5px] font-semibold tracking-widest text-[#666159] uppercase">
            Payment Receipt Confirmation
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-[#151515]">{cleanStudioName}</h1>
        </div>
        <div className="sm:text-right">
          <p className="font-mono text-xs text-[#666159]">Invoice</p>
          <p className="font-mono text-sm font-bold text-[#151515]">{invoice.invoiceNumber}</p>
        </div>
      </header>

      <section className="print-avoid-break mt-5 rounded-xl border-2 border-[#151515] p-4 text-xs">
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-[#666159]">Received From</dt>
            <dd className="font-bold text-[#151515]">
              {invoice.customerSnapshot?.name || 'Studio Client'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#666159]">Transaction Type</dt>
            <dd className="font-semibold text-[#151515]">{transaction.transactionTypeLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#666159]">Received Date</dt>
            <dd className="font-medium text-[#151515]">
              {formatIndonesianTimestamp(transaction.receivedAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#666159]">Payment Method</dt>
            <dd className="font-semibold text-[#151515]">{transaction.paymentMethodLabel}</dd>
          </div>
          {transaction.referenceNumber ? (
            <div className="flex justify-between gap-4">
              <dt className="text-[#666159]">Reference Number</dt>
              <dd className="font-mono font-semibold text-[#151515]">
                {transaction.referenceNumber}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-[#151515]/15 pt-2 text-sm font-extrabold">
            <dt className="text-[#151515]">Amount Recorded</dt>
            <dd className="font-mono text-[#0F6246] tabular-nums">
              {formatClientRupiah(transaction.amount)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pt-1">
            <dt className="text-[#666159]">Current Invoice Status</dt>
            <dd className="font-semibold text-[#151515]">
              {statusDisplay.label} (Balance Due: {formatClientRupiah(invoice.balanceDue)})
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

/**
 * Mounts the active printable sheet into `#studio-print-portal` so 1-click
 * `Download / Print Invoice` works immediately and cleanly in `@media print`.
 */
export function ClientPrintPortalHost({ children }) {
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.removeAttribute('data-studio-print-mode');
      }
    };
  }, []);

  const portalNode = getOrCreateStudioPrintPortal();
  if (!portalNode) return null;
  return createPortal(children, portalNode);
}

/**
 * On-screen Document Preview Modal for Customer Invoice or Customer-Safe Payment Receipt.
 */
export function ClientDocumentPreviewModal({
  open = false,
  onOpenChange,
  title = 'Invoice Document Preview',
  printButtonLabel = 'Download / Print Invoice',
  onPrint,
  children,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sa-overlay-backdrop no-print fixed inset-0 z-50" />
        <Dialog.Popup
          data-client-portal-layer="true"
          data-testid="client-document-preview-modal"
          className="no-print fixed inset-x-3 top-4 bottom-4 z-50 mx-auto flex max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#151515]/15 bg-[#F4F1E8] shadow-2xl sm:inset-x-6 sm:top-8 sm:bottom-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/10 bg-white px-4 py-3 sm:px-5">
            <Dialog.Title className="text-sm font-bold text-[#151515]">{title}</Dialog.Title>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrint}
                className="sa-btn-primary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{printButtonLabel}</span>
              </button>

              <Dialog.Close
                aria-label="Close document preview"
                className="sa-btn-secondary inline-flex h-9 w-9 cursor-pointer items-center justify-center p-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <div className="overflow-hidden rounded-2xl border border-[#151515]/12 bg-white shadow-sm">
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
