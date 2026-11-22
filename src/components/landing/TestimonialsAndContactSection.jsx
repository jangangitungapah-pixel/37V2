import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
} from 'lucide-react';
import { Link } from 'react-router';

import { resolveMapsHref, resolveWhatsAppHref } from '@/lib/external-links';

import { StudioImage } from './StudioImage';

export function TestimonialsAndContactSection({ testimonialsAndContact, finalCta, onNavigate }) {
  const { contact } = testimonialsAndContact;

  const mapsHref = resolveMapsHref(contact);
  const whatsappHref = resolveWhatsAppHref(finalCta.secondaryCta);

  const addressDisplay = contact.addressText || '';
  const hoursDisplay = contact.hoursText || '10:00 – 23:00 WIB';
  const contactDisplay = contact.contactText || '';

  return (
    <>
      {/* Section 09 — Studio Location & Hours (Legacy manual testimonials column removed) */}
      <section
        id="contact"
        aria-labelledby="contact-heading"
        className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Studio Location & Hours Column */}
            <div className="brutal-card-lg bg-studio-white text-studio-ink grid grid-cols-1 gap-6 p-5 sm:p-8 lg:col-span-12 lg:grid-cols-12 lg:items-center lg:gap-10">
              <div className="lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase">
                    {contact.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-lime border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {hoursDisplay}
                  </span>
                </div>

                <h2
                  id="contact-heading"
                  className="font-display text-studio-ink mt-2 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl"
                >
                  {contact.heading}
                </h2>

                <ul className="mt-4 space-y-3 text-xs sm:text-sm">
                  {addressDisplay ? (
                    <li className="flex items-start gap-2.5">
                      <MapPin
                        className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{addressDisplay}</span>
                    </li>
                  ) : null}
                  <li className="flex items-start gap-2.5">
                    <Clock
                      className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">
                      Studio sessions daily: {hoursDisplay} (Asia/Jakarta)
                    </span>
                  </li>
                  {contactDisplay ? (
                    <li className="flex items-start gap-2.5">
                      <Phone
                        className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-medium">{contactDisplay}</span>
                    </li>
                  ) : null}
                  {contact.email ? (
                    <li className="flex items-start gap-2.5">
                      <Mail
                        className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <a href={`mailto:${contact.email}`} className="font-medium hover:underline">
                        {contact.email}
                      </a>
                    </li>
                  ) : null}
                </ul>

                <div className="mt-5 flex flex-wrap gap-3">
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                    >
                      <span>{contact.mapCtaLabel}</span>
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  ) : null}

                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      <span>WhatsApp Studio</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Studio Exterior / Location Photograph */}
              <div className="border-studio-ink relative overflow-hidden border-2 lg:col-span-6">
                <StudioImage
                  src={contact.image.src}
                  alt={contact.image.alt}
                  width={contact.image.width}
                  height={contact.image.height}
                  fallbackLabel="37 Music Studio"
                  className="aspect-[16/9] w-full"
                />
                {contact.image.caption ? (
                  <p className="border-studio-ink bg-studio-ivory text-studio-muted-ink border-t-2 px-3 py-1.5 font-mono text-[11px] font-semibold">
                    {contact.image.caption}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 10 — Signal-Orange Final Conversion Statement */}
      <section
        aria-labelledby="final-cta-heading"
        className="border-studio-ink bg-studio-orange text-studio-white border-b-2 py-12 sm:py-20"
      >
        <div className="mx-auto max-w-[1680px] px-4 text-center sm:px-6 lg:px-8">
          <span className="border-studio-ink bg-studio-ink text-studio-white inline-block border px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
            {finalCta.eyebrow}
          </span>

          <h2
            id="final-cta-heading"
            className="font-display text-studio-white mx-auto mt-4 max-w-4xl text-4xl leading-[0.93] font-black tracking-tight uppercase sm:text-6xl lg:text-7xl"
          >
            {finalCta.headline}
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed font-medium text-white/95 sm:text-base">
            {finalCta.description}
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <a
              href={finalCta.primaryCta.href}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(finalCta.primaryCta.href);
              }}
              className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-12 w-full items-center justify-center gap-2 px-7 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
            >
              <span>{finalCta.primaryCta.label}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>

            <Link
              to="/availability"
              className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-12 w-full items-center justify-center gap-2 px-7 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              <span>CHECK AVAILABILITY</span>
            </Link>

            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>{finalCta.secondaryCta.label}</span>
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
