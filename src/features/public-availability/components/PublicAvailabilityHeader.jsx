import { ArrowLeft, ArrowRight, Clock, Radio, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Editorial Header for the Public Availability Calendar (`/availability`).
 * Shares the 37 Music Studio Neo-Brutalist Editorial identity while keeping
 * mobile height compact so schedule controls stay immediately accessible.
 */
export function PublicAvailabilityHeader({
  studioName = '37 Music Studio',
  operatingHours = '10:00 – 23:00 WIB',
  isReady = false,
  isLoading = false,
  isOwnerSyncing = false,
  error = null,
}) {
  const statusBadge = isOwnerSyncing
    ? {
        label: 'SYNCING SCHEDULE...',
        className: 'border-[#C8F13A]/60 bg-[#C8F13A]/15 text-[#C8F13A]',
        icon: 'spin',
      }
    : isLoading
      ? {
          label: 'CHECKING SCHEDULE...',
          className: 'border-neutral-700 bg-neutral-900 text-neutral-300',
          icon: 'radio',
        }
      : error
        ? {
            label: 'SCHEDULE UNAVAILABLE',
            className: 'border-[#FF4B22] bg-[#FF4B22]/15 text-[#FF8A70]',
            icon: 'radio',
          }
        : isReady
          ? {
              label: 'LIVE SCHEDULE',
              className: 'border-[#C8F13A]/60 bg-[#C8F13A] text-[#151515]',
              icon: 'dot',
            }
          : {
              label: 'SCHEDULE NOT LIVE YET',
              className: 'border-amber-400/50 bg-amber-400/15 text-amber-200',
              icon: 'radio',
            };

  return (
    <header className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2">
      {/* Top Navigation Bar */}
      <div className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-2 px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/"
              className="group inline-flex min-h-10 items-center gap-1.5 font-mono text-xs font-extrabold tracking-wider text-neutral-200 uppercase transition-colors hover:text-[#C8F13A]"
            >
              <ArrowLeft
                className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
              <span className="truncate">{studioName || '37 Music Studio'}</span>
            </Link>

            <span className="hidden text-neutral-600 sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-studio-lime hidden font-mono text-xs font-bold tracking-wider uppercase sm:inline">
              Availability
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/#rooms"
              className="hidden min-h-10 items-center px-3 py-1.5 font-mono text-xs font-bold text-neutral-300 uppercase transition-colors hover:text-white md:inline-flex"
            >
              Rooms
            </Link>
            <Link
              to="/#services"
              className="hidden min-h-10 items-center px-3 py-1.5 font-mono text-xs font-bold text-neutral-300 uppercase transition-colors hover:text-white md:inline-flex"
            >
              Services
            </Link>
            <Link
              to="/#booking"
              className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-extrabold tracking-wider uppercase sm:px-3.5 sm:text-xs"
            >
              <span>Book a Session</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Compact Hero Title Block */}
      <div className="mx-auto max-w-[1680px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="public-availability-freshness-badge"
                className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-wider uppercase sm:text-[11px] ${statusBadge.className}`}
              >
                {statusBadge.icon === 'spin' ? (
                  <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : statusBadge.icon === 'dot' ? (
                  <span
                    className="bg-studio-ink inline-block h-2 w-2 rounded-full"
                    aria-hidden="true"
                  />
                ) : (
                  <Radio className="h-3 w-3" aria-hidden="true" />
                )}
                <span>{statusBadge.label}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 border border-neutral-700 bg-neutral-900 px-2.5 py-1 font-mono text-[10px] font-bold text-neutral-200 uppercase sm:text-[11px]">
                <Clock className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
                <span>{operatingHours || '10:00 – 23:00 WIB'}</span>
              </span>
            </div>

            <h1 className="font-display text-studio-ivory mt-2.5 text-3xl leading-[0.94] font-black tracking-tight uppercase sm:text-5xl lg:text-6xl">
              STUDIO AVAILABILITY
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-neutral-300 sm:text-sm">
              Pick an open start time in Room A or Room B to prefill your booking request.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
