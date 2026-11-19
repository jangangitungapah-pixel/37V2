import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, ArrowDownUp, GitMerge, Loader2, X } from 'lucide-react';

import { mapCustomerErrorToMessage } from '../services/customer-service';
import { formatPhoneDisplay } from '../utils/phone-number';

export function CustomerMergeDialog({
  open,
  candidates = [],
  initialTargetId = '',
  initialSourceId = '',
  allowCrossPhoneMerge = false,
  onOpenChange,
  onConfirmMerge,
}) {
  const [targetId, setTargetId] = useState(() => initialTargetId || candidates[0]?.id || '');
  const [sourceId, setSourceId] = useState(() => {
    if (initialSourceId && initialSourceId !== (initialTargetId || candidates[0]?.id)) {
      return initialSourceId;
    }
    const fallback = candidates.find((c) => c.id !== (initialTargetId || candidates[0]?.id));
    return fallback?.id || '';
  });
  const [error, setError] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  const targetProfile = candidates.find((c) => c.id === targetId) || null;
  const sourceProfile = candidates.find((c) => c.id === sourceId) || null;
  const combinedBookings =
    (Number(targetProfile?.bookingCount) || 0) + (Number(sourceProfile?.bookingCount) || 0);

  const handleSwap = () => {
    setTargetId(sourceId);
    setSourceId(targetId);
    setError('');
  };

  const handleConfirm = async () => {
    if (isMerging || !targetProfile || !sourceProfile) return;
    setError('');
    setIsMerging(true);
    try {
      await onConfirmMerge?.({
        targetCustomerId: targetProfile.id,
        sourceCustomerId: sourceProfile.id,
        allowCrossPhoneMerge,
      });
      onOpenChange?.(false);
    } catch (err) {
      setError(mapCustomerErrorToMessage(err));
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!isMerging ? onOpenChange?.(next) : null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label="Merge customer history"
          data-customer-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col border-t-2 shadow-[6px_6px_0px_#151515] sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:border-2"
        >
          {/* Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex shrink-0 items-start justify-between gap-3 border-b-2 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <span className="border-studio-ivory bg-studio-orange text-studio-white inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-widest uppercase">
                <GitMerge className="h-3 w-3" aria-hidden="true" />
                <span>GABUNGKAN DATA PELANGGAN</span>
              </span>
              <Dialog.Title className="font-display mt-1.5 text-2xl leading-none font-black text-white uppercase sm:text-3xl">
                Gabungkan Riwayat Profil
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-300">
                Riwayat booking kedua profil tampil jadi satu, sementara data booking lama tetap
                tersimpan aman.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog merge customer"
              disabled={isMerging}
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

            {/* Target & Source Selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-studio-ink bg-studio-white border-2 p-3">
                <label
                  htmlFor="merge-target-select"
                  className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
                >
                  Profil Utama (Yang Dipakai Selanjutnya)
                </label>
                <select
                  id="merge-target-select"
                  value={targetId}
                  onChange={(e) => {
                    const nextTarget = e.target.value;
                    setTargetId(nextTarget);
                    if (nextTarget === sourceId) {
                      const other = candidates.find((c) => c.id !== nextTarget);
                      setSourceId(other?.id || '');
                    }
                  }}
                  className="border-studio-ink bg-studio-ivory mt-1.5 h-11 w-full border-2 px-2 text-xs font-bold"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.bookingCount} booking)
                    </option>
                  ))}
                </select>
                {targetProfile ? (
                  <p className="text-studio-muted-ink mt-1.5 font-mono text-[11px] font-bold">
                    {formatPhoneDisplay(targetProfile.phoneNormalized)} •{' '}
                    {targetProfile.bookingCount} booking
                  </p>
                ) : null}
              </div>

              <div className="border-studio-ink bg-studio-white border-2 p-3">
                <label
                  htmlFor="merge-source-select"
                  className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase"
                >
                  Profil Kedua (Akan Digabungkan)
                </label>
                <select
                  id="merge-source-select"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="border-studio-ink bg-studio-ivory mt-1.5 h-11 w-full border-2 px-2 text-xs font-bold"
                >
                  {candidates
                    .filter((c) => c.id !== targetId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName} ({c.bookingCount} booking)
                      </option>
                    ))}
                </select>
                {sourceProfile ? (
                  <p className="text-studio-muted-ink mt-1.5 font-mono text-[11px] font-bold">
                    {formatPhoneDisplay(sourceProfile.phoneNormalized)} •{' '}
                    {sourceProfile.bookingCount} booking
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                disabled={!targetProfile || !sourceProfile}
                className="border-studio-ink bg-studio-white hover:bg-studio-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 border px-3 py-1 font-mono text-[10px] font-extrabold uppercase"
              >
                <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tukar Posisi Profil</span>
              </button>
            </div>

            {/* Result Preview */}
            {targetProfile && sourceProfile ? (
              <div className="border-studio-ink bg-studio-lime/25 border-2 p-4">
                <span className="text-studio-ink block font-mono text-[10px] font-extrabold uppercase">
                  HASIL PENGGABUNGAN
                </span>
                <p className="font-display text-studio-ink mt-1 text-2xl leading-none font-black uppercase">
                  {targetProfile.displayName}
                </p>
                <p className="text-studio-ink mt-1 font-mono text-xs font-extrabold">
                  {combinedBookings} total bookings
                </p>
                <ul className="text-studio-ink mt-2.5 list-disc space-y-1 pl-4 text-xs font-medium">
                  <li>Semua riwayat booking akan tampil dalam satu profil utama.</li>
                  <li>
                    Nama <strong>{sourceProfile.displayName}</strong> tetap dicatat sebagai nama
                    lain.
                  </li>
                  <li>Data booking yang sudah lewat tidak berubah.</li>
                  <li>
                    Booking berikutnya akan otomatis memakai profil{' '}
                    <strong>{targetProfile.displayName}</strong>.
                  </li>
                </ul>
              </div>
            ) : null}
          </div>

          <div className="border-studio-ink bg-studio-white flex shrink-0 items-center justify-end gap-2.5 border-t-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              disabled={isMerging}
              onClick={() => onOpenChange?.(false)}
              className="brutal-btn bg-studio-ivory text-studio-ink min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isMerging || !targetProfile || !sourceProfile}
              onClick={handleConfirm}
              aria-label="Confirm Merge"
              className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 cursor-pointer items-center gap-2 px-5 py-2 font-mono text-xs font-extrabold uppercase disabled:opacity-60"
            >
              {isMerging ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GitMerge className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Ya, Gabungkan</span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
