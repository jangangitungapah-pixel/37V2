import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';

import {
  PAYMENT_EVIDENCE_CLOUDINARY_HOSTS,
  PAYMENT_EVIDENCE_FIELD_LIMITS,
  PAYMENT_EVIDENCE_SOURCES,
  PAYMENT_EVIDENCE_STATUSES,
} from '../config/payment-evidence-config';

/**
 * Generates a deterministic official payment transaction ID derived from an evidence document ID.
 * Guarantees strict idempotency on Admin verification (`pay_evidence_{evidenceId}`).
 */
export function buildEvidencePaymentId(evidenceId) {
  const clean = String(evidenceId || '').trim();
  return clean ? `pay_evidence_${clean}` : '';
}

/**
 * Generates a random non-identifying ID for Firestore `paymentEvidence` docs or uploaded filenames.
 * Never embeds customer names, phone numbers, emails, or invoice numbers.
 */
export function generatePaymentEvidenceId(prefix = 'ev') {
  const randomUuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${randomUuid.slice(0, 24)}`;
}

/**
 * Validates that a URL is a strict HTTPS Cloudinary image delivery URL.
 * When `expectedCloudName` is provided, also requires `/<expectedCloudName>/image/upload/`.
 */
export function isValidPaymentEvidenceDeliveryUrl(url, expectedCloudName = '') {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > PAYMENT_EVIDENCE_FIELD_LIMITS.secureUrlMax) return false;
  if (/\s/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname !== PAYMENT_EVIDENCE_CLOUDINARY_HOSTS.DELIVERY) return false;

    const cleanCloud = typeof expectedCloudName === 'string' ? expectedCloudName.trim() : '';
    if (cleanCloud) {
      const prefix = `/${cleanCloud}/image/upload/`;
      if (!parsed.pathname.startsWith(prefix)) return false;
      return parsed.pathname.slice(prefix.length).length > 0;
    }

    return /^\/[a-zA-Z0-9_-]+\/image\/upload\/.+$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Builds an optimized Cloudinary thumbnail/preview URL from a validated `secureUrl`.
 * Returns empty string for any unvalidated or non-Cloudinary URL.
 */
export function buildPaymentEvidencePreviewUrl(secureUrl, { width = 720 } = {}) {
  if (!isValidPaymentEvidenceDeliveryUrl(secureUrl)) return '';
  const trimmed = secureUrl.trim();
  const marker = '/image/upload/';
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return trimmed;

  const safeWidth = Number.isInteger(width) && width > 0 ? width : 720;
  const transform = `f_auto,q_auto,c_limit,w_${safeWidth}`;
  const before = trimmed.slice(0, markerIndex + marker.length);
  const after = trimmed.slice(markerIndex + marker.length);

  if (after.startsWith(`${transform}/`)) return trimmed;
  return `${before}${transform}/${after}`;
}

export function formatEvidenceFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  if (num < 1024) return `${Math.round(num)} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

export function normalizeEvidenceImageFormat(rawFormat = '') {
  const clean = String(rawFormat || '')
    .trim()
    .toLowerCase();
  if (clean === 'jpeg') return 'jpg';
  return clean;
}

export function sortPaymentEvidenceRecords(records = []) {
  return [...(Array.isArray(records) ? records : [])].sort((a, b) => {
    const timeB = getTimestampMillis(b?.submittedAt) || getTimestampMillis(b?.createdAt);
    const timeA = getTimestampMillis(a?.submittedAt) || getTimestampMillis(a?.createdAt);
    if (timeB !== timeA) return timeB - timeA;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}

export function getPaymentEvidenceStatusMeta(status, { locale = 'en' } = {}) {
  const isId = locale === 'id';

  switch (status) {
    case PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW:
      return {
        status,
        label: isId ? 'Menunggu Verifikasi' : 'Pending Review',
        shortLabel: isId ? 'Menunggu' : 'Under Review',
        tone: 'amber',
      };
    case PAYMENT_EVIDENCE_STATUSES.VERIFIED:
      return {
        status,
        label: isId ? 'Terverifikasi' : 'Verified',
        shortLabel: isId ? 'Terverifikasi' : 'Verified',
        tone: 'emerald',
      };
    case PAYMENT_EVIDENCE_STATUSES.REJECTED:
      return {
        status,
        label: isId ? 'Ditolak' : 'Rejected',
        shortLabel: isId ? 'Ditolak' : 'Evidence Rejected',
        tone: 'danger',
      };
    case PAYMENT_EVIDENCE_STATUSES.ATTACHED:
      return {
        status,
        label: isId ? 'Lampiran Admin' : 'Studio Attachment',
        shortLabel: isId ? 'Lampiran' : 'Attached',
        tone: 'ivory',
      };
    default:
      return {
        status: String(status || ''),
        label: isId ? 'Tidak Diketahui' : 'Unknown',
        shortLabel: isId ? 'Unknown' : 'Unknown',
        tone: 'neutral',
      };
  }
}

export function getPaymentEvidenceSourceLabel(source, { locale = 'id' } = {}) {
  if (source === PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL) {
    return locale === 'en' ? 'Client Portal Submission' : 'Kiriman Client Portal';
  }
  return locale === 'en' ? 'Studio Admin Attachment' : 'Lampiran Admin Studio';
}

/**
 * Derives a secondary Customer Billing directory indicator (separate from financial status)
 * for invoices requiring Client payment evidence.
 */
export function getClientInvoiceEvidenceIndicator(invoice, invoiceEvidenceList = []) {
  if (!invoice || invoice.invoiceStatus !== 'issued') {
    return null;
  }

  const clientSubmissions = sortPaymentEvidenceRecords(
    (Array.isArray(invoiceEvidenceList) ? invoiceEvidenceList : []).filter(
      (item) => item && item.evidenceSource === PAYMENT_EVIDENCE_SOURCES.CLIENT_PORTAL,
    ),
  );

  const hasPending = clientSubmissions.some(
    (item) => item.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
  );
  if (hasPending) {
    return {
      key: 'under_review',
      label: 'Under Review',
      tone: 'amber',
    };
  }

  if (invoice.balanceDue <= 0) {
    return null;
  }

  const latest = clientSubmissions[0] || null;
  if (latest?.status === PAYMENT_EVIDENCE_STATUSES.REJECTED) {
    return {
      key: 'evidence_rejected',
      label: 'Evidence Rejected',
      tone: 'danger',
    };
  }

  if (invoice.clientPaymentEvidenceRequired) {
    return {
      key: 'evidence_required',
      label: 'Payment Evidence Required',
      tone: 'orange',
    };
  }

  return null;
}
