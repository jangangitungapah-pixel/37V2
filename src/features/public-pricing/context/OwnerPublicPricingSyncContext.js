import { createContext, useContext } from 'react';

export const OwnerPublicPricingSyncContext = createContext(null);

export function useOptionalOwnerPublicPricingSync() {
  return useContext(OwnerPublicPricingSyncContext);
}
