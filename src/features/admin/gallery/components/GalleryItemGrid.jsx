import { GalleryItemCard } from './GalleryItemCard';

/**
 * Responsive photo-first grid:
 * 3 columns on mobile phones, 4 on tablet, 5 on wide desktop screens.
 */
export function GalleryItemGrid({
  items = [],
  publishedOrderIds = [],
  usageByGalleryItemId = {},
  onSelectItem,
}) {
  return (
    <div
      role="list"
      aria-label="Studio gallery photograph library"
      className="grid grid-cols-3 gap-1.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {items.map((item) => {
        const pubIndex = publishedOrderIds.indexOf(item.id);
        const publishedPosition = pubIndex !== -1 ? pubIndex + 1 : null;
        const usedPlacements = usageByGalleryItemId[item.id] || [];

        return (
          <div key={item.id} role="listitem">
            <GalleryItemCard
              item={item}
              publishedPosition={publishedPosition}
              usedPlacements={usedPlacements}
              onSelect={onSelectItem}
            />
          </div>
        );
      })}
    </div>
  );
}
