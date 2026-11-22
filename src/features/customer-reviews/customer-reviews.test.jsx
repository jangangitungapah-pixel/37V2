import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '@/App';
import { CustomerReviewsSection } from '@/components/landing/CustomerReviewsSection';
import { BookingDetailDrawer } from '@/features/admin/calendar/components/BookingDetailDrawer';
import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import { AuthContext } from '@/features/auth/AuthContext';
import {
  CUSTOMER_REVIEW_CONSENT_VERSION,
  CUSTOMER_REVIEW_LIMITS,
  CUSTOMER_REVIEW_STATUS,
  REVIEW_INVITATION_STATUS,
} from '@/features/customer-reviews/config/customer-review-config';
import { AdminCustomerReviewsPage } from '@/features/customer-reviews/pages/AdminCustomerReviewsPage';
import {
  createInMemoryCustomerReviewRepositoryAdapter,
  resetCustomerReviewRepositoryAdapter,
  setCustomerReviewRepositoryAdapter,
} from '@/features/customer-reviews/repositories/customer-review-repository';
import { moderateCustomerReview } from '@/features/customer-reviews/services/customer-review-moderation-service';
import {
  submitCustomerReview,
  validateAndLoadPublicInvitation,
} from '@/features/customer-reviews/services/customer-review-submission-service';
import {
  buildReviewInvitationWhatsAppMessage,
  buildReviewInvitationWhatsAppUrl,
  evaluateBookingReviewEligibility,
  issueReviewInvitation,
  resolveBookingReviewPanelState,
  revokeReviewInvitation,
} from '@/features/customer-reviews/services/review-invitation-service';
import {
  buildReviewInvitationUrl,
  generateReviewToken,
  hashReviewToken,
  isValidReviewTokenSyntax,
  isValidTokenHash,
} from '@/features/customer-reviews/utils/review-token';
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
import { PublicReviewSubmissionPage } from '@/features/public-reviews/pages/PublicReviewSubmissionPage';

function makeAuthValue({ uid = 'owner-1', role = 'owner', active = true } = {}) {
  return {
    user: uid ? { uid, email: `${role}@37music.id`, displayName: 'Studio User' } : null,
    profile: uid
      ? { uid, email: `${role}@37music.id`, displayName: 'Studio User', role, active }
      : null,
    status: uid ? 'authenticated' : 'unauthenticated',
    role,
    authError: '',
    lastReauthenticatedAt: null,
    login: vi.fn(),
    logout: vi.fn(),
    reauthenticate: vi.fn(),
    resetPassword: vi.fn(),
    clearAuthError: vi.fn(),
  };
}

function makeCompletedBooking(overrides = {}) {
  return {
    id: 'bkg_completed_1',
    customerId: 'cust_1',
    customerName: 'Nadia Pratama',
    phone: '081234567890',
    phoneNormalized: '+6281234567890',
    studioId: 'room-a',
    serviceId: 'rehearsal',
    serviceTypeId: 'rehearsal',
    serviceTypeName: 'Rehearsal Band',
    serviceLabel: 'Rehearsal Band',
    deliveryMode: 'studio',
    date: '2026-11-20',
    startMinute: 600,
    endMinute: 720,
    durationMinutes: 120,
    totalAmount: 200000,
    initialPaymentStatus: 'paid',
    initialPaidAmount: 200000,
    sessionStatus: BOOKING_SESSION_STATUS.COMPLETED,
    actualCompletedAt: '2026-11-20T05:05:00.000Z',
    version: 2,
    ...overrides,
  };
}

describe('Customer Review Management System (Invitations, Submission, Moderation & Landing Proof)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    setPublicSiteSettingsRepositoryAdapter(createInMemoryPublicSiteSettingsAdapter(null));
    setGalleryRepositoryAdapter(createInMemoryGalleryRepositoryAdapter([]));
    setLandingPagePlacementAdapter(createInMemoryLandingPagePlacementAdapter([]));
    setPublicAvailabilityRepositoryAdapter(
      createInMemoryPublicAvailabilityRepositoryAdapter({
        initialProjections: [],
        initialMetadata: { isReady: true, backfilledFromDate: '2026-01-01' },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    resetCustomerReviewRepositoryAdapter();
    resetPublicSiteSettingsRepositoryAdapter();
    resetGalleryRepositoryAdapter();
    resetLandingPagePlacementAdapter();
    resetPublicAvailabilityRepositoryAdapter();
    vi.restoreAllMocks();
  });

  describe('22.1 Token Generation & SHA-256 Privacy Hygiene', () => {
    it('generates high-entropy unique 64-hex tokens, hashes deterministically, and never persists raw tokens in Firestore docs', async () => {
      const tokenA = generateReviewToken();
      const tokenB = generateReviewToken();

      expect(isValidReviewTokenSyntax(tokenA)).toBe(true);
      expect(isValidReviewTokenSyntax(tokenB)).toBe(true);
      expect(tokenA).not.toBe(tokenB);
      expect(tokenA).toHaveLength(CUSTOMER_REVIEW_LIMITS.tokenHexLength);

      const hashA1 = await hashReviewToken(tokenA);
      const hashA2 = await hashReviewToken(tokenA);
      expect(isValidTokenHash(hashA1)).toBe(true);
      expect(hashA1).toBe(hashA2);
      expect(hashA1).not.toBe(tokenA);

      const url = buildReviewInvitationUrl(tokenA, 'https://studio37.web.app');
      expect(url).toBe(`https://studio37.web.app/review/${tokenA}`);

      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      const booking = makeCompletedBooking();
      adapter._seedBooking(booking);

      const issued = await issueReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'staff-1', role: 'staff', active: true },
        origin: 'https://studio37.web.app',
        adapter,
      });

      expect(issued.rawToken).toHaveLength(64);
      expect(issued.invitationUrl).toContain(`/review/${issued.rawToken}`);
      expect(issued.invitation.id).not.toBe(issued.rawToken);

      const state = adapter._inspectState();
      const rawJson = JSON.stringify({
        invitations: Array.from(state.invitationsMap.values()),
        indexes: Array.from(state.invitationIndexesMap.values()),
      });
      expect(rawJson).not.toContain(issued.rawToken);
      expect(rawJson).not.toContain('081234567890');
      expect(rawJson).not.toContain('+6281234567890');
      expect(rawJson).not.toContain('cust_1');
    });
  });

  describe('22.2 Booking Review Eligibility, Invitation Issuance, Rotation & Manual WhatsApp Flow', () => {
    it('enforces Completed + Studio + actualCompletedAt + Customer + Phone eligibility', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();

      const cases = [
        makeCompletedBooking({ id: 'b_upcoming', sessionStatus: BOOKING_SESSION_STATUS.UPCOMING }),
        makeCompletedBooking({
          id: 'b_cancelled',
          sessionStatus: BOOKING_SESSION_STATUS.CANCELLED,
        }),
        makeCompletedBooking({ id: 'b_noshow', sessionStatus: BOOKING_SESSION_STATUS.NO_SHOW }),
        makeCompletedBooking({ id: 'b_remote', deliveryMode: 'remote' }),
        makeCompletedBooking({ id: 'b_nots', actualCompletedAt: null }),
        makeCompletedBooking({ id: 'b_nocust', customerId: '' }),
        makeCompletedBooking({ id: 'b_nophone', phone: '', phoneNormalized: '' }),
      ];

      for (const b of cases) {
        expect(evaluateBookingReviewEligibility(b).isEligible).toBe(false);
        adapter._seedBooking(b);
        await expect(
          issueReviewInvitation({
            bookingId: b.id,
            actor: { uid: 'owner-1', role: 'owner', active: true },
            adapter,
          }),
        ).rejects.toThrow();
      }

      // Unauthenticated / inactive actors also rejected
      const eligible = makeCompletedBooking({ id: 'b_valid' });
      adapter._seedBooking(eligible);
      await expect(
        issueReviewInvitation({
          bookingId: eligible.id,
          actor: { uid: 'staff-1', role: 'staff', active: false },
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'review-invitation/unauthorized' });
    });

    it('rotates prior active invitation atomically, revokes active invitations, and formats manual WhatsApp Click-to-Chat URL', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      const booking = makeCompletedBooking({ id: 'b_rotate', phone: '0812-3456-7890' });
      adapter._seedBooking(booking);

      const first = await issueReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'staff-1', role: 'staff', active: true },
        origin: 'https://studio37.id',
        adapter,
      });

      const second = await issueReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'owner-1', role: 'owner', active: true },
        origin: 'https://studio37.id',
        adapter,
      });

      expect(second.rawToken).not.toBe(first.rawToken);
      const state = adapter._inspectState();
      expect(state.invitationsMap.get(first.invitation.id).status).toBe(
        REVIEW_INVITATION_STATUS.REVOKED,
      );
      expect(state.invitationsMap.get(second.invitation.id).status).toBe(
        REVIEW_INVITATION_STATUS.ACTIVE,
      );
      expect(state.invitationIndexesMap.get(booking.id).activeInvitationId).toBe(
        second.invitation.id,
      );

      // Revoking second active invitation makes its link invalid
      await revokeReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'owner-1', role: 'owner', active: true },
        adapter,
      });
      const checkRevoked = await validateAndLoadPublicInvitation({
        rawToken: second.rawToken,
        adapter,
      });
      expect(checkRevoked.state).toBe('revoked');

      const waMsg = buildReviewInvitationWhatsAppMessage({
        customerName: booking.customerName,
        reviewUrl: second.invitationUrl,
      });
      expect(waMsg).toContain('Halo Nadia Pratama!');
      expect(waMsg).toContain('37 Music Studio');
      expect(waMsg).toContain(second.invitationUrl);

      const waUrl = buildReviewInvitationWhatsAppUrl({
        phone: booking.phone,
        customerName: booking.customerName,
        reviewUrl: second.invitationUrl,
      });
      expect(waUrl.isValid).toBe(true);
      expect(waUrl.url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    });

    it('integrates cleanly in BookingDetailDrawer: shows ineligible state for upcoming booking and generates WhatsApp Share Dialog for Completed booking', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);
      const user = userEvent.setup();

      const upcoming = makeCompletedBooking({
        id: 'b_drawer_upcoming',
        sessionStatus: BOOKING_SESSION_STATUS.UPCOMING,
      });
      adapter._seedBooking(upcoming);

      const { rerender } = render(
        <MemoryRouter>
          <AuthContext.Provider value={makeAuthValue({ uid: 'staff-1', role: 'staff' })}>
            <BookingDetailDrawer booking={upcoming} open onOpenChange={vi.fn()} />
          </AuthContext.Provider>
        </MemoryRouter>,
      );

      const reviewSection = await screen.findByTestId('booking-customer-review-section');
      expect(
        within(reviewSection).getByText(
          /hanya dapat dibuat untuk sesi studio yang berstatus completed/i,
        ),
      ).toBeTruthy();
      expect(
        within(reviewSection).queryByRole('button', { name: /request customer review/i }),
      ).toBeNull();

      const completed = makeCompletedBooking({ id: 'b_drawer_completed' });
      adapter._seedBooking(completed);

      rerender(
        <MemoryRouter>
          <AuthContext.Provider value={makeAuthValue({ uid: 'staff-1', role: 'staff' })}>
            <BookingDetailDrawer booking={completed} open onOpenChange={vi.fn()} />
          </AuthContext.Provider>
        </MemoryRouter>,
      );

      const reqBtn = await screen.findByRole('button', { name: /request customer review/i });
      await user.click(reqBtn);

      const shareDialog = await screen.findByTestId('review-invitation-share-dialog');
      expect(shareDialog.textContent).toMatch(/bagikan link ulasan via whatsapp/i);
      const waCta = within(shareDialog).getByRole('link', { name: /open whatsapp/i });
      expect(waCta.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
      expect(within(shareDialog).getByDisplayValue(/\/review\/[0-9a-f]{64}/)).toBeTruthy();

      expect(
        resolveBookingReviewPanelState({
          booking: completed,
          invitation: null,
          review: null,
        }).key,
      ).toBe('not_invited');
    });
  });

  describe('22.3 Public Review Submission Workflow (/review/:token)', () => {
    it('loads valid invitation safely, validates form fields, submits pending review atomically, and blocks replay reuse', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);
      const user = userEvent.setup();

      const booking = makeCompletedBooking({ id: 'b_pub_1' });
      adapter._seedBooking(booking);

      const issued = await issueReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'owner-1', role: 'owner', active: true },
        adapter,
      });

      const { unmount } = render(
        <MemoryRouter initialEntries={[`/review/${issued.rawToken}`]}>
          <Routes>
            <Route path="/review/:token" element={<PublicReviewSubmissionPage />} />
          </Routes>
        </MemoryRouter>,
      );

      const form = await screen.findByTestId('public-customer-review-form');
      const contextBox = within(form).getByTestId('public-review-session-context');
      expect(contextBox.textContent).toContain('Rehearsal Band');
      expect(contextBox.textContent).toContain('Room A');
      // Never exposes private phone or booking/customer IDs on the public form
      expect(contextBox.textContent).not.toContain('081234567890');
      expect(contextBox.textContent).not.toContain('b_pub_1');
      expect(contextBox.textContent).not.toContain('cust_1');

      // Validation blocks incomplete form & unchecked consent
      await user.click(screen.getByRole('button', { name: /kirim ulasan studio/i }));
      expect(screen.getByText(/nama tampilan minimal 2 karakter/i)).toBeTruthy();
      expect(screen.getByText(/pilih rating bintang 1 sampai 5/i)).toBeTruthy();
      expect(screen.getByText(/ulasan minimal 10 karakter/i)).toBeTruthy();
      expect(screen.getByText(/wajib menyetujui publikasi ulasan/i)).toBeTruthy();

      // Fill valid customer submission
      await user.type(screen.getByLabelText(/nama tampilan publik/i), 'Raka — Midnight Static');
      await user.click(screen.getByRole('button', { name: '5 stars' }));
      await user.type(
        screen.getByLabelText(/ulasan tertulis/i),
        'Sound monitoring sangat jernih dan drum kit tertata rapi sepanjang sesi rehearsal.',
      );
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /kirim ulasan studio/i }));

      const successBanner = await screen.findByTestId('public-review-success');
      expect(successBanner.textContent).toContain('TERIMA KASIH ATAS ULASAN LO!');
      expect(successBanner.textContent).toContain('menunggu peninjauan');

      // Atomic verification in repository
      const state = adapter._inspectState();
      const reviewDoc = state.reviewsMap.get(booking.id);
      const invDoc = state.invitationsMap.get(issued.invitation.id);
      expect(reviewDoc.status).toBe(CUSTOMER_REVIEW_STATUS.PENDING);
      expect(reviewDoc.consentToPublish).toBe(true);
      expect(reviewDoc.consentVersion).toBe(CUSTOMER_REVIEW_CONSENT_VERSION);
      expect(invDoc.status).toBe(REVIEW_INVITATION_STATUS.SUBMITTED);
      expect(state.statsState.publishedCount).toBe(0);

      // Replay attempt on same route renders "already submitted"
      unmount();
      render(
        <MemoryRouter initialEntries={[`/review/${issued.rawToken}`]}>
          <Routes>
            <Route path="/review/:token" element={<PublicReviewSubmissionPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('public-review-state-submitted')).toBeTruthy();
      expect(screen.queryByTestId('public-customer-review-form')).toBeNull();
    });

    it('handles expired, invalid, permission-denied, and honeypot-filled submissions cleanly', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);

      // Expired invitation rendered as expired state
      const booking = makeCompletedBooking({ id: 'b_expired' });
      adapter._seedBooking(booking);
      const pastDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const issued = await issueReviewInvitation({
        bookingId: booking.id,
        actor: { uid: 'owner-1', role: 'owner', active: true },
        now: pastDate,
        adapter,
      });

      const { unmount } = render(
        <MemoryRouter initialEntries={[`/review/${issued.rawToken}`]}>
          <Routes>
            <Route path="/review/:token" element={<PublicReviewSubmissionPage />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByTestId('public-review-state-expired')).toBeTruthy();
      unmount();

      // Malformed / unknown token renders generic invalid state cleanly
      const unknownToken = generateReviewToken();
      render(
        <MemoryRouter initialEntries={[`/review/${unknownToken}`]}>
          <Routes>
            <Route path="/review/:token" element={<PublicReviewSubmissionPage />} />
          </Routes>
        </MemoryRouter>,
      );
      expect(await screen.findByTestId('public-review-state-invalid')).toBeTruthy();

      // Honeypot rejects automation silently
      const activeBooking = makeCompletedBooking({ id: 'b_honeypot' });
      adapter._seedBooking(activeBooking);
      const activeIssued = await issueReviewInvitation({
        bookingId: activeBooking.id,
        actor: { uid: 'owner-1', role: 'owner', active: true },
        adapter,
      });

      await expect(
        submitCustomerReview({
          rawToken: activeIssued.rawToken,
          honeypotValue: 'http://spam.invalid',
          formValues: {
            displayName: 'Bot User',
            rating: 5,
            reviewText: 'Spam submission text more than 10 chars.',
            consentToPublish: true,
          },
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'public-review/spam-deterrent' });
    });
  });

  describe('22.4 Owner Moderation Workflow & Atomic Aggregate Stats', () => {
    it('enforces Owner-only moderation transitions, immutable review text/consent, and atomic publicReviewStats updates', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);
      const user = userEvent.setup();

      const ownerActor = { uid: 'owner-1', role: 'owner', active: true };
      const staffActor = { uid: 'staff-1', role: 'staff', active: true };

      // Seed two bookings and customer submissions
      const b1 = makeCompletedBooking({ id: 'b_mod_1' });
      const b2 = makeCompletedBooking({ id: 'b_mod_2', customerName: 'Dito Synth' });
      adapter._seedBooking(b1);
      adapter._seedBooking(b2);

      const inv1 = await issueReviewInvitation({ bookingId: b1.id, actor: ownerActor, adapter });
      const inv2 = await issueReviewInvitation({ bookingId: b2.id, actor: ownerActor, adapter });

      await submitCustomerReview({
        rawToken: inv1.rawToken,
        formValues: {
          displayName: 'Nadia Band',
          rating: 5,
          reviewText: 'Kualitas ruangan dan sound engineering top banget untuk rekaman demo.',
          consentToPublish: true,
        },
        adapter,
      });
      await submitCustomerReview({
        rawToken: inv2.rawToken,
        formValues: {
          displayName: 'Dito Synth',
          rating: 4,
          reviewText: 'Nyaman banget untuk latihan band 3 jam tanpa kendala teknis.',
          consentToPublish: true,
        },
        adapter,
      });

      // Staff cannot moderate any review
      await expect(
        moderateCustomerReview({
          bookingId: b1.id,
          targetStatus: CUSTOMER_REVIEW_STATUS.PUBLISHED,
          actor: staffActor,
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'customer-review/owner-required' });

      // Invalid direct transition rejected (e.g., pending -> archived not allowed directly)
      await expect(
        moderateCustomerReview({
          bookingId: b1.id,
          targetStatus: CUSTOMER_REVIEW_STATUS.ARCHIVED,
          actor: ownerActor,
          adapter,
        }),
      ).rejects.toMatchObject({ code: 'customer-review/invalid-transition' });

      // Publish b2 via service (4 stars)
      await moderateCustomerReview({
        bookingId: b2.id,
        targetStatus: CUSTOMER_REVIEW_STATUS.PUBLISHED,
        actor: ownerActor,
        adapter,
      });
      expect(adapter._inspectState().statsState).toMatchObject({
        publishedCount: 1,
        ratingSum: 4,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
      });

      // Render AdminCustomerReviewsPage as Owner and publish b1 (5 stars) via UI
      render(
        <MemoryRouter initialEntries={['/admin/reviews']}>
          <AuthContext.Provider value={makeAuthValue({ uid: 'owner-1', role: 'owner' })}>
            <AdminCustomerReviewsPage />
          </AuthContext.Provider>
        </MemoryRouter>,
      );

      const row = await screen.findByTestId('admin-review-row-b_mod_1');
      await user.click(within(row).getByRole('button', { name: /publish/i }));

      const modal = await screen.findByTestId('review-moderation-dialog');
      expect(modal.textContent).toContain('Isi tulisan pelanggan tidak akan diubah');
      await user.click(within(modal).getByRole('button', { name: /ya, publikasikan ulasan/i }));

      await waitFor(() => {
        expect(adapter._inspectState().statsState.publishedCount).toBe(2);
      });

      const statsAfterPublish = adapter._inspectState().statsState;
      expect(statsAfterPublish.ratingSum).toBe(9);
      expect(statsAfterPublish.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 1,
        5: 1,
      });

      // Verify content & consent unchanged
      const publishedB1 = adapter._inspectState().reviewsMap.get(b1.id);
      expect(publishedB1.displayName).toBe('Nadia Band');
      expect(publishedB1.rating).toBe(5);
      expect(publishedB1.reviewText).toContain('Kualitas ruangan dan sound engineering top');
      expect(publishedB1.consentToPublish).toBe(true);

      // Archive b2 atomically decrements public stats
      await moderateCustomerReview({
        bookingId: b2.id,
        targetStatus: CUSTOMER_REVIEW_STATUS.ARCHIVED,
        actor: ownerActor,
        adapter,
      });
      expect(adapter._inspectState().statsState).toMatchObject({
        publishedCount: 1,
        ratingSum: 5,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      });
    });
  });

  describe('22.5 Landing Page First-Party Reviews & Legacy Deprecation', () => {
    it('displays ONLY published reviews, accurate publicReviewStats summary, Prev/Next carousel controls, and zero unapproved reviews', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);
      const user = userEvent.setup();

      const owner = { uid: 'owner-1', role: 'owner', active: true };
      const bookings = [1, 2, 3, 4].map((num) =>
        makeCompletedBooking({ id: `b_lp_${num}`, customerName: `Artist ${num}` }),
      );
      for (const b of bookings) adapter._seedBooking(b);

      const invs = [];
      for (const b of bookings) {
        invs.push(await issueReviewInvitation({ bookingId: b.id, actor: owner, adapter }));
      }

      // 1..3 Published, 4 stays Pending (must never appear publicly)
      await submitCustomerReview({
        rawToken: invs[0].rawToken,
        formValues: {
          displayName: 'Artist Published 1',
          rating: 5,
          reviewText: 'Publik review pertama yang mantap dan jernih.',
          consentToPublish: true,
        },
        adapter,
      });
      await submitCustomerReview({
        rawToken: invs[1].rawToken,
        formValues: {
          displayName: 'Artist Published 2',
          rating: 4,
          reviewText: 'Publik review kedua untuk latihan full band.',
          consentToPublish: true,
        },
        adapter,
      });
      await submitCustomerReview({
        rawToken: invs[2].rawToken,
        formValues: {
          displayName: 'Artist Published 3',
          rating: 5,
          reviewText: 'Publik review ketiga operator sangat membantu.',
          consentToPublish: true,
        },
        adapter,
      });
      await submitCustomerReview({
        rawToken: invs[3].rawToken,
        formValues: {
          displayName: 'Hidden Pending Musician',
          rating: 2,
          reviewText: 'Ini masih pending dan tidak boleh tampil di halaman utama.',
          consentToPublish: true,
        },
        adapter,
      });

      await moderateCustomerReview({
        bookingId: 'b_lp_1',
        targetStatus: CUSTOMER_REVIEW_STATUS.PUBLISHED,
        actor: owner,
        adapter,
      });
      await moderateCustomerReview({
        bookingId: 'b_lp_2',
        targetStatus: CUSTOMER_REVIEW_STATUS.PUBLISHED,
        actor: owner,
        adapter,
      });
      await moderateCustomerReview({
        bookingId: 'b_lp_3',
        targetStatus: CUSTOMER_REVIEW_STATUS.PUBLISHED,
        actor: owner,
        adapter,
      });

      // Set narrower viewport to exercise Prev/Next carousel buttons
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(
        <MemoryRouter>
          <CustomerReviewsSection />
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('customer-reviews-aggregate-card')).toBeTruthy();
      expect(screen.getByTestId('customer-reviews-average-rating').textContent).toBe('4.7');
      expect(screen.getByTestId('customer-reviews-published-count').textContent).toMatch(
        /3 published reviews/i,
      );

      const cards = screen.getAllByTestId('public-customer-review-card');
      expect(cards).toHaveLength(1);
      expect(screen.queryByText(/hidden pending musician/i)).toBeNull();

      // Advance carousel using Next button
      const nextBtn = screen.getByRole('button', { name: /next customer reviews/i });
      const prevBtn = screen.getByRole('button', { name: /previous customer reviews/i });
      expect(prevBtn.disabled).toBe(true);
      await user.click(nextBtn);
      expect(prevBtn.disabled).toBe(false);
    });

    it('honestly renders empty state without fake scores when zero reviews are published and renders clean Landing Page without deprecated Google or manual testimonials', async () => {
      const adapter = createInMemoryCustomerReviewRepositoryAdapter();
      setCustomerReviewRepositoryAdapter(adapter);

      const { container } = render(<App />);
      expect(await screen.findByTestId('customer-reviews-empty-state')).toBeTruthy();
      expect(screen.queryByTestId('customer-reviews-aggregate-card')).toBeNull();
      expect(screen.queryByTestId('verified-testimonials-section')).toBeNull();
      expect(container.textContent).not.toMatch(/Google Maps Reviews|ChIJfYXPy6P-aS4RFCRQptFpsVg/i);
    });
  });
});
