import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Eye, Globe, Images, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { StudioImage } from '@/components/landing/StudioImage';
import {
  AdminButton,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { GalleryEmptyState } from '../components/GalleryEmptyState';
import { GalleryItemEditorDialog } from '../components/GalleryItemEditorDialog';
import { GalleryItemGrid } from '../components/GalleryItemGrid';
import { GalleryItemPreviewDialog } from '../components/GalleryItemPreviewDialog';
import { GalleryOwnerAccessNotice } from '../components/GalleryOwnerAccessNotice';
import { GalleryToolbar } from '../components/GalleryToolbar';
import { GalleryUploadDropzone } from '../components/GalleryUploadDropzone';
import { GalleryUploadQueue } from '../components/GalleryUploadQueue';
import {
  GALLERY_BOUNDED_QUERY_LIMIT,
  GALLERY_STATUSES,
  getCloudinaryConfig,
} from '../config/gallery-config';
import { useGalleryItems } from '../hooks/useGalleryItems';
import { useGalleryUpload } from '../hooks/useGalleryUpload';
import {
  archiveGalleryItem,
  mapGalleryServiceErrorToMessage,
  publishGalleryItem,
  reorderPublishedGalleryItem,
  restoreGalleryItem,
  unpublishGalleryItem,
  updateGalleryItemMetadata,
} from '../services/gallery-service';

export function AdminGalleryPage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isActiveProfile = profile ? profile.active === true : true;
  const isOwner = actorRole === 'owner' && Boolean(actorUid) && isActiveProfile;

  const cloudinaryConfig = getCloudinaryConfig();

  const {
    items,
    publishedItems,
    counts,
    reachedQueryLimit,
    isLoading,
    error: loadError,
  } = useGalleryItems({
    enabled: isOwner,
    limitCount: GALLERY_BOUNDED_QUERY_LIMIT,
  });

  const {
    queue,
    enqueueFiles,
    cancelQueuedItem,
    retryFailedUpload,
    retryMetadataSave,
    removeCompletedItems,
    dismissQueueItem,
  } = useGalleryUpload({
    enabled: isOwner,
    actorUid,
    actorRole,
    existingItems: items,
    cloudinaryConfig,
    onUploadSuccess: (saved) => {
      toast.success(`"${saved.title}" berhasil diunggah dan disimpan sebagai Draft.`);
    },
    onUploadError: (msg) => {
      toast.error(msg);
    },
  });

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPublicPreview, setShowPublicPreview] = useState(false);
  const [busyItemId, setBusyItemId] = useState('');
  const [actionError, setActionError] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);

  const publishedOrderIds = useMemo(() => publishedItems.map((item) => item.id), [publishedItems]);

  const filteredItems = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeFilter !== 'all' && item.status !== activeFilter) {
        return false;
      }
      if (queryLower) {
        const titleMatch = item.title.toLowerCase().includes(queryLower);
        const categoryMatch = item.category.toLowerCase().includes(queryLower);
        return titleMatch || categoryMatch;
      }
      return true;
    });
  }, [activeFilter, items, searchQuery]);

  const handleSaveEditedMetadata = async (values) => {
    if (!editingItem || !isOwner) return;
    setActionError('');
    setBusyItemId(editingItem.id);
    try {
      const updated = await updateGalleryItemMetadata({
        item: editingItem,
        actorUid,
        actorRole,
        input: values,
      });
      setEditingItem(null);
      toast.success(`Metadata "${updated.title}" berhasil diperbarui (v${updated.version}).`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setBusyItemId('');
    }
  };

  const handlePublish = async (item) => {
    if (!isOwner || !item) return;
    setActionError('');
    setBusyItemId(item.id);
    try {
      const updated = await publishGalleryItem({
        item,
        actorUid,
        actorRole,
        existingItems: items,
        expectedCloudName: cloudinaryConfig.cloudName,
      });
      toast.success(`"${updated.title}" telah dipublikasikan ke Landing Page.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  const handleUnpublish = async (item) => {
    if (!isOwner || !item) return;
    setActionError('');
    setBusyItemId(item.id);
    try {
      const updated = await unpublishGalleryItem({
        item,
        actorUid,
        actorRole,
      });
      toast.info(`"${updated.title}" dikembalikan ke status Draft.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  const handleArchive = async (item) => {
    if (!isOwner || !item) return;
    setActionError('');
    setBusyItemId(item.id);
    try {
      const updated = await archiveGalleryItem({
        item,
        actorUid,
        actorRole,
      });
      toast.info(`"${updated.title}" telah dipindahkan ke Archived.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  const handleRestore = async (item) => {
    if (!isOwner || !item) return;
    setActionError('');
    setBusyItemId(item.id);
    try {
      const updated = await restoreGalleryItem({
        item,
        actorUid,
        actorRole,
      });
      toast.success(`"${updated.title}" dipulihkan ke status Draft.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  const handleReorder = async (item, direction) => {
    if (!isOwner || !item) return;
    setActionError('');
    setBusyItemId(item.id);
    try {
      await reorderPublishedGalleryItem({
        itemId: item.id,
        direction,
        publishedItems,
        actorUid,
        actorRole,
      });
      toast.success(`Urutan tampil "${item.title}" berhasil diperbarui.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  const activePreviewPublishedPosition = useMemo(() => {
    if (!previewItem || previewItem.status !== GALLERY_STATUSES.PUBLISHED) return null;
    const idx = publishedOrderIds.indexOf(previewItem.id);
    return idx !== -1 ? idx + 1 : null;
  }, [previewItem, publishedOrderIds]);

  return (
    <div data-gallery-scoped="true" className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        compactMobile
        keepDescriptionOnMobile
        eyebrow="PUBLIC WEBSITE MEDIA"
        icon={Images}
        title="Gallery"
        titleId="gallery-page-heading"
        description="Manage studio photographs and curate the images displayed on the public website."
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge tone="ivory" size="sm">
              Owner Only
            </AdminStatusBadge>
            {isOwner ? (
              <>
                <AdminStatusBadge tone="neutral" size="sm">
                  Total: {counts.total}
                </AdminStatusBadge>
                <AdminStatusBadge tone="lime" dot size="sm">
                  Published: {counts.published}
                </AdminStatusBadge>
                <AdminStatusBadge tone="ivory" size="sm">
                  Draft: {counts.draft}
                </AdminStatusBadge>
                <AdminStatusBadge tone="neutral" size="sm">
                  Archived: {counts.archived}
                </AdminStatusBadge>
              </>
            ) : null}
          </div>
        }
      >
        {isOwner ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-2.5 sm:p-3">
              <p className="font-mono text-[10px] font-semibold tracking-wide text-[#756F65] uppercase">
                Total Images
              </p>
              <p
                data-testid="gallery-count-total"
                className="mt-0.5 text-lg font-bold text-[#151515] sm:text-xl"
              >
                {counts.total}
              </p>
            </div>
            <div className="rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2]/55 p-2.5 sm:p-3">
              <p className="font-mono text-[10px] font-semibold tracking-wide text-[#243300] uppercase">
                Published
              </p>
              <p
                data-testid="gallery-count-published"
                className="mt-0.5 text-lg font-bold text-[#151515] sm:text-xl"
              >
                {counts.published}
              </p>
            </div>
            <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-2.5 sm:p-3">
              <p className="font-mono text-[10px] font-semibold tracking-wide text-[#756F65] uppercase">
                Draft
              </p>
              <p
                data-testid="gallery-count-draft"
                className="mt-0.5 text-lg font-bold text-[#151515] sm:text-xl"
              >
                {counts.draft}
              </p>
            </div>
            <div className="rounded-xl border border-[#151515]/[0.08] bg-white/80 p-2.5 sm:p-3">
              <p className="font-mono text-[10px] font-semibold tracking-wide text-[#756F65] uppercase">
                Archived
              </p>
              <p
                data-testid="gallery-count-archived"
                className="mt-0.5 text-lg font-bold text-[#151515] sm:text-xl"
              >
                {counts.archived}
              </p>
            </div>
          </div>
        ) : null}
      </AdminPageHeader>

      {!isOwner ? (
        <GalleryOwnerAccessNotice />
      ) : (
        <>
          {reachedQueryLimit ? (
            <AdminSurface
              as="div"
              role="status"
              variant="subcard"
              className="border-amber-500/40 bg-[#FEF4DD] p-3.5 text-xs text-[#6B3B08] sm:p-4"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#8A4B08]"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-semibold">Batas Kuota Tampilan Pustaka Tercapai</p>
                  <p className="mt-0.5 leading-relaxed">
                    Query pustaka menampilkan maksimal {GALLERY_BOUNDED_QUERY_LIMIT} dokumen
                    teratas. Arsipkan foto lama yang tidak digunakan agar pustaka tetap ringkas.
                  </p>
                </div>
              </div>
            </AdminSurface>
          ) : null}

          {loadError || actionError ? (
            <AdminSurface
              as="div"
              role="alert"
              variant="subcard"
              className="border-red-300 bg-red-50 p-3.5 text-xs font-medium text-red-800 sm:p-4"
            >
              {actionError || loadError}
            </AdminSurface>
          ) : null}

          {/* Area A: Upload Dropzone & Queue */}
          <GalleryUploadDropzone cloudinaryConfig={cloudinaryConfig} onSelectFiles={enqueueFiles} />

          <GalleryUploadQueue
            queue={queue}
            onCancelQueued={cancelQueuedItem}
            onRetryUpload={retryFailedUpload}
            onRetryMetadataSave={retryMetadataSave}
            onRemoveCompleted={removeCompletedItems}
            onDismissItem={dismissQueueItem}
          />

          {/* Area C (Optional Collapsible / Live Strip): Public Landing Page Arrangement Preview */}
          {showPublicPreview ? (
            <AdminSurface
              as="section"
              variant="ivory"
              aria-labelledby="public-arrangement-preview-heading"
              className="p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#151515]" aria-hidden="true" />
                  <div>
                    <h3
                      id="public-arrangement-preview-heading"
                      className="text-sm font-bold text-[#151515] sm:text-base"
                    >
                      Public Landing Page Gallery Arrangement ({publishedItems.length})
                    </h3>
                    <p className="text-xs text-[#666159]">
                      Urutan foto yang saat ini tampil secara publik di Landing Page.
                    </p>
                  </div>
                </div>
                <AdminStatusBadge tone="lime" dot size="sm">
                  {publishedItems.length} Live Photos
                </AdminStatusBadge>
              </div>

              {publishedItems.length === 0 ? (
                <p className="mt-4 text-xs text-[#666159]">
                  Belum ada foto berstatus Published. Landing Page publik saat ini menampilkan pesan
                  &ldquo;Studio photos coming soon.&rdquo;
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {publishedItems.map((pubItem, index) => (
                    <div
                      key={pubItem.id}
                      className="flex flex-col justify-between overflow-hidden rounded-xl border border-[#151515]/15 bg-white p-2.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 pb-1.5">
                          <span className="rounded-md bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                            #{index + 1}
                          </span>
                          <span className="truncate font-mono text-[10px] text-[#756F65]">
                            {pubItem.category}
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-lg bg-[#151515]">
                          <StudioImage
                            src={pubItem.thumbnailUrl || pubItem.secureUrl}
                            alt={pubItem.altText || pubItem.title}
                            width={pubItem.width}
                            height={pubItem.height}
                            className="aspect-[4/4.3] w-full"
                          />
                        </div>
                        <p className="mt-2 truncate text-xs font-bold text-[#151515]">
                          {pubItem.title}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-1 border-t border-[#151515]/[0.07] pt-2">
                        <div className="flex items-center gap-1">
                          <AdminButton
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={busyItemId === pubItem.id || index === 0}
                            onClick={() => handleReorder(pubItem, 'up')}
                            aria-label={`Move ${pubItem.title} up in preview`}
                          >
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          </AdminButton>
                          <AdminButton
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={
                              busyItemId === pubItem.id || index === publishedItems.length - 1
                            }
                            onClick={() => handleReorder(pubItem, 'down')}
                            aria-label={`Move ${pubItem.title} down in preview`}
                          >
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          </AdminButton>
                        </div>

                        <AdminButton
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setPreviewItem(pubItem)}
                          aria-label={`Preview published photo ${pubItem.title}`}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        </AdminButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminSurface>
          ) : null}

          {/* Area B: Gallery Library Filter & Grid */}
          <GalleryToolbar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showPublicPreview={showPublicPreview}
            onTogglePublicPreview={() => setShowPublicPreview((prev) => !prev)}
          />

          {isLoading ? (
            <AdminSurface
              variant="card"
              className="flex items-center gap-3 p-6 text-sm text-[#46433D]"
            >
              <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
              <span>Memuat pustaka foto studio dari Firestore...</span>
            </AdminSurface>
          ) : filteredItems.length === 0 ? (
            <GalleryEmptyState
              activeFilter={activeFilter}
              searchQuery={searchQuery}
              onResetFilters={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
            />
          ) : (
            <GalleryItemGrid
              items={filteredItems}
              publishedOrderIds={publishedOrderIds}
              busyItemId={busyItemId}
              onEdit={setEditingItem}
              onPreview={setPreviewItem}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
              onArchive={handleArchive}
              onRestore={handleRestore}
              onMoveUp={(item) => handleReorder(item, 'up')}
              onMoveDown={(item) => handleReorder(item, 'down')}
            />
          )}

          <GalleryItemEditorDialog
            open={Boolean(editingItem)}
            item={editingItem}
            onOpenChange={(open) => {
              if (!open) setEditingItem(null);
            }}
            onSave={handleSaveEditedMetadata}
          />

          <GalleryItemPreviewDialog
            open={Boolean(previewItem)}
            item={previewItem}
            publishedPosition={activePreviewPublishedPosition}
            onOpenChange={(open) => {
              if (!open) setPreviewItem(null);
            }}
            onEdit={setEditingItem}
          />
        </>
      )}
    </div>
  );
}

export default AdminGalleryPage;
