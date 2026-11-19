import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Archive, ArchiveRestore, Loader2, X } from 'lucide-react';

import { mapCustomerErrorToMessage } from '../services/customer-service';
import { CUSTOMER_STATUS } from '../utils/customer-identity';

export function CustomerArchiveDialog({ open, customer, onOpenChange, onConfirmArchiveToggle }) {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  if (!customer) return null;

  const willArchive = customer.status !== CUSTOMER_STATUS.ARCHIVED;

  const handleConfirm = async () => {
    if (isWorking) return;
    setIsWorking(true);
    setError('');
    try {
      await onConfirmArchiveToggle?.({
        customerId: customer.id,
        expectedVersion: customer.version,
        archived: willArchive,
      });
      onOpenChange?.(false);
    } catch (err) {
      setError(mapCustomerErrorToMessage(err));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!isWorking ? onOpenChange?.(next) : null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={willArchive ? 'Konfirmasi arsipkan customer' : 'Konfirmasi aktifkan customer'}
          data-customer-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-4 top-1/2 z-[70] mx-auto max-w-md -translate-y-1/2 border-2 shadow-[6px_6px_0px_#151515]"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex items-start justify-between gap-2 border-b-2 px-4 py-3.5">
            <div>
              <span className="border-studio-ivory bg-studio-orange text-studio-white inline-block border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                {willArchive ? 'ARCHIVE CUSTOMER' : 'REACTIVATE CUSTOMER'}
              </span>
              <Dialog.Title className="font-display mt-1.5 text-xl leading-none font-black text-white uppercase">
                {willArchive
                  ? `Arsipkan ${customer.displayName}?`
                  : `Aktifkan ${customer.displayName}?`}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Tutup dialog arsip"
              disabled={isWorking}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="space-y-3 p-4 text-xs leading-relaxed">
            {error ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2 border-2 p-2.5 font-bold"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {willArchive ? (
              <p className="font-medium text-neutral-800">
                Profil tidak akan dihapus permanen dan seluruh riwayat{' '}
                <strong>{customer.bookingCount} booking</strong> tetap tersimpan. Profil yang
                diarsipkan disembunyikan dari directory utama dan tidak otomatis dipilih pada
                booking baru, tetapi tetap dapat ditemukan pada filter <strong>Archived</strong> dan
                diaktifkan kembali kapan saja.
              </p>
            ) : (
              <p className="font-medium text-neutral-800">
                Profil <strong>{customer.displayName}</strong> akan kembali aktif pada Customer
                Directory dan kembali terdeteksi saat nomor HP digunakan pada Booking Form.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onOpenChange?.(false)}
                className="brutal-btn bg-studio-white text-studio-ink min-h-11 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isWorking}
                onClick={handleConfirm}
                className={`brutal-btn inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-4 py-2 font-mono text-xs font-extrabold uppercase ${
                  willArchive
                    ? 'bg-studio-orange text-studio-white'
                    : 'bg-studio-lime text-studio-ink'
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
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
