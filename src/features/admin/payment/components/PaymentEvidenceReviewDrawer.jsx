import { useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ReceiptText,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { getPaymentMethodLabel } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { PaymentEvidencePreview } from '@/features/payment-evidence/components/PaymentEvidencePreview';
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';
import {
  mapPaymentEvidenceErrorToMessage,
  rejectClientPaymentEvidence,
  verifyClientPaymentEvidence,
} from '@/features/payment-evidence/services/payment-evidence-service';
import {
  getPaymentEvidenceSourceLabel,
  getPaymentEvidenceStatusMeta,
} from '@/features/payment-evidence/utils/payment-evidence-utils';

import { useInvoiceDetail } from '../hooks/useInvoiceDetail';
import { getInvoiceStatusMeta, INVOICE_STATUS } from '../utils/invoice-status';

function parseIntegerInput(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

/**
 * Spatial Ambient Evidence Review Drawer (Section 9C).
 *
 * Allows Staff/Owner to inspect uploaded Cloudinary evidence, compare against
 * live invoice balance, adjust `verifiedAmount` (<= live balanceDue), confirm
 * atomic verification, or reject with a mandatory reason.
 */
export function PaymentEvidenceReviewDrawer({
  open = false,
  evidence = null,
  fallbackInvoice = null,
  actorUid = '',
  reversedTransactionIds = new Set(),
  onOpenChange,
  onOpenInvoice,
  onActionCompleted,
  customPaymentAdapter = null,
  customEvidenceAdapter = null,
}) {
  const { invoice: liveInvoice, isLoading: isInvoiceLoading } = useInvoiceDetail(
    open && evidence?.invoiceId ? evidence.invoiceId : '',
  );
  const invoice = liveInvoice || fallbackInvoice;

  const [verifiedAmountInput, setVerifiedAmountInput] = useState(() =>
    evidence?.claimedAmount ? String(evidence.claimedAmount) : '',
  );
  const [verifyNotes, setVerifyNotes] = useState('');
  const [confirmMode, setConfirmMode] = useState('none'); // 'none' | 'verify' | 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  if (!evidence && !open) return null;

  const statusMeta = getPaymentEvidenceStatusMeta(evidence?.status, 'id');
  const sourceLabel = getPaymentEvidenceSourceLabel(evidence?.evidenceSource, 'id');
  const invoiceMeta = getInvoiceStatusMeta(invoice?.invoiceStatus);
  const isPending = evidence?.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW;
  const isVoidInvoice = invoice?.invoiceStatus === INVOICE_STATUS.VOID;
  const liveBalanceDue = Math.max(0, Math.round(Number(invoice?.balanceDue) || 0));
  const parsedVerifiedAmount = parseIntegerInput(verifiedAmountInput);
  const resultingBalance = Math.max(0, liveBalanceDue - parsedVerifiedAmount);
  const isReversedLinkedTx = Boolean(
    evidence?.linkedTransactionId && reversedTransactionIds?.has?.(evidence.linkedTransactionId),
  );

  const canVerifyInvoice = Boolean(
    isPending && invoice && invoice.invoiceStatus === INVOICE_STATUS.ISSUED && liveBalanceDue > 0,
  );
  const isVerifiedAmountValid =
    parsedVerifiedAmount > 0 && parsedVerifiedAmount <= liveBalanceDue;

  const handleRequestVerifyConfirm = () => {
    setActionError('');
    if (!canVerifyInvoice) {
      setActionError('Invoice tidak berstatus aktif atau tidak memiliki sisa tagihan.');
      return;
    }
    if (!isVerifiedAmountValid) {
      setActionError(
        `Nominal terverifikasi harus lebih dari Rp 0 dan tidak melebihi sisa tagihan (${formatRupiah(liveBalanceDue)}).`,
      );
      return;
    }
    setConfirmMode('verify');
  };

  const handleConfirmVerify = async () => {
    if (submitLockRef.current || isSubmitting || !evidence || !invoice) return;
    setActionError('');
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await verifyClientPaymentEvidence({
        evidenceId: evidence.id,
        verifiedAmount: parsedVerifiedAmount,
        expectedInvoiceVersion: invoice.version,
        notes: verifyNotes.trim(),
        actorUid,
        ...(customPaymentAdapter ? { paymentAdapter: customPaymentAdapter } : {}),
        ...(customEvidenceAdapter ? { evidenceAdapter: customEvidenceAdapter } : {}),
      });

      toast.success(
        `Bukti pembayaran diverifikasi & ${formatRupiah(result.transaction.amount)} dicatat pada ${result.invoice.invoiceNumber}.`,
      );
      setConfirmMode('none');
      onActionCompleted?.('verified', result);
      onOpenChange?.(false);
    } catch (err) {
      const message = mapPaymentEvidenceErrorToMessage(err, { locale: 'id' });
      setActionError(message);
      toast.error(message);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (submitLockRef.current || isSubmitting || !evidence) return;
    const cleanReason = rejectionReason.trim();
    if (cleanReason.length < 3) {
      setActionError('Alasan penolakan wajib diisi minimal 3 karakter.');
      return;
    }

    setActionError('');
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const updated = await rejectClientPaymentEvidence({
        evidenceId: evidence.id,
        rejectionReason: cleanReason,
        actorUid,
        ...(customEvidenceAdapter ? { evidenceAdapter: customEvidenceAdapter } : {}),
      });

      toast.success(
        `Bukti pembayaran ${evidence.invoiceNumber} ditolak. Pelanggan dapat mengunggah ulang bukti baru.`,
      );
      setConfirmMode('none');
      onActionCompleted?.('rejected', updated);
      onOpenChange?.(false);
    } catch (err) {
      const message = mapPaymentEvidenceErrorToMessage(err, { locale: 'id' });
      setActionError(message);
      toast.error(message);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange?.(nextOpen);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          data-testid="admin-payment-evidence-review-drawer"
          aria-label={
            evidence ? `Tinjau bukti pembayaran ${evidence.invoiceNumber}` : 'Tinjau bukti pembayaran'
          }
          data-payment-scoped="true"
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="shrink-0 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/92 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone={statusMeta.tone} size="sm" dot={isPending}>
                    {statusMeta.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ivory" size="sm">
                    {sourceLabel}
                  </AdminStatusBadge>
                  {isReversedLinkedTx ? (
                    <AdminStatusBadge tone="neutral" size="sm">
                      Transaksi Dibatalkan
                    </AdminStatusBadge>
                  ) : null}
                </div>

                <Dialog.Title className="mt-1.5 truncate font-mono text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                  {evidence?.invoiceNumber || 'Bukti Pembayaran'}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#666159]">
                  <span className="font-semibold text-[#151515]">
                    {invoice?.customerSnapshot?.name || 'Pelanggan Studio'}
                  </span>
                  {evidence?.submittedAt ? (
                    <span>• Dikirim {formatIndonesianTimestamp(evidence.submittedAt)}</span>
                  ) : null}
                </Dialog.Description>
              </div>

              <Dialog.Close
                disabled={isSubmitting}
                aria-label="Tutup panel tinjau bukti pembayaran"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-white/90 text-[#46433D] transition-colors hover:bg-white hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {evidence?.invoiceId && onOpenInvoice ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#151515]/[0.07] pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange?.(false);
                    onOpenInvoice(evidence.invoiceId);
                  }}
                  className="sa-control sa-btn-secondary inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                >
                  <ReceiptText className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                  <span>Buka Detail Invoice</span>
                  <ExternalLink className="h-3 w-3 text-[#666159]" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>

          {/* Scrollable Body */}
          <div className="sa-safe-bottom min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {evidence ? (
              <>
                {/* 1. Validated Cloudinary Image Preview */}
                <AdminSurface variant="card" className="space-y-2.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                      Lampiran Bukti Pembayaran
                    </h3>
                    <span className="font-mono text-[10.5px] text-[#666159]">
                      {evidence.evidence?.format?.toUpperCase() || 'IMG'}
                    </span>
                  </div>
                  <PaymentEvidencePreview
                    evidence={evidence.evidence}
                    size="lg"
                    showOpenOriginal
                    locale="id"
                    alt={`Bukti pembayaran ${evidence.invoiceNumber}`}
                  />
                </AdminSurface>

                {/* 2. Submitted Claim Details */}
                <AdminSurface variant="card" className="p-4">
                  <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                    Detail Pengajuan Pembayaran
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] text-[#666159]">Nominal Diklaim</dt>
                      <dd className="mt-0.5 font-mono text-sm font-bold text-[#151515] tabular-nums">
                        {formatRupiah(evidence.claimedAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#666159]">Metode Pembayaran</dt>
                      <dd className="mt-0.5 font-semibold text-[#151515]">
                        {getPaymentMethodLabel(evidence.paymentMethod)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#666159]">Tanggal Bayar</dt>
                      <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-[#151515]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                        <span>
                          {evidence.claimedPaidAt
                            ? formatIndonesianDateMedium(evidence.claimedPaidAt)
                            : '-'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-[#666159]">Nomor Referensi</dt>
                      <dd className="mt-0.5 font-mono font-medium break-all text-[#151515]">
                        {evidence.referenceNumber || '—'}
                      </dd>
                    </div>
                  </dl>
                </AdminSurface>

                {/* 3. Live Invoice Financial Context */}
                <AdminSurface variant="card" className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                      Status Tagihan Saat Ini
                    </h3>
                    {invoice ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${invoiceMeta.badgeClass}`}
                      >
                        {invoiceMeta.label}
                      </span>
                    ) : null}
                  </div>

                  {isInvoiceLoading && !invoice ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#666159]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Memuat saldo invoice terbaru...</span>
                    </div>
                  ) : invoice ? (
                    <dl className="mt-3 grid grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 font-mono text-xs min-[400px]:grid-cols-3 min-[400px]:gap-2">
                      <div>
                        <dt className="font-sans text-[11px] text-[#666159]">Total Invoice</dt>
                        <dd className="mt-0.5 font-semibold text-[#151515] tabular-nums">
                          {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-sans text-[11px] text-[#666159]">Sudah Dibayar</dt>
                        <dd className="mt-0.5 font-semibold text-[#0F6246] tabular-nums">
                          {formatRupiah(invoice.amountPaid || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-sans text-[11px] text-[#666159]">Sisa Tagihan</dt>
                        <dd
                          className={`mt-0.5 font-bold tabular-nums ${
                            liveBalanceDue > 0 && !isVoidInvoice
                              ? 'text-[#FF4B22]'
                              : 'text-[#0F6246]'
                          }`}
                        >
                          {formatRupiah(liveBalanceDue)}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-xs text-[#B92B0C]">
                      Data invoice induk tidak ditemukan.
                    </p>
                  )}
                </AdminSurface>

                {/* 4. Action / Decision Panel OR Read-Only Audit Details */}
                {isPending ? (
                  <AdminSurface
                    variant="card"
                    data-testid="admin-evidence-decision-panel"
                    className="space-y-3.5 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[#151515]" aria-hidden="true" />
                      <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                        Keputusan Verifikasi
                      </h3>
                    </div>

                    {actionError ? (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/30 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{actionError}</span>
                      </div>
                    ) : null}

                    {!canVerifyInvoice ? (
                      <div className="rounded-xl border border-amber-500/30 bg-[#FEF4DD]/70 p-3 text-xs text-[#8A4B08]">
                        Invoice ini sudah lunas atau berstatus dibatalkan sehingga bukti tidak dapat
                        diverifikasi menjadi transaksi pembayaran baru. Anda tetap dapat menolak bukti
                        ini dengan alasan yang jelas.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="admin-evidence-verified-amount"
                            className="block text-xs font-semibold text-[#151515]"
                          >
                            Nominal Terverifikasi (Rp)
                          </label>
                          <input
                            id="admin-evidence-verified-amount"
                            type="text"
                            inputMode="numeric"
                            disabled={isSubmitting || confirmMode === 'verify'}
                            value={verifiedAmountInput}
                            onChange={(e) => {
                              setVerifiedAmountInput(e.target.value.replace(/[^\d]/g, ''));
                              setActionError('');
                            }}
                            className="sa-input min-h-10.5 w-full px-3 font-mono text-sm font-bold text-[#151515]"
                          />
                          <p className="text-[11px] text-[#666159]">
                            Default mengikuti nominal klaim ({formatRupiah(evidence.claimedAmount)}).
                            Dapat disesuaikan jika nominal transfer berbeda, maksimal{' '}
                            <span className="font-mono font-semibold text-[#151515]">
                              {formatRupiah(liveBalanceDue)}
                            </span>
                            .
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="admin-evidence-verify-notes"
                            className="block text-xs font-semibold text-[#151515]"
                          >
                            Catatan Verifikasi (Opsional)
                          </label>
                          <input
                            id="admin-evidence-verify-notes"
                            type="text"
                            maxLength={300}
                            disabled={isSubmitting || confirmMode === 'verify'}
                            value={verifyNotes}
                            onChange={(e) => setVerifyNotes(e.target.value)}
                            placeholder="Contoh: Mutasi masuk BCA terkonfirmasi"
                            className="sa-input min-h-10 w-full px-3 text-xs"
                          />
                        </div>

                        <div className="sa-panel-ivory rounded-xl p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#666159]">Nominal dicatat ke ledger</span>
                            <span className="font-mono font-bold text-[#0F6246] tabular-nums">
                              +{formatRupiah(parsedVerifiedAmount)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[#666159]">Sisa tagihan setelah verifikasi</span>
                            <span className="font-mono font-bold text-[#151515] tabular-nums">
                              {formatRupiah(resultingBalance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Confirm Verify Panel */}
                    {confirmMode === 'verify' ? (
                      <div
                        data-testid="admin-evidence-verify-confirmation"
                        className="space-y-3 rounded-xl border border-emerald-500/35 bg-[#E6F6EC]/70 p-3.5 text-xs"
                      >
                        <p className="font-semibold text-[#0F6246]">
                          Konfirmasi Verifikasi &amp; Pencatatan Pembayaran
                        </p>
                        <p className="leading-relaxed text-[#151515]">
                          Tindakan ini akan menyetujui bukti pembayaran secara atomik, mencatat
                          transaksi resmi sebesar{' '}
                          <strong className="font-mono">
                            {formatRupiah(parsedVerifiedAmount)}
                          </strong>
                          , dan memperbarui sisa tagihan {evidence.invoiceNumber} menjadi{' '}
                          <strong className="font-mono">{formatRupiah(resultingBalance)}</strong>.
                        </p>
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setConfirmMode('none')}
                            className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleConfirmVerify}
                            className="sa-control sa-btn-lime inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold disabled:opacity-60 sm:flex-initial"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span>
                              {isSubmitting
                                ? 'Memproses...'
                                : 'Ya, Verifikasi & Catat Pembayaran'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : confirmMode === 'reject' ? (
                      <div
                        data-testid="admin-evidence-reject-panel"
                        className="space-y-3 rounded-xl border border-[#FF4B22]/30 bg-[#FFEDE8]/70 p-3.5 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#B92B0C]">Tolak Bukti Pembayaran</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#46433D]">
                            Alasan penolakan akan ditampilkan ke pelanggan di Client Portal agar
                            mereka dapat mengunggah bukti pembayaran yang benar. Saldo invoice tidak
                            akan berubah.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="admin-evidence-rejection-reason"
                            className="block text-xs font-semibold text-[#151515]"
                          >
                            Alasan Penolakan <span className="text-[#FF4B22]">*</span>
                          </label>
                          <textarea
                            id="admin-evidence-rejection-reason"
                            rows={3}
                            maxLength={300}
                            disabled={isSubmitting}
                            value={rejectionReason}
                            onChange={(e) => {
                              setRejectionReason(e.target.value);
                              setActionError('');
                            }}
                            placeholder="Contoh: Nominal pada bukti transfer buram / tidak sesuai dengan mutasi masuk."
                            className="sa-input w-full p-2.5 text-xs"
                          />
                          <p className="text-right font-mono text-[10px] text-[#666159]">
                            {rejectionReason.trim().length}/300
                          </p>
                        </div>

                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => {
                              setConfirmMode('none');
                              setActionError('');
                            }}
                            className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleConfirmReject}
                            className="sa-control inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border border-[#FF4B22] bg-[#FF4B22] px-4 text-xs font-semibold text-white hover:bg-[#d93915] disabled:opacity-60 sm:flex-initial"
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span>{isSubmitting ? 'Menolak...' : 'Konfirmasi Penolakan'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setActionError('');
                            setConfirmMode('reject');
                          }}
                          className="sa-control inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[11px] border border-[#FF4B22]/30 bg-[#FFEDE8]/85 px-4 text-xs font-semibold text-[#B92B0C] hover:border-[#FF4B22] hover:bg-[#FF4B22] hover:text-white sm:flex-initial"
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Tolak Bukti</span>
                        </button>

                        {canVerifyInvoice ? (
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleRequestVerifyConfirm}
                            className="sa-control sa-btn-lime inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold sm:flex-1"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            <span>Verifikasi &amp; Catat Pembayaran</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </AdminSurface>
                ) : (
                  <AdminSurface variant="card" className="space-y-2.5 p-4">
                    <h3 className="text-xs font-bold tracking-wider text-[#151515] uppercase">
                      Riwayat Keputusan &amp; Audit
                    </h3>
                    <dl className="space-y-2 border-t border-[#151515]/[0.07] pt-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#666159]">Status Akhir</dt>
                        <dd className="font-semibold text-[#151515]">{statusMeta.label}</dd>
                      </div>
                      {evidence.verifiedAmount != null ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#666159]">Nominal Tercatat</dt>
                          <dd className="font-mono font-bold text-[#0F6246] tabular-nums">
                            {formatRupiah(evidence.verifiedAmount)}
                          </dd>
                        </div>
                      ) : null}
                      {evidence.linkedTransactionId ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#666159]">ID Transaksi Ledger</dt>
                          <dd className="font-mono text-[11px] break-all text-[#151515]">
                            {evidence.linkedTransactionId}
                          </dd>
                        </div>
                      ) : null}
                      {evidence.reviewedAt ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-[#666159]">Ditinjau Pada</dt>
                          <dd className="font-mono text-[11px] text-[#151515]">
                            {formatIndonesianTimestamp(evidence.reviewedAt)}
                          </dd>
                        </div>
                      ) : null}
                      {evidence.rejectionReason ? (
                        <div className="rounded-xl border border-[#FF4B22]/20 bg-[#FFEDE8]/65 p-2.5 text-[#B92B0C]">
                          <p className="text-[10.5px] font-bold uppercase">Alasan Penolakan</p>
                          <p className="mt-0.5 text-xs">{evidence.rejectionReason}</p>
                        </div>
                      ) : null}
                      {isReversedLinkedTx ? (
                        <div className="rounded-xl border border-amber-500/30 bg-[#FEF4DD]/70 p-2.5 text-[#8A4B08]">
                          Transaksi pembayaran yang terhubung dengan bukti ini telah dibatalkan
                          (reversed) di ledger. Catatan bukti tetap dipertahankan untuk audit.
                        </div>
                      ) : null}
                    </dl>
                  </AdminSurface>
                )}
              </>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
