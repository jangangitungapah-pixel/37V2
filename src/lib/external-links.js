const PENDING_TOKEN_PATTERN = /\[[A-Z0-9_]+_PENDING\]/;

/**
 * Validates that a configured external URL is a real http(s) URL
 * and not an empty string or unresolved pending placeholder token.
 */
export function isValidHttpUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed || PENDING_TOKEN_PATTERN.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Resolves a verified Google Maps destination only when both confirmation flag and valid URL exist.
 */
export function resolveMapsHref(contact) {
  if (!contact?.isAddressConfirmed || !isValidHttpUrl(contact?.mapsUrl)) {
    return null;
  }

  return contact.mapsUrl.trim();
}

/**
 * Resolves a verified WhatsApp URL only when confirmation flag, number/URL, and valid URL exist.
 * Appends an approved prefilled message if configured and not already present in the query string.
 */
export function resolveWhatsAppHref(secondaryCta) {
  if (!secondaryCta?.isConfirmed || !isValidHttpUrl(secondaryCta?.whatsappUrl)) {
    return null;
  }

  const trimmedUrl = secondaryCta.whatsappUrl.trim();
  const parsed = new URL(trimmedUrl);
  const message =
    typeof secondaryCta.prefilledMessage === 'string' ? secondaryCta.prefilledMessage.trim() : '';

  if (message && !parsed.searchParams.has('text')) {
    parsed.searchParams.set('text', message);
  }

  return parsed.toString();
}

/**
 * Resolves a verified social profile anchor URL only when both confirmation flag and valid URL exist.
 */
export function resolveSocialHref(social) {
  if (!social?.isConfirmed || !isValidHttpUrl(social?.href)) {
    return null;
  }

  return social.href.trim();
}
