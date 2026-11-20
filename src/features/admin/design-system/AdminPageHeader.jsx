import { cn } from '@/lib/utils';

/**
 * Unified hero header card for Admin Portal modules.
 * Balances warm ambient lighting, clear typography hierarchy, and mobile breathing room.
 */
export function AdminPageHeader({
  eyebrow,
  icon: Icon,
  meta,
  title,
  titleId,
  description,
  actions,
  children,
  className = '',
}) {
  return (
    <section aria-labelledby={titleId} className={cn('sa-card-hero p-4 sm:p-6 lg:p-7', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          {(eyebrow || meta) && (
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-[#F1EEE4]">
                  {Icon ? <Icon className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" /> : null}
                  <span>{eyebrow}</span>
                </span>
              ) : null}
              {meta}
            </div>
          )}

          <div>
            <h2
              id={titleId}
              className="text-xl font-bold tracking-[-0.025em] text-[#151515] sm:text-2xl lg:text-[28px] lg:leading-tight"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-2.5">{actions}</div>
        ) : null}
      </div>

      {children ? <div className="mt-4 sm:mt-5">{children}</div> : null}
    </section>
  );
}
