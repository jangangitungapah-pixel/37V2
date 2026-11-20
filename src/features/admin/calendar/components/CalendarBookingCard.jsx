import { getPaymentStatusMeta } from '@/features/admin/payment/utils/invoice-status';

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
  const paymentMeta = booking.invoiceSummary?.hasInvoice
    ? getPaymentStatusMeta(booking.invoiceSummary.paymentStatus)
    : getInitialPaymentStatusMeta(booking.initialPaymentStatus);
  const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
  const isCancelled = booking.sessionStatus === BOOKING_SESSION_STATUS.CANCELLED;
  const timeRangeLabel = formatMinuteRange(booking.startMinute, booking.endMinute, false);
  const durationLabel = formatDurationMinutes(booking.durationMinutes);
  const serviceSummary = booking.packageLabel || booking.recordingTypeLabel || booking.serviceLabel;
  const isShortDuration = Number(booking.durationMinutes) <= 45;

  const isRoomA = booking.studioId === 'room-a';
  const cardSurfaceClass = isCancelled
    ? 'bg-[#151515]/[0.03] border-[#151515]/12 text-[#666159] opacity-75'
    : isRoomA
      ? 'bg-white border-[#151515]/14 text-studio-ink hover:bg-[#FCFBF7]'
      : 'bg-[#FAF8F1] border-[#151515]/14 text-studio-ink hover:bg-white';

  const leftAccentClass = isCancelled
    ? 'border-l-[3.5px] border-l-[#8B857B]'
    : isRoomA
      ? 'border-l-[3.5px] border-l-[#9BC416]'
      : 'border-l-[3.5px] border-l-studio-orange';

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
        className={`${cardSurfaceClass} ${leftAccentClass} flex w-full cursor-pointer items-center justify-between gap-1.5 overflow-hidden rounded-lg border px-2 py-0.5 text-left shadow-xs transition-all hover:shadow-sm`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0 font-mono text-[8.5px] leading-tight font-semibold ${room.badgeClass}`}
          >
            {room.shortLabel}
          </span>
          <span className="truncate text-[11px] leading-none font-semibold">
            {booking.customerName}
          </span>
        </div>

        <span className="shrink-0 font-mono text-[9px] leading-none font-medium text-[#666159] tabular-nums">
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
        className={`${cardSurfaceClass} ${leftAccentClass} flex w-full cursor-pointer flex-col justify-between overflow-hidden rounded-lg border p-1.5 text-left shadow-xs transition-all hover:shadow-sm`}
      >
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-mono text-[9.5px] leading-none font-semibold tracking-tight text-[#46433D] tabular-nums">
              {timeRangeLabel}
            </span>
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0 font-mono text-[8.5px] leading-tight font-semibold ${room.badgeClass}`}
            >
              {room.shortLabel}
            </span>
          </div>

          <p className="truncate text-[11px] leading-tight font-semibold">{booking.customerName}</p>

          {!isMultiLane && booking.bandName ? (
            <p className="truncate text-[10px] leading-tight font-medium text-[#666159]">
              {booking.bandName}
            </p>
          ) : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {!isMultiLane ? (
            <span className="max-w-full truncate rounded-full border border-[#151515]/10 bg-[#151515]/[0.045] px-1.5 py-0 text-[8.5px] leading-tight font-medium text-[#46433D]">
              {serviceSummary}
            </span>
          ) : null}

          <span
            className={`rounded-full border px-1.5 py-0 text-[8.5px] leading-tight font-medium ${paymentMeta.badgeClass}`}
          >
            {paymentMeta.shortLabel}
          </span>

          {!isMultiLane ? (
            <span
              className={`rounded-full border px-1.5 py-0 text-[8.5px] leading-tight font-medium ${sessionMeta.badgeClass}`}
            >
              {sessionMeta.label}
            </span>
          ) : null}

          {endsAfterDisplay ? (
            <span className="rounded-full border border-amber-500/25 bg-[#FEF4DD] px-1.5 py-0 text-[8.5px] leading-tight font-medium text-[#8A4B08]">
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
      className={`${cardSurfaceClass} ${leftAccentClass} group flex w-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-2 text-left shadow-xs transition-all hover:shadow-sm`}
    >
      <div className="min-w-0 space-y-0.5">
        {/* Top Metadata Row: Time + Room Badge */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-studio-ink font-mono text-[10.5px] leading-none font-semibold tracking-tight tabular-nums">
            {timeRangeLabel} <span className="font-normal text-[#666159]">({durationLabel})</span>
          </span>

          <span
            className={`rounded-full border px-2 py-0.5 text-[9.5px] leading-none font-semibold ${room.badgeClass}`}
          >
            {room.label}
          </span>
        </div>

        {/* Customer + Band Name */}
        <div className="min-w-0 pt-0.5">
          <p className="truncate text-xs leading-tight font-semibold">{booking.customerName}</p>
          {booking.bandName && Number(booking.durationMinutes) >= 60 ? (
            <p className="truncate text-[11px] leading-tight font-medium text-[#666159]">
              {booking.bandName}
            </p>
          ) : null}
        </div>
      </div>

      {/* Bottom Badges: Service + Payment Status + Session Status */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="truncate rounded-full border border-[#151515]/10 bg-[#151515]/[0.045] px-2 py-0.5 text-[9.5px] leading-none font-medium text-[#46433D]">
          {serviceSummary}
        </span>

        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] leading-none font-medium ${paymentMeta.badgeClass}`}
        >
          {paymentMeta.shortLabel}
        </span>

        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] leading-none font-medium ${sessionMeta.badgeClass}`}
        >
          {sessionMeta.label}
        </span>

        {endsAfterDisplay ? (
          <span className="rounded-full border border-amber-500/25 bg-[#FEF4DD] px-2 py-0.5 text-[9.5px] leading-none font-medium text-[#8A4B08]">
            Lanjut s/d {formatMinuteOfDay(booking.endMinute)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
