import { cn } from '@/lib/utils';

/**
 * Calm spatial empty / fallback state container.
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className = '',
}) {
  const iconTone =
    tone === 'orange'
      ? 'bg-[#FFEDE8] text-[#B92B0C]'
      : tone === 'lime'
        ? 'bg-[#EDF8C2] text-[#243300]'
        : 'bg-[#F4F1E8] text-[#46433D]';

  return (
    <div
      className={cn(
        'sa-panel flex flex-col items-center justify-center border-dashed px-4 py-8 text-center sm:px-6 sm:py-10',
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl',
            iconTone,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}

      {title ? <p className="text-sm font-semibold text-[#151515] sm:text-base">{title}</p> : null}

      {description ? (
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#666159] sm:text-sm">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
