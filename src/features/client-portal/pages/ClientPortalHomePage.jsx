import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock3,
  ReceiptText,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

const QUICK_ACCESS_CARDS = [
  {
    id: 'book',
    title: 'Book a Session',
    description: 'Preview studio rehearsal, recording, and post-production sessions.',
    href: CLIENT_PORTAL_ROUTES.BOOK,
    icon: CalendarPlus,
    iconBg: 'bg-[#FFEDE8] text-[#B92B0C]',
  },
  {
    id: 'bookings',
    title: 'My Bookings',
    description: 'Track upcoming studio dates, requests, and past sessions.',
    href: CLIENT_PORTAL_ROUTES.BOOKINGS,
    icon: CalendarDays,
    iconBg: 'bg-[#EDF8C2] text-[#243300]',
  },
  {
    id: 'invoices',
    title: 'Invoices & Payments',
    description: 'Review studio invoices, paid balances, and payment records.',
    href: CLIENT_PORTAL_ROUTES.INVOICES,
    icon: ReceiptText,
    iconBg: 'bg-[#F4F1E8] text-[#46433D]',
  },
  {
    id: 'profile',
    title: 'My Profile',
    description: 'Inspect your Google sign-in details and studio profile status.',
    href: CLIENT_PORTAL_ROUTES.PROFILE,
    icon: UserRound,
    iconBg: 'bg-[#E6F6EC] text-[#0F6246]',
  },
];

export function ClientPortalHomePage() {
  const { user, clientAccount, clientProfile } = useAuth();

  const displayName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || 'Client';

  return (
    <div data-testid="client-portal-home" className="space-y-4 sm:space-y-5">
      {/* A. Welcome Hero */}
      <AdminPageHeader
        eyebrow="YOUR STUDIO WORKSPACE"
        titleId="client-overview-heading"
        title={`Welcome back, ${displayName}`}
        description="All your studio sessions, bookings, and account activity — in one place."
        keepDescriptionOnMobile
        meta={
          <AdminStatusBadge tone="lime" dot>
            Active Client
          </AdminStatusBadge>
        }
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-2.5">
            <Link
              to={CLIENT_PORTAL_ROUTES.BOOK}
              className="sa-btn-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Book a Session</span>
            </Link>
            <Link
              to={CLIENT_PORTAL_ROUTES.BOOKINGS}
              className="sa-btn-secondary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>View My Bookings</span>
            </Link>
          </div>
        }
      />

      {/* D. Account Snapshot */}
      <section aria-labelledby="client-account-snapshot-heading" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h3
            id="client-account-snapshot-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Account Snapshot
          </h3>
          <span className="font-mono text-[10.5px] text-[#8B857B]">Awaiting module sync</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminMetricCard
            label="Upcoming Sessions"
            value="—"
            hint="Scheduled sessions will sync here"
            icon={CalendarCheck2}
            tone="lime"
          />
          <AdminMetricCard
            label="Active Booking Requests"
            value="—"
            hint="Submitted studio inquiries appear here"
            icon={Clock3}
            tone="orange"
          />
          <AdminMetricCard
            label="Outstanding Balance"
            value="—"
            hint="Billing summary arrives in a future update"
            icon={Wallet}
            tone="neutral"
          />
        </div>
      </section>

      {/* B. Quick Access */}
      <section aria-labelledby="client-quick-access-heading" className="space-y-2.5">
        <div className="px-0.5">
          <h3
            id="client-quick-access-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Quick Access
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACCESS_CARDS.map((card) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.id}
                to={card.href}
                className="sa-card group flex flex-col justify-between gap-3 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#151515]/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}
                  >
                    <CardIcon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-[#8B857B] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#FF4B22]"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#151515]">{card.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-[#666159]">{card.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* C. Next Session & E. Recent Activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <AdminSurface as="section" variant="card" className="p-4 sm:p-5 xl:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Next Session</h3>
              <p className="text-xs text-[#666159]">Your nearest confirmed studio reservation</p>
            </div>
            <AdminStatusBadge tone="ivory">Schedule Integration Pending</AdminStatusBadge>
          </div>

          <AdminEmptyState
            icon={CalendarClock}
            tone="lime"
            title="No session feed connected yet"
            description="Your upcoming studio session dates, room assignment, and check-in timing will appear here once Client Booking integration is active."
          />
        </AdminSurface>

        <AdminSurface as="section" variant="card" className="p-4 sm:p-5 xl:col-span-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Recent Activity</h3>
              <p className="text-xs text-[#666159]">Account and booking updates timeline</p>
            </div>
            <AdminStatusBadge tone="neutral">Ready</AdminStatusBadge>
          </div>

          <AdminEmptyState
            icon={Activity}
            tone="neutral"
            title="No recent studio activity"
            description="Booking confirmations, invoice updates, and studio announcements will be recorded here as portal modules launch."
          />
        </AdminSurface>
      </div>
    </div>
  );
}

export default ClientPortalHomePage;
