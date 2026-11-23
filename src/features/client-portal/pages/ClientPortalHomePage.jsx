import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock3,
  MapPin,
  ReceiptText,
  RefreshCw,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';
import { useClientBookings } from '../hooks/useClientBookings';

const QUICK_ACCESS_CARDS = [
  {
    id: 'book',
    title: 'Book a Session',
    description: 'Reserve studio rehearsal, recording, or request Mix & Master sessions.',
    href: CLIENT_PORTAL_ROUTES.BOOK,
    icon: CalendarPlus,
    iconBg: 'bg-[#FFEDE8] text-[#B92B0C]',
  },
  {
    id: 'bookings',
    title: 'My Bookings',
    description: 'Track upcoming studio dates, active requests, and past sessions.',
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

export function ClientPortalHomePage({ now } = {}) {
  const { user, clientAccount, clientProfile } = useAuth();
  const { counts, nextSession, recentActivity, isLoading, error, retry } = useClientBookings({
    now,
  });

  const displayName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || 'Client';

  const nextSchedule = nextSession?._view?.schedule || null;
  const nextStatusMeta = nextSession?._view?.statusMeta || null;

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
          <span className="font-mono text-[10.5px] text-[#8B857B]">
            {error ? 'Unavailable' : isLoading ? 'Loading...' : 'Live updates'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminMetricCard
            label="Upcoming Sessions"
            value={isLoading || error ? '—' : String(counts.upcoming)}
            hint={
              counts.upcoming > 0
                ? 'Confirmed studio reservations ahead'
                : 'No confirmed sessions scheduled yet'
            }
            icon={CalendarCheck2}
            tone="lime"
          />
          <AdminMetricCard
            label="Active Booking Requests"
            value={isLoading || error ? '—' : String(counts.requests)}
            hint={
              counts.requests > 0
                ? 'In progress with our studio desk'
                : 'No pending studio inquiries'
            }
            icon={Clock3}
            tone="orange"
          />
          <AdminMetricCard
            label="Outstanding Balance"
            value="—"
            hint="Online billing & invoices coming soon"
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
        <AdminSurface
          as="section"
          variant="card"
          data-testid="client-overview-next-session"
          className="p-4 sm:p-5 xl:col-span-7"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Next Session</h3>
              <p className="text-xs text-[#666159]">Your nearest confirmed studio reservation</p>
            </div>
            {isLoading ? (
              <AdminStatusBadge tone="ivory">Loading...</AdminStatusBadge>
            ) : error ? (
              <AdminStatusBadge tone="danger">Unavailable</AdminStatusBadge>
            ) : nextStatusMeta ? (
              <AdminStatusBadge tone={nextStatusMeta.tone} dot>
                {nextStatusMeta.label}
              </AdminStatusBadge>
            ) : counts.requests > 0 ? (
              <AdminStatusBadge tone="orange" dot>
                Pending Review
              </AdminStatusBadge>
            ) : (
              <AdminStatusBadge tone="neutral">No Session Scheduled</AdminStatusBadge>
            )}
          </div>

          {isLoading ? (
            <div className="h-28 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]" />
          ) : error ? (
            <AdminEmptyState
              icon={CalendarClock}
              tone="orange"
              title="Unable to load next session"
              description={error}
              action={
                <button
                  type="button"
                  onClick={retry}
                  className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Try Again</span>
                </button>
              }
            />
          ) : nextSession && nextSchedule ? (
            <div className="sa-panel-ivory space-y-3 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#151515] sm:text-base">
                    {nextSchedule.serviceOptionName
                      ? `${nextSchedule.serviceTypeName} · ${nextSchedule.serviceOptionName}`
                      : nextSchedule.serviceTypeName}
                  </h4>
                  {nextSession.bandName ? (
                    <p className="mt-0.5 text-xs font-medium text-[#46433D]">
                      {nextSession.bandName}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {nextSchedule.bookingReference ? (
                    <span className="rounded-lg bg-[#151515] px-2 py-0.5 font-mono text-[11px] font-bold text-[#C8F13A]">
                      {nextSchedule.bookingReference}
                    </span>
                  ) : null}
                  <span className="rounded-lg border border-[#151515]/12 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#46433D]">
                    {nextSession.requestReference}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                <div className="flex items-center gap-2 font-semibold text-[#151515]">
                  <CalendarDays className="h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
                  <span>{formatIndonesianDateFull(nextSchedule.date)}</span>
                </div>
                <div className="flex items-center gap-2 font-mono font-semibold text-[#151515]">
                  <Clock3 className="h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
                  <span>
                    {formatMinuteRange(nextSchedule.startMinute, nextSchedule.endMinute)} (
                    {formatDurationMinutes(nextSchedule.durationMinutes)})
                  </span>
                </div>
                <div className="flex items-center gap-2 font-semibold text-[#151515]">
                  <MapPin className="h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
                  <span>{nextSchedule.studioName}</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#151515] underline hover:text-[#FF4B22]"
                >
                  <span>View in My Bookings</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : counts.requests > 0 ? (
            <AdminEmptyState
              icon={Clock3}
              tone="orange"
              title="Booking request awaiting confirmation"
              description={`You have ${counts.requests} active ${counts.requests === 1 ? 'request' : 'requests'} under review by our studio desk. Once confirmed, your room & time slot will appear here.`}
              action={
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="sa-btn-secondary inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <span>Track in My Bookings</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <AdminEmptyState
              icon={CalendarClock}
              tone="lime"
              title="No upcoming session scheduled"
              description="Ready to rehearse or record? Pick your service and preferred time slot to send a session request."
              action={
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOK}
                  className="sa-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <span>Book a Session</span>
                </Link>
              }
            />
          )}
        </AdminSurface>

        <AdminSurface
          as="section"
          variant="card"
          data-testid="client-overview-recent-activity"
          className="p-4 sm:p-5 xl:col-span-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#151515] sm:text-base">Recent Activity</h3>
              <p className="text-xs text-[#666159]">Account and booking updates timeline</p>
            </div>
            <AdminStatusBadge
              tone={
                error
                  ? 'danger'
                  : isLoading
                    ? 'ivory'
                    : recentActivity.length > 0
                      ? 'lime'
                      : 'neutral'
              }
              dot={!isLoading && !error && recentActivity.length > 0}
            >
              {error
                ? 'Unavailable'
                : isLoading
                  ? 'Loading...'
                  : recentActivity.length > 0
                    ? 'Live'
                    : 'Ready'}
            </AdminStatusBadge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1].map((slot) => (
                <div
                  key={slot}
                  className="h-14 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]"
                />
              ))}
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-2.5">
              <ul className="space-y-2">
                {recentActivity.map((act) => {
                  const tsLabel = formatIndonesianTimestamp(act.timestampValue);
                  return (
                    <li
                      key={act.id}
                      className="sa-panel-ivory flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#151515]">{act.title}</span>
                        <AdminStatusBadge tone={act.statusMeta.tone} size="sm">
                          {act.statusMeta.label}
                        </AdminStatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#666159]">
                        <span className="truncate">{act.subtitle}</span>
                        <span className="font-mono font-semibold text-[#46433D]">
                          {act.bookingReference || act.requestReference}
                        </span>
                      </div>
                      {tsLabel !== '-' ? (
                        <p className="font-mono text-[10px] text-[#8B857B]">{tsLabel}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="flex justify-end pt-1">
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#151515] underline hover:text-[#FF4B22]"
                >
                  <span>View all in My Bookings</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <AdminEmptyState
              icon={Activity}
              tone="neutral"
              title="No recent studio activity"
              description="Booking requests and studio confirmations appear here automatically as you reserve sessions."
            />
          )}
        </AdminSurface>
      </div>
    </div>
  );
}

export default ClientPortalHomePage;
