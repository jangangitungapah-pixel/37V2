import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, format, subDays } from 'date-fns';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { bookingInquirySchema } from '@/components/landing/bookingInquirySchema';
import { landingPageContent, pendingConfigTokens } from '@/data/landing-page-content';
import {
  createInMemoryGalleryRepositoryAdapter,
  resetGalleryRepositoryAdapter,
  setGalleryRepositoryAdapter,
} from '@/features/admin/gallery/repositories/gallery-repository';
import { getTodayLocalDateString } from '@/lib/booking-date';
import { LandingPage } from '@/pages/LandingPage';

describe('37 Music Studio Public Landing Page (Phase 2B)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    setGalleryRepositoryAdapter(createInMemoryGalleryRepositoryAdapter([]));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetGalleryRepositoryAdapter();
    cleanup();
  });

  it('renders all key sections honestly without raw pending tokens or unverified claims', () => {
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
    expect(screen.getByRole('heading', { level: 2, name: /booking inquiry/i })).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /studio location & hours/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: /don’t rehearse in a garage\./i }),
    ).toBeTruthy();

    // Utility strip should sit outside sticky <header> so it scrolls away cleanly on mobile
    const headerLandmark = screen.getByRole('banner');
    expect(
      within(headerLandmark).queryByText(
        /37 MUSIC STUDIO • REHEARSAL \/ RECORDING \/ MIX & MASTER/i,
      ),
    ).toBeNull();

    const pageText = container.textContent || '';
    for (const rawToken of Object.values(pendingConfigTokens)) {
      expect(pageText).not.toContain(rawToken);
    }

    expect(pageText).not.toMatch(/42m²|24ch|15min|BAND FAVORITE|2 min from the mainline/i);
  });

  it('opens and closes the header Client Login coming-soon dialog without authentication inputs', async () => {
    const user = userEvent.setup();
    render(<App />);

    const clientLoginButton = screen.getByRole('button', {
      name: /client login portal \(coming soon\)/i,
    });
    await user.click(clientLoginButton);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/client login coming soon/i)).toBeTruthy();
    expect(
      within(dialog).getByText(
        /the client portal is not available yet\. you can still explore our services and submit a booking inquiry from the public website\./i,
      ),
    ).toBeTruthy();
    expect(within(dialog).queryByLabelText(/password/i)).toBeNull();

    const closeButton = within(dialog).getByRole('button', { name: /back to website/i });
    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('preselects the corresponding service and room across all service and room CTAs', async () => {
    const user = userEvent.setup();
    render(<App />);

    const roomSelect = screen.getByLabelText(/room preference/i);

    await user.click(screen.getByRole('button', { name: /check availability — recording/i }));
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(roomSelect.value).toBe('room-b');

    await user.click(screen.getByRole('button', { name: /check availability — mix & master/i }));
    expect(
      screen.getByRole('button', { name: /^mix & master$/i }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(roomSelect.value).toBe('room-b');

    await user.click(screen.getByRole('button', { name: /check availability — rehearsal/i }));
    expect(screen.getByRole('button', { name: /^rehearsal$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(roomSelect.value).toBe('room-a');

    await user.click(screen.getByRole('button', { name: /book this room \(room b\)/i }));
    expect(roomSelect.value).toBe('room-b');
    expect(screen.getByRole('button', { name: /^recording$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await user.click(screen.getByRole('button', { name: /book this room \(room a\)/i }));
    expect(roomSelect.value).toBe('room-a');
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

  it('rejects invalid calendar dates and past dates while accepting today and future dates', async () => {
    const todayStr = getTodayLocalDateString();
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    // Schema-level calendar & format validation
    const basePayload = {
      clientName: 'Midnight Static',
      contactNumber: '+62 812 3456 7890',
      service: 'rehearsal',
      room: 'room-a',
      preferredTime: '19:00',
      duration: '2 hours',
      notes: '',
    };

    const badFormat = bookingInquirySchema.safeParse({
      ...basePayload,
      preferredDate: '21-11-2026',
    });
    expect(badFormat.success).toBe(false);
    expect(badFormat.error.issues[0].message).toMatch(/YYYY-MM-DD/i);

    const badCalendarDate = bookingInquirySchema.safeParse({
      ...basePayload,
      preferredDate: '2026-02-30',
    });
    expect(badCalendarDate.success).toBe(false);
    expect(badCalendarDate.error.issues[0].message).toMatch(/valid calendar date/i);

    const pastDateResult = bookingInquirySchema.safeParse({
      ...basePayload,
      preferredDate: yesterdayStr,
    });
    expect(pastDateResult.success).toBe(false);
    expect(pastDateResult.error.issues[0].message).toMatch(/cannot be in the past/i);

    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: todayStr }).success,
    ).toBe(true);
    expect(
      bookingInquirySchema.safeParse({ ...basePayload, preferredDate: tomorrowStr }).success,
    ).toBe(true);

    // UI-level past-date rejection and future-date acceptance
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/name \/ band name/i), 'Midnight Static');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '+62 812 3456 7890');

    const dateInput = screen.getByLabelText(/preferred date/i);
    fireEvent.change(dateInput, { target: { value: yesterdayStr } });
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(await screen.findByText(/preferred date cannot be in the past\./i)).toBeTruthy();

    fireEvent.change(dateInput, { target: { value: tomorrowStr } });
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(
      await screen.findByText(
        /demo inquiry only — your request has not been sent\. the booking integration will be added later\./i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(new RegExp(tomorrowStr))).toBeTruthy();
  });

  it('re-evaluates today at submit time if the page remains open past midnight', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 0));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    const dateInput = screen.getByLabelText(/preferred date/i);
    expect(dateInput.value).toBe('2026-11-18');

    await user.type(screen.getByLabelText(/name \/ band name/i), 'Late Night Session');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '+62 812 0000 1111');

    // Advance past midnight without touching the date field
    vi.setSystemTime(new Date(2026, 10, 19, 0, 1, 0));
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(await screen.findByText(/preferred date cannot be in the past\./i)).toBeTruthy();
  });

  it('uses a multiline textarea for Notes with a live character counter and 400-character limit', async () => {
    const user = userEvent.setup();
    render(<App />);

    const notesField = screen.getByLabelText(/notes \/ setup requirements/i);
    expect(notesField.tagName).toBe('TEXTAREA');
    expect(screen.getByText('0 / 400')).toBeTruthy();

    const overLimitText = 'A'.repeat(401);
    fireEvent.change(notesField, { target: { value: overLimitText } });
    expect(screen.getByText('401 / 400')).toBeTruthy();

    await user.type(screen.getByLabelText(/name \/ band name/i), 'The Velvet Echoes');
    await user.type(screen.getByLabelText(/whatsapp \/ contact number/i), '+62 812 3456 7890');
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(await screen.findByText(/notes must be 400 characters or fewer\./i)).toBeTruthy();

    const validNotes = 'Need room setup for a 4-piece band.';
    fireEvent.change(notesField, { target: { value: validNotes } });
    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));

    expect(
      await screen.findByText(
        /demo inquiry only — your request has not been sent\. the booking integration will be added later\./i,
      ),
    ).toBeTruthy();
    expect(screen.getByText(validNotes)).toBeTruthy();

    // Edit & Reset workflow
    await user.click(screen.getByRole('button', { name: /edit inquiry details/i }));
    expect(screen.getByLabelText(/name \/ band name/i).value).toBe('The Velvet Echoes');

    await user.click(screen.getByRole('button', { name: /send booking inquiry/i }));
    await user.click(await screen.findByRole('button', { name: /reset \/ new inquiry/i }));
    expect(screen.getByLabelText(/name \/ band name/i).value).toBe('');
    expect(screen.getByLabelText(/preferred date/i).value).toBe(getTodayLocalDateString());
  });

  it('opens the accessible gallery viewer dialog and cycles through published studio images while hiding old static demo SVGs', async () => {
    const user = userEvent.setup();

    // When empty, shows editorial empty state and never shows demo SVG gallery assets
    const { container } = render(<App />);
    expect(await screen.findByText(/studio photos coming soon\./i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /view all photos/i })).toBeNull();
    expect(container.innerHTML).not.toMatch(
      /gallery-guitar\.svg|gallery-drums\.svg|gallery-mic\.svg|gallery-console\.svg/i,
    );
    cleanup();

    // Seed published photos in Firestore adapter and verify dynamic gallery & lightbox navigation
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

  it('shows honest pending notices for unconfirmed Maps, WhatsApp, and social actions', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mapsButton = screen.getByRole('button', { name: /open in maps/i });
    await user.click(mapsButton);
    expect(
      await screen.findByText(
        /verified studio map coordinates and street address are pending owner confirmation/i,
      ),
    ).toBeTruthy();

    const whatsappButton = screen.getByRole('button', { name: /ask on whatsapp/i });
    await user.click(whatsappButton);
    expect(
      await screen.findByText(
        /the official 37 music studio whatsapp number is pending owner confirmation/i,
      ),
    ).toBeTruthy();

    const instagramButton = screen.getByRole('button', {
      name: /instagram \(official url pending owner confirmation\)/i,
    });
    await user.click(instagramButton);
    expect(
      await screen.findByText(
        /official 37 music studio instagram profile url is pending owner confirmation\./i,
      ),
    ).toBeTruthy();
  });

  it('renders confirmed external links defensively only when both confirmation flag and valid URL exist', async () => {
    const user = userEvent.setup();
    const mixedConfigContent = {
      ...landingPageContent,
      testimonialsAndContact: {
        ...landingPageContent.testimonialsAndContact,
        contact: {
          ...landingPageContent.testimonialsAndContact.contact,
          isAddressConfirmed: true,
          addressText: 'Jl. Studio No. 37, Jakarta',
          mapsUrl: 'https://maps.google.com/?q=37+Music+Studio',
        },
      },
      finalCta: {
        ...landingPageContent.finalCta,
        secondaryCta: {
          ...landingPageContent.finalCta.secondaryCta,
          isConfirmed: true,
          whatsappNumber: '6281234567890',
          whatsappUrl: 'https://wa.me/6281234567890',
          prefilledMessage: 'Hi 37 Music Studio, I would like to ask about booking.',
        },
      },
      footer: {
        ...landingPageContent.footer,
        socialLinks: [
          {
            id: 'instagram',
            label: 'Instagram',
            isConfirmed: true,
            href: 'https://instagram.com/37musicstudio',
          },
          {
            id: 'tiktok',
            label: 'TikTok',
            isConfirmed: true,
            href: 'javascript:alert(1)',
          },
          {
            id: 'youtube',
            label: 'YouTube',
            isConfirmed: true,
            href: '',
          },
        ],
      },
    };

    render(
      <MemoryRouter>
        <LandingPage content={mixedConfigContent} />
      </MemoryRouter>,
    );

    // Confirmed Maps renders external anchor with safe rel attributes
    const mapsLink = screen.getByRole('link', { name: /open in maps/i });
    expect(mapsLink.getAttribute('href')).toBe('https://maps.google.com/?q=37+Music+Studio');
    expect(mapsLink.getAttribute('target')).toBe('_blank');
    expect(mapsLink.getAttribute('rel')).toBe('noopener noreferrer');

    // Confirmed WhatsApp renders external anchor with encoded prefilled message
    const whatsappLink = screen.getByRole('link', { name: /ask on whatsapp/i });
    expect(whatsappLink.getAttribute('href')).toBe(
      'https://wa.me/6281234567890?text=Hi+37+Music+Studio%2C+I+would+like+to+ask+about+booking.',
    );
    expect(whatsappLink.getAttribute('target')).toBe('_blank');
    expect(whatsappLink.getAttribute('rel')).toBe('noopener noreferrer');

    // Confirmed Instagram renders anchor; invalid/empty URLs stay pending buttons despite flag=true
    const igLink = screen.getByRole('link', { name: /instagram \(opens in a new tab\)/i });
    expect(igLink.getAttribute('href')).toBe('https://instagram.com/37musicstudio');
    expect(igLink.getAttribute('rel')).toBe('noopener noreferrer');

    const tiktokFallbackButton = screen.getByRole('button', {
      name: /tiktok \(official url pending owner confirmation\)/i,
    });
    await user.click(tiktokFallbackButton);
    expect(
      await screen.findByText(
        /official 37 music studio tiktok profile url is pending owner confirmation\./i,
      ),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: /youtube \(official url pending owner confirmation\)/i,
      }),
    ).toBeTruthy();
  });
});
