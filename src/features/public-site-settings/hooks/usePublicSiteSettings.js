import { useEffect, useState } from 'react';

import { DEFAULT_PUBLIC_SITE_SETTINGS } from '../config/public-site-settings-config';
import { getPublicSiteSettingsRepositoryAdapter } from '../repositories/public-site-settings-repository';

/**
 * Public-safe subscription hook for `publicSiteSettings/site` without requiring authentication.
 */
export function usePublicSiteSettings(customAdapter = null) {
  const resolvedAdapter = customAdapter || getPublicSiteSettingsRepositoryAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedAdapter: null,
    settings: structuredClone(DEFAULT_PUBLIC_SITE_SETTINGS),
    isPersisted: false,
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribePublicSiteSettings({
      onData: ({ settings, isPersisted }) => {
        if (isCancelled) return;
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          settings: settings || structuredClone(DEFAULT_PUBLIC_SITE_SETTINGS),
          isPersisted: Boolean(isPersisted),
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setSnapshotState((prev) => ({
          ...prev,
          loadedAdapter: resolvedAdapter,
          error: err?.message || 'Gagal memuat informasi publik studio.',
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
    settings: snapshotState.settings,
    isPersisted: snapshotState.isPersisted,
    isLoading,
    error: snapshotState.error,
  };
}
