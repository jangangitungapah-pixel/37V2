import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MessageCircle, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { BOOKING_REQUEST_TYPES } from '@/features/admin/booking-requests/config/booking-request-config';

import { CLIENT_PORTAL_ROUTES } from '../../config/client-portal-config';

export function ClientBookingSuccessView({ submittedRequest, estimateSnapshot, onBookAnother }) {
  const isPostProduction =
    submittedRequest?.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY;

  return (
    <AdminSurface
      as="section"
      variant="card"
      data-testid="client-booking-success-view"
      className="space-y-5 p-5 sm:p-7"
    >
      <div className="flex flex-col gap-4 border-b border-[#151515]/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EDF8C2] text-[#243300]">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone="amber" dot>
                Request Received · Pending Studio Review
              </AdminStatusBadge>
              <span className="rounded-lg bg-[#151515] px-2.5 py-0.5 font-mono text-xs font-bold text-[#C8F13A]">
                {submittedRequest?.requestReference}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-[#151515] sm:text-xl">
              {isPostProduction
                ? 'Your project inquiry is in our studio inbox'
                : 'Your session request is in our studio inbox'}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#666159] sm:text-sm">
              This request is tentative and does not confirm or reserve a studio room yet. Our team
              will verify availability and follow up directly on WhatsApp (
              {submittedRequest?.contactPhoneDisplay || submittedRequest?.contactPhone}).
            </p>
          </div>
        </div>
      </div>

      {/* Request Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sa-panel-ivory rounded-xl p-3.5">
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
            Selected Service
          </span>
          <p className="mt-1 text-sm font-bold text-[#151515]">
            {submittedRequest?.serviceLabelSnapshot}
          </p>
          {submittedRequest?.serviceOptionName ? (
            <p className="mt-0.5 text-xs text-[#46433D]">{submittedRequest.serviceOptionName}</p>
          ) : null}
        </div>

        {!isPostProduction ? (
          <div className="sa-panel-ivory rounded-xl p-3.5">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              <span>Preferred Schedule</span>
            </span>
            <p className="mt-1 text-sm font-bold text-[#151515]">
              {submittedRequest?.preferredDate} · {submittedRequest?.preferredTimeLabel} WIB
            </p>
            <p className="mt-0.5 text-xs text-[#46433D]">
              {submittedRequest?.requestedRoomLabel} ·{' '}
              {formatDurationMinutes(Number(submittedRequest?.preferredDurationMinutes) || 60)}
            </p>
          </div>
        ) : (
          <div className="sa-panel-ivory rounded-xl p-3.5">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              <span>Project Timeline</span>
            </span>
            <p className="mt-1 text-sm font-bold text-[#151515]">
              {submittedRequest?.targetDeadline
                ? `Target: ${submittedRequest.targetDeadline}`
                : 'Flexible deadline'}
            </p>
            <p className="mt-0.5 text-xs text-[#46433D]">Post-Production Inquiry (Non-Room)</p>
          </div>
        )}

        <div className="sa-panel-ivory rounded-xl p-3.5">
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
            Tentative Estimate
          </span>
          <p className="mt-1 font-mono text-sm font-bold text-[#151515]">
            {estimateSnapshot?.isManualQuote || estimateSnapshot?.estimatedTotal === null
              ? 'Custom Quote'
              : formatRupiah(estimateSnapshot.estimatedTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666159]">
            Final payment &amp; confirmation are coordinated directly with studio staff.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#151515]/10 bg-[#FAF8F1] p-3.5 text-xs text-[#46433D]">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
        <span>
          Keep reference{' '}
          <strong className="text-[#151515]">{submittedRequest?.requestReference}</strong> handy.
          Once our staff confirms your slot on the studio calendar, your session becomes official.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onBookAnother}
          className="sa-btn-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Book Another Session</span>
        </button>

        <Link
          to={CLIENT_PORTAL_ROUTES.BOOKINGS}
          className="sa-btn-secondary inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
        >
          <span>View My Bookings</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        <Link
          to={CLIENT_PORTAL_ROUTES.HOME}
          className="inline-flex min-h-10 items-center justify-center px-3 py-2 text-xs font-semibold text-[#666159] hover:text-[#151515]"
        >
          Back to Overview
        </Link>
      </div>
    </AdminSurface>
  );
}
