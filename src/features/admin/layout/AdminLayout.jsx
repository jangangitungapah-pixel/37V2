import { useContext, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Lock, RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link, Outlet, useLocation } from 'react-router';
import { Toaster } from 'sonner';

import { BookingRequestAlertsProvider } from '@/features/admin/booking-requests/context/BookingRequestAlertsContext';
import { useBookingRequestAlerts } from '@/features/admin/booking-requests/hooks/useBookingRequestAlerts';
import { useFactoryResetStatus } from '@/features/admin/settings/danger-area/hooks/useFactoryReset';
import { AuthContext } from '@/features/auth/AuthContext';
import { OwnerPublicAvailabilitySyncContext } from '@/features/public-availability/context/OwnerPublicAvailabilitySyncContext';
import { useOwnerPublicAvailabilityAutoSync } from '@/features/public-availability/hooks/useOwnerPublicAvailabilityAutoSync';
import { OwnerPublicPricingSyncContext } from '@/features/public-pricing/context/OwnerPublicPricingSyncContext';
import { useOwnerPublicPricingAutoSync } from '@/features/public-pricing/hooks/useOwnerPublicPricingAutoSync';

import { AdminMobileBottomNav } from '../components/AdminMobileBottomNav';
import { AdminMobileDrawer } from '../components/AdminMobileDrawer';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminTopbar } from '../components/AdminTopbar';
import { getAdminNavItemByPath } from '../navigation/admin-navigation';

function AdminLayoutShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const mobileMenuTriggerRef = useRef(null);
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const auth = useContext(AuthContext);
  const isActiveOwner = Boolean(
    auth?.profile &&
    auth.profile.active === true &&
    auth.role === 'owner' &&
    auth.profile.role === 'owner',
  );
  const { isLocked: isFactoryResetLocked, operation: activeResetOp } = useFactoryResetStatus({
    enabled: isActiveOwner,
  });

  const ownerPricingSync = useOwnerPublicPricingAutoSync({
    enabled: isActiveOwner && !isFactoryResetLocked,
    actorUid: auth?.user?.uid || auth?.profile?.uid || '',
    actorRole: auth?.role || auth?.profile?.role || '',
  });

  const ownerAvailabilitySync = useOwnerPublicAvailabilityAutoSync({
    enabled: isActiveOwner && !isFactoryResetLocked,
    actorUid: auth?.user?.uid || auth?.profile?.uid || '',
    actorRole: auth?.role || auth?.profile?.role || '',
  });

  const { badgeLabel } = useBookingRequestAlerts();
  const navBadges = {
    'booking-requests': badgeLabel,
  };

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
        navBadges={navBadges}
      />

      {/* Off-Canvas Mobile & Tablet Navigation Drawer (<1024px) */}
      <AdminMobileDrawer
        open={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        triggerRef={mobileMenuTriggerRef}
        navBadges={navBadges}
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
          className="w-full flex-1 px-3 pt-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-7"
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
            {isActiveOwner &&
            isFactoryResetLocked &&
            location.pathname !== '/admin/settings/danger-area' ? (
              <div
                role="status"
                data-testid="admin-factory-reset-maintenance-banner"
                className="mb-4 flex flex-col items-start justify-between gap-2.5 rounded-2xl border border-red-300 bg-red-50 p-3 text-xs text-red-950 sm:flex-row sm:items-center sm:px-4 sm:py-2.5"
              >
                <span className="inline-flex items-start gap-2 font-medium sm:items-center">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-700 sm:mt-0" aria-hidden="true" />
                  <span>
                    <strong>Maintenance Mode Aktif:</strong> Factory Reset (
                    {activeResetOp?.operationId}) berstatus <strong>{activeResetOp?.status}</strong>
                    . Penambahan &amp; perubahan data operasional dikunci sementara.
                  </span>
                </span>
                <Link
                  to="/admin/settings/danger-area"
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-red-300 bg-white px-3 py-1.5 font-bold text-red-800 hover:text-red-950 sm:min-h-0 sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:underline"
                >
                  Buka Danger Area →
                </Link>
              </div>
            ) : null}
            {isActiveOwner &&
            ownerPricingSync.syncError &&
            location.pathname !== '/admin/settings/price-and-fee' ? (
              <div
                role="alert"
                data-testid="admin-public-pricing-sync-error-banner"
                className="mb-4 flex flex-col items-start justify-between gap-2.5 rounded-2xl border border-[#FF4B22]/30 bg-[#FFEDE8] p-3 text-xs text-[#8C2B14] sm:flex-row sm:items-center sm:px-4 sm:py-2.5"
              >
                <span className="inline-flex items-start gap-2 font-medium sm:items-center">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#B92B0C] sm:mt-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Public Pricing Catalog gagal disinkronkan:</strong>{' '}
                    {ownerPricingSync.syncError}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={ownerPricingSync.isSyncing}
                  onClick={ownerPricingSync.triggerSync}
                  className="sa-control inline-flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#151515] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2926] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:w-auto sm:py-1"
                >
                  {ownerPricingSync.isSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Sync Public Catalog</span>
                </button>
              </div>
            ) : null}

            {isActiveOwner &&
            ownerAvailabilitySync.syncError &&
            location.pathname !== '/admin/calendar' ? (
              <div
                role="alert"
                data-testid="admin-public-availability-sync-error-banner"
                className="mb-4 flex flex-col items-start justify-between gap-2.5 rounded-2xl border border-[#FF4B22]/30 bg-[#FFEDE8] p-3 text-xs text-[#8C2B14] sm:flex-row sm:items-center sm:px-4 sm:py-2.5"
              >
                <span className="inline-flex items-start gap-2 font-medium sm:items-center">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#B92B0C] sm:mt-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Kalender Publik (/availability) gagal disinkronkan:</strong>{' '}
                    {ownerAvailabilitySync.syncError}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={ownerAvailabilitySync.isSyncing}
                  onClick={() => void ownerAvailabilitySync.triggerSync()}
                  className="sa-control inline-flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#151515] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2a2926] disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:w-auto sm:py-1"
                >
                  {ownerAvailabilitySync.isSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>Coba Sinkronkan</span>
                </button>
              </div>
            ) : null}

            <OwnerPublicAvailabilitySyncContext.Provider value={ownerAvailabilitySync}>
              <OwnerPublicPricingSyncContext.Provider value={ownerPricingSync}>
                <Outlet />
              </OwnerPublicPricingSyncContext.Provider>
            </OwnerPublicAvailabilitySyncContext.Provider>
          </motion.div>
        </main>

        <footer className="hidden border-t border-[#151515]/[0.07] bg-white/35 px-3 py-3 backdrop-blur-xs sm:px-6 sm:py-3.5 lg:block lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-1 text-[11px] text-[#666159] sm:flex-row sm:items-center">
            <p>© 2026 37 Music Studio • Studio Management Workspace</p>
            <p className="font-mono text-[10.5px] text-[#8B857B]">Owner &amp; Staff Portal</p>
          </div>
        </footer>
      </div>

      <AdminMobileBottomNav
        isMobileDrawerOpen={isMobileDrawerOpen}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        navBadges={navBadges}
      />

      <Toaster
        position="bottom-right"
        mobileOffset={{ bottom: '80px', left: '12px', right: '12px' }}
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

export function AdminLayout() {
  return (
    <BookingRequestAlertsProvider>
      <AdminLayoutShell />
    </BookingRequestAlertsProvider>
  );
}

export default AdminLayout;
