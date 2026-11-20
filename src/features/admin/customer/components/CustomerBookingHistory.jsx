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
import { AdminEmptyState, AdminStatusBadge } from '@/features/admin/design-system';

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
        className="sa-panel-ivory flex items-center gap-2 p-4 text-xs font-medium text-[#666159]"
      >
        <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
        <span>Memuat riwayat booking customer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <AdminEmptyState
        title="Belum Ada Riwayat Booking"
        description="Booking baru dari halaman Calendar yang tertaut ke profil ini akan muncul otomatis di sini."
      />
    );
  }

  return (
    <div className="space-y-3">
      {isTruncated ? (
        <div className="rounded-xl border border-amber-500/25 bg-[#FEF4DD] px-3 py-2 text-xs font-medium text-[#8A4B08]">
          Menampilkan 100 booking terbaru per ID histori yang tergabung.
        </div>
      ) : null}

      <div className="space-y-2.5">
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
              className="group block w-full cursor-pointer rounded-xl border border-[#151515]/10 bg-[#FAF8F3]/75 p-3.5 text-left transition-all hover:border-[#151515]/20 hover:bg-white hover:shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge tone="ink" icon={CalendarDays} size="sm" className="font-mono">
                    {formatIndonesianDateMedium(booking.date)}
                  </AdminStatusBadge>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${room.badgeClass}`}
                  >
                    {room.shortLabel}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${sessionMeta.badgeClass}`}
                  >
                    {sessionMeta.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${paymentMeta.badgeClass}`}
                  >
                    {paymentMeta.shortLabel}
                  </span>
                </div>

                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[#8B857B] transition-colors group-hover:text-[#FF4B22]"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2.5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#151515]">
                    {booking.customerName}
                    {booking.bandName ? (
                      <span className="font-normal text-[#666159]"> • {booking.bandName}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-[#666159]">{serviceDisplay}</p>
                </div>

                <div className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium text-[#151515]">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#8B857B]" aria-hidden="true" />
                  <span>{formatMinuteRange(booking.startMinute, booking.endMinute, false)}</span>
                  <span className="text-[#666159]">
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
            className="sa-control sa-btn-secondary inline-flex min-h-10 w-full cursor-pointer items-center justify-center px-4 py-2 text-xs font-semibold sm:w-auto"
          >
            Load More ({bookings.length} / {totalLoaded})
          </button>
        </div>
      ) : null}
    </div>
  );
}
