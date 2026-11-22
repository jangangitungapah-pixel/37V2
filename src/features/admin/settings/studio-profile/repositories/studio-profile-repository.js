import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  PUBLIC_SITE_SETTINGS_COLLECTION,
  PUBLIC_SITE_SETTINGS_DOC_ID,
} from '@/features/public-site-settings/config/public-site-settings-config';
import { getPublicSiteSettingsRepositoryAdapter } from '@/features/public-site-settings/repositories/public-site-settings-repository';
import {
  buildSanitizedPublicSiteSettingsWriteDoc,
  normalizePublicSiteSettings,
} from '@/features/public-site-settings/utils/public-site-settings-normalize';

import {
  DEFAULT_STUDIO_PROFILE,
  STUDIO_PROFILE_COLLECTION,
  STUDIO_PROFILE_DOC_ID,
  STUDIO_PROFILE_SCHEMA_VERSION,
} from '../config/default-studio-profile';
import { cloneStudioProfile, normalizeStudioProfile } from '../utils/normalize-studio-profile';

export function createStudioProfileRepositoryError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Cloud Firestore repository adapter for `settings/studioProfile`.
 * Strictly read-safe: never auto-creates or auto-writes on initial subscription.
 */
export function createFirestoreStudioProfileAdapter() {
  return {
    subscribeStudioProfile({ onData, onError }) {
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
          const profileRef = doc(db, STUDIO_PROFILE_COLLECTION, STUDIO_PROFILE_DOC_ID);

          unsubscribe = onSnapshot(
            profileRef,
            (snapshot) => {
              if (isCancelled) return;
              const docExists =
                typeof snapshot?.exists === 'function'
                  ? snapshot.exists()
                  : Boolean(snapshot?.exists);

              if (!docExists) {
                onData?.({
                  profile: cloneStudioProfile(DEFAULT_STUDIO_PROFILE),
                  isPersisted: false,
                });
                return;
              }

              onData?.({
                profile: normalizeStudioProfile(snapshot.data()),
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

    async saveStudioProfileTransaction({
      actorUid,
      payload,
      expectedVersion,
      publicSiteSettingsInput = null,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const profileRef = doc(db, STUDIO_PROFILE_COLLECTION, STUDIO_PROFILE_DOC_ID);
      const publicSiteRef = doc(db, PUBLIC_SITE_SETTINGS_COLLECTION, PUBLIC_SITE_SETTINGS_DOC_ID);

      return runTransaction(db, async (tx) => {
        // 1. All reads first
        const [snap, publicSnap] = await Promise.all([tx.get(profileRef), tx.get(publicSiteRef)]);
        const currentVersion = snap.exists() ? Number(snap.data()?.version) || 1 : 0;

        if (Number.isInteger(expectedVersion) && currentVersion !== expectedVersion) {
          throw createStudioProfileRepositoryError(
            'studio-profile/stale-version',
            `Profil studio telah diperbarui di sesi lain (versi saat ini v${currentVersion}). Muat data terbaru sebelum menyimpan agar tidak menimpa perubahan.`,
            { currentVersion, expectedVersion },
          );
        }

        const existingPublicDoc = publicSnap.exists()
          ? publicSnap.data()
          : DEFAULT_PUBLIC_SITE_SETTINGS;

        const nextVersion = currentVersion > 0 ? currentVersion + 1 : 1;
        const tsValue = serverTimestamp();
        const firestoreDoc = {
          schemaVersion: STUDIO_PROFILE_SCHEMA_VERSION,
          studioName: payload.studioName,
          tagline: payload.tagline,
          whatsappNumber: payload.whatsappNumber,
          email: payload.email,
          address: payload.address,
          city: payload.city,
          mapsUrl: payload.mapsUrl,
          version: nextVersion,
          updatedAt: tsValue,
          updatedByUid: actorUid,
        };

        const sanitizedPublicDoc = buildSanitizedPublicSiteSettingsWriteDoc({
          studioProfilePayload: payload,
          publicSettingsInput: publicSiteSettingsInput,
          fallbackPublicSettings: existingPublicDoc,
          timestampValue: tsValue,
        });

        // 2. Atomic writes: private studio profile + sanitized public site projection
        tx.set(profileRef, firestoreDoc);
        tx.set(publicSiteRef, sanitizedPublicDoc);

        return normalizeStudioProfile({
          ...firestoreDoc,
          updatedAt: new Date(),
        });
      });
    },
  };
}

/**
 * Deterministic in-memory realtime & transactional adapter for tests.
 */
export function createInMemoryStudioProfileAdapter(
  initialDoc = null,
  linkedPublicSiteAdapter = null,
) {
  let storedRawDoc = initialDoc ? structuredClone(initialDoc) : null;
  let storedPublicDoc = null;
  let queuedSaveError = null;
  const listeners = new Set();

  function buildEmitPayload() {
    if (!storedRawDoc) {
      return {
        profile: cloneStudioProfile(DEFAULT_STUDIO_PROFILE),
        isPersisted: false,
      };
    }

    return {
      profile: normalizeStudioProfile(storedRawDoc),
      isPersisted: true,
    };
  }

  function emitSnapshot() {
    const payload = buildEmitPayload();
    listeners.forEach((listener) => {
      listener.onData?.(payload);
    });
  }

  return {
    subscribeStudioProfile({ onData, onError }) {
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

    async saveStudioProfileTransaction({
      actorUid,
      payload,
      expectedVersion,
      publicSiteSettingsInput = null,
    }) {
      if (queuedSaveError) {
        const errToThrow = queuedSaveError;
        queuedSaveError = null;
        throw errToThrow;
      }

      const currentVersion = storedRawDoc ? Number(storedRawDoc.version) || 1 : 0;
      if (Number.isInteger(expectedVersion) && currentVersion !== expectedVersion) {
        throw createStudioProfileRepositoryError(
          'studio-profile/stale-version',
          `Profil studio telah diperbarui di sesi lain (versi saat ini v${currentVersion}). Muat data terbaru sebelum menyimpan agar tidak menimpa perubahan.`,
          { currentVersion, expectedVersion },
        );
      }

      const nextVersion = currentVersion > 0 ? currentVersion + 1 : 1;
      const nowIso = new Date().toISOString();
      const targetPublicAdapter =
        linkedPublicSiteAdapter || getPublicSiteSettingsRepositoryAdapter();
      const fallbackPublic =
        targetPublicAdapter?._getStoredDoc?.() || storedPublicDoc || DEFAULT_PUBLIC_SITE_SETTINGS;

      const nextPublicDoc = buildSanitizedPublicSiteSettingsWriteDoc({
        studioProfilePayload: payload,
        publicSettingsInput: publicSiteSettingsInput,
        fallbackPublicSettings: fallbackPublic,
        timestampValue: nowIso,
      });

      storedRawDoc = normalizeStudioProfile({
        schemaVersion: STUDIO_PROFILE_SCHEMA_VERSION,
        studioName: payload.studioName,
        tagline: payload.tagline,
        whatsappNumber: payload.whatsappNumber,
        email: payload.email,
        address: payload.address,
        city: payload.city,
        mapsUrl: payload.mapsUrl,
        version: nextVersion,
        updatedAt: nowIso,
        updatedByUid: actorUid,
      });

      storedPublicDoc = normalizePublicSiteSettings(nextPublicDoc);
      targetPublicAdapter?._syncFromRawDoc?.(nextPublicDoc);

      emitSnapshot();
      return cloneStudioProfile(storedRawDoc);
    },

    _getPublicSiteDoc() {
      return storedPublicDoc ? structuredClone(storedPublicDoc) : null;
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

let activeStudioProfileAdapter = createFirestoreStudioProfileAdapter();

export function getStudioProfileRepositoryAdapter() {
  return activeStudioProfileAdapter;
}

export function setStudioProfileRepositoryAdapter(customAdapter) {
  activeStudioProfileAdapter = customAdapter || createFirestoreStudioProfileAdapter();
}

export function resetStudioProfileRepositoryAdapter() {
  activeStudioProfileAdapter = createFirestoreStudioProfileAdapter();
}
