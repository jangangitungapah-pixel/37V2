import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { BookingSection } from '@/components/landing/BookingSection';
import { GallerySection } from '@/components/landing/GallerySection';
import { HeroSection } from '@/components/landing/HeroSection';
import { LoginComingSoonDialog } from '@/components/landing/LoginComingSoonDialog';
import { PublicAvailabilityTeaserSection } from '@/components/landing/PublicAvailabilityTeaserSection';
import { RoomsSection } from '@/components/landing/RoomsSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { TestimonialsAndContactSection } from '@/components/landing/TestimonialsAndContactSection';
import { landingPageContent } from '@/data/landing-page-content';
import { usePublishedLandingPagePlacements } from '@/features/admin/gallery/hooks/usePublishedLandingPagePlacements';
import { mergeLandingPageContentWithPlacements } from '@/features/admin/gallery/utils/landing-page-placement-normalize';
import { parseAndValidateInquiryPrefillParams } from '@/features/public-availability/utils/public-availability-calculation';

const SERVICE_NAMES = {
  rehearsal: 'Rehearsal',
  recording: 'Recording',
  'mix-master': 'Mix & Master',
};

const ROOM_NAMES = {
  'room-a': 'Room A — Live Room',
  'room-b': 'Room B — Control + Booth',
  any: 'No preference',
};

function scrollToSection(hash) {
  if (typeof document === 'undefined') return;
  const targetId = hash.replace(/^#/, '');
  const element = document.getElementById(targetId);

  if (element && typeof element.scrollIntoView === 'function') {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    element.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

export function LandingPage({ content = landingPageContent }) {
  const [searchParams] = useSearchParams();
  const { placementsById } = usePublishedLandingPagePlacements();
  const effectiveContent = useMemo(
    () => mergeLandingPageContentWithPlacements(content, placementsById),
    [content, placementsById],
  );

  const urlPrefill = useMemo(
    () => parseAndValidateInquiryPrefillParams(searchParams),
    [searchParams],
  );

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [returnFocusToMenuTrigger, setReturnFocusToMenuTrigger] = useState(false);
  const [selectedService, setSelectedService] = useState(() => urlPrefill.service || 'rehearsal');
  const [selectedRoom, setSelectedRoom] = useState(() => urlPrefill.room || 'room-a');
  const [selectedDate, setSelectedDate] = useState(() => urlPrefill.preferredDate || '');
  const [selectedTime, setSelectedTime] = useState(() => urlPrefill.preferredTime || '');
  const [selectedDuration, setSelectedDuration] = useState(() => urlPrefill.duration || '');
  const [selectionVersion, setSelectionVersion] = useState(() =>
    urlPrefill.hasValidPrefill ? 1 : 0,
  );
  const [preselectionNotice, setPreselectionNotice] = useState(() => {
    if (!urlPrefill.hasValidPrefill) return '';
    const parts = [];
    if (urlPrefill.room) parts.push(ROOM_NAMES[urlPrefill.room] || urlPrefill.room);
    if (urlPrefill.preferredDate) parts.push(urlPrefill.preferredDate);
    if (urlPrefill.preferredTime) parts.push(`${urlPrefill.preferredTime} WIB`);
    if (urlPrefill.service) parts.push(SERVICE_NAMES[urlPrefill.service] || urlPrefill.service);
    return `Prefilled from availability calendar: ${parts.join(' • ')}`;
  });

  const mobileMenuTriggerRef = useRef(null);

  useEffect(() => {
    if (urlPrefill.hasValidPrefill) {
      scrollToSection('#booking');
    }
  }, [urlPrefill.hasValidPrefill]);

  const handleNavigate = (hash) => {
    scrollToSection(hash);
  };

  const handleOpenLogin = (fromMobileMenu = false) => {
    setReturnFocusToMenuTrigger(Boolean(fromMobileMenu));
    setLoginDialogOpen(true);
  };

  const handleSelectService = (serviceId, defaultRoomId) => {
    setSelectedService(serviceId);
    if (defaultRoomId) {
      setSelectedRoom(defaultRoomId);
    }
    setSelectionVersion((prev) => prev + 1);
    const serviceLabel = SERVICE_NAMES[serviceId] || serviceId;
    const roomLabel = defaultRoomId ? ROOM_NAMES[defaultRoomId] : null;
    setPreselectionNotice(
      roomLabel
        ? `Preselected session: ${serviceLabel} (${roomLabel})`
        : `Preselected session: ${serviceLabel}`,
    );
    scrollToSection('#booking');
  };

  const handleSelectRoom = (roomId, defaultServiceId) => {
    setSelectedRoom(roomId);
    if (defaultServiceId) {
      setSelectedService(defaultServiceId);
    }
    setSelectionVersion((prev) => prev + 1);
    const roomLabel = ROOM_NAMES[roomId] || roomId;
    const serviceLabel = defaultServiceId ? SERVICE_NAMES[defaultServiceId] : null;
    setPreselectionNotice(
      serviceLabel
        ? `Preselected room: ${roomLabel} (${serviceLabel})`
        : `Preselected room: ${roomLabel}`,
    );
    scrollToSection('#booking');
  };

  const handleClearPreselection = () => {
    setPreselectionNotice('');
    setSelectedDate('');
    setSelectedTime('');
    setSelectedDuration('');
  };

  return (
    <div className="bg-studio-ivory text-studio-ink min-h-screen">
      {/* Keyboard Skip Link */}
      <a
        href="#main-content"
        className="border-studio-ink bg-studio-lime text-studio-ink sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:border-2 focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-extrabold focus:uppercase"
      >
        Skip to main content
      </a>

      {/* Section 01 — Non-Sticky Utility Strip & Sticky Main Header */}
      <SiteHeader
        utilityStrip={effectiveContent.utilityStrip}
        header={effectiveContent.header}
        onNavigate={handleNavigate}
        onOpenLogin={handleOpenLogin}
        mobileMenuTriggerRef={mobileMenuTriggerRef}
      />

      {/* Main Content Landmark */}
      <main id="main-content">
        {/* Sections 02 & 03 — Hero & Acid-Lime Ticker */}
        <HeroSection
          hero={effectiveContent.hero}
          ticker={effectiveContent.ticker}
          onNavigate={handleNavigate}
        />

        {/* Section 04 — Services ("Pick your session") */}
        <ServicesSection
          services={effectiveContent.services}
          onSelectService={handleSelectService}
        />

        {/* Section 05 — Rooms ("Two rooms, zero guesswork") */}
        <RoomsSection rooms={effectiveContent.rooms} onSelectRoom={handleSelectRoom} />

        {/* Section 06 — Gallery ("Proof, not renders.") */}
        <GallerySection gallery={effectiveContent.gallery} />

        {/* Section 07 — Public Availability Teaser ("Find your next open session.") */}
        <PublicAvailabilityTeaserSection />

        {/* Section 08 — Booking Process + Booking Inquiry Form */}
        <BookingSection
          bookingSection={effectiveContent.bookingSection}
          selectedService={selectedService}
          selectedRoom={selectedRoom}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          selectedDuration={selectedDuration}
          selectionVersion={selectionVersion}
          preselectionNotice={preselectionNotice}
          onClearPreselectionNotice={handleClearPreselection}
        />

        {/* Section 09 — Testimonials + Location Card & Final CTA */}
        <TestimonialsAndContactSection
          testimonialsAndContact={effectiveContent.testimonialsAndContact}
          finalCta={effectiveContent.finalCta}
          onNavigate={handleNavigate}
        />
      </main>

      {/* Section 10 — Black Footer */}
      <SiteFooter
        footer={effectiveContent.footer}
        contact={effectiveContent.testimonialsAndContact.contact}
        navLinks={effectiveContent.header.navLinks}
        onNavigate={handleNavigate}
      />

      {/* Client Login Coming Soon Accessible Dialog */}
      <LoginComingSoonDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        content={effectiveContent.loginDialog}
        onGoToBooking={() => handleNavigate('#booking')}
        returnFocusToMenuTrigger={returnFocusToMenuTrigger}
        mobileMenuTriggerRef={mobileMenuTriggerRef}
      />
    </div>
  );
}
