import { Dialog } from '@base-ui/react/dialog';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

import { StudioImage } from './StudioImage';

export function GalleryLightboxDialog({ isOpen, activeIndex, items, onClose, onPrev, onNext }) {
  const activeItem = isOpen && activeIndex !== null ? items[activeIndex] : null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="brutal-card-lg bg-studio-ivory text-studio-ink w-full max-w-2xl overflow-hidden">
            {activeItem ? (
              <div>
                <div className="border-studio-ink bg-studio-white flex items-center justify-between gap-3 border-b-2 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-studio-muted-ink font-mono text-[10px] font-bold tracking-wider uppercase">
                      {activeItem.category} ({activeIndex + 1} / {items.length})
                    </p>
                    <Dialog.Title className="font-display text-xl leading-none font-black uppercase sm:text-2xl">
                      {activeItem.title}
                    </Dialog.Title>
                  </div>

                  <Dialog.Close
                    aria-label="Close gallery preview"
                    className="brutal-btn bg-studio-white text-studio-ink flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <div className="bg-studio-ink">
                  <StudioImage
                    src={activeItem.lightboxSrc || activeItem.src}
                    alt={activeItem.alt}
                    width={activeItem.width}
                    height={activeItem.height}
                    priority
                    className="aspect-[4/3] max-h-[60vh] w-full"
                  />
                </div>

                <div className="border-studio-ink bg-studio-ivory flex flex-col justify-between gap-3 border-t-2 p-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 space-y-1">
                    {activeItem.caption ? (
                      <p className="text-studio-ink text-xs leading-snug font-bold sm:text-sm">
                        {activeItem.caption}
                      </p>
                    ) : null}
                    <Dialog.Description className="text-studio-muted-ink text-xs leading-relaxed">
                      {activeItem.alt}
                    </Dialog.Description>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={onPrev}
                      aria-label="Previous studio image"
                      className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      <span>Prev</span>
                    </button>
                    <button
                      type="button"
                      onClick={onNext}
                      aria-label="Next studio image"
                      className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase"
                    >
                      <span>Next</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default GalleryLightboxDialog;
