import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Globe,
  Pencil,
  RotateCcw,
} from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { GALLERY_FIELD_LIMITS, GALLERY_STATUSES } from '../config/gallery-config';
import {
  formatGalleryDimensions,
  formatGalleryFileSize,
  formatGalleryFormatBadge,
  formatGalleryTimestamp,
} from '../utils/gallery-format';
import { GalleryPublishStatusBadge } from './GalleryPublishStatusBadge';

export function GalleryItemCard({
  item,
  publishedPosition = null,
  canMoveUp = false,
  canMoveDown = false,
  isBusy = false,
  onEdit,
  onPreview,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onMoveUp,
  onMoveDown,
}) {
  const isPublished = item.status === GALLERY_STATUSES.PUBLISHED;
  const isArchived = item.status === GALLERY_STATUSES.ARCHIVED;
  const isDraft = item.status === GALLERY_STATUSES.DRAFT;

  const hasValidAltText =
    typeof item.altText === 'string' &&
    item.altText.trim().length >= GALLERY_FIELD_LIMITS.altTextMinPublished;

  return (
    <AdminSurface
      as="article"
      variant="card"
      aria-label={`Gallery item: ${item.title}`}
      className={`flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 ${
        isPublished ? 'ring-1 ring-[#8BAD12]/45' : ''
      }`}
    >
      <div>
        {/* Top Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <GalleryPublishStatusBadge status={item.status} publishedPosition={publishedPosition} />

          <div className="flex items-center gap-1.5">
            {isPublished ? (
              <AdminStatusBadge tone="ink" icon={Globe} size="sm">
                Live on Website
              </AdminStatusBadge>
            ) : (
              <AdminStatusBadge tone="neutral" size="sm">
                Hidden from Public
              </AdminStatusBadge>
            )}
          </div>
        </div>

        {/* Image Thumbnail */}
        <button
          type="button"
          onClick={() => onPreview?.(item)}
          aria-label={`Preview photograph ${item.title}`}
          className="group relative mt-3 block w-full cursor-pointer overflow-hidden rounded-xl border border-[#151515]/10 bg-[#151515] text-left"
        >
          <StudioImage
            src={item.thumbnailUrl || item.secureUrl}
            alt={item.altText || item.title}
            width={item.width}
            height={item.height}
            className="aspect-[4/3] w-full transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-[#151515]/85 px-2 py-1 font-mono text-[10px] font-semibold text-[#F1EEE4] backdrop-blur-xs">
            <Eye className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
            <span>Preview</span>
          </span>
        </button>

        {/* Title, Category & Alt Text Info */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] font-semibold tracking-wider text-[#756F65] uppercase">
              {item.category}
            </span>
            <span className="font-mono text-[10.5px] text-[#8B857B]">v{item.version}</span>
          </div>

          <h3 className="text-base font-bold tracking-tight wrap-break-word text-[#151515]">
            {item.title}
          </h3>

          {item.caption ? (
            <p className="line-clamp-2 text-xs leading-relaxed wrap-break-word text-[#666159]">
              {item.caption}
            </p>
          ) : null}

          {hasValidAltText ? (
            <p className="line-clamp-1 text-[11px] text-[#666159]">
              <span className="font-semibold text-[#46433D]">Alt:</span> {item.altText}
            </p>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-[#FEF4DD] px-2.5 py-1.5 text-[11px] font-medium text-[#8A4B08]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Alt text wajib diisi sebelum publikasi</span>
            </div>
          )}
        </div>

        {/* Technical Metadata Facts */}
        <dl className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-[#151515]/[0.07] bg-[#F8F6EF] p-2.5 text-[11px]">
          <div>
            <dt className="text-[10px] font-medium text-[#756F65]">Dimensions</dt>
            <dd className="font-mono font-semibold text-[#151515]">
              {formatGalleryDimensions(item.width, item.height)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium text-[#756F65]">Format &amp; Size</dt>
            <dd className="font-mono font-semibold text-[#151515]">
              {formatGalleryFormatBadge(item.format)} · {formatGalleryFileSize(item.bytes)}
            </dd>
          </div>
          <div className="col-span-2 border-t border-[#151515]/[0.06] pt-1.5">
            <dt className="inline text-[10px] font-medium text-[#756F65]">Uploaded: </dt>
            <dd className="inline font-medium text-[#3E3A33]">
              {formatGalleryTimestamp(item.uploadedAt)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Actions Footer */}
      <div className="mt-4 space-y-2 border-t border-[#151515]/[0.08] pt-3">
        {/* Primary Publication / Ordering Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isDraft ? (
            <AdminButton
              type="button"
              variant="primary"
              size="xs"
              disabled={isBusy}
              onClick={() => onPublish?.(item)}
              aria-label={`Publish ${item.title}`}
              className="flex-1"
            >
              <Globe className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
              <span>Publish</span>
            </AdminButton>
          ) : null}

          {isPublished ? (
            <>
              <AdminButton
                type="button"
                variant="secondary"
                size="xs"
                disabled={isBusy}
                onClick={() => onUnpublish?.(item)}
                aria-label={`Unpublish ${item.title}`}
                className="flex-1"
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unpublish</span>
              </AdminButton>

              <AdminButton
                type="button"
                variant="secondary"
                size="xs"
                disabled={isBusy || !canMoveUp}
                onClick={() => onMoveUp?.(item)}
                aria-label={`Move ${item.title} up`}
                title="Move up in public gallery order"
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Up</span>
              </AdminButton>

              <AdminButton
                type="button"
                variant="secondary"
                size="xs"
                disabled={isBusy || !canMoveDown}
                onClick={() => onMoveDown?.(item)}
                aria-label={`Move ${item.title} down`}
                title="Move down in public gallery order"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Down</span>
              </AdminButton>
            </>
          ) : null}

          {isArchived ? (
            <AdminButton
              type="button"
              variant="primary"
              size="xs"
              disabled={isBusy}
              onClick={() => onRestore?.(item)}
              aria-label={`Restore ${item.title} to Draft`}
              className="flex-1"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
              <span>Restore to Draft</span>
            </AdminButton>
          ) : null}
        </div>

        {/* Secondary Edit / Preview / Archive Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminButton
            type="button"
            variant="secondary"
            size="xs"
            disabled={isBusy}
            onClick={() => onEdit?.(item)}
            aria-label={`Edit metadata for ${item.title}`}
            className="flex-1"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </AdminButton>

          <AdminButton
            type="button"
            variant="secondary"
            size="xs"
            disabled={isBusy}
            onClick={() => onPreview?.(item)}
            aria-label={`Inspect ${item.title}`}
            className="flex-1"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Inspect</span>
          </AdminButton>

          {!isArchived ? (
            <AdminButton
              type="button"
              variant="ghost"
              size="xs"
              disabled={isBusy}
              onClick={() => onArchive?.(item)}
              aria-label={`Archive ${item.title}`}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Archive</span>
            </AdminButton>
          ) : null}
        </div>
      </div>
    </AdminSurface>
  );
}
