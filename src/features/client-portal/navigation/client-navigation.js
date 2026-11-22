import { CalendarDays, CalendarPlus, LayoutDashboard, ReceiptText, UserRound } from 'lucide-react';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

/**
 * Central navigation and route configuration for the 37 Music Studio Client Portal.
 * Single source of truth for sidebar/drawer navigation, topbar breadcrumb, page title,
 * and header metadata across all Client Portal routes.
 *
 * Menu order:
 * 01. Overview
 * 02. Book a Session
 * 03. My Bookings
 * 04. Invoices & Payments
 * 05. My Profile
 */
export const CLIENT_NAVIGATION_ITEMS = [
  {
    id: 'overview',
    order: '01',
    label: 'Overview',
    path: '',
    href: CLIENT_PORTAL_ROUTES.HOME,
    exact: true,
    icon: LayoutDashboard,
    eyebrow: 'YOUR STUDIO WORKSPACE',
    summary: 'All your studio sessions, bookings, and account activity — in one place.',
  },
  {
    id: 'book',
    order: '02',
    label: 'Book a Session',
    path: 'book',
    href: CLIENT_PORTAL_ROUTES.BOOK,
    exact: false,
    icon: CalendarPlus,
    eyebrow: 'STUDIO RESERVATION',
    summary: 'Choose the right studio experience for your next creative session.',
  },
  {
    id: 'bookings',
    order: '03',
    label: 'My Bookings',
    path: 'bookings',
    href: CLIENT_PORTAL_ROUTES.BOOKINGS,
    exact: false,
    icon: CalendarDays,
    eyebrow: 'SESSION HISTORY',
    summary: 'Keep track of your upcoming studio sessions and booking history.',
  },
  {
    id: 'invoices',
    order: '04',
    label: 'Invoices & Payments',
    path: 'invoices',
    href: CLIENT_PORTAL_ROUTES.INVOICES,
    exact: false,
    icon: ReceiptText,
    eyebrow: 'BILLING WORKSPACE',
    summary: 'View your studio invoices and keep track of your payments.',
  },
  {
    id: 'profile',
    order: '05',
    label: 'My Profile',
    path: 'profile',
    href: CLIENT_PORTAL_ROUTES.PROFILE,
    exact: false,
    icon: UserRound,
    eyebrow: 'PERSONAL ACCOUNT',
    summary: 'Your account details and personal studio identity.',
  },
];

export const CLIENT_NOT_FOUND_NAV_ITEM = {
  id: 'not-found',
  order: '',
  label: 'Page Not Found',
  path: '*',
  href: null,
  exact: false,
  icon: LayoutDashboard,
  eyebrow: 'CLIENT PORTAL',
  summary: 'The page you are looking for is not available in Client Portal.',
};

export function getClientNavItemByPath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/';

  const subPageMatch = CLIENT_NAVIGATION_ITEMS.find(
    (item) => !item.exact && (normalized === item.href || normalized.startsWith(`${item.href}/`)),
  );
  if (subPageMatch) {
    return subPageMatch;
  }

  if (normalized === CLIENT_PORTAL_ROUTES.HOME) {
    return CLIENT_NAVIGATION_ITEMS[0];
  }

  return CLIENT_NOT_FOUND_NAV_ITEM;
}
