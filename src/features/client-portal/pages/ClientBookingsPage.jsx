import { useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  Clock3,
  History,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';
import { cn } from '@/lib/utils';

import { ClientBookingCard } from '../components/bookings/ClientBookingCard';
import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';
import { useClientBookings } from '../hooks/useClientBookings';

const BOOKING_GROUPS = [
  { id: 'all', label: 'All Groups' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'requests', label: 'Requests' },
  { id: 'history', label: 'History' },
];

export function ClientBookingsPage({ now } = {}) {
  const [selectedGroup, setSelectedGroup] = useState('all');
  const { upcoming, requests, history, counts, isLoading, isTruncated, error, retry } =
    useClientBookings({ now });
  const { settings: siteSettings } = usePublicSiteSettings();

  const whatsappNumber = siteSettings?.publicWhatsappNumber || '';
  const studioName = siteSettings?.studioName || '37 Music Studio';

  const showGroup = (groupId) => selectedGroup === 'all' || selectedGroup === groupId;

  return (
    <div data-testid="client-bookings-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="SESSION HISTORY"
        titleId="client-bookings-heading"
        title="My Bookings"
        description="Keep track of your upcoming studio sessions, active requests, and past history."
        keepDescriptionOnMobile
        meta={
          isLoading ? (
            <AdminStatusBadge tone="ivory">Loading...</AdminStatusBadge>
          ) : error ? (
            <AdminStatusBadge tone="danger">Connection Issue</AdminStatusBadge>
          ) : (
            <AdminStatusBadge tone="lime" dot>
              Live Updates
            </AdminStatusBadge>
          )
        }
        actions={
          <Link
            to={CLIENT_PORTAL_ROUTES.BOOK}
            className="sa-btn-primary inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-[13px]"
          >
            <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Book a Session</span>
          </Link>
        }
      >
        {/* Booking Group Capsule Selector */}
        <div
          role="tablist"
          aria-label="Booking category filter"
          className="sa-pill-track inline-flex flex-wrap items-center gap-1"
        >
          {BOOKING_GROUPS.map((group) => {
            const isSelected = selectedGroup === group.id;
            const groupCount = isLoading ? null : (counts[group.id] ?? 0);
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedGroup(group.id)}
                className={cn(
                  'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 py-1 text-xs font-semibold transition-colors',
                  isSelected
                    ? 'bg-[#151515] text-[#C8F13A] shadow-xs'
                    : 'text-[#46433D] hover:bg-white/70 hover:text-[#151515]',
                )}
              >
                <span>{group.label}</span>
                {groupCount !== null ? (
                  <span
                    className={cn(
                      'py-0.2 rounded-full px-1.5 font-mono text-[10px] font-bold tabular-nums',
                      isSelected
                        ? 'bg-[#C8F13A]/20 text-[#C8F13A]'
                        : 'bg-[#151515]/8 text-[#46433D]',
                    )}
                  >
                    {groupCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </AdminPageHeader>

      {isLoading ? (
        <div data-testid="client-bookings-loading" className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((slot) => (
            <AdminSurface key={slot} variant="card" className="p-5">
              <div className="space-y-3">
                <div className="h-4 w-28 animate-pulse rounded bg-[#151515]/10" />
                <div className="h-5 w-52 animate-pulse rounded bg-[#151515]/10" />
                <div className="h-14 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]" />
              </div>
            </AdminSurface>
          ))}
        </div>
      ) : error ? (
        <AdminSurface
          as="section"
          variant="card"
          role="alert"
          data-testid="client-bookings-error-state"
          className="p-6"
        >
          <AdminEmptyState
            icon={AlertTriangle}
            tone="orange"
            title="Unable to load your bookings"
            description={error}
            action={
              <button
                type="button"
                onClick={retry}
                className="sa-btn-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Try Again</span>
              </button>
            }
          />
        </AdminSurface>
      ) : (
        <div className="space-y-4">
          {isTruncated ? (
            <p className="px-1 font-mono text-[11px] text-[#666159]">
              Showing your latest 100 studio booking records.
            </p>
          ) : null}

          {showGroup('upcoming') ? (
            <AdminSurface
              as="section"
              variant="card"
              data-testid="client-bookings-section-upcoming"
              className="p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-[#658800]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#151515] sm:text-base">
                    Upcoming Sessions
                  </h3>
                </div>
                <AdminStatusBadge tone={counts.upcoming > 0 ? 'emerald' : 'lime'}>
                  {counts.upcoming > 0 ? `${counts.upcoming} Confirmed` : 'Upcoming'}
                </AdminStatusBadge>
              </div>

              {upcoming.length > 0 ? (
                <div className="space-y-3">
                  {upcoming.map((item) => (
                    <ClientBookingCard
                      key={item.id}
                      record={item}
                      whatsappNumber={whatsappNumber}
                      studioName={studioName}
                    />
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  icon={CalendarDays}
                  tone="lime"
                  title="No upcoming sessions yet"
                  description="Confirmed studio bookings, assigned rooms, and session timings appear here automatically once confirmed by studio staff."
                  action={
                    <Link
                      to={CLIENT_PORTAL_ROUTES.BOOK}
                      className="sa-btn-secondary inline-flex min-h-9 items-center px-3.5 py-1.5 text-xs font-semibold"
                    >
                      Book a Session
                    </Link>
                  }
                />
              )}
            </AdminSurface>
          ) : null}

          {showGroup('requests') ? (
            <AdminSurface
              as="section"
              variant="card"
              data-testid="client-bookings-section-requests"
              className="p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#FF4B22]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#151515] sm:text-base">
                    Booking Requests
                  </h3>
                </div>
                <AdminStatusBadge tone="orange">
                  {counts.requests > 0 ? `${counts.requests} Active` : 'Requests'}
                </AdminStatusBadge>
              </div>

              {requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map((item) => (
                    <ClientBookingCard
                      key={item.id}
                      record={item}
                      whatsappNumber={whatsappNumber}
                      studioName={studioName}
                    />
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  icon={Clock3}
                  tone="orange"
                  title="No active booking requests"
                  description="Studio session requests and Mix & Master inquiries submitted from your account appear here while our team reviews them."
                />
              )}
            </AdminSurface>
          ) : null}

          {showGroup('history') ? (
            <AdminSurface
              as="section"
              variant="card"
              data-testid="client-bookings-section-history"
              className="p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#151515] sm:text-base">
                    Recent Session History
                  </h3>
                </div>
                <AdminStatusBadge tone="neutral">
                  {counts.history > 0 ? `${counts.history} Past` : 'History'}
                </AdminStatusBadge>
              </div>

              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item) => (
                    <ClientBookingCard
                      key={item.id}
                      record={item}
                      whatsappNumber={whatsappNumber}
                      studioName={studioName}
                    />
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  icon={History}
                  tone="neutral"
                  title="No past sessions yet"
                  description="Completed studio sessions and closed requests tied to your portal account will appear in this timeline."
                />
              )}
            </AdminSurface>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ClientBookingsPage;
