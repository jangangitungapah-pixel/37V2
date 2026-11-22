import {
  FIRESTORE_COLLECTIONS,
  normalizeBookingRecord,
} from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { isFirebaseConfigured } from '@/lib/firebase/client';

import {
  CUSTOMER_REVIEW_LIMITS,
  CUSTOMER_REVIEW_SCHEMA_VERSION,
  CUSTOMER_REVIEW_STATUS,
  PUBLIC_REVIEW_STATS_DOC_ID,
} from '../config/customer-review-config';
import {
  normalizeCustomerReviewRecord,
  normalizeReviewInvitationIndexRecord,
  normalizeReviewInvitationRecord,
} from '../utils/customer-review-normalize';
import {
  createEmptyPublicReviewStats,
  normalizePublicReviewStats,
} from '../utils/customer-review-stats';

/**
 * Cloud Firestore repository adapter for Customer Review Management:
 * - `reviewInvitations/{tokenHash}`
 * - `reviewInvitationIndexes/{bookingId}`
 * - `customerReviews/{bookingId}`
 * - `publicReviewStats/summary`
 */
export function createFirestoreCustomerReviewRepositoryAdapter() {
  return {
    async runAtomicTransaction(callback) {
      const [{ Timestamp, doc, runTransaction, serverTimestamp }, { getFirebaseDb }] =
        await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);

      const db = getFirebaseDb();
      return runTransaction(db, async (transaction) => {
        const tx = {
          async getBooking(bookingId) {
            const snap = await transaction.get(doc(db, FIRESTORE_COLLECTIONS.BOOKINGS, bookingId));
            return snap.exists() ? normalizeBookingRecord(snap.id, snap.data()) : null;
          },

          async getInvitation(tokenHash) {
            const snap = await transaction.get(
              doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS, tokenHash),
            );
            return snap.exists() ? normalizeReviewInvitationRecord(snap.id, snap.data()) : null;
          },

          async createInvitation(tokenHash, payload) {
            const expiresDate =
              payload.expiresAt instanceof Date ? payload.expiresAt : new Date(payload.expiresAt);
            const firestoreData = {
              schemaVersion: payload.schemaVersion || CUSTOMER_REVIEW_SCHEMA_VERSION,
              bookingId: payload.bookingId,
              serviceLabelSnapshot: payload.serviceLabelSnapshot,
              sessionDate: payload.sessionDate,
              studioId: payload.studioId || '',
              status: payload.status,
              issuedByUid: payload.issuedByUid,
              issuedAt: serverTimestamp(),
              expiresAt: Timestamp.fromDate(expiresDate),
              submittedAt: null,
              revokedAt: null,
              revokedByUid: '',
              version: 1,
            };
            transaction.set(
              doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS, tokenHash),
              firestoreData,
            );
            const nowIso = new Date().toISOString();
            return normalizeReviewInvitationRecord(tokenHash, {
              ...firestoreData,
              issuedAt: nowIso,
              expiresAt: expiresDate.toISOString(),
            });
          },

          async updateInvitation(tokenHash, patch) {
            const ref = doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS, tokenHash);
            const updatePayload = {
              status: patch.status,
              version: patch.version,
            };
            if (patch.markSubmitted) {
              updatePayload.submittedAt = serverTimestamp();
            }
            if (patch.markRevoked) {
              updatePayload.revokedAt = serverTimestamp();
              updatePayload.revokedByUid = String(patch.revokedByUid || '');
            }
            transaction.update(ref, updatePayload);
            return normalizeReviewInvitationRecord(tokenHash, {
              id: tokenHash,
              bookingId: patch.bookingId || 'updated',
              ...updatePayload,
              submittedAt: patch.markSubmitted ? new Date().toISOString() : null,
              revokedAt: patch.markRevoked ? new Date().toISOString() : null,
            });
          },

          async getInvitationIndex(bookingId) {
            const snap = await transaction.get(
              doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATION_INDEXES, bookingId),
            );
            return snap.exists()
              ? normalizeReviewInvitationIndexRecord(snap.id, snap.data())
              : null;
          },

          async setInvitationIndex(bookingId, payload) {
            const expiresDate =
              payload.expiresAt instanceof Date ? payload.expiresAt : new Date(payload.expiresAt);
            const indexData = {
              schemaVersion: payload.schemaVersion || CUSTOMER_REVIEW_SCHEMA_VERSION,
              bookingId,
              activeInvitationId: payload.activeInvitationId,
              issuedAt: serverTimestamp(),
              expiresAt: Timestamp.fromDate(expiresDate),
              version: Number(payload.version || 1),
            };
            transaction.set(
              doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATION_INDEXES, bookingId),
              indexData,
            );
            return normalizeReviewInvitationIndexRecord(bookingId, {
              ...indexData,
              issuedAt: new Date().toISOString(),
              expiresAt: expiresDate.toISOString(),
            });
          },

          async getReview(bookingId) {
            const snap = await transaction.get(
              doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS, bookingId),
            );
            return snap.exists() ? normalizeCustomerReviewRecord(snap.id, snap.data()) : null;
          },

          async createReview(bookingId, payload) {
            const reviewData = {
              schemaVersion: payload.schemaVersion || CUSTOMER_REVIEW_SCHEMA_VERSION,
              bookingId,
              invitationId: payload.invitationId,
              displayName: payload.displayName,
              rating: payload.rating,
              reviewText: payload.reviewText,
              serviceLabelSnapshot: payload.serviceLabelSnapshot || 'Studio Session',
              sessionDate: payload.sessionDate || '',
              consentToPublish: true,
              consentVersion: payload.consentVersion,
              status: payload.status,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              publishedAt: null,
              version: 1,
            };
            transaction.set(doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS, bookingId), reviewData);
            const nowIso = new Date().toISOString();
            return normalizeCustomerReviewRecord(bookingId, {
              ...reviewData,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          },

          async updateReview(bookingId, patch) {
            const updatePayload = {
              status: patch.status,
              updatedAt: serverTimestamp(),
              publishedAt: patch.markPublished ? serverTimestamp() : (patch.publishedAt ?? null),
              version: Number(patch.version || 1),
            };
            transaction.update(
              doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS, bookingId),
              updatePayload,
            );
            return {
              bookingId,
              ...updatePayload,
              updatedAt: new Date().toISOString(),
              publishedAt: patch.markPublished
                ? new Date().toISOString()
                : (patch.publishedAt ?? null),
            };
          },

          async getReviewStats() {
            const snap = await transaction.get(
              doc(db, FIRESTORE_COLLECTIONS.PUBLIC_REVIEW_STATS, PUBLIC_REVIEW_STATS_DOC_ID),
            );
            return snap.exists()
              ? normalizePublicReviewStats(snap.data())
              : createEmptyPublicReviewStats();
          },

          async setReviewStats(nextStats) {
            const dist = nextStats.ratingDistribution || {};
            const writeData = {
              schemaVersion: CUSTOMER_REVIEW_SCHEMA_VERSION,
              publishedCount: Math.max(0, Math.round(Number(nextStats.publishedCount) || 0)),
              ratingSum: Math.max(0, Math.round(Number(nextStats.ratingSum) || 0)),
              ratingDistribution: {
                1: Math.max(0, Math.round(Number(dist['1']) || 0)),
                2: Math.max(0, Math.round(Number(dist['2']) || 0)),
                3: Math.max(0, Math.round(Number(dist['3']) || 0)),
                4: Math.max(0, Math.round(Number(dist['4']) || 0)),
                5: Math.max(0, Math.round(Number(dist['5']) || 0)),
              },
              updatedAt: serverTimestamp(),
            };
            transaction.set(
              doc(db, FIRESTORE_COLLECTIONS.PUBLIC_REVIEW_STATS, PUBLIC_REVIEW_STATS_DOC_ID),
              writeData,
            );
            return normalizePublicReviewStats({
              ...writeData,
              updatedAt: new Date().toISOString(),
            });
          },
        };

        return callback(tx);
      });
    },

    async getPublicInvitationByTokenHash(tokenHash) {
      if (!isFirebaseConfigured()) return null;
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS, tokenHash));
      return snap.exists() ? normalizeReviewInvitationRecord(snap.id, snap.data()) : null;
    },

    subscribePublicReviewStats({ onData, onError }) {
      if (!isFirebaseConfigured()) {
        queueMicrotask(() => onData?.(createEmptyPublicReviewStats()));
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
            onData?.(createEmptyPublicReviewStats());
            return;
          }

          const db = getFirebaseDb();
          unsubscribe = onSnapshot(
            doc(db, FIRESTORE_COLLECTIONS.PUBLIC_REVIEW_STATS, PUBLIC_REVIEW_STATS_DOC_ID),
            (snap) => {
              if (isCancelled) return;
              onData?.(
                snap && typeof snap.exists === 'function' && snap.exists()
                  ? normalizePublicReviewStats(snap.data())
                  : createEmptyPublicReviewStats(),
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

    subscribePublishedReviews({
      maxLimit = CUSTOMER_REVIEW_LIMITS.publicReviewsLimit,
      onData,
      onError,
    }) {
      if (!isFirebaseConfigured()) {
        queueMicrotask(() => onData?.([]));
        return () => {};
      }

      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query, where }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            onData?.([]);
            return;
          }

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS),
            where('status', '==', CUSTOMER_REVIEW_STATUS.PUBLISHED),
            orderBy('publishedAt', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const items = (snapshot?.docs || [])
                .map((d) => normalizeCustomerReviewRecord(d.id, d.data()))
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

    subscribeAllCustomerReviews({
      maxLimit = CUSTOMER_REVIEW_LIMITS.adminReviewsLimit,
      onData,
      onError,
    }) {
      if (!isFirebaseConfigured()) {
        queueMicrotask(() => onData?.([]));
        return () => {};
      }

      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            onData?.([]);
            return;
          }

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS),
            orderBy('createdAt', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const items = (snapshot?.docs || [])
                .map((d) => normalizeCustomerReviewRecord(d.id, d.data()))
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

    subscribeAllReviewInvitations({
      maxLimit = CUSTOMER_REVIEW_LIMITS.adminInvitationsLimit,
      onData,
      onError,
    }) {
      if (!isFirebaseConfigured()) {
        queueMicrotask(() => onData?.([]));
        return () => {};
      }

      let unsubscribe = null;
      let isCancelled = false;

      (async () => {
        try {
          const [{ collection, limit, onSnapshot, orderBy, query }, { getFirebaseDb }] =
            await Promise.all([import('firebase/firestore'), import('@/lib/firebase/firestore')]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            onData?.([]);
            return;
          }

          const db = getFirebaseDb();
          const q = query(
            collection(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS),
            orderBy('issuedAt', 'desc'),
            limit(maxLimit),
          );

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const items = (snapshot?.docs || [])
                .map((d) => normalizeReviewInvitationRecord(d.id, d.data()))
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

    subscribeBookingReviewState({ bookingId, onData, onError }) {
      if (!bookingId || !isFirebaseConfigured()) {
        queueMicrotask(() => onData?.({ invitation: null, invitationIndex: null, review: null }));
        return () => {};
      }

      let unsubIndex = null;
      let unsubInvitation = null;
      let unsubReview = null;
      let isCancelled = false;

      let latestIndex = null;
      let latestInvitation = null;
      let latestReview = null;
      let indexReady = false;
      let reviewReady = false;

      const emit = () => {
        if (isCancelled || !indexReady || !reviewReady) return;
        onData?.({
          invitationIndex: latestIndex,
          invitation: latestInvitation,
          review: latestReview,
        });
      };

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            onData?.({ invitation: null, invitationIndex: null, review: null });
            return;
          }

          const db = getFirebaseDb();

          unsubReview = onSnapshot(
            doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_REVIEWS, bookingId),
            (snap) => {
              if (isCancelled) return;
              latestReview =
                snap && typeof snap.exists === 'function' && snap.exists()
                  ? normalizeCustomerReviewRecord(snap.id, snap.data())
                  : null;
              reviewReady = true;
              emit();
            },
            (err) => {
              if (!isCancelled) onError?.(err);
            },
          );

          unsubIndex = onSnapshot(
            doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATION_INDEXES, bookingId),
            (snap) => {
              if (isCancelled) return;
              latestIndex =
                snap && typeof snap.exists === 'function' && snap.exists()
                  ? normalizeReviewInvitationIndexRecord(snap.id, snap.data())
                  : null;
              indexReady = true;

              unsubInvitation?.();
              unsubInvitation = null;

              if (latestIndex?.activeInvitationId) {
                unsubInvitation = onSnapshot(
                  doc(db, FIRESTORE_COLLECTIONS.REVIEW_INVITATIONS, latestIndex.activeInvitationId),
                  (invSnap) => {
                    if (isCancelled) return;
                    latestInvitation =
                      invSnap && typeof invSnap.exists === 'function' && invSnap.exists()
                        ? normalizeReviewInvitationRecord(invSnap.id, invSnap.data())
                        : null;
                    emit();
                  },
                  (err) => {
                    if (!isCancelled) onError?.(err);
                  },
                );
              } else {
                latestInvitation = null;
                emit();
              }
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
        unsubIndex?.();
        unsubInvitation?.();
        unsubReview?.();
      };
    },
  };
}

/**
 * Deterministic In-Memory Customer Review Repository Adapter for unit & UI tests.
 */
export function createInMemoryCustomerReviewRepositoryAdapter({
  initialBookings = [],
  initialInvitations = [],
  initialInvitationIndexes = [],
  initialReviews = [],
  initialStats = null,
} = {}) {
  const bookingsMap = new Map();
  for (const b of initialBookings || []) {
    if (b?.id) bookingsMap.set(b.id, normalizeBookingRecord(b.id, b));
  }

  const invitationsMap = new Map();
  for (const inv of initialInvitations || []) {
    if (inv?.id) invitationsMap.set(inv.id, normalizeReviewInvitationRecord(inv.id, inv));
  }

  const invitationIndexesMap = new Map();
  for (const idx of initialInvitationIndexes || []) {
    if (idx?.id || idx?.bookingId) {
      const key = idx.id || idx.bookingId;
      invitationIndexesMap.set(key, normalizeReviewInvitationIndexRecord(key, idx));
    }
  }

  const reviewsMap = new Map();
  for (const rev of initialReviews || []) {
    const key = rev?.bookingId || rev?.id;
    if (key) reviewsMap.set(key, normalizeCustomerReviewRecord(key, rev));
  }

  let statsState = initialStats
    ? normalizePublicReviewStats(initialStats)
    : createEmptyPublicReviewStats();
  let nextPublicGetError = null;
  let txQueue = Promise.resolve();

  const statsSubscribers = new Set();
  const publishedSubscribers = new Set();
  const allReviewsSubscribers = new Set();
  const allInvitationsSubscribers = new Set();
  const bookingSubscribers = new Map();

  function notifySubscribers() {
    const currentStats = normalizePublicReviewStats(statsState);
    for (const cb of statsSubscribers) {
      cb?.(currentStats);
    }

    const allReviews = Array.from(reviewsMap.values())
      .map((item) => normalizeCustomerReviewRecord(item.bookingId, item))
      .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));

    for (const cb of allReviewsSubscribers) {
      cb?.(allReviews);
    }

    const published = allReviews
      .filter((item) => item.status === CUSTOMER_REVIEW_STATUS.PUBLISHED)
      .sort((a, b) => getTimestampMillis(b.publishedAt) - getTimestampMillis(a.publishedAt))
      .slice(0, CUSTOMER_REVIEW_LIMITS.publicReviewsLimit);

    for (const cb of publishedSubscribers) {
      cb?.(published);
    }

    const allInvitations = Array.from(invitationsMap.values())
      .map((item) => normalizeReviewInvitationRecord(item.id, item))
      .sort((a, b) => getTimestampMillis(b.issuedAt) - getTimestampMillis(a.issuedAt));

    for (const cb of allInvitationsSubscribers) {
      cb?.(allInvitations);
    }

    for (const [bookingId, subs] of bookingSubscribers.entries()) {
      const idx = invitationIndexesMap.get(bookingId) || null;
      const inv = idx?.activeInvitationId
        ? invitationsMap.get(idx.activeInvitationId) || null
        : null;
      const rev = reviewsMap.get(bookingId) || null;
      for (const cb of subs) {
        cb?.({
          invitationIndex: idx ? { ...idx } : null,
          invitation: inv ? { ...inv } : null,
          review: rev ? { ...rev } : null,
        });
      }
    }
  }

  return {
    _inspectState() {
      return {
        bookingsMap,
        invitationsMap,
        invitationIndexesMap,
        reviewsMap,
        statsState: normalizePublicReviewStats(statsState),
      };
    },

    _seedBooking(booking) {
      if (booking?.id) {
        bookingsMap.set(booking.id, normalizeBookingRecord(booking.id, booking));
      }
    },

    _setNextPublicGetError(err = null) {
      nextPublicGetError = err;
    },

    _resetOperationalInvitationsForResetTest() {
      invitationsMap.clear();
      invitationIndexesMap.clear();
      notifySubscribers();
    },

    async runAtomicTransaction(callback) {
      const execute = async () => {
        // Snapshot maps before transaction so thrown errors roll back all staged mutations cleanly
        const stageInvitations = new Map(
          Array.from(invitationsMap.entries()).map(([k, v]) => [k, { ...v }]),
        );
        const stageIndexes = new Map(
          Array.from(invitationIndexesMap.entries()).map(([k, v]) => [k, { ...v }]),
        );
        const stageReviews = new Map(
          Array.from(reviewsMap.entries()).map(([k, v]) => [k, { ...v }]),
        );
        let stageStats = structuredClone(statsState);
        const nowIso = new Date().toISOString();

        const tx = {
          async getBooking(bookingId) {
            const existing = bookingsMap.get(bookingId);
            return existing ? { ...existing } : null;
          },

          async getInvitation(tokenHash) {
            const existing = stageInvitations.get(tokenHash);
            return existing ? normalizeReviewInvitationRecord(tokenHash, existing) : null;
          },

          async createInvitation(tokenHash, payload) {
            if (stageInvitations.has(tokenHash)) {
              const err = new Error('Invitation already exists.');
              err.code = 'already-exists';
              throw err;
            }
            const record = normalizeReviewInvitationRecord(tokenHash, {
              ...payload,
              issuedAt: nowIso,
              expiresAt:
                payload.expiresAt instanceof Date
                  ? payload.expiresAt.toISOString()
                  : payload.expiresAt,
              submittedAt: null,
              revokedAt: null,
              version: 1,
            });
            stageInvitations.set(tokenHash, record);
            return { ...record };
          },

          async updateInvitation(tokenHash, patch) {
            const current = stageInvitations.get(tokenHash);
            if (!current) {
              const err = new Error('Invitation missing for update.');
              err.code = 'not-found';
              throw err;
            }
            const next = normalizeReviewInvitationRecord(tokenHash, {
              ...current,
              status: patch.status,
              version: Number(patch.version || Number(current.version || 1) + 1),
              submittedAt: patch.markSubmitted ? nowIso : current.submittedAt,
              revokedAt: patch.markRevoked ? nowIso : current.revokedAt,
              revokedByUid: patch.markRevoked
                ? String(patch.revokedByUid || '')
                : current.revokedByUid,
            });
            stageInvitations.set(tokenHash, next);
            return { ...next };
          },

          async getInvitationIndex(bookingId) {
            const existing = stageIndexes.get(bookingId);
            return existing ? { ...existing } : null;
          },

          async setInvitationIndex(bookingId, payload) {
            const record = normalizeReviewInvitationIndexRecord(bookingId, {
              ...payload,
              bookingId,
              issuedAt: nowIso,
              expiresAt:
                payload.expiresAt instanceof Date
                  ? payload.expiresAt.toISOString()
                  : payload.expiresAt,
            });
            stageIndexes.set(bookingId, record);
            return { ...record };
          },

          async getReview(bookingId) {
            const existing = stageReviews.get(bookingId);
            return existing ? normalizeCustomerReviewRecord(bookingId, existing) : null;
          },

          async createReview(bookingId, payload) {
            if (stageReviews.has(bookingId)) {
              const err = new Error('Duplicate review for booking.');
              err.code = 'already-exists';
              throw err;
            }
            const record = normalizeCustomerReviewRecord(bookingId, {
              ...payload,
              bookingId,
              createdAt: nowIso,
              updatedAt: nowIso,
              publishedAt: null,
              version: 1,
            });
            stageReviews.set(bookingId, record);
            return { ...record };
          },

          async updateReview(bookingId, patch) {
            const current = stageReviews.get(bookingId);
            if (!current) {
              const err = new Error('Review missing.');
              err.code = 'not-found';
              throw err;
            }
            const next = normalizeCustomerReviewRecord(bookingId, {
              ...current,
              status: patch.status,
              publishedAt: patch.markPublished
                ? nowIso
                : (patch.publishedAt ?? current.publishedAt),
              updatedAt: nowIso,
              version: Number(patch.version || Number(current.version || 1) + 1),
            });
            stageReviews.set(bookingId, next);
            return { ...next };
          },

          async getReviewStats() {
            return normalizePublicReviewStats(stageStats);
          },

          async setReviewStats(nextStats) {
            stageStats = normalizePublicReviewStats({
              ...nextStats,
              updatedAt: nowIso,
            });
            return { ...stageStats };
          },
        };

        const result = await callback(tx);

        // Commit staged changes atomically
        invitationsMap.clear();
        for (const [k, v] of stageInvitations.entries()) invitationsMap.set(k, v);
        invitationIndexesMap.clear();
        for (const [k, v] of stageIndexes.entries()) invitationIndexesMap.set(k, v);
        reviewsMap.clear();
        for (const [k, v] of stageReviews.entries()) reviewsMap.set(k, v);
        statsState = stageStats;
        notifySubscribers();
        return result;
      };

      const chained = txQueue.then(execute, execute);
      txQueue = chained.catch(() => {});
      return chained;
    },

    async getPublicInvitationByTokenHash(tokenHash) {
      if (nextPublicGetError) {
        const err = nextPublicGetError;
        nextPublicGetError = null;
        throw err;
      }
      const existing = invitationsMap.get(tokenHash);
      return existing ? normalizeReviewInvitationRecord(tokenHash, existing) : null;
    },

    subscribePublicReviewStats({ onData }) {
      statsSubscribers.add(onData);
      queueMicrotask(() => onData?.(normalizePublicReviewStats(statsState)));
      return () => {
        statsSubscribers.delete(onData);
      };
    },

    subscribePublishedReviews({ maxLimit = CUSTOMER_REVIEW_LIMITS.publicReviewsLimit, onData }) {
      const wrapped = (allPublished) => {
        onData?.((allPublished || []).slice(0, maxLimit));
      };
      publishedSubscribers.add(wrapped);
      queueMicrotask(() => {
        const published = Array.from(reviewsMap.values())
          .filter((item) => item.status === CUSTOMER_REVIEW_STATUS.PUBLISHED)
          .sort((a, b) => getTimestampMillis(b.publishedAt) - getTimestampMillis(a.publishedAt))
          .slice(0, maxLimit);
        onData?.(published);
      });
      return () => {
        publishedSubscribers.delete(wrapped);
      };
    },

    subscribeAllCustomerReviews({ maxLimit = CUSTOMER_REVIEW_LIMITS.adminReviewsLimit, onData }) {
      const wrapped = (allReviews) => {
        onData?.((allReviews || []).slice(0, maxLimit));
      };
      allReviewsSubscribers.add(wrapped);
      queueMicrotask(() => {
        const list = Array.from(reviewsMap.values())
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
          .slice(0, maxLimit);
        onData?.(list);
      });
      return () => {
        allReviewsSubscribers.delete(wrapped);
      };
    },

    subscribeAllReviewInvitations({
      maxLimit = CUSTOMER_REVIEW_LIMITS.adminInvitationsLimit,
      onData,
    }) {
      const wrapped = (allInvs) => {
        onData?.((allInvs || []).slice(0, maxLimit));
      };
      allInvitationsSubscribers.add(wrapped);
      queueMicrotask(() => {
        const list = Array.from(invitationsMap.values())
          .sort((a, b) => getTimestampMillis(b.issuedAt) - getTimestampMillis(a.issuedAt))
          .slice(0, maxLimit);
        onData?.(list);
      });
      return () => {
        allInvitationsSubscribers.delete(wrapped);
      };
    },

    subscribeBookingReviewState({ bookingId, onData }) {
      if (!bookingId) {
        queueMicrotask(() => onData?.({ invitation: null, invitationIndex: null, review: null }));
        return () => {};
      }

      if (!bookingSubscribers.has(bookingId)) {
        bookingSubscribers.set(bookingId, new Set());
      }
      bookingSubscribers.get(bookingId).add(onData);

      queueMicrotask(() => {
        const idx = invitationIndexesMap.get(bookingId) || null;
        const inv = idx?.activeInvitationId
          ? invitationsMap.get(idx.activeInvitationId) || null
          : null;
        const rev = reviewsMap.get(bookingId) || null;
        onData?.({
          invitationIndex: idx ? { ...idx } : null,
          invitation: inv ? { ...inv } : null,
          review: rev ? { ...rev } : null,
        });
      });

      return () => {
        bookingSubscribers.get(bookingId)?.delete(onData);
      };
    },
  };
}

let activeCustomerReviewAdapter = createFirestoreCustomerReviewRepositoryAdapter();

export function getCustomerReviewRepositoryAdapter() {
  return activeCustomerReviewAdapter;
}

export function setCustomerReviewRepositoryAdapter(customAdapter) {
  activeCustomerReviewAdapter = customAdapter || createFirestoreCustomerReviewRepositoryAdapter();
}

export function resetCustomerReviewRepositoryAdapter() {
  activeCustomerReviewAdapter = createFirestoreCustomerReviewRepositoryAdapter();
}
