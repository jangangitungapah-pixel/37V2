import { z } from 'zod';

import {
  getJakartaTodayIso,
  isValidIsoDateString,
} from '@/features/admin/calendar/utils/calendar-date';
import { SUPPORTED_PAYMENT_METHODS } from '@/features/admin/payment/utils/invoice-status';
import { toNonNegativeRupiahInt } from '@/features/admin/payment/utils/payment-calculation';

import {
  PAYMENT_EVIDENCE_FIELD_LIMITS,
  PAYMENT_EVIDENCE_SCHEMA_VERSION,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
  PAYMENT_EVIDENCE_STATUS_LIST,
  PAYMENT_EVIDENCE_UPLOAD_LIMITS,
} from '../config/payment-evidence-config';
import {
  isValidPaymentEvidenceDeliveryUrl,
  normalizeEvidenceImageFormat,
} from '../utils/payment-evidence-utils';

export const paymentEvidenceAssetSchema = z.object({
  provider: z.literal('cloudinary'),
  cloudName: z.string().trim().min(1).max(PAYMENT_EVIDENCE_FIELD_LIMITS.cloudNameMax),
  cloudinaryPublicId: z.string().trim().min(1).max(PAYMENT_EVIDENCE_FIELD_LIMITS.publicIdMax),
  cloudinaryAssetId: z.string().trim().min(1).max(PAYMENT_EVIDENCE_FIELD_LIMITS.assetIdMax),
  secureUrl: z
    .string()
    .trim()
    .min(1)
    .max(PAYMENT_EVIDENCE_FIELD_LIMITS.secureUrlMax)
    .refine((val) => isValidPaymentEvidenceDeliveryUrl(val), {
      message: 'Evidence URL must be a valid HTTPS Cloudinary delivery URL.',
    }),
  resourceType: z.literal('image'),
  format: z.enum(['jpg', 'jpeg', 'png', 'webp']),
  width: z.number().int().min(1).max(PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx),
  height: z.number().int().min(1).max(PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxDimensionPx),
  bytes: z.number().int().min(1).max(PAYMENT_EVIDENCE_UPLOAD_LIMITS.maxFileSizeBytes),
});

export const clientEvidenceSubmissionInputSchema = z.object({
  claimedAmount: z
    .number({ invalid_type_error: 'Please enter a valid payment amount in IDR.' })
    .int('Payment amount must be a whole Rupiah integer.')
    .positive('Payment amount must be greater than Rp 0.'),
  paymentMethod: z.enum(SUPPORTED_PAYMENT_METHODS, {
    message: 'Please select a valid payment method.',
  }),
  claimedPaidAt: z
    .string()
    .trim()
    .refine((val) => isValidIsoDateString(val), {
      message: 'Please select a valid payment date.',
    }),
  referenceNumber: z
    .string()
    .trim()
    .max(
      PAYMENT_EVIDENCE_FIELD_LIMITS.referenceMax,
      `Reference number must be at most ${PAYMENT_EVIDENCE_FIELD_LIMITS.referenceMax} characters.`,
    )
    .optional()
    .default(''),
});

export const verifyEvidenceInputSchema = z.object({
  verifiedAmount: z
    .number({ invalid_type_error: 'Nominal terverifikasi harus berupa angka Rupiah.' })
    .int('Nominal terverifikasi harus berupa bilangan bulat Rupiah.')
    .positive('Nominal terverifikasi harus lebih besar dari Rp 0.'),
});

export const rejectEvidenceInputSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(
      PAYMENT_EVIDENCE_FIELD_LIMITS.rejectionReasonMin,
      `Alasan penolakan minimal ${PAYMENT_EVIDENCE_FIELD_LIMITS.rejectionReasonMin} karakter.`,
    )
    .max(
      PAYMENT_EVIDENCE_FIELD_LIMITS.rejectionReasonMax,
      `Alasan penolakan maksimal ${PAYMENT_EVIDENCE_FIELD_LIMITS.rejectionReasonMax} karakter.`,
    ),
});

export function validateClientEvidenceSubmissionInput(input = {}, maxBalanceDue = null) {
  const numericAmount = Number(input.claimedAmount);
  const parsed = clientEvidenceSubmissionInputSchema.safeParse({
    claimedAmount: Number.isFinite(numericAmount) ? numericAmount : NaN,
    paymentMethod: String(input.paymentMethod || '').trim(),
    claimedPaidAt: String(input.claimedPaidAt || '').trim() || getJakartaTodayIso(),
    referenceNumber: String(input.referenceNumber ?? '').trim(),
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  if (
    maxBalanceDue !== null &&
    Number.isFinite(Number(maxBalanceDue)) &&
    parsed.data.claimedAmount > Number(maxBalanceDue)
  ) {
    return {
      isValid: false,
      errors: {
        claimedAmount: 'Payment amount cannot exceed the current remaining balance.',
      },
      data: null,
    };
  }

  return {
    isValid: true,
    errors: {},
    data: parsed.data,
  };
}

export function validateVerifyEvidenceInput(input = {}, maxBalanceDue = null) {
  const numericAmount = Number(input.verifiedAmount);
  const parsed = verifyEvidenceInputSchema.safeParse({
    verifiedAmount: Number.isFinite(numericAmount) ? numericAmount : NaN,
  });

  if (!parsed.success) {
    const errors = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || 'verifiedAmount');
      if (!errors[key]) errors[key] = issue.message;
    }
    return { isValid: false, errors, data: null };
  }

  if (
    maxBalanceDue !== null &&
    Number.isFinite(Number(maxBalanceDue)) &&
    parsed.data.verifiedAmount > Number(maxBalanceDue)
  ) {
    return {
      isValid: false,
      errors: {
        verifiedAmount: 'Nominal terverifikasi tidak boleh melebihi sisa tagihan invoice saat ini.',
      },
      data: null,
    };
  }

  return {
    isValid: true,
    errors: {},
    data: parsed.data,
  };
}

export function validateRejectEvidenceInput(input = {}) {
  const parsed = rejectEvidenceInputSchema.safeParse({
    rejectionReason: String(input.rejectionReason ?? ''),
  });

  if (!parsed.success) {
    return {
      isValid: false,
      errors: {
        rejectionReason: parsed.error.issues[0]?.message || 'Alasan penolakan wajib diisi.',
      },
      data: null,
    };
  }

  return {
    isValid: true,
    errors: {},
    data: parsed.data,
  };
}

export function validatePaymentEvidenceAsset(asset, expectedCloudName = '') {
  if (!asset || typeof asset !== 'object') {
    return { isValid: false, error: 'Payment proof image metadata is required.', data: null };
  }

  const parsed = paymentEvidenceAssetSchema.safeParse({
    provider: asset.provider || 'cloudinary',
    cloudName: String(asset.cloudName || '').trim(),
    cloudinaryPublicId: String(asset.cloudinaryPublicId || '').trim(),
    cloudinaryAssetId: String(asset.cloudinaryAssetId || '').trim(),
    secureUrl: String(asset.secureUrl || '').trim(),
    resourceType: asset.resourceType || 'image',
    format: normalizeEvidenceImageFormat(asset.format),
    width: Number(asset.width),
    height: Number(asset.height),
    bytes: Number(asset.bytes),
  });

  if (!parsed.success) {
    return {
      isValid: false,
      error: parsed.error.issues[0]?.message || 'Uploaded image metadata is invalid.',
      data: null,
    };
  }

  const cleanCloud = String(expectedCloudName || '').trim();
  if (
    cleanCloud &&
    (parsed.data.cloudName !== cleanCloud ||
      !isValidPaymentEvidenceDeliveryUrl(parsed.data.secureUrl, cleanCloud))
  ) {
    return {
      isValid: false,
      error: 'Uploaded image URL does not match the configured studio Cloudinary cloud.',
      data: null,
    };
  }

  return {
    isValid: true,
    error: '',
    data: {
      ...parsed.data,
      format: normalizeEvidenceImageFormat(parsed.data.format),
    },
  };
}

export function normalizePaymentEvidenceAsset(raw = null) {
  if (!raw || typeof raw !== 'object') {
    return {
      provider: 'cloudinary',
      cloudName: '',
      cloudinaryPublicId: '',
      cloudinaryAssetId: '',
      secureUrl: '',
      resourceType: 'image',
      format: 'jpg',
      width: 0,
      height: 0,
      bytes: 0,
    };
  }

  const secureUrl = String(raw.secureUrl || '').trim();
  return {
    provider: 'cloudinary',
    cloudName: String(raw.cloudName || '').trim(),
    cloudinaryPublicId: String(raw.cloudinaryPublicId || '').trim(),
    cloudinaryAssetId: String(raw.cloudinaryAssetId || '').trim(),
    secureUrl: isValidPaymentEvidenceDeliveryUrl(secureUrl) ? secureUrl : '',
    resourceType: 'image',
    format: normalizeEvidenceImageFormat(raw.format || 'jpg'),
    width: Math.max(0, Math.round(Number(raw.width) || 0)),
    height: Math.max(0, Math.round(Number(raw.height) || 0)),
    bytes: Math.max(0, Math.round(Number(raw.bytes) || 0)),
  };
}

/**
 * Normalizes a raw Firestore `paymentEvidence/{evidenceId}` document into a safe domain record.
 */
export function normalizePaymentEvidenceRecord(id, data = {}) {
  const cleanId = String(id || data?.id || '').trim();
  if (!cleanId) return null;

  const evidenceSource = Object.values(PAYMENT_EVIDENCE_SOURCES).includes(data.evidenceSource)
    ? data.evidenceSource
    : PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL;

  const status = PAYMENT_EVIDENCE_STATUS_LIST.includes(data.status)
    ? data.status
    : PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW;

  const paymentMethod = SUPPORTED_PAYMENT_METHODS.includes(data.paymentMethod)
    ? data.paymentMethod
    : 'transfer';

  const claimedPaidAt =
    typeof data.claimedPaidAt === 'string' && isValidIsoDateString(data.claimedPaidAt)
      ? data.claimedPaidAt.trim()
      : '';

  return {
    id: cleanId,
    schemaVersion: Number(data.schemaVersion) || PAYMENT_EVIDENCE_SCHEMA_VERSION,
    invoiceId: String(data.invoiceId || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    bookingId: String(data.bookingId || '').trim(),
    customerId: String(data.customerId || '').trim(),
    clientUid: String(data.clientUid || '').trim(),
    evidenceSource,
    status,
    claimedAmount: toNonNegativeRupiahInt(data.claimedAmount),
    paymentMethod,
    claimedPaidAt,
    referenceNumber: String(data.referenceNumber || '').trim(),
    evidence: normalizePaymentEvidenceAsset(data.evidence),
    submittedByUid: String(data.submittedByUid || '').trim(),
    submittedAt: data.submittedAt ?? data.createdAt ?? null,
    reviewedAt: data.reviewedAt ?? null,
    reviewedByUid: String(data.reviewedByUid || '').trim(),
    rejectionReason: String(data.rejectionReason || '').trim(),
    verifiedAmount:
      data.verifiedAmount === null || data.verifiedAmount === undefined
        ? null
        : toNonNegativeRupiahInt(data.verifiedAmount),
    linkedTransactionId: data.linkedTransactionId
      ? String(data.linkedTransactionId).trim()
      : null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    version:
      Number.isInteger(Number(data.version)) && Number(data.version) >= 1
        ? Number(data.version)
        : 1,
  };
}

/**
 * Customer-safe allow-list projection for `paymentEvidence` inside Client Portal.
 * Strips internal UIDs (`customerId`, `clientUid`, `submittedByUid`, `reviewedByUid`),
 * internal `linkedTransactionId`, and unvalidated external URLs.
 */
export function projectClientPaymentEvidenceRecord(idOrRecord, maybeRawData = undefined) {
  const normalized =
    maybeRawData !== undefined
      ? normalizePaymentEvidenceRecord(idOrRecord, maybeRawData)
      : idOrRecord && typeof idOrRecord === 'object'
        ? normalizePaymentEvidenceRecord(idOrRecord.id, idOrRecord)
        : null;

  if (!normalized || !normalized.id) return null;

  return {
    id: normalized.id,
    invoiceId: normalized.invoiceId,
    invoiceNumber: normalized.invoiceNumber,
    evidenceSource: normalized.evidenceSource,
    status: normalized.status,
    claimedAmount: normalized.claimedAmount,
    paymentMethod: normalized.paymentMethod,
    claimedPaidAt: normalized.claimedPaidAt,
    referenceNumber: normalized.referenceNumber,
    evidence: {
      secureUrl: normalized.evidence.secureUrl,
      format: normalized.evidence.format,
      width: normalized.evidence.width,
      height: normalized.evidence.height,
      bytes: normalized.evidence.bytes,
    },
    submittedAt: normalized.submittedAt,
    reviewedAt: normalized.reviewedAt,
    rejectionReason: normalized.rejectionReason,
    verifiedAmount: normalized.verifiedAmount,
  };
}
