import { useEffect, useState } from 'react';

import { DEFAULT_BOOKING_POLICIES } from '../config/booking-policies-config';
import { getBookingPoliciesRepositoryAdapter } from '../repositories/booking-policies-repository';
import { normalizeBookingPolicies } from '../utils/booking-policies-normalize';

export function useBookingPolicies(customAdapter = null) {
  const adapter = customAdapter || getBookingPoliciesRepositoryAdapter();
  const [state, setState] = useState({
    adapter: null,
    policies: normalizeBookingPolicies(DEFAULT_BOOKING_POLICIES),
    isPersisted: false,
    isLoading: true,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({
      ...previous,
      adapter,
      isLoading: true,
      error: '',
    }));

    const unsubscribe = adapter.subscribeBookingPolicies({
      onData: ({ policies, isPersisted }) => {
        if (cancelled) return;
        setState({
          adapter,
          policies: normalizeBookingPolicies(policies),
          isPersisted: Boolean(isPersisted),
          isLoading: false,
          error: '',
        });
      },
      onError: (error) => {
        if (cancelled) return;
        setState({
          adapter,
          policies: normalizeBookingPolicies(DEFAULT_BOOKING_POLICIES),
          isPersisted: false,
          isLoading: false,
          error: error?.message || 'Gagal memuat Booking Policies.',
        });
      },
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [adapter]);

  return {
    ...state,
    isLoading: state.adapter !== adapter || state.isLoading,
  };
}
