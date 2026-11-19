import { useCallback, useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, CheckCircle2, Database, Link2, Loader2, RefreshCw, X } from 'lucide-react';

import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

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
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Import existing booking history"
          data-customer-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex h-[95dvh] w-full max-w-3xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                <Database className="h-3 w-3" aria-hidden="true" />
                <span>LEGACY HISTORY BACKFILL</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black text-white uppercase sm:text-3xl">
                Import Existing Booking History
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-300">
                Hanya menautkan customerId &amp; phoneNormalized pada booking lama tanpa mengubah
                harga, komisi, jadwal, atau snapshot nama.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog import legacy"
              disabled={isImporting}
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {error ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-3 text-xs font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {importSummary ? (
              <div
                role="status"
                className="border-studio-ink bg-studio-lime text-studio-ink flex items-start gap-2.5 border-2 p-3.5 text-xs font-bold"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-mono text-[11px] font-extrabold uppercase">
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
              <div className="border-studio-ink bg-studio-white flex items-center gap-2.5 border-2 p-5 font-mono text-xs font-bold">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Memindai booking historis (mode preview, tanpa menulis data)...</span>
              </div>
            ) : preview ? (
              <>
                {/* Preview Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Legacy Unlinked
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.totalLegacyUnlinked}
                    </span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Unique Phones
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.uniqueNormalizedPhones}
                    </span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Estimated Profiles
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.estimatedProfiles}
                    </span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Same Phone / Diff Name
                    </span>
                    <span className="font-display text-studio-orange mt-0.5 block text-2xl leading-none font-black">
                      {preview.samePhoneDifferentNamesCount}
                    </span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Needs Review (Invalid)
                    </span>
                    <span className="font-display text-studio-orange mt-0.5 block text-2xl leading-none font-black">
                      {preview.needsReviewCount}
                    </span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border-2 p-3">
                    <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                      Already Linked
                    </span>
                    <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                      {preview.alreadyLinkedCount}
                    </span>
                  </div>
                </div>

                {/* Same-phone different-name explanation */}
                {preview.sharedNumberGroups?.length > 0 ? (
                  <div className="border-studio-ink border-2 bg-amber-100 p-3.5 text-xs">
                    <p className="font-mono text-[10px] font-extrabold uppercase">
                      Nomor Sama dengan Nama Berbeda (Tetap Dipisahkan, Tidak Auto-Merge)
                    </p>
                    <ul className="mt-2 space-y-1 font-medium">
                      {preview.sharedNumberGroups.map((item) => (
                        <li key={item.phoneNormalized}>
                          <span className="font-mono font-extrabold">{item.phoneDisplay}</span>:{' '}
                          {item.profileNames.join(' • ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Import Progress */}
                {isImporting && progress ? (
                  <div className="border-studio-ink bg-studio-white flex items-center gap-2 border-2 p-3 font-mono text-xs font-bold">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
                    className="border-studio-ink bg-studio-white space-y-3 border-2 p-4"
                  >
                    <div>
                      <span className="border-studio-ink bg-studio-orange text-studio-white inline-block border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                        NEEDS REVIEW ({preview.needsReviewBookings.length})
                      </span>
                      <h3
                        id="legacy-needs-review-heading"
                        className="font-display text-studio-ink mt-1 text-lg leading-none font-black uppercase"
                      >
                        Booking Lama dengan Nomor Tidak Valid / Kosong
                      </h3>
                      <p className="text-studio-muted-ink mt-1 text-xs font-medium">
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
                            className="border-studio-ink bg-studio-ivory space-y-2 border p-3 text-xs"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <div>
                                <p className="text-studio-ink font-extrabold">
                                  {booking.customerName || '(Tanpa Nama)'}{' '}
                                  {booking.bandName ? `• ${booking.bandName}` : ''}
                                </p>
                                <p className="text-studio-muted-ink font-mono text-[10px]">
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
                                className="border-studio-ink bg-studio-white h-10 w-full border px-2.5 font-mono text-xs font-bold"
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
                                className="border-studio-ink bg-studio-white h-10 w-full border px-2 text-xs font-semibold"
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
                                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3 py-1 font-mono text-[10px] font-extrabold uppercase disabled:opacity-50"
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
          <div className="border-studio-ink bg-studio-white flex shrink-0 flex-wrap items-center justify-between gap-2 border-t-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              disabled={isScanning || isImporting}
              onClick={loadPreview}
              className="border-studio-ink bg-studio-ivory text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Scan Ulang</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => onOpenChange?.(false)}
                className="brutal-btn bg-studio-white text-studio-ink min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={
                  isScanning || isImporting || !preview || preview.importableBookingCount === 0
                }
                onClick={handleRunImport}
                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
      </Dialog.Portal>
    </Dialog.Root>
  );
}
