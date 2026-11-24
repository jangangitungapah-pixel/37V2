import { CalendarDays, Inbox, LayoutDashboard, Menu, ReceiptText } from 'lucide-react';
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
  const location = useLocation();
  const normalizedPath = String(location.pathname || '').replace(/\/+$/, '');
  const isPrimaryRoute = PRIMARY_DOCK_ITEMS.some(
    (item) => normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`),
  );
  const isMoreActive = isMobileDrawerOpen || !isPrimaryRoute;

  return (
    <nav
      aria-label="Pintasan navigasi mobile"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[#151515]/10 bg-[#FAF8F3]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(21,21,21,0.14)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1.5 py-1">
        {PRIMARY_DOCK_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const badge = navBadges[item.id] || '';
          return (
            <NavLink
              key={item.id}
              to={item.href}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10.5px] leading-tight transition-colors',
                  isActive
                    ? 'bg-[#C8F13A]/75 font-bold text-[#151515] shadow-[inset_0_0_0_1px_rgba(21,21,21,0.12)]'
                    : 'font-medium text-[#46433D] hover:bg-[#151515]/[0.05] hover:text-[#151515]',
                )
              }
            >
              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                <IconComponent className="h-[18px] w-[18px] stroke-[2]" aria-hidden="true" />
                {badge ? (
                  <span
                    data-testid={`mobile-dock-badge-${item.id}`}
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-[#FF4B22] px-1 py-[1px] font-mono text-[9px] leading-none font-extrabold text-white shadow-xs"
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={onOpenMobileDrawer}
          aria-expanded={isMobileDrawerOpen}
          aria-label="Buka menu lainnya"
          className={cn(
            'relative flex min-h-13 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10.5px] leading-tight transition-colors',
            isMoreActive
              ? 'bg-[#151515] font-bold text-[#C8F13A]'
              : 'font-medium text-[#46433D] hover:bg-[#151515]/[0.05] hover:text-[#151515]',
          )}
        >
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <Menu className="h-[18px] w-[18px] stroke-[2]" aria-hidden="true" />
          </span>
          <span className="truncate">Lainnya</span>
        </button>
      </div>
    </nav>
  );
}
