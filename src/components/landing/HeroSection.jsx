import { ArrowRight, AudioWaveform, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';

import { StudioImage } from './StudioImage';

export function HeroSection({ hero, ticker, onNavigate }) {
  const handleAnchorClick = (event, href) => {
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <>
      {/* Section 02 — Asymmetric 12-Column Editorial Hero */}
      <section
        id="top"
        aria-labelledby="hero-heading"
        className="border-studio-ink bg-studio-ivory relative scroll-mt-20 border-b-2 py-7 sm:py-14 lg:py-20"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left Column Group (7 cols): Oversized Editorial Typography + Primary Conversion Paths */}
            <div className="lg:col-span-7">
              {/* Editorial Index & Issue Markers */}
              <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
                {hero.badges.map((badge, badgeIndex) => (
                  <span
                    key={badge.id}
                    className={`${badgeIndex > 0 ? 'hidden sm:inline-flex' : 'inline-flex'} ${
                      badge.variant === 'lime'
                        ? 'border-studio-ink bg-studio-lime text-studio-ink items-center gap-1.5 border-[1.5px] px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]'
                        : 'border-studio-ink bg-studio-white text-studio-ink items-center gap-1.5 border-[1.5px] px-3 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]'
                    }`}
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
                className="font-display text-studio-ink flex flex-col items-start text-[2.75rem] leading-[0.89] font-black tracking-tight uppercase min-[375px]:text-[3.2rem] sm:text-7xl md:text-[5.25rem] lg:text-[6.25rem]"
              >
                <span>{hero.headline.lineOne}</span>
                <span className="bg-studio-ink text-studio-ivory mt-1.5 inline-block px-3.5 py-0.5 sm:px-5 sm:py-1">
                  {hero.headline.lineTwo}
                </span>
                <span className="text-studio-orange mt-1">{hero.headline.lineThree}</span>
              </h1>

              {/* Editorial Lead Copy with Left Structural Rule */}
              <p className="border-studio-ink text-studio-muted-ink mt-5 max-w-xl border-l-4 pl-4 text-sm leading-relaxed font-medium sm:mt-6 sm:text-lg">
                {hero.description}
              </p>

              {/* Primary & Secondary CTAs */}
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
                <a
                  href={hero.primaryCta.href}
                  onClick={(event) => handleAnchorClick(event, hero.primaryCta.href)}
                  className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-12 items-center justify-center gap-2.5 px-7 py-3 text-sm font-extrabold tracking-wider uppercase"
                >
                  <span>{hero.primaryCta.label}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>

                {hero.secondaryCta.isRoute || hero.secondaryCta.href.startsWith('/') ? (
                  <Link
                    to={hero.secondaryCta.href}
                    className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-12 items-center justify-center gap-2.5 px-7 py-3 text-sm font-extrabold tracking-wider uppercase"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    <span>{hero.secondaryCta.label}</span>
                  </Link>
                ) : (
                  <a
                    href={hero.secondaryCta.href}
                    onClick={(event) => handleAnchorClick(event, hero.secondaryCta.href)}
                    className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-12 items-center justify-center gap-2.5 px-7 py-3 text-sm font-extrabold tracking-wider uppercase"
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    <span>{hero.secondaryCta.label}</span>
                  </a>
                )}
              </div>

              {/* Clean Architectural Facts Row (Typography-Led, No Heavy Box Shadow) */}
              <dl
                aria-label="Studio preview highlights"
                className="border-studio-ink mt-8 grid grid-cols-3 border-t-2 pt-5 sm:mt-10"
              >
                {hero.facts.map((fact, idx) => (
                  <div
                    key={fact.id}
                    className={`${idx > 0 ? 'border-studio-ink/25 border-l pl-3 sm:pl-6' : 'pr-2'}`}
                  >
                    <dt className="text-studio-muted-ink font-mono text-[10px] leading-tight font-bold tracking-wider uppercase sm:text-xs">
                      {fact.label}
                    </dt>
                    <dd className="font-display text-studio-ink mt-1 text-2xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Right Column Group (5 cols): Editorial Photographic Frame */}
            <div className="relative lg:col-span-5">
              {hero.featuredPhoto.topSticker ? (
                <div className="border-studio-ink bg-studio-orange text-studio-white absolute -top-3 left-3 z-10 hidden border-2 px-3 py-1 font-mono text-[11px] font-bold tracking-wider uppercase shadow-[3px_3px_0px_#151515] sm:block">
                  {hero.featuredPhoto.topSticker}
                </div>
              ) : null}

              <div className="brutal-card-lg bg-studio-white overflow-hidden">
                <StudioImage
                  src={hero.featuredPhoto.src}
                  alt={hero.featuredPhoto.alt}
                  width={hero.featuredPhoto.width}
                  height={hero.featuredPhoto.height}
                  priority
                  fallbackLabel={hero.featuredPhoto.captionTitle || '37 Music Studio Live Floor'}
                  className="aspect-[16/11] w-full"
                />

                <div className="border-studio-ink bg-studio-ink text-studio-ivory flex flex-col justify-between gap-3 border-t-2 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div>
                    <p className="font-display text-lg leading-none font-black tracking-wide uppercase sm:text-2xl">
                      {hero.featuredPhoto.captionTitle}
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-300">
                      {hero.featuredPhoto.captionSubtitle}
                    </p>
                  </div>

                  <div className="border-studio-ivory/20 flex shrink-0 items-center gap-2 border bg-neutral-900 px-3 py-1.5">
                    <AudioWaveform className="text-studio-lime h-4 w-4" aria-hidden="true" />
                    <div className="text-left">
                      <p className="font-mono text-[10px] leading-tight font-extrabold text-white uppercase">
                        {hero.featuredPhoto.floatingBadgeTitle}
                      </p>
                      <p className="font-mono text-[9px] text-neutral-400">
                        {hero.featuredPhoto.floatingBadgeSubtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 03 — Acid-Lime Studio Statement Ticker */}
      <div
        aria-label="Studio session categories summary"
        className="border-studio-ink bg-studio-lime text-studio-ink border-b-2 py-2.5"
      >
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
            {ticker.items.map((item, idx) => (
              <li
                key={item}
                className={`${idx >= 3 ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-1.5`}
              >
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
