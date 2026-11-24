import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Banknote, Loader2, X } from 'lucide-react';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import {
  BOOKKEEPING_PAYMENT_METHOD_OPTIONS,
  getPayableStatusMeta,
} from '../config/bookkeeping-config';
import { validateSettlementInput } from '../schemas/bookkeeping-schema';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';
import { formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingSettlementDialog({ open, entry, onOpenChange, onSubmitSettlement }) {
  const [settlementId] = useState(() => generateOperationId('bk_set'));
  const todayIso = getJakartaTodayIso();
  const remainingAmount = entry?.remainingAmount || 0;

  const [amount, setAmount] = useState(() => (remainingAmount > 0 ? String(remainingAmount) : ''));
  const [paidDate, setPaidDate] = useState(todayIso);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!entry) return null;

  const statusMeta = getPayableStatusMeta(entry.settlementStatus);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setSubmitError('');

    const validation = validateSettlementInput(
      { amount, paidDate, paymentMethod, referenceNumber, notes },
      entry.remainingAmount,
    );

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitSettlement?.({
        entryId: entry.id,
        settlementId,
        expectedVersion: entry.version,
        amount: validation.data.amount,
        paidDate: validation.data.paidDate,
        paymentMethod: validation.data.paymentMethod,
        referenceNumber: validation.data.referenceNumber,
        notes: validation.data.notes,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapBookkeepingErrorToMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => (!next ? handleClose() : onOpenChange?.(next))}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <div
          data-admin-portal-layer="true"
          className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          <Dialog.Popup
            aria-label="Settle Payment Kewajiban"
            className="sa-dialog flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-[20px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:px-5 sm:py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone="orange" icon={Banknote} size="sm">
                    Settle Payment
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={statusMeta.tone} size="sm">
                    {statusMeta.label}
                  </AdminStatusBadge>
                </div>
                <Dialog.Title className="mt-1.5 text-base font-bold text-[#151515] sm:text-lg">
                  Bayar Kewajiban Operasional
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[#666159]">
                  Mendukung pelunasan penuh atau cicilan (partial settlement). Sumber akrual tetap
                  terjaga dan tidak dihapus.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup modal pelunasan"
                disabled={isSubmitting}
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4.5 w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-3.5 overflow-y-auto px-4 py-4 sm:px-5">
                {/* Payable Summary */}
                <div className="sa-panel-ivory space-y-2 p-3">
                  <p className="text-xs font-bold break-words text-[#151515]">
                    {entry.description}
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-[11px] min-[400px]:grid-cols-3">
                    <div>
                      <span className="text-[#666159]">Original</span>
                      <p className="font-mono font-semibold text-[#151515] tabular-nums">
                        {formatBookkeepingRupiah(entry.amount)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#666159]">Settled</span>
                      <p className="font-mono font-semibold text-[#0F6246] tabular-nums">
                        {formatBookkeepingRupiah(entry.amountSettled)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#666159]">Remaining</span>
                      <p className="font-mono font-bold text-[#B92B0C] tabular-nums">
                        {formatBookkeepingRupiah(entry.remainingAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {submitError ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="settlement-amount-input"
                      className="text-xs font-semibold text-[#151515]"
                    >
                      Amount to Pay (IDR) <span className="text-[#FF4B22]">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {entry.remainingAmount > 1 ? (
                        <button
                          type="button"
                          onClick={() => setAmount(String(Math.floor(entry.remainingAmount / 2)))}
                          className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-[#F8F6EF] px-3 py-1 text-xs font-semibold text-[#46433D] hover:bg-[#EDE8D8]"
                        >
                          50%
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setAmount(String(entry.remainingAmount))}
                        className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-[#EDF8C2] px-3 py-1 text-xs font-semibold text-[#243300] hover:bg-[#DCF09A]"
                      >
                        Bayar Penuh
                      </button>
                    </div>
                  </div>
                  <input
                    id="settlement-amount-input"
                    type="number"
                    min="1"
                    max={entry.remainingAmount}
                    step="1"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="sa-input mt-1 min-h-11 w-full px-3 py-2 font-mono text-xs font-bold text-[#151515] sm:text-sm"
                  />
                  {fieldErrors.amount ? (
                    <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                      {fieldErrors.amount}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Payment Date <span className="text-[#FF4B22]">*</span>
                      <input
                        type="date"
                        value={paidDate}
                        onChange={(e) => setPaidDate(e.target.value)}
                        className="sa-input mt-1 min-h-11 w-full px-3 py-2 font-mono text-xs text-[#151515]"
                      />
                    </label>
                    {fieldErrors.paidDate ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.paidDate}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Payment Method <span className="text-[#FF4B22]">*</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="sa-input mt-1 min-h-11 w-full px-3 py-2 text-xs text-[#151515]"
                      >
                        {BOOKKEEPING_PAYMENT_METHOD_OPTIONS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Reference Number (Opsional)
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="No. transfer / bukti"
                        className="sa-input mt-1 min-h-10 w-full px-3 py-1.5 text-xs text-[#151515]"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Notes (Opsional)
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Catatan pelunasan"
                        className="sa-input mt-1 min-h-10 w-full px-3 py-1.5 text-xs text-[#151515]"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                <AdminButton
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="min-h-11 flex-1 sm:flex-initial"
                >
                  Batal
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="orange"
                  size="md"
                  disabled={isSubmitting}
                  className="min-h-11 flex-1 sm:flex-initial"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>Confirm Settlement</span>
                </AdminButton>
              </div>
            </form>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
