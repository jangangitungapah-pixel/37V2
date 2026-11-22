import { Archive, Globe, LayoutTemplate } from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';

import { GALLERY_STATUSES } from '../config/gallery-config';

/**
 * Smartphone-gallery-style photo tile.
 * Displays only the photograph, a subtle title overlay, and tiny publication/usage badges.
 * Never displays technical metadata (dimensions, bytes, format, IDs, versions, timestamps).
 */
export function GalleryItemCard({ item, publishedPosition = null, usedPlacements = [], onSelect }) {
  const isPublished = item.status === GALLERY_STATUSES.PUBLISHED;
  const isArchived = item.status === GALLERY_STATUSES.ARCHIVED;
  const isUsedOnLandingPage = Array.isArray(usedPlacements) && usedPlacements.length > 0;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      aria-label={`Buka foto ${item.title}`}
      className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-[#151515]/10 bg-[#151515] text-left shadow-xs transition-transform duration-150 hover:scale-[1.01] focus:ring-2 focus:ring-[#151515] focus:outline-none sm:rounded-2xl"
    >
      <StudioImage
        src={item.thumbnailUrl || item.secureUrl}
        alt={item.altText || item.title}
        width={item.width}
        height={item.height}
        className="h-full w-full"
      />

      {/* Top tiny publication & Landing Page usage indicators */}
      <div className="pointer-events-none absolute top-1.5 right-1.5 left-1.5 flex flex-wrap items-center justify-between gap-1 sm:top-2 sm:right-2 sm:left-2">
        <div className="flex flex-wrap items-center gap-1">
          {isPublished ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C8F13A] px-2 py-0.5 text-[10px] font-bold text-[#151515] shadow-xs">
              <Globe className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>{publishedPosition ? `Galeri #${publishedPosition}` : 'Galeri'}</span>
            </span>
          ) : null}

          {isUsedOnLandingPage ? (
            <span
              data-testid={`used-on-landing-badge-${item.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#151515]/85 px-2 py-0.5 text-[10px] font-semibold text-[#F1EEE4] backdrop-blur-xs"
            >
              <LayoutTemplate className="h-2.5 w-2.5 shrink-0 text-[#C8F13A]" aria-hidden="true" />
              <span className="hidden sm:inline">Used on Landing Page</span>
              <span className="sm:hidden">Landing</span>
            </span>
          ) : null}

          {isArchived ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-medium text-white/90">
              <Archive className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span>Arsip</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom subtle title gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pt-5 pb-1.5 sm:px-3 sm:pt-7 sm:pb-2.5">
        <p className="truncate text-[11px] font-semibold text-white sm:text-xs">{item.title}</p>
      </div>
    </button>
  );
}
