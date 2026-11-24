import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Loader2, X } from 'lucide-react';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import {
  BOOKKEEPING_PAYMENT_METHOD_OPTIONS,
  MANUAL_EXPENSE_CATEGORIES,
  MANUAL_INCOME_CATEGORIES,
} from '../config/bookkeeping-config';
import {
  validateManualExpenseInput,
  validateManualIncomeInput,
} from '../schemas/bookkeeping-schema';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';
import { formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingEntryDialog({
  open,
  mode = 'income',
  onOpenChange,
  onSubmitIncome,
  onSubmitExpense,
}) {
  const isIncome = mode === 'income';
  const todayIso = getJakartaTodayIso();

  // Stable pre-generated IDs per dialog session for strict transaction idempotency
  const [operationIds] = useState(() => ({
    entryId: generateOperationId(isIncome ? 'bk_inc' : 'bk_exp'),
    settlementId: generateOperationId('bk_set'),
  }));

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(() =>
    isIncome ? MANUAL_INCOME_CATEGORIES[0].id : MANUAL_EXPENSE_CATEGORIES[0].id,
  );
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidDate, setPaidDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange?.(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setSubmitError('');

    if (isIncome) {
      const payload = {
        description,
        category,
        amount,
        receivedDate: entryDate,
        paymentMethod,
        referenceNumber,
        notes,
      };
      const validation = validateManualIncomeInput(payload);
      if (!validation.isValid) {
        setFieldErrors(validation.errors);
        return;
      }
      setIsSubmitting(true);
      try {
        await onSubmitIncome?.({
          entryId: operationIds.entryId,
          input: payload,
        });
        onOpenChange?.(false);
      } catch (err) {
        setSubmitError(mapBookkeepingErrorToMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const payload = {
      description,
      category,
      amount,
      expenseDate: entryDate,
      paymentStatus,
      paymentMethod,
      paidDate: paymentStatus === 'paid' ? paidDate : '',
      dueDate: paymentStatus === 'unpaid' ? dueDate : '',
      referenceNumber,
      notes,
    };
    const validation = validateManualExpenseInput(payload);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitExpense?.({
        entryId: operationIds.entryId,
        settlementId: operationIds.settlementId,
        input: payload,
      });
      onOpenChange?.(false);
    } catch (err) {
      setSubmitError(mapBookkeepingErrorToMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedPreviewAmount = Math.max(0, Math.round(Number(amount) || 0));

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
            aria-label={isIncome ? 'Record Manual Income' : 'Record Manual Expense'}
            className="sa-dialog flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-5 sm:py-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge
                    tone={isIncome ? 'lime' : 'orange'}
                    icon={isIncome ? ArrowDownLeft : ArrowUpRight}
                    size="sm"
                  >
                    {isIncome ? 'Manual Income' : 'Manual Expense'}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ivory" size="sm">
                    Audit Immutable
                  </AdminStatusBadge>
                </div>
                <Dialog.Title className="mt-1.5 text-base font-bold text-[#151515] sm:text-lg">
                  {isIncome ? 'Record Income (Non-Invoice)' : 'Record Expense (Studio Cost)'}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[#666159]">
                  {isIncome
                    ? 'Catat pemasukan di luar invoice booking (sewa alat tambahan, merchandise, atau pendapatan lain).'
                    : 'Catat beban operasional studio sebagai Paid (langsung memotong kas) atau Unpaid (masuk ke Outstanding Payables).'}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup form catatan manual"
                disabled={isSubmitting}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-3.5 overflow-y-auto px-4 py-4 sm:px-5">
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
                  <label className="block text-xs font-semibold text-[#151515]">
                    Description <span className="text-[#FF4B22]">*</span>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        isIncome
                          ? 'Contoh: Sewa ampli tambahan band tamu'
                          : 'Contoh: Tagihan listrik studio bulan November'
                      }
                      className="sa-input mt-1 min-h-11 w-full px-3 py-2 text-xs text-[#151515] sm:text-[13px]"
                    />
                  </label>
                  {fieldErrors.description ? (
                    <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                      {fieldErrors.description}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Category <span className="text-[#FF4B22]">*</span>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="sa-input mt-1 min-h-11 w-full px-3 py-2 text-xs text-[#151515] sm:text-[13px]"
                      >
                        {(isIncome ? MANUAL_INCOME_CATEGORIES : MANUAL_EXPENSE_CATEGORIES).map(
                          (cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    {fieldErrors.category ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.category}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Amount (IDR) <span className="text-[#FF4B22]">*</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="250000"
                        className="sa-input mt-1 min-h-11 w-full px-3 py-2 font-mono text-xs font-bold text-[#151515] sm:text-[13px]"
                      />
                    </label>
                    {parsedPreviewAmount > 0 ? (
                      <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                        {formatBookkeepingRupiah(parsedPreviewAmount)}
                      </p>
                    ) : null}
                    {fieldErrors.amount ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.amount}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      {isIncome ? 'Received Date' : 'Expense Date'}{' '}
                      <span className="text-[#FF4B22]">*</span>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => {
                          setEntryDate(e.target.value);
                          if (!isIncome && paymentStatus === 'paid') {
                            setPaidDate(e.target.value);
                          }
                        }}
                        className="sa-input mt-1 min-h-11 w-full px-3 py-2 font-mono text-xs text-[#151515]"
                      />
                    </label>
                    {fieldErrors.receivedDate || fieldErrors.expenseDate ? (
                      <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.receivedDate || fieldErrors.expenseDate}
                      </p>
                    ) : null}
                  </div>

                  {!isIncome ? (
                    <div>
                      <span className="block text-xs font-semibold text-[#151515]">
                        Payment Status <span className="text-[#FF4B22]">*</span>
                      </span>
                      <div className="mt-1 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('paid')}
                          aria-pressed={paymentStatus === 'paid'}
                          className={
                            paymentStatus === 'paid'
                              ? 'min-h-11 cursor-pointer rounded-xl border border-[#151515] bg-[#151515] px-3 text-xs font-semibold text-white'
                              : 'sa-control min-h-11 cursor-pointer bg-white px-3 text-xs font-medium text-[#46433D]'
                          }
                        >
                          Paid (Tunai/Keluar)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus('unpaid')}
                          aria-pressed={paymentStatus === 'unpaid'}
                          className={
                            paymentStatus === 'unpaid'
                              ? 'min-h-11 cursor-pointer rounded-xl border border-[#FF4B22] bg-[#FFEDE8] px-3 text-xs font-semibold text-[#B92B0C]'
                              : 'sa-control min-h-11 cursor-pointer bg-white px-3 text-xs font-medium text-[#46433D]'
                          }
                        >
                          Unpaid (Utang)
                        </button>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                {!isIncome && paymentStatus === 'paid' ? (
                  <div className="sa-panel-ivory grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#151515]">
                        Payment Method <span className="text-[#FF4B22]">*</span>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 text-xs text-[#151515]"
                        >
                          {BOOKKEEPING_PAYMENT_METHOD_OPTIONS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {fieldErrors.paymentMethod ? (
                        <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                          {fieldErrors.paymentMethod}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#151515]">
                        Paid Date <span className="text-[#FF4B22]">*</span>
                        <input
                          type="date"
                          value={paidDate}
                          onChange={(e) => setPaidDate(e.target.value)}
                          className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 font-mono text-xs text-[#151515]"
                        />
                      </label>
                      {fieldErrors.paidDate ? (
                        <p className="mt-1 text-[11px] font-medium text-[#B92B0C]">
                          {fieldErrors.paidDate}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {!isIncome && paymentStatus === 'unpaid' ? (
                  <div className="sa-panel-ivory space-y-2 p-3">
                    <label className="block text-xs font-semibold text-[#151515]">
                      Due Date (Opsional)
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="sa-input mt-1 min-h-10 w-full px-2.5 py-1.5 font-mono text-xs text-[#151515]"
                      />
                    </label>
                    <p className="text-[11px] text-[#666159]">
                      Pengeluaran Unpaid dicatat ke <strong>Outstanding Payables</strong> dan belum
                      mengurangi Cash Out hingga dilunasi lewat menu <strong>Settle Payment</strong>
                      .
                    </p>
                    {fieldErrors.dueDate ? (
                      <p className="text-[11px] font-medium text-[#B92B0C]">
                        {fieldErrors.dueDate}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#151515]">
                      Reference Number (Opsional)
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="No. kwitansi / mutasi bank"
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
                        placeholder="Catatan tambahan singkat"
                        className="sa-input mt-1 min-h-10 w-full px-3 py-1.5 text-xs text-[#151515]"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
                <AdminButton
                  variant="secondary"
                  size="md"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="min-h-10 flex-1 sm:flex-initial"
                >
                  Batal
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant={isIncome ? 'primary' : 'orange'}
                  size="md"
                  disabled={isSubmitting}
                  className="min-h-10 flex-1 sm:flex-initial"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>{isIncome ? 'Save Manual Income' : 'Save Manual Expense'}</span>
                </AdminButton>
              </div>
            </form>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
