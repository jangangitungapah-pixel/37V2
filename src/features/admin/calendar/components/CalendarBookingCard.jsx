import {
  BOOKING_SESSION_STATUS,
  getInitialPaymentStatusMeta,
  getSessionStatusMeta,
  getStudioRoomById,
} from '../config/calendar-config';
import { formatDurationMinutes, formatMinuteRange } from '../utils/booking-time';

export function CalendarBookingCard({
  booking,
  onSelectBooking,
  variant = 'timeline',
  style = undefined,
}) {
  const room = getStudioRoomById(booking.studioId);
  const paymentMeta = getInitialPaymentStatusMeta(booking.initialPaymentStatus);
  const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
  const isCancelled = booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED;
  const timeRangeLabel = formatMinuteRange(booking.startMinute, booking.endMinute, false);
  const durationLabel = formatDurationMinutes(booking.durationMinutes);
  const serviceSummary = booking.packageLabel || booking.recordingTypeLabel || booking.serviceLabel;

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

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelectBooking(booking);
        }}
        aria-label={`Booking ${booking.customerName}, ${room.label}, ${timeRangeLabel}, ${serviceSummary}, pembayaran ${paymentMeta.shortLabel}, sesi ${sessionMeta.label}`}
        className={`border-studio-ink ${cardSurfaceClass} ${leftAccentClass} flex w-full cursor-pointer flex-col gap-1 border p-1.5 text-left shadow-[1px_1px_0px_#151515] transition-transform hover:-translate-y-0.5`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[10px] font-extrabold">{timeRangeLabel}</span>
          <span
            className={`py-0.2 border px-1 font-mono text-[9px] font-extrabold uppercase ${room.badgeClass}`}
          >
            {room.shortLabel}
          </span>
        </div>

        <p className="truncate text-xs leading-tight font-extrabold">
          {booking.customerName}
          {booking.bandName ? ` • ${booking.bandName}` : ''}
        </p>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-studio-muted-ink truncate font-mono text-[9px] font-bold uppercase">
            {serviceSummary}
          </span>
          <span
            className={`py-0.2 border px-1 font-mono text-[9px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
          >
            {paymentMeta.shortLabel}
          </span>
          <span
            className={`py-0.2 border px-1 font-mono text-[9px] font-extrabold uppercase ${sessionMeta.badgeClass}`}
          >
            {sessionMeta.label}
          </span>
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
      aria-label={`Booking ${booking.customerName}, ${room.label}, ${timeRangeLabel}, ${serviceSummary}, pembayaran ${paymentMeta.shortLabel}, sesi ${sessionMeta.label}`}
      className={`border-studio-ink ${cardSurfaceClass} ${leftAccentClass} group flex w-full cursor-pointer flex-col justify-between overflow-hidden border-2 p-2 text-left shadow-[2px_2px_0px_#151515] transition-shadow hover:shadow-[3px_3px_0px_#151515]`}
    >
      <div className="min-w-0 space-y-1">
        {/* Top Metadata Row: Time + Room Badge */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="font-mono text-[10px] leading-none font-extrabold tracking-tight">
            {timeRangeLabel} <span className="text-studio-muted-ink">({durationLabel})</span>
          </span>

          <span
            className={`border px-1.5 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${room.badgeClass}`}
          >
            {room.label}
          </span>
        </div>

        {/* Customer + Band Name */}
        <div className="min-w-0">
          <p className="truncate text-xs leading-tight font-extrabold sm:text-sm">
            {booking.customerName}
          </p>
          {booking.bandName ? (
            <p className="text-studio-muted-ink truncate text-[11px] leading-tight font-semibold">
              {booking.bandName}
            </p>
          ) : null}
        </div>
      </div>

      {/* Bottom Badges: Service + Payment Status + Session Status */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pt-1">
        <span className="border-studio-ink bg-studio-ivory text-studio-ink truncate border px-1.5 py-0.5 font-mono text-[9px] leading-none font-bold uppercase">
          {serviceSummary}
        </span>

        <span
          className={`border px-1.5 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${paymentMeta.badgeClass}`}
        >
          {paymentMeta.shortLabel}
        </span>

        <span
          className={`border px-1.5 py-0.5 font-mono text-[9px] leading-none font-extrabold uppercase ${sessionMeta.badgeClass}`}
        >
          {sessionMeta.label}
        </span>
      </div>
    </button>
  );
}
