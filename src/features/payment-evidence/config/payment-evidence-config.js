/**
 * Payment Evidence & Verification v1 — Configuration & Constants.
 *
 * Uses a dedicated unsigned Cloudinary upload preset (`VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET`)
 * isolated from the Gallery preset (`VITE_CLOUDINARY_UPLOAD_PRESET`).
 * Never exposes or reads any Cloudinary API Key or API Secret in browser code.
 */

export const PAYMENT_EVIDENCE_COLLECTION = 'paymentEvidence';
export const PAYMENT_EVIDENCE_SCHEMA_VERSION = 1;

export const PAYMENT_EVIDENCE_CLIENT_INVOICE_LIMIT = 50;
export const PAYMENT_EVIDENCE_CLIENT_CUSTOMER_LIMIT = 150;
export const PAYMENT_EVIDENCE_ADMIN_QUEUE_LIMIT = 150;

export const PAYMENT_EVIDENCE_SOURCES = Object.freeze({
  CLIENT_PORTAL: 'client_portal',
  ADMIN_MANUAL: 'admin_manual',
});

export const PAYMENT_EVIDENCE_STATUSES = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  ATTACHED: 'attached',
});

export const PAYMENT_EVIDENCE_STATUS_LIST = Object.freeze([
  PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
  PAYMENT_EVIDENCE_STATUSES.VERIFIED,
  PAYMENT_EVIDENCE_STATUSES.REJECTED,
  PAYMENT_EVIDENCE_STATUSES.ATTACHED,
]);

export const PAYMENT_EVIDENCE_UPLOAD_STATES = Object.freeze({
  IDLE: 'idle',
  SELECTED: 'selected',
  VALIDATING: 'validating',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  SAVING_METADATA: 'saving_metadata',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

export const PAYMENT_EVIDENCE_UPLOAD_LIMITS = Object.freeze({
  maxFileSizeBytes: 5 * 1024 * 1024, // 5 MB strict limit for v1
  maxDimensionPx: 6000,
  minDimensionPx: 1,
  allowedMimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  allowedFormats: Object.freeze(['jpg', 'jpeg', 'png', 'webp']),
  forbiddenExtensions: Object.freeze([
    'svg',
    'gif',
    'avif',
    'heic',
    'heif',
    'bmp',
    'tiff',
    'mp4',
    'mov',
    'avi',
    'mkv',
    'webm',
    'pdf',
    'doc',
    'docx',
    'exe',
    'bat',
    'cmd',
    'sh',
    'msi',
    'js',
    'html',
  ]),
});

export const PAYMENT_EVIDENCE_FIELD_LIMITS = Object.freeze({
  referenceMax: 120,
  rejectionReasonMin: 3,
  rejectionReasonMax: 300,
  publicIdMax: 240,
  assetIdMax: 120,
  secureUrlMax: 600,
  cloudNameMax: 120,
});

export const PAYMENT_EVIDENCE_CLOUDINARY_HOSTS = Object.freeze({
  DELIVERY: 'res.cloudinary.com',
  API: 'api.cloudinary.com',
});

export const PAYMENT_EVIDENCE_PRIVACY_NOTICE =
  'Your uploaded payment image is stored on Cloudinary using a public delivery URL. Anyone who obtains the original URL may access the image. Please hide unrelated account numbers, account balances, and sensitive banking information before uploading.';

export const PAYMENT_EVIDENCE_PRIVACY_NOTICE_ID =
  'Gambar bukti pembayaran disimpan di Cloudinary dengan URL publik. Siapa pun yang memiliki tautan asli dapat membuka gambar tersebut. Harap tutupi nomor rekening, saldo, atau informasi perbankan sensitif yang tidak relevan sebelum mengunggah.';

let runtimePaymentEvidenceCloudinaryOverride = null;

export function setPaymentEvidenceCloudinaryConfigOverride(overrideConfig = null) {
  runtimePaymentEvidenceCloudinaryOverride = overrideConfig;
}

export function resetPaymentEvidenceCloudinaryConfigOverride() {
  runtimePaymentEvidenceCloudinaryOverride = null;
}

/**
 * Reads ONLY public unsigned-upload Cloudinary variables for payment evidence:
 * - VITE_CLOUDINARY_CLOUD_NAME
 * - VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET
 *
 * Strictly NEVER falls back to `VITE_CLOUDINARY_UPLOAD_PRESET` (`37gallery`).
 * Never reads or exposes any Cloudinary API Key or API Secret.
 */
export function getPaymentEvidenceCloudinaryConfig(envSource = null) {
  const source =
    envSource ||
    runtimePaymentEvidenceCloudinaryOverride ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

  const rawCloudName =
    typeof source?.VITE_CLOUDINARY_CLOUD_NAME === 'string'
      ? source.VITE_CLOUDINARY_CLOUD_NAME
      : typeof source?.cloudName === 'string'
        ? source.cloudName
        : '';
  const rawUploadPreset =
    typeof source?.VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET === 'string'
      ? source.VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET
      : typeof source?.uploadPreset === 'string'
        ? source.uploadPreset
        : '';

  const cloudName = rawCloudName.trim();
  const uploadPreset = rawUploadPreset.trim();

  const missingKeys = [];
  if (!cloudName) missingKeys.push('VITE_CLOUDINARY_CLOUD_NAME');
  if (!uploadPreset) missingKeys.push('VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET');

  const isConfigured = missingKeys.length === 0;
  const uploadEndpoint = isConfigured
    ? `https://${PAYMENT_EVIDENCE_CLOUDINARY_HOSTS.API}/v1_1/${encodeURIComponent(cloudName)}/image/upload`
    : '';

  const statusMessage = isConfigured
    ? `Cloudinary payment evidence upload ready (${cloudName} / preset: ${uploadPreset}).`
    : `Payment evidence upload is not configured yet. Missing environment variable(s): ${missingKeys.join(', ')}.`;

  return {
    cloudName,
    uploadPreset,
    isConfigured,
    missingKeys,
    uploadEndpoint,
    statusMessage,
  };
}
