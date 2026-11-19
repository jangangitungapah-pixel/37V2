import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, X } from 'lucide-react';

import { PAYMENT_METHOD_OPTIONS } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah, parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import { mapPaymentErrorToMessage } from '../services/invoice-service';
import {
  importLegacyBookingInvoices,
  reconcileNeedsReviewLegacyBooking,
  scanLegacyBookingsForInvoicesPreview,
} from '../services/legacy-invoice-service';

export function LegacyInvoiceImportDialog({ open, onOpenChange, actorUid, onImportCompleted }) {
  const [preview, setPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState('');

  // Per-booking reconciliation draft inputs for Needs Review records
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reconcilingBookingId, setReconcilingBookingId] = useState('');

  const loadPreview = useCallback(async () => {
    setIsScanning(true);
    setError('');
    try {
      const result = await scanLegacyBookingsForInvoicesPreview();
      setPreview(result);
    } catch (err) {
      setError(mapPaymentErrorToMessage(err));
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const result = await scanLegacyBookingsForInvoicesPreview();
        if (cancelled) return;
        setImportSummary(null);
        setProgress(null);
        setError('');
        setPreview(result);
      } catch (err) {
        if (cancelled) return;
        setError(mapPaymentErrorToMessage(err));
      } finally {
        if (!cancelled) {
          setIsScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleRunImport = async () => {
    if (isImporting || !preview) return;
    setIsImporting(true);
    setError('');
    setProgress({ processedOperations: 0, totalOperations: 0, batchesCommitted: 0 });

    try {
      const summary = await importLegacyBookingInvoices({
        actorUid,
        preview,
        onProgress: (prog) => setProgress(prog),
      });
      setImportSummary(summary);
      await loadPreview();
      onImportCompleted?.(summary);
    } catch (err) {
      setError(mapPaymentErrorToMessage(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReconcileReviewItem = async (item) => {
    if (reconcilingBookingId) return;
    const booking = item.booking;
    const draft = reviewDrafts[booking.id] || {
      paidAmount: String(Math.min(item.totalAmount, item.initialPaidAmount)),
      paymentMethod: booking.paymentMethod || 'cash',
    };

    setError('');
    setReconcilingBookingId(booking.id);
    try {
      await reconcileNeedsReviewLegacyBooking({
        bookingId: booking.id,
        verifiedPaidAmount: parseMoneyInput(draft.paidAmount),
        paymentMethod: draft.paymentMethod,
        actorUid,
      });
      await loadPreview();
      onImportCompleted?.();
    } catch (err) {
      setError(mapPaymentErrorToMessage(err));
    } finally {
      setReconcilingBookingId('');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!isImporting ? onOpenChange?.(next) : null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Import dan rekonsiliasi invoice booking lama"
          data-payment-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex h-[95dvh] w-full max-w-3xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
                <Database className="h-3 w-3" aria-hidden="true" />
                <span>LEGACY INVOICE RECONCILIATION</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase sm:text-2xl">
                Import Existing Booking Invoices
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-300">
                Membuat invoice &amp; transaksi `Legacy Initial Payment` dari snapshot booking lama
                tanpa mengubah dokumen booking, slot, event, atau profil customer.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog rekonsiliasi invoice legacy"
              disabled={isImporting}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">
            {error ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-2.5 text-xs font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {importSummary ? (
              <div
                role="status"
                className="border-studio-ink bg-studio-lime text-studio-ink flex items-start gap-2 border-2 p-3 text-xs font-bold"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-mono text-[10.5px] font-extrabold uppercase">
                    Rekonsiliasi Selesai ({importSummary.batchesCommitted} batch)
                  </p>
                  <p className="mt-0.5">
                    {importSummary.createdInvoicesCount} invoice diterbitkan •{' '}
                    {importSummary.createdInitialPaymentsCount} transaksi Legacy Initial Payment
                    dicatat • {importSummary.skippedAlreadyExistsCount} dilewati (sudah ada).
                  </p>
                </div>
              </div>
            ) : null}

            {isScanning || !preview ? (
              <div className="border-studio-ink bg-studio-white flex items-center gap-2 border-2 p-4 font-mono text-xs font-bold">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memindai booking tanpa invoice (mode preview, tanpa menulis data)...</span>
              </div>
            ) : (
              <>
                {/* Preview Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="border-studio-ink bg-studio-white border-2 p-2.5">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Tanpa Invoice
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.totalWithoutInvoice}
                    </span>
                  </div>
                  <div className="border-studio-ink bg-studio-white border-2 p-2.5">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Siap Import
                    </span>
                    <span className="font-display mt-0.5 block text-2xl leading-none font-black text-emerald-800">
                      {preview.importableCount}
                    </span>
                  </div>
                  <div className="border-studio-ink bg-studio-white border-2 p-2.5">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      With Initial Pay
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.withInitialPaymentCount}
                    </span>
                  </div>
                  <div
                    className={`border-studio-ink border-2 p-2.5 ${
                      preview.needsReviewCount > 0 ? 'bg-amber-100' : 'bg-studio-white'
                    }`}
                  >
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Needs Review
                    </span>
                    <span className="font-display text-studio-orange mt-0.5 block text-2xl leading-none font-black">
                      {preview.needsReviewCount}
                    </span>
                  </div>
                </div>

                {/* Status Distribution Strip */}
                <div className="border-studio-ink bg-studio-white flex flex-wrap items-center gap-x-4 gap-y-1 border px-3 py-2 font-mono text-[10px] font-bold">
                  <span>Unpaid: {preview.unpaidCount}</span>
                  <span>Partial/DP: {preview.partialCount}</span>
                  <span>Paid: {preview.paidCount}</span>
                  <span>Cancelled/No-Show: {preview.cancelledOrNoShowCount}</span>
                  <span className="text-studio-muted-ink">
                    Sudah Ber-Invoice: {preview.alreadyHasInvoiceCount}
                  </span>
                </div>

                {/* No Double Counting Guarantee Note */}
                <div className="border-studio-ink bg-studio-lime/25 border px-3 py-2 text-[11px] font-medium">
                  <strong>Anti Double-Counting:</strong> Setiap booking menghasilkan maksimal satu
                  invoice deterministik (<code>inv_{'{bookingId}'}</code>) dan satu initial payment
                  (<code>pay_initial_{'{bookingId}'}</code>). Menjalankan ulang import tidak akan
                  menduplikasi pembayaran awal.
                </div>

                {progress ? (
                  <div className="border-studio-ink bg-studio-white border-2 p-3 font-mono text-xs font-bold">
                    Memproses batch {progress.batchesCommitted}... ({progress.processedOperations} /{' '}
                    {progress.totalOperations} operasi)
                  </div>
                ) : null}

                {/* Needs Review Queue (Inconsistent Payments + Cancelled / No-Show) */}
                {preview.needsReviewItems.length > 0 ? (
                  <section className="space-y-2">
                    <h4 className="font-mono text-[10.5px] font-extrabold text-[#b92b0c] uppercase">
                      Perlu Review Eksplisit ({preview.needsReviewItems.length})
                    </h4>
                    <div className="space-y-2">
                      {preview.needsReviewItems.map((item) => {
                        const booking = item.booking;
                        const draft = reviewDrafts[booking.id] || {
                          paidAmount: String(Math.min(item.totalAmount, item.initialPaidAmount)),
                          paymentMethod: booking.paymentMethod || 'cash',
                        };
                        const isBusy = reconcilingBookingId === booking.id;

                        return (
                          <div
                            key={booking.id}
                            className="border-studio-ink bg-studio-white space-y-2 border-2 p-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-extrabold">
                                  {booking.customerName}{' '}
                                  <span className="text-studio-muted-ink font-mono text-[10.5px]">
                                    • {formatIndonesianDateMedium(booking.date)} • {booking.id}
                                  </span>
                                </p>
                                <p className="text-studio-muted-ink font-mono text-[10px]">
                                  Total: {formatRupiah(item.totalAmount)} • Snapshot Awal:{' '}
                                  {formatRupiah(item.initialPaidAmount)} (
                                  {item.initialPaymentStatus}) • Sesi: {booking.sessionStatus}
                                </p>
                              </div>
                            </div>

                            <ul className="list-disc pl-4 text-[11px] font-semibold text-[#b92b0c]">
                              {item.reasons.map((r, i) => (
                                <li key={`${r.code}-${i}`}>{r.message}</li>
                              ))}
                            </ul>

                            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-12 sm:items-end">
                              <div className="sm:col-span-5">
                                <label
                                  htmlFor={`rev-paid-${booking.id}`}
                                  className="text-studio-muted-ink block font-mono text-[9.5px] font-bold uppercase"
                                >
                                  Nominal Terbayar Terverifikasi (Rp)
                                </label>
                                <input
                                  id={`rev-paid-${booking.id}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={draft.paidAmount}
                                  onChange={(e) =>
                                    setReviewDrafts((prev) => ({
                                      ...prev,
                                      [booking.id]: {
                                        ...draft,
                                        paidAmount: e.target.value.replace(/[^\d]/g, ''),
                                      },
                                    }))
                                  }
                                  className="border-studio-ink bg-studio-ivory mt-0.5 h-9 w-full border px-2 font-mono text-xs font-bold"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label
                                  htmlFor={`rev-method-${booking.id}`}
                                  className="text-studio-muted-ink block font-mono text-[9.5px] font-bold uppercase"
                                >
                                  Metode
                                </label>
                                <select
                                  id={`rev-method-${booking.id}`}
                                  value={draft.paymentMethod}
                                  onChange={(e) =>
                                    setReviewDrafts((prev) => ({
                                      ...prev,
                                      [booking.id]: {
                                        ...draft,
                                        paymentMethod: e.target.value,
                                      },
                                    }))
                                  }
                                  className="border-studio-ink bg-studio-ivory mt-0.5 h-9 w-full border px-2 font-mono text-[10.5px] font-bold uppercase"
                                >
                                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="sm:col-span-4">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleReconcileReviewItem(item)}
                                  className="cal-control bg-studio-ink text-studio-lime inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 px-3 font-mono text-[10px] font-extrabold uppercase"
                                >
                                  {isBusy ? (
                                    <Loader2
                                      className="h-3.5 w-3.5 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  <span>Terbitkan Invoice</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="border-studio-ink bg-studio-white flex shrink-0 flex-wrap items-center justify-between gap-2 border-t-2 px-4 py-3 sm:px-5">
            <button
              type="button"
              disabled={isScanning || isImporting}
              onClick={loadPreview}
              className="cal-control bg-studio-ivory text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-extrabold uppercase"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Scan Ulang</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => onOpenChange?.(false)}
                className="cal-control bg-studio-white text-studio-ink min-h-10 cursor-pointer px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
              >
                Tutup
              </button>

              {preview && preview.importableCount > 0 ? (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleRunImport}
                  className="cal-control bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
                >
                  {isImporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Import {preview.importableCount} Invoice</span>
                </button>
              ) : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
