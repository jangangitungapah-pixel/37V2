import { getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function isFirebaseConfigured() {
  return requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));
}

/**
 * Initialize Firebase lazily so local UI work does not require cloud credentials.
 * Auth and Firestore services should be added in the phase that defines their flows.
 */
export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env.local and provide the Firebase web app configuration.',
    );
  }

  const defaultApp = getApps().find((app) => app.name === '[DEFAULT]');

  return defaultApp ?? initializeApp(firebaseConfig);
}
