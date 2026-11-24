import {
  normalizeCustomerRecord,
  normalizePhoneIndexRecord,
} from '@/features/admin/customer/schemas/customer-schema';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';

import {
  BOOKING_SESSION_STATUS,
  CALENDAR_BOOKINGS_QUERY_LIMIT,
  INITIAL_PAYMENT_STATUS,
  STUDIO_TIME_ZONE,
} from '../config/calendar-config';

export const FIRESTORE_COLLECTIONS = {
  BOOKINGS: 'bookings',
  BOOKING_SLOTS: 'bookingSlots',
  BOOKING_EVENTS: 'bookingEvents',
  PUBLIC_BOOKING_REQUESTS: 'publicBookingRequests',
  BOOKING_REQUEST_ACTIVITIES: 'activities',
  PUBLIC_AVAILABILITY: 'publicAvailability',
  PUBLIC_AVAILABILITY_METADATA: 'publicAvailabilityMetadata',
  CUSTOMERS: 'customers',
  CUSTOMER_PHONE_INDEX: 'customerPhoneIndex',
  CUSTOMER_EMAIL_INDEX: 'customerEmailIndex',
  CLIENT_ACCOUNTS: 'clientAccounts',
  CLIENT_CUSTOMER_LINKS: 'clientCustomerLinks',
  CLIENT_PROFILES: 'clientProfiles',
  INVOICES: 'invoices',
  PAYMENT_TRANSACTIONS: 'paymentTransactions',
  PAYMENT_EVIDENCE: 'paymentEvidence',
  COMMISSION_BATCHES: 'commissionBatches',
  COMMISSION_POSTING_ITEMS: 'commissionPostingItems',
  COMMISSION_REVIEW_RESOLUTIONS: 'commissionReviewResolutions',
  BOOKKEEPING_ENTRIES: 'bookkeepingEntries',
  BOOKKEEPING_SETTLEMENTS: 'bookkeepingSettlements',
  BOOKKEEPING_SETTINGS: 'bookkeepingSettings',
  INVENTORY_ITEMS: 'inventoryItems',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  SYSTEM_OPERATIONS: 'systemOperations',
  REVIEW_INVITATIONS: 'reviewInvitations',
  REVIEW_INVITATION_INDEXES: 'reviewInvitationIndexes',
  CUSTOMER_REVIEWS: 'customerReviews',
  PUBLIC_REVIEW_STATS: 'publicReviewStats',
};

/**
 * Generates a collision-resistant UUID for bookings and events before a transaction starts
 * so retries remain strictly idempotent.
 */
export function generateOperationId(prefix = '') {
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

  return prefix ? `${prefix}_${randomUuid}` : randomUuid;
}

/**
 * Normalizes the automatic duration-based discount snapshot with safe fallback (`null`)
 * for Phase 5/6 bookings or bookings without duration-multiple automatic discount.
 */
export function normalizeAutomaticDiscountSnapshot(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const intervalMinutes = Math.round(Number(raw.intervalMinutes) || 0);
  const eligibleBlocks = Math.round(Number(raw.eligibleBlocks) || 0);
  const discountPerBlock = Math.round(Number(raw.discountPerBlock) || 0);
  const totalDiscount = Math.round(Number(raw.totalDiscount) || 0);

  if (
    raw.type !== 'duration_multiple' ||
    intervalMinutes <= 0 ||
    eligibleBlocks <= 0 ||
    discountPerBlock <= 0 ||
    totalDiscount <= 0
  ) {
    return null;
  }

  return {
    type: 'duration_multiple',
    intervalMinutes,
    eligibleBlocks,
    discountPerBlock,
    totalDiscount,
  };
}

/**
 * Normalizes a single V2 internal fee recipient entry (`staff`, `owner`, or `recordingOperator`).
 */
function normalizeCommissionRoleEntry(raw = null) {
  const validBasis = ['none', 'fixed', 'hourly', 'manual'];
  if (!raw || typeof raw !== 'object') {
    return { basis: 'none', rate: 0, amount: 0 };
  }
  const basis = validBasis.includes(raw.basis) ? raw.basis : 'none';
  return {
    basis,
    rate: Math.max(0, Math.round(Number(raw.rate) || 0)),
    amount: Math.max(0, Math.round(Number(raw.amount) || 0)),
  };
}

/**
 * Normalizes the internal commission snapshot with full backward compatibility across:
 * - Phase 5 bookings (`null`)
 * - Phase 6 V1 bookings (`staffBasis`, `staffRate`, `staffAmount`, `recordingOperatorAmount`, `settingsVersion`)
 * - Phase 6 V2 bookings (`schemaVersion: 2`, `staff`, `owner`, `recordingOperator`, `settingsVersion`)
 */
export function normalizeCommissionSnapshot(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (raw.schemaVersion === 2 || (raw.staff && typeof raw.staff === 'object')) {
    return {
      schemaVersion: 2,
      staff: normalizeCommissionRoleEntry(raw.staff),
      owner: normalizeCommissionRoleEntry(raw.owner),
      recordingOperator: normalizeCommissionRoleEntry(raw.recordingOperator),
      settingsVersion: Math.max(1, Math.round(Number(raw.settingsVersion) || 1)),
    };
  }

  const validLegacyBasis = ['package', 'rehearsal_hourly', 'none'];
  const staffBasis = validLegacyBasis.includes(raw.staffBasis) ? raw.staffBasis : 'none';
  return {
    staffBasis,
    staffRate: Math.max(0, Math.round(Number(raw.staffRate) || 0)),
    staffAmount: Math.max(0, Math.round(Number(raw.staffAmount) || 0)),
    recordingOperatorAmount: Math.max(0, Math.round(Number(raw.recordingOperatorAmount) || 0)),
    settingsVersion: Math.max(1, Math.round(Number(raw.settingsVersion) || 1)),
  };
}

/**
 * Normalizes a raw Firestore booking document into a consistent domain record.
 */
export function normalizeBookingRecord(id, data = {}) {
  const startMinute = Number.isFinite(Number(data.startMinute)) ? Number(data.startMinute) : 600;
  const durationMinutes = Number.isFinite(Number(data.durationMinutes))
    ? Number(data.durationMinutes)
    : 60;
  const endMinute = Number.isFinite(Number(data.endMinute))
    ? Number(data.endMinute)
    : startMinute + durationMinutes;

  const serviceId = String(data.serviceId || data.serviceTypeId || 'rehearsal').trim();
  const serviceLabel = String(data.serviceLabel || data.serviceTypeName || 'Rehearsal').trim();

  const record = {
    id: String(id || data.id || ''),
    customerName: String(data.customerName || '').trim(),
    phone: String(data.phone || '').trim(),
    bandName: String(data.bandName || '').trim(),
    studioId: String(data.studioId || 'room-a').trim(),
    serviceId,
    serviceLabel,
    packageId: String(data.packageId || '').trim(),
    packageLabel: String(data.packageLabel || '').trim(),
    recordingTypeId: String(data.recordingTypeId || '').trim(),
    recordingTypeLabel: String(data.recordingTypeLabel || '').trim(),
    date: String(data.date || '').trim(),
    startMinute,
    durationMinutes,
    endMinute,
    timeZone: String(data.timeZone || STUDIO_TIME_ZONE),
    unitRate: Math.max(0, Number(data.unitRate) || 0),
    subtotal: Math.max(0, Number(data.subtotal) || 0),
    discountAmount: Math.max(0, Number(data.discountAmount) || 0),
    totalAmount: Math.max(0, Number(data.totalAmount) || 0),
    automaticDiscount: normalizeAutomaticDiscountSnapshot(data.automaticDiscount),
    commissionSnapshot: normalizeCommissionSnapshot(data.commissionSnapshot),
    initialPaymentStatus: data.initialPaymentStatus || INITIAL_PAYMENT_STATUS.UNPAID,
    initialPaidAmount: Math.max(0, Number(data.initialPaidAmount) || 0),
    paymentMethod: String(data.paymentMethod || '').trim(),
    sessionStatus: data.sessionStatus || BOOKING_SESSION_STATUS.UPCOMING,
    checkedInAt: data.checkedInAt ?? null,
    checkedInByUid: String(data.checkedInByUid || ''),
    actualStartedAt: data.actualStartedAt ?? null,
    actualCompletedAt: data.actualCompletedAt ?? null,
    notes: String(data.notes || ''),
    createdAt: data.createdAt ?? null,
    createdByUid: String(data.createdByUid || ''),
    updatedAt: data.updatedAt ?? null,
    updatedByUid: String(data.updatedByUid || ''),
    version: Number.isInteger(Number(data.version)) ? Number(data.version) : 1,
  };

  if (data.customerId) {
    record.customerId = String(data.customerId).trim();
  }
  if (data.phoneNormalized) {
    record.phoneNormalized = String(data.phoneNormalized).trim();
  }
  if (data.deliveryMode) {
    record.deliveryMode = String(data.deliveryMode).trim();
  }

  if (data.serviceTypeId) {
    record.serviceTypeId = String(data.serviceTypeId).trim();
    record.serviceTypeName = String(data.serviceTypeName || serviceLabel).trim();
    record.serviceOptionId = String(data.serviceOptionId || '').trim();
    record.serviceOptionName = String(data.serviceOptionName || '').trim();
    record.deliveryMode = String(data.deliveryMode || 'studio').trim();
    record.pricingMode = String(data.pricingMode || 'hourly').trim();
    record.pricingSettingsVersion = Math.max(
      1,
      Math.round(Number(data.pricingSettingsVersion) || 1),
    );
  }

  return record;
}

/**
 * Normalizes a raw Firestore bookingEvent document.
 */
export function normalizeBookingEventRecord(id, data = {}) {
  return {
    id: String(id || data.id || ''),
    bookingId: String(data.bookingId || ''),
    eventType: String(data.eventType || ''),
    actorUid: String(data.actorUid || ''),
    createdAt: data.createdAt ?? null,
    previousValue: data.previousValue ?? null,
    newValue: data.newValue ?? null,
    note: String(data.note || ''),
  };
}

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Creates the default Cloud Firestore transactional adapter using the shared `getFirebaseDb()`
 * instance. Uses single-field range queries on `date` and equality queries on `bookingId`
 * so no extra composite indexes are required.
 */
export function createFirestoreBookingRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          async getBooking(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookingRecord(snap.id, snap.data()) : null;
          },
          async getSlot(slotId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_SLOTS, slotId);
            const snap = await tx.get(ref);
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          },
          async getEvent(eventId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_EVENTS, eventId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookingEventRecord(snap.id, snap.data()) : null;
          },
          async getCustomer(customerId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMERS, customerId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeCustomerRecord(snap.id, snap.data()) : null;
          },
          async getPhoneIndex(phoneHash) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX, phoneHash);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizePhoneIndexRecord(snap.id, snap.data()) : null;
          },
          async getInvoice(invoiceId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeInvoiceRecord(snap.id, snap.data()) : null;
          },
          async getPaymentTransaction(transactionId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS, transactionId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizePaymentTransactionRecord(snap.id, snap.data()) : null;
          },
          async getBookingRequest(requestId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PUBLIC_BOOKING_REQUESTS, requestId);
            const snap = await tx.get(ref);
            return snap.exists() ? { id: snap.id, ...snap.data(), _raw: snap.data() } : null;
          },
          setBooking(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            tx.set(ref, data);
          },
          updateBooking(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            tx.update(ref, data);
          },
          setSlot(slotId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_SLOTS, slotId);
            tx.set(ref, data);
          },
          deleteSlot(slotId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_SLOTS, slotId);
            tx.delete(ref);
          },
          setEvent(eventId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_EVENTS, eventId);
            tx.set(ref, data);
          },
          setCustomer(customerId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMERS, customerId);
            tx.set(ref, data);
          },
          updateCustomer(customerId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMERS, customerId);
            tx.update(ref, data);
          },
          setPhoneIndex(phoneHash, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX, phoneHash);
            tx.set(ref, data);
          },
          setInvoice(invoiceId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
            tx.set(ref, data);
          },
          updateInvoice(invoiceId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId);
            tx.update(ref, data);
          },
          setPaymentTransaction(transactionId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS, transactionId);
            tx.set(ref, data);
          },
          setPaymentEvidence(evidenceId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE, evidenceId);
            tx.set(ref, data);
          },
          setPublicAvailability(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY, bookingId);
            tx.set(ref, data);
          },
          deletePublicAvailability(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY, bookingId);
            tx.delete(ref);
          },
          updateBookingRequest(requestId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PUBLIC_BOOKING_REQUESTS, requestId);
            tx.update(ref, data);
          },
          setBookingRequestActivity(requestId, eventId, data) {
            const ref = doc(
              db,
              FIRESTORE_COLLECTIONS.PUBLIC_BOOKING_REQUESTS,
              requestId,
              FIRESTORE_COLLECTIONS.BOOKING_REQUEST_ACTIVITIES,
              eventId,
            );
            tx.set(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    subscribeBookingsInRange({
      startDate,
      endDate,
      maxLimit = CALENDAR_BOOKINGS_QUERY_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);
          const rangeQuery = query(
            bookingsRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            rangeQuery,
            (snapshot) => {
              if (isCancelled) return;
              const bookings = snapshot.docs
                .map((docSnap) => normalizeBookingRecord(docSnap.id, docSnap.data()))
                .sort((a, b) => {
                  if (a.date !== b.date) return a.date.localeCompare(b.date);
                  if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
                  return a.studioId.localeCompare(b.studioId);
                });

              onData?.({
                bookings,
                isTruncated: snapshot.docs.length >= maxLimit,
                maxLimit,
              });
            },
            (err) => {
              if (isCancelled) return;
              onError?.(err);
            },
          );
        } catch (err) {
          if (!isCancelled) {
            onError?.(err);
          }
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribe?.();
      };
    },

    subscribeBookingEvents({ bookingId, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!bookingId) {
        onData?.([]);
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const eventsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKING_EVENTS);
          const eventsQuery = query(eventsRef, where('bookingId', '==', bookingId), limit(100));

          unsubscribe = onSnapshot(
            eventsQuery,
            (snapshot) => {
              if (isCancelled) return;
              const events = snapshot.docs
                .map((docSnap) => normalizeBookingEventRecord(docSnap.id, docSnap.data()))
                .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));

              onData?.(events);
            },
            (err) => {
              if (isCancelled) return;
              onError?.(err);
            },
          );
        } catch (err) {
          if (!isCancelled) {
            onError?.(err);
          }
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribe?.();
      };
    },
  };
}

let activeRepositoryAdapter = createFirestoreBookingRepositoryAdapter();

export function getBookingRepositoryAdapter() {
  return activeRepositoryAdapter;
}

export function setBookingRepositoryAdapter(customAdapter) {
  activeRepositoryAdapter = customAdapter || createFirestoreBookingRepositoryAdapter();
}

export function resetBookingRepositoryAdapter() {
  activeRepositoryAdapter = createFirestoreBookingRepositoryAdapter();
}
