import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, format, subDays } from 'date-fns';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { bookingInquirySchema } from '@/components/landing/bookingInquirySchema';
import { landingPageContent } from '@/data/landing-page-content';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { resetPublicSubmissionCooldownForTests } from '@/features/admin/booking-requests/services/booking-request-service';
import {
  createInMemoryGalleryRepositoryAdapter,
  resetGalleryRepositoryAdapter,
  setGalleryRepositoryAdapter,
} from '@/features/admin/gallery/repositories/gallery-repository';
import {
  createInMemoryLandingPagePlacementAdapter,
  resetLandingPagePlacementAdapter,
  setLandingPagePlacementAdapter,
} from '@/features/admin/gallery/repositories/landing-page-placement-repository';
import {
  createInMemoryCustomerReviewRepositoryAdapter,
  resetCustomerReviewRepositoryAdapter,
  setCustomerReviewRepositoryAdapter,
} from '@/features/customer-reviews/repositories/customer-review-repository';
import {
  createInMemoryPublicAvailabilityRepositoryAdapter,
  resetPublicAvailabilityRepositoryAdapter,
  setPublicAvailabilityRepositoryAdapter,
} from '@/features/public-availability/repositories/public-availability-repository';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';
import { getTodayLocalDateString } from '@/lib/booking-date';
import { LandingPage } from '@/pages/LandingPage';

describe('37 Music Studio Production Public Website & Booking Requests', () => {
  let bookingRequestAdapter;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    bookingRequestAdapter = createInMemoryBookingRequestRepositoryAdapter();
    setBookingRequestRepositoryAdapter(bookingRequestAdapter);
    setPublicSiteSettingsRepositoryAdapter(createInMemoryPublicSiteSettingsAdapter(null));
    setGalleryRepositoryAdapter(createInMemoryGalleryRepositoryAdapter([]));
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));
    setCustomerReviewRepositoryAdapter(createInMemoryCustomerReviewRepositoryAdapter());
    setPublicAvailabilityRepositoryAdapter(
      createInMemoryPublicAvailabilityRepositoryAdapter({
        initialProjections: [],
        initialMetadata: { isReady: true, backfilledFromDate: '2026-01-01' },
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPublicSubmissionCooldownForTests();
    resetBookingRequestRepositoryAdapter();
    resetPublicSiteSettingsRepositoryAdapter();
    resetGalleryRepositoryAdapter();
    resetLandingPagePlacementAdapter();
    resetCustomerReviewRepositoryAdapter();
    resetPublicAvailabilityRepositoryAdapter();
    cleanup();
  });

  it('renders production sections honestly without demo badges, fake testimonials, or broken Client Login preview CTAs', async () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: /loud rooms\s*for loud\s*ideas\./i }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /pick your session/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /two rooms, zero guesswork/i }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /proof, not renders\./i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /three taps to loud\./i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /send booking request/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /studio location & hours/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /don’t rehearse in a garage\./i }),
    ).toBeTruthy();

    // No nonfunctional Client Login button in public UI, and production header exposes Client Portal Login link
    expect(screen.queryByRole('button', { name: /client login/i })).toBeNull();
    const headerLoginLink = screen.getByTestId('header-login-link');
    expect(headerLoginLink.textContent).toMatch(/login/i);
    expect(headerLoginLink.getAttribute('href')).toBe('/portal/login');

    // No fake testimonials or unverified rating numbers rendered when zero published reviews exist
    expect(screen.queryByTestId('verified-testimonials-section')).toBeNull();
    expect(screen.queryByTestId('customer-reviews-aggregate-card')).toBeNull();
    expect(await screen.findByTestId('customer-reviews-empty-state')).toBeTruthy();

    const pageText = container.textContent || '';
    expect(pageText).not.toMatch(
      /DRAFT PREVIEW|FRONTEND DEMO|DEMO PLACEHOLDER|Local Preview|PENDING\]|42m²|24ch|Client Name Pending/i,
    );

    // Privacy Notice link in form & footer
    expect(screen.getByRole('link', { name: /read privacy notice/i }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.getByRole('link', { name: /^privacy notice$/i }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('preselects the corresponding service and room across all service and room CTAs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /request recording — recording/i }));
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-b');

    await user.click(screen.getByRole('button', { name: /send inquiry — mix & master/i }));
    expect(
      screen.getByRole('button', { name: /^mix & master$/i }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.queryByLabelText(/room preference/i)).toBeNull();
    expect(screen.getByTestId('post-production-inquiry-notice')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /request rehearsal — rehearsal/i }));
    expect(screen.getByRole('button', { name: /^rehearsal$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-a');

    await user.click(screen.getByRole('button', { name: /book this room \(room b\)/i }));
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-b');
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await user.click(screen.getByRole('button', { name: /book this room \(room a\)/i }));
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-a');
    expect(screen.getByRole('button', { name: /^rehearsal$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('defaults the booking date dynamically to today and sets the input min attribute', () => {
    const expectedToday = getTodayLocalDateString();
    render(<App />);

    const dateInput = screen.getByLabelText(/preferred date/i);
    expect(dateInput.value).toBe(expectedToday);
    expect(dateInput.getAttribute('min')).toBe(expectedToday);
  });

  it('validates dates/consent cleanly and persists real studio booking requests with genuine REQ reference', async () => {
    const todayStr = getTodayLocalDateString();
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const basePayload = {
      clientName: 'Midnight Static',
      contactNumber: '+62 812 3456 7890',
      service: 'rehearsal',
      room: 'room-a',
      preferredTime: '19:00',
      duration: '2 hours',
      notes: '',
      privacyConsent: true,
    };

    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: '21-11-2026' }).success,
    ).toBe(false);
    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: yesterdayStr }).success,
    ).toBe(false);
    expect(
      bookingInquirySchema.safeParse({
        ...basePayload,
        preferredDate: todayStr,
        privacyConsent: false,
      }).success,
    ).toBe(false);
    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: tomorrowStr }).success,
    ).toBe(true);

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/your name/i), 'Midnight Static');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '081234567890');

    const dateInput = screen.getByLabelText(/preferred date/i);
    fireEvent.change(dateInput, { target: { value: yesterdayStr } });
    await user.click(screen.getByLabelText(/i agree that 37 music studio/i));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    expect(await screen.findByText(/preferred date cannot be in the past\./i)).toBeTruthy();

    fireEvent.change(dateInput, { target: { value: tomorrowStr } });
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    const successPanel = await screen.findByTestId('booking-request-success-panel');
    expect(within(successPanel).getByText(/booking request received/i)).toBeTruthy();
    expect(within(successPanel).getByText(/this is not a confirmed reservation/i)).toBeTruthy();
    expect(within(successPanel).getByText(/^REQ-[A-Z0-9]{8}$/)).toBeTruthy();

    const stored = Array.from(bookingRequestAdapter._inspectState().requests.values());
    expect(stored).toHaveLength(1);
    expect(stored[0].contactPhone).toBe('+6281234567890');
    expect(stored[0].preferredDate).toBe(tomorrowStr);
  });

  it('re-evaluates today at submit time if the page remains open past midnight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 0));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const dateInput = screen.getByLabelText(/preferred date/i);
    expect(dateInput.value).toBe('2026-11-18');

    await user.type(screen.getByLabelText(/your name/i), 'Late Night Session');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '+62 812 0000 1111');
    await user.click(screen.getByLabelText(/i agree that 37 music studio/i));

    vi.setSystemTime(new Date(2026, 10, 19, 0, 1, 0));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    expect(await screen.findByText(/preferred date cannot be in the past\./i)).toBeTruthy();
  });

  it('enforces 600-char notes limit and supports submitting another request cleanly', async () => {
    const user = userEvent.setup();
    render(<App />);

    const notesField = screen.getByLabelText(/notes \/ setup requirements/i);
    expect(notesField.tagName).toBe('TEXTAREA');
    expect(screen.getByText('0 / 600')).toBeTruthy();

    fireEvent.change(notesField, { target: { value: 'A'.repeat(601) } });
    expect(screen.getByText('601 / 600')).toBeTruthy();

    await user.type(screen.getByLabelText(/your name/i), 'The Velvet Echoes');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '+62 812 3456 7890');
    await user.click(screen.getByLabelText(/i agree that 37 music studio/i));
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    expect(await screen.findByText(/notes must be 600 characters or fewer\./i)).toBeTruthy();

    const validNotes = 'Need room setup for a 4-piece band.';
    fireEvent.change(notesField, { target: { value: validNotes } });
    await user.click(screen.getByRole('button', { name: /submit booking request/i }));

    const successPanel = await screen.findByTestId('booking-request-success-panel');
    expect(within(successPanel).getByText(validNotes)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /submit another request/i }));
    expect(screen.getByLabelText(/your name/i).value).toBe('');
    expect(screen.getByLabelText(/preferred date/i).value).toBe(getTodayLocalDateString());
  });

  it('opens the accessible gallery viewer dialog and cycles through published studio images while hiding old static demo SVGs', async () => {
    const user = userEvent.setup();

    const { container } = render(<App />);
    expect(await screen.findByText(/studio photos coming soon\./i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /view all photos/i })).toBeNull();
    expect(container.innerHTML).not.toMatch(
      /gallery-guitar\.svg|gallery-drums\.svg|gallery-mic\.svg|gallery-console\.svg/i,
    );
    cleanup();

    setGalleryRepositoryAdapter(
      createInMemoryGalleryRepositoryAdapter([
        {
          id: 'gal-pub-1',
          title: 'Live Room A Tracking Setup',
          category: 'Live Room (Room A)',
          altText: 'Full band tracking setup inside Live Room A',
          caption: 'Evening tracking session',
          cloudinaryPublicId: '37musicstudio/gallery/live-room-a',
          cloudinaryAssetId: 'asset-pub-1',
          secureUrl:
            'https://res.cloudinary.com/fodgcil9/image/upload/v1/37musicstudio/gallery/live-room-a.webp',
          resourceType: 'image',
          format: 'webp',
          width: 1600,
          height: 1200,
          bytes: 420000,
          status: 'published',
          sortOrder: 1000,
          version: 1,
        },
        {
          id: 'gal-pub-2',
          title: 'Control Room B Mixing Console',
          category: 'Control Room (Room B)',
          altText: 'Mixing console and studio monitors in Control Room B',
          caption: 'Control desk view',
          cloudinaryPublicId: '37musicstudio/gallery/control-room-b',
          cloudinaryAssetId: 'asset-pub-2',
          secureUrl:
            'https://res.cloudinary.com/fodgcil9/image/upload/v1/37musicstudio/gallery/control-room-b.webp',
          resourceType: 'image',
          format: 'webp',
          width: 1600,
          height: 1200,
          bytes: 380000,
          status: 'published',
          sortOrder: 2000,
          version: 1,
        },
      ]),
    );

    render(<App />);

    const viewAllButton = await screen.findByRole('button', { name: /view all photos/i });
    await user.click(viewAllButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/live room a tracking setup/i)).toBeTruthy();

    const nextButton = within(dialog).getByRole('button', { name: /next studio image/i });
    await user.click(nextButton);

    expect(within(dialog).getByText(/control room b mixing console/i)).toBeTruthy();
  });

  it('consumes Owner-managed publicSiteSettings/site for Maps, WhatsApp, and Social Links while ignoring deprecated manual testimonials', async () => {
    setCustomerReviewRepositoryAdapter(createInMemoryCustomerReviewRepositoryAdapter());
    setPublicSiteSettingsRepositoryAdapter(
      createInMemoryPublicSiteSettingsAdapter({
        studioName: '37 Music Studio',
        publicWhatsappNumber: '+6281234567890',
        publicAddress: 'Jl. Studio No. 37',
        city: 'Jakarta Selatan',
        mapsUrl: 'https://maps.google.com/?q=37+Music+Studio',
        socialLinks: [
          { id: 'instagram', label: 'Instagram', url: 'https://instagram.com/37musicstudio' },
          { id: 'tiktok', label: 'TikTok', url: 'javascript:alert(1)' },
          { id: 'youtube', label: 'YouTube', url: '' },
        ],
        verifiedTestimonials: [
          {
            id: 'tm-1',
            badge: 'VERIFIED BAND',
            quote: 'Ruangan nyaman dan drum kit siap pakai sepanjang sesi.',
            author: 'Raka / Midnight Static',
            role: 'Rehearsal & Recording',
            rating: 5,
          },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    const mapsLink = await screen.findByRole('link', { name: /open in maps/i });
    expect(mapsLink.getAttribute('href')).toBe('https://maps.google.com/?q=37+Music+Studio');
    expect(mapsLink.getAttribute('rel')).toBe('noopener noreferrer');

    const whatsappLink = screen.getByRole('link', { name: /ask on whatsapp/i });
    expect(whatsappLink.getAttribute('href')).toContain('https://wa.me/6281234567890?text=');

    const igLink = screen.getByRole('link', { name: /instagram \(opens in a new tab\)/i });
    expect(igLink.getAttribute('href')).toBe('https://instagram.com/37musicstudio');
    expect(screen.queryByRole('button', { name: /tiktok/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /tiktok/i })).toBeNull();

    // Deprecated manual testimonials from publicSiteSettings/site are never rendered
    expect(screen.queryByTestId('verified-testimonials-section')).toBeNull();
    expect(screen.queryByText(/raka \/ midnight static/i)).toBeNull();
  });

  it('exposes Availability links and renders Privacy Notice at /privacy', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage content={landingPageContent} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /find your next open session\./i }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /check room availability \(room a\)/i })
        .getAttribute('href'),
    ).toBe('/availability?room=room-a');
    expect(
      screen
        .getByRole('link', { name: /check room availability \(room b\)/i })
        .getAttribute('href'),
    ).toBe('/availability?room=room-b');
    expect(screen.getByRole('link', { name: /view full availability/i }).getAttribute('href')).toBe(
      '/availability',
    );
  });

  it('prefills booking request form from valid URL search parameters and ignores invalid params', () => {
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    render(
      <MemoryRouter
        initialEntries={[
          `/?date=${tomorrowStr}&room=room-b&time=19:30&service=recording&duration=3+hours#booking`,
        ]}
      >
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('booking-availability-disclaimer').textContent).toMatch(
      /availability may change\./i,
    );
    expect(screen.getByTestId('booking-preselection-notice').textContent).toMatch(
      /prefilled from availability calendar/i,
    );
    expect(screen.getByLabelText(/preferred date/i).value).toBe(tomorrowStr);
    expect(screen.getByLabelText(/preferred start time/i).value).toBe('19:30');
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-b');
    expect(screen.getByLabelText(/estimated duration/i).value).toBe('3 hours');
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    cleanup();

    render(
      <MemoryRouter
        initialEntries={[
          '/?date=2020-01-01&room=invalid-room&time=23:45&service=unknown&duration=99h',
        ]}
      >
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('booking-preselection-notice')).toBeNull();
    expect(screen.getByLabelText(/preferred date/i).value).toBe(getTodayLocalDateString());
    expect(screen.getByLabelText(/room preference/i).value).toBe('room-a');
    expect(screen.getByLabelText(/preferred start time/i).value).toBe('19:00');
  });
});
