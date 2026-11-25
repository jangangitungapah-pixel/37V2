/**
 * Authoritative Factory Reset Manifest & Configuration.
 *
 * Defines the explicit operational collections & nested subcollections eligible for deletion,
 * the dependency-aware deletion order, batch safety limits, and the explicit preservation manifest.
 *
 * Never uses unbounded database-wide sweeps. Every deletion target must be listed here.
 */

export const FACTORY_RESET_SCHEMA_VERSION = 1;
export const SYSTEM_OPERATIONS_COLLECTION = 'systemOperations';
export const FACTORY_RESET_DOC_ID = 'factoryReset';

export const FACTORY_RESET_CONFIRMATION_PHRASE = 'RESET 37 MUSIC STUDIO';

// Conservative batch limit strictly inside Firestore 500-write ceiling and Security Rules call budget
export const FACTORY_RESET_BATCH_SIZE = 10;
export const FACTORY_RESET_PARENT_PAGE_SIZE = 25;
export const FACTORY_RESET_REAUTH_WINDOW_MS = 5 * 60 * 1000;

export const FACTORY_RESET_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  FAILED: 'failed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const FACTORY_RESET_LOCKED_STATUSES = Object.freeze([
  FACTORY_RESET_STATUS.RUNNING,
  FACTORY_RESET_STATUS.PAUSED,
  FACTORY_RESET_STATUS.FAILED,
]);

export const FACTORY_RESET_PREVIEW_GROUPS = Object.freeze([
  { id: 'booking_requests', label: 'Booking Requests & History' },
  { id: 'booking_scheduling', label: 'Booking & Scheduling' },
  { id: 'public_availability', label: 'Public Availability Projections' },
  { id: 'customer', label: 'Customer Records' },
  { id: 'financial', label: 'Financial, Payment, Commission & Bookkeeping' },
  { id: 'inventory', label: 'Inventory Master & Movements' },
]);

/**
 * Authoritative dependency-aware ordered deletion manifest (25 explicit targets).
 * Subcollections (`communications`, `activities`) are always deleted and verified empty
 * before deleting parent `publicBookingRequests` documents, and dependents are deleted
 * before canonical `bookings` and `customers`.
 */
export const FACTORY_RESET_DELETION_MANIFEST = Object.freeze([
  {
    key: 'publicBookingRequests_communications',
    label: 'Request Communications (Subcollection)',
    collection: 'communications',
    parentCollection: 'publicBookingRequests',
    subcollection: 'communications',
    pathPattern: 'publicBookingRequests/{requestId}/communications',
    kind: 'subcollection',
    group: 'booking_requests',
    order: 1,
  },
  {
    key: 'publicBookingRequests_activities',
    label: 'Request Activities (Subcollection)',
    collection: 'activities',
    parentCollection: 'publicBookingRequests',
    subcollection: 'activities',
    pathPattern: 'publicBookingRequests/{requestId}/activities',
    kind: 'subcollection',
    group: 'booking_requests',
    order: 2,
  },
  {
    key: 'publicBookingRequests',
    label: 'Incoming Booking Requests',
    collection: 'publicBookingRequests',
    pathPattern: 'publicBookingRequests',
    kind: 'collection',
    group: 'booking_requests',
    order: 3,
  },
  {
    key: 'clientReservations',
    label: 'Client Booking Reservations',
    collection: 'clientReservations',
    pathPattern: 'clientReservations',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 4,
  },
  {
    key: 'bookingEvents',
    label: 'Booking Events',
    collection: 'bookingEvents',
    pathPattern: 'bookingEvents',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 5,
  },
  {
    key: 'bookingSlots',
    label: 'Booking Slots (Room Locks)',
    collection: 'bookingSlots',
    pathPattern: 'bookingSlots',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 6,
  },
  {
    key: 'publicAvailability',
    label: 'Public Availability Projections',
    collection: 'publicAvailability',
    pathPattern: 'publicAvailability',
    kind: 'collection',
    group: 'public_availability',
    order: 7,
  },
  {
    key: 'paymentEvidence',
    label: 'Payment Evidence Submissions',
    collection: 'paymentEvidence',
    pathPattern: 'paymentEvidence',
    kind: 'collection',
    group: 'financial',
    order: 8,
  },
  {
    key: 'paymentTransactions',
    label: 'Payment Transactions',
    collection: 'paymentTransactions',
    pathPattern: 'paymentTransactions',
    kind: 'collection',
    group: 'financial',
    order: 9,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    collection: 'invoices',
    pathPattern: 'invoices',
    kind: 'collection',
    group: 'financial',
    order: 10,
  },
  {
    key: 'commissionReviewResolutions',
    label: 'Commission Review Resolutions',
    collection: 'commissionReviewResolutions',
    pathPattern: 'commissionReviewResolutions',
    kind: 'collection',
    group: 'financial',
    order: 11,
  },
  {
    key: 'commissionPostingItems',
    label: 'Commission Posting Items',
    collection: 'commissionPostingItems',
    pathPattern: 'commissionPostingItems',
    kind: 'collection',
    group: 'financial',
    order: 12,
  },
  {
    key: 'commissionBatches',
    label: 'Commission Batches',
    collection: 'commissionBatches',
    pathPattern: 'commissionBatches',
    kind: 'collection',
    group: 'financial',
    order: 13,
  },
  {
    key: 'bookkeepingSettlements',
    label: 'Bookkeeping Settlements',
    collection: 'bookkeepingSettlements',
    pathPattern: 'bookkeepingSettlements',
    kind: 'collection',
    group: 'financial',
    order: 14,
  },
  {
    key: 'bookkeepingEntries',
    label: 'Bookkeeping Entries',
    collection: 'bookkeepingEntries',
    pathPattern: 'bookkeepingEntries',
    kind: 'collection',
    group: 'financial',
    order: 15,
  },
  {
    key: 'inventoryMovements',
    label: 'Inventory Movements',
    collection: 'inventoryMovements',
    pathPattern: 'inventoryMovements',
    kind: 'collection',
    group: 'inventory',
    order: 16,
  },
  {
    key: 'inventoryItems',
    label: 'Inventory Items',
    collection: 'inventoryItems',
    pathPattern: 'inventoryItems',
    kind: 'collection',
    group: 'inventory',
    order: 17,
  },
  {
    key: 'customerPhoneIndex',
    label: 'Customer Phone Indexes',
    collection: 'customerPhoneIndex',
    pathPattern: 'customerPhoneIndex',
    kind: 'collection',
    group: 'customer',
    order: 18,
  },
  {
    key: 'customerEmailIndex',
    label: 'Customer Email Indexes',
    collection: 'customerEmailIndex',
    pathPattern: 'customerEmailIndex',
    kind: 'collection',
    group: 'customer',
    order: 19,
  },
  {
    key: 'clientCustomerLinks',
    label: 'Client-to-Customer Identity Links',
    collection: 'clientCustomerLinks',
    pathPattern: 'clientCustomerLinks',
    kind: 'collection',
    group: 'customer',
    order: 20,
  },
  {
    key: 'clientProfiles',
    label: 'Client Profiles',
    collection: 'clientProfiles',
    pathPattern: 'clientProfiles',
    kind: 'collection',
    group: 'customer',
    order: 21,
  },
  {
    key: 'customers',
    label: 'Customers',
    collection: 'customers',
    pathPattern: 'customers',
    kind: 'collection',
    group: 'customer',
    order: 22,
  },
  {
    key: 'reviewInvitations',
    label: 'Review Invitations (Tokens)',
    collection: 'reviewInvitations',
    pathPattern: 'reviewInvitations',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 23,
  },
  {
    key: 'reviewInvitationIndexes',
    label: 'Review Invitation Indexes',
    collection: 'reviewInvitationIndexes',
    pathPattern: 'reviewInvitationIndexes',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 24,
  },
  {
    key: 'bookings',
    label: 'Canonical Bookings',
    collection: 'bookings',
    pathPattern: 'bookings',
    kind: 'collection',
    group: 'booking_scheduling',
    order: 25,
  },
]);;

export const FACTORY_RESET_DELETION_TARGET_KEYS = Object.freeze(
  FACTORY_RESET_DELETION_MANIFEST.map((target) => target.key),
);

/**
 * Authoritative list of preserved configuration, security, and studio-owned assets.
 */
export const FACTORY_RESET_PRESERVED_MANIFEST = Object.freeze([
  {
    key: 'firebaseAuthUsers',
    label: 'Akun Login Firebase Authentication',
    path: 'Firebase Authentication',
    category: 'Authentication & Access',
    reason: 'Owner dan Staff tetap dapat masuk ke sistem setelah Factory Reset.',
    checkType: 'auth_session',
  },
  {
    key: 'staffProfiles',
    label: 'Profil & Hak Akses Staff/Owner',
    path: 'staffProfiles/{uid}',
    category: 'Authentication & Access',
    reason: 'Profil akses Owner & Staff aktif tetap utuh untuk otorisasi Admin.',
    checkType: 'actor_profile_doc',
  },
  {
    key: 'studioProfile',
    label: 'Identitas & Kontak Studio',
    path: 'settings/studioProfile',
    category: 'Studio Configuration',
    reason: 'Nama studio, alamat, nomor WhatsApp resmi, dan koordinat Maps dipertahankan.',
    checkType: 'singleton_doc',
    collection: 'settings',
    docId: 'studioProfile',
  },
  {
    key: 'pricing',
    label: 'Konfigurasi Tarif & Komisi',
    path: 'settings/pricing',
    category: 'Studio Configuration',
    reason: 'Daftar layanan, tarif jam/paket, diskon durasi, dan aturan fee tetap tersimpan.',
    checkType: 'singleton_doc',
    collection: 'settings',
    docId: 'pricing',
  },
  {
    key: 'bookingPolicies',
    label: 'Kebijakan Booking Studio',
    path: 'settings/bookingPolicies',
    category: 'Studio Configuration',
    reason: 'Aturan DP, durasi hold default, dan tenggat pelunasan dipertahankan saat data operasional direset.',
    checkType: 'singleton_doc',
    collection: 'settings',
    docId: 'bookingPolicies',
  },
  {
    key: 'bookkeepingSettings',
    label: 'Pengaturan Awal Pembukuan',
    path: 'bookkeepingSettings/default',
    category: 'Studio Configuration',
    reason: 'Konfigurasi dasar pembukuan Owner tidak dihapus.',
    checkType: 'singleton_doc',
    collection: 'bookkeepingSettings',
    docId: 'default',
  },
  {
    key: 'publicSiteSettings',
    label: 'Pengaturan Website Publik',
    path: 'publicSiteSettings/site',
    category: 'Public Website Configuration',
    reason: 'Konten publik, jam operasional, layanan, dan testimoni terverifikasi tetap tayang.',
    checkType: 'singleton_doc',
    collection: 'publicSiteSettings',
    docId: 'site',
  },
  {
    key: 'bookingRequestMessageTemplates',
    label: 'Template Pesan WhatsApp',
    path: 'bookingRequestMessageTemplates',
    category: 'WhatsApp Configuration',
    reason: 'Template komunikasi operasional dapat langsung digunakan ulang untuk klien baru.',
    checkType: 'collection_count',
    collection: 'bookingRequestMessageTemplates',
  },
  {
    key: 'galleryItems',
    label: 'Pustaka Foto Galeri Studio',
    path: 'galleryItems',
    category: 'Gallery & Media Assets',
    reason: 'Metadata foto milik studio dipertahankan agar tampilan publik tidak kosong.',
    checkType: 'collection_count',
    collection: 'galleryItems',
  },
  {
    key: 'landingPagePlacements',
    label: 'Penempatan Media Landing Page',
    path: 'landingPagePlacements',
    category: 'Gallery & Media Assets',
    reason: 'Foto Hero, Room A, Room B, dan Exterior tetap aktif.',
    checkType: 'collection_count',
    collection: 'landingPagePlacements',
  },
  {
    key: 'customerReviews',
    label: 'Ulasan Pelanggan Resmi Studio',
    path: 'customerReviews',
    category: 'Customer Reviews & Reputation',
    reason:
      'Ulasan pelanggan termoderasi & terpublikasi dipertahankan sebagai aset reputasi studio.',
    checkType: 'collection_count',
    collection: 'customerReviews',
  },
  {
    key: 'publicReviewStats',
    label: 'Ringkasan Rating Publik Studio',
    path: 'publicReviewStats/summary',
    category: 'Customer Reviews & Reputation',
    reason: 'Statistik rating rata-rata dan distribusi ulasan terpublikasi tetap terjaga.',
    checkType: 'singleton_doc',
    collection: 'publicReviewStats',
    docId: 'summary',
  },
  {
    key: 'cloudinaryAssets',
    label: 'Aset Gambar Cloud Cloudinary',
    path: 'Cloudinary Storage',
    category: 'Gallery & Media Assets',
    reason: 'Reset tidak pernah memanggil API penghapusan aset Cloudinary.',
    checkType: 'external_asset',
  },
  {
    key: 'publicAvailabilityMetadata',
    label: 'Status Kalender Publik (Direinisialisasi)',
    path: 'publicAvailabilityMetadata/status',
    category: 'Public Availability',
    reason: 'Dipertahankan dan direinisialisasi ke isReady: true setelah proyeksi kosong.',
    checkType: 'singleton_doc',
    collection: 'publicAvailabilityMetadata',
    docId: 'status',
  },
  {
    key: 'systemOperationsFactoryReset',
    label: 'Riwayat Audit Operasi Reset',
    path: 'systemOperations/factoryReset',
    category: 'System Audit',
    reason: 'Menyimpan rekam jejak non-PII bahwa Factory Reset telah dilaksanakan.',
    checkType: 'singleton_doc',
    collection: 'systemOperations',
    docId: 'factoryReset',
  },
]);
