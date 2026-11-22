import { ArrowRight, CalendarClock, Clock, DoorOpen, Lock, Radio } from 'lucide-react';
import { Link } from 'react-router';

import { PUBLIC_VIEW_MODES } from '@/features/public-availability/config/public-availability-config';
import { usePublicAvailability } from '@/features/public-availability/hooks/usePublicAvailability';

/**
 * SECTION 07 — PUBLIC AVAILABILITY TEASER ("FIND YOUR NEXT OPEN SESSION.")
 * Full-width ink-black editorial contrast section introducing the new `/availability`
 * schedule viewer using actual public availability records (never mock schedules).
 */
export function PublicAvailabilityTeaserSection({ now } = {}) {
  const { dateRange, roomSchedules, isReady, isTruncated, isLoading, error } =
    usePublicAvailability({
      viewMode: PUBLIC_VIEW_MODES.DAY,
      roomFilter: 'all',
      now,
    });

  const canShowLivePreview =
    !isLoading && !error && isReady && !isTruncated && roomSchedules.length > 0;

  return (
    <section
      id="availability-preview"
      aria-labelledby="availability-teaser-heading"
      className="border-studio-ink bg-studio-ink text-studio-ivory scroll-mt-20 border-b-2 py-10 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column (5 cols): Editorial Headline, Legend & Primary CTA */}
          <div className="lg:col-span-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>PUBLIC SCHEDULE VIEWER</span>
              </span>
              <span className="border border-neutral-700 bg-neutral-900 px-2.5 py-1 font-mono text-[10px] font-bold text-neutral-300 uppercase">
                10:00 – 23:00 WIB
              </span>
            </div>

            <h2
              id="availability-teaser-heading"
              className="font-display text-studio-ivory mt-4 text-4xl leading-[0.92] font-black tracking-tight uppercase sm:text-6xl"
            >
              FIND YOUR NEXT OPEN SESSION.
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-neutral-300 sm:text-base">
              Inspect open 1-hour time slots across Room A and Room B before contacting the studio.
              Pick a free start time and carry your selection straight into the booking request
              form.
            </p>

            {/* Availability Legend */}
            <div className="mt-6 space-y-2 border-y border-neutral-800 py-4 font-mono text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className="bg-studio-lime inline-block h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-bold text-white uppercase">Available:</span>
                <span className="text-neutral-300">Open 1-hour time slot</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className="bg-studio-orange inline-block h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-bold text-white uppercase">Occupied:</span>
                <span className="text-neutral-300">Booked studio session</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/availability"
                className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-12 items-center justify-center gap-2 px-6 py-3 font-mono text-xs font-extrabold tracking-wider uppercase"
              >
                <span>VIEW FULL AVAILABILITY</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right Column (7 cols): Real Live Today Schedule Preview or Honest Readiness Notice */}
          <div className="lg:col-span-7">
            {canShowLivePreview ? (
              <div
                data-testid="availability-teaser-live-preview"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                {roomSchedules.map((room) => {
                  const todaySchedule = room.daySchedules?.[0] || null;
                  const nextOpenSlots = (todaySchedule?.slots || [])
                    .filter((s) => s.isSelectable)
                    .slice(0, 4);

                  return (
                    <div key={room.id} className="border border-neutral-700 bg-neutral-900/90 p-5">
                      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="text-studio-lime h-4 w-4" aria-hidden="true" />
                          <h3 className="font-display text-2xl leading-none font-black text-white uppercase">
                            {room.shortLabel}
                          </h3>
                        </div>
                        <span className="bg-studio-lime text-studio-ink px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                          {todaySchedule?.selectableStartCount ?? 0} Open Today
                        </span>
                      </div>

                      <p className="mt-2 font-mono text-[11px] text-neutral-400">
                        {todaySchedule?.fullLabel} • {todaySchedule?.occupiedSlotsCount ?? 0}{' '}
                        occupied blocks
                      </p>

                      {nextOpenSlots.length > 0 ? (
                        <div className="mt-4">
                          <p className="font-mono text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                            Next open start times today (WIB):
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {nextOpenSlots.map((slot) => (
                              <Link
                                key={slot.startMinute}
                                to={`/?date=${encodeURIComponent(slot.dateIso)}&room=${encodeURIComponent(room.id)}&time=${encodeURIComponent(slot.startLabel)}&service=${encodeURIComponent(room.defaultService)}#booking`}
                                className="border-studio-lime/40 hover:bg-studio-lime hover:text-studio-ink flex min-h-10 items-center justify-between border bg-neutral-950 px-2.5 py-1.5 font-mono text-xs font-bold text-white transition-colors"
                              >
                                <span>{slot.startLabel}</span>
                                <span className="text-[10px] uppercase">Select →</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-center gap-2 border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-300">
                          <Lock
                            className="text-studio-orange h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>No remaining open start times for today.</span>
                        </div>
                      )}

                      <div className="mt-4 border-t border-neutral-800 pt-3">
                        <Link
                          to={`/availability?room=${encodeURIComponent(room.id)}`}
                          className="text-studio-lime inline-flex items-center gap-1.5 font-mono text-xs font-extrabold uppercase hover:underline"
                        >
                          <span>Inspect {room.shortLabel} calendar</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                data-testid="availability-teaser-uninitialized"
                className="border border-neutral-700 bg-neutral-900/90 p-6 sm:p-8"
              >
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#C8F13A] uppercase">
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isLoading ? 'Checking studio availability...' : 'Live Room Schedule'}
                  </span>
                </div>
                <h3 className="font-display mt-3 text-2xl leading-none font-black text-white uppercase sm:text-3xl">
                  Room A &amp; Room B Schedule Explorer
                </h3>
                <p className="mt-2.5 text-xs leading-relaxed text-neutral-300 sm:text-sm">
                  {!isLoading && !isReady
                    ? 'Availability data is not ready yet. Open the public availability page or submit your preferred date and time in the booking request form below.'
                    : 'Browse 1-hour time slots from 10:00 to 23:00 WIB across Room A (Live Room) and Room B (Control + Booth) without logging in.'}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link
                    to="/availability?room=room-a"
                    className="hover:border-studio-lime flex items-center justify-between border border-neutral-700 bg-neutral-950 p-3.5 font-mono text-xs font-bold text-white uppercase transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Clock className="text-studio-lime h-4 w-4" aria-hidden="true" />
                      <span>Room A — Live Room</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/availability?room=room-b"
                    className="hover:border-studio-orange flex items-center justify-between border border-neutral-700 bg-neutral-950 p-3.5 font-mono text-xs font-bold text-white uppercase transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Clock className="text-studio-orange h-4 w-4" aria-hidden="true" />
                      <span>Room B — Control + Booth</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                {dateRange?.todayIso ? (
                  <p className="mt-4 font-mono text-[11px] text-neutral-400">
                    All times in WIB (Asia/Jakarta) • {dateRange.todayIso}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
