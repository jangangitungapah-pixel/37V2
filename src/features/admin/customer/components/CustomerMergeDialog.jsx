import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, ArrowDownUp, GitMerge, Loader2, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label="Merge customer history"
          data-customer-scoped="true"
          className="sa-dialog fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl rounded-b-none outline-none sm:inset-x-4 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <AdminStatusBadge tone="orange" icon={GitMerge} size="sm" className="uppercase">
                Gabungkan Data Pelanggan
              </AdminStatusBadge>
              <Dialog.Title className="mt-2 text-lg font-bold tracking-tight text-[#151515] sm:text-xl">
                Gabungkan Riwayat Profil
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[#666159]">
                Riwayat booking kedua profil tampil jadi satu, sementara data booking lama tetap
                tersimpan aman.
              </Dialog.Description>
            </div>

            <Dialog.Close
              aria-label="Tutup dialog merge customer"
              disabled={isMerging}
              className="sa-control inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
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

            {/* Target & Source Selectors */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sa-panel-ivory p-3.5">
                <label
                  htmlFor="merge-target-select"
                  className="block text-[11px] font-semibold text-[#151515]"
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
                  className="sa-input mt-2 h-10 w-full px-2.5 text-xs font-semibold"
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.bookingCount} booking)
                    </option>
                  ))}
                </select>
                {targetProfile ? (
                  <p className="mt-2 font-mono text-[11px] text-[#666159]">
                    {formatPhoneDisplay(targetProfile.phoneNormalized)} •{' '}
                    {targetProfile.bookingCount} booking
                  </p>
                ) : null}
              </div>

              <div className="sa-panel-ivory p-3.5">
                <label
                  htmlFor="merge-source-select"
                  className="block text-[11px] font-semibold text-[#151515]"
                >
                  Profil Kedua (Akan Digabungkan)
                </label>
                <select
                  id="merge-source-select"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="sa-input mt-2 h-10 w-full px-2.5 text-xs font-semibold"
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
                  <p className="mt-2 font-mono text-[11px] text-[#666159]">
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
                className="sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                <span>Tukar Posisi Profil</span>
              </button>
            </div>

            {/* Result Preview */}
            {targetProfile && sourceProfile ? (
              <div className="rounded-2xl border border-[#8BAD12]/35 bg-[#EDF8C2]/50 p-4">
                <span className="block font-mono text-[10.5px] font-semibold tracking-wider text-[#243300] uppercase">
                  Hasil Penggabungan
                </span>
                <p className="mt-1 text-lg font-bold text-[#151515]">{targetProfile.displayName}</p>
                <p className="mt-0.5 font-mono text-xs font-semibold text-[#243300]">
                  {combinedBookings} total bookings
                </p>
                <ul className="mt-2.5 list-disc space-y-1 pl-4 text-xs text-[#46433D]">
                  <li>Semua riwayat booking akan tampil dalam satu profil utama.</li>
                  <li>
                    Nama <strong className="text-[#151515]">{sourceProfile.displayName}</strong>{' '}
                    tetap dicatat sebagai nama lain.
                  </li>
                  <li>Data booking yang sudah lewat tidak berubah.</li>
                  <li>
                    Booking berikutnya akan otomatis memakai profil{' '}
                    <strong className="text-[#151515]">{targetProfile.displayName}</strong>.
                  </li>
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-3.5 sm:px-6">
            <button
              type="button"
              disabled={isMerging}
              onClick={() => onOpenChange?.(false)}
              className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isMerging || !targetProfile || !sourceProfile}
              onClick={handleConfirm}
              aria-label="Confirm Merge"
              className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-2 px-5 py-2 text-xs font-semibold disabled:opacity-60"
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
