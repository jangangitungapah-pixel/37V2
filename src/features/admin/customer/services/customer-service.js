/**
 * Customer Management Domain Services (Phase 7 — Phone Number First, Customer Identity Aware).
 *
 * Handles:
 * - Phone lookup via `customerPhoneIndex/{phoneHash}` + candidate identity resolution
 * - Manual Customer creation with duplicate detection
 * - Editing display name (preserving previous names as aliases) & notes
 * - Atomic primary phone change (`previousPhones` + dual `customerPhoneIndex` update + conflict check)
 * - Archiving & reactivating profiles (never permanent delete)
 * - Virtual history merge (`historyCustomerIds`) in a single atomic transaction without editing bookings
 */

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import { getCustomerRepositoryAdapter } from '../repositories/customer-repository';
import {
  normalizeCustomerRecord,
  validateCustomerCreateInput,
  validateCustomerEditInput,
  validateCustomerPhoneUpdateInput,
} from '../schemas/customer-schema';
import {
  CUSTOMER_EMAIL_INDEX_STATUS,
  buildClientSafeCustomerProfilePayload,
} from '../utils/customer-email';
import {
  appendUniqueNameAlias,
  CUSTOMER_STATUS,
  mergeUniqueNameAliases,
  normalizeCustomerName,
  resolveCustomerIdentityCandidates,
} from '../utils/customer-identity';
import {
  formatPhoneDisplay,
  getPhoneNumberHash,
  normalizePhoneNumber,
} from '../utils/phone-number';

export function createCustomerServiceError(code, message, details = null) {
  const err = new Error(message);
  err.code = code;
  if (details) err.details = details;
  return err;
}

export function mapCustomerErrorToMessage(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return 'Akses ditolak oleh Firestore. Pastikan akun Anda aktif sebagai Owner atau Staff.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Koneksi jaringan tidak tersedia. Periksa koneksi internet lalu coba kembali.';
  }

  if (code.startsWith('customer/') && typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Gagal memproses data customer. Silakan periksa kembali input Anda lalu coba lagi.';
}

function assertStaffActor(actorUid) {
  const clean = String(actorUid || '').trim();
  if (!clean) {
    throw createCustomerServiceError(
      'customer/missing-actor',
      'Sesi pengguna tidak valid. Silakan login kembali sebagai Staff atau Owner.',
    );
  }
  return clean;
}

function assertNoEmailIndexConflict(existingEmailIndex, targetCustomerId) {
  if (!existingEmailIndex) return;
  if (
    existingEmailIndex.status === CUSTOMER_EMAIL_INDEX_STATUS.AMBIGUOUS ||
    (existingEmailIndex.status === CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE &&
      existingEmailIndex.customerId &&
      existingEmailIndex.customerId !== targetCustomerId)
  ) {
    throw createCustomerServiceError(
      'customer/email-conflict',
      'Email ini sudah terdaftar pada profil customer lain atau perlu resolusi konflik terlebih dahulu.',
      {
        emailNormalized: existingEmailIndex.emailNormalized,
        existingCustomerId: existingEmailIndex.customerId,
        status: existingEmailIndex.status,
      },
    );
  }
}

/**
 * Looks up `customerPhoneIndex/{phoneHash}` and resolves active / historical candidates
 * for a given phone number and optional input name.
 */
export async function lookupCustomerByPhone({
  phone,
  inputName = '',
  adapter = getCustomerRepositoryAdapter(),
}) {
  const phoneNormalized = normalizePhoneNumber(phone);
  if (!phoneNormalized) {
    throw createCustomerServiceError(
      'customer/invalid-phone',
      'Nomor HP / WhatsApp tidak valid untuk pencarian.',
    );
  }

  const phoneHash = await getPhoneNumberHash(phoneNormalized);
  const phoneIndex = await adapter.getPhoneIndex(phoneHash);

  const idsToFetch = Array.from(
    new Set([
      ...(phoneIndex?.activeCustomerIds || []),
      ...(phoneIndex?.historicalCustomerIds || []),
    ]),
  );

  const profiles = idsToFetch.length > 0 ? await adapter.getCustomersByIds(idsToFetch) : [];

  // Also fetch canonical targets if any index entry points to a merged profile
  const mergedTargetIds = profiles
    .filter((p) => p.status === CUSTOMER_STATUS.MERGED && p.mergedIntoCustomerId)
    .map((p) => p.mergedIntoCustomerId)
    .filter((id) => !idsToFetch.includes(id));

  if (mergedTargetIds.length > 0) {
    const targetProfiles = await adapter.getCustomersByIds(mergedTargetIds);
    profiles.push(...targetProfiles);
  }

  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const resolution = resolveCustomerIdentityCandidates({
    inputName,
    phoneNormalized,
    phoneIndex,
    profilesById,
  });

  return {
    phoneHash,
    phoneNormalized,
    phoneDisplay: formatPhoneDisplay(phoneNormalized),
    phoneIndex,
    ...resolution,
  };
}

/**
 * Creates a Customer Profile manually (from Customer page) in one atomic transaction
 * updating `customers/{customerId}` and `customerPhoneIndex/{phoneHash}`.
 *
 * When `allowSharedPhone` is false (default), rejects with `customer/phone-already-exists`
 * if an active profile already uses the normalized phone so the UI can show duplicate confirmation.
 */
export async function createManualCustomer({
  customerId = generateOperationId('cust'),
  actorUid,
  input,
  allowSharedPhone = false,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanCustomerId = String(customerId || '').trim() || generateOperationId('cust');

  const validation = validateCustomerCreateInput(input);
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Data customer tidak valid.';
    throw createCustomerServiceError('customer/validation-error', firstMsg, validation.errors);
  }

  const {
    displayName,
    normalizedName,
    phoneDisplay,
    phoneNormalized,
    email,
    emailNormalized,
    notes,
  } = validation.data;
  const phoneHash = await getPhoneNumberHash(phoneNormalized);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const [existingCustomer, existingIndex, existingEmailIndex] = await Promise.all([
      tx.getCustomer(cleanCustomerId),
      tx.getPhoneIndex(phoneHash),
      emailNormalized && typeof tx.getEmailIndex === 'function'
        ? tx.getEmailIndex(emailNormalized)
        : Promise.resolve(null),
    ]);

    if (existingCustomer) {
      return existingCustomer;
    }

    assertNoEmailIndexConflict(existingEmailIndex, cleanCustomerId);

    const activeIds = Array.isArray(existingIndex?.activeCustomerIds)
      ? existingIndex.activeCustomerIds
      : [];

    if (activeIds.length > 0 && !allowSharedPhone) {
      const activeProfiles = (await Promise.all(activeIds.map((id) => tx.getCustomer(id)))).filter(
        (p) => p && p.status === CUSTOMER_STATUS.ACTIVE,
      );

      if (activeProfiles.length > 0) {
        throw createCustomerServiceError(
          'customer/phone-already-exists',
          'Nomor telepon ini sudah terdaftar pada profil customer lain. Konfirmasi terlebih dahulu sebelum membuat profil terpisah.',
          { activeProfiles, phoneNormalized },
        );
      }
    }

    // 2. WRITES AFTER READS
    const timestamp = tx.nowValue();
    const customerDoc = {
      displayName,
      normalizedName,
      phoneDisplay,
      phoneNormalized,
      nameAliases: [],
      previousPhones: [],
      status: CUSTOMER_STATUS.ACTIVE,
      mergedIntoCustomerId: null,
      historyCustomerIds: [cleanCustomerId],
      bookingCount: 0,
      firstBookingDate: '',
      lastBookingDate: '',
      notes,
      createdAt: timestamp,
      createdByUid: cleanActorUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: 1,
      ...(emailNormalized ? { email, emailNormalized } : {}),
    };

    const nextActiveIds = Array.from(new Set([...activeIds, cleanCustomerId]));
    const nextHistoricalIds = (existingIndex?.historicalCustomerIds || []).filter(
      (id) => id !== cleanCustomerId,
    );

    tx.setCustomer(cleanCustomerId, customerDoc);
    tx.setPhoneIndex(phoneHash, {
      phoneNormalized,
      activeCustomerIds: nextActiveIds,
      historicalCustomerIds: nextHistoricalIds,
      version: (Number(existingIndex?.version) || 0) + 1,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
    });

    if (emailNormalized && typeof tx.setEmailIndex === 'function') {
      tx.setEmailIndex(emailNormalized, {
        schemaVersion: 1,
        emailNormalized,
        customerId: cleanCustomerId,
        status: CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingEmailIndex?.version) || 0) + 1,
      });
    }

    if (emailNormalized && typeof tx.setClientProfile === 'function') {
      tx.setClientProfile(
        cleanCustomerId,
        buildClientSafeCustomerProfilePayload({
          customerId: cleanCustomerId,
          displayName,
          emailNormalized,
          phoneDisplay,
          status: CUSTOMER_STATUS.ACTIVE,
          timestamp,
        }),
      );
    }

    return normalizeCustomerRecord(cleanCustomerId, customerDoc);
  });
}

/**
 * Updates a Customer Profile's display name and optional notes atomically.
 * When display name changes, preserves the previous display name inside `nameAliases`.
 * Historical booking snapshots are NEVER mutated.
 */
export async function updateCustomerProfile({
  customerId,
  expectedVersion,
  actorUid,
  input,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanCustomerId = String(customerId || '').trim();
  if (!cleanCustomerId) {
    throw createCustomerServiceError('customer/not-found', 'ID customer wajib disertakan.');
  }

  const validation = validateCustomerEditInput(input);
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Data perubahan customer tidak valid.';
    throw createCustomerServiceError('customer/validation-error', firstMsg, validation.errors);
  }

  const {
    displayName,
    normalizedName,
    email,
    emailNormalized: requestedEmailNormalized,
    notes,
  } = validation.data;
  const hasExplicitEmailInput = 'email' in (input || {});

  return adapter.runAtomicTransaction(async (tx) => {
    const existing = await tx.getCustomer(cleanCustomerId);
    if (!existing) {
      throw createCustomerServiceError('customer/not-found', 'Profil customer tidak ditemukan.');
    }

    if (existing.status === CUSTOMER_STATUS.MERGED) {
      throw createCustomerServiceError(
        'customer/merged-readonly',
        'Profil yang sudah digabung (Merged) tidak dapat diedit. Edit profil utama tujuan merge.',
      );
    }

    if (Number.isInteger(Number(expectedVersion)) && existing.version !== Number(expectedVersion)) {
      throw createCustomerServiceError(
        'customer/stale-update',
        'Data customer telah diperbarui di sesi lain. Muat ulang detail customer terlebih dahulu.',
      );
    }

    const oldEmailNormalized = existing.emailNormalized || '';
    const nextEmailNormalized = hasExplicitEmailInput
      ? requestedEmailNormalized
      : oldEmailNormalized;
    const nextEmailRaw = hasExplicitEmailInput
      ? email
      : existing.email || existing.emailNormalized || '';
    const emailChanged = nextEmailNormalized !== oldEmailNormalized;

    const [oldEmailIndex, newEmailIndex, existingClientProfile] = await Promise.all([
      oldEmailNormalized && typeof tx.getEmailIndex === 'function'
        ? tx.getEmailIndex(oldEmailNormalized)
        : Promise.resolve(null),
      nextEmailNormalized &&
      nextEmailNormalized !== oldEmailNormalized &&
      typeof tx.getEmailIndex === 'function'
        ? tx.getEmailIndex(nextEmailNormalized)
        : Promise.resolve(null),
      typeof tx.getClientProfile === 'function'
        ? tx.getClientProfile(cleanCustomerId)
        : Promise.resolve(null),
    ]);

    if (nextEmailNormalized && nextEmailNormalized !== oldEmailNormalized) {
      assertNoEmailIndexConflict(newEmailIndex, cleanCustomerId);
    } else if (nextEmailNormalized && oldEmailIndex) {
      assertNoEmailIndexConflict(oldEmailIndex, cleanCustomerId);
    }

    const nextAliases =
      existing.displayName && existing.displayName !== displayName
        ? appendUniqueNameAlias(displayName, existing.nameAliases, existing.displayName)
        : existing.nameAliases;

    const timestamp = tx.nowValue();
    const updatedFields = {
      displayName,
      normalizedName,
      phoneDisplay: existing.phoneDisplay,
      phoneNormalized: existing.phoneNormalized,
      nameAliases: nextAliases,
      previousPhones: existing.previousPhones,
      status: existing.status,
      mergedIntoCustomerId: existing.mergedIntoCustomerId,
      historyCustomerIds: existing.historyCustomerIds,
      bookingCount: existing.bookingCount,
      firstBookingDate: existing.firstBookingDate,
      lastBookingDate: existing.lastBookingDate,
      notes,
      createdAt: existing.createdAt,
      createdByUid: existing.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(existing.version) || 1) + 1,
      ...(nextEmailNormalized || oldEmailNormalized
        ? { email: nextEmailRaw, emailNormalized: nextEmailNormalized }
        : {}),
    };

    tx.updateCustomer(cleanCustomerId, updatedFields);

    if (
      emailChanged &&
      oldEmailNormalized &&
      oldEmailIndex?.customerId === cleanCustomerId &&
      typeof tx.deleteEmailIndex === 'function'
    ) {
      tx.deleteEmailIndex(oldEmailNormalized);
    }

    if (
      nextEmailNormalized &&
      existing.status === CUSTOMER_STATUS.ACTIVE &&
      (emailChanged || !oldEmailIndex) &&
      typeof tx.setEmailIndex === 'function'
    ) {
      const targetIndex = emailChanged ? newEmailIndex : oldEmailIndex;
      tx.setEmailIndex(nextEmailNormalized, {
        schemaVersion: 1,
        emailNormalized: nextEmailNormalized,
        customerId: cleanCustomerId,
        status: CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(targetIndex?.version) || 0) + 1,
      });
    }

    if (
      (nextEmailNormalized || existingClientProfile) &&
      typeof tx.setClientProfile === 'function'
    ) {
      tx.setClientProfile(
        cleanCustomerId,
        buildClientSafeCustomerProfilePayload({
          customerId: cleanCustomerId,
          displayName,
          emailNormalized: nextEmailNormalized,
          phoneDisplay: existing.phoneDisplay,
          status: existing.status,
          timestamp,
          existingProfile: existingClientProfile,
        }),
      );
    }

    return normalizeCustomerRecord(cleanCustomerId, updatedFields);
  });
}

/**
 * Updates a Customer Profile's primary phone number atomically:
 * - Normalizes the new phone
 * - Checks if another active profile already uses the new phone (rejects with conflict details unless explicitly resolved)
 * - Moves old primary phone into `previousPhones`
 * - Updates old `customerPhoneIndex/{oldHash}` (moves customerId from active -> historical)
 * - Updates new `customerPhoneIndex/{newHash}` (adds customerId to active)
 * - NEVER mutates historical booking `phone` snapshots
 */
export async function updateCustomerPhone({
  customerId,
  expectedVersion,
  actorUid,
  newPhone,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanCustomerId = String(customerId || '').trim();
  if (!cleanCustomerId) {
    throw createCustomerServiceError('customer/not-found', 'ID customer wajib disertakan.');
  }

  const validation = validateCustomerPhoneUpdateInput({ phone: newPhone });
  if (!validation.isValid) {
    const firstMsg = Object.values(validation.errors)[0] || 'Nomor HP baru tidak valid.';
    throw createCustomerServiceError('customer/validation-error', firstMsg, validation.errors);
  }

  const { phoneNormalized: newNormalized, phoneDisplay: newDisplay } = validation.data;
  const newHash = await getPhoneNumberHash(newNormalized);

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. ALL READS FIRST
    const existing = await tx.getCustomer(cleanCustomerId);
    if (!existing) {
      throw createCustomerServiceError('customer/not-found', 'Profil customer tidak ditemukan.');
    }

    if (existing.status !== CUSTOMER_STATUS.ACTIVE) {
      throw createCustomerServiceError(
        'customer/inactive-phone-change',
        'Hanya profil customer berstatus Active yang dapat mengubah nomor telepon utama.',
      );
    }

    if (Number.isInteger(Number(expectedVersion)) && existing.version !== Number(expectedVersion)) {
      throw createCustomerServiceError(
        'customer/stale-update',
        'Data customer telah berubah. Muat ulang profil sebelum mengganti nomor telepon.',
      );
    }

    if (existing.phoneNormalized === newNormalized) {
      return existing;
    }

    const oldHash = existing.phoneNormalized
      ? await getPhoneNumberHash(existing.phoneNormalized)
      : '';

    const [oldIndex, newIndex, existingClientProfile] = await Promise.all([
      oldHash ? tx.getPhoneIndex(oldHash) : Promise.resolve(null),
      tx.getPhoneIndex(newHash),
      typeof tx.getClientProfile === 'function'
        ? tx.getClientProfile(cleanCustomerId)
        : Promise.resolve(null),
    ]);

    const conflictingIds = (newIndex?.activeCustomerIds || []).filter(
      (id) => id !== cleanCustomerId,
    );
    if (conflictingIds.length > 0) {
      const conflictingProfiles = (
        await Promise.all(conflictingIds.map((id) => tx.getCustomer(id)))
      ).filter((p) => p && p.status === CUSTOMER_STATUS.ACTIVE);

      if (conflictingProfiles.length > 0) {
        throw createCustomerServiceError(
          'customer/phone-conflict',
          'Nomor telepon baru sudah digunakan oleh profil customer lain. Pilih Merge History atau batalkan perubahan.',
          {
            conflictingProfiles,
            newPhoneNormalized: newNormalized,
            newPhoneDisplay: newDisplay,
          },
        );
      }
    }

    // 2. WRITES AFTER READS
    const timestamp = tx.nowValue();
    const existingPrevPhones = Array.isArray(existing.previousPhones)
      ? existing.previousPhones
      : [];
    const nextPrevPhones = existing.phoneNormalized
      ? [
          ...existingPrevPhones.filter((p) => p.phoneNormalized !== existing.phoneNormalized),
          {
            phoneDisplay: existing.phoneDisplay || formatPhoneDisplay(existing.phoneNormalized),
            phoneNormalized: existing.phoneNormalized,
            changedAt: timestamp,
          },
        ]
      : existingPrevPhones;

    const updatedFields = {
      displayName: existing.displayName,
      normalizedName: existing.normalizedName || normalizeCustomerName(existing.displayName),
      phoneDisplay: newDisplay,
      phoneNormalized: newNormalized,
      nameAliases: existing.nameAliases,
      previousPhones: nextPrevPhones,
      status: existing.status,
      mergedIntoCustomerId: null,
      historyCustomerIds: existing.historyCustomerIds,
      bookingCount: existing.bookingCount,
      firstBookingDate: existing.firstBookingDate,
      lastBookingDate: existing.lastBookingDate,
      notes: existing.notes,
      createdAt: existing.createdAt,
      createdByUid: existing.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(existing.version) || 1) + 1,
      ...(existing.emailNormalized
        ? {
            email: existing.email || existing.emailNormalized,
            emailNormalized: existing.emailNormalized,
          }
        : {}),
    };

    tx.updateCustomer(cleanCustomerId, updatedFields);

    if (existingClientProfile && typeof tx.setClientProfile === 'function') {
      tx.setClientProfile(
        cleanCustomerId,
        buildClientSafeCustomerProfilePayload({
          customerId: cleanCustomerId,
          displayName: existing.displayName,
          emailNormalized: existing.emailNormalized || '',
          phoneDisplay: newDisplay,
          status: existing.status,
          timestamp,
          existingProfile: existingClientProfile,
        }),
      );
    }

    // Move customerId from active -> historical on old phone index
    if (oldHash && oldIndex) {
      tx.setPhoneIndex(oldHash, {
        phoneNormalized: oldIndex.phoneNormalized || existing.phoneNormalized,
        activeCustomerIds: (oldIndex.activeCustomerIds || []).filter(
          (id) => id !== cleanCustomerId,
        ),
        historicalCustomerIds: Array.from(
          new Set([...(oldIndex.historicalCustomerIds || []), cleanCustomerId]),
        ),
        version: (Number(oldIndex.version) || 0) + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    }

    // Add customerId to activeCustomerIds on new phone index
    tx.setPhoneIndex(newHash, {
      phoneNormalized: newNormalized,
      activeCustomerIds: Array.from(
        new Set([...(newIndex?.activeCustomerIds || []), cleanCustomerId]),
      ),
      historicalCustomerIds: (newIndex?.historicalCustomerIds || []).filter(
        (id) => id !== cleanCustomerId,
      ),
      version: (Number(newIndex?.version) || 0) + 1,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
    });

    return normalizeCustomerRecord(cleanCustomerId, updatedFields);
  });
}

/**
 * Archives or reactivates a Customer Profile atomically without deleting the profile
 * or its historical bookings.
 */
export async function setCustomerArchiveStatus({
  customerId,
  expectedVersion,
  archived,
  actorUid,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const cleanCustomerId = String(customerId || '').trim();
  if (!cleanCustomerId) {
    throw createCustomerServiceError('customer/not-found', 'ID customer wajib disertakan.');
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const existing = await tx.getCustomer(cleanCustomerId);
    if (!existing) {
      throw createCustomerServiceError('customer/not-found', 'Profil customer tidak ditemukan.');
    }

    if (existing.status === CUSTOMER_STATUS.MERGED) {
      throw createCustomerServiceError(
        'customer/merged-readonly',
        'Profil yang sudah berstatus Merged tidak dapat diarsipkan atau diaktifkan kembali.',
      );
    }

    if (Number.isInteger(Number(expectedVersion)) && existing.version !== Number(expectedVersion)) {
      throw createCustomerServiceError(
        'customer/stale-update',
        'Data customer telah berubah. Muat ulang halaman sebelum melanjutkan.',
      );
    }

    const nextStatus = archived ? CUSTOMER_STATUS.ARCHIVED : CUSTOMER_STATUS.ACTIVE;
    if (existing.status === nextStatus) {
      return existing;
    }

    const phoneHash = existing.phoneNormalized
      ? await getPhoneNumberHash(existing.phoneNormalized)
      : '';
    const existingEmailNormalized = existing.emailNormalized || '';
    const [phoneIndex, existingEmailIndex, existingClientProfile] = await Promise.all([
      phoneHash ? tx.getPhoneIndex(phoneHash) : Promise.resolve(null),
      existingEmailNormalized && typeof tx.getEmailIndex === 'function'
        ? tx.getEmailIndex(existingEmailNormalized)
        : Promise.resolve(null),
      typeof tx.getClientProfile === 'function'
        ? tx.getClientProfile(cleanCustomerId)
        : Promise.resolve(null),
    ]);

    if (!archived && existingEmailNormalized) {
      assertNoEmailIndexConflict(existingEmailIndex, cleanCustomerId);
    }

    const timestamp = tx.nowValue();
    const updatedFields = {
      displayName: existing.displayName,
      normalizedName: existing.normalizedName || normalizeCustomerName(existing.displayName),
      phoneDisplay: existing.phoneDisplay,
      phoneNormalized: existing.phoneNormalized,
      nameAliases: existing.nameAliases,
      previousPhones: existing.previousPhones,
      status: nextStatus,
      mergedIntoCustomerId: null,
      historyCustomerIds: existing.historyCustomerIds,
      bookingCount: existing.bookingCount,
      firstBookingDate: existing.firstBookingDate,
      lastBookingDate: existing.lastBookingDate,
      notes: existing.notes,
      createdAt: existing.createdAt,
      createdByUid: existing.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(existing.version) || 1) + 1,
      ...(existingEmailNormalized
        ? {
            email: existing.email || existingEmailNormalized,
            emailNormalized: existingEmailNormalized,
          }
        : {}),
    };

    tx.updateCustomer(cleanCustomerId, updatedFields);

    if (
      archived &&
      existingEmailNormalized &&
      existingEmailIndex?.customerId === cleanCustomerId &&
      typeof tx.deleteEmailIndex === 'function'
    ) {
      tx.deleteEmailIndex(existingEmailNormalized);
    } else if (!archived && existingEmailNormalized && typeof tx.setEmailIndex === 'function') {
      tx.setEmailIndex(existingEmailNormalized, {
        schemaVersion: 1,
        emailNormalized: existingEmailNormalized,
        customerId: cleanCustomerId,
        status: CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingEmailIndex?.version) || 0) + 1,
      });
    }

    if (
      (existingClientProfile || (!archived && existingEmailNormalized)) &&
      typeof tx.setClientProfile === 'function'
    ) {
      tx.setClientProfile(
        cleanCustomerId,
        buildClientSafeCustomerProfilePayload({
          customerId: cleanCustomerId,
          displayName: existing.displayName,
          emailNormalized: existingEmailNormalized,
          phoneDisplay: existing.phoneDisplay,
          status: nextStatus,
          timestamp,
          existingProfile: existingClientProfile,
        }),
      );
    }

    if (phoneHash) {
      const currentActive = phoneIndex?.activeCustomerIds || [];
      const currentHistorical = phoneIndex?.historicalCustomerIds || [];
      const nextActive = archived
        ? currentActive.filter((id) => id !== cleanCustomerId)
        : Array.from(new Set([...currentActive, cleanCustomerId]));
      const nextHistorical = archived
        ? Array.from(new Set([...currentHistorical, cleanCustomerId]))
        : currentHistorical.filter((id) => id !== cleanCustomerId);

      tx.setPhoneIndex(phoneHash, {
        phoneNormalized: existing.phoneNormalized,
        activeCustomerIds: nextActive,
        historicalCustomerIds: nextHistorical,
        version: (Number(phoneIndex?.version) || 0) + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    }

    return normalizeCustomerRecord(cleanCustomerId, updatedFields);
  });
}

/**
 * Performs an explicit virtual history merge between two active Customer Profiles
 * in a single atomic Firestore transaction.
 *
 * Guarantees:
 * - Both target and source MUST be `active` (blocks chained merges on already-merged profiles)
 * - By default, both profiles MUST share the same `phoneNormalized` (unless `allowCrossPhoneMerge: true`
 *   during explicit Phone-Change conflict resolution, where source's phone is also recorded in target `previousPhones`)
 * - NEVER mutates historical booking documents (`bookings/{id}` retains its original `customerId` & `customerName`)
 * - Target accumulates `historyCustomerIds`, `nameAliases`, combined `bookingCount`, `firstBookingDate`, `lastBookingDate`
 * - Source becomes `status: 'merged'` with `mergedIntoCustomerId: targetCustomerId`
 * - `customerPhoneIndex` removes source from `activeCustomerIds` and records it in `historicalCustomerIds`
 */
export async function mergeCustomerProfiles({
  targetCustomerId,
  sourceCustomerId,
  actorUid,
  allowCrossPhoneMerge = false,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = assertStaffActor(actorUid);
  const targetId = String(targetCustomerId || '').trim();
  const sourceId = String(sourceCustomerId || '').trim();

  if (!targetId || !sourceId) {
    throw createCustomerServiceError(
      'customer/invalid-merge',
      'Pilih profil target dan profil sumber yang valid untuk penggabungan.',
    );
  }

  if (targetId === sourceId) {
    throw createCustomerServiceError(
      'customer/self-merge',
      'Tidak dapat menggabungkan profil customer dengan dirinya sendiri.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    // 1. READS FIRST
    const [target, source] = await Promise.all([
      tx.getCustomer(targetId),
      tx.getCustomer(sourceId),
    ]);

    if (!target || !source) {
      throw createCustomerServiceError(
        'customer/not-found',
        'Salah satu profil customer tidak ditemukan.',
      );
    }

    if (target.status !== CUSTOMER_STATUS.ACTIVE) {
      throw createCustomerServiceError(
        'customer/invalid-merge-status',
        'Profil target merge harus berstatus Active.',
      );
    }

    if (source.status !== CUSTOMER_STATUS.ACTIVE) {
      throw createCustomerServiceError(
        'customer/invalid-merge-status',
        source.status === CUSTOMER_STATUS.MERGED
          ? 'Profil sumber sudah pernah digabung. Pilih profil utama yang aktif terlebih dahulu.'
          : 'Profil sumber harus berstatus Active untuk digabungkan.',
      );
    }

    if (!allowCrossPhoneMerge && target.phoneNormalized !== source.phoneNormalized) {
      throw createCustomerServiceError(
        'customer/merge-phone-mismatch',
        'Penggabungan profil hanya diizinkan untuk profil yang memiliki nomor telepon canonical yang sama.',
      );
    }

    // Prevent circular merge relationships
    if (
      (source.historyCustomerIds || []).includes(targetId) ||
      target.mergedIntoCustomerId === sourceId
    ) {
      throw createCustomerServiceError(
        'customer/circular-merge',
        'Terdeteksi relasi melingkar antar profil customer. Penggabungan dibatalkan.',
      );
    }

    const targetPhoneHash = await getPhoneNumberHash(target.phoneNormalized);
    const sourcePhoneHash =
      source.phoneNormalized !== target.phoneNormalized
        ? await getPhoneNumberHash(source.phoneNormalized)
        : targetPhoneHash;

    const targetPhoneIndex = await tx.getPhoneIndex(targetPhoneHash);
    const sourcePhoneIndex =
      sourcePhoneHash !== targetPhoneHash
        ? await tx.getPhoneIndex(sourcePhoneHash)
        : targetPhoneIndex;

    const targetEmailNormalized = target.emailNormalized || '';
    const sourceEmailNormalized = source.emailNormalized || '';
    const adoptedEmailNormalized = targetEmailNormalized || sourceEmailNormalized;
    const adoptedEmailRaw = targetEmailNormalized
      ? target.email || targetEmailNormalized
      : sourceEmailNormalized
        ? source.email || sourceEmailNormalized
        : '';

    const [targetEmailIndex, sourceEmailIndex, targetClientProfile, sourceClientProfile] =
      await Promise.all([
        targetEmailNormalized && typeof tx.getEmailIndex === 'function'
          ? tx.getEmailIndex(targetEmailNormalized)
          : Promise.resolve(null),
        sourceEmailNormalized &&
        sourceEmailNormalized !== targetEmailNormalized &&
        typeof tx.getEmailIndex === 'function'
          ? tx.getEmailIndex(sourceEmailNormalized)
          : Promise.resolve(null),
        typeof tx.getClientProfile === 'function'
          ? tx.getClientProfile(targetId)
          : Promise.resolve(null),
        typeof tx.getClientProfile === 'function'
          ? tx.getClientProfile(sourceId)
          : Promise.resolve(null),
      ]);

    if (adoptedEmailNormalized && !targetEmailNormalized && sourceEmailIndex) {
      if (
        sourceEmailIndex.status === CUSTOMER_EMAIL_INDEX_STATUS.AMBIGUOUS ||
        (sourceEmailIndex.customerId &&
          sourceEmailIndex.customerId !== sourceId &&
          sourceEmailIndex.customerId !== targetId)
      ) {
        throw createCustomerServiceError(
          'customer/email-conflict',
          'Email profil sumber bentrok dengan profil customer lain.',
        );
      }
    }

    // 2. WRITES AFTER READS
    const timestamp = tx.nowValue();

    const combinedHistoryIds = Array.from(
      new Set([
        targetId,
        ...(target.historyCustomerIds || []),
        sourceId,
        ...(source.historyCustomerIds || []),
      ]),
    );

    const combinedAliases = mergeUniqueNameAliases(
      target.displayName,
      target.nameAliases,
      [source.displayName],
      source.nameAliases,
    );

    // Combine previousPhones without duplicates
    const prevPhonesMap = new Map();
    for (const entry of [...(target.previousPhones || []), ...(source.previousPhones || [])]) {
      if (entry?.phoneNormalized && entry.phoneNormalized !== target.phoneNormalized) {
        prevPhonesMap.set(entry.phoneNormalized, entry);
      }
    }
    if (source.phoneNormalized && source.phoneNormalized !== target.phoneNormalized) {
      prevPhonesMap.set(source.phoneNormalized, {
        phoneDisplay: source.phoneDisplay || formatPhoneDisplay(source.phoneNormalized),
        phoneNormalized: source.phoneNormalized,
        changedAt: timestamp,
      });
    }

    const firstBookingDates = [target.firstBookingDate, source.firstBookingDate].filter(Boolean);
    const lastBookingDates = [target.lastBookingDate, source.lastBookingDate].filter(Boolean);
    const nextFirstDate = firstBookingDates.length > 0 ? firstBookingDates.sort()[0] : '';
    const nextLastDate =
      lastBookingDates.length > 0 ? lastBookingDates.sort()[lastBookingDates.length - 1] : '';

    const combinedBookingCount =
      (Number(target.bookingCount) || 0) + (Number(source.bookingCount) || 0);

    const updatedTarget = {
      displayName: target.displayName,
      normalizedName: target.normalizedName || normalizeCustomerName(target.displayName),
      phoneDisplay: target.phoneDisplay,
      phoneNormalized: target.phoneNormalized,
      nameAliases: combinedAliases,
      previousPhones: Array.from(prevPhonesMap.values()),
      status: CUSTOMER_STATUS.ACTIVE,
      mergedIntoCustomerId: null,
      historyCustomerIds: combinedHistoryIds,
      bookingCount: combinedBookingCount,
      firstBookingDate: nextFirstDate,
      lastBookingDate: nextLastDate,
      notes: target.notes || source.notes || '',
      createdAt: target.createdAt,
      createdByUid: target.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(target.version) || 1) + 1,
      ...(adoptedEmailNormalized
        ? { email: adoptedEmailRaw, emailNormalized: adoptedEmailNormalized }
        : {}),
    };

    const updatedSource = {
      displayName: source.displayName,
      normalizedName: source.normalizedName || normalizeCustomerName(source.displayName),
      phoneDisplay: source.phoneDisplay,
      phoneNormalized: source.phoneNormalized,
      nameAliases: source.nameAliases,
      previousPhones: source.previousPhones,
      status: CUSTOMER_STATUS.MERGED,
      mergedIntoCustomerId: targetId,
      historyCustomerIds: source.historyCustomerIds,
      bookingCount: source.bookingCount,
      firstBookingDate: source.firstBookingDate,
      lastBookingDate: source.lastBookingDate,
      notes: source.notes,
      createdAt: source.createdAt,
      createdByUid: source.createdByUid,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(source.version) || 1) + 1,
      ...(sourceEmailNormalized ? { email: '', emailNormalized: '' } : {}),
    };

    tx.updateCustomer(targetId, updatedTarget);
    tx.updateCustomer(sourceId, updatedSource);

    if (
      sourceEmailNormalized &&
      targetEmailNormalized &&
      sourceEmailNormalized !== targetEmailNormalized &&
      sourceEmailIndex?.customerId === sourceId &&
      typeof tx.deleteEmailIndex === 'function'
    ) {
      tx.deleteEmailIndex(sourceEmailNormalized);
    } else if (
      !targetEmailNormalized &&
      sourceEmailNormalized &&
      typeof tx.setEmailIndex === 'function'
    ) {
      tx.setEmailIndex(sourceEmailNormalized, {
        schemaVersion: 1,
        emailNormalized: sourceEmailNormalized,
        customerId: targetId,
        status: CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(sourceEmailIndex?.version) || 0) + 1,
      });
    } else if (
      targetEmailNormalized &&
      !targetEmailIndex &&
      typeof tx.setEmailIndex === 'function'
    ) {
      tx.setEmailIndex(targetEmailNormalized, {
        schemaVersion: 1,
        emailNormalized: targetEmailNormalized,
        customerId: targetId,
        status: CUSTOMER_EMAIL_INDEX_STATUS.ACTIVE,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      });
    }

    if (sourceClientProfile && typeof tx.setClientProfile === 'function') {
      tx.setClientProfile(
        sourceId,
        buildClientSafeCustomerProfilePayload({
          customerId: sourceId,
          displayName: source.displayName,
          emailNormalized: '',
          phoneDisplay: source.phoneDisplay,
          status: CUSTOMER_STATUS.MERGED,
          timestamp,
          existingProfile: sourceClientProfile,
        }),
      );
    }

    if (
      (targetClientProfile || adoptedEmailNormalized) &&
      typeof tx.setClientProfile === 'function'
    ) {
      tx.setClientProfile(
        targetId,
        buildClientSafeCustomerProfilePayload({
          customerId: targetId,
          displayName: target.displayName,
          emailNormalized: adoptedEmailNormalized,
          phoneDisplay: target.phoneDisplay,
          status: CUSTOMER_STATUS.ACTIVE,
          timestamp,
          existingProfile: targetClientProfile,
        }),
      );
    }

    // Update Phone Index(es): source is no longer an active profile
    if (sourcePhoneHash === targetPhoneHash) {
      const nextActive = Array.from(
        new Set([
          ...(targetPhoneIndex?.activeCustomerIds || []).filter((id) => id !== sourceId),
          targetId,
        ]),
      );
      const nextHistorical = Array.from(
        new Set([...(targetPhoneIndex?.historicalCustomerIds || []), sourceId]),
      ).filter((id) => id !== targetId);

      tx.setPhoneIndex(targetPhoneHash, {
        phoneNormalized: target.phoneNormalized,
        activeCustomerIds: nextActive,
        historicalCustomerIds: nextHistorical,
        version: (Number(targetPhoneIndex?.version) || 0) + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    } else {
      // Cross-phone merge (e.g., phone-change conflict resolution)
      tx.setPhoneIndex(targetPhoneHash, {
        phoneNormalized: target.phoneNormalized,
        activeCustomerIds: Array.from(
          new Set([...(targetPhoneIndex?.activeCustomerIds || []), targetId]),
        ),
        historicalCustomerIds: (targetPhoneIndex?.historicalCustomerIds || []).filter(
          (id) => id !== targetId,
        ),
        version: (Number(targetPhoneIndex?.version) || 0) + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });

      tx.setPhoneIndex(sourcePhoneHash, {
        phoneNormalized: source.phoneNormalized,
        activeCustomerIds: (sourcePhoneIndex?.activeCustomerIds || []).filter(
          (id) => id !== sourceId,
        ),
        historicalCustomerIds: Array.from(
          new Set([...(sourcePhoneIndex?.historicalCustomerIds || []), sourceId]),
        ),
        version: (Number(sourcePhoneIndex?.version) || 0) + 1,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
      });
    }

    return {
      target: normalizeCustomerRecord(targetId, updatedTarget),
      source: normalizeCustomerRecord(sourceId, updatedSource),
    };
  });
}

/**
 * Loads deduplicated booking history across all `historyCustomerIds` for a Customer Profile
 * using chunked Firestore `in` queries and bounded page limits.
 */
export async function loadCustomerBookingHistory({
  customer,
  perChunkLimit = 100,
  adapter = getCustomerRepositoryAdapter(),
}) {
  if (!customer?.id) {
    return { bookings: [], isTruncated: false };
  }

  const historyIds = Array.from(
    new Set([
      customer.id,
      ...(Array.isArray(customer.historyCustomerIds) ? customer.historyCustomerIds : []),
    ]),
  );

  return adapter.queryBookingsByCustomerIds({
    customerIds: historyIds,
    perChunkLimit,
  });
}
