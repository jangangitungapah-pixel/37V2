import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';

import {
  FACTORY_RESET_BATCH_SIZE,
  FACTORY_RESET_DELETION_MANIFEST,
  FACTORY_RESET_PARENT_PAGE_SIZE,
  FACTORY_RESET_PRESERVED_MANIFEST,
  FACTORY_RESET_SCHEMA_VERSION,
  FACTORY_RESET_STATUS,
} from '../config/factory-reset-config';
import { getFactoryResetRepositoryAdapter } from '../repositories/factory-reset-repository';
import { buildPreflightSummary, getPendingManifestSteps } from '../utils/factory-reset-manifest';
import {
  canCancelFactoryResetSafely,
  isFactoryResetLockedStatus,
  validateStartFactoryResetInput,
} from '../utils/factory-reset-validation';
import {
  assertActiveOwnerActor,
  assertFreshReauthentication,
  createFactoryResetError,
} from './factory-reset-auth-service';

async function countManifestTarget(step, adapter) {
  if (step.kind === 'collection') {
    const count = await adapter.countCollectionDocuments(step.collection);
    return { key: step.key, count, error: '' };
  }

  // Paginated parent enumeration to aggregate subcollection counts cleanly
  let total = 0;
  let cursorId = '';
  let hasMore = true;

  while (hasMore) {
    const page = await adapter.listDocumentIdsPage({
      collectionName: step.parentCollection,
      pageSize: FACTORY_RESET_PARENT_PAGE_SIZE,
      afterId: cursorId,
    });
    const ids = page.ids || [];
    if (ids.length === 0) break;

    const counts = await Promise.all(
      ids.map((parentId) =>
        adapter.countSubcollectionForParent({
          parentCollection: step.parentCollection,
          parentId,
          subcollectionName: step.subcollection,
        }),
      ),
    );
    total += counts.reduce((sum, n) => sum + Number(n || 0), 0);
    hasMore = Boolean(page.hasMore);
    cursorId = ids[ids.length - 1];
  }

  return { key: step.key, count: total, error: '' };
}

/**
 * Generates a complete read-only preflight dry-run summary for Factory Reset.
 * Verifies active Owner authorization and performs ZERO mutations.
 */
export async function previewFactoryReset({
  actor,
  adapter = getFactoryResetRepositoryAdapter(),
} = {}) {
  const cleanActor = assertActiveOwnerActor(actor);

  let existingOperation;
  try {
    existingOperation = await adapter.getResetOperation();
  } catch (err) {
    throw createFactoryResetError(
      err?.code || 'factory-reset/operation-read-failed',
      err?.message || 'Gagal membaca status operasi Factory Reset yang tersimpan.',
    );
  }

  const targetCounts = await Promise.all(
    FACTORY_RESET_DELETION_MANIFEST.map(async (step) => {
      try {
        return await countManifestTarget(step, adapter);
      } catch (err) {
        return {
          key: step.key,
          count: null,
          error: err?.message || `Gagal menghitung dokumen pada ${step.pathPattern}.`,
        };
      }
    }),
  );

  const preservedChecks = await Promise.all(
    FACTORY_RESET_PRESERVED_MANIFEST.map(async (item) => {
      try {
        return await adapter.checkPreservedTarget(item, cleanActor.uid);
      } catch (err) {
        return {
          key: item.key,
          error: err?.message || `Gagal memverifikasi status aset terjaga (${item.path}).`,
        };
      }
    }),
  );

  return buildPreflightSummary({
    targetCounts,
    preservedChecks,
    existingOperation,
    checkedAtIso: new Date().toISOString(),
  });
}

async function verifyAllManifestTargetsEmpty(adapter) {
  const nonEmptyTargets = [];
  let remainingTotal = 0;

  for (const step of FACTORY_RESET_DELETION_MANIFEST) {
    const res = await countManifestTarget(step, adapter);
    const remaining = Math.max(0, Number(res.count) || 0);
    if (remaining > 0) {
      remainingTotal += remaining;
      nonEmptyTargets.push({
        key: step.key,
        label: step.label,
        pathPattern: step.pathPattern,
        remaining,
      });
    }
  }

  return {
    allZero: remainingTotal === 0,
    checkedCollectionsCount: FACTORY_RESET_DELETION_MANIFEST.length,
    remainingTotal,
    nonEmptyTargets,
  };
}

async function processSubcollectionStep({
  step,
  initialCursorId,
  adapter,
  stateBox,
  shouldPause,
  onProgress,
}) {
  let parentCursorId = initialCursorId || '';
  let hasMoreParents = true;

  while (hasMoreParents) {
    if (shouldPause?.()) {
      return { paused: true };
    }

    const parentPage = await adapter.listDocumentIdsPage({
      collectionName: step.parentCollection,
      pageSize: FACTORY_RESET_PARENT_PAGE_SIZE,
      afterId: parentCursorId,
    });

    const parentIds = parentPage.ids || [];
    if (parentIds.length === 0) {
      break;
    }

    for (const parentId of parentIds) {
      let childCursorEmptyLoopGuard = 0;

      while (childCursorEmptyLoopGuard < 10_000) {
        if (shouldPause?.()) {
          return { paused: true };
        }

        const childPage = await adapter.listSubcollectionDocIds({
          parentCollection: step.parentCollection,
          parentId,
          subcollectionName: step.subcollection,
          pageSize: FACTORY_RESET_BATCH_SIZE,
          afterId: '',
        });

        const childIds = childPage.ids || [];
        if (childIds.length === 0) {
          break;
        }
        childCursorEmptyLoopGuard += 1;

        const pathList = childIds.map((childId) => [
          step.parentCollection,
          parentId,
          step.subcollection,
          childId,
        ]);

        await adapter.deleteDocumentsBatch(pathList);

        const deletedInBatch = pathList.length;
        const nextCounts = {
          ...stateBox.current.deletedDocumentCounts,
          [step.key]: (stateBox.current.deletedDocumentCounts[step.key] || 0) + deletedInBatch,
        };
        const nextTotalDeleted = stateBox.current.totalDeletedCount + deletedInBatch;
        stateBox.current = await adapter.updateResetOperation(
          {
            status: FACTORY_RESET_STATUS.RUNNING,
            currentCollection: step.key,
            lastProcessedDocumentId: parentCursorId,
            completedCollections: stateBox.current.completedCollections,
            deletedDocumentCounts: nextCounts,
            totalDeletedCount: nextTotalDeleted,
            lastErrorCode: '',
            lastErrorMessage: '',
          },
          stateBox.current,
        );
        onProgress?.(stateBox.current);
      }

      const remainingChildren = await adapter.countSubcollectionForParent({
        parentCollection: step.parentCollection,
        parentId,
        subcollectionName: step.subcollection,
      });
      if (remainingChildren > 0) {
        throw createFactoryResetError(
          'factory-reset/subcollection-not-empty',
          `Subkoleksi ${step.subcollection} untuk request ${parentId} masih menyisakan ${remainingChildren} dokumen.`,
        );
      }

      parentCursorId = parentId;
      stateBox.current = await adapter.updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.RUNNING,
          currentCollection: step.key,
          lastProcessedDocumentId: parentCursorId,
          completedCollections: stateBox.current.completedCollections,
          deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
          totalDeletedCount: stateBox.current.totalDeletedCount,
          lastErrorCode: '',
          lastErrorMessage: '',
        },
        stateBox.current,
      );
      onProgress?.(stateBox.current);
    }

    hasMoreParents = Boolean(parentPage.hasMore);
  }

  return { paused: false };
}

async function processTopLevelCollectionStep({
  step,
  initialCursorId,
  adapter,
  stateBox,
  shouldPause,
  onProgress,
}) {
  let cursorId = initialCursorId || '';
  let resetSweepAttempts = 0;

  while (resetSweepAttempts < 2) {
    let hasMoreDocs = true;

    while (hasMoreDocs) {
      if (shouldPause?.()) {
        return { paused: true };
      }

      const page = await adapter.listDocumentIdsPage({
        collectionName: step.collection,
        pageSize: FACTORY_RESET_BATCH_SIZE,
        afterId: cursorId,
      });

      const docIds = page.ids || [];
      if (docIds.length === 0) {
        break;
      }

      // Enforce child-subcollection emptiness right before deleting parent documents
      if (step.collection === 'publicBookingRequests') {
        const subChecks = await Promise.all(
          docIds.map(async (parentId) => {
            const [commCount, actCount, offerCount] = await Promise.all([
              adapter.countSubcollectionForParent({
                parentCollection: 'publicBookingRequests',
                parentId,
                subcollectionName: 'communications',
              }),
              adapter.countSubcollectionForParent({
                parentCollection: 'publicBookingRequests',
                parentId,
                subcollectionName: 'activities',
              }),
              adapter.countSubcollectionForParent({
                parentCollection: 'publicBookingRequests',
                parentId,
                subcollectionName: 'offers',
              }),
            ]);
            return { parentId, total: commCount + actCount + offerCount };
          }),
        );
        const nonEmptyParent = subChecks.find((c) => c.total > 0);
        if (nonEmptyParent) {
          throw createFactoryResetError(
            'factory-reset/subcollection-not-empty',
            `Dokumen induk publicBookingRequests/${nonEmptyParent.parentId} masih memiliki ${nonEmptyParent.total} subkoleksi aktif dan tidak boleh dihapus lebih dulu.`,
          );
        }
      }

      if (step.collection === 'invoices') {
        const adjChecks = await Promise.all(
          docIds.map(async (invoiceId) => {
            const adjCount = await adapter.countSubcollectionForParent({
              parentCollection: 'invoices',
              parentId: invoiceId,
              subcollectionName: 'adjustments',
            });
            return { invoiceId, adjCount };
          }),
        );
        const nonEmptyInvoice = adjChecks.find((c) => c.adjCount > 0);
        if (nonEmptyInvoice) {
          throw createFactoryResetError(
            'factory-reset/subcollection-not-empty',
            `Dokumen induk invoices/${nonEmptyInvoice.invoiceId} masih memiliki ${nonEmptyInvoice.adjCount} penyesuaian harga aktif dan tidak boleh dihapus lebih dulu.`,
          );
        }
      }

      const pathList = docIds.map((docId) => [step.collection, docId]);
      await adapter.deleteDocumentsBatch(pathList);

      cursorId = docIds[docIds.length - 1];
      const deletedInBatch = pathList.length;
      const nextCounts = {
        ...stateBox.current.deletedDocumentCounts,
        [step.key]: (stateBox.current.deletedDocumentCounts[step.key] || 0) + deletedInBatch,
      };
      const nextTotalDeleted = stateBox.current.totalDeletedCount + deletedInBatch;
      stateBox.current = await adapter.updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.RUNNING,
          currentCollection: step.key,
          lastProcessedDocumentId: cursorId,
          completedCollections: stateBox.current.completedCollections,
          deletedDocumentCounts: nextCounts,
          totalDeletedCount: nextTotalDeleted,
          lastErrorCode: '',
          lastErrorMessage: '',
        },
        stateBox.current,
      );
      onProgress?.(stateBox.current);
      hasMoreDocs = Boolean(page.hasMore);
    }

    const remaining = await adapter.countCollectionDocuments(step.collection);
    if (remaining === 0 || !cursorId || resetSweepAttempts > 0) {
      break;
    }
    cursorId = '';
    resetSweepAttempts += 1;
  }

  return { paused: false };
}

async function executeResetLoop({
  initialOperation,
  adapter,
  shouldPause,
  onProgress,
  now = new Date(),
}) {
  const stateBox = { current: { ...initialOperation } };
  const pendingSteps = getPendingManifestSteps(stateBox.current);

  try {
    for (const step of pendingSteps) {
      if (shouldPause?.()) {
        stateBox.current = await adapter.updateResetOperation(
          {
            status: FACTORY_RESET_STATUS.PAUSED,
            currentCollection: step.key,
            lastProcessedDocumentId:
              stateBox.current.currentCollection === step.key
                ? stateBox.current.lastProcessedDocumentId
                : '',
            completedCollections: stateBox.current.completedCollections,
            deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
            totalDeletedCount: stateBox.current.totalDeletedCount,
            lastErrorCode: '',
            lastErrorMessage: '',
          },
          stateBox.current,
        );
        onProgress?.(stateBox.current);
        return stateBox.current;
      }

      const initialCursorId =
        stateBox.current.currentCollection === step.key
          ? stateBox.current.lastProcessedDocumentId
          : '';

      stateBox.current = await adapter.updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.RUNNING,
          currentCollection: step.key,
          lastProcessedDocumentId: initialCursorId,
          completedCollections: stateBox.current.completedCollections,
          deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
          totalDeletedCount: stateBox.current.totalDeletedCount,
          lastErrorCode: '',
          lastErrorMessage: '',
        },
        stateBox.current,
      );
      onProgress?.(stateBox.current);

      const stepResult =
        step.kind === 'subcollection'
          ? await processSubcollectionStep({
              step,
              initialCursorId,
              adapter,
              stateBox,
              shouldPause,
              onProgress,
            })
          : await processTopLevelCollectionStep({
              step,
              initialCursorId,
              adapter,
              stateBox,
              shouldPause,
              onProgress,
            });

      if (stepResult.paused) {
        stateBox.current = await adapter.updateResetOperation(
          {
            status: FACTORY_RESET_STATUS.PAUSED,
            currentCollection: stateBox.current.currentCollection || step.key,
            lastProcessedDocumentId: stateBox.current.lastProcessedDocumentId || '',
            completedCollections: stateBox.current.completedCollections,
            deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
            totalDeletedCount: stateBox.current.totalDeletedCount,
            lastErrorCode: '',
            lastErrorMessage: '',
          },
          stateBox.current,
        );
        onProgress?.(stateBox.current);
        return stateBox.current;
      }

      stateBox.current.completedCollections = [...stateBox.current.completedCollections, step.key];
      stateBox.current = await adapter.updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.RUNNING,
          currentCollection: step.key,
          lastProcessedDocumentId: '',
          completedCollections: stateBox.current.completedCollections,
          deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
          totalDeletedCount: stateBox.current.totalDeletedCount,
          lastErrorCode: '',
          lastErrorMessage: '',
        },
        stateBox.current,
      );
      onProgress?.(stateBox.current);
    }

    // Fresh completion verification across all 18 operational targets
    const verification = await verifyAllManifestTargetsEmpty(adapter);
    if (!verification.allZero) {
      const nonEmptyKeys = new Set(verification.nonEmptyTargets.map((item) => item.key));
      stateBox.current.completedCollections = stateBox.current.completedCollections.filter(
        (key) => !nonEmptyKeys.has(key),
      );
      stateBox.current.currentCollection = verification.nonEmptyTargets[0].key;
      stateBox.current.lastProcessedDocumentId = '';
      throw createFactoryResetError(
        'factory-reset/verification-failed',
        `Verifikasi akhir mendeteksi ${verification.remainingTotal} dokumen tersisa pada ${verification.nonEmptyTargets.map((t) => t.pathPattern).join(', ')}.`,
        { nonEmptyTargets: verification.nonEmptyTargets },
      );
    }

    // Reinitialize public availability readiness cleanly for an empty studio schedule
    const todayIso = getJakartaTodayIso(now);
    try {
      await adapter.setPublicAvailabilityMetadata({
        isReady: true,
        backfilledFromDate: todayIso,
      });
    } catch (reinitErr) {
      throw createFactoryResetError(
        'factory-reset/availability-reinit-failed',
        reinitErr?.message ||
          'Gagal menginisialisasi ulang metadata kesiapan kalender publik (/availability).',
      );
    }

    const completedOp = await adapter.updateResetOperation(
      {
        status: FACTORY_RESET_STATUS.COMPLETED,
        currentCollection: '',
        lastProcessedDocumentId: '',
        completedCollections: stateBox.current.completedCollections,
        deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
        totalDeletedCount: stateBox.current.totalDeletedCount,
        lastErrorCode: '',
        lastErrorMessage: '',
        verificationSummary: {
          allZero: true,
          checkedCollectionsCount: verification.checkedCollectionsCount,
          remainingTotal: 0,
        },
        markCompleted: true,
      },
      stateBox.current,
    );
    onProgress?.(completedOp);
    return completedOp;
  } catch (err) {
    const errorCode = String(err?.code || 'factory-reset/batch-failed').slice(0, 80);
    const errorMessage = String(err?.message || 'Operasi Factory Reset terhenti.').slice(0, 400);

    try {
      const failedOp = await adapter.updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.FAILED,
          currentCollection: stateBox.current.currentCollection || '',
          lastProcessedDocumentId: stateBox.current.lastProcessedDocumentId || '',
          completedCollections: stateBox.current.completedCollections,
          deletedDocumentCounts: stateBox.current.deletedDocumentCounts,
          totalDeletedCount: stateBox.current.totalDeletedCount,
          lastErrorCode: errorCode,
          lastErrorMessage: errorMessage,
        },
        stateBox.current,
      );
      onProgress?.(failedOp);
    } catch {
      // Preserve primary failure error if manifest write also fails due to offline/expired session
    }

    throw createFactoryResetError(errorCode, errorMessage, err?.details || null);
  }
}

/**
 * Starts a verified, lock-guarded Owner-only Operational Factory Reset.
 */
export async function startFactoryReset({
  actor,
  preflight,
  confirmationPhrase,
  acknowledged,
  reauthenticatedAt,
  shouldPause,
  onProgress,
  adapter = getFactoryResetRepositoryAdapter(),
  now = new Date(),
} = {}) {
  const cleanActor = assertActiveOwnerActor(actor);
  assertFreshReauthentication(reauthenticatedAt, now);

  const validation = validateStartFactoryResetInput({
    preflight,
    confirmationPhrase,
    acknowledged,
  });
  if (!validation.isValid) {
    throw createFactoryResetError(validation.code, validation.message);
  }

  const existingOp = await adapter.getResetOperation();
  if (isFactoryResetLockedStatus(existingOp?.status)) {
    throw createFactoryResetError(
      'factory-reset/already-running',
      'Operasi Factory Reset sedang berjalan atau menunggu dilanjutkan. Gunakan fitur Resume.',
    );
  }

  const operationId = generateOperationId('reset');
  const firstStepKey = FACTORY_RESET_DELETION_MANIFEST[0].key;

  // Persist lock BEFORE first delete batch
  const createdOp = await adapter.startOrReplaceResetOperation({
    schemaVersion: FACTORY_RESET_SCHEMA_VERSION,
    operationId,
    status: FACTORY_RESET_STATUS.RUNNING,
    initiatedByUid: cleanActor.uid,
    currentCollection: firstStepKey,
    lastProcessedDocumentId: '',
    completedCollections: [],
    deletedDocumentCounts: {},
    totalDeletedCount: 0,
  });
  onProgress?.(createdOp);

  // Mark public availability unready immediately while projections & bookings are purged
  try {
    await adapter.setPublicAvailabilityMetadata({
      isReady: false,
      backfilledFromDate: '',
    });
  } catch (err) {
    await adapter
      .updateResetOperation(
        {
          status: FACTORY_RESET_STATUS.FAILED,
          currentCollection: firstStepKey,
          lastProcessedDocumentId: '',
          completedCollections: [],
          deletedDocumentCounts: {},
          totalDeletedCount: 0,
          lastErrorCode: String(err?.code || 'factory-reset/lock-init-failed').slice(0, 80),
          lastErrorMessage: String(
            err?.message || 'Gagal mengunci metadata kalender publik.',
          ).slice(0, 400),
        },
        createdOp,
      )
      .catch(() => {});
    throw createFactoryResetError(
      err?.code || 'factory-reset/lock-init-failed',
      err?.message || 'Gagal mempersiapkan penguncian metadata kalender publik.',
    );
  }

  return executeResetLoop({
    initialOperation: createdOp,
    adapter,
    shouldPause,
    onProgress,
    now,
  });
}

/**
 * Resumes an interrupted, paused, or failed Factory Reset preserving its immutable operationId & cursor.
 */
export async function resumeFactoryReset({
  actor,
  reauthenticatedAt,
  shouldPause,
  onProgress,
  adapter = getFactoryResetRepositoryAdapter(),
  now = new Date(),
} = {}) {
  assertActiveOwnerActor(actor);
  assertFreshReauthentication(reauthenticatedAt, now);

  const existingOp = await adapter.getResetOperation();
  if (!existingOp) {
    throw createFactoryResetError(
      'factory-reset/no-operation',
      'Tidak ada operasi Factory Reset yang perlu dilanjutkan.',
    );
  }

  if (existingOp.status === FACTORY_RESET_STATUS.COMPLETED) {
    return existingOp;
  }

  if (existingOp.status === FACTORY_RESET_STATUS.CANCELLED) {
    throw createFactoryResetError(
      'factory-reset/not-resumable',
      'Operasi Factory Reset tersebut telah dibatalkan sebelum penghapusan dimulai.',
    );
  }

  const resumedOp = await adapter.updateResetOperation(
    {
      status: FACTORY_RESET_STATUS.RUNNING,
      currentCollection: existingOp.currentCollection || '',
      lastProcessedDocumentId: existingOp.lastProcessedDocumentId || '',
      completedCollections: existingOp.completedCollections || [],
      deletedDocumentCounts: existingOp.deletedDocumentCounts || {},
      totalDeletedCount: existingOp.totalDeletedCount || 0,
      lastErrorCode: '',
      lastErrorMessage: '',
    },
    existingOp,
  );
  onProgress?.(resumedOp);

  await adapter.setPublicAvailabilityMetadata({
    isReady: false,
    backfilledFromDate: '',
  });

  return executeResetLoop({
    initialOperation: resumedOp,
    adapter,
    shouldPause,
    onProgress,
    now,
  });
}

/**
 * Safely cancels a started Factory Reset ONLY when ZERO deletions have occurred.
 */
export async function cancelFactoryResetBeforeDeletion({
  actor,
  adapter = getFactoryResetRepositoryAdapter(),
  now = new Date(),
} = {}) {
  assertActiveOwnerActor(actor);

  const existingOp = await adapter.getResetOperation();
  if (!existingOp) {
    return null;
  }

  if (!canCancelFactoryResetSafely(existingOp)) {
    throw createFactoryResetError(
      'factory-reset/cannot-cancel-after-deletion',
      'Factory Reset tidak dapat dibatalkan setelah penghapusan batch pertama dilakukan. Lanjutkan hingga verifikasi selesai.',
    );
  }

  const cancelledOp = await adapter.updateResetOperation(
    {
      status: FACTORY_RESET_STATUS.CANCELLED,
      currentCollection: '',
      lastProcessedDocumentId: '',
      completedCollections: [],
      deletedDocumentCounts: {},
      totalDeletedCount: 0,
      lastErrorCode: '',
      lastErrorMessage: 'Dibatalkan aman sebelum ada dokumen yang terhapus.',
    },
    existingOp,
  );

  await adapter
    .setPublicAvailabilityMetadata({
      isReady: true,
      backfilledFromDate: getJakartaTodayIso(now),
    })
    .catch(() => {});

  return cancelledOp;
}
