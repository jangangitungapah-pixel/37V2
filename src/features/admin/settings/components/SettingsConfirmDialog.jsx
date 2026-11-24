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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Popup
            data-admin-portal-layer="true"
            data-calendar-scoped="true"
            className="sa-dialog flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl rounded-b-none outline-none sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFEDE8] text-[#B92B0C]">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
                <Dialog.Title className="text-base font-bold tracking-tight wrap-break-word text-[#151515]">
                  {title}
                </Dialog.Title>
              </div>

              <Dialog.Close
                aria-label="Close confirmation dialog"
                className="sa-control inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <Dialog.Description className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
                {description}
              </Dialog.Description>
            </div>

            <div className="sa-safe-bottom flex shrink-0 flex-col-reverse gap-2 border-t border-[#151515]/[0.08] bg-[#FAF8F3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5 sm:px-5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="sa-control sa-btn-secondary min-h-11 w-full cursor-pointer px-4 py-2 text-xs font-semibold sm:w-auto"
              >
                {infoOnly ? 'Mengerti' : cancelLabel}
              </button>

              {!infoOnly ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  className={
                    confirmTone === 'danger'
                      ? 'sa-control sa-btn-orange min-h-11 w-full cursor-pointer px-4 py-2 text-xs font-semibold sm:w-auto'
                      : 'sa-control sa-btn-lime min-h-11 w-full cursor-pointer px-4 py-2 text-xs font-semibold sm:w-auto'
                  }
                >
                  {confirmLabel}
                </button>
              ) : null}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
