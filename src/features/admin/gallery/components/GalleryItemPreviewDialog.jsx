import { Dialog } from '@base-ui/react/dialog';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  EyeOff,
  Globe,
  LayoutTemplate,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';

import { StudioImage } from '@/components/landing/StudioImage';
import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import { GALLERY_STATUSES } from '../config/gallery-config';

/**
 * Mobile-first Photo Detail Sheet / Dialog.
 * Bottom-sheet presentation on mobile screens; centered modal on desktop.
 * Uses natural Indonesian labels without technical jargon.
 */
export function GalleryItemPreviewDialog({
  open,
  item,
  publishedPosition = null,
  canMoveUp = false,
  canMoveDown = false,
  usedPlacements = [],
  isBusy = false,
  onOpenChange,
  onEdit,
  onPublish,
  onUnpublish,
  onArchive,
  onRestore,
  onMoveUp,
  onMoveDown,
}) {
  const isPublished = item?.status === GALLERY_STATUSES.PUBLISHED;
  const isArchived = item?.status === GALLERY_STATUSES.ARCHIVED;
  const isDraft = item?.status === GALLERY_STATUSES.DRAFT;
  const descriptionText = item?.caption?.trim() || item?.altText?.trim() || '';

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
            {item ? (
              <>
                {/* Sticky Header */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/8 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isPublished ? (
                        <AdminStatusBadge tone="lime" dot size="sm">
                          {publishedPosition
                            ? `Tampil di Galeri Website • #${publishedPosition}`
                            : 'Tampil di Galeri Website'}
                        </AdminStatusBadge>
                      ) : isArchived ? (
                        <AdminStatusBadge tone="neutral" size="sm">
                          Diarsipkan
                        </AdminStatusBadge>
                      ) : (
                        <AdminStatusBadge tone="ivory" size="sm">
                          Disembunyikan dari Galeri
                        </AdminStatusBadge>
                      )}

                      {usedPlacements.length > 0 ? (
                        <AdminStatusBadge tone="ink" icon={LayoutTemplate} size="sm">
                          Used on Landing Page: {usedPlacements.map((u) => u.label).join(', ')}
                        </AdminStatusBadge>
                      ) : null}
                    </div>

                    <Dialog.Title className="mt-1.5 text-lg font-bold wrap-break-word text-[#151515] sm:text-xl">
                      {item.title}
                    </Dialog.Title>
                  </div>

                  <Dialog.Close
                    aria-label="Tutup detail foto"
                    className="sa-control sa-btn-secondary inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                {/* Scrollable Body */}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                  {/* Prominent Photo Preview */}
                  <div className="overflow-hidden rounded-2xl border border-[#151515]/10 bg-[#151515]">
                    <StudioImage
                      src={item.lightboxUrl || item.secureUrl}
                      alt={item.altText || item.title}
                      width={item.width}
                      height={item.height}
                      priority
                      className="aspect-[4/3] max-h-[44vh] w-full sm:max-h-[52vh]"
                    />
                  </div>

                  {/* Photo Title & Description */}
                  <div className="rounded-xl border border-[#151515]/[0.08] bg-[#F8F6EF] p-3.5 text-xs sm:p-4">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold text-[#756F65]">Judul Foto</p>
                        <p className="mt-0.5 text-sm font-bold wrap-break-word text-[#151515]">
                          {item.title}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#756F65]">Deskripsi</p>
                        <Dialog.Description className="mt-0.5 text-xs leading-relaxed wrap-break-word text-[#3E3A33]">
                          {descriptionText || 'Belum ada deskripsi foto.'}
                        </Dialog.Description>
                      </div>
                    </div>
                  </div>

                  {/* Less prominent secondary Archive area */}
                  {!isArchived ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#151515]/[0.08] pt-3">
                      <p className="min-w-0 flex-1 text-[11px] text-[#756F65]">
                        {usedPlacements.length > 0
                          ? 'Foto ini sedang dipakai di Landing Page. Mengarsipkan foto tidak akan merusak tampilan Landing Page yang sudah terbit.'
                          : 'Arsipkan foto untuk menyembunyikannya dari daftar foto utama.'}
                      </p>
                      <AdminButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={isBusy}
                        onClick={() => onArchive?.(item)}
                        className="min-h-10 shrink-0"
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Arsipkan Foto</span>
                      </AdminButton>
                    </div>
                  ) : null}
                </div>

                {/* Sticky Footer Controls */}
                <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/8 bg-white p-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-6">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onEdit?.(item)}
                    className="min-h-10.5 w-full sm:w-auto"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span>Edit Foto</span>
                  </AdminButton>

                  {isPublished ? (
                    <div className="flex w-full gap-2 sm:w-auto">
                      <AdminButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy || !canMoveUp}
                        onClick={() => onMoveUp?.(item)}
                        aria-label={`Move ${item.title} up`}
                        className="min-h-10.5 flex-1 sm:flex-none"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        <span>Geser Naik</span>
                      </AdminButton>

                      <AdminButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy || !canMoveDown}
                        onClick={() => onMoveDown?.(item)}
                        aria-label={`Move ${item.title} down`}
                        className="min-h-10.5 flex-1 sm:flex-none"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        <span>Geser Turun</span>
                      </AdminButton>
                    </div>
                  ) : null}

                  {isDraft ? (
                    <AdminButton
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => onPublish?.(item)}
                      className="min-h-10.5 w-full sm:w-auto"
                    >
                      <Globe className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
                      <span>Tampilkan di Galeri Website</span>
                    </AdminButton>
                  ) : null}

                  {isPublished ? (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => onUnpublish?.(item)}
                      className="min-h-10.5 w-full sm:w-auto"
                    >
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                      <span>Sembunyikan dari Galeri</span>
                    </AdminButton>
                  ) : null}

                  {isArchived ? (
                    <AdminButton
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => onRestore?.(item)}
                      className="min-h-10.5 w-full sm:w-auto"
                    >
                      <RotateCcw className="h-4 w-4 text-[#C8F13A]" aria-hidden="true" />
                      <span>Pulihkan Foto</span>
                    </AdminButton>
                  ) : null}
                </div>
              </>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
