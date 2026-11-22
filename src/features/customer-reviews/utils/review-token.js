import { sha256HexSync } from '@/features/admin/customer/utils/phone-number';

import { CUSTOMER_REVIEW_LIMITS } from '../config/customer-review-config';

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Encodes a `Uint8Array` into a lowercase hexadecimal string.
 */
export function bytesToHex(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('Expected Uint8Array for hex encoding.');
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a cryptographically random 256-bit (32-byte -> 64 hex chars) invitation token.
 * Never falls back to non-cryptographic `Math.random()`.
 */
export function generateReviewToken() {
  if (
    typeof globalThis === 'undefined' ||
    typeof globalThis.crypto?.getRandomValues !== 'function'
  ) {
    throw new Error('Cryptographic random generator unavailable for review token creation.');
  }

  const randomBytes = globalThis.crypto.getRandomValues(
    new Uint8Array(CUSTOMER_REVIEW_LIMITS.tokenByteLength),
  );
  return bytesToHex(randomBytes);
}

/**
 * Normalizes and validates raw invitation token syntax (64 hexadecimal chars).
 */
export function normalizeReviewTokenInput(rawToken = '') {
  return String(rawToken || '')
    .trim()
    .toLowerCase();
}

export function isValidReviewTokenSyntax(rawToken = '') {
  return HEX_64_PATTERN.test(normalizeReviewTokenInput(rawToken));
}

export function isValidTokenHash(tokenHash = '') {
  return HEX_64_PATTERN.test(String(tokenHash || '').trim());
}

/**
 * Computes deterministic SHA-256 lowercase 64-char hex digest of a raw invitation token.
 * Uses Web Crypto `crypto.subtle.digest` with byte-identical pure-JS fallback (`sha256HexSync`).
 */
export async function hashReviewToken(rawToken = '') {
  const cleanToken = normalizeReviewTokenInput(rawToken);
  if (!isValidReviewTokenSyntax(cleanToken)) {
    throw new Error('Invalid review invitation token format.');
  }

  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.subtle?.digest === 'function'
  ) {
    try {
      const encoded = new TextEncoder().encode(cleanToken);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
      return bytesToHex(new Uint8Array(digest));
    } catch {
      return sha256HexSync(cleanToken);
    }
  }

  return sha256HexSync(cleanToken);
}

/**
 * Constructs a shareable review URL for transient display/copying using the active origin.
 */
export function buildReviewInvitationUrl(rawToken, originOverride = '') {
  const cleanToken = normalizeReviewTokenInput(rawToken);
  if (!isValidReviewTokenSyntax(cleanToken)) {
    throw new Error('Cannot build invitation URL for invalid review token.');
  }

  const origin =
    String(originOverride || '').trim() ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  const cleanOrigin = origin.replace(/\/+$/, '');
  return cleanOrigin ? `${cleanOrigin}/review/${cleanToken}` : `/review/${cleanToken}`;
}
