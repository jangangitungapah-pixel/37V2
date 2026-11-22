import { ShieldAlert } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function GalleryOwnerAccessNotice() {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Pembatasan akses halaman Gallery"
      className="p-5 sm:p-7"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFEDE8] text-[#B92B0C]">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-[#151515]">Owner Access Required</h3>
            <AdminStatusBadge tone="ivory" size="sm">
              Public Website Curation
            </AdminStatusBadge>
          </div>

          <p className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
            Halaman <strong className="text-[#151515]">Gallery</strong> digunakan untuk mengunggah
            foto resmi studio ke Cloudinary serta mengatur foto yang tampil di Landing Page publik,
            sehingga hanya dapat diakses oleh{' '}
            <strong className="text-[#151515]">Owner aktif</strong>.
          </p>
          <p className="text-xs text-[#666159]">
            Operasional harian seperti Calendar, Customer, Payment and Bill, dan Inventory tetap
            dapat digunakan seperti biasa.
          </p>
        </div>
      </div>
    </AdminSurface>
  );
}
