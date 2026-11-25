import { DEFAULT_BOOKING_POLICIES, BOOKING_POLICIES_COLLECTION, BOOKING_POLICIES_DOC_ID } from '../config/booking-policies-config';
import { normalizeBookingPolicies } from '../utils/booking-policies-normalize';

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createFirestoreBookingPoliciesRepositoryAdapter() {
  return {
    subscribeBookingPolicies({ onData, onError }) {
      let unsubscribe = null;
      let cancelled = false;
      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (cancelled) return;
          const ref = doc(getFirebaseDb(), BOOKING_POLICIES_COLLECTION, BOOKING_POLICIES_DOC_ID);
          unsubscribe = onSnapshot(
            ref,
            (snapshot) => {
              if (cancelled) return;
              onData?.({
                policies: normalizeBookingPolicies(
                  snapshot.exists() ? snapshot.data() : DEFAULT_BOOKING_POLICIES,
                ),
                isPersisted: snapshot.exists(),
              });
            },
            (error) => {
              if (!cancelled) onError?.(error);
            },
          );
        } catch (error) {
          if (!cancelled) onError?.(error);
        }
      })();
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },

    async saveBookingPolicies({ actorUid, policies, expectedVersion }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const ref = doc(db, BOOKING_POLICIES_COLLECTION, BOOKING_POLICIES_DOC_ID);
      return runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const currentVersion = snapshot.exists() ? Number(snapshot.data().version) || 0 : 0;
        if (currentVersion !== Number(expectedVersion || 0)) {
          throw createRepositoryError(
            'booking-policies/stale-update',
            'Booking Policies sudah berubah di sesi lain. Muat ulang sebelum menyimpan.',
          );
        }
        const next = {
          ...normalizeBookingPolicies(policies),
          version: currentVersion + 1,
          updatedAt: serverTimestamp(),
          updatedByUid: String(actorUid || ''),
        };
        transaction.set(ref, next);
        return normalizeBookingPolicies({ ...next, updatedAt: new Date().toISOString() });
      });
    },
  };
}

export function createInMemoryBookingPoliciesRepositoryAdapter(initialPolicies = null) {
  let current = initialPolicies ? normalizeBookingPolicies(initialPolicies) : null;
  const subscribers = new Set();
  const emit = () => {
    const payload = {
      policies: normalizeBookingPolicies(current || DEFAULT_BOOKING_POLICIES),
      isPersisted: Boolean(current),
    };
    for (const subscriber of subscribers) subscriber.onData?.(payload);
  };
  return {
    subscribeBookingPolicies({ onData, onError }) {
      const subscriber = { onData, onError };
      subscribers.add(subscriber);
      queueMicrotask(emit);
      return () => subscribers.delete(subscriber);
    },
    async saveBookingPolicies({ actorUid, policies, expectedVersion }) {
      const currentVersion = Number(current?.version) || 0;
      if (currentVersion !== Number(expectedVersion || 0)) {
        throw createRepositoryError(
          'booking-policies/stale-update',
          'Booking Policies sudah berubah di sesi lain. Muat ulang sebelum menyimpan.',
        );
      }
      current = normalizeBookingPolicies({
        ...policies,
        version: currentVersion + 1,
        updatedAt: new Date().toISOString(),
        updatedByUid: actorUid,
      });
      emit();
      return current;
    },
    _inspectState: () => current ? structuredClone(current) : null,
  };
}

let repositoryAdapter;
export function getBookingPoliciesRepositoryAdapter() {
  if (!repositoryAdapter) repositoryAdapter = createFirestoreBookingPoliciesRepositoryAdapter();
  return repositoryAdapter;
}
export function setBookingPoliciesRepositoryAdapter(adapter) {
  repositoryAdapter = adapter;
}
export function resetBookingPoliciesRepositoryAdapter() {
  repositoryAdapter = null;
}
