import { Archive, ImagePlus, Pencil } from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { GALLERY_STATUSES } from '../config/gallery-config';
import {
  LANDING_PAGE_PLACEMENT_DEFINITIONS,
  LANDING_PAGE_PLACEMENT_IDS,
  LANDING_PAGE_PLACEMENT_STATUSES,
} from '../config/landing-page-placements-config';
import { normalizePlacementCopy } from '../utils/landing-page-placement-normalize';

function renderCopyPreview(placementId, copy) {
  if (placementId === LANDING_PAGE_PLACEMENT_IDS.HERO_FEATURED) {
    return (
      <div className="space-y-1 text-xs">
        {copy.topSticker ? (
          <p className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
            {copy.topSticker}
          </p>
        ) : null}
        <p className="font-bold text-[#151515]">{copy.captionTitle}</p>
        {copy.captionSubtitle ? <p className="text-[#666159]">{copy.captionSubtitle}</p> : null}
      </div>
    );
  }

  if (
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_A ||
    placementId === LANDING_PAGE_PLACEMENT_IDS.ROOM_B
  ) {
    return (
      <div className="space-y-1 text-xs">
        {copy.sticker ? (
          <p className="font-mono text-[10px] font-semibold text-[#756F65] uppercase">
            {copy.sticker}
          </p>
        ) : null}
        <p className="font-bold text-[#151515]">{copy.name}</p>
        <p className="line-clamp-2 text-[#666159]">{copy.capacityLabel}</p>
        {Array.isArray(copy.tags) && copy.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {copy.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-[#151515]/10 bg-[#F8F6EF] px-1.5 py-0.5 font-mono text-[10px] text-[#46433D]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      <p className="text-[#666159]">
        {copy.caption ? `Caption: ${copy.caption}` : 'Tampil pada kartu alamat & lokasi studio.'}
      </p>
    </div>
  );
}

export function LandingPageMediaManager({
  placementsById = {},
  galleryItems = [],
  onChangePhoto,
  onEditCopy,
}) {
  const galleryMap = new Map(galleryItems.map((item) => [item.id, item]));

  return (
    <section aria-label="Landing Page Media Manager" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LANDING_PAGE_PLACEMENT_DEFINITIONS.map((def) => {
          const record = placementsById[def.id] || null;
          const isPublished =
            record &&
            record.status === LANDING_PAGE_PLACEMENT_STATUSES.PUBLISHED &&
            Boolean(record.secureUrl);
          const effectiveCopy = normalizePlacementCopy(def.id, record?.copy);
          const sourceItem = record?.sourceGalleryItemId
            ? galleryMap.get(record.sourceGalleryItemId)
            : null;
          const isSourceArchived = sourceItem && sourceItem.status === GALLERY_STATUSES.ARCHIVED;

          return (
            <AdminSurface
              key={def.id}
              as="article"
              variant="card"
              aria-label={`Placement: ${def.label}`}
              className="group flex flex-col justify-between p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] font-semibold tracking-wider text-[#756F65] uppercase">
                      {def.sectionLabel}
                    </p>
                    <h3 className="text-base font-bold text-[#151515]">{def.label}</h3>
                  </div>

                  <AdminStatusBadge
                    tone={isPublished ? 'lime' : 'neutral'}
                    dot={isPublished}
                    size="sm"
                  >
                    {isPublished ? 'Terpasang di Website' : 'Belum Ada Foto'}
                  </AdminStatusBadge>
                </div>

                {/* Photo Thumbnail */}
                <div className="overflow-hidden rounded-xl border border-[#151515]/10 bg-[#151515]">
                  <StudioImage
                    src={record?.thumbnailUrl || record?.secureUrl || ''}
                    alt={record?.altText || def.defaultAltText}
                    width={record?.width || 960}
                    height={record?.height || 640}
                    fallbackLabel="Belum ada foto dipilih"
                    className={`${def.aspectClass} w-full`}
                    imgClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                {isSourceArchived ? (
                  <div className="flex items-center gap-1.5 rounded-lg border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-1.5 text-[11px] text-[#46433D]">
                    <Archive className="h-3.5 w-3.5 shrink-0 text-[#756F65]" aria-hidden="true" />
                    <span>
                      Foto sumber diarsipkan di galeri, namun foto ini tetap tampil normal di
                      Landing Page.
                    </span>
                  </div>
                ) : null}

                {/* Copy Preview */}
                <div className="rounded-xl border border-[#151515]/[0.07] bg-[#F8F6EF] p-3">
                  {renderCopyPreview(def.id, effectiveCopy)}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#151515]/[0.08] pt-3.5">
                <AdminButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => onChangePhoto?.(def.id)}
                  aria-label={`Ganti Foto untuk ${def.label}`}
                  className="min-h-10 flex-1"
                >
                  <ImagePlus className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                  <span>Ganti Foto</span>
                </AdminButton>

                <AdminButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEditCopy?.(def.id)}
                  aria-label={`Edit Teks untuk ${def.label}`}
                  className="min-h-10 flex-1"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit Teks</span>
                </AdminButton>
              </div>
            </AdminSurface>
          );
        })}
      </div>
    </section>
  );
}
