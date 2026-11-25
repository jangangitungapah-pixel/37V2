import { describe, expect, it } from 'vitest';

import {
  normalizeBookingPolicies,
  resolveBookingPolicyForService,
  validateBookingPolicies,
} from './utils/booking-policies-normalize';
import { validateClientReservationBackfillActor } from './services/client-reservation-backfill-service';

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

  it('requires an authenticated Owner for identity backfill execution', () => {
    expect(() => validateClientReservationBackfillActor('staff-uid', 'staff')).toThrow(
      'Hanya Owner',
    );
    expect(validateClientReservationBackfillActor('owner-uid', 'owner')).toBe('owner-uid');
  });
});
