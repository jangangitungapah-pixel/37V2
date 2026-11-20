import { cn } from '@/lib/utils';

const BADGE_TONES = {
  neutral: 'bg-[#151515]/[0.05] text-[#46433D] border-[#151515]/10',
  ivory: 'bg-[#F8F6EF] text-[#46433D] border-[#151515]/12',
  lime: 'bg-[#EDF8C2] text-[#243300] border-[#8BAD12]/35',
  orange: 'bg-[#FFEDE8] text-[#B92B0C] border-[#FF4B22]/25',
  amber: 'bg-[#FEF4DD] text-[#8A4B08] border-amber-500/25',
  emerald: 'bg-[#E6F6EC] text-[#0F6246] border-emerald-500/25',
  danger: 'bg-red-50 text-red-700 border-red-200',
  ink: 'bg-[#151515] text-[#F1EEE4] border-[#151515]',
};

const DOT_TONES = {
  neutral: 'bg-[#666159]',
  ivory: 'bg-[#666159]',
  lime: 'bg-[#658800]',
  orange: 'bg-[#FF4B22]',
  amber: 'bg-amber-600',
  emerald: 'bg-emerald-600',
  danger: 'bg-red-600',
  ink: 'bg-[#C8F13A]',
};

/**
 * Refined capsule status badge replacing hard-edged uppercase stamps.
 */
export function AdminStatusBadge({
  tone = 'neutral',
  icon: Icon,
  dot = false,
  size = 'md',
  className = '',
  children,
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-0.5 text-[11px]',
        BADGE_TONES[tone] || BADGE_TONES.neutral,
        className,
      )}
    >
      {dot ? (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[tone] || DOT_TONES.neutral)}
          aria-hidden="true"
        />
      ) : null}
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
