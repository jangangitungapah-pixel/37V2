import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  Hourglass,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { useAuth } from '@/features/auth/AuthContext';

import { getReservationStatusMeta, RESERVATION_STATUS } from '../config/calendar-config';
import { getBookingRepositoryAdapter } from '../repositories/calendar-booking-repository';
import { mapBookingErrorToMessage } from '../services/calendar-booking-service';
import {
  confirmReservation,
  expireReservationHold,
  extendReservationHold,
  restoreExpiredReservation,
} from '../services/reservation-hold-service';
import {
  getBookingLifecycleCapabilities,
  isBookingHoldOverdue,
  normalizeBookingReservationStatus,
} from '../utils/booking-time';
import { formatIndonesianTimestamp } from '../utils/calendar-date';

export function HoldLifecyclePanel({
  booking,
  actorUid = '',
  latestPayment = null,
  bookingPolicies = null,
  isInteractive = true,
  now = undefined,
}) {
  const { user, profile } = useAuth();
  const cleanActorUid = String(actorUid || user?.uid || profile?.uid || '').trim();

  const resStatus = normalizeBookingReservationStatus(booking);
  const resMeta = getReservationStatusMeta(resStatus);
  const capabilities = getBookingLifecycleCapabilities(booking, now);
  const isOverdue = isBookingHoldOverdue(booking, now);

  const invoiceId = booking?.invoiceId || (booking?.id ? `inv_${booking.id}` : '');
  const minDeposit = Number.isInteger(booking?.minimumDepositAmount)
    ? booking.minimumDepositAmount
    : 0;
  const paidAmount = Math.max(
    0,
    Math.round(Number(latestPayment?.amountPaid ?? booking?.initialPaidAmount) || 0),
  );
  const depositShortfall = Math.max(0, minDeposit - paidAmount);

  const hasHoldOrDepositContext = Boolean(
    booking &&
      (resStatus === RESERVATION_STATUS.DEPOSIT_HOLD ||
        resStatus === RESERVATION_STATUS.EXPIRED ||
        minDeposit > 0 ||
        booking.depositIntegrityAlert ||
        booking.confirmationSource === 'staff_override' ||
        (Number(booking.holdExtensionCount) || 0) > 0 ||
        booking.restoredAt),
  );

  const [pendingState, setPendingState] = useState({
    invoiceId: '',
    count: 0,
    loading: false,
  });
  const [activeActionPanel, setActiveActionPanel] = useState(''); // '' | 'confirm' | 'extend' | 'expire' | 'restore'
  const [reasonInput, setReasonInput] = useState('');
  const [extensionHours, setExtensionHours] = useState('24');
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState('');

  useEffect(() => {
    if (!invoiceId || resStatus !== RESERVATION_STATUS.DEPOSIT_HOLD) {
      return undefined;
    }
    let cancelled = false;
    const adapter = getBookingRepositoryAdapter();
    if (typeof adapter.listPendingPaymentEvidenceForInvoice !== 'function') {
      return undefined;
    }
    adapter
      .listPendingPaymentEvidenceForInvoice(invoiceId)
      .then((list) => {
        if (cancelled) return;
        setPendingState({
          invoiceId,
          count: Array.isArray(list) ? list.length : 0,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPendingState({ invoiceId, count: 0, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceId, resStatus, booking?.version]);

  if (!hasHoldOrDepositContext) {
    return null;
  }

  const pendingEvidenceCount =
    pendingState.invoiceId === invoiceId ? pendingState.count : 0;

  const resetPanel = () => {
    setActiveActionPanel('');
    setReasonInput('');
    setPanelError('');
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPanelError('');
    try {
      await confirmReservation({
        bookingId: booking.id,
        expectedVersion: booking.version,
        reason: reasonInput,
        actorUid: cleanActorUid,
      });
      toast.success('Reservasi berhasil dikonfirmasi.');
      resetPanel();
    } catch (err) {
      const msg = mapBookingErrorToMessage(err);
      setPanelError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPanelError('');
    try {
      await extendReservationHold({
        bookingId: booking.id,
        expectedVersion: booking.version,
        extensionHours: Number(extensionHours) || 24,
        reason: reasonInput,
        bookingPolicies,
        actorUid: cleanActorUid,
      });
      toast.success('Durasi Deposit Hold berhasil diperpanjang.');
      resetPanel();
    } catch (err) {
      const msg = mapBookingErrorToMessage(err);
      setPanelError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExpire = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPanelError('');
    try {
      await expireReservationHold({
        bookingId: booking.id,
        expectedVersion: booking.version,
        reason: reasonInput,
        actorUid: cleanActorUid,
      });
      toast.success('Deposit Hold telah diakhiri manual dan slot ruangan dilepaskan.');
      resetPanel();
    } catch (err) {
      const msg = mapBookingErrorToMessage(err);
      setPanelError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPanelError('');
    try {
      await restoreExpiredReservation({
        bookingId: booking.id,
        expectedVersion: booking.version,
        reason: reasonInput,
        extensionHours: Number(extensionHours) || 24,
        bookingPolicies,
        actorUid: cleanActorUid,
      });
      toast.success('Reservasi berhasil dipulihkan dan slot ruangan kembali dikunci.');
      resetPanel();
    } catch (err) {
      const msg = mapBookingErrorToMessage(err);
      setPanelError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="hold-lifecycle-panel"
      aria-labelledby="hold-lifecycle-heading"
      className={`sa-card space-y-3 p-4 sm:p-5 ${
        resStatus === RESERVATION_STATUS.DEPOSIT_HOLD
          ? isOverdue
            ? 'border-red-400/50 bg-[#FFF5F2]'
            : 'border-amber-400/45 bg-[#FFFBF2]'
          : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-[#8A4B08]" aria-hidden="true" />
          <h3 id="hold-lifecycle-heading" className="text-studio-ink text-sm font-semibold tracking-tight">
            Status Reservasi &amp; Kebijakan Deposit Hold
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <AdminStatusBadge tone={resMeta.tone} size="sm" dot>
            {resMeta.label}
          </AdminStatusBadge>
          {isOverdue ? (
            <AdminStatusBadge tone="danger" size="sm">
              Hold Overdue
            </AdminStatusBadge>
          ) : null}
        </div>
      </div>

      {panelError ? (
        <div
          role="alert"
          data-testid="hold-lifecycle-error"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{panelError}</span>
        </div>
      ) : null}

      {booking.depositIntegrityAlert ? (
        <div
          data-testid="deposit-integrity-alert-banner"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Deposit Integrity Alert:</strong> Pembalikan/reversal pembayaran membuat total terbayar berada di bawah minimum DP ({formatRupiah(minDeposit)}). Reservasi tetap berstatus Confirmed hingga ditinjau.
          </span>
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-2.5 rounded-xl border border-[#151515]/8 bg-white/80 p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-medium text-[#666159]">Minimum Deposit (DP)</dt>
          <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
            {minDeposit > 0 ? formatRupiah(minDeposit) : 'Tanpa Minimum DP'}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] font-medium text-[#666159]">DP Terverifikasi</dt>
          <dd className="mt-0.5 font-mono font-semibold text-[#151515]">
            {formatRupiah(paidAmount)}
            {depositShortfall > 0 ? (
              <span className="ml-1.5 text-[11px] font-normal text-[#B92B0C]">
                (Kurang {formatRupiah(depositShortfall)})
              </span>
            ) : null}
          </dd>
        </div>

        {booking.holdExpiresAt ? (
          <div>
            <dt className="text-[11px] font-medium text-[#666159]">Batas Waktu Hold (WIB)</dt>
            <dd className={`mt-0.5 font-mono font-semibold ${isOverdue ? 'text-[#B92B0C]' : 'text-[#151515]'}`}>
              {formatIndonesianTimestamp(booking.holdExpiresAt)}
            </dd>
          </div>
        ) : null}

        {(Number(booking.holdExtensionCount) || 0) > 0 ? (
          <div>
            <dt className="text-[11px] font-medium text-[#666159]">Perpanjangan Hold</dt>
            <dd className="mt-0.5 text-[#151515]">
              {booking.holdExtensionCount}x diperpanjang
              {booking.holdLastExtensionReason ? ` — "${booking.holdLastExtensionReason}"` : ''}
            </dd>
          </div>
        ) : null}

        {booking.expiryReason ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium text-[#666159]">Alasan Hold Expired</dt>
            <dd className="mt-0.5 text-[#B92B0C]">{booking.expiryReason}</dd>
          </div>
        ) : null}

        {booking.confirmationOverrideReason ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium text-[#666159]">Catatan Staff Override Konfirmasi</dt>
            <dd className="mt-0.5 text-[#0F6246]">{booking.confirmationOverrideReason}</dd>
          </div>
        ) : null}
      </dl>

      {/* Pending Evidence Shield Notice (OD-09) */}
      {resStatus === RESERVATION_STATUS.DEPOSIT_HOLD && pendingEvidenceCount > 0 ? (
        <div
          data-testid="pending-evidence-shield-banner"
          className="space-y-2 rounded-xl border border-amber-400/50 bg-[#FEF4DD] p-3 text-xs text-[#6A3B00]"
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Terdapat <strong>{pendingEvidenceCount} bukti pembayaran</strong> yang menunggu tinjauan (<code>pending_review</code>). Hold <strong>tidak boleh di-expire</strong> sebelum bukti ditinjau.
            </span>
          </div>
          <Link
            to={`/admin/payment-and-bill?tab=payment-evidence&invoiceId=${encodeURIComponent(invoiceId)}`}
            className="inline-flex items-center gap-1 font-semibold underline hover:text-[#151515]"
          >
            <span>Tinjau Payment Evidence</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {isInteractive && resStatus === RESERVATION_STATUS.DEPOSIT_HOLD ? (
        <div className="flex flex-wrap gap-2">
          <AdminButton
            variant="lime"
            size="sm"
            disabled={submitting || !capabilities.canConfirmHold}
            onClick={() => {
              if (depositShortfall <= 0) {
                void handleConfirm();
                return;
              }
              setActiveActionPanel((p) => (p === 'confirm' ? '' : 'confirm'));
              setReasonInput('');
              setPanelError('');
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{depositShortfall > 0 ? 'Confirm (Staff Override)' : 'Confirm Hold'}</span>
          </AdminButton>

          <AdminButton
            variant="secondary"
            size="sm"
            disabled={submitting || !capabilities.canExtendHold}
            onClick={() => {
              setActiveActionPanel((p) => (p === 'extend' ? '' : 'extend'));
              setReasonInput('');
              setPanelError('');
            }}
          >
            <CalendarPlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Extend Hold</span>
          </AdminButton>

          <AdminButton
            variant="danger"
            size="sm"
            disabled={submitting || !capabilities.canExpireHold || pendingEvidenceCount > 0}
            data-testid="expire-hold-button"
            onClick={() => {
              setActiveActionPanel((p) => (p === 'expire' ? '' : 'expire'));
              setReasonInput('');
              setPanelError('');
            }}
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Expire Hold Manual</span>
          </AdminButton>
        </div>
      ) : null}

      {isInteractive && resStatus === RESERVATION_STATUS.EXPIRED ? (
        <div className="space-y-2">
          {paidAmount > 0 ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              Hold berakhir dengan pembayaran bersih {formatRupiah(paidAmount)} (handoff Review Refund / Credit telah dicatat).
            </p>
          ) : null}
          <AdminButton
            variant="secondary"
            size="sm"
            disabled={submitting || !capabilities.canRestoreHold}
            onClick={() => {
              setActiveActionPanel((p) => (p === 'restore' ? '' : 'restore'));
              setReasonInput('');
              setPanelError('');
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restore Expired Reservation</span>
          </AdminButton>
        </div>
      ) : null}

      {/* Inline Action Confirmation Panel */}
      {activeActionPanel ? (
        <div className="space-y-2.5 rounded-xl border border-[#151515]/12 bg-white p-3 text-xs">
          {activeActionPanel === 'extend' || activeActionPanel === 'restore' ? (
            <div>
              <label htmlFor="hold-action-hours" className="block text-[11px] font-semibold text-[#151515]">
                Durasi Hold Tambahan (Jam, akan dijepit sebelum sesi dimulai WIB)
              </label>
              <input
                id="hold-action-hours"
                type="number"
                min={1}
                max={168}
                value={extensionHours}
                onChange={(e) => setExtensionHours(e.target.value)}
                className="sa-input mt-1 min-h-9 w-full rounded-lg px-2.5 py-1 font-mono text-xs"
              />
            </div>
          ) : null}

          {activeActionPanel === 'expire' ? (
            <p className="text-[11px] leading-relaxed text-[#666159]">
              Semua slot 30 menit akan dilepaskan.{' '}
              {paidAmount === 0
                ? 'Karena belum ada pembayaran, invoice terkait akan di-Void secara atomik.'
                : 'Pembayaran bersih yang sudah masuk dipertahankan dan handoff Refund/Credit dibuka otomatis.'}
            </p>
          ) : null}

          {activeActionPanel === 'restore' ? (
            <p className="text-[11px] leading-relaxed text-[#666159]">
              Sistem akan memeriksa seluruh slot jadwal secara langsung sebelum memulihkan. Jika sudah terisi booking lain, pemulihan dibatalkan otomatis.
            </p>
          ) : null}

          <div>
            <label htmlFor="hold-action-reason" className="block text-[11px] font-semibold text-[#151515]">
              Alasan Tertulis (Wajib min. 5 karakter)
            </label>
            <input
              id="hold-action-reason"
              type="text"
              maxLength={300}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Tuliskan alasan operasional..."
              className="sa-input mt-1 min-h-9 w-full rounded-lg px-2.5 py-1 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2">
            <AdminButton variant="ghost" size="sm" onClick={resetPanel}>
              Batal
            </AdminButton>
            <AdminButton
              variant={activeActionPanel === 'expire' ? 'danger' : 'primary'}
              size="sm"
              disabled={submitting || reasonInput.trim().length < 5}
              onClick={() => {
                if (activeActionPanel === 'confirm') return void handleConfirm();
                if (activeActionPanel === 'extend') return void handleExtend();
                if (activeActionPanel === 'expire') return void handleExpire();
                if (activeActionPanel === 'restore') return void handleRestore();
                return undefined;
              }}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{submitting ? 'Menyimpan...' : 'Konfirmasi Aksi Hold'}</span>
            </AdminButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
