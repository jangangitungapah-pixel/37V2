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
import { AdminStatusBadge } from '@/features/admin/design-system';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';
import { getCommissionBasisLabel } from '../utils/commission-snapshot';

/**
 * Slide-over detail drawer for inspecting a completed session's commission breakdown.
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
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={`Detail komisi booking ${item.bookingId}`}
          data-commission-scoped="true"
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-lg flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 shrink-0 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/92 px-4 py-3.5 backdrop-blur-md sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminStatusBadge
                    tone={isPosted ? 'lime' : isNeedsReview ? 'orange' : 'amber'}
                    size="sm"
                  >
                    {isPosted ? 'Posted' : isNeedsReview ? 'Needs Review' : 'Pending Review'}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone="ivory" size="sm" className="font-mono">
                    Snapshot {snapshot.schemaVersion ? `V${snapshot.schemaVersion}` : 'Missing'}
                  </AdminStatusBadge>
                </div>

                <Dialog.Title className="mt-2 truncate text-lg font-bold tracking-tight text-[#151515] sm:text-xl">
                  {booking.customerName}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 font-mono text-xs break-all text-[#666159]">
                  Booking ID: <strong className="text-[#151515]">{item.bookingId}</strong>
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail komisi booking"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="sa-safe-bottom flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* Session Info */}
            <section className="sa-card p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#666159]">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Informasi Sesi Studio</span>
              </h3>

              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Customer / Band</dt>
                  <dd className="min-w-0 text-right font-semibold break-words text-[#151515]">
                    {booking.customerName}
                    {booking.bandName ? ` (${booking.bandName})` : ''}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Booking ID</dt>
                  <dd className="min-w-0 text-right font-mono font-medium break-all text-[#151515]">
                    {item.bookingId}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Layanan &amp; Subkategori</dt>
                  <dd className="min-w-0 text-right font-medium break-words text-[#151515]">
                    {serviceInfo.serviceTypeName} — {serviceInfo.serviceOptionName}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Ruangan Studio</dt>
                  <dd className="min-w-0 text-right font-medium text-[#151515]">{room.label}</dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Tanggal Booking</dt>
                  <dd className="min-w-0 text-right font-mono font-medium text-[#151515]">
                    {booking.date ? formatIndonesianDateMedium(booking.date) : '-'} (
                    {formatMinuteRange(booking.startMinute, booking.endMinute)})
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Selesai Aktual</dt>
                  <dd className="min-w-0 text-right font-mono font-semibold text-[#151515]">
                    {formatIndonesianTimestamp(booking.actualCompletedAt)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Durasi Sesi</dt>
                  <dd className="min-w-0 text-right font-mono font-medium text-[#151515]">
                    {formatDurationMinutes(booking.durationMinutes)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Snapshot Breakdown */}
            <section className="sa-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#151515]">
                  <Receipt className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                  <span>Rincian Snapshot Komisi</span>
                </h3>
                {snapshot.isValid ? (
                  <AdminStatusBadge tone="ivory" size="sm" className="font-mono">
                    Tarif v{snapshot.settingsVersion} • Schema V{snapshot.schemaVersion}
                  </AdminStatusBadge>
                ) : null}
              </div>

              {isNeedsReview ? (
                <div className="mt-3 rounded-xl border border-amber-500/25 bg-[#FEF4DD] p-3 text-xs">
                  <p className="font-semibold text-[#8A4B08]">
                    Needs Review — Tidak Dapat Diposting
                  </p>
                  <p className="mt-1 text-[#8A4B08]/90">{reason}</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <div className="sa-panel-ivory p-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#151515]">Staff / Studio Guard</p>
                        <p className="mt-0.5 font-mono text-[10.5px] break-words text-[#666159]">
                          Basis: {getCommissionBasisLabel(snapshot.staff?.basis)} (Rate:{' '}
                          {formatRupiah(snapshot.staff?.rate || 0)})
                        </p>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[#151515] tabular-nums">
                        {formatRupiah(item.staffPayableAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="sa-panel-ivory p-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#151515]">
                          Recording Operator / External PIC
                        </p>
                        <p className="mt-0.5 font-mono text-[10.5px] break-words text-[#666159]">
                          Basis: {getCommissionBasisLabel(snapshot.recordingOperator?.basis)} (Rate:{' '}
                          {formatRupiah(snapshot.recordingOperator?.rate || 0)})
                        </p>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[#151515] tabular-nums">
                        {formatRupiah(item.recordingOperatorPayableAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#8BAD12]/35 bg-[#EDF8C2] p-3 text-xs font-bold text-[#151515]">
                    <span>Total Dibayar (Payable Total)</span>
                    <span className="font-mono tabular-nums">
                      {formatRupiah(item.payableTotal)}
                    </span>
                  </div>

                  <div className="rounded-xl border border-dashed border-[#151515]/15 bg-white p-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="inline-flex items-center gap-1.5 font-semibold text-[#46433D]">
                          <Info
                            className="h-3.5 w-3.5 shrink-0 text-[#666159]"
                            aria-hidden="true"
                          />
                          <span>Owner Allocation (Referensi Saja)</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#666159]">
                          Basis: {getCommissionBasisLabel(snapshot.owner?.basis)} • Tidak masuk
                          hutang biaya ke Pembukuan
                        </p>
                      </div>
                      <span className="shrink-0 font-mono font-bold text-[#46433D] tabular-nums">
                        {formatRupiah(item.ownerAllocationReference)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Audit Provenance if already posted */}
            {isPosted && postingItem ? (
              <section className="rounded-2xl border border-[#8BAD12]/30 bg-[#EDF8C2]/45 p-4 text-xs">
                <p className="font-semibold text-[#243300]">Status Posting Pembukuan</p>
                <p className="mt-1 text-[#243300]/90">
                  Sudah masuk batch <strong className="font-mono">{postingItem.batchId}</strong>{' '}
                  pada {formatIndonesianTimestamp(postingItem.postedAt)}.
                </p>
                <p className="mt-1 text-[11px] text-[#46433D]">
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
