import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Images, LayoutTemplate, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

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
import { GalleryUploadQueue } from '../components/GalleryUploadQueue';
import { LandingPageMediaManager } from '../components/LandingPageMediaManager';
import { LandingPagePhotoPickerDialog } from '../components/LandingPagePhotoPickerDialog';
import { LandingPagePlacementEditorDialog } from '../components/LandingPagePlacementEditorDialog';
import {
  GALLERY_BOUNDED_QUERY_LIMIT,
  GALLERY_CATEGORY_SUGGESTIONS,
  GALLERY_STATUSES,
  getCloudinaryConfig,
} from '../config/gallery-config';
import { useGalleryItems } from '../hooks/useGalleryItems';
import { useGalleryUpload } from '../hooks/useGalleryUpload';
import { useLandingPagePlacements } from '../hooks/useLandingPagePlacements';
import {
  mapCloudinaryErrorToMessage,
  uploadImageToCloudinary,
} from '../services/cloudinary-upload-service';
import {
  archiveGalleryItem,
  createGalleryMetadataFromUpload,
  mapGalleryServiceErrorToMessage,
  publishGalleryItem,
  reorderPublishedGalleryItem,
  restoreGalleryItem,
  unpublishGalleryItem,
  updateGalleryItemMetadata,
} from '../services/gallery-service';
import {
  mapLandingPagePlacementErrorToMessage,
  saveLandingPagePlacement,
} from '../services/landing-page-placement-service';
import { deriveTitleFromFilename } from '../utils/gallery-format';

const GALLERY_TABS = Object.freeze({
  PHOTOS: 'photos',
  LANDING_PAGE: 'landing-page',
});

export function AdminGalleryPage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isActiveProfile = profile ? profile.active === true : true;
  const isOwner = actorRole === 'owner' && Boolean(actorUid) && isActiveProfile;

  const cloudinaryConfig = getCloudinaryConfig();
  const fileInputRef = useRef(null);

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
    placementsById,
    usageByGalleryItemId,
    error: placementsError,
  } = useLandingPagePlacements({
    enabled: isOwner,
  });

  const {
    queue,
    enqueueFiles,
    cancelQueuedItem,
    retryFailedUpload,
    retryMetadataSave,
    dismissQueueItem,
  } = useGalleryUpload({
    enabled: isOwner,
    actorUid,
    actorRole,
    existingItems: items,
    cloudinaryConfig,
    onUploadSuccess: (saved) => {
      toast.success(`"${saved.title}" ditambahkan ke galeri.`);
    },
    onUploadError: (msg) => {
      toast.error(msg);
    },
  });

  const [activeTab, setActiveTab] = useState(GALLERY_TABS.PHOTOS);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyItemId, setBusyItemId] = useState('');
  const [actionError, setActionError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Photo Detail & Edit dialogs
  const [previewItemId, setPreviewItemId] = useState('');
  const [editingItem, setEditingItem] = useState(null);

  // Landing Page Placement Photo Picker & Editor dialogs
  const [pickerPlacementId, setPickerPlacementId] = useState('');
  const [editorState, setEditorState] = useState({
    open: false,
    placementId: '',
    selectedPhoto: null,
    sessionKey: 0,
  });

  const publishedOrderIds = useMemo(() => publishedItems.map((item) => item.id), [publishedItems]);

  // Keep previewItem live as its status or metadata updates
  const previewItem = useMemo(
    () => (previewItemId ? items.find((item) => item.id === previewItemId) || null : null),
    [items, previewItemId],
  );

  const filteredItems = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeFilter !== 'all' && item.status !== activeFilter) {
        return false;
      }
      if (queryLower) {
        return (
          item.title.toLowerCase().includes(queryLower) ||
          item.category.toLowerCase().includes(queryLower)
        );
      }
      return true;
    });
  }, [activeFilter, items, searchQuery]);

  const handleTriggerAddPhotos = () => {
    if (!isOwner) return;
    if (!cloudinaryConfig.isConfigured) {
      const msg =
        'Konfigurasi unggah foto belum lengkap. Pastikan VITE_CLOUDINARY_CLOUD_NAME dan VITE_CLOUDINARY_UPLOAD_PRESET tersedia.';
      setActionError(msg);
      toast.error(msg);
      return;
    }
    setActionError('');
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      enqueueFiles(files);
    }
    event.target.value = '';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (isOwner && activeTab === GALLERY_TABS.PHOTOS) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    if (!isOwner || activeTab !== GALLERY_TABS.PHOTOS) return;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      if (!cloudinaryConfig.isConfigured) {
        setActionError(cloudinaryConfig.statusMessage);
        return;
      }
      enqueueFiles(files);
    }
  };

  const handleSaveEditedPhoto = async ({
    title,
    category,
    altText,
    caption,
    showInPublicGallery,
  }) => {
    if (!editingItem || !isOwner) return;
    setActionError('');
    setBusyItemId(editingItem.id);
    try {
      let updated = await updateGalleryItemMetadata({
        item: editingItem,
        actorUid,
        actorRole,
        input: { title, category, altText, caption },
      });

      const wasPublished = updated.status === GALLERY_STATUSES.PUBLISHED;
      if (showInPublicGallery && !wasPublished) {
        updated = await publishGalleryItem({
          item: updated,
          actorUid,
          actorRole,
          existingItems: items,
          expectedCloudName: cloudinaryConfig.cloudName,
        });
      } else if (!showInPublicGallery && wasPublished) {
        updated = await unpublishGalleryItem({
          item: updated,
          actorUid,
          actorRole,
        });
      }

      setEditingItem(null);
      toast.success(`Perubahan pada "${updated.title}" berhasil disimpan.`);
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
      // Ensure altText is populated from caption or title if empty
      let targetItem = item;
      if (!targetItem.altText || targetItem.altText.trim().length < 3) {
        const autoAlt =
          targetItem.caption?.trim().length >= 3 ? targetItem.caption.trim() : targetItem.title;
        targetItem = await updateGalleryItemMetadata({
          item: targetItem,
          actorUid,
          actorRole,
          input: {
            title: targetItem.title,
            category: targetItem.category || 'Recording',
            altText: autoAlt,
            caption: targetItem.caption || '',
          },
        });
      }

      const updated = await publishGalleryItem({
        item: targetItem,
        actorUid,
        actorRole,
        existingItems: items,
        expectedCloudName: cloudinaryConfig.cloudName,
      });
      toast.success(`"${updated.title}" kini ditampilkan di Galeri Website.`);
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
      toast.info(`"${updated.title}" disembunyikan dari Galeri Website.`);
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
      setPreviewItemId('');
      toast.info(`"${updated.title}" telah diarsipkan.`);
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
      toast.success(`"${updated.title}" berhasil dipulihkan.`);
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
      toast.success(`Urutan "${item.title}" diperbarui.`);
    } catch (err) {
      const msg = mapGalleryServiceErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyItemId('');
    }
  };

  // Landing Page Media Manager handlers
  const handleOpenChangePhoto = (placementId) => {
    setPickerPlacementId(placementId);
  };

  const handleOpenEditCopy = (placementId) => {
    setEditorState((prev) => ({
      open: true,
      placementId,
      selectedPhoto: null,
      sessionKey: prev.sessionKey + 1,
    }));
  };

  const handleSelectPhotoForPlacement = (photo) => {
    const targetPlacementId = pickerPlacementId || editorState.placementId;
    setPickerPlacementId('');
    setEditorState((prev) => ({
      open: true,
      placementId: targetPlacementId,
      selectedPhoto: photo,
      sessionKey: prev.sessionKey + 1,
    }));
  };

  const handleUploadNewPhotoFromPicker = async (file) => {
    if (!cloudinaryConfig.isConfigured) {
      throw new Error(cloudinaryConfig.statusMessage);
    }
    try {
      const uploadedAsset = await uploadImageToCloudinary({
        file,
        config: cloudinaryConfig,
      });
      const defaultTitle = deriveTitleFromFilename(file.name || 'Studio Photo');
      const savedDoc = await createGalleryMetadataFromUpload({
        actorUid,
        actorRole,
        cloudinaryResponse: uploadedAsset,
        initialMetadata: {
          title: defaultTitle,
          category: GALLERY_CATEGORY_SUGGESTIONS[0],
          altText: defaultTitle,
          caption: '',
        },
        existingItems: items,
        expectedCloudName: cloudinaryConfig.cloudName,
      });
      toast.success(`Foto "${savedDoc.title}" berhasil diunggah dan dipilih.`);
      return savedDoc;
    } catch (err) {
      const msg = mapCloudinaryErrorToMessage(err, {
        uploadPreset: cloudinaryConfig.uploadPreset,
      });
      throw new Error(msg, { cause: err });
    }
  };

  const handleSavePlacement = async ({
    placementId,
    photoItem,
    altText,
    copy,
    expectedVersion,
  }) => {
    try {
      await saveLandingPagePlacement({
        placementId,
        actorUid,
        actorRole,
        photoItem,
        altText,
        copy,
        status: 'published',
        expectedVersion,
        expectedCloudName: cloudinaryConfig.cloudName,
      });
      setEditorState((prev) => ({ ...prev, open: false }));
      toast.success('Perubahan foto & teks Landing Page berhasil disimpan.');
    } catch (err) {
      const msg = mapLandingPagePlacementErrorToMessage(err);
      toast.error(msg);
      throw new Error(msg, { cause: err });
    }
  };

  const previewPubIndex = previewItem ? publishedOrderIds.indexOf(previewItem.id) : -1;
  const previewPublishedPosition = previewPubIndex !== -1 ? previewPubIndex + 1 : null;
  const previewCanMoveUp = previewPubIndex > 0;
  const previewCanMoveDown =
    previewPubIndex !== -1 && previewPubIndex < publishedOrderIds.length - 1;
  const previewUsedPlacements = previewItem ? usageByGalleryItemId[previewItem.id] || [] : [];

  return (
    <div
      data-gallery-scoped="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="space-y-3.5 sm:space-y-5"
    >
      {/* Hidden multi-file picker triggered by "+ Add Photos" */}
      {isOwner ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileInputChange}
          aria-label="Select studio photograph files to upload"
          className="sr-only"
        />
      ) : null}

      <AdminPageHeader
        compactMobile
        eyebrow="STUDIO PHOTO GALLERY"
        icon={Images}
        title="Gallery"
        titleId="gallery-page-heading"
        description="Manage studio photographs and curate the images displayed on the public website."
        meta={
          <AdminStatusBadge tone="ivory" size="sm">
            Owner Only
          </AdminStatusBadge>
        }
        actions={
          isOwner ? (
            <AdminButton
              type="button"
              variant="primary"
              size="sm"
              onClick={handleTriggerAddPhotos}
              className="min-h-10"
            >
              <Plus className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
              <span>Add Photos</span>
            </AdminButton>
          ) : null
        }
      >
        {isOwner ? (
          <div
            role="tablist"
            aria-label="Mode pengelolaan galeri"
            className="grid w-full grid-cols-2 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-1 sm:inline-flex sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === GALLERY_TABS.PHOTOS}
              onClick={() => setActiveTab(GALLERY_TABS.PHOTOS)}
              className={`inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:px-3.5 ${
                activeTab === GALLERY_TABS.PHOTOS
                  ? 'bg-[#151515] text-[#F1EEE4] shadow-xs'
                  : 'text-[#46433D] hover:text-[#151515]'
              }`}
            >
              <Images className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Photos</span>
              <span
                className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  activeTab === GALLERY_TABS.PHOTOS
                    ? 'bg-[#C8F13A] text-[#151515]'
                    : 'bg-[#151515]/10 text-[#46433D]'
                }`}
              >
                {counts.total}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === GALLERY_TABS.LANDING_PAGE}
              onClick={() => setActiveTab(GALLERY_TABS.LANDING_PAGE)}
              className={`inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors sm:px-3.5 ${
                activeTab === GALLERY_TABS.LANDING_PAGE
                  ? 'bg-[#151515] text-[#F1EEE4] shadow-xs'
                  : 'text-[#46433D] hover:text-[#151515]'
              }`}
            >
              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Landing Page</span>
            </button>
          </div>
        ) : null}
      </AdminPageHeader>

      {!isOwner ? (
        <GalleryOwnerAccessNotice />
      ) : (
        <>
          {loadError || placementsError || actionError ? (
            <AdminSurface
              as="div"
              role="alert"
              variant="subcard"
              className="border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800 sm:p-3.5"
            >
              {actionError || loadError || placementsError}
            </AdminSurface>
          ) : null}

          {reachedQueryLimit ? (
            <AdminSurface
              as="div"
              role="status"
              variant="subcard"
              className="border-amber-500/40 bg-[#FEF4DD] p-3 text-xs text-[#6B3B08]"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#8A4B08]" aria-hidden="true" />
                <span>
                  Menampilkan {GALLERY_BOUNDED_QUERY_LIMIT} foto terbaru. Arsipkan foto lama yang
                  tidak digunakan agar galeri tetap ringkas.
                </span>
              </div>
            </AdminSurface>
          ) : null}

          {/* Compact Upload Progress & Partial-Failure Recovery Bar */}
          <GalleryUploadQueue
            queue={queue}
            onCancelQueued={cancelQueuedItem}
            onRetryUpload={retryFailedUpload}
            onRetryMetadataSave={retryMetadataSave}
            onDismissItem={dismissQueueItem}
          />

          {/* TAB 1: PHOTOS (Native Phone Gallery Experience) */}
          {activeTab === GALLERY_TABS.PHOTOS ? (
            <div
              className={`space-y-3.5 rounded-2xl transition-colors ${
                isDragOver ? 'bg-[#EDF8C2]/25 p-2 ring-2 ring-[#151515]' : ''
              }`}
            >
              <GalleryToolbar
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                counts={counts}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              {isLoading ? (
                <AdminSurface
                  variant="card"
                  className="flex items-center gap-3 p-6 text-sm text-[#46433D]"
                >
                  <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
                  <span>Memuat koleksi foto...</span>
                </AdminSurface>
              ) : filteredItems.length === 0 ? (
                <div className="space-y-3">
                  <GalleryEmptyState
                    activeFilter={activeFilter}
                    searchQuery={searchQuery}
                    onResetFilters={() => {
                      setActiveFilter('all');
                      setSearchQuery('');
                    }}
                  />
                  {items.length === 0 ? (
                    <div className="flex justify-center">
                      <AdminButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleTriggerAddPhotos}
                        className="min-h-10"
                      >
                        <ImagePlus className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
                        <span>Add Photos</span>
                      </AdminButton>
                    </div>
                  ) : null}
                </div>
              ) : (
                <GalleryItemGrid
                  items={filteredItems}
                  publishedOrderIds={publishedOrderIds}
                  usageByGalleryItemId={usageByGalleryItemId}
                  onSelectItem={(item) => setPreviewItemId(item.id)}
                />
              )}
            </div>
          ) : null}

          {/* TAB 2: LANDING PAGE MEDIA MANAGER */}
          {activeTab === GALLERY_TABS.LANDING_PAGE ? (
            <LandingPageMediaManager
              placementsById={placementsById}
              galleryItems={items}
              onChangePhoto={handleOpenChangePhoto}
              onEditCopy={handleOpenEditCopy}
            />
          ) : null}

          {/* Photo Detail Sheet / Dialog */}
          <GalleryItemPreviewDialog
            open={Boolean(previewItem)}
            item={previewItem}
            publishedPosition={previewPublishedPosition}
            canMoveUp={previewCanMoveUp}
            canMoveDown={previewCanMoveDown}
            usedPlacements={previewUsedPlacements}
            isBusy={Boolean(previewItem && busyItemId === previewItem.id)}
            onOpenChange={(open) => {
              if (!open) setPreviewItemId('');
            }}
            onEdit={(item) => {
              setPreviewItemId('');
              setEditingItem(item);
            }}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onMoveUp={(item) => handleReorder(item, 'up')}
            onMoveDown={(item) => handleReorder(item, 'down')}
          />

          {/* Simplified Photo Title & Description Editor */}
          <GalleryItemEditorDialog
            open={Boolean(editingItem)}
            item={editingItem}
            onOpenChange={(open) => {
              if (!open) setEditingItem(null);
            }}
            onSave={handleSaveEditedPhoto}
          />

          {/* Landing Page Placement Editor Dialog */}
          <LandingPagePlacementEditorDialog
            key={`placement-editor-${editorState.placementId}-${editorState.sessionKey}`}
            open={editorState.open}
            placementId={editorState.placementId}
            existingPlacement={placementsById[editorState.placementId] || null}
            selectedPhoto={editorState.selectedPhoto}
            onOpenChange={(open) => {
              if (!open) {
                setEditorState((prev) => ({ ...prev, open: false }));
              }
            }}
            onOpenPhotoPicker={() => {
              setPickerPlacementId(editorState.placementId);
            }}
            onSavePlacement={handleSavePlacement}
          />

          {/* Landing Page Photo Picker Dialog */}
          <LandingPagePhotoPickerDialog
            open={Boolean(pickerPlacementId)}
            placementId={pickerPlacementId}
            galleryItems={items}
            selectedPhotoId={
              editorState.selectedPhoto?.id ||
              placementsById[pickerPlacementId]?.sourceGalleryItemId ||
              ''
            }
            onOpenChange={(open) => {
              if (!open) setPickerPlacementId('');
            }}
            onSelectPhoto={handleSelectPhotoForPlacement}
            onUploadNewPhoto={handleUploadNewPhotoFromPicker}
          />
        </>
      )}
    </div>
  );
}

export default AdminGalleryPage;
