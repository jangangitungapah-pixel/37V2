/**
 * Payment Evidence Repository Adapter (Cloud Firestore + Shared In-Memory Test Adapter)
 * for 37 Music Studio (Payment Evidence & Verification v1).
 *
 * Query & Security Guarantees:
 * - Zero custom composite indexes required (uses equality / single-field indexes + client-side sort).
 * - Client evidence history queries bind `customerId` / `clientUid` plus invoice IDs
 *   from the Client-visible invoice subscription; invoice IDs are chunked into bounded IN queries.
 * - Invoice-detail evidence queries bind both `customerId` and one concrete `invoiceId`
 *   so Firestore Security Rules can statically prove parent ownership.
 * - Admin queries are bounded (`limit(maxLimit + 1)`) and Staff/Owner gated by Firestore Rules.
 * - Shared transactional adapter coordinates `invoices`, `paymentTransactions`, and `paymentEvidence`
 *   in a single atomic Firestore transaction without nested transactions.
 */

import {
  buildFirestoreBookingRequestTxHelpers,
  createInMemoryBookingRequestStage,
  FIRESTORE_COLLECTIONS,
  normalizeBookingEventRecord,
  normalizeBookingRecord,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';

import {
  PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT,
  PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT,
  PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
} from '../config/payment-evidence-config';
import {
  normalizePaymentEvidenceRecord,
  projectClientPaymentEvidenceRecord,
} from '../schemas/payment-evidence-schema';
import { sortPaymentEvidenceRecords } from '../utils/payment-evidence-utils';

function createRepositoryError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const CLIENT_EVIDENCE_IN_QUERY_CHUNK_SIZE = 10;

function chunkInvoiceIds(values = [], size = CLIENT_EVIDENCE_IN_QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function createFirestorePaymentEvidenceRepositoryAdapter() {
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
          async getPaymentEvidence(evidenceId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE, evidenceId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizePaymentEvidenceRecord(snap.id, snap.data()) : null;
          },
          async getClientReservation(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CLIENT_RESERVATIONS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          },
          async getBooking(bookingId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeBookingRecord(snap.id, snap.data()) : null;
          },
          async getPaymentEvidenceLock(invoiceId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE_LOCKS, invoiceId);
            const snap = await tx.get(ref);
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          },
          updateBooking(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId);
            tx.update(ref, data);
          },
          setBookingEvent(eventId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.BOOKING_EVENTS, eventId);
            tx.set(ref, data);
          },
          setPaymentEvidenceLock(invoiceId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE_LOCKS, invoiceId);
            tx.set(ref, data);
          },
          updateClientReservation(bookingId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.CLIENT_RESERVATIONS, bookingId);
            tx.update(ref, data);
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
          ...buildFirestoreBookingRequestTxHelpers({ tx, db, doc }),
        };

        return transactionWork(txContext);
      });
    },

    async getPaymentEvidenceById(evidenceId) {
      const cleanId = String(evidenceId || '').trim();
      if (!cleanId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE, cleanId));
      return snap.exists() ? normalizePaymentEvidenceRecord(snap.id, snap.data()) : null;
    },

    /**
     * Client-scoped subscription to payment evidence for ONE specific invoice.
     * Binds both `customerId` and `invoiceId` (single-field zigzag merge; zero composite index).
     */
    subscribeClientInvoiceEvidence({
      customerId,
      clientUid,
      invoiceId,
      maxLimit = PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanClientUid = String(clientUid || '').trim();
      const cleanInvoiceId = String(invoiceId || '').trim();
      if ((!cleanCustomerId && !cleanClientUid) || !cleanInvoiceId) {
        queueMicrotask(() => onError?.(createRepositoryError(
          'permission-denied',
          'Missing client or invoice identity for payment evidence subscription.',
        )));
        return () => {};
      }

      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT);
      let unsubscribes = [];
      let isCancelled = false;
      const snapshots = new Map();
      const expectedSources = [
        ...(cleanCustomerId ? ['customer'] : []),
        ...(cleanClientUid ? ['uid'] : []),
      ];

      const emitMerged = () => {
        if (isCancelled || expectedSources.some((source) => !snapshots.has(source))) return;
        const unique = new Map();
        for (const source of expectedSources) {
          for (const docSnap of snapshots.get(source) || []) {
            const raw = docSnap.data();
            if (!raw || raw.invoiceId !== cleanInvoiceId) continue;
            if (raw.clientUid !== cleanClientUid && raw.customerId !== cleanCustomerId) continue;
            unique.set(docSnap.id, projectClientPaymentEvidenceRecord(docSnap.id, raw));
          }
        }
        const sorted = sortPaymentEvidenceRecords(Array.from(unique.values()).filter(Boolean));
        const hasMore =
          expectedSources.some((source) => (snapshots.get(source) || []).length > safeLimit) ||
          sorted.length > safeLimit;
        onData?.({
          items: sorted.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            throw createRepositoryError('unavailable', 'Realtime Firestore listener unavailable.');
          }
          const ref = collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE);
          const attach = (source, field, value) => {
            const q = query(
              ref,
              where(field, '==', value),
              where('invoiceId', '==', cleanInvoiceId),
              limit(safeLimit + 1),
            );
            const unsubscribe = onSnapshot(
              q,
              (snapshot) => {
                if (isCancelled) return;
                snapshots.set(source, snapshot.docs || []);
                emitMerged();
              },
              (error) => {
                if (!isCancelled) onError?.(error);
              },
            );
            unsubscribes.push(unsubscribe);
          };

          if (cleanCustomerId) attach('customer', 'customerId', cleanCustomerId);
          if (cleanClientUid) attach('uid', 'clientUid', cleanClientUid);
        } catch (error) {
          if (!isCancelled) onError?.(error);
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribes.forEach((unsubscribe) => unsubscribe?.());
      };
    },

    /**
     * Client-scoped subscription to evidence under the authenticated Client's visible invoices.
     * Every bounded query includes the owner identity and a finite invoiceId chunk so Rules
     * can validate each document against its owned parent invoice.
     */
    subscribeClientCustomerEvidence({
      customerId,
      clientUid,
      invoiceIds = [],
      maxLimit = PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanClientUid = String(clientUid || '').trim();
      const targetInvoiceIds = Array.from(new Set(
        (Array.isArray(invoiceIds) ? invoiceIds : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ));

      if (!cleanCustomerId && !cleanClientUid) {
        queueMicrotask(() => onError?.(createRepositoryError(
          'permission-denied',
          'Missing client identity for payment evidence subscription.',
        )));
        return () => {};
      }

      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT);
      if (targetInvoiceIds.length === 0) {
        queueMicrotask(() => onData?.({
          items: [],
          hasMore: false,
          isTruncated: false,
          maxLimit: safeLimit,
        }));
        return () => {};
      }

      const chunks = chunkInvoiceIds(targetInvoiceIds);
      const owners = [
        ...(cleanCustomerId ? [{ key: 'customer', field: 'customerId', value: cleanCustomerId }] : []),
        ...(cleanClientUid ? [{ key: 'uid', field: 'clientUid', value: cleanClientUid }] : []),
      ];
      const sources = chunks.flatMap((invoiceChunk, chunkIndex) =>
        owners.map((owner) => ({
          ...owner,
          invoiceChunk,
          key: `${owner.key}:${chunkIndex}`,
        })),
      );
      const snapshots = new Map();
      const unsubscribes = [];
      let isCancelled = false;

      const emitMerged = () => {
        if (isCancelled || sources.some((source) => !snapshots.has(source.key))) return;
        const unique = new Map();
        for (const source of sources) {
          for (const docSnap of snapshots.get(source.key) || []) {
            const raw = docSnap.data();
            if (!raw || !targetInvoiceIds.includes(raw.invoiceId)) continue;
            const ownerMatches = source.key.startsWith('uid:')
              ? raw.clientUid === cleanClientUid
              : raw.customerId === cleanCustomerId;
            if (!ownerMatches) continue;
            unique.set(docSnap.id, projectClientPaymentEvidenceRecord(docSnap.id, raw));
          }
        }

        const sorted = sortPaymentEvidenceRecords(Array.from(unique.values()).filter(Boolean));
        const hasMore =
          sources.some((source) => (snapshots.get(source.key) || []).length > safeLimit) ||
          sorted.length > safeLimit;
        onData?.({
          items: sorted.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            throw createRepositoryError('unavailable', 'Realtime Firestore listener unavailable.');
          }

          const ref = collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE);
          for (const source of sources) {
            const isSingleInvoice = source.invoiceChunk.length === 1;
            const q = query(
              ref,
              where(source.field, '==', source.value),
              where(
                'invoiceId',
                isSingleInvoice ? '==' : 'in',
                isSingleInvoice ? source.invoiceChunk[0] : source.invoiceChunk,
              ),
              limit(safeLimit + 1),
            );
            const unsubscribe = onSnapshot(
              q,
              (snapshot) => {
                if (isCancelled) return;
                snapshots.set(source.key, snapshot.docs || []);
                emitMerged();
              },
              (error) => {
                if (!isCancelled) onError?.(error);
              },
            );
            unsubscribes.push(unsubscribe);
          }
        } catch (error) {
          if (!isCancelled) onError?.(error);
        }
      })();

      return () => {
        isCancelled = true;
        unsubscribes.forEach((unsubscribe) => unsubscribe?.());
      };
    },

    /**
     * Staff/Owner bounded subscription to `paymentEvidence` ordered newest-first by `submittedAt`.
     * Uses built-in single-field index (zero custom composite index).
     */
    subscribeAdminPaymentEvidence({
      maxLimit = PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT,
      onData,
      onError,
    }) {
      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT);
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            throw createRepositoryError('unavailable', 'Realtime Firestore listener unavailable.');
          }

          const db = getFirebaseDb();
          const ref = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE);
          const q = query(ref, orderBy('submittedAt', 'desc'), limit(safeLimit + 1));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > safeLimit;
              const docs = hasMore ? snapshot.docs.slice(0, safeLimit) : snapshot.docs;
              const items = sortPaymentEvidenceRecords(
                docs.map((docSnap) => normalizePaymentEvidenceRecord(docSnap.id, docSnap.data())),
              );
              onData?.({ items, hasMore, isTruncated: hasMore, maxLimit: safeLimit });
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
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    },

    /**
     * Staff/Owner bounded subscription to all evidence linked to one `invoiceId`.
     */
    subscribeAdminInvoiceEvidence({
      invoiceId,
      maxLimit = PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
      onData,
      onError,
    }) {
      const cleanInvoiceId = String(invoiceId || '').trim();
      if (!cleanInvoiceId) {
        queueMicrotask(() => {
          onData?.({ items: [], hasMore: false, isTruncated: false, maxLimit });
        });
        return () => {};
      }

      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT);
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            throw createRepositoryError('unavailable', 'Realtime Firestore listener unavailable.');
          }

          const db = getFirebaseDb();
          const ref = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_EVIDENCE);
          const q = query(ref, where('invoiceId', '==', cleanInvoiceId), limit(safeLimit + 1));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > safeLimit;
              const docs = hasMore ? snapshot.docs.slice(0, safeLimit) : snapshot.docs;
              const items = sortPaymentEvidenceRecords(
                docs.map((docSnap) => normalizePaymentEvidenceRecord(docSnap.id, docSnap.data())),
              );
              onData?.({ items, hasMore, isTruncated: hasMore, maxLimit: safeLimit });
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
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    },
  };
}

/**
 * Shared In-Memory Payment Evidence Repository Adapter for Vitest unit & integration suites.
 * Connects directly to `_sharedStore` from `bookingAdapter` or `paymentAdapter` so Admin and
 * Client Portal stay 100% transactionally synchronized in realtime tests.
 */
export function createInMemoryPaymentEvidenceRepositoryAdapter({
  bookingAdapter = null,
  paymentAdapter = null,
  initialInvoices = [],
  initialTransactions = [],
  initialEvidence = [],
} = {}) {
  const sharedStore = bookingAdapter?._sharedStore || paymentAdapter?._sharedStore || null;
  const bookings = sharedStore?.bookings || new Map();
  const events = sharedStore?.events || new Map();
  const invoices = sharedStore?.invoices || new Map();
  const paymentTransactions = sharedStore?.paymentTransactions || new Map();
  const paymentEvidence = sharedStore?.paymentEvidence || new Map();
  const paymentEvidenceLocks = sharedStore?.paymentEvidenceLocks || new Map();
  const clientReservations = sharedStore?.clientReservations || new Map();
  const paymentEvidenceSubscribers = sharedStore?.paymentEvidenceSubscribers || new Set();

  let localQueue = Promise.resolve();
  const enqueue =
    sharedStore?.enqueueTransaction ||
    ((work) => {
      const next = localQueue.then(work);
      localQueue = next.catch(() => {});
      return next;
    });

  let simulatedReadError = null;
  let simulatedWriteError = null;

  for (const inv of initialInvoices) {
    const norm = normalizeInvoiceRecord(inv.id, inv);
    if (norm?.id) invoices.set(norm.id, norm);
  }
  for (const tx of initialTransactions) {
    const norm = normalizePaymentTransactionRecord(tx.id, tx);
    if (norm?.id) paymentTransactions.set(norm.id, norm);
  }
  for (const ev of initialEvidence) {
    const norm = normalizePaymentEvidenceRecord(ev.id, ev);
    if (norm?.id) paymentEvidence.set(norm.id, norm);
  }

  function notifyAllEvidence() {
    if (sharedStore?.notifyPaymentEvidence) {
      sharedStore.notifyPaymentEvidence();
      return;
    }
    for (const listener of paymentEvidenceSubscribers) {
      listener();
    }
  }

  return {
    _inspectState() {
      return {
        invoices: new Map(invoices),
        paymentTransactions: new Map(paymentTransactions),
        paymentEvidence: new Map(paymentEvidence),
      };
    },

    _setSimulatedReadError(error) {
      simulatedReadError = error || null;
    },

    _setSimulatedWriteError(error) {
      simulatedWriteError = error || null;
    },

    _seedEvidence(rawEvidence) {
      const norm = normalizePaymentEvidenceRecord(rawEvidence.id, rawEvidence);
      if (norm?.id) {
        paymentEvidence.set(norm.id, norm);
        notifyAllEvidence();
      }
      return norm;
    },

    runAtomicTransaction(transactionWork) {
      return enqueue(async () => {
        if (simulatedWriteError) {
          throw simulatedWriteError;
        }

        const stagedBookings = new Map(bookings);
        const stagedEvents = new Map(events);
        const stagedInvoices = new Map(invoices);
        const stagedTransactions = new Map(paymentTransactions);
        const stagedEvidence = new Map(paymentEvidence);
        const stagedEvidenceLocks = new Map(paymentEvidenceLocks);
        const stagedClientReservations = new Map(clientReservations);
        const touchedBookingIds = new Set();
        let writeStarted = false;
        const requestStage = createInMemoryBookingRequestStage({
          sharedStore,
          checkCanRead: () => {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
          },
          markWrite: () => {
            writeStarted = true;
          },
        });

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
          async getPaymentEvidence(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEvidence.get(id);
            return item ? normalizePaymentEvidenceRecord(id, item) : null;
          },
          async getPaymentEvidenceLock(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedEvidenceLocks.get(id);
            return item ? { ...item } : null;
          },
          async getBooking(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedBookings.get(id);
            return item ? normalizeBookingRecord(id, item) : null;
          },
          async getClientReservation(id) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const item = stagedClientReservations.get(id);
            return item ? { id, ...item } : null;
          },
          updateBooking(id, data) {
            writeStarted = true;
            touchedBookingIds.add(id);
            const prev = stagedBookings.get(id) || {};
            stagedBookings.set(id, normalizeBookingRecord(id, { ...prev, ...data }));
          },
          setBookingEvent(id, data) {
            writeStarted = true;
            touchedBookingIds.add(data.bookingId);
            stagedEvents.set(id, normalizeBookingEventRecord(id, data));
          },
          setPaymentEvidenceLock(id, data) {
            writeStarted = true;
            stagedEvidenceLocks.set(id, { id, ...data });
          },
          updateClientReservation(id, data) {
            writeStarted = true;
            const prev = stagedClientReservations.get(id) || {};
            stagedClientReservations.set(id, { ...prev, ...data, id });
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
            if (stagedEvidence.has(id)) {
              throw createRepositoryError(
                'already-exists',
                'Payment evidence document already exists.',
              );
            }
            stagedEvidence.set(id, normalizePaymentEvidenceRecord(id, data));
          },
          updatePaymentEvidence(id, data) {
            writeStarted = true;
            const prev = stagedEvidence.get(id) || {};
            stagedEvidence.set(id, normalizePaymentEvidenceRecord(id, { ...prev, ...data }));
          },
          ...requestStage.helpers,
        };

        const result = await transactionWork(txContext);

        bookings.clear();
        for (const [k, v] of stagedBookings) bookings.set(k, v);
        events.clear();
        for (const [k, v] of stagedEvents) events.set(k, v);
        invoices.clear();
        for (const [k, v] of stagedInvoices) invoices.set(k, v);
        paymentTransactions.clear();
        for (const [k, v] of stagedTransactions) paymentTransactions.set(k, v);
        paymentEvidence.clear();
        for (const [k, v] of stagedEvidence) paymentEvidence.set(k, v);
        paymentEvidenceLocks.clear();
        for (const [k, v] of stagedEvidenceLocks) paymentEvidenceLocks.set(k, v);
        clientReservations.clear();
        for (const [k, v] of stagedClientReservations) clientReservations.set(k, v);
        requestStage.commitAndNotify();

        sharedStore?.notifyInvoices?.();
        sharedStore?.notifyClientReservations?.();
        if (touchedBookingIds.size > 0) {
          sharedStore?.notifyBookings?.();
          for (const bId of touchedBookingIds) {
            sharedStore?.notifyEvents?.(bId);
          }
        }
        sharedStore?.notifyTransactions?.();
        notifyAllEvidence();

        return result;
      });
    },

    async getPaymentEvidenceById(evidenceId) {
      const item = paymentEvidence.get(String(evidenceId || '').trim());
      return item ? normalizePaymentEvidenceRecord(item.id, item) : null;
    },

    subscribeClientInvoiceEvidence({
      customerId,
      invoiceId,
      maxLimit = PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanInvoiceId = String(invoiceId || '').trim();
      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT);

      if (!cleanCustomerId || !cleanInvoiceId) {
        queueMicrotask(() => {
          onError?.(createRepositoryError('permission-denied', 'Missing customer or invoice ID.'));
        });
        return () => {};
      }

      let active = true;
      const push = () => {
        if (!active) return;
        if (simulatedReadError) {
          onError?.(simulatedReadError);
          return;
        }
        const matching = sortPaymentEvidenceRecords(
          Array.from(paymentEvidence.values())
            .filter(
              (ev) => ev && ev.customerId === cleanCustomerId && ev.invoiceId === cleanInvoiceId,
            )
            .map((ev) => projectClientPaymentEvidenceRecord(ev.id, ev))
            .filter(Boolean),
        );
        const hasMore = matching.length > safeLimit;
        onData?.({
          items: matching.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      paymentEvidenceSubscribers.add(push);
      queueMicrotask(push);

      return () => {
        active = false;
        paymentEvidenceSubscribers.delete(push);
      };
    },

    subscribeClientCustomerEvidence({
      customerId,
      clientUid,
      invoiceIds = [],
      maxLimit = PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanClientUid = String(clientUid || '').trim();
      const targetInvoiceIds = new Set(
        (Array.isArray(invoiceIds) ? invoiceIds : [])
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      );
      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT);

      if (!cleanCustomerId && !cleanClientUid) {
        queueMicrotask(() => {
          onError?.(createRepositoryError('permission-denied', 'Missing client identity.'));
        });
        return () => {};
      }
      if (targetInvoiceIds.size === 0) {
        queueMicrotask(() => onData?.({
          items: [],
          hasMore: false,
          isTruncated: false,
          maxLimit: safeLimit,
        }));
        return () => {};
      }

      let active = true;
      const push = () => {
        if (!active) return;
        if (simulatedReadError) {
          onError?.(simulatedReadError);
          return;
        }
        const matching = sortPaymentEvidenceRecords(
          Array.from(paymentEvidence.values())
            .filter((ev) => ev
              && targetInvoiceIds.has(ev.invoiceId)
              && (
                (cleanCustomerId && ev.customerId === cleanCustomerId)
                || (cleanClientUid && ev.clientUid === cleanClientUid)
              ))
            .map((ev) => projectClientPaymentEvidenceRecord(ev.id, ev))
            .filter(Boolean),
        );
        const hasMore = matching.length > safeLimit;
        onData?.({
          items: matching.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      paymentEvidenceSubscribers.add(push);
      queueMicrotask(push);

      return () => {
        active = false;
        paymentEvidenceSubscribers.delete(push);
      };
    },

    subscribeAdminPaymentEvidence({
      maxLimit = PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT,
      onData,
      onError,
    }) {
      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT);
      let active = true;
      const push = () => {
        if (!active) return;
        if (simulatedReadError) {
          onError?.(simulatedReadError);
          return;
        }
        const sorted = sortPaymentEvidenceRecords(
          Array.from(paymentEvidence.values()).map((ev) =>
            normalizePaymentEvidenceRecord(ev.id, ev),
          ),
        );
        const hasMore = sorted.length > safeLimit;
        onData?.({
          items: sorted.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      paymentEvidenceSubscribers.add(push);
      queueMicrotask(push);

      return () => {
        active = false;
        paymentEvidenceSubscribers.delete(push);
      };
    },

    subscribeAdminInvoiceEvidence({
      invoiceId,
      maxLimit = PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT,
      onData,
      onError,
    }) {
      const cleanInvoiceId = String(invoiceId || '').trim();
      const safeLimit = Math.max(1, Number(maxLimit) || PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT);
      if (!cleanInvoiceId) {
        queueMicrotask(() => {
          onData?.({ items: [], hasMore: false, isTruncated: false, maxLimit: safeLimit });
        });
        return () => {};
      }

      let active = true;
      const push = () => {
        if (!active) return;
        if (simulatedReadError) {
          onError?.(simulatedReadError);
          return;
        }
        const sorted = sortPaymentEvidenceRecords(
          Array.from(paymentEvidence.values())
            .filter((ev) => ev && ev.invoiceId === cleanInvoiceId)
            .map((ev) => normalizePaymentEvidenceRecord(ev.id, ev)),
        );
        const hasMore = sorted.length > safeLimit;
        onData?.({
          items: sorted.slice(0, safeLimit),
          hasMore,
          isTruncated: hasMore,
          maxLimit: safeLimit,
        });
      };

      paymentEvidenceSubscribers.add(push);
      queueMicrotask(push);

      return () => {
        active = false;
        paymentEvidenceSubscribers.delete(push);
      };
    },
  };
}

let activePaymentEvidenceAdapter = null;

export function getPaymentEvidenceRepositoryAdapter() {
  if (!activePaymentEvidenceAdapter) {
    activePaymentEvidenceAdapter = createFirestorePaymentEvidenceRepositoryAdapter();
  }
  return activePaymentEvidenceAdapter;
}

export function setPaymentEvidenceRepositoryAdapter(adapter) {
  activePaymentEvidenceAdapter = adapter;
}

export function resetPaymentEvidenceRepositoryAdapter() {
  activePaymentEvidenceAdapter = null;
}
