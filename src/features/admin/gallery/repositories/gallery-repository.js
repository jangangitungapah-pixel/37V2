import {
  GALLERY_BOUNDED_QUERY_LIMIT,
  GALLERY_COLLECTION,
  GALLERY_DEFAULT_SORT_STEP,
  GALLERY_SCHEMA_VERSION,
  GALLERY_STATUSES,
} from '../config/gallery-config';
import {
  normalizeGalleryItem,
  sortAdminGalleryItems,
  sortPublishedGalleryItems,
} from '../utils/gallery-normalize';

export function createGalleryRepositoryError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

export function generateGalleryItemId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return `gal_${ts}_${rand}`;
}

/**
 * Cloud Firestore repository adapter for `galleryItems/{galleryItemId}`.
 */
export function createFirestoreGalleryRepositoryAdapter() {
  return {
    subscribeAdminGalleryItems({ limitCount = GALLERY_BOUNDED_QUERY_LIMIT, onData, onError }) {
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
          const q = query(collection(db, GALLERY_COLLECTION), limit(limitCount));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
              const items = sortAdminGalleryItems(
                docs.map((docSnap) => normalizeGalleryItem(docSnap.id, docSnap.data())),
              );
              onData?.({
                items,
                reachedQueryLimit: docs.length >= limitCount,
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

    subscribePublishedGalleryItems({ limitCount = GALLERY_BOUNDED_QUERY_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(db, GALLERY_COLLECTION),
            where('status', '==', GALLERY_STATUSES.PUBLISHED),
            orderBy('sortOrder', 'asc'),
            limit(limitCount),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
              const items = sortPublishedGalleryItems(
                docs.map((docSnap) => normalizeGalleryItem(docSnap.id, docSnap.data())),
              );
              onData?.({
                items,
                reachedQueryLimit: docs.length >= limitCount,
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

    async createGalleryItemTransaction({ itemId, actorUid, payload }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const itemRef = doc(db, GALLERY_COLLECTION, itemId);

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(itemRef);
        if (snap.exists()) {
          const existing = snap.data();
          if (existing?.cloudinaryAssetId === payload.cloudinaryAssetId) {
            return normalizeGalleryItem(itemId, existing);
          }
          throw createGalleryRepositoryError(
            'gallery/id-conflict',
            'ID dokumen galeri sudah digunakan oleh aset lain.',
          );
        }

        const nowTs = serverTimestamp();
        const firestoreDoc = {
          schemaVersion: GALLERY_SCHEMA_VERSION,
          title: payload.title,
          category: payload.category,
          altText: payload.altText,
          caption: payload.caption,
          cloudinaryPublicId: payload.cloudinaryPublicId,
          cloudinaryAssetId: payload.cloudinaryAssetId,
          secureUrl: payload.secureUrl,
          resourceType: 'image',
          format: payload.format,
          width: payload.width,
          height: payload.height,
          bytes: payload.bytes,
          status: GALLERY_STATUSES.DRAFT,
          sortOrder: payload.sortOrder ?? GALLERY_DEFAULT_SORT_STEP,
          uploadedAt: nowTs,
          uploadedByUid: actorUid,
          createdAt: nowTs,
          createdByUid: actorUid,
          updatedAt: nowTs,
          updatedByUid: actorUid,
          version: 1,
        };

        tx.set(itemRef, firestoreDoc);

        const nowDate = new Date();
        return normalizeGalleryItem(itemId, {
          ...firestoreDoc,
          uploadedAt: nowDate,
          createdAt: nowDate,
          updatedAt: nowDate,
        });
      });
    },

    async updateGalleryItemTransaction({ itemId, actorUid, expectedVersion, patch }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const itemRef = doc(db, GALLERY_COLLECTION, itemId);

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(itemRef);
        if (!snap.exists()) {
          throw createGalleryRepositoryError(
            'gallery/not-found',
            'Data foto galeri tidak ditemukan di Firestore.',
          );
        }

        const current = snap.data();
        const currentVersion = Number(current?.version) || 1;
        if (Number.isInteger(expectedVersion) && currentVersion !== expectedVersion) {
          throw createGalleryRepositoryError(
            'gallery/stale-version',
            `Foto ini telah diperbarui di sesi lain (versi saat ini v${currentVersion}). Muat data terbaru sebelum menyimpan ulang.`,
            { currentVersion, expectedVersion },
          );
        }

        const nextVersion = currentVersion + 1;
        const nextDoc = {
          schemaVersion: GALLERY_SCHEMA_VERSION,
          title: patch.title !== undefined ? patch.title : current.title,
          category: patch.category !== undefined ? patch.category : current.category,
          altText: patch.altText !== undefined ? patch.altText : current.altText,
          caption: patch.caption !== undefined ? patch.caption : current.caption,
          cloudinaryPublicId: current.cloudinaryPublicId,
          cloudinaryAssetId: current.cloudinaryAssetId,
          secureUrl: current.secureUrl,
          resourceType: current.resourceType,
          format: current.format,
          width: current.width,
          height: current.height,
          bytes: current.bytes,
          status: patch.status !== undefined ? patch.status : current.status,
          sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : current.sortOrder,
          uploadedAt: current.uploadedAt,
          uploadedByUid: current.uploadedByUid,
          createdAt: current.createdAt,
          createdByUid: current.createdByUid,
          updatedAt: serverTimestamp(),
          updatedByUid: actorUid,
          version: nextVersion,
        };

        tx.set(itemRef, nextDoc);

        return normalizeGalleryItem(itemId, {
          ...nextDoc,
          updatedAt: new Date(),
        });
      });
    },

    async swapGallerySortOrderTransaction({
      firstItemId,
      firstExpectedVersion,
      secondItemId,
      secondExpectedVersion,
      actorUid,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const firstRef = doc(db, GALLERY_COLLECTION, firstItemId);
      const secondRef = doc(db, GALLERY_COLLECTION, secondItemId);

      return runTransaction(db, async (tx) => {
        const [firstSnap, secondSnap] = await Promise.all([tx.get(firstRef), tx.get(secondRef)]);

        if (!firstSnap.exists() || !secondSnap.exists()) {
          throw createGalleryRepositoryError(
            'gallery/not-found',
            'Salah satu foto yang ingin diurutkan tidak ditemukan.',
          );
        }

        const firstData = firstSnap.data();
        const secondData = secondSnap.data();

        const firstVersion = Number(firstData.version) || 1;
        const secondVersion = Number(secondData.version) || 1;

        if (
          (Number.isInteger(firstExpectedVersion) && firstVersion !== firstExpectedVersion) ||
          (Number.isInteger(secondExpectedVersion) && secondVersion !== secondExpectedVersion)
        ) {
          throw createGalleryRepositoryError(
            'gallery/stale-version',
            'Urutan galeri telah berubah di sesi lain. Silakan coba lagi setelah daftar diperbarui.',
          );
        }

        if (
          firstData.status !== GALLERY_STATUSES.PUBLISHED ||
          secondData.status !== GALLERY_STATUSES.PUBLISHED
        ) {
          throw createGalleryRepositoryError(
            'gallery/reorder-requires-published',
            'Hanya foto dengan status Published yang dapat diubah urutan tampilnya.',
          );
        }

        let nextFirstOrder = Number(secondData.sortOrder) || 0;
        let nextSecondOrder = Number(firstData.sortOrder) || 0;

        if (nextFirstOrder === nextSecondOrder) {
          nextFirstOrder = Math.max(0, nextSecondOrder);
          nextSecondOrder = nextFirstOrder + GALLERY_DEFAULT_SORT_STEP;
        }

        const nowTs = serverTimestamp();

        const updatedFirst = {
          ...firstData,
          sortOrder: nextFirstOrder,
          updatedAt: nowTs,
          updatedByUid: actorUid,
          version: firstVersion + 1,
        };
        const updatedSecond = {
          ...secondData,
          sortOrder: nextSecondOrder,
          updatedAt: nowTs,
          updatedByUid: actorUid,
          version: secondVersion + 1,
        };

        tx.set(firstRef, updatedFirst);
        tx.set(secondRef, updatedSecond);

        const nowDate = new Date();
        return {
          first: normalizeGalleryItem(firstItemId, { ...updatedFirst, updatedAt: nowDate }),
          second: normalizeGalleryItem(secondItemId, { ...updatedSecond, updatedAt: nowDate }),
        };
      });
    },
  };
}

/**
 * Deterministic in-memory repository adapter for unit and integration testing.
 */
export function createInMemoryGalleryRepositoryAdapter(initialItems = []) {
  const itemsMap = new Map();
  let nextWriteError = null;
  const adminListeners = new Set();
  const publicListeners = new Set();

  function seed(list = []) {
    itemsMap.clear();
    list.forEach((raw) => {
      const id = raw?.id || generateGalleryItemId();
      const nowIso = new Date().toISOString();
      const normalized = normalizeGalleryItem(id, {
        uploadedAt: raw?.uploadedAt || nowIso,
        createdAt: raw?.createdAt || nowIso,
        updatedAt: raw?.updatedAt || nowIso,
        ...raw,
      });
      itemsMap.set(id, normalized);
    });
  }

  seed(initialItems);

  function buildAdminPayload(limitCount = GALLERY_BOUNDED_QUERY_LIMIT) {
    const all = sortAdminGalleryItems(Array.from(itemsMap.values()));
    const sliced = all.slice(0, limitCount);
    return {
      items: structuredClone(sliced),
      reachedQueryLimit: all.length >= limitCount,
    };
  }

  function buildPublicPayload(limitCount = GALLERY_BOUNDED_QUERY_LIMIT) {
    const published = sortPublishedGalleryItems(Array.from(itemsMap.values()));
    const sliced = published.slice(0, limitCount);
    return {
      items: structuredClone(sliced),
      reachedQueryLimit: published.length >= limitCount,
    };
  }

  function emitAll() {
    adminListeners.forEach((entry) => {
      entry.onData?.(buildAdminPayload(entry.limitCount));
    });
    publicListeners.forEach((entry) => {
      entry.onData?.(buildPublicPayload(entry.limitCount));
    });
  }

  function consumeQueuedWriteError() {
    if (nextWriteError) {
      const err = nextWriteError;
      nextWriteError = null;
      throw err;
    }
  }

  return {
    subscribeAdminGalleryItems({ limitCount = GALLERY_BOUNDED_QUERY_LIMIT, onData, onError }) {
      const entry = { limitCount, onData, onError };
      adminListeners.add(entry);

      queueMicrotask(() => {
        if (!adminListeners.has(entry)) return;
        onData?.(buildAdminPayload(limitCount));
      });

      return () => {
        adminListeners.delete(entry);
      };
    },

    subscribePublishedGalleryItems({ limitCount = GALLERY_BOUNDED_QUERY_LIMIT, onData, onError }) {
      const entry = { limitCount, onData, onError };
      publicListeners.add(entry);

      queueMicrotask(() => {
        if (!publicListeners.has(entry)) return;
        onData?.(buildPublicPayload(limitCount));
      });

      return () => {
        publicListeners.delete(entry);
      };
    },

    async createGalleryItemTransaction({ itemId, actorUid, payload }) {
      consumeQueuedWriteError();

      const existing = itemsMap.get(itemId);
      if (existing) {
        if (existing.cloudinaryAssetId === payload.cloudinaryAssetId) {
          return structuredClone(existing);
        }
        throw createGalleryRepositoryError(
          'gallery/id-conflict',
          'ID dokumen galeri sudah digunakan oleh aset lain.',
        );
      }

      const nowIso = new Date().toISOString();
      const record = normalizeGalleryItem(itemId, {
        schemaVersion: GALLERY_SCHEMA_VERSION,
        title: payload.title,
        category: payload.category,
        altText: payload.altText,
        caption: payload.caption,
        cloudinaryPublicId: payload.cloudinaryPublicId,
        cloudinaryAssetId: payload.cloudinaryAssetId,
        secureUrl: payload.secureUrl,
        resourceType: 'image',
        format: payload.format,
        width: payload.width,
        height: payload.height,
        bytes: payload.bytes,
        status: GALLERY_STATUSES.DRAFT,
        sortOrder: payload.sortOrder ?? GALLERY_DEFAULT_SORT_STEP,
        uploadedAt: nowIso,
        uploadedByUid: actorUid,
        createdAt: nowIso,
        createdByUid: actorUid,
        updatedAt: nowIso,
        updatedByUid: actorUid,
        version: 1,
      });

      itemsMap.set(itemId, record);
      emitAll();
      return structuredClone(record);
    },

    async updateGalleryItemTransaction({ itemId, actorUid, expectedVersion, patch }) {
      consumeQueuedWriteError();

      const current = itemsMap.get(itemId);
      if (!current) {
        throw createGalleryRepositoryError(
          'gallery/not-found',
          'Data foto galeri tidak ditemukan.',
        );
      }

      if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
        throw createGalleryRepositoryError(
          'gallery/stale-version',
          `Foto ini telah diperbarui di sesi lain (versi saat ini v${current.version}). Muat data terbaru sebelum menyimpan ulang.`,
          { currentVersion: current.version, expectedVersion },
        );
      }

      const nowIso = new Date().toISOString();
      const updated = normalizeGalleryItem(itemId, {
        ...current,
        title: patch.title !== undefined ? patch.title : current.title,
        category: patch.category !== undefined ? patch.category : current.category,
        altText: patch.altText !== undefined ? patch.altText : current.altText,
        caption: patch.caption !== undefined ? patch.caption : current.caption,
        status: patch.status !== undefined ? patch.status : current.status,
        sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : current.sortOrder,
        updatedAt: nowIso,
        updatedByUid: actorUid,
        version: current.version + 1,
      });

      itemsMap.set(itemId, updated);
      emitAll();
      return structuredClone(updated);
    },

    async swapGallerySortOrderTransaction({
      firstItemId,
      firstExpectedVersion,
      secondItemId,
      secondExpectedVersion,
      actorUid,
    }) {
      consumeQueuedWriteError();

      const first = itemsMap.get(firstItemId);
      const second = itemsMap.get(secondItemId);
      if (!first || !second) {
        throw createGalleryRepositoryError(
          'gallery/not-found',
          'Salah satu foto yang ingin diurutkan tidak ditemukan.',
        );
      }

      if (
        (Number.isInteger(firstExpectedVersion) && first.version !== firstExpectedVersion) ||
        (Number.isInteger(secondExpectedVersion) && second.version !== secondExpectedVersion)
      ) {
        throw createGalleryRepositoryError(
          'gallery/stale-version',
          'Urutan galeri telah berubah di sesi lain. Silakan coba lagi.',
        );
      }

      if (
        first.status !== GALLERY_STATUSES.PUBLISHED ||
        second.status !== GALLERY_STATUSES.PUBLISHED
      ) {
        throw createGalleryRepositoryError(
          'gallery/reorder-requires-published',
          'Hanya foto dengan status Published yang dapat diubah urutan tampilnya.',
        );
      }

      let nextFirstOrder = second.sortOrder;
      let nextSecondOrder = first.sortOrder;
      if (nextFirstOrder === nextSecondOrder) {
        nextFirstOrder = Math.max(0, nextSecondOrder);
        nextSecondOrder = nextFirstOrder + GALLERY_DEFAULT_SORT_STEP;
      }

      const nowIso = new Date().toISOString();
      const updatedFirst = normalizeGalleryItem(firstItemId, {
        ...first,
        sortOrder: nextFirstOrder,
        updatedAt: nowIso,
        updatedByUid: actorUid,
        version: first.version + 1,
      });
      const updatedSecond = normalizeGalleryItem(secondItemId, {
        ...second,
        sortOrder: nextSecondOrder,
        updatedAt: nowIso,
        updatedByUid: actorUid,
        version: second.version + 1,
      });

      itemsMap.set(firstItemId, updatedFirst);
      itemsMap.set(secondItemId, updatedSecond);
      emitAll();

      return {
        first: structuredClone(updatedFirst),
        second: structuredClone(updatedSecond),
      };
    },

    _seedItems(list) {
      seed(list);
      emitAll();
    },

    _getItems() {
      return sortAdminGalleryItems(Array.from(itemsMap.values())).map((item) =>
        structuredClone(item),
      );
    },

    _getItemById(id) {
      const found = itemsMap.get(id);
      return found ? structuredClone(found) : null;
    },

    _setNextWriteError(err) {
      nextWriteError = err;
    },

    _triggerPublicError(err) {
      publicListeners.forEach((entry) => {
        entry.onError?.(err);
      });
    },
  };
}

let activeGalleryAdapter = createFirestoreGalleryRepositoryAdapter();

export function getGalleryRepositoryAdapter() {
  return activeGalleryAdapter;
}

export function setGalleryRepositoryAdapter(customAdapter) {
  activeGalleryAdapter = customAdapter || createFirestoreGalleryRepositoryAdapter();
}

export function resetGalleryRepositoryAdapter() {
  activeGalleryAdapter = createFirestoreGalleryRepositoryAdapter();
}
