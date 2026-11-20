import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, Archive, ArchiveRestore, Loader2, X } from 'lucide-react';

import { AdminStatusBadge } from '@/features/admin/design-system';

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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-[60]"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={willArchive ? 'Konfirmasi arsipkan customer' : 'Konfirmasi aktifkan customer'}
          data-customer-scoped="true"
          className="sa-dialog fixed inset-x-4 top-1/2 z-[70] mx-auto max-w-md -translate-y-1/2 overflow-hidden outline-none"
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-4">
            <div>
              <AdminStatusBadge tone="orange" size="sm" className="uppercase">
                {willArchive ? 'Arsipkan Pelanggan' : 'Aktifkan Pelanggan'}
              </AdminStatusBadge>
              <Dialog.Title className="mt-2 text-lg font-bold tracking-tight text-[#151515]">
                {willArchive
                  ? `Arsipkan ${customer.displayName}?`
                  : `Aktifkan ${customer.displayName}?`}
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Tutup dialog arsip"
              disabled={isWorking}
              className="sa-control inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="space-y-3.5 bg-white p-5 text-xs leading-relaxed">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3 font-medium text-[#B92B0C]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {willArchive ? (
              <p className="text-[#46433D]">
                Data tidak dihapus dan riwayat{' '}
                <strong className="text-[#151515]">{customer.bookingCount} booking</strong> tetap
                aman tersimpan. Pelanggan yang diarsipkan disembunyikan dari daftar utama, namun
                tetap dapat dicari lewat filter{' '}
                <strong className="text-[#151515]">Diarsipkan</strong> dan diaktifkan kembali kapan
                saja.
              </p>
            ) : (
              <p className="text-[#46433D]">
                Profil <strong className="text-[#151515]">{customer.displayName}</strong> akan
                tampil kembali di daftar utama dan otomatis dikenali saat nomor HP diisi di form
                booking.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isWorking}
                onClick={() => onOpenChange?.(false)}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isWorking}
                onClick={handleConfirm}
                className={`sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold ${
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
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
