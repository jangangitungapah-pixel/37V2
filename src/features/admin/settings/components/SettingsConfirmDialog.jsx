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

        <Dialog.Popup
          data-admin-portal-layer="true"
          data-calendar-scoped="true"
          className="sa-dialog fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 overflow-hidden outline-none"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#151515]/[0.08] bg-[#FAF8F3] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFEDE8] text-[#B92B0C]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <Dialog.Title className="text-base font-bold tracking-tight text-[#151515]">
                {title}
              </Dialog.Title>
            </div>

            <Dialog.Close
              aria-label="Close confirmation dialog"
              className="sa-control inline-flex h-8.5 w-8.5 shrink-0 cursor-pointer items-center justify-center rounded-xl border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="p-5">
            <Dialog.Description className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
              {description}
            </Dialog.Description>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="sa-control sa-btn-secondary min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold"
              >
                {infoOnly ? 'Mengerti' : cancelLabel}
              </button>

              {!infoOnly ? (
                <button
                  type="button"
                  onClick={onConfirm}
                  className={
                    confirmTone === 'danger'
                      ? 'sa-control sa-btn-orange min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold'
                      : 'sa-control sa-btn-lime min-h-10 cursor-pointer px-4 py-2 text-xs font-semibold'
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
