/**
 * Public Availability Repository Adapter (Cloud Firestore + Shared In-Memory Test/QA Adapter)
 * for 37 Music Studio (`/availability`).
 *
 * Strictly accesses ONLY sanitized public collections (`publicAvailability` and
 * `publicAvailabilityMetadata/status`) for public visitors, and supports bounded
 * Owner-only backfill reads/writes via authenticated Firebase client SDK.
 */

import {
  FIRESTORE_COLLECTIONS,
  normalizeBookingRecord,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  PUBLIC_AVAILABILITY_METADATA_DOC_ID,
  PUBLIC_AVAILABILITY_QUERY_LIMIT,
  PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
  PUBLIC_BACKFILL_PAGE_SIZE,
} from '../config/public-availability-config';
import {
  hasOnlySanitizedPublicAvailabilityKeys,
  normalizePublicAvailabilityMetadata,
  normalizePublicAvailabilityRecord,
} from '../utils/public-availability-calculation';

function stripIdField(projection = {}) {
  const {
    schemaVersion = 1,
    date = '',
    studioId = '',
    startMinute = 600,
    endMinute = 630,
    updatedAt = null,
  } = projection || {};
  return {
    schemaVersion,
    date,
    studioId,
    startMinute,
    endMinute,
    updatedAt,
  };
}

/**
 * Default Cloud Firestore Public Availability Repository Adapter.
 * Uses single-field range queries on `date` (`where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'asc')`)
 * requiring zero custom composite indexes.
 */
export function createFirestorePublicAvailabilityRepositoryAdapter() {
  return {
    subscribePublicAvailabilityInRange({
      startDate,
      endDate,
      maxLimit = PUBLIC_AVAILABILITY_QUERY_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!startDate || !endDate) {
        onData?.({
          projections: [],
          isTruncated: false,
          maxLimit,
        });
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const colRef = collection(db, FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY);
          const q = query(
            colRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc'),
            limit(maxLimit + 1),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const isTruncated = snapshot.docs.length > maxLimit;
              const docs = isTruncated ? snapshot.docs.slice(0, maxLimit) : snapshot.docs;
              const projections = docs
                .map((docSnap) => normalizePublicAvailabilityRecord(docSnap.id, docSnap.data()))
                .filter(Boolean)
                .sort((a, b) => {
                  if (a.date !== b.date) return a.date.localeCompare(b.date);
                  if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
                  return a.studioId.localeCompare(b.studioId);
                });

              onData?.({
                projections,
                isTruncated,
                maxLimit,
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

    subscribePublicAvailabilityMetadata({ onData, onError }) {
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
          const docRef = doc(
            db,
            FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY_METADATA,
            PUBLIC_AVAILABILITY_METADATA_DOC_ID,
          );

          unsubscribe = onSnapshot(
            docRef,
            (snap) => {
              if (isCancelled) return;
              onData?.(
                snap.exists()
                  ? normalizePublicAvailabilityMetadata(snap.data())
                  : normalizePublicAvailabilityMetadata(null),
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

    async getPublicAvailabilityMetadata() {
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(
        doc(
          db,
          FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY_METADATA,
          PUBLIC_AVAILABILITY_METADATA_DOC_ID,
        ),
      );
      return snap.exists()
        ? normalizePublicAvailabilityMetadata(snap.data())
        : normalizePublicAvailabilityMetadata(null);
    },

    async setPublicAvailabilityMetadata({ isReady, backfilledFromDate = '' }) {
      const [{ doc, serverTimestamp, setDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const now = serverTimestamp();
      const payload = {
        schemaVersion: 1,
        isReady: Boolean(isReady),
        backfilledFromDate: String(backfilledFromDate || '').trim(),
        backfillCompletedAt: isReady ? now : null,
        updatedAt: now,
      };
      await setDoc(
        doc(
          db,
          FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY_METADATA,
          PUBLIC_AVAILABILITY_METADATA_DOC_ID,
        ),
        payload,
      );
      return normalizePublicAvailabilityMetadata({
        ...payload,
        backfillCompletedAt: isReady ? { seconds: Math.floor(Date.now() / 1000) } : null,
        updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      });
    },

    async listCanonicalBookingsForBackfillPage({
      fromDateIso,
      pageSize = PUBLIC_BACKFILL_PAGE_SIZE,
      cursorDoc = null,
    }) {
      const [{ collection, getDocs, limit, orderBy, query, startAfter, where }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const bookingsRef = collection(db, FIRESTORE_COLLECTIONS.BOOKINGS);

      const constraints = [
        where('date', '>=', fromDateIso),
        orderBy('date', 'asc'),
        ...(cursorDoc ? [startAfter(cursorDoc)] : []),
        limit(pageSize + 1),
      ];

      const snap = await getDocs(query(bookingsRef, ...constraints));
      const hasMore = snap.docs.length > pageSize;
      const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
      const bookings = pageDocs.map((d) => normalizeBookingRecord(d.id, d.data()));
      const nextCursor = hasMore ? pageDocs[pageDocs.length - 1] : null;

      return {
        bookings,
        hasMore,
        nextCursor,
      };
    },

    async writePublicAvailabilityBatch({
      upserts = [],
      deleteIds = [],
      batchLimit = PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
    }) {
      const [{ doc, serverTimestamp, writeBatch }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      const operations = [
        ...upserts.map((u) => ({
          type: 'upsert',
          bookingId: u.bookingId,
          projection: u.projection,
        })),
        ...deleteIds.map((id) => ({ type: 'delete', bookingId: id })),
      ];

      const safeChunkSize = Math.max(1, Math.min(batchLimit, PUBLIC_BACKFILL_BATCH_WRITE_LIMIT));
      for (let i = 0; i < operations.length; i += safeChunkSize) {
        const chunk = operations.slice(i, i + safeChunkSize);
        const batch = writeBatch(db);
        const now = serverTimestamp();

        for (const op of chunk) {
          const ref = doc(db, FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY, op.bookingId);
          if (op.type === 'upsert') {
            const cleanPayload = {
              schemaVersion: 1,
              date: op.projection.date,
              studioId: op.projection.studioId,
              startMinute: op.projection.startMinute,
              endMinute: op.projection.endMinute,
              updatedAt: now,
            };
            batch.set(ref, cleanPayload);
          } else {
            batch.delete(ref);
          }
        }

        await batch.commit();
      }
    },

    async getPublicAvailabilityProjectionsByIds(bookingIds = []) {
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const map = new Map();

      const snaps = await Promise.all(
        (bookingIds || [])
          .filter(Boolean)
          .map((id) => getDoc(doc(db, FIRESTORE_COLLECTIONS.PUBLIC_AVAILABILITY, id))),
      );

      for (const snap of snaps) {
        if (snap.exists()) {
          const raw = snap.data();
          const norm = normalizePublicAvailabilityRecord(snap.id, raw);
          if (norm) {
            map.set(snap.id, {
              ...norm,
              _rawKeys: Object.keys(raw || {}),
            });
          }
        }
      }

      return map;
    },
  };
}

/**
 * In-Memory Public Availability Repository Adapter for deterministic testing.
 * Can optionally attach to a `createInMemoryBookingRepositoryAdapter()._sharedStore`
 * so booking transactions and public availability reads share the exact same store.
 */
export function createInMemoryPublicAvailabilityRepositoryAdapter({
  initialProjections = [],
  initialMetadata = { isReady: true, backfilledFromDate: '2026-01-01' },
  sharedStore = null,
  forceTruncated = false,
} = {}) {
  const projectionsMap = sharedStore?.publicAvailability || new Map();
  const metadataMap = sharedStore?.publicAvailabilityMetadata || new Map();
  const canonicalBookingsMap = sharedStore?.bookings || new Map();
  const subscribers = sharedStore?.publicAvailabilitySubscribers || new Set();
  const metadataSubscribers = sharedStore?.publicAvailabilityMetadataSubscribers || new Set();

  let simulatedError = null;
  let simulatedWriteFailureOnChunk = -1;
  let chunkCounter = 0;

  for (const item of initialProjections || []) {
    const id = item.id || item.bookingId || `pub_${projectionsMap.size + 1}`;
    const norm = normalizePublicAvailabilityRecord(id, item);
    if (norm) {
      projectionsMap.set(id, {
        id,
        ...stripIdField(norm),
      });
    }
  }

  if (initialMetadata !== null) {
    const normMeta = normalizePublicAvailabilityMetadata(initialMetadata);
    metadataMap.set(PUBLIC_AVAILABILITY_METADATA_DOC_ID, {
      schemaVersion: 1,
      isReady: normMeta.isReady,
      backfilledFromDate: normMeta.backfilledFromDate,
      backfillCompletedAt: normMeta.isReady
        ? normMeta.backfillCompletedAt || { seconds: Math.floor(Date.now() / 1000) }
        : null,
      updatedAt: normMeta.updatedAt || { seconds: Math.floor(Date.now() / 1000) },
    });
  }

  function emitProjections() {
    for (const sub of subscribers) {
      if (simulatedError) {
        sub.onError?.(simulatedError);
        continue;
      }
      const matching = Array.from(projectionsMap.values())
        .filter((p) => p.date >= sub.startDate && p.date <= sub.endDate)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
          return a.studioId.localeCompare(b.studioId);
        });

      const isTruncated = Boolean(forceTruncated || matching.length > sub.maxLimit);
      const limited = matching.slice(0, sub.maxLimit);
      sub.onData?.({
        projections: limited.map((p) => ({ ...p })),
        isTruncated,
        maxLimit: sub.maxLimit,
      });
    }
  }

  function emitMetadata() {
    const raw = metadataMap.get(PUBLIC_AVAILABILITY_METADATA_DOC_ID) || null;
    const norm = normalizePublicAvailabilityMetadata(raw);
    for (const cb of metadataSubscribers) {
      cb?.(norm);
    }
  }

  return {
    _inspectProjections() {
      return new Map(projectionsMap);
    },

    _inspectRawProjection(bookingId) {
      const item = projectionsMap.get(bookingId);
      if (!item) return null;
      return stripIdField(item);
    },

    _setSimulatedError(err) {
      simulatedError = err;
      emitProjections();
    },

    _setFailOnWriteChunk(chunkIndex) {
      simulatedWriteFailureOnChunk = chunkIndex;
      chunkCounter = 0;
    },

    subscribePublicAvailabilityInRange({
      startDate,
      endDate,
      maxLimit = PUBLIC_AVAILABILITY_QUERY_LIMIT,
      onData,
      onError,
    }) {
      if (!startDate || !endDate) {
        onData?.({ projections: [], isTruncated: false, maxLimit });
        return () => {};
      }
      const sub = { startDate, endDate, maxLimit, onData, onError };
      subscribers.add(sub);
      emitProjections();
      return () => {
        subscribers.delete(sub);
      };
    },

    subscribePublicAvailabilityMetadata({ onData, onError }) {
      if (simulatedError) {
        onError?.(simulatedError);
        return () => {};
      }
      metadataSubscribers.add(onData);
      emitMetadata();
      return () => {
        metadataSubscribers.delete(onData);
      };
    },

    async getPublicAvailabilityMetadata() {
      const raw = metadataMap.get(PUBLIC_AVAILABILITY_METADATA_DOC_ID) || null;
      return normalizePublicAvailabilityMetadata(raw);
    },

    async setPublicAvailabilityMetadata({ isReady, backfilledFromDate = '' }) {
      const now = { seconds: Math.floor(Date.now() / 1000) };
      const payload = {
        schemaVersion: 1,
        isReady: Boolean(isReady),
        backfilledFromDate: String(backfilledFromDate || '').trim(),
        backfillCompletedAt: isReady ? now : null,
        updatedAt: now,
      };
      metadataMap.set(PUBLIC_AVAILABILITY_METADATA_DOC_ID, payload);
      emitMetadata();
      return normalizePublicAvailabilityMetadata(payload);
    },

    async listCanonicalBookingsForBackfillPage({
      fromDateIso,
      pageSize = PUBLIC_BACKFILL_PAGE_SIZE,
      cursorDoc = null,
    }) {
      const allMatching = Array.from(canonicalBookingsMap.values())
        .filter((b) => b.date >= fromDateIso)
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return String(a.id).localeCompare(String(b.id));
        });

      let startIndex = 0;
      if (typeof cursorDoc === 'number') {
        startIndex = cursorDoc;
      }

      const slice = allMatching.slice(startIndex, startIndex + pageSize + 1);
      const hasMore = slice.length > pageSize;
      const bookings = hasMore ? slice.slice(0, pageSize) : slice;
      const nextCursor = hasMore ? startIndex + pageSize : null;

      return {
        bookings,
        hasMore,
        nextCursor,
      };
    },

    async writePublicAvailabilityBatch({
      upserts = [],
      deleteIds = [],
      batchLimit = PUBLIC_BACKFILL_BATCH_WRITE_LIMIT,
    }) {
      const operations = [
        ...upserts.map((u) => ({
          type: 'upsert',
          bookingId: u.bookingId,
          projection: u.projection,
        })),
        ...deleteIds.map((id) => ({ type: 'delete', bookingId: id })),
      ];

      const safeChunkSize = Math.max(1, Math.min(batchLimit, PUBLIC_BACKFILL_BATCH_WRITE_LIMIT));
      for (let i = 0; i < operations.length; i += safeChunkSize) {
        if (simulatedWriteFailureOnChunk >= 0 && chunkCounter === simulatedWriteFailureOnChunk) {
          chunkCounter += 1;
          throw new Error('Simulated batch write failure during public availability backfill.');
        }
        chunkCounter += 1;

        const chunk = operations.slice(i, i + safeChunkSize);
        const now = { seconds: Math.floor(Date.now() / 1000) };

        for (const op of chunk) {
          if (op.type === 'upsert') {
            const cleanPayload = {
              schemaVersion: 1,
              date: op.projection.date,
              studioId: op.projection.studioId,
              startMinute: op.projection.startMinute,
              endMinute: op.projection.endMinute,
              updatedAt: now,
            };
            if (!hasOnlySanitizedPublicAvailabilityKeys(cleanPayload)) {
              throw new Error('Invalid publicAvailability schema keys.');
            }
            projectionsMap.set(op.bookingId, {
              id: op.bookingId,
              ...cleanPayload,
            });
          } else {
            projectionsMap.delete(op.bookingId);
          }
        }
      }

      emitProjections();
    },

    async getPublicAvailabilityProjectionsByIds(bookingIds = []) {
      const result = new Map();
      for (const id of bookingIds || []) {
        const stored = projectionsMap.get(id);
        if (stored) {
          const raw = stripIdField(stored);
          result.set(id, {
            ...stored,
            _rawKeys: Object.keys(raw),
          });
        }
      }
      return result;
    },
  };
}

let activePublicAvailabilityAdapter = createFirestorePublicAvailabilityRepositoryAdapter();

export function getPublicAvailabilityRepositoryAdapter() {
  return activePublicAvailabilityAdapter;
}

export function setPublicAvailabilityRepositoryAdapter(customAdapter) {
  activePublicAvailabilityAdapter =
    customAdapter || createFirestorePublicAvailabilityRepositoryAdapter();
}

export function resetPublicAvailabilityRepositoryAdapter() {
  activePublicAvailabilityAdapter = createFirestorePublicAvailabilityRepositoryAdapter();
}
