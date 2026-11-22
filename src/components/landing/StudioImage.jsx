import { useState } from 'react';
import { AudioWaveform, Camera } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Branded Neo-Brutalist Editorial Image Component.
 * When authentic studio media is unavailable or fails to load, displays an
 * intentional architectural editorial frame rather than a broken image or blank dark rectangle.
 */
export function StudioImage({
  src,
  alt,
  width = 960,
  height = 680,
  priority = false,
  className,
  imgClassName,
  fallbackLabel = 'Studio visual preview',
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const hasError = Boolean(src) && failedSrc === src;

  if (hasError || !src) {
    return (
      <div
        role="img"
        aria-label={alt || fallbackLabel}
        className={cn(
          'bg-studio-ivory text-studio-ink relative flex flex-col justify-between overflow-hidden p-5 sm:p-6',
          className,
        )}
      >
        {/* Subtle Architectural Grid Lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, #151515 1px, transparent 1px), linear-gradient(to bottom, #151515 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="border-studio-ink bg-studio-ink text-studio-ivory inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase">
            <AudioWaveform className="text-studio-lime h-3 w-3" aria-hidden="true" />
            <span>37 MUSIC STUDIO</span>
          </span>
          <span className="border-studio-ink bg-studio-lime text-studio-ink border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
            CURATION PREVIEW
          </span>
        </div>

        <div className="relative z-10 my-auto py-3 text-left">
          <div className="border-studio-ink bg-studio-white inline-flex h-10 w-10 items-center justify-center border-2 shadow-[2px_2px_0px_#151515]">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="font-display text-studio-ink mt-2.5 text-xl leading-none font-black tracking-tight uppercase sm:text-2xl">
            {fallbackLabel}
          </p>
          <p className="text-studio-muted-ink mt-1 max-w-sm text-xs leading-relaxed">
            {alt || 'Authentic 37 Music Studio photograph pending owner publication.'}
          </p>
        </div>

        <div className="border-studio-ink/20 relative z-10 flex items-center justify-between border-t pt-2 font-mono text-[10px] font-semibold text-[#666159] uppercase">
          <span>NO STOCK PHOTOGRAPHY</span>
          <span>VERIFIED MEDIA ONLY</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-studio-ink relative overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        onError={() => setFailedSrc(src)}
        className={cn('block h-full w-full object-cover', imgClassName)}
      />
    </div>
  );
}
