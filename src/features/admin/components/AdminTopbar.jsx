import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '@/features/auth/AuthContext';

function getInitials(displayName = '') {
  const parts = String(displayName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '37';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AdminTopbar({
  activeNavItem,
  isSidebarCollapsed,
  onToggleSidebarCollapse,
  isMobileDrawerOpen,
  onOpenMobileDrawer,
  mobileMenuTriggerRef,
}) {
  const { profile, user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = profile?.displayName || user?.displayName || 'Studio Team Member';
  const email = profile?.email || user?.email || '';
  const roleLabel = (role || profile?.role || 'staff').toUpperCase();
  const isOwner = roleLabel === 'OWNER';
  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await logout();
      navigate('/staff/login', { replace: true });
    } catch {
      // Keep layout intact if network sign-out encounters a transient error
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="border-studio-ink bg-studio-white sticky top-0 z-20 border-b-2">
      <div className="flex min-h-14 items-center justify-between gap-1.5 px-2.5 py-1.5 sm:min-h-[72px] sm:gap-2 sm:px-6 sm:py-2 lg:px-8">
        {/* Left: Mobile Drawer Button / Desktop Sidebar Toggle + Breadcrumb + Dynamic Page Title */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
          {/* Mobile & Tablet Off-Canvas Drawer Trigger */}
          <button
            ref={mobileMenuTriggerRef}
            type="button"
            onClick={onOpenMobileDrawer}
            aria-expanded={isMobileDrawerOpen}
            aria-label="Open navigation drawer"
            className="brutal-btn bg-studio-ivory text-studio-ink inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center sm:h-11 sm:w-11 lg:hidden"
          >
            <Menu className="h-4.5 w-4.5 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>

          {/* Desktop Sidebar Expand / Collapse Quick Control */}
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="brutal-btn bg-studio-ivory text-studio-ink hidden h-11 w-11 shrink-0 cursor-pointer items-center justify-center lg:inline-flex"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Breadcrumb & Active Route Page Title */}
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="hidden sm:block">
              <ol className="text-studio-muted-ink flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
                <li className="truncate">37 Studio</li>
                <li aria-hidden="true">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </li>
                <li aria-current="page" className="text-studio-ink truncate font-extrabold">
                  {activeNavItem.label}
                </li>
              </ol>
            </nav>

            <h1 className="font-display text-studio-ink truncate text-base leading-none font-black tracking-tight uppercase sm:text-2xl">
              {activeNavItem.label}
            </h1>
          </div>
        </div>

        {/* Right: Authenticated User Identity + Role Badge + Public Site Link + Logout */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {/* Authenticated Identity Pill */}
          <div
            aria-label="Authenticated user profile"
            className="sm:border-studio-ink sm:bg-studio-ivory flex items-center gap-2 sm:min-h-11 sm:gap-2.5 sm:border-[1.5px] sm:px-3 sm:py-1.5"
          >
            <span
              aria-hidden="true"
              className="border-studio-ink bg-studio-ink text-studio-lime hidden h-8 w-8 shrink-0 items-center justify-center border font-mono text-xs font-extrabold sm:flex"
            >
              {initials}
            </span>

            <div className="hidden max-w-[160px] min-w-0 flex-col text-left md:flex lg:max-w-[200px]">
              <span className="text-studio-ink truncate text-xs leading-tight font-extrabold">
                {displayName}
              </span>
              {email ? (
                <span className="text-studio-muted-ink truncate font-mono text-[10px] leading-tight">
                  {email}
                </span>
              ) : null}
            </div>

            <span
              className={
                isOwner
                  ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold tracking-wider uppercase sm:px-2 sm:text-[10px]'
                  : 'border-studio-ink bg-studio-orange text-studio-white inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold tracking-wider uppercase sm:px-2 sm:text-[10px]'
              }
            >
              <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{roleLabel}</span>
            </span>
          </div>

          {/* Public Website Secondary Shortcut */}
          <Link
            to="/"
            aria-label="Open public website"
            className="brutal-btn bg-studio-white text-studio-ink hidden min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-extrabold tracking-wider uppercase xl:inline-flex"
          >
            <span>Public Site</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Sign out of studio session"
            title="Sign Out"
            className="brutal-btn bg-studio-orange text-studio-white inline-flex h-9 w-9 cursor-pointer items-center justify-center gap-1.5 text-xs font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:min-h-11 sm:w-auto sm:px-4 sm:py-2"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
