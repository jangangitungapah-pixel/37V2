import { createContext } from 'react';

import { BOOKING_REQUEST_BADGE_CAP } from '../config/booking-request-config';

export const BookingRequestAlertsContext = createContext(null);

export function computeBookingRequestAlertsSummary({
  requests = [],
  hasMore = false,
  isLoading = false,
  error = null,
}) {
  const newCount = requests.length;
  const isCapped = hasMore || newCount > BOOKING_REQUEST_BADGE_CAP;
  const badgeLabel =
    newCount === 0 ? '' : isCapped ? `${BOOKING_REQUEST_BADGE_CAP}+` : String(newCount);

  return {
    newRequests: requests,
    newCount,
    hasMoreNew: Boolean(hasMore),
    badgeLabel,
    newestRequest: requests[0] || null,
    recentNewRequests: requests.slice(0, 3),
    isLoading,
    error,
  };
}
