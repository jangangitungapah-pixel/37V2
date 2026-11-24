import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';

import { getPaymentMethodLabel } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[70]"
        />

        <Dialog.Viewport className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Koreksi / Reversal transaksi pembayaran"
            data-payment-scoped="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="orange" icon={RotateCcw} size="sm" className="uppercase">
                  Koreksi Catatan Pembayaran
                </AdminStatusBadge>
                <Dialog.Title className="mt-1.5 text-lg font-bold tracking-tight text-[#151515] sm:mt-2">
                  Batalkan Catatan Pembayaran
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog koreksi transaksi"
                disabled={isWorking}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3]/80 text-[#46433D] transition-colors hover:bg-[#151515]/[0.06] hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="payment-correction-form"
              onSubmit={handleSubmit}
              noValidate
              className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-4 text-xs sm:p-5"
            >
              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              ) : null}

              {/* Explicit Non-Refund Notice */}
              <div className="rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 leading-relaxed text-[#8A4B08]">
                <p className="font-semibold">Penting: Koreksi Catatan (Bukan Pengembalian Uang)</p>
                <p className="mt-1">
                  Tindakan ini membuat catatan pembatalan baru untuk mengoreksi entri yang salah
                  input atau ganda tanpa menghapus riwayat lama. Ini <strong>bukan</strong> proses
                  pengembalian uang (refund) ke pelanggan.
                </p>
              </div>

              {/* Original Transaction Summary */}
              <dl className="sa-panel-ivory space-y-1.5 p-3.5 font-mono text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#666159]">No. Transaksi</dt>
                  <dd className="truncate font-semibold text-[#151515]">{transaction.id}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#666159]">Tanggal</dt>
                  <dd className="font-medium text-[#151515]">
                    {formatIndonesianTimestamp(transaction.receivedAt || transaction.createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#666159]">Metode</dt>
                  <dd className="font-medium text-[#151515]">
                    {getPaymentMethodLabel(transaction.paymentMethod)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-[#151515]/[0.08] pt-2 font-bold">
                  <dt className="text-[#FF4B22]">Nominal Dibatalkan</dt>
                  <dd className="text-[#FF4B22]">-{formatRupiah(transaction.amount)}</dd>
                </div>
              </dl>

              <div>
                <label
                  htmlFor="reversal-reason-input"
                  className="block text-xs font-semibold text-[#151515]"
                >
                  Alasan Pembatalan Transaksi <span className="text-[#FF4B22]">*</span>
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
                  className="sa-input mt-1.5 w-full px-3 py-2 text-xs"
                />
                {fieldError ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                    {fieldError}
                  </p>
                ) : null}
              </div>
            </form>

            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleClose}
                className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
              >
                Batal
              </button>
              <button
                type="submit"
                form="payment-correction-form"
                disabled={isWorking}
                className="sa-control sa-btn-orange inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold sm:flex-initial"
              >
                {isWorking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Ya, Batalkan Catatan</span>
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
