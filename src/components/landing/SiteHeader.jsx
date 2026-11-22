import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowRight, CalendarClock, Clock, LogIn, Menu, X } from 'lucide-react';
import { Link } from 'react-router';

export function SiteHeader({ utilityStrip, header, onNavigate, mobileMenuTriggerRef }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hoursLabel = utilityStrip.hoursText || '10:00 – 23:00 WIB';
  const loginCta = header?.loginCta || { label: 'Login', href: '/portal/login' };

  const handleSectionSelect = (event, href) => {
    event.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(href);
  };

  return (
    <>
      {/* Section 01 — Slim Black Top Utility Strip */}
      <div className="border-studio-ink bg-studio-ink text-studio-ivory hidden border-b sm:block">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-2 px-3 py-1.5 sm:px-6 lg:px-8">
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
              <span>{hoursLabel}</span>
            </div>
            <Link
              to="/availability"
              className="text-studio-lime hidden items-center gap-1 font-mono text-[10px] font-bold tracking-wider uppercase hover:underline sm:inline-flex"
            >
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              <span>LIVE AVAILABILITY</span>
            </Link>
            <a
              href={utilityStrip.ctaHref}
              onClick={(event) => handleSectionSelect(event, utilityStrip.ctaHref)}
              className="bg-studio-orange text-studio-white hover:bg-studio-lime hover:text-studio-ink hidden px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-colors sm:inline-block"
            >
              {utilityStrip.ctaLabel}
            </a>
          </div>
        </div>
      </div>

      {/* Section 02 — Sticky Main Header / Navigation */}
      <header className="border-studio-ink bg-studio-ivory/95 sticky top-0 z-40 border-b-2 backdrop-blur-xs">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-2 px-2.5 py-2 min-[375px]:px-3 sm:px-6 sm:py-2.5 lg:px-8">
          {/* Brand Lockup */}
          <a
            href="#top"
            onClick={(event) => handleSectionSelect(event, '#top')}
            className="group flex min-h-11 min-w-0 items-center gap-1.5 pr-1 min-[375px]:gap-2.5"
            aria-label="37 Music Studio — Back to top"
          >
            <span className="border-studio-ink bg-studio-ink text-studio-white group-hover:bg-studio-orange flex h-8 w-8 shrink-0 items-center justify-center border-2 font-mono text-xs font-extrabold tracking-tight transition-colors min-[375px]:h-10 min-[375px]:w-10 min-[375px]:text-base">
              {header.brandMark}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-display truncate text-sm leading-none font-black tracking-tight uppercase min-[375px]:text-lg sm:text-xl">
                {header.brandName}
              </span>
              <span className="text-studio-muted-ink mt-0.5 hidden truncate font-mono text-[9px] font-semibold tracking-wider uppercase sm:block sm:text-[10px]">
                {header.brandTagline}
              </span>
            </span>
          </a>

          {/* Desktop Section Navigation */}
          <nav
            aria-label="Primary section navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            {header.navLinks.map((item) =>
              item.isRoute || item.href.startsWith('/') ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-studio-ink hover:bg-studio-lime inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-bold transition-colors"
                >
                  <CalendarClock className="text-studio-orange h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleSectionSelect(event, item.href)}
                  className="text-studio-ink hover:bg-studio-lime inline-flex min-h-11 items-center px-3 py-2 text-sm font-semibold transition-colors"
                >
                  {item.label}
                </a>
              ),
            )}
          </nav>

          {/* Actions: Client Portal Login + Primary Book a Session + Mobile Menu Trigger */}
          <div className="flex shrink-0 items-center gap-1.5 min-[375px]:gap-2">
            <Link
              to={loginCta.href}
              data-testid="header-login-link"
              className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime hidden min-h-11 items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold tracking-wider uppercase transition-colors sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{loginCta.label}</span>
            </Link>

            <a
              href={header.primaryCta.href}
              onClick={(event) => handleSectionSelect(event, header.primaryCta.href)}
              className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-1 px-3 py-2 text-[11px] font-extrabold tracking-wider uppercase min-[375px]:gap-1.5 min-[375px]:px-3.5 min-[375px]:text-xs sm:px-4"
            >
              <span>{header.primaryCta.label}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            {/* Mobile Accessible Menu Dialog */}
            <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <Dialog.Trigger
                ref={mobileMenuTriggerRef}
                aria-label="Open navigation menu"
                className="brutal-btn bg-studio-white text-studio-ink inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center lg:hidden"
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
                        {header.navLinks.map((item, index) =>
                          item.isRoute || item.href.startsWith('/') ? (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="border-studio-ink bg-studio-lime text-studio-ink flex min-h-12 items-center justify-between border-2 px-4 py-2.5 text-base font-extrabold transition-colors"
                            >
                              <span className="inline-flex items-center gap-2">
                                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                <span>{item.label}</span>
                              </span>
                              <span className="font-mono text-xs">0{index + 1}</span>
                            </Link>
                          ) : (
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
                          ),
                        )}
                      </nav>
                    </div>

                    <div className="border-studio-ink mt-6 space-y-3 border-t-2 pt-4">
                      <div className="bg-studio-ink text-studio-ivory flex items-center gap-2 px-3 py-2 font-mono text-[11px]">
                        <Clock
                          className="text-studio-lime h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{hoursLabel}</span>
                      </div>

                      <Link
                        to={loginCta.href}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="mobile-menu-login-link"
                        className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold tracking-wider uppercase transition-colors"
                      >
                        <LogIn className="h-4 w-4" aria-hidden="true" />
                        <span>{loginCta.label}</span>
                      </Link>

                      <a
                        href={header.primaryCta.href}
                        onClick={(event) => handleSectionSelect(event, header.primaryCta.href)}
                        className="brutal-btn bg-studio-orange text-studio-white flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold tracking-wider uppercase"
                      >
                        <span>{header.primaryCta.label}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>
                  </Dialog.Popup>
                </Dialog.Viewport>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>
    </>
  );
}
