import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, Clock, KeyRound, Menu, X } from 'lucide-react';

export function SiteHeader({ utilityStrip, header, onNavigate, onOpenLogin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionSelect = (event, href) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(href);
  };

  return (
    <header className="border-studio-ink bg-studio-ivory sticky top-0 z-40 border-b-2">
      {/* Section 01 — Slim Black Top Utility Strip */}
      <div className="border-studio-ink bg-studio-ink text-studio-ivory border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-1.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="bg-studio-lime inline-block h-2 w-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
            <p className="truncate font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
              {utilityStrip.descriptor}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-1.5 font-mono text-[11px] text-neutral-300 md:flex">
              <Clock className="text-studio-lime h-3.5 w-3.5" aria-hidden="true" />
              <span>{utilityStrip.hoursDisplay}</span>
            </div>
            <a
              href={utilityStrip.ctaHref}
              onClick={(event) => handleSectionSelect(event, utilityStrip.ctaHref)}
              className="bg-studio-orange text-studio-white hover:bg-studio-lime hover:text-studio-ink hidden px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase transition-colors sm:inline-block"
            >
              {utilityStrip.ctaLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Section 02 — Main Header / Navigation */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        {/* Brand Lockup */}
        <a
          href="#top"
          onClick={(event) => handleSectionSelect(event, '#top')}
          className="group flex min-h-11 items-center gap-2.5 pr-1"
          aria-label="37 Music Studio — Back to top"
        >
          <span className="border-studio-ink bg-studio-ink text-studio-white group-hover:bg-studio-orange flex h-10 w-10 shrink-0 items-center justify-center border-2 font-mono text-base font-extrabold tracking-tight transition-colors">
            {header.brandMark}
          </span>
          <span className="flex flex-col">
            <span className="font-display text-lg leading-none font-black tracking-tight uppercase sm:text-xl">
              {header.brandName}
            </span>
            <span className="text-studio-muted-ink mt-0.5 font-mono text-[9px] font-semibold tracking-wider uppercase sm:text-[10px]">
              {header.brandTagline}
            </span>
          </span>
        </a>

        {/* Desktop Section Navigation */}
        <nav aria-label="Primary section navigation" className="hidden items-center gap-1 lg:flex">
          {header.navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => handleSectionSelect(event, item.href)}
              className="text-studio-ink hover:bg-studio-lime inline-flex min-h-11 items-center px-3 py-2 text-sm font-semibold transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Actions: Login Dummy + Primary Book Now + Mobile Menu Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenLogin}
            aria-label={header.loginButton.ariaLabel}
            className="brutal-btn bg-studio-white text-studio-ink hidden min-h-11 cursor-pointer items-center gap-1.5 px-3.5 py-2 text-xs font-bold tracking-wider uppercase sm:inline-flex"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{header.loginButton.label}</span>
          </button>

          <a
            href={header.primaryCta.href}
            onClick={(event) => handleSectionSelect(event, header.primaryCta.href)}
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-bold tracking-wider uppercase sm:px-4"
          >
            <span>{header.primaryCta.label}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {/* Mobile Accessible Menu Dialog */}
          <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <Dialog.Trigger
              aria-label="Open navigation menu"
              className="brutal-btn bg-studio-white text-studio-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/65 lg:hidden" />
              <Dialog.Viewport className="fixed inset-0 z-50 flex justify-end p-3 sm:p-4 lg:hidden">
                <Dialog.Popup className="brutal-card-lg bg-studio-ivory text-studio-ink flex h-full max-h-[92vh] w-full max-w-sm flex-col justify-between overflow-y-auto p-5">
                  <div>
                    <div className="border-studio-ink flex items-center justify-between border-b-2 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="border-studio-ink bg-studio-ink text-studio-white flex h-9 w-9 items-center justify-center border-2 font-mono text-sm font-extrabold">
                          {header.brandMark}
                        </span>
                        <div>
                          <Dialog.Title className="font-display text-lg leading-none font-black tracking-tight uppercase">
                            {header.brandName}
                          </Dialog.Title>
                          <Dialog.Description className="text-studio-muted-ink mt-0.5 font-mono text-[10px] font-semibold uppercase">
                            Site Navigation
                          </Dialog.Description>
                        </div>
                      </div>

                      <Dialog.Close
                        aria-label="Close navigation menu"
                        className="brutal-btn bg-studio-white text-studio-ink flex h-11 w-11 items-center justify-center"
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </Dialog.Close>
                    </div>

                    <nav
                      aria-label="Mobile section navigation"
                      className="mt-4 flex flex-col gap-2"
                    >
                      {header.navLinks.map((item, index) => (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={(event) => handleSectionSelect(event, item.href)}
                          className="border-studio-ink bg-studio-white hover:bg-studio-lime flex min-h-12 items-center justify-between border-2 px-4 py-2.5 text-base font-bold transition-colors"
                        >
                          <span>{item.label}</span>
                          <span className="text-studio-muted-ink font-mono text-xs">
                            0{index + 1}
                          </span>
                        </a>
                      ))}
                    </nav>
                  </div>

                  <div className="border-studio-ink mt-6 space-y-3 border-t-2 pt-4">
                    <div className="bg-studio-ink text-studio-ivory flex items-center gap-2 px-3 py-2 font-mono text-[11px]">
                      <Clock className="text-studio-lime h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{utilityStrip.hoursDisplay}</span>
                    </div>

                    <a
                      href={header.primaryCta.href}
                      onClick={(event) => handleSectionSelect(event, header.primaryCta.href)}
                      className="brutal-btn bg-studio-orange text-studio-white flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wider uppercase"
                    >
                      <span>{header.primaryCta.label}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenLogin();
                      }}
                      className="brutal-btn bg-studio-white text-studio-ink flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-bold tracking-wider uppercase"
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      <span>{header.loginButton.label} (Staff / Owner)</span>
                    </button>
                  </div>
                </Dialog.Popup>
              </Dialog.Viewport>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
