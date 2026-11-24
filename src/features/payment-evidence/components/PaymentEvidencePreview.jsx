import { ExternalLink, Image as ImageIcon, ShieldAlert } from 'lucide-react';

import {
  buildPaymentEvidencePreviewUrl,
  formatEvidenceFileSize,
  isValidPaymentEvidenceDeliveryUrl,
} from '../utils/payment-evidence-utils';

/**
 * Validated Cloudinary payment-evidence image preview & safe external link.
 * Strictly refuses to render unvalidated or non-Cloudinary URLs.
 */
export function PaymentEvidencePreview({
  evidence,
  size = 'md',
  locale = 'en',
  showMeta = true,
  className = '',
}) {
  const isId = locale === 'id';
  const secureUrl = typeof evidence?.secureUrl === 'string' ? evidence.secureUrl.trim() : '';
  const isSafeUrl = isValidPaymentEvidenceDeliveryUrl(secureUrl);

  if (!isSafeUrl) {
    return (
      <div
        data-testid="payment-evidence-invalid-url"
        className={`flex items-center gap-2 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8]/70 px-3 py-2.5 text-xs text-[#B92B0C] ${className}`}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {isId
            ? 'Tautan gambar bukti pembayaran tidak valid dan tidak ditampilkan demi keamanan.'
            : 'Image URL is invalid and cannot be previewed safely.'}
        </span>
      </div>
    );
  }

  const targetWidth = size === 'lg' ? 1200 : size === 'sm' ? 320 : 640;
  const previewSrc = buildPaymentEvidencePreviewUrl(secureUrl, { width: targetWidth }) || secureUrl;

  if (size === 'sm') {
    return (
      <a
        href={secureUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={isId ? 'Buka gambar bukti pembayaran asli' : 'Open original payment evidence image'}
        className={`group relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#151515]/12 bg-[#F8F6EF] ${className}`}
      >
        <img
          src={previewSrc}
          alt={isId ? 'Thumbnail bukti pembayaran' : 'Payment proof thumbnail'}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
      </a>
    );
  }

  const maxHeightClass = size === 'lg' ? 'max-h-[380px]' : 'max-h-[220px]';

  return (
    <div
      data-testid="payment-evidence-preview"
      className={`overflow-hidden rounded-xl border border-[#151515]/12 bg-[#FAF8F3] ${className}`}
    >
      <div className="relative flex items-center justify-center bg-[#151515]/[0.03] p-2">
        <img
          src={previewSrc}
          alt={isId ? 'Pratinjau bukti pembayaran' : 'Payment proof preview'}
          loading="lazy"
          className={`${maxHeightClass} w-auto max-w-full rounded-lg object-contain`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#151515]/[0.08] bg-white px-3 py-2 text-[11px] text-[#666159]">
        {showMeta ? (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <ImageIcon className="h-3.5 w-3.5 text-[#8B857B]" aria-hidden="true" />
            <span>
              {String(evidence?.format || 'img').toUpperCase()}
              {evidence?.bytes ? ` · ${formatEvidenceFileSize(evidence.bytes)}` : ''}
              {evidence?.width && evidence?.height
                ? ` · ${evidence.width}×${evidence.height}`
                : ''}
            </span>
          </span>
        ) : (
          <span />
        )}

        <a
          href={secureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-[#151515] underline-offset-2 hover:text-[#FF4B22] hover:underline"
        >
          <span>{isId ? 'Buka Gambar Asli' : 'Open Original'}</span>
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
