import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, Lock, X } from 'lucide-react';

export function LoginComingSoonDialog({
  open,
  onOpenChange,
  content,
  onGoToBooking,
  returnFocusToMenuTrigger,
  mobileMenuTriggerRef,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px]" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            finalFocus={() => {
              if (returnFocusToMenuTrigger && mobileMenuTriggerRef?.current?.isConnected) {
                return mobileMenuTriggerRef.current;
              }
              return true;
            }}
            className="brutal-card-lg bg-studio-ivory text-studio-ink relative w-full max-w-md p-6 sm:p-7"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <span className="border-studio-ink bg-studio-lime inline-flex items-center gap-1.5 border-[1.5px] px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {content.badge}
              </span>
              <Dialog.Close
                aria-label="Close studio login dialog"
                className="brutal-btn bg-studio-white text-studio-ink flex h-11 w-11 shrink-0 items-center justify-center"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <Dialog.Title className="font-display text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
              {content.title}
            </Dialog.Title>

            <Dialog.Description className="text-studio-ink mt-3 text-base font-semibold">
              {content.description}
            </Dialog.Description>

            <p className="border-studio-ink bg-studio-white text-studio-muted-ink mt-3 border-[1.5px] p-3.5 text-sm leading-relaxed">
              {content.detail}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
              <Dialog.Close className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center px-5 py-2.5 text-sm font-bold tracking-wide uppercase">
                {content.closeLabel}
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onGoToBooking?.();
                }}
                className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold tracking-wide uppercase"
              >
                <span>{content.bookingCtaLabel}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
