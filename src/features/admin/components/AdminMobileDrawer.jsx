import { Dialog } from '@base-ui/react/dialog';
import { ShieldCheck, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { ADMIN_NAVIGATION_ITEMS } from '../navigation/admin-navigation';
import { AdminSidebarNavItem } from './AdminSidebarNavItem';

export function AdminMobileDrawer({ open, onOpenChange, triggerRef }) {
  const prefersReducedMotion = useReducedMotion();

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-testid="admin-mobile-drawer-backdrop"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] lg:hidden"
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex justify-start lg:hidden">
          <Dialog.Popup
            finalFocus={() => (triggerRef?.current?.isConnected ? triggerRef.current : true)}
            aria-label="Mobile workspace navigation drawer"
            className="border-studio-ink bg-studio-ink text-studio-ivory flex h-full w-[280px] max-w-[86vw] flex-col justify-between overflow-y-auto border-r-2 shadow-[6px_0px_0px_#151515] outline-none"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { x: -24, opacity: 0.85 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
              className="flex min-h-full flex-col justify-between"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="border-studio-ivory bg-studio-lime text-studio-ink flex h-9 w-9 shrink-0 items-center justify-center border-2 font-mono text-sm font-extrabold">
                      37
                    </span>
                    <div className="min-w-0">
                      <Dialog.Title className="font-display truncate text-lg leading-none font-black tracking-tight text-white uppercase">
                        37 MUSIC STUDIO
                      </Dialog.Title>
                      <Dialog.Description className="text-studio-lime mt-0.5 truncate font-mono text-[9px] font-bold tracking-widest uppercase">
                        STUDIO MANAGEMENT
                      </Dialog.Description>
                    </div>
                  </div>

                  <Dialog.Close
                    aria-label="Close navigation drawer"
                    className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-neutral-200 transition-colors"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                {/* Section Eyebrow */}
                <div className="px-4 pt-4 pb-1.5">
                  <p className="font-mono text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
                    MENU UTAMA (08)
                  </p>
                </div>

                {/* Full Eight Navigation Items */}
                <nav aria-label="Mobile admin workspace navigation" className="px-3 py-2">
                  <ul className="space-y-1">
                    {ADMIN_NAVIGATION_ITEMS.map((item) => (
                      <AdminSidebarNavItem
                        key={item.id}
                        item={item}
                        isCollapsed={false}
                        onSelect={handleClose}
                        layoutScope="mobile"
                      />
                    ))}
                  </ul>
                </nav>
              </div>

              {/* Drawer Footer */}
              <div className="border-t border-neutral-800 p-4">
                <div className="border border-neutral-800 bg-neutral-900/90 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="text-studio-lime h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-mono text-[10px] font-bold tracking-wider text-neutral-200 uppercase">
                      37 STUDIO • ADMIN
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-neutral-400">
                    Akses Owner &amp; Staff studio
                  </p>
                </div>
              </div>
            </motion.div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
