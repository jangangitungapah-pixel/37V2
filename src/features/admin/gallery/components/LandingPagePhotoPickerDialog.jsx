import { useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton } from '@/features/admin/design-system';

import { GALLERY_STATUSES } from '../config/gallery-config';
import { getLandingPagePlacementDefinition } from '../config/landing-page-placements-config';

/**
 * Simple photo-picker dialog reusing the Gallery photo library.
 * Displays thumbnails only, marks the currently selected photo, and supports
 * uploading a new photo directly into the Gallery and selecting it for the placement.
 */
export function LandingPagePhotoPickerDialog({
  open,
  placementId,
  galleryItems = [],
  selectedPhotoId = '',
  onOpenChange,
  onSelectPhoto,
  onUploadNewPhoto,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const def = getLandingPagePlacementDefinition(placementId);

  // Show all non-archived gallery photos (plus currently selected photo if archived)
  const selectablePhotos = galleryItems.filter(
    (item) => item.status !== GALLERY_STATUSES.ARCHIVED || item.id === selectedPhotoId,
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onUploadNewPhoto) return;

    setUploadError('');
    setIsUploading(true);
    try {
      const savedItem = await onUploadNewPhoto(file);
      if (savedItem) {
        onSelectPhoto?.(savedItem);
      }
    } catch (err) {
      setUploadError(err?.message || 'Gagal mengunggah foto baru.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-50"
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            className="sa-dialog flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl rounded-b-none bg-white p-0 outline-none sm:rounded-2xl"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/8 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-bold wrap-break-word text-[#151515]">
                  Pilih Foto — {def?.label || 'Landing Page'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-[#666159]">
                  Pilih salah satu foto dari galeri atau unggah foto baru.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup pemilih foto"
                className="sa-control sa-btn-secondary inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {/* Upload New Photo Action */}
              <div className="flex flex-col gap-2.5 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-[#46433D]">
                  Ingin memakai foto yang belum ada di galeri?
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  aria-label="Upload new photo for placement"
                  className="sr-only"
                />

                <AdminButton
                  type="button"
                  variant="primary"
                  size="xs"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-9.5 w-full shrink-0 sm:w-auto"
                >
                  {isUploading ? (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-[#C8F13A]"
                      aria-hidden="true"
                    />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                  )}
                  <span>{isUploading ? 'Mengunggah...' : 'Upload New Photo'}</span>
                </AdminButton>
              </div>

              {uploadError ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800"
                >
                  {uploadError}
                </div>
              ) : null}

              {/* Thumbnails-only Grid */}
              {selectablePhotos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#151515]/15 p-8 text-center text-xs text-[#666159]">
                  Belum ada foto di galeri. Klik <strong>Upload New Photo</strong> di atas untuk
                  mengunggah foto pertama.
                </div>
              ) : (
                <div
                  role="listbox"
                  aria-label="Pilihan foto galeri"
                  className="grid grid-cols-2 gap-2.5 min-[380px]:grid-cols-3 sm:grid-cols-4"
                >
                  {selectablePhotos.map((photo) => {
                    const isSelected = photo.id === selectedPhotoId;
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`Pilih foto ${photo.title}`}
                        onClick={() => onSelectPhoto?.(photo)}
                        className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border-2 bg-[#151515] text-left transition-all ${
                          isSelected
                            ? 'border-[#151515] ring-2 ring-[#C8F13A]'
                            : 'border-transparent hover:border-[#151515]/40'
                        }`}
                      >
                        <StudioImage
                          src={photo.thumbnailUrl || photo.secureUrl}
                          alt={photo.altText || photo.title}
                          width={photo.width}
                          height={photo.height}
                          className="h-full w-full"
                        />

                        {isSelected ? (
                          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-[#C8F13A] px-2 py-0.5 text-[10px] font-bold text-[#151515] shadow-xs">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>Dipilih</span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="sa-safe-bottom flex shrink-0 items-center justify-end border-t border-[#151515]/8 bg-white p-3.5 sm:px-6">
              <AdminButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange?.(false)}
                className="min-h-10.5 w-full sm:w-auto"
              >
                <span>Tutup</span>
              </AdminButton>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
