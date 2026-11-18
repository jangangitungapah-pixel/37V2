import { lazy, Suspense, useState } from 'react';
import { ArrowRight, Expand } from 'lucide-react';

import { StudioImage } from './StudioImage';

const GalleryLightboxDialog = lazy(() => import('./GalleryLightboxDialog'));

export function GallerySection({ gallery }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const isDialogOpen = activeIndex !== null;

  const handleOpenIndex = (index) => {
    setActiveIndex(index);
  };

  const handlePrev = () => {
    setActiveIndex((prev) =>
      prev === null ? 0 : (prev - 1 + gallery.items.length) % gallery.items.length,
    );
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % gallery.items.length));
  };

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="border-studio-ink bg-studio-ivory border-b-2 py-12 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header Row */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2
              id="gallery-heading"
              className="font-display text-studio-ink text-4xl leading-none font-black tracking-tight uppercase sm:text-5xl"
            >
              {gallery.heading}
            </h2>
            <p className="text-studio-muted-ink mt-2 text-xs font-medium sm:text-sm">
              {gallery.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenIndex(0)}
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 self-start px-4 py-2.5 text-xs font-extrabold tracking-wider uppercase sm:self-auto"
          >
            <span>{gallery.ctaLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Four-Photo Grid */}
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
          {gallery.items.map((item, index) => (
            <figure
              key={item.id}
              className="brutal-card bg-studio-white group flex flex-col justify-between overflow-hidden"
            >
              <button
                type="button"
                onClick={() => handleOpenIndex(index)}
                aria-label={`Enlarge gallery image: ${item.title}`}
                className="relative block w-full cursor-pointer text-left"
              >
                <StudioImage
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  className="aspect-[4/4.3] w-full"
                />
                <span className="border-studio-ink bg-studio-white/95 text-studio-ink absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0px_#151515]">
                  <Expand className="h-3 w-3" aria-hidden="true" />
                  <span>Inspect</span>
                </span>
              </button>

              <figcaption className="border-studio-ink bg-studio-white border-t-2 px-3.5 py-3">
                <p className="text-studio-muted-ink font-mono text-[10px] font-bold tracking-wider uppercase">
                  {item.category}
                </p>
                <p className="text-studio-ink mt-0.5 text-xs font-extrabold sm:text-sm">
                  {item.title}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* Lazy-Loaded Accessible Enlarged Gallery Viewer Dialog */}
      {isDialogOpen ? (
        <Suspense fallback={null}>
          <GalleryLightboxDialog
            isOpen={isDialogOpen}
            activeIndex={activeIndex}
            items={gallery.items}
            onClose={() => setActiveIndex(null)}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
