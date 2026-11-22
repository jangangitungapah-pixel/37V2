import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  PUBLIC_SITE_SETTINGS_COLLECTION,
  PUBLIC_SITE_SETTINGS_DOC_ID,
} from '../config/public-site-settings-config';
import {
  buildSanitizedPublicSiteSettingsWriteDoc,
  normalizePublicSiteSettings,
} from '../utils/public-site-settings-normalize';

/**
 * Cloud Firestore repository adapter for `publicSiteSettings/site`.
 * Strictly read-safe: never auto-creates or writes during initial subscription.
 */
export function createFirestorePublicSiteSettingsAdapter() {
  return {
    subscribePublicSiteSettings({ onData, onError }) {
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
          const settingsRef = doc(db, PUBLIC_SITE_SETTINGS_COLLECTION, PUBLIC_SITE_SETTINGS_DOC_ID);

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
                  settings: structuredClone(DEFAULT_PUBLIC_SITE_SETTINGS),
                  isPersisted: false,
                });
                return;
              }

              onData?.({
                settings: normalizePublicSiteSettings(snapshot.data()),
                isPersisted: true,
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

    async savePublicSiteSettings({ studioProfilePayload, publicSettingsInput }) {
      const [{ doc, getDoc, serverTimestamp, setDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const settingsRef = doc(db, PUBLIC_SITE_SETTINGS_COLLECTION, PUBLIC_SITE_SETTINGS_DOC_ID);
      const existingSnap = await getDoc(settingsRef);
      const existing = existingSnap.exists() ? existingSnap.data() : DEFAULT_PUBLIC_SITE_SETTINGS;

      const writeDoc = buildSanitizedPublicSiteSettingsWriteDoc({
        studioProfilePayload,
        publicSettingsInput,
        fallbackPublicSettings: existing,
        timestampValue: serverTimestamp(),
      });

      await setDoc(settingsRef, writeDoc);

      return normalizePublicSiteSettings({
        ...writeDoc,
        updatedAt: new Date(),
      });
    },
  };
}

/**
 * Deterministic in-memory realtime adapter for `publicSiteSettings/site` tests.
 */
export function createInMemoryPublicSiteSettingsAdapter(initialDoc = null) {
  let storedRawDoc = initialDoc ? normalizePublicSiteSettings(initialDoc) : null;
  const listeners = new Set();

  function buildEmitPayload() {
    if (!storedRawDoc) {
      return {
        settings: structuredClone(DEFAULT_PUBLIC_SITE_SETTINGS),
        isPersisted: false,
      };
    }

    return {
      settings: normalizePublicSiteSettings(storedRawDoc),
      isPersisted: true,
    };
  }

  function emitSnapshot() {
    const payload = buildEmitPayload();
    listeners.forEach((entry) => {
      entry.onData?.(payload);
    });
  }

  return {
    subscribePublicSiteSettings({ onData, onError }) {
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

    async savePublicSiteSettings({ studioProfilePayload, publicSettingsInput }) {
      const writeDoc = buildSanitizedPublicSiteSettingsWriteDoc({
        studioProfilePayload,
        publicSettingsInput,
        fallbackPublicSettings: storedRawDoc || DEFAULT_PUBLIC_SITE_SETTINGS,
        timestampValue: new Date().toISOString(),
      });

      storedRawDoc = normalizePublicSiteSettings(writeDoc);
      emitSnapshot();
      return structuredClone(storedRawDoc);
    },

    _syncFromRawDoc(nextDoc) {
      storedRawDoc = nextDoc ? normalizePublicSiteSettings(nextDoc) : null;
      emitSnapshot();
    },

    _seedRemoteDoc(nextDoc) {
      storedRawDoc = nextDoc ? normalizePublicSiteSettings(nextDoc) : null;
      emitSnapshot();
    },

    _getStoredDoc() {
      return storedRawDoc ? structuredClone(storedRawDoc) : null;
    },
  };
}

let activePublicSiteSettingsAdapter = createFirestorePublicSiteSettingsAdapter();

export function getPublicSiteSettingsRepositoryAdapter() {
  return activePublicSiteSettingsAdapter;
}

export function setPublicSiteSettingsRepositoryAdapter(customAdapter) {
  activePublicSiteSettingsAdapter = customAdapter || createFirestorePublicSiteSettingsAdapter();
}

export function resetPublicSiteSettingsRepositoryAdapter() {
  activePublicSiteSettingsAdapter = createFirestorePublicSiteSettingsAdapter();
}
