import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Receipt,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router';

import { getBookingRequestRepositoryAdapter } from '@/features/admin/booking-requests/repositories/booking-request-repository';
import {
  isOfferExpiredByTime,
  OFFER_MODES,
  OFFER_STATUS_META,
  OFFER_STATUSES,
} from '@/features/admin/booking-requests/schemas/offer-schema';
import {
  acceptClientOffer,
  rejectClientOffer,
} from '@/features/admin/booking-requests/services/offer-service';
import { formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { formatClientRupiah } from '@/features/client-portal/billing/utils/client-billing-utils';
import { CLIENT_PORTAL_ROUTES } from '@/features/client-portal/config/client-portal-config';
import { AdminStatusBadge } from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

export function ClientOfferReviewCard({ request, now = undefined }) {
  const { user } = useAuth();
  const clientUid = String(user?.uid || request?.clientUid || '').trim();
  const requestId = String(request?.sourceRequestId || request?.id || '').trim();
  const requestVersion = request?.requestVersion ?? request?.version;

  const [offersState, setOffersState] = useState({
    requestId: '',
    offers: [],
  });
  const [submittingAction, setSubmittingAction] = useState(''); // '' | 'accept' | 'reject'
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!requestId) return undefined;
    const adapter = getBookingRequestRepositoryAdapter();
    if (typeof adapter.subscribeRequestOffers !== 'function') return undefined;

    let cancelled = false;
    const unsub = adapter.subscribeRequestOffers({
      requestId,
      clientSafe: true,
      maxLimit: 20,
      onData: (items) => {
        if (!cancelled) {
          setOffersState({
            requestId,
            offers: Array.isArray(items) ? items : [],
          });
        }
      },
      onError: () => {},
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [requestId]);

  const offers = offersState.requestId === requestId ? offersState.offers : [];
  const activeOffer =
    offers.find((o) => o.id === request?.activeOfferId) || offers[0] || null;
  const fallbackSummary = !activeOffer ? request?.activeOfferSummary : null;

  if (!activeOffer && !fallbackSummary) {
    return null;
  }

  const displayStatus = activeOffer?.status || fallbackSummary?.status || OFFER_STATUSES.SENT;
  const statusMeta = OFFER_STATUS_META[displayStatus] || {
    label: displayStatus,
    tone: 'neutral',
  };
  const isExpiredTime = activeOffer ? isOfferExpiredByTime(activeOffer, now || new Date()) : false;
  const offerMode = activeOffer?.offerMode || fallbackSummary?.mode || OFFER_MODES.QUOTE_ONLY;
  const isDepositHoldOffer = offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER;
  const provisionalBookingId =
    activeOffer?.provisionalBookingId || fallbackSummary?.provisionalBookingId || null;
  const holdDeadline = activeOffer?.holdDeadline || fallbackSummary?.holdExpiresAt || null;
  const isActionableOffer = Boolean(
    activeOffer &&
      [OFFER_MODES.QUOTE_ONLY, OFFER_MODES.DEPOSIT_HOLD_OFFER].includes(activeOffer.offerMode) &&
      activeOffer.status === OFFER_STATUSES.SENT &&
      !activeOffer.supersededByOfferId &&
      !isExpiredTime,
  );

  const schedule = activeOffer?.scheduleSnapshot || null;
  const service = activeOffer?.serviceSnapshot || null;
  const totalAmount =
    activeOffer?.financialSnapshot?.totalAmount ?? fallbackSummary?.totalAmount ?? 0;
  const minDeposit =
    activeOffer?.depositPolicySnapshot?.minimumDepositAmount ??
    fallbackSummary?.minimumDepositAmount ??
    0;

  const handleAccept = async () => {
    if (!activeOffer || submittingAction) return;
    setSubmittingAction('accept');
    setActionError('');
    try {
      await acceptClientOffer({
        requestId,
        offerId: activeOffer.id,
        expectedOfferVersion: activeOffer.version,
        expectedRequestVersion: requestVersion,
        clientUid,
        now: now || new Date(),
      });
    } catch (err) {
      setActionError(err?.message || 'Unable to accept this offer right now.');
    } finally {
      setSubmittingAction('');
    }
  };

  const handleReject = async () => {
    if (!activeOffer || submittingAction) return;
    setSubmittingAction('reject');
    setActionError('');
    try {
      await rejectClientOffer({
        requestId,
        offerId: activeOffer.id,
        expectedOfferVersion: activeOffer.version,
        expectedRequestVersion: requestVersion,
        clientUid,
        responseReason: rejectReason,
        now: now || new Date(),
      });
      setShowRejectBox(false);
      setRejectReason('');
    } catch (err) {
      setActionError(err?.message || 'Unable to submit offer response right now.');
    } finally {
      setSubmittingAction('');
    }
  };

  return (
    <div
      data-testid={`client-offer-review-${requestId}`}
      className="mt-3.5 space-y-2.5 rounded-xl border border-[#8BAD12]/35 bg-[#F8FBE8]/75 p-3.5 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[#151515] px-2 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
            {activeOffer?.offerNumber || fallbackSummary?.offerNumber || 'OFFER'}
          </span>
          <AdminStatusBadge tone={isExpiredTime && displayStatus === OFFER_STATUSES.SENT ? 'danger' : statusMeta.tone} size="sm">
            {isExpiredTime && displayStatus === OFFER_STATUSES.SENT ? 'Expired' : statusMeta.label}
          </AdminStatusBadge>
          <AdminStatusBadge tone="ivory" size="sm">
            {isDepositHoldOffer
              ? 'Deposit Hold Offer (Provisional Slot Held)'
              : 'Quote Proposal (Slot Not Locked Yet)'}
          </AdminStatusBadge>
        </div>

        <span className="font-mono text-sm font-bold text-[#151515] tabular-nums">
          {formatClientRupiah(totalAmount)}
        </span>
      </div>

      {schedule ? (
        <div className="grid gap-1.5 text-[11px] text-[#46433D] sm:grid-cols-2">
          <p className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
            <span>
              {formatIndonesianDateMedium(schedule.date)} ·{' '}
              {formatMinuteRange(schedule.startMinute, schedule.endMinute)} WIB ·{' '}
              {schedule.studioName || (schedule.studioId === 'room-b' ? 'Room B' : 'Room A')}
            </span>
          </p>
          {service ? (
            <p className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
              <span>
                {service.serviceTypeName}
                {service.serviceOptionName ? ` · ${service.serviceOptionName}` : ''}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#46433D]">
        <span>
          {isDepositHoldOffer
            ? 'Minimum Deposit Required:'
            : 'Minimum Deposit Needed After Confirmation:'}{' '}
          <strong className="font-mono text-[#151515]">
            {minDeposit > 0 ? formatClientRupiah(minDeposit) : 'No Deposit Required'}
          </strong>
        </span>
        {holdDeadline ? (
          <span>
            Hold expires at:{' '}
            <strong>{formatIndonesianTimestamp(holdDeadline)}</strong>
          </span>
        ) : null}
        {activeOffer?.offerExpiresAt || fallbackSummary?.offerExpiresAt ? (
          <span>
            Offer valid until:{' '}
            <strong>
              {formatIndonesianTimestamp(
                activeOffer?.offerExpiresAt || fallbackSummary?.offerExpiresAt,
              )}
            </strong>
          </span>
        ) : null}
      </div>

      {activeOffer?.staffNoteToClient ? (
        <p className="rounded-lg bg-white/90 px-2.5 py-2 text-[11px] leading-relaxed text-[#46433D]">
          Studio Note: &ldquo;{activeOffer.staffNoteToClient}&rdquo;
        </p>
      ) : null}

      {isDepositHoldOffer &&
      provisionalBookingId &&
      [OFFER_STATUSES.SENT, OFFER_STATUSES.ACCEPTED].includes(displayStatus) ? (
        <div
          data-testid={`client-deposit-hold-invoice-notice-${requestId}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-950"
        >
          <span className="inline-flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Your room slot is provisionally held and unpaid invoice{' '}
              <code className="font-mono font-bold">inv_{provisionalBookingId}</code> is ready.
            </span>
          </span>
          <Link
            to={`${CLIENT_PORTAL_ROUTES.INVOICES}?invoiceId=${encodeURIComponent(`inv_${provisionalBookingId}`)}`}
            className="inline-flex items-center gap-1 font-semibold text-[#151515] underline decoration-[#151515]/30 hover:text-[#0F6246]"
          >
            <span>Upload Deposit Proof</span>
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">
          {actionError}
        </p>
      ) : null}

      {displayStatus === OFFER_STATUSES.ACCEPTED ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0F6246]">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {isDepositHoldOffer
              ? 'Offer accepted. Please submit your deposit payment proof in My Invoices before the hold deadline to confirm your booking.'
              : 'Offer accepted. Studio team will lock the room schedule and send your invoice shortly.'}
          </span>
        </p>
      ) : isExpiredTime && displayStatus === OFFER_STATUSES.SENT ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#B92B0C]">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>This offer validity window has passed. Contact our team for an updated revision.</span>
        </p>
      ) : isActionableOffer ? (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={handleAccept}
              data-testid={`client-accept-offer-${activeOffer.id}`}
              className="sa-btn-primary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{submittingAction === 'accept' ? 'Accepting...' : 'Accept Offer'}</span>
            </button>

            <button
              type="button"
              disabled={Boolean(submittingAction)}
              onClick={() => setShowRejectBox((prev) => !prev)}
              data-testid={`client-reject-offer-toggle-${activeOffer.id}`}
              className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Request Changes / Decline</span>
            </button>
          </div>

          {showRejectBox ? (
            <div className="space-y-2 rounded-lg border border-[#151515]/10 bg-white p-2.5">
              <label htmlFor={`reject-reason-${activeOffer.id}`} className="block text-[11px] font-semibold text-[#151515]">
                Note to Studio (Optional)
              </label>
              <input
                id={`reject-reason-${activeOffer.id}`}
                type="text"
                maxLength={300}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g. Can we move to 16:00 WIB or Room B?"
                className="sa-input min-h-9 w-full rounded-lg px-2.5 py-1 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectBox(false)}
                  className="sa-btn-secondary min-h-8 cursor-pointer px-3 py-1 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(submittingAction)}
                  onClick={handleReject}
                  data-testid={`client-confirm-reject-offer-${activeOffer.id}`}
                  className="sa-btn-orange min-h-8 cursor-pointer px-3 py-1 text-xs font-semibold disabled:opacity-50"
                >
                  {submittingAction === 'reject' ? 'Sending...' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
