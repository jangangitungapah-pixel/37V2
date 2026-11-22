import { AlertTriangle, Lock } from 'lucide-react';

import { AdminSurface } from '@/features/admin/design-system';

export function FactoryResetWarning() {
  return (
    <AdminSurface
      as="section"
      variant="subcard"
      role="region"
      aria-labelledby="factory-reset-warning-heading"
      className="border-red-300/80 bg-red-50/75 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700">
          <AlertTriangle className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h3
            id="factory-reset-warning-heading"
            className="text-sm font-bold tracking-tight text-red-900 sm:text-base"
          >
            Peringatan Tindakan Permanen
          </h3>
          <p className="text-xs leading-relaxed font-medium text-red-900 sm:text-sm">
            Factory Reset akan menghapus seluruh data operasional yang tercantum secara permanen.
            Data yang sudah dihapus tidak dapat dipulihkan melalui aplikasi.
          </p>
          <div className="flex items-start gap-2 rounded-xl border border-red-200/80 bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-[#46433D]">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" aria-hidden="true" />
            <span>
              Selama Factory Reset berjalan, kunci pemeliharaan (<em>maintenance lock</em>) otomatis
              memblokir penambahan atau perubahan booking, pelanggan, pembayaran, inventori,
              pembukuan, maupun booking request baru hingga seluruh target terverifikasi kosong.
            </span>
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
