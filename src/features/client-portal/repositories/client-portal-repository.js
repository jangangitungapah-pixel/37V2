import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { normalizeEmailIndexRecord } from '@/features/admin/customer/schemas/customer-schema';
import { STAFF_PROFILES_COLLECTION } from '@/features/auth/staff-profile-service';
import { isFirebaseConfigured } from '@/lib/firebase/client';

import {
  CLIENT_ACCOUNT_STATUS,
  CLIENT_PORTAL_SCHEMA_VERSION,
  CLIENT_PROFILE_SOURCE,
  CLIENT_ROLE,
} from '../config/client-portal-config';
import {
  buildIsolatedClientCustomerId,
  normalizeClientAccountRecord,
  normalizeClientProfileRecord,
} from '../utils/client-auth-helpers';

function createRepositoryError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function buildNewClientAccountPayload({
  uid,
  customerId,
  profileSource,
  emailNormalized,
  displayName,
  photoURL,
  authProvider = 'google.com',
  emailVerified = true,
  timestamp,
}) {
  return {
    schemaVersion: CLIENT_PORTAL_SCHEMA_VERSION,
    uid,
    role: CLIENT_ROLE,
    status: CLIENT_ACCOUNT_STATUS.ACTIVE,
    customerId,
    profileSource,
    emailNormalized,
    displayName,
    photoURL,
    authProvider,
    emailVerified: Boolean(emailVerified),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

function buildNewClientCustomerLinkPayload({
  customerId,
  ownerUid,
  emailNormalized,
  profileSource,
  timestamp,
}) {
  return {
    schemaVersion: CLIENT_PORTAL_SCHEMA_VERSION,
    customerId,
    ownerUid,
    emailNormalized,
    profileSource,
    createdAt: timestamp,
    version: 1,
  };
}

function buildIsolatedProfilePayload({
  isolatedCustomerId,
  ownerUid,
  emailNormalized,
  displayName,
  photoURL,
  timestamp,
}) {
  return {
    schemaVersion: CLIENT_PORTAL_SCHEMA_VERSION,
    customerId: isolatedCustomerId,
    ownerUid,
    profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
    displayName,
    emailNormalized,
    phoneDisplay: '',
    photoURL,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

export function createFirestoreClientPortalRepositoryAdapter() {
  return {
    async hasStaffProfile(uid) {
      if (!uid || !isFirebaseConfigured()) {
        return { exists: false, active: false, data: null };
      }
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const snap = await getDoc(doc(getFirebaseDb(), STAFF_PROFILES_COLLECTION, uid));
      if (!snap.exists()) {
        return { exists: false, active: false, data: null };
      }
      const data = snap.data() || {};
      return {
        exists: true,
        active: data.active === true,
        data,
      };
    },

    async getClientAccount(uid) {
      if (!uid || !isFirebaseConfigured()) {
        return null;
      }
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const snap = await getDoc(doc(getFirebaseDb(), FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid));
      return snap.exists() ? normalizeClientAccountRecord(snap.id, snap.data()) : null;
    },

    subscribeClientAccount(uid, { onData, onError } = {}) {
      if (!uid || !isFirebaseConfigured()) {
        queueMicrotask(() => onData?.(null));
        return () => {};
      }

      let isCancelled = false;
      let unsubscribe = null;

      (async () => {
        try {
          const [{ doc, onSnapshot }, { getFirebaseDb }] = await Promise.all([
            import('firebase/firestore'),
            import('@/lib/firebase/firestore'),
          ]);
          if (isCancelled) return;
          if (typeof onSnapshot !== 'function') {
            return;
          }

          const ref = doc(getFirebaseDb(), FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid);
          unsubscribe = onSnapshot(
            ref,
            (snap) => {
              if (isCancelled) return;
              onData?.(snap.exists() ? normalizeClientAccountRecord(snap.id, snap.data()) : null);
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

    async getClientProfile(customerId) {
      if (!customerId || !isFirebaseConfigured()) {
        return null;
      }
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const snap = await getDoc(
        doc(getFirebaseDb(), FIRESTORE_COLLECTIONS.CLIENT_PROFILES, customerId),
      );
      return snap.exists() ? normalizeClientProfileRecord(snap.id, snap.data()) : null;
    },

    async getEmailIndexForOwnEmail(emailNormalized) {
      if (!emailNormalized || !isFirebaseConfigured()) {
        return null;
      }
      const [{ doc, getDoc }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      try {
        const snap = await getDoc(
          doc(getFirebaseDb(), FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized),
        );
        return snap.exists() ? normalizeEmailIndexRecord(snap.id, snap.data()) : null;
      } catch (err) {
        const code = String(err?.code || '').toLowerCase();
        if (code.includes('permission-denied')) {
          return null;
        }
        throw err;
      }
    },

    async provisionClientAccountLinked({
      uid,
      emailNormalized,
      displayName,
      photoURL,
      matchedCustomerId,
      authProvider = 'google.com',
      emailVerified = true,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const [staffSnap, existingAccountSnap, indexSnap] = await Promise.all([
          tx.get(doc(db, STAFF_PROFILES_COLLECTION, uid)),
          tx.get(doc(db, FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid)),
          tx.get(doc(db, FIRESTORE_COLLECTIONS.CUSTOMER_EMAIL_INDEX, emailNormalized)),
        ]);

        if (staffSnap.exists()) {
          throw createRepositoryError(
            'client/staff-account-blocked',
            'Akun ini terdaftar sebagai akun internal studio.',
          );
        }

        if (existingAccountSnap.exists()) {
          return {
            account: normalizeClientAccountRecord(uid, existingAccountSnap.data()),
            alreadyExisted: true,
          };
        }

        const emailIndexRecord = indexSnap.exists()
          ? normalizeEmailIndexRecord(indexSnap.id, indexSnap.data())
          : null;

        if (
          !emailIndexRecord ||
          emailIndexRecord.status !== 'active' ||
          emailIndexRecord.customerId !== matchedCustomerId
        ) {
          throw createRepositoryError(
            'client/link-conflict',
            'Customer mapping untuk email ini tidak lagi aktif atau valid.',
          );
        }

        const nowServer = serverTimestamp();
        const nowIso = new Date().toISOString();
        const accountPayload = buildNewClientAccountPayload({
          uid,
          customerId: matchedCustomerId,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          emailNormalized,
          displayName,
          photoURL,
          authProvider,
          emailVerified,
          timestamp: nowServer,
        });
        const linkPayload = buildNewClientCustomerLinkPayload({
          customerId: matchedCustomerId,
          ownerUid: uid,
          emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          timestamp: nowServer,
        });

        tx.set(doc(db, FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid), accountPayload);
        tx.set(
          doc(db, FIRESTORE_COLLECTIONS.CLIENT_CUSTOMER_LINKS, matchedCustomerId),
          linkPayload,
        );

        return {
          account: normalizeClientAccountRecord(uid, {
            ...accountPayload,
            createdAt: nowIso,
            updatedAt: nowIso,
          }),
          alreadyExisted: false,
        };
      });
    },

    async provisionClientAccountIsolated({
      uid,
      emailNormalized,
      displayName,
      photoURL,
      authProvider = 'google.com',
      emailVerified = true,
    }) {
      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();
      const isolatedCustomerId = buildIsolatedClientCustomerId(uid);

      return runTransaction(db, async (tx) => {
        const [staffSnap, existingAccountSnap] = await Promise.all([
          tx.get(doc(db, STAFF_PROFILES_COLLECTION, uid)),
          tx.get(doc(db, FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid)),
        ]);

        if (staffSnap.exists()) {
          throw createRepositoryError(
            'client/staff-account-blocked',
            'Akun ini terdaftar sebagai akun internal studio.',
          );
        }

        if (existingAccountSnap.exists()) {
          return {
            account: normalizeClientAccountRecord(uid, existingAccountSnap.data()),
            alreadyExisted: true,
          };
        }

        const nowServer = serverTimestamp();
        const nowIso = new Date().toISOString();
        const accountPayload = buildNewClientAccountPayload({
          uid,
          customerId: isolatedCustomerId,
          profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
          emailNormalized,
          displayName,
          photoURL,
          authProvider,
          emailVerified,
          timestamp: nowServer,
        });
        const linkPayload = buildNewClientCustomerLinkPayload({
          customerId: isolatedCustomerId,
          ownerUid: uid,
          emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
          timestamp: nowServer,
        });
        const isolatedProfilePayload = buildIsolatedProfilePayload({
          isolatedCustomerId,
          ownerUid: uid,
          emailNormalized,
          displayName,
          photoURL,
          timestamp: nowServer,
        });

        tx.set(doc(db, FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, uid), accountPayload);
        tx.set(
          doc(db, FIRESTORE_COLLECTIONS.CLIENT_CUSTOMER_LINKS, isolatedCustomerId),
          linkPayload,
        );
        tx.set(
          doc(db, FIRESTORE_COLLECTIONS.CLIENT_PROFILES, isolatedCustomerId),
          isolatedProfilePayload,
        );

        return {
          account: normalizeClientAccountRecord(uid, {
            ...accountPayload,
            createdAt: nowIso,
            updatedAt: nowIso,
          }),
          alreadyExisted: false,
        };
      });
    },
  };
}

/**
 * Shared in-memory Client Portal repository adapter for unit and UI integration tests.
 * Can attach directly to `createInMemoryCustomerRepositoryAdapter()` via `_clientBridge`.
 */
export function createInMemoryClientPortalRepositoryAdapter(customerAdapterOrBridge = null) {
  const bridge = customerAdapterOrBridge?._clientBridge || null;

  const staffProfilesMap = new Map();
  const clientAccountsMap = new Map();
  const clientCustomerLinksMap = new Map();
  const emailIndexMap = bridge?.emailIndex || new Map();
  const clientProfilesMap = bridge?.clientProfiles || new Map();
  const subscribersByUid = new Map();

  let localQueue = Promise.resolve();
  function runSerial(work) {
    if (bridge?.enqueueTx) {
      return bridge.enqueueTx(work);
    }
    const next = localQueue.then(work);
    localQueue = next.catch(() => {});
    return next;
  }

  function notifyUid(uid) {
    const subs = subscribersByUid.get(uid);
    if (!subs) return;
    const raw = clientAccountsMap.get(uid);
    const snap = raw ? normalizeClientAccountRecord(uid, raw) : null;
    for (const cb of subs) {
      cb?.(snap);
    }
  }

  return {
    _inspectState() {
      return {
        staffProfiles: new Map(staffProfilesMap),
        clientAccounts: new Map(clientAccountsMap),
        clientCustomerLinks: new Map(clientCustomerLinksMap),
        emailIndex: new Map(emailIndexMap),
        clientProfiles: new Map(clientProfilesMap),
      };
    },

    _seedStaffProfile(uid, data = {}) {
      staffProfilesMap.set(uid, { uid, role: 'staff', active: true, ...data });
    },

    _seedEmailIndex(emailNormalized, data = {}) {
      const normalized = normalizeEmailIndexRecord(emailNormalized, data);
      emailIndexMap.set(normalized.emailNormalized, normalized);
    },

    _seedClientProfile(customerId, data = {}) {
      clientProfilesMap.set(
        customerId,
        normalizeClientProfileRecord(customerId, {
          schemaVersion: 1,
          customerId,
          status: 'active',
          ...data,
        }),
      );
    },

    _seedClientAccount(uid, data = {}) {
      const rec = normalizeClientAccountRecord(uid, {
        schemaVersion: 1,
        uid,
        role: CLIENT_ROLE,
        status: CLIENT_ACCOUNT_STATUS.ACTIVE,
        authProvider: 'google.com',
        emailVerified: true,
        ...data,
      });
      clientAccountsMap.set(uid, rec);
      notifyUid(uid);
    },

    _seedClientCustomerLink(customerId, data = {}) {
      clientCustomerLinksMap.set(customerId, {
        schemaVersion: 1,
        customerId,
        ...data,
      });
    },

    _setClientAccountStatus(uid, nextStatus) {
      const prev = clientAccountsMap.get(uid);
      if (!prev) return;
      clientAccountsMap.set(uid, {
        ...prev,
        status: nextStatus,
        version: (Number(prev.version) || 1) + 1,
        updatedAt: new Date().toISOString(),
      });
      notifyUid(uid);
    },

    _setClientAccountBinding(uid, customerId) {
      const prev = clientAccountsMap.get(uid);
      if (!prev) return;
      clientAccountsMap.set(uid, {
        ...prev,
        customerId,
        version: (Number(prev.version) || 1) + 1,
      });
      notifyUid(uid);
    },

    async hasStaffProfile(uid) {
      const staff = staffProfilesMap.get(uid);
      if (!staff) {
        return { exists: false, active: false, data: null };
      }
      return {
        exists: true,
        active: staff.active === true,
        data: { ...staff },
      };
    },

    async getClientAccount(uid) {
      const existing = clientAccountsMap.get(uid);
      return existing ? normalizeClientAccountRecord(uid, existing) : null;
    },

    subscribeClientAccount(uid, { onData } = {}) {
      if (!uid) {
        queueMicrotask(() => onData?.(null));
        return () => {};
      }
      if (!subscribersByUid.has(uid)) {
        subscribersByUid.set(uid, new Set());
      }
      subscribersByUid.get(uid).add(onData);
      queueMicrotask(() => {
        const existing = clientAccountsMap.get(uid);
        onData?.(existing ? normalizeClientAccountRecord(uid, existing) : null);
      });
      return () => {
        subscribersByUid.get(uid)?.delete(onData);
      };
    },

    async getClientProfile(customerId) {
      const existing = clientProfilesMap.get(customerId);
      return existing ? normalizeClientProfileRecord(customerId, existing) : null;
    },

    async getEmailIndexForOwnEmail(emailNormalized) {
      const existing = emailIndexMap.get(emailNormalized);
      return existing ? normalizeEmailIndexRecord(emailNormalized, existing) : null;
    },

    async provisionClientAccountLinked({
      uid,
      emailNormalized,
      displayName,
      photoURL,
      matchedCustomerId,
      authProvider = 'google.com',
      emailVerified = true,
    }) {
      return runSerial(async () => {
        if (staffProfilesMap.has(uid)) {
          throw createRepositoryError(
            'client/staff-account-blocked',
            'Akun ini terdaftar sebagai akun internal studio.',
          );
        }

        if (clientAccountsMap.has(uid)) {
          return {
            account: normalizeClientAccountRecord(uid, clientAccountsMap.get(uid)),
            alreadyExisted: true,
          };
        }

        const idx = emailIndexMap.get(emailNormalized);
        const profile = clientProfilesMap.get(matchedCustomerId);
        if (
          !idx ||
          idx.status !== 'active' ||
          idx.customerId !== matchedCustomerId ||
          !profile ||
          profile.status !== 'active'
        ) {
          throw createRepositoryError('client/link-conflict', 'Customer mapping tidak lagi valid.');
        }

        const existingLink = clientCustomerLinksMap.get(matchedCustomerId);
        if (existingLink && existingLink.ownerUid !== uid) {
          throw createRepositoryError(
            'permission-denied',
            'Customer profile telah tertaut pada akun lain.',
          );
        }

        const nowIso = new Date().toISOString();
        const account = normalizeClientAccountRecord(
          uid,
          buildNewClientAccountPayload({
            uid,
            customerId: matchedCustomerId,
            profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
            emailNormalized,
            displayName,
            photoURL,
            authProvider,
            emailVerified,
            timestamp: nowIso,
          }),
        );
        const link = buildNewClientCustomerLinkPayload({
          customerId: matchedCustomerId,
          ownerUid: uid,
          emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          timestamp: nowIso,
        });

        clientAccountsMap.set(uid, account);
        clientCustomerLinksMap.set(matchedCustomerId, link);
        notifyUid(uid);

        return { account: { ...account }, alreadyExisted: false };
      });
    },

    async provisionClientAccountIsolated({
      uid,
      emailNormalized,
      displayName,
      photoURL,
      authProvider = 'google.com',
      emailVerified = true,
    }) {
      return runSerial(async () => {
        if (staffProfilesMap.has(uid)) {
          throw createRepositoryError(
            'client/staff-account-blocked',
            'Akun ini terdaftar sebagai akun internal studio.',
          );
        }

        if (clientAccountsMap.has(uid)) {
          return {
            account: normalizeClientAccountRecord(uid, clientAccountsMap.get(uid)),
            alreadyExisted: true,
          };
        }

        const isolatedCustomerId = buildIsolatedClientCustomerId(uid);
        const existingLink = clientCustomerLinksMap.get(isolatedCustomerId);
        if (existingLink && existingLink.ownerUid !== uid) {
          throw createRepositoryError('permission-denied', 'Isolated link conflict.');
        }

        const nowIso = new Date().toISOString();
        const account = normalizeClientAccountRecord(
          uid,
          buildNewClientAccountPayload({
            uid,
            customerId: isolatedCustomerId,
            profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
            emailNormalized,
            displayName,
            photoURL,
            authProvider,
            emailVerified,
            timestamp: nowIso,
          }),
        );
        const link = buildNewClientCustomerLinkPayload({
          customerId: isolatedCustomerId,
          ownerUid: uid,
          emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
          timestamp: nowIso,
        });
        const isolatedProfile = normalizeClientProfileRecord(
          isolatedCustomerId,
          buildIsolatedProfilePayload({
            isolatedCustomerId,
            ownerUid: uid,
            emailNormalized,
            displayName,
            photoURL,
            timestamp: nowIso,
          }),
        );

        clientAccountsMap.set(uid, account);
        clientCustomerLinksMap.set(isolatedCustomerId, link);
        clientProfilesMap.set(isolatedCustomerId, isolatedProfile);
        notifyUid(uid);

        return { account: { ...account }, alreadyExisted: false };
      });
    },
  };
}

let activeClientPortalAdapter = createFirestoreClientPortalRepositoryAdapter();

export function getClientPortalRepositoryAdapter() {
  return activeClientPortalAdapter;
}

export function setClientPortalRepositoryAdapter(customAdapter) {
  activeClientPortalAdapter = customAdapter || createFirestoreClientPortalRepositoryAdapter();
}

export function resetClientPortalRepositoryAdapter() {
  activeClientPortalAdapter = createFirestoreClientPortalRepositoryAdapter();
}
