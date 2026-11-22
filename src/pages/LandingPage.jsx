import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { BookingSection } from '@/components/landing/BookingSection';
import { CustomerReviewsSection } from '@/components/landing/CustomerReviewsSection';
import { GallerySection } from '@/components/landing/GallerySection';
import { HeroSection } from '@/components/landing/HeroSection';
import { PublicAvailabilityTeaserSection } from '@/components/landing/PublicAvailabilityTeaserSection';
import { RoomsSection } from '@/components/landing/RoomsSection';
import { ServicesSection } from '@/components/landing/ServicesSection';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { TestimonialsAndContactSection } from '@/components/landing/TestimonialsAndContactSection';
import { landingPageContent } from '@/data/landing-page-content';
import { BOOKING_REQUEST_SOURCES } from '@/features/admin/booking-requests/config/booking-request-config';
import { usePublishedLandingPagePlacements } from '@/features/admin/gallery/hooks/usePublishedLandingPagePlacements';
import { mergeLandingPageContentWithPlacements } from '@/features/admin/gallery/utils/landing-page-placement-normalize';
import { parseAndValidateInquiryPrefillParams } from '@/features/public-availability/utils/public-availability-calculation';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';
import { mergeLandingPageContentWithSiteSettings } from '@/features/public-site-settings/utils/public-site-settings-normalize';

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

function updateMetaTag(selector, attrName, attrValue) {
  if (typeof document === 'undefined' || !attrValue) return;
  const node = document.querySelector(selector);
  if (node) {
    node.setAttribute(attrName, attrValue);
  }
}

export function LandingPage({ content = landingPageContent }) {
  const [searchParams] = useSearchParams();
  const { placementsById } = usePublishedLandingPagePlacements();
  const { settings: publicSiteSettings } = usePublicSiteSettings();

  const effectiveContent = useMemo(() => {
    const withSiteSettings = mergeLandingPageContentWithSiteSettings(content, publicSiteSettings);
    return mergeLandingPageContentWithPlacements(withSiteSettings, placementsById);
  }, [content, publicSiteSettings, placementsById]);

  const urlPrefill = useMemo(
    () => parseAndValidateInquiryPrefillParams(searchParams),
    [searchParams],
  );

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
    if (typeof document === 'undefined') return;
    const seoTitle =
      effectiveContent.meta?.seoTitle ||
      `${effectiveContent.meta?.studioName || '37 Music Studio'} — Rehearsal, Recording, Mixing & Mastering`;
    const seoDesc = effectiveContent.meta?.seoDescription || '';

    document.title = seoTitle;
    updateMetaTag('meta[name="description"]', 'content', seoDesc);
    updateMetaTag('meta[property="og:title"]', 'content', seoTitle);
    updateMetaTag('meta[property="og:description"]', 'content', seoDesc);

    const heroPhotoSrc = effectiveContent.hero?.featuredPhoto?.src;
    if (heroPhotoSrc && typeof document !== 'undefined') {
      let ogImage = document.querySelector('meta[property="og:image"]');
      if (!ogImage) {
        ogImage = document.createElement('meta');
        ogImage.setAttribute('property', 'og:image');
        document.head.appendChild(ogImage);
      }
      ogImage.setAttribute('content', heroPhotoSrc);
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.setAttribute('href', `${window.location.origin}/`);
      }
    }
  }, [
    effectiveContent.meta?.seoTitle,
    effectiveContent.meta?.seoDescription,
    effectiveContent.meta?.studioName,
    effectiveContent.hero?.featuredPhoto?.src,
  ]);

  useEffect(() => {
    if (urlPrefill.hasValidPrefill) {
      scrollToSection('#booking');
    }
  }, [urlPrefill.hasValidPrefill]);

  const handleNavigate = (hash) => {
    scrollToSection(hash);
  };

  const handleSelectService = (serviceId, defaultRoomId) => {
    setSelectedService(serviceId);
    if (defaultRoomId && defaultRoomId !== 'any') {
      setSelectedRoom(defaultRoomId);
    }
    setSelectionVersion((prev) => prev + 1);
    const serviceLabel = SERVICE_NAMES[serviceId] || serviceId;
    const roomLabel = defaultRoomId ? ROOM_NAMES[defaultRoomId] : null;
    setPreselectionNotice(
      roomLabel && serviceId !== 'mix-master'
        ? `Selected session: ${serviceLabel} (${roomLabel})`
        : `Selected service: ${serviceLabel}`,
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
        ? `Selected room: ${roomLabel} (${serviceLabel})`
        : `Selected room: ${roomLabel}`,
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

      {/* Section 01 & 02 — Utility Strip & Sticky Header */}
      <SiteHeader
        utilityStrip={effectiveContent.utilityStrip}
        header={effectiveContent.header}
        onNavigate={handleNavigate}
        mobileMenuTriggerRef={mobileMenuTriggerRef}
      />

      {/* Main Content Landmark */}
      <main id="main-content">
        {/* Hero & Studio Statement Ticker */}
        <HeroSection
          hero={effectiveContent.hero}
          ticker={effectiveContent.ticker}
          onNavigate={handleNavigate}
        />

        {/* Services ("Pick your session") */}
        <ServicesSection
          services={effectiveContent.services}
          onSelectService={handleSelectService}
        />

        {/* Rooms ("Two rooms, zero guesswork") */}
        <RoomsSection rooms={effectiveContent.rooms} onSelectRoom={handleSelectRoom} />

        {/* Gallery ("Proof, not renders.") */}
        <GallerySection gallery={effectiveContent.gallery} />

        {/* Real Stories From Our Customers (Approved booking-linked reviews) */}
        <CustomerReviewsSection />

        {/* Public Availability Teaser ("Find your next open session.") */}
        <PublicAvailabilityTeaserSection />

        {/* Booking Process + Production Booking Request Form */}
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
          publicWhatsappNumber={effectiveContent.testimonialsAndContact?.contact?.whatsappNumber}
          studioName={effectiveContent.meta?.studioName}
          requestSource={
            urlPrefill.hasValidPrefill
              ? BOOKING_REQUEST_SOURCES.PUBLIC_AVAILABILITY_CALENDAR
              : BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE
          }
        />

        {/* Verified Testimonials (when published) + Location & Hours + Final CTA */}
        <TestimonialsAndContactSection
          testimonialsAndContact={effectiveContent.testimonialsAndContact}
          finalCta={effectiveContent.finalCta}
          onNavigate={handleNavigate}
        />
      </main>

      {/* Black Editorial Footer */}
      <SiteFooter
        footer={effectiveContent.footer}
        contact={effectiveContent.testimonialsAndContact.contact}
        navLinks={effectiveContent.header.navLinks}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
