import { useEffect, useMemo, useState } from 'react';

import { LANDING_PAGE_PLACEMENT_DEFINITIONS } from '../config/landing-page-placements-config';
import { getLandingPagePlacementAdapter } from '../repositories/landing-page-placement-repository';

/**
 * Owner-side hook subscribing to all 4 `landingPagePlacements` documents
 * and computing which Gallery library items are currently used on the Landing Page.
 */
export function useLandingPagePlacements({ enabled = true, customAdapter = null } = {}) {
  const resolvedAdapter = customAdapter || getLandingPagePlacementAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedKey: '',
    placementsById: {},
    error: '',
  });

  const subscriptionKey = enabled ? 'owner-placements' : 'disabled';

  useEffect(() => {
    if (!enabled) return undefined;

    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribeAdminPlacements({
      onData: ({ placementsById }) => {
        if (isCancelled) return;
        setSnapshotState({
          loadedKey: subscriptionKey,
          placementsById: placementsById || {},
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setSnapshotState((prev) => ({
          ...prev,
          loadedKey: subscriptionKey,
          error: err?.message || 'Gagal memuat konfigurasi media Landing Page.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [enabled, resolvedAdapter, subscriptionKey]);

  const placementsById = useMemo(
    () => (enabled ? snapshotState.placementsById : {}),
    [enabled, snapshotState.placementsById],
  );

  // Map each galleryItemId -> array of placement definitions using it
  const usageByGalleryItemId = useMemo(() => {
    const map = {};
    LANDING_PAGE_PLACEMENT_DEFINITIONS.forEach((def) => {
      const record = placementsById[def.id];
      if (record && record.sourceGalleryItemId) {
        const gid = record.sourceGalleryItemId;
        if (!map[gid]) map[gid] = [];
        map[gid].push({
          placementId: def.id,
          label: def.label,
          status: record.status,
        });
      }
    });
    return map;
  }, [placementsById]);

  const isLoading = enabled && snapshotState.loadedKey !== subscriptionKey;

  return {
    placementsById,
    usageByGalleryItemId,
    isLoading,
    error: enabled ? snapshotState.error : '',
  };
}
