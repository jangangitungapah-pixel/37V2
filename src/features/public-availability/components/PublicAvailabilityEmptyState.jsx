import { AlertTriangle, ArrowRight, CalendarClock, MessageCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Fail-Closed States for the Public Availability Calendar (`/availability`):
 * - `loading`: skeleton blocks while schedule & readiness metadata load
 * - `not_ready`: when `publicAvailabilityMetadata/status.isReady !== true`
 * - `truncated`: when the query limit is exceeded and complete availability cannot be guaranteed
 * - `error`: when Firestore query fails
 */
export function PublicAvailabilityEmptyState({
  variant = 'not_ready',
  error = '',
  onRetry,
  onSwitchToDayView,
  whatsappUrl = '',
  studioName = '37 Music Studio',
  isOwner = false,
  isOwnerSyncing = false,
  ownerSyncError = '',
  onOwnerSync,
}) {
  if (variant === 'loading') {
    return (
      <div
        data-testid="public-availability-loading"
        aria-busy="true"
        aria-label="Loading studio availability schedule"
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
      >
        {[0, 1].map((idx) => (
          <div key={idx} className="brutal-card bg-studio-white p-5">
            <div className="bg-studio-ink/15 h-6 w-48 animate-pulse" />
            <div className="bg-studio-ink/10 mt-2 h-4 w-64 animate-pulse" />
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 12 }).map((_, sIdx) => (
                <div key={sIdx} className="bg-studio-ink/10 h-14 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'truncated') {
    return (
      <div
        role="status"
        data-testid="public-availability-truncated-state"
        className="brutal-card-lg bg-studio-white mx-auto max-w-xl p-6 text-center sm:p-8"
      >
        <div className="border-studio-ink bg-studio-orange text-studio-white mx-auto flex h-12 w-12 items-center justify-center border-2">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
          Schedule Window Too Large
        </h2>
        <p className="text-studio-muted-ink mx-auto mt-2.5 max-w-md text-sm leading-relaxed">
          This multi-day window has more bookings than can be shown at once. Switch to Day View to
          browse exact open slots.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onSwitchToDayView ? (
            <button
              type="button"
              onClick={onSwitchToDayView}
              className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 cursor-pointer items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
            >
              <span>Switch to Day View</span>
            </button>
          ) : null}
          <Link
            to="/#booking"
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            <span>Send Booking Request</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  if (variant === 'error') {
    return (
      <div
        role="alert"
        data-testid="public-availability-error-state"
        className="brutal-card-lg bg-studio-white mx-auto max-w-xl p-6 text-center sm:p-8"
      >
        <div className="border-studio-ink bg-studio-orange text-studio-white mx-auto flex h-12 w-12 items-center justify-center border-2">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
          Availability Schedule Unavailable
        </h2>
        <p className="text-studio-muted-ink mx-auto mt-2.5 max-w-md text-sm leading-relaxed">
          {error || 'Unable to load the studio availability schedule right now.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-11 cursor-pointer items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          ) : null}
          <Link
            to="/#booking"
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            <span>Send Booking Request</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Chat on WhatsApp</span>
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  // Default: `not_ready` state (when publicAvailabilityMetadata/status.isReady === false)
  return (
    <div
      role="status"
      data-testid="public-availability-not-ready-state"
      className="brutal-card-lg bg-studio-white mx-auto max-w-xl p-6 text-center sm:p-8"
    >
      <div className="border-studio-ink bg-studio-lime text-studio-ink mx-auto flex h-12 w-12 items-center justify-center border-2">
        {isOwnerSyncing ? (
          <RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true" />
        ) : (
          <CalendarClock className="h-6 w-6" aria-hidden="true" />
        )}
      </div>

      <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
        {isOwnerSyncing ? 'Syncing Studio Schedule' : 'Live Schedule Not Ready Yet'}
      </h2>

      <p className="text-studio-ink mx-auto mt-2.5 max-w-md text-sm leading-relaxed font-bold">
        Availability data is not ready yet. Please contact the studio.
      </p>

      <p className="text-studio-muted-ink mx-auto mt-1.5 max-w-md text-xs leading-relaxed sm:text-sm">
        {isOwnerSyncing
          ? 'Verifying Room A and Room B bookings from the studio calendar...'
          : `You can still submit your preferred date and time directly — the ${studioName || '37 Music Studio'} team will confirm availability shortly.`}
      </p>

      <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          to="/#booking"
          className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          <span>Send Booking Request</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Chat on WhatsApp</span>
          </a>
        ) : (
          <Link
            to="/#contact"
            className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
          >
            <span>Contact Studio</span>
          </Link>
        )}

        {onRetry && !isOwnerSyncing ? (
          <button
            type="button"
            onClick={onRetry}
            className="border-studio-ink/40 hover:border-studio-ink text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 border-2 bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
        ) : null}
      </div>

      {isOwner ? (
        <div
          data-testid="public-availability-owner-sync-panel"
          className="border-studio-ink bg-studio-ivory mt-6 border-2 p-4 text-left"
        >
          <p className="font-mono text-[10px] font-extrabold tracking-wider text-[#B92B0C] uppercase">
            Studio Owner Controls
          </p>
          <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed">
            Sync canonical bookings from Admin Calendar to activate live public slots for visitors.
          </p>

          {ownerSyncError ? (
            <p
              role="alert"
              className="border-studio-orange bg-studio-white text-studio-error-ink mt-2.5 border p-2.5 font-mono text-[11px] font-semibold"
            >
              {ownerSyncError}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOwnerSync}
              disabled={isOwnerSyncing}
              className="brutal-btn bg-studio-ink text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-2 px-4 py-2 font-mono text-xs font-extrabold tracking-wider uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isOwnerSyncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isOwnerSyncing ? 'Syncing...' : 'Sync & Activate Live Schedule'}</span>
            </button>

            <Link
              to="/admin/calendar"
              className="text-studio-ink font-mono text-xs font-bold underline hover:text-[#FF4B22]"
            >
              Open Admin Calendar →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
