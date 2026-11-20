import { cn } from '@/lib/utils';

const TONE_MAP = {
  neutral: {
    container: 'bg-white border-[#151515]/[0.085]',
    iconWrap: 'bg-[#F6F3EB] text-[#46433D]',
    value: 'text-[#151515]',
    label: 'text-[#666159]',
    hint: 'text-[#666159]',
  },
  lime: {
    container:
      'bg-[radial-gradient(14rem_8rem_at_100%_0%,rgba(200,241,58,0.22),transparent_70%),#FFFFFF] border-[#8BAD12]/25',
    iconWrap: 'bg-[#EDF8C2] text-[#243300]',
    value: 'text-[#151515]',
    label: 'text-[#46433D]',
    hint: 'text-[#46433D]',
  },
  orange: {
    container:
      'bg-[radial-gradient(14rem_8rem_at_100%_0%,rgba(255,75,34,0.12),transparent_70%),#FFFFFF] border-[#FF4B22]/20',
    iconWrap: 'bg-[#FFEDE8] text-[#B92B0C]',
    value: 'text-[#151515]',
    label: 'text-[#666159]',
    hint: 'text-[#666159]',
  },
  amber: {
    container:
      'bg-[radial-gradient(14rem_8rem_at_100%_0%,rgba(245,158,11,0.14),transparent_70%),#FFFFFF] border-amber-500/20',
    iconWrap: 'bg-[#FEF4DD] text-[#8A4B08]',
    value: 'text-[#151515]',
    label: 'text-[#666159]',
    hint: 'text-[#666159]',
  },
  emerald: {
    container:
      'bg-[radial-gradient(14rem_8rem_at_100%_0%,rgba(16,185,129,0.14),transparent_70%),#FFFFFF] border-emerald-500/20',
    iconWrap: 'bg-[#E6F6EC] text-[#0F6246]',
    value: 'text-[#151515]',
    label: 'text-[#666159]',
    hint: 'text-[#666159]',
  },
  ink: {
    container:
      'bg-[radial-gradient(16rem_10rem_at_100%_0%,rgba(200,241,58,0.12),transparent_70%),#151515] border-white/10 text-white',
    iconWrap: 'bg-white/10 text-[#C8F13A]',
    value: 'text-white',
    label: 'text-neutral-300',
    hint: 'text-neutral-400',
  },
};

/**
 * Calm spatial KPI card with subtle corner accent glow and tabular monospace numerals.
 */
export function AdminMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  className = '',
  children,
}) {
  const styles = TONE_MAP[tone] || TONE_MAP.neutral;

  return (
    <div
      className={cn(
        'rounded-2xl border p-3.5 shadow-[0_1px_2px_rgba(21,21,21,0.035),0_8px_22px_-8px_rgba(21,21,21,0.06)] transition-shadow duration-200 hover:shadow-[0_2px_6px_rgba(21,21,21,0.05),0_12px_28px_-8px_rgba(21,21,21,0.09)] sm:p-4',
        styles.container,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[11px] font-semibold tracking-wide', styles.label)}>{label}</p>
        {Icon ? (
          <span
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              styles.iconWrap,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <p
        className={cn(
          'mt-2 font-mono text-lg font-bold tracking-tight tabular-nums sm:text-xl',
          styles.value,
        )}
      >
        {value}
      </p>

      {hint ? <p className={cn('mt-1 text-[11px] leading-snug', styles.hint)}>{hint}</p> : null}
      {children}
    </div>
  );
}
