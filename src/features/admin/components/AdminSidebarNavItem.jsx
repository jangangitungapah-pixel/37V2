import { motion, useReducedMotion } from 'motion/react';
import { NavLink } from 'react-router';

import { cn } from '@/lib/utils';

export function AdminSidebarNavItem({
  item,
  isCollapsed = false,
  onSelect,
  layoutScope = 'desktop',
}) {
  const prefersReducedMotion = useReducedMotion();
  const IconComponent = item.icon;

  return (
    <li className="relative">
      <NavLink
        to={item.href}
        onClick={onSelect}
        aria-label={item.label}
        title={isCollapsed ? `${item.order} • ${item.label}` : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex min-h-10.5 w-full items-center overflow-visible rounded-xl transition-colors duration-150',
            isCollapsed ? 'justify-center px-0' : 'justify-start px-1.5',
            isActive
              ? 'font-semibold text-[#151515]'
              : 'font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white',
          )
        }
      >
        {({ isActive }) => (
          <>
            {/* Active Surface & Signal-Orange Accent Indicator */}
            {isActive ? (
              <motion.span
                layoutId={
                  prefersReducedMotion ? undefined : `${layoutScope}-admin-sidebar-active-pill`
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 34 }
                }
                className="absolute inset-0 rounded-xl bg-[#C8F13A] shadow-[0_6px_18px_-6px_rgba(200,241,58,0.45)]"
                aria-hidden="true"
              >
                <span className="absolute inset-y-2 left-1.5 w-1 rounded-full bg-[#FF4B22]" />
              </motion.span>
            ) : null}

            {/* Stationary Icon Container */}
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-150',
                !isCollapsed && !isActive ? 'group-hover:translate-x-0.5' : '',
              )}
            >
              <IconComponent
                className={cn(
                  'h-[18px] w-[18px] shrink-0 stroke-[1.9]',
                  isActive
                    ? 'text-[#151515]'
                    : 'text-neutral-400 transition-colors group-hover:text-[#C8F13A]',
                )}
                aria-hidden="true"
              />
            </span>

            {/* Navigation Text Label (Rendered when Expanded) */}
            {!isCollapsed ? (
              <motion.span
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                data-sidebar-label={item.id}
                className="relative z-10 flex min-w-0 flex-1 items-center justify-between gap-2 pr-2.5 whitespace-nowrap"
              >
                <span className="truncate text-[13.5px]">{item.label}</span>
                <span
                  className={cn(
                    'font-mono text-[10px] font-semibold',
                    isActive
                      ? 'text-[#151515]/70'
                      : 'text-neutral-500 group-hover:text-neutral-300',
                  )}
                >
                  {item.order}
                </span>
              </motion.span>
            ) : (
              /* Collapsed Hover / Keyboard Focus Tooltip */
              <span
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-full z-50 ml-3 flex items-center gap-2 rounded-xl border border-white/15 bg-[#151515] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
              >
                <span className="font-mono text-[10px] font-bold text-[#C8F13A]">{item.order}</span>
                <span>{item.label}</span>
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}
