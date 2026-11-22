import { lazy, Suspense, useState } from 'react';
import { ArrowRight, Camera, Expand } from 'lucide-react';

import { usePublishedGallery } from '@/features/admin/gallery/hooks/usePublishedGallery';

import { StudioImage } from './StudioImage';

const GalleryLightboxDialog = lazy(() => import('./GalleryLightboxDialog'));

export function GallerySection({ gallery }) {
  const { items: publishedItems, isLoading, error } = usePublishedGallery();
  const [activeIndex, setActiveIndex] = useState(null);

  const hasPhotos = !isLoading && !error && publishedItems.length > 0;
  const safeActiveIndex =
    hasPhotos && activeIndex !== null && activeIndex < publishedItems.length ? activeIndex : null;
  const isDialogOpen = safeActiveIndex !== null;

  const handleOpenIndex = (index) => {
    if (!hasPhotos) return;
    setActiveIndex(index);
  };

  const handlePrev = () => {
    if (!hasPhotos) return;
    setActiveIndex((prev) =>
      prev === null ? 0 : (prev - 1 + publishedItems.length) % publishedItems.length,
    );
  };

  const handleNext = () => {
    if (!hasPhotos) return;
    setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % publishedItems.length));
  };

  return (
    <section
      id="gallery"
      aria-labelledby="gallery-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-8 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Header Row */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div>
            <h2
              id="gallery-heading"
              className="font-display text-studio-ink text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl"
            >
              {gallery.heading}
            </h2>
            <p className="text-studio-muted-ink mt-2 hidden text-xs font-medium sm:block sm:text-sm">
              {gallery.subtitle}
            </p>
          </div>

          {hasPhotos ? (
            <button
              type="button"
              onClick={() => handleOpenIndex(0)}
              className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 self-start px-3.5 py-2 text-xs font-extrabold tracking-wider uppercase sm:min-h-11 sm:self-auto sm:px-4 sm:py-2.5"
            >
              <span>{gallery.ctaLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* State 1: Loading Skeleton */}
        {isLoading ? (
          <div
            data-testid="gallery-loading-skeleton"
            aria-busy="true"
            aria-label="Loading studio photographs"
            className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-5 lg:mt-10 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="brutal-card bg-studio-white flex flex-col justify-between overflow-hidden"
              >
                <div className="bg-studio-ink/10 aspect-[4/4.3] w-full animate-pulse" />
                <div className="border-studio-ink bg-studio-white border-t-2 px-2.5 py-2.5 sm:px-3.5 sm:py-3">
                  <div className="bg-studio-ink/15 h-2.5 w-20 animate-pulse" />
                  <div className="bg-studio-ink/20 mt-1.5 h-3.5 w-32 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* State 2: Error Fallback */}
        {!isLoading && error ? (
          <div
            role="status"
            data-testid="gallery-error-state"
            className="brutal-card bg-studio-white mt-5 p-6 text-center sm:mt-8 sm:p-10"
          >
            <p className="font-display text-studio-ink text-lg font-black uppercase sm:text-xl">
              Gallery Temporarily Unavailable
            </p>
            <p className="text-studio-muted-ink mx-auto mt-2 max-w-md text-xs leading-relaxed sm:text-sm">
              {error}
            </p>
          </div>
        ) : null}

        {/* State 3: Empty State */}
        {!isLoading && !error && publishedItems.length === 0 ? (
          <div
            data-testid="gallery-empty-state"
            className="brutal-card bg-studio-white mt-5 flex flex-col items-center justify-center p-6 text-center sm:mt-8 sm:p-12"
          >
            <div className="border-studio-ink bg-studio-lime flex h-11 w-11 items-center justify-center border-2">
              <Camera className="text-studio-ink h-5 w-5" aria-hidden="true" />
            </div>
            <p className="font-display text-studio-ink mt-3.5 text-xl font-black tracking-tight uppercase sm:text-2xl">
              {gallery.emptyTitle || 'Studio photos coming soon.'}
            </p>
            <p className="text-studio-muted-ink mt-1.5 max-w-md text-xs leading-relaxed sm:text-sm">
              {gallery.emptyDescription ||
                'Published 37 Music Studio photographs will appear here once curated by the studio owner.'}
            </p>
          </div>
        ) : null}

        {/* State 4: Published Responsive Photo Grid (2 cols mobile, 4 cols desktop) */}
        {hasPhotos ? (
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-5 lg:mt-10 lg:grid-cols-4">
            {publishedItems.map((item, index) => (
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
                  <span className="border-studio-ink bg-studio-white/95 text-studio-ink absolute right-2 bottom-2 hidden items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase shadow-[2px_2px_0px_#151515] sm:right-2.5 sm:bottom-2.5 sm:inline-flex sm:px-2 sm:py-1 sm:text-[10px]">
                    <Expand className="h-3 w-3" aria-hidden="true" />
                    <span>Inspect</span>
                  </span>
                </button>

                <figcaption className="border-studio-ink bg-studio-white border-t-2 px-2.5 py-2 sm:px-3.5 sm:py-3">
                  <p className="text-studio-muted-ink hidden font-mono text-[9px] font-bold tracking-wider uppercase sm:block sm:text-[10px]">
                    {item.category}
                  </p>
                  <p className="text-studio-ink text-xs leading-snug font-extrabold sm:mt-0.5 sm:text-sm">
                    {item.title}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </div>

      {/* Lazy-Loaded Accessible Enlarged Gallery Viewer Dialog */}
      {isDialogOpen ? (
        <Suspense fallback={null}>
          <GalleryLightboxDialog
            isOpen={isDialogOpen}
            activeIndex={safeActiveIndex}
            items={publishedItems}
            onClose={() => setActiveIndex(null)}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
