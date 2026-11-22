import { useContext } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';

import { AuthContext } from '@/features/auth/AuthContext';

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';
import { AdminSidebarNavItem } from './AdminSidebarNavItem';

export function AdminSidebar({ isCollapsed, onToggleCollapse, navBadges = {} }) {
  const prefersReducedMotion = useReducedMotion();
  const auth = useContext(AuthContext);
  const actorRole = String(auth?.role || auth?.profile?.role || '')
    .trim()
    .toLowerCase();
  const visibleNavItems = ADMIN_NAVIGATION_ITEMS.filter(
    (item) => !Array.isArray(item.roles) || item.roles.includes(actorRole),
  );

  return (
    <motion.aside
      aria-label="Studio administration sidebar"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      initial={false}
      animate={{ width: isCollapsed ? 80 : 264 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className="sa-sidebar sticky top-0 z-30 hidden h-screen shrink-0 flex-col justify-between select-none lg:flex"
    >
      {/* Top Section: Brand Identity + Collapse Control + Navigation List */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Brand Lockup Header */}
        <div className="flex min-h-[72px] items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-3">
          <Link
            to="/admin/dashboard"
            aria-label="37 Music Studio — Dashboard home"
            className={
              isCollapsed
                ? 'mx-auto flex h-10 w-10 items-center justify-center'
                : 'flex min-w-0 items-center gap-3'
            }
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8F13A] font-mono text-sm font-extrabold tracking-tight text-[#151515] shadow-[0_6px_16px_-4px_rgba(200,241,58,0.38)] ring-1 ring-white/15">
              37
            </span>
            {!isCollapsed ? (
              <span className="flex min-w-0 flex-col overflow-hidden whitespace-nowrap">
                <span className="truncate text-sm font-bold tracking-tight text-white">
                  37 Music Studio
                </span>
                <span className="mt-0.5 truncate font-mono text-[10px] font-medium tracking-wider text-[#C8F13A]/90 uppercase">
                  Workspace
                </span>
              </span>
            ) : null}
          </Link>

          {!isCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label="Collapse sidebar navigation"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.09] hover:text-[#C8F13A]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Expand Control Bar when Collapsed */}
        {isCollapsed ? (
          <div className="flex justify-center border-b border-white/[0.08] px-2 py-2.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label="Expand sidebar navigation"
              title="Expand sidebar navigation"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.09] hover:text-[#C8F13A]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {/* Section Eyebrow */}
        {!isCollapsed ? (
          <div className="px-4 pt-5 pb-2">
            <p className="font-mono text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
              Menu Utama
            </p>
          </div>
        ) : null}

        {/* Eight Navigation Items */}
        <nav
          aria-label="Admin workspace navigation"
          className="flex-1 overflow-x-visible overflow-y-auto px-3 py-2"
        >
          <ul className="space-y-1">
            {visibleNavItems.map((item) => (
              <AdminSidebarNavItem
                key={item.id}
                item={item}
                badge={navBadges[item.id] || ''}
                isCollapsed={isCollapsed}
                layoutScope="desktop"
              />
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom Workspace Descriptor */}
      <div className="border-t border-white/[0.08] p-3">
        {isCollapsed ? (
          <div
            title="37 Music Studio • Panel Owner & Staff"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#C8F13A]"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#C8F13A]" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-neutral-200">37 Studio • Admin</span>
            </div>
            <p className="mt-0.5 text-[10.5px] text-neutral-400">Akses Owner &amp; Staff studio</p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
