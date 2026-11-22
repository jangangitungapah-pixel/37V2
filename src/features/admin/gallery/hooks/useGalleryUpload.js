import { useCallback, useEffect, useRef, useState } from 'react';

import {
  GALLERY_CATEGORY_SUGGESTIONS,
  GALLERY_MAX_CONCURRENT_UPLOADS,
  getCloudinaryConfig,
} from '../config/gallery-config';
import {
  generateGalleryItemId,
  getGalleryRepositoryAdapter,
} from '../repositories/gallery-repository';
import {
  mapCloudinaryErrorToMessage,
  uploadImageToCloudinary,
  validateGalleryUploadFile,
} from '../services/cloudinary-upload-service';
import {
  createGalleryMetadataFromUpload,
  mapGalleryServiceErrorToMessage,
} from '../services/gallery-service';
import { deriveTitleFromFilename } from '../utils/gallery-format';

export const UPLOAD_QUEUE_STATUSES = Object.freeze({
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  SAVING_METADATA: 'saving_metadata',
  COMPLETED: 'completed',
  UPLOAD_FAILED: 'upload_failed',
  METADATA_FAILED: 'metadata_failed',
  CANCELLED: 'cancelled',
});

/**
 * Manages the Owner Gallery upload queue with:
 * - Max 2 concurrent Cloudinary uploads
 * - Pre-generated stable Firestore document ID per file
 * - Cancel queued upload before it starts
 * - Retry failed Cloudinary upload
 * - Retry Firestore metadata creation WITHOUT re-uploading when Cloudinary succeeded
 * - Remove completed / cancelled items from the visible queue
 */
export function useGalleryUpload({
  enabled = true,
  actorUid = '',
  actorRole = '',
  existingItems = [],
  defaultCategory = GALLERY_CATEGORY_SUGGESTIONS[0],
  cloudinaryConfig = null,
  customAdapter = null,
  onUploadSuccess = null,
  onUploadError = null,
} = {}) {
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  const activeCountRef = useRef(0);
  const abortControllersRef = useRef(new Map());
  const existingItemsRef = useRef(existingItems);

  useEffect(() => {
    existingItemsRef.current = existingItems;
  }, [existingItems]);

  const updateQueueState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(queueRef.current) : updater;
    queueRef.current = next;
    setQueue(next);
  }, []);

  const updateItemById = useCallback(
    (queueId, patch) => {
      updateQueueState((prev) =>
        prev.map((item) =>
          item.queueId === queueId
            ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) }
            : item,
        ),
      );
    },
    [updateQueueState],
  );

  const runSingleQueueItem = useCallback(
    async (queueItem, processNext) => {
      const resolvedConfig = cloudinaryConfig || getCloudinaryConfig();
      const resolvedAdapter = customAdapter || getGalleryRepositoryAdapter();

      let cloudinaryAsset = queueItem.cloudinaryAsset;

      try {
        // Step 1: Upload to Cloudinary ONLY if we don't already have a validated Cloudinary asset
        if (!cloudinaryAsset) {
          const abortController =
            typeof AbortController !== 'undefined' ? new AbortController() : null;
          if (abortController) {
            abortControllersRef.current.set(queueItem.queueId, abortController);
          }

          updateItemById(queueItem.queueId, {
            status: UPLOAD_QUEUE_STATUSES.UPLOADING,
            progress: 10,
            error: '',
          });

          cloudinaryAsset = await uploadImageToCloudinary({
            file: queueItem.file,
            config: resolvedConfig,
            signal: abortController?.signal || null,
            onProgress: (pct) => {
              updateItemById(queueItem.queueId, {
                progress: Math.min(90, Math.max(10, Number(pct) || 10)),
              });
            },
          });

          abortControllersRef.current.delete(queueItem.queueId);
        }
      } catch (uploadErr) {
        abortControllersRef.current.delete(queueItem.queueId);
        const msg = mapCloudinaryErrorToMessage(uploadErr, {
          uploadPreset: resolvedConfig.uploadPreset,
        });
        updateItemById(queueItem.queueId, {
          status: UPLOAD_QUEUE_STATUSES.UPLOAD_FAILED,
          error: msg,
        });
        onUploadError?.(msg, queueItem);
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        processNext();
        return;
      }

      // Step 2: Preserve validated Cloudinary response immediately so a Firestore failure never re-uploads
      updateItemById(queueItem.queueId, {
        status: UPLOAD_QUEUE_STATUSES.SAVING_METADATA,
        progress: 95,
        cloudinaryAsset,
        cloudinaryPublicId: cloudinaryAsset.cloudinaryPublicId,
        error: '',
      });

      try {
        const savedDoc = await createGalleryMetadataFromUpload({
          itemId: queueItem.galleryItemId,
          actorUid,
          actorRole,
          cloudinaryResponse: cloudinaryAsset,
          initialMetadata: {
            title: queueItem.title,
            category: queueItem.category,
            altText: queueItem.altText,
            caption: '',
          },
          existingItems: existingItemsRef.current,
          expectedCloudName: resolvedConfig.cloudName,
          adapter: resolvedAdapter,
        });

        updateItemById(queueItem.queueId, {
          status: UPLOAD_QUEUE_STATUSES.COMPLETED,
          progress: 100,
          savedItem: savedDoc,
          error: '',
        });
        onUploadSuccess?.(savedDoc);
      } catch (metaErr) {
        const msg = mapGalleryServiceErrorToMessage(metaErr);
        updateItemById(queueItem.queueId, {
          status: UPLOAD_QUEUE_STATUSES.METADATA_FAILED,
          error: msg,
        });
        onUploadError?.(msg, queueItem);
      } finally {
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        processNext();
      }
    },
    [
      actorRole,
      actorUid,
      cloudinaryConfig,
      customAdapter,
      onUploadError,
      onUploadSuccess,
      updateItemById,
    ],
  );

  const pumpQueue = useCallback(() => {
    function drainQueue() {
      if (!enabled) return;

      while (activeCountRef.current < GALLERY_MAX_CONCURRENT_UPLOADS) {
        const nextItem = queueRef.current.find(
          (item) => item.status === UPLOAD_QUEUE_STATUSES.QUEUED,
        );
        if (!nextItem) break;

        activeCountRef.current += 1;
        updateItemById(nextItem.queueId, {
          status: nextItem.cloudinaryAsset
            ? UPLOAD_QUEUE_STATUSES.SAVING_METADATA
            : UPLOAD_QUEUE_STATUSES.UPLOADING,
        });

        runSingleQueueItem(nextItem, drainQueue);
      }
    }

    drainQueue();
  }, [enabled, runSingleQueueItem, updateItemById]);

  const enqueueFiles = useCallback(
    async (fileList) => {
      if (!enabled) return [];

      const files = Array.from(fileList || []);
      if (files.length === 0) return [];

      const newItems = [];

      for (const file of files) {
        const queueId = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const galleryItemId = generateGalleryItemId();
        const defaultTitle = deriveTitleFromFilename(file?.name || 'Studio Photo');

        try {
          await validateGalleryUploadFile(file);
          newItems.push({
            queueId,
            galleryItemId,
            file,
            fileName: file.name || 'studio-photo',
            fileSize: Number(file.size) || 0,
            title: defaultTitle,
            category: defaultCategory,
            altText: defaultTitle,
            status: UPLOAD_QUEUE_STATUSES.QUEUED,
            progress: 0,
            cloudinaryAsset: null,
            cloudinaryPublicId: '',
            savedItem: null,
            error: '',
          });
        } catch (validationErr) {
          const msg = validationErr?.message || 'File foto tidak valid.';
          newItems.push({
            queueId,
            galleryItemId,
            file,
            fileName: file?.name || 'invalid-file',
            fileSize: Number(file?.size) || 0,
            title: defaultTitle,
            category: defaultCategory,
            altText: defaultTitle,
            status: UPLOAD_QUEUE_STATUSES.UPLOAD_FAILED,
            progress: 0,
            cloudinaryAsset: null,
            cloudinaryPublicId: '',
            savedItem: null,
            error: msg,
          });
          onUploadError?.(msg, { fileName: file?.name });
        }
      }

      updateQueueState((prev) => [...prev, ...newItems]);
      queueMicrotask(() => {
        pumpQueue();
      });

      return newItems;
    },
    [defaultCategory, enabled, onUploadError, pumpQueue, updateQueueState],
  );

  const cancelQueuedItem = useCallback(
    (queueId) => {
      updateQueueState((prev) =>
        prev.filter((item) => {
          if (item.queueId !== queueId) return true;
          // Only allow cancelling items before upload begins (or remove failed items)
          if (item.status === UPLOAD_QUEUE_STATUSES.QUEUED) {
            return false;
          }
          return true;
        }),
      );
    },
    [updateQueueState],
  );

  const retryFailedUpload = useCallback(
    (queueId) => {
      if (!enabled) return;
      updateItemById(queueId, (item) => {
        if (item.status !== UPLOAD_QUEUE_STATUSES.UPLOAD_FAILED) return {};
        return {
          status: UPLOAD_QUEUE_STATUSES.QUEUED,
          progress: 0,
          error: '',
        };
      });
      queueMicrotask(() => {
        pumpQueue();
      });
    },
    [enabled, pumpQueue, updateItemById],
  );

  /**
   * Retries ONLY the Firestore metadata write using the preserved Cloudinary upload response
   * and original `galleryItemId`, never re-uploading the binary to Cloudinary.
   */
  const retryMetadataSave = useCallback(
    (queueId) => {
      if (!enabled) return;
      updateItemById(queueId, (item) => {
        if (item.status !== UPLOAD_QUEUE_STATUSES.METADATA_FAILED || !item.cloudinaryAsset) {
          return {};
        }
        return {
          status: UPLOAD_QUEUE_STATUSES.QUEUED,
          progress: 90,
          error: '',
        };
      });
      queueMicrotask(() => {
        pumpQueue();
      });
    },
    [enabled, pumpQueue, updateItemById],
  );

  const removeCompletedItems = useCallback(() => {
    updateQueueState((prev) =>
      prev.filter((item) => item.status !== UPLOAD_QUEUE_STATUSES.COMPLETED),
    );
  }, [updateQueueState]);

  const dismissQueueItem = useCallback(
    (queueId) => {
      updateQueueState((prev) =>
        prev.filter((item) => {
          if (item.queueId !== queueId) return true;
          return (
            item.status === UPLOAD_QUEUE_STATUSES.UPLOADING ||
            item.status === UPLOAD_QUEUE_STATUSES.SAVING_METADATA
          );
        }),
      );
    },
    [updateQueueState],
  );

  return {
    queue,
    enqueueFiles,
    cancelQueuedItem,
    retryFailedUpload,
    retryMetadataSave,
    removeCompletedItems,
    dismissQueueItem,
  };
}
