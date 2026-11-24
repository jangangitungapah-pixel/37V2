import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, X } from 'lucide-react';

import { PAYMENT_METHOD_OPTIONS } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah, parseMoneyInput } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Viewport className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Import dan rekonsiliasi invoice booking lama"
            data-payment-scoped="true"
            className="sa-dialog flex h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:h-auto sm:max-h-[90dvh] sm:rounded-[22px]"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="lime" icon={Database} size="sm" className="uppercase">
                  Buat Invoice Data Lama
                </AdminStatusBadge>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  Buat Invoice untuk Booking Lama
                </Dialog.Title>
                <Dialog.Description className="sr-only sm:not-sr-only sm:mt-0.5 sm:block sm:text-xs sm:text-[#666159]">
                  Membuat invoice dan catatan pembayaran awal dari booking lama secara aman tanpa
                  mengubah jadwal atau data pelanggan.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog rekonsiliasi invoice legacy"
                disabled={isImporting}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3]/80 text-[#46433D] transition-colors hover:bg-[#151515]/[0.06] hover:text-[#151515] disabled:opacity-50"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white px-4 py-3.5 sm:space-y-4 sm:px-5 sm:py-4">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 text-xs font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {importSummary ? (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] p-3.5 text-xs text-[#243300]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
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
              <div className="sa-panel-ivory flex items-center gap-2.5 p-4 text-xs font-medium text-[#666159]">
                <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
                <span>Memindai booking tanpa invoice (mode preview, tanpa menulis data)...</span>
              </div>
            ) : (
              <>
                {/* Preview Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Belum Ada Invoice
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.totalWithoutInvoice}
                    </span>
                  </div>
                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Siap Dibuatkan
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#0F6246]">
                      {preview.importableCount}
                    </span>
                  </div>
                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Ada Bayar Awal
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.withInitialPaymentCount}
                    </span>
                  </div>
                  <div
                    className={`rounded-[14px] border p-3 ${
                      preview.needsReviewCount > 0
                        ? 'border-amber-500/25 bg-[#FEF4DD]'
                        : 'border-[#151515]/[0.085] bg-[#F8F6EF]'
                    }`}
                  >
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Perlu Dicek
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#FF4B22]">
                      {preview.needsReviewCount}
                    </span>
                  </div>
                </div>

                {/* Status Distribution Strip */}
                <div className="sa-panel-ivory flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5 font-mono text-xs text-[#46433D]">
                  <span>Belum Bayar: {preview.unpaidCount}</span>
                  <span>DP / Sebagian: {preview.partialCount}</span>
                  <span>Lunas: {preview.paidCount}</span>
                  <span>Batal / Tidak Hadir: {preview.cancelledOrNoShowCount}</span>
                  <span className="text-[#8B857B]">
                    Sudah Ada Invoice: {preview.alreadyHasInvoiceCount}
                  </span>
                </div>

                {/* No Double Counting Guarantee Note */}
                <div className="rounded-xl border border-[#8BAD12]/30 bg-[#EDF8C2]/45 px-3.5 py-2.5 text-xs text-[#243300]">
                  <strong>Aman dari Duplikasi:</strong> Setiap booking maksimal hanya dibuatkan 1
                  invoice dan 1 catatan pembayaran awal, sehingga aman jika proses ini dijalankan
                  ulang.
                </div>

                {progress ? (
                  <div className="sa-panel-ivory p-3 font-mono text-xs font-medium text-[#46433D]">
                    Memproses bagian ke-{progress.batchesCommitted}... (
                    {progress.processedOperations} / {progress.totalOperations} data)
                  </div>
                ) : null}

                {/* Needs Review Queue */}
                {preview.needsReviewItems.length > 0 ? (
                  <section className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-[#B92B0C]">
                      Perlu Dicek Manual ({preview.needsReviewItems.length})
                    </h4>
                    <div className="space-y-2.5">
                      {preview.needsReviewItems.map((item) => {
                        const booking = item.booking;
                        const draft = reviewDrafts[booking.id] || {
                          paidAmount: String(Math.min(item.totalAmount, item.initialPaidAmount)),
                          paymentMethod: booking.paymentMethod || 'cash',
                        };
                        const isBusy = reconcilingBookingId === booking.id;

                        return (
                          <div key={booking.id} className="sa-subcard space-y-2.5 p-3.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[#151515]">
                                  {booking.customerName}{' '}
                                  <span className="font-mono text-[11px] font-normal text-[#666159]">
                                    • {formatIndonesianDateMedium(booking.date)} • {booking.id}
                                  </span>
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                                  Total: {formatRupiah(item.totalAmount)} • Snapshot Awal:{' '}
                                  {formatRupiah(item.initialPaidAmount)} (
                                  {item.initialPaymentStatus}) • Sesi: {booking.sessionStatus}
                                </p>
                              </div>
                            </div>

                            <ul className="list-disc pl-4 text-xs text-[#B92B0C]">
                              {item.reasons.map((r, i) => (
                                <li key={`${r.code}-${i}`}>{r.message}</li>
                              ))}
                            </ul>

                            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-12 sm:items-end">
                              <div className="sm:col-span-5">
                                <label
                                  htmlFor={`rev-paid-${booking.id}`}
                                  className="block text-[11px] font-medium text-[#666159]"
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
                                  className="sa-input mt-1 h-9.5 w-full px-2.5 font-mono text-xs font-semibold"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label
                                  htmlFor={`rev-method-${booking.id}`}
                                  className="block text-[11px] font-medium text-[#666159]"
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
                                  className="sa-input mt-1 h-9.5 w-full px-2.5 text-xs font-medium"
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
                                  className="sa-control sa-btn-primary inline-flex h-9.5 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
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
          <div className="sa-safe-bottom flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:flex-nowrap sm:px-5 sm:py-3.5">
            <button
              type="button"
              disabled={isScanning || isImporting}
              onClick={loadPreview}
              className="sa-control sa-btn-secondary inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Scan Ulang</span>
            </button>

            <div className="flex flex-1 items-center justify-end gap-2.5 sm:flex-initial">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => onOpenChange?.(false)}
                className="sa-control sa-btn-secondary inline-flex h-10 flex-1 cursor-pointer items-center justify-center px-4 text-xs font-semibold sm:flex-initial"
              >
                Tutup
              </button>

              {preview && preview.importableCount > 0 ? (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleRunImport}
                  className="sa-control sa-btn-lime inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 text-xs font-semibold whitespace-nowrap sm:flex-initial sm:px-5"
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
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
