import { useCallback, useEffect, useRef, useState } from 'react';

import { usePricingSettings } from '@/features/admin/settings/hooks/usePricingSettings';
import {
  mapPricingSettingsErrorToMessage,
  syncPublicPricingCatalog,
} from '@/features/admin/settings/pricing/services/pricing-settings-service';

import { usePublicPricingCatalog } from './usePublicPricingCatalog';

/**
 * Safely auto-syncs `publicPricingCatalog/current` from persisted V2 `settings/pricing`
 * when an active Studio Owner visits any Admin Portal route.
 *
 * Safety boundaries:
 * - Only runs when `enabled === true` (active Owner, not Factory Reset locked, non-empty `actorUid`).
 * - NEVER writes when `settings/pricing` is unpersisted or still legacy Schema V1 (`migratedFromV1`).
 * - Attempts auto-sync at most once per remote settings version to avoid retry loops on failure.
 */
export function useOwnerPublicPricingAutoSync({
  enabled = false,
  actorUid = '',
  actorRole = '',
} = {}) {
  const canSubscribe = Boolean(enabled);
  const {
    settings,
    isPersisted,
    migratedFromV1,
    isLoading: isPricingLoading,
    error: pricingError,
  } = usePricingSettings({ enabled: canSubscribe });

  const {
    catalogVersion,
    isPersisted: isCatalogPersisted,
    isValid: isCatalogValid,
    isLoading: isCatalogLoading,
    error: catalogLoadError,
  } = usePublicPricingCatalog(null, { enabled: canSubscribe });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');

  const inFlightRef = useRef(false);
  const attemptedKeyRef = useRef('');

  const normalizedServerVersion = Math.max(1, Number(settings?.version) || 1);
  const needsSync = Boolean(
    canSubscribe &&
    !isPricingLoading &&
    !isCatalogLoading &&
    !pricingError &&
    isPersisted &&
    !migratedFromV1 &&
    (!isCatalogPersisted ||
      !isCatalogValid ||
      Boolean(catalogLoadError) ||
      Number(catalogVersion) !== normalizedServerVersion),
  );

  const needsInitialSave = Boolean(
    canSubscribe &&
    !isPricingLoading &&
    !isCatalogLoading &&
    !isPersisted &&
    !migratedFromV1 &&
    !isCatalogPersisted,
  );

  const isSynced = Boolean(
    canSubscribe &&
    isPersisted &&
    !migratedFromV1 &&
    isCatalogPersisted &&
    isCatalogValid &&
    !catalogLoadError &&
    Number(catalogVersion) === normalizedServerVersion,
  );

  const triggerSync = useCallback(async () => {
    const cleanUid = String(actorUid || '').trim();
    if (!cleanUid || inFlightRef.current) return null;

    inFlightRef.current = true;
    setIsSyncing(true);
    setSyncError('');
    setSyncSuccess('');

    try {
      const result = await syncPublicPricingCatalog({
        actorUid: cleanUid,
        actorRole,
      });
      setSyncSuccess(
        `Public Pricing Catalog v${result?.version || normalizedServerVersion} berhasil disinkronkan untuk Client Portal.`,
      );
      return result;
    } catch (err) {
      setSyncError(mapPricingSettingsErrorToMessage(err));
      return null;
    } finally {
      inFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [actorRole, actorUid, normalizedServerVersion]);

  useEffect(() => {
    const cleanUid = String(actorUid || '').trim();
    if (!needsSync || !cleanUid || isSyncing || inFlightRef.current) {
      return undefined;
    }

    const syncKey = `${normalizedServerVersion}:${isCatalogPersisted ? (catalogVersion ?? 'invalid') : 'missing'}`;
    if (attemptedKeyRef.current === syncKey) {
      return undefined;
    }

    let isCancelled = false;
    Promise.resolve().then(() => {
      if (isCancelled || inFlightRef.current || attemptedKeyRef.current === syncKey) return;
      attemptedKeyRef.current = syncKey;
      void triggerSync();
    });

    return () => {
      isCancelled = true;
    };
  }, [
    actorUid,
    catalogVersion,
    isCatalogPersisted,
    isSyncing,
    needsSync,
    normalizedServerVersion,
    triggerSync,
  ]);

  return {
    isSyncing,
    syncError,
    syncSuccess,
    isSynced,
    needsSync,
    needsInitialSave,
    isPersisted,
    migratedFromV1,
    serverVersion: normalizedServerVersion,
    catalogVersion,
    isCatalogPersisted,
    isCatalogValid,
    isCatalogLoading,
    catalogLoadError,
    triggerSync,
  };
}
