import {
  DEFAULT_PRICING_SETTINGS,
  PRICING_SETTINGS_COLLECTION,
  PRICING_SETTINGS_DOC_ID,
  PRICING_SETTINGS_SCHEMA_VERSION,
} from '../config/default-pricing-settings';
import { isLegacyV1PricingSettings } from '../utils/migrate-pricing-settings';
import {
  clonePricingSettings,
  normalizePricingSettings,
} from '../utils/normalize-pricing-settings';

export function createPricingSettingsRepositoryError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Default Cloud Firestore repository adapter for the single centralized document
 * `settings/pricing` (Schema V2 with safe runtime migration from legacy Schema V1).
 * Never auto-creates or auto-writes during read/subscribe.
 */
export function createFirestorePricingSettingsAdapter() {
  return {
    subscribePricingSettings({ onData, onError }) {
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
          const settingsRef = doc(db, PRICING_SETTINGS_COLLECTION, PRICING_SETTINGS_DOC_ID);

          unsubscribe = onSnapshot(
            settingsRef,
            (snapshot) => {
              if (isCancelled) return;
              const docExists =
                typeof snapshot?.exists === 'function'
                  ? snapshot.exists()
                  : Boolean(snapshot?.exists);

              if (!docExists) {
                onData?.({
                  settings: clonePricingSettings(DEFAULT_PRICING_SETTINGS),
                  isPersisted: false,
                  migratedFromV1: false,
                });
                return;
              }

              const rawData = snapshot.data();
              const migratedFromV1 = isLegacyV1PricingSettings(rawData);

              onData?.({
                settings: normalizePricingSettings(rawData),
                isPersisted: true,
                migratedFromV1,
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

    async savePricingSettingsTransaction({ actorUid, payload, expectedVersion }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const settingsRef = doc(db, PRICING_SETTINGS_COLLECTION, PRICING_SETTINGS_DOC_ID);

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(settingsRef);
        const currentVersion = snap.exists() ? Number(snap.data()?.version) || 1 : 0;

        if (Number.isInteger(expectedVersion) && currentVersion !== expectedVersion) {
          throw createPricingSettingsRepositoryError(
            'pricing/stale-version',
            `Konfigurasi telah diperbarui di sesi lain (versi saat ini v${currentVersion}). Muat versi terbaru sebelum menyimpan agar tidak menimpa perubahan.`,
            { currentVersion, expectedVersion },
          );
        }

        const nextVersion = currentVersion > 0 ? currentVersion + 1 : 1;
        const firestoreDoc = {
          schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
          serviceTypes: payload.serviceTypes,
          operationalSettings: payload.operationalSettings,
          version: nextVersion,
          updatedAt: serverTimestamp(),
          updatedByUid: actorUid,
        };

        tx.set(settingsRef, firestoreDoc);

        return normalizePricingSettings({
          ...firestoreDoc,
          updatedAt: new Date(),
        });
      });
    },
  };
}

/**
 * In-memory realtime & transactional adapter for deterministic testing across
 * Settings UI, V1 -> V2 migration preview, and Calendar Booking Form without network dependencies.
 */
export function createInMemoryPricingSettingsAdapter(initialDoc = null) {
  // Store raw doc so legacy V1 seed preserves `migratedFromV1` detection without auto-writing V2
  let storedRawDoc = initialDoc ? structuredClone(initialDoc) : null;
  let queuedSaveError = null;
  const listeners = new Set();

  function buildEmitPayload() {
    if (!storedRawDoc) {
      return {
        settings: clonePricingSettings(DEFAULT_PRICING_SETTINGS),
        isPersisted: false,
        migratedFromV1: false,
      };
    }

    const migratedFromV1 = isLegacyV1PricingSettings(storedRawDoc);
    return {
      settings: normalizePricingSettings(storedRawDoc),
      isPersisted: true,
      migratedFromV1,
    };
  }

  function emitSnapshot() {
    const payload = buildEmitPayload();
    listeners.forEach((listener) => {
      listener.onData?.(payload);
    });
  }

  return {
    subscribePricingSettings({ onData, onError }) {
      const entry = { onData, onError };
      listeners.add(entry);

      queueMicrotask(() => {
        if (!listeners.has(entry)) return;
        onData?.(buildEmitPayload());
      });

      return () => {
        listeners.delete(entry);
      };
    },

    async savePricingSettingsTransaction({ actorUid, payload, expectedVersion }) {
      if (queuedSaveError) {
        const errToThrow = queuedSaveError;
        queuedSaveError = null;
        throw errToThrow;
      }

      const currentVersion = storedRawDoc ? Number(storedRawDoc.version) || 1 : 0;
      if (Number.isInteger(expectedVersion) && currentVersion !== expectedVersion) {
        throw createPricingSettingsRepositoryError(
          'pricing/stale-version',
          `Konfigurasi telah diperbarui di sesi lain (versi saat ini v${currentVersion}). Muat versi terbaru sebelum menyimpan agar tidak menimpa perubahan.`,
          { currentVersion, expectedVersion },
        );
      }

      const nextVersion = currentVersion > 0 ? currentVersion + 1 : 1;
      storedRawDoc = normalizePricingSettings({
        schemaVersion: PRICING_SETTINGS_SCHEMA_VERSION,
        serviceTypes: payload.serviceTypes,
        operationalSettings: payload.operationalSettings,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        updatedByUid: actorUid,
      });

      emitSnapshot();
      return clonePricingSettings(storedRawDoc);
    },

    _seedRemoteDoc(nextDoc) {
      storedRawDoc = nextDoc ? structuredClone(nextDoc) : null;
      emitSnapshot();
    },

    _setNextSaveError(err) {
      queuedSaveError = err;
    },

    _getStoredDoc() {
      return storedRawDoc ? structuredClone(storedRawDoc) : null;
    },
  };
}

let activePricingAdapter = createFirestorePricingSettingsAdapter();

export function getPricingSettingsRepositoryAdapter() {
  return activePricingAdapter;
}

export function setPricingSettingsRepositoryAdapter(customAdapter) {
  activePricingAdapter = customAdapter || createFirestorePricingSettingsAdapter();
}

export function resetPricingSettingsRepositoryAdapter() {
  activePricingAdapter = createFirestorePricingSettingsAdapter();
}
