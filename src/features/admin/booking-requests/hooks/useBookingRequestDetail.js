import { useEffect, useMemo, useState } from 'react';

import { BOOKING_SESSION_STATUS } from '@/features/admin/calendar/config/calendar-config';
import { getBookingRepositoryAdapter } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  doTimeIntervalsOverlap,
  formatMinuteOfDay,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import { OPERATING_HALF_HOUR_SLOTS } from '@/features/public-availability/utils/public-availability-calculation';

import {
  BOOKING_REQUEST_TIMELINE_LIMIT,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import { getBookingRequestRepositoryAdapter } from '../repositories/booking-request-repository';

function evaluateRequestAvailability({ request, bookingsOnDate = [] }) {
  if (
    !request ||
    request.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING ||
    !request.preferredDate ||
    !Number.isInteger(request.preferredStartMinute) ||
    !Number.isInteger(request.preferredDurationMinutes)
  ) {
    return null;
  }

  const activeBookings = (bookingsOnDate || []).filter(
    (b) =>
      b.date === request.preferredDate &&
      b.sessionStatus !== BOOKING_SESSION_STATUS.CANCELLED &&
      b.sessionStatus !== BOOKING_SESSION_STATUS.NO_SHOW,
  );

  const reqStart = request.preferredStartMinute;
  const reqEnd = reqStart + request.preferredDurationMinutes;

  const candidateRooms =
    request.requestedRoomId === 'room-a' || request.requestedRoomId === 'room-b'
      ? [request.requestedRoomId]
      : ['room-a', 'room-b'];

  const roomResults = candidateRooms.map((studioId) => {
    const conflicts = activeBookings.filter(
      (b) =>
        b.studioId === studioId &&
        doTimeIntervalsOverlap(reqStart, reqEnd, b.startMinute, b.endMinute),
    );

    const alternativeSlots = [];
    for (const slot of OPERATING_HALF_HOUR_SLOTS) {
      const slotEnd = slot.startMinute + request.preferredDurationMinutes;
      if (slotEnd > 1380) continue;
      const overlaps = activeBookings.some(
        (b) =>
          b.studioId === studioId &&
          doTimeIntervalsOverlap(slot.startMinute, slotEnd, b.startMinute, b.endMinute),
      );
      if (!overlaps) {
        alternativeSlots.push({
          studioId,
          roomLabel: studioId === 'room-b' ? 'Room B' : 'Room A',
          startMinute: slot.startMinute,
          endMinute: slotEnd,
          label: `${studioId === 'room-b' ? 'Room B' : 'Room A'} • ${formatMinuteOfDay(slot.startMinute)}–${formatMinuteOfDay(slotEnd)} WIB`,
        });
      }
      if (alternativeSlots.length >= 4) break;
    }

    return {
      studioId,
      roomLabel: studioId === 'room-b' ? 'Room B — Control + Booth' : 'Room A — Live Room',
      isOpen: conflicts.length === 0,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        customerName: c.customerName,
        rangeLabel: formatMinuteRange(c.startMinute, c.endMinute),
      })),
      alternativeSlots,
    };
  });

  const hasAnyOpenRoom = roomResults.some((r) => r.isOpen);
  const allAlternatives = roomResults.flatMap((r) => r.alternativeSlots).slice(0, 6);

  return {
    date: request.preferredDate,
    requestedRangeLabel: formatMinuteRange(reqStart, reqEnd),
    hasAnyOpenRoom,
    roomResults,
    alternativeSlots: allAlternatives,
  };
}

export function useBookingRequestDetail(requestId = '') {
  const requestAdapter = getBookingRequestRepositoryAdapter();
  const bookingAdapter = getBookingRepositoryAdapter();

  const [docState, setDocState] = useState({
    loadedId: '',
    request: null,
    error: null,
  });
  const [communications, setCommunications] = useState([]);
  const [activities, setActivities] = useState([]);
  const [dateBookingsState, setDateBookingsState] = useState({
    date: '',
    bookings: [],
    error: null,
  });

  useEffect(() => {
    if (!requestId) return undefined;
    let isCancelled = false;

    const unsubDoc = requestAdapter.subscribeBookingRequestById({
      requestId,
      onData: (record) => {
        if (isCancelled) return;
        setDocState({
          loadedId: requestId,
          request: record,
          error: null,
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setDocState({
          loadedId: requestId,
          request: null,
          error: err?.message || 'Gagal memuat detail booking request.',
        });
      },
    });

    const unsubComms = requestAdapter.subscribeRequestCommunications({
      requestId,
      maxLimit: BOOKING_REQUEST_TIMELINE_LIMIT,
      onData: (items) => {
        if (!isCancelled) setCommunications(items || []);
      },
      onError: () => {},
    });

    const unsubActs = requestAdapter.subscribeRequestActivities({
      requestId,
      maxLimit: BOOKING_REQUEST_TIMELINE_LIMIT,
      onData: (items) => {
        if (!isCancelled) setActivities(items || []);
      },
      onError: () => {},
    });

    return () => {
      isCancelled = true;
      unsubDoc?.();
      unsubComms?.();
      unsubActs?.();
    };
  }, [requestAdapter, requestId]);

  const activeRequest = docState.loadedId === requestId ? docState.request : null;
  const preferredDate =
    activeRequest?.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING
      ? activeRequest.preferredDate || ''
      : '';

  useEffect(() => {
    if (!preferredDate) return undefined;
    let isCancelled = false;

    const unsubBookings = bookingAdapter.subscribeBookingsInRange({
      startDate: preferredDate,
      endDate: preferredDate,
      maxLimit: 100,
      onData: ({ bookings }) => {
        if (isCancelled) return;
        setDateBookingsState({
          date: preferredDate,
          bookings: bookings || [],
          error: null,
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setDateBookingsState({
          date: preferredDate,
          bookings: [],
          error: err?.message || 'Gagal memuat ketersediaan kalender.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubBookings?.();
    };
  }, [bookingAdapter, preferredDate]);

  const availabilityContext = useMemo(() => {
    if (!preferredDate) return null;
    const loadedBookings =
      dateBookingsState.date === preferredDate ? dateBookingsState.bookings : [];
    return {
      ...evaluateRequestAvailability({
        request: activeRequest,
        bookingsOnDate: loadedBookings,
      }),
      isLoading: dateBookingsState.date !== preferredDate && !dateBookingsState.error,
      error: dateBookingsState.error,
    };
  }, [activeRequest, preferredDate, dateBookingsState]);

  const isLoading = Boolean(requestId) && docState.loadedId !== requestId && !docState.error;

  return {
    request: activeRequest,
    communications: requestId ? communications : [],
    activities: requestId ? activities : [],
    availabilityContext,
    isLoading,
    error: docState.loadedId === requestId ? docState.error : null,
  };
}
