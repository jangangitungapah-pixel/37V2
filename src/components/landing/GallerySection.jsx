import { lazy, Suspense, useMemo, useState } from 'react';
import { ArrowRight, Camera, Expand } from 'lucide-react';

import { usePublishedGallery } from '@/features/admin/gallery/hooks/usePublishedGallery';

import { StudioImage } from './StudioImage';

const GalleryLightboxDialog = lazy(() => import('./GalleryLightboxDialog'));

/**
 * SECTION 06 — GALLERY: PROOF, NOT RENDERS
 * Displays only published studio photographs from `usePublishedGallery()`,
 * deduplicated by photo identity so a single image is never repeated to fill a grid.
 */
export function GallerySection({ gallery }) {
  const { items: rawPublishedItems, isLoading, error } = usePublishedGallery();
  const [activeIndex, setActiveIndex] = useState(null);

  // Deduplicate published items by ID and canonical image URL so repeated assets do not clutter the grid
  const publishedItems = useMemo(() => {
    const seenIds = new Set();
    const seenUrls = new Set();
    const result = [];
    for (const item of rawPublishedItems || []) {
      if (!item?.id || seenIds.has(item.id)) continue;
      const cleanUrl = String(item.src || item.secureUrl || '').trim();
      if (cleanUrl && seenUrls.has(cleanUrl)) continue;
      seenIds.add(item.id);
      if (cleanUrl) seenUrls.add(cleanUrl);
      result.push(item);
    }
    return result;
  }, [rawPublishedItems]);

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
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Editorial Section Header */}
        <div className="border-studio-ink flex flex-col justify-between gap-4 border-b-2 pb-6 sm:flex-row sm:items-end">
          <div>
            <span className="bg-studio-ink text-studio-white inline-block px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
              {gallery.eyebrow || 'INSIDE THE STUDIO'}
            </span>
            <h2
              id="gallery-heading"
              className="font-display text-studio-ink mt-3 text-4xl leading-none font-black tracking-tight uppercase sm:text-6xl"
            >
              {gallery.heading}
            </h2>
            <p className="text-studio-muted-ink mt-2 max-w-xl text-xs font-medium sm:text-sm">
              {gallery.subtitle}
            </p>
          </div>

          {hasPhotos ? (
            <button
              type="button"
              onClick={() => handleOpenIndex(0)}
              className="brutal-btn bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 self-start px-4 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase sm:self-auto"
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
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[0, 1, 2, 3].map((slot) => (
              <div
                key={slot}
                className="border-studio-ink bg-studio-white flex flex-col justify-between overflow-hidden border-2"
              >
                <div className="bg-studio-ink/10 aspect-[4/3] w-full animate-pulse" />
                <div className="border-studio-ink bg-studio-white border-t-2 px-3.5 py-3">
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
            className="border-studio-ink bg-studio-white mt-8 border-2 p-6 text-center sm:p-10"
          >
            <p className="font-display text-studio-ink text-xl font-black uppercase sm:text-2xl">
              Gallery Temporarily Unavailable
            </p>
            <p className="text-studio-muted-ink mx-auto mt-2 max-w-md text-xs leading-relaxed sm:text-sm">
              {error}
            </p>
          </div>
        ) : null}

        {/* State 3: Intentional Editorial Empty State */}
        {!isLoading && !error && publishedItems.length === 0 ? (
          <div
            data-testid="gallery-empty-state"
            className="border-studio-ink bg-studio-white mt-8 flex flex-col items-center justify-center border-2 p-8 text-center sm:p-14"
          >
            <div className="border-studio-ink bg-studio-lime flex h-12 w-12 items-center justify-center border-2 shadow-[2px_2px_0px_#151515]">
              <Camera className="text-studio-ink h-5 w-5" aria-hidden="true" />
            </div>
            <p className="font-display text-studio-ink mt-4 text-2xl font-black tracking-tight uppercase sm:text-3xl">
              {gallery.emptyTitle || 'Studio photos coming soon.'}
            </p>
            <p className="text-studio-muted-ink mt-2 max-w-md text-xs leading-relaxed sm:text-sm">
              {gallery.emptyDescription ||
                'Published 37 Music Studio photographs will appear here once curated by the studio owner.'}
            </p>
          </div>
        ) : null}

        {/* State 4: Editorial Photo Spread */}
        {hasPhotos ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
            {publishedItems.map((item, index) => {
              // Editorial magazine hierarchy: first photo takes a wider lead frame when 3+ photos exist
              const isLeadFrame = index === 0 && publishedItems.length >= 3;
              const colSpanClass = isLeadFrame
                ? 'sm:col-span-2 lg:col-span-6'
                : publishedItems.length === 1
                  ? 'sm:col-span-2 lg:col-span-8'
                  : publishedItems.length === 2
                    ? 'lg:col-span-6'
                    : 'lg:col-span-3';

              return (
                <figure
                  key={item.id}
                  className={`border-studio-ink bg-studio-white group flex flex-col justify-between overflow-hidden border-2 shadow-[4px_4px_0px_#151515] ${colSpanClass}`}
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
                      fallbackLabel={item.title}
                      className={isLeadFrame ? 'aspect-[16/10] w-full' : 'aspect-[4/3] w-full'}
                    />
                    <span className="border-studio-ink bg-studio-white/95 text-studio-ink group-hover:bg-studio-lime absolute right-3 bottom-3 inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] font-extrabold uppercase shadow-[2px_2px_0px_#151515] transition-colors">
                      <Expand className="h-3 w-3" aria-hidden="true" />
                      <span>Inspect</span>
                    </span>
                  </button>

                  <figcaption className="border-studio-ink bg-studio-white flex items-center justify-between gap-3 border-t-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-studio-muted-ink font-mono text-[10px] font-bold tracking-wider uppercase">
                        {item.category}
                      </p>
                      <p className="text-studio-ink truncate text-sm leading-snug font-extrabold">
                        {item.title}
                      </p>
                    </div>
                    <span className="text-studio-muted-ink shrink-0 font-mono text-xs font-bold">
                      0{index + 1}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
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
