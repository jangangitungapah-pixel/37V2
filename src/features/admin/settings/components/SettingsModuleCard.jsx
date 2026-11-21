import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

export function SettingsModuleCard({
  to,
  order = '01',
  title,
  description,
  icon: IconComponent,
  badge = 'ACTIVE MODULE',
}) {
  return (
    <AdminSurface as="article" variant="card" className="flex flex-col justify-between p-4 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="hidden font-mono text-xs font-semibold text-[#8B857B] sm:inline">
            MODUL {order}
          </span>
          <AdminStatusBadge tone="lime" dot size="sm">
            {badge}
          </AdminStatusBadge>
        </div>

        <div className="mt-3 flex items-start gap-3 sm:mt-4 sm:gap-3.5">
          {IconComponent ? (
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#151515]/10 bg-[#F8F6EF] text-[#151515]">
              <IconComponent className="h-5 w-5 stroke-[1.9]" aria-hidden="true" />
            </span>
          ) : null}

          <div className="min-w-0">
            <h3 className="text-lg font-bold tracking-tight text-[#151515] sm:text-xl">{title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#666159] sm:text-sm">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-[#151515]/[0.07] pt-4">
        <Link
          to={to}
          className="sa-control sa-btn-primary flex min-h-10.5 w-full items-center justify-between px-4 py-2 text-xs font-semibold"
        >
          <span>Open {title}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#C8F13A]" aria-hidden="true" />
        </Link>
      </div>
    </AdminSurface>
  );
}
