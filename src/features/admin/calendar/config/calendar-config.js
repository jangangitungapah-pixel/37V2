/**
 * Central domain configuration for the 37 Music Studio Calendar & Booking Workspace.
 *
 * Operating hours, service options, duration presets, and pricing defaults are derived
 * from the 37studioproper reference implementation (`scheduleConfig.js` and
 * `pricingSettings.js`) and adapted for the Phase 5 two-room studio workspace.
 */

export const STUDIO_TIME_ZONE = 'Asia/Jakarta';

export const OPERATING_START_HOUR = 10; // 10:00 WIB
export const OPERATING_END_HOUR = 23; // 23:00 WIB
export const OPERATING_START_MINUTE = OPERATING_START_HOUR * 60; // 600
export const OPERATING_END_MINUTE = OPERATING_END_HOUR * 60; // 1380
export const SLOT_INTERVAL_MINUTES = 30;
export const NO_SHOW_GRACE_MINUTES = 15;
export const CALENDAR_BOOKINGS_QUERY_LIMIT = 300;

export const STUDIO_ROOMS = [
  {
    id: 'room-a',
    label: 'Room A',
    shortLabel: 'RM-A',
    subtitle: 'Live Room — Latihan & Full-Band Tracking',
    badgeClass: 'bg-studio-lime text-studio-ink border-studio-ink',
    accentColor: '#C8F13A',
  },
  {
    id: 'room-b',
    label: 'Room B',
    shortLabel: 'RM-B',
    subtitle: 'Control + Booth — Recording, Mixing & Mastering',
    badgeClass: 'bg-studio-orange text-studio-white border-studio-ink',
    accentColor: '#FF4B22',
  },
];

export const ROOM_FILTER_OPTIONS = [
  { id: 'all', label: 'All Rooms', shortLabel: 'ALL' },
  ...STUDIO_ROOMS.map((room) => ({
    id: room.id,
    label: room.label,
    shortLabel: room.shortLabel,
  })),
];

export const CALENDAR_VIEW_MODES = [
  { id: 'day', label: 'Day', indoLabel: 'Harian', description: 'Jadwal detail satu tanggal' },
  { id: 'week', label: 'Week', indoLabel: 'Mingguan', description: 'Jadwal tujuh hari aktif' },
  { id: 'month', label: 'Month', indoLabel: 'Bulanan', description: 'Ikhtisar satu bulan penuh' },
];

/**
 * Default studio services & hourly rates from 37studioproper (`scheduleConfig.js` & `pricingSettings.js`).
 */
export const STUDIO_SERVICES = [
  {
    id: 'rehearsal',
    label: 'Rehearsal',
    description: 'Latihan studio reguler',
    unitRate: 100000,
    supportsRecordingType: false,
  },
  {
    id: 'recording',
    label: 'Recording',
    description: 'Tracking rekaman instrumen & vokal',
    unitRate: 150000,
    supportsRecordingType: true,
  },
  {
    id: 'mixing',
    label: 'Mixing',
    description: 'Mixing audio multi-track',
    unitRate: 250000,
    supportsRecordingType: false,
  },
  {
    id: 'mastering',
    label: 'Mastering',
    description: 'Final mastering siap rilis',
    unitRate: 300000,
    supportsRecordingType: false,
  },
];

/**
 * Recording type options for the Recording service.
 * Supports standard hourly tracking (`none`) as well as fixed-shift recording options.
 */
export const RECORDING_TYPE_OPTIONS = [
  {
    id: '',
    label: 'Tracking Reguler (Per Jam)',
    description: 'Tarif per jam mengikuti durasi sesi (Rp 150.000/jam)',
    priceMode: 'hourly',
    unitRate: 150000,
    fixedPrice: 0,
    lockedDurationMinutes: 0,
  },
  {
    id: 'live-recording-3h',
    label: 'Live Recording Session (3 Jam)',
    description: 'Sesi rekaman live 3 jam (Rp 420.000)',
    priceMode: 'fixed',
    unitRate: 140000,
    fixedPrice: 420000,
    lockedDurationMinutes: 180,
  },
  {
    id: 'multitrack-shift-6h',
    label: 'Multitrack Shift (6 Jam)',
    description: 'Shift rekaman 6 jam penuh (Rp 800.000)',
    priceMode: 'fixed',
    unitRate: 133333,
    fixedPrice: 800000,
    lockedDurationMinutes: 360,
  },
];

/**
 * Optional studio packages that bundle service + duration + promotional discount.
 */
export const STUDIO_PACKAGES = [
  {
    id: '',
    label: 'Tanpa Paket (Reguler)',
    description: 'Pilih layanan dan durasi sesuai kebutuhan',
    serviceId: '',
    durationMinutes: 0,
    subtotal: 0,
    discountAmount: 0,
    totalAmount: 0,
  },
  {
    id: 'pkg-rehearsal-3h',
    label: 'Paket Rehearsal 3 Jam',
    description: 'Latihan 3 jam hemat Rp 30.000',
    serviceId: 'rehearsal',
    serviceLabel: 'Rehearsal',
    durationMinutes: 180,
    unitRate: 100000,
    subtotal: 300000,
    discountAmount: 30000,
    totalAmount: 270000,
  },
  {
    id: 'pkg-rehearsal-5h',
    label: 'Paket Rehearsal 5 Jam',
    description: 'Latihan 5 jam hemat Rp 50.000',
    serviceId: 'rehearsal',
    serviceLabel: 'Rehearsal',
    durationMinutes: 300,
    unitRate: 100000,
    subtotal: 500000,
    discountAmount: 50000,
    totalAmount: 450000,
  },
];

export const DURATION_PRESET_OPTIONS = [
  { key: '60', label: '1 Jam', minutes: 60 },
  { key: '120', label: '2 Jam', minutes: 120 },
  { key: '180', label: '3 Jam', minutes: 180 },
  { key: '240', label: '4 Jam', minutes: 240 },
  { key: '300', label: '5 Jam', minutes: 300 },
  { key: '360', label: '6 Jam', minutes: 360 },
  { key: 'custom', label: 'Custom (30 mnt)', minutes: null },
];

export const INITIAL_PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
};

export const INITIAL_PAYMENT_STATUS_OPTIONS = [
  {
    id: INITIAL_PAYMENT_STATUS.UNPAID,
    label: 'Belum Bayar',
    shortLabel: 'Belum Bayar',
    description: 'Belum ada pembayaran awal saat booking dibuat',
    badgeClass: 'bg-studio-ivory text-studio-ink border-studio-ink',
  },
  {
    id: INITIAL_PAYMENT_STATUS.PARTIAL,
    label: 'DP / Partial',
    shortLabel: 'DP',
    description: 'Customer membayar uang muka (DP) sebagian',
    badgeClass: 'bg-amber-200 text-studio-ink border-studio-ink',
  },
  {
    id: INITIAL_PAYMENT_STATUS.PAID,
    label: 'Lunas',
    shortLabel: 'Lunas',
    description: 'Pembayaran penuh diterima saat booking dibuat',
    badgeClass: 'bg-studio-lime text-studio-ink border-studio-ink',
  },
];

export const PAYMENT_FILTER_OPTIONS = [
  { id: 'all', label: 'All Payment Status' },
  { id: INITIAL_PAYMENT_STATUS.UNPAID, label: 'Belum Bayar' },
  { id: INITIAL_PAYMENT_STATUS.PARTIAL, label: 'DP' },
  { id: INITIAL_PAYMENT_STATUS.PAID, label: 'Lunas' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { id: 'cash', label: 'Cash', description: 'Tunai di kasir studio' },
  { id: 'transfer', label: 'Transfer', description: 'Transfer rekening bank' },
  { id: 'qris', label: 'QRIS', description: 'Scan QRIS / e-wallet' },
  { id: 'other', label: 'Other', description: 'Metode pembayaran lainnya' },
];

export const BOOKING_SESSION_STATUS = {
  UPCOMING: 'upcoming',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

export const SESSION_STATUS_META = {
  [BOOKING_SESSION_STATUS.UPCOMING]: {
    id: BOOKING_SESSION_STATUS.UPCOMING,
    label: 'Upcoming',
    indoLabel: 'Akan Datang',
    badgeClass: 'bg-studio-white text-studio-ink border-studio-ink',
    dotClass: 'bg-studio-ink',
  },
  [BOOKING_SESSION_STATUS.IN_PROGRESS]: {
    id: BOOKING_SESSION_STATUS.IN_PROGRESS,
    label: 'In Progress',
    indoLabel: 'Berlangsung',
    badgeClass: 'bg-studio-lime text-studio-ink border-studio-ink',
    dotClass: 'bg-studio-ink',
  },
  [BOOKING_SESSION_STATUS.COMPLETED]: {
    id: BOOKING_SESSION_STATUS.COMPLETED,
    label: 'Completed',
    indoLabel: 'Selesai',
    badgeClass: 'bg-emerald-200 text-studio-ink border-studio-ink',
    dotClass: 'bg-emerald-800',
  },
  [BOOKING_SESSION_STATUS.NO_SHOW]: {
    id: BOOKING_SESSION_STATUS.NO_SHOW,
    label: 'No Show',
    indoLabel: 'Tidak Hadir',
    badgeClass: 'bg-studio-orange text-studio-white border-studio-ink',
    dotClass: 'bg-studio-white',
  },
  [BOOKING_SESSION_STATUS.CANCELLED]: {
    id: BOOKING_SESSION_STATUS.CANCELLED,
    label: 'Cancelled',
    indoLabel: 'Dibatalkan',
    badgeClass: 'bg-neutral-200 text-neutral-700 border-neutral-500',
    dotClass: 'bg-neutral-500',
  },
};

export const BOOKING_EVENT_TYPES = {
  CREATED: 'booking_created',
  EDITED: 'booking_edited',
  RESCHEDULED: 'booking_rescheduled',
  CHECKED_IN: 'customer_checked_in',
  STARTED: 'session_started',
  COMPLETED: 'session_completed',
  NO_SHOW: 'session_no_show',
  CANCELLED: 'booking_cancelled',
};

export const BOOKING_EVENT_LABELS = {
  [BOOKING_EVENT_TYPES.CREATED]: 'Booking dibuat',
  [BOOKING_EVENT_TYPES.EDITED]: 'Booking diperbarui',
  [BOOKING_EVENT_TYPES.RESCHEDULED]: 'Jadwal di-reschedule',
  [BOOKING_EVENT_TYPES.CHECKED_IN]: 'Customer check-in',
  [BOOKING_EVENT_TYPES.STARTED]: 'Sesi dimulai',
  [BOOKING_EVENT_TYPES.COMPLETED]: 'Sesi selesai',
  [BOOKING_EVENT_TYPES.NO_SHOW]: 'Ditandai No Show',
  [BOOKING_EVENT_TYPES.CANCELLED]: 'Booking dibatalkan',
};

/**
 * Generates all 30-minute timeline start slots from 10:00 (600) to 22:30 (1350).
 */
export const TIMELINE_HALF_HOUR_SLOTS = Array.from(
  { length: (OPERATING_END_MINUTE - OPERATING_START_MINUTE) / SLOT_INTERVAL_MINUTES },
  (_, index) => {
    const startMinute = OPERATING_START_MINUTE + index * SLOT_INTERVAL_MINUTES;
    const endMinute = startMinute + SLOT_INTERVAL_MINUTES;
    const hours = String(Math.floor(startMinute / 60)).padStart(2, '0');
    const mins = String(startMinute % 60).padStart(2, '0');
    return {
      startMinute,
      endMinute,
      label: `${hours}:${mins}`,
      isFullHour: startMinute % 60 === 0,
    };
  },
);

export function getStudioRoomById(studioId) {
  return STUDIO_ROOMS.find((room) => room.id === studioId) || STUDIO_ROOMS[0];
}

export function getServiceById(serviceId) {
  return STUDIO_SERVICES.find((service) => service.id === serviceId) || STUDIO_SERVICES[0];
}

export function getPackageById(packageId) {
  if (!packageId) return STUDIO_PACKAGES[0];
  return STUDIO_PACKAGES.find((pkg) => pkg.id === packageId) || STUDIO_PACKAGES[0];
}

export function getRecordingTypeById(recordingTypeId) {
  if (!recordingTypeId) return RECORDING_TYPE_OPTIONS[0];
  return (
    RECORDING_TYPE_OPTIONS.find((item) => item.id === recordingTypeId) || RECORDING_TYPE_OPTIONS[0]
  );
}

export function getInitialPaymentStatusMeta(status) {
  return (
    INITIAL_PAYMENT_STATUS_OPTIONS.find((item) => item.id === status) ||
    INITIAL_PAYMENT_STATUS_OPTIONS[0]
  );
}

export function getSessionStatusMeta(status) {
  return SESSION_STATUS_META[status] || SESSION_STATUS_META[BOOKING_SESSION_STATUS.UPCOMING];
}

export function getPaymentMethodLabel(methodId) {
  if (!methodId) return '-';
  const matched = PAYMENT_METHOD_OPTIONS.find((item) => item.id === String(methodId).toLowerCase());
  return matched ? matched.label : String(methodId);
}
