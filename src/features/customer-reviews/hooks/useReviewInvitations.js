import { useEffect, useState } from 'react';

import { getCustomerReviewRepositoryAdapter } from '../repositories/customer-review-repository';

/**
 * Admin hook subscribing to all booking review invitations (for Owner invitation management overview).
 */
export function useReviewInvitations({ enabled = true } = {}) {
  const [state, setState] = useState({
    invitations: [],
    isLoading: Boolean(enabled),
    error: '',
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let isCancelled = false;
    const adapter = getCustomerReviewRepositoryAdapter();

    const unsub = adapter.subscribeAllReviewInvitations({
      onData: (items) => {
        if (isCancelled) return;
        setState({
          invitations: items || [],
          isLoading: false,
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState({
          invitations: [],
          isLoading: false,
          error: err?.message || 'Gagal memuat daftar undangan ulasan.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsub?.();
    };
  }, [enabled]);

  return state;
}

/**
 * Realtime hook for a single booking's review invitation + review status (used in BookingDetailDrawer).
 */
export function useBookingReviewState(bookingId, { enabled = true } = {}) {
  const [state, setState] = useState({
    bookingId: '',
    invitationIndex: null,
    invitation: null,
    review: null,
    isLoading: Boolean(enabled && bookingId),
    error: '',
  });

  useEffect(() => {
    if (!enabled || !bookingId) return undefined;

    let isCancelled = false;
    const adapter = getCustomerReviewRepositoryAdapter();

    const unsub = adapter.subscribeBookingReviewState({
      bookingId,
      onData: ({ invitationIndex, invitation, review }) => {
        if (isCancelled) return;
        setState({
          bookingId,
          invitationIndex: invitationIndex || null,
          invitation: invitation || null,
          review: review || null,
          isLoading: false,
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setState({
          bookingId,
          invitationIndex: null,
          invitation: null,
          review: null,
          isLoading: false,
          error: err?.message || 'Gagal memuat status undangan ulasan booking.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsub?.();
    };
  }, [bookingId, enabled]);

  if (!enabled || !bookingId) {
    return {
      invitationIndex: null,
      invitation: null,
      review: null,
      isLoading: false,
      error: '',
    };
  }

  const isStaleBooking = state.bookingId !== bookingId;
  return {
    invitationIndex: isStaleBooking ? null : state.invitationIndex,
    invitation: isStaleBooking ? null : state.invitation,
    review: isStaleBooking ? null : state.review,
    isLoading: isStaleBooking ? true : state.isLoading,
    error: isStaleBooking ? '' : state.error,
  };
}
