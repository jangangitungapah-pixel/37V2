/**
 * Legacy Booking History Backfill & Import Service (Phase 7 — Customer Management).
 *
 * Scans existing `bookings` lacking `customerId` via paginated queries, builds a preview
 * grouped strictly by `(phoneNormalized + normalizedName)` (never auto-merging different names),
 * separates invalid/missing phone records into `Needs Review`, and executes resumable
 * conservative batches (<= 400 writes per batch) using deterministic legacy Customer IDs.
 *
 * Safety invariants:
 * - Zero writes occur during preview scanning.
 * - Updates ONLY `customerId`, `phoneNormalized`, `updatedAt`, `updatedByUid`, `version` on legacy bookings.
 * - NEVER touches `customerName`, `phone`, financial snapshots, commission snapshots,
 *   payment data, dates, `bookingSlots`, or `bookingEvents`.
 * - Already-linked bookings (`booking.customerId`) are never overwritten or reprocessed.
 */

import { FIRESTORE_COLLECTIONS } from '@/features/admin/calendar/repositories/calendar-booking-repository';

import {
  getCustomerRepositoryAdapter,
  LEGACY_BOOKINGS_SCAN_PAGE_SIZE,
  MAX_BATCH_WRITES,
} from '../repositories/customer-repository';
import { normalizeCustomerRecord } from '../schemas/customer-schema';
import {
  buildDeterministicLegacyCustomerId,
  CUSTOMER_STATUS,
  normalizeCustomerName,
} from '../utils/customer-identity';
import {
  formatPhoneDisplay,
  getPhoneNumberHash,
  normalizePhoneNumber,
} from '../utils/phone-number';
import { createCustomerServiceError } from './customer-service';

const MAX_SCAN_PAGES = 50; // Up to 10,000 bookings safely scanned via bounded pages

/**
 * Scans legacy bookings via bounded pagination and builds an import preview without writing anything.
 */
export async function scanLegacyBookingsPreview({
  pageSize = LEGACY_BOOKINGS_SCAN_PAGE_SIZE,
  maxPages = MAX_SCAN_PAGES,
  adapter = getCustomerRepositoryAdapter(),
} = {}) {
  let cursor = null;
  let pagesScanned = 0;
  let hasMorePages = false;

  const allScannedBookings = [];
  const alreadyLinkedBookings = [];
  const unlinkedBookings = [];

  while (pagesScanned < maxPages) {
    const page = await adapter.listBookingsPage({ pageSize, cursor });
    pagesScanned += 1;

    for (const booking of page.bookings) {
      allScannedBookings.push(booking);
      if (booking.customerId) {
        alreadyLinkedBookings.push(booking);
      } else {
        unlinkedBookings.push(booking);
      }
    }

    if (!page.hasMore || !page.nextCursor) {
      hasMorePages = false;
      break;
    }

    cursor = page.nextCursor;
    hasMorePages = true;
  }

  // Group unlinked bookings by `(phoneNormalized + normalizedName)`
  const groupsMap = new Map();
  const phoneToGroupKeys = new Map();
  const needsReviewBookings = [];

  for (const booking of unlinkedBookings) {
    const phoneNormalized = normalizePhoneNumber(booking.phoneNormalized || booking.phone);
    const normalizedName = normalizeCustomerName(booking.customerName);

    if (!phoneNormalized || !normalizedName) {
      needsReviewBookings.push({
        booking,
        reason: !phoneNormalized
          ? 'Nomor HP kosong atau format tidak valid'
          : 'Nama customer kosong',
      });
      continue;
    }

    const groupKey = `${phoneNormalized}|${normalizedName}`;
    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        groupKey,
        deterministicCustomerId: buildDeterministicLegacyCustomerId(
          phoneNormalized,
          normalizedName,
        ),
        phoneNormalized,
        phoneDisplay: formatPhoneDisplay(phoneNormalized),
        displayName: String(booking.customerName || '').trim(),
        normalizedName,
        bookings: [],
        firstBookingDate: booking.date || '',
        lastBookingDate: booking.date || '',
      });
    }

    const group = groupsMap.get(groupKey);
    group.bookings.push(booking);
    if (booking.date) {
      if (!group.firstBookingDate || booking.date < group.firstBookingDate) {
        group.firstBookingDate = booking.date;
      }
      if (!group.lastBookingDate || booking.date > group.lastBookingDate) {
        group.lastBookingDate = booking.date;
      }
    }

    if (!phoneToGroupKeys.has(phoneNormalized)) {
      phoneToGroupKeys.set(phoneNormalized, new Set());
    }
    phoneToGroupKeys.get(phoneNormalized).add(groupKey);
  }

  const groups = Array.from(groupsMap.values()).map((group) => {
    const samePhoneKeys = phoneToGroupKeys.get(group.phoneNormalized);
    return {
      ...group,
      isSharedNumber: (samePhoneKeys?.size || 0) > 1,
    };
  });

  const sharedNumberGroups = [];
  for (const [phoneNormalized, keys] of phoneToGroupKeys.entries()) {
    if (keys.size > 1) {
      sharedNumberGroups.push({
        phoneNormalized,
        phoneDisplay: formatPhoneDisplay(phoneNormalized),
        profileNames: Array.from(keys).map((k) => groupsMap.get(k)?.displayName || ''),
      });
    }
  }

  return {
    totalScannedBookings: allScannedBookings.length,
    totalLegacyUnlinked: unlinkedBookings.length,
    alreadyLinkedCount: alreadyLinkedBookings.length,
    importableBookingCount: unlinkedBookings.length - needsReviewBookings.length,
    uniqueNormalizedPhones: phoneToGroupKeys.size,
    estimatedProfiles: groups.length,
    samePhoneDifferentNamesCount: sharedNumberGroups.length,
    sharedNumberGroups,
    needsReviewCount: needsReviewBookings.length,
    needsReviewBookings,
    groups,
    hasMorePages,
  };
}

/**
 * Executes resumable batch import for previewed legacy bookings.
 * - Uses deterministic Customer IDs so interrupted retries never duplicate profiles.
 * - Matches existing active customer profiles on the same `(phoneNormalized + normalizedName)` if already present.
 * - Caps every batch strictly at <= `maxBatchWrites` (default 400, safely under Firestore's 500-op limit).
 * - Never overwrites bookings that already have `customerId`.
 */
export async function importLegacyBookingHistory({
  actorUid,
  preview = null,
  maxBatchWrites = MAX_BATCH_WRITES,
  onProgress = null,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = String(actorUid || '').trim();
  if (!cleanActorUid) {
    throw createCustomerServiceError(
      'customer/missing-actor',
      'Sesi pengguna tidak valid untuk menjalankan import histori booking.',
    );
  }

  const effectivePreview = preview || (await scanLegacyBookingsPreview({ adapter }));
  const groups = effectivePreview.groups || [];

  if (groups.length === 0) {
    return {
      linkedBookingsCount: 0,
      createdProfilesCount: 0,
      reusedProfilesCount: 0,
      skippedAlreadyLinkedCount: effectivePreview.alreadyLinkedCount || 0,
      needsReviewCount: effectivePreview.needsReviewCount || 0,
      batchesCommitted: 0,
    };
  }

  // Group legacy groups by phoneNormalized so each phoneIndex document is updated once per batch
  const groupsByPhone = new Map();
  for (const group of groups) {
    if (!groupsByPhone.has(group.phoneNormalized)) {
      groupsByPhone.set(group.phoneNormalized, []);
    }
    groupsByPhone.get(group.phoneNormalized).push(group);
  }

  const operations = [];
  let createdProfilesCount = 0;
  let reusedProfilesCount = 0;
  let linkedBookingsCount = 0;

  for (const [phoneNormalized, phoneGroups] of groupsByPhone.entries()) {
    const phoneHash = await getPhoneNumberHash(phoneNormalized);
    const existingIndex = await adapter.getPhoneIndex(phoneHash);
    const existingActiveIds = Array.isArray(existingIndex?.activeCustomerIds)
      ? existingIndex.activeCustomerIds
      : [];
    const existingProfiles =
      existingActiveIds.length > 0 ? await adapter.getCustomersByIds(existingActiveIds) : [];

    const nextActiveIds = new Set(existingActiveIds);
    const existingHistoricalIds = new Set(existingIndex?.historicalCustomerIds || []);

    for (const group of phoneGroups) {
      // Only link bookings that still lack customerId (resumable safety)
      const pendingBookings = (group.bookings || []).filter((b) => !b.customerId);
      if (pendingBookings.length === 0) continue;

      // Check if an existing active profile already matches exact `(phoneNormalized + normalizedName)`
      // OR if our deterministic legacy ID already exists from an earlier interrupted run
      let existingMatch =
        existingProfiles.find(
          (p) =>
            p.status === CUSTOMER_STATUS.ACTIVE &&
            p.phoneNormalized === phoneNormalized &&
            p.normalizedName === group.normalizedName,
        ) || (await adapter.getCustomerById(group.deterministicCustomerId));

      const targetCustomerId = existingMatch?.id || group.deterministicCustomerId;
      nextActiveIds.add(targetCustomerId);
      existingHistoricalIds.delete(targetCustomerId);

      if (existingMatch) {
        reusedProfilesCount += 1;
        const firstDate =
          [existingMatch.firstBookingDate, group.firstBookingDate].filter(Boolean).sort()[0] || '';
        const lastDates = [existingMatch.lastBookingDate, group.lastBookingDate]
          .filter(Boolean)
          .sort();
        const lastDate = lastDates[lastDates.length - 1] || '';

        operations.push({
          type: 'update',
          collection: FIRESTORE_COLLECTIONS.CUSTOMERS,
          id: targetCustomerId,
          buildData: (now) => ({
            displayName: existingMatch.displayName,
            normalizedName: existingMatch.normalizedName,
            phoneDisplay: existingMatch.phoneDisplay,
            phoneNormalized: existingMatch.phoneNormalized,
            nameAliases: existingMatch.nameAliases,
            previousPhones: existingMatch.previousPhones,
            status: CUSTOMER_STATUS.ACTIVE,
            mergedIntoCustomerId: null,
            historyCustomerIds: Array.from(
              new Set([targetCustomerId, ...(existingMatch.historyCustomerIds || [])]),
            ),
            bookingCount: (Number(existingMatch.bookingCount) || 0) + pendingBookings.length,
            firstBookingDate: firstDate,
            lastBookingDate: lastDate,
            notes: existingMatch.notes,
            createdAt: existingMatch.createdAt || now,
            createdByUid: existingMatch.createdByUid || cleanActorUid,
            updatedAt: now,
            updatedByUid: cleanActorUid,
            version: (Number(existingMatch.version) || 1) + 1,
          }),
        });
      } else {
        createdProfilesCount += 1;
        operations.push({
          type: 'set',
          collection: FIRESTORE_COLLECTIONS.CUSTOMERS,
          id: targetCustomerId,
          buildData: (now) => ({
            displayName: group.displayName,
            normalizedName: group.normalizedName,
            phoneDisplay: group.phoneDisplay,
            phoneNormalized,
            nameAliases: [],
            previousPhones: [],
            status: CUSTOMER_STATUS.ACTIVE,
            mergedIntoCustomerId: null,
            historyCustomerIds: [targetCustomerId],
            bookingCount: pendingBookings.length,
            firstBookingDate: group.firstBookingDate || '',
            lastBookingDate: group.lastBookingDate || '',
            notes: '',
            createdAt: now,
            createdByUid: cleanActorUid,
            updatedAt: now,
            updatedByUid: cleanActorUid,
            version: 1,
          }),
        });
      }

      // Queue one-time link updates for each unlinked legacy booking (ONLY customerId + phoneNormalized + audit version)
      for (const booking of pendingBookings) {
        linkedBookingsCount += 1;
        operations.push({
          type: 'update',
          collection: FIRESTORE_COLLECTIONS.BOOKINGS,
          id: booking.id,
          buildData: (now) => ({
            customerId: targetCustomerId,
            phoneNormalized,
            updatedAt: now,
            updatedByUid: cleanActorUid,
            version: (Number(booking.version) || 1) + 1,
          }),
        });
      }
    }

    // Queue Phone Index write for this canonical phone
    operations.push({
      type: 'set',
      collection: FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX,
      id: phoneHash,
      buildData: (now) => ({
        phoneNormalized,
        activeCustomerIds: Array.from(nextActiveIds),
        historicalCustomerIds: Array.from(existingHistoricalIds),
        version: (Number(existingIndex?.version) || 0) + 1,
        updatedAt: now,
        updatedByUid: cleanActorUid,
      }),
    });
  }

  // Commit in conservative chunks (<= maxBatchWrites, ensuring customer creation precedes booking updates)
  const safeLimit = Math.max(
    1,
    Math.min(MAX_BATCH_WRITES, Number(maxBatchWrites) || MAX_BATCH_WRITES),
  );
  let batchesCommitted = 0;

  // Order operations: customers first, phone indexes second, booking links last so Firestore Rules `getAfter` / existence checks always pass cleanly even across batches!
  const customerOps = operations.filter((op) => op.collection === FIRESTORE_COLLECTIONS.CUSTOMERS);
  const indexOps = operations.filter(
    (op) => op.collection === FIRESTORE_COLLECTIONS.CUSTOMER_PHONE_INDEX,
  );
  const bookingOps = operations.filter((op) => op.collection === FIRESTORE_COLLECTIONS.BOOKINGS);
  const orderedOps = [...customerOps, ...indexOps, ...bookingOps];

  for (let offset = 0; offset < orderedOps.length; offset += safeLimit) {
    const batchSlice = orderedOps.slice(offset, offset + safeLimit);
    await adapter.commitBatchWrites(batchSlice);
    batchesCommitted += 1;
    onProgress?.({
      processedOperations: Math.min(offset + batchSlice.length, orderedOps.length),
      totalOperations: orderedOps.length,
      batchesCommitted,
    });
  }

  return {
    linkedBookingsCount,
    createdProfilesCount,
    reusedProfilesCount,
    skippedAlreadyLinkedCount: effectivePreview.alreadyLinkedCount || 0,
    needsReviewCount: effectivePreview.needsReviewCount || 0,
    batchesCommitted,
  };
}

/**
 * Resolves a single `Needs Review` legacy booking (missing/invalid phone) either by:
 * - Linking it to an existing active Customer Profile (`existingCustomerId`), OR
 * - Providing a valid phone number (`correctedPhone`) to create/link a Customer Profile atomically.
 *
 * Historical booking snapshots (`customerName`, `phone`, pricing, payment, schedule) remain untouched;
 * ONLY `customerId`, `phoneNormalized`, `updatedAt`, `updatedByUid`, `version` are updated.
 */
export async function resolveNeedsReviewLegacyBooking({
  bookingId,
  existingCustomerId = '',
  correctedPhone = '',
  actorUid,
  adapter = getCustomerRepositoryAdapter(),
}) {
  const cleanActorUid = String(actorUid || '').trim();
  const cleanBookingId = String(bookingId || '').trim();
  if (!cleanActorUid || !cleanBookingId) {
    throw createCustomerServiceError(
      'customer/invalid-review-link',
      'ID booking dan sesi pengguna wajib valid.',
    );
  }

  const cleanTargetId = String(existingCustomerId || '').trim();
  const normalizedCorrectedPhone = correctedPhone ? normalizePhoneNumber(correctedPhone) : '';

  if (!cleanTargetId && !normalizedCorrectedPhone) {
    throw createCustomerServiceError(
      'customer/invalid-phone',
      'Pilih profil customer eksisting atau masukkan nomor HP yang valid.',
    );
  }

  return adapter.runAtomicTransaction(async (tx) => {
    const booking = await tx.getBooking(cleanBookingId);
    if (!booking) {
      throw createCustomerServiceError('customer/booking-not-found', 'Booking tidak ditemukan.');
    }
    if (booking.customerId) {
      return { booking, customerId: booking.customerId };
    }

    if (cleanTargetId) {
      const targetCustomer = await tx.getCustomer(cleanTargetId);
      if (!targetCustomer || targetCustomer.status !== CUSTOMER_STATUS.ACTIVE) {
        throw createCustomerServiceError(
          'customer/not-found',
          'Profil customer target tidak ditemukan atau tidak aktif.',
        );
      }

      const timestamp = tx.nowValue();
      const firstDate =
        [targetCustomer.firstBookingDate, booking.date].filter(Boolean).sort()[0] || '';
      const lastDates = [targetCustomer.lastBookingDate, booking.date].filter(Boolean).sort();
      const lastDate = lastDates[lastDates.length - 1] || '';

      tx.updateCustomer(cleanTargetId, {
        displayName: targetCustomer.displayName,
        normalizedName: targetCustomer.normalizedName,
        phoneDisplay: targetCustomer.phoneDisplay,
        phoneNormalized: targetCustomer.phoneNormalized,
        nameAliases: targetCustomer.nameAliases,
        previousPhones: targetCustomer.previousPhones,
        status: targetCustomer.status,
        mergedIntoCustomerId: targetCustomer.mergedIntoCustomerId,
        historyCustomerIds: targetCustomer.historyCustomerIds,
        bookingCount: (Number(targetCustomer.bookingCount) || 0) + 1,
        firstBookingDate: firstDate,
        lastBookingDate: lastDate,
        notes: targetCustomer.notes,
        createdAt: targetCustomer.createdAt,
        createdByUid: targetCustomer.createdByUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(targetCustomer.version) || 1) + 1,
      });

      tx.updateBooking(cleanBookingId, {
        customerId: cleanTargetId,
        phoneNormalized: targetCustomer.phoneNormalized,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(booking.version) || 1) + 1,
      });

      return {
        customerId: cleanTargetId,
        phoneNormalized: targetCustomer.phoneNormalized,
        customer: normalizeCustomerRecord(cleanTargetId, {
          ...targetCustomer,
          bookingCount: (Number(targetCustomer.bookingCount) || 0) + 1,
        }),
      };
    }

    // Create/link using corrected valid phone
    const displayName = String(booking.customerName || 'Customer Tanpa Nama').trim();
    const normalizedName = normalizeCustomerName(displayName);
    const deterministicId = buildDeterministicLegacyCustomerId(
      normalizedCorrectedPhone,
      normalizedName,
    );
    const phoneHash = await getPhoneNumberHash(normalizedCorrectedPhone);

    const [existingCustomer, existingIndex] = await Promise.all([
      tx.getCustomer(deterministicId),
      tx.getPhoneIndex(phoneHash),
    ]);

    const timestamp = tx.nowValue();
    if (existingCustomer) {
      const firstDate =
        [existingCustomer.firstBookingDate, booking.date].filter(Boolean).sort()[0] || '';
      const lastDates = [existingCustomer.lastBookingDate, booking.date].filter(Boolean).sort();
      const lastDate = lastDates[lastDates.length - 1] || '';

      tx.updateCustomer(deterministicId, {
        displayName: existingCustomer.displayName,
        normalizedName: existingCustomer.normalizedName,
        phoneDisplay: existingCustomer.phoneDisplay,
        phoneNormalized: existingCustomer.phoneNormalized,
        nameAliases: existingCustomer.nameAliases,
        previousPhones: existingCustomer.previousPhones,
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: existingCustomer.historyCustomerIds,
        bookingCount: (Number(existingCustomer.bookingCount) || 0) + 1,
        firstBookingDate: firstDate,
        lastBookingDate: lastDate,
        notes: existingCustomer.notes,
        createdAt: existingCustomer.createdAt,
        createdByUid: existingCustomer.createdByUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: (Number(existingCustomer.version) || 1) + 1,
      });
    } else {
      tx.setCustomer(deterministicId, {
        displayName,
        normalizedName,
        phoneDisplay: formatPhoneDisplay(normalizedCorrectedPhone),
        phoneNormalized: normalizedCorrectedPhone,
        nameAliases: [],
        previousPhones: [],
        status: CUSTOMER_STATUS.ACTIVE,
        mergedIntoCustomerId: null,
        historyCustomerIds: [deterministicId],
        bookingCount: 1,
        firstBookingDate: booking.date || '',
        lastBookingDate: booking.date || '',
        notes: '',
        createdAt: timestamp,
        createdByUid: cleanActorUid,
        updatedAt: timestamp,
        updatedByUid: cleanActorUid,
        version: 1,
      });
    }

    tx.setPhoneIndex(phoneHash, {
      phoneNormalized: normalizedCorrectedPhone,
      activeCustomerIds: Array.from(
        new Set([...(existingIndex?.activeCustomerIds || []), deterministicId]),
      ),
      historicalCustomerIds: (existingIndex?.historicalCustomerIds || []).filter(
        (id) => id !== deterministicId,
      ),
      version: (Number(existingIndex?.version) || 0) + 1,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
    });

    tx.updateBooking(cleanBookingId, {
      customerId: deterministicId,
      phoneNormalized: normalizedCorrectedPhone,
      updatedAt: timestamp,
      updatedByUid: cleanActorUid,
      version: (Number(booking.version) || 1) + 1,
    });

    return {
      customerId: deterministicId,
      phoneNormalized: normalizedCorrectedPhone,
    };
  });
}
