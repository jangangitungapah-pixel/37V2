import { ArrowRight, CalendarClock, Sliders, Users, Volume2 } from 'lucide-react';
import { Link } from 'react-router';

import { StudioImage } from './StudioImage';

/**
 * SECTION 05 — ROOMS: TWO ROOMS, ZERO GUESSWORK
 * Photography-led centerpiece with distinct visual compositions for
 * Room A (Live Room) and Room B (Control + Booth).
 */
export function RoomsSection({ rooms, onSelectRoom }) {
  return (
    <section
      id="rooms"
      aria-labelledby="rooms-heading"
      className="border-studio-ink bg-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        {/* Section Header Row */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <span className="bg-studio-ink text-studio-white inline-block px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px]">
              {rooms.eyebrow}
            </span>
            <h2
              id="rooms-heading"
              className="font-display text-studio-ink mt-3 text-4xl leading-none font-black tracking-tight uppercase sm:text-6xl"
            >
              {rooms.heading}
            </h2>
          </div>

          <p className="border-studio-orange text-studio-muted-ink max-w-md border-l-4 pl-3.5 text-xs leading-relaxed font-medium sm:text-sm">
            {rooms.intro}
          </p>
        </div>

        {/* Distinct Asymmetric Editorial Showcases for Room A & Room B */}
        <div className="mt-8 space-y-8 sm:mt-12 sm:space-y-12">
          {rooms.items.map((room, index) => {
            const isRoomA = room.id === 'room-a' || index === 0;
            const shortRoomName =
              room.id === 'room-a'
                ? 'Room A'
                : room.id === 'room-b'
                  ? 'Room B'
                  : room.name.split('—')[0].trim();

            return (
              <article
                key={room.id}
                data-testid={`landing-room-showcase-${room.id}`}
                className={`border-studio-ink grid grid-cols-1 overflow-hidden border-2 lg:grid-cols-12 ${
                  isRoomA
                    ? 'bg-studio-white text-studio-ink shadow-[6px_6px_0px_#151515]'
                    : 'bg-studio-ink text-studio-ivory shadow-[6px_6px_0px_#FF4B22]'
                }`}
              >
                {/* Photographic Column (7 cols on desktop, alternating left/right) */}
                <div
                  className={`border-studio-ink relative border-b-2 lg:col-span-7 lg:border-b-0 ${
                    isRoomA ? 'lg:order-1 lg:border-r-2' : 'lg:order-2 lg:border-l-2'
                  }`}
                >
                  {room.sticker ? (
                    <span
                      className={`border-studio-ink absolute top-3 left-3 z-10 border-[1.5px] px-3 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase shadow-[2px_2px_0px_#151515] ${
                        isRoomA
                          ? 'bg-studio-lime text-studio-ink'
                          : 'bg-studio-orange text-studio-white'
                      }`}
                    >
                      {room.sticker}
                    </span>
                  ) : null}

                  <StudioImage
                    src={room.image.src}
                    alt={room.image.alt}
                    width={room.image.width}
                    height={room.image.height}
                    fallbackLabel={room.name}
                    className="aspect-[16/10] h-full w-full"
                  />
                </div>

                {/* Editorial Details & Dual Conversion Column (5 cols on desktop) */}
                <div
                  className={`flex flex-col justify-between p-5 sm:p-8 lg:col-span-5 ${
                    isRoomA ? 'lg:order-2' : 'lg:order-1'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`font-mono text-xs font-extrabold tracking-wider uppercase ${
                          isRoomA ? 'text-studio-muted-ink' : 'text-[#C8F13A]'
                        }`}
                      >
                        SPACE 0{index + 1} •{' '}
                        {isRoomA ? 'LIVE REHEARSAL FLOOR' : 'TRACKING & MIX SUITE'}
                      </span>

                      <span
                        className={`border-studio-ink flex h-9 w-9 shrink-0 items-center justify-center border ${
                          isRoomA
                            ? 'bg-studio-lime text-studio-ink'
                            : 'bg-studio-orange text-studio-white'
                        }`}
                      >
                        {isRoomA ? (
                          <Volume2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Sliders className="h-4 w-4" aria-hidden="true" />
                        )}
                      </span>
                    </div>

                    <h3 className="font-display mt-2 text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
                      {room.name}
                    </h3>

                    <p
                      className={`mt-3 flex items-start gap-2 text-xs leading-relaxed font-semibold sm:text-sm ${
                        isRoomA ? 'text-studio-muted-ink' : 'text-neutral-300'
                      }`}
                    >
                      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{room.capacityLabel}</span>
                    </p>

                    {/* Confirmed / Pending Capability Tags */}
                    <ul
                      aria-label={`${room.name} highlights`}
                      className="mt-4 flex flex-wrap gap-2"
                    >
                      {room.tags.map((tag) => (
                        <li
                          key={tag}
                          className={`px-2.5 py-1 font-mono text-[11px] font-bold ${
                            isRoomA
                              ? 'border-studio-ink bg-studio-ivory text-studio-ink border-[1.5px]'
                              : 'border border-neutral-700 bg-neutral-900 text-neutral-200'
                          }`}
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Primary Action: Check Room Availability + Secondary Action: Book This Room */}
                  <div className="mt-6 space-y-2.5 pt-4">
                    <Link
                      to={`/availability?room=${encodeURIComponent(room.id)}`}
                      aria-label={`Check Room Availability (${shortRoomName})`}
                      className={`brutal-btn flex min-h-11 w-full items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase ${
                        isRoomA
                          ? 'bg-studio-lime text-studio-ink'
                          : 'bg-studio-orange text-studio-white'
                      }`}
                    >
                      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>CHECK ROOM AVAILABILITY</span>
                    </Link>

                    <button
                      type="button"
                      aria-label={`${room.ctaLabel} (${shortRoomName})`}
                      onClick={() => onSelectRoom(room.id, room.defaultService)}
                      className={`brutal-btn flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase ${
                        isRoomA
                          ? 'bg-studio-ink text-studio-white hover:bg-studio-orange'
                          : 'bg-studio-white text-studio-ink hover:bg-studio-lime'
                      }`}
                    >
                      <span>{room.ctaLabel}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* All Sessions Include Capability Strip */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-studio-muted-ink mr-1 font-mono text-xs font-bold uppercase">
            {rooms.includedLabel}
          </span>
          {rooms.includedChips.map((chip) => (
            <span
              key={chip}
              className="border-studio-ink bg-studio-white border px-3 py-1 font-mono text-[11px] font-semibold"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
