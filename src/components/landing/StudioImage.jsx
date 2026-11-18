import { useState } from 'react';
import { ImageOff } from 'lucide-react';

import { cn } from '@/lib/utils';

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
          'bg-studio-ivory text-studio-ink flex flex-col items-center justify-center gap-2 p-6 text-center',
          className,
        )}
      >
        <div className="border-studio-ink bg-studio-lime flex h-11 w-11 items-center justify-center border-2">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="font-mono text-xs font-bold tracking-wider uppercase">{fallbackLabel}</p>
        <p className="text-studio-muted-ink max-w-xs text-xs">
          {alt || 'Studio visual placeholder — awaiting approved 37 Music Studio asset.'}
        </p>
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
