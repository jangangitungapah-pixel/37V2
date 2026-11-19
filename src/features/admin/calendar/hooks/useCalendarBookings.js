import { useEffect, useMemo, useState } from 'react';

import { resolveBookingLatestPaymentView } from '@/features/admin/payment/utils/payment-calculation';

import { BOOKING_SESSION_STATUS, CALENDAR_BOOKINGS_QUERY_LIMIT } from '../config/calendar-config';
import { getBookingRepositoryAdapter } from '../repositories/calendar-booking-repository';
import { mapBookingErrorToMessage } from '../services/calendar-booking-service';

/**
 * Subscribes in realtime to `bookings` within `[startDate, endDate]` and applies
 * client-side filtering (room, payment status, cancelled toggle, search query).
 * When `invoicesByBookingId` is provided from the shared Calendar invoice range
 * subscription, payment badges & filters reflect the latest Invoice Ledger status.
 */
export function useCalendarBookings({
  startDate,
  endDate,
  roomFilter = 'all',
  paymentFilter = 'all',
  showCancelled = false,
  searchQuery = '',
  invoicesByBookingId = null,
}) {
  const activeRangeKey = `${startDate || ''}:${endDate || ''}`;

  const [state, setState] = useState({
    rangeKey: '',
    bookings: [],
    error: null,
    isTruncated: false,
    maxLimit: CALENDAR_BOOKINGS_QUERY_LIMIT,
  });

  useEffect(() => {
    if (!startDate || !endDate) return undefined;

    const currentRangeKey = `${startDate}:${endDate}`;
    const adapter = getBookingRepositoryAdapter();
    const unsubscribe = adapter.subscribeBookingsInRange({
      startDate,
      endDate,
      maxLimit: CALENDAR_BOOKINGS_QUERY_LIMIT,
      onData: ({ bookings, isTruncated, maxLimit }) => {
        setState({
          rangeKey: currentRangeKey,
          bookings,
          error: null,
          isTruncated: Boolean(isTruncated),
          maxLimit: maxLimit || CALENDAR_BOOKINGS_QUERY_LIMIT,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          rangeKey: currentRangeKey,
          error: mapBookingErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [startDate, endDate]);

  const isLoading = Boolean(startDate && endDate && state.rangeKey !== activeRangeKey);

  const normalizedSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();

  const enrichedBookings = useMemo(() => {
    return state.bookings.map((booking) => {
      const linkedInvoice = invoicesByBookingId?.get?.(booking.id) || null;
      const invoiceSummary = resolveBookingLatestPaymentView(booking, linkedInvoice);
      return {
        ...booking,
        linkedInvoice,
        invoiceSummary,
      };
    });
  }, [state.bookings, invoicesByBookingId]);

  // Active (non-cancelled) bookings in the current date range for conflict detection
  const activeSlotBookings = useMemo(() => {
    return enrichedBookings.filter(
      (booking) =>
        booking.sessionStatus !== BOOKING_SESSION_STATUS.CANCELLED &&
        booking.sessionStatus !== BOOKING_SESSION_STATUS.NO_SHOW,
    );
  }, [enrichedBookings]);

  // Bookings matching the active toolbar & filter bar criteria
  const filteredBookings = useMemo(() => {
    return enrichedBookings.filter((booking) => {
      if (!showCancelled && booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED) {
        return false;
      }

      if (roomFilter !== 'all' && booking.studioId !== roomFilter) {
        return false;
      }

      const authoritativePaymentStatus =
        booking.invoiceSummary?.storedPaymentStatus || booking.initialPaymentStatus;
      if (paymentFilter !== 'all' && authoritativePaymentStatus !== paymentFilter) {
        return false;
      }

      if (normalizedSearch) {
        const customerMatch = String(booking.customerName || '')
          .toLowerCase()
          .includes(normalizedSearch);
        const bandMatch = String(booking.bandName || '')
          .toLowerCase()
          .includes(normalizedSearch);
        const phoneMatch = String(booking.phone || '')
          .toLowerCase()
          .includes(normalizedSearch);
        const serviceMatch = String(booking.serviceLabel || '')
          .toLowerCase()
          .includes(normalizedSearch);
        const invoiceMatch = String(booking.invoiceSummary?.invoiceNumber || '')
          .toLowerCase()
          .includes(normalizedSearch);

        if (!customerMatch && !bandMatch && !phoneMatch && !serviceMatch && !invoiceMatch) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedBookings, showCancelled, roomFilter, paymentFilter, normalizedSearch]);

  // Upcoming bookings panel list (active upcoming or in_progress bookings in loaded window)
  const upcomingBookings = useMemo(() => {
    return filteredBookings
      .filter(
        (booking) =>
          booking.sessionStatus === BOOKING_SESSION_STATUS.UPCOMING ||
          booking.sessionStatus === BOOKING_SESSION_STATUS.IN_PROGRESS,
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startMinute - b.startMinute;
      })
      .slice(0, 12);
  }, [filteredBookings]);

  return {
    allBookings: enrichedBookings,
    activeSlotBookings,
    filteredBookings,
    upcomingBookings,
    isLoading,
    error: state.error,
    isTruncated: state.isTruncated,
    maxLimit: state.maxLimit,
  };
}

/**
 * Subscribes in realtime to immutable `bookingEvents` for a specific booking.
 */
export function useBookingEvents(bookingId) {
  const [state, setState] = useState({
    loadedBookingId: '',
    events: [],
    error: null,
  });

  useEffect(() => {
    if (!bookingId) {
      return undefined;
    }

    const adapter = getBookingRepositoryAdapter();
    const unsubscribe = adapter.subscribeBookingEvents({
      bookingId,
      onData: (events) => {
        setState({
          loadedBookingId: bookingId,
          events,
          error: null,
        });
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          loadedBookingId: bookingId,
          error: mapBookingErrorToMessage(err),
        }));
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [bookingId]);

  if (!bookingId) {
    return {
      events: [],
      isLoading: false,
      error: null,
    };
  }

  return {
    events: state.loadedBookingId === bookingId ? state.events : [],
    isLoading: state.loadedBookingId !== bookingId,
    error: state.loadedBookingId === bookingId ? state.error : null,
  };
}
