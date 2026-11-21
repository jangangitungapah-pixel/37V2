import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Quote,
  Star,
} from 'lucide-react';

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
      {/* Section 09 — Acid-Lime Testimonials + Location / Contact Card */}
      <section
        id="contact"
        aria-labelledby="contact-heading"
        className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-8 sm:py-16 lg:py-20"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:gap-7 lg:grid-cols-12">
            {/* Left Panel: Acid-Lime Testimonials Surface */}
            <div className="brutal-card-lg bg-studio-lime text-studio-ink flex flex-col justify-between p-4 sm:p-8 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
                    {testimonials.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-white hidden border px-2 py-0.5 font-mono text-[10px] font-bold uppercase sm:inline-block">
                    {testimonials.isVerified ? 'VERIFIED QUOTES' : 'DEMO PREVIEW'}
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2">
                  {testimonials.items.map((item, itemIndex) => {
                    const showVerifiedRating =
                      testimonials.isVerified &&
                      typeof item.rating === 'number' &&
                      item.rating >= 1 &&
                      item.rating <= 5;

                    return (
                      <article
                        key={item.id}
                        className={`brutal-card bg-studio-white ${itemIndex > 0 ? 'hidden md:flex' : 'flex'} flex-col justify-between p-3.5 sm:p-5`}
                      >
                        <div>
                          <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
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
                              <span className="text-studio-muted-ink inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase">
                                <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>UNVERIFIED</span>
                              </span>
                            )}
                            <span className="border-studio-ink bg-studio-ivory border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                              {item.badge}
                            </span>
                          </div>

                          <p className="text-studio-ink text-sm leading-relaxed font-medium sm:mt-3.5">
                            {item.quote}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center gap-2.5 border-t border-neutral-200 pt-2.5 sm:mt-4 sm:pt-3">
                          <span
                            className="border-studio-ink bg-studio-ivory flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-extrabold"
                            aria-hidden="true"
                          >
                            37
                          </span>
                          <div>
                            <p className="text-xs font-extrabold">{item.author}</p>
                            <p className="text-studio-muted-ink font-mono text-[10px]">
                              {item.role}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {!testimonials.isVerified && testimonials.demoNotice ? (
                <p className="border-studio-ink bg-studio-white/85 mt-6 hidden border px-3.5 py-2.5 font-mono text-[11px] font-semibold sm:block">
                  {testimonials.demoNotice}
                </p>
              ) : null}
            </div>

            {/* Right Panel: White Location & Contact Card */}
            <div className="brutal-card-lg bg-studio-white text-studio-ink flex flex-col justify-between p-4 sm:p-8 lg:col-span-5">
              <div>
                <div className="hidden flex-wrap items-center justify-between gap-2 sm:flex">
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
                  className="font-display text-studio-ink mt-0 text-3xl leading-none font-black tracking-tight uppercase sm:mt-2 sm:text-4xl"
                >
                  {contact.heading}
                </h2>

                <ul className="mt-3 space-y-2 text-xs sm:mt-4 sm:space-y-2.5 sm:text-sm">
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

                {/* Architectural Preview Image */}
                <div className="border-studio-ink relative mt-5 hidden overflow-hidden border-2 sm:block">
                  {contact.image.isDemoAsset ? (
                    <span className="border-studio-ink bg-studio-white/95 text-studio-ink absolute top-2.5 right-2.5 z-10 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_#151515]">
                      DEMO ASSET
                    </span>
                  ) : null}
                  <StudioImage
                    src={contact.image.src}
                    alt={contact.image.alt}
                    width={contact.image.width}
                    height={contact.image.height}
                    className="aspect-[16/9] w-full"
                  />
                </div>
              </div>

              <div className="mt-4 sm:mt-5">
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

      {/* Section 10 — Full-Width Signal-Orange Final CTA Panel */}
      <section
        aria-labelledby="final-cta-heading"
        className="border-studio-ink bg-studio-ivory border-b-2 py-8 sm:py-16"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="brutal-card-lg bg-studio-orange text-studio-white px-4 py-7 text-center sm:px-10 sm:py-14">
            <span className="border-studio-ink bg-studio-ink text-studio-white hidden border px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:inline-block">
              {finalCta.eyebrow}
            </span>

            <h2
              id="final-cta-heading"
              className="font-display text-studio-white mx-auto mt-0 max-w-4xl text-3xl leading-[0.95] font-black tracking-tight uppercase sm:mt-4 sm:text-6xl lg:text-7xl"
            >
              {finalCta.headline}
            </h2>

            <p className="mx-auto mt-4 hidden max-w-xl text-sm leading-relaxed font-medium text-white/95 sm:block sm:text-base">
              {finalCta.description}
            </p>

            <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:mt-7 sm:flex-row sm:gap-3">
              <a
                href={finalCta.primaryCta.href}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(finalCta.primaryCta.href);
                }}
                className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
              >
                <span>{finalCta.primaryCta.label}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>

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
        </div>
      </section>
    </>
  );
}
