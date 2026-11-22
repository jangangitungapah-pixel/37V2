import { isFirebaseConfigured } from '@/lib/firebase/client';

import {
  PUBLIC_PRICING_CATALOG_COLLECTION,
  PUBLIC_PRICING_CATALOG_DOC_ID,
} from '../config/public-pricing-config';
import { normalizePublicPricingCatalog } from '../utils/public-pricing-projection';

function resolveRawPublicCatalogResult(exists, rawData) {
  if (!exists || !rawData) {
    return {
      catalog: null,
      isPersisted: false,
      isValid: false,
      invalidReason: 'missing',
    };
  }

  const normalized = normalizePublicPricingCatalog(rawData);
  if (!normalized.isValid) {
    return {
      catalog: null,
      isPersisted: true,
      isValid: false,
      invalidReason: normalized.reason || 'invalid',
    };
  }

  return {
    catalog: normalized.catalog,
    isPersisted: true,
    isValid: true,
    invalidReason: '',
  };
}

export function createFirestorePublicPricingCatalogAdapter() {
  return {
    kind: 'firestore',

    subscribePublicPricingCatalog({ onData, onError }) {
      let isDisposed = false;
      let unsubscribeFirestore = null;

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);

          if (isDisposed) return;
          if (typeof onSnapshot !== 'function') {
            onError?.(new Error('Firestore realtime listener unavailable.'));
            return;
          }

          const db = getFirebaseDb();
          const docRef = doc(db, PUBLIC_PRICING_CATALOG_COLLECTION, PUBLIC_PRICING_CATALOG_DOC_ID);

          unsubscribeFirestore = onSnapshot(
            docRef,
            (snap) => {
              if (isDisposed) return;
              const docExists =
                typeof snap?.exists === 'function' ? snap.exists() : Boolean(snap?.exists);
              onData?.(resolveRawPublicCatalogResult(docExists, docExists ? snap.data() : null));
            },
            (err) => {
              if (isDisposed) return;
              onError?.(err);
            },
          );
        } catch (err) {
          if (!isDisposed) {
            onError?.(err);
          }
        }
      })();

      return () => {
        isDisposed = true;
        unsubscribeFirestore?.();
      };
    },

    async getPublicPricingCatalogSnapshot() {
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const docRef = doc(db, PUBLIC_PRICING_CATALOG_COLLECTION, PUBLIC_PRICING_CATALOG_DOC_ID);
      const snap = await getDoc(docRef);
      const docExists = typeof snap?.exists === 'function' ? snap.exists() : Boolean(snap?.exists);
      return resolveRawPublicCatalogResult(docExists, docExists ? snap.data() : null);
    },
  };
}

export function createInMemoryPublicPricingCatalogAdapter(initialRawDoc = null) {
  let storedRawDoc = initialRawDoc ? structuredClone(initialRawDoc) : null;
  const listeners = new Set();

  const notifyAll = () => {
    const payload = resolveRawPublicCatalogResult(Boolean(storedRawDoc), storedRawDoc);
    listeners.forEach((cb) => {
      cb?.(payload);
    });
  };

  return {
    kind: 'in-memory',

    subscribePublicPricingCatalog({ onData }) {
      let active = true;
      const listener = (payload) => {
        if (active) onData?.(payload);
      };
      listeners.add(listener);

      queueMicrotask(() => {
        if (active) {
          onData?.(resolveRawPublicCatalogResult(Boolean(storedRawDoc), storedRawDoc));
        }
      });

      return () => {
        active = false;
        listeners.delete(listener);
      };
    },

    async getPublicPricingCatalogSnapshot() {
      return resolveRawPublicCatalogResult(Boolean(storedRawDoc), storedRawDoc);
    },

    _setStoredDoc(nextRawDoc) {
      storedRawDoc = nextRawDoc ? structuredClone(nextRawDoc) : null;
      notifyAll();
    },

    _getStoredDoc() {
      return storedRawDoc ? structuredClone(storedRawDoc) : null;
    },
  };
}

let activeAdapter = null;

export function getPublicPricingCatalogRepositoryAdapter() {
  if (!activeAdapter) {
    activeAdapter = isFirebaseConfigured()
      ? createFirestorePublicPricingCatalogAdapter()
      : createInMemoryPublicPricingCatalogAdapter(null);
  }
  return activeAdapter;
}

export function setPublicPricingCatalogRepositoryAdapter(adapter) {
  activeAdapter = adapter || null;
}

export function resetPublicPricingCatalogRepositoryAdapter() {
  activeAdapter = null;
}
