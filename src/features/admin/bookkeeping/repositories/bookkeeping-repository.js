/**
 * Bookkeeping Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter).
 *
 * Uses strictly single-field indexed queries (`orderBy`, equality, bounded `in`)
 * so zero custom composite indexes are needed in Cloud Firestore.
 */

import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { normalizeInvoiceRecord } from '@/features/admin/payment/schemas/payment-schema';

import {
  BOOKKEEPING_ENTRIES_PAGE_SIZE,
  BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT,
  BOOKKEEPING_PAYABLES_LIMIT,
  BOOKKEEPING_SETTLEMENTS_PAGE_SIZE,
} from '../config/bookkeeping-config';
import {
  normalizeBookkeepingEntryRecord,
  normalizeBookkeepingSettingsRecord,
  normalizeBookkeepingSettlementRecord,
} from '../schemas/bookkeeping-schema';
import { parseJakartaTimestamp } from '../utils/bookkeeping-period';

export function createFirestoreBookkeepingRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ doc, runTransaction, serverTimestamp, Timestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          timestampFromDate: (d) => Timestamp.fromDate(d instanceof Date ? d : new Date()),
          async getBookkeepingEntry(entryId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES, entryId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookkeepingEntryRecord(snap.id, snap.data()) : null;
          },
          async getBookkeepingSettlement(settlementId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTLEMENTS, settlementId);
            const snap = await tx.get(ref);
            return snap.exists()
              ? normalizeBookkeepingSettlementRecord(snap.id, snap.data())
              : null;
          },
          async getBookkeepingSettings() {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTINGS, 'default');
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookkeepingSettingsRecord(snap.id, snap.data()) : null;
          },
          setBookkeepingEntry(entryId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES, entryId);
            tx.set(ref, data);
          },
          updateBookkeepingEntry(entryId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES, entryId);
            tx.update(ref, data);
          },
          setBookkeepingSettlement(settlementId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTLEMENTS, settlementId);
            tx.set(ref, data);
          },
          setBookkeepingSettings(data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTINGS, 'default');
            tx.set(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    subscribeBookkeepingEntries({ maxLimit = BOOKKEEPING_ENTRIES_PAGE_SIZE, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES),
            orderBy('occurredAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const entries = docs.map((d) => normalizeBookkeepingEntryRecord(d.id, d.data()));
              onData?.({ entries, hasMore, maxLimit });
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

    subscribeActivePayables({ maxLimit = BOOKKEEPING_PAYABLES_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_ENTRIES),
            where('settlementStatus', 'in', ['unpaid', 'partially_paid']),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const payables = docs.map((d) => normalizeBookkeepingEntryRecord(d.id, d.data()));
              onData?.({ payables, hasMore, maxLimit });
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

    subscribeBookkeepingSettlements({
      maxLimit = BOOKKEEPING_SETTLEMENTS_PAGE_SIZE,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTLEMENTS),
            orderBy('paidAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const settlements = docs.map((d) =>
                normalizeBookkeepingSettlementRecord(d.id, d.data()),
              );
              onData?.({ settlements, hasMore, maxLimit });
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

    subscribeEntrySettlements({ entryId, maxLimit = 100, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!entryId) {
        onData?.([]);
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTLEMENTS),
            where('entryId', '==', entryId),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const items = snapshot.docs
                .map((d) => normalizeBookkeepingSettlementRecord(d.id, d.data()))
                .sort(
                  (a, b) =>
                    parseJakartaTimestamp(b.paidAt || b.createdAt).millis -
                    parseJakartaTimestamp(a.paidAt || a.createdAt).millis,
                );
              onData?.(items);
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

    subscribeOutstandingInvoices({
      maxLimit = BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.INVOICES),
            where('paymentStatus', 'in', ['unpaid', 'partial']),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const invoices = docs.map((d) => normalizeInvoiceRecord(d.id, d.data()));
              onData?.({ invoices, hasMore, maxLimit });
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

    subscribeBookkeepingSettings({ onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          unsubscribe = onSnapshot(
            doc(db, FIRESTORE_COLLECTIONS.BOOKKEEPING_SETTINGS, 'default'),
            (snap) => {
              if (isCancelled) return;
              const docExists = typeof snap?.exists === 'function' ? snap.exists() : false;
              onData?.(
                docExists
                  ? normalizeBookkeepingSettingsRecord(snap.id, snap.data())
                  : normalizeBookkeepingSettingsRecord('default', {}),
              );
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
  };
}

/**
 * In-memory transactional repository adapter sharing `_sharedStore` with Calendar, Payment,
 * and Commission adapters so end-to-end financial flows share live atomic state in tests.
 */
export function createInMemoryBookkeepingRepositoryAdapter(bookingAdapter = null) {
  const sharedStore = bookingAdapter?._sharedStore || null;
  const invoices = sharedStore?.invoices || new Map();
  const bookkeepingEntries = sharedStore?.bookkeepingEntries || new Map();
  const bookkeepingSettlements = sharedStore?.bookkeepingSettlements || new Map();
  const bookkeepingSettings = sharedStore?.bookkeepingSettings || new Map();
  const bookkeepingSubscribers = sharedStore?.bookkeepingSubscribers || new Set();

  const entriesSubs = new Set();
  const activePayablesSubs = new Set();
  const settlementsSubs = new Set();
  const entrySettlementSubs = new Map();
  const outstandingInvoiceSubs = new Set();
  const settingsSubs = new Set();

  let localQueue = Promise.resolve();
  const enqueue =
    sharedStore?.enqueueTransaction ||
    ((work) => {
      const next = localQueue.then(work);
      localQueue = next.catch(() => {});
      return next;
    });

  function emitAll() {
    const sortedEntries = Array.from(bookkeepingEntries.entries())
      .map(([id, data]) => normalizeBookkeepingEntryRecord(id, data))
      .sort(
        (a, b) =>
          parseJakartaTimestamp(b.occurredAt || b.createdAt).millis -
          parseJakartaTimestamp(a.occurredAt || a.createdAt).millis,
      );

    for (const sub of entriesSubs) {
      sub.onData?.({
        entries: sortedEntries.slice(0, sub.maxLimit),
        hasMore: sortedEntries.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    const payablesList = sortedEntries.filter(
      (entry) => entry.settlementStatus === 'unpaid' || entry.settlementStatus === 'partially_paid',
    );
    for (const sub of activePayablesSubs) {
      sub.onData?.({
        payables: payablesList.slice(0, sub.maxLimit),
        hasMore: payablesList.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    const sortedSettlements = Array.from(bookkeepingSettlements.entries())
      .map(([id, data]) => normalizeBookkeepingSettlementRecord(id, data))
      .sort(
        (a, b) =>
          parseJakartaTimestamp(b.paidAt || b.createdAt).millis -
          parseJakartaTimestamp(a.paidAt || a.createdAt).millis,
      );

    for (const sub of settlementsSubs) {
      sub.onData?.({
        settlements: sortedSettlements.slice(0, sub.maxLimit),
        hasMore: sortedSettlements.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [entryId, listeners] of entrySettlementSubs.entries()) {
      const matching = sortedSettlements.filter((s) => s.entryId === entryId);
      for (const cb of listeners) {
        cb?.(matching);
      }
    }

    const outstandingInv = Array.from(invoices.values())
      .map((inv) => normalizeInvoiceRecord(inv.id, inv))
      .filter((inv) => inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial');
    for (const sub of outstandingInvoiceSubs) {
      sub.onData?.({
        invoices: outstandingInv.slice(0, sub.maxLimit),
        hasMore: outstandingInv.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    const rawSettings = bookkeepingSettings.get('default') || {};
    const normSettings = normalizeBookkeepingSettingsRecord('default', rawSettings);
    for (const cb of settingsSubs) {
      cb?.(normSettings);
    }
  }

  bookkeepingSubscribers.add(emitAll);

  return {
    _inspectState() {
      return {
        bookkeepingEntries: new Map(bookkeepingEntries),
        bookkeepingSettlements: new Map(bookkeepingSettlements),
        bookkeepingSettings: new Map(bookkeepingSettings),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueue(async () => {
        const stagedEntries = new Map(bookkeepingEntries);
        const stagedSettlements = new Map(bookkeepingSettlements);
        const stagedSettings = new Map(bookkeepingSettings);
        let writeStarted = false;

        const txContext = {
          nowValue: () => new Date(),
          timestampFromDate: (d) => (d instanceof Date ? d : new Date(d)),
          async getBookkeepingEntry(entryId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const raw = stagedEntries.get(entryId);
            return raw ? normalizeBookkeepingEntryRecord(entryId, raw) : null;
          },
          async getBookkeepingSettlement(settlementId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const raw = stagedSettlements.get(settlementId);
            return raw ? normalizeBookkeepingSettlementRecord(settlementId, raw) : null;
          },
          async getBookkeepingSettings() {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const raw = stagedSettings.get('default');
            return raw ? normalizeBookkeepingSettingsRecord('default', raw) : null;
          },
          setBookkeepingEntry(entryId, data) {
            writeStarted = true;
            stagedEntries.set(entryId, { ...data, id: entryId });
          },
          updateBookkeepingEntry(entryId, data) {
            writeStarted = true;
            const prev = stagedEntries.get(entryId) || {};
            stagedEntries.set(entryId, { ...prev, ...data, id: entryId });
          },
          setBookkeepingSettlement(settlementId, data) {
            writeStarted = true;
            stagedSettlements.set(settlementId, { ...data, id: settlementId });
          },
          setBookkeepingSettings(data) {
            writeStarted = true;
            stagedSettings.set('default', { ...data, id: 'default' });
          },
        };

        const result = await transactionWork(txContext);

        bookkeepingEntries.clear();
        for (const [k, v] of stagedEntries) bookkeepingEntries.set(k, v);
        bookkeepingSettlements.clear();
        for (const [k, v] of stagedSettlements) bookkeepingSettlements.set(k, v);
        bookkeepingSettings.clear();
        for (const [k, v] of stagedSettings) bookkeepingSettings.set(k, v);

        emitAll();
        sharedStore?.notifyCommissions?.();
        return result;
      });
    },

    subscribeBookkeepingEntries({ maxLimit = BOOKKEEPING_ENTRIES_PAGE_SIZE, onData }) {
      const sub = { maxLimit, onData };
      entriesSubs.add(sub);
      emitAll();
      return () => {
        entriesSubs.delete(sub);
      };
    },

    subscribeActivePayables({ maxLimit = BOOKKEEPING_PAYABLES_LIMIT, onData }) {
      const sub = { maxLimit, onData };
      activePayablesSubs.add(sub);
      emitAll();
      return () => {
        activePayablesSubs.delete(sub);
      };
    },

    subscribeBookkeepingSettlements({ maxLimit = BOOKKEEPING_SETTLEMENTS_PAGE_SIZE, onData }) {
      const sub = { maxLimit, onData };
      settlementsSubs.add(sub);
      emitAll();
      return () => {
        settlementsSubs.delete(sub);
      };
    },

    subscribeEntrySettlements({ entryId, onData }) {
      if (!entryId) {
        onData?.([]);
        return () => {};
      }
      if (!entrySettlementSubs.has(entryId)) {
        entrySettlementSubs.set(entryId, new Set());
      }
      const set = entrySettlementSubs.get(entryId);
      set.add(onData);
      emitAll();
      return () => {
        set.delete(onData);
      };
    },

    subscribeOutstandingInvoices({ maxLimit = BOOKKEEPING_OUTSTANDING_INVOICES_LIMIT, onData }) {
      const sub = { maxLimit, onData };
      outstandingInvoiceSubs.add(sub);
      emitAll();
      return () => {
        outstandingInvoiceSubs.delete(sub);
      };
    },

    subscribeBookkeepingSettings({ onData }) {
      settingsSubs.add(onData);
      emitAll();
      return () => {
        settingsSubs.delete(onData);
      };
    },
  };
}

let activeBookkeepingAdapter = createFirestoreBookkeepingRepositoryAdapter();

export function getBookkeepingRepositoryAdapter() {
  return activeBookkeepingAdapter;
}

export function setBookkeepingRepositoryAdapter(customAdapter) {
  activeBookkeepingAdapter = customAdapter || createFirestoreBookkeepingRepositoryAdapter();
}

export function resetBookkeepingRepositoryAdapter() {
  activeBookkeepingAdapter = createFirestoreBookkeepingRepositoryAdapter();
}
