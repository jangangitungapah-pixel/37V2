import { useContext } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowUpRight, ShieldCheck, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';

import { AuthContext } from '@/features/auth/AuthContext';

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';
import { AdminSidebarNavItem } from './AdminSidebarNavItem';

export function AdminMobileDrawer({ open, onOpenChange, triggerRef, navBadges = {} }) {
  const prefersReducedMotion = useReducedMotion();
  const auth = useContext(AuthContext);
  const actorRole = String(auth?.role || auth?.profile?.role || '')
    .trim()
    .toLowerCase();
  const displayName =
    auth?.profile?.displayName || auth?.user?.displayName || 'Studio Team Member';
  const roleLabel = actorRole === 'owner' ? 'OWNER' : 'STAFF';
  const visibleNavItems = ADMIN_NAVIGATION_ITEMS.filter(
    (item) => !Array.isArray(item.roles) || item.roles.includes(actorRole),
  );

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          data-testid="admin-mobile-drawer-backdrop"
          className="sa-overlay-backdrop fixed inset-0 z-50 lg:hidden"
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex justify-start lg:hidden">
          <Dialog.Popup
            data-admin-portal-layer="true"
            finalFocus={() => (triggerRef?.current?.isConnected ? triggerRef.current : true)}
            aria-label="Mobile workspace navigation drawer"
            className="flex h-dvh w-[290px] max-w-[86vw] flex-col justify-between overflow-y-auto rounded-r-2xl border-r border-white/10 bg-[#151515] text-[#F1EEE4] shadow-[16px_0_48px_-12px_rgba(21,21,21,0.45)] outline-none"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { x: -24, opacity: 0.85 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
              className="flex min-h-full flex-col justify-between bg-[radial-gradient(240px_220px_at_20%_0%,rgba(200,241,58,0.10),transparent_72%)]"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3.5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C8F13A] font-mono text-sm font-extrabold text-[#151515] shadow-[0_6px_16px_-4px_rgba(200,241,58,0.38)]">
                      37
                    </span>
                    <div className="min-w-0">
                      <Dialog.Title className="truncate text-sm font-bold tracking-tight text-white">
                        37 Music Studio
                      </Dialog.Title>
                      <Dialog.Description className="mt-0.5 truncate font-mono text-[9.5px] font-medium tracking-wider text-[#C8F13A]/90 uppercase">
                        Studio Management
                      </Dialog.Description>
                    </div>
                  </div>

                  <Dialog.Close
                    aria-label="Close navigation drawer"
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-neutral-300 transition-colors hover:border-white/20 hover:bg-white/[0.1] hover:text-[#C8F13A]"
                  >
                    <X className="h-4.5 w-4.5" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                {/* Section Eyebrow */}
                <div className="px-3.5 pt-3 pb-1">
                  <p className="font-mono text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">
                    Menu Utama
                  </p>
                </div>

                {/* Full Eight Navigation Items */}
                <nav aria-label="Mobile admin workspace navigation" className="px-2.5 py-1.5">
                  <ul className="space-y-1">
                    {visibleNavItems.map((item) => (
                      <AdminSidebarNavItem
                        key={item.id}
                        item={item}
                        badge={navBadges[item.id] || ''}
                        isCollapsed={false}
                        onSelect={handleClose}
                        layoutScope="mobile"
                      />
                    ))}
                  </ul>
                </nav>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-white/[0.08] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-[#C8F13A]" aria-hidden="true" />
                      <span className="truncate text-[11.5px] font-semibold text-neutral-100">
                        {displayName}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[#C8F13A]/15 px-2 py-0.5 font-mono text-[9.5px] font-bold text-[#C8F13A]">
                      {roleLabel}
                    </span>
                  </div>
                  <Link
                    to="/"
                    onClick={handleClose}
                    className="mt-2.5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.12] hover:text-[#C8F13A]"
                  >
                    <span>Website Publik</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
