import { createContext, useContext } from 'react';

export const OwnerPublicAvailabilitySyncContext = createContext(null);

export function useOptionalOwnerPublicAvailabilitySync() {
  return useContext(OwnerPublicAvailabilitySyncContext);
}
