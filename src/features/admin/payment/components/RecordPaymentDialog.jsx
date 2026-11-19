import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Banknote, Loader2, X } from 'lucide-react';

import { PAYMENT_METHOD_OPTIONS } from '@/features/admin/calendar/config/calendar-config';
import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { formatRupiah, parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import { validateRecordPaymentInput } from '../schemas/payment-schema';
import { mapPaymentErrorToMessage } from '../services/invoice-service';

export function RecordPaymentDialog({ open, invoice, onOpenChange, onSubmitPayment }) {
  // Stable operation ID per dialog open -> safe idempotent retry on flaky networks
  const [operationTxId] = useState(() => generateOperationId('pay'));
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
    try {
      await onSubmitPayment?.({
        transactionId: operationTxId,
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        amount: validation.data.amount,
        paymentMethod: validation.data.paymentMethod,
        receivedDate: validation.data.receivedDate,
        referenceNumber: validation.data.referenceNumber,
        notes: validation.data.notes,
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
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Catat pembayaran invoice"
          data-payment-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                <Banknote className="h-3 w-3" aria-hidden="true" />
                <span>RECORD CUSTOMER PAYMENT</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase sm:text-2xl">
                Record Payment
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-mono text-[11px] text-neutral-300">
                <strong className="text-studio-lime">{invoice.invoiceNumber}</strong> •{' '}
                {invoice.customerSnapshot?.name}
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog catat pembayaran"
              disabled={isSubmitting}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            id="record-payment-form"
            onSubmit={handleSubmit}
            noValidate
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4"
          >
            {submitError ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-2.5 text-xs font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="record-payment-amount"
                  className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase"
                >
                  Nominal Pembayaran (Rp) <span className="text-studio-orange">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAmountInput(String(currentBalance));
                    setFieldErrors((prev) => ({ ...prev, amount: '' }));
                  }}
                  className="border-studio-ink bg-studio-lime/40 text-studio-ink hover:bg-studio-lime cursor-pointer border px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase"
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
                className="border-studio-ink bg-studio-white text-studio-ink mt-1.5 h-11 w-full border-2 px-3 font-mono text-sm font-extrabold"
              />
              {exceedsBalance ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  Nominal melebihi sisa tagihan ({formatRupiah(currentBalance)}). Overpayment tidak
                  diperbolehkan.
                </p>
              ) : fieldErrors.amount ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {fieldErrors.amount}
                </p>
              ) : null}
            </div>

            {/* Payment Method */}
            <div>
              <span className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase">
                Metode Pembayaran <span className="text-studio-orange">*</span>
              </span>
              <div
                role="group"
                aria-label="Pilih metode pembayaran"
                className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
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
                          ? 'border-studio-ink bg-studio-lime text-studio-ink min-h-10 cursor-pointer border-2 px-2.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase shadow-[2px_2px_0px_#151515]'
                          : 'border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-ivory min-h-10 cursor-pointer border-2 px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase'
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {fieldErrors.paymentMethod ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {fieldErrors.paymentMethod}
                </p>
              ) : null}
            </div>

            {/* Received Date + Reference Number */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="record-payment-date"
                  className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase"
                >
                  Tanggal Diterima
                </label>
                <input
                  id="record-payment-date"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1 h-10 w-full border-2 px-2.5 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label
                  htmlFor="record-payment-ref"
                  className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase"
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
                  className="border-studio-ink bg-studio-white text-studio-ink mt-1 h-10 w-full border-2 px-2.5 font-mono text-xs font-semibold"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="record-payment-notes"
                className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase"
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
                className="border-studio-ink bg-studio-white text-studio-ink mt-1 w-full border-2 px-2.5 py-2 text-xs font-medium"
              />
            </div>

            {/* Live Pre-Commit Payment Breakdown */}
            <div className="border-studio-ink bg-studio-white border-2 p-3 shadow-[2px_2px_0px_#151515]">
              <p className="text-studio-muted-ink font-mono text-[9.5px] font-extrabold uppercase">
                Ringkasan Setelah Pembayaran
              </p>
              <dl className="mt-2 space-y-1 font-mono text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Invoice Total</dt>
                  <dd className="font-bold tabular-nums">{formatRupiah(invoiceTotal)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Already Paid</dt>
                  <dd className="font-bold tabular-nums">{formatRupiah(alreadyPaid)}</dd>
                </div>
                <div className="flex justify-between gap-2 text-emerald-800">
                  <dt className="font-bold">This Payment</dt>
                  <dd className="font-extrabold tabular-nums">+{formatRupiah(parsedAmount)}</dd>
                </div>
                <div className="border-studio-ink flex justify-between gap-2 border-t pt-1.5 font-extrabold">
                  <dt>Remaining Balance</dt>
                  <dd
                    className={`tabular-nums ${
                      remainingAfterPayment === 0 ? 'text-emerald-800' : 'text-studio-orange'
                    }`}
                  >
                    {formatRupiah(remainingAfterPayment)}
                  </dd>
                </div>
              </dl>
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="border-studio-ink bg-studio-white flex shrink-0 items-center justify-end gap-2 border-t-2 px-4 py-3 sm:px-5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="cal-control bg-studio-ivory text-studio-ink min-h-10 cursor-pointer px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
            >
              Batal
            </button>
            <button
              type="submit"
              form="record-payment-form"
              disabled={isSubmitting || parsedAmount <= 0 || exceedsBalance}
              className="cal-control bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
      </Dialog.Portal>
    </Dialog.Root>
  );
}
