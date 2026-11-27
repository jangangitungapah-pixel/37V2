import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { createInMemoryBookingRepositoryAdapter } from '@/features/admin/calendar/services/calendar-booking-service';
import { buildInvoiceNumber } from '@/features/admin/payment/utils/invoice-number';
import { AuthContext } from '@/features/auth/AuthContext';
import {
  createInMemoryPaymentEvidenceRepositoryAdapter,
  resetPaymentEvidenceRepositoryAdapter,
  setPaymentEvidenceRepositoryAdapter,
} from '@/features/payment-evidence/repositories/payment-evidence-repository';
import { submitClientPaymentEvidence } from '@/features/payment-evidence/services/payment-evidence-service';

import { createInMemoryClientBillingRepositoryAdapter, resetClientBillingRepositoryAdapter, setClientBillingRepositoryAdapter } from './billing/repositories/client-billing-repository';
import { ClientPortalHomePage } from './pages/ClientPortalHomePage';

const FIXED_NOW = new Date('2026-11-24T12:00:00+07:00');

function makeAuthValue({
  uid = 'client_overview_uid_1',
  customerId = 'cust_overview_1',
  displayName = 'Nadia Pratama',
  email = 'nadia@gmail.com',
  status = 'active',
} = {}) {
  return {
    status: 'authenticated',
    accountType: 'client',
    role: 'client',
    user: { uid, email, displayName },
    clientAccount: {
      uid,
      role: 'client',
      status,
      customerId,
      displayName,
      emailNormalized: email,
    },
    clientProfile: {
      customerId,
      displayName,
      phoneDisplay: '+62 812-3456-7890',
    },
  };
}

function makeClientBookingRecord({
  id,
  requestReference,
  status = BOOKING_REQUEST_STATUS.NEW,
  requestType = BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
  clientUid = 'client_overview_uid_1',
  customerId = 'cust_overview_1',
  serviceLabelSnapshot = 'Rehearsal',
  serviceOptionName = 'Reguler',
  bandName = 'Midnight Echo',
  preferredDate = '2026-11-26',
  preferredStartMinute = 900,
  preferredDurationMinutes = 120,
  requestedRoomId = 'room-a',
  requestedRoomLabel = 'Room A — Live Room',
  targetDeadline = null,
  createdAt = '2026-11-24T08:00:00.000Z',
  updatedAt = '2026-11-24T09:00:00.000Z',
  confirmedAt = null,
  confirmedBookingSnapshot = null,
} = {}) {
  return {
    id,
    schemaVersion: 1,
    requestReference: requestReference || `REQ-${id.toUpperCase()}`,
    requestType,
    status,
    statusReason: status === BOOKING_REQUEST_STATUS.DECLINED ? 'Room maintenance during slot' : '',
    customerName: 'Nadia Pratama',
    bandName,
    contactPhone: '+6281234567890',
    publicServiceId: requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? 'mix-master' : 'rehearsal',
    serviceLabelSnapshot,
    serviceOptionId: 'rehearsal-regular',
    serviceOptionName,
    requestedRoomId: requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? null : requestedRoomId,
    requestedRoomLabel,
    preferredDate: requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? null : preferredDate,
    preferredStartMinute:
      requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? null : preferredStartMinute,
    preferredDurationMinutes:
      requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? null : preferredDurationMinutes,
    targetDeadline,
    notes: '',
    source: BOOKING_REQUEST_SOURCES.CLIENT_PORTAL,
    clientUid,
    customerId,
    confirmedBookingSnapshot,
    createdAt,
    updatedAt,
    confirmedAt,
    version: 1,
  };
}

function makeRawInvoice({
  bookingId,
  customerId = 'cust_overview_1',
  invoiceStatus = 'issued',
  totalAmount = 500000,
  amountPaid = 0,
  balanceDue = 500000,
  paymentStatus = 'unpaid',
  bookingDate = '2026-11-25',
  dueDate = '2026-11-30',
  invoiceDate = '2026-11-24T09:00:00.000Z',
  serviceTypeName = 'Rehearsal',
  serviceOptionName = 'Reguler',
  clientPaymentEvidenceRequired = false,
} = {}) {
  return {
    id: `inv_${bookingId}`,
    invoiceNumber: buildInvoiceNumber({ bookingId, bookingDate }),
    bookingId,
    customerId,
    invoiceStatus,
    currency: 'IDR',
    clientPaymentEvidenceRequired,
    customerSnapshot: {
      name: 'Nadia Pratama',
      phone: '+6281234567890',
      bandName: 'Midnight Echo',
    },
    bookingSnapshot: {
      serviceTypeName,
      serviceOptionName,
      studioId: 'room-a',
      bookingDate,
      startMinute: 600,
      endMinute: 780,
      durationMinutes: 180,
    },
    financialSnapshot: {
      subtotal: totalAmount,
      discountAmount: 0,
      totalAmount,
    },
    amountPaid,
    balanceDue,
    paymentStatus,
    invoiceDate,
    dueDate,
    lastPaymentTransactionId: null,
    voidReason: invoiceStatus === 'void' ? 'Internal cancellation reason' : '',
    createdAt: invoiceDate,
    createdByUid: 'staff-secret-uid-1',
    updatedAt: invoiceDate,
    updatedByUid: 'owner-secret-uid-1',
    version: 1,
  };
}

function renderOverview({
  authValue = makeAuthValue(),
  now = FIXED_NOW,
  customBookingAdapter = null,
  customBillingAdapter = null,
  billingInitialLimit,
} = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route
            path="/portal"
            element={
              <ClientPortalHomePage
                now={now}
                customBookingAdapter={customBookingAdapter}
                customBillingAdapter={customBillingAdapter}
                billingInitialLimit={billingInitialLimit}
              />
            }
          />
          <Route path="/portal/book" element={<div data-testid="route-book">Book Page</div>} />
          <Route path="/portal/bookings" element={<div data-testid="route-bookings">My Bookings Page</div>} />
          <Route path="/portal/invoices" element={<div data-testid="route-invoices">Invoices Page</div>} />
          <Route path="/portal/profile" element={<div data-testid="route-profile">Profile Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Client Portal Overview — Account Snapshot, Real Billing, Next Session, Activity & Navigation', () => {
  let bookingAdapter;
  let bookingRequestAdapter;
  let clientBillingAdapter;
  let paymentEvidenceAdapter;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    bookingAdapter = createInMemoryBookingRepositoryAdapter();
    bookingRequestAdapter = createInMemoryBookingRequestRepositoryAdapter(bookingAdapter);
    clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({ bookingAdapter });
    paymentEvidenceAdapter = createInMemoryPaymentEvidenceRepositoryAdapter({ bookingAdapter });

    setBookingRepositoryAdapter(bookingAdapter);
    setBookingRequestRepositoryAdapter(bookingRequestAdapter);
    setClientBillingRepositoryAdapter(clientBillingAdapter);
    setPaymentEvidenceRepositoryAdapter(paymentEvidenceAdapter);
  });

  afterEach(() => {
    cleanup();
    resetClientBillingRepositoryAdapter();
    resetBookingRequestRepositoryAdapter();
    resetPaymentEvidenceRepositoryAdapter();
    resetBookingRepositoryAdapter();
  });

  it('counts confirmed upcoming sessions separately from pending requests, clarifies Next Session & Recent Activity, and keeps IDs private', async () => {
    bookingRequestAdapter._seedRequests([
      // 1. Two confirmed upcoming sessions (nearest one is 2026-11-25 14:00, further is 2026-11-28 19:00)
      makeClientBookingRecord({
        id: 'req_confirmed_later',
        requestReference: 'REQ-LATER02',
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        serviceLabelSnapshot: 'Recording',
        serviceOptionName: 'Tracking Reguler',
        bandName: 'Velvet Sun',
        confirmedAt: '2026-11-24T08:30:00.000Z',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_later',
          bookingReference: 'BKG_REF_LATER',
          studioId: 'room-b',
          studioName: 'Room B — Control + Booth',
          serviceTypeName: 'Recording',
          serviceOptionName: 'Tracking Reguler',
          date: '2026-11-28',
          startMinute: 1140,
          endMinute: 1320,
          durationMinutes: 180,
        },
      }),
      makeClientBookingRecord({
        id: 'req_confirmed_next',
        requestReference: 'REQ-NEXT001',
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        serviceLabelSnapshot: 'Rehearsal',
        serviceOptionName: 'Reguler',
        bandName: 'Midnight Echo',
        confirmedAt: '2026-11-24T10:15:00.000Z',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_next',
          bookingReference: 'BKG_REF_NEXT1',
          studioId: 'room-a',
          studioName: 'Room A — Live Room',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Reguler',
          date: '2026-11-25',
          startMinute: 840,
          endMinute: 960,
          durationMinutes: 120,
        },
      }),
      // 2. Confirmed session already in the past -> belongs to history, MUST NOT count in Upcoming
      makeClientBookingRecord({
        id: 'req_confirmed_past',
        requestReference: 'REQ-PAST001',
        status: BOOKING_REQUEST_STATUS.CONFIRMED,
        confirmedAt: '2026-11-20T09:00:00.000Z',
        confirmedBookingSnapshot: {
          bookingId: 'bkg_past',
          bookingReference: 'BKG_REF_PAST',
          studioId: 'room-a',
          studioName: 'Room A — Live Room',
          serviceTypeName: 'Rehearsal',
          serviceOptionName: 'Reguler',
          date: '2026-11-20',
          startMinute: 600,
          endMinute: 720,
          durationMinutes: 120,
        },
      }),
      // 3. Pending request (IN_REVIEW) -> counts ONLY in Requests Awaiting Confirmation, NEVER Upcoming
      makeClientBookingRecord({
        id: 'req_pending_1',
        requestReference: 'REQ-WAIT001',
        status: BOOKING_REQUEST_STATUS.IN_REVIEW,
        preferredDate: '2026-11-29',
        updatedAt: '2026-11-24T11:00:00.000Z',
      }),
      // 4. Declined request -> belongs to history, MUST NOT count in Upcoming or Requests
      makeClientBookingRecord({
        id: 'req_declined_1',
        requestReference: 'REQ-DECL001',
        status: BOOKING_REQUEST_STATUS.DECLINED,
        updatedAt: '2026-11-23T15:00:00.000Z',
      }),
      // 5. Other client's request -> isolated, never included
      makeClientBookingRecord({
        id: 'req_other_user',
        requestReference: 'REQ-SECRET9',
        clientUid: 'other_client_uid_99',
        customerId: 'cust_other_99',
        status: BOOKING_REQUEST_STATUS.NEW,
      }),
    ]);

    renderOverview();

    const upcomingCard = await screen.findByTestId('client-metric-upcoming-sessions');
    const requestsCard = screen.getByTestId('client-metric-pending-requests');
    const balanceCard = screen.getByTestId('client-metric-outstanding-balance');

    await waitFor(() => {
      expect(within(upcomingCard).getByText('2')).toBeTruthy();
      expect(within(requestsCard).getByText('1')).toBeTruthy();
      expect(within(balanceCard).getByText('Rp 0')).toBeTruthy();
    });

    expect(within(upcomingCard).getByText('Confirmed studio sessions scheduled ahead.')).toBeTruthy();
    expect(within(requestsCard).getByText('Waiting for confirmation from our studio team.')).toBeTruthy();
    expect(within(balanceCard).getByText("You're all caught up. No outstanding payments.")).toBeTruthy();

    // Next Session spotlight shows the nearest upcoming confirmed session
    const nextSection = screen.getByTestId('client-overview-next-session');
    expect(within(nextSection).getByText('Rehearsal · Reguler')).toBeTruthy();
    expect(within(nextSection).getByText('Midnight Echo')).toBeTruthy();
    expect(within(nextSection).getByText('BKG_REF_NEXT1')).toBeTruthy();
    expect(within(nextSection).getByText('Rabu, 25 November 2026')).toBeTruthy();
    expect(within(nextSection).getByText(/14:00 – 16:00 WIB \(2 jam\)/)).toBeTruthy();
    expect(within(nextSection).getByText('Room A — Live Room')).toBeTruthy();
    expect(within(nextSection).getByRole('link', { name: /View in My Bookings/i }).getAttribute('href')).toBe(
      '/portal/bookings',
    );

    // Recent Activity is readable without technical jargon and excludes other users
    const activitySection = screen.getByTestId('client-overview-recent-activity');
    expect(within(activitySection).getByText('Request under review')).toBeTruthy();
    expect(within(activitySection).getAllByText('Session confirmed').length).toBeGreaterThanOrEqual(1);
    expect(within(activitySection).getByText(/Rab, 25 Nov 2026/)).toBeTruthy();
    expect(
      within(activitySection).getAllByText(/Confirmed 24 Nov 2026/).length,
    ).toBeGreaterThanOrEqual(1);
    expect(activitySection.textContent).not.toContain('REQ-SECRET9');

    // Privacy check: internal customer/UID identifiers must never appear on Overview
    const home = screen.getByTestId('client-portal-home');
    expect(home.textContent).not.toContain('client_overview_uid_1');
    expect(home.textContent).not.toContain('cust_overview_1');
    expect(home.textContent).not.toContain('REQ-SECRET9');
    expect(home.textContent.toLowerCase()).not.toContain('firestore');
    expect(home.textContent.toLowerCase()).not.toContain('repository');
    expect(home.textContent.toLowerCase()).not.toContain('ledger');
  });

  it('aggregates Outstanding Balance strictly from issued owned invoices, surfaces overdue info, ignores void/draft/other customers and pending payment evidence', async () => {
    // 1. Unpaid overdue invoice: balanceDue 400,000
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_unpaid_overdue',
        totalAmount: 400000,
        amountPaid: 0,
        balanceDue: 400000,
        paymentStatus: 'unpaid',
        dueDate: '2026-11-22', // past FIXED_NOW 2026-11-24 -> overdue!
      }),
    );

    // 2. Partially paid invoice (not overdue): total 600,000, paid 250,000 -> balanceDue 350,000
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_partial_active',
        totalAmount: 600000,
        amountPaid: 250000,
        balanceDue: 350000,
        paymentStatus: 'partial',
        dueDate: '2026-11-28',
        clientPaymentEvidenceRequired: true,
      }),
    );

    // 3. Fully paid invoice -> contributes 0
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_fully_paid',
        totalAmount: 300000,
        amountPaid: 300000,
        balanceDue: 0,
        paymentStatus: 'paid',
        dueDate: '2026-11-20',
      }),
    );

    // 4. Void invoice -> MUST NOT contribute (even if raw fields have balanceDue)
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_void_ignored',
        invoiceStatus: 'void',
        totalAmount: 900000,
        amountPaid: 0,
        balanceDue: 900000,
        paymentStatus: 'unpaid',
        dueDate: '2026-11-18',
      }),
    );

    // 5. Draft invoice -> internal only, MUST NOT contribute
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_draft_ignored',
        invoiceStatus: 'draft',
        totalAmount: 800000,
        amountPaid: 0,
        balanceDue: 800000,
        paymentStatus: 'unpaid',
        dueDate: '2026-11-19',
      }),
    );

    // 6. Another customer's unpaid invoice -> MUST NOT contribute
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_other_cust',
        customerId: 'cust_other_person',
        totalAmount: 1500000,
        amountPaid: 0,
        balanceDue: 1500000,
        paymentStatus: 'unpaid',
        dueDate: '2026-11-18',
      }),
    );

    // Submit PENDING payment evidence for Rp 350.000 -> MUST NOT reduce Outstanding Balance (400k + 350k = 750k)!
    await submitClientPaymentEvidence({
      evidenceId: 'ev_pending_not_paid',
      invoiceId: 'inv_bkg_partial_active',
      claimedAmount: 350000,
      paymentMethod: 'transfer',
      claimedPaidAt: '2026-11-24',
      referenceNumber: 'TRF-001',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'studio37demo',
        cloudinaryPublicId: 'payment-evidence/ev_pending_not_paid',
        cloudinaryAssetId: 'asset_1',
        secureUrl:
          'https://res.cloudinary.com/studio37demo/image/upload/v1732400000/payment-evidence/ev_pending_not_paid.jpg',
        resourceType: 'image',
        format: 'jpg',
        width: 800,
        height: 1000,
        bytes: 64000,
      },
      actorUid: 'client_overview_uid_1',
      customerId: 'cust_overview_1',
      expectedCloudName: 'studio37demo',
      adapter: paymentEvidenceAdapter,
    });

    renderOverview();

    const balanceCard = await screen.findByTestId('client-metric-outstanding-balance');
    await waitFor(() => {
      expect(within(balanceCard).getByText('Rp 750.000')).toBeTruthy();
    });
    expect(within(balanceCard).getByText('2 invoices need payment · 1 overdue')).toBeTruthy();
    expect(screen.queryByTestId('client-overview-billing-truncation-notice')).toBeNull();
  });

  it('communicates truncated invoice totals honestly and allows loading more invoices cleanly', async () => {
    const user = userEvent.setup();

    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_trunc_1',
        totalAmount: 200000,
        balanceDue: 200000,
        invoiceDate: '2026-11-24T12:00:00.000Z',
        dueDate: '2026-11-30',
      }),
    );
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_trunc_2',
        totalAmount: 300000,
        balanceDue: 300000,
        invoiceDate: '2026-11-23T12:00:00.000Z',
        dueDate: '2026-11-30',
      }),
    );
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_trunc_3',
        totalAmount: 450000,
        balanceDue: 450000,
        invoiceDate: '2026-11-22T12:00:00.000Z',
        dueDate: '2026-11-30',
      }),
    );

    renderOverview({ billingInitialLimit: 2 });

    const balanceCard = await screen.findByTestId('client-metric-outstanding-balance');
    await waitFor(() => {
      expect(within(balanceCard).getByText('Rp 500.000')).toBeTruthy();
    });
    expect(
      within(balanceCard).getByText(/2 invoices need payment · Based on latest 2 loaded invoices/),
    ).toBeTruthy();
    expect(within(balanceCard).queryByText(/all caught up/i)).toBeNull();

    const truncationBanner = screen.getByTestId('client-overview-billing-truncation-notice');
    expect(truncationBanner.textContent).toContain('Balance shown reflects your latest 2 invoices.');

    await user.click(within(truncationBanner).getByRole('button', { name: /Load More Invoices/i }));

    await waitFor(() => {
      expect(within(balanceCard).getByText('Rp 950.000')).toBeTruthy();
    });
    expect(screen.queryByTestId('client-overview-billing-truncation-notice')).toBeNull();
  });

  it('shows honest Next Session states for pending-only requests and completely empty accounts', async () => {
    // 1. Pending request only -> confirms slot is NOT reserved until confirmed
    bookingRequestAdapter._seedRequests([
      makeClientBookingRecord({
        id: 'req_only_pending',
        requestReference: 'REQ-ONLYPEND',
        status: BOOKING_REQUEST_STATUS.NEW,
      }),
    ]);

    renderOverview();

    const nextSectionPending = await screen.findByTestId('client-overview-next-session');
    await waitFor(() => {
      expect(
        within(nextSectionPending).getByText('Your booking request is waiting for confirmation.'),
      ).toBeTruthy();
    });
    expect(
      within(nextSectionPending).getByText(/requested times are not reserved until confirmed/i),
    ).toBeTruthy();
    expect(
      within(nextSectionPending)
        .getByRole('link', { name: /View Requests in My Bookings/i })
        .getAttribute('href'),
    ).toBe('/portal/bookings');
    cleanup();

    // 2. Empty bookings & empty billing -> Book a Session CTA + calm empty Recent Activity
    const emptyBookingReqAdapter = createInMemoryBookingRequestRepositoryAdapter();
    setBookingRequestRepositoryAdapter(emptyBookingReqAdapter);
    renderOverview({ customBookingAdapter: emptyBookingReqAdapter });

    const nextSectionEmpty = await screen.findByTestId('client-overview-next-session');
    await waitFor(() => {
      expect(within(nextSectionEmpty).getByText('Ready for your next session?')).toBeTruthy();
    });
    expect(
      within(nextSectionEmpty).getByRole('link', { name: /Book a Session/i }).getAttribute('href'),
    ).toBe('/portal/book');

    const activitySection = screen.getByTestId('client-overview-recent-activity');
    expect(within(activitySection).getByText('No recent studio activity')).toBeTruthy();
  });

  it('navigates cleanly from all three Account Snapshot cards and all four Quick Access cards without nested links', async () => {
    const user = userEvent.setup();

    const checkMetricNavigation = async (cardTestId, expectedRouteTestId) => {
      renderOverview();
      const card = await screen.findByTestId(cardTestId);
      expect(card.tagName).toBe('A');
      expect(card.querySelector('a, button')).toBeNull();
      await user.click(card);
      expect(await screen.findByTestId(expectedRouteTestId)).toBeTruthy();
      cleanup();
    };

    await checkMetricNavigation('client-metric-upcoming-sessions', 'route-bookings');
    await checkMetricNavigation('client-metric-pending-requests', 'route-bookings');
    await checkMetricNavigation('client-metric-outstanding-balance', 'route-invoices');

    const quickAccessTargets = [
      { linkName: /Book a Session/i, index: 1, routeTestId: 'route-book' }, // index 0 is hero CTA
      { linkName: /My Bookings/i, index: 1, routeTestId: 'route-bookings' }, // index 0 is View My Bookings
      { linkName: /Invoices & Payments/i, index: 0, routeTestId: 'route-invoices' },
      { linkName: /My Profile/i, index: 0, routeTestId: 'route-profile' },
    ];

    for (const target of quickAccessTargets) {
      renderOverview();
      await screen.findByTestId('client-portal-home');
      const matches = screen.getAllByRole('link', { name: target.linkName });
      await user.click(matches[target.index]);
      expect(await screen.findByTestId(target.routeTestId)).toBeTruthy();
      cleanup();
    }
  });

  it('handles independent loading, independent failures, combined failures, and retry recovery without flashing false zeros', async () => {
    const user = userEvent.setup();

    // Case 1: One source loading while the other has already loaded (Bookings loading, Billing loaded; then Booking loaded, Billing loading)
    let pendingBookingCallbacks = null;
    const controllableBookingAdapter = {
      subscribeClientBookingRequests({ onData, onError }) {
        pendingBookingCallbacks = { onData, onError };
        return () => {};
      },
    };
    let pendingBillingCallbacks = null;
    const controllableBillingAdapter = {
      subscribeClientInvoices({ onData, onError }) {
        pendingBillingCallbacks = { onData, onError };
        return () => {};
      },
    };

    renderOverview({
      customBookingAdapter: controllableBookingAdapter,
      customBillingAdapter: controllableBillingAdapter,
    });

    // Both initially loading -> skeletons shown, NEVER '0' or 'Rp 0'
    expect(screen.getByTestId('client-overview-upcoming-skeleton')).toBeTruthy();
    expect(screen.getByTestId('client-overview-requests-skeleton')).toBeTruthy();
    expect(screen.getByTestId('client-overview-billing-skeleton')).toBeTruthy();
    expect(screen.queryByText('Rp 0')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();

    // Billing resolves FIRST with Rp 250.000 while bookings are STILL loading
    pendingBillingCallbacks.onData({
      invoices: [
        makeRawInvoice({
          bookingId: 'bkg_async_1',
          totalAmount: 250000,
          balanceDue: 250000,
          dueDate: '2026-11-30',
        }),
      ],
      hasMore: false,
      isTruncated: false,
      maxLimit: 100,
    });

    await waitFor(() => {
      expect(within(screen.getByTestId('client-metric-outstanding-balance')).getByText('Rp 250.000')).toBeTruthy();
    });
    expect(screen.getByTestId('client-overview-upcoming-skeleton')).toBeTruthy();
    expect(screen.getByTestId('client-overview-next-session-skeleton')).toBeTruthy();
    cleanup();

    // Case 2: Bookings succeed immediately while Billing is still loading (never flashes Rp 0)
    bookingRequestAdapter._seedRequests([
      makeClientBookingRecord({
        id: 'req_case2_1',
        status: BOOKING_REQUEST_STATUS.NEW,
      }),
    ]);
    renderOverview({ customBillingAdapter: controllableBillingAdapter });

    await waitFor(() => {
      expect(within(screen.getByTestId('client-metric-upcoming-sessions')).getByText('0')).toBeTruthy();
      expect(within(screen.getByTestId('client-metric-pending-requests')).getByText('1')).toBeTruthy();
    });
    expect(screen.getByTestId('client-overview-billing-skeleton')).toBeTruthy();
    expect(screen.queryByText('Rp 0')).toBeNull();
    cleanup();

    // Case 3: Bookings FAIL while Billing SUCCEEDS -> booking cards show '—', Next Session & Recent Activity show error, Billing works; booking Retry recovers
    clientBillingAdapter._seedInvoice(
      makeRawInvoice({
        bookingId: 'bkg_bill_ok',
        totalAmount: 550000,
        balanceDue: 550000,
        dueDate: '2026-11-30',
      }),
    );
    bookingRequestAdapter._setNextClientSubscribeError({
      code: 'unavailable',
      message: 'Booking stream offline',
    });

    renderOverview();

    const bookingErrBanner = await screen.findByTestId('client-overview-booking-error');
    expect(bookingErrBanner).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-upcoming-sessions')).getByText('—'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-pending-requests')).getByText('—'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-outstanding-balance')).getByText('Rp 550.000'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-overview-next-session')).getByText('Unable to load next session'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-overview-recent-activity')).getByText('Unable to load recent activity'),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Retry loading bookings/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('client-overview-booking-error')).toBeNull();
      expect(within(screen.getByTestId('client-metric-pending-requests')).getByText('1')).toBeTruthy();
    });
    cleanup();

    // Case 4: Bookings SUCCEED while Billing FAILS -> billing card shows '—' (never Rp 0!), no 'ledger' wording; billing Retry recovers
    clientBillingAdapter._setSimulatedError({ code: 'unavailable', message: 'Billing down' });

    renderOverview();

    const billingErrBanner = await screen.findByTestId('client-overview-billing-error');
    expect(billingErrBanner.textContent.toLowerCase()).not.toContain('ledger');
    expect(
      within(screen.getByTestId('client-metric-outstanding-balance')).getByText('—'),
    ).toBeTruthy();
    expect(within(screen.getByTestId('client-metric-outstanding-balance')).queryByText('Rp 0')).toBeNull();
    expect(within(screen.getByTestId('client-metric-pending-requests')).getByText('1')).toBeTruthy();

    clientBillingAdapter._setSimulatedError(null);
    await user.click(screen.getByRole('button', { name: /Retry loading billing information/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('client-overview-billing-error')).toBeNull();
      expect(
        within(screen.getByTestId('client-metric-outstanding-balance')).getByText('Rp 550.000'),
      ).toBeTruthy();
    });
    cleanup();

    // Case 5: Both FAIL simultaneously -> all 3 cards show '—', header says 'Unavailable', both retries recover cleanly
    bookingRequestAdapter._setNextClientSubscribeError({ code: 'unavailable', message: 'Down' });
    clientBillingAdapter._setSimulatedError({ code: 'unavailable', message: 'Down' });

    renderOverview();

    expect(await screen.findByTestId('client-overview-booking-error')).toBeTruthy();
    expect(await screen.findByTestId('client-overview-billing-error')).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-upcoming-sessions')).getByText('—'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-pending-requests')).getByText('—'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('client-metric-outstanding-balance')).getByText('—'),
    ).toBeTruthy();

    clientBillingAdapter._setSimulatedError(null);
    await user.click(screen.getByRole('button', { name: /Retry loading bookings/i }));
    await user.click(screen.getByRole('button', { name: /Retry loading billing information/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('client-overview-booking-error')).toBeNull();
      expect(screen.queryByTestId('client-overview-billing-error')).toBeNull();
      expect(within(screen.getByTestId('client-metric-outstanding-balance')).getByText('Rp 550.000')).toBeTruthy();
    });

    void pendingBookingCallbacks;
  });
});
