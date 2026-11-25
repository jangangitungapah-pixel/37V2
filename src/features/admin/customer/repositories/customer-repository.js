/**
 * Customer Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter)
 * for 37 Music Studio (Phase 7 — Customer Management).
 *
 * Uses single-field indexes and chunked `in` queries so zero custom composite
 * indexes are required in Firestore.
 */

import {
  FIRESTORE_COLLECTIONS,
  normalizeBookingRecord,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  normalizeCustomerRecord,
  normalizeEmailIndexRecord,
  normalizePhoneIndexRecord,
} from '../schemas/customer-schema';
import {
  chunkArray,
  FIRESTORE_IN_QUERY_CHUNK_SIZE,
  mergeAndDeduplicateBookings,
} from '../utils/customer-history';

export const CUSTOMERS_DEFAULT_QUERY_LIMIT = 200;
export const LEGACY_BOOKINGS_SCAN_PAGE_SIZE = 200;
export const MAX_BATCH_WRITES = 5;

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
 * Default Cloud Firestore Customer Repository Adapter using the shared `getFirebaseDb()` instance.
 */
export function createFirestoreCustomerRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ deleteField, doc, runTransaction, serverTimestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          deleteFieldValue: () => deleteField(),
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
          async getEmailIndex(emailNormalized) {
            if (!emailNormalized) return null;
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeEmailIndexRecord(snap.id, snap.data()) : null;
          },
          async getClientProfile(customerId) {
            if (!customerId) return null;
            const ref = doc(db, FIRESTORE_COLLECTIONS.CLIENT_PROFILES, customerId);
            const snap = await tx.get(ref);
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          },
          async getBooking(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookingRecord(snap.id, snap.data()) : null;
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
          setEmailIndex(emailNormalized, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized);
            tx.set(ref, data);
          },
          deleteEmailIndex(emailNormalized) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized);
            tx.delete(ref);
          },
          setClientProfile(customerId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CLIENT_PROFILES, customerId);
            tx.set(ref, data);
          },
          updateBooking(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            tx.update(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    async getCustomerById(customerId) {
      if (!customerId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.CUSTOMERS, customerId));
      return snap.exists() ? normalizeCustomerRecord(snap.id, snap.data()) : null;
    },

    async getCustomersByIds(customerIds = []) {
      const uniqueIds = Array.from(new Set((customerIds || []).filter(Boolean)));
      if (uniqueIds.length === 0) return [];
      const results = await Promise.all(uniqueIds.map((id) => this.getCustomerById(id)));
      return results.filter(Boolean);
    },

    async getPhoneIndex(phoneHash) {
      if (!phoneHash) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX, phoneHash));
      return snap.exists() ? normalizePhoneIndexRecord(snap.id, snap.data()) : null;
    },

    async getEmailIndex(emailNormalized) {
      if (!emailNormalized) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(
        doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized),
      );
      return snap.exists() ? normalizeEmailIndexRecord(snap.id, snap.data()) : null;
    },

    subscribeCustomers({ maxLimit = CUSTOMERS_DEFAULT_QUERY_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const customersRef = collection(db, FIRESTORE_COLLECTIONS.CUSTOMERS);
          const q = query(customersRef, orderBy('updatedAt', 'desc'), limit(maxLimit));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const customers = snapshot.docs.map((docSnap) =>
                normalizeCustomerRecord(docSnap.id, docSnap.data()),
              );
              onData?.({
                customers,
                hasMore: snapshot.docs.length >= maxLimit,
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

    async queryBookingsByCustomerIds({ customerIds = [], perChunkLimit = 100 }) {
      const chunks = chunkArray(customerIds, FIRESTORE_IN_QUERY_CHUNK_SIZE);
      if (chunks.length === 0) {
        return { bookings: [], isTruncated: false };
      }

      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);

      let isTruncated = false;
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          const q =
            chunk.length === 1
              ? query(bookingsRef, where('customerId', '==', chunk[0]), limit(perChunkLimit))
              : query(bookingsRef, where('customerId', 'in', chunk), limit(perChunkLimit));
          const snapshot = await getDocs(q);
          if (snapshot.docs.length >= perChunkLimit) {
            isTruncated = true;
          }
          return snapshot.docs.map((docSnap) => normalizeBookingRecord(docSnap.id, docSnap.data()));
        }),
      );

      return {
        bookings: mergeAndDeduplicateBookings(chunkResults),
        isTruncated,
      };
    },

    async listBookingsPage({ pageSize = LEGACY_BOOKINGS_SCAN_PAGE_SIZE, cursor = null } = {}) {
      const [{ collection, getDocs, limit, orderBy, query, startAfter }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);

      const constraints = [orderBy('date', 'desc'), limit(pageSize)];
      if (cursor) {
        constraints.push(startAfter(cursor));
      }

      const snapshot = await getDocs(query(bookingsRef, ...constraints));
      const docs = snapshot.docs;
      return {
        bookings: docs.map((docSnap) => normalizeBookingRecord(docSnap.id, docSnap.data())),
        nextCursor: docs.length >= pageSize ? docs[docs.length - 1] : null,
        hasMore: docs.length >= pageSize,
      };
    },

    async commitBatchWrites(operations = []) {
      if (!Array.isArray(operations) || operations.length === 0) return;

      const [{ doc, serverTimestamp, writeBatch }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      for (let offset = 0; offset < operations.length; offset += MAX_BATCH_WRITES) {
        const slice = operations.slice(offset, offset + MAX_BATCH_WRITES);
        const batch = writeBatch(db);
        const now = serverTimestamp();

        for (const op of slice) {
          const ref = doc(db, op.collection, op.id);
          const payload = typeof op.buildData === 'function' ? op.buildData(now) : op.data;
          if (op.type === 'update') {
            batch.update(ref, payload);
          } else {
            batch.set(ref, payload);
          }
        }

        await batch.commit();
      }
    },
  };
}

/**
 * In-memory transactional Customer Repository Adapter.
 * Can optionally attach to a `createInMemoryBookingRepositoryAdapter()` instance so both
 * Calendar and Customer modules share the exact same live in-memory Firestore store.
 */
export function createInMemoryCustomerRepositoryAdapter(bookingAdapterOrStore = null) {
  const sharedStore = bookingAdapterOrStore?._sharedStore || null;

  const customers = sharedStore?.customers || new Map();
  const phoneIndex = sharedStore?.phoneIndex || new Map();
  const emailIndex = sharedStore?.emailIndex || new Map();
  const clientProfiles = sharedStore?.clientProfiles || new Map();
  if (sharedStore) {
    sharedStore.emailIndex = emailIndex;
    sharedStore.clientProfiles = clientProfiles;
  }
  const bookings = sharedStore?.bookings || new Map();
  const customerSubscribers = sharedStore?.customerSubscribers || new Set();
  const notifyCustomers =
    sharedStore?.notifyCustomers ||
    (() => {
      const sorted = Array.from(customers.values()).sort(
        (a, b) => getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt),
      );
      for (const sub of customerSubscribers) {
        const limited = sorted.slice(0, sub.maxLimit);
        sub.onData?.({
          customers: limited.map((c) => ({ ...c })),
          hasMore: sorted.length > sub.maxLimit,
          maxLimit: sub.maxLimit,
        });
      }
    });

  let localQueue = Promise.resolve();

  function enqueueTx(work) {
    if (sharedStore?.enqueueTransaction) {
      return sharedStore.enqueueTransaction(work);
    }

    const next = localQueue.then(work);
    localQueue = next.catch(() => {});
    return next;
  }

  return {
    _clientBridge: {
      customers,
      phoneIndex,
      emailIndex,
      clientProfiles,
      enqueueTx,
    },

    _inspectState() {
      return {
        customers: new Map(customers),
        phoneIndex: new Map(phoneIndex),
        emailIndex: new Map(emailIndex),
        clientProfiles: new Map(clientProfiles),
        bookings: new Map(bookings),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueueTx(async () => {
        const stagedCustomers = new Map(customers);
        const stagedPhoneIndex = new Map(phoneIndex);
        const stagedEmailIndex = new Map(emailIndex);
        const stagedClientProfiles = new Map(clientProfiles);
        const stagedBookings = new Map(bookings);
        let writeStarted = false;

        const txContext = {
          nowValue: () => ({ seconds: Math.floor(Date.now() / 1000) }),
          async getCustomer(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedCustomers.get(id);
            return item ? normalizeCustomerRecord(id, item) : null;
          },
          async getPhoneIndex(hash) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedPhoneIndex.get(hash);
            return item ? normalizePhoneIndexRecord(hash, item) : null;
          },
          async getEmailIndex(normalizedEmail) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEmailIndex.get(normalizedEmail);
            return item ? normalizeEmailIndexRecord(normalizedEmail, item) : null;
          },
          async getClientProfile(customerId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedClientProfiles.get(customerId);
            return item ? { ...item } : null;
          },
          async getBooking(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookings.get(id);
            return item ? normalizeBookingRecord(id, item) : null;
          },
          setCustomer(id, data) {
            writeStarted = true;
            stagedCustomers.set(id, normalizeCustomerRecord(id, data));
          },
          updateCustomer(id, data) {
            writeStarted = true;
            const prev = stagedCustomers.get(id) || {};
            stagedCustomers.set(id, normalizeCustomerRecord(id, { ...prev, ...data }));
          },
          setPhoneIndex(hash, data) {
            writeStarted = true;
            stagedPhoneIndex.set(hash, normalizePhoneIndexRecord(hash, data));
          },
          setEmailIndex(normalizedEmail, data) {
            writeStarted = true;
            stagedEmailIndex.set(normalizedEmail, normalizeEmailIndexRecord(normalizedEmail, data));
          },
          deleteEmailIndex(normalizedEmail) {
            writeStarted = true;
            stagedEmailIndex.delete(normalizedEmail);
          },
          setClientProfile(customerId, data) {
            writeStarted = true;
            stagedClientProfiles.set(customerId, { id: customerId, ...data });
          },
          updateBooking(id, data) {
            writeStarted = true;
            const prev = stagedBookings.get(id) || {};
            stagedBookings.set(id, normalizeBookingRecord(id, { ...prev, ...data }));
          },
        };

        const result = await transactionWork(txContext);

        customers.clear();
        for (const [k, v] of stagedCustomers) customers.set(k, v);
        phoneIndex.clear();
        for (const [k, v] of stagedPhoneIndex) phoneIndex.set(k, v);
        emailIndex.clear();
        for (const [k, v] of stagedEmailIndex) emailIndex.set(k, v);
        clientProfiles.clear();
        for (const [k, v] of stagedClientProfiles) clientProfiles.set(k, v);
        bookings.clear();
        for (const [k, v] of stagedBookings) bookings.set(k, v);

        notifyCustomers();
        sharedStore?.notifyBookings?.();

        return result;
      });
    },

    async getCustomerById(customerId) {
      const item = customers.get(customerId);
      return item ? normalizeCustomerRecord(customerId, item) : null;
    },

    async getCustomersByIds(customerIds = []) {
      const uniqueIds = Array.from(new Set((customerIds || []).filter(Boolean)));
      return uniqueIds
        .map((id) => {
          const item = customers.get(id);
          return item ? normalizeCustomerRecord(id, item) : null;
        })
        .filter(Boolean);
    },

    async getPhoneIndex(phoneHash) {
      const item = phoneIndex.get(phoneHash);
      return item ? normalizePhoneIndexRecord(phoneHash, item) : null;
    },

    async getEmailIndex(normalizedEmail) {
      const item = emailIndex.get(normalizedEmail);
      return item ? normalizeEmailIndexRecord(normalizedEmail, item) : null;
    },

    subscribeCustomers({ maxLimit = CUSTOMERS_DEFAULT_QUERY_LIMIT, onData }) {
      const sub = { maxLimit, onData };
      customerSubscribers.add(sub);
      notifyCustomers();
      return () => {
        customerSubscribers.delete(sub);
      };
    },

    async queryBookingsByCustomerIds({ customerIds = [], perChunkLimit = 100 }) {
      const chunks = chunkArray(customerIds, FIRESTORE_IN_QUERY_CHUNK_SIZE);
      if (chunks.length === 0) return { bookings: [], isTruncated: false };

      let isTruncated = false;
      const chunkResults = chunks.map((chunk) => {
        const idSet = new Set(chunk);
        const matching = Array.from(bookings.values())
          .filter((b) => b.customerId && idSet.has(b.customerId))
          .map((b) => normalizeBookingRecord(b.id, b));
        if (matching.length > perChunkLimit) {
          isTruncated = true;
          return matching.slice(0, perChunkLimit);
        }
        return matching;
      });

      return {
        bookings: mergeAndDeduplicateBookings(chunkResults),
        isTruncated,
      };
    },

    async listBookingsPage({ pageSize = LEGACY_BOOKINGS_SCAN_PAGE_SIZE, cursor = null } = {}) {
      const allSorted = Array.from(bookings.values())
        .map((b) => normalizeBookingRecord(b.id, b))
        .sort((a, b) => {
          const cmp = String(b.date || '').localeCompare(String(a.date || ''));
          if (cmp !== 0) return cmp;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });

      const startIndex = typeof cursor === 'number' ? cursor : 0;
      const slice = allSorted.slice(startIndex, startIndex + pageSize);
      const nextIndex = startIndex + slice.length;
      return {
        bookings: slice,
        nextCursor: nextIndex < allSorted.length ? nextIndex : null,
        hasMore: nextIndex < allSorted.length,
      };
    },

    async commitBatchWrites(operations = []) {
      if (!Array.isArray(operations) || operations.length === 0) return;

      for (let offset = 0; offset < operations.length; offset += MAX_BATCH_WRITES) {
        const slice = operations.slice(offset, offset + MAX_BATCH_WRITES);
        const now = { seconds: Math.floor(Date.now() / 1000) };

        for (const op of slice) {
          const payload = typeof op.buildData === 'function' ? op.buildData(now) : op.data;
          if (op.collection === FIRESTORE_COLLECTIONS.CUSTOMERS) {
            const prev = op.type === 'update' ? customers.get(op.id) || {} : {};
            customers.set(op.id, normalizeCustomerRecord(op.id, { ...prev, ...payload }));
          } else if (op.collection === FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX) {
            const prev = op.type === 'update' ? phoneIndex.get(op.id) || {} : {};
            phoneIndex.set(op.id, normalizePhoneIndexRecord(op.id, { ...prev, ...payload }));
          } else if (op.collection === FIRESTORE_COLLECTIONS.BOOKINGS) {
            const prev = op.type === 'update' ? bookings.get(op.id) || {} : {};
            bookings.set(op.id, normalizeBookingRecord(op.id, { ...prev, ...payload }));
          }
        }
      }

      notifyCustomers();
      sharedStore?.notifyBookings?.();
    },
  };
}

let activeCustomerAdapter = createFirestoreCustomerRepositoryAdapter();

export function getCustomerRepositoryAdapter() {
  return activeCustomerAdapter;
}

export function setCustomerRepositoryAdapter(customAdapter) {
  activeCustomerAdapter = customAdapter || createFirestoreCustomerRepositoryAdapter();
}

export function resetCustomerRepositoryAdapter() {
  activeCustomerAdapter = createFirestoreCustomerRepositoryAdapter();
}
