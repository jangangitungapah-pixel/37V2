import { useEffect, useMemo, useState } from 'react';

import { GALLERY_BOUNDED_QUERY_LIMIT, GALLERY_STATUSES } from '../config/gallery-config';
import { getGalleryRepositoryAdapter } from '../repositories/gallery-repository';
import { sortPublishedGalleryItems } from '../utils/gallery-normalize';

/**
 * Subscribes to the bounded Admin Gallery collection (`galleryItems`) ONLY when `enabled` is true
 * (i.e., when the signed-in user is an active Owner). Staff accounts never subscribe to private items.
 */
export function useGalleryItems({
  enabled = true,
  limitCount = GALLERY_BOUNDED_QUERY_LIMIT,
  customAdapter = null,
} = {}) {
  const resolvedAdapter = customAdapter || getGalleryRepositoryAdapter();

  const [snapshotState, setSnapshotState] = useState({
    loadedKey: '',
    items: [],
    reachedQueryLimit: false,
    error: '',
  });

  const subscriptionKey = enabled ? `owner:${limitCount}` : 'disabled';

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isCancelled = false;

    const unsubscribe = resolvedAdapter.subscribeAdminGalleryItems({
      limitCount,
      onData: ({ items, reachedQueryLimit }) => {
        if (isCancelled) return;
        setSnapshotState({
          loadedKey: subscriptionKey,
          items,
          reachedQueryLimit: Boolean(reachedQueryLimit),
          error: '',
        });
      },
      onError: (err) => {
        if (isCancelled) return;
        setSnapshotState((prev) => ({
          ...prev,
          loadedKey: subscriptionKey,
          error: err?.message || 'Gagal memuat pustaka galeri dari Firestore.',
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe?.();
    };
  }, [enabled, limitCount, resolvedAdapter, subscriptionKey]);

  const items = useMemo(() => (enabled ? snapshotState.items : []), [enabled, snapshotState.items]);
  const publishedItems = useMemo(() => sortPublishedGalleryItems(items), [items]);

  const counts = useMemo(() => {
    let published = 0;
    let draft = 0;
    let archived = 0;
    items.forEach((item) => {
      if (item.status === GALLERY_STATUSES.PUBLISHED) published += 1;
      else if (item.status === GALLERY_STATUSES.ARCHIVED) archived += 1;
      else draft += 1;
    });
    return {
      total: items.length,
      published,
      draft,
      archived,
    };
  }, [items]);

  const isLoading = enabled && snapshotState.loadedKey !== subscriptionKey;

  return {
    items,
    publishedItems,
    counts,
    reachedQueryLimit: enabled ? snapshotState.reachedQueryLimit : false,
    isLoading,
    error: enabled ? snapshotState.error : '',
  };
}
