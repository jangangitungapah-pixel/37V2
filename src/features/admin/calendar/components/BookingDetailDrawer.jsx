import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  History,
  Loader2,
  Phone,
  Play,
  ReceiptText,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
} from '@/features/admin/payment/utils/invoice-status';
import { resolveBookingLatestPaymentView } from '@/features/admin/payment/utils/payment-calculation';
import { BookingCustomerReviewSection } from '@/features/customer-reviews/components/BookingCustomerReviewSection';

import {
  BOOKING_EVENT_LABELS,
  getInitialPaymentStatusMeta,
  getPaymentMethodLabel,
  getSessionStatusMeta,
  getStudioRoomById,
} from '../config/calendar-config';
import { useBookingEvents } from '../hooks/useCalendarBookings';
import { generateOperationId } from '../repositories/calendar-booking-repository';
import {
  extractBookingFinancialSnapshot,
  formatRupiah,
  getCommissionSnapshotDisplay,
} from '../utils/booking-pricing';
import {
  formatDurationMinutes,
  formatMinuteRange,
  getBookingLifecycleCapabilities,
} from '../utils/booking-time';
import { formatIndonesianDateFull, formatIndonesianTimestamp } from '../utils/calendar-date';

export function BookingDetailDrawer({
  booking,
  open,
  onOpenChange,
  onEditBooking = null,
  onRescheduleBooking = null,
  onLifecycleAction = null,
  readOnly = false,
  overlayZIndexClass = '',
  now = undefined,
}) {
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');

  const { events, isLoading: isEventsLoading } = useBookingEvents(
    open && booking?.id ? booking.id : '',
  );

  if (!booking) {
    return null;
  }

  const room = getStudioRoomById(booking.studioId);
  const latestPayment =
    booking.invoiceSummary ||
    resolveBookingLatestPaymentView(booking, booking.linkedInvoice || null);
  const paymentMeta = latestPayment.hasInvoice
    ? getPaymentStatusMeta(latestPayment.paymentStatus)
    : getInitialPaymentStatusMeta(booking.initialPaymentStatus);
  const invoiceStatusMeta = latestPayment.hasInvoice
    ? getInvoiceStatusMeta(latestPayment.invoiceStatus)
    : null;
  const sessionMeta = getSessionStatusMeta(booking.sessionStatus);
  const capabilities = getBookingLifecycleCapabilities(booking, now);
  const financial = extractBookingFinancialSnapshot(booking);
  const commissionDisplay = getCommissionSnapshotDisplay(booking.commissionSnapshot);
  const remainingBalance = latestPayment.hasInvoice
    ? latestPayment.balanceDue
    : financial.remainingBalance;
  const displayedPaidAmount = latestPayment.hasInvoice
    ? latestPayment.amountPaid
    : financial.initialPaidAmount;
  const displayedTotalAmount = latestPayment.hasInvoice
    ? latestPayment.totalAmount
    : financial.totalAmount;
  const serviceTitle = booking.serviceTypeName || booking.serviceLabel;
  const optionTitle =
    booking.serviceOptionName || booking.packageLabel || booking.recordingTypeLabel || '';

  const handleRunAction = async (actionKey, noteValue = '') => {
    if (actionLoading) return;
    setActionLoading(actionKey);
    setActionError('');

    const eventId = generateOperationId('evt');
    try {
      await onLifecycleAction({
        booking,
        action: actionKey,
        note: noteValue,
        eventId,
      });
      setShowCancelConfirm(false);
      setShowNoShowConfirm(false);
    } catch (err) {
      setActionError(err?.message || 'Gagal memperbarui status sesi booking.');
    } finally {
      setActionLoading('');
    }
  };

  const isInteractive =
    !readOnly && Boolean(onEditBooking || onRescheduleBooking || onLifecycleAction);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className={`sa-overlay-backdrop fixed inset-0 transition-opacity ${overlayZIndexClass ? 'z-[60]' : 'z-40'}`}
        />

        <Dialog.Popup
          aria-label={`Detail booking ${booking.customerName}`}
          data-calendar-scoped="true"
          data-admin-portal-layer="true"
          className={`sa-drawer fixed inset-y-0 right-0 flex h-dvh w-full max-w-xl flex-col ${overlayZIndexClass || 'z-50'}`}
        >
          {/* Sticky Drawer Header */}
          <div className="shrink-0 border-b border-white/10 bg-[#151515] px-4 py-3 text-[#F1EEE4] sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${room.badgeClass}`}
                  >
                    {room.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-[11px] ${sessionMeta.badgeClass}`}
                  >
                    Sesi: {sessionMeta.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-[11px] ${paymentMeta.badgeClass}`}
                  >
                    Bayar: {paymentMeta.shortLabel}
                  </span>
                </div>

                <Dialog.Title className="mt-1.5 truncate text-lg font-bold tracking-tight text-white sm:mt-2.5 sm:text-2xl">
                  {booking.customerName}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate font-mono text-[11px] text-neutral-400 sm:mt-1 sm:text-xs">
                  {booking.bandName ? `${booking.bandName} • ` : ''}ID: {booking.id}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail booking"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/8 text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Quick Booking Actions Bar: Edit, Reschedule, Cancel */}
            {isInteractive ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2.5 sm:mt-4 sm:gap-2 sm:pt-3.5">
                {onEditBooking ? (
                  <button
                    type="button"
                    disabled={!capabilities.canEditOrReschedule || Boolean(actionLoading)}
                    onClick={() => onEditBooking(booking)}
                    className="text-studio-ink hover:bg-studio-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Edit Booking</span>
                  </button>
                ) : null}

                {onRescheduleBooking ? (
                  <button
                    type="button"
                    disabled={!capabilities.canEditOrReschedule || Boolean(actionLoading)}
                    onClick={() => onRescheduleBooking(booking)}
                    className="bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#d3f752] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
                  >
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reschedule</span>
                  </button>
                ) : null}

                {onLifecycleAction ? (
                  <button
                    type="button"
                    disabled={!capabilities.canCancel || Boolean(actionLoading)}
                    onClick={() => setShowCancelConfirm((prev) => !prev)}
                    className="bg-studio-orange hover:bg-studio-orange-hover inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cancel Booking</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Scrollable Drawer Content */}
          <div className="sa-safe-bottom min-h-0 flex-1 space-y-4 overflow-y-auto px-3.5 pt-3.5 sm:space-y-5 sm:px-6 sm:pt-5 sm:pb-6">
            {actionError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C] shadow-xs"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            {/* Inline Cancel Confirmation Box */}
            {showCancelConfirm && capabilities.canCancel ? (
              <div className="sa-card p-4 sm:p-5">
                <p className="text-sm font-semibold text-[#B92B0C]">
                  Konfirmasi Pembatalan Booking
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#666159]">
                  Slot ruangan akan langsung dikosongkan agar dapat dipakai booking lain, sedangkan
                  catatan booking ini tetap tersimpan.
                </p>

                <label
                  htmlFor="cancel-booking-reason"
                  className="text-studio-ink mt-3 block text-xs font-medium"
                >
                  Alasan Pembatalan (Opsional)
                </label>
                <input
                  id="cancel-booking-reason"
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Permintaan perubahan jadwal dari band"
                  className="sa-input mt-1.5 min-h-10 w-full rounded-xl px-3 py-2 text-xs font-medium"
                />

                <div className="mt-3.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="sa-control sa-btn-secondary min-h-10 cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold"
                  >
                    Urungkan
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => handleRunAction('cancel_session', cancelReason)}
                    className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    {actionLoading === 'cancel_session' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    <span>Ya, Batalkan Booking</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* SECTION 1: BOOKING OVERVIEW */}
            <section aria-labelledby="drawer-overview-heading" className="sa-card p-4 sm:p-5">
              <h3
                id="drawer-overview-heading"
                className="text-studio-ink text-sm font-semibold tracking-tight"
              >
                Booking Overview
              </h3>

              <dl className="mt-3.5 grid grid-cols-1 gap-3.5 border-t border-[#151515]/8 pt-3.5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Customer</dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-semibold">
                    {booking.customerName}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Band / Project</dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-medium">
                    {booking.bandName || '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Nomor HP / WhatsApp</dt>
                  <dd className="text-studio-ink mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                    <Phone className="h-3.5 w-3.5 text-[#8B857B]" aria-hidden="true" />
                    <span>{booking.phone}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Studio Room</dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-semibold">{room.label}</dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">
                    Layanan &amp; Subcategory
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-semibold">
                    {serviceTitle}
                    {optionTitle ? ` • ${optionTitle}` : ''}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-[#666159]">Tanggal Sesi</dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-semibold">
                    {formatIndonesianDateFull(booking.date)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-medium text-[#666159]">Jam &amp; Durasi</dt>
                  <dd className="text-studio-ink mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                    <Clock3 className="h-4 w-4 text-[#8B857B]" aria-hidden="true" />
                    <span>
                      {formatMinuteRange(booking.startMinute, booking.endMinute)} (
                      {formatDurationMinutes(booking.durationMinutes)})
                    </span>
                  </dd>
                </div>
              </dl>

              {/* Financial & Authoritative Invoice Ledger Subcard */}
              <div className="sa-panel-ivory mt-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-studio-ink inline-flex items-center gap-1.5 text-xs font-semibold">
                    <ReceiptText className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                    <span>
                      {latestPayment.hasInvoice
                        ? 'Status Invoice & Pembayaran Terkini'
                        : 'Informasi Pembayaran Awal'}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {invoiceStatusMeta ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${invoiceStatusMeta.badgeClass}`}
                      >
                        {invoiceStatusMeta.label}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.indoLabel || paymentMeta.label}
                    </span>
                  </div>
                </div>

                {latestPayment.hasInvoice ? (
                  <div className="sa-subcard mt-3 flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5">
                    <div className="min-w-0 font-mono text-xs">
                      <span className="block font-sans text-[10.5px] text-[#666159]">
                        Nomor Invoice
                      </span>
                      <span className="text-studio-ink font-semibold">
                        {latestPayment.invoiceNumber}
                      </span>
                    </div>
                    <Link
                      to={`/admin/payment-and-bill?invoiceId=${encodeURIComponent(latestPayment.invoiceId)}`}
                      className="sa-control sa-btn-primary hover:bg-studio-orange inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    >
                      <span>Lihat Invoice</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                ) : null}

                {latestPayment.isSnapshotMismatch ? (
                  <p className="mt-2.5 rounded-xl border border-amber-500/25 bg-[#FEF4DD] px-3 py-2 text-xs font-medium text-[#8A4B08]">
                    Perhatian: Total booking terbaru ({formatRupiah(financial.totalAmount)}) berbeda
                    dari total di invoice ({formatRupiah(latestPayment.totalAmount)}). Sesuaikan
                    tagihan melalui halaman Payment and Bill.
                  </p>
                ) : null}

                <dl className="mt-3 space-y-1.5 text-xs">
                  {financial.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-[#666159]">Harga Normal</dt>
                        <dd className="font-mono font-semibold tabular-nums">
                          {formatRupiah(financial.subtotal)}
                        </dd>
                      </div>
                      <div className="flex justify-between text-[#0F6246]">
                        <dt>
                          {financial.automaticDiscount
                            ? 'Diskon Durasi'
                            : booking.packageId
                              ? 'Diskon Paket'
                              : 'Diskon'}
                        </dt>
                        <dd className="font-mono font-semibold tabular-nums">
                          -{formatRupiah(financial.discountAmount)}
                        </dd>
                      </div>
                      {financial.automaticDiscount ? (
                        <p className="text-[11px] font-medium text-[#0F6246]">
                          {financial.automaticDiscount.eligibleBlocks}x kelipatan{' '}
                          {formatDurationMinutes(financial.automaticDiscount.intervalMinutes)} (-
                          {formatRupiah(financial.automaticDiscount.discountPerBlock)})
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-[#666159]">Total Tagihan</dt>
                    <dd className="text-studio-ink font-mono font-semibold tabular-nums">
                      {formatRupiah(displayedTotalAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#666159]">
                      {latestPayment.hasInvoice ? 'Sudah Dibayar' : 'Pembayaran Awal'}
                    </dt>
                    <dd className="text-studio-ink font-mono font-semibold tabular-nums">
                      {formatRupiah(displayedPaidAmount)}
                      {!latestPayment.hasInvoice && booking.paymentMethod
                        ? ` (${getPaymentMethodLabel(booking.paymentMethod)})`
                        : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-[#151515]/10 pt-2 font-semibold">
                    <dt className="text-[#B92B0C]">Sisa Tagihan</dt>
                    <dd className="font-mono text-[#B92B0C] tabular-nums">
                      {formatRupiah(remainingBalance)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Internal Operational Fee Breakdown */}
              <div className="sa-subcard mt-3.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-studio-ink text-xs font-semibold">
                    Pembagian Komisi Tim
                  </span>
                  {commissionDisplay ? (
                    <span className="rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-0.5 font-mono text-[10.5px] font-medium text-[#46433D]">
                      Tarif v{commissionDisplay.settingsVersion}
                    </span>
                  ) : null}
                </div>

                {commissionDisplay ? (
                  <dl className="mt-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-[#666159]">Staff Fee</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatRupiah(commissionDisplay.staff.amount)}
                      </dd>
                    </div>
                    {commissionDisplay.owner ? (
                      <div className="flex justify-between">
                        <dt className="text-[#666159]">Owner Fee</dt>
                        <dd className="font-mono font-semibold tabular-nums">
                          {formatRupiah(commissionDisplay.owner.amount)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <dt className="text-[#666159]">Recording Operator Fee</dt>
                      <dd className="font-mono font-semibold tabular-nums">
                        {formatRupiah(commissionDisplay.recordingOperator.amount)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-1.5 text-xs text-[#666159]">
                    Belum ada catatan komisi tim untuk booking lama ini.
                  </p>
                )}
              </div>

              {booking.notes ? (
                <div className="mt-3.5 border-t border-[#151515]/8 pt-3.5">
                  <p className="text-[11px] font-medium text-[#666159]">Catatan Sesi</p>
                  <p className="text-studio-ink mt-1 text-xs leading-relaxed">{booking.notes}</p>
                </div>
              ) : null}
            </section>

            {/* SECTION 2: SESSION STATUS */}
            <section aria-labelledby="drawer-lifecycle-heading" className="sa-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/8 pb-3">
                <div>
                  <h3
                    id="drawer-lifecycle-heading"
                    className="text-studio-ink text-sm font-semibold tracking-tight"
                  >
                    Status Sesi Studio
                  </h3>
                  <p className="mt-0.5 text-xs text-[#666159]">
                    Status sesi operasional terpisah dari status pembayaran.
                  </p>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sessionMeta.badgeClass}`}
                >
                  {sessionMeta.label} ({sessionMeta.indoLabel})
                </span>
              </div>

              {/* Check-in & Execution Timestamps */}
              <div className="mt-3.5 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                <div className="sa-panel-ivory p-3">
                  <span className="block text-[10.5px] font-medium text-[#666159]">Check-in</span>
                  <span className="text-studio-ink mt-1 block font-mono text-xs font-semibold">
                    {booking.checkedInAt
                      ? formatIndonesianTimestamp(booking.checkedInAt)
                      : 'Belum Check-in'}
                  </span>
                </div>

                <div className="sa-panel-ivory p-3">
                  <span className="block text-[10.5px] font-medium text-[#666159]">Mulai Sesi</span>
                  <span className="text-studio-ink mt-1 block font-mono text-xs font-semibold">
                    {booking.actualStartedAt
                      ? formatIndonesianTimestamp(booking.actualStartedAt)
                      : '-'}
                  </span>
                </div>

                <div className="sa-panel-ivory p-3">
                  <span className="block text-[10.5px] font-medium text-[#666159]">
                    Selesai Sesi
                  </span>
                  <span className="text-studio-ink mt-1 block font-mono text-xs font-semibold">
                    {booking.actualCompletedAt
                      ? formatIndonesianTimestamp(booking.actualCompletedAt)
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Operational Transition Buttons */}
              {isInteractive && onLifecycleAction ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!capabilities.canCheckIn || Boolean(actionLoading)}
                    onClick={() => handleRunAction('check_in')}
                    className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'check_in' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserCheck className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Check-in</span>
                  </button>

                  <button
                    type="button"
                    disabled={!capabilities.canStart || Boolean(actionLoading)}
                    onClick={() => handleRunAction('start_session')}
                    className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'start_session' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Start Session</span>
                  </button>

                  <button
                    type="button"
                    disabled={!capabilities.canComplete || Boolean(actionLoading)}
                    onClick={() => handleRunAction('complete_session')}
                    className="sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-[#E6F6EC] px-3.5 py-2 text-xs font-semibold text-[#0F6246] transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionLoading === 'complete_session' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Complete Session</span>
                  </button>

                  <button
                    type="button"
                    disabled={!capabilities.canMarkNoShow || Boolean(actionLoading)}
                    title={capabilities.noShowReason || 'Tandai customer tidak hadir (No Show)'}
                    onClick={() => setShowNoShowConfirm((prev) => !prev)}
                    className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserX className="h-4 w-4" aria-hidden="true" />
                    <span>Mark No Show</span>
                  </button>
                </div>
              ) : null}

              {isInteractive &&
              !capabilities.canMarkNoShow &&
              booking.sessionStatus === 'upcoming' &&
              capabilities.noShowReason ? (
                <p className="mt-2.5 text-xs text-[#666159]">
                  Info No Show: {capabilities.noShowReason}
                </p>
              ) : null}

              {showNoShowConfirm && capabilities.canMarkNoShow ? (
                <div className="sa-panel-ivory mt-3.5 p-4">
                  <label
                    htmlFor="no-show-reason-input"
                    className="text-studio-ink block text-xs font-semibold"
                  >
                    Catatan / Alasan No Show
                  </label>
                  <input
                    id="no-show-reason-input"
                    type="text"
                    value={noShowReason}
                    onChange={(e) => setNoShowReason(e.target.value)}
                    placeholder="Contoh: Tidak hadir >15 menit setelah jam mulai dan nomor tidak aktif"
                    className="sa-input mt-1.5 min-h-10 w-full rounded-xl px-3 py-2 text-xs font-medium"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNoShowConfirm(false)}
                      className="sa-control sa-btn-secondary min-h-10 cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(actionLoading)}
                      onClick={() => handleRunAction('mark_no_show', noShowReason)}
                      className="sa-control sa-btn-orange inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                    >
                      {actionLoading === 'mark_no_show' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      <span>Konfirmasi No Show</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            {/* SECTION 3: CUSTOMER REVIEW INVITATION & MODERATION LINK */}
            <BookingCustomerReviewSection booking={booking} readOnly={readOnly} now={now} />

            {/* SECTION 4: ACTIVITY HISTORY (FIRESTORE BOOKING EVENTS) */}
            <section aria-labelledby="drawer-activity-heading" className="sa-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-[#151515]/8 pb-3">
                <div className="flex items-center gap-2">
                  <History className="text-studio-orange h-4 w-4" aria-hidden="true" />
                  <h3
                    id="drawer-activity-heading"
                    className="text-studio-ink text-sm font-semibold tracking-tight"
                  >
                    Activity History (Firestore)
                  </h3>
                </div>
                <span className="rounded-full border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#46433D] tabular-nums">
                  {events.length} log
                </span>
              </div>

              {isEventsLoading ? (
                <div className="mt-3.5 flex items-center gap-2 text-xs text-[#666159]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memuat riwayat aktivitas...</span>
                </div>
              ) : events.length === 0 ? (
                <p className="mt-3.5 text-xs text-[#666159]">
                  Belum ada riwayat aktivitas yang tercatat untuk booking ini.
                </p>
              ) : (
                <ol className="mt-3.5 space-y-2.5">
                  {events.map((evt) => {
                    const eventLabel = BOOKING_EVENT_LABELS[evt.eventType] || evt.eventType;
                    return (
                      <li key={evt.id} className="sa-panel-ivory p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-studio-ink font-semibold">{eventLabel}</span>
                          <span className="font-mono text-[11px] text-[#666159]">
                            {formatIndonesianTimestamp(evt.createdAt)}
                          </span>
                        </div>
                        {evt.note ? (
                          <p className="mt-1.5 leading-relaxed text-[#46433D]">{evt.note}</p>
                        ) : null}
                        <p className="mt-1.5 font-mono text-[10.5px] text-[#8B857B]">
                          Actor UID: {evt.actorUid || '-'}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
