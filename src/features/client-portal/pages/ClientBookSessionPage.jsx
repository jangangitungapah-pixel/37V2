import { AudioLines, CalendarClock, Mic2, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';

import { AdminPageHeader, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { ClientPortalPagePlaceholder } from '../components/ClientPortalPagePlaceholder';
import { CLIENT_PORTAL_ROUTES } from '../config/client-portal-config';

const STUDIO_SERVICE_PREVIEWS = [
  {
    id: 'rehearsal',
    name: 'Rehearsal',
    description: 'Band practice and live-room sessions.',
    detail: 'Dedicated sound-treated rehearsal floor prepared for full bands and ensembles.',
    icon: AudioLines,
    iconBg: 'bg-[#EDF8C2] text-[#243300]',
  },
  {
    id: 'recording',
    name: 'Recording',
    description: 'Professional studio recording sessions.',
    detail: 'Controlled live tracking environment paired with studio engineering support.',
    icon: Mic2,
    iconBg: 'bg-[#FFEDE8] text-[#B92B0C]',
  },
  {
    id: 'mix-master',
    name: 'Mix & Master',
    description: 'Post-production inquiry for your recordings.',
    detail: 'Balanced mixing and final mastering consultation tailored to your project.',
    icon: SlidersHorizontal,
    iconBg: 'bg-[#F4F1E8] text-[#46433D]',
  },
];

export function ClientBookSessionPage() {
  return (
    <div data-testid="client-book-session-page" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        eyebrow="STUDIO RESERVATION"
        titleId="client-book-session-heading"
        title="Book a Session"
        description="Choose the right studio experience for your next creative session."
        keepDescriptionOnMobile
        meta={<AdminStatusBadge tone="ivory">Preview Mode</AdminStatusBadge>}
      />

      {/* Service Preview Cards */}
      <section aria-labelledby="client-service-previews-heading" className="space-y-2.5">
        <div className="px-0.5">
          <h3
            id="client-service-previews-heading"
            className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
          >
            Available Studio Experiences
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {STUDIO_SERVICE_PREVIEWS.map((service) => {
            const ServiceIcon = service.icon;
            return (
              <AdminSurface
                key={service.id}
                variant="card"
                className="flex flex-col justify-between gap-4 p-4 sm:p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${service.iconBg}`}
                    >
                      <ServiceIcon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <AdminStatusBadge tone="ivory">Coming Soon</AdminStatusBadge>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-[#151515]">{service.name}</h4>
                    <p className="mt-1 text-xs font-medium text-[#46433D] sm:text-sm">
                      {service.description}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#666159]">
                      {service.detail}
                    </p>
                  </div>
                </div>
              </AdminSurface>
            );
          })}
        </div>
      </section>

      {/* Spatial Availability Preview Container */}
      <AdminSurface as="section" variant="card" className="p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">
              Room Availability Preview
            </h3>
            <p className="text-xs text-[#666159]">
              Self-service studio booking and slot selection workspace
            </p>
          </div>
          <AdminStatusBadge tone="orange">Self-Service Coming Next</AdminStatusBadge>
        </div>

        <ClientPortalPagePlaceholder
          icon={CalendarClock}
          tone="orange"
          badge="In Preparation"
          title="Portal Booking & Live Slot Picker Coming Soon"
          description="Self-service room availability checking and direct booking submission inside Client Portal will be activated in the next update."
          action={
            <Link
              to="/availability"
              className="sa-btn-secondary inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-semibold"
            >
              Inspect Public Studio Availability
            </Link>
          }
        >
          <p className="text-xs text-[#666159]">
            No reservation requests can be submitted from this placeholder view yet.{' '}
            <Link to={CLIENT_PORTAL_ROUTES.HOME} className="font-semibold text-[#151515] underline">
              Return to Overview
            </Link>
          </p>
        </ClientPortalPagePlaceholder>
      </AdminSurface>
    </div>
  );
}

export default ClientBookSessionPage;
