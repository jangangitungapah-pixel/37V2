import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
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
  createInMemoryPublicAvailabilityRepositoryAdapter,
  resetPublicAvailabilityRepositoryAdapter,
  setPublicAvailabilityRepositoryAdapter,
} from '@/features/public-availability/repositories/public-availability-repository';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';
import {
  GOOGLE_MAPS_JS_SCRIPT_ID,
  GOOGLE_REVIEWS_DIAGNOSTIC_CODES,
  PLACE_FETCH_FIELDS,
  VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
  VERIFIED_STUDIO_PLACE_ID,
  fetchStudioGoogleReviews,
  loadGoogleMapsPlacesLibrary,
  normalizeGooglePlaceResult,
  resetGoogleMapsPlacesClientForTests,
  verifyStudioPlaceIdentity,
} from '@/lib/google-maps/places-client';
import { LandingPage } from '@/pages/LandingPage';

import { GoogleReviewsSection } from './GoogleReviewsSection';

function createSyntheticPlaceResponse(overrides = {}) {
  return {
    displayName: '37 Music Studio TANGERANG',
    formattedAddress:
      'Semi, Jl. Palem Kuning Jl. Palem Raya No.37, Bencongan Indah, Kec. Kelapa Dua, Kabupaten Tangerang, Banten 15810, Indonesia',
    rating: 4.8,
    userRatingCount: 127,
    googleMapsURI: 'https://maps.google.com/?cid=999000111',
    attributions: [
      {
        provider: 'Google Maps Mock Attribution Provider',
        providerURI: 'https://maps.google.com/attribution-example',
      },
    ],
    reviews: [
      {
        rating: 5,
        text: 'Synthetic test review one checking clean room monitoring and rehearsal flow.',
        relativePublishTimeDescription: '2 minggu lalu',
        publishTime: '2026-11-08T10:00:00Z',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-1',
        flagContentURI: 'https://maps.google.com/flags/mock-review-1',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Alpha',
          photoURI: 'https://example.com/avatar-alpha.png',
          uri: 'https://maps.google.com/contrib/alpha',
        },
      },
      {
        rating: 4,
        text: 'Synthetic test review two verifying neutral attribution without avatar image.',
        relativePublishTimeDescription: '',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-2',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Beta',
          photoURI: '',
          uri: '',
        },
      },
      {
        rating: 5,
        text: 'Synthetic test review three checking five-card carousel capacity.',
        relativePublishTimeDescription: '1 bulan lalu',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-3',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Gamma',
          photoURI: 'https://example.com/avatar-gamma.png',
          uri: 'https://maps.google.com/contrib/gamma',
        },
      },
      {
        rating: 3,
        text: 'Synthetic test review four proving lower ratings are preserved honestly without filtering.',
        relativePublishTimeDescription: '2 bulan lalu',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-4',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Delta',
          uri: 'https://maps.google.com/contrib/delta',
        },
      },
      {
        rating: 5,
        text: 'Synthetic test review five checking max 5 reviews cap.',
        relativePublishTimeDescription: '3 bulan lalu',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-5',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Epsilon',
          uri: 'https://maps.google.com/contrib/epsilon',
        },
      },
      {
        rating: 5,
        text: 'Sixth synthetic review beyond Google 5-review limit should never appear.',
        relativePublishTimeDescription: '4 bulan lalu',
        googleMapsURI: 'https://maps.google.com/reviews/mock-review-6',
        authorAttribution: {
          displayName: 'Synthetic Reviewer Zeta',
          uri: 'https://maps.google.com/contrib/zeta',
        },
      },
    ],
    ...overrides,
  };
}

function cleanupInjectedGoogleMapsGlobals() {
  document.getElementById(GOOGLE_MAPS_JS_SCRIPT_ID)?.remove();
  document
    .querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]')
    .forEach((el) => el.remove());
  delete window.google;
  delete window.gm_authFailure;
  Object.keys(window).forEach((key) => {
    if (key.startsWith('__init37StudioGoogleMaps_')) {
      delete window[key];
    }
  });
}

describe('Google Maps Places Client & Reviews Section', () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    resetGoogleMapsPlacesClientForTests();
    cleanupInjectedGoogleMapsGlobals();
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllEnvs();

    setBookingRequestRepositoryAdapter(createInMemoryBookingRequestRepositoryAdapter());
    setPublicSiteSettingsRepositoryAdapter(createInMemoryPublicSiteSettingsAdapter(null));
    setGalleryRepositoryAdapter(createInMemoryGalleryRepositoryAdapter([]));
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));
    setPublicAvailabilityRepositoryAdapter(
      createInMemoryPublicAvailabilityRepositoryAdapter({
        initialProjections: [],
        initialMetadata: { isReady: true, backfilledFromDate: '2026-11-22' },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetGoogleMapsPlacesClientForTests();
    cleanupInjectedGoogleMapsGlobals();
    resetBookingRequestRepositoryAdapter();
    resetPublicSiteSettingsRepositoryAdapter();
    resetGalleryRepositoryAdapter();
    resetLandingPagePlacementAdapter();
    resetPublicAvailabilityRepositoryAdapter();
    window.IntersectionObserver = originalIntersectionObserver;
    window.matchMedia = originalMatchMedia;
    cleanup();
  });

  describe('1. API Loader (`places-client.js`)', () => {
    it('loads Maps JS SDK once when concurrent callers initialize Places API with Indonesian locale/region', async () => {
      const mockImportLibrary = vi.fn(async () => ({
        Place: class MockPlace {},
      }));

      const p1 = loadGoogleMapsPlacesLibrary({ apiKey: 'test-public-browser-key-123' });
      const p2 = loadGoogleMapsPlacesLibrary({ apiKey: 'test-public-browser-key-123' });

      const scripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]');
      expect(scripts).toHaveLength(1);
      expect(scripts[0].id).toBe(GOOGLE_MAPS_JS_SCRIPT_ID);
      expect(scripts[0].src).toContain('language=id');
      expect(scripts[0].src).toContain('region=ID');
      expect(scripts[0].src).toContain('loading=async');

      const callbackParam = new URL(scripts[0].src).searchParams.get('callback');
      window.google = { maps: { importLibrary: mockImportLibrary } };
      window[callbackParam]();

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe(res2);
      expect(typeof res1.Place).toBe('function');
      expect(mockImportLibrary).toHaveBeenCalledTimes(1);
      expect(mockImportLibrary).toHaveBeenCalledWith('places');
    });

    it('rejects cleanly on missing API key, script network error, gm_authFailure, or importLibrary failure', async () => {
      await expect(loadGoogleMapsPlacesLibrary({ apiKey: '' })).rejects.toMatchObject({
        code: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.UNCONFIGURED,
      });
      expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(0);

      // Script error
      const failScriptPromise = loadGoogleMapsPlacesLibrary({ apiKey: 'key-err-test' });
      const script = document.getElementById(GOOGLE_MAPS_JS_SCRIPT_ID);
      fireEvent.error(script);
      await expect(failScriptPromise).rejects.toMatchObject({
        code: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_LOAD_FAILED,
      });

      cleanupInjectedGoogleMapsGlobals();

      // Places library import failure
      const failImportPromise = loadGoogleMapsPlacesLibrary({ apiKey: 'key-import-fail' });
      const importScript = document.getElementById(GOOGLE_MAPS_JS_SCRIPT_ID);
      const cbName = new URL(importScript.src).searchParams.get('callback');
      window.google = {
        maps: {
          importLibrary: vi.fn(async () => {
            throw new Error('Places import blocked');
          }),
        },
      };
      window[cbName]();
      await expect(failImportPromise).rejects.toMatchObject({
        code: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
      });

      cleanupInjectedGoogleMapsGlobals();

      // gm_authFailure global rejection handler
      const authFailPromise = loadGoogleMapsPlacesLibrary({ apiKey: 'key-auth-fail' });
      expect(typeof window.gm_authFailure).toBe('function');
      window.gm_authFailure();
      await expect(authFailPromise).rejects.toMatchObject({
        code: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.AUTH_FAILED,
      });

      cleanupInjectedGoogleMapsGlobals();

      // Existing incompatible Maps script conflict
      const foreignScript = document.createElement('script');
      foreignScript.src = 'https://maps.googleapis.com/maps/api/js?key=other-key';
      foreignScript.dataset.loaded = 'true';
      document.head.appendChild(foreignScript);
      await expect(loadGoogleMapsPlacesLibrary({ apiKey: 'new-key' })).rejects.toMatchObject({
        code: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_CONFLICT,
      });
    });

    it('invokes Place.fetchFields using exact SDK fields once per runtime and verifies returned studio data', async () => {
      const mockFetchFields = vi.fn(async () => {});
      const constructedIds = [];

      window.google = {
        maps: {
          importLibrary: vi.fn(async () => ({
            Place: class MockStudioPlace {
              constructor(opts) {
                constructedIds.push(opts.id);
                Object.assign(this, createSyntheticPlaceResponse());
                this.fetchFields = mockFetchFields;
              }
            },
          })),
        },
      };

      const configOverride = {
        apiKey: 'mock-browser-key',
        placeId: VERIFIED_STUDIO_PLACE_ID,
        isConfigured: true,
        fallbackUrl: VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
      };

      const first = await fetchStudioGoogleReviews({ configOverride });
      const second = await fetchStudioGoogleReviews({ configOverride });

      expect(constructedIds).toEqual([VERIFIED_STUDIO_PLACE_ID]);
      expect(mockFetchFields).toHaveBeenCalledTimes(1);
      expect(mockFetchFields).toHaveBeenCalledWith({ fields: [...PLACE_FETCH_FIELDS] });
      expect(first.status).toBe('loaded');
      expect(second).toBe(first);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('2. Place Identity Validation', () => {
    it('accepts 37 Music Studio TANGERANG with valid address OR missing optional address fields', () => {
      expect(verifyStudioPlaceIdentity(createSyntheticPlaceResponse()).isMatch).toBe(true);
      expect(
        verifyStudioPlaceIdentity({
          displayName: '37 Music Studio TANGERANG',
          formattedAddress: undefined,
        }).isMatch,
      ).toBe(true);
    });

    it('rejects mismatching displayName or foreign address without leaking unrelated place data', () => {
      const wrongName = normalizeGooglePlaceResult(
        createSyntheticPlaceResponse({
          displayName: 'Unrelated Coffee Bar',
        }),
      );
      expect(wrongName.status).toBe('mismatch');
      expect(wrongName.diagnosticCode).toBe(GOOGLE_REVIEWS_DIAGNOSTIC_CODES.IDENTITY_MISMATCH);
      expect(wrongName.place).toBeNull();

      const wrongCity = normalizeGooglePlaceResult(
        createSyntheticPlaceResponse({
          displayName: '37 Music Studio',
          formattedAddress: '123 Fake Street, Surabaya 60111',
        }),
      );
      expect(wrongCity.status).toBe('mismatch');
      expect(wrongCity.place).toBeNull();
    });
  });

  describe('3. UI Rendering, Lazy-Load Viewport Gate, Attribution & Fallbacks', () => {
    it('defers fetching until IntersectionObserver fires, and fetches only once across StrictMode remounts', async () => {
      let observerCallback = null;
      const observeSpy = vi.fn();
      const disconnectSpy = vi.fn();

      window.IntersectionObserver = class MockObserver {
        constructor(cb) {
          observerCallback = cb;
        }
        observe(node) {
          observeSpy(node);
        }
        disconnect() {
          disconnectSpy();
        }
      };

      const normalized = normalizeGooglePlaceResult(createSyntheticPlaceResponse());
      const mockFetcher = vi.fn(async () => normalized);

      render(
        <StrictMode>
          <GoogleReviewsSection fetchReviewsFn={mockFetcher} />
        </StrictMode>,
      );

      expect(observeSpy).toHaveBeenCalled();
      expect(mockFetcher).not.toHaveBeenCalled();
      expect(screen.getByTestId('google-reviews-loading')).toBeTruthy();

      observerCallback([{ isIntersecting: true }]);

      expect(await screen.findByTestId('google-reviews-aggregate-rating')).toBeTruthy();
      expect(screen.getByTestId('google-reviews-aggregate-rating').textContent).toBe('4.8');
      expect(screen.getByTestId('google-reviews-total-count').textContent).toBe(
        '127 Google ratings',
      );
      expect(mockFetcher).toHaveBeenCalledTimes(1);
    });

    it('renders up to 5 authentic reviews with author attribution, avatar fallback, missing publishTime, direct Google Maps URI, and mandatory disclosures', async () => {
      const incompleteMissingAuthor = {
        rating: 5,
        text: 'Incomplete card missing author attribution must be excluded.',
        googleMapsURI: 'https://maps.google.com/reviews/no-author',
        authorAttribution: { displayName: '' },
      };
      const incompleteMissingUri = {
        rating: 5,
        text: 'Incomplete card missing googleMapsURI must be excluded.',
        googleMapsURI: '',
        authorAttribution: { displayName: 'Missing Link User' },
      };

      const responseWithMixed = createSyntheticPlaceResponse({
        reviews: [
          ...createSyntheticPlaceResponse().reviews.slice(0, 3),
          incompleteMissingAuthor,
          incompleteMissingUri,
          ...createSyntheticPlaceResponse().reviews.slice(3),
        ],
      });

      // Only the 5 slice reviews from top 5 API entries contain 3 eligible (entries 0,1,2) + 2 excluded (3,4),
      // so let's also verify exact 5-review rendering when all 5 API entries are eligible.
      const normalizedFive = normalizeGooglePlaceResult(createSyntheticPlaceResponse());
      render(<GoogleReviewsSection fetchReviewsFn={async () => normalizedFive} />);

      const cards = await screen.findAllByTestId('google-review-card');
      expect(cards).toHaveLength(5);

      // Card 1: linked author name, image avatar, verbatim text, direct review link, flag link
      const firstCard = cards[0];
      const authorLink = within(firstCard).getByRole('link', { name: 'Synthetic Reviewer Alpha' });
      expect(authorLink.getAttribute('href')).toBe('https://maps.google.com/contrib/alpha');
      expect(authorLink.getAttribute('rel')).toBe('noopener noreferrer');
      expect(within(firstCard).getByAltText('Synthetic Reviewer Alpha avatar')).toBeTruthy();
      expect(
        within(firstCard).getByText(
          'Synthetic test review one checking clean room monitoring and rehearsal flow.',
        ),
      ).toBeTruthy();
      const reviewSourceLink = within(firstCard).getByRole('link', {
        name: /view original review on google maps/i,
      });
      expect(reviewSourceLink.getAttribute('href')).toBe(
        'https://maps.google.com/reviews/mock-review-1',
      );
      expect(reviewSourceLink.getAttribute('target')).toBe('_blank');
      expect(reviewSourceLink.getAttribute('rel')).toBe('noopener noreferrer');

      // Card 2: missing avatar falls back to neutral initial badge, missing relative time doesn't crash, no author URI renders plain text
      const secondCard = cards[1];
      expect(within(secondCard).queryByRole('img')).toBeNull();
      expect(within(secondCard).getByText('S')).toBeTruthy();
      expect(within(secondCard).getByText('Synthetic Reviewer Beta').tagName).toBe('P');

      // Non-5-star review is preserved (never censored) and 6th review is excluded
      expect(
        screen.getByText(
          'Synthetic test review four proving lower ratings are preserved honestly without filtering.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Synthetic Reviewer Zeta')).toBeNull();

      // Returned Place attributions + relevance order disclosure + no forbidden endorsed phrasing
      const footer = screen.getByTestId('google-reviews-attribution-footer');
      expect(within(footer).getByText(/powered by google/i)).toBeTruthy();
      expect(within(footer).getByText(/returned relevance order/i)).toBeTruthy();
      expect(
        within(footer).getByRole('link', { name: 'Google Maps Mock Attribution Provider' }),
      ).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/Google Verified Customers/i);

      // Separate check confirming incomplete reviews without author or URI are omitted
      cleanup();
      const mixedNormalized = normalizeGooglePlaceResult(responseWithMixed);
      render(<GoogleReviewsSection fetchReviewsFn={async () => mixedNormalized} />);
      expect(await screen.findAllByTestId('google-review-card')).toHaveLength(3);
      expect(
        screen.queryByText('Incomplete card missing author attribution must be excluded.'),
      ).toBeNull();
      expect(
        screen.queryByText('Incomplete card missing googleMapsURI must be excluded.'),
      ).toBeNull();
    });

    it('gracefully handles missing API key, API request failure, zero eligible reviews, and Place mismatch', async () => {
      // Missing API key when using default fetcher
      render(<GoogleReviewsSection />);
      const fallbackSummary = await screen.findByTestId('google-reviews-fallback-summary');
      expect(fallbackSummary.textContent).toMatch(/not configured yet/i);
      const fallbackLink = within(fallbackSummary).getByRole('link', {
        name: /view our reviews on google maps/i,
      });
      expect(fallbackLink.getAttribute('href')).toBe(VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL);
      cleanup();

      // API failure
      render(
        <GoogleReviewsSection
          fetchReviewsFn={async () => ({
            status: 'error',
            diagnosticCode: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.FETCH_FAILED,
            place: null,
            fallbackUrl: VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
          })}
        />,
      );
      expect(
        (
          await screen.findByRole('link', {
            name: /view our reviews on google maps/i,
          })
        ).getAttribute('href'),
      ).toBe(VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL);
      cleanup();

      // Place identity mismatch hides unrelated name/rating/reviews
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mismatchNormalized = normalizeGooglePlaceResult(
        createSyntheticPlaceResponse({
          displayName: 'Wrong Business Elsewhere',
          rating: 1.2,
          userRatingCount: 999,
        }),
      );
      render(<GoogleReviewsSection fetchReviewsFn={async () => mismatchNormalized} />);
      expect(await screen.findByTestId('google-reviews-fallback-summary')).toBeTruthy();
      expect(screen.queryByText('Wrong Business Elsewhere')).toBeNull();
      expect(screen.queryByText('1.2')).toBeNull();
      expect(screen.queryByTestId('google-review-card')).toBeNull();
      warnSpy.mockRestore();
      cleanup();

      // Zero eligible reviews preserves valid rating header + empty explanation without fake cards
      const zeroReviewsNormalized = normalizeGooglePlaceResult(
        createSyntheticPlaceResponse({ reviews: [] }),
      );
      render(<GoogleReviewsSection fetchReviewsFn={async () => zeroReviewsNormalized} />);
      expect(await screen.findByTestId('google-reviews-empty-state')).toBeTruthy();
      expect(screen.getByTestId('google-reviews-aggregate-rating').textContent).toBe('4.8');
      expect(screen.queryByTestId('google-review-card')).toBeNull();
    });
  });

  describe('4. Interaction, Keyboard Navigation, Reduced Motion & LandingPage Placement', () => {
    it('supports carousel Prev/Next buttons, keyboard ArrowRight/ArrowLeft, and reduced-motion scrolling', async () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const scrollToSpy = vi.fn();
      const normalized = normalizeGooglePlaceResult(createSyntheticPlaceResponse());
      const user = userEvent.setup();

      render(<GoogleReviewsSection fetchReviewsFn={async () => normalized} />);

      const track = await screen.findByTestId('google-reviews-carousel-track');
      track.scrollTo = scrollToSpy;

      const prevBtn = screen.getByRole('button', { name: /previous google reviews/i });
      const nextBtn = screen.getByRole('button', { name: /next google reviews/i });

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(false);

      await user.click(nextBtn);
      await waitFor(() => {
        expect(track.getAttribute('data-active-index')).toBe('1');
      });
      expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
      expect(prevBtn.disabled).toBe(false);

      track.focus();
      await user.keyboard('{ArrowRight}');
      expect(track.getAttribute('data-active-index')).toBe('2');

      await user.keyboard('{ArrowLeft}');
      expect(track.getAttribute('data-active-index')).toBe('1');

      await user.click(prevBtn);
      expect(track.getAttribute('data-active-index')).toBe('0');

      // Mobile / container overflow safety checks
      const section = screen.getByTestId('google-reviews-section');
      expect(section.className).toContain('overflow-x-clip');
      expect(track.className).toContain('overflow-x-auto');
      const cards = screen.getAllByTestId('google-review-card');
      cards.forEach((card) => {
        expect(card.className).toContain('basis-full');
        expect(card.className).toContain('min-w-0');
      });
    });

    it('renders GoogleReviewsSection on LandingPage after Gallery and before Public Availability Teaser without breaking other sections', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>,
      );

      const galleryHeading = screen.getByRole('heading', {
        level: 2,
        name: /proof, not renders\./i,
      });
      const reviewsSection = await screen.findByTestId('google-reviews-section');
      const availabilityHeading = screen.getByRole('heading', {
        level: 2,
        name: /find your next open session\./i,
      });

      const gallerySection = galleryHeading.closest('section');
      const availabilitySection = availabilityHeading.closest('section');

      expect(
        Boolean(
          gallerySection.compareDocumentPosition(reviewsSection) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);
      expect(
        Boolean(
          reviewsSection.compareDocumentPosition(availabilitySection) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ).toBe(true);

      // Existing sections remain fully intact and interactive
      expect(screen.getByRole('heading', { level: 2, name: /send booking request/i })).toBeTruthy();
      expect(
        screen.getByRole('heading', { level: 2, name: /studio location & hours/i }),
      ).toBeTruthy();
    });
  });
});
