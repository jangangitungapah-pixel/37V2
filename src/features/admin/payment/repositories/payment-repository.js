/**
 * Payment & Invoice Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter)
 * for 37 Music Studio (Phase 8 — Payment & Bill Management).
 *
 * Uses strictly single-field indexes and chunked `in` queries (`<= 10`) so zero
 * custom composite indexes are required in Firestore.
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
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '../schemas/payment-schema';
import { normalizePaymentEvidenceRecord } from '@/features/payment-evidence/schemas/payment-evidence-schema';
import { getTimestampMillis } from '../utils/invoice-format';

export const INVOICES_DEFAULT_QUERY_LIMIT = 200;
export const TRANSACTIONS_DEFAULT_QUERY_LIMIT = 200;
export const CALENDAR_INVOICE_SUMMARY_LIMIT = 300;
export const LEGACY_INVOICE_SCAN_PAGE_SIZE = 200;
export const MAX_PAYMENT_BATCH_WRITES = 5;

function deduplicateAndSortInvoices(chunks = []) {
  const byId = new Map();
  for (const list of chunks) {
    for (const inv of list || []) {
      if (inv?.id && !byId.has(inv.id)) {
        byId.set(inv.id, inv);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const dateCmp = String(b.bookingSnapshot?.bookingDate || '').localeCompare(
      String(a.bookingSnapshot?.bookingDate || ''),
    );
    if (dateCmp !== 0) return dateCmp;
    return getTimestampMillis(b.invoiceDate) - getTimestampMillis(a.invoiceDate);
  });
}

/**
 * Default Cloud Firestore Payment & Invoice Repository Adapter
 * using the shared `getFirebaseDb()` instance.
 */
export function createFirestorePaymentRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ doc, runTransaction, serverTimestamp, Timestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          timestampFromDate: (date) => Timestamp.fromDate(date instanceof Date ? date : new Date()),
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
          async getBooking(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookingRecord(snap.id, snap.data()) : null;
          },
          async getPaymentEvidence(evidenceId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE, evidenceId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizePaymentEvidenceRecord(snap.id, snap.data()) : null;
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
          updatePaymentEvidence(evidenceId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE, evidenceId);
            tx.update(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    async getInvoiceById(invoiceId) {
      if (!invoiceId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId));
      return snap.exists() ? normalizeInvoiceRecord(snap.id, snap.data()) : null;
    },

    async getInvoicesByIds(invoiceIds = []) {
      const uniqueIds = Array.from(new Set((invoiceIds || []).filter(Boolean)));
      if (uniqueIds.length === 0) return [];
      const results = await Promise.all(uniqueIds.map((id) => this.getInvoiceById(id)));
      return results.filter(Boolean);
    },

    async getPaymentTransactionById(transactionId) {
      if (!transactionId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS, transactionId));
      return snap.exists() ? normalizePaymentTransactionRecord(snap.id, snap.data()) : null;
    },

    subscribeInvoices({ maxLimit = INVOICES_DEFAULT_QUERY_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.INVOICES),
            orderBy('invoiceDate', 'desc'),
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

    subscribeInvoiceById({ invoiceId, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!invoiceId) {
        onData?.(null);
        return () => {};
      }

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          unsubscribe = onSnapshot(
            doc(db, FIRESTORE_COLLECTIONS.INVOICES, invoiceId),
            (snap) => {
              if (isCancelled) return;
              onData?.(snap.exists() ? normalizeInvoiceRecord(snap.id, snap.data()) : null);
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

    subscribeInvoicesInBookingDateRange({
      startDate,
      endDate,
      maxLimit = CALENDAR_INVOICE_SUMMARY_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!startDate || !endDate) {
        onData?.({ invoices: [], isTruncated: false });
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          // Single-field range query on nested `bookingSnapshot.bookingDate` (no composite index needed)
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.INVOICES),
            where('bookingSnapshot.bookingDate', '>=', startDate),
            where('bookingSnapshot.bookingDate', '<=', endDate),
            orderBy('bookingSnapshot.bookingDate', 'asc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const invoices = snapshot.docs.map((d) => normalizeInvoiceRecord(d.id, d.data()));
              onData?.({
                invoices,
                isTruncated: snapshot.docs.length >= maxLimit,
              });
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

    subscribePaymentTransactions({ maxLimit = TRANSACTIONS_DEFAULT_QUERY_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS),
            orderBy('receivedAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const transactions = docs.map((d) =>
                normalizePaymentTransactionRecord(d.id, d.data()),
              );
              onData?.({ transactions, hasMore, maxLimit });
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

    subscribeInvoiceTransactions({ invoiceId, maxLimit = 200, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!invoiceId) {
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
            collection(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS),
            where('invoiceId', '==', invoiceId),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const transactions = snapshot.docs
                .map((d) => normalizePaymentTransactionRecord(d.id, d.data()))
                .sort((a, b) => {
                  const diff =
                    getTimestampMillis(b.receivedAt || b.createdAt) -
                    getTimestampMillis(a.receivedAt || a.createdAt);
                  if (diff !== 0) return diff;
                  return String(b.id || '').localeCompare(String(a.id || ''));
                });
              onData?.(transactions);
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

    async queryInvoicesByCustomerIds({ customerIds = [], perChunkLimit = 100 } = {}) {
      const chunks = chunkArray(customerIds, FIRESTORE_IN_QUERY_CHUNK_SIZE);
      if (chunks.length === 0) {
        return { invoices: [], isTruncated: false };
      }

      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const invoicesRef = collection(db, FIRESTORE_COLLECTIONS.INVOICES);

      let isTruncated = false;
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          const q = query(invoicesRef, where('customerId', 'in', chunk), limit(perChunkLimit));
          const snap = await getDocs(q);
          if (snap.docs.length >= perChunkLimit) {
            isTruncated = true;
          }
          return snap.docs.map((d) => normalizeInvoiceRecord(d.id, d.data()));
        }),
      );

      return {
        invoices: deduplicateAndSortInvoices(chunkResults),
        isTruncated,
      };
    },

    async listBookingsPage({ pageSize = LEGACY_INVOICE_SCAN_PAGE_SIZE, cursor = null } = {}) {
      const [{ collection, getDocs, limit, orderBy, query, startAfter }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);

      const constraints = [orderBy('date', 'desc')];
      if (cursor) {
        constraints.push(startAfter(cursor));
      }
      constraints.push(limit(pageSize));

      const snap = await getDocs(query(bookingsRef, ...constraints));
      const bookings = snap.docs.map((d) => normalizeBookingRecord(d.id, d.data()));
      const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      return {
        bookings,
        nextCursor: snap.docs.length >= pageSize ? lastDoc : null,
        hasMore: snap.docs.length >= pageSize,
      };
    },

    async commitBatchWrites(operations = []) {
      if (!Array.isArray(operations) || operations.length === 0) return;

      const [{ doc, serverTimestamp, Timestamp, writeBatch }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      for (let offset = 0; offset < operations.length; offset += MAX_PAYMENT_BATCH_WRITES) {
        const slice = operations.slice(offset, offset + MAX_PAYMENT_BATCH_WRITES);
        const batch = writeBatch(db);
        const now = serverTimestamp();

        for (const op of slice) {
          const ref = doc(db, op.collection, op.id);
          const data =
            typeof op.buildData === 'function'
              ? op.buildData({
                  now,
                  timestampFromDate: (d) => Timestamp.fromDate(d instanceof Date ? d : new Date()),
                })
              : op.data;
          if (op.type === 'update') {
            batch.update(ref, data);
          } else {
            batch.set(ref, data);
          }
        }

        await batch.commit();
      }
    },
  };
}

/**
 * In-memory Payment & Invoice Repository Adapter that optionally shares the exact same
 * live Maps and transaction queue with `createInMemoryBookingRepositoryAdapter()`
 * so Calendar, Customer, and Payment operations stay 100% transactionally synchronized.
 */
export function createInMemoryPaymentRepositoryAdapter(bookingAdapter = null) {
  const sharedStore = bookingAdapter?._sharedStore || null;
  const bookings = sharedStore?.bookings || new Map();
  const invoices = sharedStore?.invoices || new Map();
  const paymentTransactions = sharedStore?.paymentTransactions || new Map();
  const paymentEvidence = sharedStore?.paymentEvidence || new Map();
  const invoiceSubscribers = sharedStore?.invoiceSubscribers || new Set();
  const invoiceDocSubscribers = sharedStore?.invoiceDocSubscribers || new Map();
  const invoiceRangeSubscribers = sharedStore?.invoiceRangeSubscribers || new Set();
  const transactionSubscribers = sharedStore?.transactionSubscribers || new Set();
  const invoiceTransactionSubscribers = sharedStore?.invoiceTransactionSubscribers || new Map();
  const paymentEvidenceSubscribers = sharedStore?.paymentEvidenceSubscribers || new Set();

  let localQueue = Promise.resolve();
  const enqueue =
    sharedStore?.enqueueTransaction ||
    ((work) => {
      const next = localQueue.then(work);
      localQueue = next.catch(() => {});
      return next;
    });

  function notifyInvoices() {
    if (sharedStore?.notifyInvoices) {
      sharedStore.notifyInvoices();
      return;
    }

    const sorted = Array.from(invoices.values()).sort((a, b) => {
      const diff = getTimestampMillis(b.invoiceDate) - getTimestampMillis(a.invoiceDate);
      if (diff !== 0) return diff;
      return String(b.invoiceNumber || '').localeCompare(String(a.invoiceNumber || ''));
    });

    for (const sub of invoiceSubscribers) {
      const limited = sorted.slice(0, sub.maxLimit);
      sub.onData?.({
        invoices: limited.map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceDocSubscribers.entries()) {
      const target = invoices.get(invoiceId);
      const normalized = target ? normalizeInvoiceRecord(invoiceId, target) : null;
      for (const cb of listeners) {
        cb(normalized);
      }
    }

    for (const sub of invoiceRangeSubscribers) {
      const matching = Array.from(invoices.values())
        .filter((inv) => {
          const d = inv.bookingSnapshot?.bookingDate || '';
          return d >= sub.startDate && d <= sub.endDate;
        })
        .sort((a, b) =>
          String(a.bookingSnapshot?.bookingDate || '').localeCompare(
            String(b.bookingSnapshot?.bookingDate || ''),
          ),
        );
      sub.onData?.({
        invoices: matching.slice(0, sub.maxLimit).map((inv) => normalizeInvoiceRecord(inv.id, inv)),
        isTruncated: matching.length > sub.maxLimit,
      });
    }
  }

  function notifyTransactions() {
    if (sharedStore?.notifyTransactions) {
      sharedStore.notifyTransactions();
      return;
    }

    const sorted = Array.from(paymentTransactions.values()).sort((a, b) => {
      const diff =
        getTimestampMillis(b.receivedAt || b.createdAt) -
        getTimestampMillis(a.receivedAt || a.createdAt);
      if (diff !== 0) return diff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    for (const sub of transactionSubscribers) {
      sub.onData?.({
        transactions: sorted
          .slice(0, sub.maxLimit)
          .map((tx) => normalizePaymentTransactionRecord(tx.id, tx)),
        hasMore: sorted.length > sub.maxLimit,
        maxLimit: sub.maxLimit,
      });
    }

    for (const [invoiceId, listeners] of invoiceTransactionSubscribers.entries()) {
      const matching = sorted
        .filter((tx) => tx.invoiceId === invoiceId)
        .map((tx) => normalizePaymentTransactionRecord(tx.id, tx));
      for (const cb of listeners) {
        cb(matching);
      }
    }
  }

  return {
    _sharedStore: sharedStore || {
      bookings,
      invoices,
      paymentTransactions,
      paymentEvidence,
      invoiceSubscribers,
      invoiceDocSubscribers,
      invoiceRangeSubscribers,
      transactionSubscribers,
      invoiceTransactionSubscribers,
      paymentEvidenceSubscribers,
      enqueueTransaction: enqueue,
      notifyInvoices,
      notifyTransactions,
      notifyPaymentEvidence() {
        for (const listener of paymentEvidenceSubscribers) {
          listener();
        }
      },
    },

    _inspectState() {
      return {
        invoices: new Map(invoices),
        paymentTransactions: new Map(paymentTransactions),
        paymentEvidence: new Map(paymentEvidence),
        bookings: new Map(bookings),
      };
    },

    runAtomicTransaction(transactionWork) {
      return enqueue(async () => {
        const stagedInvoices = new Map(invoices);
        const stagedTransactions = new Map(paymentTransactions);
        const stagedEvidence = new Map(paymentEvidence);
        let writeStarted = false;

        const txContext = {
          nowValue: () => ({ seconds: Math.floor(Date.now() / 1000) }),
          timestampFromDate: (date) => ({
            seconds: Math.floor((date instanceof Date ? date.getTime() : Date.now()) / 1000),
          }),
          async getInvoice(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedInvoices.get(id);
            return item ? normalizeInvoiceRecord(id, item) : null;
          },
          async getPaymentTransaction(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedTransactions.get(id);
            return item ? normalizePaymentTransactionRecord(id, item) : null;
          },
          async getBooking(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = bookings.get(id);
            return item ? normalizeBookingRecord(id, item) : null;
          },
          async getPaymentEvidence(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEvidence.get(id);
            return item ? normalizePaymentEvidenceRecord(id, item) : null;
          },
          setInvoice(id, data) {
            writeStarted = true;
            stagedInvoices.set(id, normalizeInvoiceRecord(id, data));
          },
          updateInvoice(id, data) {
            writeStarted = true;
            const prev = stagedInvoices.get(id) || {};
            stagedInvoices.set(id, normalizeInvoiceRecord(id, { ...prev, ...data }));
          },
          setPaymentTransaction(id, data) {
            writeStarted = true;
            stagedTransactions.set(id, normalizePaymentTransactionRecord(id, data));
          },
          setPaymentEvidence(id, data) {
            writeStarted = true;
            stagedEvidence.set(id, normalizePaymentEvidenceRecord(id, data));
          },
          updatePaymentEvidence(id, data) {
            writeStarted = true;
            const prev = stagedEvidence.get(id) || {};
            stagedEvidence.set(id, normalizePaymentEvidenceRecord(id, { ...prev, ...data }));
          },
        };

        const result = await transactionWork(txContext);

        invoices.clear();
        for (const [k, v] of stagedInvoices) invoices.set(k, v);
        paymentTransactions.clear();
        for (const [k, v] of stagedTransactions) paymentTransactions.set(k, v);
        paymentEvidence.clear();
        for (const [k, v] of stagedEvidence) paymentEvidence.set(k, v);

        notifyInvoices();
        notifyTransactions();
        if (sharedStore?.notifyPaymentEvidence) {
          sharedStore.notifyPaymentEvidence();
        } else {
          for (const listener of paymentEvidenceSubscribers) {
            listener();
          }
        }

        return result;
      });
    },

    async getInvoiceById(invoiceId) {
      const item = invoices.get(invoiceId);
      return item ? normalizeInvoiceRecord(invoiceId, item) : null;
    },

    async getInvoicesByIds(invoiceIds = []) {
      const uniqueIds = Array.from(new Set((invoiceIds || []).filter(Boolean)));
      return uniqueIds
        .map((id) => {
          const item = invoices.get(id);
          return item ? normalizeInvoiceRecord(id, item) : null;
        })
        .filter(Boolean);
    },

    async getPaymentTransactionById(transactionId) {
      const item = paymentTransactions.get(transactionId);
      return item ? normalizePaymentTransactionRecord(transactionId, item) : null;
    },

    subscribeInvoices({ maxLimit = INVOICES_DEFAULT_QUERY_LIMIT, onData }) {
      const sub = { maxLimit, onData };
      invoiceSubscribers.add(sub);
      notifyInvoices();
      return () => {
        invoiceSubscribers.delete(sub);
      };
    },

    subscribeInvoiceById({ invoiceId, onData }) {
      if (!invoiceId) {
        onData?.(null);
        return () => {};
      }
      if (!invoiceDocSubscribers.has(invoiceId)) {
        invoiceDocSubscribers.set(invoiceId, new Set());
      }
      const set = invoiceDocSubscribers.get(invoiceId);
      set.add(onData);
      const item = invoices.get(invoiceId);
      onData?.(item ? normalizeInvoiceRecord(invoiceId, item) : null);
      return () => {
        set.delete(onData);
      };
    },

    subscribeInvoicesInBookingDateRange({
      startDate,
      endDate,
      maxLimit = CALENDAR_INVOICE_SUMMARY_LIMIT,
      onData,
    }) {
      if (!startDate || !endDate) {
        onData?.({ invoices: [], isTruncated: false });
        return () => {};
      }
      const sub = { startDate, endDate, maxLimit, onData };
      invoiceRangeSubscribers.add(sub);
      notifyInvoices();
      return () => {
        invoiceRangeSubscribers.delete(sub);
      };
    },

    subscribePaymentTransactions({ maxLimit = TRANSACTIONS_DEFAULT_QUERY_LIMIT, onData }) {
      const sub = { maxLimit, onData };
      transactionSubscribers.add(sub);
      notifyTransactions();
      return () => {
        transactionSubscribers.delete(sub);
      };
    },

    subscribeInvoiceTransactions({ invoiceId, onData }) {
      if (!invoiceId) {
        onData?.([]);
        return () => {};
      }
      if (!invoiceTransactionSubscribers.has(invoiceId)) {
        invoiceTransactionSubscribers.set(invoiceId, new Set());
      }
      const set = invoiceTransactionSubscribers.get(invoiceId);
      set.add(onData);
      notifyTransactions();
      return () => {
        set.delete(onData);
      };
    },

    async queryInvoicesByCustomerIds({ customerIds = [], perChunkLimit = 100 } = {}) {
      const chunks = chunkArray(customerIds, FIRESTORE_IN_QUERY_CHUNK_SIZE);
      if (chunks.length === 0) return { invoices: [], isTruncated: false };

      let isTruncated = false;
      const chunkResults = chunks.map((chunk) => {
        const idSet = new Set(chunk);
        const matching = Array.from(invoices.values())
          .filter((inv) => inv.customerId && idSet.has(inv.customerId))
          .map((inv) => normalizeInvoiceRecord(inv.id, inv));
        if (matching.length > perChunkLimit) {
          isTruncated = true;
          return matching.slice(0, perChunkLimit);
        }
        return matching;
      });

      return {
        invoices: deduplicateAndSortInvoices(chunkResults),
        isTruncated,
      };
    },

    async listBookingsPage({ pageSize = LEGACY_INVOICE_SCAN_PAGE_SIZE, cursor = null } = {}) {
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

      for (let offset = 0; offset < operations.length; offset += MAX_PAYMENT_BATCH_WRITES) {
        const slice = operations.slice(offset, offset + MAX_PAYMENT_BATCH_WRITES);
        const now = { seconds: Math.floor(Date.now() / 1000) };

        for (const op of slice) {
          const payload =
            typeof op.buildData === 'function'
              ? op.buildData({
                  now,
                  timestampFromDate: (d) => ({
                    seconds: Math.floor((d instanceof Date ? d.getTime() : Date.now()) / 1000),
                  }),
                })
              : op.data;

          if (op.collection === FIRESTORE_COLLECTIONS.INVOICES) {
            const prev = op.type === 'update' ? invoices.get(op.id) || {} : {};
            invoices.set(op.id, normalizeInvoiceRecord(op.id, { ...prev, ...payload }));
          } else if (op.collection === FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS) {
            paymentTransactions.set(op.id, normalizePaymentTransactionRecord(op.id, payload));
          }
        }
      }

      notifyInvoices();
      notifyTransactions();
    },
  };
}

let activePaymentAdapter = createFirestorePaymentRepositoryAdapter();

export function getPaymentRepositoryAdapter() {
  return activePaymentAdapter;
}

export function setPaymentRepositoryAdapter(customAdapter) {
  activePaymentAdapter = customAdapter || createFirestorePaymentRepositoryAdapter();
}

export function resetPaymentRepositoryAdapter() {
  activePaymentAdapter = createFirestorePaymentRepositoryAdapter();
}
