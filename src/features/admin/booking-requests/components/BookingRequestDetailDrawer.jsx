import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Phone,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';
import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';

import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import { useBookingRequestDetail } from '../hooks/useBookingRequestDetail';
import {
  mapBookingRequestErrorToMessage,
  transitionBookingRequestStatus,
} from '../services/booking-request-service';
import { formatRequestDurationLabel } from '../utils/booking-request-normalize';
import { BookingRequestActivityTimeline } from './BookingRequestActivityTimeline';
import {
  BookingRequestSourceBadge,
  BookingRequestStatusBadge,
  BookingRequestTypeBadge,
} from './BookingRequestStatusBadge';
import { WhatsAppMessageComposer } from './WhatsAppMessageComposer';

const TRANSITION_BUTTON_META = {
  [BOOKING_REQUEST_STATUS.IN_REVIEW]: { label: 'Mark In Review', variant: 'secondary' },
  [BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER]: { label: 'Awaiting Customer', variant: 'secondary' },
  [BOOKING_REQUEST_STATUS.ACCEPTED]: { label: 'Accept Request', variant: 'lime' },
  [BOOKING_REQUEST_STATUS.DECLINED]: { label: 'Decline Request', variant: 'danger' },
  [BOOKING_REQUEST_STATUS.CLOSED]: { label: 'Close Request', variant: 'ghost' },
};

export function BookingRequestDetailDrawer({ requestId, open, onOpenChange, actorUid, actorName }) {
  const { request, communications, activities, availabilityContext, isLoading, error } =
    useBookingRequestDetail(open ? requestId : '');

  const [pendingReasonTarget, setPendingReasonTarget] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  const allowedManualTargets = request
    ? ALLOWED_MANUAL_STATUS_TRANSITIONS[request.status] || []
    : [];

  const canConvertToCalendarBooking = Boolean(
    request &&
    request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING &&
    !request.linkedBookingId &&
    [
      BOOKING_REQUEST_STATUS.NEW,
      BOOKING_REQUEST_STATUS.IN_REVIEW,
      BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
      BOOKING_REQUEST_STATUS.ACCEPTED,
    ].includes(request.status),
  );

  const handleTransitionClick = async (targetStatus) => {
    if (!request || isUpdatingStatus) return;

    if (
      targetStatus === BOOKING_REQUEST_STATUS.DECLINED ||
      targetStatus === BOOKING_REQUEST_STATUS.CLOSED
    ) {
      setPendingReasonTarget(targetStatus);
      setReasonInput('');
      setStatusError('');
      return;
    }

    await executeStatusTransition(targetStatus, '');
  };

  const executeStatusTransition = async (targetStatus, reason) => {
    if (!request || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setStatusError('');

    try {
      await transitionBookingRequestStatus({
        requestId: request.id,
        expectedVersion: request.version,
        nextStatus: targetStatus,
        reason,
        actorUid,
        actorName,
      });
      setPendingReasonTarget('');
      setReasonInput('');
      toast.success(`Status request diperbarui ke ${targetStatus}.`);
    } catch (err) {
      const msg = mapBookingRequestErrorToMessage(err);
      setStatusError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />
        <Dialog.Viewport className="fixed inset-0 z-50 flex justify-end">
          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label="Detail Booking Request"
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#FAF8F1] shadow-[-16px_0_48px_-12px_rgba(21,21,21,0.3)] outline-none"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-[#151515] px-4 py-4 text-[#F1EEE4] sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#C8F13A] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#151515]">
                    {request?.requestReference || 'LOADING...'}
                  </span>
                  {request ? <BookingRequestStatusBadge status={request.status} size="sm" /> : null}
                  {request ? (
                    <BookingRequestTypeBadge requestType={request.requestType} size="sm" />
                  ) : null}
                  {request ? <BookingRequestSourceBadge source={request.source} size="sm" /> : null}
                </div>
                <Dialog.Title className="mt-1.5 truncate text-lg font-bold text-white sm:text-xl">
                  {request?.customerName || 'Detail Booking Request'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-neutral-400">
                  Tinjau permintaan pelanggan, cek kalender, hubungi via WhatsApp, dan konversi
                  booking di Calendar.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail request"
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:text-[#C8F13A]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              {isLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-[#151515]/10 bg-white p-5 text-sm text-[#46433D]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memuat detail booking request...</span>
                </div>
              ) : error || !request ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-900 sm:text-sm"
                >
                  {error || 'Booking request tidak ditemukan.'}
                </div>
              ) : (
                <>
                  {/* Customer & Service Overview */}
                  <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[#151515]/10 bg-white p-4 sm:grid-cols-2">
                    <div>
                      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#666159] uppercase">
                        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Customer &amp; Band</span>
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#151515]">
                        {request.customerName}
                      </p>
                      {request.bandName ? (
                        <p className="text-xs text-[#666159]">Band/Project: {request.bandName}</p>
                      ) : null}
                      <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-[#151515]">
                        <Phone className="h-3 w-3 text-[#666159]" aria-hidden="true" />
                        <span>{request.contactPhoneDisplay || request.contactPhone}</span>
                      </p>
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[#666159] uppercase">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Permintaan Asli Customer</span>
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#151515]">
                        {request.serviceLabelSnapshot}
                        {request.serviceOptionName ? ` · ${request.serviceOptionName}` : ''}
                      </p>
                      {request.pricingVersion ? (
                        <p className="mt-0.5 font-mono text-[11px] text-[#666159]">
                          Katalog Publik v{request.pricingVersion}
                        </p>
                      ) : null}
                      {request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING ? (
                        <p className="mt-0.5 text-xs text-[#46433D]">
                          {request.requestedRoomLabel} • {request.preferredDate || '-'} •{' '}
                          {request.preferredTimeLabel || '-'} WIB (
                          {formatRequestDurationLabel(request.preferredDurationMinutes)})
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-[#46433D]">
                          Post-production inquiry (non-room)
                          {request.targetDeadline ? ` • Target: ${request.targetDeadline}` : ''}
                        </p>
                      )}
                      {request.notes ? (
                        <p className="mt-2 rounded-lg bg-[#FAF8F1] p-2 text-xs whitespace-pre-wrap text-[#46433D]">
                          {request.notes}
                        </p>
                      ) : null}
                    </div>
                  </section>

                  {/* Confirmed Canonical Booking Card OR Accepted Warning */}
                  {request.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
                  request.linkedBookingId &&
                  request.confirmedBookingSnapshot ? (
                    <section
                      data-testid="confirmed-booking-summary-card"
                      className="rounded-2xl border border-emerald-500/35 bg-[#E6F6EC]/75 p-4 text-xs text-[#0F6246]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>
                            Terkonfirmasi ke Booking Kanonik (
                            {request.confirmedBookingSnapshot.bookingReference})
                          </span>
                        </div>
                        <Link
                          to={`/admin/calendar?date=${encodeURIComponent(request.confirmedBookingSnapshot.date)}&bookingId=${encodeURIComponent(request.linkedBookingId)}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#151515] px-2.5 py-1 font-semibold text-white hover:bg-[#2B2A27]"
                        >
                          <span>Lihat di Calendar</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                        </Link>
                      </div>
                      <p className="mt-1.5 font-medium">
                        {request.confirmedBookingSnapshot.studioName} •{' '}
                        {request.confirmedBookingSnapshot.serviceTypeName} (
                        {request.confirmedBookingSnapshot.serviceOptionName}) •{' '}
                        {request.confirmedBookingSnapshot.date} •{' '}
                        {formatMinuteRange(
                          request.confirmedBookingSnapshot.startMinute,
                          request.confirmedBookingSnapshot.endMinute,
                        )}{' '}
                        ({formatDurationMinutes(request.confirmedBookingSnapshot.durationMinutes)})
                      </p>
                    </section>
                  ) : null}

                  {request.status === BOOKING_REQUEST_STATUS.ACCEPTED ? (
                    <div className="flex items-start gap-2 rounded-xl border border-[#8BAD12]/40 bg-[#EDF8C2]/70 p-3 text-xs text-[#243300]">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        <strong>Accepted ≠ Confirmed:</strong> Request ini ditandai siap diterima,
                        namun slot ruangan belum terkunci sebelum Anda menekan{' '}
                        <strong>Convert to Calendar Booking</strong>.
                      </span>
                    </div>
                  ) : null}

                  {/* Live Availability Context for studio_booking */}
                  {request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING &&
                  availabilityContext ? (
                    <section
                      aria-labelledby="availability-context-heading"
                      className="space-y-2.5 rounded-2xl border border-[#151515]/10 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4
                          id="availability-context-heading"
                          className="text-xs font-bold tracking-wide text-[#151515] uppercase"
                        >
                          Konteks Ketersediaan ({availabilityContext.date} •{' '}
                          {availabilityContext.requestedRangeLabel})
                        </h4>
                        <AdminStatusBadge
                          tone={availabilityContext.hasAnyOpenRoom ? 'emerald' : 'orange'}
                          size="sm"
                        >
                          {availabilityContext.isLoading
                            ? 'Memeriksa...'
                            : availabilityContext.hasAnyOpenRoom
                              ? 'Tersedia di Calendar'
                              : 'Jadwal Bentrok'}
                        </AdminStatusBadge>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {availabilityContext.roomResults?.map((roomRes) => (
                          <div
                            key={roomRes.studioId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] px-3 py-2"
                          >
                            <span className="font-semibold text-[#151515]">
                              {roomRes.roomLabel}
                            </span>
                            {roomRes.isOpen ? (
                              <span className="font-mono text-[11px] font-semibold text-[#0F6246]">
                                Terbuka
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] font-semibold text-[#B92B0C]">
                                Bentrok ({roomRes.conflicts[0]?.customerName} ·{' '}
                                {roomRes.conflicts[0]?.rangeLabel})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] text-[#666159]">
                        Status di atas bersifat informasional. Validasi ketersediaan kanonik
                        dijalankan secara atomik saat booking dibuat di Admin Calendar.
                      </p>
                    </section>
                  ) : null}

                  {/* Workflow Controls + Convert to Calendar Booking */}
                  <section
                    aria-labelledby="workflow-controls-heading"
                    className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-4"
                  >
                    <h4
                      id="workflow-controls-heading"
                      className="text-xs font-bold tracking-wide text-[#151515] uppercase"
                    >
                      Aksi Workflow &amp; Konversi
                    </h4>

                    {statusError ? (
                      <p role="alert" className="text-xs font-semibold text-red-700">
                        {statusError}
                      </p>
                    ) : null}

                    {request.statusReason &&
                    (request.status === BOOKING_REQUEST_STATUS.DECLINED ||
                      request.status === BOOKING_REQUEST_STATUS.CLOSED) ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                        <strong>Alasan:</strong> {request.statusReason}
                      </p>
                    ) : null}

                    {canConvertToCalendarBooking ? (
                      <Link
                        to={`/admin/calendar?action=new-booking&requestId=${encodeURIComponent(request.id)}`}
                        data-testid="convert-to-calendar-booking-link"
                        className="sa-btn-orange inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold tracking-wide uppercase shadow-sm"
                      >
                        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                        <span>Convert to Calendar Booking</span>
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : request.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? (
                      <p className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3 py-2 text-xs text-[#46433D]">
                        Inquiry Mix &amp; Master dikelola melalui status workflow &amp; WhatsApp
                        tanpa membuat jadwal ruangan palsu di Calendar.
                      </p>
                    ) : null}

                    {allowedManualTargets.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {allowedManualTargets.map((targetStatus) => {
                          const btnMeta = TRANSITION_BUTTON_META[targetStatus] || {
                            label: targetStatus,
                            variant: 'secondary',
                          };
                          return (
                            <AdminButton
                              key={targetStatus}
                              variant={btnMeta.variant}
                              size="sm"
                              disabled={isUpdatingStatus}
                              onClick={() => handleTransitionClick(targetStatus)}
                            >
                              {btnMeta.label}
                            </AdminButton>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#666159]">
                        Status saat ini sudah final — tidak ada transisi status manual lagi.
                      </p>
                    )}

                    {/* Inline Decline / Close Reason Confirmation */}
                    {pendingReasonTarget ? (
                      <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/70 p-3">
                        <label
                          htmlFor="status-reason-input"
                          className="block text-xs font-semibold text-red-900"
                        >
                          Alasan{' '}
                          {pendingReasonTarget === BOOKING_REQUEST_STATUS.DECLINED
                            ? 'Penolakan'
                            : 'Penutupan'}{' '}
                          (Wajib)
                        </label>
                        <input
                          id="status-reason-input"
                          type="text"
                          value={reasonInput}
                          onChange={(e) => setReasonInput(e.target.value)}
                          placeholder="Mis. Jadwal penuh atau pelanggan membatalkan..."
                          className="sa-input w-full rounded-xl bg-white px-3 py-2 text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <AdminButton
                            variant="secondary"
                            size="xs"
                            onClick={() => setPendingReasonTarget('')}
                          >
                            Batal
                          </AdminButton>
                          <AdminButton
                            variant="danger"
                            size="xs"
                            disabled={isUpdatingStatus || reasonInput.trim().length < 3}
                            onClick={() =>
                              executeStatusTransition(pendingReasonTarget, reasonInput.trim())
                            }
                          >
                            Konfirmasi{' '}
                            {pendingReasonTarget === BOOKING_REQUEST_STATUS.DECLINED
                              ? 'Decline'
                              : 'Close'}
                          </AdminButton>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  {/* WhatsApp Click-to-Chat Workspace */}
                  <WhatsAppMessageComposer
                    request={request}
                    actorUid={actorUid}
                    alternativeSlots={availabilityContext?.alternativeSlots || []}
                  />

                  {/* Immutable Activity & Communication Timeline */}
                  <BookingRequestActivityTimeline
                    activities={activities}
                    communications={communications}
                  />
                </>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
