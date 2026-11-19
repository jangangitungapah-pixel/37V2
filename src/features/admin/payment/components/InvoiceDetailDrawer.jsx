import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  Ban,
  Banknote,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Printer,
  ReceiptText,
  RotateCcw,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
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

import { useInvoiceDetail } from '../hooks/useInvoiceDetail';
import { buildWhatsAppInvoiceSummary } from '../utils/invoice-format';
import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentSourceMeta,
  getPaymentStatusMeta,
  getTransactionTypeMeta,
  INVOICE_STATUS,
  TRANSACTION_TYPE,
} from '../utils/invoice-status';

export function InvoiceDetailDrawer({
  invoiceId,
  fallbackInvoice = null,
  open,
  onOpenChange,
  onOpenRecordPayment,
  onOpenPrintPreview,
  onOpenReceipt,
  onOpenCorrection,
  onOpenVoidInvoice,
  onSaveDueDate,
}) {
  const {
    invoice: liveInvoice,
    transactions,
    reversedTransactionIds,
    isLoading,
    error,
  } = useInvoiceDetail(open ? invoiceId : '');

  const invoice = liveInvoice || fallbackInvoice;

  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!invoice && !open) return null;

  const isVoid = invoice?.invoiceStatus === INVOICE_STATUS.VOID;
  const effectiveStatus = invoice ? getEffectivePaymentStatus(invoice) : 'unpaid';
  const paymentMeta = getPaymentStatusMeta(effectiveStatus);
  const invoiceMeta = getInvoiceStatusMeta(invoice?.invoiceStatus);
  const room = getStudioRoomById(invoice?.bookingSnapshot?.studioId);
  const canRecordPayment = Boolean(invoice && !isVoid && invoice.balanceDue > 0);
  const canVoid = Boolean(invoice && invoice.invoiceStatus === INVOICE_STATUS.ISSUED);

  const handleCopySummary = async () => {
    if (!invoice) return;
    try {
      const text = buildWhatsAppInvoiceSummary(invoice);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedSummary(true);
      toast.success('Ringkasan invoice disalin untuk WhatsApp.');
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      toast.error('Gagal menyalin ringkasan invoice.');
    }
  };

  const handleCommitDueDate = async () => {
    if (!invoice || savingDueDate) return;
    setSavingDueDate(true);
    try {
      await onSaveDueDate?.({
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        dueDate: dueDateInput || null,
      });
      setEditingDueDate(false);
    } finally {
      setSavingDueDate(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={invoice ? `Detail invoice ${invoice.invoiceNumber}` : 'Detail invoice'}
          data-payment-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col border-l-2 shadow-[-6px_0px_0px_#151515]"
        >
          {/* Sticky Dark Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase ${invoiceMeta.badgeClass}`}
                  >
                    {invoiceMeta.label}
                  </span>
                  {!isVoid ? (
                    <span
                      className={`border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.label} ({paymentMeta.indoLabel})
                    </span>
                  ) : null}
                </div>

                <Dialog.Title className="font-display mt-1.5 truncate text-xl leading-none font-black tracking-tight text-white uppercase sm:text-2xl">
                  {invoice?.invoiceNumber || 'Memuat Invoice...'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] text-neutral-300">
                  <span>Issued: {formatIndonesianTimestamp(invoice?.invoiceDate)}</span>
                  {invoice?.dueDate ? (
                    <span className="text-studio-lime font-bold">
                      • Due: {formatIndonesianDateMedium(invoice.dueDate)}
                    </span>
                  ) : null}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail invoice"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Action Bar */}
            {invoice ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-neutral-800 pt-2.5">
                {canRecordPayment ? (
                  <button
                    type="button"
                    onClick={() => onOpenRecordPayment?.(invoice)}
                    className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                  >
                    <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Record Payment</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => onOpenPrintPreview?.(invoice, transactions)}
                  className="border-studio-ivory bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="border-studio-ivory bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                >
                  {copiedSummary ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedSummary ? 'Disalin' : 'Copy WA'}</span>
                </button>

                {canVoid ? (
                  <button
                    type="button"
                    onClick={() => onOpenVoidInvoice?.(invoice)}
                    className="border-studio-ivory bg-studio-orange text-studio-white inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Void Invoice</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 pb-7 sm:px-5 sm:py-4">
            {error ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-3 text-xs font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {!invoice ? (
              <div className="cal-card bg-studio-white flex items-center gap-2 p-4 font-mono text-xs font-bold">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Memuat dokumen invoice...</span>
                  </>
                ) : (
                  <span>Dokumen invoice tidak ditemukan.</span>
                )}
              </div>
            ) : (
              <>
                {isVoid && invoice.voidReason ? (
                  <div className="border-studio-ink text-studio-white border-2 bg-neutral-900 p-3 text-xs">
                    <p className="font-mono text-[9.5px] font-extrabold text-amber-300 uppercase">
                      Invoice Void — Pembayaran Baru Diblokir
                    </p>
                    <p className="mt-1 font-medium text-neutral-200">
                      Alasan: {invoice.voidReason}
                    </p>
                  </div>
                ) : null}

                {/* 1. Financial Breakdown (Strict Customer Billing — Zero Internal Fees) */}
                <section
                  aria-labelledby="invoice-financial-heading"
                  className="cal-card bg-studio-white p-3.5 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      id="invoice-financial-heading"
                      className="font-mono text-xs font-extrabold tracking-wider uppercase"
                    >
                      Financial Summary
                    </h3>

                    {!isVoid ? (
                      editingDueDate ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            aria-label="Tanggal jatuh tempo invoice"
                            value={dueDateInput}
                            onChange={(e) => setDueDateInput(e.target.value)}
                            className="border-studio-ink bg-studio-ivory h-8 border px-2 font-mono text-[10px] font-bold"
                          />
                          <button
                            type="button"
                            disabled={savingDueDate}
                            onClick={handleCommitDueDate}
                            className="border-studio-ink bg-studio-lime text-studio-ink h-8 cursor-pointer border px-2 font-mono text-[9.5px] font-extrabold uppercase"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDueDate(false)}
                            className="border-studio-ink bg-studio-ivory text-studio-ink h-8 cursor-pointer border px-2 font-mono text-[9.5px] font-bold uppercase"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDueDateInput(invoice.dueDate || '');
                            setEditingDueDate(true);
                          }}
                          className="text-studio-muted-ink hover:text-studio-orange cursor-pointer font-mono text-[10px] font-extrabold uppercase underline"
                        >
                          {invoice.dueDate ? 'Ubah Due Date' : '+ Set Due Date'}
                        </button>
                      )
                    ) : null}
                  </div>

                  <dl className="mt-3 space-y-1.5 border-t border-neutral-200 pt-3 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-studio-muted-ink">Subtotal</dt>
                      <dd className="font-bold tabular-nums">
                        {formatRupiah(invoice.financialSnapshot?.subtotal || 0)}
                      </dd>
                    </div>
                    {Number(invoice.financialSnapshot?.discountAmount) > 0 ? (
                      <div className="flex justify-between gap-2 text-emerald-800">
                        <dt>Discount</dt>
                        <dd className="font-bold tabular-nums">
                          -{formatRupiah(invoice.financialSnapshot.discountAmount)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="border-studio-ink flex justify-between gap-2 border-t pt-1.5 text-sm font-extrabold">
                      <dt>Total Invoice</dt>
                      <dd className="tabular-nums">
                        {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-800">
                      <dt>Amount Paid</dt>
                      <dd className="font-extrabold tabular-nums">
                        {formatRupiah(invoice.amountPaid || 0)}
                      </dd>
                    </div>
                    <div className="border-studio-ink flex justify-between gap-2 border-t pt-1.5 text-sm font-extrabold">
                      <dt className={invoice.balanceDue > 0 && !isVoid ? 'text-studio-orange' : ''}>
                        Outstanding Balance
                      </dt>
                      <dd
                        className={`tabular-nums ${
                          invoice.balanceDue > 0 && !isVoid
                            ? 'text-studio-orange'
                            : 'text-emerald-800'
                        }`}
                      >
                        {formatRupiah(invoice.balanceDue || 0)}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* 2. Customer Snapshot */}
                <section
                  aria-labelledby="invoice-customer-heading"
                  className="cal-card bg-studio-white p-3.5 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="invoice-customer-heading"
                      className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wider uppercase"
                    >
                      <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Customer Snapshot</span>
                    </h3>
                    {invoice.customerId ? (
                      <Link
                        to={`/admin/customer?customerId=${encodeURIComponent(invoice.customerId)}`}
                        className="text-studio-ink hover:text-studio-orange inline-flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase"
                      >
                        <span>Customer Profile</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>

                  <dl className="mt-2.5 grid grid-cols-1 gap-2.5 border-t border-neutral-200 pt-2.5 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                        Customer Name
                      </dt>
                      <dd className="mt-0.5 font-extrabold">
                        {invoice.customerSnapshot?.name || '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                        Phone / WhatsApp
                      </dt>
                      <dd className="mt-0.5 font-mono font-extrabold">
                        {formatPhoneDisplay(invoice.customerSnapshot?.phone || '') || '-'}
                      </dd>
                    </div>
                    {invoice.customerSnapshot?.bandName ? (
                      <div className="sm:col-span-2">
                        <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                          Band / Project
                        </dt>
                        <dd className="mt-0.5 font-bold">{invoice.customerSnapshot.bandName}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                {/* 3. Booking Snapshot */}
                <section
                  aria-labelledby="invoice-booking-heading"
                  className="cal-card bg-studio-white p-3.5 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="invoice-booking-heading"
                      className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wider uppercase"
                    >
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Booking Details</span>
                    </h3>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${room.badgeClass}`}
                    >
                      {room.label}
                    </span>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-1 gap-2.5 border-t border-neutral-200 pt-2.5 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                        Service
                      </dt>
                      <dd className="mt-0.5 font-extrabold">
                        {invoice.bookingSnapshot?.serviceTypeName}
                        {invoice.bookingSnapshot?.serviceOptionName
                          ? ` • ${invoice.bookingSnapshot.serviceOptionName}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                        Date &amp; Time
                      </dt>
                      <dd className="mt-0.5 font-mono font-bold">
                        {invoice.bookingSnapshot?.bookingDate
                          ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
                          : '-'}{' '}
                        •{' '}
                        {formatMinuteRange(
                          invoice.bookingSnapshot?.startMinute ?? 600,
                          invoice.bookingSnapshot?.endMinute ?? 660,
                          false,
                        )}{' '}
                        ({formatDurationMinutes(invoice.bookingSnapshot?.durationMinutes ?? 60)})
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                        Booking ID
                      </dt>
                      <dd className="mt-0.5 font-mono text-[11px] font-bold break-all">
                        {invoice.bookingId}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* 4. Payment History Ledger */}
                <section
                  aria-labelledby="invoice-payments-heading"
                  className="cal-card bg-studio-white p-3.5 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
                    <h3
                      id="invoice-payments-heading"
                      className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wider uppercase"
                    >
                      <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Payment History ({transactions.length})</span>
                    </h3>
                    <span className="text-studio-muted-ink font-mono text-[9.5px] font-bold uppercase">
                      Append-Only Ledger
                    </span>
                  </div>

                  {isLoading && transactions.length === 0 ? (
                    <div className="mt-3 flex items-center gap-2 font-mono text-xs font-bold">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Memuat riwayat transaksi...</span>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="border-studio-ink bg-studio-ivory mt-3 border border-dashed p-4 text-center">
                      <p className="font-mono text-xs font-extrabold uppercase">
                        Belum Ada Pembayaran Tercatat
                      </p>
                      <p className="text-studio-muted-ink mt-1 text-xs">
                        Klik <strong>Record Payment</strong> untuk mencatat DP, cicilan, atau
                        pelunasan.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {transactions.map((tx) => {
                        const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
                        const isReversed = reversedTransactionIds.has(tx.id);
                        const typeMeta = getTransactionTypeMeta(tx.transactionType);
                        const sourceMeta = getPaymentSourceMeta(tx.source);
                        const canReverse = !isVoid && !isReversal && !isReversed;

                        return (
                          <li
                            key={tx.id}
                            className={`border-studio-ink border-2 p-2.5 text-xs ${
                              isReversal
                                ? 'border-l-studio-orange border-l-4 bg-orange-50/50'
                                : 'bg-studio-ivory/50'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span
                                    className={`border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold uppercase ${typeMeta.badgeClass}`}
                                  >
                                    {typeMeta.label}
                                  </span>
                                  <span className="border-studio-ink bg-studio-white border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase">
                                    {getPaymentMethodLabel(tx.paymentMethod)}
                                  </span>
                                  <span className="text-studio-muted-ink font-mono text-[9.5px] font-bold">
                                    {sourceMeta.shortLabel}
                                  </span>
                                  {isReversed ? (
                                    <span className="border-studio-ink border bg-neutral-200 px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold text-neutral-700 uppercase">
                                      Reversed
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mt-1 font-mono text-[10.5px] font-bold">
                                  {formatIndonesianTimestamp(tx.receivedAt || tx.createdAt)}
                                </p>
                                {tx.referenceNumber ? (
                                  <p className="text-studio-muted-ink font-mono text-[10px]">
                                    Ref: {tx.referenceNumber}
                                  </p>
                                ) : null}
                                {tx.notes ? (
                                  <p className="text-studio-ink mt-0.5 text-[11px] font-medium">
                                    {tx.notes}
                                  </p>
                                ) : null}
                                <p className="text-studio-subtle-ink mt-0.5 font-mono text-[9.5px]">
                                  Recorded by: {tx.recordedByUid || '-'} • ID: {tx.id}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p
                                  className={`font-mono text-sm font-extrabold tabular-nums ${
                                    isReversal
                                      ? 'text-studio-orange'
                                      : isReversed
                                        ? 'text-neutral-500 line-through'
                                        : 'text-emerald-800'
                                  }`}
                                >
                                  {isReversal ? '-' : '+'}
                                  {formatRupiah(tx.amount)}
                                </p>

                                <div className="mt-1.5 flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenReceipt?.(tx, invoice)}
                                    className="border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex h-7 cursor-pointer items-center gap-1 border px-2 font-mono text-[9px] font-extrabold uppercase"
                                  >
                                    <ReceiptText className="h-3 w-3" aria-hidden="true" />
                                    <span>Receipt</span>
                                  </button>

                                  {canReverse ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenCorrection?.(invoice, tx)}
                                      aria-label={`Koreksi reversal transaksi ${tx.id}`}
                                      className="border-studio-ink bg-studio-ivory text-studio-orange hover:bg-studio-orange hover:text-studio-white inline-flex h-7 cursor-pointer items-center gap-1 border px-2 font-mono text-[9px] font-extrabold uppercase"
                                    >
                                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                      <span>Reverse</span>
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
