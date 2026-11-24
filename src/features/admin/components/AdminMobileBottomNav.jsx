import { CalendarDays, Inbox, LayoutDashboard, Menu, ReceiptText } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { NavLink, useLocation } from 'react-router';

import { cn } from '@/lib/utils';

const PRIMARY_DOCK_ITEMS = [
  {
    id: 'dashboard',
    label: 'Ringkasan',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'calendar',
    label: 'Jadwal',
    href: '/admin/calendar',
    icon: CalendarDays,
  },
  {
    id: 'booking-requests',
    label: 'Inbox',
    href: '/admin/booking-requests',
    icon: Inbox,
  },
  {
    id: 'payment-and-bill',
    label: 'Tagihan',
    href: '/admin/payment-and-bill',
    icon: ReceiptText,
  },
];

export function AdminMobileBottomNav({
  isMobileDrawerOpen = false,
  onOpenMobileDrawer,
  navBadges = {},
}) {
  const prefersReducedMotion = useReducedMotion();
  const location = useLocation();
  const normalizedPath = String(location.pathname || '').replace(/\/+$/, '');
  const isPrimaryRoute = PRIMARY_DOCK_ITEMS.some(
    (item) => normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`),
  );
  const isMoreActive = isMobileDrawerOpen || !isPrimaryRoute;

  return (
    <nav
      aria-label="Pintasan navigasi mobile"
      className="no-print pointer-events-none fixed inset-x-3 bottom-2.5 z-30 mx-auto max-w-[430px] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="pointer-events-auto grid grid-cols-5 items-center gap-1 rounded-[20px] border border-white/12 bg-[#151515]/92 p-1.5 text-[#F1EEE4] shadow-[0_20px_44px_-12px_rgba(21,21,21,0.52),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
        {PRIMARY_DOCK_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const badge = navBadges[item.id] || '';
          const isRouteActive =
            normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`);
          const isVisuallyActive = isRouteActive && !isMobileDrawerOpen;

          return (
            <NavLink
              key={item.id}
              to={item.href}
              aria-label={item.label}
              className={cn(
                'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1 text-[10.5px] leading-tight transition-colors duration-150',
                isVisuallyActive
                  ? 'font-bold text-[#151515]'
                  : 'font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white',
              )}
            >
              {isVisuallyActive ? (
                <motion.span
                  layoutId={prefersReducedMotion ? undefined : 'admin-mobile-dock-active-pill'}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 460, damping: 34 }
                  }
                  className="absolute inset-0 rounded-[14px] bg-[#C8F13A] shadow-[0_6px_16px_-4px_rgba(200,241,58,0.45)]"
                  aria-hidden="true"
                />
              ) : null}

              <span className="relative z-10 inline-flex h-5 w-5 items-center justify-center">
                <IconComponent className="h-[18px] w-[18px] stroke-[2]" aria-hidden="true" />
                {badge ? (
                  <span
                    data-testid={`mobile-dock-badge-${item.id}`}
                    aria-hidden="true"
                    className={cn(
                      'absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full px-1 py-[1px] font-mono text-[9px] leading-none font-extrabold shadow-xs',
                      isVisuallyActive ? 'bg-[#151515] text-[#C8F13A]' : 'bg-[#FF4B22] text-white',
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
              <span className="relative z-10 truncate">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={onOpenMobileDrawer}
          aria-expanded={isMobileDrawerOpen}
          aria-label="Buka menu lainnya"
          className={cn(
            'relative flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1 text-[10.5px] leading-tight transition-colors duration-150',
            isMoreActive
              ? 'font-bold text-[#151515]'
              : 'font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white',
          )}
        >
          {isMoreActive ? (
            <motion.span
              layoutId={prefersReducedMotion ? undefined : 'admin-mobile-dock-active-pill'}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 460, damping: 34 }
              }
              className="absolute inset-0 rounded-[14px] bg-[#C8F13A] shadow-[0_6px_16px_-4px_rgba(200,241,58,0.45)]"
              aria-hidden="true"
            />
          ) : null}

          <span className="relative z-10 inline-flex h-5 w-5 items-center justify-center">
            <Menu className="h-[18px] w-[18px] stroke-[2]" aria-hidden="true" />
          </span>
          <span className="relative z-10 truncate">Lainnya</span>
        </button>
      </div>
    </nav>
  );
}
