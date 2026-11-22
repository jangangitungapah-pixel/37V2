import {
  LANDING_PAGE_PLACEMENT_ID_LIST,
  LANDING_PAGE_PLACEMENT_SCHEMA_VERSION,
  LANDING_PAGE_PLACEMENT_STATUSES,
  LANDING_PAGE_PLACEMENTS_COLLECTION,
} from '../config/landing-page-placements-config';
import { normalizeLandingPagePlacement } from '../utils/landing-page-placement-normalize';

export function createLandingPagePlacementError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Cloud Firestore repository adapter for `landingPagePlacements/{placementId}`.
 */
export function createFirestoreLandingPagePlacementAdapter() {
  return {
    subscribeAdminPlacements({ onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(collection(db, LANDING_PAGE_PLACEMENTS_COLLECTION), limit(10));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
              const placementsById = {};
              docs.forEach((docSnap) => {
                if (LANDING_PAGE_PLACEMENT_ID_LIST.includes(docSnap.id)) {
                  placementsById[docSnap.id] = normalizeLandingPagePlacement(
                    docSnap.id,
                    docSnap.data(),
                  );
                }
              });
              onData?.({ placementsById });
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

    subscribePublishedPlacements({ onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, LANDING_PAGE_PLACEMENTS_COLLECTION),
            where('status', '==', LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED),
            limit(10),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
              const placementsById = {};
              docs.forEach((docSnap) => {
                if (LANDING_PAGE_PLACEMENT_ID_LIST.includes(docSnap.id)) {
                  const normalized = normalizeLandingPagePlacement(docSnap.id, docSnap.data());
                  if (normalized.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED) {
                    placementsById[docSnap.id] = normalized;
                  }
                }
              });
              onData?.({ placementsById });
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

    async savePlacementTransaction({ placementId, actorUid, expectedVersion = null, payload }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const placementRef = doc(db, LANDING_PAGE_PLACEMENTS_COLLECTION, placementId);

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(placementRef);
        const exists = snap.exists();
        const current = exists ? snap.data() : null;
        const currentVersion = exists ? Number(current?.version) || 1 : 0;

        if (
          Number.isInteger(expectedVersion) &&
          expectedVersion >= 0 &&
          currentVersion !== expectedVersion
        ) {
          throw createLandingPagePlacementError(
            'placement/stale-version',
            `Penempatan "${placementId}" telah diperbarui di sesi lain (v${currentVersion}). Silakan coba simpan kembali.`,
            { currentVersion, expectedVersion },
          );
        }

        const nextVersion = exists ? currentVersion + 1 : 1;
        const nowTs = serverTimestamp();

        const firestoreDoc = {
          schemaVersion: LANDING_PAGE_PLACEMENT_SCHEMA_VERSION,
          placementId,
          sourceGalleryItemId: payload.sourceGalleryItemId,
          cloudinaryPublicId: payload.cloudinaryPublicId,
          cloudinaryAssetId: payload.cloudinaryAssetId,
          secureUrl: payload.secureUrl,
          resourceType: 'image',
          format: payload.format,
          width: payload.width,
          height: payload.height,
          bytes: payload.bytes,
          altText: payload.altText,
          copy: payload.copy,
          status: payload.status,
          version: nextVersion,
          createdAt: exists ? current.createdAt : nowTs,
          createdByUid: exists ? current.createdByUid : actorUid,
          updatedAt: nowTs,
          updatedByUid: actorUid,
        };

        tx.set(placementRef, firestoreDoc);

        const nowDate = new Date();
        return normalizeLandingPagePlacement(placementId, {
          ...firestoreDoc,
          createdAt: exists ? current.createdAt : nowDate,
          updatedAt: nowDate,
        });
      });
    },
  };
}

/**
 * Deterministic in-memory adapter for unit and integration tests.
 */
export function createInMemoryLandingPagePlacementAdapter(initialPlacements = []) {
  const placementsMap = new Map();
  let nextWriteError = null;
  const adminListeners = new Set();
  const publicListeners = new Set();

  function seed(items = []) {
    placementsMap.clear();
    const list = Array.isArray(items) ? items : Object.values(items || {});
    list.forEach((raw) => {
      const id = raw?.placementId || raw?.id;
      if (!LANDING_PAGE_PLACEMENT_ID_LIST.includes(id)) return;
      const nowIso = new Date().toISOString();
      const normalized = normalizeLandingPagePlacement(id, {
        createdAt: raw?.createdAt || nowIso,
        updatedAt: raw?.updatedAt || nowIso,
        ...raw,
      });
      placementsMap.set(id, normalized);
    });
  }

  seed(initialPlacements);

  function buildAdminPayload() {
    const placementsById = {};
    placementsMap.forEach((value, key) => {
      placementsById[key] = structuredClone(value);
    });
    return { placementsById };
  }

  function buildPublicPayload() {
    const placementsById = {};
    placementsMap.forEach((value, key) => {
      if (value.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED) {
        placementsById[key] = structuredClone(value);
      }
    });
    return { placementsById };
  }

  function emitAll() {
    const adminPayload = buildAdminPayload();
    adminListeners.forEach((entry) => entry.onData?.(adminPayload));
    const publicPayload = buildPublicPayload();
    publicListeners.forEach((entry) => entry.onData?.(publicPayload));
  }

  return {
    subscribeAdminPlacements({ onData, onError }) {
      const entry = { onData, onError };
      adminListeners.add(entry);
      queueMicrotask(() => {
        if (!adminListeners.has(entry)) return;
        onData?.(buildAdminPayload());
      });
      return () => {
        adminListeners.delete(entry);
      };
    },

    subscribePublishedPlacements({ onData, onError }) {
      const entry = { onData, onError };
      publicListeners.add(entry);
      queueMicrotask(() => {
        if (!publicListeners.has(entry)) return;
        onData?.(buildPublicPayload());
      });
      return () => {
        publicListeners.delete(entry);
      };
    },

    async savePlacementTransaction({ placementId, actorUid, expectedVersion = null, payload }) {
      if (nextWriteError) {
        const err = nextWriteError;
        nextWriteError = null;
        throw err;
      }

      const existing = placementsMap.get(placementId);
      const currentVersion = existing ? existing.version : 0;

      if (
        Number.isInteger(expectedVersion) &&
        expectedVersion >= 0 &&
        currentVersion !== expectedVersion
      ) {
        throw createLandingPagePlacementError(
          'placement/stale-version',
          `Penempatan "${placementId}" telah diperbarui di sesi lain (v${currentVersion}).`,
          { currentVersion, expectedVersion },
        );
      }

      const nowIso = new Date().toISOString();
      const nextVersion = existing ? currentVersion + 1 : 1;

      const record = normalizeLandingPagePlacement(placementId, {
        schemaVersion: LANDING_PAGE_PLACEMENT_SCHEMA_VERSION,
        placementId,
        sourceGalleryItemId: payload.sourceGalleryItemId,
        cloudinaryPublicId: payload.cloudinaryPublicId,
        cloudinaryAssetId: payload.cloudinaryAssetId,
        secureUrl: payload.secureUrl,
        resourceType: 'image',
        format: payload.format,
        width: payload.width,
        height: payload.height,
        bytes: payload.bytes,
        altText: payload.altText,
        copy: payload.copy,
        status: payload.status,
        version: nextVersion,
        createdAt: existing ? existing.createdAt : nowIso,
        createdByUid: existing ? existing.createdByUid : actorUid,
        updatedAt: nowIso,
        updatedByUid: actorUid,
      });

      placementsMap.set(placementId, record);
      emitAll();
      return structuredClone(record);
    },

    _seedPlacements(items) {
      seed(items);
      emitAll();
    },

    _getPlacement(placementId) {
      const found = placementsMap.get(placementId);
      return found ? structuredClone(found) : null;
    },

    _getAllPlacements() {
      return buildAdminPayload().placementsById;
    },

    _setNextWriteError(err) {
      nextWriteError = err;
    },

    _triggerPublicError(err) {
      publicListeners.forEach((entry) => entry.onError?.(err));
    },
  };
}

let activePlacementAdapter = createFirestoreLandingPagePlacementAdapter();

export function getLandingPagePlacementAdapter() {
  return activePlacementAdapter;
}

export function setLandingPagePlacementAdapter(customAdapter) {
  activePlacementAdapter = customAdapter || createFirestoreLandingPagePlacementAdapter();
}

export function resetLandingPagePlacementAdapter() {
  activePlacementAdapter = createFirestoreLandingPagePlacementAdapter();
}
