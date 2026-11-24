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
  const isLongDuration = Number(booking.durationMinutes) >= 90;
  const isRoomA = booking.studioId === 'room-a';

  const cardSurfaceClass = isCancelled
    ? 'border-[#C8C4BA] bg-[#F0EFEA] text-[#67635C] opacity-80'
    : isRoomA
      ? 'border-[#A7BF4E]/75 bg-gradient-to-br from-[#F4F8E2] via-[#FCFDF8] to-[#EEF4D8] text-[#202A08] shadow-[0_3px_10px_-7px_rgba(48,65,9,0.5)]'
      : 'border-[#ECA287]/75 bg-gradient-to-br from-[#FFF0E8] via-[#FFFCF9] to-[#FBE6DC] text-[#3E1B11] shadow-[0_3px_10px_-7px_rgba(123,46,23,0.42)]';

  const topAccentClass = isCancelled
    ? 'before:bg-[#8B857B]'
    : isRoomA
      ? 'before:bg-[#A7C72A]'
      : 'before:bg-[#FF6E49]';

  const baseCardClass =
    'relative isolate flex w-full min-w-0 cursor-pointer flex-col overflow-hidden border text-left outline-none transition-[box-shadow,transform] duration-150 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[3px] hover:-translate-y-px hover:shadow-[0_8px_18px_-12px_rgba(21,21,21,0.6)] focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8BAD12] active:translate-y-0';

  const ariaLabel = `Booking ${booking.customerName}, ${room.label}, ${timeRangeLabel}, ${serviceSummary}, pembayaran ${paymentMeta.shortLabel}, sesi ${sessionMeta.label}`;

  // Very short bookings stay on one quiet line so proportional half-hour blocks remain readable.
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
        title={ariaLabel}
        className={`${baseCardClass} ${cardSurfaceClass} ${topAccentClass} flex-row items-center justify-between gap-1 rounded-[9px] border-l-[3px] px-1.5 py-0.5`}
      >
        <span className="min-w-0 flex-1 truncate text-[10px] leading-none font-semibold tracking-tight">
          {booking.customerName}
        </span>
        <span className="shrink-0 font-mono text-[8px] leading-none font-semibold tracking-tight text-[#4F4B43] tabular-nums">
          {timeRangeLabel}
        </span>
      </button>
    );
  }

  // Week and Month columns are deliberately compact; the detail drawer carries the full record.
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
        title={ariaLabel}
        className={`${baseCardClass} ${cardSurfaceClass} ${topAccentClass} justify-between gap-0.5 rounded-[9px] border-l-[3px] p-1.5`}
      >
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className="truncate font-mono text-[8.5px] leading-none font-semibold tracking-tight text-[#46433D] tabular-nums">
            {timeRangeLabel}
          </span>
          <span
            className={`shrink-0 rounded-full border px-1 py-0 font-mono text-[7.5px] leading-tight font-bold ${room.badgeClass}`}
          >
            {room.shortLabel}
          </span>
        </div>

        <p className="min-w-0 truncate text-[10px] leading-tight font-bold tracking-tight">
          {booking.customerName}
        </p>

        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1 pt-0.5">
          {!isMultiLane ? (
            <span className="max-w-full truncate rounded-full border border-[#151515]/10 bg-white/70 px-1.5 py-0 text-[8px] leading-tight font-medium text-[#46433D]">
              {serviceSummary}
            </span>
          ) : null}
          <span
            className={`rounded-full border px-1.5 py-0 text-[8px] leading-tight font-semibold ${paymentMeta.badgeClass}`}
          >
            {paymentMeta.shortLabel}
          </span>
          {endsAfterDisplay ? (
            <span className="rounded-full border border-amber-500/25 bg-[#FEF4DD] px-1.5 py-0 text-[8px] leading-tight font-semibold text-[#8A4B08]">
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
      title={ariaLabel}
      className={`${baseCardClass} ${cardSurfaceClass} ${topAccentClass} justify-between gap-0.5 rounded-[11px] border-l-[4px] p-1.5 sm:p-2`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center justify-between gap-1">
          <span className="truncate font-mono text-[9px] leading-none font-bold tracking-tight text-[#46433D] tabular-nums sm:text-[10px]">
            {timeRangeLabel}
          </span>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0 text-[8px] leading-tight font-bold sm:text-[9px] ${room.badgeClass}`}
          >
            {room.shortLabel}
          </span>
        </div>

        <div className="mt-1 min-w-0">
          <p className="truncate text-[11px] leading-tight font-bold tracking-tight sm:text-xs">
            {booking.customerName}
          </p>
          {booking.bandName && isLongDuration ? (
            <p className="mt-0.5 truncate text-[9px] leading-tight font-medium text-[#666159] sm:text-[10px]">
              {booking.bandName}
            </p>
          ) : null}
        </div>
      </div>

      {isLongDuration ? (
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1 pt-1">
          <span className="max-w-full truncate rounded-full border border-[#151515]/10 bg-white/70 px-1.5 py-0 text-[8px] leading-tight font-semibold text-[#46433D] sm:text-[9px]">
            {serviceSummary}
          </span>
          <span
            className={`rounded-full border px-1.5 py-0 text-[8px] leading-tight font-semibold sm:text-[9px] ${paymentMeta.badgeClass}`}
          >
            {paymentMeta.shortLabel}
          </span>
          <span
            className={`rounded-full border px-1.5 py-0 text-[8px] leading-tight font-semibold sm:text-[9px] ${sessionMeta.badgeClass}`}
          >
            {sessionMeta.label}
          </span>
          {endsAfterDisplay ? (
            <span className="rounded-full border border-amber-500/25 bg-[#FEF4DD] px-1.5 py-0 text-[8px] leading-tight font-semibold text-[#8A4B08]">
              s/d {formatMinuteOfDay(booking.endMinute)}
            </span>
          ) : null}
        </div>
      ) : (
        <span
          className={`mt-auto inline-flex w-fit rounded-full border px-1.5 py-0 text-[8px] leading-tight font-semibold ${paymentMeta.badgeClass}`}
        >
          {paymentMeta.shortLabel}
        </span>
      )}
      <span className="sr-only">{durationLabel}</span>
    </button>
  );
}
