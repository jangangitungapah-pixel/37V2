import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCircle2, Database, Link2, Loader2, RefreshCw, X } from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  importLegacyBookingHistory,
  resolveNeedsReviewLegacyBooking,
  scanLegacyBookingsPreview,
} from '../services/customer-migration-service';
import { mapCustomerErrorToMessage } from '../services/customer-service';
import { CUSTOMER_STATUS } from '../utils/customer-identity';
import { formatPhoneDisplay } from '../utils/phone-number';

export function LegacyCustomerImportDialog({
  open,
  onOpenChange,
  actorUid,
  activeCustomers = [],
  onImportCompleted,
}) {
  const [preview, setPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [error, setError] = useState('');

  // Per-booking state inside `Needs Review`
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [linkingBookingId, setLinkingBookingId] = useState('');

  const loadPreview = useCallback(async () => {
    setIsScanning(true);
    setError('');
    try {
      const result = await scanLegacyBookingsPreview();
      setPreview(result);
    } catch (err) {
      setError(mapCustomerErrorToMessage(err));
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const result = await scanLegacyBookingsPreview();
        if (cancelled) return;
        setImportSummary(null);
        setProgress(null);
        setError('');
        setPreview(result);
      } catch (err) {
        if (cancelled) return;
        setError(mapCustomerErrorToMessage(err));
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
      const summary = await importLegacyBookingHistory({
        actorUid,
        preview,
        onProgress: (prog) => setProgress(prog),
      });
      setImportSummary(summary);
      await loadPreview();
      onImportCompleted?.(summary);
    } catch (err) {
      setError(mapCustomerErrorToMessage(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleResolveNeedsReview = async (bookingId) => {
    if (linkingBookingId) return;
    const draft = reviewDrafts[bookingId] || {};
    setError('');
    setLinkingBookingId(bookingId);
    try {
      await resolveNeedsReviewLegacyBooking({
        bookingId,
        existingCustomerId: draft.existingCustomerId || '',
        correctedPhone: draft.correctedPhone || '',
        actorUid,
      });
      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      await loadPreview();
      onImportCompleted?.();
    } catch (err) {
      setError(mapCustomerErrorToMessage(err));
    } finally {
      setLinkingBookingId('');
    }
  };

  const activeOnlyCustomers = activeCustomers.filter((c) => c.status === CUSTOMER_STATUS.ACTIVE);

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
            aria-label="Import existing booking history"
            data-customer-scoped="true"
            className="sa-dialog flex h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-2.5 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge tone="lime" icon={Database} size="sm" className="uppercase">
                  Lengkapi Data Pelanggan Lama
                </AdminStatusBadge>
                <Dialog.Title className="mt-1 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                  Hubungkan Data Booking Lama
                </Dialog.Title>
                <Dialog.Description className="sr-only sm:not-sr-only sm:mt-0.5 sm:block sm:text-xs sm:text-[#666159]">
                  Membuat data pelanggan dari booking lama secara otomatis tanpa mengubah harga,
                  komisi, jadwal, atau nama pemesan.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup dialog import legacy"
                disabled={isImporting}
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
              </Dialog.Close>
            </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5 sm:px-6">
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
                    Import Batch Selesai ({importSummary.batchesCommitted} batch)
                  </p>
                  <p className="mt-0.5">
                    {importSummary.linkedBookingsCount} booking tertaut •{' '}
                    {importSummary.createdProfilesCount} profil baru dibuat •{' '}
                    {importSummary.reusedProfilesCount} profil eksisting diperbarui.
                  </p>
                </div>
              </div>
            ) : null}

            {isScanning ? (
              <div className="sa-panel-ivory flex items-center gap-2.5 p-5 text-xs font-medium text-[#666159]">
                <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
                <span>Memeriksa daftar booking lama (belum menyimpan perubahan)...</span>
              </div>
            ) : preview ? (
              <>
                {/* Preview Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Belum Terhubung
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.totalLegacyUnlinked}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Nomor HP Unik
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.uniqueNormalizedPhones}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Perkiraan Pelanggan
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.estimatedProfiles}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      No. Sama, Beda Nama
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#FF4B22]">
                      {preview.samePhoneDifferentNamesCount}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Perlu Dicek (No. Invalid)
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#FF4B22]">
                      {preview.needsReviewCount}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3.5">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Sudah Terhubung
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515]">
                      {preview.alreadyLinkedCount}
                    </span>
                  </div>
                </div>

                {/* Same-phone different-name explanation */}
                {preview.sharedNumberGroups?.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3.5 text-xs text-[#8A4B08]">
                    <p className="font-semibold">
                      Nomor Sama dengan Nama Berbeda (Tetap Dipisahkan, Tidak Auto-Merge)
                    </p>
                    <ul className="mt-2 space-y-1">
                      {preview.sharedNumberGroups.map((item) => (
                        <li key={item.phoneNormalized}>
                          <span className="font-mono font-semibold text-[#151515]">
                            {item.phoneDisplay}
                          </span>
                          : {item.profileNames.join(' • ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Import Progress */}
                {isImporting && progress ? (
                  <div className="sa-panel-ivory flex items-center gap-2 p-3 text-xs font-medium text-[#46433D]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
                    <span>
                      Memproses batch ({progress.processedOperations} /{' '}
                      {progress.totalOperations || '...'} operasi)...
                    </span>
                  </div>
                ) : null}

                {/* Needs Review Section */}
                {preview.needsReviewBookings?.length > 0 ? (
                  <section
                    aria-labelledby="legacy-needs-review-heading"
                    className="sa-card space-y-3 p-4"
                  >
                    <div>
                      <AdminStatusBadge tone="orange" size="sm" className="uppercase">
                        Perlu Dicek ({preview.needsReviewBookings.length})
                      </AdminStatusBadge>
                      <h3
                        id="legacy-needs-review-heading"
                        className="mt-1.5 text-base font-bold text-[#151515]"
                      >
                        Booking Lama dengan Nomor Tidak Valid / Kosong
                      </h3>
                      <p className="mt-1 text-xs text-[#666159]">
                        Booking ini tidak otomatis dihapus atau digabung berdasarkan nama. Masukkan
                        nomor HP valid atau tautkan ke profil customer yang sudah ada.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {preview.needsReviewBookings.map(({ booking, reason }) => {
                        const draft = reviewDrafts[booking.id] || {};
                        const isLinkingThis = linkingBookingId === booking.id;

                        return (
                          <div
                            key={booking.id}
                            className="sa-panel-ivory space-y-2.5 p-3.5 text-xs"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[#151515]">
                                  {booking.customerName || '(Tanpa Nama)'}{' '}
                                  {booking.bandName ? `• ${booking.bandName}` : ''}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                                  {formatIndonesianDateMedium(booking.date)} • Raw HP: &ldquo;
                                  {booking.phone || '-'}&rdquo; • {reason}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <input
                                type="tel"
                                aria-label={`Nomor HP valid untuk ${booking.customerName || booking.id}`}
                                value={draft.correctedPhone || ''}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [booking.id]: {
                                      correctedPhone: e.target.value,
                                      existingCustomerId: '',
                                    },
                                  }))
                                }
                                placeholder="Input nomor HP valid (08...)"
                                className="sa-input h-10 w-full px-3 font-mono text-xs font-medium"
                              />

                              <select
                                aria-label={`Pilih profil existing untuk ${booking.customerName || booking.id}`}
                                value={draft.existingCustomerId || ''}
                                onChange={(e) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [booking.id]: {
                                      correctedPhone: '',
                                      existingCustomerId: e.target.value,
                                    },
                                  }))
                                }
                                className="sa-input h-10 w-full px-3 text-xs font-medium"
                              >
                                <option value="">— Atau pilih profil existing —</option>
                                {activeOnlyCustomers.map((cust) => (
                                  <option key={cust.id} value={cust.id}>
                                    {cust.displayName} ({formatPhoneDisplay(cust.phoneNormalized)})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={
                                  isLinkingThis ||
                                  (!draft.correctedPhone && !draft.existingCustomerId)
                                }
                                onClick={() => handleResolveNeedsReview(booking.id)}
                                className="sa-control sa-btn-lime inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:opacity-50 sm:w-auto"
                              >
                                {isLinkingThis ? (
                                  <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                <span>Tautkan Booking</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="sa-safe-bottom grid shrink-0 grid-cols-2 gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
            <button
              type="button"
              disabled={isScanning || isImporting}
              onClick={loadPreview}
              className="sa-control sa-btn-secondary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold disabled:opacity-50 sm:px-3.5"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Scan Ulang</span>
            </button>

            <div className="contents sm:flex sm:items-center sm:gap-2">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => onOpenChange?.(false)}
                className="sa-control sa-btn-secondary inline-flex min-h-10.5 cursor-pointer items-center justify-center px-3.5 py-2 text-xs font-semibold sm:px-4"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={
                  isScanning || isImporting || !preview || preview.importableBookingCount === 0
                }
                onClick={handleRunImport}
                className="sa-control sa-btn-lime col-span-2 inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Database className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Import {preview?.importableBookingCount || 0} Booking</span>
              </button>
            </div>
          </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
