import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { ensureAppCheckTokenForPublicWrite } from '@/lib/firebase/app-check';

import {
  BOOKING_REQUEST_ACTIVITIES_SUBCOLLECTION,
  BOOKING_REQUEST_COMMUNICATIONS_SUBCOLLECTION,
  BOOKING_REQUEST_INBOX_PAGE_SIZE,
  BOOKING_REQUEST_NEW_BADGE_LIMIT,
  BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TIMELINE_LIMIT,
  PUBLIC_BOOKING_REQUESTS_COLLECTION,
} from '../config/booking-request-config';
import {
  normalizeOfferRecord,
  projectClientOfferRecord,
} from '../schemas/offer-schema';
import {
  normalizeActivityEvent,
  normalizeBookingRequestRecord,
  normalizeCommunicationEvent,
} from '../utils/booking-request-normalize';

export function createBookingRequestRepositoryError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

/**
 * Cloud Firestore repository adapter for incoming public booking requests,
 * immutable activity logs, and immutable WhatsApp communication events.
 * Uses single-field queries only (zero extra composite indexes required).
 */
export function createFirestoreBookingRequestRepositoryAdapter() {
  return {
    async createPublicBookingRequest({ requestId, payload }) {
      const appCheckResult = await ensureAppCheckTokenForPublicWrite();
      const [{ doc, serverTimestamp, setDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);

      const db = getFirebaseDb();
      const requestRef = doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, requestId);
      const writeDoc = {
        ...payload,
        appCheckState: appCheckResult?.state || 'unconfigured',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(requestRef, writeDoc);
      const nowIso = new Date().toISOString();
      return normalizeBookingRequestRecord(requestId, {
        ...writeDoc,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    },

    async getBookingRequestById(requestId) {
      if (!requestId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, requestId));
      return snap.exists() ? normalizeBookingRequestRecord(snap.id, snap.data()) : null;
    },

    subscribeNewBookingRequests({ maxLimit = BOOKING_REQUEST_NEW_BADGE_LIMIT, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const fetchLimit = maxLimit + 1;
          const q = query(
            collection(db, PUBLIC_BOOKING_REQUESTS_COLLECTION),
            where('status', '==', BOOKING_REQUEST_STATUS.NEW),
            limit(fetchLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const allDocs = snapshot.docs
                .map((d) => normalizeBookingRequestRecord(d.id, d.data()))
                .filter(Boolean)
                .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
              const hasMore = allDocs.length > maxLimit;
              onData?.({
                requests: hasMore ? allDocs.slice(0, maxLimit) : allDocs,
                hasMore,
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

    subscribeBookingRequests({ maxLimit = BOOKING_REQUEST_INBOX_PAGE_SIZE, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const fetchLimit = maxLimit + 1;
          const q = query(
            collection(db, PUBLIC_BOOKING_REQUESTS_COLLECTION),
            orderBy('createdAt', 'desc'),
            limit(fetchLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = snapshot.docs;
              const hasMore = docs.length > maxLimit;
              const visibleDocs = hasMore ? docs.slice(0, maxLimit) : docs;
              const requests = visibleDocs
                .map((d) => normalizeBookingRequestRecord(d.id, d.data()))
                .filter(Boolean);

              onData?.({
                requests,
                hasMore,
                isTruncated: hasMore,
                lastCursor: visibleDocs[visibleDocs.length - 1] || null,
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

    subscribeClientBookingRequests({ clientUid, maxLimit = 100, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      const cleanClientUid = String(clientUid || '').trim();
      if (!cleanClientUid) {
        onData?.({
          requests: [],
          hasMore: false,
          isTruncated: false,
          maxLimit,
        });
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            onError?.(new Error('Firestore realtime listener unavailable.'));
            return;
          }

          const db = getFirebaseDb();
          const fetchLimit = maxLimit + 1;
          const q = query(
            collection(db, PUBLIC_BOOKING_REQUESTS_COLLECTION),
            where('source', '==', BOOKING_REQUEST_SOURCES.CLIENT_PORTAL),
            where('clientUid', '==', cleanClientUid),
            limit(fetchLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
              const allDocs = docs
                .map((d) => normalizeBookingRequestRecord(d.id, d.data()))
                .filter(Boolean)
                .sort((a, b) => {
                  const diff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
                  if (diff !== 0) return diff;
                  return String(b.id).localeCompare(String(a.id));
                });
              const hasMore = allDocs.length > maxLimit;
              onData?.({
                requests: hasMore ? allDocs.slice(0, maxLimit) : allDocs,
                hasMore,
                isTruncated: hasMore,
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

    async fetchMoreBookingRequests({ cursor, pageSize = BOOKING_REQUEST_INBOX_PAGE_SIZE }) {
      if (!cursor) {
        return { requests: [], hasMore: false, lastCursor: null };
      }
      const [{ collection, getDocs, limit, orderBy, query, startAfter }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);

      const db = getFirebaseDb();
      const q = query(
        collection(db, PUBLIC_BOOKING_REQUESTS_COLLECTION),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(pageSize + 1),
      );
      const snapshot = await getDocs(q);
      const hasMore = snapshot.docs.length > pageSize;
      const visibleDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
      return {
        requests: visibleDocs
          .map((d) => normalizeBookingRequestRecord(d.id, d.data()))
          .filter(Boolean),
        hasMore,
        lastCursor: visibleDocs[visibleDocs.length - 1] || null,
      };
    },

    subscribeBookingRequestById({ requestId, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!requestId) {
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
            doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, requestId),
            (snap) => {
              if (isCancelled) return;
              onData?.(snap.exists() ? normalizeBookingRequestRecord(snap.id, snap.data()) : null);
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

    subscribeRequestCommunications({
      requestId,
      maxLimit = BOOKING_REQUEST_TIMELINE_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!requestId) {
        onData?.([]);
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              requestId,
              BOOKING_REQUEST_COMMUNICATIONS_SUBCOLLECTION,
            ),
            orderBy('createdAt', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              onData?.(snapshot.docs.map((d) => normalizeCommunicationEvent(d.id, d.data())));
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

    subscribeRequestActivities({
      requestId,
      maxLimit = BOOKING_REQUEST_TIMELINE_LIMIT,
      onData,
      onError,
    }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!requestId) {
        onData?.([]);
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              requestId,
              BOOKING_REQUEST_ACTIVITIES_SUBCOLLECTION,
            ),
            orderBy('createdAt', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              onData?.(snapshot.docs.map((d) => normalizeActivityEvent(d.id, d.data())));
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

    async runWorkflowUpdateTransaction({
      requestId,
      expectedVersion,
      actorUid,
      activityId,
      buildNextState,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const requestRef = doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, requestId);
      const activityRef = doc(
        db,
        PUBLIC_BOOKING_REQUESTS_COLLECTION,
        requestId,
        BOOKING_REQUEST_ACTIVITIES_SUBCOLLECTION,
        activityId,
      );

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists()) {
          throw createBookingRequestRepositoryError(
            'booking-request/not-found',
            'Data booking request tidak ditemukan.',
          );
        }

        const rawCurrent = snap.data();
        const current = normalizeBookingRequestRecord(snap.id, rawCurrent);

        if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
          throw createBookingRequestRepositoryError(
            'booking-request/stale-update',
            `Request ini telah diperbarui di sesi lain (versi saat ini v${current.version}). Muat ulang detail sebelum menyimpan.`,
            { currentVersion: current.version, expectedVersion },
          );
        }

        const { parentPatch, activityDoc } = buildNextState({
          current,
          rawCurrent,
          timestampValue: serverTimestamp(),
        });

        const nextRawDoc = {
          ...rawCurrent,
          ...parentPatch,
          updatedAt: serverTimestamp(),
          updatedByUid: actorUid,
          version: current.version + 1,
        };

        tx.update(requestRef, nextRawDoc);
        if (activityDoc) {
          tx.set(activityRef, {
            ...activityDoc,
            createdAt: serverTimestamp(),
          });
        }

        return normalizeBookingRequestRecord(requestId, {
          ...nextRawDoc,
          updatedAt: new Date(),
        });
      });
    },

    async recordCommunicationTransaction({
      requestId,
      expectedVersion,
      actorUid,
      communicationId,
      communicationDoc,
      parentCommunicationPatch,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const requestRef = doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, requestId);
      const commRef = doc(
        db,
        PUBLIC_BOOKING_REQUESTS_COLLECTION,
        requestId,
        BOOKING_REQUEST_COMMUNICATIONS_SUBCOLLECTION,
        communicationId,
      );

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists()) {
          throw createBookingRequestRepositoryError(
            'booking-request/not-found',
            'Data booking request tidak ditemukan.',
          );
        }

        const rawCurrent = snap.data();
        const current = normalizeBookingRequestRecord(snap.id, rawCurrent);

        if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
          throw createBookingRequestRepositoryError(
            'booking-request/stale-update',
            `Request ini baru saja diperbarui di sesi lain (v${current.version}). Muat ulang sebelum mencatat komunikasi.`,
            { currentVersion: current.version, expectedVersion },
          );
        }

        const ts = serverTimestamp();
        const resolvedComm = {
          ...communicationDoc,
          preparedAt: communicationDoc.preparedAt ? ts : null,
          manuallyMarkedSentAt: communicationDoc.manuallyMarkedSentAt ? ts : null,
          createdAt: ts,
        };
        const parentUpdate = {
          ...parentCommunicationPatch,
          lastCommunicationAt: ts,
          updatedAt: ts,
          updatedByUid: actorUid,
          version: current.version + 1,
        };

        tx.set(commRef, resolvedComm);
        tx.update(requestRef, parentUpdate);

        return {
          request: normalizeBookingRequestRecord(requestId, {
            ...rawCurrent,
            ...parentUpdate,
            lastCommunicationAt: new Date(),
            updatedAt: new Date(),
          }),
          communication: normalizeCommunicationEvent(communicationId, {
            ...communicationDoc,
            preparedAt: communicationDoc.preparedAt ? new Date() : null,
            manuallyMarkedSentAt: communicationDoc.manuallyMarkedSentAt ? new Date() : null,
            createdAt: new Date(),
          }),
        };
      });
    },

    async getOfferById(requestId, offerId) {
      if (!requestId || !offerId) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(
        doc(
          db,
          PUBLIC_BOOKING_REQUESTS_COLLECTION,
          requestId,
          BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
          offerId,
        ),
      );
      return snap.exists() ? normalizeOfferRecord(snap.id, snap.data()) : null;
    },

    async listOffersByRequestId(requestId, { maxLimit = 50, clientSafe = false } = {}) {
      if (!requestId) return [];
      const [{ collection, getDocs, limit, orderBy, query }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();
      const q = query(
        collection(
          db,
          PUBLIC_BOOKING_REQUESTS_COLLECTION,
          requestId,
          BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
        ),
        orderBy('revisionNumber', 'desc'),
        limit(maxLimit),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => {
          const norm = normalizeOfferRecord(d.id, d.data());
          return clientSafe ? projectClientOfferRecord(norm) : norm;
        })
        .filter(Boolean);
    },

    subscribeRequestOffers({ requestId, clientSafe = false, maxLimit = 50, onData, onError }) {
      let unsubscribe = null;
      let isCancelled = false;

      if (!requestId) {
        onData?.([]);
        return () => {};
      }

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;

          const db = getFirebaseDb();
          const q = query(
            collection(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              requestId,
              BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
            ),
            orderBy('revisionNumber', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const items = snapshot.docs
                .map((d) => {
                  const norm = normalizeOfferRecord(d.id, d.data());
                  return clientSafe ? projectClientOfferRecord(norm) : norm;
                })
                .filter(Boolean);
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

    async runOfferTransaction({ requestId, txWork }) {
      const [{ doc, runTransaction, serverTimestamp, Timestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const txContext = {
          nowValue: () => serverTimestamp(),
          timestampFromDate: (date) => Timestamp.fromDate(date instanceof Date ? date : new Date(date)),
          async getRequest(targetReqId = requestId) {
            const ref = doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, targetReqId);
            const snap = await tx.get(ref);
            return snap.exists()
              ? {
                  ...normalizeBookingRequestRecord(snap.id, snap.data()),
                  _raw: snap.data(),
                }
              : null;
          },
          async getOffer(offerId, targetReqId = requestId) {
            if (!offerId) return null;
            const ref = doc(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              targetReqId,
              BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
              offerId,
            );
            const snap = await tx.get(ref);
            return snap.exists()
              ? { ...normalizeOfferRecord(snap.id, snap.data()), _raw: snap.data() }
              : null;
          },
          updateRequest(data, targetReqId = requestId) {
            const ref = doc(db, PUBLIC_BOOKING_REQUESTS_COLLECTION, targetReqId);
            tx.update(ref, data);
          },
          setOffer(offerId, data, targetReqId = requestId) {
            const ref = doc(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              targetReqId,
              BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
              offerId,
            );
            tx.set(ref, data);
          },
          updateOffer(offerId, data, targetReqId = requestId) {
            const ref = doc(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              targetReqId,
              BOOKING_REQUEST_OFFERS_SUBCOLLECTION,
              offerId,
            );
            tx.update(ref, data);
          },
          setActivity(activityId, data, targetReqId = requestId) {
            const ref = doc(
              db,
              PUBLIC_BOOKING_REQUESTS_COLLECTION,
              targetReqId,
              BOOKING_REQUEST_ACTIVITIES_SUBCOLLECTION,
              activityId,
            );
            tx.set(ref, data);
          },
        };

        return txWork(txContext);
      });
    },
  };
}

/**
 * Deterministic in-memory adapter for unit/integration tests.
 * Can optionally attach to a Calendar `memoryAdapter._sharedStore` so atomic `createBooking`
 * confirmation updates are reflected immediately across Inbox & Detail Drawer listeners.
 */
export function createInMemoryBookingRequestRepositoryAdapter(
  bookingMemoryAdapter = null,
  initialRequests = [],
) {
  const shared = bookingMemoryAdapter?._sharedStore || null;
  const requests = shared?.bookingRequests || new Map();
  const activities = shared?.bookingRequestActivities || new Map();
  const communications = shared?.bookingRequestCommunications || new Map();
  const offers = shared?.bookingRequestOffers || new Map();
  const newSubscribers = shared?.bookingRequestNewSubscribers || new Set();
  const listSubscribers = shared?.bookingRequestListSubscribers || new Set();
  const docSubscribers = shared?.bookingRequestDocSubscribers || new Map();
  const clientSubscribers = shared?.bookingRequestClientSubscribers || new Set();
  const activitySubscribers = shared?.bookingRequestActivitySubscribers || new Map();
  const commSubscribers = shared?.bookingRequestCommSubscribers || new Map();
  const offerSubscribers = shared?.bookingRequestOfferSubscribers || new Map();

  let queuedCreateError = null;
  let queuedUpdateError = null;
  let queuedClientSubscribeError = null;

  for (const seed of initialRequests || []) {
    const norm = normalizeBookingRequestRecord(seed.id, seed);
    if (norm?.id) {
      requests.set(norm.id, norm);
    }
  }

  function sortedRequests() {
    return Array.from(requests.values()).sort((a, b) => {
      const diff = getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      if (diff !== 0) return diff;
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function notifyAll(targetRequestId = '') {
    if (targetRequestId) {
      const targetOffers = Array.from(offers.values())
        .filter((o) => o.requestId === targetRequestId)
        .sort((a, b) => (Number(b.revisionNumber) || 1) - (Number(a.revisionNumber) || 1));
      offerSubscribers.get(targetRequestId)?.forEach((sub) => {
        const list = sub.clientSafe
          ? targetOffers.map((o) => projectClientOfferRecord(o)).filter(Boolean)
          : targetOffers.map((o) => ({ ...o }));
        sub.onData?.(list);
      });
    }

    if (shared?.notifyBookingRequests) {
      shared.notifyBookingRequests(targetRequestId);
      return;
    }

    const allSorted = sortedRequests();
    const newOnly = allSorted.filter((r) => r.status === BOOKING_REQUEST_STATUS.NEW);

    for (const sub of newSubscribers) {
      const hasMore = newOnly.length > sub.maxLimit;
      sub.onData?.({
        requests: hasMore ? newOnly.slice(0, sub.maxLimit) : newOnly,
        hasMore,
        maxLimit: sub.maxLimit,
      });
    }

    for (const sub of listSubscribers) {
      const hasMore = allSorted.length > sub.maxLimit;
      const visible = hasMore ? allSorted.slice(0, sub.maxLimit) : allSorted;
      sub.onData?.({
        requests: visible,
        hasMore,
        isTruncated: hasMore,
        lastCursor: visible.length > 0 ? visible[visible.length - 1].id : null,
        maxLimit: sub.maxLimit,
      });
    }

    for (const sub of clientSubscribers) {
      const ownOnly = allSorted.filter(
        (r) => r.source === BOOKING_REQUEST_SOURCES.CLIENT_PORTAL && r.clientUid === sub.clientUid,
      );
      const hasMore = ownOnly.length > sub.maxLimit;
      sub.onData?.({
        requests: hasMore ? ownOnly.slice(0, sub.maxLimit) : ownOnly,
        hasMore,
        isTruncated: hasMore,
        maxLimit: sub.maxLimit,
      });
    }

    if (targetRequestId) {
      const targetDoc = requests.get(targetRequestId) || null;
      docSubscribers.get(targetRequestId)?.forEach((cb) => cb(targetDoc ? { ...targetDoc } : null));

      const acts = Array.from(activities.values())
        .filter((a) => a.requestId === targetRequestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      activitySubscribers.get(targetRequestId)?.forEach((cb) => cb([...acts]));

      const comms = Array.from(communications.values())
        .filter((c) => c.requestId === targetRequestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
      commSubscribers.get(targetRequestId)?.forEach((cb) => cb([...comms]));
    }
  }

  return {
    async createPublicBookingRequest({ requestId, payload }) {
      if (queuedCreateError) {
        const err = queuedCreateError;
        queuedCreateError = null;
        throw err;
      }

      const nowIso = new Date().toISOString();
      const record = normalizeBookingRequestRecord(requestId, {
        ...payload,
        appCheckState: 'unconfigured',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      requests.set(requestId, record);
      notifyAll(requestId);
      return { ...record };
    },

    async getBookingRequestById(requestId) {
      const found = requests.get(requestId);
      return found ? { ...found } : null;
    },

    subscribeNewBookingRequests({ maxLimit = BOOKING_REQUEST_NEW_BADGE_LIMIT, onData, onError }) {
      const sub = { maxLimit, onData, onError };
      newSubscribers.add(sub);
      const filtered = sortedRequests().filter((r) => r.status === BOOKING_REQUEST_STATUS.NEW);
      const hasMore = filtered.length > maxLimit;
      onData?.({
        requests: hasMore ? filtered.slice(0, maxLimit) : filtered,
        hasMore,
        maxLimit,
      });
      return () => {
        newSubscribers.delete(sub);
      };
    },

    subscribeBookingRequests({ maxLimit = BOOKING_REQUEST_INBOX_PAGE_SIZE, onData, onError }) {
      const sub = { maxLimit, onData, onError };
      listSubscribers.add(sub);
      const allSorted = sortedRequests();
      const hasMore = allSorted.length > maxLimit;
      const visible = hasMore ? allSorted.slice(0, maxLimit) : allSorted;
      onData?.({
        requests: visible,
        hasMore,
        isTruncated: hasMore,
        lastCursor: visible.length > 0 ? visible[visible.length - 1].id : null,
        maxLimit,
      });
      return () => {
        listSubscribers.delete(sub);
      };
    },

    subscribeClientBookingRequests({ clientUid, maxLimit = 100, onData, onError }) {
      const cleanClientUid = String(clientUid || '').trim();
      if (queuedClientSubscribeError) {
        const err = queuedClientSubscribeError;
        queuedClientSubscribeError = null;
        let cancelled = false;
        queueMicrotask(() => {
          if (!cancelled) onError?.(err);
        });
        return () => {
          cancelled = true;
        };
      }

      if (!cleanClientUid) {
        onData?.({
          requests: [],
          hasMore: false,
          isTruncated: false,
          maxLimit,
        });
        return () => {};
      }

      const sub = { clientUid: cleanClientUid, maxLimit, onData, onError };
      clientSubscribers.add(sub);
      const ownOnly = sortedRequests().filter(
        (r) => r.source === BOOKING_REQUEST_SOURCES.CLIENT_PORTAL && r.clientUid === cleanClientUid,
      );
      const hasMore = ownOnly.length > maxLimit;
      onData?.({
        requests: hasMore ? ownOnly.slice(0, maxLimit) : ownOnly,
        hasMore,
        isTruncated: hasMore,
        maxLimit,
      });
      return () => {
        clientSubscribers.delete(sub);
      };
    },

    async fetchMoreBookingRequests({ cursor, pageSize = BOOKING_REQUEST_INBOX_PAGE_SIZE }) {
      const allSorted = sortedRequests();
      const idx = cursor ? allSorted.findIndex((item) => item.id === cursor) : -1;
      const start = idx >= 0 ? idx + 1 : 0;
      const slice = allSorted.slice(start, start + pageSize);
      const hasMore = allSorted.length > start + pageSize;
      return {
        requests: slice,
        hasMore,
        lastCursor: slice.length > 0 ? slice[slice.length - 1].id : null,
      };
    },

    subscribeBookingRequestById({ requestId, onData }) {
      if (!requestId) {
        onData?.(null);
        return () => {};
      }
      if (!docSubscribers.has(requestId)) docSubscribers.set(requestId, new Set());
      const set = docSubscribers.get(requestId);
      set.add(onData);
      const found = requests.get(requestId) || null;
      onData?.(found ? { ...found } : null);
      return () => {
        set.delete(onData);
      };
    },

    subscribeRequestCommunications({
      requestId,
      maxLimit = BOOKING_REQUEST_TIMELINE_LIMIT,
      onData,
    }) {
      if (!requestId) {
        onData?.([]);
        return () => {};
      }
      if (!commSubscribers.has(requestId)) commSubscribers.set(requestId, new Set());
      const set = commSubscribers.get(requestId);
      set.add(onData);
      const items = Array.from(communications.values())
        .filter((c) => c.requestId === requestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
        .slice(0, maxLimit);
      onData?.(items);
      return () => {
        set.delete(onData);
      };
    },

    subscribeRequestActivities({ requestId, maxLimit = BOOKING_REQUEST_TIMELINE_LIMIT, onData }) {
      if (!requestId) {
        onData?.([]);
        return () => {};
      }
      if (!activitySubscribers.has(requestId)) activitySubscribers.set(requestId, new Set());
      const set = activitySubscribers.get(requestId);
      set.add(onData);
      const items = Array.from(activities.values())
        .filter((a) => a.requestId === requestId)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
        .slice(0, maxLimit);
      onData?.(items);
      return () => {
        set.delete(onData);
      };
    },

    async runWorkflowUpdateTransaction({
      requestId,
      expectedVersion,
      actorUid,
      activityId,
      buildNextState,
    }) {
      if (queuedUpdateError) {
        const err = queuedUpdateError;
        queuedUpdateError = null;
        throw err;
      }

      const work = async () => {
        const current = requests.get(requestId);
        if (!current) {
          throw createBookingRequestRepositoryError(
            'booking-request/not-found',
            'Data booking request tidak ditemukan.',
          );
        }
        if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
          throw createBookingRequestRepositoryError(
            'booking-request/stale-update',
            `Request ini telah diperbarui di sesi lain (versi saat ini v${current.version}). Muat ulang detail sebelum menyimpan.`,
            { currentVersion: current.version, expectedVersion },
          );
        }

        const nowIso = new Date().toISOString();
        const { parentPatch, activityDoc } = buildNextState({
          current,
          rawCurrent: current,
          timestampValue: nowIso,
        });

        const nextRecord = normalizeBookingRequestRecord(requestId, {
          ...current,
          ...parentPatch,
          updatedAt: nowIso,
          updatedByUid: actorUid,
          version: current.version + 1,
        });

        requests.set(requestId, nextRecord);
        if (activityDoc) {
          activities.set(activityId, {
            requestId,
            ...normalizeActivityEvent(activityId, { ...activityDoc, createdAt: nowIso }),
          });
        }
        notifyAll(requestId);
        return { ...nextRecord };
      };

      return shared?.enqueueTransaction ? shared.enqueueTransaction(work) : work();
    },

    async recordCommunicationTransaction({
      requestId,
      expectedVersion,
      actorUid,
      communicationId,
      communicationDoc,
      parentCommunicationPatch,
    }) {
      if (queuedUpdateError) {
        const err = queuedUpdateError;
        queuedUpdateError = null;
        throw err;
      }

      const work = async () => {
        const current = requests.get(requestId);
        if (!current) {
          throw createBookingRequestRepositoryError(
            'booking-request/not-found',
            'Data booking request tidak ditemukan.',
          );
        }
        if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
          throw createBookingRequestRepositoryError(
            'booking-request/stale-update',
            `Request ini baru saja diperbarui di sesi lain (v${current.version}). Muat ulang sebelum mencatat komunikasi.`,
            { currentVersion: current.version, expectedVersion },
          );
        }

        const nowIso = new Date().toISOString();
        const normalizedComm = {
          requestId,
          ...normalizeCommunicationEvent(communicationId, {
            ...communicationDoc,
            preparedAt: communicationDoc.preparedAt ? nowIso : null,
            manuallyMarkedSentAt: communicationDoc.manuallyMarkedSentAt ? nowIso : null,
            createdAt: nowIso,
          }),
        };

        const nextRecord = normalizeBookingRequestRecord(requestId, {
          ...current,
          ...parentCommunicationPatch,
          lastCommunicationAt: nowIso,
          updatedAt: nowIso,
          updatedByUid: actorUid,
          version: current.version + 1,
        });

        communications.set(communicationId, normalizedComm);
        requests.set(requestId, nextRecord);
        notifyAll(requestId);

        return {
          request: { ...nextRecord },
          communication: { ...normalizedComm },
        };
      };

      return shared?.enqueueTransaction ? shared.enqueueTransaction(work) : work();
    },

    async getOfferById(requestId, offerId) {
      const target = offers.get(String(offerId || '').trim());
      if (!target || target.requestId !== requestId) return null;
      return { ...target };
    },

    async listOffersByRequestId(requestId, { maxLimit = 50, clientSafe = false } = {}) {
      return Array.from(offers.values())
        .filter((o) => o.requestId === requestId)
        .sort((a, b) => (Number(b.revisionNumber) || 1) - (Number(a.revisionNumber) || 1))
        .slice(0, maxLimit)
        .map((o) => (clientSafe ? projectClientOfferRecord(o) : { ...o }))
        .filter(Boolean);
    },

    subscribeRequestOffers({ requestId, clientSafe = false, maxLimit = 50, onData }) {
      if (!requestId) {
        onData?.([]);
        return () => {};
      }
      if (!offerSubscribers.has(requestId)) offerSubscribers.set(requestId, new Set());
      const sub = { clientSafe, onData };
      const set = offerSubscribers.get(requestId);
      set.add(sub);
      const list = Array.from(offers.values())
        .filter((o) => o.requestId === requestId)
        .sort((a, b) => (Number(b.revisionNumber) || 1) - (Number(a.revisionNumber) || 1))
        .slice(0, maxLimit)
        .map((o) => (clientSafe ? projectClientOfferRecord(o) : { ...o }))
        .filter(Boolean);
      onData?.(list);
      return () => {
        set.delete(sub);
      };
    },

    async runOfferTransaction({ requestId, txWork }) {
      if (queuedUpdateError) {
        const err = queuedUpdateError;
        queuedUpdateError = null;
        throw err;
      }

      const work = async () => {
        const stagedRequests = new Map(requests);
        const stagedOffers = new Map(offers);
        const stagedActivities = new Map(activities);
        const touchedRequestIds = new Set();
        let writeStarted = false;

        const txContext = {
          nowValue: () => ({ seconds: Math.floor(Date.now() / 1000) }),
          timestampFromDate: (date) => ({
            seconds: Math.floor((date instanceof Date ? date.getTime() : Date.now()) / 1000),
          }),
          async getRequest(targetReqId = requestId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            const cur = stagedRequests.get(targetReqId);
            return cur ? { ...cur, _raw: cur } : null;
          },
          async getOffer(offerId, targetReqId = requestId) {
            if (writeStarted) {
              throw new Error('Firestore transactions require all reads before writes.');
            }
            if (!offerId) return null;
            const found = stagedOffers.get(offerId);
            if (!found || found.requestId !== targetReqId) return null;
            return { ...found, _raw: found };
          },
          updateRequest(data, targetReqId = requestId) {
            writeStarted = true;
            touchedRequestIds.add(targetReqId);
            const prev = stagedRequests.get(targetReqId) || {};
            const nowIso = new Date().toISOString();
            stagedRequests.set(
              targetReqId,
              normalizeBookingRequestRecord(targetReqId, {
                ...prev,
                ...data,
                updatedAt: nowIso,
              }),
            );
          },
          setOffer(offerId, data, targetReqId = requestId) {
            writeStarted = true;
            touchedRequestIds.add(targetReqId);
            const nowIso = new Date().toISOString();
            stagedOffers.set(
              offerId,
              normalizeOfferRecord(offerId, {
                ...data,
                requestId: targetReqId,
                createdAt: data.createdAt?.seconds ? data.createdAt : nowIso,
                updatedAt: nowIso,
              }),
            );
          },
          updateOffer(offerId, data, targetReqId = requestId) {
            writeStarted = true;
            touchedRequestIds.add(targetReqId);
            const prev = stagedOffers.get(offerId) || {};
            const nowIso = new Date().toISOString();
            stagedOffers.set(
              offerId,
              normalizeOfferRecord(offerId, {
                ...prev,
                ...data,
                requestId: targetReqId,
                respondedAt: data.respondedAt ? nowIso : prev.respondedAt,
                updatedAt: nowIso,
              }),
            );
          },
          setActivity(activityId, data, targetReqId = requestId) {
            writeStarted = true;
            touchedRequestIds.add(targetReqId);
            const nowIso = new Date().toISOString();
            stagedActivities.set(activityId, {
              requestId: targetReqId,
              ...normalizeActivityEvent(activityId, { ...data, createdAt: nowIso }),
            });
          },
        };

        const result = await txWork(txContext);

        requests.clear();
        for (const [k, v] of stagedRequests) requests.set(k, v);
        offers.clear();
        for (const [k, v] of stagedOffers) offers.set(k, v);
        activities.clear();
        for (const [k, v] of stagedActivities) activities.set(k, v);

        for (const reqId of touchedRequestIds) {
          notifyAll(reqId);
        }

        return result;
      };

      return shared?.enqueueTransaction ? shared.enqueueTransaction(work) : work();
    },

    _seedRequests(list = []) {
      for (const item of list) {
        const norm = normalizeBookingRequestRecord(item.id, item);
        if (norm?.id) requests.set(norm.id, norm);
      }
      notifyAll();
    },

    _setNextCreateError(err) {
      queuedCreateError = err;
    },

    _setNextUpdateError(err) {
      queuedUpdateError = err;
    },

    _setNextClientSubscribeError(err) {
      queuedClientSubscribeError = err;
    },

    _inspectState() {
      return {
        requests: new Map(requests),
        activities: new Map(activities),
        communications: new Map(communications),
        offers: new Map(offers),
      };
    },
  };
}

let activeBookingRequestAdapter = createFirestoreBookingRequestRepositoryAdapter();

export function getBookingRequestRepositoryAdapter() {
  return activeBookingRequestAdapter;
}

export function setBookingRequestRepositoryAdapter(customAdapter) {
  activeBookingRequestAdapter = customAdapter || createFirestoreBookingRequestRepositoryAdapter();
}

export function resetBookingRequestRepositoryAdapter() {
  activeBookingRequestAdapter = createFirestoreBookingRequestRepositoryAdapter();
}
