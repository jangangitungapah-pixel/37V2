/**
 * Inventory Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter)
 * for 37 Music Studio Operational Inventory Module.
 *
 * Uses strictly single-field Firestore queries and `getCountFromServer()` aggregations
 * so zero custom composite indexes are required in production Cloud Firestore.
 */

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  INVENTORY_ITEM_HISTORY_PAGE_SIZE,
  INVENTORY_ITEMS_PAGE_SIZE,
  INVENTORY_ITEMS_SUMMARY_BOUND,
  INVENTORY_MOVEMENTS_PAGE_SIZE,
} from '../config/inventory-config';
import {
  normalizeInventoryItemRecord,
  normalizeInventoryMovementRecord,
} from '../schemas/inventory-schema';

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortItemsByUpdatedDesc(items = []) {
  return [...items].sort((a, b) => {
    const diff = getTimestampMillis(b.updatedAt) - getTimestampMillis(a.updatedAt);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

function sortMovementsDesc(movements = []) {
  return [...movements].sort((a, b) => {
    const diff =
      getTimestampMillis(b.occurredAt || b.createdAt) -
      getTimestampMillis(a.occurredAt || a.createdAt);
    if (diff !== 0) return diff;
    const createdDiff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

/**
 * Default Cloud Firestore Inventory Repository Adapter using shared `getFirebaseDb()`.
 */
export function createFirestoreInventoryRepositoryAdapter() {
  return {
    async runAtomicTransaction(transactionWork) {
      const [{ doc, runTransaction, serverTimestamp, Timestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          timestampFromDate: (date) => Timestamp.fromDate(date instanceof Date ? date : new Date()),
          async getItem(itemId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS, itemId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeInventoryItemRecord(snap.id, snap.data()) : null;
          },
          async getMovement(movementId) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVENTORY_MOVEMENTS, movementId);
            const snap = await tx.get(ref);
            return snap.exists() ? normalizeInventoryMovementRecord(snap.id, snap.data()) : null;
          },
          setItem(itemId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS, itemId);
            tx.set(ref, data);
          },
          updateItem(itemId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS, itemId);
            tx.update(ref, data);
          },
          setMovement(movementId, data) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.INVENTORY_MOVEMENTS, movementId);
            tx.set(ref, data);
          },
        };

        return transactionWork(txContext);
      });
    },

    async getItemById(itemId) {
      if (!itemId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS, itemId));
      return snap.exists() ? normalizeInventoryItemRecord(snap.id, snap.data()) : null;
    },

    async getItemByCode(normalizedCode) {
      const clean = String(normalizedCode || '')
        .trim()
        .toLowerCase();
      if (!clean) return null;
      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS),
        where('normalizedCode', '==', clean),
        limit(5),
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnap = snapshot.docs[0];
      return normalizeInventoryItemRecord(docSnap.id, docSnap.data());
    },

    subscribeInventoryItems({ maxLimit = INVENTORY_ITEMS_PAGE_SIZE, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS),
            orderBy('updatedAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const items = docs.map((docSnap) =>
                normalizeInventoryItemRecord(docSnap.id, docSnap.data()),
              );
              onData?.({ items, hasMore, maxLimit });
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

    async listArchivedInventoryItems({ maxLimit = INVENTORY_ITEMS_PAGE_SIZE } = {}) {
      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS),
        where('isActive', '==', false),
        limit(maxLimit + 1),
      );
      const snapshot = await getDocs(q);
      const hasMore = snapshot.docs.length > maxLimit;
      const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
      const items = sortItemsByUpdatedDesc(
        docs.map((docSnap) => normalizeInventoryItemRecord(docSnap.id, docSnap.data())),
      );
      return { items, hasMore };
    },

    async fetchInventorySummary({ todayIso = getJakartaTodayIso() } = {}) {
      const [{ collection, getCountFromServer, getDocs, limit, query, where }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const itemsRef = collection(db, FIRESTORE_COLLECTIONS.INVENTORY_ITEMS);

      const [
        activeCountSnap,
        archivedCountSnap,
        lowStockCountSnap,
        damagedRetiredCountSnap,
        inMaintDocsSnap,
        dueMaintDocsSnap,
      ] = await Promise.all([
        getCountFromServer(query(itemsRef, where('isActive', '==', true))),
        getCountFromServer(query(itemsRef, where('isActive', '==', false))),
        getCountFromServer(query(itemsRef, where('lowStock', '==', true))),
        getCountFromServer(query(itemsRef, where('hasDamagedOrRetired', '==', true))),
        getDocs(
          query(itemsRef, where('inMaintenance', '==', true), limit(INVENTORY_ITEMS_SUMMARY_BOUND)),
        ),
        getDocs(
          query(
            itemsRef,
            where('nextMaintenanceDate', '<=', todayIso),
            limit(INVENTORY_ITEMS_SUMMARY_BOUND),
          ),
        ),
      ]);

      const maintenanceIds = new Set();
      for (const docSnap of inMaintDocsSnap.docs) {
        const rec = normalizeInventoryItemRecord(docSnap.id, docSnap.data());
        if (rec.isActive) maintenanceIds.add(rec.id);
      }
      for (const docSnap of dueMaintDocsSnap.docs) {
        const rec = normalizeInventoryItemRecord(docSnap.id, docSnap.data());
        if (rec.isActive && rec.itemType === 'equipment') maintenanceIds.add(rec.id);
      }

      const maintenanceBoundedExceeded =
        inMaintDocsSnap.docs.length >= INVENTORY_ITEMS_SUMMARY_BOUND ||
        dueMaintDocsSnap.docs.length >= INVENTORY_ITEMS_SUMMARY_BOUND;

      return {
        activeItemsCount: activeCountSnap.data().count,
        archivedItemsCount: archivedCountSnap.data().count,
        lowStockCount: lowStockCountSnap.data().count,
        maintenanceCount: maintenanceIds.size,
        damagedRetiredCount: damagedRetiredCountSnap.data().count,
        maintenanceBoundedExceeded,
        isServerAggregated: true,
      };
    },

    subscribeInventoryMovements({ maxLimit = INVENTORY_MOVEMENTS_PAGE_SIZE, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.INVENTORY_MOVEMENTS),
            orderBy('occurredAt', 'desc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const hasMore = snapshot.docs.length > maxLimit;
              const docs = hasMore ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const movements = sortMovementsDesc(
                docs.map((docSnap) => normalizeInventoryMovementRecord(docSnap.id, docSnap.data())),
              );
              onData?.({ movements, hasMore, maxLimit });
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

    async listItemMovements({ itemId, maxLimit = INVENTORY_ITEM_HISTORY_PAGE_SIZE } = {}) {
      if (!itemId) return { movements: [], hasMore: false };
      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const boundLimit = Math.max(maxLimit + 1, 200);
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.INVENTORY_MOVEMENTS),
        where('itemId', '==', itemId),
        limit(boundLimit),
      );
      const snapshot = await getDocs(q);
      const sorted = sortMovementsDesc(
        snapshot.docs.map((docSnap) =>
          normalizeInventoryMovementRecord(docSnap.id, docSnap.data()),
        ),
      );
      return {
        movements: sorted.slice(0, maxLimit),
        hasMore: sorted.length > maxLimit,
        totalLoaded: sorted.length,
      };
    },
  };
}

/**
 * Shared In-Memory Transactional Inventory Repository Adapter for Vitest & QA.
 */
export function createInMemoryInventoryRepositoryAdapter({
  initialItems = [],
  initialMovements = [],
} = {}) {
  const itemsStore = new Map();
  const movementsStore = new Map();
  const itemListeners = new Set();
  const movementListeners = new Set();
  let clockOffsetMs = 0;

  const nextClockDate = () => {
    clockOffsetMs += 1;
    return new Date(Date.now() + clockOffsetMs);
  };

  for (const item of initialItems) {
    if (item?.id) {
      itemsStore.set(item.id, normalizeInventoryItemRecord(item.id, item));
    }
  }
  for (const mov of initialMovements) {
    if (mov?.id) {
      movementsStore.set(mov.id, normalizeInventoryMovementRecord(mov.id, mov));
    }
  }

  const cloneValue = (val) => {
    if (val instanceof Date) return new Date(val.getTime());
    if (Array.isArray(val)) return val.map(cloneValue);
    if (val && typeof val === 'object') {
      return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, cloneValue(v)]));
    }
    return val;
  };

  const notifyItems = () => {
    const allSorted = sortItemsByUpdatedDesc(Array.from(itemsStore.values()));
    for (const entry of itemListeners) {
      const slice = allSorted.slice(0, entry.maxLimit);
      entry.onData?.({
        items: slice.map((item) => normalizeInventoryItemRecord(item.id, cloneValue(item))),
        hasMore: allSorted.length > entry.maxLimit,
        maxLimit: entry.maxLimit,
      });
    }
  };

  const notifyMovements = () => {
    const allSorted = sortMovementsDesc(Array.from(movementsStore.values()));
    for (const entry of movementListeners) {
      const slice = allSorted.slice(0, entry.maxLimit);
      entry.onData?.({
        movements: slice.map((mov) => normalizeInventoryMovementRecord(mov.id, cloneValue(mov))),
        hasMore: allSorted.length > entry.maxLimit,
        maxLimit: entry.maxLimit,
      });
    }
  };

  return {
    itemsStore,
    movementsStore,

    async runAtomicTransaction(transactionWork) {
      // Snapshot-and-commit transaction isolation for deterministic concurrency tests
      const stagedItems = new Map();
      const stagedMovements = new Map();
      const readItemVersions = new Map();
      const txTimestamp = nextClockDate();

      const txContext = {
        nowValue: () => txTimestamp,
        timestampFromDate: (date) => (date instanceof Date ? date : new Date(txTimestamp)),
        async getItem(itemId) {
          if (stagedItems.has(itemId)) {
            const val = stagedItems.get(itemId);
            return val ? normalizeInventoryItemRecord(itemId, cloneValue(val)) : null;
          }
          const existing = itemsStore.get(itemId) || null;
          readItemVersions.set(itemId, existing ? existing.version : null);
          return existing ? normalizeInventoryItemRecord(itemId, cloneValue(existing)) : null;
        },
        async getMovement(movementId) {
          if (stagedMovements.has(movementId)) {
            const val = stagedMovements.get(movementId);
            return val ? normalizeInventoryMovementRecord(movementId, cloneValue(val)) : null;
          }
          const existing = movementsStore.get(movementId) || null;
          return existing
            ? normalizeInventoryMovementRecord(movementId, cloneValue(existing))
            : null;
        },
        setItem(itemId, data) {
          stagedItems.set(itemId, { ...cloneValue(data), id: itemId });
        },
        updateItem(itemId, data) {
          const base = stagedItems.get(itemId) || itemsStore.get(itemId);
          if (!base) {
            throw new Error(`Document inventoryItems/${itemId} does not exist.`);
          }
          stagedItems.set(itemId, {
            ...cloneValue(base),
            ...cloneValue(data),
            id: itemId,
          });
        },
        setMovement(movementId, data) {
          stagedMovements.set(movementId, { ...cloneValue(data), id: movementId });
        },
      };

      const result = await transactionWork(txContext);

      // Verify optimistic concurrency before committing staged writes
      for (const [itemId, seenVersion] of readItemVersions.entries()) {
        const latest = itemsStore.get(itemId);
        const latestVersion = latest ? latest.version : null;
        if (latestVersion !== seenVersion && stagedItems.has(itemId)) {
          const err = new Error('Concurrent inventory modification detected.');
          err.code = 'aborted';
          throw err;
        }
      }

      for (const [id, data] of stagedItems.entries()) {
        itemsStore.set(id, normalizeInventoryItemRecord(id, data));
      }
      for (const [id, data] of stagedMovements.entries()) {
        movementsStore.set(id, normalizeInventoryMovementRecord(id, data));
      }

      if (stagedItems.size > 0) notifyItems();
      if (stagedMovements.size > 0) notifyMovements();

      return result;
    },

    async getItemById(itemId) {
      const existing = itemsStore.get(itemId);
      return existing ? normalizeInventoryItemRecord(itemId, cloneValue(existing)) : null;
    },

    async getItemByCode(normalizedCode) {
      const clean = String(normalizedCode || '')
        .trim()
        .toLowerCase();
      if (!clean) return null;
      for (const item of itemsStore.values()) {
        if (String(item.normalizedCode || '').toLowerCase() === clean) {
          return normalizeInventoryItemRecord(item.id, cloneValue(item));
        }
      }
      return null;
    },

    subscribeInventoryItems({ maxLimit = INVENTORY_ITEMS_PAGE_SIZE, onData }) {
      const entry = { maxLimit, onData };
      itemListeners.add(entry);
      const allSorted = sortItemsByUpdatedDesc(Array.from(itemsStore.values()));
      queueMicrotask(() => {
        if (!itemListeners.has(entry)) return;
        onData?.({
          items: allSorted
            .slice(0, maxLimit)
            .map((item) => normalizeInventoryItemRecord(item.id, cloneValue(item))),
          hasMore: allSorted.length > maxLimit,
          maxLimit,
        });
      });
      return () => {
        itemListeners.delete(entry);
      };
    },

    async listArchivedInventoryItems({ maxLimit = INVENTORY_ITEMS_PAGE_SIZE } = {}) {
      const archived = sortItemsByUpdatedDesc(
        Array.from(itemsStore.values()).filter((item) => item.isActive === false),
      );
      return {
        items: archived
          .slice(0, maxLimit)
          .map((item) => normalizeInventoryItemRecord(item.id, cloneValue(item))),
        hasMore: archived.length > maxLimit,
      };
    },

    async fetchInventorySummary({ todayIso = getJakartaTodayIso() } = {}) {
      const all = Array.from(itemsStore.values());
      let activeItemsCount = 0;
      let archivedItemsCount = 0;
      let lowStockCount = 0;
      let damagedRetiredCount = 0;
      const maintIds = new Set();

      for (const item of all) {
        if (item.isActive === false) {
          archivedItemsCount += 1;
          continue;
        }
        activeItemsCount += 1;
        if (item.lowStock) lowStockCount += 1;
        if (item.hasDamagedOrRetired) damagedRetiredCount += 1;
        if (
          item.itemType === 'equipment' &&
          (item.inMaintenance || (item.nextMaintenanceDate && item.nextMaintenanceDate <= todayIso))
        ) {
          maintIds.add(item.id);
        }
      }

      return {
        activeItemsCount,
        archivedItemsCount,
        lowStockCount,
        maintenanceCount: maintIds.size,
        damagedRetiredCount,
        maintenanceBoundedExceeded: false,
        isServerAggregated: true,
      };
    },

    subscribeInventoryMovements({ maxLimit = INVENTORY_MOVEMENTS_PAGE_SIZE, onData }) {
      const entry = { maxLimit, onData };
      movementListeners.add(entry);
      const allSorted = sortMovementsDesc(Array.from(movementsStore.values()));
      queueMicrotask(() => {
        if (!movementListeners.has(entry)) return;
        onData?.({
          movements: allSorted
            .slice(0, maxLimit)
            .map((mov) => normalizeInventoryMovementRecord(mov.id, cloneValue(mov))),
          hasMore: allSorted.length > maxLimit,
          maxLimit,
        });
      });
      return () => {
        movementListeners.delete(entry);
      };
    },

    async listItemMovements({ itemId, maxLimit = INVENTORY_ITEM_HISTORY_PAGE_SIZE } = {}) {
      const filtered = sortMovementsDesc(
        Array.from(movementsStore.values()).filter((mov) => mov.itemId === itemId),
      );
      return {
        movements: filtered
          .slice(0, maxLimit)
          .map((mov) => normalizeInventoryMovementRecord(mov.id, cloneValue(mov))),
        hasMore: filtered.length > maxLimit,
        totalLoaded: filtered.length,
      };
    },
  };
}

let activeInventoryRepositoryAdapter = null;

export function getInventoryRepositoryAdapter() {
  if (!activeInventoryRepositoryAdapter) {
    activeInventoryRepositoryAdapter = createFirestoreInventoryRepositoryAdapter();
  }
  return activeInventoryRepositoryAdapter;
}

export function setInventoryRepositoryAdapter(adapter) {
  activeInventoryRepositoryAdapter = adapter;
}

export function resetInventoryRepositoryAdapter() {
  activeInventoryRepositoryAdapter = null;
}
