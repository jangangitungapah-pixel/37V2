import {
  FACTORY_RESET_CONFIRMATION_PHRASE,
  FACTORY_RESET_LOCKED_STATUSES,
  FACTORY_RESET_SCHEMA_VERSION,
  FACTORY_RESET_STATUS,
} from '../config/factory-reset-config';

const VALID_RESET_STATUSES = new Set(Object.values(FACTORY_RESET_STATUS));

/**
 * Collapses leading/trailing and internal consecutive spaces while preserving exact uppercase casing.
 */
export function normalizeConfirmationPhrase(input = '') {
  return String(input || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isConfirmationPhraseValid(input = '') {
  return normalizeConfirmationPhrase(input) === FACTORY_RESET_CONFIRMATION_PHRASE;
}

export function isFactoryResetLockedStatus(status = '') {
  return FACTORY_RESET_LOCKED_STATUSES.includes(String(status || '').trim());
}

/**
 * Safe cancellation is allowed ONLY before any document batch has been committed/deleted.
 */
export function canCancelFactoryResetSafely(operation = null) {
  if (!operation || !isFactoryResetLockedStatus(operation.status)) {
    return false;
  }
  const totalDeleted = Math.max(0, Number(operation.totalDeletedCount) || 0);
  const completedCount = Array.isArray(operation.completedCollections)
    ? operation.completedCollections.length
    : 0;
  return totalDeleted === 0 && completedCount === 0;
}

export function normalizeFactoryResetOperation(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const operationId = String(raw.operationId || '').trim();
  const status = VALID_RESET_STATUSES.has(raw.status) ? raw.status : FACTORY_RESET_STATUS.IDLE;

  if (!operationId) {
    return null;
  }

  const completedCollections = Array.isArray(raw.completedCollections)
    ? Array.from(
        new Set(raw.completedCollections.map((item) => String(item || '').trim()).filter(Boolean)),
      )
    : [];

  const rawCounts =
    raw.deletedDocumentCounts && typeof raw.deletedDocumentCounts === 'object'
      ? raw.deletedDocumentCounts
      : {};
  const deletedDocumentCounts = {};
  for (const [k, v] of Object.entries(rawCounts)) {
    const cleanKey = String(k || '').trim();
    if (cleanKey) {
      deletedDocumentCounts[cleanKey] = Math.max(0, Math.round(Number(v) || 0));
    }
  }

  const rawVerification =
    raw.verificationSummary && typeof raw.verificationSummary === 'object'
      ? {
          allZero: raw.verificationSummary.allZero === true,
          checkedCollectionsCount: Math.max(
            0,
            Math.round(Number(raw.verificationSummary.checkedCollectionsCount) || 0),
          ),
          remainingTotal: Math.max(
            0,
            Math.round(Number(raw.verificationSummary.remainingTotal) || 0),
          ),
        }
      : null;

  return {
    schemaVersion: Number(raw.schemaVersion) || FACTORY_RESET_SCHEMA_VERSION,
    operationId,
    status,
    initiatedByUid: String(raw.initiatedByUid || '').trim(),
    initiatedAt: raw.initiatedAt ?? null,
    currentCollection: String(raw.currentCollection || '').trim(),
    lastProcessedDocumentId: String(raw.lastProcessedDocumentId || '').trim(),
    completedCollections,
    deletedDocumentCounts,
    totalDeletedCount: Math.max(0, Math.round(Number(raw.totalDeletedCount) || 0)),
    startedAt: raw.startedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    completedAt: raw.completedAt ?? null,
    lastErrorCode: String(raw.lastErrorCode || '').trim(),
    lastErrorMessage: String(raw.lastErrorMessage || '').trim(),
    verificationSummary: rawVerification,
  };
}

/**
 * Validates all prerequisites before starting a fresh Factory Reset execution.
 */
export function validateStartFactoryResetInput({
  preflight = null,
  confirmationPhrase = '',
  acknowledged = false,
} = {}) {
  if (!preflight || typeof preflight !== 'object' || preflight.isComplete !== true) {
    return {
      isValid: false,
      code: 'factory-reset/incomplete-preflight',
      message:
        'Preflight ringkasan data belum lengkap atau mengalami kegagalan kueri. Muat ulang ringkasan data sebelum melanjutkan.',
    };
  }

  if (
    preflight.activeLockError ||
    isFactoryResetLockedStatus(preflight.existingOperation?.status)
  ) {
    return {
      isValid: false,
      code: 'factory-reset/already-running',
      message:
        'Terdapat operasi Factory Reset yang belum selesai. Gunakan alur Resume untuk menuntaskan operasi yang sedang berjalan.',
    };
  }

  if (!isConfirmationPhraseValid(confirmationPhrase)) {
    return {
      isValid: false,
      code: 'factory-reset/invalid-confirmation-phrase',
      message: `Frasa konfirmasi tidak cocok. Ketik persis "${FACTORY_RESET_CONFIRMATION_PHRASE}".`,
    };
  }

  if (acknowledged !== true) {
    return {
      isValid: false,
      code: 'factory-reset/acknowledgment-required',
      message: 'Centang pernyataan pemahaman bahwa seluruh data operasional akan dihapus permanen.',
    };
  }

  return {
    isValid: true,
  };
}
