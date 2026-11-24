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

        <Dialog.Viewport className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Konfirmasi void invoice"
            data-payment-scoped="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="orange" icon={Ban} size="sm" className="uppercase">
                  Batalkan Invoice
                </AdminStatusBadge>
                <Dialog.Title className="mt-1.5 text-lg font-bold tracking-tight text-[#151515] sm:mt-2">
                  Batalkan {invoice.invoiceNumber}?
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog void invoice"
                disabled={isWorking}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3]/80 text-[#46433D] transition-colors hover:bg-[#151515]/[0.06] hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form
              id="void-invoice-form"
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
            </form>

            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleClose}
                className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
              >
                Tutup
              </button>
              {!hasNetPayments ? (
                <button
                  type="submit"
                  form="void-invoice-form"
                  disabled={isWorking}
                  className="sa-control sa-btn-orange inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold sm:flex-initial"
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
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
