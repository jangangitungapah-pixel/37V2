import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
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

import { useClientInvoices } from '../billing/hooks/useClientInvoices';
import { formatClientRupiah } from '../billing/utils/client-billing-utils';
import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';
import { useClientBookings } from '../hooks/useClientBookings';

const QUICK_ACCESS_CARDS = [
  {
    id: 'book',
    title: 'Book a Session',
    description: 'Request a rehearsal, recording session, or Mix & Master project.',
    href: CLIENT_PORTAL_ROUTES.BOOK,
    icon: CalendarPlus,
    iconBg: 'bg-[#FFEDE8] text-[#B92B0C]',
  },
  {
    id: 'bookings',
    title: 'My Bookings',
    description: 'Check confirmed studio schedules, pending requests, and past sessions.',
    href: CLIENT_PORTAL_ROUTES.BOOKINGS,
    icon: CalendarDays,
    iconBg: 'bg-[#EDF8C2] text-[#243300]',
  },
  {
    id: 'invoices',
    title: 'Invoices & Payments',
    description: 'View active invoices, upload payment proof, and check payment status.',
    href: CLIENT_PORTAL_ROUTES.INVOICES,
    icon: ReceiptText,
    iconBg: 'bg-[#F4F1E8] text-[#46433D]',
  },
  {
    id: 'profile',
    title: 'My Profile',
    description: 'View your connected Google account and studio contact details.',
    href: CLIENT_PORTAL_ROUTES.PROFILE,
    icon: UserRound,
    iconBg: 'bg-[#E6F6EC] text-[#0F6246]',
  },
];

const METRIC_LINK_CLASS =
  'group flex h-full min-h-11 flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-[#151515]/22 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#C8F13A]/55 active:scale-[0.99]';

function formatOverviewBillingError(rawError) {
  const message = String(rawError || '').trim();
  if (!message) {
    return 'Unable to load your billing information right now. Please try again.';
  }
  return message.replace(/billing ledger/gi, 'billing information');
}

function MetricValueSkeleton({ testId, label, widthClass = 'w-14' }) {
  return (
    <span
      data-testid={testId}
      aria-label={label}
      className={`inline-block h-6 ${widthClass} animate-pulse rounded-lg bg-[#151515]/10 align-middle`}
    />
  );
}

export function ClientPortalHomePage({
  now,
  customBookingAdapter = null,
  customBillingAdapter = null,
  billingInitialLimit,
} = {}) {
  const { user, clientAccount, clientProfile } = useAuth();
  const {
    counts,
    nextSession,
    recentActivity,
    isLoading: isBookingsLoading,
    isTruncated: isBookingsTruncated,
    error: bookingsError,
    retry: retryBookings,
  } = useClientBookings({
    now,
    customAdapter: customBookingAdapter,
  });

  const {
    invoices,
    metrics: billingMetrics,
    isLoading: isBillingLoading,
    hasMore: hasMoreInvoices,
    isTruncated: isBillingTruncated,
    error: billingError,
    retry: retryBilling,
    loadMore: loadMoreInvoices,
  } = useClientInvoices({
    now,
    customAdapter: customBillingAdapter,
    ...(billingInitialLimit ? { initialLimit: billingInitialLimit } : {}),
  });

  const displayName =
    clientProfile?.displayName || clientAccount?.displayName || user?.displayName || 'Client';

  const nextSchedule = nextSession?._view?.schedule || null;
  const nextStatusMeta = nextSession?._view?.statusMeta || null;
  const isBillingPartial = Boolean(isBillingTruncated || hasMoreInvoices);

  const snapshotStatusText =
    isBookingsLoading || isBillingLoading
      ? 'Loading...'
      : bookingsError && billingError
        ? 'Unavailable'
        : bookingsError || billingError
          ? 'Partial availability'
          : 'Live updates';

  const upcomingTone =
    isBookingsLoading || bookingsError ? 'neutral' : counts.upcoming > 0 ? 'lime' : 'neutral';
  const upcomingHint = isBookingsLoading
    ? 'Checking your confirmed schedule...'
    : bookingsError
      ? 'Confirmed schedule could not be loaded.'
      : counts.upcoming > 0
        ? isBookingsTruncated
          ? 'Confirmed studio sessions scheduled ahead (latest 100 records).'
          : 'Confirmed studio sessions scheduled ahead.'
        : 'No confirmed sessions scheduled yet.';

  const requestsTone =
    isBookingsLoading || bookingsError ? 'neutral' : counts.requests > 0 ? 'orange' : 'neutral';
  const requestsHint = isBookingsLoading
    ? 'Checking your booking requests...'
    : bookingsError
      ? 'Booking request status could not be loaded.'
      : counts.requests > 0
        ? 'Waiting for confirmation from our studio team.'
        : 'You have no booking requests waiting for confirmation.';

  const unpaidLabel =
    billingMetrics.unpaidCount === 1
      ? '1 invoice needs payment'
      : `${billingMetrics.unpaidCount} invoices need payment`;

  const billingTone =
    isBillingLoading || billingError
      ? 'neutral'
      : billingMetrics.overdueCount > 0
        ? 'amber'
        : billingMetrics.totalOutstanding > 0
          ? 'orange'
          : isBillingPartial
            ? 'neutral'
            : 'emerald';

  const billingHint = isBillingLoading
    ? 'Checking your active studio invoices...'
    : billingError
      ? 'Billing information could not be loaded.'
      : isBillingPartial
        ? billingMetrics.unpaidCount > 0
          ? `${unpaidLabel}${billingMetrics.overdueCount > 0 ? ` · ${billingMetrics.overdueCount} overdue` : ''} · Based on latest ${invoices.length} loaded invoices`
          : `Based on latest ${invoices.length} loaded invoices · Older invoices not yet loaded`
        : billingMetrics.totalOutstanding > 0
          ? billingMetrics.overdueCount > 0
            ? `${unpaidLabel} · ${billingMetrics.overdueCount} overdue`
            : `${unpaidLabel} across active studio invoices.`
          : "You're all caught up. No outstanding payments.";

  const nextServiceTitle = nextSchedule
    ? nextSchedule.serviceOptionName &&
      nextSchedule.serviceOptionName.toLowerCase() !==
        String(nextSchedule.serviceTypeName || '').toLowerCase()
      ? `${nextSchedule.serviceTypeName} · ${nextSchedule.serviceOptionName}`
      : nextSchedule.serviceTypeName || 'Studio Session'
    : 'Studio Session';

  const nextOwnerLabel = nextSession?.bandName || nextSession?.customerName || '';

  return (
    <div data-testid="client-portal-home" className="space-y-4 sm:space-y-5">
      {/* A. Welcome Hero */}
      <AdminPageHeader
        eyebrow="YOUR STUDIO WORKSPACE"
        titleId="client-overview-heading"
        title={`Welcome back, ${displayName}`}
        description="See your upcoming sessions, booking requests, and studio balance in one place."
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
              className="sa-control sa-btn-primary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
            >
              <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Book a Session</span>
            </Link>
            <Link
              to={CLIENT_PORTAL_ROUTES.BOOKINGS}
              className="sa-control sa-btn-secondary inline-flex min-h-10 flex-1 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>View My Bookings</span>
            </Link>
          </div>
        }
      />

      {/* B. Account Snapshot */}
      <section aria-labelledby="client-account-snapshot-heading" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2
            id="client-account-snapshot-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Account Snapshot
          </h2>
          <span className="font-mono text-[10.5px] text-[#8B857B]">{snapshotStatusText}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdminMetricCard
            as={Link}
            to={CLIENT_PORTAL_ROUTES.BOOKINGS}
            data-testid="client-metric-upcoming-sessions"
            label="Upcoming Sessions"
            value={
              isBookingsLoading ? (
                <MetricValueSkeleton
                  testId="client-overview-upcoming-skeleton"
                  label="Loading upcoming sessions"
                />
              ) : bookingsError ? (
                '—'
              ) : (
                String(counts.upcoming)
              )
            }
            hint={upcomingHint}
            icon={CalendarCheck2}
            tone={upcomingTone}
            className={METRIC_LINK_CLASS}
          >
            <span className="mt-2.5 flex items-center justify-between border-t border-[#151515]/[0.07] pt-2 text-[11px] font-semibold text-[#46433D] group-hover:text-[#151515]">
              <span>View schedule</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#FF4B22]"
                aria-hidden="true"
              />
            </span>
          </AdminMetricCard>

          <AdminMetricCard
            as={Link}
            to={CLIENT_PORTAL_ROUTES.BOOKINGS}
            data-testid="client-metric-pending-requests"
            label="Requests Awaiting Confirmation"
            value={
              isBookingsLoading ? (
                <MetricValueSkeleton
                  testId="client-overview-requests-skeleton"
                  label="Loading booking requests"
                />
              ) : bookingsError ? (
                '—'
              ) : (
                String(counts.requests)
              )
            }
            hint={requestsHint}
            icon={Clock3}
            tone={requestsTone}
            className={METRIC_LINK_CLASS}
          >
            <span className="mt-2.5 flex items-center justify-between border-t border-[#151515]/[0.07] pt-2 text-[11px] font-semibold text-[#46433D] group-hover:text-[#151515]">
              <span>Track request status</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#FF4B22]"
                aria-hidden="true"
              />
            </span>
          </AdminMetricCard>

          <AdminMetricCard
            as={Link}
            to={CLIENT_PORTAL_ROUTES.INVOICES}
            data-testid="client-metric-outstanding-balance"
            label="Outstanding Balance"
            value={
              isBillingLoading ? (
                <MetricValueSkeleton
                  testId="client-overview-billing-skeleton"
                  label="Loading outstanding balance"
                  widthClass="w-28"
                />
              ) : billingError ? (
                '—'
              ) : (
                formatClientRupiah(billingMetrics.totalOutstanding)
              )
            }
            hint={billingHint}
            icon={Wallet}
            tone={billingTone}
            className={METRIC_LINK_CLASS}
          >
            <span className="mt-2.5 flex items-center justify-between border-t border-[#151515]/[0.07] pt-2 text-[11px] font-semibold text-[#46433D] group-hover:text-[#151515]">
              <span>View billing details</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#FF4B22]"
                aria-hidden="true"
              />
            </span>
          </AdminMetricCard>
        </div>

        {/* Independent Booking & Billing Error Alerts + Truncation Notice */}
        {bookingsError ? (
          <AdminSurface
            variant="card"
            role="alert"
            data-testid="client-overview-booking-error"
            className="flex flex-col gap-3 border-[#FF4B22]/25 bg-[#FFEDE8]/55 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#B92B0C]"
                aria-hidden="true"
              />
              <div className="text-xs text-[#46433D]">
                <p className="font-semibold text-[#151515]">Unable to load booking summary</p>
                <p className="mt-0.5 leading-relaxed">{bookingsError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={retryBookings}
              aria-label="Retry loading bookings"
              className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          </AdminSurface>
        ) : null}

        {billingError ? (
          <AdminSurface
            variant="card"
            role="alert"
            data-testid="client-overview-billing-error"
            className="flex flex-col gap-3 border-[#FF4B22]/25 bg-[#FFEDE8]/55 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#B92B0C]"
                aria-hidden="true"
              />
              <div className="text-xs text-[#46433D]">
                <p className="font-semibold text-[#151515]">Unable to load billing information</p>
                <p className="mt-0.5 leading-relaxed">{formatOverviewBillingError(billingError)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={retryBilling}
              aria-label="Retry loading billing information"
              className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          </AdminSurface>
        ) : null}

        {!isBillingLoading && !billingError && isBillingPartial ? (
          <div
            data-testid="client-overview-billing-truncation-notice"
            className="sa-panel-ivory flex flex-col items-start justify-between gap-2.5 rounded-xl px-4 py-3 text-xs sm:flex-row sm:items-center"
          >
            <p className="text-[#46433D]">
              Balance shown reflects your latest{' '}
              <span className="font-semibold text-[#151515]">{invoices.length}</span> invoices.
              Load older invoices to include your full billing history.
            </p>
            <button
              type="button"
              onClick={loadMoreInvoices}
              className="sa-control sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Load More Invoices</span>
            </button>
          </div>
        ) : null}
      </section>

      {/* C. Quick Access */}
      <section aria-labelledby="client-quick-access-heading" className="space-y-2.5">
        <div className="px-0.5">
          <h2
            id="client-quick-access-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Quick Access
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACCESS_CARDS.map((card) => {
            const CardIcon = card.icon;
            return (
              <Link
                key={card.id}
                to={card.href}
                className="sa-card group flex min-h-11 flex-col justify-between gap-3 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#151515]/20 focus-visible:ring-3 focus-visible:ring-[#C8F13A]/55 focus-visible:outline-none active:scale-[0.99]"
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
                  <h3 className="text-sm font-bold text-[#151515]">{card.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#666159]">{card.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* D. Next Session & E. Recent Activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <AdminSurface
          as="section"
          variant="card"
          aria-labelledby="client-next-session-heading"
          data-testid="client-overview-next-session"
          className="p-4 sm:p-5 xl:col-span-7"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="client-next-session-heading"
                className="text-sm font-bold text-[#151515] sm:text-base"
              >
                Next Session
              </h2>
              <p className="text-xs text-[#666159]">Your next confirmed studio reservation</p>
            </div>
            {isBookingsLoading ? (
              <AdminStatusBadge tone="ivory">Loading...</AdminStatusBadge>
            ) : bookingsError ? (
              <AdminStatusBadge tone="danger">Unavailable</AdminStatusBadge>
            ) : nextStatusMeta ? (
              <AdminStatusBadge tone={nextStatusMeta.tone} dot>
                {nextStatusMeta.label}
              </AdminStatusBadge>
            ) : counts.requests > 0 ? (
              <AdminStatusBadge tone="orange" dot>
                Awaiting Confirmation
              </AdminStatusBadge>
            ) : (
              <AdminStatusBadge tone="neutral">No Upcoming Session</AdminStatusBadge>
            )}
          </div>

          {isBookingsLoading ? (
            <div
              data-testid="client-overview-next-session-skeleton"
              className="h-28 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]"
            />
          ) : bookingsError ? (
            <AdminEmptyState
              icon={CalendarClock}
              tone="orange"
              title="Unable to load next session"
              description={bookingsError}
              action={
                <button
                  type="button"
                  onClick={retryBookings}
                  className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Try Again</span>
                </button>
              }
            />
          ) : nextSession && nextSchedule ? (
            <div className="sa-panel-ivory space-y-3 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#151515] sm:text-base">
                    {nextServiceTitle}
                  </h3>
                  {nextOwnerLabel ? (
                    <p className="mt-0.5 text-xs font-medium text-[#46433D]">{nextOwnerLabel}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {nextSchedule.bookingReference ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#151515]/12 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#151515]">
                      <span className="text-[#666159]">Ref</span>
                      <span>{nextSchedule.bookingReference}</span>
                    </span>
                  ) : nextSession.requestReference ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#151515]/12 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-[#46433D]">
                      <span className="text-[#8B857B]">Ref</span>
                      <span>{nextSession.requestReference}</span>
                    </span>
                  ) : null}
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#151515]/[0.07] pt-2.5">
                {nextStatusMeta?.helperText ? (
                  <p className="text-xs text-[#666159]">{nextStatusMeta.helperText}</p>
                ) : (
                  <span />
                )}
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#151515] underline hover:text-[#FF4B22] focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-[#C8F13A]/55 focus-visible:outline-none"
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
              title="Your booking request is waiting for confirmation."
              description={`You have ${counts.requests} ${counts.requests === 1 ? 'request' : 'requests'} under review. Our studio team will confirm your actual room and schedule shortly — requested times are not reserved until confirmed.`}
              action={
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="sa-control sa-btn-secondary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-xs font-semibold"
                >
                  <span>View Requests in My Bookings</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <AdminEmptyState
              icon={CalendarClock}
              tone="lime"
              title="Ready for your next session?"
              description="You have no confirmed sessions scheduled right now. Choose rehearsal, recording, or Mix & Master to request your studio time."
              action={
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOK}
                  className="sa-control sa-btn-primary inline-flex min-h-10 items-center gap-1.5 px-4 py-2 text-xs font-semibold"
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
          aria-labelledby="client-recent-activity-heading"
          data-testid="client-overview-recent-activity"
          className="p-4 sm:p-5 xl:col-span-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="client-recent-activity-heading"
                className="text-sm font-bold text-[#151515] sm:text-base"
              >
                Recent Activity
              </h2>
              <p className="text-xs text-[#666159]">Latest updates on your bookings and requests</p>
            </div>
            <AdminStatusBadge
              tone={
                bookingsError
                  ? 'danger'
                  : isBookingsLoading
                    ? 'ivory'
                    : recentActivity.length > 0
                      ? 'lime'
                      : 'neutral'
              }
              dot={!isBookingsLoading && !bookingsError && recentActivity.length > 0}
            >
              {bookingsError
                ? 'Unavailable'
                : isBookingsLoading
                  ? 'Loading...'
                  : recentActivity.length > 0
                    ? 'Live'
                    : 'Ready'}
            </AdminStatusBadge>
          </div>

          {isBookingsLoading ? (
            <div data-testid="client-overview-activity-skeleton" className="space-y-2">
              {[0, 1].map((slot) => (
                <div
                  key={slot}
                  className="h-16 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]"
                />
              ))}
            </div>
          ) : bookingsError ? (
            <AdminEmptyState
              icon={Activity}
              tone="orange"
              title="Unable to load recent activity"
              description={bookingsError}
              action={
                <button
                  type="button"
                  onClick={retryBookings}
                  className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Try Again</span>
                </button>
              }
            />
          ) : recentActivity.length > 0 ? (
            <div className="space-y-2.5">
              <ul className="space-y-2">
                {recentActivity.map((act) => {
                  const tsLabel = formatIndonesianTimestamp(act.timestampValue);
                  const displayRef = act.bookingReference || act.requestReference;
                  const titleLine = act.bandName ? `${act.title} · ${act.bandName}` : act.title;
                  return (
                    <li
                      key={act.id}
                      className="sa-panel-ivory flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#151515]">
                          {act.actionLabel || act.title}
                        </span>
                        <AdminStatusBadge tone={act.statusMeta.tone} dot size="sm">
                          {act.statusMeta.label}
                        </AdminStatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#151515]">
                        <span className="min-w-0 font-semibold break-words">{titleLine}</span>
                        {displayRef ? (
                          <span className="shrink-0 font-mono text-[11px] font-semibold text-[#46433D]">
                            {displayRef}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] leading-snug text-[#46433D]">{act.subtitle}</p>
                      {act.statusMeta?.helperText ? (
                        <p className="text-[11px] leading-snug text-[#666159]">
                          {act.statusMeta.helperText}
                        </p>
                      ) : null}
                      {tsLabel !== '-' ? (
                        <p className="font-mono text-[10.5px] text-[#666159]">
                          {act.timestampPrefix ? `${act.timestampPrefix} ${tsLabel}` : tsLabel}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              <div className="flex justify-end pt-1">
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOKINGS}
                  className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#151515] underline hover:text-[#FF4B22] focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-[#C8F13A]/55 focus-visible:outline-none"
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
              description="Your booking requests and confirmed studio schedules will appear here automatically."
            />
          )}
        </AdminSurface>
      </div>
    </div>
  );
}

export default ClientPortalHomePage;
