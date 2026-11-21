import { useEffect, useState } from 'react';

import { DEFAULT_STUDIO_PROFILE } from '../config/default-studio-profile';
import { getStudioProfileRepositoryAdapter } from '../repositories/studio-profile-repository';
import { cloneStudioProfile } from '../utils/normalize-studio-profile';

/**
 * Subscribes to `settings/studioProfile` via the active repository adapter
 * (real-time Firestore or deterministic in-memory test adapter).
 */
export function useStudioProfile(customAdapter = null) {
  const resolvedAdapter = customAdapter || getStudioProfileRepositoryAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedAdapter: null,
    profile: cloneStudioProfile(DEFAULT_STUDIO_PROFILE),
    isPersisted: false,
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribeStudioProfile({
      onData: ({ profile, isPersisted }) => {
        if (isCancelled) return;
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          profile,
          isPersisted: Boolean(isPersisted),
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setSnapshotState((prev) => ({
          ...prev,
          loadedAdapter: resolvedAdapter,
          error: err?.message || 'Gagal memuat profil studio dari Firestore.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [resolvedAdapter]);

  const isLoading = snapshotState.loadedAdapter !== resolvedAdapter;

  return {
    profile: snapshotState.profile,
    isPersisted: snapshotState.isPersisted,
    isLoading,
    error: snapshotState.error,
  };
}
