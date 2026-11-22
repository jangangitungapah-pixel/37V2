export const PUBLIC_BOOKING_REQUESTS_COLLECTION = 'publicBookingRequests';
export const BOOKING_REQUEST_COMMUNICATIONS_SUBCOLLECTION = 'communications';
export const BOOKING_REQUEST_ACTIVITIES_SUBCOLLECTION = 'activities';
export const BOOKING_REQUEST_TEMPLATES_COLLECTION = 'bookingRequestMessageTemplates';

export const BOOKING_REQUEST_SCHEMA_VERSION = 1;
export const BOOKING_REQUEST_CONSENT_VERSION = 'v1';

export const BOOKING_REQUEST_TYPES = Object.freeze({
  STUDIO_BOOKING: 'studio_booking',
  POST_PRODUCTION_INQUIRY: 'post_production_inquiry',
});

export const BOOKING_REQUEST_SOURCES = Object.freeze({
  PUBLIC_LANDING_PAGE: 'public_landing_page',
  PUBLIC_AVAILABILITY_CALENDAR: 'public_availability_calendar',
  CLIENT_PORTAL: 'client_portal',
});

export const BOOKING_REQUEST_STATUS = Object.freeze({
  NEW: 'new',
  IN_REVIEW: 'in_review',
  AWAITING_CUSTOMER: 'awaiting_customer',
  ACCEPTED: 'accepted',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CLOSED: 'closed',
});

export const BOOKING_REQUEST_STATUS_ORDER = Object.freeze([
  BOOKING_REQUEST_STATUS.NEW,
  BOOKING_REQUEST_STATUS.IN_REVIEW,
  BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
  BOOKING_REQUEST_STATUS.ACCEPTED,
  BOOKING_REQUEST_STATUS.CONFIRMED,
  BOOKING_REQUEST_STATUS.DECLINED,
  BOOKING_REQUEST_STATUS.CLOSED,
]);

export const BOOKING_REQUEST_STATUS_META = Object.freeze({
  [BOOKING_REQUEST_STATUS.NEW]: {
    id: BOOKING_REQUEST_STATUS.NEW,
    label: 'New',
    shortLabel: 'New',
    tone: 'orange',
    description: 'Permintaan baru masuk dan belum ditinjau tim studio.',
  },
  [BOOKING_REQUEST_STATUS.IN_REVIEW]: {
    id: BOOKING_REQUEST_STATUS.IN_REVIEW,
    label: 'In Review',
    shortLabel: 'In Review',
    tone: 'amber',
    description: 'Tim studio sedang meninjau ketersediaan jadwal atau detail project.',
  },
  [BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER]: {
    id: BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
    label: 'Awaiting Customer',
    shortLabel: 'Awaiting Customer',
    tone: 'ivory',
    description: 'Menunggu respons atau klarifikasi tambahan dari pelanggan.',
  },
  [BOOKING_REQUEST_STATUS.ACCEPTED]: {
    id: BOOKING_REQUEST_STATUS.ACCEPTED,
    label: 'Accepted (Slot Not Locked)',
    shortLabel: 'Accepted',
    tone: 'lime',
    description:
      'Studio siap memproses permintaan, tetapi slot kalender belum terkunci sebelum booking dibuat.',
  },
  [BOOKING_REQUEST_STATUS.CONFIRMED]: {
    id: BOOKING_REQUEST_STATUS.CONFIRMED,
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    tone: 'emerald',
    description: 'Booking resmi telah dibuat dan slot kalender terkunci di Admin Calendar.',
  },
  [BOOKING_REQUEST_STATUS.DECLINED]: {
    id: BOOKING_REQUEST_STATUS.DECLINED,
    label: 'Declined',
    shortLabel: 'Declined',
    tone: 'danger',
    description: 'Permintaan tidak dapat diakomodasi (mis. jadwal penuh atau di luar layanan).',
  },
  [BOOKING_REQUEST_STATUS.CLOSED]: {
    id: BOOKING_REQUEST_STATUS.CLOSED,
    label: 'Closed',
    shortLabel: 'Closed',
    tone: 'neutral',
    description: 'Permintaan telah ditutup / diarsipkan secara operasional.',
  },
});

/**
 * Controlled Admin Inbox status transition graph.
 * Note: `confirmed` is strictly omitted here for `studio_booking` because it can
 * ONLY happen atomically inside `createBooking({ bookingRequestId })`.
 */
export const ALLOWED_MANUAL_STATUS_TRANSITIONS = Object.freeze({
  [BOOKING_REQUEST_STATUS.NEW]: [
    BOOKING_REQUEST_STATUS.IN_REVIEW,
    BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
    BOOKING_REQUEST_STATUS.ACCEPTED,
    BOOKING_REQUEST_STATUS.DECLINED,
    BOOKING_REQUEST_STATUS.CLOSED,
  ],
  [BOOKING_REQUEST_STATUS.IN_REVIEW]: [
    BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
    BOOKING_REQUEST_STATUS.ACCEPTED,
    BOOKING_REQUEST_STATUS.DECLINED,
    BOOKING_REQUEST_STATUS.CLOSED,
  ],
  [BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER]: [
    BOOKING_REQUEST_STATUS.IN_REVIEW,
    BOOKING_REQUEST_STATUS.ACCEPTED,
    BOOKING_REQUEST_STATUS.DECLINED,
    BOOKING_REQUEST_STATUS.CLOSED,
  ],
  [BOOKING_REQUEST_STATUS.ACCEPTED]: [
    BOOKING_REQUEST_STATUS.IN_REVIEW,
    BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
    BOOKING_REQUEST_STATUS.DECLINED,
    BOOKING_REQUEST_STATUS.CLOSED,
  ],
  [BOOKING_REQUEST_STATUS.DECLINED]: [BOOKING_REQUEST_STATUS.CLOSED],
  [BOOKING_REQUEST_STATUS.CONFIRMED]: [],
  [BOOKING_REQUEST_STATUS.CLOSED]: [],
});

export const BOOKING_REQUEST_COMMUNICATION_TYPES = Object.freeze({
  WHATSAPP_PREPARED: 'whatsapp_message_prepared',
  WHATSAPP_MARKED_SENT: 'whatsapp_message_marked_sent',
  STAFF_NOTE_ADDED: 'staff_note_added',
});

export const BOOKING_REQUEST_ACTIVITY_TYPES = Object.freeze({
  REQUEST_CREATED: 'request_created',
  STATUS_CHANGED: 'status_changed',
  BOOKING_CONFIRMED: 'booking_confirmed',
  STAFF_ASSIGNED: 'staff_assigned',
});

export const BOOKING_REQUEST_INBOX_PAGE_SIZE = 50;
export const BOOKING_REQUEST_NEW_BADGE_LIMIT = 20;
export const BOOKING_REQUEST_BADGE_CAP = 9;
export const BOOKING_REQUEST_TIMELINE_LIMIT = 100;

export const PUBLIC_SUBMIT_COOLDOWN_MS = 15000;
export const PUBLIC_MIN_ELAPSED_MS = 1000;

export const PUBLIC_SERVICE_OPTIONS = Object.freeze([
  {
    id: 'rehearsal',
    label: 'Rehearsal',
    requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
    defaultRoom: 'room-a',
  },
  {
    id: 'recording',
    label: 'Recording',
    requestType: BOOKING_REQUEST_TYPES.STUDIO_BOOKING,
    defaultRoom: 'room-b',
  },
  {
    id: 'mix-master',
    label: 'Mix & Master',
    requestType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
    defaultRoom: null,
  },
]);

export const PUBLIC_ROOM_LABELS = Object.freeze({
  'room-a': 'Room A — Live Room',
  'room-b': 'Room B — Control + Booth',
  any: 'No preference / Studio recommends',
});

export const PUBLIC_DURATION_OPTION_VALUES = Object.freeze([
  { value: '1 hour', label: '1 hour', minutes: 60 },
  { value: '2 hours', label: '2 hours', minutes: 120 },
  { value: '3 hours', label: '3 hours', minutes: 180 },
  { value: '4 hours', label: '4 hours', minutes: 240 },
  { value: '6 hours', label: '6 hours', minutes: 360 },
]);

export const PUBLIC_START_TIME_SLOTS = Object.freeze([
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
]);
