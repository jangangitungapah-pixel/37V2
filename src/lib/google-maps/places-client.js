import { isValidHttpUrl } from '@/lib/external-links';

/**
 * Authoritative configuration and transient browser-side client for
 * Google Maps JavaScript API — Places Library (New).
 *
 * Security & Compliance invariants:
 * - Zero persistence: never writes reviews to Firestore, localStorage, sessionStorage, or IndexedDB.
 * - Treats Place ID as public configuration and verifies returned identity (`displayName` + address)
 *   against 37 Music Studio TANGERANG before returning ratings or reviews to the UI.
 * - Preserves API-returned review order and sanitizes every external URL via `isValidHttpUrl`.
 */

export const VERIFIED_STUDIO_PLACE_ID = 'ChIJfYXPy6P-aS4RFCRQptFpsVg';
export const VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL = 'https://share.google/vNzc7I8OCvwMexEU9';
export const GOOGLE_MAPS_JS_SCRIPT_ID = 'google-maps-places-js-sdk';
export const MAX_GOOGLE_REVIEWS_DISPLAYED = 5;

export const PLACE_FETCH_FIELDS = Object.freeze([
  'displayName',
  'formattedAddress',
  'rating',
  'userRatingCount',
  'reviews',
  'googleMapsURI',
  'attributions',
]);

export const GOOGLE_REVIEWS_DIAGNOSTIC_CODES = Object.freeze({
  UNCONFIGURED: 'GOOGLE_MAPS_API_KEY_MISSING',
  MISSING_PLACE_ID: 'GOOGLE_MAPS_PLACE_ID_MISSING',
  SCRIPT_LOAD_FAILED: 'GOOGLE_MAPS_SCRIPT_LOAD_FAILED',
  SCRIPT_CONFLICT: 'GOOGLE_MAPS_SCRIPT_CONFLICT',
  AUTH_FAILED: 'GOOGLE_MAPS_AUTH_FAILED',
  PLACES_IMPORT_FAILED: 'GOOGLE_MAPS_PLACES_IMPORT_FAILED',
  FETCH_FAILED: 'GOOGLE_MAPS_PLACE_FETCH_FAILED',
  IDENTITY_MISMATCH: 'GOOGLE_PLACE_IDENTITY_MISMATCH',
});

const STUDIO_ADDRESS_LOCATION_TOKENS = [
  'tangerang',
  'bencongan',
  'kelapa dua',
  'palem',
  'banten',
  '15810',
];

const PLACEHOLDER_KEY_PATTERN = /^\[.*\]$|^(your|replace|demo|placeholder)/i;

let inFlightScriptLoadPromise = null;
let inFlightScriptApiKey = '';
let inFlightReviewsFetchPromise = null;
let cachedRuntimeReviewsResult = null;
let customPlacesFetcherForTests = null;

function readEnvValue(name) {
  try {
    const raw = import.meta?.env?.[name];
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Resolves current public Google Maps Platform environment config.
 */
export function getGoogleMapsPlacesConfig() {
  const rawApiKey = readEnvValue('VITE_GOOGLE_MAPS_API_KEY');
  const apiKey = rawApiKey && !PLACEHOLDER_KEY_PATTERN.test(rawApiKey) ? rawApiKey : '';
  const placeId = readEnvValue('VITE_GOOGLE_MAPS_PLACE_ID') || VERIFIED_STUDIO_PLACE_ID;

  return {
    apiKey,
    placeId,
    isConfigured: Boolean(apiKey && placeId),
    fallbackUrl: VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
  };
}

function createDiagnosticError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function extractTextValue(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof value.text === 'string') {
    return value.text.trim();
  }
  return '';
}

/**
 * Verifies at runtime that the returned Google Place corresponds to 37 Music Studio TANGERANG.
 * Never exposes unrelated Place data if `displayName` or non-empty address fails verification.
 */
export function verifyStudioPlaceIdentity(placeData) {
  const displayName = extractTextValue(placeData?.displayName);
  const normalizedName = displayName.toLowerCase().replace(/\s+/g, ' ');
  const formattedAddress = extractTextValue(placeData?.formattedAddress);
  const normalizedAddress = formattedAddress.toLowerCase().replace(/\s+/g, ' ');

  const hasStudioBrand =
    normalizedName.includes('37') &&
    (normalizedName.includes('music studio') || normalizedName.includes('studio'));

  if (!hasStudioBrand) {
    return {
      isMatch: false,
      diagnosticCode: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.IDENTITY_MISMATCH,
    };
  }

  // Only inspect address tokens if Google returned a formatted address; missing optional address never crashes.
  if (normalizedAddress) {
    const hasExpectedLocationToken = STUDIO_ADDRESS_LOCATION_TOKENS.some((token) =>
      normalizedAddress.includes(token),
    );
    if (!hasExpectedLocationToken) {
      return {
        isMatch: false,
        diagnosticCode: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.IDENTITY_MISMATCH,
      };
    }
  }

  return {
    isMatch: true,
    diagnosticCode: null,
  };
}

/**
 * Normalizes a single Google Places `Review` object while preserving original meaning,
 * API-returned order, and strict attribution/source URI eligibility rules.
 */
export function normalizeGoogleReviewItem(rawReview, index = 0) {
  if (!rawReview || typeof rawReview !== 'object') {
    return null;
  }

  const authorRaw = rawReview.authorAttribution || {};
  const authorName = extractTextValue(authorRaw.displayName);
  const reviewUri = isValidHttpUrl(rawReview.googleMapsURI) ? rawReview.googleMapsURI.trim() : null;

  // Attribution policy: do not render a custom review card without author attribution & direct source link.
  if (!authorName || !reviewUri) {
    return null;
  }

  const authorUri = isValidHttpUrl(authorRaw.uri) ? authorRaw.uri.trim() : null;
  const photoURI = isValidHttpUrl(authorRaw.photoURI) ? authorRaw.photoURI.trim() : null;
  const flagContentURI = isValidHttpUrl(rawReview.flagContentURI)
    ? rawReview.flagContentURI.trim()
    : null;

  const numericRating = Number(rawReview.rating);
  const rating =
    Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 5
      ? Math.round(numericRating * 10) / 10
      : null;

  const text = extractTextValue(rawReview.text ?? rawReview.originalText);
  const relativePublishTimeDescription = extractTextValue(rawReview.relativePublishTimeDescription);

  let publishTime = '';
  if (typeof rawReview.publishTime === 'string') {
    publishTime = rawReview.publishTime.trim();
  } else if (
    rawReview.publishTime instanceof Date &&
    !Number.isNaN(rawReview.publishTime.getTime())
  ) {
    publishTime = rawReview.publishTime.toISOString();
  }

  return {
    id: `${reviewUri}::${index}`,
    rating,
    text,
    relativePublishTimeDescription,
    publishTime,
    googleMapsURI: reviewUri,
    flagContentURI,
    authorAttribution: {
      displayName: authorName,
      uri: authorUri,
      photoURI,
    },
  };
}

/**
 * Normalizes raw `google.maps.places.Place` fields into a clean transient view model.
 */
export function normalizeGooglePlaceResult(
  rawPlace,
  fallbackUrl = VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
) {
  const identity = verifyStudioPlaceIdentity(rawPlace);
  if (!identity.isMatch) {
    return {
      status: 'mismatch',
      diagnosticCode: identity.diagnosticCode,
      place: null,
      fallbackUrl,
    };
  }

  const rawRating = Number(rawPlace?.rating);
  const rating =
    Number.isFinite(rawRating) && rawRating > 0 && rawRating <= 5
      ? Math.round(rawRating * 10) / 10
      : null;

  const rawCount = Number(rawPlace?.userRatingCount);
  const userRatingCount = Number.isFinite(rawCount) && rawCount >= 0 ? Math.round(rawCount) : null;

  const googleMapsURI = isValidHttpUrl(rawPlace?.googleMapsURI)
    ? rawPlace.googleMapsURI.trim()
    : fallbackUrl;

  const rawAttributions = Array.isArray(rawPlace?.attributions) ? rawPlace.attributions : [];
  const attributions = rawAttributions
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const provider = extractTextValue(entry.provider);
      if (!provider) return null;
      return {
        provider,
        providerURI: isValidHttpUrl(entry.providerURI) ? entry.providerURI.trim() : null,
      };
    })
    .filter(Boolean);

  // Preserve Google's exact returned relevance order, capped to up to 5 returned reviews.
  const rawReviews = Array.isArray(rawPlace?.reviews)
    ? rawPlace.reviews.slice(0, MAX_GOOGLE_REVIEWS_DISPLAYED)
    : [];
  const reviews = rawReviews
    .map((review, index) => normalizeGoogleReviewItem(review, index))
    .filter(Boolean);

  return {
    status: reviews.length > 0 ? 'loaded' : 'empty',
    diagnosticCode: null,
    fallbackUrl: googleMapsURI,
    place: {
      displayName: extractTextValue(rawPlace?.displayName),
      formattedAddress: extractTextValue(rawPlace?.formattedAddress),
      rating,
      userRatingCount,
      googleMapsURI,
      attributions,
      reviews,
    },
  };
}

function findExistingGoogleMapsScript() {
  if (typeof document === 'undefined') return null;
  return (
    document.getElementById(GOOGLE_MAPS_JS_SCRIPT_ID) ||
    document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
  );
}

/**
 * Dynamically injects and awaits the official Google Maps JavaScript SDK (`loading=async`),
 * then imports the `places` library (`google.maps.importLibrary('places')`).
 */
export function loadGoogleMapsPlacesLibrary({
  apiKey,
  language = 'id',
  region = 'ID',
  timeoutMs = 12000,
} = {}) {
  const cleanKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!cleanKey) {
    return Promise.reject(
      createDiagnosticError(
        GOOGLE_REVIEWS_DIAGNOSTIC_CODES.UNCONFIGURED,
        'Google Maps API key is not configured.',
      ),
    );
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      createDiagnosticError(
        GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_LOAD_FAILED,
        'Browser environment unavailable.',
      ),
    );
  }

  // If Google Maps JS SDK with `importLibrary` is already ready, reuse without mutating script tags.
  if (typeof window.google?.maps?.importLibrary === 'function') {
    return Promise.resolve()
      .then(() => window.google.maps.importLibrary('places'))
      .then((placesLib) => {
        if (!placesLib || typeof placesLib.Place !== 'function') {
          throw createDiagnosticError(
            GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
            'Places library loaded without Place constructor.',
          );
        }
        return placesLib;
      })
      .catch((err) => {
        if (err?.code) throw err;
        throw createDiagnosticError(
          GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
          err?.message || 'Failed to import Google Maps Places library.',
        );
      });
  }

  // Check for existing initialized Maps script without `importLibrary` (legacy or incompatible setup)
  const existingScript = findExistingGoogleMapsScript();
  if (inFlightScriptLoadPromise && inFlightScriptApiKey === cleanKey) {
    return inFlightScriptLoadPromise;
  }
  if (existingScript) {
    const existingSrc = existingScript.getAttribute('src') || '';
    const hasMatchingKey = existingSrc.includes(`key=${encodeURIComponent(cleanKey)}`);
    const isMarkedLoaded =
      existingScript.dataset?.loaded === 'true' || Boolean(window.google?.maps);
    if (isMarkedLoaded && !window.google?.maps?.importLibrary) {
      return Promise.reject(
        createDiagnosticError(
          GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_CONFLICT,
          'An incompatible Google Maps script is already loaded.',
        ),
      );
    }
    if (!hasMatchingKey) {
      return Promise.reject(
        createDiagnosticError(
          GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_CONFLICT,
          'An existing Google Maps script tag with different configuration is present.',
        ),
      );
    }
  }

  inFlightScriptApiKey = cleanKey;
  inFlightScriptLoadPromise = new Promise((resolve, reject) => {
    const callbackName = `__init37StudioGoogleMaps_${Math.random().toString(36).slice(2, 10)}`;
    const previousAuthFailure = window.gm_authFailure;
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (typeof window[callbackName] === 'function') {
        delete window[callbackName];
      }
      if (window.gm_authFailure === handleAuthFailure) {
        if (typeof previousAuthFailure === 'function') {
          window.gm_authFailure = previousAuthFailure;
        } else {
          delete window.gm_authFailure;
        }
      }
    };

    const fail = (code, message) => {
      if (settled) return;
      settled = true;
      cleanup();
      inFlightScriptLoadPromise = null;
      inFlightScriptApiKey = '';
      reject(createDiagnosticError(code, message));
    };

    const succeed = async () => {
      if (settled) return;
      try {
        if (typeof window.google?.maps?.importLibrary !== 'function') {
          fail(
            GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
            'Google Maps importLibrary is unavailable after script load.',
          );
          return;
        }
        const placesLib = await window.google.maps.importLibrary('places');
        if (!placesLib || typeof placesLib.Place !== 'function') {
          fail(
            GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
            'Places library did not expose Place constructor.',
          );
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        resolve(placesLib);
      } catch (err) {
        fail(
          GOOGLE_REVIEWS_DIAGNOSTIC_CODES.PLACES_IMPORT_FAILED,
          err?.message || 'Failed to import Google Maps Places library.',
        );
      }
    };

    function handleAuthFailure() {
      if (typeof previousAuthFailure === 'function') {
        try {
          previousAuthFailure();
        } catch {
          // Ignore prior handler errors
        }
      }
      fail(
        GOOGLE_REVIEWS_DIAGNOSTIC_CODES.AUTH_FAILED,
        'Google Maps Platform rejected API key authorization.',
      );
    }

    window.gm_authFailure = handleAuthFailure;
    window[callbackName] = () => {
      void succeed();
    };

    timeoutId = setTimeout(() => {
      fail(
        GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_LOAD_FAILED,
        'Timed out loading Google Maps JavaScript SDK.',
      );
    }, timeoutMs);

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        () => {
          existingScript.dataset.loaded = 'true';
          if (typeof window.google?.maps?.importLibrary === 'function') {
            void succeed();
          }
        },
        { once: true },
      );
      existingScript.addEventListener(
        'error',
        () => {
          fail(
            GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_LOAD_FAILED,
            'Failed to load Google Maps JavaScript script.',
          );
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_JS_SCRIPT_ID;
    script.async = true;
    script.defer = true;

    const params = new URLSearchParams({
      key: cleanKey,
      v: 'weekly',
      loading: 'async',
      language,
      region,
      callback: callbackName,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        if (typeof window.google?.maps?.importLibrary === 'function') {
          void succeed();
        }
      },
      { once: true },
    );

    script.addEventListener(
      'error',
      () => {
        fail(
          GOOGLE_REVIEWS_DIAGNOSTIC_CODES.SCRIPT_LOAD_FAILED,
          'Network or CSP error loading Google Maps JavaScript SDK.',
        );
      },
      { once: true },
    );

    document.head.appendChild(script);
  });

  return inFlightScriptLoadPromise;
}

/**
 * Fetches live 37 Music Studio Google Maps ratings & reviews once per browser runtime,
 * holding results strictly in transient JS memory (zero persistence).
 */
export async function fetchStudioGoogleReviews({ configOverride = null } = {}) {
  if (cachedRuntimeReviewsResult) {
    return cachedRuntimeReviewsResult;
  }

  if (inFlightReviewsFetchPromise) {
    return inFlightReviewsFetchPromise;
  }

  if (typeof customPlacesFetcherForTests === 'function') {
    inFlightReviewsFetchPromise = (async () => {
      try {
        const result = await customPlacesFetcherForTests({ configOverride });
        cachedRuntimeReviewsResult = result;
        return result;
      } finally {
        inFlightReviewsFetchPromise = null;
      }
    })();
    return inFlightReviewsFetchPromise;
  }

  const config = configOverride || getGoogleMapsPlacesConfig();
  if (!config.apiKey) {
    const unconfiguredResult = {
      status: 'unconfigured',
      diagnosticCode: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.UNCONFIGURED,
      place: null,
      fallbackUrl: config.fallbackUrl || VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
    };
    cachedRuntimeReviewsResult = unconfiguredResult;
    return unconfiguredResult;
  }

  if (!config.placeId) {
    const missingIdResult = {
      status: 'error',
      diagnosticCode: GOOGLE_REVIEWS_DIAGNOSTIC_CODES.MISSING_PLACE_ID,
      place: null,
      fallbackUrl: config.fallbackUrl || VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
    };
    cachedRuntimeReviewsResult = missingIdResult;
    return missingIdResult;
  }

  inFlightReviewsFetchPromise = (async () => {
    try {
      const { Place } = await loadGoogleMapsPlacesLibrary({
        apiKey: config.apiKey,
        language: 'id',
        region: 'ID',
      });

      const place = new Place({
        id: config.placeId,
        requestedLanguage: 'id',
        requestedRegion: 'ID',
      });

      const fetchResponse = await place.fetchFields({
        fields: [...PLACE_FETCH_FIELDS],
      });

      // Places SDK mutates `place` in-place and may return `{ place }` wrapper.
      const resolvedPlace = fetchResponse?.place || place;
      const normalized = normalizeGooglePlaceResult(
        resolvedPlace,
        config.fallbackUrl || VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
      );

      if (normalized.status === 'mismatch') {
        console.warn('[GoogleReviews] Diagnostic:', normalized.diagnosticCode);
      }

      cachedRuntimeReviewsResult = normalized;
      return normalized;
    } catch (err) {
      const diagnosticCode = err?.code || GOOGLE_REVIEWS_DIAGNOSTIC_CODES.FETCH_FAILED;
      console.warn('[GoogleReviews] Diagnostic:', diagnosticCode);
      const errorResult = {
        status: 'error',
        diagnosticCode,
        place: null,
        fallbackUrl: config.fallbackUrl || VERIFIED_STUDIO_GOOGLE_MAPS_FALLBACK_URL,
      };
      cachedRuntimeReviewsResult = errorResult;
      return errorResult;
    } finally {
      inFlightReviewsFetchPromise = null;
    }
  })();

  return inFlightReviewsFetchPromise;
}

/**
 * Test seam helpers — injects deterministic runtime fetcher and resets transient memory between tests.
 */
export function setGoogleReviewsLoaderForTests(customFn) {
  customPlacesFetcherForTests = typeof customFn === 'function' ? customFn : null;
  inFlightReviewsFetchPromise = null;
  cachedRuntimeReviewsResult = null;
}

export function resetGoogleMapsPlacesClientForTests() {
  inFlightScriptLoadPromise = null;
  inFlightScriptApiKey = '';
  inFlightReviewsFetchPromise = null;
  cachedRuntimeReviewsResult = null;
  customPlacesFetcherForTests = null;
}
