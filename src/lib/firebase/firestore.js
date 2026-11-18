import { getFirestore } from 'firebase/firestore';

import { getFirebaseApp } from './client';

let cachedFirestore = null;

/**
 * Returns the shared Cloud Firestore instance for the default Firebase App.
 */
export function getFirebaseDb() {
  const app = getFirebaseApp();

  if (!cachedFirestore || cachedFirestore.app !== app) {
    cachedFirestore = getFirestore(app);
  }

  return cachedFirestore;
}
