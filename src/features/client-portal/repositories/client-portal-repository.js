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

function buildLinkedClientProfilePayload({
  customerId,
  ownerUid,
  customer,
  existingProfile = null,
  timestamp,
}) {
  return {
    schemaVersion: CLIENT_PORTAL_SCHEMA_VERSION,
    customerId,
    ownerUid,
    profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
    displayName: String(customer?.displayName || existingProfile?.displayName || '').trim(),
    emailNormalized: String(customer?.emailNormalized || customer?.email || '').trim().toLowerCase(),
    phoneDisplay: String(customer?.phoneDisplay || '').trim(),
    photoURL: String(existingProfile?.photoURL || '').trim(),
    status: 'active',
    createdAt: existingProfile?.createdAt || timestamp,
    updatedAt: timestamp,
    version: existingProfile ? (Number(existingProfile.version) || 1) + 1 : 1,
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

    async listOwnerEligibleClientAccounts({ maxResults = 100 } = {}) {
      if (!isFirebaseConfigured()) return [];
      const safeLimit = Math.max(1, Math.min(200, Number(maxResults) || 100));
      const [{ collection, getDocs, limit, query, where }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const accountsQuery = query(
        collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS),
        where('profileSource', '==', CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE),
        limit(safeLimit),
      );
      const snapshot = await getDocs(accountsQuery);
      return snapshot.docs
        .map((item) => normalizeClientAccountRecord(item.id, item.data()))
        .filter(
          (account) =>
            account?.role === CLIENT_ROLE &&
            account.status === CLIENT_ACCOUNT_STATUS.ACTIVE &&
            account.profileSource === CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE &&
            account.customerId === buildIsolatedClientCustomerId(account.uid),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },

    async linkLegacyClientToCustomer({
      uid,
      targetCustomerId,
      actorUid,
      reviewReason,
      operationId,
    }) {
      const cleanUid = String(uid || '').trim();
      const cleanTargetCustomerId = String(targetCustomerId || '').trim();
      const cleanActorUid = String(actorUid || '').trim();
      const cleanReason = String(reviewReason || '').trim();
      const cleanOperationId = String(operationId || '').trim();
      if (!cleanUid || !cleanTargetCustomerId || !cleanActorUid || !cleanOperationId) {
        throw createRepositoryError('client-identity/invalid-input', 'Data identity link belum lengkap.');
      }
      if (cleanReason.length < 10 || cleanReason.length > 1000) {
        throw createRepositoryError('client-identity/invalid-reason', 'Alasan review wajib 10–1000 karakter.');
      }

      const [{ doc, runTransaction, serverTimestamp }, { getFirebaseDb }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firestore'),
      ]);
      const db = getFirebaseDb();

      return runTransaction(db, async (tx) => {
        const isolatedCustomerId = buildIsolatedClientCustomerId(cleanUid);
        const accountRef = doc(db, FIRESTORE_COLLECTIONS.CLIENT_ACCOUNTS, cleanUid);
        const sourceLinkRef = doc(db, FIRESTORE_COLLECTIONS.CLIENT_CUSTOMER_LINKS, isolatedCustomerId);
        const sourceProfileRef = doc(db, FIRESTORE_COLLECTIONS.CLIENT_PROFILES, isolatedCustomerId);
        const customerRef = doc(db, FIRESTORE_COLLECTIONS.CUSTOMERS, cleanTargetCustomerId);
        const targetProfileRef = doc(db, FIRESTORE_COLLECTIONS.CLIENT_PROFILES, cleanTargetCustomerId);
        const targetLinkRef = doc(db, FIRESTORE_COLLECTIONS.CLIENT_CUSTOMER_LINKS, cleanTargetCustomerId);
        const auditRef = doc(db, 'clientIdentityLinkAudits', cleanOperationId);

        const [
          accountSnapshot,
          sourceLinkSnapshot,
          sourceProfileSnapshot,
          customerSnapshot,
          targetProfileSnapshot,
          targetLinkSnapshot,
          auditSnapshot,
        ] = await Promise.all([
          tx.get(accountRef),
          tx.get(sourceLinkRef),
          tx.get(sourceProfileRef),
          tx.get(customerRef),
          tx.get(targetProfileRef),
          tx.get(targetLinkRef),
          tx.get(auditRef),
        ]);

        if (!accountSnapshot.exists()) {
          throw createRepositoryError('client-identity/account-not-found', 'Akun Client tidak ditemukan.');
        }

        const account = normalizeClientAccountRecord(cleanUid, accountSnapshot.data());
        if (
          account.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER &&
          account.customerId === cleanTargetCustomerId &&
          targetLinkSnapshot.exists() &&
          targetLinkSnapshot.data()?.ownerUid === cleanUid &&
          auditSnapshot.exists() &&
          auditSnapshot.data()?.operationId === cleanOperationId &&
          auditSnapshot.data()?.action === 'owner_reviewed_legacy_link'
        ) {
          return {
            account,
            clientProfile: targetProfileSnapshot.exists()
              ? normalizeClientProfileRecord(cleanTargetCustomerId, targetProfileSnapshot.data())
              : null,
            audit: auditSnapshot.data(),
            alreadyLinked: true,
          };
        }
        if (auditSnapshot.exists()) {
          throw createRepositoryError('client-identity/duplicate-operation', 'Operation ID identity link sudah digunakan.');
        }
        if (account.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER) {
          throw createRepositoryError(
            'client-identity/reassignment-blocked',
            'Akun ini sudah tertaut ke CRM lain. Reassignment memerlukan proses dispute terpisah.',
          );
        }
        if (
          account.role !== CLIENT_ROLE ||
          account.status !== CLIENT_ACCOUNT_STATUS.ACTIVE ||
          account.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE ||
          account.customerId !== isolatedCustomerId
        ) {
          throw createRepositoryError('client-identity/account-not-eligible', 'Akun Client bukan profil terisolasi yang eligible.');
        }
        if (
          !sourceLinkSnapshot.exists() ||
          sourceLinkSnapshot.data()?.ownerUid !== cleanUid ||
          sourceLinkSnapshot.data()?.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE ||
          !sourceProfileSnapshot.exists() ||
          sourceProfileSnapshot.data()?.ownerUid !== cleanUid ||
          sourceProfileSnapshot.data()?.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE
        ) {
          throw createRepositoryError('client-identity/source-binding-invalid', 'Binding profil terisolasi tidak konsisten.');
        }
        if (!customerSnapshot.exists() || customerSnapshot.data()?.status !== 'active') {
          throw createRepositoryError('client-identity/customer-not-eligible', 'Customer target tidak ditemukan atau tidak aktif.');
        }
        if (targetLinkSnapshot.exists()) {
          throw createRepositoryError('client-identity/customer-already-claimed', 'Customer target sudah tertaut ke akun Client lain.');
        }
        const customer = customerSnapshot.data() || {};
        const existingProfile = targetProfileSnapshot.exists() ? targetProfileSnapshot.data() : null;
        if (
          existingProfile &&
          (
            existingProfile.ownerUid != null ||
            existingProfile.profileSource !== CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER ||
            existingProfile.status !== 'active'
          )
        ) {
          throw createRepositoryError('client-identity/profile-already-claimed', 'Client profile target sudah memiliki Owner atau tidak aktif.');
        }

        const timestamp = serverTimestamp();
        const nextAccount = {
          ...accountSnapshot.data(),
          customerId: cleanTargetCustomerId,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          updatedAt: timestamp,
          version: account.version + 1,
        };
        const nextProfile = buildLinkedClientProfilePayload({
          customerId: cleanTargetCustomerId,
          ownerUid: cleanUid,
          customer,
          existingProfile,
          timestamp,
        });
        const linkPayload = buildNewClientCustomerLinkPayload({
          customerId: cleanTargetCustomerId,
          ownerUid: cleanUid,
          emailNormalized: account.emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          timestamp,
        });
        const auditPayload = {
          schemaVersion: 1,
          operationId: cleanOperationId,
          action: 'owner_reviewed_legacy_link',
          clientUid: cleanUid,
          actorUid: cleanActorUid,
          fromCustomerId: isolatedCustomerId,
          toCustomerId: cleanTargetCustomerId,
          fromProfileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
          toProfileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          reviewReason: cleanReason,
          reviewedAt: timestamp,
          createdAt: timestamp,
          accountVersionBefore: account.version,
          accountVersionAfter: account.version + 1,
          version: 1,
        };

        tx.update(accountRef, {
          customerId: cleanTargetCustomerId,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          updatedAt: timestamp,
          version: account.version + 1,
        });
        if (existingProfile) tx.update(targetProfileRef, nextProfile);
        else tx.set(targetProfileRef, nextProfile);
        tx.set(targetLinkRef, linkPayload);
        tx.set(auditRef, auditPayload);

        return {
          account: normalizeClientAccountRecord(cleanUid, nextAccount),
          clientProfile: normalizeClientProfileRecord(cleanTargetCustomerId, nextProfile),
          audit: auditPayload,
          alreadyLinked: false,
        };
      });
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
  const identityLinkAuditsMap = new Map();
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
        clientIdentityLinkAudits: new Map(identityLinkAuditsMap),
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

    async listOwnerEligibleClientAccounts({ maxResults = 100 } = {}) {
      const safeLimit = Math.max(1, Math.min(200, Number(maxResults) || 100));
      return Array.from(clientAccountsMap.entries())
        .map(([uid, raw]) => normalizeClientAccountRecord(uid, raw))
        .filter(
          (account) =>
            account?.role === CLIENT_ROLE &&
            account.status === CLIENT_ACCOUNT_STATUS.ACTIVE &&
            account.profileSource === CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE &&
            account.customerId === buildIsolatedClientCustomerId(account.uid),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, safeLimit);
    },

    async linkLegacyClientToCustomer({
      uid,
      targetCustomerId,
      actorUid,
      reviewReason,
      operationId,
    }) {
      const cleanUid = String(uid || '').trim();
      const cleanTargetCustomerId = String(targetCustomerId || '').trim();
      const cleanActorUid = String(actorUid || '').trim();
      const cleanReason = String(reviewReason || '').trim();
      const cleanOperationId = String(operationId || '').trim();
      if (!cleanUid || !cleanTargetCustomerId || !cleanActorUid || !cleanOperationId) {
        throw createRepositoryError('client-identity/invalid-input', 'Data identity link belum lengkap.');
      }
      if (cleanReason.length < 10 || cleanReason.length > 1000) {
        throw createRepositoryError('client-identity/invalid-reason', 'Alasan review wajib 10–1000 karakter.');
      }

      return runSerial(async () => {
        const isolatedCustomerId = buildIsolatedClientCustomerId(cleanUid);
        const account = normalizeClientAccountRecord(cleanUid, clientAccountsMap.get(cleanUid));
        if (!account) {
          throw createRepositoryError('client-identity/account-not-found', 'Akun Client tidak ditemukan.');
        }
        if (account.profileSource === CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER) {
          const existingLink = clientCustomerLinksMap.get(cleanTargetCustomerId);
          const existingAudit = identityLinkAuditsMap.get(cleanOperationId);
          if (
            account.customerId === cleanTargetCustomerId &&
            existingLink?.ownerUid === cleanUid &&
            existingAudit?.action === 'owner_reviewed_legacy_link'
          ) {
            return {
              account,
              clientProfile: clientProfilesMap.get(cleanTargetCustomerId) || null,
              audit: { ...existingAudit },
              alreadyLinked: true,
            };
          }
          throw createRepositoryError(
            'client-identity/reassignment-blocked',
            'Akun ini sudah tertaut ke CRM lain. Reassignment memerlukan proses dispute terpisah.',
          );
        }
        if (
          account.role !== CLIENT_ROLE ||
          account.status !== CLIENT_ACCOUNT_STATUS.ACTIVE ||
          account.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE ||
          account.customerId !== isolatedCustomerId
        ) {
          throw createRepositoryError('client-identity/account-not-eligible', 'Akun Client bukan profil terisolasi yang eligible.');
        }
        const sourceLink = clientCustomerLinksMap.get(isolatedCustomerId);
        const sourceProfile = clientProfilesMap.get(isolatedCustomerId);
        if (
          !sourceLink ||
          sourceLink.ownerUid !== cleanUid ||
          sourceLink.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE ||
          !sourceProfile ||
          sourceProfile.ownerUid !== cleanUid ||
          sourceProfile.profileSource !== CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE
        ) {
          throw createRepositoryError('client-identity/source-binding-invalid', 'Binding profil terisolasi tidak konsisten.');
        }
        const customer = bridge?.customers?.get(cleanTargetCustomerId);
        if (!customer || customer.status !== 'active') {
          throw createRepositoryError('client-identity/customer-not-eligible', 'Customer target tidak ditemukan atau tidak aktif.');
        }
        if (clientCustomerLinksMap.has(cleanTargetCustomerId)) {
          throw createRepositoryError('client-identity/customer-already-claimed', 'Customer target sudah tertaut ke akun Client lain.');
        }
        const existingProfile = clientProfilesMap.get(cleanTargetCustomerId) || null;
        if (
          existingProfile &&
          (
            existingProfile.ownerUid != null ||
            existingProfile.profileSource !== CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER ||
            existingProfile.status !== 'active'
          )
        ) {
          throw createRepositoryError('client-identity/profile-already-claimed', 'Client profile target sudah memiliki Owner atau tidak aktif.');
        }
        if (identityLinkAuditsMap.has(cleanOperationId)) {
          throw createRepositoryError('client-identity/duplicate-operation', 'Operation ID identity link sudah digunakan.');
        }

        const timestamp = new Date().toISOString();
        const nextAccount = normalizeClientAccountRecord(cleanUid, {
          ...account,
          customerId: cleanTargetCustomerId,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          updatedAt: timestamp,
          version: account.version + 1,
        });
        const nextProfile = buildLinkedClientProfilePayload({
          customerId: cleanTargetCustomerId,
          ownerUid: cleanUid,
          customer,
          existingProfile,
          timestamp,
        });
        const linkPayload = buildNewClientCustomerLinkPayload({
          customerId: cleanTargetCustomerId,
          ownerUid: cleanUid,
          emailNormalized: account.emailNormalized,
          profileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          timestamp,
        });
        const auditPayload = {
          schemaVersion: 1,
          operationId: cleanOperationId,
          action: 'owner_reviewed_legacy_link',
          clientUid: cleanUid,
          actorUid: cleanActorUid,
          fromCustomerId: isolatedCustomerId,
          toCustomerId: cleanTargetCustomerId,
          fromProfileSource: CLIENT_PROFILE_SOURCE.ISOLATED_CLIENT_PROFILE,
          toProfileSource: CLIENT_PROFILE_SOURCE.LINKED_CUSTOMER,
          reviewReason: cleanReason,
          reviewedAt: timestamp,
          createdAt: timestamp,
          accountVersionBefore: account.version,
          accountVersionAfter: account.version + 1,
          version: 1,
        };

        clientAccountsMap.set(cleanUid, nextAccount);
        clientCustomerLinksMap.set(cleanTargetCustomerId, linkPayload);
        clientProfilesMap.set(cleanTargetCustomerId, nextProfile);
        identityLinkAuditsMap.set(cleanOperationId, auditPayload);
        notifyUid(cleanUid);
        return {
          account: { ...nextAccount },
          clientProfile: { ...nextProfile },
          audit: { ...auditPayload },
          alreadyLinked: false,
        };
      });
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
