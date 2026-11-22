import {
  GALLERY_FIELD_LIMITS,
  GALLERY_UPLOAD_LIMITS,
  getCloudinaryConfig,
} from '../config/gallery-config';
import { isValidCloudinaryDeliveryUrl } from '../utils/cloudinary-url';
import { formatGalleryFileSize } from '../utils/gallery-format';
import { normalizeGalleryFormat } from '../utils/gallery-normalize';

export function createCloudinaryUploadError(code, message, details = null) {
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

/**
 * Probes browser-readable image dimensions (`width` and `height`) when running in a browser
 * with `URL.createObjectURL` and `Image`. Falls back gracefully in non-browser unit test environments
 * if explicit `file.width` / `file.height` properties are provided or decoding is not supported.
 */
export async function probeImageFileDimensions(file) {
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

  // In JSDOM, Image onload does not fire for Blob URLs; detect JSDOM via navigator.userAgent
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
        createCloudinaryUploadError(
          'gallery/corrupt-image',
          'File gambar tidak dapat dibaca oleh browser. Pastikan file gambar valid dan tidak rusak.',
        ),
      );
    };

    img.src = objectUrl;
  });
}

/**
 * Client-side usability & format validation before initiating an unsigned Cloudinary upload.
 * Note: Client-side file size and dimension checks are usability safeguards, not server boundaries.
 */
export async function validateGalleryUploadFile(
  file,
  { dimensionProber = probeImageFileDimensions } = {},
) {
  if (!file || typeof file !== 'object') {
    throw createCloudinaryUploadError('gallery/missing-file', 'Pilih file foto terlebih dahulu.');
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw createCloudinaryUploadError(
      'gallery/empty-file',
      `File "${file.name || 'foto'}" berukuran 0 byte (kosong).`,
    );
  }

  if (size > GALLERY_UPLOAD_LIMITS.maxFileSizeBytes) {
    throw createCloudinaryUploadError(
      'gallery/file-too-large',
      `Ukuran file "${file.name || 'foto'}" (${formatGalleryFileSize(size)}) melebihi batas maksimal 10 MB.`,
    );
  }

  const ext = extractFileExtension(file.name || '');
  const mime = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';

  if (
    GALLERY_UPLOAD_LIMITS.forbiddenExtensions.includes(ext) ||
    mime === 'image/svg+xml' ||
    mime === 'image/gif' ||
    mime.startsWith('video/') ||
    mime === 'application/pdf'
  ) {
    throw createCloudinaryUploadError(
      'gallery/unsupported-format',
      `Format file "${file.name || ext || mime}" tidak didukung. Gunakan foto berformat JPG, JPEG, PNG, WEBP, atau AVIF.`,
    );
  }

  const hasValidMime = GALLERY_UPLOAD_LIMITS.allowedMimeTypes.includes(mime);
  const hasValidExt = GALLERY_UPLOAD_LIMITS.allowedFormats.includes(ext);

  if (!hasValidMime || (ext && !hasValidExt)) {
    throw createCloudinaryUploadError(
      'gallery/unsupported-format',
      `Format file "${file.name || 'foto'}" tidak diizinkan. Hanya JPG, JPEG, PNG, WEBP, dan AVIF yang didukung.`,
    );
  }

  const probed = await dimensionProber(file);
  if (probed) {
    const { width, height } = probed;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < GALLERY_UPLOAD_LIMITS.minDimensionPx ||
      height < GALLERY_UPLOAD_LIMITS.minDimensionPx
    ) {
      throw createCloudinaryUploadError(
        'gallery/invalid-dimensions',
        `Dimensi foto "${file.name || 'foto'}" tidak valid.`,
      );
    }

    if (
      width > GALLERY_UPLOAD_LIMITS.maxDimensionPx ||
      height > GALLERY_UPLOAD_LIMITS.maxDimensionPx
    ) {
      throw createCloudinaryUploadError(
        'gallery/dimensions-too-large',
        `Dimensi foto "${file.name || 'foto'}" (${width} × ${height} px) melebihi batas maksimal 6000 × 6000 piksel.`,
      );
    }
  }

  return {
    valid: true,
    probedDimensions: probed,
  };
}

/**
 * Strictly validates the JSON response returned by Cloudinary before persisting metadata to Firestore.
 */
export function validateCloudinaryUploadResponse(payload, { expectedCloudName = '' } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw createCloudinaryUploadError(
      'gallery/malformed-response',
      'Respons dari Cloudinary kosong atau tidak berformat JSON yang valid.',
    );
  }

  const publicId = typeof payload.public_id === 'string' ? payload.public_id.trim() : '';
  const assetId = typeof payload.asset_id === 'string' ? payload.asset_id.trim() : '';
  const secureUrl = typeof payload.secure_url === 'string' ? payload.secure_url.trim() : '';
  const resourceType =
    typeof payload.resource_type === 'string' ? payload.resource_type.trim() : '';
  const rawFormat = typeof payload.format === 'string' ? payload.format.trim().toLowerCase() : '';
  const width = Number(payload.width);
  const height = Number(payload.height);
  const bytes = Number(payload.bytes);

  if (!publicId || publicId.length > GALLERY_FIELD_LIMITS.publicIdMax) {
    throw createCloudinaryUploadError(
      'gallery/invalid-public-id',
      'Respons Cloudinary tidak memiliki public_id yang valid.',
    );
  }

  if (!assetId || assetId.length > GALLERY_FIELD_LIMITS.assetIdMax) {
    throw createCloudinaryUploadError(
      'gallery/invalid-asset-id',
      'Respons Cloudinary tidak memiliki asset_id yang valid.',
    );
  }

  if (resourceType !== 'image') {
    throw createCloudinaryUploadError(
      'gallery/invalid-resource-type',
      `Tipe resource Cloudinary harus "image", tetapi diterima "${resourceType || 'unknown'}".`,
    );
  }

  if (!GALLERY_UPLOAD_LIMITS.allowedFormats.includes(rawFormat)) {
    throw createCloudinaryUploadError(
      'gallery/invalid-response-format',
      `Format hasil unggahan Cloudinary ("${rawFormat || 'unknown'}") tidak termasuk daftar yang diizinkan.`,
    );
  }

  if (!isValidCloudinaryDeliveryUrl(secureUrl, expectedCloudName)) {
    throw createCloudinaryUploadError(
      'gallery/invalid-secure-url',
      'URL pengiriman Cloudinary tidak valid (wajib HTTPS pada host res.cloudinary.com dengan cloud name yang sesuai).',
    );
  }

  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    width > GALLERY_UPLOAD_LIMITS.maxDimensionPx ||
    !Number.isInteger(height) ||
    height <= 0 ||
    height > GALLERY_UPLOAD_LIMITS.maxDimensionPx
  ) {
    throw createCloudinaryUploadError(
      'gallery/invalid-response-dimensions',
      'Dimensi gambar dari respons Cloudinary tidak valid atau melebihi batas 6000 piksel.',
    );
  }

  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > GALLERY_UPLOAD_LIMITS.maxFileSizeBytes) {
    throw createCloudinaryUploadError(
      'gallery/invalid-response-bytes',
      'Ukuran byte gambar dari respons Cloudinary tidak valid.',
    );
  }

  return {
    cloudinaryPublicId: publicId,
    cloudinaryAssetId: assetId,
    secureUrl,
    resourceType: 'image',
    format: normalizeGalleryFormat(rawFormat),
    width,
    height,
    bytes,
  };
}

export function mapCloudinaryErrorToMessage(error, { uploadPreset = '37gallery' } = {}) {
  if (error?.code && String(error.code).startsWith('gallery/')) {
    return error.message;
  }

  const rawMsg = String(error?.message || '').trim();
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('whitelisted for unsigned') ||
    lower.includes('unsigned') ||
    lower.includes('must be signed')
  ) {
    return `Upload preset "${uploadPreset}" pada Cloudinary terdeteksi sebagai Signed Preset. Buka Cloudinary Console -> Settings -> Upload -> Upload Presets, lalu ubah Signing Mode preset "${uploadPreset}" menjadi "Unsigned".`;
  }

  if (lower.includes('preset') && lower.includes('not found')) {
    return `Upload preset "${uploadPreset}" tidak ditemukan di akun Cloudinary. Pastikan preset unsigned "${uploadPreset}" telah dibuat.`;
  }

  if (lower.includes('file size too large') || lower.includes('too large')) {
    return 'Ukuran foto ditolak oleh Cloudinary karena terlalu besar. Gunakan foto maksimal 10 MB.';
  }

  if (lower.includes('abort') || lower.includes('cancelled') || lower.includes('canceled')) {
    return 'Unggahan foto dibatalkan.';
  }

  return rawMsg || 'Gagal mengunggah foto ke Cloudinary. Periksa koneksi internet dan coba lagi.';
}

/**
 * Default browser transport using native `fetch` (or XHR if progress events are supported).
 * Sends ONLY `file` and `upload_preset` in an unsigned FormData POST request.
 */
async function defaultFetchUploadTransport({ endpoint, formData, signal, onProgress }) {
  onProgress?.(15);
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    signal,
  });

  onProgress?.(85);
  let json;
  try {
    json = await response.json();
  } catch {
    throw createCloudinaryUploadError(
      'gallery/network-parse-error',
      `Gagal membaca respons Cloudinary (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    const apiMessage =
      json?.error?.message || `Cloudinary menolak unggahan (HTTP ${response.status}).`;
    throw createCloudinaryUploadError(
      'gallery/cloudinary-http-error',
      mapCloudinaryErrorToMessage({ message: apiMessage }),
      { status: response.status, cloudinaryError: apiMessage },
    );
  }

  onProgress?.(100);
  return json;
}

let activeUploadTransport = defaultFetchUploadTransport;

export function setCloudinaryUploadTransport(customTransport) {
  activeUploadTransport = customTransport || defaultFetchUploadTransport;
}

export function resetCloudinaryUploadTransport() {
  activeUploadTransport = defaultFetchUploadTransport;
}

/**
 * Performs a direct unsigned upload to Cloudinary and validates the returned asset metadata.
 * Never includes any API Key, API Secret, or signature.
 */
export async function uploadImageToCloudinary({
  file,
  config = null,
  onProgress = null,
  signal = null,
  transport = null,
  dimensionProber = probeImageFileDimensions,
}) {
  const resolvedConfig = config || getCloudinaryConfig();
  if (!resolvedConfig.isConfigured) {
    throw createCloudinaryUploadError(
      'gallery/cloudinary-unconfigured',
      resolvedConfig.statusMessage,
      { missingKeys: resolvedConfig.missingKeys },
    );
  }

  await validateGalleryUploadFile(file, { dimensionProber });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', resolvedConfig.uploadPreset);

  const runTransport = transport || activeUploadTransport;
  const rawResponse = await runTransport({
    endpoint: resolvedConfig.uploadEndpoint,
    formData,
    signal,
    onProgress,
  });

  return validateCloudinaryUploadResponse(rawResponse, {
    expectedCloudName: resolvedConfig.cloudName,
  });
}
