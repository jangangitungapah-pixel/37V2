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
            'group relative flex min-h-11 w-full items-center overflow-visible transition-colors',
            isCollapsed ? 'justify-center px-0' : 'justify-start px-1.5',
            isActive
              ? 'text-studio-ink font-extrabold'
              : 'text-studio-ivory/85 font-semibold hover:bg-neutral-900 hover:text-white',
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
                className="bg-studio-lime border-studio-ivory/20 absolute inset-0 border"
                aria-hidden="true"
              >
                <span className="bg-studio-orange absolute inset-y-0 left-0 w-1.5" />
              </motion.span>
            ) : null}

            {/* Stationary Icon Container */}
            <span
              className={cn(
                'relative z-10 flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-150',
                !isCollapsed && !isActive ? 'group-hover:translate-x-0.5' : '',
              )}
            >
              <IconComponent
                className={cn(
                  'h-5 w-5 shrink-0 stroke-[2.1]',
                  isActive
                    ? 'text-studio-ink'
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
                <span className="truncate text-sm tracking-wide">{item.label}</span>
                <span
                  className={cn(
                    'font-mono text-[10px] font-bold',
                    isActive
                      ? 'text-studio-ink/80'
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
                className="border-studio-ink bg-studio-ivory text-studio-ink pointer-events-none invisible absolute left-full z-50 ml-3 flex items-center gap-1.5 border-2 px-2.5 py-1.5 font-mono text-xs font-extrabold whitespace-nowrap opacity-0 shadow-[3px_3px_0px_#151515] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
              >
                <span className="text-studio-orange">{item.order}</span>
                <span>{item.label}</span>
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}
