import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  Banknote,
  ExternalLink,
  History,
  Info,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { Link } from 'react-router';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import {
  BOOKKEEPING_ENTRY_TYPES,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SOURCE_MODULES,
  BOOKKEEPING_SOURCE_TYPES,
  getBookkeepingPaymentMethodLabel,
  getLedgerPresentationMeta,
  getLedgerSourceGroupLabel,
  getLedgerStatusMeta,
} from '../config/bookkeeping-config';
import { useEntrySettlementHistory } from '../hooks/useBookkeepingSettlements';
import { validateBookkeepingReversalInput } from '../schemas/bookkeeping-schema';
import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';
import { formatBookkeepingDateTime, formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingEntryDetailDrawer({
  item,
  open,
  onOpenChange,
  onOpenSettleDialog,
  onReverseManualEntry,
}) {
  const [reversalOpen, setReversalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const entryObj =
    item?.linkedEntry ||
    (item?.recordCollection === 'bookkeepingEntries' ? item.originalRecord : null);
  const entryIdForSettlements =
    entryObj?.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL ? entryObj.id : '';

  const { settlements: entrySettlements, isLoading: isSettlementsLoading } =
    useEntrySettlementHistory({
      entryId: entryIdForSettlements,
      enabled: Boolean(open && entryIdForSettlements),
    });

  if (!item) return null;

  const presentationMeta = getLedgerPresentationMeta(item.presentationType);
  const statusMeta = getLedgerStatusMeta(item.status);
  const isManualSource =
    entryObj?.sourceModule === BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING &&
    entryObj?.sourceType === BOOKKEEPING_SOURCE_TYPES.MANUAL &&
    item.recordCollection === 'bookkeepingEntries';

  const canReverseManual =
    isManualSource &&
    entryObj.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.REVERSED &&
    (entryObj.entryType === BOOKKEEPING_ENTRY_TYPES.INCOME ||
      (entryObj.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL &&
        entryObj.amountSettled === 0 &&
        entryObj.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.UNPAID));

  const isSettledManualExpense =
    isManualSource &&
    entryObj.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL &&
    entryObj.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.REVERSED &&
    (entryObj.amountSettled > 0 ||
      entryObj.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.UNPAID);

  const canSettlePayable =
    entryObj &&
    entryObj.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL &&
    entryObj.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.REVERSED &&
    entryObj.remainingAmount > 0;

  const handleConfirmReversal = async (e) => {
    e.preventDefault();
    if (!canReverseManual || isReversing) return;
    setReversalError('');

    const validation = validateBookkeepingReversalInput({ reason: reversalReason });
    if (!validation.isValid) {
      setReversalError(validation.errors.reason);
      return;
    }

    setIsReversing(true);
    try {
      await onReverseManualEntry?.({
        entryId: entryObj.id,
        expectedVersion: entryObj.version,
        reason: validation.data.reason,
      });
      setReversalOpen(false);
      setReversalReason('');
    } catch (err) {
      setReversalError(mapBookkeepingErrorToMessage(err));
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReversalOpen(false);
          setReversalReason('');
          setReversalError('');
        }
        onOpenChange?.(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={`Detail transaksi ${item.description}`}
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="shrink-0 border-b border-[#151515]/[0.08] bg-white px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone={presentationMeta.tone} size="sm">
                    {presentationMeta.fullLabel}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={statusMeta.tone} size="sm">
                    {statusMeta.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ivory" size="sm">
                    Source: {getLedgerSourceGroupLabel(item.sourceGroup)}
                  </AdminStatusBadge>
                </div>

                <Dialog.Title className="mt-2 text-base font-bold text-[#151515] sm:text-lg">
                  {item.description}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 font-mono text-[11px] text-[#666159]">
                  ID: {item.recordId} • {item.recordCollection}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail transaksi"
                className="sa-control inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#FAF8F3] text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {/* Core Amount Card */}
            <div className="sa-panel-ivory flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[11px] font-semibold text-[#666159] uppercase">
                  Nominal Tercatat
                </p>
                <p
                  className={`mt-1 font-mono text-xl font-bold tabular-nums sm:text-2xl ${
                    item.signedAmount >= 0 ? 'text-[#243300]' : 'text-[#B92B0C]'
                  }`}
                >
                  {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
                </p>
              </div>

              {canSettlePayable && onOpenSettleDialog ? (
                <AdminButton
                  variant="orange"
                  size="sm"
                  onClick={() => onOpenSettleDialog(entryObj)}
                >
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                  <span>Settle Payment</span>
                </AdminButton>
              ) : null}
            </div>

            {/* Metadata Grid */}
            <div className="sa-subcard grid grid-cols-2 gap-3 p-3.5 text-xs">
              <div>
                <span className="text-[11px] text-[#666159]">Category</span>
                <p className="mt-0.5 font-semibold text-[#151515]">{item.categoryLabel}</p>
              </div>
              <div>
                <span className="text-[11px] text-[#666159]">Effective Date (WIB)</span>
                <p className="mt-0.5 font-mono text-[#151515]">
                  {formatBookkeepingDateTime(item.date)}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[#666159]">Payment Method</span>
                <p className="mt-0.5 font-semibold text-[#151515]">
                  {item.paymentMethod ? getBookkeepingPaymentMethodLabel(item.paymentMethod) : '-'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[#666159]">Reference</span>
                <p className="mt-0.5 font-mono text-[#151515]">{item.referenceNumber || '-'}</p>
              </div>
              <div>
                <span className="text-[11px] text-[#666159]">Source ID</span>
                <p className="mt-0.5 font-mono text-[11px] break-all text-[#151515]">
                  {item.sourceId || '-'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[#666159]">Recorded By UID</span>
                <p className="mt-0.5 font-mono text-[11px] break-all text-[#151515]">
                  {item.actorUid || '-'}
                </p>
              </div>
              {item.notes ? (
                <div className="col-span-2 border-t border-[#151515]/[0.07] pt-2">
                  <span className="text-[11px] text-[#666159]">Notes</span>
                  <p className="mt-0.5 text-[#151515]">{item.notes}</p>
                </div>
              ) : null}
            </div>

            {/* Traceable Source Links */}
            {item.invoiceId ? (
              <div className="sa-panel space-y-2 p-3.5 text-xs">
                <div className="flex items-start gap-2 text-[#46433D]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
                  <p>
                    Pembayaran dan koreksi (reversal) invoice pelanggan dikelola dari modul{' '}
                    <strong>Payment and Bill</strong> agar tidak mengubah saldo tagihan secara
                    terpisah.
                  </p>
                </div>
                <Link
                  to={`/admin/payment-and-bill?invoiceId=${encodeURIComponent(item.invoiceId)}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#151515] underline underline-offset-2"
                >
                  <span>Buka Invoice {item.invoiceNumber}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}

            {entryObj?.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH ? (
              <div className="sa-panel space-y-2 p-3.5 text-xs">
                <div className="flex items-start gap-2 text-[#46433D]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
                  <p>
                    Sumber berasal dari batch <strong>Commission and Fee</strong> (
                    {entryObj.sourceId}
                    ). Catatan akrual komisi tidak dapat diubah manual dari Pembukuan dan hanya
                    dapat dilunasi melalui <strong>Settle Payment</strong>.
                  </p>
                </div>
                <Link
                  to="/admin/commission-and-fee"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#151515] underline underline-offset-2"
                >
                  <span>Lihat Modul Commission &amp; Fee</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}

            {/* Payable Balance & Settlement History */}
            {entryIdForSettlements && entryObj ? (
              <div className="sa-subcard space-y-3 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                    <h4 className="text-xs font-bold text-[#151515] uppercase">
                      Status Kewajiban &amp; Riwayat Pelunasan
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F8F6EF] p-2.5 text-[11px]">
                  <div>
                    <span className="text-[#666159]">Original</span>
                    <p className="font-mono font-bold text-[#151515] tabular-nums">
                      {formatBookkeepingRupiah(entryObj.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#666159]">Settled</span>
                    <p className="font-mono font-bold text-[#0F6246] tabular-nums">
                      {formatBookkeepingRupiah(entryObj.amountSettled)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#666159]">Remaining</span>
                    <p className="font-mono font-bold text-[#B92B0C] tabular-nums">
                      {formatBookkeepingRupiah(entryObj.remainingAmount)}
                    </p>
                  </div>
                </div>

                {isSettlementsLoading ? (
                  <p className="text-xs text-[#666159]">Memuat riwayat pembayaran...</p>
                ) : entrySettlements.length === 0 ? (
                  <p className="text-xs text-[#666159]">Belum ada pembayaran / settlement.</p>
                ) : (
                  <ul className="divide-y divide-[#151515]/[0.07]">
                    {entrySettlements.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 py-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#151515]">
                            {getBookkeepingPaymentMethodLabel(s.paymentMethod)} •{' '}
                            {formatBookkeepingDateTime(s.paidAt)}
                          </p>
                          <p className="font-mono text-[10.5px] text-[#666159]">
                            {s.referenceNumber ? `Ref: ${s.referenceNumber} • ` : ''}
                            {s.notes || s.id}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-[#B92B0C] tabular-nums">
                          {formatBookkeepingRupiah(s.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {/* Owner-only Reversal / Correction Workflow (Unsettled Manual Entries Only) */}
            {canReverseManual ? (
              <div className="sa-subcard space-y-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#151515]">
                      Koreksi / Reversal Catatan Manual
                    </h4>
                    <p className="text-[11px] text-[#666159]">
                      Catatan keuangan tidak boleh dihapus permanen. Koreksi menjaga catatan asal
                      dan menambahkan entri pembalik (audit trail).
                    </p>
                  </div>
                  {!reversalOpen ? (
                    <AdminButton
                      variant="secondary"
                      size="xs"
                      onClick={() => setReversalOpen(true)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Koreksi</span>
                    </AdminButton>
                  ) : null}
                </div>

                {reversalOpen ? (
                  <form
                    onSubmit={handleConfirmReversal}
                    className="space-y-2.5 border-t border-[#151515]/[0.08] pt-2.5"
                  >
                    {reversalError ? (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg bg-[#FFEDE8] p-2.5 text-xs text-[#B92B0C]"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{reversalError}</span>
                      </div>
                    ) : null}

                    <label className="block text-xs font-semibold text-[#151515]">
                      Alasan Koreksi / Reversal <span className="text-[#FF4B22]">*</span>
                      <textarea
                        rows={2}
                        value={reversalReason}
                        onChange={(e) => setReversalReason(e.target.value)}
                        placeholder="Jelaskan alasan koreksi (minimal 3 karakter)..."
                        className="sa-input mt-1 w-full px-2.5 py-1.5 text-xs text-[#151515]"
                      />
                    </label>

                    <div className="flex justify-end gap-2">
                      <AdminButton
                        variant="secondary"
                        size="xs"
                        disabled={isReversing}
                        onClick={() => setReversalOpen(false)}
                      >
                        Batal
                      </AdminButton>
                      <AdminButton type="submit" variant="danger" size="xs" disabled={isReversing}>
                        {isReversing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : null}
                        <span>Confirm Reversal</span>
                      </AdminButton>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}

            {isSettledManualExpense ? (
              <div className="sa-panel p-3 text-[11px] text-[#666159]">
                <strong>Catatan Audit:</strong> Pengeluaran manual yang sudah memiliki
                pembayaran/settlement tidak menyediakan pembatalan otomatis pada versi ini (koreksi
                kas fisik dilakukan melalui alur khusus agar tidak menciptakan refund fiktif).
              </div>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
