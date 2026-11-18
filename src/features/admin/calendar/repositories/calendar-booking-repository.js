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
 * Normalizes the internal commission snapshot with safe fallback for Phase 5 bookings
 * that predate Phase 6 commission tracking.
 */
export function normalizeCommissionSnapshot(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const validBasis = ['package', 'rehearsal_hourly', 'none'];
  const staffBasis = validBasis.includes(raw.staffBasis) ? raw.staffBasis : 'none';
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

  return {
    id: String(id || data.id || ''),
    customerName: String(data.customerName || '').trim(),
    phone: String(data.phone || '').trim(),
    bandName: String(data.bandName || '').trim(),
    studioId: String(data.studioId || 'room-a').trim(),
    serviceId: String(data.serviceId || 'rehearsal').trim(),
    serviceLabel: String(data.serviceLabel || 'Rehearsal').trim(),
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
