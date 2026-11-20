import { ArrowUpRight, CalendarClock, Clock3, Plus } from 'lucide-react';

import { getPaymentStatusMeta } from '@/features/admin/payment/utils/invoice-status';

import {
  getInitialPaymentStatusMeta,
  getSessionStatusMeta,
  getStudioRoomById,
} from '../config/calendar-config';
import { formatMinuteRange } from '../utils/booking-time';
import { formatIndonesianDateMedium } from '../utils/calendar-date';

export function UpcomingBookings({ bookings = [], onSelectBooking, onOpenNewBooking }) {
  return (
    <section aria-labelledby="upcoming-bookings-heading" className="sa-card p-3 sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-[#151515]/8 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] text-[#243300]">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3
              id="upcoming-bookings-heading"
              className="text-studio-ink truncate text-sm font-semibold tracking-tight sm:text-base"
            >
              Jadwal Terdekat
            </h3>
            <p className="mt-0.5 truncate text-xs text-[#666159]">Sesi aktif pada periode ini</p>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#46433D] tabular-nums">
          {bookings.length}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="sa-panel-ivory mt-3.5 rounded-2xl border border-dashed border-[#151515]/15 p-5 text-center">
          <p className="text-studio-ink text-xs font-semibold sm:text-sm">
            Belum ada sesi terjadwal pada periode ini
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#666159]">
            Pilih slot jam pada kalender atau klik tombol di bawah untuk membuat booking baru.
          </p>
          <button
            type="button"
            onClick={() => onOpenNewBooking?.()}
            className="sa-control sa-btn-primary mt-3.5 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Buat Booking Baru</span>
          </button>
        </div>
      ) : (
        <ul className="mt-3.5 space-y-2.5">
          {bookings.map((booking) => {
            const room = getStudioRoomById(booking.studioId);
            const paymentMeta = booking.invoiceSummary?.hasInvoice
              ? getPaymentStatusMeta(booking.invoiceSummary.paymentStatus)
              : getInitialPaymentStatusMeta(booking.initialPaymentStatus);
            const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
            const serviceSummary =
              booking.packageLabel || booking.recordingTypeLabel || booking.serviceLabel;

            return (
              <li key={booking.id}>
                <button
                  type="button"
                  onClick={() => onSelectBooking(booking)}
                  aria-label={`Detail booking ${booking.customerName}, ${formatIndonesianDateMedium(booking.date)}, ${formatMinuteRange(booking.startMinute, booking.endMinute, false)}, ${room.label}`}
                  className="sa-subcard group flex w-full cursor-pointer flex-col gap-2 rounded-xl p-3 text-left transition-all hover:border-[#151515]/22 hover:bg-[#FCFBF7]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-studio-ink truncate text-xs font-semibold sm:text-sm">
                        {booking.customerName}
                      </p>
                      {booking.bandName ? (
                        <p className="truncate text-xs text-[#666159]">{booking.bandName}</p>
                      ) : null}
                    </div>

                    <ArrowUpRight
                      className="group-hover:text-studio-orange h-3.5 w-3.5 shrink-0 text-[#8B857B] transition-colors"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-medium text-[#46433D] tabular-nums">
                    <span>{formatIndonesianDateMedium(booking.date)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3 shrink-0 text-[#8B857B]" aria-hidden="true" />
                      <span>
                        {formatMinuteRange(booking.startMinute, booking.endMinute, false)}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${room.badgeClass}`}
                    >
                      {room.label}
                    </span>
                    <span className="rounded-full border border-[#151515]/10 bg-[#151515]/[0.045] px-2 py-0.5 text-[10px] font-medium text-[#46433D]">
                      {serviceSummary}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.shortLabel}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${sessionMeta.badgeClass}`}
                    >
                      {sessionMeta.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
