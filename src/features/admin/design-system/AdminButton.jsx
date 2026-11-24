import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  primary: 'sa-btn-primary',
  orange: 'sa-btn-orange',
  lime: 'sa-btn-lime',
  secondary: 'sa-btn-secondary',
  ghost:
    'rounded-[10px] border border-transparent text-[#46433D] hover:bg-[#151515]/[0.05] hover:text-[#151515] transition-colors',
  danger:
    'rounded-[10px] border border-red-600 bg-red-600 text-white shadow-[0_8px_18px_-6px_rgba(220,38,38,0.34)] hover:bg-red-700 transition-all',
};

const SIZE_STYLES = {
  xs: 'min-h-9 sm:min-h-8 px-2.5 py-1 text-xs gap-1.5',
  sm: 'min-h-10 sm:min-h-9 px-3 py-1.5 text-xs gap-1.5',
  md: 'min-h-11 sm:min-h-10 px-4 py-2 text-xs sm:text-[13px] gap-2',
  lg: 'min-h-11 px-5 py-2.5 text-sm gap-2',
};

/**
 * Spatial Ambient Admin Button with soft tactile affordance and full accessibility support.
 */
export function AdminButton({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center font-semibold disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_STYLES[variant] || VARIANT_STYLES.secondary,
        SIZE_STYLES[size] || SIZE_STYLES.md,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
