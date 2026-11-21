import { ArrowRight, Sliders, Users, Volume2 } from 'lucide-react';

import { StudioImage } from './StudioImage';

export function RoomsSection({ rooms, onSelectRoom }) {
  return (
    <section
      id="rooms"
      aria-labelledby="rooms-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-8 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Section Header Row */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="bg-studio-ink text-studio-white hidden px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider uppercase sm:inline-block">
              {rooms.eyebrow}
            </span>
            <h2
              id="rooms-heading"
              className="font-display text-studio-ink mt-0 text-3xl leading-none font-black tracking-tight uppercase sm:mt-3 sm:text-5xl"
            >
              {rooms.heading}
            </h2>
          </div>

          <p className="border-studio-orange text-studio-muted-ink hidden max-w-md border-l-4 pl-3.5 text-sm leading-relaxed font-medium sm:block">
            {rooms.intro}
          </p>
        </div>

        {/* Two Large Photo-Led Room Cards */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:mt-8 sm:gap-7 md:grid-cols-2 lg:mt-10">
          {rooms.items.map((room, index) => (
            <article
              key={room.id}
              className="brutal-card-lg bg-studio-white flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Room Photograph with Lime Sticker */}
                <div className="border-studio-ink relative border-b-2">
                  <span className="border-studio-ink bg-studio-lime text-studio-ink absolute top-3 left-3 z-10 hidden border-[1.5px] px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase shadow-[2px_2px_0px_#151515] sm:inline-block">
                    {room.sticker}
                  </span>
                  <StudioImage
                    src={room.image.src}
                    alt={room.image.alt}
                    width={room.image.width}
                    height={room.image.height}
                    className="aspect-[16/10] w-full"
                  />
                </div>

                {/* Room Details */}
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl leading-none font-black tracking-tight uppercase sm:text-3xl">
                      {room.name}
                    </h3>
                    <span className="border-studio-ink bg-studio-ivory flex h-9 w-9 shrink-0 items-center justify-center border">
                      {index === 0 ? (
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Sliders className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </div>

                  <p className="text-studio-muted-ink mt-2 flex items-center gap-2 text-xs font-semibold sm:mt-2.5 sm:text-sm">
                    <Users className="text-studio-ink h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{room.capacityLabel}</span>
                  </p>

                  {/* Capability Chips */}
                  <ul
                    aria-label={`${room.name} highlights`}
                    className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2"
                  >
                    {room.tags.map((tag, tagIndex) => (
                      <li
                        key={tag}
                        className={`border-studio-ink bg-studio-ivory px-2 py-0.5 font-mono text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px] ${tagIndex >= 3 ? 'hidden sm:inline-block' : ''}`}
                        style={{ borderWidth: '1.5px' }}
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Full-Width Solid Black Booking Action */}
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <button
                  type="button"
                  aria-label={`${room.ctaLabel} (${room.name.split('—')[0].trim()})`}
                  onClick={() => onSelectRoom(room.id, room.defaultService)}
                  className="brutal-btn bg-studio-ink text-studio-white hover:bg-studio-orange flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-5 py-2.5 text-xs font-extrabold tracking-wider uppercase sm:min-h-12 sm:py-3 sm:text-sm"
                >
                  <span>{room.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* All Sessions Include Capability Strip */}
        <div className="mt-8 hidden flex-wrap items-center gap-2 sm:flex">
          <span className="text-studio-muted-ink mr-1 font-mono text-xs font-bold uppercase">
            {rooms.includedLabel}
          </span>
          {rooms.includedChips.map((chip) => (
            <span
              key={chip}
              className="border-studio-ink bg-studio-white rounded-full border-[1.5px] px-3 py-1 font-mono text-[11px] font-semibold"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
