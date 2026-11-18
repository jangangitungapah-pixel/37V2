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

export function ServicesSection({ services, onSelectService }) {
  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="border-studio-ink bg-studio-ivory border-b-2 py-12 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header Row */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="bg-studio-ink text-studio-white inline-block px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase">
              {services.eyebrow}
            </span>
            <h2
              id="services-heading"
              className="font-display text-studio-ink mt-3 text-4xl leading-none font-black tracking-tight uppercase sm:text-5xl"
            >
              {services.heading}
            </h2>
          </div>

          <p className="border-studio-orange text-studio-muted-ink max-w-md border-l-4 pl-3.5 text-sm leading-relaxed font-medium">
            {services.intro}
          </p>
        </div>

        {/* Three Numbered Service Cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:mt-10 lg:grid-cols-3">
          {services.items.map((service) => {
            const IconComponent = SERVICE_ICONS[service.icon] || Disc3;

            return (
              <article
                key={service.id}
                className="brutal-card-lg bg-studio-white flex flex-col justify-between p-5 sm:p-6"
              >
                <div>
                  {/* Card Top Row: Number + Category Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xl font-extrabold tracking-tight">
                      {service.number}
                    </span>
                    <span
                      className={`border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${getBadgeClasses(service.badgeVariant)}`}
                    >
                      {service.badge}
                    </span>
                  </div>

                  {/* Icon Tile + Service Title */}
                  <div className="mt-4 flex items-center gap-3">
                    <span className="border-studio-ink bg-studio-ivory flex h-10 w-10 shrink-0 items-center justify-center border-2">
                      <IconComponent className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-display text-2xl leading-none font-black tracking-tight uppercase sm:text-3xl">
                      {service.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-studio-muted-ink mt-3.5 text-sm leading-relaxed">
                    {service.description}
                  </p>

                  {/* Feature Bullet List */}
                  <ul className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="text-studio-ink flex items-start gap-2 text-xs font-semibold sm:text-sm"
                      >
                        <Check
                          className="text-studio-orange mt-0.5 h-4 w-4 shrink-0 stroke-[2.5]"
                          aria-hidden="true"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom Action Row */}
                <div className="border-studio-ink mt-6 border-t-2 pt-4">
                  <button
                    type="button"
                    onClick={() => onSelectService(service.id, service.defaultRoom)}
                    className="group text-studio-ink hover:bg-studio-lime flex min-h-11 w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-xs font-extrabold tracking-wider uppercase transition-colors sm:text-sm"
                  >
                    <span>
                      {service.ctaLabel} — {service.title}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
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
