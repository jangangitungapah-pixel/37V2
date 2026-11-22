import {
  FACTORY_RESET_BATCH_SIZE,
  FACTORY_RESET_DELETION_MANIFEST,
  FACTORY_RESET_PRESERVED_MANIFEST,
  FACTORY_RESET_PREVIEW_GROUPS,
} from '../config/factory-reset-config';

/**
 * Builds the grouped preflight summary object from raw count query results.
 * Never fabricates zero when a count query fails — marks `isComplete = false` strictly.
 */
export function buildPreflightSummary({
  targetCounts = [],
  preservedChecks = [],
  existingOperation = null,
  checkedAtIso = new Date().toISOString(),
} = {}) {
  const resultMap = new Map((targetCounts || []).map((item) => [item.key, item]));

  const items = FACTORY_RESET_DELETION_MANIFEST.map((target) => {
    const measured = resultMap.get(target.key) || {
      key: target.key,
      count: null,
      error: 'Count query did not execute.',
    };
    const hasError = Boolean(measured.error) || typeof measured.count !== 'number';
    const count = hasError ? null : Math.max(0, Math.round(measured.count));
    const estimatedBatches =
      count === null ? null : count === 0 ? 0 : Math.ceil(count / FACTORY_RESET_BATCH_SIZE);

    return {
      ...target,
      count,
      estimatedBatches,
      error: measured.error || (hasError ? 'Gagal membaca jumlah dokumen.' : ''),
      ok: !hasError,
    };
  });

  const failedTargets = items.filter((item) => !item.ok);
  const topLevelItems = items.filter((item) => item.kind === 'collection');
  const subcollectionItems = items.filter((item) => item.kind === 'subcollection');

  const topLevelDocumentCount =
    failedTargets.length === 0
      ? topLevelItems.reduce((sum, item) => sum + (item.count || 0), 0)
      : null;
  const subcollectionDocumentCount =
    failedTargets.length === 0
      ? subcollectionItems.reduce((sum, item) => sum + (item.count || 0), 0)
      : null;
  const totalDeleteOperations =
    failedTargets.length === 0
      ? (topLevelDocumentCount || 0) + (subcollectionDocumentCount || 0)
      : null;
  const estimatedBatchCommits =
    failedTargets.length === 0
      ? items.reduce((sum, item) => sum + (item.estimatedBatches || 0), 0)
      : null;

  const groupedItems = FACTORY_RESET_PREVIEW_GROUPS.map((group) => {
    const groupTargets = items.filter((item) => item.group === group.id);
    const groupHasError = groupTargets.some((item) => !item.ok);
    const groupTotal = groupHasError
      ? null
      : groupTargets.reduce((sum, item) => sum + (item.count || 0), 0);

    return {
      ...group,
      targets: groupTargets,
      totalCount: groupTotal,
      hasError: groupHasError,
    };
  });

  const preservedMap = new Map((preservedChecks || []).map((item) => [item.key, item]));
  const preservedItems = FACTORY_RESET_PRESERVED_MANIFEST.map((item) => {
    const check = preservedMap.get(item.key) || {};
    return {
      ...item,
      count: typeof check.count === 'number' ? check.count : null,
      exists: typeof check.exists === 'boolean' ? check.exists : null,
      error: check.error || '',
      statusLabel: check.statusLabel || 'Preserved',
    };
  });

  const preservedErrors = preservedItems.filter((item) => Boolean(item.error));
  const preservedDetectedCount = preservedItems.reduce((sum, item) => {
    if (typeof item.count === 'number') return sum + item.count;
    if (item.exists === true) return sum + 1;
    return sum;
  }, 0);

  const isComplete = failedTargets.length === 0 && preservedErrors.length === 0;

  return {
    isComplete,
    checkedAtIso,
    items,
    groupedItems,
    failedTargets,
    preservedItems,
    preservedErrors,
    preservedDetectedCount,
    topLevelDocumentCount,
    subcollectionDocumentCount,
    totalDeleteOperations,
    estimatedBatchCommits,
    existingOperation,
  };
}

/**
 * Resolves the remaining manifest steps from an existing operation state for deterministic resume.
 */
export function getPendingManifestSteps(operation = null) {
  const completedSet = new Set(operation?.completedCollections || []);
  return FACTORY_RESET_DELETION_MANIFEST.filter((step) => !completedSet.has(step.key));
}

/**
 * Computes honest progress telemetry from the persisted operation manifest and optional preflight estimate.
 */
export function computeFactoryResetProgress(operation = null, preflight = null) {
  const totalSteps = FACTORY_RESET_DELETION_MANIFEST.length;
  const completedStepsCount = Math.min(
    totalSteps,
    Array.isArray(operation?.completedCollections) ? operation.completedCollections.length : 0,
  );
  const currentStep =
    FACTORY_RESET_DELETION_MANIFEST.find((s) => s.key === operation?.currentCollection) || null;
  const totalDeletedCount = Math.max(0, Number(operation?.totalDeletedCount) || 0);

  const hasReliableTotal =
    Boolean(preflight?.isComplete) && typeof preflight?.totalDeleteOperations === 'number';
  const estimatedTotalDocuments = hasReliableTotal ? preflight.totalDeleteOperations : null;

  let percentage = null;
  if (operation?.status === 'completed') {
    percentage = 100;
  } else if (hasReliableTotal && estimatedTotalDocuments > 0) {
    percentage = Math.min(99, Math.round((totalDeletedCount / estimatedTotalDocuments) * 100));
  } else if (hasReliableTotal && estimatedTotalDocuments === 0) {
    percentage =
      completedStepsCount === totalSteps
        ? 100
        : Math.round((completedStepsCount / totalSteps) * 100);
  }

  const remainingEstimate =
    hasReliableTotal && typeof estimatedTotalDocuments === 'number'
      ? Math.max(0, estimatedTotalDocuments - totalDeletedCount)
      : null;

  return {
    totalSteps,
    completedStepsCount,
    currentStep,
    totalDeletedCount,
    estimatedTotalDocuments,
    remainingEstimate,
    percentage,
    isIndeterminate: percentage === null,
    deletedDocumentCounts: operation?.deletedDocumentCounts || {},
  };
}

/**
 * Maps Firebase/service errors into clear Indonesian operational messages for the Owner UI.
 */
export function formatResetErrorForDisplay(error) {
  const code = String(error?.code || '').toLowerCase();

  if (code === 'factory-reset/owner-required' || code.includes('owner-required')) {
    return 'Hanya Owner Studio aktif yang diizinkan menjalankan atau melanjutkan Factory Reset.';
  }
  if (code === 'factory-reset/reauth-required') {
    return 'Verifikasi ulang password akun Owner diperlukan sebelum memulai atau melanjutkan Factory Reset.';
  }
  if (code === 'factory-reset/incomplete-preflight') {
    return (
      error?.message ||
      'Ringkasan jumlah data belum lengkap karena sebagian kueri gagal. Muat ulang pratinjau data sebelum memulai.'
    );
  }
  if (code === 'factory-reset/subcollection-not-empty') {
    return (
      error?.message ||
      'Subkoleksi Booking Request belum sepenuhnya kosong sebelum menghapus dokumen induk. Coba lanjutkan (Resume) lagi.'
    );
  }
  if (code === 'factory-reset/verification-failed') {
    return (
      error?.message ||
      'Verifikasi pasca-penghapusan menemukan sisa dokumen pada salah satu koleksi. Operasi tetap terkunci untuk Resume.'
    );
  }
  if (code === 'factory-reset/availability-reinit-failed') {
    return 'Semua data operasional telah dihapus, tetapi gagal menginisialisasi ulang publicAvailabilityMetadata/status. Tekan Resume untuk menyelesaikan tahap akhir.';
  }
  if (code.includes('permission-denied')) {
    return 'Akses Firestore ditolak (permission-denied). Pastikan akun Anda berstatus Owner aktif dan Firestore Rules Factory Reset terbaru telah di-deploy.';
  }
  if (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    code.includes('network')
  ) {
    return 'Koneksi ke Firestore terputus saat menghapus batch data. Progres telah tersimpan dan dapat dilanjutkan (Resume).';
  }
  if (code.includes('unauthenticated')) {
    return 'Sesi autentikasi berakhir. Silakan login ulang sebagai Owner lalu lanjutkan operasi yang tersisa.';
  }

  return (
    error?.message ||
    'Terjadi kesalahan saat memproses Factory Reset. Progres aman untuk dilanjutkan kembali.'
  );
}
