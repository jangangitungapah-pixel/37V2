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
  FileCheck2,
  Loader2,
  Printer,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
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
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { PaymentEvidencePreview } from '@/features/payment-evidence/components/PaymentEvidencePreview';
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';
import { useAdminPaymentEvidence } from '@/features/payment-evidence/hooks/useAdminPaymentEvidence';
import {
  getPaymentEvidenceSourceLabel,
  getPaymentEvidenceStatusMeta,
} from '@/features/payment-evidence/utils/payment-evidence-utils';

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
  onOpenEvidenceReview,
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

  const { items: invoiceEvidence, isLoading: isEvidenceLoading } = useAdminPaymentEvidence({
    invoiceId: open ? invoiceId : '',
    enabled: open && Boolean(invoiceId),
  });

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
  const requiresClientEvidence = Boolean(invoice?.clientPaymentEvidenceRequired);
  const pendingEvidence =
    invoiceEvidence.find((ev) => ev.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW) || null;
  const canRecordPayment = Boolean(
    invoice && !isVoid && invoice.balanceDue > 0 && !requiresClientEvidence,
  );
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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={invoice ? `Detail invoice ${invoice.invoiceNumber}` : 'Detail invoice'}
          data-payment-scoped="true"
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="shrink-0 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/92 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${invoiceMeta.badgeClass}`}
                  >
                    {invoiceMeta.label}
                  </span>
                  {!isVoid ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.label}
                    </span>
                  ) : null}
                </div>

                <Dialog.Title className="mt-1.5 truncate font-mono text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  {invoice?.invoiceNumber || 'Memuat Invoice...'}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[#666159] sm:text-xs">
                  <span>Dibuat: {formatIndonesianTimestamp(invoice?.invoiceDate)}</span>
                  {invoice?.dueDate ? (
                    <span className="font-semibold text-[#151515]">
                      • Jatuh Tempo: {formatIndonesianDateMedium(invoice.dueDate)}
                    </span>
                  ) : null}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail invoice"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-white/90 text-[#46433D] transition-colors hover:bg-white hover:text-[#151515]"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Action Bar */}
            {invoice ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#151515]/[0.07] pt-2.5 sm:mt-3.5 sm:gap-2 sm:pt-3">
                {canRecordPayment ? (
                  <button
                    type="button"
                    onClick={() => onOpenRecordPayment?.(invoice)}
                    className="sa-control sa-btn-lime inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                  >
                    <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Catat Pembayaran</span>
                  </button>
                ) : requiresClientEvidence && !isVoid && invoice.balanceDue > 0 ? (
                  pendingEvidence ? (
                    <button
                      type="button"
                      onClick={() => onOpenEvidenceReview?.(pendingEvidence, invoice)}
                      className="sa-control sa-btn-lime inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Tinjau Bukti Pembayaran</span>
                    </button>
                  ) : (
                    <AdminStatusBadge tone="orange" size="sm">
                      Menunggu Bukti Pembayaran Client
                    </AdminStatusBadge>
                  )
                ) : null}

                <button
                  type="button"
                  onClick={() => onOpenPrintPreview?.(invoice, transactions)}
                  className="sa-control sa-btn-secondary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                >
                  <Printer className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                  <span>Cetak / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="sa-control sa-btn-secondary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                >
                  {copiedSummary ? (
                    <Check className="h-3.5 w-3.5 text-[#0F6246]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                  )}
                  <span>{copiedSummary ? 'Disalin' : 'Salin WA'}</span>
                </button>

                {canVoid ? (
                  <button
                    type="button"
                    onClick={() => onOpenVoidInvoice?.(invoice)}
                    className="sa-control inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-[#FF4B22]/25 bg-[#FFEDE8]/85 px-3.5 text-xs font-semibold text-[#B92B0C] transition-colors hover:border-[#FF4B22] hover:bg-[#FF4B22] hover:text-white"
                  >
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Batalkan Invoice</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Scrollable Body */}
          <div className="sa-safe-bottom min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {!invoice ? (
              <AdminSurface
                variant="card"
                className="flex items-center gap-2 p-4 text-xs font-medium text-[#666159]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
                    <span>Memuat dokumen invoice...</span>
                  </>
                ) : (
                  <span>Dokumen invoice tidak ditemukan.</span>
                )}
              </AdminSurface>
            ) : (
              <>
                {isVoid && invoice.voidReason ? (
                  <div className="rounded-2xl border border-white/10 bg-[#151515] p-3.5 text-xs text-white">
                    <p className="font-mono text-[10.5px] font-semibold text-[#C8F13A] uppercase">
                      Invoice Dibatalkan — Tidak Menerima Pembayaran Baru
                    </p>
                    <p className="mt-1 text-neutral-300">Alasan: {invoice.voidReason}</p>
                  </div>
                ) : null}

                {/* 1. Financial Breakdown */}
                <AdminSurface
                  as="section"
                  variant="card"
                  aria-labelledby="invoice-financial-heading"
                  className="p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3
                      id="invoice-financial-heading"
                      className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      Rincian Tagihan
                    </h3>

                    {!isVoid ? (
                      editingDueDate ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="date"
                            aria-label="Tanggal jatuh tempo invoice"
                            value={dueDateInput}
                            onChange={(e) => setDueDateInput(e.target.value)}
                            className="sa-input min-h-10 px-2.5 font-mono text-xs font-medium"
                          />
                          <button
                            type="button"
                            disabled={savingDueDate}
                            onClick={handleCommitDueDate}
                            className="sa-control sa-btn-lime inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-xs font-semibold"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDueDate(false)}
                            className="sa-control sa-btn-secondary inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-xs font-medium"
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
                          className="inline-flex min-h-9.5 cursor-pointer items-center text-xs font-semibold text-[#666159] underline-offset-2 transition-colors hover:text-[#FF4B22] hover:underline"
                        >
                          {invoice.dueDate ? 'Ubah Jatuh Tempo' : '+ Atur Jatuh Tempo'}
                        </button>
                      )
                    ) : null}
                  </div>

                  <dl className="mt-3 space-y-2 border-t border-[#151515]/[0.07] pt-3 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#666159]">Subtotal</dt>
                      <dd className="font-semibold text-[#151515] tabular-nums">
                        {formatRupiah(invoice.financialSnapshot?.subtotal || 0)}
                      </dd>
                    </div>
                    {Number(invoice.financialSnapshot?.discountAmount) > 0 ? (
                      <div className="flex justify-between gap-2 text-[#0F6246]">
                        <dt>Diskon</dt>
                        <dd className="font-semibold tabular-nums">
                          -{formatRupiah(invoice.financialSnapshot.discountAmount)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 text-sm font-bold text-[#151515]">
                      <dt>Total Invoice</dt>
                      <dd className="tabular-nums">
                        {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 text-[#0F6246]">
                      <dt>Sudah Dibayar</dt>
                      <dd className="font-bold tabular-nums">
                        {formatRupiah(invoice.amountPaid || 0)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 text-sm font-bold">
                      <dt
                        className={
                          invoice.balanceDue > 0 && !isVoid ? 'text-[#FF4B22]' : 'text-[#151515]'
                        }
                      >
                        Sisa Tagihan
                      </dt>
                      <dd
                        className={`tabular-nums ${
                          invoice.balanceDue > 0 && !isVoid ? 'text-[#FF4B22]' : 'text-[#0F6246]'
                        }`}
                      >
                        {formatRupiah(invoice.balanceDue || 0)}
                      </dd>
                    </div>
                  </dl>
                </AdminSurface>

                {/* 2. Customer Info */}
                <AdminSurface
                  as="section"
                  variant="card"
                  aria-labelledby="invoice-customer-heading"
                  className="p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="invoice-customer-heading"
                      className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      <UserRound className="h-4 w-4 text-[#666159]" aria-hidden="true" />
                      <span>Data Pelanggan</span>
                    </h3>
                    {invoice.customerId ? (
                      <Link
                        to={`/admin/customer?customerId=${encodeURIComponent(invoice.customerId)}`}
                        className="inline-flex min-h-9.5 items-center gap-1 px-1 text-xs font-semibold text-[#666159] transition-colors hover:text-[#FF4B22]"
                      >
                        <span>Lihat Pelanggan</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-[#151515]/[0.07] pt-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-medium text-[#666159]">Nama Pelanggan</dt>
                      <dd className="mt-0.5 font-semibold text-[#151515]">
                        {invoice.customerSnapshot?.name || '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-[#666159]">No. HP / WhatsApp</dt>
                      <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                        {formatPhoneDisplay(invoice.customerSnapshot?.phone || '') || '-'}
                      </dd>
                    </div>
                    {invoice.customerSnapshot?.bandName ? (
                      <div className="sm:col-span-2">
                        <dt className="text-[11px] font-medium text-[#666159]">Band / Project</dt>
                        <dd className="mt-0.5 font-medium text-[#151515]">
                          {invoice.customerSnapshot.bandName}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </AdminSurface>

                {/* 3. Booking Info */}
                <AdminSurface
                  as="section"
                  variant="card"
                  aria-labelledby="invoice-booking-heading"
                  className="p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="invoice-booking-heading"
                      className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      <CalendarClock className="h-4 w-4 text-[#666159]" aria-hidden="true" />
                      <span>Detail Booking</span>
                    </h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${room.badgeClass}`}
                    >
                      {room.label}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-[#151515]/[0.07] pt-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-medium text-[#666159]">Layanan</dt>
                      <dd className="mt-0.5 font-semibold text-[#151515]">
                        {invoice.bookingSnapshot?.serviceTypeName}
                        {invoice.bookingSnapshot?.serviceOptionName
                          ? ` • ${invoice.bookingSnapshot.serviceOptionName}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-[#666159]">Tanggal &amp; Jam</dt>
                      <dd className="mt-0.5 font-mono font-medium text-[#151515]">
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
                      <dt className="text-[11px] font-medium text-[#666159]">Kode Booking</dt>
                      <dd className="mt-0.5 font-mono text-xs break-all text-[#46433D]">
                        {invoice.bookingId}
                      </dd>
                    </div>
                  </dl>
                </AdminSurface>

                {/* 4. Payment History */}
                <AdminSurface
                  as="section"
                  variant="card"
                  aria-labelledby="invoice-payments-heading"
                  className="p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                    <h3
                      id="invoice-payments-heading"
                      className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      <ReceiptText className="h-4 w-4 text-[#666159]" aria-hidden="true" />
                      <span>Riwayat Pembayaran ({transactions.length})</span>
                    </h3>
                    <span className="text-[11px] text-[#666159]">Tercatat Permanen</span>
                  </div>

                  {isLoading && transactions.length === 0 ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#666159]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Memuat riwayat transaksi...</span>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="sa-panel mt-3 border-dashed p-5 text-center">
                      <p className="text-xs font-semibold text-[#151515]">
                        Belum Ada Pembayaran Tercatat
                      </p>
                      <p className="mt-1 text-xs text-[#666159]">
                        {requiresClientEvidence ? (
                          <>
                            Invoice ini berasal dari Client Portal dan wajib melalui unggah serta
                            verifikasi bukti pembayaran pelanggan.
                          </>
                        ) : (
                          <>
                            Klik <strong>Catat Pembayaran</strong> untuk mencatat DP, cicilan, atau
                            pelunasan.
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {transactions.map((tx) => {
                        const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
                        const isReversed = reversedTransactionIds.has(tx.id);
                        const typeMeta = getTransactionTypeMeta(tx.transactionType);
                        const sourceMeta = getPaymentSourceMeta(tx.source);
                        const canReverse = !isVoid && !isReversal && !isReversed;

                        return (
                          <li
                            key={tx.id}
                            className={`rounded-xl border border-[#151515]/10 p-3 text-xs ${
                              isReversal
                                ? 'border-l-[3px] border-l-[#FF4B22] bg-[#FFEDE8]/45'
                                : 'bg-[#FAF8F3]/75'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${typeMeta.badgeClass}`}
                                  >
                                    {typeMeta.label}
                                  </span>
                                  <AdminStatusBadge
                                    tone="ivory"
                                    size="sm"
                                    className="font-mono uppercase"
                                  >
                                    {getPaymentMethodLabel(tx.paymentMethod)}
                                  </AdminStatusBadge>
                                  <span className="text-[11px] font-medium text-[#666159]">
                                    {sourceMeta.shortLabel}
                                  </span>
                                  {isReversed ? (
                                    <AdminStatusBadge
                                      tone="neutral"
                                      size="sm"
                                      className="uppercase"
                                    >
                                      Dibatalkan
                                    </AdminStatusBadge>
                                  ) : null}
                                </div>

                                <p className="mt-1.5 font-mono text-[11px] font-medium text-[#151515]">
                                  {formatIndonesianTimestamp(tx.receivedAt || tx.createdAt)}
                                </p>
                                {tx.referenceNumber ? (
                                  <p className="font-mono text-[11px] text-[#666159]">
                                    Ref: {tx.referenceNumber}
                                  </p>
                                ) : null}
                                {tx.notes ? (
                                  <p className="mt-0.5 text-xs text-[#46433D]">{tx.notes}</p>
                                ) : null}
                                <p className="mt-0.5 font-mono text-[10px] text-[#8B857B]">
                                  No. Transaksi: {tx.id}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p
                                  className={`font-mono text-sm font-bold tabular-nums ${
                                    isReversal
                                      ? 'text-[#FF4B22]'
                                      : isReversed
                                        ? 'text-[#8B857B] line-through'
                                        : 'text-[#0F6246]'
                                  }`}
                                >
                                  {isReversal ? '-' : '+'}
                                  {formatRupiah(tx.amount)}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onOpenReceipt?.(tx, invoice)}
                                    className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold hover:bg-[#C8F13A]"
                                  >
                                    <ReceiptText className="h-3 w-3" aria-hidden="true" />
                                    <span>Kwitansi</span>
                                  </button>

                                  {canReverse ? (
                                    <button
                                      type="button"
                                      onClick={() => onOpenCorrection?.(invoice, tx)}
                                      aria-label={`Koreksi atau batalkan transaksi ${tx.id}`}
                                      className="sa-control inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[#FF4B22]/25 bg-[#FFEDE8]/85 px-3 py-1 text-[11px] font-semibold text-[#B92B0C] transition-colors hover:bg-[#FF4B22] hover:text-white"
                                    >
                                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                      <span>Batalkan</span>
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
                </AdminSurface>

                {/* 5. Linked Payment Evidence History (Client-Submitted & Admin-Attached) */}
                {(requiresClientEvidence || invoiceEvidence.length > 0) ? (
                  <AdminSurface
                    as="section"
                    variant="card"
                    aria-labelledby="invoice-evidence-heading"
                    data-testid="admin-invoice-evidence-section"
                    className="p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                      <h3
                        id="invoice-evidence-heading"
                        className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                      >
                        <FileCheck2 className="h-4 w-4 text-[#666159]" aria-hidden="true" />
                        <span>Bukti Pembayaran ({invoiceEvidence.length})</span>
                      </h3>
                      {requiresClientEvidence ? (
                        <AdminStatusBadge tone="orange" size="sm">
                          Wajib Bukti Client Portal
                        </AdminStatusBadge>
                      ) : (
                        <span className="text-[11px] text-[#666159]">Lampiran Opsional</span>
                      )}
                    </div>

                    {isEvidenceLoading && invoiceEvidence.length === 0 ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#666159]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Memuat bukti pembayaran...</span>
                      </div>
                    ) : invoiceEvidence.length === 0 ? (
                      <div className="sa-panel mt-3 border-dashed p-4 text-center">
                        <p className="text-xs font-semibold text-[#151515]">
                          Belum Ada Bukti Pembayaran Diunggah
                        </p>
                        <p className="mt-1 text-xs text-[#666159]">
                          Pelanggan dapat mengunggah bukti transfer melalui Client Portal pada detail
                          invoice ini.
                        </p>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-2.5">
                        {invoiceEvidence.map((ev) => {
                          const evStatusMeta = getPaymentEvidenceStatusMeta(ev.status, 'id');
                          const evSourceLabel = getPaymentEvidenceSourceLabel(
                            ev.evidenceSource,
                            'id',
                          );
                          const isEvPending =
                            ev.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW;
                          const isEvReversed = Boolean(
                            ev.linkedTransactionId &&
                            reversedTransactionIds.has(ev.linkedTransactionId),
                          );

                          return (
                            <li
                              key={ev.id}
                              data-testid={`admin-invoice-evidence-item-${ev.id}`}
                              className="flex flex-wrap items-start gap-3 rounded-xl border border-[#151515]/10 bg-[#FAF8F3]/75 p-3 text-xs min-[420px]:flex-nowrap"
                            >
                              <div className="shrink-0">
                                <PaymentEvidencePreview
                                  evidence={ev.evidence}
                                  size="sm"
                                  locale="id"
                                  alt={`Bukti ${ev.invoiceNumber}`}
                                />
                              </div>

                              <div className="min-w-[140px] flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <AdminStatusBadge
                                    tone={evStatusMeta.tone}
                                    size="sm"
                                    dot={isEvPending}
                                  >
                                    {evStatusMeta.label}
                                  </AdminStatusBadge>
                                  <AdminStatusBadge tone="ivory" size="sm">
                                    {evSourceLabel}
                                  </AdminStatusBadge>
                                  {isEvReversed ? (
                                    <AdminStatusBadge tone="neutral" size="sm">
                                      Dibatalkan
                                    </AdminStatusBadge>
                                  ) : null}
                                </div>

                                <p className="font-mono font-bold text-[#151515] tabular-nums">
                                  {formatRupiah(ev.verifiedAmount ?? ev.claimedAmount)}
                                  {ev.verifiedAmount != null &&
                                  ev.verifiedAmount !== ev.claimedAmount
                                    ? ` (Klaim: ${formatRupiah(ev.claimedAmount)})`
                                    : ''}
                                </p>
                                <p className="text-[11px] text-[#666159]">
                                  {getPaymentMethodLabel(ev.paymentMethod)} •{' '}
                                  {formatIndonesianTimestamp(ev.submittedAt)}
                                </p>
                                {ev.rejectionReason ? (
                                  <p className="text-[11px] text-[#B92B0C]">
                                    Alasan ditolak: {ev.rejectionReason}
                                  </p>
                                ) : null}
                              </div>

                              {onOpenEvidenceReview ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenEvidenceReview(ev, invoice)}
                                  className={`sa-control ml-auto inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center rounded-full px-3.5 py-1 text-[11px] font-semibold ${
                                    isEvPending ? 'sa-btn-lime' : 'sa-btn-secondary'
                                  }`}
                                >
                                  {isEvPending ? 'Tinjau' : 'Lihat'}
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </AdminSurface>
                ) : null}
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
