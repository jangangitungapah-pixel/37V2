import { useCallback, useEffect, useMemo, useState } from 'react';

import { DELIVERY_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import { getPublicPricingCatalogRepositoryAdapter } from '../repositories/public-pricing-repository';

/**
 * Customer-safe subscription hook for `publicPricingCatalog/current`.
 *
 * Fail closed: never substitutes hardcoded default prices if the public catalog
 * document is missing, invalid, or unreadable.
 */
export function usePublicPricingCatalog(customAdapter = null, { enabled = true } = {}) {
  const adapter = customAdapter || getPublicPricingCatalogRepositoryAdapter();
  const [retryCounter, setRetryCounter] = useState(0);

  const [state, setState] = useState({
    resolvedAdapter: null,
    resolvedRetryCounter: -1,
    catalog: null,
    isPersisted: false,
    isValid: false,
    invalidReason: '',
    error: '',
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isCancelled = false;

    const unsubscribe = adapter.subscribePublicPricingCatalog({
      onData: ({ catalog, isPersisted, isValid, invalidReason }) => {
        if (isCancelled) return;
        setState({
          resolvedAdapter: adapter,
          resolvedRetryCounter: retryCounter,
          catalog: isValid && catalog ? catalog : null,
          isPersisted: Boolean(isPersisted),
          isValid: Boolean(isValid),
          invalidReason: invalidReason || '',
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState({
          resolvedAdapter: adapter,
          resolvedRetryCounter: retryCounter,
          catalog: null,
          isPersisted: false,
          isValid: false,
          invalidReason: 'subscription_error',
          error: err?.message || 'Unable to load public studio pricing catalog.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [adapter, enabled, retryCounter]);

  const retry = useCallback(() => {
    setRetryCounter((prev) => prev + 1);
  }, []);

  const isLoading = enabled
    ? state.resolvedAdapter !== adapter || state.resolvedRetryCounter !== retryCounter
    : false;

  const serviceTypes = useMemo(
    () =>
      enabled && state.isValid && state.catalog?.serviceTypes ? state.catalog.serviceTypes : [],
    [enabled, state.catalog, state.isValid],
  );

  const studioServiceTypes = useMemo(
    () => serviceTypes.filter((svc) => svc.deliveryMode === DELIVERY_MODES.STUDIO),
    [serviceTypes],
  );

  const wfaServiceTypes = useMemo(
    () => serviceTypes.filter((svc) => svc.deliveryMode === DELIVERY_MODES.WFA),
    [serviceTypes],
  );

  const isReady =
    enabled &&
    !isLoading &&
    !state.error &&
    state.isPersisted &&
    state.isValid &&
    serviceTypes.length > 0;

  return {
    catalog: enabled ? state.catalog : null,
    catalogVersion: enabled ? (state.catalog?.version ?? null) : null,
    serviceTypes,
    studioServiceTypes,
    wfaServiceTypes,
    isPersisted: enabled ? state.isPersisted : false,
    isValid: enabled ? state.isValid : false,
    invalidReason: enabled ? state.invalidReason : '',
    isReady,
    isLoading,
    error: enabled ? state.error : '',
    retry,
  };
}
