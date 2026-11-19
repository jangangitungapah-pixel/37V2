import { AlertTriangle, CalendarDays, ChevronRight, Clock3, Loader2 } from 'lucide-react';

import {
  getInitialPaymentStatusMeta,
  getSessionStatusMeta,
  getStudioRoomById,
} from '@/features/admin/calendar/config/calendar-config';
import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

export function CustomerBookingHistory({
  bookings = [],
  totalLoaded = 0,
  hasMore = false,
  isTruncated = false,
  isLoading = false,
  error = null,
  onLoadMore,
  onSelectBooking,
}) {
  if (isLoading) {
    return (
      <div
        role="status"
        className="border-studio-ink bg-studio-ivory flex items-center gap-2 border p-4 font-mono text-xs font-bold"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Memuat riwayat booking customer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2.5 border-2 p-3.5 text-xs font-bold"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="border-studio-ink bg-studio-ivory border-2 border-dashed p-5 text-center">
        <p className="font-display text-studio-ink text-lg font-black uppercase">
          Belum Ada Riwayat Booking
        </p>
        <p className="text-studio-muted-ink mt-1 text-xs font-medium">
          Booking baru dari halaman Calendar yang tertaut ke profil ini akan muncul otomatis di
          sini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {isTruncated ? (
        <div className="border-studio-ink border bg-amber-100 px-3 py-2 font-mono text-[10px] font-bold text-neutral-800">
          Menampilkan 100 booking terbaru per ID histori yang tergabung.
        </div>
      ) : null}

      <div className="space-y-2">
        {bookings.map((booking) => {
          const room = getStudioRoomById(booking.studioId);
          const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
          const paymentMeta = getInitialPaymentStatusMeta(booking.initialPaymentStatus);
          const serviceDisplay = booking.serviceOptionName
            ? `${booking.serviceTypeName || booking.serviceLabel} • ${booking.serviceOptionName}`
            : booking.packageLabel
              ? `${booking.serviceLabel} • ${booking.packageLabel}`
              : booking.recordingTypeLabel
                ? `${booking.serviceLabel} • ${booking.recordingTypeLabel}`
                : booking.serviceLabel;

          return (
            <button
              key={booking.id}
              type="button"
              onClick={() => onSelectBooking?.(booking)}
              aria-label={`Buka detail booking ${booking.customerName} tanggal ${booking.date}`}
              className="border-studio-ink bg-studio-white hover:bg-studio-ivory/70 group block w-full cursor-pointer border-2 p-3 text-left transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                    <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{formatIndonesianDateMedium(booking.date)}</span>
                  </span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${room.badgeClass}`}
                  >
                    {room.shortLabel}
                  </span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${sessionMeta.badgeClass}`}
                  >
                    {sessionMeta.label}
                  </span>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                  >
                    {paymentMeta.shortLabel}
                  </span>
                </div>

                <ChevronRight
                  className="text-studio-muted-ink group-hover:text-studio-orange h-4 w-4 shrink-0 transition-colors"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <p className="text-studio-ink truncate text-sm font-extrabold">
                    {booking.customerName}
                    {booking.bandName ? (
                      <span className="text-studio-muted-ink font-semibold">
                        {' '}
                        • {booking.bandName}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-studio-muted-ink truncate text-xs font-semibold">
                    {serviceDisplay}
                  </p>
                </div>

                <div className="text-studio-ink inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{formatMinuteRange(booking.startMinute, booking.endMinute, false)}</span>
                  <span className="text-studio-muted-ink">
                    ({formatDurationMinutes(booking.durationMinutes)})
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 w-full cursor-pointer items-center justify-center px-4 py-2 font-mono text-xs font-extrabold uppercase sm:w-auto"
          >
            Load More ({bookings.length} / {totalLoaded})
          </button>
        </div>
      ) : null}
    </div>
  );
}
