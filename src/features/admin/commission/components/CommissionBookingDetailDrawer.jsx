import { Dialog } from '@base-ui/react/dialog';
import { CalendarClock, Info, Receipt, X } from 'lucide-react';

import { getStudioRoomById } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';
import { getCommissionBasisLabel } from '../utils/commission-snapshot';

/**
 * Slide-over detail drawer for inspecting a completed session's commission breakdown (Section 6.E).
 */
export function CommissionBookingDetailDrawer({ item, open, onOpenChange }) {
  if (!item && !open) return null;
  if (!item) return null;

  const { booking, serviceInfo, snapshot, status, postingItem, reason } = item;
  const room = getStudioRoomById(booking.studioId);
  const isPosted = status === COMMISSION_ITEM_STATUS.POSTED;
  const isNeedsReview = status === COMMISSION_ITEM_STATUS.NEEDS_REVIEW;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={`Detail komisi booking ${item.bookingId}`}
          data-commission-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col border-l-2 shadow-[-6px_0px_0px_#151515]"
        >
          {/* Sticky Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase ${
                      isPosted
                        ? 'border-studio-ivory bg-studio-lime text-studio-ink'
                        : isNeedsReview
                          ? 'border-studio-ivory bg-studio-orange text-white'
                          : 'border-studio-ivory text-studio-ink bg-amber-200'
                    }`}
                  >
                    {isPosted ? 'Posted' : isNeedsReview ? 'Needs Review' : 'Pending Review'}
                  </span>
                  <span className="border-studio-ivory border bg-neutral-800 px-2 py-0.5 font-mono text-[9px] font-bold text-neutral-200 uppercase">
                    Snapshot {snapshot.schemaVersion ? `V${snapshot.schemaVersion}` : 'Missing'}
                  </span>
                </div>

                <Dialog.Title className="font-display mt-1.5 truncate text-xl leading-none font-black text-white uppercase sm:text-2xl">
                  {booking.customerName}
                </Dialog.Title>
                <Dialog.Description className="mt-1 font-mono text-[11px] text-neutral-300">
                  Booking ID: <strong className="text-studio-lime">{item.bookingId}</strong>
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail komisi booking"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* Session Info */}
            <section className="cal-card bg-studio-white p-3.5">
              <h3 className="text-studio-muted-ink flex items-center gap-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Informasi Sesi Studio</span>
              </h3>

              <dl className="mt-2.5 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Customer / Band</dt>
                  <dd className="text-right font-extrabold">
                    {booking.customerName}
                    {booking.bandName ? ` (${booking.bandName})` : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Booking ID</dt>
                  <dd className="text-right font-bold">{item.bookingId}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Layanan &amp; Subkategori</dt>
                  <dd className="text-right font-bold">
                    {serviceInfo.serviceTypeName} — {serviceInfo.serviceOptionName}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Ruangan Studio</dt>
                  <dd className="text-right font-bold">{room.label}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Tanggal Booking</dt>
                  <dd className="text-right font-bold">
                    {booking.date ? formatIndonesianDateMedium(booking.date) : '-'} (
                    {formatMinuteRange(booking.startMinute, booking.endMinute)})
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Selesai Aktual</dt>
                  <dd className="text-studio-ink text-right font-extrabold">
                    {formatIndonesianTimestamp(booking.actualCompletedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Durasi Sesi</dt>
                  <dd className="text-right font-bold">
                    {formatDurationMinutes(booking.durationMinutes)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Snapshot Breakdown */}
            <section className="cal-card bg-studio-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-studio-ink flex items-center gap-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Rincian Snapshot Komisi</span>
                </h3>
                {snapshot.isValid ? (
                  <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase">
                    Tarif v{snapshot.settingsVersion} • Schema V{snapshot.schemaVersion}
                  </span>
                ) : null}
              </div>

              {isNeedsReview ? (
                <div className="border-studio-ink mt-2.5 border bg-amber-100 p-2.5 font-mono text-xs">
                  <p className="font-extrabold text-[#9a3412]">
                    Needs Review — Tidak Dapat Diposting
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-neutral-800">{reason}</p>
                </div>
              ) : (
                <div className="mt-2.5 space-y-2.5">
                  <div className="border-studio-ink bg-studio-ivory border p-2.5 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-studio-ink font-extrabold">Staff / Studio Guard</p>
                        <p className="text-studio-muted-ink text-[10px]">
                          Basis: {getCommissionBasisLabel(snapshot.staff?.basis)} (Rate:{' '}
                          {formatRupiah(snapshot.staff?.rate || 0)})
                        </p>
                      </div>
                      <span className="text-studio-ink font-black tabular-nums">
                        {formatRupiah(item.staffPayableAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="border-studio-ink bg-studio-ivory border p-2.5 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-studio-ink font-extrabold">
                          Recording Operator / External PIC
                        </p>
                        <p className="text-studio-muted-ink text-[10px]">
                          Basis: {getCommissionBasisLabel(snapshot.recordingOperator?.basis)} (Rate:{' '}
                          {formatRupiah(snapshot.recordingOperator?.rate || 0)})
                        </p>
                      </div>
                      <span className="text-studio-ink font-black tabular-nums">
                        {formatRupiah(item.recordingOperatorPayableAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="border-studio-ink bg-studio-lime/40 flex justify-between border-2 p-2.5 font-mono text-xs font-extrabold">
                    <span>Total Dibayar (Payable Total)</span>
                    <span className="tabular-nums">{formatRupiah(item.payableTotal)}</span>
                  </div>

                  <div className="border-studio-ink bg-studio-white border border-dashed p-2.5 font-mono text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-studio-muted-ink inline-flex items-center gap-1 font-extrabold">
                          <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Owner Allocation (Referensi Saja)</span>
                        </p>
                        <p className="text-studio-subtle-ink mt-0.5 text-[10px]">
                          Basis: {getCommissionBasisLabel(snapshot.owner?.basis)} • Tidak masuk
                          hutang biaya ke Pembukuan
                        </p>
                      </div>
                      <span className="text-studio-muted-ink font-black tabular-nums">
                        {formatRupiah(item.ownerAllocationReference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Audit Provenance if already posted */}
            {isPosted && postingItem ? (
              <section className="cal-card bg-studio-lime/20 p-3.5 font-mono text-xs">
                <p className="text-studio-ink font-extrabold uppercase">Status Posting Pembukuan</p>
                <p className="text-studio-muted-ink mt-1 text-[11px]">
                  Sudah masuk batch{' '}
                  <strong className="text-studio-ink">{postingItem.batchId}</strong> pada{' '}
                  {formatIndonesianTimestamp(postingItem.postedAt)}.
                </p>
                <p className="text-studio-subtle-ink mt-1 text-[10px] font-semibold">
                  Sesi yang sudah diposting bersifat permanen agar tidak terhitung dua kali di
                  Pembukuan.
                </p>
              </section>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
