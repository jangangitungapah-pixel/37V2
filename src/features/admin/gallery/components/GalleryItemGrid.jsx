import { GalleryItemCard } from './GalleryItemCard';

export function GalleryItemGrid({
  items = [],
  publishedOrderIds = [],
  busyItemId = '',
  onEdit,
  onPreview,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onMoveUp,
  onMoveDown,
}) {
  return (
    <div
      role="list"
      aria-label="Studio gallery photograph library"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {items.map((item) => {
        const pubIndex = publishedOrderIds.indexOf(item.id);
        const isPublished = pubIndex !== -1;
        const publishedPosition = isPublished ? pubIndex + 1 : null;
        const canMoveUp = isPublished && pubIndex > 0;
        const canMoveDown = isPublished && pubIndex < publishedOrderIds.length - 1;

        return (
          <div key={item.id} role="listitem">
            <GalleryItemCard
              item={item}
              publishedPosition={publishedPosition}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              isBusy={busyItemId === item.id}
              onEdit={onEdit}
              onPreview={onPreview}
              onPublish={onPublish}
              onUnpublish={onUnpublish}
              onArchive={onArchive}
              onRestore={onRestore}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          </div>
        );
      })}
    </div>
  );
}
