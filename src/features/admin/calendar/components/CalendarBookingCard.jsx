import {
  BOOKING_SESSION_STATUS,
  getInitialPaymentStatusMeta,
  getSessionStatusMeta,
  getStudioRoomById,
} from '../config/calendar-config';
import { formatDurationMinutes, formatMinuteOfDay, formatMinuteRange } from '../utils/booking-time';

export function CalendarBookingCard({
  booking,
  onSelectBooking,
  variant = 'timeline',
  isMultiLane = false,
  endsAfterDisplay = false,
  style = undefined,
}) {
  const room = getStudioRoomById(booking.studioId);
  const paymentMeta = getInitialPaymentStatusMeta(booking.initialPaymentStatus);
  const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
  const isCancelled = booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED;
  const timeRangeLabel = formatMinuteRange(booking.startMinute, booking.endMinute, false);
  const durationLabel = formatDurationMinutes(booking.durationMinutes);
  const serviceSummary = booking.packageLabel || booking.recordingTypeLabel || booking.serviceLabel;
  const isShortDuration = Number(booking.durationMinutes) <= 45;

  const isRoomA = booking.studioId === 'room-a';
  const cardSurfaceClass = isCancelled
    ? 'bg-neutral-100 border-neutral-500 text-neutral-600 opacity-75'
    : isRoomA
      ? 'bg-studio-white border-studio-ink text-studio-ink hover:bg-[#faf8f1]'
      : 'bg-studio-ivory border-studio-ink text-studio-ink hover:bg-studio-white';

  const leftAccentClass = isCancelled
    ? 'border-l-4 border-l-neutral-500'
    : isRoomA
      ? 'border-l-4 border-l-studio-lime'
      : 'border-l-4 border-l-studio-orange';

  const ariaLabel = `Booking ${booking.customerName}, ${room.label}, ${timeRangeLabel}, ${serviceSummary}, pembayaran ${paymentMeta.shortLabel}, sesi ${sessionMeta.label}`;

  // Single-row compact strip for very short (e.g. 30-minute) or tightly split multi-lane timeline blocks
  if (isShortDuration && variant === 'timeline') {
    return (
      <button
        type="button"
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          onSelectBooking(booking);
        }}
        aria-label={ariaLabel}
        className={`border-studio-ink ${cardSurfaceClass} ${leftAccentClass} flex w-full cursor-pointer items-center justify-between gap-1 overflow-hidden border-[1.5px] px-1.5 py-0.5 text-left shadow-[1px_1px_0px_#151515] transition-shadow hover:shadow-[2px_2px_0px_#151515]`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={`shrink-0 border px-1 py-0 font-mono text-[8px] leading-tight font-extrabold uppercase ${room.badgeClass}`}
          >
            {room.shortLabel}
          </span>
          <span className="truncate text-[11px] leading-none font-extrabold">
            {booking.customerName}
          </span>
        </div>

        <span className="text-studio-muted-ink shrink-0 font-mono text-[9px] leading-none font-bold">
          {timeRangeLabel}
        </span>
      </button>
    );
  }

  // Timeline-compact variant used for Week & Month columns where width is narrower
  if (variant === 'compact' || isMultiLane) {
    return (
      <button
        type="button"
        style={style}
        onClick={(event) => {
          event.stopPropagation();
          onSelectBooking(booking);
        }}
        aria-label={ariaLabel}
        className={`border-studio-ink ${cardSurfaceClass} ${leftAccentClass} flex w-full cursor-pointer flex-col justify-between overflow-hidden border-[1.5px] p-1 text-left shadow-[1px_1px_0px_#151515] transition-shadow hover:shadow-[2px_2px_0px_#151515]`}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-mono text-[9px] leading-none font-extrabold tracking-tight">
              {timeRangeLabel}
            </span>
            <span
              className={`shrink-0 border px-1 py-0 font-mono text-[8px] leading-tight font-extrabold uppercase ${room.badgeClass}`}
            >
              {room.shortLabel}
            </span>
          </div>

          <p className="truncate text-[11px] leading-tight font-extrabold">
            {booking.customerName}
          </p>

          {!isMultiLane && booking.bandName ? (
            <p className="text-studio-muted-ink truncate text-[10px] leading-tight font-semibold">
              {booking.bandName}
            </p>
          ) : null}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
          {!isMultiLane ? (
            <span className="border-studio-ink bg-studio-ivory text-studio-ink max-w-full truncate border px-1 py-0 font-mono text-[8px] leading-tight font-bold uppercase">
              {serviceSummary}
            </span>
          ) : null}

          <span
            className={`border px-1 py-0 font-mono text-[8px] leading-tight font-extrabold uppercase ${paymentMeta.badgeClass}`}
          >
            {paymentMeta.shortLabel}
          </span>

          {!isMultiLane ? (
            <span
              className={`border px-1 py-0 font-mono text-[8px] leading-tight font-extrabold uppercase ${sessionMeta.badgeClass}`}
            >
              {sessionMeta.label}
            </span>
          ) : null}

          {endsAfterDisplay ? (
            <span className="border-studio-ink text-studio-ink border bg-amber-200 px-1 py-0 font-mono text-[8px] leading-tight font-extrabold uppercase">
              s/d {formatMinuteOfDay(booking.endMinute)}
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onSelectBooking(booking);
      }}
      aria-label={ariaLabel}
      className={`border-studio-ink ${cardSurfaceClass} ${leftAccentClass} group flex w-full cursor-pointer flex-col justify-between overflow-hidden border-2 p-1.5 text-left shadow-[2px_2px_0px_#151515] transition-shadow hover:shadow-[3px_3px_0px_#151515]`}
    >
      <div className="min-w-0 space-y-0.5">
        {/* Top Metadata Row: Time + Room Badge */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="font-mono text-[10px] leading-none font-extrabold tracking-tight">
            {timeRangeLabel}{' '}
            <span className="text-studio-muted-ink font-semibold">({durationLabel})</span>
          </span>

          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${room.badgeClass}`}
          >
            {room.label}
          </span>
        </div>

        {/* Customer + Band Name */}
        <div className="min-w-0">
          <p className="truncate text-xs leading-tight font-extrabold">{booking.customerName}</p>
          {booking.bandName && Number(booking.durationMinutes) >= 60 ? (
            <p className="text-studio-muted-ink truncate text-[10px] leading-tight font-semibold">
              {booking.bandName}
            </p>
          ) : null}
        </div>
      </div>

      {/* Bottom Badges: Service + Payment Status + Session Status */}
      <div className="mt-1 flex flex-wrap items-center gap-1 pt-0.5">
        <span className="border-studio-ink bg-studio-ivory text-studio-ink truncate border px-1 py-0.5 font-mono text-[9px] leading-none font-bold uppercase">
          {serviceSummary}
        </span>

        <span
          className={`border px-1 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${paymentMeta.badgeClass}`}
        >
          {paymentMeta.shortLabel}
        </span>

        <span
          className={`border px-1 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${sessionMeta.badgeClass}`}
        >
          {sessionMeta.label}
        </span>

        {endsAfterDisplay ? (
          <span className="border-studio-ink text-studio-ink border bg-amber-200 px-1 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase">
            Lanjut s/d {formatMinuteOfDay(booking.endMinute)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
