import { ArrowLeft, CheckCircle2, Compass } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge, AdminSurface } from '../design-system';
import { getAdminModuleById } from '../navigation/admin-navigation';

export function AdminModulePlaceholderPage({ moduleId }) {
  const moduleItem = getAdminModuleById(moduleId);
  const IconComponent = moduleItem.icon;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Module Card */}
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="module-placeholder-heading"
        className="p-4 sm:p-7 lg:p-9"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AdminStatusBadge tone="lime" icon={CheckCircle2}>
            SEGERA HADIR
          </AdminStatusBadge>

          <AdminStatusBadge tone="ivory" size="sm" className="font-mono uppercase">
            {moduleItem.eyebrow}
          </AdminStatusBadge>
        </div>

        <div className="mt-5 flex flex-col items-start gap-3.5 sm:mt-6 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#151515]/10 bg-[#F8F6EF] text-[#151515] shadow-[0_6px_16px_-6px_rgba(21,21,21,0.1)] sm:h-14 sm:w-14">
            <IconComponent className="h-6 w-6 stroke-[1.8] sm:h-7 sm:w-7" aria-hidden="true" />
          </span>

          <div>
            <p className="font-mono text-[11px] font-semibold tracking-wider text-[#666159] uppercase">
              MENU {moduleItem.order} • DALAM PERSIAPAN
            </p>
            <h2
              id="module-placeholder-heading"
              className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[#151515] sm:text-3xl lg:text-4xl"
            >
              {moduleItem.label}
            </h2>
          </div>
        </div>

        <div className="sa-panel-ivory mt-5 p-3.5 text-xs leading-relaxed font-medium text-[#151515] sm:mt-6 sm:p-4 sm:text-sm">
          Halaman ini sedang disiapkan dan fitur lengkapnya akan segera hadir pada pembaruan
          berikutnya.
        </div>

        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[#666159] sm:mt-4 sm:text-sm">
          {moduleItem.summary}
        </p>

        {/* Planned Features */}
        <div className="mt-6 border-t border-[#151515]/[0.08] pt-5 sm:mt-7 sm:pt-6">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
            <h3 className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
              Fitur yang Akan Tersedia di {moduleItem.label}
            </h3>
          </div>

          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:mt-4 sm:gap-3 md:grid-cols-3">
            {moduleItem.scopeNotes.map((note, index) => (
              <li key={note} className="sa-subcard flex flex-col justify-between p-3.5 sm:p-4">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[#FF4B22] uppercase">
                  FITUR 0{index + 1}
                </span>
                <p className="mt-2 text-xs leading-relaxed font-medium text-[#151515]">{note}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#151515]/[0.08] pt-5 sm:mt-7">
          <Link
            to="/admin/dashboard"
            className="sa-control sa-btn-primary inline-flex min-h-10 items-center gap-2 px-4 py-2 text-xs font-semibold sm:min-h-10.5 sm:px-5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke Dashboard</span>
          </Link>

          <span className="text-xs text-[#666159]">
            Belum ada catatan transaksi yang aktif di menu ini.
          </span>
        </div>
      </AdminSurface>
    </div>
  );
}

export default AdminModulePlaceholderPage;
