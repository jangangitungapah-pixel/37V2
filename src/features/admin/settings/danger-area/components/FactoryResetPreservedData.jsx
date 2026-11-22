import { CheckCircle2, ShieldCheck } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { FACTORY_RESET_PRESERVED_MANIFEST } from '../config/factory-reset-config';

export function FactoryResetPreservedData({ preservedItems = [] }) {
  const items = preservedItems.length > 0 ? preservedItems : FACTORY_RESET_PRESERVED_MANIFEST;

  return (
    <AdminSurface
      as="section"
      variant="ivory"
      aria-labelledby="factory-reset-preserved-heading"
      className="p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] text-[#243300]">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="factory-reset-preserved-heading"
              className="text-sm font-bold tracking-tight text-[#151515] sm:text-base"
            >
              Data &amp; Aset yang Dipertahankan (Preserved)
            </h2>
            <p className="text-xs text-[#666159]">
              Akun admin, identitas studio, pengaturan harga, media Cloudinary, dan template tidak
              dihapus.
            </p>
          </div>
        </div>

        <AdminStatusBadge tone="lime" dot size="sm">
          {items.length} Target Dijaga
        </AdminStatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex flex-col justify-between rounded-xl border border-[#151515]/10 bg-white/90 p-3.5"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#756F65] uppercase">
                  {item.category}
                </span>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#658800]" aria-hidden="true" />
              </div>
              <h3 className="mt-1 text-xs font-bold text-[#151515] sm:text-sm">{item.label}</h3>
              <p className="mt-1 font-mono text-[11px] text-[#666159]">{item.path}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#666159]">{item.reason}</p>
            </div>

            {item.statusLabel ? (
              <div className="mt-3 border-t border-[#151515]/[0.06] pt-2">
                <AdminStatusBadge tone={item.error ? 'orange' : 'ivory'} size="sm">
                  {item.error ? 'Gagal cek' : item.statusLabel}
                </AdminStatusBadge>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AdminSurface>
  );
}
