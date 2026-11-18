import { useEffect, useMemo, useState } from 'react';

import { DEFAULT_PRICING_SETTINGS } from '../pricing/config/default-pricing-settings';
import { getPricingSettingsRepositoryAdapter } from '../pricing/repositories/pricing-settings-repository';
import { mapPricingSettingsErrorToMessage } from '../pricing/services/pricing-settings-service';
import { clonePricingSettings } from '../pricing/utils/normalize-pricing-settings';

/**
 * Subscribes in realtime to Cloud Firestore `settings/pricing`.
 *
 * Shared by both Price and Fee Settings page and Calendar Booking Form so
 * updates made in Settings propagate immediately without page refresh or
 * relying on localStorage as source of truth.
 */
export function usePricingSettings() {
  const adapter = getPricingSettingsRepositoryAdapter();

  const [state, setState] = useState(() => ({
    resolvedAdapter: null,
    settings: clonePricingSettings(DEFAULT_PRICING_SETTINGS),
    isPersisted: false,
    error: null,
  }));

  useEffect(() => {
    const unsubscribe = adapter.subscribePricingSettings({
      onData: ({ settings, isPersisted }) => {
        setState({
          resolvedAdapter: adapter,
          settings: settings || clonePricingSettings(DEFAULT_PRICING_SETTINGS),
          isPersisted: Boolean(isPersisted),
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
  }, [adapter]);

  const isLoading = state.resolvedAdapter !== adapter;

  const activeSessionTypes = useMemo(
    () => (state.settings.sessionTypes || []).filter((item) => item.isActive !== false),
    [state.settings.sessionTypes],
  );

  const activeRecordingTypes = useMemo(
    () => (state.settings.recordingTypes || []).filter((item) => item.isActive !== false),
    [state.settings.recordingTypes],
  );

  const activePackages = useMemo(
    () => (state.settings.packages || []).filter((item) => item.isActive !== false),
    [state.settings.packages],
  );

  const activeDiscounts = useMemo(
    () => (state.settings.discounts || []).filter((item) => item.isActive !== false),
    [state.settings.discounts],
  );

  return {
    settings: state.settings,
    activeSessionTypes,
    activeRecordingTypes,
    activePackages,
    activeDiscounts,
    isPersisted: state.isPersisted,
    isLoading,
    error: state.error,
  };
}
