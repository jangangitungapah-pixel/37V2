import { useEffect, useMemo, useState } from 'react';

import { getLandingPagePlacementAdapter } from '../repositories/landing-page-placement-repository';

/**
 * Public Landing Page hook subscribing to published `landingPagePlacements`
 * (`where('status', '==', 'published')`) without requiring authentication.
 */
export function usePublishedLandingPagePlacements({ customAdapter = null } = {}) {
  const resolvedAdapter = customAdapter || getLandingPagePlacementAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedAdapter: null,
    placementsById: {},
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribePublishedPlacements({
      onData: ({ placementsById }) => {
        if (isCancelled) return;
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          placementsById: placementsById || {},
          error: '',
        });
      },
      onError: () => {
        if (isCancelled) return;
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          placementsById: {},
          error: 'Failed to load published placements.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [resolvedAdapter]);

  const isLoading = snapshotState.loadedAdapter !== resolvedAdapter;
  const placementsById = useMemo(
    () => snapshotState.placementsById,
    [snapshotState.placementsById],
  );

  return {
    placementsById,
    isLoading,
    error: snapshotState.error,
  };
}
