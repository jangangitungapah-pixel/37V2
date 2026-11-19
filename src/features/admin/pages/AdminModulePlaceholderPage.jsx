import { ArrowLeft, CheckCircle2, Compass } from 'lucide-react';
import { Link } from 'react-router';

import { getAdminModuleById } from '../navigation/admin-navigation';

export function AdminModulePlaceholderPage({ moduleId }) {
  const moduleItem = getAdminModuleById(moduleId);
  const IconComponent = moduleItem.icon;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Module Card */}
      <section
        aria-labelledby="module-placeholder-heading"
        className="brutal-card-lg bg-studio-white p-4 sm:p-8 lg:p-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-[1.5px] px-2.5 py-0.5 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:px-3 sm:py-1 sm:text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SEGERA HADIR</span>
          </span>

          <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase sm:px-2.5 sm:py-1 sm:text-[10px]">
            {moduleItem.eyebrow}
          </span>
        </div>

        <div className="mt-4 flex flex-col items-start gap-3 sm:mt-5 sm:flex-row sm:items-center sm:gap-4">
          <span className="border-studio-ink bg-studio-ivory flex h-12 w-12 shrink-0 items-center justify-center border-2 shadow-[3px_3px_0px_#151515] sm:h-14 sm:w-14">
            <IconComponent className="h-6 w-6 stroke-[2] sm:h-7 sm:w-7" aria-hidden="true" />
          </span>

          <div>
            <p className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase sm:text-xs">
              MENU {moduleItem.order} • DALAM PERSIAPAN
            </p>
            <h2
              id="module-placeholder-heading"
              className="font-display text-studio-ink mt-1 text-2xl leading-none font-black tracking-tight uppercase sm:text-5xl"
            >
              {moduleItem.label}
            </h2>
          </div>
        </div>

        <p className="border-studio-ink bg-studio-ivory text-studio-ink mt-4 border-2 p-3 text-xs leading-relaxed font-bold sm:mt-6 sm:p-4 sm:text-base">
          Halaman ini sedang disiapkan dan fitur lengkapnya akan segera hadir pada pembaruan
          berikutnya.
        </p>

        <p className="text-studio-muted-ink mt-3 max-w-2xl text-xs leading-relaxed font-medium sm:mt-4 sm:text-sm">
          {moduleItem.summary}
        </p>

        {/* Planned Features */}
        <div className="mt-5 border-t border-neutral-200 pt-4 sm:mt-6 sm:pt-5">
          <div className="flex items-center gap-2">
            <Compass className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
            <h3 className="font-mono text-xs font-extrabold tracking-wider uppercase">
              Fitur yang Akan Tersedia di {moduleItem.label}
            </h3>
          </div>

          <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:mt-3.5 sm:gap-3 md:grid-cols-3">
            {moduleItem.scopeNotes.map((note, index) => (
              <li
                key={note}
                className="border-studio-ink bg-studio-ivory flex flex-col justify-between border p-3 sm:p-3.5"
              >
                <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                  FITUR 0{index + 1}
                </span>
                <p className="text-studio-ink mt-1.5 text-xs leading-relaxed font-semibold">
                  {note}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-4 sm:mt-7 sm:pt-5">
          <Link
            to="/admin/dashboard"
            className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-10 items-center gap-2 px-4 py-2 text-xs font-extrabold tracking-wider uppercase sm:min-h-11 sm:px-5 sm:py-2.5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali ke Dashboard</span>
          </Link>

          <span className="text-studio-muted-ink font-mono text-[11px]">
            Belum ada catatan transaksi yang aktif di menu ini.
          </span>
        </div>
      </section>
    </div>
  );
}

export default AdminModulePlaceholderPage;
