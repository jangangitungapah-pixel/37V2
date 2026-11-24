import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Archive, ArchiveRestore, Loader2, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

import { mapInventoryErrorToMessage } from '../services/inventory-item-service';
import { checkArchiveEligibility } from '../utils/inventory-calculation';

export function InventoryArchiveDialog({
  open,
  item,
  isOwner = false,
  onOpenChange,
  onConfirmArchiveToggle,
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  if (!item) return null;

  const willArchive = item.isActive !== false;
  const eligibility = willArchive
    ? checkArchiveEligibility(item)
    : { allowed: isOwner, reason: '' };

  const handleConfirm = async () => {
    if (isWorking) return;
    if (willArchive && !eligibility.allowed) return;
    if (!willArchive && !isOwner) return;

    setIsWorking(true);
    setError('');
    try {
      await onConfirmArchiveToggle?.({
        itemId: item.id,
        expectedVersion: item.version,
        archived: willArchive,
      });
      onOpenChange?.(false);
    } catch (err) {
      setError(mapInventoryErrorToMessage(err));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!isWorking ? onOpenChange?.(next) : null)}>
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
            aria-label={willArchive ? 'Konfirmasi arsipkan barang' : 'Konfirmasi aktifkan barang'}
            className="sa-dialog flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] rounded-b-none outline-none sm:rounded-[22px]"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#151515]/[0.07] bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-5 sm:py-4">
              <div className="min-w-0">
                <AdminStatusBadge
                  tone={willArchive ? 'orange' : 'lime'}
                  size="sm"
                  className="uppercase"
                >
                  {willArchive ? 'Arsipkan Item' : 'Aktifkan Kembali'}
                </AdminStatusBadge>
                <Dialog.Title className="mt-1.5 truncate text-base font-bold tracking-tight text-[#151515] sm:text-lg">
                  {willArchive ? `Arsipkan ${item.name}?` : `Aktifkan ${item.name}?`}
                </Dialog.Title>
              </div>
              <Dialog.Close
                aria-label="Tutup dialog arsip inventory"
                disabled={isWorking}
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-white p-4 text-xs leading-relaxed sm:p-5">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              ) : null}

              {willArchive && !eligibility.allowed ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{eligibility.reason}</span>
                </div>
              ) : willArchive ? (
                <p className="text-[#46433D]">
                  Barang dan seluruh riwayat pergerakan tetap tersimpan aman (tidak ada hapus
                  permanen). Item yang diarsipkan disembunyikan dari daftar aktif dan dapat dicari
                  melalui filter <strong className="text-[#151515]">Archived</strong>.
                </p>
              ) : !isOwner ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Hanya Owner aktif yang dapat mengaktifkan kembali item yang diarsipkan.
                  </span>
                </div>
              ) : (
                <p className="text-[#46433D]">
                  Item <strong className="text-[#151515]">{item.name}</strong> akan tampil kembali
                  pada daftar aktif dan siap mencatat pergerakan stok.
                </p>
              )}
            </div>

            <div className="sa-safe-bottom flex shrink-0 items-center justify-end gap-2.5 border-t border-[#151515]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-3.5">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onOpenChange?.(false)}
                className="sa-control sa-btn-secondary h-10 flex-1 cursor-pointer px-4 py-2 text-xs font-semibold sm:flex-initial"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isWorking || (willArchive ? !eligibility.allowed : !isOwner)}
                onClick={handleConfirm}
                className={`sa-control inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50 sm:flex-initial ${
                  willArchive ? 'sa-btn-orange' : 'sa-btn-lime'
                }`}
              >
                {isWorking ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : willArchive ? (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{willArchive ? 'Ya, Arsipkan' : 'Aktifkan Kembali'}</span>
              </button>
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
