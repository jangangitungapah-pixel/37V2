import { useContext, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Send,
  Star,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AuthContext } from '@/features/auth/AuthContext';

import { useReviewInvitations, useBookingReviewState } from '../hooks/useReviewInvitations';
import {
  issueReviewInvitation,
  resolveBookingReviewPanelState,
  revokeReviewInvitation,
} from '../services/review-invitation-service';
import { ReviewInvitationShareDialog } from './ReviewInvitationShareDialog';
import { ReviewStatusBadge } from './ReviewStatusBadge';

// Ensure tree-shake compatibility while keeping named export usage explicit
void useReviewInvitations;

export function BookingCustomerReviewSection({ booking, readOnly = false, now }) {
  const auth = useContext(AuthContext);
  const actor = {
    uid: auth?.user?.uid || auth?.profile?.uid || '',
    role: String(auth?.role || auth?.profile?.role || '')
      .trim()
      .toLowerCase(),
    active: auth?.profile?.active === true,
  };
  const isOwner = actor.role === 'owner';
  const canActAsStaffOrOwner =
    !readOnly && Boolean(actor.uid) && actor.active && ['owner', 'staff'].includes(actor.role);

  const { invitation, review, isLoading, error } = useBookingReviewState(booking?.id || '', {
    enabled: Boolean(booking?.id),
  });

  const [isIssuing, setIsIssuing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [shareDialogState, setShareDialogState] = useState({
    open: false,
    invitationResult: null,
  });

  if (!booking?.id) {
    return null;
  }

  const panelState = resolveBookingReviewPanelState({
    booking,
    invitation,
    review,
    now,
  });

  const handleGenerateInvitation = async () => {
    if (!canActAsStaffOrOwner || isIssuing) return;
    setIsIssuing(true);
    setActionError('');

    try {
      const origin =
        typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
      const result = await issueReviewInvitation({
        bookingId: booking.id,
        actor,
        origin,
        now: now || new Date(),
      });
      setShareDialogState({
        open: true,
        invitationResult: result,
      });
      toast.success('Tautan undangan ulasan berhasil dibuat.');
    } catch (err) {
      const msg = err?.message || 'Gagal membuat tautan undangan ulasan.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!canActAsStaffOrOwner || isRevoking) return;
    setIsRevoking(true);
    setActionError('');

    try {
      await revokeReviewInvitation({
        bookingId: booking.id,
        actor,
      });
      toast.success('Undangan ulasan aktif berhasil dicabut.');
    } catch (err) {
      const msg = err?.message || 'Gagal mencabut undangan ulasan.';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsRevoking(false);
    }
  };

  const renderPanelBody = () => {
    if (isLoading) {
      return (
        <div className="mt-3.5 flex items-center gap-2 text-xs text-[#666159]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memeriksa status ulasan &amp; undangan booking...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-3.5 rounded-xl border border-red-700/20 bg-red-50/70 p-3 text-xs text-red-900">
          {error}
        </div>
      );
    }

    if (panelState.review) {
      const rev = panelState.review;
      return (
        <div className="mt-3.5 space-y-3 text-xs">
          <div className="sa-panel-ivory p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1" aria-label={`Rating ${rev.rating} dari 5`}>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={`h-3.5 w-3.5 ${
                      idx < rev.rating ? 'fill-[#DF532B] text-[#DF532B]' : 'text-[#151515]/20'
                    }`}
                    aria-hidden="true"
                  />
                ))}
                <span className="ml-1 font-mono font-bold text-[#151515]">{rev.rating}/5</span>
              </div>
              <ReviewStatusBadge status={rev.status} kind="review" />
            </div>

            <p className="mt-2 font-semibold text-[#151515]">{rev.displayName}</p>
            <p className="mt-1 leading-relaxed text-[#46433D]">“{rev.reviewText}”</p>
            <p className="mt-2 font-mono text-[10.5px] text-[#666159]">
              Dikirim {formatIndonesianTimestamp(rev.createdAt)}
            </p>
          </div>

          {isOwner ? (
            <Link
              to="/admin/reviews"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#151515] underline hover:text-[#DF532B]"
            >
              <span>Kelola Moderasi di Customer Reviews</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      );
    }

    if (panelState.key === 'ineligible') {
      return (
        <div className="mt-3.5 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3.5 text-xs text-[#46433D]">
          <p className="font-semibold text-[#151515]">Belum memenuhi syarat undangan ulasan</p>
          <p className="mt-1 leading-relaxed">{panelState.eligibility.reason}</p>
        </div>
      );
    }

    if (panelState.key === 'invitation_active' && panelState.invitation) {
      return (
        <div className="mt-3.5 space-y-3 text-xs">
          <div className="sa-panel-ivory p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#151515]">Undangan Aktif Tersedia</span>
              <ReviewStatusBadge status="active" kind="invitation" />
            </div>
            <p className="mt-1.5 leading-relaxed text-[#46433D]">
              Sesi {panelState.invitation.serviceLabelSnapshot || booking.serviceTypeName} (
              {panelState.invitation.sessionDate
                ? formatIndonesianDateFull(panelState.invitation.sessionDate)
                : booking.date}
              ) memiliki undangan ulasan aktif. Token mentah tidak disimpan — buat ulang jika perlu
              mengirim link baru via WhatsApp.
            </p>
            <p className="mt-1.5 font-mono text-[10.5px] text-[#666159]">
              Berlaku hingga {formatIndonesianTimestamp(panelState.invitation.expiresAt)}
            </p>
          </div>

          {canActAsStaffOrOwner ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isIssuing || isRevoking}
                onClick={handleGenerateInvitation}
                className="sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#151515]/15 bg-[#C8F13A] px-3.5 py-1.5 text-xs font-bold text-[#151515] hover:bg-[#b8e229] disabled:opacity-50"
              >
                {isIssuing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Buat Ulang Undangan</span>
              </button>

              <button
                type="button"
                disabled={isIssuing || isRevoking}
                onClick={handleRevokeInvitation}
                className="sa-control inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-red-700/20 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                {isRevoking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Cabut Undangan</span>
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (panelState.key === 'invitation_submitted') {
      return (
        <div className="mt-3.5 rounded-xl border border-[#151515]/10 bg-[#F4FBE3] p-3.5 text-xs text-[#243300]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>Undangan ulasan sudah digunakan oleh pelanggan.</span>
          </div>
        </div>
      );
    }

    const isRevokedOrExpired =
      panelState.key === 'invitation_revoked' || panelState.key === 'invitation_expired';

    return (
      <div className="mt-3.5 space-y-3 text-xs">
        <div className="sa-panel-ivory p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#151515]">
              {isRevokedOrExpired
                ? panelState.key === 'invitation_expired'
                  ? 'Undangan Ulasan Sebelumnya Kedaluwarsa'
                  : 'Undangan Ulasan Sebelumnya Dicabut'
                : 'Siap Meminta Ulasan Pelanggan'}
            </span>
            {panelState.key === 'invitation_revoked' ? (
              <ReviewStatusBadge status="revoked" kind="invitation" />
            ) : panelState.key === 'invitation_expired' ? (
              <ReviewStatusBadge status="expired" kind="invitation" />
            ) : (
              <span className="rounded-full border border-[#151515]/12 bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#46433D]">
                Not Invited
              </span>
            )}
          </div>
          <p className="mt-1.5 leading-relaxed text-[#46433D]">
            {isRevokedOrExpired
              ? 'Buat ulang link undangan baru untuk dikirim ke WhatsApp pelanggan.'
              : 'Buat tautan undangan unik berbasis booking ini lalu bagikan secara manual via WhatsApp.'}
          </p>
        </div>

        {canActAsStaffOrOwner ? (
          <button
            type="button"
            disabled={isIssuing}
            onClick={handleGenerateInvitation}
            className="sa-control inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-[#151515] px-4 py-2 font-mono text-xs font-bold tracking-wider text-[#C8F13A] uppercase hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            {isIssuing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isRevokedOrExpired ? 'Buat Ulang Undangan' : 'REQUEST CUSTOMER REVIEW'}</span>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <section
        aria-labelledby="drawer-customer-review-heading"
        data-testid="booking-customer-review-section"
        className="sa-card p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#151515]/8 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="text-studio-orange h-4 w-4" aria-hidden="true" />
            <h3
              id="drawer-customer-review-heading"
              className="text-studio-ink text-sm font-semibold tracking-tight"
            >
              Customer Review
            </h3>
          </div>
          {panelState.review ? (
            <ReviewStatusBadge status={panelState.review.status} kind="review" />
          ) : panelState.key === 'invitation_active' ? (
            <ReviewStatusBadge status="active" kind="invitation" />
          ) : null}
        </div>

        {actionError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-700/20 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
          >
            {actionError}
          </div>
        ) : null}

        {renderPanelBody()}
      </section>

      <ReviewInvitationShareDialog
        open={shareDialogState.open}
        onOpenChange={(nextOpen) =>
          setShareDialogState((prev) => ({
            ...prev,
            open: nextOpen,
          }))
        }
        invitationResult={shareDialogState.invitationResult}
      />
    </>
  );
}
