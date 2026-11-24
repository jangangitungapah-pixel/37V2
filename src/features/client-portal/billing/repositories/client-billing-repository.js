/**
 * Client-Scoped Firestore & In-Memory Billing Repository
 * for 37 Music Studio (Client Portal Phase 4 — Billing & Payments).
 *
 * Security & Query Guarantees:
 * - Never executes global/unscoped `invoices` or `paymentTransactions` reads.
 * - Every query requires an authenticated `customerId` derived from `AuthContext`.
 * - Invoice queries restrict `invoiceStatus in ['issued', 'void']` (never `draft`)
 *   and use single-field equality/IN filters with client-side sorting (zero custom composite indexes).
 * - Payment transaction queries bind both `customerId` and `invoiceId` so Firestore
 *   Security Rules can statically prove ownership and parent-invoice visibility.
 */

import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import {
  normalizeInvoiceRecord,
  normalizePaymentTransactionRecord,
} from '@/features/admin/payment/schemas/payment-schema';
import { INVOICE_STATUS } from '@/features/admin/payment/utils/invoice-status';

import {
  isCustomerVisibleInvoiceStatus,
  projectClientInvoiceRecord,
  projectClientPaymentTransactions,
  sortClientInvoices,
} from '../utils/client-billing-utils';

export const CLIENT_INVOICES_INITIAL_LIMIT = 100;
export const CLIENT_INVOICES_PAGE_STEP = 100;
export const CLIENT_TRANSACTIONS_INITIAL_LIMIT = 200;
export const CLIENT_TRANSACTIONS_PAGE_STEP = 200;

const CUSTOMER_VISIBLE_INVOICE_STATUSES = [INVOICE_STATUS.ISSUED, INVOICE_STATUS.VOID];
const IN_QUERY_CHUNK_SIZE = 10;

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function chunkValues(items = [], size = IN_QUERY_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function createFirestoreClientBillingRepositoryAdapter() {
  return {
    /**
     * Subscribes in realtime to customer-visible (`issued` | `void`) invoices
     * strictly owned by `customerId`. Uses `limit(maxLimit + 1)` to detect truncation.
     */
    subscribeClientInvoices({
      customerId,
      maxLimit = CLIENT_INVOICES_INITIAL_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      if (!cleanCustomerId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer identity for client invoice subscription.',
            ),
          );
        });
        return () => {};
      }

      const safeLimit = Math.max(1, Number(maxLimit) || CLIENT_INVOICES_INITIAL_LIMIT);
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
          const invoicesRef = collection(db, FIRESTORE_COLLECTIONS.INVOICES);
          const clientInvoicesQuery = query(
            invoicesRef,
            where('customerId', '==', cleanCustomerId),
            where('invoiceStatus', 'in', CUSTOMER_VISIBLE_INVOICE_STATUSES),
            limit(safeLimit + 1),
          );

          unsubscribe = onSnapshot(
            clientInvoicesQuery,
            (snapshot) => {
              if (isCancelled) return;
              const projected = snapshot.docs
                .map((docSnap) => {
                  const data = docSnap.data();
                  if (!data || data.customerId !== cleanCustomerId) return null;
                  return projectClientInvoiceRecord(docSnap.id, data);
                })
                .filter(Boolean);

              const sorted = sortClientInvoices(projected);
              const hasMore = snapshot.docs.length > safeLimit || sorted.length > safeLimit;

              onData?.({
                invoices: sorted.slice(0, safeLimit),
                hasMore,
                isTruncated: hasMore,
                maxLimit: safeLimit,
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
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    },

    /**
     * Subscribes in realtime to a single customer-owned invoice document (`issued` | `void`).
     */
    subscribeClientInvoiceById({ customerId, invoiceId, onData, onError }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanInvoiceId = String(invoiceId || '').trim();

      if (!cleanCustomerId || !cleanInvoiceId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer or invoice identity for invoice detail subscription.',
            ),
          );
        });
        return () => {};
      }

      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            throw createRepositoryError('unavailable', 'Realtime Firestore listener unavailable.');
          }

          const db = getFirebaseDb();
          const invoiceRef = doc(db, FIRESTORE_COLLECTIONS.INVOICES, cleanInvoiceId);

          unsubscribe = onSnapshot(
            invoiceRef,
            (snap) => {
              if (isCancelled) return;
              if (!snap.exists()) {
                onData?.(null);
                return;
              }
              const raw = snap.data();
              if (!raw || raw.customerId !== cleanCustomerId) {
                onError?.(
                  createRepositoryError('permission-denied', 'Invoice ownership mismatch.'),
                );
                return;
              }
              const projected = projectClientInvoiceRecord(snap.id, raw);
              onData?.(projected);
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
     * Subscribes in realtime to payment transactions belonging to `customerId` and
     * scoped to a concrete `invoiceId` (or bounded list of `invoiceIds`).
     * Never issues an unscoped collection-wide transaction query.
     */
    subscribeClientPaymentTransactions({
      customerId,
      invoiceId = '',
      invoiceIds = [],
      maxLimit = CLIENT_TRANSACTIONS_INITIAL_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanSingleInvoiceId = String(invoiceId || '').trim();
      const targetIds = cleanSingleInvoiceId
        ? [cleanSingleInvoiceId]
        : Array.from(
            new Set(
              (Array.isArray(invoiceIds) ? invoiceIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean),
            ),
          );

      if (!cleanCustomerId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer identity for payment transaction subscription.',
            ),
          );
        });
        return () => {};
      }

      if (targetIds.length === 0) {
        queueMicrotask(() => {
          onData?.({
            transactions: [],
            reversedTransactionIds: new Set(),
            hasMore: false,
            isTruncated: false,
            maxLimit: Math.max(1, Number(maxLimit) || CLIENT_TRANSACTIONS_INITIAL_LIMIT),
          });
        });
        return () => {};
      }

      const safeLimit = Math.max(1, Number(maxLimit) || CLIENT_TRANSACTIONS_INITIAL_LIMIT);
      const chunks =
        targetIds.length === 1 ? [targetIds] : chunkValues(targetIds, IN_QUERY_CHUNK_SIZE);

      let unsubscribes = [];
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
          const txCollectionRef = collection(db, FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTIONS);
          const chunkRecords = new Map();
          const chunkTruncated = new Set();
          const readyChunks = new Set();

          const emitMerged = () => {
            if (isCancelled || readyChunks.size < chunks.length) return;
            const combinedRaw = [];
            for (const list of chunkRecords.values()) {
              for (const item of list) {
                combinedRaw.push(item);
              }
            }
            const { transactions, reversedTransactionIds } =
              projectClientPaymentTransactions(combinedRaw);
            const hasMore = chunkTruncated.size > 0 || transactions.length > safeLimit;

            onData?.({
              transactions: transactions.slice(0, safeLimit),
              reversedTransactionIds,
              hasMore,
              isTruncated: hasMore,
              maxLimit: safeLimit,
            });
          };

          unsubscribes = chunks.map((chunk, chunkIndex) => {
            const txQuery =
              chunk.length === 1
                ? query(
                    txCollectionRef,
                    where('customerId', '==', cleanCustomerId),
                    where('invoiceId', '==', chunk[0]),
                    limit(safeLimit + 1),
                  )
                : query(
                    txCollectionRef,
                    where('customerId', '==', cleanCustomerId),
                    where('invoiceId', 'in', chunk),
                    limit(safeLimit + 1),
                  );

            return onSnapshot(
              txQuery,
              (snapshot) => {
                if (isCancelled) return;
                const docs = snapshot.docs
                  .map((docSnap) => {
                    const data = docSnap.data();
                    if (!data || data.customerId !== cleanCustomerId) return null;
                    return { id: docSnap.id, ...data };
                  })
                  .filter(Boolean);

                chunkRecords.set(chunkIndex, docs);
                if (snapshot.docs.length > safeLimit) {
                  chunkTruncated.add(chunkIndex);
                } else {
                  chunkTruncated.delete(chunkIndex);
                }
                readyChunks.add(chunkIndex);
                emitMerged();
              },
              (err) => {
                if (!isCancelled) onError?.(err);
              },
            );
          });
        } catch (err) {
          if (!isCancelled) onError?.(err);
        }
      })();

      return () => {
        isCancelled = true;
        for (const unsub of unsubscribes) {
          if (typeof unsub === 'function') unsub();
        }
      };
    },
  };
}

/**
 * In-memory Client Billing Repository Adapter for deterministic Vitest suites.
 * Can share `_sharedStore` with `createInMemoryCalendarBookingRepositoryAdapter` /
 * `createInMemoryPaymentRepositoryAdapter` so Admin payment & reversal mutations
 * stream live into Client Portal tests without browser reload.
 */
export function createInMemoryClientBillingRepositoryAdapter({
  bookingAdapter = null,
  initialInvoices = [],
  initialPaymentTransactions = [],
} = {}) {
  const sharedStore = bookingAdapter?._sharedStore || null;
  const invoices = sharedStore?.invoices || new Map();
  const paymentTransactions = sharedStore?.paymentTransactions || new Map();

  const localInvoiceListeners = new Set();
  const localTransactionListeners = new Set();
  let simulatedError = null;

  for (const seedInv of initialInvoices) {
    const normalized = normalizeInvoiceRecord(seedInv.id, seedInv);
    if (normalized?.id) {
      invoices.set(normalized.id, normalized);
    }
  }

  for (const seedTx of initialPaymentTransactions) {
    const normalized = normalizePaymentTransactionRecord(seedTx.id, seedTx);
    if (normalized?.id) {
      paymentTransactions.set(normalized.id, normalized);
    }
  }

  function emitLocalInvoices() {
    for (const listener of localInvoiceListeners) {
      listener();
    }
  }

  function emitLocalTransactions() {
    for (const listener of localTransactionListeners) {
      listener();
    }
  }

  function computeOwnedVisibleInvoices(cleanCustomerId, safeLimit) {
    const projected = Array.from(invoices.values())
      .filter(
        (inv) => inv && inv.customerId === cleanCustomerId && isCustomerVisibleInvoiceStatus(inv.invoiceStatus),
      )
      .map((inv) => projectClientInvoiceRecord(inv.id, inv))
      .filter(Boolean);

    const sorted = sortClientInvoices(projected);
    const hasMore = sorted.length > safeLimit;

    return {
      invoices: sorted.slice(0, safeLimit),
      hasMore,
      isTruncated: hasMore,
      maxLimit: safeLimit,
    };
  }

  function isParentInvoiceReadableByClient(invoiceId, cleanCustomerId) {
    const parent = invoices.get(invoiceId);
    return Boolean(
      parent &&
        parent.customerId === cleanCustomerId &&
        isCustomerVisibleInvoiceStatus(parent.invoiceStatus),
    );
  }

  function computeOwnedTransactions(cleanCustomerId, targetIdSet, safeLimit) {
    const matchingRaw = Array.from(paymentTransactions.values()).filter(
      (tx) =>
        tx &&
        tx.customerId === cleanCustomerId &&
        targetIdSet.has(tx.invoiceId) &&
        isParentInvoiceReadableByClient(tx.invoiceId, cleanCustomerId),
    );

    const { transactions, reversedTransactionIds } = projectClientPaymentTransactions(matchingRaw);
    const hasMore = transactions.length > safeLimit;

    return {
      transactions: transactions.slice(0, safeLimit),
      reversedTransactionIds,
      hasMore,
      isTruncated: hasMore,
      maxLimit: safeLimit,
    };
  }

  return {
    _inspectState() {
      return {
        invoices: new Map(invoices),
        paymentTransactions: new Map(paymentTransactions),
      };
    },

    _setSimulatedError(error) {
      simulatedError = error || null;
    },

    _seedInvoice(rawInvoice) {
      const normalized = normalizeInvoiceRecord(rawInvoice.id, rawInvoice);
      if (normalized?.id) {
        invoices.set(normalized.id, normalized);
        if (sharedStore?.notifyInvoices) {
          sharedStore.notifyInvoices();
        }
        emitLocalInvoices();
      }
      return normalized;
    },

    _seedTransaction(rawTransaction) {
      const normalized = normalizePaymentTransactionRecord(rawTransaction.id, rawTransaction);
      if (normalized?.id) {
        paymentTransactions.set(normalized.id, normalized);
        if (sharedStore?.notifyTransactions) {
          sharedStore.notifyTransactions();
        }
        emitLocalTransactions();
      }
      return normalized;
    },

    subscribeClientInvoices({
      customerId,
      maxLimit = CLIENT_INVOICES_INITIAL_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const safeLimit = Math.max(1, Number(maxLimit) || CLIENT_INVOICES_INITIAL_LIMIT);

      if (!cleanCustomerId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer identity for client invoice subscription.',
            ),
          );
        });
        return () => {};
      }

      let active = true;

      const pushSnapshot = () => {
        if (!active) return;
        if (simulatedError) {
          onError?.(simulatedError);
          return;
        }
        onData?.(computeOwnedVisibleInvoices(cleanCustomerId, safeLimit));
      };

      localInvoiceListeners.add(pushSnapshot);

      let sharedSub = null;
      if (sharedStore?.invoiceSubscribers) {
        sharedSub = {
          maxLimit: Number.MAX_SAFE_INTEGER,
          onData: () => pushSnapshot(),
        };
        sharedStore.invoiceSubscribers.add(sharedSub);
      }

      queueMicrotask(pushSnapshot);

      return () => {
        active = false;
        localInvoiceListeners.delete(pushSnapshot);
        if (sharedSub && sharedStore?.invoiceSubscribers) {
          sharedStore.invoiceSubscribers.delete(sharedSub);
        }
      };
    },

    subscribeClientInvoiceById({ customerId, invoiceId, onData, onError }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanInvoiceId = String(invoiceId || '').trim();

      if (!cleanCustomerId || !cleanInvoiceId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer or invoice identity for invoice detail subscription.',
            ),
          );
        });
        return () => {};
      }

      let active = true;

      const pushDoc = () => {
        if (!active) return;
        if (simulatedError) {
          onError?.(simulatedError);
          return;
        }
        const raw = invoices.get(cleanInvoiceId);
        if (!raw) {
          onError?.(createRepositoryError('permission-denied', 'Invoice not accessible.'));
          return;
        }
        if (raw.customerId !== cleanCustomerId || !isCustomerVisibleInvoiceStatus(raw.invoiceStatus)) {
          onError?.(createRepositoryError('permission-denied', 'Invoice not accessible.'));
          return;
        }
        onData?.(projectClientInvoiceRecord(raw.id, raw));
      };

      localInvoiceListeners.add(pushDoc);

      let sharedDocCb = null;
      if (sharedStore?.invoiceDocSubscribers) {
        if (!sharedStore.invoiceDocSubscribers.has(cleanInvoiceId)) {
          sharedStore.invoiceDocSubscribers.set(cleanInvoiceId, new Set());
        }
        sharedDocCb = () => pushDoc();
        sharedStore.invoiceDocSubscribers.get(cleanInvoiceId).add(sharedDocCb);
      }

      queueMicrotask(pushDoc);

      return () => {
        active = false;
        localInvoiceListeners.delete(pushDoc);
        if (sharedDocCb && sharedStore?.invoiceDocSubscribers) {
          sharedStore.invoiceDocSubscribers.get(cleanInvoiceId)?.delete(sharedDocCb);
        }
      };
    },

    subscribeClientPaymentTransactions({
      customerId,
      invoiceId = '',
      invoiceIds = [],
      maxLimit = CLIENT_TRANSACTIONS_INITIAL_LIMIT,
      onData,
      onError,
    }) {
      const cleanCustomerId = String(customerId || '').trim();
      const cleanSingleInvoiceId = String(invoiceId || '').trim();
      const targetIds = cleanSingleInvoiceId
        ? [cleanSingleInvoiceId]
        : (Array.isArray(invoiceIds) ? invoiceIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
      const safeLimit = Math.max(1, Number(maxLimit) || CLIENT_TRANSACTIONS_INITIAL_LIMIT);

      if (!cleanCustomerId) {
        queueMicrotask(() => {
          onError?.(
            createRepositoryError(
              'permission-denied',
              'Missing customer identity for payment transaction subscription.',
            ),
          );
        });
        return () => {};
      }

      if (targetIds.length === 0) {
        queueMicrotask(() => {
          onData?.({
            transactions: [],
            reversedTransactionIds: new Set(),
            hasMore: false,
            isTruncated: false,
            maxLimit: safeLimit,
          });
        });
        return () => {};
      }

      const targetIdSet = new Set(targetIds);
      let active = true;

      const pushTx = () => {
        if (!active) return;
        if (simulatedError) {
          onError?.(simulatedError);
          return;
        }
        for (const id of targetIdSet) {
          const parent = invoices.get(id);
          if (
            !parent ||
            parent.customerId !== cleanCustomerId ||
            !isCustomerVisibleInvoiceStatus(parent.invoiceStatus)
          ) {
            onError?.(
              createRepositoryError(
                'permission-denied',
                'Parent invoice is not accessible for transaction query.',
              ),
            );
            return;
          }
        }
        onData?.(computeOwnedTransactions(cleanCustomerId, targetIdSet, safeLimit));
      };

      localTransactionListeners.add(pushTx);
      localInvoiceListeners.add(pushTx);

      let sharedTxSub = null;
      let sharedInvSub = null;
      if (sharedStore?.transactionSubscribers) {
        sharedTxSub = {
          maxLimit: Number.MAX_SAFE_INTEGER,
          onData: () => pushTx(),
        };
        sharedStore.transactionSubscribers.add(sharedTxSub);
      }
      if (sharedStore?.invoiceSubscribers) {
        sharedInvSub = {
          maxLimit: Number.MAX_SAFE_INTEGER,
          onData: () => pushTx(),
        };
        sharedStore.invoiceSubscribers.add(sharedInvSub);
      }

      queueMicrotask(pushTx);

      return () => {
        active = false;
        localTransactionListeners.delete(pushTx);
        localInvoiceListeners.delete(pushTx);
        if (sharedTxSub && sharedStore?.transactionSubscribers) {
          sharedStore.transactionSubscribers.delete(sharedTxSub);
        }
        if (sharedInvSub && sharedStore?.invoiceSubscribers) {
          sharedStore.invoiceSubscribers.delete(sharedInvSub);
        }
      };
    },
  };
}

let activeClientBillingAdapter = null;

export function getClientBillingRepositoryAdapter() {
  if (!activeClientBillingAdapter) {
    activeClientBillingAdapter = createFirestoreClientBillingRepositoryAdapter();
  }
  return activeClientBillingAdapter;
}

export function setClientBillingRepositoryAdapter(adapter) {
  activeClientBillingAdapter = adapter;
}

export function resetClientBillingRepositoryAdapter() {
  activeClientBillingAdapter = null;
}
