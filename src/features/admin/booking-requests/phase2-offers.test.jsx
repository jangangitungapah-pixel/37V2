import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BookingRequestDetailDrawer } from '@/features/admin/booking-requests/components/BookingRequestDetailDrawer';
import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
import {
  OFFER_MODES,
  OFFER_STATUSES,
} from '@/features/admin/booking-requests/schemas/offer-schema';
import {
  acceptClientOffer,
  createAndSendOffer,
  expireOffer,
  rejectClientOffer,
  staffRecordOfferResponse,
  withdrawOffer,
} from '@/features/admin/booking-requests/services/offer-service';
import { RESERVATION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  createReservationFromOffer,
} from '@/features/admin/calendar/services/calendar-booking-service';
import { expireReservationHold } from '@/features/admin/calendar/services/reservation-hold-service';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';
import {
  createInMemoryPaymentEvidenceRepositoryAdapter,
  resetPaymentEvidenceRepositoryAdapter,
  setPaymentEvidenceRepositoryAdapter,
} from '@/features/payment-evidence/repositories/payment-evidence-repository';
import {
  rejectClientPaymentEvidence,
  submitClientPaymentEvidence,
  verifyClientPaymentEvidence,
} from '@/features/payment-evidence/services/payment-evidence-service';
import { DEFAULT_BOOKING_POLICIES } from '@/features/admin/settings/booking-policies/config/booking-policies-config';
import {
  createInMemoryBookingPoliciesRepositoryAdapter,
  resetBookingPoliciesRepositoryAdapter,
  setBookingPoliciesRepositoryAdapter,
} from '@/features/admin/settings/booking-policies/repositories/booking-policies-repository';
import {
  buildDepositPolicySnapshot,
  computeDepositStatus,
  computeMinimumDepositAmount,
  DEPOSIT_STATUS,
  resolveBalanceDuePolicySnapshot,
  resolveEffectiveHoldDeadline,
} from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import {
  createInMemoryPricingSettingsAdapter,
  resetPricingSettingsRepositoryAdapter,
  setPricingSettingsRepositoryAdapter,
} from '@/features/admin/settings/pricing/repositories/pricing-settings-repository';
import { AuthContext } from '@/features/auth/AuthContext';
import { ClientBookingsPage } from '@/features/client-portal/pages/ClientBookingsPage';
import {
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
  createInMemoryPublicSiteSettingsAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';

function createSharedTestEnv({ requests = [], policies = null } = {}) {
  const calendarAdapter = createInMemoryBookingRepositoryAdapter([]);
  if (policies) {
    calendarAdapter._seedBookingPolicies(policies);
  }
  const requestAdapter = createInMemoryBookingRequestRepositoryAdapter(calendarAdapter, requests);
  const paymentAdapter = createInMemoryPaymentRepositoryAdapter(calendarAdapter);
  const evidenceAdapter = createInMemoryPaymentEvidenceRepositoryAdapter({
    bookingAdapter: calendarAdapter,
  });
  const policiesAdapter = createInMemoryBookingPoliciesRepositoryAdapter(policies);
  const pricingAdapter = createInMemoryPricingSettingsAdapter(DEFAULT_PRICING_SETTINGS);
  const siteAdapter = createInMemoryPublicSiteSettingsAdapter({ studioName: '37 Music Studio' });

  setBookingRepositoryAdapter(calendarAdapter);
  setBookingRequestRepositoryAdapter(requestAdapter);
  setPaymentRepositoryAdapter(paymentAdapter);
  setPaymentEvidenceRepositoryAdapter(evidenceAdapter);
  setBookingPoliciesRepositoryAdapter(policiesAdapter);
  setPricingSettingsRepositoryAdapter(pricingAdapter);
  setPublicSiteSettingsRepositoryAdapter(siteAdapter);

  return {
    calendarAdapter,
    requestAdapter,
    paymentAdapter,
    evidenceAdapter,
    policiesAdapter,
  };
}

function createSamplePortalRequest(overrides = {}) {
  return {
    id: 'req_portal_offer_1',
    schemaVersion: 1,
    requestReference: 'REQ-PORTAL01',
    requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
    status: BOOKING_REQUEST_STATUS.IN_REVIEW,
    statusReason: '',
    customerName: 'Raka Pratama',
    bandName: 'Gema Band',
    contactPhone: '+6281234567890',
    publicServiceId: 'rehearsal',
    serviceLabelSnapshot: 'Rehearsal',
    requestedRoomId: 'room-a',
    preferredDate: '2026-12-20',
    preferredStartMinute: 840,
    preferredDurationMinutes: 120,
    targetDeadline: null,
    notes: 'Butuh tambahan mic',
    privacyConsent: true,
    consentVersion: '2026-04-privacy-v1',
    source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
    clientUid: 'client-uid-1',
    customerId: 'cust_client_1',
    serviceOptionId: 'rehearsal-regular',
    serviceOptionName: 'Reguler',
    pricingVersion: 1,
    assignedStaffUid: 'staff-1',
    assignedStaffName: 'Admin Studio',
    linkedBookingId: null,
    confirmedBookingSnapshot: null,
    version: 1,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  resetBookingRepositoryAdapter();
  resetBookingRequestRepositoryAdapter();
  resetPaymentRepositoryAdapter();
  resetPaymentEvidenceRepositoryAdapter();
  resetBookingPoliciesRepositoryAdapter();
  resetPricingSettingsRepositoryAdapter();
  resetPublicSiteSettingsRepositoryAdapter();
});

describe('Phase 2 Booking Policy Runtime Engine & Offer Revisions', () => {
  it('A1/A2/A3: resolves policy precedence (option > service > default), DP math, WIB clamping, and fail-closed unconfigured TTL', () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'percentage', percentage: 25, fixedAmount: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 24, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
      defaultBalanceDuePolicy: { trigger: 'before_session', offsetHoursBeforeStart: 2 },
      serviceOverrides: {
        rehearsal: {
          depositPolicy: { type: 'fixed', fixedAmount: 50000, percentage: 0, calculationBase: 'total_amount' },
        },
      },
      optionOverrides: {
        'rehearsal-regular': {
          depositPolicy: { type: 'percentage', percentage: 50, fixedAmount: 0, calculationBase: 'subtotal' },
          holdPolicy: { defaultHours: 12, minMinutesBeforeSessionStart: 30, allowPerBookingOverride: true },
        },
      },
      version: 3,
    };

    const snap = buildDepositPolicySnapshot({
      policies,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'rehearsal-regular',
      subtotal: 200000,
      totalAmount: 180000,
    });
    expect(snap.policySource).toBe('option_override');
    expect(snap.minimumDepositAmount).toBe(100000);
    expect(computeMinimumDepositAmount({ totalAmount: 80000, depositPolicy: { type: 'fixed', fixedAmount: 150000 } })).toBe(80000);
    expect(computeDepositStatus({ depositType: 'percentage', minimumDepositAmount: 100000, amountPaid: 0 })).toBe(DEPOSIT_STATUS.AWAITING_DEPOSIT);
    expect(computeDepositStatus({ depositType: 'percentage', minimumDepositAmount: 100000, amountPaid: 40000 })).toBe(DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM);
    expect(computeDepositStatus({ depositType: 'percentage', minimumDepositAmount: 100000, amountPaid: 100000 })).toBe(DEPOSIT_STATUS.MET);

    // Clamping test: session starts at 2026-12-20 14:00 WIB (07:00Z); baseDate at 2026-12-20 10:00 WIB (03:00Z); 12h > 3.5h left before cutoff (13:30 WIB)
    const clamped = resolveEffectiveHoldDeadline({
      policies,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'rehearsal-regular',
      bookingDate: '2026-12-20',
      startMinute: 840,
      baseDate: new Date('2026-12-20T03:00:00.000Z'),
    });
    expect(clamped.wasClamped).toBe(true);
    expect(clamped.holdExpiresAtIso).toBe('2026-12-20T06:30:00.000Z'); // 13:30 WIB

    const balanceDue = resolveBalanceDuePolicySnapshot({
      policies,
      serviceTypeId: 'rehearsal',
      serviceOptionId: 'rehearsal-regular',
      bookingDate: '2026-12-20',
      startMinute: 840,
    });
    expect(balanceDue.dueDate).toBe('2026-12-20');

    // Fail-closed TTL check when defaultHours is null & no override supplied
    expect(() =>
      resolveEffectiveHoldDeadline({
        policies: DEFAULT_BOOKING_POLICIES,
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        bookingDate: '2026-12-20',
        startMinute: 840,
        baseDate: new Date('2026-12-19T03:00:00.000Z'),
      }),
    ).toThrow(/TTL/i);
  });

  it('B1/B2/B3/B4/B5: sends quote_only Offers, supersedes revisions (OD-13), blocks stale accept, converts exact accepted Offer & blocks mismatch', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'percentage', percentage: 50, fixedAmount: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 24, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
      version: 2,
    };
    const { calendarAdapter, requestAdapter } = createSharedTestEnv({
      requests: [createSamplePortalRequest()],
      policies,
    });

    const baseNow = new Date('2026-12-10T03:00:00.000Z');
    // 1. Send v1 (OFF-01)
    const v1 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_0001',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      pricingSettings: DEFAULT_PRICING_SETTINGS,
      bookingPolicies: policies,
      offerValidHours: 24,
      staffNoteToClient: 'Penawaran awal Room A',
      actorUid: 'staff-1',
      actorName: 'Admin Studio',
      now: baseNow,
      adapter: requestAdapter,
    });

    expect(v1.offer.offerNumber).toBe('OFF-01');
    expect(v1.offer.status).toBe(OFFER_STATUSES.SENT);
    // Does not occupy slots or public availability yet
    expect(calendarAdapter._inspectState().slots.size).toBe(0);
    expect(calendarAdapter._inspectState().publicAvailability.size).toBe(0);
    expect(requestAdapter._inspectState().requests.get('req_portal_offer_1').status).toBe(
      BOOKING_REQUEST_STATUS.OFFER_SENT,
    );

    // 2. Send v2 (OFF-02) -> v1 atomically marked superseded
    const v2 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_0002',
      previousOfferId: 'off_0001',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-b', date: '2026-12-20', startMinute: 900, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      pricingSettings: DEFAULT_PRICING_SETTINGS,
      bookingPolicies: policies,
      offerValidHours: 24,
      staffNoteToClient: 'Revisi pindah ke Room B 15:00 WIB',
      actorUid: 'staff-1',
      actorName: 'Admin Studio',
      now: new Date('2026-12-10T04:00:00.000Z'),
      adapter: requestAdapter,
    });

    expect(v2.offer.offerNumber).toBe('OFF-02');
    expect(v2.supersededCount).toBe(1);
    const v1After = requestAdapter._inspectState().offers.get('off_0001');
    expect(v1After.status).toBe(OFFER_STATUSES.SUPERSEDED);
    expect(v1After.supersededByOfferId).toBe('off_0002');

    // 3. Stale Client accept on v1 fails cleanly
    await expect(
      acceptClientOffer({
        requestId: 'req_portal_offer_1',
        offerId: 'off_0001',
        clientUid: 'client-uid-1',
        now: new Date('2026-12-10T05:00:00.000Z'),
        adapter: requestAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/stale-offer' });

    // 4. Client accepts v2 cleanly without writing canonical bookings/invoices
    const acceptedV2 = await acceptClientOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_0002',
      clientUid: 'client-uid-1',
      now: new Date('2026-12-10T05:00:00.000Z'),
      adapter: requestAdapter,
    });
    expect(acceptedV2.offer.status).toBe(OFFER_STATUSES.ACCEPTED);
    expect(calendarAdapter._inspectState().bookings.size).toBe(0);
    expect(calendarAdapter._inspectState().invoices.size).toBe(0);

    // 5. Staff conversion mismatch against accepted v2 fails cleanly
    await expect(
      createBooking({
        bookingId: 'bkg_mismatch',
        actorUid: 'staff-1',
        bookingRequestId: 'req_portal_offer_1',
        acceptedOfferId: 'off_0002',
        bookingPolicies: policies,
        now: new Date('2026-12-10T06:00:00.000Z'),
        formValues: {
          customerName: 'Raka Pratama',
          bandName: 'Gema Band',
          phone: '081234567890',
          studioId: 'room-a', // mismatch vs v2 room-b!
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'rehearsal-regular',
          date: '2026-12-20',
          startMinute: 900,
          durationPreset: '120',
          initialPaymentStatus: 'unpaid',
        },
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/payload-mismatch' });

    // 6. Staff converts exact accepted v2 -> Deposit Hold created atomically with immutable policy snapshot
    const createdHold = await createBooking({
      bookingId: 'bkg_offer_v2',
      actorUid: 'staff-1',
      bookingRequestId: 'req_portal_offer_1',
      acceptedOfferId: 'off_0002',
      bookingPolicies: policies,
      now: new Date('2026-12-10T06:00:00.000Z'),
      formValues: {
        customerName: 'Raka Pratama',
        bandName: 'Gema Band',
        phone: '081234567890',
        studioId: 'room-b',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-20',
        startMinute: 900,
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
      },
      adapter: calendarAdapter,
    });

    expect(createdHold.reservationStatus).toBe('deposit_hold');
    expect(createdHold.sessionStatus).toBe('pending_confirmation');
    expect(createdHold.acceptedOfferId).toBe('off_0002');
    expect(createdHold.minimumDepositAmount).toBe(v2.offer.depositPolicySnapshot.minimumDepositAmount);
    expect(calendarAdapter._inspectState().slots.size).toBe(4);
    expect(calendarAdapter._inspectState().bookingRequests.get('req_portal_offer_1').status).toBe(
      BOOKING_REQUEST_STATUS.CONFIRMED,
    );
  });

  it('B4/B6: enforces policy & mode guards on deposit_hold_offer, plus expired Offer, withdraw, and WA non-portal recording', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'fixed', fixedAmount: 50000, percentage: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 24, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
    };
    const publicReq = createSamplePortalRequest({
      id: 'req_wa_1',
      source: BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE,
      clientUid: '',
      customerId: '',
    });
    const { calendarAdapter, requestAdapter } = createSharedTestEnv({
      requests: [createSamplePortalRequest(), publicReq],
      policies,
    });

    // Unrecognized offerMode still fails closed
    await expect(
      createAndSendOffer({
        requestId: 'req_portal_offer_1',
        offerMode: 'invalid_mode',
        scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
        serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
        bookingPolicies: policies,
        actorUid: 'staff-1',
        adapter: requestAdapter,
        bookingAdapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/invalid-mode' });

    // No-deposit policy cannot issue deposit_hold_offer (must use quote_only)
    const noDepositPolicies = {
      ...policies,
      defaultDepositPolicy: { type: 'none', percentage: 0, fixedAmount: 0, calculationBase: 'total_amount' },
    };
    await expect(
      createAndSendOffer({
        requestId: 'req_portal_offer_1',
        offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
        scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
        serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
        bookingPolicies: noDepositPolicies,
        actorUid: 'staff-1',
        adapter: requestAdapter,
        bookingAdapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/deposit-not-required' });

    // B4: Expired deadline rejection, Withdraw, Manual Expire & Client Reject
    const sent = await createAndSendOffer({
      requestId: 'req_wa_1',
      offerId: 'off_wa_1',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      offerValidHours: 4,
      actorUid: 'staff-1',
      now: new Date('2026-12-10T01:00:00.000Z'),
      adapter: requestAdapter,
    });
    expect(sent.offer.status).toBe(OFFER_STATUSES.SENT);

    const withdrawn = await withdrawOffer({
      requestId: 'req_wa_1',
      offerId: 'off_wa_1',
      reason: 'Customer minta reschedule ke besok',
      actorUid: 'staff-1',
      adapter: requestAdapter,
    });
    expect(withdrawn.offer.status).toBe(OFFER_STATUSES.WITHDRAWN);

    const sent2 = await createAndSendOffer({
      requestId: 'req_wa_1',
      offerId: 'off_wa_2',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-a', date: '2026-12-21', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      offerValidHours: 4,
      actorUid: 'staff-1',
      now: new Date('2026-12-10T02:00:00.000Z'),
      adapter: requestAdapter,
    });
    expect(sent2.offer.offerNumber).toBe('OFF-02');

    // Past deadline staff response fails cleanly; expireOffer succeeds
    await expect(
      staffRecordOfferResponse({
        requestId: 'req_wa_1',
        offerId: 'off_wa_2',
        decision: OFFER_STATUSES.ACCEPTED,
        actorUid: 'staff-1',
        now: new Date('2026-12-11T00:00:00.000Z'),
        adapter: requestAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/expired' });

    const expired = await expireOffer({
      requestId: 'req_wa_1',
      offerId: 'off_wa_2',
      reason: 'Batas waktu penawaran terlewati',
      actorUid: 'staff-1',
      adapter: requestAdapter,
    });
    expect(expired.offer.status).toBe(OFFER_STATUSES.EXPIRED);

    // Client reject clears active sent offer back to in_review cleanly
    const portalSent = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_p_1',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-a', date: '2026-12-22', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      offerValidHours: 24,
      actorUid: 'staff-1',
      now: new Date('2026-12-10T02:00:00.000Z'),
      adapter: requestAdapter,
    });
    expect(portalSent.offer.status).toBe(OFFER_STATUSES.SENT);

    const rej = await rejectClientOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_p_1',
      clientUid: 'client-uid-1',
      responseReason: 'Jam terlalu pagi, minta sore',
      now: new Date('2026-12-10T03:00:00.000Z'),
      adapter: requestAdapter,
    });
    expect(rej.offer.status).toBe(OFFER_STATUSES.REJECTED);
    expect(requestAdapter._inspectState().requests.get('req_portal_offer_1').status).toBe(
      BOOKING_REQUEST_STATUS.IN_REVIEW,
    );
  });

  it('B7 (UI): Admin Offer Composer + Client Portal Offer Review end-to-end interaction with real state updates', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'fixed', fixedAmount: 50000, percentage: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 24, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
    };
    createSharedTestEnv({
      requests: [createSamplePortalRequest()],
      policies,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BookingRequestDetailDrawer
          requestId="req_portal_offer_1"
          open
          onOpenChange={vi.fn()}
          actorUid="staff-1"
          actorName="Admin Studio"
        />
      </MemoryRouter>,
    );

    const composer = await screen.findByTestId('offer-composer-card');
    expect(composer.textContent).toContain('OFF-01');

    // Submit Quote Offer from Admin UI
    await user.click(screen.getByTestId('send-offer-submit-button'));
    await waitFor(() => {
      expect(screen.getByTestId('offer-revision-item-OFF-01')).toBeTruthy();
    });

    // While OFF-01 is active Sent, direct raw Calendar convert shows pending notice
    expect(screen.getByTestId('pending-offer-conversion-notice')).toBeTruthy();

    // Render Client Portal My Bookings for the same Client user (in-memory store shares offer!)
    const { unmount } = render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { uid: 'client-uid-1', email: 'client@example.com' },
            clientAccount: { uid: 'client-uid-1', customerId: 'cust_client_1', status: 'active' },
            status: 'authenticated',
            role: 'client',
          }}
        >
          <ClientBookingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const reviewCard = await screen.findByTestId('client-offer-review-req_portal_offer_1');
    expect(reviewCard.textContent).toContain('OFF-01');
    expect(reviewCard.textContent).not.toContain('staff-1');

    const acceptBtn = within(reviewCard).getByRole('button', { name: /Accept Offer/i });
    await user.click(acceptBtn);

    await waitFor(() => {
      expect(reviewCard.textContent).toMatch(/Offer accepted/i);
    });
    unmount();

    // Back in Admin drawer, accepted Offer unlocks Convert to Calendar link with ?requestId=...&offerId=...
    const convertLink = await screen.findByTestId('convert-to-calendar-booking-link');
    expect(convertLink.getAttribute('href')).toContain('requestId=req_portal_offer_1');
    expect(convertLink.getAttribute('href')).toContain('offerId=');
  });

  it('B8 (Option A): Staff send deposit_hold_offer creates provisional hold + unpaid invoice -> Client accept -> DP proof verify auto-confirms hold & request', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'fixed', fixedAmount: 100000, percentage: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 12, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
      version: 3,
    };
    const { calendarAdapter, requestAdapter, evidenceAdapter } = createSharedTestEnv({
      requests: [createSamplePortalRequest()],
      policies,
    });

    const baseNow = new Date('2026-12-19T03:00:00.000Z');
    const sent = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_opt_a_01',
      offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      offerValidHours: 24,
      staffNoteToClient: 'Slot kami hold sementara sambil menunggu DP.',
      actorUid: 'staff-1',
      actorName: 'Admin Studio',
      now: baseNow,
      adapter: requestAdapter,
      bookingAdapter: calendarAdapter,
    });

    expect(sent.offer.offerMode).toBe(OFFER_MODES.DEPOSIT_HOLD_OFFER);
    expect(sent.offer.provisionalBookingId).toBe('bkg_offer_opt_a_01');
    expect(sent.offer.holdDeadline).toBeTruthy();
    expect(sent.booking.reservationStatus).toBe(RESERVATION_STATUS.DEPOSIT_HOLD);
    expect(sent.booking.acceptedOfferId).toBe('off_opt_a_01');
    expect(sent.invoice.id).toBe('inv_bkg_offer_opt_a_01');
    expect(sent.invoice.clientPaymentEvidenceRequired).toBe(true);
    expect(sent.invoice.amountPaid).toBe(0);

    const stateAfterSend = calendarAdapter._inspectState();
    expect(stateAfterSend.slots.size).toBe(4);
    expect(stateAfterSend.clientReservations.get('bkg_offer_opt_a_01')?.reservationStatus).toBe(
      RESERVATION_STATUS.DEPOSIT_HOLD,
    );
    expect(stateAfterSend.bookingRequests.get('req_portal_offer_1')?.status).toBe(
      BOOKING_REQUEST_STATUS.OFFER_SENT,
    );

    // Client accepts Offer without touching canonical bookings/invoices
    const accepted = await acceptClientOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_opt_a_01',
      expectedOfferVersion: sent.offer.version,
      clientUid: 'client-uid-1',
      now: new Date('2026-12-19T03:30:00.000Z'),
      adapter: requestAdapter,
    });
    expect(accepted.offer.status).toBe(OFFER_STATUSES.ACCEPTED);

    // Prevent double-booking via createReservationFromOffer while provisional hold already exists
    await expect(
      createReservationFromOffer({
        requestId: 'req_portal_offer_1',
        offerId: 'off_opt_a_01',
        actorUid: 'staff-1',
        formValues: {
          customerName: 'Raka Pratama',
          phone: '+6281234567890',
          studioId: 'room-a',
          date: '2026-12-20',
          startMinute: 840,
          durationPreset: 'custom',
          customDurationMinutes: 120,
          serviceTypeId: 'rehearsal',
          serviceOptionId: 'rehearsal-regular',
          initialPaymentStatus: 'unpaid',
          dpAmount: 0,
        },
        bookingPolicies: policies,
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'offer/provisional-booking-exists' });

    // Client immediately uploads DP proof -> Staff verifies -> Hold & Request both auto-confirm!
    const submitted = await submitClientPaymentEvidence({
      evidenceId: 'ev_opt_a_dp',
      invoiceId: 'inv_bkg_offer_opt_a_01',
      customerId: 'cust_client_1',
      actorUid: 'client-uid-1',
      claimedAmount: 100000,
      paymentMethod: 'qris',
      claimedPaidAt: '2026-12-19',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'demo',
        cloudinaryPublicId: 'evidence/dp-proof',
        cloudinaryAssetId: 'asset_dp_proof',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/evidence/dp-proof.png',
        resourceType: 'image',
        format: 'png',
        width: 800,
        height: 600,
        bytes: 12000,
      },
      expectedCloudName: 'demo',
      adapter: evidenceAdapter,
    });
    await verifyClientPaymentEvidence({
      evidenceId: submitted.evidence.id,
      expectedEvidenceVersion: submitted.evidence.version,
      expectedInvoiceVersion: sent.invoice.version,
      verifiedAmount: 100000,
      actorUid: 'staff-1',
      adapter: evidenceAdapter,
    });

    const finalState = calendarAdapter._inspectState();
    expect(finalState.bookings.get('bkg_offer_opt_a_01')?.reservationStatus).toBe(
      RESERVATION_STATUS.CONFIRMED,
    );
    expect(finalState.bookings.get('bkg_offer_opt_a_01')?.holdExpiresAt).toBeNull();
    expect(finalState.invoices.get('inv_bkg_offer_opt_a_01')?.amountPaid).toBe(100000);
    expect(finalState.clientReservations.get('bkg_offer_opt_a_01')?.reservationStatus).toBe(
      RESERVATION_STATUS.CONFIRMED,
    );
    expect(finalState.bookingRequests.get('req_portal_offer_1')?.status).toBe(
      BOOKING_REQUEST_STATUS.CONFIRMED,
    );
    expect(finalState.bookingRequests.get('req_portal_offer_1')?.linkedBookingId).toBe(
      'bkg_offer_opt_a_01',
    );
  });

  it('B9 (Option A): OD-09 shields provisional hold revision/withdraw under pending evidence; revise, downgrade to quote_only, withdraw & client reject release holds cleanly', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'fixed', fixedAmount: 100000, percentage: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 12, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
    };
    const { calendarAdapter, requestAdapter, evidenceAdapter } = createSharedTestEnv({
      requests: [createSamplePortalRequest()],
      policies,
    });

    const baseNow = new Date('2026-12-19T03:00:00.000Z');
    const v1 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_rev_h1',
      offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: baseNow,
      adapter: requestAdapter,
      bookingAdapter: calendarAdapter,
    });

    // Upload pending_review proof on v1's provisional invoice -> OD-09 blocks revise & withdraw!
    const pendingProof = await submitClientPaymentEvidence({
      evidenceId: 'ev_shield_h1',
      invoiceId: 'inv_bkg_offer_rev_h1',
      customerId: 'cust_client_1',
      actorUid: 'client-uid-1',
      claimedAmount: 100000,
      paymentMethod: 'transfer',
      claimedPaidAt: '2026-12-19',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'demo',
        cloudinaryPublicId: 'evidence/pending',
        cloudinaryAssetId: 'asset_pending',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/evidence/pending.png',
        resourceType: 'image',
        format: 'png',
        width: 800,
        height: 600,
        bytes: 8000,
      },
      expectedCloudName: 'demo',
      adapter: evidenceAdapter,
    });

    await expect(
      withdrawOffer({
        requestId: 'req_portal_offer_1',
        offerId: 'off_rev_h1',
        reason: 'Ingin ganti jadwal lain',
        actorUid: 'staff-1',
        adapter: requestAdapter,
        bookingAdapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'hold/pending-evidence-exists' });

    await expect(
      createAndSendOffer({
        requestId: 'req_portal_offer_1',
        offerId: 'off_rev_h2_blocked',
        previousOfferId: 'off_rev_h1',
        offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
        scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 900, durationMinutes: 120 },
        serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
        bookingPolicies: policies,
        actorUid: 'staff-1',
        now: baseNow,
        adapter: requestAdapter,
        bookingAdapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'hold/pending-evidence-exists' });

    // Reject proof to unlock OD-09, then revise v1 -> v2 overlapping slots 14:00-17:00
    await rejectClientPaymentEvidence({
      evidenceId: pendingProof.evidence.id,
      expectedEvidenceVersion: pendingProof.evidence.version,
      rejectionReason: 'Nominal transfer belum terbaca jelas',
      actorUid: 'staff-1',
      adapter: evidenceAdapter,
    });

    const v2 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_rev_h2',
      previousOfferId: 'off_rev_h1',
      expectedPreviousOfferVersion: v1.offer.version,
      offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 840, durationMinutes: 180 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: baseNow,
      adapter: requestAdapter,
      bookingAdapter: calendarAdapter,
    });
    expect(v2.offer.offerNumber).toBe('OFF-02');
    const afterV2 = calendarAdapter._inspectState();
    expect(afterV2.bookings.get('bkg_offer_rev_h1')?.reservationStatus).toBe(RESERVATION_STATUS.EXPIRED);
    expect(afterV2.invoices.get('inv_bkg_offer_rev_h1')?.invoiceStatus).toBe(INVOICE_STATUS.VOID);
    expect(afterV2.bookings.get('bkg_offer_rev_h2')?.reservationStatus).toBe(
      RESERVATION_STATUS.DEPOSIT_HOLD,
    );
    expect(afterV2.slots.size).toBe(6);

    // Client rejects v2 -> hold remains until Staff revises to quote_only (v3), releasing v2 hold cleanly
    await rejectClientOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_rev_h2',
      clientUid: 'client-uid-1',
      responseReason: 'Minta quotation dulu',
      now: baseNow,
      adapter: requestAdapter,
    });

    const v3 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_rev_q3',
      previousOfferId: 'off_rev_h2',
      offerMode: OFFER_MODES.QUOTE_ONLY,
      scheduleInput: { studioId: 'room-a', date: '2026-12-20', startMinute: 960, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: baseNow,
      adapter: requestAdapter,
      bookingAdapter: calendarAdapter,
    });
    expect(v3.offer.offerMode).toBe(OFFER_MODES.QUOTE_ONLY);
    expect(calendarAdapter._inspectState().bookings.get('bkg_offer_rev_h2')?.reservationStatus).toBe(
      RESERVATION_STATUS.EXPIRED,
    );
    expect(calendarAdapter._inspectState().slots.size).toBe(0);

    // Also verify manual hold expiry directly syncs active sent deposit_hold_offer
    const v4 = await createAndSendOffer({
      requestId: 'req_portal_offer_1',
      offerId: 'off_rev_h4',
      offerMode: OFFER_MODES.DEPOSIT_HOLD_OFFER,
      scheduleInput: { studioId: 'room-b', date: '2026-12-21', startMinute: 720, durationMinutes: 120 },
      serviceInput: { serviceTypeId: 'rehearsal', serviceOptionId: 'rehearsal-regular' },
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: baseNow,
      adapter: requestAdapter,
      bookingAdapter: calendarAdapter,
    });
    await expireReservationHold({
      bookingId: v4.booking.id,
      reason: 'Hold habis masa tunggu dari Ledger',
      actorUid: 'staff-1',
      adapter: calendarAdapter,
    });
    expect(calendarAdapter._inspectState().bookingRequestOffers.get('off_rev_h4')?.status).toBe(
      OFFER_STATUSES.EXPIRED,
    );
    expect(calendarAdapter._inspectState().bookingRequests.get('req_portal_offer_1')?.status).toBe(
      BOOKING_REQUEST_STATUS.IN_REVIEW,
    );
  });

  it('B10 (Option A UI): Staff selects Deposit Hold Offer (Opsi A) -> Admin drawer shows Hold Calendar link -> Client accepts & sees invoice upload notice', async () => {
    const policies = {
      ...DEFAULT_BOOKING_POLICIES,
      defaultDepositPolicy: { type: 'fixed', fixedAmount: 100000, percentage: 0, calculationBase: 'total_amount' },
      defaultHoldPolicy: { defaultHours: 12, minMinutesBeforeSessionStart: 60, allowPerBookingOverride: true },
    };
    createSharedTestEnv({
      requests: [
        createSamplePortalRequest({
          preferredDate: '2099-12-20',
        }),
      ],
      policies,
    });

    const user = userEvent.setup();
    const { unmount: unmountAdmin } = render(
      <MemoryRouter>
        <BookingRequestDetailDrawer
          requestId="req_portal_offer_1"
          open
          onOpenChange={vi.fn()}
          actorUid="staff-1"
          actorName="Admin Studio"
        />
      </MemoryRouter>,
    );

    await screen.findByTestId('offer-composer-card');
    await user.click(screen.getByRole('button', { name: /Deposit Hold Offer/i }));
    expect(screen.getByTestId('deposit-hold-offer-preview-notice')).toBeTruthy();
    await user.click(screen.getByTestId('send-offer-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('offer-revision-item-OFF-01').textContent).toContain(
        'Deposit Hold Offer',
      );
      expect(screen.getByTestId('open-provisional-hold-calendar-link')).toBeTruthy();
    });
    expect(screen.queryByTestId('convert-to-calendar-booking-link')).toBeNull();

    const { unmount: unmountClient } = render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { uid: 'client-uid-1', email: 'client@example.com' },
            clientAccount: { uid: 'client-uid-1', customerId: 'cust_client_1', status: 'active' },
            status: 'authenticated',
            role: 'client',
          }}
        >
          <ClientBookingsPage />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const reviewCard = await screen.findByTestId('client-offer-review-req_portal_offer_1');
    expect(reviewCard.textContent).toContain('Deposit Hold Offer');
    expect(screen.getByTestId('client-deposit-hold-invoice-notice-req_portal_offer_1')).toBeTruthy();

    await user.click(within(reviewCard).getByRole('button', { name: /Accept Offer/i }));
    await waitFor(() => {
      expect(reviewCard.textContent).toMatch(/submit your deposit payment proof in My Invoices/i);
    });
    unmountClient();
    unmountAdmin();
  });
});
