/**
 * Factory Reset Repository Adapter (Cloud Firestore + Deterministic In-Memory Test Adapter).
 *
 * Responsibilities:
 * - Reads & persists the `systemOperations/factoryReset` manifest lock.
 * - Counts top-level collections & nested `publicBookingRequests` subcollections via `getCountFromServer`.
 * - Reads paginated document IDs ordered deterministically by `documentId()`.
 * - Deletes explicitly targeted document references in bounded `<= FACTORY_RESET_BATCH_SIZE` batches.
 * - Preserves configuration & account docs (checked read-only via `getDoc` / `getCountFromServer`).
 * - Reinitializes `publicAvailabilityMetadata/status` through the public-availability repository contract.
 */

import { STAFF_PROFILES_COLLECTION } from '@/features/auth/staff-profile-service';
import { getPublicAvailabilityRepositoryAdapter } from '@/features/public-availability/repositories/public-availability-repository';

import {
  FACTORY_RESET_BATCH_SIZE,
  FACTORY_RESET_DELETION_MANIFEST,
  FACTORY_RESET_DOC_ID,
  FACTORY_RESET_SCHEMA_VERSION,
  SYSTEM_OPERATIONS_COLLECTION,
} from '../config/factory-reset-config';
import { normalizeFactoryResetOperation } from '../utils/factory-reset-validation';

/**
 * Default Cloud Firestore Factory Reset Repository Adapter.
 */
export function createFirestoreFactoryResetRepositoryAdapter() {
  return {
    subscribeResetOperation({ onData, onError }) {
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
            onError?.(new Error('Firestore realtime listener unavailable.'));
            return;
          }

          const db = getFirebaseDb();
          const docRef = doc(db, SYSTEM_OPERATIONS_COLLECTION, FACTORY_RESET_DOC_ID);
          unsubscribe = onSnapshot(
            docRef,
            (snap) => {
              if (isCancelled) return;
              if (!snap || typeof snap.exists !== 'function') {
                onError?.(new Error('Invalid factoryReset snapshot received from Firestore.'));
                return;
              }
              onData?.(snap.exists() ? normalizeFactoryResetOperation(snap.data()) : null);
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

    async getResetOperation() {
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, SYSTEM_OPERATIONS_COLLECTION, FACTORY_RESET_DOC_ID));
      return snap.exists() ? normalizeFactoryResetOperation(snap.data()) : null;
    },

    async startOrReplaceResetOperation(initialPayload) {
      const [{ doc, serverTimestamp, setDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const docRef = doc(db, SYSTEM_OPERATIONS_COLLECTION, FACTORY_RESET_DOC_ID);
      const nowServer = serverTimestamp();

      const firestorePayload = {
        schemaVersion: FACTORY_RESET_SCHEMA_VERSION,
        operationId: initialPayload.operationId,
        status: initialPayload.status,
        initiatedByUid: initialPayload.initiatedByUid,
        initiatedAt: nowServer,
        currentCollection: String(initialPayload.currentCollection || ''),
        lastProcessedDocumentId: String(initialPayload.lastProcessedDocumentId || ''),
        completedCollections: [...(initialPayload.completedCollections || [])],
        deletedDocumentCounts: { ...(initialPayload.deletedDocumentCounts || {}) },
        totalDeletedCount: Math.max(0, Math.round(Number(initialPayload.totalDeletedCount) || 0)),
        startedAt: nowServer,
        updatedAt: nowServer,
        completedAt: null,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: null,
      };

      await setDoc(docRef, firestorePayload);

      const nowIso = new Date().toISOString();
      return normalizeFactoryResetOperation({
        ...firestorePayload,
        initiatedAt: nowIso,
        startedAt: nowIso,
        updatedAt: nowIso,
      });
    },

    async updateResetOperation(patch, currentOperation = null) {
      const [{ doc, serverTimestamp, updateDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const docRef = doc(db, SYSTEM_OPERATIONS_COLLECTION, FACTORY_RESET_DOC_ID);

      const updateFields = {
        ...patch,
        updatedAt: serverTimestamp(),
      };
      if (patch.markCompleted === true) {
        updateFields.completedAt = serverTimestamp();
      }
      delete updateFields.markCompleted;

      await updateDoc(docRef, updateFields);

      const nowIso = new Date().toISOString();
      return normalizeFactoryResetOperation({
        ...(currentOperation || {}),
        ...patch,
        updatedAt: nowIso,
        completedAt:
          patch.markCompleted === true ? nowIso : (currentOperation?.completedAt ?? null),
      });
    },

    async countCollectionDocuments(collectionName) {
      const [{ collection, getCountFromServer }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getCountFromServer(collection(db, collectionName));
      return snap.data().count;
    },

    async countSubcollectionForParent({ parentCollection, parentId, subcollectionName }) {
      const [{ collection, getCountFromServer }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getCountFromServer(
        collection(db, parentCollection, parentId, subcollectionName),
      );
      return snap.data().count;
    },

    async listDocumentIdsPage({ collectionName, pageSize, afterId = '' }) {
      const [
        { collection, documentId, getDocs, limit, orderBy, query, startAfter },
        { getFirebaseDb },
      ] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const colRef = collection(db, collectionName);
      const constraints = [
        orderBy(documentId(), 'asc'),
        ...(afterId ? [startAfter(afterId)] : []),
        limit(pageSize + 1),
      ];
      const snap = await getDocs(query(colRef, ...constraints));
      const hasMore = snap.docs.length > pageSize;
      const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
      return {
        ids: docs.map((d) => d.id),
        hasMore,
      };
    },

    async listSubcollectionDocIds({
      parentCollection,
      parentId,
      subcollectionName,
      pageSize,
      afterId = '',
    }) {
      const [
        { collection, documentId, getDocs, limit, orderBy, query, startAfter },
        { getFirebaseDb },
      ] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const subRef = collection(db, parentCollection, parentId, subcollectionName);
      const constraints = [
        orderBy(documentId(), 'asc'),
        ...(afterId ? [startAfter(afterId)] : []),
        limit(pageSize + 1),
      ];
      const snap = await getDocs(query(subRef, ...constraints));
      const hasMore = snap.docs.length > pageSize;
      const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
      return {
        ids: docs.map((d) => d.id),
        hasMore,
      };
    },

    async deleteDocumentsBatch(pathSegmentsList = []) {
      if (!Array.isArray(pathSegmentsList) || pathSegmentsList.length === 0) {
        return 0;
      }
      if (pathSegmentsList.length > FACTORY_RESET_BATCH_SIZE) {
        throw new Error(
          `Factory Reset batch size ${pathSegmentsList.length} exceeds limit of ${FACTORY_RESET_BATCH_SIZE}.`,
        );
      }

      const [{ doc, writeBatch }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const batch = writeBatch(db);
      for (const segments of pathSegmentsList) {
        batch.delete(doc(db, ...segments));
      }
      await batch.commit();
      return pathSegmentsList.length;
    },

    async checkPreservedTarget(preservedItem, actorUid = '') {
      if (preservedItem.checkType === 'auth_session') {
        return {
          key: preservedItem.key,
          exists: Boolean(actorUid),
          statusLabel: 'Active Auth Session',
        };
      }
      if (preservedItem.checkType === 'external_asset') {
        return {
          key: preservedItem.key,
          statusLabel: 'Untouched (Cloudinary Preserved)',
        };
      }
      if (preservedItem.checkType === 'actor_profile_doc') {
        const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase/firestore'),
        ]);
        const snap = await getDoc(doc(getFirebaseDb(), STAFF_PROFILES_COLLECTION, actorUid));
        return {
          key: preservedItem.key,
          exists: snap.exists(),
          statusLabel: snap.exists() ? 'Verified Active Profile' : 'Missing Profile',
        };
      }
      if (preservedItem.checkType === 'singleton_doc') {
        const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase/firestore'),
        ]);
        const snap = await getDoc(
          doc(getFirebaseDb(), preservedItem.collection, preservedItem.docId),
        );
        return {
          key: preservedItem.key,
          exists: snap.exists(),
          statusLabel: snap.exists() ? 'Persisted Document' : 'Not Created Yet (Preserved Path)',
        };
      }
      if (preservedItem.checkType === 'collection_count') {
        const [{ collection, getCountFromServer }, { getFirebaseDb }] = await Promise.all([
          import('firebase/firestore'),
          import('@/lib/firebase/firestore'),
        ]);
        const snap = await getCountFromServer(
          collection(getFirebaseDb(), preservedItem.collection),
        );
        return {
          key: preservedItem.key,
          count: snap.data().count,
          statusLabel: `${snap.data().count} documents`,
        };
      }
      return {
        key: preservedItem.key,
        statusLabel: 'Preserved',
      };
    },

    async setPublicAvailabilityMetadata({ isReady, backfilledFromDate = '' }) {
      return getPublicAvailabilityRepositoryAdapter().setPublicAvailabilityMetadata({
        isReady,
        backfilledFromDate,
      });
    },
  };
}

/**
 * Deterministic In-Memory Factory Reset Repository Adapter for tests and QA.
 */
export function createInMemoryFactoryResetRepositoryAdapter({
  initialCollections = {},
  initialRequestSubcollections = {},
  initialInvoiceSubcollections = {},
  initialSubcollections = {},
  initialPreserved = {},
  initialOperation = null,
  initialPublicAvailabilityMetadata = { isReady: true, backfilledFromDate: '2026-11-22' },
} = {}) {
  const collectionsMap = new Map();
  for (const step of FACTORY_RESET_DELETION_MANIFEST) {
    if (step.kind === 'collection') {
      collectionsMap.set(step.collection, new Map());
    }
  }
  for (const [colName, docsList] of Object.entries(initialCollections || {})) {
    if (!collectionsMap.has(colName)) {
      collectionsMap.set(colName, new Map());
    }
    const targetMap = collectionsMap.get(colName);
    for (const item of docsList || []) {
      const id = item?.id || `doc_${targetMap.size + 1}`;
      targetMap.set(id, { id, ...item });
    }
  }

  // Map<parentRequestId, { communications: Map<id, doc>, activities: Map<id, doc>, offers: Map<id, doc> }>
  const requestSubcollectionsMap = new Map();
  // Generalized Map<`${parentCollection}/${parentId}/${subcollectionName}`, Map<id, doc>>
  const subcollectionsByPathMap = new Map();

  function getOrCreateSubcollectionMap(parentCollection, parentId, subcollectionName) {
    const pathKey = `${parentCollection}/${parentId}/${subcollectionName}`;
    if (!subcollectionsByPathMap.has(pathKey)) {
      subcollectionsByPathMap.set(pathKey, new Map());
    }
    return subcollectionsByPathMap.get(pathKey);
  }

  for (const [parentId, subs] of Object.entries(initialRequestSubcollections || {})) {
    const commMap = getOrCreateSubcollectionMap('publicBookingRequests', parentId, 'communications');
    const actMap = getOrCreateSubcollectionMap('publicBookingRequests', parentId, 'activities');
    const offerMap = getOrCreateSubcollectionMap('publicBookingRequests', parentId, 'offers');
    for (const c of subs?.communications || []) {
      const cid = c?.id || `comm_${commMap.size + 1}`;
      commMap.set(cid, { id: cid, ...c });
    }
    for (const a of subs?.activities || []) {
      const aid = a?.id || `act_${actMap.size + 1}`;
      actMap.set(aid, { id: aid, ...a });
    }
    for (const o of subs?.offers || []) {
      const oid = o?.id || `off_${offerMap.size + 1}`;
      offerMap.set(oid, { id: oid, ...o });
    }
    requestSubcollectionsMap.set(parentId, {
      communications: commMap,
      activities: actMap,
      offers: offerMap,
    });
  }

  for (const [invoiceId, subs] of Object.entries(initialInvoiceSubcollections || {})) {
    const adjMap = getOrCreateSubcollectionMap('invoices', invoiceId, 'adjustments');
    for (const adj of subs?.adjustments || []) {
      const adjId = adj?.id || adj?.adjustmentId || `adj_${adjMap.size + 1}`;
      adjMap.set(adjId, { id: adjId, ...adj });
    }
  }

  for (const [parentCollection, parentsObj] of Object.entries(initialSubcollections || {})) {
    for (const [parentId, subsObj] of Object.entries(parentsObj || {})) {
      for (const [subName, docs] of Object.entries(subsObj || {})) {
        const subMap = getOrCreateSubcollectionMap(parentCollection, parentId, subName);
        for (const docItem of docs || []) {
          const docId = docItem?.id || `doc_${subMap.size + 1}`;
          subMap.set(docId, { id: docId, ...docItem });
        }
      }
    }
  }

  const preservedCollectionsMap = new Map([
    ['staffProfiles', new Map()],
    ['settings', new Map()],
    ['bookkeepingSettings', new Map()],
    ['publicSiteSettings', new Map()],
    ['bookingRequestMessageTemplates', new Map()],
    ['galleryItems', new Map()],
    ['landingPagePlacements', new Map()],
    ['customerReviews', new Map()],
    ['publicReviewStats', new Map()],
  ]);
  for (const [colName, docsList] of Object.entries(initialPreserved || {})) {
    if (!preservedCollectionsMap.has(colName)) {
      preservedCollectionsMap.set(colName, new Map());
    }
    const target = preservedCollectionsMap.get(colName);
    for (const item of docsList || []) {
      const id = item?.id || `pres_${target.size + 1}`;
      target.set(id, { id, ...item });
    }
  }

  let publicAvailabilityMetadataState = initialPublicAvailabilityMetadata
    ? { schemaVersion: 1, ...initialPublicAvailabilityMetadata }
    : null;
  let storedOperation = initialOperation ? normalizeFactoryResetOperation(initialOperation) : null;
  const operationSubscribers = new Set();

  let failCountTargetKey = '';
  let failDeleteOnBatchNumber = -1;
  let committedDeleteBatchesCount = 0;
  let failAvailabilityReinit = false;
  let failNextOperationStart = false;
  const batchSizesLog = [];

  function notifyOperationSubscribers() {
    const snap = storedOperation ? { ...storedOperation } : null;
    for (const cb of operationSubscribers) {
      cb?.(snap);
    }
  }

  return {
    _inspectState() {
      const operationalCounts = {};
      for (const [colName, docsMap] of collectionsMap.entries()) {
        operationalCounts[colName] = docsMap.size;
      }
      let communicationsCount = 0;
      let activitiesCount = 0;
      let offersCount = 0;
      let adjustmentsCount = 0;
      for (const subs of requestSubcollectionsMap.values()) {
        communicationsCount += subs.communications.size;
        activitiesCount += subs.activities.size;
        offersCount += subs.offers?.size || 0;
      }
      for (const [pathKey, docsMap] of subcollectionsByPathMap.entries()) {
        if (pathKey.startsWith('invoices/') && pathKey.endsWith('/adjustments')) {
          adjustmentsCount += docsMap.size;
        }
      }
      const preservedCounts = {};
      for (const [colName, docsMap] of preservedCollectionsMap.entries()) {
        preservedCounts[colName] = docsMap.size;
      }
      return {
        collectionsMap,
        requestSubcollectionsMap,
        subcollectionsByPathMap,
        preservedCollectionsMap,
        operationalCounts,
        communicationsCount,
        activitiesCount,
        offersCount,
        adjustmentsCount,
        preservedCounts,
        publicAvailabilityMetadataState,
        operation: storedOperation ? { ...storedOperation } : null,
        batchSizesLog: [...batchSizesLog],
        committedDeleteBatchesCount,
      };
    },

    _setFailCountForTarget(targetKey = '') {
      failCountTargetKey = targetKey;
    },

    _setFailDeleteAtBatch(batchIndex = -1) {
      failDeleteOnBatchNumber = batchIndex;
      committedDeleteBatchesCount = 0;
    },

    _setFailAvailabilityReinit(shouldFail = false) {
      failAvailabilityReinit = Boolean(shouldFail);
    },

    _setFailNextOperationStart(shouldFail = false) {
      failNextOperationStart = Boolean(shouldFail);
    },

    _seedStragglerDoc(collectionName, docObj) {
      if (!collectionsMap.has(collectionName)) {
        collectionsMap.set(collectionName, new Map());
      }
      const target = collectionsMap.get(collectionName);
      target.set(docObj.id, { ...docObj });
    },

    subscribeResetOperation({ onData }) {
      operationSubscribers.add(onData);
      onData?.(storedOperation ? { ...storedOperation } : null);
      return () => {
        operationSubscribers.delete(onData);
      };
    },

    async getResetOperation() {
      return storedOperation ? { ...storedOperation } : null;
    },

    async startOrReplaceResetOperation(initialPayload) {
      if (failNextOperationStart) {
        failNextOperationStart = false;
        const err = new Error('Simulated permission-denied creating reset lock.');
        err.code = 'permission-denied';
        throw err;
      }
      const nowIso = new Date().toISOString();
      storedOperation = normalizeFactoryResetOperation({
        ...initialPayload,
        initiatedAt: nowIso,
        startedAt: nowIso,
        updatedAt: nowIso,
        completedAt: null,
        verificationSummary: null,
      });
      notifyOperationSubscribers();
      return { ...storedOperation };
    },

    async updateResetOperation(patch, currentOperation = null) {
      const base = storedOperation || currentOperation || {};
      const nowIso = new Date().toISOString();
      const next = {
        ...base,
        ...patch,
        updatedAt: nowIso,
        completedAt: patch.markCompleted === true ? nowIso : (base.completedAt ?? null),
      };
      delete next.markCompleted;
      storedOperation = normalizeFactoryResetOperation(next);
      notifyOperationSubscribers();
      return { ...storedOperation };
    },

    async countCollectionDocuments(collectionName) {
      if (failCountTargetKey === collectionName) {
        const err = new Error(`Simulated count failure for ${collectionName}.`);
        err.code = 'permission-denied';
        throw err;
      }
      return collectionsMap.get(collectionName)?.size || 0;
    },

    async countSubcollectionForParent({ parentCollection, parentId, subcollectionName }) {
      const key = `${parentCollection}_${subcollectionName}`;
      if (failCountTargetKey === key) {
        const err = new Error(`Simulated subcollection count failure for ${key}.`);
        err.code = 'permission-denied';
        throw err;
      }
      return subcollectionsByPathMap.get(`${parentCollection}/${parentId}/${subcollectionName}`)?.size || 0;
    },

    async listDocumentIdsPage({ collectionName, pageSize, afterId = '' }) {
      const target = collectionsMap.get(collectionName) || new Map();
      const sortedIds = Array.from(target.keys()).sort((a, b) => a.localeCompare(b));
      const filtered = afterId ? sortedIds.filter((id) => id > afterId) : sortedIds;
      const slice = filtered.slice(0, pageSize + 1);
      const hasMore = slice.length > pageSize;
      return {
        ids: slice.slice(0, pageSize),
        hasMore,
      };
    },

    async listSubcollectionDocIds({
      parentCollection,
      parentId,
      subcollectionName,
      pageSize,
      afterId = '',
    }) {
      const subMap =
        subcollectionsByPathMap.get(`${parentCollection}/${parentId}/${subcollectionName}`) ||
        new Map();
      const sortedIds = Array.from(subMap.keys()).sort((a, b) => a.localeCompare(b));
      const filtered = afterId ? sortedIds.filter((id) => id > afterId) : sortedIds;
      const slice = filtered.slice(0, pageSize + 1);
      const hasMore = slice.length > pageSize;
      return {
        ids: slice.slice(0, pageSize),
        hasMore,
      };
    },

    async deleteDocumentsBatch(pathSegmentsList = []) {
      if (!Array.isArray(pathSegmentsList) || pathSegmentsList.length === 0) {
        return 0;
      }
      if (pathSegmentsList.length > FACTORY_RESET_BATCH_SIZE) {
        throw new Error(
          `Batch size ${pathSegmentsList.length} exceeds limit of ${FACTORY_RESET_BATCH_SIZE}.`,
        );
      }

      if (failDeleteOnBatchNumber >= 0 && committedDeleteBatchesCount === failDeleteOnBatchNumber) {
        committedDeleteBatchesCount += 1;
        const err = new Error('Simulated Firestore batch commit failure during Factory Reset.');
        err.code = 'unavailable';
        throw err;
      }

      committedDeleteBatchesCount += 1;
      batchSizesLog.push(pathSegmentsList.length);

      for (const segments of pathSegmentsList) {
        if (segments.length === 2) {
          const [colName, docId] = segments;
          collectionsMap.get(colName)?.delete(docId);
        } else if (segments.length === 4) {
          const [parentCol, parentId, subName, docId] = segments;
          subcollectionsByPathMap.get(`${parentCol}/${parentId}/${subName}`)?.delete(docId);
        }
      }

      return pathSegmentsList.length;
    },

    async checkPreservedTarget(preservedItem, actorUid = '') {
      if (preservedItem.checkType === 'auth_session') {
        return {
          key: preservedItem.key,
          exists: Boolean(actorUid),
          statusLabel: 'Active Auth Session',
        };
      }
      if (preservedItem.checkType === 'external_asset') {
        return {
          key: preservedItem.key,
          statusLabel: 'Untouched (Cloudinary Preserved)',
        };
      }
      if (preservedItem.checkType === 'actor_profile_doc') {
        const exists = Boolean(preservedCollectionsMap.get('staffProfiles')?.has(actorUid));
        return {
          key: preservedItem.key,
          exists,
          statusLabel: exists ? 'Verified Active Profile' : 'Preserved Path',
        };
      }
      if (preservedItem.checkType === 'singleton_doc') {
        const exists =
          preservedItem.collection === 'publicAvailabilityMetadata'
            ? Boolean(publicAvailabilityMetadataState)
            : Boolean(
                preservedCollectionsMap.get(preservedItem.collection)?.has(preservedItem.docId),
              );
        return {
          key: preservedItem.key,
          exists,
          statusLabel: exists ? 'Persisted Document' : 'Preserved Path',
        };
      }
      if (preservedItem.checkType === 'collection_count') {
        const count = preservedCollectionsMap.get(preservedItem.collection)?.size || 0;
        return {
          key: preservedItem.key,
          count,
          statusLabel: `${count} documents`,
        };
      }
      return {
        key: preservedItem.key,
        statusLabel: 'Preserved',
      };
    },

    async setPublicAvailabilityMetadata({ isReady, backfilledFromDate = '' }) {
      if (isReady && failAvailabilityReinit) {
        const err = new Error('Simulated public availability metadata reinit failure.');
        err.code = 'unavailable';
        throw err;
      }
      const nowSec = Math.floor(Date.now() / 1000);
      publicAvailabilityMetadataState = {
        schemaVersion: 1,
        isReady: Boolean(isReady),
        backfilledFromDate: String(backfilledFromDate || '').trim(),
        backfillCompletedAt: isReady ? { seconds: nowSec } : null,
        updatedAt: { seconds: nowSec },
      };
      return { ...publicAvailabilityMetadataState };
    },
  };
}

let activeFactoryResetAdapter = createFirestoreFactoryResetRepositoryAdapter();

export function getFactoryResetRepositoryAdapter() {
  return activeFactoryResetAdapter;
}

export function setFactoryResetRepositoryAdapter(customAdapter) {
  activeFactoryResetAdapter = customAdapter || createFirestoreFactoryResetRepositoryAdapter();
}

export function resetFactoryResetRepositoryAdapter() {
  activeFactoryResetAdapter = createFirestoreFactoryResetRepositoryAdapter();
}
