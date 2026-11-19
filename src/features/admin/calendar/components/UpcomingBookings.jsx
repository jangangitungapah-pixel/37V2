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
    <section
      aria-labelledby="upcoming-bookings-heading"
      className="cal-card bg-studio-white p-2.5 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-neutral-200 pb-2 sm:pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="border-studio-ink bg-studio-lime text-studio-ink flex h-7 w-7 shrink-0 items-center justify-center border">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3
              id="upcoming-bookings-heading"
              className="font-display text-studio-ink truncate text-lg leading-none font-black tracking-tight uppercase"
            >
              Jadwal Terdekat
            </h3>
            <p className="text-studio-muted-ink mt-0.5 truncate font-mono text-[9px] font-bold uppercase">
              Sesi aktif pada periode ini
            </p>
          </div>
        </div>

        <span className="border-studio-ink bg-studio-ivory shrink-0 border px-1.5 py-0.5 font-mono text-[11px] font-extrabold">
          {bookings.length}
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="border-studio-ink bg-studio-ivory mt-3 border border-dashed p-4 text-center">
          <p className="text-studio-ink text-xs font-extrabold sm:text-sm">
            Belum ada sesi terjadwal pada periode ini
          </p>
          <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed font-medium">
            Pilih slot jam pada kalender atau klik tombol di bawah untuk membuat booking baru.
          </p>
          <button
            type="button"
            onClick={() => onOpenNewBooking?.()}
            className="cal-control bg-studio-ink text-studio-white mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 font-mono text-[11px] font-extrabold uppercase sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Buat Booking Baru</span>
          </button>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
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
                  className="border-studio-ink bg-studio-ivory hover:bg-studio-white group flex w-full cursor-pointer flex-col gap-1.5 border-2 p-2.5 text-left shadow-[2px_2px_0px_#151515] transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-studio-ink truncate text-xs font-extrabold sm:text-sm">
                        {booking.customerName}
                      </p>
                      {booking.bandName ? (
                        <p className="text-studio-muted-ink truncate text-[11px] font-semibold">
                          {booking.bandName}
                        </p>
                      ) : null}
                    </div>

                    <ArrowUpRight
                      className="text-studio-muted-ink group-hover:text-studio-orange h-3.5 w-3.5 shrink-0 transition-colors"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="text-studio-ink flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10px] font-bold">
                    <span>{formatIndonesianDateMedium(booking.date)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>
                        {formatMinuteRange(booking.startMinute, booking.endMinute, false)}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${room.badgeClass}`}
                    >
                      {room.label}
                    </span>
                    <span className="border-studio-ink bg-studio-white border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                      {serviceSummary}
                    </span>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.shortLabel}
                    </span>
                    <span
                      className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${sessionMeta.badgeClass}`}
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
