import { BOOKING_REQUEST_TEMPLATES_COLLECTION } from '../config/booking-request-config';
import {
  ALLOWLISTED_TEMPLATE_VARIABLES,
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_CATEGORIES,
} from '../config/default-whatsapp-templates';

const ALLOWLIST_SET = new Set(ALLOWLISTED_TEMPLATE_VARIABLES);
const VALID_CATEGORIES = new Set(Object.values(WHATSAPP_TEMPLATE_CATEGORIES));

export function normalizeWhatsAppTemplate(id, raw = {}, fallbackBuiltIn = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const def = fallbackBuiltIn || {};
  const cleanId = String(id || source.id || def.id || '').trim();
  const category = VALID_CATEGORIES.has(source.category)
    ? source.category
    : def.category || WHATSAPP_TEMPLATE_CATEGORIES.FOLLOW_UP;

  const rawAllowed = Array.isArray(source.allowedVariables)
    ? source.allowedVariables.filter((v) => ALLOWLIST_SET.has(v))
    : def.allowedVariables || [];
  const rawRequired = Array.isArray(source.requiredVariables)
    ? source.requiredVariables.filter((v) => ALLOWLIST_SET.has(v))
    : def.requiredVariables || [];

  return {
    schemaVersion: 1,
    id: cleanId,
    label: String(source.label || def.label || cleanId).trim(),
    category,
    description: String(source.description ?? def.description ?? '').trim(),
    body: String(source.body ?? def.body ?? ''),
    allowedVariables: rawAllowed,
    requiredVariables: rawRequired,
    requiresConfirmedBooking:
      typeof source.requiresConfirmedBooking === 'boolean'
        ? source.requiresConfirmedBooking
        : Boolean(def.requiresConfirmedBooking),
    isActive: typeof source.isActive === 'boolean' ? source.isActive : def.isActive !== false,
    isBuiltIn: Boolean(def.id || source.isBuiltIn),
    sortOrder: Number.isInteger(Number(source.sortOrder))
      ? Number(source.sortOrder)
      : Number(def.sortOrder) || 99,
    version: Number.isInteger(Number(source.version)) ? Number(source.version) : 1,
    updatedAt: source.updatedAt ?? null,
    updatedByUid: String(source.updatedByUid || '').trim(),
  };
}

export function mergeWithDefaultWhatsAppTemplates(persistedDocs = []) {
  const persistedById = new Map();
  for (const docItem of persistedDocs || []) {
    if (docItem?.id) {
      persistedById.set(docItem.id, docItem);
    }
  }

  const merged = [];
  for (const def of DEFAULT_WHATSAPP_TEMPLATES) {
    const custom = persistedById.get(def.id);
    if (custom) {
      merged.push(normalizeWhatsAppTemplate(def.id, custom, def));
      persistedById.delete(def.id);
    } else {
      merged.push(normalizeWhatsAppTemplate(def.id, def, def));
    }
  }

  for (const [id, docItem] of persistedById.entries()) {
    merged.push(normalizeWhatsAppTemplate(id, docItem, null));
  }

  return merged.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/**
 * Cloud Firestore adapter for `bookingRequestMessageTemplates/{templateId}`.
 * Read-safe: merges Firestore documents with code defaults without writing on initial read.
 */
export function createFirestoreWhatsAppTemplateRepositoryAdapter() {
  return {
    subscribeTemplates({ onData, onError }) {
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
          const q = query(collection(db, BOOKING_REQUEST_TEMPLATES_COLLECTION), limit(50));

          unsubscribe = onSnapshot(
            q,
            (snapshot) => {
              if (isCancelled) return;
              const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
              onData?.(mergeWithDefaultWhatsAppTemplates(docs));
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

    async saveTemplate({ templateId, templateDoc, actorUid }) {
      const [{ doc, getDoc, serverTimestamp, setDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const ref = doc(db, BOOKING_REQUEST_TEMPLATES_COLLECTION, templateId);
      const existingSnap = await getDoc(ref);
      const nextVersion = existingSnap.exists()
        ? (Number(existingSnap.data()?.version) || 1) + 1
        : 1;

      const writePayload = {
        schemaVersion: 1,
        label: templateDoc.label,
        category: templateDoc.category,
        description: templateDoc.description,
        body: templateDoc.body,
        allowedVariables: templateDoc.allowedVariables,
        requiredVariables: templateDoc.requiredVariables,
        requiresConfirmedBooking: Boolean(templateDoc.requiresConfirmedBooking),
        isActive: templateDoc.isActive !== false,
        isBuiltIn: Boolean(templateDoc.isBuiltIn),
        sortOrder: Number(templateDoc.sortOrder) || 99,
        version: nextVersion,
        updatedAt: serverTimestamp(),
        updatedByUid: actorUid,
      };

      await setDoc(ref, writePayload);
      const builtIn = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === templateId) || null;
      return normalizeWhatsAppTemplate(
        templateId,
        { ...writePayload, updatedAt: new Date() },
        builtIn,
      );
    },
  };
}

/**
 * Deterministic in-memory adapter for WhatsApp template management tests.
 */
export function createInMemoryWhatsAppTemplateRepositoryAdapter(initialPersistedDocs = []) {
  const storedById = new Map();
  const subscribers = new Set();

  for (const docItem of initialPersistedDocs || []) {
    if (docItem?.id) {
      storedById.set(docItem.id, structuredClone(docItem));
    }
  }

  function emit() {
    const merged = mergeWithDefaultWhatsAppTemplates(Array.from(storedById.values()));
    subscribers.forEach((entry) => entry.onData?.(merged));
  }

  return {
    subscribeTemplates({ onData, onError }) {
      const entry = { onData, onError };
      subscribers.add(entry);
      queueMicrotask(() => {
        if (!subscribers.has(entry)) return;
        onData?.(mergeWithDefaultWhatsAppTemplates(Array.from(storedById.values())));
      });
      return () => {
        subscribers.delete(entry);
      };
    },

    async saveTemplate({ templateId, templateDoc, actorUid }) {
      const prev = storedById.get(templateId);
      const nextVersion = prev ? (Number(prev.version) || 1) + 1 : 1;
      const nowIso = new Date().toISOString();
      const builtIn = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === templateId) || null;

      const writePayload = {
        schemaVersion: 1,
        id: templateId,
        label: templateDoc.label,
        category: templateDoc.category,
        description: templateDoc.description,
        body: templateDoc.body,
        allowedVariables: [...templateDoc.allowedVariables],
        requiredVariables: [...templateDoc.requiredVariables],
        requiresConfirmedBooking: Boolean(templateDoc.requiresConfirmedBooking),
        isActive: templateDoc.isActive !== false,
        isBuiltIn: Boolean(builtIn || templateDoc.isBuiltIn),
        sortOrder: Number(templateDoc.sortOrder) || 99,
        version: nextVersion,
        updatedAt: nowIso,
        updatedByUid: actorUid,
      };

      storedById.set(templateId, writePayload);
      emit();
      return normalizeWhatsAppTemplate(templateId, writePayload, builtIn);
    },

    _getStoredTemplates() {
      return new Map(storedById);
    },
  };
}

let activeWhatsAppTemplateAdapter = createFirestoreWhatsAppTemplateRepositoryAdapter();

export function getWhatsAppTemplateRepositoryAdapter() {
  return activeWhatsAppTemplateAdapter;
}

export function setWhatsAppTemplateRepositoryAdapter(customAdapter) {
  activeWhatsAppTemplateAdapter =
    customAdapter || createFirestoreWhatsAppTemplateRepositoryAdapter();
}

export function resetWhatsAppTemplateRepositoryAdapter() {
  activeWhatsAppTemplateAdapter = createFirestoreWhatsAppTemplateRepositoryAdapter();
}
