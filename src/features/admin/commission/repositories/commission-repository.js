/**
 * Commission & Fee Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter)
 * for 37 Music Studio (Phase 9 — Commission & Fee Management).
 *
 * Strictly uses single-field queries (`actualCompletedAt`, `postedAt`, chunked `bookingId in [...]`,
 * `batchId == ...`, `sourceId == ...`) so zero custom composite indexes are required.
 */

import {
  FIRESTORE_COLLECTIONS,
  normalizeBookingRecord,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  chunkArray,
  FIRESTORE_IN_QUERY_CHUNK_SIZE,
} from '@/features/admin/customer/utils/customer-history';

import {
  normalizeBookkeepingEntryRecord,
  normalizeCommissionBatchRecord,
  normalizeCommissionPostingItemRecord,
  normalizeCommissionReviewBookingRecord,
  normalizeCommissionReviewResolutionRecord,
} from '../schemas/commission-schema';
import { parseJakartaTimestamp } from '../utils/commission-period';

export const COMMISSION_REVIEW_PAGE_SIZE = 100;
export const COMMISSION_BATCHES_PAGE_SIZE = 50;

/**
 * Shared chunked single-field (`bookingId in [...]`) realtime listener avoiding N+1
 * listeners and requiring zero custom composite indexes in Firestore.
 */
function subscribeFirestoreCollectionByBookingIds({
  collectionName,
  normalizeRecord,
  bookingIds = [],
  onData,
  onError,
}) {
  const uniqueIds = Array.from(new Set((bookingIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    onData?.(new Map());
    return () => {};
  }

  const chunks = chunkArray(uniqueIds, FIRESTORE_IN_QUERY_CHUNK_SIZE);
  const chunkMaps = new Map();
  const unsubscribes = [];
  let isCancelled = false;

  const emitCombined = () => {
    const combined = new Map();
    for (const map of chunkMaps.values()) {
      for (const [k, v] of map.entries()) {
        combined.set(k, v);
      }
    }
    onData?.(combined);
  };

  (async () => {
    try {
      const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      if (isCancelled) return;

      const db = getFirebaseDb();
      const colRef = collection(db, collectionName);

      chunks.forEach((chunk, chunkIdx) => {
        const q = query(colRef, where('bookingId', 'in', chunk), limit(chunk.length + 2));
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            if (isCancelled) return;
            const localMap = new Map();
            for (const docSnap of snapshot.docs) {
              const item = normalizeRecord(docSnap.id, docSnap.data());
              if (item.bookingId) {
                localMap.set(item.bookingId, item);
              }
            }
            chunkMaps.set(chunkIdx, localMap);
            emitCombined();
          },
          (err) => {
            if (!isCancelled) onError?.(err);
          },
        );
        unsubscribes.push(unsub);
      });
    } catch (err) {
      if (!isCancelled) onError?.(err);
    }
  })();

  return () => {
    isCancelled = true;
    for (const unsub of unsubscribes) {
      unsub?.();
    }
  };
}

/**
 * Default Cloud Firestore Commission Repository Adapter using shared `getFirebaseDb()`.
 */
export function createFirestoreCommissionRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ doc, runTransaction, serverTimestamp, Timestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          timestampFromDate: (date) => Timestamp.fromDate(date instanceof Date ? date : new Date()),
          async getCommissionBatch(batchId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_BATCHES, batchId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeCommissionBatchRecord(snap.id, snap.data()) : null;
          },
          async getCommissionPostingItem(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_POSTING_ITEMS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists()
              ? normalizeCommissionPostingItemRecord(snap.id, snap.data())
              : null;
          },
          async getCommissionReviewResolution(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_REVIEW_RESOLUTIONS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists()
              ? normalizeCommissionReviewResolutionRecord(snap.id, snap.data())
              : null;
          },
          async getBookkeepingEntry(entryId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES, entryId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookkeepingEntryRecord(snap.id, snap.data()) : null;
          },
          async getBooking(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists()
              ? normalizeCommissionReviewBookingRecord(snap.id, snap.data(), normalizeBookingRecord)
              : null;
          },
          setCommissionBatch(batchId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_BATCHES, batchId);
            tx.set(ref, data);
          },
          setCommissionPostingItem(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_POSTING_ITEMS, bookingId);
            tx.set(ref, data);
          },
          setCommissionReviewResolution(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.COMMISSION_REVIEW_RESOLUTIONS, bookingId);
            tx.set(ref, data);
          },
          setBookkeepingEntry(entryId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES, entryId);
            tx.set(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    subscribePeriodCompletedBookings({
      startDate,
      endDate,
      maxLimit = COMMISSION_REVIEW_PAGE_SIZE,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!startDate || !endDate) {
        onData?.({ bookings: [], hasMore: false, maxLimit });
        return () => {};
      }

      (async () => {
        try {
          const [
            { collection, limit, onSnapshot, orderBy, query, Timestamp, where },
            { getFirebaseDb },
          ] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);
          const toTs = (d) => (Timestamp?.fromDate ? Timestamp.fromDate(d) : d);
          const periodQuery = query(
            bookingsRef,
            where('actualCompletedAt', '>=', toTs(startDate)),
            where('actualCompletedAt', '<=', toTs(endDate)),
            orderBy('actualCompletedAt', 'asc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            periodQuery,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const bookings = docs.map((docSnap) =>
                normalizeCommissionReviewBookingRecord(
                  docSnap.id,
                  docSnap.data(),
                  normalizeBookingRecord,
                ),
              );
              onData?.({ bookings, hasMore, maxLimit });
            },
            (err) => {
              if (!isCancelled) onError?.(err);
            },
          );
        } catch (err) {
          if (!isCancelled) onError?.(err);
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribe?.();
      };
    },

    subscribePostingItemsForBookingIds({ bookingIds = [], onData, onError }) {
      return subscribeFirestoreCollectionByBookingIds({
        collectionName: FIRESTORE_COLLECTIONS.COMMISSION_POSTING_ITEMS,
        normalizeRecord: normalizeCommissionPostingItemRecord,
        bookingIds,
        onData,
        onError,
      });
    },

    subscribeReviewResolutionsForBookingIds({ bookingIds = [], onData, onError }) {
      return subscribeFirestoreCollectionByBookingIds({
        collectionName: FIRESTORE_COLLECTIONS.COMMISSION_REVIEW_RESOLUTIONS,
        normalizeRecord: normalizeCommissionReviewResolutionRecord,
        bookingIds,
        onData,
        onError,
      });
    },

    subscribeCommissionBatches({ maxLimit = COMMISSION_BATCHES_PAGE_SIZE, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.COMMISSION_BATCHES),
            orderBy('postedAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const batches = docs.map((d) => normalizeCommissionBatchRecord(d.id, d.data()));
              onData?.({ batches, hasMore, maxLimit });
            },
            (err) => {
              if (!isCancelled) onError?.(err);
            },
          );
        } catch (err) {
          if (!isCancelled) onError?.(err);
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribe?.();
      };
    },

    async getCommissionBatchDetails(batchId) {
      const cleanBatchId = String(batchId || '').trim();
      if (!cleanBatchId) {
        return { postingItems: [], bookkeepingEntries: [] };
      }

      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      const itemsQuery = query(
        collection(db, FIRESTORE_COLLECTIONS.COMMISSION_POSTING_ITEMS),
        where('batchId', '==', cleanBatchId),
        limit(150),
      );
      const entriesQuery = query(
        collection(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES),
        where('sourceId', '==', cleanBatchId),
        limit(10),
      );

      const [itemsSnap, entriesSnap] = await Promise.all([
        getDocs(itemsQuery),
        getDocs(entriesQuery),
      ]);

      const postingItems = itemsSnap.docs
        .map((d) => normalizeCommissionPostingItemRecord(d.id, d.data()))
        .sort(
          (a, b) =>
            parseJakartaTimestamp(a.completedAt).millis -
            parseJakartaTimestamp(b.completedAt).millis,
        );

      const bookkeepingEntries = entriesSnap.docs
        .map((d) => normalizeBookkeepingEntryRecord(d.id, d.data()))
        .sort((a, b) => a.category.localeCompare(b.category));

      return { postingItems, bookkeepingEntries };
    },
  };
}

/**
 * In-memory Commission Repository Adapter sharing live state and transaction queue
 * with `createInMemoryBookingRepositoryAdapter()` for deterministic automated testing.
 */
export function createInMemoryCommissionRepositoryAdapter(bookingAdapter = null) {
  const sharedStore = bookingAdapter?._sharedStore || null;
  const bookings = sharedStore?.bookings || new Map();
  const rawCommissionSnapshots = sharedStore?.rawCommissionSnapshots || new Map();
  const commissionBatches = sharedStore?.commissionBatches || new Map();
  const commissionPostingItems = sharedStore?.commissionPostingItems || new Map();
  const commissionReviewResolutions = sharedStore?.commissionReviewResolutions || new Map();
  const bookkeepingEntries = sharedStore?.bookkeepingEntries || new Map();
  const sharedCommissionSubscribers = sharedStore?.commissionSubscribers || new Set();

  const periodSubscribers = new Set();
  const postingItemSubscribers = new Set();
  const resolutionSubscribers = new Set();
  const batchSubscribers = new Set();

  let localQueue = Promise.resolve();
  const enqueue =
    sharedStore?.enqueueTransaction ||
    ((work) => {
      const next = localQueue.then(work);
      localQueue = next.catch(() => {});
      return next;
    });

  function readNormalizedReviewBooking(bookingId) {
    const base = bookings.get(bookingId);
    if (!base) return null;
    const rawSnap = rawCommissionSnapshots.has(bookingId)
      ? rawCommissionSnapshots.get(bookingId)
      : base.commissionSnapshot;
    return normalizeCommissionReviewBookingRecord(
      bookingId,
      { ...base, rawCommissionSnapshot: rawSnap },
      normalizeBookingRecord,
    );
  }

  function emitPeriodSubscribers() {
    for (const sub of periodSubscribers) {
      const startMs = sub.startDate instanceof Date ? sub.startDate.getTime() : 0;
      const endMs = sub.endDate instanceof Date ? sub.endDate.getTime() : Number.MAX_SAFE_INTEGER;

      const matching = Array.from(bookings.keys())
        .map((id) => readNormalizedReviewBooking(id))
        .filter((b) => {
          if (!b) return false;
          const ts = parseJakartaTimestamp(b.actualCompletedAt);
          return ts.isValid && ts.millis >= startMs && ts.millis <= endMs;
        })
        .sort(
          (a, b) =>
            parseJakartaTimestamp(a.actualCompletedAt).millis -
            parseJakartaTimestamp(b.actualCompletedAt).millis,
        );

      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        bookings: limited,
        hasMore: matching.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function emitPostingItemSubscribers() {
    for (const sub of postingItemSubscribers) {
      const resultMap = new Map();
      for (const bId of sub.bookingIds) {
        const item = commissionPostingItems.get(bId);
        if (item) {
          resultMap.set(bId, normalizeCommissionPostingItemRecord(bId, item));
        }
      }
      sub.onData?.(resultMap);
    }
  }

  function emitResolutionSubscribers() {
    for (const sub of resolutionSubscribers) {
      const resultMap = new Map();
      for (const bId of sub.bookingIds) {
        const item = commissionReviewResolutions.get(bId);
        if (item) {
          resultMap.set(bId, normalizeCommissionReviewResolutionRecord(bId, item));
        }
      }
      sub.onData?.(resultMap);
    }
  }

  function emitBatchSubscribers() {
    const sorted = Array.from(commissionBatches.values())
      .map((b) => normalizeCommissionBatchRecord(b.id, b))
      .sort((a, b) => {
        const diff =
          parseJakartaTimestamp(b.postedAt).millis - parseJakartaTimestamp(a.postedAt).millis;
        if (diff !== 0) return diff;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

    for (const sub of batchSubscribers) {
      sub.onData?.({
        batches: sorted.slice(0, sub.maxLimit),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }
  }

  const bookingChangeListener = () => {
    emitPeriodSubscribers();
  };
  sharedCommissionSubscribers.add(bookingChangeListener);

  return {
    _inspectState() {
      return {
        bookings: new Map(bookings),
        commissionBatches: new Map(commissionBatches),
        commissionPostingItems: new Map(commissionPostingItems),
        commissionReviewResolutions: new Map(commissionReviewResolutions),
        bookkeepingEntries: new Map(bookkeepingEntries),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueue(async () => {
        const stagedBatches = new Map(commissionBatches);
        const stagedItems = new Map(commissionPostingItems);
        const stagedResolutions = new Map(commissionReviewResolutions);
        const stagedEntries = new Map(bookkeepingEntries);
        let writeStarted = false;

        const txContext = {
          nowValue: () => ({ seconds: Math.floor(Date.now() / 1000) }),
          timestampFromDate: (date) => ({
            seconds: Math.floor((date instanceof Date ? date.getTime() : Date.now()) / 1000),
          }),
          async getCommissionBatch(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBatches.get(id);
            return item ? normalizeCommissionBatchRecord(id, item) : null;
          },
          async getCommissionPostingItem(bookingId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedItems.get(bookingId);
            return item ? normalizeCommissionPostingItemRecord(bookingId, item) : null;
          },
          async getCommissionReviewResolution(bookingId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedResolutions.get(bookingId);
            return item ? normalizeCommissionReviewResolutionRecord(bookingId, item) : null;
          },
          async getBookkeepingEntry(entryId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEntries.get(entryId);
            return item ? normalizeBookkeepingEntryRecord(entryId, item) : null;
          },
          async getBooking(bookingId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            return readNormalizedReviewBooking(bookingId);
          },
          setCommissionBatch(id, data) {
            writeStarted = true;
            stagedBatches.set(id, normalizeCommissionBatchRecord(id, data));
          },
          setCommissionPostingItem(bookingId, data) {
            writeStarted = true;
            stagedItems.set(bookingId, normalizeCommissionPostingItemRecord(bookingId, data));
          },
          setCommissionReviewResolution(bookingId, data) {
            writeStarted = true;
            stagedResolutions.set(
              bookingId,
              normalizeCommissionReviewResolutionRecord(bookingId, data),
            );
          },
          setBookkeepingEntry(entryId, data) {
            writeStarted = true;
            stagedEntries.set(entryId, normalizeBookkeepingEntryRecord(entryId, data));
          },
        };

        const result = await transactionWork(txContext);

        commissionBatches.clear();
        for (const [k, v] of stagedBatches) commissionBatches.set(k, v);
        commissionPostingItems.clear();
        for (const [k, v] of stagedItems) commissionPostingItems.set(k, v);
        commissionReviewResolutions.clear();
        for (const [k, v] of stagedResolutions) commissionReviewResolutions.set(k, v);
        bookkeepingEntries.clear();
        for (const [k, v] of stagedEntries) bookkeepingEntries.set(k, v);

        emitPostingItemSubscribers();
        emitResolutionSubscribers();
        emitBatchSubscribers();

        return result;
      });
    },

    subscribePeriodCompletedBookings({
      startDate,
      endDate,
      maxLimit = COMMISSION_REVIEW_PAGE_SIZE,
      onData,
    }) {
      const sub = { startDate, endDate, maxLimit, onData };
      periodSubscribers.add(sub);
      emitPeriodSubscribers();
      return () => {
        periodSubscribers.delete(sub);
      };
    },

    subscribePostingItemsForBookingIds({ bookingIds = [], onData }) {
      const uniqueIds = Array.from(new Set((bookingIds || []).filter(Boolean)));
      if (uniqueIds.length === 0) {
        onData?.(new Map());
        return () => {};
      }
      const sub = { bookingIds: uniqueIds, onData };
      postingItemSubscribers.add(sub);
      emitPostingItemSubscribers();
      return () => {
        postingItemSubscribers.delete(sub);
      };
    },

    subscribeReviewResolutionsForBookingIds({ bookingIds = [], onData }) {
      const uniqueIds = Array.from(new Set((bookingIds || []).filter(Boolean)));
      if (uniqueIds.length === 0) {
        onData?.(new Map());
        return () => {};
      }
      const sub = { bookingIds: uniqueIds, onData };
      resolutionSubscribers.add(sub);
      emitResolutionSubscribers();
      return () => {
        resolutionSubscribers.delete(sub);
      };
    },

    subscribeCommissionBatches({ maxLimit = COMMISSION_BATCHES_PAGE_SIZE, onData }) {
      const sub = { maxLimit, onData };
      batchSubscribers.add(sub);
      emitBatchSubscribers();
      return () => {
        batchSubscribers.delete(sub);
      };
    },

    async getCommissionBatchDetails(batchId) {
      const cleanBatchId = String(batchId || '').trim();
      const postingItems = Array.from(commissionPostingItems.values())
        .filter((item) => item.batchId === cleanBatchId)
        .map((item) => normalizeCommissionPostingItemRecord(item.id, item))
        .sort(
          (a, b) =>
            parseJakartaTimestamp(a.completedAt).millis -
            parseJakartaTimestamp(b.completedAt).millis,
        );

      const bookkeeping = Array.from(bookkeepingEntries.values())
        .filter((entry) => entry.sourceId === cleanBatchId)
        .map((entry) => normalizeBookkeepingEntryRecord(entry.id, entry))
        .sort((a, b) => a.category.localeCompare(b.category));

      return { postingItems, bookkeepingEntries: bookkeeping };
    },
  };
}

let activeCommissionAdapter = createFirestoreCommissionRepositoryAdapter();

export function getCommissionRepositoryAdapter() {
  return activeCommissionAdapter;
}

export function setCommissionRepositoryAdapter(customAdapter) {
  activeCommissionAdapter = customAdapter || createFirestoreCommissionRepositoryAdapter();
}

export function resetCommissionRepositoryAdapter() {
  activeCommissionAdapter = createFirestoreCommissionRepositoryAdapter();
}
