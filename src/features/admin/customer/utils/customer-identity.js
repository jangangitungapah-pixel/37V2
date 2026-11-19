/**
 * Customer Identity Resolution & Lightweight Name Matching Utilities
 * (Phase 7 — Phone Number First, Customer Identity Aware).
 */

import { normalizePhoneNumber, sha256HexSync } from './phone-number';

export const CUSTOMER_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  MERGED: 'merged',
};

export const IDENTITY_MATCH_STATUS = {
  NO_MATCH: 'no_match',
  HISTORICAL_ONLY: 'historical_only',
  EXACT_MATCH: 'exact_match',
  SINGLE_CONFLICT: 'single_conflict',
  MULTIPLE_MATCHES: 'multiple_matches',
};

export const CUSTOMER_RESOLUTION_MODE = {
  CREATE_NEW: 'create_new',
  REUSE_EXISTING: 'reuse_existing',
  MERGE_INTO_EXISTING: 'merge_into_existing',
  CREATE_SEPARATE: 'create_separate',
};

/**
 * Lightweight customer name normalization:
 * - Unicode NFKC normalization
 * - Trim leading/trailing whitespace
 * - Collapse consecutive whitespace into a single space
 * - Case-insensitive lowercase
 *
 * Does NOT strip meaningful words or numbers.
 */
export function normalizeCustomerName(rawName) {
  return String(rawName ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Compact alphanumeric-spacing form used only to match simple spacing variants
 * such as `Arief Music` <-> `Ariefmusic` <-> `ARIEF MUSIC`.
 */
export function normalizeCustomerNameCompact(rawName) {
  return normalizeCustomerName(rawName).replace(/\s+/g, '');
}

/**
 * Compares two customer names using lightweight normalization.
 * Returns true for case/whitespace variations (`Arief Music`, `Ariefmusic`, `ARIEF MUSIC`)
 * while keeping meaningfully different names distinct.
 */
export function areCustomerNamesEquivalent(nameA, nameB) {
  const normA = normalizeCustomerName(nameA);
  const normB = normalizeCustomerName(nameB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const compactA = normalizeCustomerNameCompact(normA);
  const compactB = normalizeCustomerNameCompact(normB);
  return compactA.length >= 3 && compactA === compactB;
}

/**
 * Checks whether an input customer name matches a profile's displayName or any recorded alias.
 */
export function doesProfileMatchCustomerName(profile, inputName) {
  if (!profile || !inputName) return false;
  if (areCustomerNamesEquivalent(profile.displayName, inputName)) {
    return true;
  }

  const aliases = Array.isArray(profile.nameAliases) ? profile.nameAliases : [];
  return aliases.some((alias) => areCustomerNamesEquivalent(alias, inputName));
}

/**
 * Appends a new name alias to a customer's `nameAliases` array without duplicating
 * the displayName or an existing equivalent alias.
 */
export function appendUniqueNameAlias(
  existingDisplayName,
  existingAliases = [],
  candidateName = '',
) {
  const cleanCandidate = String(candidateName || '').trim();
  const baseAliases = Array.isArray(existingAliases)
    ? existingAliases.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (!cleanCandidate) {
    return baseAliases;
  }

  if (areCustomerNamesEquivalent(existingDisplayName, cleanCandidate)) {
    return baseAliases;
  }

  if (baseAliases.some((alias) => areCustomerNamesEquivalent(alias, cleanCandidate))) {
    return baseAliases;
  }

  return [...baseAliases, cleanCandidate];
}

/**
 * Merges two alias lists cleanly, preserving original casing and deduplicating by normalized form.
 */
export function mergeUniqueNameAliases(targetDisplayName, ...aliasLists) {
  const result = [];

  for (const list of aliasLists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const clean = String(raw || '').trim();
      if (!clean) continue;
      if (areCustomerNamesEquivalent(targetDisplayName, clean)) continue;
      if (result.some((existing) => areCustomerNamesEquivalent(existing, clean))) continue;
      result.push(clean);
    }
  }

  return result;
}

/**
 * Follows `mergedIntoCustomerId` safely (with cycle guard) to locate the canonical target
 * profile when a reference points to a merged profile.
 */
export function resolveCanonicalCustomerProfile(customerId, profilesById) {
  const visited = new Set();
  let currentId = String(customerId || '').trim();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const profile =
      profilesById instanceof Map ? profilesById.get(currentId) : profilesById?.[currentId];
    if (!profile) return null;

    if (profile.status === CUSTOMER_STATUS.MERGED && profile.mergedIntoCustomerId) {
      currentId = profile.mergedIntoCustomerId;
      continue;
    }

    return profile;
  }

  return null;
}

/**
 * Resolves customer identity candidates from a `customerPhoneIndex` entry and loaded
 * customer profiles.
 *
 * Rules:
 * - Archived and merged profiles are NEVER silently selected for new bookings.
 * - Merged profiles referenced in an index resolve to their canonical active target if same phone.
 * - Recycled numbers (only present in `historicalCustomerIds`, zero active profiles) return
 *   `HISTORICAL_ONLY` so the new customer gets a fresh separate profile instead of auto-linking.
 * - 1 active profile + matching name/alias -> `EXACT_MATCH`.
 * - 1 active profile + different name -> `SINGLE_CONFLICT` (Merge vs Separate vs Review).
 * - 2+ active profiles -> `MULTIPLE_MATCHES` (user explicitly chooses profile or creates separate).
 */
export function resolveCustomerIdentityCandidates({
  inputName = '',
  phoneNormalized = '',
  phoneIndex = null,
  profilesById = new Map(),
}) {
  const canonicalPhone = normalizePhoneNumber(phoneNormalized);
  const getProfile = (id) =>
    profilesById instanceof Map ? profilesById.get(id) : profilesById?.[id];

  const rawActiveIds = Array.isArray(phoneIndex?.activeCustomerIds)
    ? phoneIndex.activeCustomerIds
    : [];
  const rawHistoricalIds = Array.isArray(phoneIndex?.historicalCustomerIds)
    ? phoneIndex.historicalCustomerIds
    : [];

  // Deduplicate and retain strictly ACTIVE profiles matching this canonical phone
  const activeProfilesMap = new Map();
  for (const id of rawActiveIds) {
    const resolved = resolveCanonicalCustomerProfile(id, profilesById);
    if (
      resolved &&
      resolved.status === CUSTOMER_STATUS.ACTIVE &&
      (!canonicalPhone || resolved.phoneNormalized === canonicalPhone)
    ) {
      activeProfilesMap.set(resolved.id, resolved);
    }
  }
  const activeProfiles = Array.from(activeProfilesMap.values());

  // Collect historical / archived profiles associated with this phone
  const historicalProfilesMap = new Map();
  for (const id of [...rawHistoricalIds, ...rawActiveIds]) {
    if (activeProfilesMap.has(id)) continue;
    const rawProfile = getProfile(id);
    if (!rawProfile) continue;
    if (
      rawProfile.status === CUSTOMER_STATUS.ARCHIVED ||
      rawProfile.phoneNormalized !== canonicalPhone
    ) {
      historicalProfilesMap.set(rawProfile.id, rawProfile);
    }
  }
  const historicalProfiles = Array.from(historicalProfilesMap.values());

  const phoneIndexVersion = Number(phoneIndex?.version) || 0;

  if (activeProfiles.length === 0) {
    if (historicalProfiles.length > 0) {
      return {
        status: IDENTITY_MATCH_STATUS.HISTORICAL_ONLY,
        phoneNormalized: canonicalPhone,
        phoneIndexVersion,
        matchedProfile: null,
        activeProfiles: [],
        historicalProfiles,
        suggestedMode: CUSTOMER_RESOLUTION_MODE.CREATE_NEW,
      };
    }

    return {
      status: IDENTITY_MATCH_STATUS.NO_MATCH,
      phoneNormalized: canonicalPhone,
      phoneIndexVersion,
      matchedProfile: null,
      activeProfiles: [],
      historicalProfiles: [],
      suggestedMode: CUSTOMER_RESOLUTION_MODE.CREATE_NEW,
    };
  }

  if (activeProfiles.length === 1) {
    const onlyProfile = activeProfiles[0];
    const cleanName = String(inputName || '').trim();
    const isNameMatch =
      cleanName.length > 0 && doesProfileMatchCustomerName(onlyProfile, cleanName);

    if (isNameMatch) {
      return {
        status: IDENTITY_MATCH_STATUS.EXACT_MATCH,
        phoneNormalized: canonicalPhone,
        phoneIndexVersion,
        matchedProfile: onlyProfile,
        activeProfiles,
        historicalProfiles,
        suggestedMode: CUSTOMER_RESOLUTION_MODE.REUSE_EXISTING,
      };
    }

    return {
      status: IDENTITY_MATCH_STATUS.SINGLE_CONFLICT,
      phoneNormalized: canonicalPhone,
      phoneIndexVersion,
      matchedProfile: onlyProfile,
      activeProfiles,
      historicalProfiles,
      suggestedMode: null,
    };
  }

  // Multiple active profiles share this phone number — never auto-select by highest bookingCount
  const nameMatchedProfile =
    String(inputName || '').trim().length > 0
      ? activeProfiles.find((profile) => doesProfileMatchCustomerName(profile, inputName)) || null
      : null;

  return {
    status: IDENTITY_MATCH_STATUS.MULTIPLE_MATCHES,
    phoneNormalized: canonicalPhone,
    phoneIndexVersion,
    matchedProfile: nameMatchedProfile,
    activeProfiles,
    historicalProfiles,
    suggestedMode: null,
  };
}

/**
 * Generates a deterministic Customer ID for legacy booking backfill groups keyed by
 * `(phoneNormalized + normalizedName)` so interrupted imports can safely resume without
 * creating duplicate customer profiles.
 */
export function buildDeterministicLegacyCustomerId(phoneNormalized, normalizedName) {
  const digest = sha256HexSync(`${phoneNormalized}|${normalizedName}`);
  return `cust_leg_${digest.slice(0, 20)}`;
}
