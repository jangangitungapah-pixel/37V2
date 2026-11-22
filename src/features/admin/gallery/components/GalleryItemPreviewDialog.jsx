import { Dialog } from '@base-ui/react/dialog';
import { Pencil, X } from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton } from '@/features/admin/design-system';

import {
  formatGalleryDimensions,
  formatGalleryFileSize,
  formatGalleryFormatBadge,
  formatGalleryTimestamp,
} from '../utils/gallery-format';
import { GalleryPublishStatusBadge } from './GalleryPublishStatusBadge';

export function GalleryItemPreviewDialog({
  open,
  item,
  publishedPosition = null,
  onOpenChange,
  onEdit,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <Dialog.Popup className="sa-card max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white p-4 sm:p-6">
            {item ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-[#151515]/10 pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <GalleryPublishStatusBadge
                        status={item.status}
                        publishedPosition={publishedPosition}
                      />
                      <span className="font-mono text-xs font-semibold text-[#756F65]">
                        {item.category}
                      </span>
                    </div>
                    <Dialog.Title className="mt-1.5 text-lg font-bold text-[#151515] sm:text-xl">
                      {item.title}
                    </Dialog.Title>
                  </div>

                  <Dialog.Close
                    aria-label="Close photograph preview"
                    className="sa-control sa-btn-secondary inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#151515]/10 bg-[#151515]">
                  <StudioImage
                    src={item.lightboxUrl || item.secureUrl}
                    alt={item.altText || item.title}
                    width={item.width}
                    height={item.height}
                    priority
                    className="aspect-[4/3] max-h-[55vh] w-full"
                  />
                </div>

                <Dialog.Description className="text-xs leading-relaxed text-[#46433D]">
                  <strong className="text-[#151515]">Alternative Text:</strong>{' '}
                  {item.altText || 'Belum diatur'}
                </Dialog.Description>

                {item.caption ? (
                  <p className="text-xs leading-relaxed text-[#666159]">
                    <strong className="text-[#151515]">Caption:</strong> {item.caption}
                  </p>
                ) : null}

                <dl className="grid grid-cols-2 gap-2.5 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] p-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[10.5px] font-medium text-[#756F65]">Dimensions</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                      {formatGalleryDimensions(item.width, item.height)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-medium text-[#756F65]">Format &amp; Size</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                      {formatGalleryFormatBadge(item.format)} · {formatGalleryFileSize(item.bytes)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-medium text-[#756F65]">Uploaded At</dt>
                    <dd className="mt-0.5 font-semibold text-[#151515]">
                      {formatGalleryTimestamp(item.uploadedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-medium text-[#756F65]">Version</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
                      v{item.version} (sort: {item.sortOrder})
                    </dd>
                  </div>
                  <div className="col-span-2 border-t border-[#151515]/[0.07] pt-2 sm:col-span-4">
                    <dt className="text-[10.5px] font-medium text-[#756F65]">
                      Cloudinary Public ID
                    </dt>
                    <dd className="mt-0.5 font-mono text-[11px] wrap-break-word text-[#3E3A33]">
                      {item.cloudinaryPublicId}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onOpenChange?.(false);
                      onEdit?.(item);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit Metadata</span>
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onOpenChange?.(false)}
                  >
                    <span>Close</span>
                  </AdminButton>
                </div>
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
