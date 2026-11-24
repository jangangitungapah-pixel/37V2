import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Banknote, Loader2, X } from 'lucide-react';

import { PAYMENT_METHOD_OPTIONS } from '@/features/admin/calendar/config/calendar-config';
import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { formatRupiah, parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';
import { PaymentEvidenceUploadField } from '@/features/payment-evidence/components/PaymentEvidenceUploadField';
import { usePaymentEvidenceUpload } from '@/features/payment-evidence/hooks/usePaymentEvidenceUpload';
import { generatePaymentEvidenceId } from '@/features/payment-evidence/utils/payment-evidence-utils';

import { validateRecordPaymentInput } from '../schemas/payment-schema';
import { mapPaymentErrorToMessage } from '../services/invoice-service';

export function RecordPaymentDialog({
  open,
  invoice,
  onOpenChange,
  onSubmitPayment,
  cloudinaryConfig = null,
}) {
  // Stable operation IDs per dialog open -> safe idempotent retry on flaky networks
  const [operationTxId] = useState(() => generateOperationId('pay'));
  const [operationEvidenceId] = useState(() => generatePaymentEvidenceId());
  const [amountInput, setAmountInput] = useState(() =>
    invoice?.balanceDue > 0 ? String(invoice.balanceDue) : '',
  );
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [receivedDate, setReceivedDate] = useState(() => getJakartaTodayIso());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const evidenceUpload = usePaymentEvidenceUpload({ cloudinaryConfig });

  if (!invoice) return null;

  const invoiceTotal = Number(invoice.financialSnapshot?.totalAmount) || 0;
  const alreadyPaid = Number(invoice.amountPaid) || 0;
  const currentBalance = Number(invoice.balanceDue) || 0;
  const parsedAmount = parseMoneyInput(amountInput);
  const exceedsBalance = parsedAmount > currentBalance;
  const remainingAfterPayment = Math.max(
    0,
    currentBalance - Math.min(parsedAmount, currentBalance),
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setFieldErrors({});
    setSubmitError('');

    const validation = validateRecordPaymentInput(
      {
        amount: parsedAmount,
        paymentMethod,
        receivedDate,
        referenceNumber,
        notes,
      },
      currentBalance,
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    let optionalEvidence = null;
    try {
      if (evidenceUpload.selectedFile || evidenceUpload.uploadedAsset) {
        const asset = await evidenceUpload.ensureUploaded();
        if (!asset) {
          return;
        }
        optionalEvidence = asset;
        evidenceUpload.markSavingMetadata();
      }

      await onSubmitPayment?.({
        transactionId: operationTxId,
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        amount: validation.data.amount,
        paymentMethod: validation.data.paymentMethod,
        receivedDate: validation.data.receivedDate,
        referenceNumber: validation.data.referenceNumber,
        notes: validation.data.notes,
        ...(optionalEvidence
          ? {
            optionalEvidence,
            evidenceId: operationEvidenceId,
          }
          : {}),
      });
      if (optionalEvidence) {
        evidenceUpload.markCompleted();
      }
      onOpenChange?.(false);
    } catch (err) {
      const readableError = mapPaymentErrorToMessage(err);
      if (optionalEvidence) {
        evidenceUpload.markMetadataFailed(readableError);
      }
      setSubmitError(readableError);
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
            aria-label="Catat pembayaran invoice"
            data-payment-scoped="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="lime" icon={Banknote} size="sm" className="uppercase">
                  Catat Pembayaran Pelanggan
                </AdminStatusBadge>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  Catat Pembayaran
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-[#666159] sm:text-xs">
                  <strong className="text-[#151515]">{invoice.invoiceNumber}</strong> •{' '}
                  {invoice.customerSnapshot?.name}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog catat pembayaran"
                disabled={isSubmitting}
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="record-payment-form"
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

              {/* Payment Amount */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="record-payment-amount"
                    className="block text-xs font-semibold text-[#151515]"
                  >
                    Nominal Pembayaran (Rp) <span className="text-[#FF4B22]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAmountInput(String(currentBalance));
                      setFieldErrors((prev) => ({ ...prev, amount: '' }));
                    }}
                    className="inline-flex min-h-9.5 shrink-0 cursor-pointer items-center rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-3 py-1 text-[11px] font-semibold text-[#243300] transition-colors hover:bg-[#C8F13A]"
                  >
                    Bayar Lunas ({formatRupiah(currentBalance)})
                  </button>
                </div>
              <input
                id="record-payment-amount"
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value.replace(/[^\d]/g, ''));
                  setFieldErrors((prev) => ({ ...prev, amount: '' }));
                }}
                placeholder="Contoh: 100000"
                className="sa-input mt-1.5 h-11 w-full px-3.5 font-mono text-sm font-bold tabular-nums"
              />
              {exceedsBalance ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  Nominal melebihi sisa tagihan ({formatRupiah(currentBalance)}). Pembayaran tidak
                  boleh lebih besar dari sisa tagihan.
                </p>
              ) : fieldErrors.amount ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  {fieldErrors.amount}
                </p>
              ) : null}
            </div>

            {/* Payment Method */}
            <div>
              <span className="block text-xs font-semibold text-[#151515]">
                Metode Pembayaran <span className="text-[#FF4B22]">*</span>
              </span>
              <div
                role="group"
                aria-label="Pilih metode pembayaran"
                className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {PAYMENT_METHOD_OPTIONS.map((m) => {
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      aria-pressed={isSelected}
                      className={
                        isSelected
                          ? 'min-h-10 cursor-pointer rounded-xl border border-[#8BAD12]/50 bg-[#EDF8C2] px-2.5 py-1.5 text-xs font-semibold text-[#243300] shadow-xs'
                          : 'min-h-10 cursor-pointer rounded-xl border border-[#151515]/12 bg-[#FAF8F3] px-2.5 py-1.5 text-xs font-medium text-[#46433D] hover:bg-white'
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.paymentMethod ? (
                <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                  {fieldErrors.paymentMethod}
                </p>
              ) : null}
            </div>

            {/* Received Date + Reference Number */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="record-payment-date"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Tanggal Diterima
                </label>
                <input
                  id="record-payment-date"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="sa-input mt-1.5 h-10 w-full px-3 font-mono text-xs font-medium"
                />
              </div>

              <div>
                <label
                  htmlFor="record-payment-ref"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  No. Referensi (Opsional)
                </label>
                <input
                  id="record-payment-ref"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Contoh: TRF-BCA-9821"
                  maxLength={120}
                  className="sa-input mt-1.5 h-10 w-full px-3 font-mono text-xs font-medium"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="record-payment-notes"
                className="block text-xs font-semibold text-[#151515]"
              >
                Catatan (Opsional)
              </label>
              <textarea
                id="record-payment-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pelunasan setelah sesi rehearsal"
                maxLength={400}
                className="sa-input mt-1.5 w-full px-3 py-2 text-xs"
              />
            </div>

            {/* Optional Payment Proof Attachment */}
            <PaymentEvidenceUploadField
              upload={evidenceUpload}
              required={false}
              disabled={isSubmitting}
              locale="id"
              inputId="record-payment-optional-evidence"
              label="Lampirkan Bukti Pembayaran (Opsional)"
              helperText="Opsional untuk pembayaran tunai/transfer manual di studio. JPG, PNG, atau WEBP maksimal 5 MB."
            />

            {/* Live Pre-Commit Payment Breakdown */}
            <div className="sa-panel-ivory p-3.5 text-xs">
              <p className="font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                Ringkasan Setelah Pembayaran
              </p>
              <dl className="mt-2.5 space-y-1.5 font-mono">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#666159]">Total Invoice</dt>
                  <dd className="font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(invoiceTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#666159]">Sudah Dibayar</dt>
                  <dd className="font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(alreadyPaid)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 text-[#0F6246]">
                  <dt className="font-semibold">Dibayar Sekarang</dt>
                  <dd className="font-bold tabular-nums">+{formatRupiah(parsedAmount)}</dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 font-bold">
                  <dt className="text-[#151515]">Sisa Setelah Bayar</dt>
                  <dd
                    className={`tabular-nums ${remainingAfterPayment === 0 ? 'text-[#0F6246]' : 'text-[#FF4B22]'
                      }`}
                  >
                    {formatRupiah(remainingAfterPayment)}
                  </dd>
                </div>
              </dl>
            </div>
          </form>

            {/* Sticky Footer */}
            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:gap-2.5 sm:px-5 sm:py-3.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleClose}
                className="sa-control sa-btn-secondary min-h-11 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial"
              >
                Batal
              </button>
              <button
                type="submit"
                form="record-payment-form"
                disabled={isSubmitting || evidenceUpload.isUploading || parsedAmount <= 0 || exceedsBalance}
                className="sa-control sa-btn-lime inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Simpan Pembayaran</span>
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
