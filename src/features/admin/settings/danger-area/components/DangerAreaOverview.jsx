import { AlertTriangle, ShieldAlert } from 'lucide-react';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function DangerAreaOverview() {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="danger-area-overview-heading"
      className="border-red-200 bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-red-100 pb-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="danger-area-overview-heading"
                className="text-base font-bold tracking-tight text-[#151515] sm:text-lg"
              >
                Operational Factory Reset
              </h2>
              <AdminStatusBadge tone="danger" icon={AlertTriangle} size="sm">
                OWNER ONLY • DESTRUCTIVE
              </AdminStatusBadge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#666159] sm:text-sm">
              Membersihkan seluruh catatan bisnis dan data klien historis agar studio dapat memulai
              pembukuan &amp; penjadwalan dari nol tanpa menghapus akun Admin maupun konfigurasi
              studio.
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
            Scope Penghapusan
          </dt>
          <dd className="mt-1 font-semibold text-[#151515]">
            16 Koleksi Utama + 2 Subkoleksi Request
          </dd>
        </div>

        <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
            Keamanan Eksekusi
          </dt>
          <dd className="mt-1 font-semibold text-[#151515]">
            Re-autentikasi Password + Frasa + Lock Rules
          </dd>
        </div>

        <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F3] p-3">
          <dt className="font-mono text-[10.5px] font-semibold tracking-wide text-[#756F65] uppercase">
            Ketahanan Sesi
          </dt>
          <dd className="mt-1 font-semibold text-[#151515]">
            Batch Terukur (≤10) &amp; Mendukung Resume
          </dd>
        </div>
      </dl>
    </AdminSurface>
  );
}
