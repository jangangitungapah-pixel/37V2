import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarPlus2,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getStudioRoomById,
  TIMELINE_HOURLY_SLOTS,
} from '@/features/admin/calendar/config/calendar-config';
import { expireReservationHold } from '@/features/admin/calendar/services/reservation-hold-service';
import { calculateBookingPricingSnapshot, formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatMinuteOfDay, formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';
import { useBookingPolicies } from '@/features/admin/settings/booking-policies/hooks/useBookingPolicies';
import {
  buildDepositPolicySnapshot,
  resolveBalanceDuePolicySnapshot,
  resolveEffectiveHoldDeadline,
} from '@/features/admin/settings/booking-policies/utils/booking-policy-engine';
import { usePricingSettings } from '@/features/admin/settings/hooks/usePricingSettings';
import { DELIVERY_MODES, PRICING_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';

import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import {
  OFFER_MODES,
  OFFER_STATUSES,
} from '../schemas/offer-schema';
import {
  createAndSendOffer,
  expireOffer,
  staffRecordOfferResponse,
  withdrawOffer,
} from '../services/offer-service';

function mapOfferErrorToMessage(error) {
  return error?.message || 'Gagal memproses Offer penawaran.';
}

export function OfferComposerCard({ request, offers = [], actorUid = '', actorName = '' }) {
  const { settings: pricingSettings, activeStudioServiceTypes } = usePricingSettings();
  const { policies } = useBookingPolicies();

  const activeOffer = useMemo(
    () =>
      offers.find((o) => o.id === request?.activeOfferId) ||
      offers[0] ||
      null,
    [offers, request?.activeOfferId],
  );

  const defaultService = activeStudioServiceTypes[0] || null;
  const defaultOption =
    defaultService?.options?.find((opt) => opt.isActive !== false) ||
    defaultService?.options?.[0] ||
    null;

  const initialSeed = useMemo(() => {
    const sched = activeOffer?.scheduleSnapshot;
    const svc = activeOffer?.serviceSnapshot;
    const fin = activeOffer?.financialSnapshot;
    return {
      offerMode: OFFER_MODES.QUOTE_ONLY,
      studioId:
        sched?.studioId ||
        (request?.requestedRoomId === 'room-b' ? 'room-b' : 'room-a'),
      date: sched?.date || request?.preferredDate || '',
      startMinute: String(
        sched?.startMinute ?? request?.preferredStartMinute ?? 600,
      ),
      durationMinutes: String(
        sched?.durationMinutes ?? request?.preferredDurationMinutes ?? 120,
      ),
      serviceTypeId: svc?.serviceTypeId || defaultService?.id || '',
      serviceOptionId:
        svc?.serviceOptionId ||
        request?.serviceOptionId ||
        defaultOption?.id ||
        '',
      manualCustomerPrice:
        svc?.pricingMode === PRICING_MODES.MANUAL_QUOTE && fin?.totalAmount
          ? String(fin.totalAmount)
          : '',
      offerValidHours: '24',
      staffNoteToClient: activeOffer?.staffNoteToClient || '',
    };
  }, [activeOffer, request, defaultService?.id, defaultOption?.id]);

  const [formState, setFormState] = useState(initialSeed);
  const [submittingAction, setSubmittingAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [closeMode, setCloseMode] = useState(''); // '' | 'withdraw' | 'expire'
  const [closeReason, setCloseReason] = useState('');

  const selectedService = useMemo(
    () =>
      activeStudioServiceTypes.find((svc) => svc.id === formState.serviceTypeId) ||
      activeStudioServiceTypes[0] ||
      null,
    [activeStudioServiceTypes, formState.serviceTypeId],
  );

  const availableOptions = useMemo(
    () =>
      (selectedService?.options || []).filter(
        (opt) => opt.isActive !== false && selectedService?.deliveryMode === DELIVERY_MODES.STUDIO,
      ),
    [selectedService],
  );

  const selectedOption = useMemo(
    () =>
      availableOptions.find((opt) => opt.id === formState.serviceOptionId) ||
      availableOptions[0] ||
      null,
    [availableOptions, formState.serviceOptionId],
  );

  const effectiveServiceTypeId = selectedService?.id || formState.serviceTypeId;
  const effectiveServiceOptionId = selectedOption?.id || formState.serviceOptionId;
  const isManualQuote = selectedOption?.pricing?.mode === PRICING_MODES.MANUAL_QUOTE;

  const livePricing = useMemo(
    () =>
      calculateBookingPricingSnapshot({
        serviceTypeId: effectiveServiceTypeId,
        serviceOptionId: effectiveServiceOptionId,
        durationMinutes: Number(formState.durationMinutes) || 60,
        manualCustomerPrice: Number(formState.manualCustomerPrice) || 0,
        pricingSettings,
      }),
    [
      effectiveServiceTypeId,
      effectiveServiceOptionId,
      formState.durationMinutes,
      formState.manualCustomerPrice,
      pricingSettings,
    ],
  );

  const liveDepositSnapshot = useMemo(
    () =>
      buildDepositPolicySnapshot({
        policies,
        serviceTypeId: effectiveServiceTypeId,
        serviceOptionId: effectiveServiceOptionId,
        totalAmount: livePricing.totalAmount,
        subtotal: livePricing.subtotal,
      }),
    [policies, effectiveServiceTypeId, effectiveServiceOptionId, livePricing.totalAmount, livePricing.subtotal],
  );

  const liveBalanceDuePolicy = useMemo(
    () =>
      resolveBalanceDuePolicySnapshot({
        policies,
        serviceTypeId: effectiveServiceTypeId,
        serviceOptionId: effectiveServiceOptionId,
        bookingDate: formState.date,
        startMinute: Number(formState.startMinute) || 600,
      }),
    [policies, effectiveServiceTypeId, effectiveServiceOptionId, formState.date, formState.startMinute],
  );

  const liveHoldPreview = useMemo(() => {
    if (formState.offerMode !== OFFER_MODES.DEPOSIT_HOLD_OFFER || !formState.date) {
      return { deadline: null, error: '' };
    }
    try {
      const deadline = resolveEffectiveHoldDeadline({
        policies,
        serviceTypeId: effectiveServiceTypeId,
        serviceOptionId: effectiveServiceOptionId,
        bookingDate: formState.date,
        startMinute: Number(formState.startMinute) || 600,
      });
      return { deadline, error: '' };
    } catch (err) {
      return { deadline: null, error: err?.message || 'Hold TTL belum dikonfigurasi.' };
    }
  }, [
    formState.offerMode,
    formState.date,
    formState.startMinute,
    policies,
    effectiveServiceTypeId,
    effectiveServiceOptionId,
  ]);

  if (!request || request.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
    return null;
  }

  const isRequestClosedOrConfirmed =
    Boolean(request.linkedBookingId) ||
    [
      BOOKING_REQUEST_STATUS.CONFIRMED,
      BOOKING_REQUEST_STATUS.DECLINED,
      BOOKING_REQUEST_STATUS.CLOSED,
    ].includes(request.status);

  const isActiveAccepted = activeOffer?.status === OFFER_STATUSES.ACCEPTED;
  const isActiveSent = activeOffer?.status === OFFER_STATUSES.SENT;
  const canComposeOffer = !isRequestClosedOrConfirmed && !isActiveAccepted;
  const isClientPortalRequest = request.source === BOOKING_REQUEST_SOURCES.CLIENT_PORTAL;

  const nextRevisionNumber =
    offers.length > 0
      ? Math.max(...offers.map((o) => Number(o.revisionNumber) || 1)) + 1
      : 1;
  const nextOfferLabel = `OFF-${String(nextRevisionNumber).padStart(2, '0')}`;

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setActionError('');
  };

  const handleSendOffer = async (event) => {
    event.preventDefault();
    if (submittingAction) return;
    setSubmittingAction('send');
    setActionError('');

    try {
      const result = await createAndSendOffer({
        requestId: request.id,
        offerMode: formState.offerMode,
        previousOfferId: activeOffer?.id || '',
        expectedRequestVersion: request.version,
        expectedPreviousOfferVersion: activeOffer?.version ?? null,
        scheduleInput: {
          studioId: formState.studioId,
          date: formState.date,
          startMinute: Number(formState.startMinute),
          durationMinutes: Number(formState.durationMinutes),
        },
        serviceInput: {
          serviceTypeId: effectiveServiceTypeId,
          serviceOptionId: effectiveServiceOptionId,
        },
        pricingSettings,
        bookingPolicies: policies,
        manualCustomerPrice: Number(formState.manualCustomerPrice) || 0,
        offerValidHours: Number(formState.offerValidHours) || 24,
        staffNoteToClient: formState.staffNoteToClient,
        actorUid,
        actorName,
      });
      toast.success(
        result.booking?.id
          ? `${result.offer.offerNumber} & Deposit Hold (${result.booking.id}) berhasil dikirim${
              result.supersededCount > 0 ? ' (menggantikan revisi sebelumnya)' : ''
            }.`
          : `${result.offer.offerNumber} berhasil dikirim${
              result.supersededCount > 0 ? ' (menggantikan revisi sebelumnya)' : ''
            }.`,
      );
      setCloseMode('');
      setCloseReason('');
    } catch (err) {
      const msg = mapOfferErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction('');
    }
  };

  const handleReleaseRejectedHold = async () => {
    if (!activeOffer?.provisionalBookingId || submittingAction) return;
    setSubmittingAction('release-rejected-hold');
    setActionError('');
    try {
      await expireReservationHold({
        bookingId: activeOffer.provisionalBookingId,
        reason: `Hold dilepas setelah ${activeOffer.offerNumber} ditolak Client.`,
        actorUid,
      });
      toast.success(`Hold provisional ${activeOffer.provisionalBookingId} berhasil dilepaskan.`);
    } catch (err) {
      const msg = mapOfferErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction('');
    }
  };

  const handleCloseActiveOffer = async () => {
    if (!activeOffer || submittingAction) return;
    setSubmittingAction(closeMode);
    setActionError('');

    try {
      const fn = closeMode === 'expire' ? expireOffer : withdrawOffer;
      await fn({
        requestId: request.id,
        offerId: activeOffer.id,
        expectedOfferVersion: activeOffer.version,
        expectedRequestVersion: request.version,
        reason: closeReason,
        actorUid,
        actorName,
      });
      toast.success(
        closeMode === 'expire'
          ? `${activeOffer.offerNumber} ditandai expired.`
          : `${activeOffer.offerNumber} ditarik kembali.`,
      );
      setCloseMode('');
      setCloseReason('');
    } catch (err) {
      const msg = mapOfferErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction('');
    }
  };

  const handleStaffRecordResponse = async (decision) => {
    if (!activeOffer || submittingAction) return;
    setSubmittingAction(`staff-${decision}`);
    setActionError('');

    try {
      await staffRecordOfferResponse({
        requestId: request.id,
        offerId: activeOffer.id,
        decision,
        expectedOfferVersion: activeOffer.version,
        expectedRequestVersion: request.version,
        actorUid,
        actorName,
      });
      toast.success(
        decision === OFFER_STATUSES.ACCEPTED
          ? `${activeOffer.offerNumber} dicatat disetujui Client.`
          : `${activeOffer.offerNumber} dicatat ditolak Client.`,
      );
    } catch (err) {
      const msg = mapOfferErrorToMessage(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSubmittingAction('');
    }
  };

  const startOptions = TIMELINE_HOURLY_SLOTS.map((s) => ({
    value: String(s.startMinute),
    label: `${s.label} WIB`,
  }));

  return (
    <section
      data-testid="offer-composer-card"
      aria-labelledby="offer-composer-heading"
      className="space-y-3.5 rounded-2xl border border-[#151515]/10 bg-white p-4 shadow-[0_2px_8px_rgba(21,21,21,0.035)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#151515]/[0.07] pb-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1]">
            <FilePlus2 className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-[#8B857B] uppercase">
              Commercial proposal
            </p>
            <h3 id="offer-composer-heading" className="text-sm font-bold tracking-tight text-[#151515]">
              Penawaran &amp; Revisi Offer
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#777166]">
              Kirim rincian jadwal &amp; biaya resmi untuk disetujui Client sebelum slot dikunci.
            </p>
          </div>
        </div>
        <AdminStatusBadge tone="ivory" size="sm">
          Next: {nextOfferLabel}
        </AdminStatusBadge>
      </div>

      {actionError ? (
        <div
          role="alert"
          data-testid="offer-composer-error"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {isActiveSent && activeOffer ? (
        <div
          data-testid="active-sent-offer-controls"
          className="space-y-2.5 rounded-xl border border-amber-400/40 bg-[#FEF4DD]/70 p-3 text-xs text-[#6A3B00]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {activeOffer.offerNumber} aktif menunggu respons Client (
                {formatMinuteRange(
                  activeOffer.scheduleSnapshot?.startMinute,
                  activeOffer.scheduleSnapshot?.endMinute,
                )}
                )
              </span>
            </div>
            <AdminStatusBadge tone="amber" size="sm">
              Sent
            </AdminStatusBadge>
          </div>
          <p className="text-[11px] leading-relaxed">
            Mengirim {nextOfferLabel} akan otomatis menggantikan (<strong>Superseded</strong>){' '}
            {activeOffer.offerNumber}. Anda juga dapat menarik atau menandai Offer ini expired.
          </p>

          <div className="flex flex-wrap gap-2">
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={Boolean(submittingAction)}
              onClick={() => {
                setCloseMode((prev) => (prev === 'withdraw' ? '' : 'withdraw'));
                setCloseReason('');
              }}
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Withdraw Offer
            </AdminButton>
            <AdminButton
              variant="secondary"
              size="sm"
              disabled={Boolean(submittingAction)}
              onClick={() => {
                setCloseMode((prev) => (prev === 'expire' ? '' : 'expire'));
                setCloseReason('');
              }}
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Tandai Expired
            </AdminButton>
            {!isClientPortalRequest ? (
              <>
                <AdminButton
                  variant="lime"
                  size="sm"
                  disabled={Boolean(submittingAction)}
                  onClick={() => handleStaffRecordResponse(OFFER_STATUSES.ACCEPTED)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Catat Setuju (WA)
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="sm"
                  disabled={Boolean(submittingAction)}
                  onClick={() => handleStaffRecordResponse(OFFER_STATUSES.REJECTED)}
                >
                  Catat Tolak (WA)
                </AdminButton>
              </>
            ) : null}
          </div>

          {closeMode ? (
            <div className="space-y-2 rounded-xl border border-[#151515]/10 bg-white p-2.5 text-[#151515]">
              <label htmlFor="close-offer-reason" className="block text-[11px] font-semibold">
                Alasan {closeMode === 'expire' ? 'kedaluwarsa' : 'penarikan'} Offer (min. 3 karakter)
              </label>
              <input
                id="close-offer-reason"
                type="text"
                maxLength={300}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Mis. Jadwal perlu disesuaikan ulang..."
                className="sa-input min-h-10 w-full rounded-lg px-2.5 py-1.5 text-xs"
              />
              <div className="flex justify-end gap-2">
                <AdminButton variant="ghost" size="sm" onClick={() => setCloseMode('')}>
                  Batal
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="sm"
                  disabled={Boolean(submittingAction) || closeReason.trim().length < 3}
                  onClick={handleCloseActiveOffer}
                >
                  {submittingAction ? 'Memproses...' : 'Simpan'}
                </AdminButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeOffer?.status === OFFER_STATUSES.REJECTED &&
      activeOffer?.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER &&
      activeOffer?.provisionalBookingId ? (
        <div
          data-testid="rejected-hold-offer-notice"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/75 p-3 text-xs text-red-900"
        >
          <span>
            {activeOffer.offerNumber} ditolak Client. Mengirim revisi baru akan melepas Hold{' '}
            <code className="font-mono font-bold">{activeOffer.provisionalBookingId}</code> secara
            otomatis, atau lepas sekarang jika tidak melanjutkan.
          </span>
          <AdminButton
            variant="danger"
            size="sm"
            disabled={Boolean(submittingAction)}
            onClick={handleReleaseRejectedHold}
          >
            Lepas Hold
          </AdminButton>
        </div>
      ) : null}

      {isActiveAccepted && activeOffer ? (
        <div
          data-testid="accepted-offer-lock-banner"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-500/35 bg-[#E6F6EC] p-3 text-xs text-[#0F6246]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">
              {activeOffer.offerNumber} Disetujui Client ({formatRupiah(activeOffer.financialSnapshot?.totalAmount || 0)})
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              Snapshot penawaran bersifat immutable. Lanjutkan ke Calendar untuk mengunci slot menjadi Deposit Hold / Confirmed Reservation.
            </p>
          </div>
        </div>
      ) : null}

      {canComposeOffer ? (
        <form onSubmit={handleSendOffer} className="space-y-3">
          {/* Offer Mode Selector (Quote Only vs Option A Deposit Hold Offer) */}
          <div className="space-y-2">
            <span className="block text-[11px] font-semibold text-[#151515]">Mode Penawaran</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleFieldChange('offerMode', OFFER_MODES.QUOTE_ONLY)}
                aria-pressed={formState.offerMode === OFFER_MODES.QUOTE_ONLY}
                className={`cursor-pointer rounded-xl border p-2.5 text-left transition-colors ${
                  formState.offerMode === OFFER_MODES.QUOTE_ONLY
                    ? 'border-[#8BAD12]/60 bg-[#EDF8C2] text-[#243300]'
                    : 'border-[#151515]/10 bg-[#FAF8F1] text-[#46433D]'
                }`}
              >
                <span className="block text-xs font-bold">Quote Only</span>
                <span className="mt-0.5 block text-[10.5px] opacity-80">
                  Client menyetujui penawaran dulu; slot &amp; invoice dibuat Staff saat konversi.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFieldChange('offerMode', OFFER_MODES.DEPOSIT_HOLD_OFFER)}
                aria-pressed={formState.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER}
                className={`cursor-pointer rounded-xl border p-2.5 text-left transition-colors ${
                  formState.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
                    ? 'border-[#8BAD12]/60 bg-[#EDF8C2] text-[#243300]'
                    : 'border-[#151515]/10 bg-[#FAF8F1] text-[#46433D]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  Deposit Hold Offer
                  <AdminStatusBadge tone="lime" size="sm">
                    Aktif · Opsi A
                  </AdminStatusBadge>
                </span>
                <span className="mt-0.5 block text-[10.5px] opacity-85">
                  Staff kunci slot Deposit Hold provisional &amp; terbitkan Invoice DP belum lunas
                  saat mengirim Offer.
                </span>
              </button>
            </div>

            {formState.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER ? (
              <div
                data-testid="deposit-hold-offer-preview-notice"
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${
                  liveDepositSnapshot.type === 'none' ||
                  liveDepositSnapshot.minimumDepositAmount <= 0 ||
                  liveHoldPreview.error
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-[#8BAD12]/40 bg-[#EDF8C2]/65 text-[#243300]'
                }`}
              >
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {liveDepositSnapshot.type === 'none' ||
                  liveDepositSnapshot.minimumDepositAmount <= 0 ? (
                    <>
                      Kebijakan layanan ini berstatus <strong>Tanpa DP</strong>. Deposit Hold Offer
                      membutuhkan kewajiban DP (&gt; Rp 0) — gunakan <strong>Quote Only</strong>.
                    </>
                  ) : liveHoldPreview.error ? (
                    <>{liveHoldPreview.error}</>
                  ) : (
                    <>
                      Mengirim Offer ini akan langsung membuat{' '}
                      <strong>Deposit Hold provisional</strong> dan{' '}
                      <strong>Invoice belum lunas</strong> (DP min.{' '}
                      <strong>{formatRupiah(liveDepositSnapshot.minimumDepositAmount)}</strong>
                      {liveHoldPreview.deadline
                        ? `, batas hold s/d ${formatIndonesianTimestamp(liveHoldPreview.deadline.holdExpiresAtIso)}`
                        : ''}
                      ).
                    </>
                  )}
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="offer-room" className="block text-[11px] font-semibold text-[#151515]">
                Ruangan Studio
              </label>
              <select
                id="offer-room"
                value={formState.studioId}
                onChange={(e) => handleFieldChange('studioId', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              >
                <option value="room-a">{getStudioRoomById('room-a').label}</option>
                <option value="room-b">{getStudioRoomById('room-b').label}</option>
              </select>
            </div>

            <div>
              <label htmlFor="offer-date" className="block text-[11px] font-semibold text-[#151515]">
                Tanggal Sesi
              </label>
              <input
                id="offer-date"
                type="date"
                required
                value={formState.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              />
            </div>

            <div>
              <label htmlFor="offer-start-minute" className="block text-[11px] font-semibold text-[#151515]">
                Jam Mulai (WIB)
              </label>
              <select
                id="offer-start-minute"
                value={formState.startMinute}
                onChange={(e) => handleFieldChange('startMinute', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              >
                {startOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="offer-duration" className="block text-[11px] font-semibold text-[#151515]">
                Durasi Sesi
              </label>
              <select
                id="offer-duration"
                value={formState.durationMinutes}
                onChange={(e) => handleFieldChange('durationMinutes', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              >
                {[60, 90, 120, 180, 240, 300, 360].map((mins) => (
                  <option key={mins} value={String(mins)}>
                    {mins % 60 === 0 ? `${mins / 60} Jam (${mins}m)` : `${mins} Menit`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="offer-service-type" className="block text-[11px] font-semibold text-[#151515]">
                Layanan
              </label>
              <select
                id="offer-service-type"
                value={effectiveServiceTypeId}
                onChange={(e) => {
                  const nextSvc = activeStudioServiceTypes.find((s) => s.id === e.target.value);
                  const nextOpt = nextSvc?.options?.find((o) => o.isActive !== false) || nextSvc?.options?.[0];
                  setFormState((prev) => ({
                    ...prev,
                    serviceTypeId: e.target.value,
                    serviceOptionId: nextOpt?.id || '',
                  }));
                }}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              >
                {activeStudioServiceTypes.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="offer-service-option" className="block text-[11px] font-semibold text-[#151515]">
                Paket / Opsi
              </label>
              <select
                id="offer-service-option"
                value={effectiveServiceOptionId}
                onChange={(e) => handleFieldChange('serviceOptionId', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 text-xs"
              >
                {availableOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {isManualQuote ? (
              <div>
                <label htmlFor="offer-manual-price" className="block text-[11px] font-semibold text-[#151515]">
                  Harga Penawaran Disepakati (IDR)
                </label>
                <input
                  id="offer-manual-price"
                  type="number"
                  min={0}
                  step={1000}
                  required
                  value={formState.manualCustomerPrice}
                  onChange={(e) => handleFieldChange('manualCustomerPrice', e.target.value)}
                  className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 font-mono text-xs"
                />
              </div>
            ) : null}

            <div>
              <label htmlFor="offer-valid-hours" className="block text-[11px] font-semibold text-[#151515]">
                Masa Berlaku Offer (Jam)
              </label>
              <input
                id="offer-valid-hours"
                type="number"
                min={1}
                max={336}
                value={formState.offerValidHours}
                onChange={(e) => handleFieldChange('offerValidHours', e.target.value)}
                className="sa-input mt-1 min-h-10 w-full rounded-xl px-3 py-1.5 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="offer-staff-note" className="block text-[11px] font-semibold text-[#151515]">
              Catatan Penawaran ke Client (Opsional)
            </label>
            <textarea
              id="offer-staff-note"
              rows={2}
              maxLength={1000}
              value={formState.staffNoteToClient}
              onChange={(e) => handleFieldChange('staffNoteToClient', e.target.value)}
              placeholder="Rincian penawaran, penyesuaian jam, atau syarat tambahan untuk Client..."
              className="sa-input mt-1 w-full rounded-xl p-2.5 text-xs"
            />
          </div>

          {/* Live Commercial & Deposit Snapshot Preview */}
          <div className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#46433D]">
                Total Quote: <strong className="font-mono text-[#151515]">{formatRupiah(livePricing.totalAmount)}</strong>
              </span>
              <span className="font-mono text-[10.5px] text-[#666159]">
                {formatMinuteOfDay(Number(formState.startMinute) || 600)}–
                {formatMinuteOfDay((Number(formState.startMinute) || 600) + (Number(formState.durationMinutes) || 60))} WIB
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#666159]">
              <span>
                Minimum DP ({liveDepositSnapshot.policySource}):{' '}
                <strong className="text-[#151515]">
                  {liveDepositSnapshot.minimumDepositAmount > 0
                    ? formatRupiah(liveDepositSnapshot.minimumDepositAmount)
                    : 'Tanpa DP (Langsung Confirmed)'}
                </strong>
              </span>
              {liveBalanceDuePolicy?.dueDate ? (
                <span>Jatuh tempo pelunasan: {liveBalanceDuePolicy.dueDate}</span>
              ) : null}
            </div>
          </div>

          <AdminButton
            type="submit"
            variant="primary"
            size="md"
            disabled={Boolean(submittingAction)}
            data-testid="send-offer-submit-button"
            className="w-full justify-center"
          >
            {isActiveSent ? (
              <CalendarPlus2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {submittingAction === 'send'
                ? 'Mengirim Offer...'
                : isActiveSent
                  ? `Kirim Revisi (${nextOfferLabel})`
                  : `Kirim Offer (${nextOfferLabel})`}
            </span>
          </AdminButton>
        </form>
      ) : null}
    </section>
  );
}
