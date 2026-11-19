/**
 * Shared Phone Number Normalization, Validation, Formatting & Deterministic Hashing
 * for 37 Music Studio (Phase 7 — Customer Management).
 *
 * Default country: Indonesia (+62).
 * All Indonesia local & international forms normalize to E.164 canonical format:
 *   081234567890        -> +6281234567890
 *   +6281234567890      -> +6281234567890
 *   6281234567890       -> +6281234567890
 *   +62 812-3456-7890   -> +6281234567890
 *   (0812) 3456 7890    -> +6281234567890
 *   006281234567890     -> +6281234567890
 *
 * Non-Indonesian international numbers with an explicit `+` or `00` country code
 * are preserved with their original country code (never rewritten to +62).
 */

const MIN_CANONICAL_DIGITS = 9;
const MAX_CANONICAL_DIGITS = 15;

/**
 * Pure JavaScript FIPS 180-4 SHA-256 implementation returning lowercase 64-char hex.
 * Produces byte-for-byte identical output to `crypto.subtle.digest('SHA-256', ...)`.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rightRotate(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256HexSync(input) {
  const utf8 = new TextEncoder().encode(String(input ?? ''));
  const bitLen = utf8.length * 8;
  const paddedLen = Math.ceil((utf8.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLen);
  buffer.set(utf8);
  buffer[utf8.length] = 0x80;

  const view = new DataView(buffer.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((val) => val.toString(16).padStart(8, '0')).join('');
}

/**
 * Normalizes a phone number into canonical E.164 format (`+<country><subscriber>`).
 * Returns empty string `''` when the input is empty or invalid.
 *
 * Options:
 * - `assumeIndonesiaLocalMobile` (boolean, default false): when true, bare `8...`
 *   numbers (8–13 digits) are interpreted as Indonesian mobile `+628...`.
 */
export function normalizePhoneNumber(rawValue, options = {}) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return '';

  // Reject inputs that contain alphabetic letters (e.g. "abc12345678" or "TBD")
  if (/[a-zA-Z]/.test(raw)) {
    return '';
  }

  // Strip separators (spaces, hyphens, parentheses, dots, slashes)
  const stripped = raw.replace(/[\s\-().\\/]/g, '');
  if (!stripped) return '';

  // Only allow optional leading `+` followed strictly by digits
  if (!/^\+?\d+$/.test(stripped)) {
    return '';
  }

  let canonical;

  if (stripped.startsWith('+')) {
    const digits = stripped.slice(1);
    if (!digits || digits.startsWith('0')) {
      return '';
    }
    // Clean occasional `+6208...` Indonesian double-trunk typo
    if (digits.startsWith('6208') && digits.length >= 11) {
      canonical = `+62${digits.slice(3)}`;
    } else {
      canonical = `+${digits}`;
    }
  } else if (stripped.startsWith('00')) {
    // International dial prefix `00` -> `+`
    const intlDigits = stripped.slice(2);
    if (!intlDigits || intlDigits.startsWith('0')) {
      return '';
    }
    if (intlDigits.startsWith('6208') && intlDigits.length >= 11) {
      canonical = `+62${intlDigits.slice(3)}`;
    } else {
      canonical = `+${intlDigits}`;
    }
  } else if (stripped.startsWith('0')) {
    // Indonesian local format (`08...` mobile or `02x...` landline)
    const subscriber = stripped.slice(1);
    if (!subscriber || subscriber.startsWith('0')) {
      return '';
    }
    canonical = `+62${subscriber}`;
  } else if (stripped.startsWith('62')) {
    // Indonesian country code without `+`
    if (stripped.startsWith('6208') && stripped.length >= 11) {
      canonical = `+62${stripped.slice(3)}`;
    } else {
      canonical = `+${stripped}`;
    }
  } else if (options.assumeIndonesiaLocalMobile && stripped.startsWith('8')) {
    canonical = `+62${stripped}`;
  } else {
    return '';
  }

  const canonicalDigits = canonical.slice(1);
  if (
    canonicalDigits.length < MIN_CANONICAL_DIGITS ||
    canonicalDigits.length > MAX_CANONICAL_DIGITS
  ) {
    return '';
  }

  // Extra sanity check for Indonesian numbers: `+62` + at least 8 subscriber digits (10+ total)
  if (canonical.startsWith('+62') && canonicalDigits.length < 10) {
    return '';
  }

  return canonical;
}

/**
 * Returns true if the provided raw or normalized phone number is valid.
 */
export function isValidPhoneNumber(rawValue, options = {}) {
  return normalizePhoneNumber(rawValue, options).length > 0;
}

/**
 * Formats a canonical or raw phone number into a clean readable display string.
 * Example: `+6281234567890` -> `+62 812-3456-7890`
 */
export function formatPhoneDisplay(value) {
  const canonical = normalizePhoneNumber(value);
  if (!canonical) {
    return String(value ?? '').trim();
  }

  if (canonical.startsWith('+62')) {
    const rest = canonical.slice(3);
    if (rest.length <= 4) {
      return `+62 ${rest}`;
    }
    if (rest.length <= 7) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3)}`;
    }
    if (rest.length <= 11) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7, 11)}-${rest.slice(11)}`;
  }

  // Generic readable spacing for non-Indonesian international numbers
  const digits = canonical.slice(1);
  if (digits.length <= 6) return canonical;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/**
 * Computes a deterministic SHA-256 hex hash of a canonical phone number using Web Crypto
 * (with identical pure-JS SHA-256 fallback). Used as the Firestore document ID for
 * `customerPhoneIndex/{phoneHash}`.
 */
export async function getPhoneNumberHash(phoneInput) {
  const canonical = normalizePhoneNumber(phoneInput);
  if (!canonical) {
    throw new Error('Cannot hash an empty or invalid phone number.');
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    try {
      const encoded = new TextEncoder().encode(canonical);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return sha256HexSync(canonical);
    }
  }

  return sha256HexSync(canonical);
}

/**
 * Synchronous deterministic SHA-256 hex hash matching `getPhoneNumberHash` byte-for-byte.
 */
export function getPhoneNumberHashSync(phoneInput) {
  const canonical = normalizePhoneNumber(phoneInput);
  if (!canonical) {
    throw new Error('Cannot hash an empty or invalid phone number.');
  }
  return sha256HexSync(canonical);
}

/**
 * Builds normalized phone search tokens from partial or complete user search queries
 * so typing `0812`, `+62812`, `62812`, or `812` matches canonical `+62812...` numbers.
 */
export function buildPhoneSearchTokens(rawQuery) {
  const trimmed = String(rawQuery ?? '').trim();
  if (!trimmed) return [];

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 3) return [];

  const tokens = new Set([digits]);

  const fullCanonical = normalizePhoneNumber(trimmed, { assumeIndonesiaLocalMobile: true });
  if (fullCanonical) {
    tokens.add(fullCanonical);
    tokens.add(fullCanonical.slice(1));
  }

  if (digits.startsWith('00')) {
    const intl = digits.slice(2);
    if (intl.length >= 3) {
      tokens.add(`+${intl}`);
      tokens.add(intl);
    }
  } else if (digits.startsWith('0')) {
    const sub = digits.slice(1);
    if (sub.length >= 2) {
      tokens.add(`+62${sub}`);
      tokens.add(`62${sub}`);
    }
  } else if (digits.startsWith('62')) {
    tokens.add(`+${digits}`);
  } else if (digits.startsWith('8')) {
    tokens.add(`+62${digits}`);
    tokens.add(`62${digits}`);
    tokens.add(`0${digits}`);
  }

  return Array.from(tokens);
}
