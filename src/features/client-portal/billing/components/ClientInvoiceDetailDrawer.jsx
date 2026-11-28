import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  Printer,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
import { useState } from 'react';

import {
  formatDurationMinutes,
  formatMinuteOfDay,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge } from '@/features/admin/design-system';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';

import { useClientInvoiceDetail } from '../hooks/useClientInvoiceDetail';
import {
  buildClientInvoiceWhatsAppUrl,
  formatClientRupiah,
  formatClientStudioRoom,
  getClientInvoiceStatusDisplay,
  triggerClientStudioPrint,
} from '../utils/client-billing-utils';
import {
  ClientDocumentPreviewModal,
  ClientInvoiceDocumentSheet,
  ClientPaymentReceiptSheet,
  ClientPrintPortalHost,
} from './ClientInvoicePrintable';
import { ClientPaymentEvidencePanel } from './ClientPaymentEvidencePanel';
import { ClientPaymentTimeline } from './ClientPaymentTimeline';

/**
 * Module C, D, E & F — Customer Invoice Detail Drawer.
 *
 * Displays:
 * - C1. Invoice Header (`invoiceNumber`, `invoiceDate`, `invoiceStatus`, `paymentStatus`, `dueDate`)
 * - C5 + F1. Payment Status Summary & Studio Payment Verification Instructions + WhatsApp CTA
 * - C4. Immutable Customer-Facing Financial Breakdown (zero commissions or internal fees)
 * - C3. Immutable Booking / Service Snapshot (`Asia/Jakarta`)
 * - C2. Customer Information (zero UIDs or internal `customerId`)
 * - D. Customer-Safe Payment & Correction Timeline
 * - E. `Download / Print Invoice` (`window.print()`) + Document & Receipt Previews
 */
export function ClientInvoiceDetailDrawer({
  open = false,
  onOpenChange,
  invoiceId = '',
  fallbackInvoice = null,
  referenceDateIso,
  studioName = '37 Music Studio',
  publicWhatsappNumber = '',
  customAdapter = null,
  customEvidenceAdapter = null,
  cloudinaryConfig = null,
}) {
  const {
    invoice,
    transactions,
    isLoading,
    isTransactionsLoading,
    hasMoreTransactions,
    loadMoreTransactions,
    error,
    retry,
  } = useClientInvoiceDetail({
    invoiceId,
    fallbackInvoice,
    enabled: open && Boolean(invoiceId),
    customAdapter,
  });

  const [printTarget, setPrintTarget] = useState({ mode: 'invoice', receiptTx: null });
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleClose = (nextOpen) => {
    if (!nextOpen) {
      setPreviewOpen(false);
      setPrintTarget({ mode: 'invoice', receiptTx: null });
    }
    onOpenChange?.(nextOpen);
  };

  const handlePrintInvoiceNow = () => {
    setPrintTarget({ mode: 'invoice', receiptTx: null });
    queueMicrotask(() => {
      triggerClientStudioPrint();
    });
  };

  const handlePreviewInvoice = () => {
    setPrintTarget({ mode: 'invoice', receiptTx: null });
    setPreviewOpen(true);
  };

  const handlePreviewReceipt = (tx) => {
    setPrintTarget({ mode: 'receipt', receiptTx: tx });
    setPreviewOpen(true);
  };

  const statusDisplay = invoice ? getClientInvoiceStatusDisplay(invoice, referenceDateIso) : null;
  const isOutstandingIssued = Boolean(
    invoice && invoice.invoiceStatus === INVOICE_STATUS.ISSUED && invoice.balanceDue > 0,
  );

  const whatsappHref = invoice
    ? buildClientInvoiceWhatsAppUrl({
        publicWhatsappNumber,
        studioName,
        invoiceNumber: invoice.invoiceNumber,
      })
    : '';

  const invoiceDateLabel = invoice
    ? formatIndonesianTimestamp(invoice.invoiceDate || invoice.createdAt)
    : '—';
  const dueDateLabel = invoice?.dueDate ? formatIndonesianDateFull(invoice.dueDate) : '';
  const bookingDateLabel = invoice?.bookingSnapshot?.bookingDate
    ? formatIndonesianDateFull(invoice.bookingSnapshot.bookingDate)
    : '—';

  return (
    <>
      {open && invoice ? (
        <ClientPrintPortalHost>
          {printTarget.mode === 'receipt' && printTarget.receiptTx ? (
            <ClientPaymentReceiptSheet
              invoice={invoice}
              transaction={printTarget.receiptTx}
              studioName={studioName}
              referenceDateIso={referenceDateIso}
            />
          ) : (
            <ClientInvoiceDocumentSheet
              invoice={invoice}
              transactions={transactions}
              studioName={studioName}
              referenceDateIso={referenceDateIso}
            />
          )}
        </ClientPrintPortalHost>
      ) : null}

      <Dialog.Root open={open} onOpenChange={handleClose}>
        <Dialog.Portal>
          <Dialog.Backdrop
            data-testid="client-invoice-drawer-backdrop"
            className="sa-overlay-backdrop no-print fixed inset-0 z-40"
          />

          <Dialog.Popup
            data-client-portal-layer="true"
            data-testid="client-invoice-detail-drawer"
            className="sa-drawer no-print fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col overflow-hidden bg-[#F8F6EF] shadow-2xl focus:outline-none"
          >
            {/* Sticky Drawer Header (C1) */}
            <div className="border-b border-[#151515]/10 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                    Invoice Detail
                  </p>
                  <Dialog.Title className="mt-0.5 truncate font-mono text-base font-bold text-[#151515] sm:text-lg">
                    {invoice?.invoiceNumber || 'Loading Invoice...'}
                  </Dialog.Title>
                </div>

                <Dialog.Close
                  aria-label="Close invoice details"
                  className="sa-btn-secondary inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center p-0"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Dialog.Close>
              </div>

              {invoice && statusDisplay ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <AdminStatusBadge
                    tone={statusDisplay.tone}
                    dot={!statusDisplay.isCancelled}
                  >
                    {statusDisplay.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ivory">
                    Status: {statusDisplay.invoiceStatusLabel}
                  </AdminStatusBadge>
                  {dueDateLabel ? (
                    <span
                      className={`font-mono text-[11px] font-medium ${
                        statusDisplay.isOverdue ? 'font-bold text-[#B92B0C]' : 'text-[#46433D]'
                      }`}
                    >
                      Due: {dueDateLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {invoice ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintInvoiceNow}
                    className="sa-btn-primary inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold sm:flex-initial"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download / Print Invoice</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePreviewInvoice}
                    className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Preview Document</span>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {isLoading && !invoice ? (
                <div data-testid="client-invoice-detail-skeleton" className="space-y-3">
                  <div className="h-28 w-full animate-pulse rounded-2xl bg-[#151515]/[0.06]" />
                  <div className="h-36 w-full animate-pulse rounded-2xl bg-[#151515]/[0.06]" />
                  <div className="h-36 w-full animate-pulse rounded-2xl bg-[#151515]/[0.06]" />
                </div>
              ) : error && !invoice ? (
                <AdminEmptyState
                  icon={AlertTriangle}
                  tone="orange"
                  title="Unable to load invoice details"
                  description={error}
                  action={
                    <button
                      type="button"
                      onClick={retry}
                      className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Try Again</span>
                    </button>
                  }
                />
              ) : invoice && statusDisplay ? (
                <>
                  {/* C5 + F1: Payment Status Summary & Customer Payment Instructions */}
                  <section
                    aria-label="Payment status summary"
                    data-testid="client-invoice-payment-summary"
                    className={`rounded-2xl border p-4 ${
                      statusDisplay.isSettled
                        ? 'border-emerald-500/25 bg-[#E6F6EC]/70'
                        : isOutstandingIssued
                          ? 'border-[#FF4B22]/25 bg-white'
                          : 'border-[#151515]/10 bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                          {statusDisplay.isCancelled ? 'Cancelled Statement' : 'Remaining Balance'}
                        </p>
                        <p className="mt-1 font-mono text-2xl font-extrabold tracking-tight text-[#151515] tabular-nums">
                          {statusDisplay.isCancelled
                            ? formatClientRupiah(0)
                            : formatClientRupiah(invoice.balanceDue)}
                        </p>
                      </div>

                      <AdminStatusBadge
                        tone={statusDisplay.tone}
                        dot={!statusDisplay.isCancelled}
                      >
                        {statusDisplay.label}
                      </AdminStatusBadge>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-[#151515]/10 pt-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-[#666159]">Total Invoice</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-[#151515] tabular-nums">
                          {formatClientRupiah(invoice.financialSnapshot?.totalAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#666159]">Total Paid</dt>
                        <dd className="mt-0.5 font-mono font-semibold text-[#0F6246] tabular-nums">
                          {formatClientRupiah(invoice.amountPaid)}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-[#666159]">Issued Date</dt>
                        <dd className="mt-0.5 font-medium text-[#151515]">{invoiceDateLabel}</dd>
                      </div>
                    </dl>

                    {Number.isInteger(invoice.minimumDepositAmount) &&
                    invoice.minimumDepositAmount > 0 &&
                    invoice.invoiceStatus === INVOICE_STATUS.ISSUED &&
                    invoice.amountPaid < invoice.minimumDepositAmount ? (
                      <div
                        data-testid="client-invoice-deposit-gap-banner"
                        className="mt-3 rounded-xl border border-amber-400/50 bg-[#FEF4DD] px-3 py-2.5 text-xs text-[#6A3B00]"
                      >
                        <p className="font-bold">
                          Deposit Requirement: {formatClientRupiah(invoice.minimumDepositAmount)}
                        </p>
                        <p className="mt-0.5 leading-relaxed">
                          Verified Paid: <strong>{formatClientRupiah(invoice.amountPaid)}</strong>.{' '}
                          <strong>
                            Pay {formatClientRupiah(Math.max(0, invoice.minimumDepositAmount - invoice.amountPaid))} more
                          </strong>{' '}
                          to confirm your booking (uploaded proofs count only after staff verification).
                        </p>
                      </div>
                    ) : null}

                    {statusDisplay.isSettled ? (
                      <div
                        data-testid="client-invoice-paid-banner"
                        className="mt-3 flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2.5 text-xs font-medium text-[#0F6246]"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Payment completed in full. Thank you for recording with us!</span>
                      </div>
                    ) : isOutstandingIssued ? (
                      <div
                        data-testid="client-invoice-payment-instructions"
                        className="sa-panel-ivory mt-3.5 space-y-2.5 rounded-xl p-3.5"
                      >
                        <p className="text-xs font-semibold text-[#151515]">
                          Payment is recorded and verified by the studio team.
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-[#46433D]">
                          Please complete your remaining balance through our official studio payment
                          channels and contact the studio desk so our team can verify and update your
                          invoice.
                        </p>
                        {whatsappHref ? (
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="client-invoice-contact-studio-cta"
                            className="sa-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Contact Studio</span>
                          </a>
                        ) : null}
                      </div>
                    ) : statusDisplay.isCancelled ? (
                      <p className="mt-3 text-xs text-[#666159]">
                        This invoice has been cancelled and is excluded from your outstanding balance.
                      </p>
                    ) : null}
                  </section>

                  {/* Payment Evidence & Verification Panel */}
                  <ClientPaymentEvidencePanel
                    invoice={invoice}
                    customEvidenceAdapter={customEvidenceAdapter}
                    cloudinaryConfig={cloudinaryConfig}
                  />

                  {/* C4: Financial Breakdown */}
                  <section className="rounded-2xl border border-[#151515]/10 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                      <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                        Financial Breakdown
                      </h3>
                    </div>

                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#666159]">Subtotal</dt>
                        <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                          {formatClientRupiah(invoice.financialSnapshot?.subtotal)}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#666159]">Discount</dt>
                        <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                          {invoice.financialSnapshot?.discountAmount > 0
                            ? `- ${formatClientRupiah(invoice.financialSnapshot.discountAmount)}`
                            : formatClientRupiah(0)}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-[#151515]/10 pt-2 text-[13px] font-bold">
                        <dt className="text-[#151515]">Total Invoice</dt>
                        <dd className="font-mono text-[#151515] tabular-nums">
                          {formatClientRupiah(invoice.financialSnapshot?.totalAmount)}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[#666159]">Amount Paid</dt>
                        <dd className="font-mono font-semibold text-[#0F6246] tabular-nums">
                          {formatClientRupiah(invoice.amountPaid)}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-[#151515]/10 pt-2 text-[13px] font-extrabold">
                        <dt className="text-[#151515]">Balance Due</dt>
                        <dd
                          className={`font-mono tabular-nums ${
                            isOutstandingIssued ? 'text-[#B92B0C]' : 'text-[#151515]'
                          }`}
                        >
                          {statusDisplay.isCancelled
                            ? formatClientRupiah(0)
                            : formatClientRupiah(invoice.balanceDue)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* C3: Booking / Service Information (Immutable Snapshot) */}
                  <section className="rounded-2xl border border-[#151515]/10 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                        <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                          Booking & Service Snapshot
                        </h3>
                      </div>
                      <span className="font-mono text-[10.5px] text-[#8B857B]">Asia/Jakarta</span>
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-[#666159]">Service Type</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515]">
                          {invoice.bookingSnapshot?.serviceTypeName || 'Studio Session'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[#666159]">Service Option / Package</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515]">
                          {invoice.bookingSnapshot?.serviceOptionName || 'Standard Session'}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[#666159]">Booking Date</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515]">{bookingDateLabel}</dd>
                      </div>

                      <div>
                        <dt className="text-[#666159]">Studio Room</dt>
                        <dd className="mt-0.5 inline-flex items-center gap-1 font-semibold text-[#151515]">
                          <MapPin className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                          <span>{formatClientStudioRoom(invoice.bookingSnapshot?.studioId)}</span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[#666159]">Start – End Time</dt>
                        <dd className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-[#151515]">
                          <Clock3 className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                          <span>
                            {formatMinuteOfDay(invoice.bookingSnapshot?.startMinute)} –{' '}
                            {formatMinuteOfDay(invoice.bookingSnapshot?.endMinute)} WIB
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-[#666159]">Duration</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515]">
                          {formatDurationMinutes(invoice.bookingSnapshot?.durationMinutes)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* C2: Customer Information */}
                  <section className="rounded-2xl border border-[#151515]/10 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                      <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                        Customer Information
                      </h3>
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-[#666159]">Customer Name</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515]">
                          {invoice.customerSnapshot?.name || 'Studio Client'}
                        </dd>
                      </div>

                      {invoice.customerSnapshot?.bandName ? (
                        <div>
                          <dt className="text-[#666159]">Band / Artist Name</dt>
                          <dd className="mt-0.5 font-semibold text-[#151515]">
                            {invoice.customerSnapshot.bandName}
                          </dd>
                        </div>
                      ) : null}

                      {invoice.customerSnapshot?.phone ? (
                        <div>
                          <dt className="text-[#666159]">Contact Phone</dt>
                          <dd className="mt-0.5 font-mono font-medium text-[#151515]">
                            {invoice.customerSnapshot.phone}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  {/* D: Payment History */}
                  <section className="rounded-2xl border border-[#151515]/10 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                          Payment History
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[#666159]">
                          Verified studio payment and correction entries
                        </p>
                      </div>
                      <AdminStatusBadge tone="ivory" size="sm">
                        {transactions.length === 1
                          ? '1 Entry'
                          : `${transactions.length} Entries`}
                      </AdminStatusBadge>
                    </div>

                    <ClientPaymentTimeline
                      transactions={transactions}
                      isLoading={isTransactionsLoading}
                      hasMore={hasMoreTransactions}
                      onLoadMore={loadMoreTransactions}
                      onPrintReceipt={handlePreviewReceipt}
                    />
                  </section>
                </>
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Document / Receipt Preview Modal */}
      {invoice ? (
        <ClientDocumentPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={
            printTarget.mode === 'receipt'
              ? `Payment Receipt · ${invoice.invoiceNumber}`
              : `Invoice Document · ${invoice.invoiceNumber}`
          }
          printButtonLabel={
            printTarget.mode === 'receipt'
              ? 'Download / Print Receipt'
              : 'Download / Print Invoice'
          }
          onPrint={triggerClientStudioPrint}
        >
          {printTarget.mode === 'receipt' && printTarget.receiptTx ? (
            <ClientPaymentReceiptSheet
              invoice={invoice}
              transaction={printTarget.receiptTx}
              studioName={studioName}
              referenceDateIso={referenceDateIso}
            />
          ) : (
            <ClientInvoiceDocumentSheet
              invoice={invoice}
              transactions={transactions}
              studioName={studioName}
              referenceDateIso={referenceDateIso}
            />
          )}
        </ClientDocumentPreviewModal>
      ) : null}
    </>
  );
}
