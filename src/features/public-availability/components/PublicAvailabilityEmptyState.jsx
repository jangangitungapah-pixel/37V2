import { AlertTriangle, ArrowRight, CalendarOff, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

/**
 * Fail-Closed States for the Public Availability Calendar:
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
}) {
  if (variant === 'loading') {
    return (
      <div
        data-testid="public-availability-loading"
        aria-busy="true"
        aria-label="Loading studio availability schedule"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
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
        className="brutal-card-lg bg-studio-white mx-auto max-w-2xl p-6 text-center sm:p-10"
      >
        <div className="border-studio-ink bg-studio-orange text-studio-white mx-auto flex h-12 w-12 items-center justify-center border-2">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
          Schedule Window Too Large to Verify
        </h2>
        <p className="text-studio-muted-ink mx-auto mt-2.5 max-w-lg text-sm leading-relaxed">
          This date range contains more occupied sessions than can be safely verified in a single
          view. To avoid showing incomplete availability, please switch to Day View or inspect a
          specific date.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
            <span>Open Booking Inquiry</span>
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
        className="brutal-card-lg bg-studio-white mx-auto max-w-2xl p-6 text-center sm:p-10"
      >
        <div className="border-studio-ink bg-studio-orange text-studio-white mx-auto flex h-12 w-12 items-center justify-center border-2">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
          Availability Schedule Unavailable
        </h2>
        <p className="text-studio-muted-ink mx-auto mt-2.5 max-w-lg text-sm leading-relaxed">
          {error || 'Unable to load the studio availability schedule right now.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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
            <span>Submit Booking Inquiry</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  // Default: `not_ready` state (when publicAvailabilityMetadata/status.isReady === false)
  return (
    <div
      role="status"
      data-testid="public-availability-not-ready-state"
      className="brutal-card-lg bg-studio-white mx-auto max-w-2xl p-6 text-center sm:p-10"
    >
      <div className="border-studio-ink bg-studio-lime text-studio-ink mx-auto flex h-12 w-12 items-center justify-center border-2">
        <CalendarOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="font-display text-studio-ink mt-4 text-3xl leading-none font-black uppercase">
        Schedule Sync in Progress
      </h2>
      <p className="text-studio-ink mx-auto mt-2.5 max-w-lg text-sm leading-relaxed font-bold">
        Availability data is not ready yet. Please contact the studio.
      </p>
      <p className="text-studio-muted-ink mx-auto mt-1.5 max-w-lg text-xs leading-relaxed">
        We never display unverified free slots before the studio schedule projection is initialized.
        You can still submit your preferred session date and time through the booking inquiry form.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/#booking"
          className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          <span>Go to Booking Inquiry</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/#contact"
          className="brutal-btn bg-studio-white text-studio-ink inline-flex min-h-11 items-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase"
        >
          <span>Contact Studio</span>
        </Link>
      </div>
    </div>
  );
}
