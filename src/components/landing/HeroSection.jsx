import { ArrowRight, AudioWaveform, CheckCircle2, Play } from 'lucide-react';

import { StudioImage } from './StudioImage';

export function HeroSection({ hero, ticker, onNavigate }) {
  const handleAnchorClick = (event, href) => {
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <>
      {/* Section 03 — Asymmetric Editorial Hero */}
      <section
        id="top"
        aria-labelledby="hero-heading"
        className="border-studio-ink bg-studio-ivory relative scroll-mt-20 border-b-2 py-8 sm:py-12 lg:py-16"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left Top: Badges, Poster Headline, Copy, Primary & Secondary CTAs */}
            <div className="lg:col-span-7 lg:row-start-1">
              {/* Pill Information Badges */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {hero.badges.map((badge) => (
                  <span
                    key={badge.id}
                    className={
                      badge.variant === 'lime'
                        ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase shadow-[2px_2px_0px_#151515] sm:text-[11px]'
                        : 'border-studio-ink bg-studio-white text-studio-ink inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase shadow-[2px_2px_0px_#151515] sm:text-[11px]'
                    }
                  >
                    {badge.hasDot ? (
                      <span
                        className="bg-studio-lime border-studio-ink inline-block h-2 w-2 rounded-full border"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span>{badge.label}</span>
                  </span>
                ))}
              </div>

              {/* Poster-Scale Condensed Display Headline */}
              <h1
                id="hero-heading"
                className="font-display text-studio-ink flex flex-col items-start text-[2.75rem] leading-[0.92] font-black tracking-tight uppercase min-[375px]:text-[3.1rem] sm:text-6xl md:text-7xl lg:text-[5.25rem]"
              >
                <span>{hero.headline.lineOne}</span>
                <span className="bg-studio-ink text-studio-ivory mt-1 inline-block px-3 py-0.5 sm:px-4 sm:py-1">
                  {hero.headline.lineTwo}
                </span>
                <span className="text-studio-orange mt-1">{hero.headline.lineThree}</span>
              </h1>

              {/* Supporting Paragraph */}
              <p className="text-studio-muted-ink mt-5 max-w-xl text-base leading-relaxed font-medium sm:text-lg">
                {hero.description}
              </p>

              {/* Hero CTAs */}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={hero.primaryCta.href}
                  onClick={(event) => handleAnchorClick(event, hero.primaryCta.href)}
                  className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-extrabold tracking-wider uppercase"
                >
                  <span>{hero.primaryCta.label}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>

                <a
                  href={hero.secondaryCta.href}
                  onClick={(event) => handleAnchorClick(event, hero.secondaryCta.href)}
                  className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 text-sm font-extrabold tracking-wider uppercase"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>{hero.secondaryCta.label}</span>
                </a>
              </div>
            </div>

            {/* Right Column on Desktop / Middle on Mobile: Framed Studio Asset Card */}
            <div className="relative lg:col-span-5 lg:row-span-2 lg:row-start-1">
              {/* Overlapping Top-Left Sticker */}
              <div className="border-studio-ink bg-studio-orange text-studio-white absolute -top-3 left-3 z-10 -rotate-3 border-2 px-3 py-1 font-mono text-[11px] font-bold tracking-wider uppercase shadow-[3px_3px_0px_#151515] sm:-left-3">
                {hero.featuredPhoto.topSticker}
              </div>

              <div className="brutal-card-lg bg-studio-white overflow-hidden">
                <div className="relative">
                  <span className="border-studio-ink bg-studio-white/95 text-studio-ink absolute top-3 right-3 z-10 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_#151515]">
                    {hero.featuredPhoto.demoTagLabel}
                  </span>
                  <StudioImage
                    src={hero.featuredPhoto.src}
                    alt={hero.featuredPhoto.alt}
                    width={hero.featuredPhoto.width}
                    height={hero.featuredPhoto.height}
                    priority
                    className="aspect-[16/11] w-full"
                  />
                </div>

                <div className="border-studio-ink bg-studio-white border-t-2 px-4 py-3.5 sm:px-5 sm:pr-60">
                  <p className="font-display text-lg leading-none font-black tracking-wide uppercase sm:text-xl">
                    {hero.featuredPhoto.captionTitle}
                  </p>
                  <p className="text-studio-muted-ink mt-1 text-xs font-medium">
                    {hero.featuredPhoto.captionSubtitle}
                  </p>
                </div>
              </div>

              {/* Overlapping Bottom-Right Demo Note Badge */}
              <div className="border-studio-ink bg-studio-white mt-3 inline-flex items-center gap-2.5 border-2 px-3 py-2 shadow-[3px_3px_0px_#151515] sm:absolute sm:right-2 sm:-bottom-6 sm:mt-0 sm:rotate-1">
                <span className="border-studio-ink bg-studio-lime flex h-8 w-8 shrink-0 items-center justify-center border">
                  <AudioWaveform className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="text-left">
                  <p className="text-xs leading-tight font-extrabold uppercase">
                    {hero.featuredPhoto.floatingBadgeTitle}
                  </p>
                  <p className="text-studio-muted-ink font-mono text-[10px]">
                    {hero.featuredPhoto.floatingBadgeSubtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Left Bottom on Desktop / Bottom on Mobile: 3-Part Preview Strip */}
            <div className="lg:col-span-7 lg:row-start-2">
              <dl
                aria-label="Studio preview highlights"
                className="brutal-card bg-studio-white grid grid-cols-1 divide-y-2 divide-[#151515] sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0"
              >
                {hero.facts.map((fact) => (
                  <div
                    key={fact.id}
                    className={
                      fact.highlight
                        ? 'bg-studio-lime flex flex-col items-center justify-center px-4 py-3.5 text-center'
                        : 'bg-studio-white flex flex-col items-center justify-center px-4 py-3.5 text-center'
                    }
                  >
                    <dt className="order-2 mt-1 font-mono text-[10px] font-bold tracking-wider uppercase">
                      {fact.label}
                    </dt>
                    <dd className="font-display order-1 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Section 04 — Acid-Lime Service Ticker / Divider */}
      <div
        aria-label="Studio session categories summary"
        className="border-studio-ink bg-studio-lime text-studio-ink border-b-2 py-2.5"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase">
            {ticker.items.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
