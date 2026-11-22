import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS_META,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';

export function BookingRequestStatusBadge({ status, size = 'md' }) {
  const meta = BOOKING_REQUEST_STATUS_META[status] || {
    label: status || 'Unknown',
    shortLabel: status || 'Unknown',
    tone: 'neutral',
  };

  return (
    <AdminStatusBadge
      tone={meta.tone}
      size={size}
      dot={status === 'new' || status === 'accepted' || status === 'confirmed'}
    >
      {size === 'sm' ? meta.shortLabel : meta.label}
    </AdminStatusBadge>
  );
}

export function BookingRequestTypeBadge({ requestType, size = 'sm' }) {
  const isPostProd = requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY;
  return (
    <AdminStatusBadge tone={isPostProd ? 'ink' : 'ivory'} size={size}>
      {isPostProd ? 'Post-Production' : 'Studio Room'}
    </AdminStatusBadge>
  );
}

export function BookingRequestSourceBadge({ source, size = 'sm' }) {
  if (source !== BOOKING_REQUEST_SOURCES.CLIENT_PORTAL) {
    return null;
  }

  return (
    <AdminStatusBadge tone="lime" size={size}>
      Client Portal
    </AdminStatusBadge>
  );
}
