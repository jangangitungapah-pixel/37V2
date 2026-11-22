import { Info } from 'lucide-react';

/**
 * Availability Status Legend & Non-Reservation Notice for `/availability`.
 * Uses both color and explicit text badges so color is never the sole indicator.
 */
export function PublicAvailabilityLegend() {
  return (
    <div
      aria-label="Availability status legend"
      className="border-studio-ink bg-studio-ivory border-b-2 py-3"
    >
      <div className="mx-auto flex max-w-[1680px] flex-col justify-between gap-2.5 px-3 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
            Legend:
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-lime inline-block h-3.5 w-3.5 border-[1.5px]"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">
              Available (Selectable)
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-ink inline-block h-3.5 w-3.5 border-[1.5px]"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">
              Occupied (Booked Session)
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink bg-studio-orange/20 inline-block h-3.5 w-3.5 border-[1.5px] border-dashed"
              aria-hidden="true"
            />
            <span className="font-mono text-[11px] font-bold uppercase">
              Limited Window (Shorter than duration)
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5">
            <span
              className="border-studio-ink/40 inline-block h-3.5 w-3.5 border bg-neutral-300"
              aria-hidden="true"
            />
            <span className="text-studio-muted-ink font-mono text-[11px] font-semibold uppercase">
              Past / Closed
            </span>
          </span>
        </div>

        <p className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[11px] font-semibold">
          <Info className="text-studio-orange h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Availability is updated from the studio schedule and may change before your session is
            confirmed.
          </span>
        </p>
      </div>
    </div>
  );
}
