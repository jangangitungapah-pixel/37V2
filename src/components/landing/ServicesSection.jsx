import { ArrowRight, Check, Disc3, Mic2, SlidersHorizontal } from 'lucide-react';

const SERVICE_ICONS = {
  drum: Disc3,
  mic: Mic2,
  sliders: SlidersHorizontal,
};

function getBadgeClasses(variant) {
  if (variant === 'lime') {
    return 'border-studio-ink bg-studio-lime text-studio-ink';
  }
  if (variant === 'orange') {
    return 'border-studio-ink bg-studio-orange text-studio-white';
  }
  return 'border-studio-ink bg-studio-ink text-studio-white';
}

/**
 * SECTION 04 — SERVICES: PICK YOUR SESSION
 * Editorial numbered service index (`01`, `02`, `03`) with asymmetrical horizontal rows
 * rather than three identical cardboard boxes.
 */
export function ServicesSection({ services, onSelectService }) {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Editorial Section Header */}
        <div className="border-studio-ink flex flex-col justify-between gap-4 border-b-2 pb-6 lg:flex-row lg:items-end lg:pb-8">
          <div>
            <span className="bg-studio-ink text-studio-white inline-block px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
              {services.eyebrow}
            </span>
            <h2
              id="services-heading"
              className="font-display text-studio-ink mt-3 text-4xl leading-none font-black tracking-tight uppercase sm:text-6xl"
            >
              {services.heading}
            </h2>
          </div>

          <p className="border-studio-orange text-studio-muted-ink max-w-md border-l-4 pl-3.5 text-xs leading-relaxed font-medium sm:text-sm">
            {services.intro}
          </p>
        </div>

        {/* Editorial Numbered Service Index Rows */}
        <div className="divide-studio-ink divide-y-2">
          {services.items.map((service) => {
            const IconComponent = SERVICE_ICONS[service.icon] || Disc3;

            return (
              <article
                key={service.id}
                className="group grid grid-cols-1 items-start gap-5 py-6 transition-colors sm:py-8 lg:grid-cols-12 lg:items-center lg:gap-8"
              >
                {/* Col 1-4: Oversized Index Number + Service Title + Category Badge */}
                <div className="flex items-start gap-4 lg:col-span-4">
                  <span className="font-display text-studio-ink text-4xl leading-none font-black sm:text-6xl">
                    {service.number}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${getBadgeClasses(service.badgeVariant)}`}
                      >
                        {service.badge}
                      </span>
                      <span className="border-studio-ink bg-studio-white inline-flex h-6 w-6 items-center justify-center border">
                        <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="font-display text-studio-ink mt-1.5 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      {service.title}
                    </h3>
                  </div>
                </div>

                {/* Col 5-9: Editorial Description + Draft Scope Bullets */}
                <div className="space-y-3 lg:col-span-5">
                  <p className="text-studio-muted-ink text-sm leading-relaxed font-medium">
                    {service.description}
                  </p>

                  <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="text-studio-ink inline-flex items-center gap-1.5 font-mono text-xs font-semibold"
                      >
                        <Check
                          className="text-studio-orange h-3.5 w-3.5 shrink-0 stroke-[2.5]"
                          aria-hidden="true"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Col 10-12: Single Conversion CTA per Service */}
                <div className="flex lg:col-span-3 lg:justify-end">
                  <button
                    type="button"
                    aria-label={`${service.ctaLabel} — ${service.title}`}
                    onClick={() => onSelectService(service.id, service.defaultRoom)}
                    className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left font-mono text-xs font-extrabold tracking-wider uppercase sm:w-auto sm:min-w-52"
                  >
                    <span>{service.ctaLabel}</span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
