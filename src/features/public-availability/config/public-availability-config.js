/**
 * Configuration & Sanitized Schema Constants for the Public Availability Calendar (`/availability`).
 *
 * Enforces the 37 Music Studio operating schedule in `Asia/Jakarta` (`WIB`, UTC+7):
 * - Operating Window: `10:00` (600) to `23:00` (1380)
 * - Canonical Storage Granularity: `30 minutes` (26 slots per room per day)
 * - Public Display Granularity: `60 minutes` (13 hourly slots per room per day)
 * - Rooms: `room-a` (Room A — Live Room) and `room-b` (Room B — Control + Booth)
 */

import {
  OPERATING_END_MINUTE,
  OPERATING_START_MINUTE,
  SLOT_INTERVAL_MINUTES,
  STUDIO_TIME_ZONE,
} from '@/features/admin/calendar/config/calendar-config';

export const PUBLIC_AVAILABILITY_TIME_ZONE = STUDIO_TIME_ZONE;
export const PUBLIC_OPERATING_START_MINUTE = OPERATING_START_MINUTE; // 600 (10:00)
export const PUBLIC_OPERATING_END_MINUTE = OPERATING_END_MINUTE; // 1380 (23:00)
export const PUBLIC_SLOT_INTERVAL_MINUTES = SLOT_INTERVAL_MINUTES; // 30 (canonical Firestore & rule grain)
export const PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES = 60; // 60 (1-hour public schedule slots)

export const PUBLIC_AVAILABILITY_SCHEMA_VERSION = 1;
export const PUBLIC_AVAILABILITY_QUERY_LIMIT = 300;
export const PUBLIC_BACKFILL_PAGE_SIZE = 50;
export const PUBLIC_BACKFILL_BATCH_WRITE_LIMIT = 4;
export const PUBLIC_VERIFICATION_READ_CHUNK_SIZE = 20;
export const PUBLIC_AVAILABILITY_METADATA_DOC_ID = 'status';

export const PUBLIC_AVAILABILITY_ALLOWED_KEYS = [
  'schemaVersion',
  'date',
  'studioId',
  'startMinute',
  'endMinute',
  'updatedAt',
];

export const PUBLIC_AVAILABILITY_FORBIDDEN_FIELDS = [
  'customerName',
  'bandName',
  'phone',
  'phoneNormalized',
  'customerId',
  'bookingId',
  'customerSnapshot',
  'notes',
  'serviceId',
  'serviceLabel',
  'serviceTypeId',
  'serviceTypeName',
  'serviceOptionId',
  'serviceOptionName',
  'packageId',
  'packageLabel',
  'recordingTypeId',
  'recordingTypeLabel',
  'unitRate',
  'subtotal',
  'discountAmount',
  'totalAmount',
  'automaticDiscount',
  'commissionSnapshot',
  'initialPaymentStatus',
  'initialPaidAmount',
  'paymentMethod',
  'sessionStatus',
  'invoiceId',
  'invoiceNumber',
  'createdByUid',
  'updatedByUid',
  'checkedInByUid',
];

export const PUBLIC_STUDIO_ROOMS = [
  {
    id: 'room-a',
    label: 'Room A — Live Room',
    shortLabel: 'Room A',
    badge: 'LIVE ROOM',
    defaultService: 'rehearsal',
    description: 'Group rehearsal & live ensemble tracking floor.',
  },
  {
    id: 'room-b',
    label: 'Room B — Control + Booth',
    shortLabel: 'Room B',
    badge: 'CONTROL + BOOTH',
    defaultService: 'recording',
    description: 'Vocal/instrument tracking booth & mixing control room.',
  },
];

export const PUBLIC_ROOM_FILTER_OPTIONS = [
  { id: 'all', label: 'All Rooms' },
  { id: 'room-a', label: 'Room A' },
  { id: 'room-b', label: 'Room B' },
];

export const PUBLIC_VIEW_MODES = {
  DAY: 'day',
  WEEK: 'week',
};

export const PUBLIC_DURATION_OPTIONS = [
  { minutes: 60, label: '1 hour (60m)', inquiryValue: '2 hours' },
  { minutes: 120, label: '2 hours (120m)', inquiryValue: '2 hours' },
  { minutes: 180, label: '3 hours (180m)', inquiryValue: '3 hours' },
  { minutes: 240, label: '4 hours (240m)', inquiryValue: '4 hours' },
];

export const PUBLIC_SLOT_STATES = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  PAST: 'past',
  DURATION_TOO_SHORT: 'duration_too_short',
  OUTSIDE_HOURS: 'outside_hours',
};
