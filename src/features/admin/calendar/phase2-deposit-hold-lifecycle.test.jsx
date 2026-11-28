import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BOOKING_SESSION_STATUS,
  CONFIRMATION_SOURCES,
  RESERVATION_STATUS,
} from '@/features/admin/calendar/config/calendar-config';
import { BookingDetailDrawer } from '@/features/admin/calendar/components/BookingDetailDrawer';
import { CalendarBookingCard } from '@/features/admin/calendar/components/CalendarBookingCard';
import {
  resetBookingRepositoryAdapter,
  setBookingRepositoryAdapter,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  cancelBooking,
  createBooking,
  createInMemoryBookingRepositoryAdapter,
  transitionBookingSession,
} from '@/features/admin/calendar/services/calendar-booking-service';
import {
  confirmReservation,
  expireReservationHold,
  extendReservationHold,
  restoreExpiredReservation,
} from '@/features/admin/calendar/services/reservation-hold-service';
import { normalizeBookingReservationStatus } from '@/features/admin/calendar/utils/booking-time';
import { DASHBOARD_ATTENTION_TYPES } from '@/features/admin/dashboard/config/dashboard-config';
import { buildNeedsAttentionItems } from '@/features/admin/dashboard/utils/dashboard-calculations';
import {
  createInMemoryPaymentRepositoryAdapter,
  resetPaymentRepositoryAdapter,
  setPaymentRepositoryAdapter,
} from '@/features/admin/payment/repositories/payment-repository';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';
import {
  recordInvoicePayment,
  reversePaymentTransaction,
} from '@/features/admin/payment/services/payment-service';
import { voidInvoice } from '@/features/admin/payment/services/invoice-service';
import { DEFAULT_BOOKING_POLICIES } from '@/features/admin/settings/booking-policies/config/booking-policies-config';
import { DEPOSIT_STATUS } from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import { AuthContext } from '@/features/auth/AuthContext';
import { ClientInvoiceDetailDrawer } from '@/features/client-portal/billing/components/ClientInvoiceDetailDrawer';
import {
  createInMemoryClientBillingRepositoryAdapter,
  resetClientBillingRepositoryAdapter,
  setClientBillingRepositoryAdapter,
} from '@/features/client-portal/billing/repositories/client-billing-repository';
import { ClientBookingsPage } from '@/features/client-portal/pages/ClientBookingsPage';
import {
  createInMemoryBookingRequestRepositoryAdapter,
  resetBookingRequestRepositoryAdapter,
  setBookingRequestRepositoryAdapter,
} from '@/features/admin/booking-requests/repositories/booking-request-repository';
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
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';
import {
  createInMemoryPublicSiteSettingsAdapter,
  resetPublicSiteSettingsRepositoryAdapter,
  setPublicSiteSettingsRepositoryAdapter,
} from '@/features/public-site-settings/repositories/public-site-settings-repository';

function createPolicies({ type = 'fixed', fixedAmount = 100000, percentage = 0, defaultHours = 24 } = {}) {
  return {
    ...DEFAULT_BOOKING_POLICIES,
    defaultDepositPolicy: {
      type,
      fixedAmount,
      percentage,
      calculationBase: 'total_amount',
    },
    defaultHoldPolicy: {
      defaultHours,
      minMinutesBeforeSessionStart: 60,
      allowPerBookingOverride: true,
    },
    defaultBalanceDuePolicy: {
      trigger: 'before_session',
      offsetHoursBeforeStart: 2,
    },
    version: 1,
  };
}

function createSharedStack({ initialBookings = [], requests = [], policies = createPolicies() } = {}) {
  const calendarAdapter = createInMemoryBookingRepositoryAdapter(initialBookings);
  if (policies) calendarAdapter._seedBookingPolicies(policies);
  const paymentAdapter = createInMemoryPaymentRepositoryAdapter(calendarAdapter);
  const evidenceAdapter = createInMemoryPaymentEvidenceRepositoryAdapter({
    bookingAdapter: calendarAdapter,
  });
  const clientBillingAdapter = createInMemoryClientBillingRepositoryAdapter({
    bookingAdapter: calendarAdapter,
  });
  const requestAdapter = createInMemoryBookingRequestRepositoryAdapter(calendarAdapter, requests);
  const siteAdapter = createInMemoryPublicSiteSettingsAdapter({ studioName: '37 Music Studio' });

  setBookingRepositoryAdapter(calendarAdapter);
  setPaymentRepositoryAdapter(paymentAdapter);
  setPaymentEvidenceRepositoryAdapter(evidenceAdapter);
  setClientBillingRepositoryAdapter(clientBillingAdapter);
  setBookingRequestRepositoryAdapter(requestAdapter);
  setPublicSiteSettingsRepositoryAdapter(siteAdapter);

  return {
    calendarAdapter,
    paymentAdapter,
    evidenceAdapter,
    clientBillingAdapter,
    requestAdapter,
  };
}

function buildPortalRequest(id = 'req_hold_portal_1', clientUid = 'client-1') {
  return {
    id,
    schemaVersion: 1,
    requestReference: 'REQ-HOLD01',
    requestType: 'studio_booking',
    status: 'accepted',
    customerName: 'Sinta Dewi',
    bandName: 'Kala Band',
    contactPhone: '+6281299998888',
    publicServiceId: 'rehearsal',
    serviceLabelSnapshot: 'Rehearsal',
    requestedRoomId: 'room-a',
    preferredDate: '2026-12-22',
    preferredStartMinute: 720,
    preferredDurationMinutes: 120,
    privacyConsent: true,
    consentVersion: '2026-04-privacy-v1',
    source: 'client_portal',
    clientUid,
    customerId: `cust_${clientUid}`,
    serviceOptionId: 'rehearsal-regular',
    serviceOptionName: 'Reguler',
    linkedBookingId: null,
    version: 1,
  };
}

afterEach(() => {
  resetBookingRepositoryAdapter();
  resetPaymentRepositoryAdapter();
  resetPaymentEvidenceRepositoryAdapter();
  resetClientBillingRepositoryAdapter();
  resetBookingRequestRepositoryAdapter();
  resetPublicSiteSettingsRepositoryAdapter();
});

describe('Phase 2 Deposit Hold Lifecycle, OD-01..OD-10, Pending Evidence Shield & Legacy Parity', () => {
  it('C1/C2: DP requirement creates deposit_hold, blocks check-in/start, and promotes atomically when verified payment meets DP (OD-01)', async () => {
    const policies = createPolicies({ type: 'fixed', fixedAmount: 100000, defaultHours: 24 });
    const { calendarAdapter, paymentAdapter, evidenceAdapter } = createSharedStack({
      requests: [buildPortalRequest()],
      policies,
    });

    const holdBooking = await createBooking({
      bookingId: 'bkg_hold_1',
      actorUid: 'staff-1',
      bookingRequestId: 'req_hold_portal_1',
      bookingPolicies: policies,
      now: new Date('2026-12-10T03:00:00.000Z'),
      formValues: {
        customerName: 'Sinta Dewi',
        bandName: 'Kala Band',
        phone: '081299998888',
        studioId: 'room-a',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-22',
        startMinute: 720,
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
      },
      adapter: calendarAdapter,
    });

    expect(holdBooking.reservationStatus).toBe(RESERVATION_STATUS.DEPOSIT_HOLD);
    expect(holdBooking.sessionStatus).toBe(BOOKING_SESSION_STATUS.PENDING_CONFIRMATION);
    expect(holdBooking.depositStatus).toBe(DEPOSIT_STATUS.AWAITING_DEPOSIT);
    expect(calendarAdapter._inspectState().slots.size).toBe(4);
    expect(calendarAdapter._inspectState().publicAvailability.has('bkg_hold_1')).toBe(true);

    // Check-in and Start Session MUST fail while in Deposit Hold
    await expect(
      transitionBookingSession({
        bookingId: 'bkg_hold_1',
        action: 'check_in',
        actorUid: 'staff-1',
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'booking/deposit-hold-not-confirmed' });

    // Partial payment (50k < 100k) via evidence -> stays deposit_hold, updates partial_below_minimum
    await submitClientPaymentEvidence({
      evidenceId: 'ev_partial_1',
      invoiceId: 'inv_bkg_hold_1',
      claimedAmount: 50000,
      paymentMethod: 'transfer',
      claimedPaidAt: '2026-12-10',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'demo',
        cloudinaryPublicId: 'evidence/partial_1',
        cloudinaryAssetId: 'asset_partial_1',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/evidence/partial_1.jpg',
        resourceType: 'image',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 120000,
      },
      actorUid: 'client-1',
      customerId: 'cust_client-1',
      expectedCloudName: 'demo',
      adapter: evidenceAdapter,
    });

    // Submitting unverified evidence does NOT satisfy DP or confirm booking (OD-07)
    expect(calendarAdapter._inspectState().bookings.get('bkg_hold_1').reservationStatus).toBe('deposit_hold');
    expect(calendarAdapter._inspectState().bookings.get('bkg_hold_1').depositStatus).toBe('awaiting_deposit');

    await verifyClientPaymentEvidence({
      evidenceId: 'ev_partial_1',
      verifiedAmount: 50000,
      actorUid: 'staff-1',
      adapter: evidenceAdapter,
    });

    const afterPartial = calendarAdapter._inspectState().bookings.get('bkg_hold_1');
    expect(afterPartial.reservationStatus).toBe(RESERVATION_STATUS.DEPOSIT_HOLD);
    expect(afterPartial.sessionStatus).toBe(BOOKING_SESSION_STATUS.PENDING_CONFIRMATION);
    expect(afterPartial.depositStatus).toBe(DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM);

    // Second verified evidence brings paid to 100,000 == minimumDepositAmount -> atomically CONFIRMED!
    await submitClientPaymentEvidence({
      evidenceId: 'ev_partial_2',
      invoiceId: 'inv_bkg_hold_1',
      claimedAmount: 50000,
      paymentMethod: 'qris',
      claimedPaidAt: '2026-12-11',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'demo',
        cloudinaryPublicId: 'evidence/partial_2',
        cloudinaryAssetId: 'asset_partial_2',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/evidence/partial_2.jpg',
        resourceType: 'image',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 110000,
      },
      actorUid: 'client-1',
      customerId: 'cust_client-1',
      expectedCloudName: 'demo',
      adapter: evidenceAdapter,
    });

    await verifyClientPaymentEvidence({
      evidenceId: 'ev_partial_2',
      verifiedAmount: 50000,
      actorUid: 'staff-1',
      adapter: evidenceAdapter,
    });

    const confirmed = calendarAdapter._inspectState().bookings.get('bkg_hold_1');
    expect(confirmed.reservationStatus).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(confirmed.sessionStatus).toBe(BOOKING_SESSION_STATUS.UPCOMING);
    expect(confirmed.depositStatus).toBe(DEPOSIT_STATUS.MET);
    expect(confirmed.holdExpiresAt).toBeNull();
    expect(confirmed.confirmationSource).toBe(CONFIRMATION_SOURCES.DEPOSIT_VERIFIED);

    const clientProj = calendarAdapter._inspectState().clientReservations.get('bkg_hold_1');
    expect(clientProj.reservationStatus).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(clientProj.sessionStatus).toBe(BOOKING_SESSION_STATUS.UPCOMING);

    // Check-in succeeds once Confirmed
    const checkedIn = await transitionBookingSession({
      bookingId: 'bkg_hold_1',
      action: 'check_in',
      actorUid: 'staff-1',
      adapter: calendarAdapter,
    });
    expect(checkedIn.checkedInAt).toBeTruthy();

    // C5: Reversing payment below min DP sets depositIntegrityAlert WITHOUT reverting Confirmed -> deposit_hold
    const rev = await reversePaymentTransaction({
      invoiceId: 'inv_bkg_hold_1',
      originalTransactionId: 'pay_evidence_ev_partial_2',
      reason: 'Transfer kedua direfund parsial karena dobel transfer',
      actorUid: 'staff-1',
      adapter: paymentAdapter,
    });
    expect(rev.invoice.depositStatus).toBe(DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM);
    const afterReversal = calendarAdapter._inspectState().bookings.get('bkg_hold_1');
    expect(afterReversal.reservationStatus).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(afterReversal.depositIntegrityAlert).toBe(true);
    expect(afterReversal.depositStatus).toBe(DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM);
  });

  it('C4/D1: Staff override confirmation requires reason >=5 chars and Extend Hold increments count with WIB clamping (OD-08)', async () => {
    const policies = createPolicies({ type: 'fixed', fixedAmount: 100000, defaultHours: 24 });
    const { calendarAdapter } = createSharedStack({ policies });

    const holdBkg = await createBooking({
      bookingId: 'bkg_extend_1',
      actorUid: 'staff-1',
      bookingPolicies: policies,
      now: new Date('2026-12-10T03:00:00.000Z'),
      formValues: {
        customerName: 'Dian Sastro',
        phone: '081355556666',
        studioId: 'room-a',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-22',
        startMinute: 720,
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
      },
      adapter: calendarAdapter,
    });

    const extended = await extendReservationHold({
      bookingId: 'bkg_extend_1',
      expectedVersion: holdBkg.version,
      extensionHours: 48,
      reason: 'Customer sedang perjalanan ke ATM BCA',
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: new Date('2026-12-11T03:00:00.000Z'),
      adapter: calendarAdapter,
    });
    expect(extended.holdExtensionCount).toBe(1);
    expect(extended.holdLastExtensionReason).toBe('Customer sedang perjalanan ke ATM BCA');

    // Override confirm without reason fails
    await expect(
      confirmReservation({
        bookingId: 'bkg_extend_1',
        expectedVersion: extended.version,
        reason: 'ok',
        actorUid: 'staff-1',
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'hold/override-reason-required' });

    const confirmed = await confirmReservation({
      bookingId: 'bkg_extend_1',
      expectedVersion: extended.version,
      reason: 'Member reguler disetujui Owner bayar di studio',
      actorUid: 'staff-1',
      adapter: calendarAdapter,
    });
    expect(confirmed.reservationStatus).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(confirmed.confirmationSource).toBe(CONFIRMATION_SOURCES.STAFF_OVERRIDE);
    expect(confirmed.holdExpiresAt).toBeNull();
  });

  it('D2/D3/D4: enforces OD-09 Pending-Evidence Shield, unpaid void vs paid refund handoff on expiry, late payment block & live slot restore (OD-10)', async () => {
    const policies = createPolicies({ type: 'fixed', fixedAmount: 100000, defaultHours: 24 });
    const { calendarAdapter, paymentAdapter, evidenceAdapter } = createSharedStack({
      requests: [buildPortalRequest('req_shield_1', 'client-shield')],
      policies,
    });

    await createBooking({
      bookingId: 'bkg_shield_1',
      actorUid: 'staff-1',
      bookingRequestId: 'req_shield_1',
      bookingPolicies: policies,
      now: new Date('2026-12-10T03:00:00.000Z'),
      formValues: {
        customerName: 'Gita Gutawa',
        phone: '081277778888',
        studioId: 'room-a',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-24',
        startMinute: 720,
        durationPreset: '120',
        initialPaymentStatus: 'unpaid',
      },
      adapter: calendarAdapter,
    });

    // Client submits pending_review proof -> creates paymentEvidenceLock
    await submitClientPaymentEvidence({
      evidenceId: 'ev_shield_1',
      invoiceId: 'inv_bkg_shield_1',
      claimedAmount: 100000,
      paymentMethod: 'transfer',
      claimedPaidAt: '2026-12-10',
      evidenceAsset: {
        provider: 'cloudinary',
        cloudName: 'demo',
        cloudinaryPublicId: 'evidence/shield_1',
        cloudinaryAssetId: 'asset_shield_1',
        secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/evidence/shield_1.jpg',
        resourceType: 'image',
        format: 'jpg',
        width: 800,
        height: 600,
        bytes: 100000,
      },
      actorUid: 'client-shield',
      customerId: 'cust_client-shield',
      expectedCloudName: 'demo',
      adapter: evidenceAdapter,
    });

    expect(calendarAdapter._inspectState().paymentEvidenceLocks.get('inv_bkg_shield_1').pendingCount).toBe(1);

    // OD-09: Hold expiry & Invoice Void MUST BE BLOCKED while pending_review proof exists
    await expect(
      expireReservationHold({
        bookingId: 'bkg_shield_1',
        reason: 'Hold lewat batas waktu 24 jam',
        actorUid: 'staff-1',
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'hold/pending-evidence-exists' });

    await expect(
      voidInvoice({
        invoiceId: 'inv_bkg_shield_1',
        reason: 'Coba void saat ada bukti pending',
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'invoice/pending-evidence-exists' });

    // Reject proof cleanly -> decrements lock pendingCount to 0 without ref errors
    const rejectedEv = await rejectClientPaymentEvidence({
      evidenceId: 'ev_shield_1',
      rejectionReason: 'Nominal struk buram tidak terbaca',
      actorUid: 'staff-1',
      adapter: evidenceAdapter,
    });
    expect(rejectedEv.status).toBe(PAYMENT_EVIDENCE_STATUSES.REJECTED);
    expect(calendarAdapter._inspectState().paymentEvidenceLocks.get('inv_bkg_shield_1').pendingCount).toBe(0);

    // Unpaid Hold Expiry succeeds now: releases slots, removes publicAvailability, voids unpaid invoice
    const expired = await expireReservationHold({
      bookingId: 'bkg_shield_1',
      reason: 'Bukti ditolak & batas hold habis',
      actorUid: 'staff-1',
      adapter: calendarAdapter,
    });
    expect(expired.reservationStatus).toBe(RESERVATION_STATUS.EXPIRED);
    expect(calendarAdapter._inspectState().slots.size).toBe(0);
    expect(calendarAdapter._inspectState().publicAvailability.has('bkg_shield_1')).toBe(false);
    expect(calendarAdapter._inspectState().invoices.get('inv_bkg_shield_1').invoiceStatus).toBe(
      INVOICE_STATUS.VOID,
    );

    // OD-10: Late payment attempt after expiry is blocked cleanly
    await expect(
      recordInvoicePayment({
        invoiceId: 'inv_bkg_shield_1',
        amount: 100000,
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'payment/invoice-void' });

    // Conflict scenario on Restore: claim 1 slot with another booking -> Restore aborts cleanly!
    await createBooking({
      bookingId: 'bkg_blocker',
      actorUid: 'staff-1',
      bookingPolicies: { ...DEFAULT_BOOKING_POLICIES }, // no DP
      formValues: {
        customerName: 'Pesaing Slot',
        phone: '081111111111',
        studioId: 'room-a',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-24',
        startMinute: 720,
        durationPreset: '60',
        initialPaymentStatus: 'unpaid',
      },
      adapter: calendarAdapter,
    });

    await expect(
      restoreExpiredReservation({
        bookingId: 'bkg_shield_1',
        expectedVersion: expired.version,
        reason: 'Customer transfer ulang setelah expire',
        extensionHours: 12,
        bookingPolicies: policies,
        actorUid: 'staff-1',
        now: new Date('2026-12-12T03:00:00.000Z'),
        adapter: calendarAdapter,
      }),
    ).rejects.toMatchObject({ code: 'hold/restore-slot-conflict' });

    // Cancel blocker freeing the slots -> Restore succeeds atomically & unvoids invoice!
    await cancelBooking({
      bookingId: 'bkg_blocker',
      actorUid: 'staff-1',
      reason: 'Pindah jadwal',
      adapter: calendarAdapter,
    });

    const restored = await restoreExpiredReservation({
      bookingId: 'bkg_shield_1',
      expectedVersion: expired.version,
      reason: 'Slot kembali kosong dan customer konfirmasi transfer',
      extensionHours: 12,
      bookingPolicies: policies,
      actorUid: 'staff-1',
      now: new Date('2026-12-12T03:00:00.000Z'),
      adapter: calendarAdapter,
    });
    expect(restored.reservationStatus).toBe(RESERVATION_STATUS.DEPOSIT_HOLD);
    expect(calendarAdapter._inspectState().slots.get('2026-12-24__room-a__720')?.bookingId).toBe(
      'bkg_shield_1',
    );
    expect(calendarAdapter._inspectState().invoices.get('inv_bkg_shield_1').invoiceStatus).toBe(
      INVOICE_STATUS.ISSUED,
    );

    // Paid Hold Expiry scenario -> opens refundCases handoff and leaves invoice/payments intact!
    const paidHold = await createBooking({
      bookingId: 'bkg_paid_hold',
      actorUid: 'staff-1',
      bookingPolicies: policies,
      now: new Date('2026-12-10T03:00:00.000Z'),
      formValues: {
        customerName: 'Budi Doremi',
        phone: '081988887777',
        studioId: 'room-b',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-26',
        startMinute: 780,
        durationPreset: '120',
        initialPaymentStatus: 'partial',
        dpAmount: 40000, // < 100k min DP -> still stays in deposit_hold!
        paymentMethod: 'cash',
      },
      adapter: calendarAdapter,
    });
    expect(paidHold.reservationStatus).toBe(RESERVATION_STATUS.DEPOSIT_HOLD);
    expect(paidHold.depositStatus).toBe(DEPOSIT_STATUS.PARTIAL_BELOW_MINIMUM);

    const expiredPaid = await expireReservationHold({
      bookingId: 'bkg_paid_hold',
      reason: 'Sisa DP tidak dilengkapi hingga tenggat',
      actorUid: 'staff-1',
      adapter: calendarAdapter,
    });
    expect(expiredPaid.reservationStatus).toBe(RESERVATION_STATUS.EXPIRED);
    expect(calendarAdapter._inspectState().invoices.get('inv_bkg_paid_hold').invoiceStatus).toBe(
      INVOICE_STATUS.ISSUED,
    );
    const refundCase = calendarAdapter._inspectState().refundCases.get('ref_bkg_paid_hold_expired');
    expect(refundCase).toMatchObject({
      bookingId: 'bkg_paid_hold',
      triggerCategory: 'hold_expired_partial_paid',
      maxRefundableAmount: 40000,
      status: 'under_review',
    });

    // OD-10: Paid expired booking blocks direct payment until explicitly restored
    await expect(
      recordInvoicePayment({
        invoiceId: 'inv_bkg_paid_hold',
        amount: 60000,
        actorUid: 'staff-1',
        adapter: paymentAdapter,
      }),
    ).rejects.toMatchObject({ code: 'payment/booking-hold-expired' });
  });

  it('F1 & UI: supports V1 legacy fallback, Dashboard overdue hold alert, HoldLifecyclePanel pending shield, and ClientInvoiceDetailDrawer DP gap', async () => {
    const policies = createPolicies({ type: 'fixed', fixedAmount: 100000, defaultHours: 24 });
    const legacySeed = {
      id: 'bkg_v1_legacy',
      customerName: 'Band V1 Lama',
      phone: '081200001111',
      studioId: 'room-a',
      serviceId: 'rehearsal',
      serviceLabel: 'Rehearsal',
      date: '2026-12-28',
      startMinute: 600,
      durationMinutes: 60,
      endMinute: 660,
      totalAmount: 120000,
      sessionStatus: 'upcoming',
    };
    const { calendarAdapter, clientBillingAdapter, evidenceAdapter } = createSharedStack({
      initialBookings: [legacySeed],
      policies,
    });

    // Legacy read-time fallback: normalized as confirmed, works normally without migration
    expect(normalizeBookingReservationStatus(legacySeed)).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(calendarAdapter._inspectState().rawBookings.get('bkg_v1_legacy').reservationStatus).toBeUndefined();

    // Create Hold booking with overdue deadline & verify Dashboard calculation surfaces it cleanly
    const holdBooking = await createBooking({
      bookingId: 'bkg_ui_hold',
      actorUid: 'staff-1',
      bookingPolicies: policies,
      now: new Date('2026-12-10T01:00:00.000Z'), // expires 2026-12-11T01:00Z
      formValues: {
        customerName: 'Band Hold Overdue',
        phone: '081244445555',
        studioId: 'room-b',
        serviceTypeId: 'rehearsal',
        serviceOptionId: 'rehearsal-regular',
        date: '2026-12-28',
        startMinute: 780,
        durationPreset: '120',
        initialPaymentStatus: 'partial',
        dpAmount: 40000,
        paymentMethod: 'transfer',
      },
      adapter: calendarAdapter,
    });

    const attention = buildNeedsAttentionItems({
      depositHoldBookings: [holdBooking],
      now: new Date('2026-12-12T05:00:00.000Z'), // clearly past holdExpiresAt!
    });
    expect(attention.some((a) => a.type === DASHBOARD_ATTENTION_TYPES.OVERDUE_DEPOSIT_HOLDS)).toBe(true);

    // Calendar card shows Hold amber styling & BookingDetailDrawer renders HoldLifecyclePanel
    const { unmount: unmountCard } = render(
      <CalendarBookingCard booking={holdBooking} onSelectBooking={vi.fn()} />,
    );
    expect(screen.getByRole('button').className).toContain('border-dashed');
    unmountCard();

    // Seed pending evidence on inv_bkg_ui_hold -> Expire button disabled cleanly in BookingDetailDrawer!
    calendarAdapter._seedPaymentEvidence('ev_ui_pending', {
      id: 'ev_ui_pending',
      invoiceId: 'inv_bkg_ui_hold',
      bookingId: 'bkg_ui_hold',
      customerId: holdBooking.customerId,
      status: 'pending_review',
      claimedAmount: 60000,
    });

    const { unmount: unmountDrawer } = render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{ user: { uid: 'staff-1' }, profile: { uid: 'staff-1', role: 'staff' }, role: 'staff' }}
        >
          <BookingDetailDrawer
            booking={holdBooking}
            open
            onOpenChange={vi.fn()}
            onLifecycleAction={vi.fn()}
            actorUid="staff-1"
            now={new Date('2026-12-12T05:00:00.000Z')}
          />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const holdPanel = await screen.findByTestId('hold-lifecycle-panel');
    expect(holdPanel.textContent).toMatch(/Hold Overdue/i);
    await waitFor(() => {
      expect(screen.getByTestId('pending-evidence-shield-banner')).toBeTruthy();
    });
    expect(screen.getByTestId('expire-hold-button').disabled).toBe(true);
    unmountDrawer();

    // ClientInvoiceDetailDrawer clearly shows verified partial DP gap: "Pay Rp 60.000 more" (OD-07)
    const inv = calendarAdapter._inspectState().invoices.get('inv_bkg_ui_hold');
    const { unmount: unmountInv } = render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { uid: 'client-ui' },
            clientAccount: { uid: 'client-ui', customerId: holdBooking.customerId, status: 'active' },
            role: 'client',
          }}
        >
          <ClientInvoiceDetailDrawer
            invoiceId={inv.id}
            fallbackInvoice={inv}
            customAdapter={clientBillingAdapter}
            customEvidenceAdapter={evidenceAdapter}
            open
            onOpenChange={vi.fn()}
            studioName="37 Music Studio"
            referenceDateIso="2026-12-12"
          />
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    const gapBanner = await screen.findByTestId('client-invoice-deposit-gap-banner');
    expect(gapBanner.textContent).toMatch(/60\.000/);
    unmountInv();

    // Client Portal bookings page shows Deposit Hold warning with NO client hold-extension button (OD-08)
    calendarAdapter._seedClientReservation('bkg_ui_hold', {
      schemaVersion: 2,
      bookingId: 'bkg_ui_hold',
      bookingReference: 'BKG-UIHOLD',
      customerId: holdBooking.customerId,
      clientUid: 'client-ui',
      invoiceId: 'inv_bkg_ui_hold',
      studioId: 'room-b',
      studioName: 'Room B — Control + Booth',
      serviceTypeName: 'Rehearsal',
      serviceOptionName: 'Reguler',
      date: '2026-12-28',
      startMinute: 780,
      endMinute: 900,
      durationMinutes: 120,
      timeZone: 'Asia/Jakarta',
      reservationStatus: 'deposit_hold',
      sessionStatus: 'pending_confirmation',
      holdExpiresAt: holdBooking.holdExpiresAt,
      effectiveTotalAmount: holdBooking.totalAmount,
      minimumDepositAmount: 100000,
      depositStatus: 'partial_below_minimum',
      paymentStatus: 'partial',
      createdAt: holdBooking.createdAt,
      updatedAt: holdBooking.updatedAt,
      version: 1,
    });

    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: { uid: 'client-ui' },
            clientAccount: { uid: 'client-ui', customerId: holdBooking.customerId, status: 'active' },
            status: 'authenticated',
            role: 'client',
          }}
        >
          <ClientBookingsPage now={new Date('2026-12-12T05:00:00.000Z')} />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const clientHoldBanner = await screen.findByTestId('client-deposit-hold-banner-bkg_ui_hold');
    expect(clientHoldBanner.textContent).toMatch(/Open Invoice & Pay Deposit/i);
    expect(screen.queryByRole('button', { name: /extend hold/i })).toBeNull();
  });
});
