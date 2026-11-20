import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Ban, Loader2, X } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminStatusBadge } from '@/features/admin/design-system';

import { validateVoidInvoiceInput } from '../schemas/payment-schema';
import { mapPaymentErrorToMessage } from '../services/invoice-service';

export function VoidInvoiceDialog({ open, invoice, onOpenChange, onConfirmVoid }) {
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  if (!invoice) return null;

  const hasNetPayments = Number(invoice.amountPaid) > 0;

  const handleClose = () => {
    if (isWorking) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isWorking || hasNetPayments) return;
    setFieldError('');
    setSubmitError('');

    const validation = validateVoidInvoiceInput({ reason });
    if (!validation.isValid) {
      setFieldError(validation.errors.reason);
      return;
    }

    setIsWorking(true);
    try {
      await onConfirmVoid?.({
        invoiceId: invoice.id,
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

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label="Konfirmasi void invoice"
          data-payment-scoped="true"
          className="sa-dialog fixed inset-x-0 bottom-0 z-[80] mx-auto flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-4">
            <div className="min-w-0">
              <AdminStatusBadge tone="orange" icon={Ban} size="sm" className="uppercase">
                Batalkan Invoice
              </AdminStatusBadge>
              <Dialog.Title className="mt-2 text-lg font-bold tracking-tight text-[#151515]">
                Batalkan {invoice.invoiceNumber}?
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog void invoice"
              disabled={isWorking}
              className="sa-control inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3.5 overflow-y-auto bg-white p-5 text-xs"
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

            {hasNetPayments ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 leading-relaxed text-[#8A4B08]"
              >
                <p className="font-semibold text-[#B92B0C]">
                  Tidak Bisa Dibatalkan — Invoice Sudah Ada Pembayaran
                </p>
                <p className="mt-1">
                  Invoice ini sudah menerima pembayaran bersih sebesar{' '}
                  <strong>{formatRupiah(invoice.amountPaid)}</strong>. Batalkan dulu catatan
                  pembayaran yang sudah masuk sebelum membatalkan invoice ini.
                </p>
              </div>
            ) : (
              <>
                <p className="leading-relaxed text-[#46433D]">
                  Invoice yang dibatalkan tidak bisa menerima pembayaran lagi, tetapi tetap
                  tersimpan di daftar arsip (tidak dihapus permanen). Jadwal booking pada Calendar
                  tidak ikut dibatalkan.
                </p>

                <div>
                  <label
                    htmlFor="void-invoice-reason"
                    className="block text-xs font-semibold text-[#151515]"
                  >
                    Alasan Pembatalan Invoice <span className="text-[#FF4B22]">*</span>
                  </label>
                  <textarea
                    id="void-invoice-reason"
                    rows={2}
                    required
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setFieldError('');
                    }}
                    placeholder="Contoh: Booking dibatalkan sebelum pembayaran dilakukan"
                    maxLength={300}
                    className="sa-input mt-1.5 w-full px-3 py-2 text-xs"
                  />
                  {fieldError ? (
                    <p role="alert" className="mt-1 text-xs font-medium text-[#B92B0C]">
                      {fieldError}
                    </p>
                  ) : null}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleClose}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
              >
                Tutup
              </button>
              {!hasNetPayments ? (
                <button
                  type="submit"
                  disabled={isWorking}
                  className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold"
                >
                  {isWorking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Ya, Batalkan Invoice</span>
                </button>
              ) : null}
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
