import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Clock, MapPin, MessageSquare, Phone, Star } from 'lucide-react';

import { StudioImage } from './StudioImage';

export function TestimonialsAndContactSection({ testimonialsAndContact, finalCta, onNavigate }) {
  const [mapNoticeVisible, setMapNoticeVisible] = useState(false);
  const [whatsappNotice, setWhatsappNotice] = useState('');

  const { testimonials, contact } = testimonialsAndContact;

  const handleOpenMaps = () => {
    if (!contact.isAddressConfirmed) {
      setMapNoticeVisible(true);
    }
  };

  const handleSecondaryWhatsApp = () => {
    if (!finalCta.secondaryCta.isConfirmed) {
      setWhatsappNotice(finalCta.secondaryCta.pendingNotice);
      onNavigate('#booking');
    }
  };

  return (
    <>
      {/* Section 09 — Acid-Lime Testimonials + Location / Contact Card */}
      <section
        id="contact"
        aria-labelledby="contact-heading"
        className="border-studio-ink bg-studio-ivory border-b-2 py-12 sm:py-16 lg:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12">
            {/* Left Panel: Acid-Lime Testimonials Surface */}
            <div className="brutal-card-lg bg-studio-lime text-studio-ink flex flex-col justify-between p-6 sm:p-8 lg:col-span-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
                    {testimonials.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-white border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                    DEMO PREVIEW
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {testimonials.items.map((item) => (
                    <article
                      key={item.id}
                      className="brutal-card bg-studio-white flex flex-col justify-between p-5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="text-studio-ink flex items-center gap-0.5"
                            aria-label="5 out of 5 stars sample layout"
                          >
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star
                                key={starIndex}
                                className="h-3.5 w-3.5 fill-current"
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <span className="border-studio-ink bg-studio-ivory border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                            {item.badge}
                          </span>
                        </div>

                        <p className="text-studio-ink mt-3.5 text-sm leading-relaxed font-medium">
                          {item.quote}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center gap-2.5 border-t border-neutral-200 pt-3">
                        <span
                          className="border-studio-ink bg-studio-ivory flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-extrabold"
                          aria-hidden="true"
                        >
                          37
                        </span>
                        <div>
                          <p className="text-xs font-extrabold">{item.author}</p>
                          <p className="text-studio-muted-ink font-mono text-[10px]">{item.role}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <p className="border-studio-ink bg-studio-white/85 mt-6 border px-3.5 py-2.5 font-mono text-[11px] font-semibold">
                Note: Quotes above are clearly labeled layout placeholders. Real artist endorsements
                will be published only after studio owner confirmation.
              </p>
            </div>

            {/* Right Panel: White Location & Contact Card */}
            <div className="brutal-card-lg bg-studio-white text-studio-ink flex flex-col justify-between p-6 sm:p-8 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-studio-muted-ink font-mono text-[11px] font-bold tracking-wider uppercase">
                    {contact.eyebrow}
                  </span>
                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {contact.statusBadge}
                  </span>
                </div>

                <h2
                  id="contact-heading"
                  className="font-display text-studio-ink mt-2 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl"
                >
                  {contact.heading}
                </h2>

                <ul className="mt-4 space-y-2.5 text-xs sm:text-sm">
                  <li className="flex items-start gap-2.5">
                    <MapPin
                      className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{contact.addressLabel}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock
                      className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{contact.hoursLabel}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Phone
                      className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{contact.contactLabel}</span>
                  </li>
                </ul>

                {/* Architectural Preview Image */}
                <div className="border-studio-ink mt-5 overflow-hidden border-2">
                  <StudioImage
                    src={contact.image.src}
                    alt={contact.image.alt}
                    width={contact.image.width}
                    height={contact.image.height}
                    className="aspect-[16/9] w-full"
                  />
                </div>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleOpenMaps}
                  className="brutal-btn bg-studio-ivory text-studio-ink flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase"
                >
                  <span>{contact.mapCtaLabel}</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>

                {mapNoticeVisible ? (
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
        className="border-studio-ink bg-studio-ivory border-b-2 py-12 sm:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="brutal-card-lg bg-studio-orange text-studio-white px-5 py-10 text-center sm:px-10 sm:py-14">
            <span className="border-studio-ink bg-studio-ink text-studio-white inline-block border px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase">
              {finalCta.eyebrow}
            </span>

            <h2
              id="final-cta-heading"
              className="font-display text-studio-white mx-auto mt-4 max-w-4xl text-4xl leading-[0.95] font-black tracking-tight uppercase sm:text-6xl lg:text-7xl"
            >
              {finalCta.headline}
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed font-medium text-white/95 sm:text-base">
              {finalCta.description}
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

              <button
                type="button"
                onClick={handleSecondaryWhatsApp}
                className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 px-6 py-3 text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:text-sm"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>{finalCta.secondaryCta.label}</span>
              </button>
            </div>

            {whatsappNotice ? (
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
