import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';
import { AdminSidebarNavItem } from './AdminSidebarNavItem';

export function AdminSidebar({ isCollapsed, onToggleCollapse }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.aside
      aria-label="Studio administration sidebar"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      initial={false}
      animate={{ width: isCollapsed ? 80 : 272 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
      }
      className="border-studio-ink bg-studio-ink text-studio-ivory sticky top-0 z-30 hidden h-screen shrink-0 flex-col justify-between border-r-2 select-none lg:flex"
    >
      {/* Top Section: Brand Identity + Collapse Control + Navigation List */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Brand Lockup Header */}
        <div className="flex min-h-[72px] items-center justify-between gap-2 border-b border-neutral-800 px-3 py-3">
          <Link
            to="/admin/dashboard"
            aria-label="37 Music Studio — Dashboard home"
            className={
              isCollapsed
                ? 'mx-auto flex h-11 w-11 items-center justify-center'
                : 'flex min-w-0 items-center gap-2.5'
            }
          >
            <span className="border-studio-ivory bg-studio-lime text-studio-ink flex h-10 w-10 shrink-0 items-center justify-center border-2 font-mono text-base font-extrabold tracking-tight">
              37
            </span>
            {!isCollapsed ? (
              <span className="flex min-w-0 flex-col overflow-hidden whitespace-nowrap">
                <span className="font-display truncate text-lg leading-none font-black tracking-tight text-white uppercase">
                  37 MUSIC STUDIO
                </span>
                <span className="text-studio-lime mt-1 truncate font-mono text-[9px] font-bold tracking-widest uppercase">
                  STUDIO MANAGEMENT
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
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-neutral-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Expand Control Bar when Collapsed */}
        {isCollapsed ? (
          <div className="flex justify-center border-b border-neutral-800 px-2 py-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label="Expand sidebar navigation"
              title="Expand sidebar navigation"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-neutral-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {/* Section Eyebrow */}
        {!isCollapsed ? (
          <div className="px-4 pt-4 pb-1.5">
            <p className="font-mono text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
              WORKSPACE MODULES (08)
            </p>
          </div>
        ) : null}

        {/* Eight Navigation Items */}
        <nav
          aria-label="Admin workspace navigation"
          className="flex-1 overflow-x-visible overflow-y-auto px-2.5 py-2"
        >
          <ul className="space-y-1">
            {ADMIN_NAVIGATION_ITEMS.map((item) => (
              <AdminSidebarNavItem
                key={item.id}
                item={item}
                isCollapsed={isCollapsed}
                layoutScope="desktop"
              />
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom Workspace Descriptor */}
      <div className="border-t border-neutral-800 p-3">
        {isCollapsed ? (
          <div
            title="37 Music Studio • Authenticated Workspace"
            className="mx-auto flex h-10 w-10 items-center justify-center border border-neutral-800 bg-neutral-900 text-[#C8F13A]"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : (
          <div className="border border-neutral-800 bg-neutral-900/90 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-studio-lime h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-neutral-200 uppercase">
                STUDIO OS • PHASE 4
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-neutral-400">
              Owner &amp; Staff unified shell
            </p>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
