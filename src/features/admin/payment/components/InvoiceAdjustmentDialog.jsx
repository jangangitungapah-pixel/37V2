import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Loader2, Scale, X } from 'lucide-react';

import { formatRupiah, parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminStatusBadge } from '@/features/admin/design-system';

import { generateAdjustmentId, validateCreateInvoiceAdjustmentInput } from '../schemas/payment-schema';
import { mapPaymentErrorToMessage } from '../services/invoice-service';
import { ADJUSTMENT_CATEGORY_OPTIONS } from '../utils/invoice-status';

/**
 * Append-Only Price Adjustment Dialog (`AD-06`, `OD-11`).
 * Never mutates `financialSnapshot`; creates `invoices/{invoiceId}/adjustments/{adjustmentId}`
 * and atomically updates `effectiveTotalAmount`, `balanceDue`, and `overpaidCreditBalance`.
 */
export function InvoiceAdjustmentDialog({
  open,
  invoice,
  onOpenChange,
  onSubmitAdjustment,
}) {
  const [adjustmentId] = useState(() => generateAdjustmentId());
  const [category, setCategory] = useState('service_change');
  const [direction, setDirection] = useState('increase'); // 'increase' | 'decrease'
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;

  const baseTotal = Math.max(0, Math.round(Number(invoice.financialSnapshot?.totalAmount) || 0));
  const currentAdjustmentTotal = Math.round(Number(invoice.adjustmentTotal) || 0);
  const currentEffectiveTotal = Math.max(
    0,
    Math.round(Number(invoice.effectiveTotalAmount ?? baseTotal) || 0),
  );
  const totalPaid = Math.max(0, Math.round(Number(invoice.amountPaid) || 0));
  const refundedTotal = Math.max(0, Math.round(Number(invoice.refundedTotal) || 0));
  const creditConvertedTotal = Math.max(0, Math.round(Number(invoice.creditConvertedTotal) || 0));
  const netPaid = Math.max(0, totalPaid - refundedTotal - creditConvertedTotal);

  const absAmount = parseMoneyInput(amountInput);
  const signedDelta = direction === 'decrease' ? -absAmount : absAmount;
  const projectedEffectiveTotal = currentEffectiveTotal + signedDelta;
  const wouldBecomeNegative = projectedEffectiveTotal < 0;
  const clampedEffectiveTotal = Math.max(0, projectedEffectiveTotal);
  const projectedBalanceDue = Math.max(0, clampedEffectiveTotal - netPaid);
  const projectedOverpaidCredit = Math.max(0, netPaid - clampedEffectiveTotal);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setSubmitError('');

    const validation = validateCreateInvoiceAdjustmentInput(
      {
        category,
        deltaAmount: signedDelta,
        reason,
      },
      { currentEffectiveTotal },
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitAdjustment?.({
        adjustmentId,
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        category: validation.data.category,
        deltaAmount: validation.data.deltaAmount,
        reason: validation.data.reason,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapPaymentErrorToMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(true))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-testid="invoice-adjustment-dialog"
            aria-label={`Penyesuaian harga invoice ${invoice.invoiceNumber}`}
            data-payment-scoped="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="ivory" icon={Scale} size="sm" className="uppercase">
                  Append-Only Adjustment Ledger
                </AdminStatusBadge>
                <Dialog.Title className="mt-1.5 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  Penyesuaian Harga Invoice
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-[#666159] sm:text-xs">
                  <strong className="text-[#151515]">{invoice.invoiceNumber}</strong> •{' '}
                  {invoice.customerSnapshot?.name}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog penyesuaian harga"
                disabled={isSubmitting}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3]/80 text-[#46433D] transition-colors hover:bg-[#151515]/[0.06] hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="invoice-adjustment-form"
              onSubmit={handleSubmit}
              noValidate
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 sm:space-y-4 sm:px-5 sm:py-4"
            >
              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              ) : null}

              {/* Category */}
              <div>
                <label
                  htmlFor="invoice-adjustment-category"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Kategori Penyesuaian <span className="text-[#FF4B22]">*</span>
                </label>
                <select
                  id="invoice-adjustment-category"
                  data-testid="invoice-adjustment-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="sa-input mt-1.5 h-10.5 w-full px-3 text-xs font-medium"
                >
                  {ADJUSTMENT_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.category ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {fieldErrors.category}
                  </p>
                ) : null}
              </div>

              {/* Direction & Delta Amount */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-[#151515]">
                  Arah &amp; Nominal Penyesuaian (Rp) <span className="text-[#FF4B22]">*</span>
                </span>
                <div
                  role="group"
                  aria-label="Arah penyesuaian harga"
                  className="grid grid-cols-2 gap-2"
                >
                  <button
                    type="button"
                    data-testid="invoice-adjustment-direction-increase"
                    aria-pressed={direction === 'increase'}
                    onClick={() => {
                      setDirection('increase');
                      setFieldErrors((prev) => ({ ...prev, deltaAmount: '' }));
                    }}
                    className={
                      direction === 'increase'
                        ? 'min-h-10 cursor-pointer rounded-xl border border-[#8BAD12]/50 bg-[#EDF8C2] px-3 py-1.5 text-xs font-semibold text-[#243300]'
                        : 'min-h-10 cursor-pointer rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#46433D] hover:bg-white'
                    }
                  >
                    + Tambah Tagihan
                  </button>
                  <button
                    type="button"
                    data-testid="invoice-adjustment-direction-decrease"
                    aria-pressed={direction === 'decrease'}
                    onClick={() => {
                      setDirection('decrease');
                      setFieldErrors((prev) => ({ ...prev, deltaAmount: '' }));
                    }}
                    className={
                      direction === 'decrease'
                        ? 'min-h-10 cursor-pointer rounded-xl border border-[#FF4B22]/40 bg-[#FFEDE8] px-3 py-1.5 text-xs font-semibold text-[#B92B0C]'
                        : 'min-h-10 cursor-pointer rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#46433D] hover:bg-white'
                    }
                  >
                    - Kurangi Tagihan
                  </button>
                </div>

                <input
                  id="invoice-adjustment-amount"
                  data-testid="invoice-adjustment-amount-input"
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value.replace(/[^\d]/g, ''));
                    setFieldErrors((prev) => ({ ...prev, deltaAmount: '' }));
                  }}
                  placeholder="Contoh: 50000"
                  className="sa-input h-11 w-full px-3.5 font-mono text-sm font-bold tabular-nums"
                />
                {wouldBecomeNegative ? (
                  <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                    Pengurangan melebihi total tagihan efektif saat ini (
                    {formatRupiah(currentEffectiveTotal)}). Total tagihan tidak boleh di bawah Rp 0.
                  </p>
                ) : fieldErrors.deltaAmount ? (
                  <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                    {fieldErrors.deltaAmount}
                  </p>
                ) : null}
              </div>

              {/* Mandatory Reason */}
              <div>
                <label
                  htmlFor="invoice-adjustment-reason"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Alasan Penyesuaian <span className="text-[#FF4B22]">*</span>
                </label>
                <textarea
                  id="invoice-adjustment-reason"
                  data-testid="invoice-adjustment-reason-input"
                  rows={2}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, reason: '' }));
                  }}
                  placeholder="Contoh: Penambahan 1 jam sesi / koreksi tarif disepakati bersama pelanggan"
                  className="sa-input mt-1.5 w-full px-3 py-2 text-xs"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  {fieldErrors.reason ? (
                    <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                      {fieldErrors.reason}
                    </p>
                  ) : (
                    <span className="text-[11px] text-[#666159]">Minimal 3 karakter, tercatat permanen.</span>
                  )}
                  <span className="font-mono text-[10.5px] text-[#666159]">
                    {reason.trim().length}/300
                  </span>
                </div>
              </div>

              {/* Live Pre-Commit Summary */}
              <div className="sa-panel-ivory p-3.5 text-xs">
                <p className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                  Simulasi Setelah Penyesuaian
                </p>
                <dl className="mt-2.5 space-y-1.5 font-mono">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#666159]">Total Awal (Snapshot)</dt>
                    <dd className="font-semibold text-[#151515] tabular-nums">
                      {formatRupiah(baseTotal)}
                    </dd>
                  </div>
                  {currentAdjustmentTotal !== 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#666159]">Penyesuaian Sebelumnya</dt>
                      <dd className="font-semibold text-[#151515] tabular-nums">
                        {currentAdjustmentTotal > 0
                          ? `+${formatRupiah(currentAdjustmentTotal)}`
                          : `-${formatRupiah(Math.abs(currentAdjustmentTotal))}`}
                      </dd>
                    </div>
                  ) : null}
                  <div
                    className={`flex justify-between gap-2 ${
                      signedDelta >= 0 ? 'text-[#0F6246]' : 'text-[#B92B0C]'
                    }`}
                  >
                    <dt className="font-semibold">Penyesuaian Ini</dt>
                    <dd className="font-bold tabular-nums">
                      {signedDelta >= 0
                        ? `+${formatRupiah(signedDelta)}`
                        : `-${formatRupiah(Math.abs(signedDelta))}`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 font-bold">
                    <dt className="text-[#151515]">Total Efektif Baru</dt>
                    <dd className="text-[#151515] tabular-nums">
                      {formatRupiah(clampedEffectiveTotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#666159]">Sudah Dibayar Bersih</dt>
                    <dd className="font-semibold text-[#0F6246] tabular-nums">
                      {formatRupiah(netPaid)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 font-bold">
                    <dt className="text-[#151515]">Sisa Tagihan Baru</dt>
                    <dd
                      className={`tabular-nums ${
                        projectedBalanceDue === 0 ? 'text-[#0F6246]' : 'text-[#FF4B22]'
                      }`}
                    >
                      {formatRupiah(projectedBalanceDue)}
                    </dd>
                  </div>
                  {projectedOverpaidCredit > 0 ? (
                    <div className="flex justify-between gap-2 text-[#8A4B08]">
                      <dt className="font-semibold">Kelebihan Bayar / Kredit</dt>
                      <dd className="font-bold tabular-nums">
                        {formatRupiah(projectedOverpaidCredit)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {projectedOverpaidCredit > 0 ? (
                  <div
                    data-testid="invoice-adjustment-overpaid-warning"
                    className="mt-2.5 rounded-xl border border-amber-500/35 bg-[#FEF4DD] p-2.5 text-[11px] leading-relaxed text-[#8A4B08]"
                  >
                    Pembayaran bersih sudah melebihi total tagihan baru sebesar{' '}
                    <strong className="font-mono">{formatRupiah(projectedOverpaidCredit)}</strong>.
                    Status invoice akan menjadi <strong>Overpaid Credit Pending</strong> hingga
                    refund atau kredit diselesaikan.
                  </div>
                ) : null}
              </div>
            </form>

            {/* Footer */}
            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
              >
                Batal
              </button>
              <button
                type="submit"
                form="invoice-adjustment-form"
                disabled={isSubmitting || absAmount <= 0 || wouldBecomeNegative}
                className="sa-control sa-btn-lime inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Simpan Penyesuaian</span>
                  </>
                )}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
