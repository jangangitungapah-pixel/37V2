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
          className={`fixed inset-0 bg-black/65 backdrop-blur-[1px] ${overlayZIndexClass ? 'z-[60]' : 'z-40'}`}
        />

        <Dialog.Popup
          aria-label={`Detail booking ${booking.customerName}`}
          data-calendar-scoped="true"
          className={`border-studio-ink bg-studio-ivory text-studio-ink fixed inset-y-0 right-0 flex h-[100dvh] w-full max-w-xl flex-col border-l-2 shadow-[-6px_0px_0px_#151515] ${overlayZIndexClass || 'z-50'}`}
        >
          {/* Sticky Drawer Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${room.badgeClass}`}
                  >
                    {room.label}
                  </span>
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${sessionMeta.badgeClass}`}
                  >
                    Sesi: {sessionMeta.label}
                  </span>
                  <span
                    className={`border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                  >
                    Bayar: {paymentMeta.shortLabel}
                  </span>
                </div>

                <Dialog.Title className="font-display mt-2 truncate text-2xl leading-none font-black tracking-tight text-white uppercase sm:text-3xl">
                  {booking.customerName}
                </Dialog.Title>
                <Dialog.Description className="mt-1 font-mono text-xs text-neutral-300">
                  {booking.bandName ? `${booking.bandName} • ` : ''}ID: {booking.id}
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail booking"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Quick Booking Actions Bar: Edit, Reschedule, Cancel */}
            {isInteractive ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
                {onEditBooking ? (
                  <button
                    type="button"
                    disabled={!capabilities.canEditOrReschedule || Boolean(actionLoading)}
                    onClick={() => onEditBooking(booking)}
                    className="border-studio-ivory bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex min-h-10 cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="border-studio-ivory bg-studio-orange text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-1.5 border px-3 py-1.5 font-mono text-xs font-extrabold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Cancel Booking</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Scrollable Drawer Content */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-8 sm:px-6 sm:py-5">
            {actionError ? (
              <div
                role="alert"
                className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2.5 border-2 p-3 text-xs font-bold shadow-[2px_2px_0px_#151515]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            {/* Inline Cancel Confirmation Box */}
            {showCancelConfirm && capabilities.canCancel ? (
              <div className="border-studio-ink bg-studio-white border-2 p-4 shadow-[3px_3px_0px_#151515]">
                <p className="font-mono text-xs font-extrabold text-[#b92b0c] uppercase">
                  Konfirmasi Pembatalan Booking
                </p>
                <p className="text-studio-muted-ink mt-1 text-xs leading-relaxed font-medium">
                  Slot ruangan akan dilepaskan secara atomik agar dapat dipakai booking lain, namun
                  dokumen histori booking tetap tersimpan.
                </p>

                <label
                  htmlFor="cancel-booking-reason"
                  className="text-studio-ink mt-3 block font-mono text-[11px] font-bold uppercase"
                >
                  Alasan Pembatalan (Opsional)
                </label>
                <input
                  id="cancel-booking-reason"
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Contoh: Permintaan perubahan jadwal dari band"
                  className="border-studio-ink bg-studio-ivory mt-1 min-h-10 w-full border px-3 py-1.5 text-xs font-semibold"
                />

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="border-studio-ink bg-studio-ivory min-h-10 cursor-pointer border px-3 py-1.5 font-mono text-xs font-bold uppercase"
                  >
                    Urungkan
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => handleRunAction('cancel_session', cancelReason)}
                    className="border-studio-ink bg-studio-orange text-studio-white inline-flex min-h-10 cursor-pointer items-center gap-1.5 border px-3.5 py-1.5 font-mono text-xs font-extrabold uppercase"
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
            <section
              aria-labelledby="drawer-overview-heading"
              className="brutal-card bg-studio-white p-4 sm:p-5"
            >
              <h3
                id="drawer-overview-heading"
                className="font-mono text-xs font-extrabold tracking-wider uppercase"
              >
                Booking Overview
              </h3>

              <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-neutral-200 pt-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Customer
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-extrabold">
                    {booking.customerName}
                  </dd>
                </div>

                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Band / Project
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-bold">
                    {booking.bandName || '-'}
                  </dd>
                </div>

                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Nomor HP / WhatsApp
                  </dt>
                  <dd className="text-studio-ink mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-extrabold">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{booking.phone}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Studio Room
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-extrabold">{room.label}</dd>
                </div>

                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Layanan &amp; Subcategory
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-extrabold">
                    {serviceTitle}
                    {optionTitle ? ` • ${optionTitle}` : ''}
                  </dd>
                </div>

                <div>
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Tanggal Sesi
                  </dt>
                  <dd className="text-studio-ink mt-0.5 text-sm font-extrabold">
                    {formatIndonesianDateFull(booking.date)}
                  </dd>
                </div>

                <div className="sm:col-span-2">
                  <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Jam &amp; Durasi
                  </dt>
                  <dd className="text-studio-ink mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm font-extrabold">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {formatMinuteRange(booking.startMinute, booking.endMinute)} (
                      {formatDurationMinutes(booking.durationMinutes)})
                    </span>
                  </dd>
                </div>
              </dl>

              {/* Financial & Authoritative Invoice Ledger Subcard */}
              <div className="border-studio-ink bg-studio-ivory mt-4 border p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-extrabold uppercase">
                    <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {latestPayment.hasInvoice
                        ? 'Status Invoice & Pembayaran Terkini'
                        : 'Informasi Pembayaran Awal'}
                    </span>
                  </span>
                  <div className="flex flex-wrap items-center gap-1">
                    {invoiceStatusMeta ? (
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase ${invoiceStatusMeta.badgeClass}`}
                      >
                        {invoiceStatusMeta.label}
                      </span>
                    ) : null}
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                    >
                      {paymentMeta.indoLabel || paymentMeta.label}
                    </span>
                  </div>
                </div>

                {latestPayment.hasInvoice ? (
                  <div className="border-studio-ink/40 bg-studio-white mt-2.5 flex flex-wrap items-center justify-between gap-2 border px-2.5 py-2">
                    <div className="min-w-0 font-mono text-[11px]">
                      <span className="text-studio-muted-ink block text-[9px] font-bold uppercase">
                        Invoice Number
                      </span>
                      <span className="text-studio-ink font-extrabold">
                        {latestPayment.invoiceNumber}
                      </span>
                    </div>
                    <Link
                      to={`/admin/payment-and-bill?invoiceId=${encodeURIComponent(latestPayment.invoiceId)}`}
                      className="border-studio-ink bg-studio-ink text-studio-lime hover:bg-studio-orange hover:text-studio-white inline-flex h-8 shrink-0 items-center gap-1 border px-2.5 font-mono text-[9.5px] font-extrabold uppercase transition-colors"
                    >
                      <span>Open Invoice</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                ) : null}

                {latestPayment.isSnapshotMismatch ? (
                  <p className="border-studio-ink mt-2 border bg-amber-100 px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#9a3412]">
                    Perhatian: Total booking terbaru ({formatRupiah(financial.totalAmount)}) berbeda
                    dari snapshot invoice ({formatRupiah(latestPayment.totalAmount)}). Kelola
                    penyesuaian tagihan secara eksplisit melalui halaman Payment and Bill.
                  </p>
                ) : null}

                <dl className="mt-2.5 space-y-1 font-mono text-xs">
                  {financial.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-studio-muted-ink">Harga Normal</dt>
                        <dd className="font-bold">{formatRupiah(financial.subtotal)}</dd>
                      </div>
                      <div className="flex justify-between text-emerald-800">
                        <dt>
                          {financial.automaticDiscount
                            ? 'Diskon Durasi'
                            : booking.packageId
                              ? 'Diskon Paket'
                              : 'Diskon'}
                        </dt>
                        <dd className="font-bold">-{formatRupiah(financial.discountAmount)}</dd>
                      </div>
                      {financial.automaticDiscount ? (
                        <p className="text-[10px] font-semibold text-emerald-900">
                          {financial.automaticDiscount.eligibleBlocks}x kelipatan{' '}
                          {formatDurationMinutes(financial.automaticDiscount.intervalMinutes)} (-
                          {formatRupiah(financial.automaticDiscount.discountPerBlock)})
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-studio-muted-ink">Total Tagihan</dt>
                    <dd className="font-extrabold">{formatRupiah(displayedTotalAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-studio-muted-ink">
                      {latestPayment.hasInvoice ? 'Sudah Dibayar (Ledger)' : 'Pembayaran Awal'}
                    </dt>
                    <dd className="font-bold">
                      {formatRupiah(displayedPaidAmount)}
                      {!latestPayment.hasInvoice && booking.paymentMethod
                        ? ` (${getPaymentMethodLabel(booking.paymentMethod)})`
                        : ''}
                    </dd>
                  </div>
                  <div className="border-studio-ink flex justify-between border-t pt-1 font-extrabold">
                    <dt className="text-studio-orange">Sisa Tagihan</dt>
                    <dd className="text-studio-orange">{formatRupiah(remainingBalance)}</dd>
                  </div>
                </dl>
              </div>

              {/* Internal Operational Fee Snapshot Subcard (V2 + Legacy V1 + Phase 5 fallback) */}
              <div className="border-studio-ink bg-studio-white mt-3 border p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-extrabold uppercase">
                    Internal Fee Snapshot
                  </span>
                  {commissionDisplay ? (
                    <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                      Settings v{commissionDisplay.settingsVersion}
                    </span>
                  ) : null}
                </div>

                {commissionDisplay ? (
                  <dl className="mt-2 space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-studio-muted-ink">Staff Fee</dt>
                      <dd className="font-bold">{formatRupiah(commissionDisplay.staff.amount)}</dd>
                    </div>
                    {commissionDisplay.owner ? (
                      <div className="flex justify-between">
                        <dt className="text-studio-muted-ink">Owner Fee</dt>
                        <dd className="font-bold">
                          {formatRupiah(commissionDisplay.owner.amount)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <dt className="text-studio-muted-ink">Recording Operator Fee</dt>
                      <dd className="font-bold">
                        {formatRupiah(commissionDisplay.recordingOperator.amount)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-studio-muted-ink mt-1.5 font-mono text-[11px]">
                    Tidak ada snapshot komisi internal (booking sebelum konfigurasi Phase 6).
                  </p>
                )}
              </div>

              {booking.notes ? (
                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <p className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                    Catatan Sesi
                  </p>
                  <p className="text-studio-ink mt-1 text-xs leading-relaxed font-medium">
                    {booking.notes}
                  </p>
                </div>
              ) : null}
            </section>

            {/* SECTION 2: SESSION LIFECYCLE */}
            <section
              aria-labelledby="drawer-lifecycle-heading"
              className="brutal-card bg-studio-white p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                <div>
                  <h3
                    id="drawer-lifecycle-heading"
                    className="font-mono text-xs font-extrabold tracking-wider uppercase"
                  >
                    Session Lifecycle
                  </h3>
                  <p className="text-studio-muted-ink mt-0.5 text-xs">
                    Status sesi operasional terpisah dari status pembayaran.
                  </p>
                </div>

                <span
                  className={`border px-2.5 py-1 font-mono text-xs font-extrabold uppercase ${sessionMeta.badgeClass}`}
                >
                  {sessionMeta.label} ({sessionMeta.indoLabel})
                </span>
              </div>

              {/* Check-in & Execution Timestamps */}
              <div className="mt-3 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-3">
                <div className="border-studio-ink bg-studio-ivory border p-2.5">
                  <span className="text-studio-muted-ink block text-[9px] font-bold uppercase">
                    Check-in
                  </span>
                  <span className="mt-0.5 block font-extrabold">
                    {booking.checkedInAt
                      ? formatIndonesianTimestamp(booking.checkedInAt)
                      : 'Belum Check-in'}
                  </span>
                </div>

                <div className="border-studio-ink bg-studio-ivory border p-2.5">
                  <span className="text-studio-muted-ink block text-[9px] font-bold uppercase">
                    Mulai Sesi
                  </span>
                  <span className="mt-0.5 block font-extrabold">
                    {booking.actualStartedAt
                      ? formatIndonesianTimestamp(booking.actualStartedAt)
                      : '-'}
                  </span>
                </div>

                <div className="border-studio-ink bg-studio-ivory border p-2.5">
                  <span className="text-studio-muted-ink block text-[9px] font-bold uppercase">
                    Selesai Sesi
                  </span>
                  <span className="mt-0.5 block font-extrabold">
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
                    className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3.5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3.5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="brutal-btn text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 bg-emerald-300 px-3.5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3.5 py-2 font-mono text-xs font-extrabold uppercase disabled:cursor-not-allowed disabled:opacity-50"
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
                <p className="text-studio-muted-ink mt-2.5 font-mono text-[11px]">
                  Info No Show: {capabilities.noShowReason}
                </p>
              ) : null}

              {showNoShowConfirm && capabilities.canMarkNoShow ? (
                <div className="border-studio-ink bg-studio-ivory mt-3 border-2 p-3.5">
                  <label
                    htmlFor="no-show-reason-input"
                    className="text-studio-ink block font-mono text-[11px] font-extrabold uppercase"
                  >
                    Catatan / Alasan No Show
                  </label>
                  <input
                    id="no-show-reason-input"
                    type="text"
                    value={noShowReason}
                    onChange={(e) => setNoShowReason(e.target.value)}
                    placeholder="Contoh: Tidak hadir >15 menit setelah jam mulai dan nomor tidak aktif"
                    className="border-studio-ink bg-studio-white mt-1.5 min-h-10 w-full border px-3 py-1.5 text-xs font-semibold"
                  />
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNoShowConfirm(false)}
                      className="border-studio-ink bg-studio-white min-h-9 cursor-pointer border px-3 py-1 font-mono text-xs font-bold uppercase"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(actionLoading)}
                      onClick={() => handleRunAction('mark_no_show', noShowReason)}
                      className="border-studio-ink bg-studio-orange text-studio-white inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-3 py-1 font-mono text-xs font-extrabold uppercase"
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

            {/* SECTION 3: ACTIVITY HISTORY (FIRESTORE BOOKING EVENTS) */}
            <section
              aria-labelledby="drawer-activity-heading"
              className="brutal-card bg-studio-white p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                <div className="flex items-center gap-2">
                  <History className="text-studio-orange h-4 w-4" aria-hidden="true" />
                  <h3
                    id="drawer-activity-heading"
                    className="font-mono text-xs font-extrabold tracking-wider uppercase"
                  >
                    Activity History (Firestore)
                  </h3>
                </div>
                <span className="font-mono text-[11px] font-bold">{events.length} log</span>
              </div>

              {isEventsLoading ? (
                <div className="text-studio-muted-ink mt-3 flex items-center gap-2 font-mono text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memuat riwayat aktivitas...</span>
                </div>
              ) : events.length === 0 ? (
                <p className="text-studio-muted-ink mt-3 font-mono text-xs">
                  Belum ada riwayat aktivitas yang tercatat untuk booking ini.
                </p>
              ) : (
                <ol className="mt-3.5 space-y-2.5">
                  {events.map((evt) => {
                    const eventLabel = BOOKING_EVENT_LABELS[evt.eventType] || evt.eventType;
                    return (
                      <li
                        key={evt.id}
                        className="border-studio-ink bg-studio-ivory border p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-mono text-[11px] font-extrabold uppercase">
                            {eventLabel}
                          </span>
                          <span className="text-studio-muted-ink font-mono text-[10px]">
                            {formatIndonesianTimestamp(evt.createdAt)}
                          </span>
                        </div>
                        {evt.note ? (
                          <p className="text-studio-ink mt-1 leading-relaxed font-semibold">
                            {evt.note}
                          </p>
                        ) : null}
                        <p className="text-studio-muted-ink mt-1 font-mono text-[10px]">
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
