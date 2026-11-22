import { getFirebaseApp, isFirebaseConfigured } from './client';

let cachedAppCheckInstance = null;
let cachedSiteKey = '';

export function getAppCheckSiteKey() {
  return String(import.meta.env.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY || '').trim();
}

export function isAppCheckConfigured() {
  return Boolean(isFirebaseConfigured() && getAppCheckSiteKey());
}

/**
 * Guarded local-development debug token helper.
 * Strictly disabled in production builds so debug bypass tokens are never enabled in prod.
 */
export function resolveDevAppCheckDebugToken() {
  const isDevRuntime = Boolean(import.meta.env.DEV) && !import.meta.env.PROD;
  if (!isDevRuntime) {
    return null;
  }

  const rawDebugToken = String(import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || '').trim();
  if (!rawDebugToken) {
    return null;
  }

  return rawDebugToken.toLowerCase() === 'true' ? true : rawDebugToken;
}

/**
 * Initializes Firebase App Check (`ReCaptchaV3Provider`) once on the `[DEFAULT]` Firebase App
 * with token auto-refresh enabled.
 */
export async function initializeFirebaseAppCheck() {
  const siteKey = getAppCheckSiteKey();
  if (!isFirebaseConfigured() || !siteKey) {
    return null;
  }

  if (cachedAppCheckInstance && cachedSiteKey === siteKey) {
    return cachedAppCheckInstance;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  const devDebugToken = resolveDevAppCheckDebugToken();
  if (devDebugToken && typeof globalThis !== 'undefined') {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = devDebugToken;
  }

  const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
  cachedAppCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  cachedSiteKey = siteKey;
  return cachedAppCheckInstance;
}

/**
 * Ensures an App Check token is obtained prior to unauthenticated public Firestore writes
 * when App Check is configured. Returns honest status metadata without logging sensitive tokens.
 */
export async function ensureAppCheckTokenForPublicWrite() {
  if (!isAppCheckConfigured()) {
    return {
      initialized: false,
      state: 'unconfigured',
    };
  }

  const instance = await initializeFirebaseAppCheck();
  if (!instance) {
    return {
      initialized: false,
      state: 'unconfigured',
    };
  }

  const { getToken } = await import('firebase/app-check');
  await getToken(instance, false);

  return {
    initialized: true,
    state: 'verified',
  };
}

export function resetAppCheckForTests() {
  cachedAppCheckInstance = null;
  cachedSiteKey = '';
  if (typeof globalThis !== 'undefined' && 'FIREBASE_APPCHECK_DEBUG_TOKEN' in globalThis) {
    delete globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
}
