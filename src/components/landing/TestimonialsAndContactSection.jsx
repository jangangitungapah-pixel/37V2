import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Quote,
  Star,
} from 'lucide-react';
import { Link } from 'react-router';

import { resolveMapsHref, resolveWhatsAppHref } from '@/lib/external-links';

import { StudioImage } from './StudioImage';

export function TestimonialsAndContactSection({ testimonialsAndContact, finalCta, onNavigate }) {
  const [mapNoticeVisible, setMapNoticeVisible] = useState(false);
  const [whatsappNotice, setWhatsappNotice] = useState('');

  const { testimonials, contact } = testimonialsAndContact;

  const mapsHref = resolveMapsHref(contact);
  const whatsappHref = resolveWhatsAppHref(finalCta.secondaryCta);

  const addressDisplay =
    contact.isAddressConfirmed && contact.addressText
      ? contact.addressText
      : contact.addressPendingLabel;
  const hoursDisplay =
    contact.isHoursConfirmed && contact.hoursText ? contact.hoursText : contact.hoursPendingLabel;
  const contactDisplay =
    contact.isContactConfirmed && contact.contactText
      ? contact.contactText
      : contact.contactPendingLabel;

  const handlePendingMaps = () => {
    setMapNoticeVisible(true);
  };

  const handlePendingWhatsApp = () => {
    setWhatsappNotice(finalCta.secondaryCta.pendingNotice);
    onNavigate('#booking');
  };

  return (
    <>
      {/* Section 09 — Editorial Artist Notes + Studio Location & Hours */}
      <section
        id="contact"
        aria-labelledby="contact-heading"
        className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column (7 cols): Acid-Lime Editorial Notes Block */}
            <div className="border-studio-ink bg-studio-lime text-studio-ink flex flex-col justify-between border-2 p-5 sm:p-8 lg:col-span-7">
              <div>
                <div className="border-studio-ink flex flex-wrap items-center justify-between gap-2 border-b-2 pb-4">
                  <span className="font-mono text-xs font-extrabold tracking-wider uppercase">
                    {testimonials.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-white border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {testimonials.isVerified ? 'VERIFIED QUOTES' : 'DEMO PREVIEW'}
                  </span>
                </div>

                <div className="divide-studio-ink/25 divide-y">
                  {testimonials.items.map((item) => {
                    const showVerifiedRating =
                      testimonials.isVerified &&
                      typeof item.rating === 'number' &&
                      item.rating >= 1 &&
                      item.rating <= 5;

                    return (
                      <article key={item.id} className="py-5 first:pt-5 last:pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {showVerifiedRating ? (
                            <div
                              className="text-studio-ink flex items-center gap-0.5"
                              aria-label={`Rated ${item.rating} out of 5`}
                            >
                              {Array.from({ length: item.rating }).map((_, starIndex) => (
                                <Star
                                  key={starIndex}
                                  className="h-3.5 w-3.5 fill-current"
                                  aria-hidden="true"
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-studio-ink inline-flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
                              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>UNVERIFIED SLOT</span>
                            </span>
                          )}
                          <span className="border-studio-ink bg-studio-white border px-2 py-0.5 font-mono text-[9px] font-bold uppercase">
                            {item.badge}
                          </span>
                        </div>

                        <p className="text-studio-ink mt-2.5 text-sm leading-relaxed font-semibold sm:text-base">
                          “{item.quote}”
                        </p>

                        <div className="mt-3 flex items-center gap-2.5">
                          <span
                            className="border-studio-ink bg-studio-ink text-studio-lime flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] font-extrabold"
                            aria-hidden="true"
                          >
                            37
                          </span>
                          <div>
                            <p className="text-xs font-extrabold uppercase">{item.author}</p>
                            <p className="text-studio-ink/80 font-mono text-[10px]">{item.role}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {!testimonials.isVerified && testimonials.demoNotice ? (
                <p className="border-studio-ink bg-studio-white/90 mt-5 border px-3.5 py-2.5 font-mono text-[11px] font-semibold">
                  {testimonials.demoNotice}
                </p>
              ) : null}
            </div>

            {/* Right Column (5 cols): Studio Location & Hours */}
            <div className="brutal-card-lg bg-studio-white text-studio-ink flex flex-col justify-between p-5 sm:p-8 lg:col-span-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase">
                    {contact.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {contact.isAddressConfirmed &&
                    contact.isHoursConfirmed &&
                    contact.isContactConfirmed
                      ? 'VERIFIED INFO'
                      : contact.statusBadge}
                  </span>
                </div>

                <h2
                  id="contact-heading"
                  className="font-display text-studio-ink mt-2 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl"
                >
                  {contact.heading}
                </h2>

                <ul className="mt-4 space-y-3 text-xs sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <MapPin
                      className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{addressDisplay}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock
                      className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{hoursDisplay}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Phone
                      className="text-studio-error-ink mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{contactDisplay}</span>
                  </li>
                </ul>

                {/* Studio Exterior / Location Photograph */}
                <div className="border-studio-ink relative mt-5 overflow-hidden border-2">
                  <StudioImage
                    src={contact.image.src}
                    alt={contact.image.alt}
                    width={contact.image.width}
                    height={contact.image.height}
                    fallbackLabel="Studio Exterior & Location"
                    className="aspect-[16/9] w-full"
                  />
                  {contact.image.caption ? (
                    <p className="border-studio-ink bg-studio-ivory text-studio-muted-ink border-t-2 px-3 py-1.5 font-mono text-[11px] font-semibold">
                      {contact.image.caption}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5">
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brutal-btn bg-studio-ivory text-studio-ink flex min-h-11 w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                  >
                    <span>{contact.mapCtaLabel}</span>
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handlePendingMaps}
                    className="brutal-btn bg-studio-ivory text-studio-ink flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                  >
                    <span>{contact.mapCtaLabel}</span>
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}

                {!mapsHref && mapNoticeVisible ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="border-studio-ink bg-studio-lime text-studio-ink mt-3 border-[1.5px] p-3 text-xs leading-relaxed font-semibold"
                  >
                    {contact.mapPendingNotice}
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
            ) : (
              <button
                type="button"
                onClick={handlePendingWhatsApp}
                className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>{finalCta.secondaryCta.label}</span>
              </button>
            )}
          </div>

          {!whatsappHref && whatsappNotice ? (
            <p
              role="status"
              aria-live="polite"
              className="border-studio-ink bg-studio-ivory text-studio-ink mx-auto mt-4 max-w-lg border-2 px-4 py-2.5 text-xs font-bold"
            >
              {whatsappNotice}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
