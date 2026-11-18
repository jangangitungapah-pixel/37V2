import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

export function SettingsModuleCard({
  to,
  order = '01',
  title,
  description,
  icon: IconComponent,
  badge = 'ACTIVE MODULE',
}) {
  return (
    <article className="brutal-card bg-studio-white flex flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-extrabold text-neutral-500">{order}</span>
          <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
            {badge}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-3.5">
          {IconComponent ? (
            <span className="border-studio-ink bg-studio-ivory flex h-12 w-12 shrink-0 items-center justify-center border-2 shadow-[2px_2px_0px_#151515]">
              <IconComponent className="h-6 w-6 stroke-[2.1]" aria-hidden="true" />
            </span>
          ) : null}

          <div className="min-w-0">
            <h3 className="font-display text-studio-ink text-2xl leading-none font-black tracking-tight uppercase">
              {title}
            </h3>
            <p className="text-studio-muted-ink mt-2 text-xs leading-relaxed font-medium sm:text-sm">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="border-studio-ink mt-5 border-t pt-4">
        <Link
          to={to}
          className="brutal-btn bg-studio-ink text-studio-lime hover:bg-studio-orange hover:text-studio-white flex min-h-11 w-full items-center justify-between px-4 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          <span>Open {title}</span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
