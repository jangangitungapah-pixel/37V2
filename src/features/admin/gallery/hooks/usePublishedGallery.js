import { useEffect, useMemo, useState } from 'react';

import { GALLERY_BOUNDED_QUERY_LIMIT } from '../config/gallery-config';
import { getGalleryRepositoryAdapter } from '../repositories/gallery-repository';
import {
  mapGalleryItemToPublicPresentation,
  sortPublishedGalleryItems,
} from '../utils/gallery-normalize';

/**
 * Public Landing Page hook that subscribes to published `galleryItems`
 * (`where('status', '==', 'published'), orderBy('sortOrder', 'asc'), limit(100)`)
 * using Firestore `onSnapshot` without requiring an authenticated user.
 */
export function usePublishedGallery({
  limitCount = GALLERY_BOUNDED_QUERY_LIMIT,
  customAdapter = null,
} = {}) {
  const resolvedAdapter = customAdapter || getGalleryRepositoryAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedAdapter: null,
    items: [],
    reachedQueryLimit: false,
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribePublishedGalleryItems({
      limitCount,
      onData: ({ items, reachedQueryLimit }) => {
        if (isCancelled) return;
        const ordered = sortPublishedGalleryItems(items).map(mapGalleryItemToPublicPresentation);
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          items: ordered,
          reachedQueryLimit: Boolean(reachedQueryLimit),
          error: '',
        });
      },
      onError: () => {
        if (isCancelled) return;
        setSnapshotState({
          loadedAdapter: resolvedAdapter,
          items: [],
          reachedQueryLimit: false,
          error: 'The studio photo gallery is temporarily unavailable. Please check back shortly.',
        });
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [limitCount, resolvedAdapter]);

  const isLoading = snapshotState.loadedAdapter !== resolvedAdapter;
  const items = useMemo(() => snapshotState.items, [snapshotState.items]);

  return {
    items,
    isLoading,
    error: snapshotState.error,
    reachedQueryLimit: snapshotState.reachedQueryLimit,
  };
}
