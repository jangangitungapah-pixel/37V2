import { Info } from 'lucide-react';

/**
 * Compact Availability Status Legend for `/availability`.
 * Uses both distinct surface styling and explicit text labels.
 */
export function PublicAvailabilityLegend() {
  return (
    <div
      aria-label="Availability status legend"
      className="border-studio-ink bg-studio-ivory border-b-2 py-2.5"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col justify-between gap-2 px-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-lime inline-block h-3 w-3 border-[1.5px]"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">Available</span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-ink inline-block h-3 w-3 border-[1.5px]"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">Booked</span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-orange/20 inline-block h-3 w-3 border-[1.5px] border-dashed"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">Too short</span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink/40 inline-block h-3 w-3 border bg-neutral-300"
              aria-hidden="true"
            />
            <span className="text-studio-muted-ink font-mono text-[11px] font-semibold uppercase">
              Past
            </span>
          </span>
        </div>

        <p className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[11px] font-medium">
          <Info className="text-studio-orange h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Slots are tentative until confirmed by our studio team.</span>
        </p>
      </div>
    </div>
  );
}
