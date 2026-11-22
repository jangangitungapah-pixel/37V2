import { ArrowLeft, ArrowRight, CalendarClock, Clock, Radio } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Editorial Header for the Public Availability Calendar (`/availability`).
 * Shares the 37 Music Studio Neo-Brutalist Editorial identity while keeping
 * navigation between the Landing Page and Public Calendar effortless.
 */
export function PublicAvailabilityHeader({ isReady = false, isLoading = false, todayIso = '' }) {
  return (
    <header className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2">
      {/* Top Navigation Bar */}
      <div className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="group inline-flex min-h-10 items-center gap-2 font-mono text-xs font-extrabold tracking-wider text-neutral-200 uppercase transition-colors hover:text-[#C8F13A]"
            >
              <ArrowLeft
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
              <span>37 Music Studio</span>
            </Link>

            <span className="hidden text-neutral-600 sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-studio-lime hidden font-mono text-xs font-bold tracking-wider uppercase sm:inline">
              Public Schedule
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/#rooms"
              className="hidden min-h-10 items-center px-3 py-1.5 font-mono text-xs font-bold text-neutral-300 uppercase transition-colors hover:text-white sm:inline-flex"
            >
              Rooms
            </Link>
            <Link
              to="/#services"
              className="hidden min-h-10 items-center px-3 py-1.5 font-mono text-xs font-bold text-neutral-300 uppercase transition-colors hover:text-white sm:inline-flex"
            >
              Services
            </Link>
            <Link
              to="/#booking"
              className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-10 items-center gap-1.5 px-3.5 py-1.5 font-mono text-xs font-extrabold tracking-wider uppercase"
            >
              <span>Book a Session</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Editorial Hero Title Block */}
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-studio-lime text-studio-ink inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px]">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>READ-ONLY PUBLIC SCHEDULE</span>
              </span>

              <span
                data-testid="public-availability-freshness-badge"
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase sm:text-[11px] ${
                  isLoading
                    ? 'border-neutral-700 bg-neutral-900 text-neutral-300'
                    : isReady
                      ? 'border-[#C8F13A]/50 bg-neutral-900 text-[#C8F13A]'
                      : 'border-[#FF4B22] bg-[#FF4B22]/15 text-[#FF4B22]'
                }`}
              >
                <Radio className="h-3 w-3" aria-hidden="true" />
                <span>
                  {isLoading
                    ? 'CHECKING SCHEDULE...'
                    : isReady
                      ? 'LIVE STUDIO SCHEDULE'
                      : 'SCHEDULE SYNC PENDING'}
                </span>
              </span>
            </div>

            <h1 className="font-display text-studio-ivory mt-3 text-4xl leading-[0.92] font-black tracking-tight uppercase sm:text-6xl lg:text-7xl">
              STUDIO AVAILABILITY
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
              Explore open sessions across both studio rooms. Select any available start time to
              carry your preferred date, room, and time directly into the booking inquiry form.
            </p>
          </div>

          <div className="border border-neutral-800 bg-neutral-900/90 p-3.5 sm:p-4 lg:shrink-0">
            <div className="flex items-center gap-2 font-mono text-xs font-extrabold text-[#C8F13A] uppercase">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>10:00 – 23:00 WIB (ASIA/JAKARTA)</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-neutral-400">
              30-minute slot granularity • Today in Jakarta: {todayIso || '-'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
