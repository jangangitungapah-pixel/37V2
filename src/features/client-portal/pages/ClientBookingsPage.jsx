import { useState } from 'react';
import { CalendarCheck2, CalendarDays, Clock3, History } from 'lucide-react';
import { Link } from 'react-router';

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { cn } from '@/lib/utils';

import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

const BOOKING_GROUPS = [
  { id: 'all', label: 'All Groups' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'requests', label: 'Requests' },
  { id: 'history', label: 'History' },
];

export function ClientBookingsPage() {
  const [selectedGroup, setSelectedGroup] = useState('all');

  const showGroup = (groupId) => selectedGroup === 'all' || selectedGroup === groupId;

  return (
    <div data-testid="client-bookings-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="SESSION HISTORY"
        titleId="client-bookings-heading"
        title="My Bookings"
        description="Keep track of your upcoming studio sessions and booking history."
        keepDescriptionOnMobile
        meta={<AdminStatusBadge tone="ivory">Sync Pending</AdminStatusBadge>}
      >
        {/* Booking Group Capsule Selector */}
        <div
          role="tablist"
          aria-label="Booking category filter"
          className="sa-pill-track inline-flex flex-wrap items-center gap-1"
        >
          {BOOKING_GROUPS.map((group) => {
            const isSelected = selectedGroup === group.id;
            return (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedGroup(group.id)}
                className={cn(
                  'min-h-8 cursor-pointer rounded-[10px] px-3 py-1 text-xs font-semibold transition-colors',
                  isSelected
                    ? 'bg-[#151515] text-[#C8F13A] shadow-xs'
                    : 'text-[#46433D] hover:bg-white/70 hover:text-[#151515]',
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>
      </AdminPageHeader>

      <div className="space-y-4">
        {showGroup('upcoming') ? (
          <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-[#658800]" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[#151515] sm:text-base">Upcoming Sessions</h3>
              </div>
              <AdminStatusBadge tone="lime">Upcoming</AdminStatusBadge>
            </div>

            <AdminEmptyState
              icon={CalendarDays}
              tone="lime"
              title="No upcoming sessions displayed yet"
              description="Confirmed studio booking times, selected rooms, and session statuses will sync here once Client Booking projection is connected."
              action={
                <Link
                  to={CLIENT_PORTAL_ROUTES.BOOK}
                  className="sa-btn-secondary inline-flex min-h-9 items-center px-3.5 py-1.5 text-xs font-semibold"
                >
                  Preview Studio Services
                </Link>
              }
            />
          </AdminSurface>
        ) : null}

        {showGroup('requests') ? (
          <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#FF4B22]" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[#151515] sm:text-base">Booking Requests</h3>
              </div>
              <AdminStatusBadge tone="orange">Requests</AdminStatusBadge>
            </div>

            <AdminEmptyState
              icon={Clock3}
              tone="orange"
              title="No booking requests tracked yet"
              description="Pending studio inquiries submitted through your portal account will show their desk review status in this section."
            />
          </AdminSurface>
        ) : null}

        {showGroup('history') ? (
          <AdminSurface as="section" variant="card" className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[#151515] sm:text-base">
                  Recent Session History
                </h3>
              </div>
              <AdminStatusBadge tone="neutral">History</AdminStatusBadge>
            </div>

            <AdminEmptyState
              icon={History}
              tone="neutral"
              title="Session history will appear here"
              description="Completed rehearsal, recording, and mix & master sessions tied to your studio profile will be archived cleanly in this timeline."
            />
          </AdminSurface>
        ) : null}
      </div>
    </div>
  );
}

export default ClientBookingsPage;
