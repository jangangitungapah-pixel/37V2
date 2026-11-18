import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, X } from 'lucide-react';

export function SettingsConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'danger',
  infoOnly = false,
  onConfirm,
  onOpenChange,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px]" />

        <Dialog.Popup
          data-calendar-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 border-2 shadow-[6px_6px_0px_#151515]"
        >
          <div className="border-studio-ink bg-studio-ink text-studio-ivory flex items-start justify-between gap-3 border-b-2 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
              <Dialog.Title className="font-display text-xl leading-none font-black tracking-tight text-white uppercase">
                {title}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close confirmation dialog"
              className="hover:border-studio-lime hover:text-studio-lime inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="p-4 sm:p-5">
            <Dialog.Description className="text-studio-ink text-xs leading-relaxed font-semibold sm:text-sm">
              {description}
            </Dialog.Description>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="brutal-btn bg-studio-white text-studio-ink min-h-10 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase"
              >
                {infoOnly ? 'Mengerti' : cancelLabel}
              </button>

              {!infoOnly ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  className={
                    confirmTone === 'danger'
                      ? 'brutal-btn bg-studio-orange text-studio-white min-h-10 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase'
                      : 'brutal-btn bg-studio-lime text-studio-ink min-h-10 cursor-pointer px-4 py-2 font-mono text-xs font-extrabold uppercase'
                  }
                >
                  {confirmLabel}
                </button>
              ) : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
