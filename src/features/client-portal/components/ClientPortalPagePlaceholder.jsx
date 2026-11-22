import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { cn } from '@/lib/utils';

/**
 * Reusable Spatial Ambient placeholder block for modular Client Portal sections.
 */
export function ClientPortalPagePlaceholder({
  icon: Icon,
  title,
  description,
  badge,
  badgeTone = 'ivory',
  action,
  tone = 'neutral',
  className = '',
  children,
}) {
  const iconTone =
    tone === 'orange'
      ? 'bg-[#FFEDE8] text-[#B92B0C]'
      : tone === 'lime'
        ? 'bg-[#EDF8C2] text-[#243300]'
        : 'bg-[#F4F1E8] text-[#46433D]';

  return (
    <AdminSurface
      as="section"
      variant="panel"
      className={cn('border-dashed px-4 py-6 text-center sm:px-6 sm:py-8', className)}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center">
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

        {badge ? (
          <div className="mb-2">
            <AdminStatusBadge tone={badgeTone}>{badge}</AdminStatusBadge>
          </div>
        ) : null}

        {title ? (
          <h3 className="text-sm font-semibold text-[#151515] sm:text-base">{title}</h3>
        ) : null}

        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-[#666159] sm:text-sm">{description}</p>
        ) : null}

        {children ? <div className="mt-4 w-full">{children}</div> : null}

        {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
      </div>
    </AdminSurface>
  );
}
