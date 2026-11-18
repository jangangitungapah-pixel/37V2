import { ArrowLeft, CheckCircle2, Compass } from 'lucide-react';
import { Link } from 'react-router';

import { getAdminModuleById } from '../navigation/admin-navigation';

export function AdminModulePlaceholderPage({ moduleId }) {
  const moduleItem = getAdminModuleById(moduleId);
  const IconComponent = moduleItem.icon;

  return (
    <div className="space-y-6">
      {/* Main Module Foundation Card */}
      <section
        aria-labelledby="module-placeholder-heading"
        className="brutal-card-lg bg-studio-white p-5 sm:p-8 lg:p-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 border-[1.5px] px-3 py-1 font-mono text-[11px] font-extrabold tracking-wider uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>MODULE FOUNDATION READY</span>
          </span>

          <span className="border-studio-ink bg-studio-ivory border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
            {moduleItem.eyebrow}
          </span>
        </div>

        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="border-studio-ink bg-studio-ivory flex h-14 w-14 shrink-0 items-center justify-center border-2 shadow-[3px_3px_0px_#151515]">
            <IconComponent className="h-7 w-7 stroke-[2]" aria-hidden="true" />
          </span>

          <div>
            <p className="text-studio-muted-ink font-mono text-xs font-bold tracking-wider uppercase">
              ROUTE: {moduleItem.href}
            </p>
            <h2
              id="module-placeholder-heading"
              className="font-display text-studio-ink mt-1 text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl"
            >
              {moduleItem.label}
            </h2>
          </div>
        </div>

        {/* Required Phase 4 Placeholder Message */}
        <p className="border-studio-ink bg-studio-ivory text-studio-ink mt-6 border-2 p-4 text-sm leading-relaxed font-bold sm:text-base">
          This workspace is ready. The module&apos;s operational features will be implemented in its
          dedicated development phase.
        </p>

        <p className="text-studio-muted-ink mt-4 max-w-2xl text-xs leading-relaxed font-medium sm:text-sm">
          {moduleItem.summary}
        </p>

        {/* Planned Architectural Scope Notes */}
        <div className="mt-6 border-t border-neutral-200 pt-5">
          <div className="flex items-center gap-2">
            <Compass className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
            <h3 className="font-mono text-xs font-extrabold tracking-wider uppercase">
              Planned Scope for Future {moduleItem.label} Phase
            </h3>
          </div>

          <ul className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {moduleItem.scopeNotes.map((note, index) => (
              <li
                key={note}
                className="border-studio-ink bg-studio-ivory flex flex-col justify-between border p-3.5"
              >
                <span className="text-studio-orange font-mono text-[10px] font-extrabold uppercase">
                  SCOPE 0{index + 1}
                </span>
                <p className="text-studio-ink mt-1.5 text-xs leading-relaxed font-semibold">
                  {note}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Navigation Actions */}
        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-5">
          <Link
            to="/admin/dashboard"
            className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 items-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </Link>

          <span className="text-studio-muted-ink font-mono text-[11px]">
            No operational records or database queries are active on this placeholder route.
          </span>
        </div>
      </section>
    </div>
  );
}

export default AdminModulePlaceholderPage;
