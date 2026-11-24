import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';

import { ClientMobileDrawer } from '../components/ClientMobileDrawer';
import { ClientPortalFooter } from '../components/ClientPortalFooter';
import { ClientSidebar } from '../components/ClientSidebar';
import { ClientTopbar } from '../components/ClientTopbar';
import { getClientNavItemByPath } from '../navigation/client-navigation';

export function ClientPortalLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const activeNavItem = getClientNavItemByPath(location.pathname);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div
      data-client-portal="true"
      data-testid="client-portal-shell"
      className="sa-canvas flex min-h-screen w-full text-[#151515]"
    >
      {/* Keyboard Skip Link */}
      <a
        href="#client-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:border focus:border-[#151515]/15 focus:bg-[#C8F13A] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#151515] focus:shadow-lg"
      >
        Skip to workspace content
      </a>

      {/* Persistent Desktop Sidebar (1024px+) */}
      <ClientSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Off-Canvas Mobile & Tablet Navigation Drawer (<1024px) */}
      <ClientMobileDrawer
        open={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        triggerRef={mobileMenuTriggerRef}
      />

      {/* Main Workspace Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ClientTopbar
          activeNavItem={activeNavItem}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          mobileMenuTriggerRef={mobileMenuTriggerRef}
        />

        <main
          id="client-main-content"
          className="w-full flex-1 px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4 sm:pb-5 xl:px-7"
        >
          <motion.div
            key={location.pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mx-auto w-full max-w-[1560px]"
          >
            <Outlet />
          </motion.div>
        </main>

        <ClientPortalFooter />
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

export default ClientPortalLayout;
