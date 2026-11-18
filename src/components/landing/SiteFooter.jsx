import { useState } from 'react';
import { ArrowRight, KeyRound } from 'lucide-react';

export function SiteFooter({ footer, navLinks, onNavigate, onOpenLogin }) {
  const [socialPendingMessage, setSocialPendingMessage] = useState('');

  const handleAnchorClick = (event, href) => {
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <footer className="bg-studio-ink text-studio-ivory pt-12 pb-8 sm:pt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Column 1: Brand Lockup & Social Icons */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <span className="border-studio-ivory bg-studio-lime text-studio-ink flex h-9 w-9 items-center justify-center border font-mono text-sm font-extrabold">
                {footer.brandMark}
              </span>
              <span className="font-display text-xl leading-none font-black tracking-tight uppercase">
                {footer.brandName}
              </span>
            </div>

            <p className="mt-3 max-w-xs text-xs leading-relaxed text-neutral-300 sm:text-sm">
              {footer.description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {footer.socialLinks.map((social) => (
                <button
                  key={social.id}
                  type="button"
                  aria-label={`${social.label} (official URL pending owner confirmation)`}
                  onClick={() =>
                    setSocialPendingMessage(
                      `Official 37 Music Studio ${social.label} profile URL is pending owner confirmation.`,
                    )
                  }
                  className="hover:border-studio-lime hover:text-studio-lime min-h-11 cursor-pointer border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-[11px] font-bold uppercase transition-colors"
                >
                  {social.label}
                </button>
              ))}
            </div>

            {socialPendingMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="text-studio-lime mt-2.5 font-mono text-[11px]"
              >
                {socialPendingMessage}
              </p>
            ) : null}
          </div>

          {/* Column 2: Visit & Navigation */}
          <div className="lg:col-span-3">
            <h2 className="font-mono text-xs font-extrabold tracking-wider text-neutral-400 uppercase">
              {footer.visitHeading}
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-neutral-300">
              {footer.visitAddressNote}
            </p>

            <ul className="mt-4 space-y-2 text-xs font-semibold">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(event) => handleAnchorClick(event, link.href)}
                    className="hover:text-studio-lime inline-flex py-1 text-neutral-200 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Hours & Contact */}
          <div className="lg:col-span-2">
            <h2 className="font-mono text-xs font-extrabold tracking-wider text-neutral-400 uppercase">
              {footer.hoursHeading}
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-neutral-200">{footer.hoursNote}</p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">{footer.contactNote}</p>
          </div>

          {/* Column 4: Quick Booking CTA + Staff Login */}
          <div className="lg:col-span-3">
            <h2 className="font-mono text-xs font-extrabold tracking-wider text-neutral-400 uppercase">
              {footer.ctaHeading}
            </h2>

            <a
              href={footer.ctaHref}
              onClick={(event) => handleAnchorClick(event, footer.ctaHref)}
              className="bg-studio-orange text-studio-white hover:bg-studio-lime hover:text-studio-ink mt-3 flex min-h-11 w-full items-center justify-center gap-2 border border-neutral-800 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase transition-colors"
            >
              <span>{footer.ctaLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={onOpenLogin}
              className="mt-2.5 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border border-neutral-700 bg-neutral-900 px-4 py-2 font-mono text-[11px] font-bold text-neutral-200 uppercase transition-colors hover:border-neutral-400"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Staff / Owner Login</span>
            </button>
          </div>
        </div>

        {/* Lower Divider & Copyright Row */}
        <div className="flex flex-col items-start justify-between gap-2 border-t border-neutral-800 pt-6 font-mono text-[11px] text-neutral-400 sm:flex-row sm:items-center">
          <p>{footer.copyright}</p>
          <p>{footer.phaseNote}</p>
        </div>
      </div>
    </footer>
  );
}
