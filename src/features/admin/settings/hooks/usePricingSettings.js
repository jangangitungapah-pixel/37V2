import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_PRICING_SETTINGS,
  DELIVERY_MODES,
} from '../pricing/config/default-pricing-settings';
import { getPricingSettingsRepositoryAdapter } from '../pricing/repositories/pricing-settings-repository';
import { mapPricingSettingsErrorToMessage } from '../pricing/services/pricing-settings-service';
import {
  clonePricingSettings,
  isOptionBookableForStudio,
} from '../pricing/utils/normalize-pricing-settings';

/**
 * Single shared realtime hook subscribing to Cloud Firestore `settings/pricing` (Schema V2,
 * with automatic runtime migration from legacy Schema V1).
 *
 * Shared by Price and Fee Settings page, Calendar workspace, Booking pricing, and Fee estimation
 * without relying on localStorage as authoritative source.
 */
export function usePricingSettings({ enabled = true } = {}) {
  const adapter = getPricingSettingsRepositoryAdapter();

  const [state, setState] = useState(() => ({
    resolvedAdapter: null,
    settings: clonePricingSettings(DEFAULT_PRICING_SETTINGS),
    isPersisted: false,
    migratedFromV1: false,
    error: null,
  }));

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribe = adapter.subscribePricingSettings({
      onData: ({ settings, isPersisted, migratedFromV1 }) => {
        setState({
          resolvedAdapter: adapter,
          settings: settings || clonePricingSettings(DEFAULT_PRICING_SETTINGS),
          isPersisted: Boolean(isPersisted),
          migratedFromV1: Boolean(migratedFromV1),
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          resolvedAdapter: adapter,
          error: mapPricingSettingsErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [adapter, enabled]);

  const isLoading = enabled ? state.resolvedAdapter !== adapter : false;

  const serviceTypes = useMemo(
    () => state.settings.serviceTypes || [],
    [state.settings.serviceTypes],
  );

  const studioServiceTypes = useMemo(
    () => serviceTypes.filter((svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO),
    [serviceTypes],
  );

  const wfaServiceTypes = useMemo(
    () => serviceTypes.filter((svc) => svc.deliveryMode === DELIVERY_MODES.WFA),
    [serviceTypes],
  );

  const activeStudioServiceTypes = useMemo(
    () =>
      studioServiceTypes
        .filter((svc) => svc.isActive !== false)
        .map((svc) => ({
          ...svc,
          bookableOptions: (svc.options || []).filter(isOptionBookableForStudio),
        }))
        .filter((svc) => svc.bookableOptions.length > 0),
    [studioServiceTypes],
  );

  return {
    settings: state.settings,
    serviceTypes,
    studioServiceTypes,
    wfaServiceTypes,
    activeStudioServiceTypes,
    operationalSettings: state.settings.operationalSettings,
    isPersisted: state.isPersisted,
    migratedFromV1: state.migratedFromV1,
    isLoading,
    error: state.error,
  };
}
