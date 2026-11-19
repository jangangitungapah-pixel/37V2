import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';

import { AdminMobileDrawer } from '../components/AdminMobileDrawer';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminTopbar } from '../components/AdminTopbar';
import { getAdminNavItemByPath } from '../navigation/admin-navigation';

export function AdminLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const activeNavItem = getAdminNavItemByPath(location.pathname);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen w-full">
      {/* Keyboard Skip Link */}
      <a
        href="#admin-main-content"
        className="border-studio-ink bg-studio-lime text-studio-ink sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:border-2 focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-extrabold focus:uppercase"
      >
        Skip to workspace content
      </a>

      {/* Persistent Desktop Sidebar (1024px+) */}
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Off-Canvas Mobile & Tablet Navigation Drawer (<1024px) */}
      <AdminMobileDrawer
        open={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        triggerRef={mobileMenuTriggerRef}
      />

      {/* Main Workspace Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          activeNavItem={activeNavItem}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />

        <main id="admin-main-content" className="w-full flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
          <motion.div
            key={location.pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="border-studio-ink bg-studio-ivory border-t px-3 py-3.5 sm:px-6 lg:px-8">
          <div className="flex w-full flex-col items-start justify-between gap-1 font-mono text-[11px] text-neutral-600 sm:flex-row sm:items-center">
            <p>© 2026 37 Music Studio • Internal Administration Workspace</p>
            <p>Phase 4 Admin Shell &amp; Navigation Foundation</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default AdminLayout;
