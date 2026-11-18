import { getAuth } from 'firebase/auth';

import { getFirebaseApp } from './client';

let cachedAuth = null;

/**
 * Returns the shared Firebase Auth instance for the default Firebase App.
 */
export function getFirebaseAuth() {
  const app = getFirebaseApp();

  if (!cachedAuth || cachedAuth.app !== app) {
    cachedAuth = getAuth(app);
  }

  return cachedAuth;
}
