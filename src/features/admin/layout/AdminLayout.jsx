import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';

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
    <div data-admin-portal="true" className="sa-canvas flex min-h-screen w-full text-[#151515]">
      {/* Keyboard Skip Link */}
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:border focus:border-[#151515]/15 focus:bg-[#C8F13A] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#151515] focus:shadow-lg"
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

        <main
          id="admin-main-content"
          className="w-full flex-1 px-2.5 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
        >
          <motion.div
            key={location.pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mx-auto w-full max-w-[1440px]"
          >
            <Outlet />
          </motion.div>
        </main>

        <footer className="hidden border-t border-[#151515]/[0.07] bg-white/35 px-3 py-3 backdrop-blur-xs sm:block sm:px-6 sm:py-3.5 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-1 text-[11px] text-[#666159] sm:flex-row sm:items-center">
            <p>© 2026 37 Music Studio • Studio Management Workspace</p>
            <p className="font-mono text-[10.5px] text-[#8B857B]">Owner &amp; Staff Portal</p>
          </div>
        </footer>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#151515',
            border: '1px solid rgba(21, 21, 21, 0.09)',
            borderRadius: '14px',
            boxShadow: '0 18px 40px -12px rgba(21, 21, 21, 0.18)',
          },
        }}
      />
    </div>
  );
}

export default AdminLayout;
