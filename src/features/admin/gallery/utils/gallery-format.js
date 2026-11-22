import { formatSettingsTimestamp } from '@/features/admin/settings/utils/settings-formatters';

export function formatGalleryFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '0 KB';
  if (num >= 1024 * 1024) {
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(num / 1024))} KB`;
}

export function formatGalleryDimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    return 'Unknown dimensions';
  }
  return `${w} × ${h} px`;
}

export function formatGalleryFormatBadge(format) {
  if (typeof format !== 'string' || !format.trim()) return 'IMAGE';
  const normalized = format.trim().toLowerCase();
  if (normalized === 'jpeg') return 'JPG';
  return normalized.toUpperCase();
}

export function formatGalleryTimestamp(value, fallback = 'Baru saja') {
  return formatSettingsTimestamp(value, fallback);
}

export function deriveTitleFromFilename(filename = '') {
  if (typeof filename !== 'string' || !filename.trim()) {
    return 'Studio Photo';
  }
  const withoutExt = filename.trim().replace(/\.[a-zA-Z0-9]+$/, '');
  const cleaned = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.length < 2) {
    return 'Studio Photo';
  }

  return cleaned.slice(0, 120);
}
