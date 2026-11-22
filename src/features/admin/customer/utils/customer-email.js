export const CUSTOMER_EMAIL_INDEX_STATUS = Object.freeze({
  ACTIVE: 'active',
  AMBIGUOUS: 'ambiguous',
});

export const CUSTOMER_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeCustomerEmail(rawEmail = '') {
  return String(rawEmail ?? '')
    .trim()
    .toLowerCase();
}

export function isValidCustomerEmail(rawEmail = '') {
  const normalized = normalizeCustomerEmail(rawEmail);
  if (normalized.length < 5 || normalized.length > 254) {
    return false;
  }
  if (normalized.includes('/') || normalized.includes('..')) {
    return false;
  }
  return CUSTOMER_EMAIL_REGEX.test(normalized);
}

/**
 * Builds the non-sensitive, client-safe `clientProfiles/{customerId}` projection written
 * atomically by Staff/Owner alongside `customers/{customerId}` and `customerEmailIndex/{emailNormalized}`.
 * Never copies internal `notes`, `createdByUid`, `updatedByUid`, `nameAliases`, or `previousPhones`.
 */
export function buildClientSafeCustomerProfilePayload({
  customerId,
  displayName,
  emailNormalized = '',
  phoneDisplay = '',
  status = 'active',
  timestamp,
  existingProfile = null,
}) {
  return {
    schemaVersion: 1,
    customerId: String(customerId || '').trim(),
    ownerUid: null,
    profileSource: 'linked_customer',
    displayName: String(displayName || '').trim() || 'Pelanggan Studio',
    emailNormalized: normalizeCustomerEmail(emailNormalized),
    phoneDisplay: String(phoneDisplay || '').trim(),
    photoURL: String(existingProfile?.photoURL || '').trim(),
    status: status === 'archived' || status === 'merged' ? 'archived' : 'active',
    createdAt: existingProfile?.createdAt || timestamp,
    updatedAt: timestamp,
    version: existingProfile ? Math.max(1, Number(existingProfile.version) || 1) + 1 : 1,
  };
}
