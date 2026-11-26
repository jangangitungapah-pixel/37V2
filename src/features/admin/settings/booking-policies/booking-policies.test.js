import { describe, expect, it } from 'vitest';

import {
  normalizeBookingPolicies,
  resolveBookingPolicyForService,
  validateBookingPolicies,
} from './utils/booking-policies-normalize';
import {
  buildClientReservationProjection,
  validateClientReservationBackfillActor,
} from './services/client-reservation-backfill-service';

describe('Booking Policies domain contracts', () => {
  it('resolves option override before service override and global defaults', () => {
    const policies = normalizeBookingPolicies({
      defaultDepositPolicy: {
        type: 'percentage',
        fixedAmount: 0,
        percentage: 20,
        calculationBase: 'total_amount',
      },
      serviceOverrides: {
        recording: {
          depositPolicy: {
            type: 'fixed',
            fixedAmount: 50000,
            percentage: 0,
            calculationBase: 'total_amount',
          },
        },
      },
      optionOverrides: {
        'rec-pro': {
          depositPolicy: {
            type: 'percentage',
            fixedAmount: 0,
            percentage: 60,
            calculationBase: 'subtotal',
          },
        },
      },
    });

    expect(resolveBookingPolicyForService(policies, 'rehearsal').depositPolicy).toMatchObject({
      type: 'percentage',
      percentage: 20,
    });
    expect(resolveBookingPolicyForService(policies, 'recording').depositPolicy).toMatchObject({
      type: 'fixed',
      fixedAmount: 50000,
    });
    expect(resolveBookingPolicyForService(policies, 'recording', 'rec-pro').depositPolicy).toMatchObject({
      type: 'percentage',
      percentage: 60,
      calculationBase: 'subtotal',
    });
  });

  it('fails closed when a fixed deposit policy is configured with zero amount', () => {
    const result = validateBookingPolicies({
      defaultDepositPolicy: {
        type: 'fixed',
        fixedAmount: 0,
        percentage: 0,
        calculationBase: 'total_amount',
      },
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.defaultDepositPolicy).toContain('lebih dari Rp0');
  });

  it('builds schema v2 customer-safe projections for both Client Portal bookings and CRM-linked walk-ins', () => {
    const projection = buildClientReservationProjection(
      {
        id: 'bkg_backfill_walkin',
        customerId: 'cust_linked_123',
        clientUid: '',
        bookingReference: 'BKG-WALKIN123',
        studioId: 'room-b',
        studioName: 'Room B — Control + Booth',
        serviceTypeName: 'Rehearsal',
        serviceOptionName: 'Regular',
        date: '2026-11-30',
        startMinute: 600,
        endMinute: 780,
        durationMinutes: 180,
        sessionStatus: 'completed',
        createdAt: { seconds: 1796000000 },
        version: 4,
        notes: 'Must not be included in projection',
        phoneNormalized: '+628123456789',
        commissionSnapshot: { ownerFee: 50000 },
      },
      {
        effectiveTotalAmount: 360000,
        paymentStatus: 'partial',
      },
      { seconds: 1796000000 },
    );

    expect(projection).toMatchObject({
      schemaVersion: 2,
      bookingId: 'bkg_backfill_walkin',
      customerId: 'cust_linked_123',
      clientUid: '',
      reservationStatus: 'confirmed',
      sessionStatus: 'completed',
      paymentStatus: 'partial',
      effectiveTotalAmount: 360000,
      version: 4,
    });
    expect(projection).not.toHaveProperty('notes');
    expect(projection).not.toHaveProperty('phoneNormalized');
    expect(projection).not.toHaveProperty('commissionSnapshot');
    expect(Object.keys(projection)).toHaveLength(27);

    expect(
      buildClientReservationProjection(
        {
          id: 'bkg_no_identity',
          customerId: '',
          clientUid: '',
          studioId: 'room-a',
          startMinute: 600,
          endMinute: 660,
          durationMinutes: 60,
        },
        null,
        { seconds: 1796000000 },
      ),
    ).toBeNull();
  });

  it('requires an authenticated Owner for identity backfill execution', () => {
    expect(() => validateClientReservationBackfillActor('staff-uid', 'staff')).toThrow(
      'Hanya Owner',
    );
    expect(validateClientReservationBackfillActor('owner-uid', 'owner')).toBe('owner-uid');
  });
});
