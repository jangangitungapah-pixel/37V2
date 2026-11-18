import { getApps, initializeApp } from 'firebase/app';

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured(configOverride) {
  const activeConfig = configOverride ?? getFirebaseConfig();
  return requiredConfigKeys.every((key) => {
    const value = activeConfig?.[key];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });
}

/**
 * Initialize Firebase lazily so local UI work does not require cloud credentials.
 * Auth and Firestore services reuse this single default Firebase App instance.
 */
export function getFirebaseApp() {
  const firebaseConfig = getFirebaseConfig();

  if (!isFirebaseConfigured(firebaseConfig)) {
    const error = new Error(
      'Firebase is not configured. Copy .env.example to .env.local and provide the Firebase web app configuration.',
    );
    error.code = 'firebase/not-configured';
    throw error;
  }

  const defaultApp = getApps().find((app) => app.name === '[DEFAULT]');

  return defaultApp ?? initializeApp(firebaseConfig);
}
