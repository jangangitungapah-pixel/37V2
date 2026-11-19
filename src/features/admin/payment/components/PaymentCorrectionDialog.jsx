import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';

import { getPaymentMethodLabel } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { validatePaymentReversalInput } from '../schemas/payment-schema';
import { mapPaymentErrorToMessage } from '../services/invoice-service';

export function PaymentCorrectionDialog({
  open,
  invoice,
  transaction,
  onOpenChange,
  onConfirmReversal,
}) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  if (!invoice || !transaction) return null;

  const handleClose = () => {
    if (isWorking) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isWorking) return;
    setFieldError('');
    setSubmitError('');

    const validation = validatePaymentReversalInput({ reason });
    if (!validation.isValid) {
      setFieldError(validation.errors.reason);
      return;
    }

    setIsWorking(true);
    try {
      await onConfirmReversal?.({
        invoiceId: invoice.id,
        originalTransactionId: transaction.id,
        expectedVersion: invoice.version,
        reason: validation.data.reason,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapPaymentErrorToMessage(err));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(true))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Koreksi / Reversal transaksi pembayaran"
          data-payment-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[80] mx-auto flex max-h-[92dvh] w-full max-w-md flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-2 border-b-2 px-4 py-3.5">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-orange text-studio-white inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>KOREKSI CATATAN PEMBAYARAN</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase">
                Batalkan Catatan Pembayaran
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog koreksi transaksi"
              disabled={isWorking}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3 overflow-y-auto p-4 text-xs"
          >
            {submitError ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-2.5 font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {/* Explicit Non-Refund Notice */}
            <div className="border-studio-ink border-2 bg-amber-100 p-3 leading-relaxed">
              <p className="font-mono text-[10px] font-extrabold uppercase">
                Penting: Koreksi Catatan (Bukan Pengembalian Uang)
              </p>
              <p className="mt-1 font-medium text-neutral-800">
                Tindakan ini membuat catatan pembatalan baru untuk mengoreksi entri yang salah input
                atau ganda tanpa menghapus riwayat lama. Ini <strong>bukan</strong> proses
                pengembalian uang (refund) ke pelanggan.
              </p>
            </div>

            {/* Original Transaction Summary */}
            <dl className="border-studio-ink bg-studio-white space-y-1 border-2 p-3 font-mono text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="text-studio-muted-ink">No. Transaksi</dt>
                <dd className="truncate font-bold">{transaction.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-studio-muted-ink">Tanggal</dt>
                <dd className="font-bold">
                  {formatIndonesianTimestamp(transaction.receivedAt || transaction.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-studio-muted-ink">Metode</dt>
                <dd className="font-bold">{getPaymentMethodLabel(transaction.paymentMethod)}</dd>
              </div>
              <div className="border-studio-ink flex justify-between gap-2 border-t pt-1 font-extrabold">
                <dt className="text-studio-orange">Nominal Dibatalkan</dt>
                <dd className="text-studio-orange">-{formatRupiah(transaction.amount)}</dd>
              </div>
            </dl>

            <div>
              <label
                htmlFor="reversal-reason-input"
                className="text-studio-ink block font-mono text-[10.5px] font-extrabold uppercase"
              >
                Alasan Pembatalan Transaksi <span className="text-studio-orange">*</span>
              </label>
              <textarea
                id="reversal-reason-input"
                rows={2}
                required
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setFieldError('');
                }}
                placeholder="Contoh: Salah input nominal pembayaran, seharusnya Rp 100.000"
                maxLength={300}
                className="border-studio-ink bg-studio-white text-studio-ink mt-1 w-full border-2 px-2.5 py-2 text-xs font-medium"
              />
              {fieldError ? (
                <p role="alert" className="text-studio-error-ink mt-1 text-xs font-bold">
                  {fieldError}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleClose}
                className="cal-control bg-studio-white text-studio-ink min-h-10 cursor-pointer px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isWorking}
                className="cal-control bg-studio-orange text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
              >
                {isWorking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Ya, Batalkan Catatan</span>
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
