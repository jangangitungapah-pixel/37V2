import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

function getInitials(displayName = '') {
  const parts = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '37';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ClientTopbar({
  activeNavItem,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  isMobileDrawerOpen,
  onOpenMobileDrawer,
  mobileMenuTriggerRef,
}) {
  const { user, clientAccount, clientProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState('');

  const displayName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || 'Client';
  const email =
    clientAccount?.emailNormalized || clientProfile?.emailNormalized || user?.email || '';
  const photoURL = clientProfile?.photoURL || clientAccount?.photoURL || user?.photoURL || '';
  const initials = getInitials(displayName);
  const showAvatarImage = Boolean(photoURL && failedPhotoUrl !== photoURL);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await logout();
      navigate(CLIENT_PORTAL_ROUTES.LOGIN, { replace: true });
    } catch {
      toast.error('Gagal keluar dari sesi saat ini. Silakan coba lagi.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sa-topbar sticky top-0 z-20">
      <div className="mx-auto flex min-h-[52px] w-full max-w-[1440px] items-center justify-between gap-1.5 px-2.5 py-1.5 sm:min-h-[60px] sm:gap-2.5 sm:px-6 sm:py-2.5 lg:px-8">
        {/* Left: Mobile Drawer Button / Desktop Sidebar Toggle + Breadcrumb + Dynamic Page Title */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
          {/* Mobile & Tablet Off-Canvas Drawer Trigger */}
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={onOpenMobileDrawer}
            aria-expanded={isMobileDrawerOpen}
            aria-label="Open navigation drawer"
            className="sa-control sa-btn-secondary inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center sm:h-10 sm:w-10 lg:hidden"
          >
            <Menu className="h-4.5 w-4.5 text-[#151515]" aria-hidden="true" />
          </button>

          {/* Desktop Sidebar Expand / Collapse Quick Control */}
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="sa-control sa-btn-secondary hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center lg:inline-flex"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
            )}
          </button>

          {/* Breadcrumb & Active Route Page Title */}
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="hidden sm:block">
              <ol className="flex items-center gap-1 text-[11px] font-medium text-[#666159]">
                <li className="truncate">37 Studio</li>
                <li aria-hidden="true">
                  <ChevronRight className="h-3 w-3 shrink-0 text-[#8B857B]" />
                </li>
                <li aria-current="page" className="truncate font-semibold text-[#151515]">
                  {activeNavItem.label}
                </li>
              </ol>
            </nav>

            <h1 className="truncate text-base font-bold tracking-[-0.02em] text-[#151515] sm:text-xl sm:leading-tight">
              {activeNavItem.label}
            </h1>
          </div>
        </div>

        {/* Right: Authenticated Client Identity + Client Badge + Public Site Link + Logout */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          {/* Authenticated Client Identity Pill */}
          <div
            aria-label="Authenticated client profile"
            className="flex items-center gap-2 sm:rounded-full sm:border sm:border-[#151515]/[0.08] sm:bg-white/85 sm:py-1 sm:pr-2 sm:pl-1.5 sm:shadow-[0_1px_2px_rgba(21,21,21,0.03)]"
          >
            {showAvatarImage ? (
              <img
                src={photoURL}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setFailedPhotoUrl(photoURL)}
                className="h-7.5 w-7.5 shrink-0 rounded-full object-cover ring-1 ring-[#151515]/10"
              />
            ) : (
              <span
                aria-hidden="true"
                data-testid="client-topbar-avatar-initials"
                className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-[#151515] font-mono text-[11px] font-bold text-[#C8F13A]"
              >
                {initials}
              </span>
            )}

            <div className="hidden max-w-[150px] min-w-0 flex-col text-left md:flex lg:max-w-[190px]">
              <span className="truncate text-xs leading-tight font-semibold text-[#151515]">
                {displayName}
              </span>
              {email ? (
                <span className="truncate font-mono text-[10px] leading-tight text-[#666159]">
                  {email}
                </span>
              ) : null}
            </div>

            <span className="inline-flex items-center gap-1 rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide text-[#243300] uppercase sm:px-2.5 sm:py-1">
              <UserCheck className="hidden h-3 w-3 shrink-0 sm:block" aria-hidden="true" />
              <span>CLIENT</span>
            </span>
          </div>

          {/* Public Website Secondary Shortcut */}
          <Link
            to="/"
            aria-label="Open public website"
            className="sa-control sa-btn-secondary hidden min-h-9.5 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#151515] xl:inline-flex"
          >
            <span>Public Site</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
          </Link>

          {/* Sign Out Action */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Sign out of client portal"
            title="Sign Out"
            className="sa-control inline-flex h-9.5 w-9.5 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[#FF4B22]/25 bg-[#FFEDE8]/90 text-xs font-semibold text-[#B92B0C] transition-colors hover:border-[#FF4B22] hover:bg-[#FF4B22] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:h-9.5 sm:w-auto sm:px-3.5 sm:py-1.5"
          >
            {isSigningOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
