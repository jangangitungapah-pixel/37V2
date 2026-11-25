import { describe, expect, it } from 'vitest';

import { DEFAULT_PRICING_SETTINGS } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { PUBLIC_PRICING_CATALOG_SCHEMA_VERSION } from './config/public-pricing-config';
import {
  buildPublicPricingProjection,
  normalizePublicPricingCatalog,
} from './utils/public-pricing-projection';

describe('Public pricing catalog schema v4', () => {
  it('publishes deposit previews without exposing internal fees', () => {
    const catalog = buildPublicPricingProjection(DEFAULT_PRICING_SETTINGS, {
      catalogVersion: 7,
      bookingPolicies: {
        version: 3,
        defaultDepositPolicy: {
          type: 'fixed',
          fixedAmount: 75000,
          percentage: 0,
          calculationBase: 'total_amount',
        },
        defaultBalanceDuePolicy: {
          trigger: 'before_session',
          offsetHoursBeforeStart: 0,
        },
        serviceOverrides: {
          rehearsal: {
            balanceDuePolicy: {
              trigger: 'at_check_in',
              offsetHoursBeforeStart: 0,
            },
          },
        },
      },
    });

    expect(PUBLIC_PRICING_CATALOG_SCHEMA_VERSION).toBe(4);
    expect(catalog.schemaVersion).toBe(4);
    expect(catalog.policyVersion).toBe(3);

    const rehearsal = catalog.serviceTypes.find((service) => service.id === 'rehearsal');
    expect(rehearsal.depositPreview).toMatchObject({
      type: 'fixed',
      fixedAmount: 75000,
      balanceDueTrigger: 'at_check_in',
    });
    expect(rehearsal.options[0].depositPreview).toMatchObject({
      type: 'fixed',
      fixedAmount: 75000,
    });
    expect(JSON.stringify(catalog)).not.toContain('"fees"');

    const normalized = normalizePublicPricingCatalog(catalog);
    expect(normalized.isValid).toBe(true);
    expect(normalized.catalog.policyVersion).toBe(3);
  });

  it('fails closed on legacy schema v3 until Owner republishes the v4 public catalog', () => {
    const v4 = buildPublicPricingProjection(DEFAULT_PRICING_SETTINGS, {
      catalogVersion: 9,
    });
    const v3 = { ...v4, schemaVersion: 3 };
    const normalized = normalizePublicPricingCatalog(v3);
    expect(normalized.isValid).toBe(false);
    expect(normalized.reason).toBe('invalid_schema_version');
  });
});
