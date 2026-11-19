/**
 * Customer Directory Grouping, Filtering, Sorting & Virtual Merged History Utilities
 * (Phase 7 — Customer Management).
 */

import { CUSTOMER_STATUS, normalizeCustomerName } from './customer-identity';
import { buildPhoneSearchTokens, formatPhoneDisplay } from './phone-number';

export const CUSTOMER_FILTER_OPTIONS = [
  { id: 'all', label: 'Semua Pelanggan', compactLabel: 'Semua' },
  { id: 'shared', label: 'Nomor Bersama', compactLabel: 'No. Bersama' },
  { id: 'recent', label: 'Baru Aktif', compactLabel: 'Baru Aktif' },
  { id: 'archived', label: 'Diarsipkan', compactLabel: 'Arsip' },
];

export const CUSTOMER_SORT_OPTIONS = [
  { id: 'latest_booking', label: 'Urut: Booking Terbaru' },
  { id: 'oldest_booking', label: 'Urut: Booking Terlama' },
  { id: 'most_bookings', label: 'Urut: Booking Terbanyak' },
  { id: 'name_asc', label: 'Urut: Nama A–Z' },
];

export const FIRESTORE_IN_QUERY_CHUNK_SIZE = 10;

/**
 * Splits an array into fixed-size chunks (used to stay safely inside Firestore `in` query limits).
 */
export function chunkArray(items = [], chunkSize = FIRESTORE_IN_QUERY_CHUNK_SIZE) {
  const safeSize = Math.max(1, Math.floor(Number(chunkSize) || FIRESTORE_IN_QUERY_CHUNK_SIZE));
  const uniqueItems = Array.from(new Set((items || []).filter(Boolean)));
  const chunks = [];
  for (let i = 0; i < uniqueItems.length; i += safeSize) {
    chunks.push(uniqueItems.slice(i, i + safeSize));
  }
  return chunks;
}

/**
 * Merges booking lists from multiple `historyCustomerIds`, deduplicates by `booking.id`,
 * and sorts in descending chronological order (`date` desc, `startMinute` desc).
 */
export function mergeAndDeduplicateBookings(bookingLists = []) {
  const byId = new Map();

  for (const list of bookingLists) {
    if (!Array.isArray(list)) continue;
    for (const booking of list) {
      if (!booking || !booking.id) continue;
      if (!byId.has(booking.id)) {
        byId.set(booking.id, booking);
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    const minCmp = (Number(b.startMinute) || 0) - (Number(a.startMinute) || 0);
    if (minCmp !== 0) return minCmp;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

/**
 * Extracts distinct non-empty band / project names from a customer's booking history
 * while preserving the most recent appearance order.
 */
export function extractDistinctBandNames(bookings = []) {
  const seen = new Set();
  const result = [];

  for (const booking of bookings) {
    const clean = String(booking?.bandName || '').trim();
    if (!clean) continue;
    const key = normalizeCustomerName(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

/**
 * Computes directory-level headline metrics (Profiles vs Unique Phone Numbers vs Shared Groups)
 * from active customer profiles.
 */
export function computeCustomerDirectoryMetrics(customers = []) {
  const activeCustomers = customers.filter((c) => c.status === CUSTOMER_STATUS.ACTIVE);
  const archivedCount = customers.filter((c) => c.status === CUSTOMER_STATUS.ARCHIVED).length;

  const phoneBuckets = new Map();
  for (const customer of activeCustomers) {
    const phoneKey = customer.phoneNormalized || customer.id;
    if (!phoneBuckets.has(phoneKey)) {
      phoneBuckets.set(phoneKey, []);
    }
    phoneBuckets.get(phoneKey).push(customer);
  }

  let sharedPhoneCount = 0;
  let sharedProfileCount = 0;
  for (const bucket of phoneBuckets.values()) {
    if (bucket.length > 1) {
      sharedPhoneCount += 1;
      sharedProfileCount += bucket.length;
    }
  }

  return {
    totalActiveProfiles: activeCustomers.length,
    uniqueActivePhones: phoneBuckets.size,
    sharedPhoneCount,
    sharedProfileCount,
    archivedCount,
  };
}

/**
 * Checks whether a customer profile matches a search query across:
 * - displayName & nameAliases
 * - canonical & display primary phone
 * - previousPhones (historical numbers)
 * - historical band / project names (if supplied via `bandNamesByCustomerId`)
 */
export function doesCustomerMatchSearch(customer, rawQuery, bandNamesByCustomerId = null) {
  const trimmed = String(rawQuery ?? '').trim();
  if (!trimmed) return true;

  const normalizedQuery = normalizeCustomerName(trimmed);
  const phoneTokens = buildPhoneSearchTokens(trimmed);

  // 1. Name & aliases match
  if (normalizedQuery) {
    if (normalizeCustomerName(customer.displayName).includes(normalizedQuery)) {
      return true;
    }

    const aliases = Array.isArray(customer.nameAliases) ? customer.nameAliases : [];
    if (aliases.some((alias) => normalizeCustomerName(alias).includes(normalizedQuery))) {
      return true;
    }

    if (normalizeCustomerName(customer.notes).includes(normalizedQuery)) {
      return true;
    }

    // Band/project history names (from either customer.bandHistory or auxiliary map)
    const bandList = [
      ...(Array.isArray(customer.bandHistory) ? customer.bandHistory : []),
      ...(bandNamesByCustomerId?.get?.(customer.id) || []),
    ];
    if (bandList.some((band) => normalizeCustomerName(band).includes(normalizedQuery))) {
      return true;
    }
  }

  // 2. Normalized & local phone match (primary + previousPhones)
  const rawLower = trimmed.toLowerCase();
  const candidatePhones = [
    customer.phoneNormalized,
    customer.phoneDisplay,
    ...(Array.isArray(customer.previousPhones)
      ? customer.previousPhones.flatMap((prev) => [prev?.phoneNormalized, prev?.phoneDisplay])
      : []),
  ].filter(Boolean);

  for (const phoneStr of candidatePhones) {
    const cleanPhone = String(phoneStr).toLowerCase();
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (cleanPhone.includes(rawLower)) {
      return true;
    }
    if (
      phoneTokens.some(
        (token) =>
          cleanPhone.includes(token.toLowerCase()) || digitsOnly.includes(token.replace(/\D/g, '')),
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether `lastBookingDate` (`YYYY-MM-DD`) falls within the last `recentDays` days.
 */
function isRecentlyActive(customer, referenceDateIso = '', recentDays = 30) {
  const lastDate = String(customer?.lastBookingDate || '').trim();
  if (!lastDate) return false;
  const refMs = referenceDateIso ? Date.parse(`${referenceDateIso}T00:00:00Z`) : Date.now();
  const lastMs = Date.parse(`${lastDate}T00:00:00Z`);
  if (Number.isNaN(refMs) || Number.isNaN(lastMs)) return false;
  const diffDays = (refMs - lastMs) / 86_400_000;
  return diffDays >= -365 && diffDays <= recentDays;
}

function compareProfiles(a, b, sortBy) {
  if (sortBy === 'oldest_booking') {
    const aDate = a.lastBookingDate || a.firstBookingDate || '9999-99-99';
    const bDate = b.lastBookingDate || b.firstBookingDate || '9999-99-99';
    const cmp = aDate.localeCompare(bDate);
    if (cmp !== 0) return cmp;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''));
  }

  if (sortBy === 'most_bookings') {
    const cmp = (Number(b.bookingCount) || 0) - (Number(a.bookingCount) || 0);
    if (cmp !== 0) return cmp;
    return String(b.lastBookingDate || '').localeCompare(String(a.lastBookingDate || ''));
  }

  if (sortBy === 'name_asc') {
    const cmp = String(a.displayName || '').localeCompare(String(b.displayName || ''), 'id', {
      sensitivity: 'base',
    });
    if (cmp !== 0) return cmp;
    return (Number(b.bookingCount) || 0) - (Number(a.bookingCount) || 0);
  }

  // Default: latest_booking
  const aDate = a.lastBookingDate || '';
  const bDate = b.lastBookingDate || '';
  const cmp = bDate.localeCompare(aDate);
  if (cmp !== 0) return cmp;
  return (Number(b.bookingCount) || 0) - (Number(a.bookingCount) || 0);
}

/**
 * Groups customer profiles by canonical `phoneNormalized` (the default directory view),
 * applies status/shared/recent filters, search, and deterministic sorting.
 *
 * Also flags `possibleDuplicateName` when a customer shares the exact same normalizedName
 * with another active profile on a DIFFERENT phone number (Scenario 1).
 */
export function buildCustomerPhoneGroups({
  customers = [],
  searchQuery = '',
  filter = 'all',
  sortBy = 'latest_booking',
  bandNamesByCustomerId = null,
  referenceDateIso = '',
}) {
  // Detect Scenario 1: same normalizedName across different phone numbers (informational badge only)
  const nameToPhones = new Map();
  for (const c of customers) {
    if (c.status !== CUSTOMER_STATUS.ACTIVE) continue;
    const normName = normalizeCustomerName(c.displayName);
    if (!normName) continue;
    if (!nameToPhones.has(normName)) {
      nameToPhones.set(normName, new Set());
    }
    nameToPhones.get(normName).add(c.phoneNormalized);
  }

  // Count active profiles per phone before filtering so `shared` detection stays accurate
  const activeCountByPhone = new Map();
  for (const c of customers) {
    if (c.status === CUSTOMER_STATUS.ACTIVE) {
      activeCountByPhone.set(
        c.phoneNormalized,
        (activeCountByPhone.get(c.phoneNormalized) || 0) + 1,
      );
    }
  }

  // Filter status first: default excludes `archived` and `merged`; `archived` shows archived
  const statusMatched = customers.filter((customer) => {
    if (filter === 'archived') {
      return customer.status === CUSTOMER_STATUS.ARCHIVED;
    }
    if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
      return false;
    }
    if (filter === 'shared') {
      return (activeCountByPhone.get(customer.phoneNormalized) || 0) > 1;
    }
    if (filter === 'recent') {
      return isRecentlyActive(customer, referenceDateIso, 30);
    }
    return true;
  });

  // Search filter
  const searchMatched = statusMatched.filter((customer) =>
    doesCustomerMatchSearch(customer, searchQuery, bandNamesByCustomerId),
  );

  // Group by canonical phoneNormalized
  const groupsMap = new Map();
  for (const customer of searchMatched) {
    const key = customer.phoneNormalized || `unindexed-${customer.id}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        phoneNormalized: customer.phoneNormalized,
        phoneDisplay: formatPhoneDisplay(customer.phoneNormalized || customer.phoneDisplay),
        profiles: [],
      });
    }
    const normName = normalizeCustomerName(customer.displayName);
    const sameNameDifferentPhone =
      customer.status === CUSTOMER_STATUS.ACTIVE && (nameToPhones.get(normName)?.size || 0) > 1;

    groupsMap.get(key).profiles.push({
      ...customer,
      sameNameDifferentPhone,
    });
  }

  // Sort profiles inside each group and compute group summary sort keys
  const groups = Array.from(groupsMap.values()).map((group) => {
    const sortedProfiles = [...group.profiles].sort((a, b) => compareProfiles(a, b, sortBy));
    const totalBookings = sortedProfiles.reduce(
      (sum, item) => sum + (Number(item.bookingCount) || 0),
      0,
    );
    const latestBookingDate = sortedProfiles.reduce(
      (best, item) =>
        item.lastBookingDate && item.lastBookingDate > best ? item.lastBookingDate : best,
      '',
    );
    const oldestBookingDate = sortedProfiles.reduce((best, item) => {
      const candidate = item.lastBookingDate || item.firstBookingDate || '';
      if (!candidate) return best;
      if (!best || candidate < best) return candidate;
      return best;
    }, '');

    const activeTotalOnPhone =
      activeCountByPhone.get(group.phoneNormalized) || sortedProfiles.length;

    return {
      ...group,
      profiles: sortedProfiles,
      profileCount: sortedProfiles.length,
      isSharedNumber:
        filter === 'archived'
          ? sortedProfiles.length > 1
          : activeTotalOnPhone > 1 || sortedProfiles.length > 1,
      totalBookings,
      latestBookingDate,
      oldestBookingDate,
      primarySortName: sortedProfiles[0]?.displayName || '',
    };
  });

  // Sort groups consistently with selected sort mode
  groups.sort((a, b) => {
    if (sortBy === 'oldest_booking') {
      const aDate = a.oldestBookingDate || '9999-99-99';
      const bDate = b.oldestBookingDate || '9999-99-99';
      const cmp = aDate.localeCompare(bDate);
      if (cmp !== 0) return cmp;
      return a.primarySortName.localeCompare(b.primarySortName);
    }

    if (sortBy === 'most_bookings') {
      const cmp = b.totalBookings - a.totalBookings;
      if (cmp !== 0) return cmp;
      return b.latestBookingDate.localeCompare(a.latestBookingDate);
    }

    if (sortBy === 'name_asc') {
      return a.primarySortName.localeCompare(b.primarySortName, 'id', { sensitivity: 'base' });
    }

    // Default: latest_booking
    const cmp = b.latestBookingDate.localeCompare(a.latestBookingDate);
    if (cmp !== 0) return cmp;
    return b.totalBookings - a.totalBookings;
  });

  return groups;
}
