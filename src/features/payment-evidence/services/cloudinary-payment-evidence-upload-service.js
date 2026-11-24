/**
 * Shared Direct Unsigned Cloudinary Upload Service for Payment Evidence v1.
 *
 * Security & Architecture Contract:
 * - Uses ONLY `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET`.
 * - Strictly NEVER falls back to `VITE_CLOUDINARY_UPLOAD_PRESET` (`37gallery`).
 * - Strictly NEVER embeds API Key, API Secret, or signed signatures in browser code.
 * - Sends a random, non-identifying filename (`pe_<random>.<ext>`) so uploaded assets
 *   never embed customer names, phone numbers, or invoice numbers in public IDs.
 * - Accepts 1 image at a time: JPG/JPEG, PNG, WEBP up to 5 MB.
 * - Supports progress reporting, AbortSignal cancellation, and strict response validation.
 */

import {
  getPaymentEvidenceCloudinaryConfig,
  PAYMENT_EVIDENCE_FIELD_LIMITS,
  PAYMENT_EVIDENCE_UPLOAD_LIMITS,
} from '../config/payment-evidence-config';
import {
  formatEvidenceFileSize,
  generatePaymentEvidenceId,
  isValidPaymentEvidenceDeliveryUrl,
  normalizeEvidenceImageFormat,
} from '../utils/payment-evidence-utils';

export function createPaymentEvidenceUploadError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}

function extractFileExtension(filename = '') {
  if (typeof filename !== 'string') return '';
  const parts = filename.trim().toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function getExtensionFromMime(mime = '') {
  const clean = String(mime || '')
    .trim()
    .toLowerCase();
  if (clean === 'image/png') return 'png';
  if (clean === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Probes image dimensions in browser environments via `URL.createObjectURL` + `Image`.
 * Gracefully skips in JSDOM/non-browser environments unless explicit `file.width` / `file.height` are attached.
 */
export async function probePaymentEvidenceDimensions(file) {
  if (
    Number.isInteger(file?.width) &&
    Number.isInteger(file?.height) &&
    file.width > 0 &&
    file.height > 0
  ) {
    return { width: file.width, height: file.height };
  }

  if (
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null;
  }

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      const width = Number(img.naturalWidth || img.width);
      const height = Number(img.naturalHeight || img.height);
      cleanup();
      resolve({ width, height });
    };

    img.onerror = () => {
      cleanup();
      reject(
        createPaymentEvidenceUploadError(
          'payment-evidence/corrupt-image',
          'The selected image could not be read. Please choose a valid JPG, PNG, or WEBP screenshot or photo.',
        ),
      );
    };

    img.src = objectUrl;
  });
}

/**
 * Client-side usability & safety validation before initiating an unsigned Cloudinary upload.
 * Limits: 1 image, max 5 MB, JPEG / PNG / WEBP only.
 */
export async function validatePaymentEvidenceFile(
  file,
  { dimensionProber = probePaymentEvidenceDimensions } = {},
) {
  if (!file || typeof file !== 'object') {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/missing-file',
      'Please select a payment proof image (JPG, PNG, or WEBP).',
    );
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/empty-file',
      'The selected file is empty (0 bytes). Please choose a valid payment screenshot or photo.',
    );
  }

  if (size > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxFileSizeBytes) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/file-too-large',
      `File size (${formatEvidenceFileSize(size)}) exceeds the 5 MB maximum limit. Please compress or crop your screenshot and try again.`,
    );
  }

  const ext = extractFileExtension(file.name || '');
  const mime = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';

  if (
    PAYMENT_EVIDENCE_UPLOAD_LIMITS.forbiddenExtensions.includes(ext) ||
    mime === 'image/svg+xml' ||
    mime === 'image/gif' ||
    mime === 'image/avif' ||
    mime.startsWith('video/') ||
    mime === 'application/pdf'
  ) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/unsupported-format',
      `Unsupported file format (${ext || mime || 'unknown'}). Only JPG, JPEG, PNG, and WEBP images are accepted.`,
    );
  }

  const hasValidMime = PAYMENT_EVIDENCE_UPLOAD_LIMITS.allowedMimeTypes.includes(mime);
  const hasValidExt = PAYMENT_EVIDENCE_UPLOAD_LIMITS.allowedFormats.includes(ext);

  if (!hasValidMime || (ext && !hasValidExt)) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/unsupported-format',
      'Unsupported file format. Please upload a JPG, JPEG, PNG, or WEBP image.',
    );
  }

  const probed = await dimensionProber(file);
  if (probed) {
    const { width, height } = probed;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < PAYMENT_EVIDENCE_UPLOAD_LIMITS.minDimensionPx ||
      height < PAYMENT_EVIDENCE_UPLOAD_LIMITS.minDimensionPx
    ) {
      throw createPaymentEvidenceUploadError(
        'payment-evidence/invalid-dimensions',
        'Image dimensions are invalid. Please select another screenshot or photo.',
      );
    }

    if (
      width > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx ||
      height > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx
    ) {
      throw createPaymentEvidenceUploadError(
        'payment-evidence/dimensions-too-large',
        `Image dimensions (${width} × ${height} px) exceed the maximum allowed size (6000 × 6000 px).`,
      );
    }
  }

  return {
    valid: true,
    probedDimensions: probed,
  };
}

/**
 * Strictly validates Cloudinary's JSON upload response before storing metadata in Firestore.
 * Returns the canonical nested `evidence` map contract.
 */
export function validatePaymentEvidenceCloudinaryResponse(
  payload,
  { expectedCloudName = '' } = {},
) {
  if (!payload || typeof payload !== 'object') {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/malformed-response',
      'Upload response from Cloudinary was empty or invalid.',
    );
  }

  const cleanExpectedCloud = String(expectedCloudName || '').trim();
  const publicId = typeof payload.public_id === 'string' ? payload.public_id.trim() : '';
  const assetId = typeof payload.asset_id === 'string' ? payload.asset_id.trim() : '';
  const secureUrl = typeof payload.secure_url === 'string' ? payload.secure_url.trim() : '';
  const resourceType =
    typeof payload.resource_type === 'string' ? payload.resource_type.trim() : '';
  const rawFormat = typeof payload.format === 'string' ? payload.format.trim().toLowerCase() : '';
  const width = Number(payload.width);
  const height = Number(payload.height);
  const bytes = Number(payload.bytes);

  if (!publicId || publicId.length > PAYMENT_EVIDENCE_FIELD_LIMITS.publicIdMax) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-public-id',
      'Upload response is missing a valid Cloudinary public ID.',
    );
  }

  if (!assetId || assetId.length > PAYMENT_EVIDENCE_FIELD_LIMITS.assetIdMax) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-asset-id',
      'Upload response is missing a valid Cloudinary asset ID.',
    );
  }

  if (resourceType !== 'image') {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-resource-type',
      `Uploaded file must be an image resource, but received "${resourceType || 'unknown'}".`,
    );
  }

  if (!PAYMENT_EVIDENCE_UPLOAD_LIMITS.allowedFormats.includes(rawFormat)) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-response-format',
      `Uploaded image format "${rawFormat || 'unknown'}" is not allowed (JPG, PNG, WEBP only).`,
    );
  }

  if (!isValidPaymentEvidenceDeliveryUrl(secureUrl, cleanExpectedCloud)) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-secure-url',
      'Cloudinary returned an invalid delivery URL or mismatched cloud name.',
    );
  }

  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    width > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx ||
    !Number.isInteger(height) ||
    height <= 0 ||
    height > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx
  ) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-response-dimensions',
      'Cloudinary returned invalid image dimensions.',
    );
  }

  if (
    !Number.isInteger(bytes) ||
    bytes <= 0 ||
    bytes > PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxFileSizeBytes
  ) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-response-bytes',
      'Uploaded image exceeds the 5 MB limit or reported invalid byte size.',
    );
  }

  const parsedCloudName =
    cleanExpectedCloud ||
    (() => {
      try {
        return new URL(secureUrl).pathname.split('/').filter(Boolean)[0] || '';
      } catch {
        return '';
      }
    })();

  if (!parsedCloudName || parsedCloudName.length > PAYMENT_EVIDENCE_FIELD_LIMITS.cloudNameMax) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/invalid-cloud-name',
      'Unable to verify Cloudinary cloud name from upload response.',
    );
  }

  return {
    provider: 'cloudinary',
    cloudName: parsedCloudName,
    cloudinaryPublicId: publicId,
    cloudinaryAssetId: assetId,
    secureUrl,
    resourceType: 'image',
    format: normalizeEvidenceImageFormat(rawFormat),
    width,
    height,
    bytes,
  };
}

export function mapPaymentEvidenceCloudinaryError(
  error,
  { uploadPreset = '37payment-evidence' } = {},
) {
  if (error?.name === 'AbortError' || error?.code === 'payment-evidence/upload-aborted') {
    return 'Upload was cancelled.';
  }

  if (error?.code && String(error.code).startsWith('payment-evidence/')) {
    return error.message;
  }

  const rawMsg = String(error?.message || '').trim();
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('whitelisted for unsigned') ||
    lower.includes('unsigned') ||
    lower.includes('must be signed')
  ) {
    return `Cloudinary upload preset "${uploadPreset}" must be configured as an Unsigned preset in Cloudinary Console.`;
  }

  if (lower.includes('preset') && lower.includes('not found')) {
    return `Cloudinary upload preset "${uploadPreset}" was not found. Please contact the studio administrator to finish Cloudinary setup.`;
  }

  if (lower.includes('file size too large') || lower.includes('too large')) {
    return 'Image file size was rejected by Cloudinary (maximum 5 MB). Please choose a smaller image.';
  }

  if (lower.includes('abort') || lower.includes('cancel')) {
    return 'Upload was cancelled.';
  }

  return rawMsg || 'Unable to upload payment proof right now. Please check your internet connection and try again.';
}

/**
 * Default upload transport using XHR (when available in browser for real upload progress)
 * with fallback to native `fetch`. Sends ONLY `file` (with a random non-identifying filename)
 * and `upload_preset` — zero API Key, zero API Secret, zero signature.
 */
async function defaultPaymentEvidenceUploadTransport({
  endpoint,
  formData,
  signal,
  onProgress,
  uploadPreset,
}) {
  if (signal?.aborted) {
    throw createPaymentEvidenceUploadError('payment-evidence/upload-aborted', 'Upload was cancelled.');
  }

  const canUseXhr =
    typeof XMLHttpRequest !== 'undefined' &&
    !(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''));

  if (canUseXhr) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);

      const handleAbort = () => {
        xhr.abort();
      };

      if (signal) {
        signal.addEventListener('abort', handleAbort, { once: true });
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.min(95, Math.max(5, Math.round((event.loaded / event.total) * 100)));
          onProgress?.(pct);
        }
      };

      xhr.onabort = () => {
        if (signal) signal.removeEventListener('abort', handleAbort);
        reject(
          createPaymentEvidenceUploadError('payment-evidence/upload-aborted', 'Upload was cancelled.'),
        );
      };

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', handleAbort);
        reject(
          createPaymentEvidenceUploadError(
            'payment-evidence/network-error',
            'Network error while uploading image to Cloudinary. Please check your connection and try again.',
          ),
        );
      };

      xhr.onload = () => {
        if (signal) signal.removeEventListener('abort', handleAbort);
        let json;
        try {
          json = JSON.parse(xhr.responseText || '{}');
        } catch {
          reject(
            createPaymentEvidenceUploadError(
              'payment-evidence/network-parse-error',
              `Could not read Cloudinary response (HTTP ${xhr.status}).`,
            ),
          );
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          const apiMessage =
            json?.error?.message || `Cloudinary rejected the upload (HTTP ${xhr.status}).`;
          reject(
            createPaymentEvidenceUploadError(
              'payment-evidence/cloudinary-http-error',
              mapPaymentEvidenceCloudinaryError({ message: apiMessage }, { uploadPreset }),
              { status: xhr.status, cloudinaryError: apiMessage },
            ),
          );
          return;
        }

        onProgress?.(100);
        resolve(json);
      };

      onProgress?.(10);
      xhr.send(formData);
    });
  }

  // Fallback for fetch / test environments
  onProgress?.(15);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      throw createPaymentEvidenceUploadError(
        'payment-evidence/upload-aborted',
        'Upload was cancelled.',
      );
    }
    throw createPaymentEvidenceUploadError(
      'payment-evidence/network-error',
      'Network error while uploading image to Cloudinary. Please check your connection and try again.',
    );
  }

  onProgress?.(85);
  let json;
  try {
    json = await response.json();
  } catch {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/network-parse-error',
      `Could not read Cloudinary response (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    const apiMessage =
      json?.error?.message || `Cloudinary rejected the upload (HTTP ${response.status}).`;
    throw createPaymentEvidenceUploadError(
      'payment-evidence/cloudinary-http-error',
      mapPaymentEvidenceCloudinaryError({ message: apiMessage }, { uploadPreset }),
      { status: response.status, cloudinaryError: apiMessage },
    );
  }

  onProgress?.(100);
  return json;
}

let activePaymentEvidenceUploadTransport = defaultPaymentEvidenceUploadTransport;

export function setPaymentEvidenceUploadTransport(customTransport) {
  activePaymentEvidenceUploadTransport = customTransport || defaultPaymentEvidenceUploadTransport;
}

export function resetPaymentEvidenceUploadTransport() {
  activePaymentEvidenceUploadTransport = defaultPaymentEvidenceUploadTransport;
}

/**
 * Validates and uploads one payment-evidence image directly to Cloudinary using the
 * dedicated unsigned payment preset (`VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET`).
 */
export async function uploadPaymentEvidenceImage({
  file,
  config = null,
  onProgress = null,
  signal = null,
  transport = null,
  dimensionProber = probePaymentEvidenceDimensions,
}) {
  const resolvedConfig = config || getPaymentEvidenceCloudinaryConfig();
  if (!resolvedConfig.isConfigured) {
    throw createPaymentEvidenceUploadError(
      'payment-evidence/cloudinary-unconfigured',
      resolvedConfig.statusMessage,
      { missingKeys: resolvedConfig.missingKeys },
    );
  }

  await validatePaymentEvidenceFile(file, { dimensionProber });

  // Rename uploaded form field to a random non-identifying filename so customer PII or
  // invoice numbers never enter Cloudinary filenames or auto-generated public IDs.
  const ext = getExtensionFromMime(file.type);
  const safeRandomFilename = `${generatePaymentEvidenceId('pe')}.${ext}`;

  const formData = new FormData();
  formData.append('file', file, safeRandomFilename);
  formData.append('upload_preset', resolvedConfig.uploadPreset);

  const runTransport = transport || activePaymentEvidenceUploadTransport;
  const rawResponse = await runTransport({
    endpoint: resolvedConfig.uploadEndpoint,
    formData,
    signal,
    onProgress,
    uploadPreset: resolvedConfig.uploadPreset,
  });

  return validatePaymentEvidenceCloudinaryResponse(rawResponse, {
    expectedCloudName: resolvedConfig.cloudName,
  });
}
