import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
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
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import {
  ALLOWED_MANUAL_STATUS_TRANSITIONS,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_STATUS_META,
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
import { OfferComposerCard } from './OfferComposerCard';
import { OfferRevisionHistoryList } from './OfferRevisionHistoryList';
import { OFFER_MODES } from '../schemas/offer-schema';
import { WhatsAppMessageComposer } from './WhatsAppMessageComposer';

const TRANSITION_BUTTON_META = {
  [BOOKING_REQUEST_STATUS.IN_REVIEW]: { label: 'Mark In Review', variant: 'secondary' },
  [BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER]: { label: 'Awaiting Customer', variant: 'secondary' },
  [BOOKING_REQUEST_STATUS.ACCEPTED]: { label: 'Accept Request', variant: 'lime' },
  [BOOKING_REQUEST_STATUS.DECLINED]: { label: 'Decline Request', variant: 'danger' },
  [BOOKING_REQUEST_STATUS.CLOSED]: { label: 'Close Request', variant: 'ghost' },
};

function RequestField({ label, value, emphasize = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">{label}</p>
      <p className={'mt-1 break-words text-xs leading-relaxed ' + (emphasize ? 'font-bold text-[#151515]' : 'font-medium text-[#46433D]')}>
        {value || 'Belum tersedia'}
      </p>
    </div>
  );
}

function RequestSectionHeading({ icon: Icon, eyebrow, title, description }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1]">
        <Icon className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-[#8B857B] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-sm font-bold tracking-tight text-[#151515]">{title}</h3>
        {description ? <p className="mt-0.5 text-[11px] leading-relaxed text-[#777166]">{description}</p> : null}
      </div>
    </div>
  );
}

export function BookingRequestDetailDrawer({ requestId, open, onOpenChange, actorUid, actorName }) {
  const { request, communications, activities, offers, availabilityContext, isLoading, error } =
    useBookingRequestDetail(open ? requestId : '');

  const [pendingReasonTarget, setPendingReasonTarget] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  const allowedManualTargets = request
    ? ALLOWED_MANUAL_STATUS_TRANSITIONS[request.status] || []
    : [];

  const activeOffer =
    offers.find((o) => o.id === request?.activeOfferId) || offers[0] || null;
  const acceptedOffer =
    offers.find((o) => o.status === 'accepted' && (!request?.activeOfferId || o.id === request.activeOfferId)) ||
    null;
  const hasPendingSentOffer = Boolean(
    request?.status === BOOKING_REQUEST_STATUS.OFFER_SENT && activeOffer?.status === 'sent',
  );
  const provisionalOfferHoldId =
    activeOffer?.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER &&
    activeOffer?.provisionalBookingId &&
    ['sent', 'accepted'].includes(activeOffer?.status)
      ? activeOffer.provisionalBookingId
      : '';

  const canConvertToCalendarBooking = Boolean(
    request &&
    request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING &&
    !request.linkedBookingId &&
    !hasPendingSentOffer &&
    !provisionalOfferHoldId &&
    [
      BOOKING_REQUEST_STATUS.NEW,
      BOOKING_REQUEST_STATUS.IN_REVIEW,
      BOOKING_REQUEST_STATUS.AWAITING_CUSTOMER,
      BOOKING_REQUEST_STATUS.OFFER_SENT,
      BOOKING_REQUEST_STATUS.ACCEPTED,
    ].includes(request.status),
  );

  const calendarConvertUrl = request
    ? acceptedOffer
      ? `/admin/calendar?action=new-booking&requestId=${encodeURIComponent(request.id)}&offerId=${encodeURIComponent(acceptedOffer.id)}`
      : `/admin/calendar?action=new-booking&requestId=${encodeURIComponent(request.id)}`
    : '/admin/calendar';

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
      toast.success('Status request diperbarui ke ' + targetStatus + '.');
    } catch (err) {
      const msg = mapBookingRequestErrorToMessage(err);
      setStatusError(msg);
      toast.error(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const statusMeta = request ? BOOKING_REQUEST_STATUS_META[request.status] : null;
  const availabilityTone = availabilityContext?.isLoading
    ? 'neutral'
    : availabilityContext?.error
      ? 'danger'
      : availabilityContext?.hasAnyOpenRoom
        ? 'emerald'
        : 'orange';

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
            className="sa-drawer flex h-dvh w-full max-w-5xl flex-col overflow-hidden bg-[#F4F1E8] shadow-[-16px_0_48px_-12px_rgba(21,21,21,0.3)] outline-none"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-[#151515] px-4 py-4 text-[#F1EEE4] sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-[#C8F13A] px-2 py-1 font-mono text-[10px] font-extrabold tracking-wide text-[#151515]">
                    {request?.requestReference || 'LOADING...'}
                  </span>
                  {request ? <BookingRequestStatusBadge status={request.status} size="sm" /> : null}
                  {request ? <BookingRequestTypeBadge requestType={request.requestType} size="sm" /> : null}
                  {request ? <BookingRequestSourceBadge source={request.source} size="sm" /> : null}
                </div>
                <p className="font-mono text-[9px] font-bold tracking-[0.18em] text-[#A8A398] uppercase">
                  Customer Operations / Request Workspace
                </p>
                <Dialog.Title className="mt-1 truncate text-lg font-bold tracking-tight text-white sm:text-2xl">
                  {request?.customerName || 'Detail Booking Request'}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-neutral-400 sm:text-xs">
                  Ringkasan permintaan, pengecekan jadwal, komunikasi customer, dan riwayat penanganan.
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail request"
                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:border-[#C8F13A] hover:text-[#C8F13A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8F13A]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </header>

            <div className="sa-safe-bottom min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {isLoading ? (
                <div className="flex min-h-44 items-center justify-center gap-2 rounded-2xl border border-[#151515]/10 bg-white p-5 text-sm text-[#46433D]">
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
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start">
                  <main className="min-w-0 space-y-4">
                    <section
                      aria-labelledby="request-overview-heading"
                      className="overflow-hidden rounded-2xl border border-[#151515]/10 bg-white shadow-[0_2px_8px_rgba(21,21,21,0.035)]"
                    >
                      <div className="border-b border-[#151515]/[0.07] px-4 py-3.5 sm:px-5">
                        <div id="request-overview-heading">
                          <RequestSectionHeading
                            icon={UserRound}
                            eyebrow="Customer & request"
                            title="Informasi Permintaan"
                            description="Data yang dikirim customer saat mengajukan permintaan."
                          />
                        </div>
                      </div>

                      <div className="grid gap-0 sm:grid-cols-2">
                        <div className="space-y-3.5 border-b border-[#151515]/[0.07] p-4 sm:border-r sm:border-b-0 sm:p-5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">
                                Nama customer
                              </p>
                              <p className="mt-1 break-words text-base font-bold leading-tight text-[#151515]">
                                {request.customerName || 'Nama belum tersedia'}
                              </p>
                              {request.bandName ? (
                                <p className="mt-1 break-words text-xs text-[#666159]">
                                  Band / Project: {request.bandName}
                                </p>
                              ) : null}
                            </div>
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FAF8F1]">
                              <UserRound className="h-4 w-4 text-[#666159]" aria-hidden="true" />
                            </span>
                          </div>

                          <div className="rounded-xl border border-[#151515]/[0.07] bg-[#FAF8F1] p-3">
                            <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">
                              Nomor WhatsApp
                            </p>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
                              <p className="min-w-0 break-all font-mono text-xs font-bold text-[#151515]">
                                {request.contactPhoneDisplay || request.contactPhone || 'Nomor belum tersedia'}
                              </p>
                            </div>
                          </div>

                          <RequestField
                            label="Kanal masuk"
                            value={
                              request.source === 'public_landing_page'
                                ? 'Website'
                                : request.source === 'public_availability_calendar'
                                  ? 'Kalender Publik'
                                  : request.source === 'client_portal'
                                    ? 'Client Portal'
                                    : request.source || 'Tidak diketahui'
                            }
                          />
                        </div>

                        <div className="space-y-3.5 p-4 sm:p-5">
                          <div>
                            <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">
                              Layanan yang diminta
                            </p>
                            <p className="mt-1 break-words text-sm font-bold text-[#151515]">
                              {request.serviceLabelSnapshot || 'Layanan belum ditentukan'}
                              {request.serviceOptionName ? ' · ' + request.serviceOptionName : ''}
                            </p>
                            {request.pricingVersion ? (
                              <p className="mt-0.5 font-mono text-[10px] text-[#8B857B]">
                                Katalog publik v{request.pricingVersion}
                              </p>
                            ) : null}
                          </div>

                          {request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING ? (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#151515]/[0.07] bg-[#FAF8F1] p-3">
                              <RequestField
                                label="Tanggal pilihan"
                                value={
                                  request.preferredDate
                                    ? formatIndonesianDateMedium(request.preferredDate)
                                    : 'Belum ditentukan'
                                }
                                emphasize
                              />
                              <RequestField
                                label="Waktu mulai"
                                value={request.preferredTimeLabel ? request.preferredTimeLabel + ' WIB' : 'Belum ditentukan'}
                                emphasize
                              />
                              <RequestField
                                label="Durasi"
                                value={formatRequestDurationLabel(request.preferredDurationMinutes)}
                              />
                              <RequestField
                                label="Preferensi ruangan"
                                value={request.requestedRoomLabel}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#151515]/[0.07] bg-[#FAF8F1] p-3">
                              <RequestField label="Jenis proyek" value="Mix & Master" emphasize />
                              <RequestField
                                label="Target selesai"
                                value={
                                  request.targetDeadline
                                    ? formatIndonesianDateMedium(request.targetDeadline)
                                    : 'Belum ditentukan'
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {request.notes ? (
                        <div className="border-t border-[#151515]/[0.07] p-4 sm:px-5">
                          <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">
                            Catatan dari customer
                          </p>
                          <p className="mt-1.5 rounded-xl border-l-[3px] border-[#C8F13A] bg-[#FAF8F1] px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-[#46433D]">
                            {request.notes}
                          </p>
                        </div>
                      ) : null}
                    </section>

                    {request.status === BOOKING_REQUEST_STATUS.CONFIRMED &&
                    request.linkedBookingId &&
                    request.confirmedBookingSnapshot ? (
                      <section
                        data-testid="confirmed-booking-summary-card"
                        className="rounded-2xl border border-emerald-500/35 bg-[#E6F6EC]/80 p-4 text-xs text-[#0F6246]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold">
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                              Booking terkonfirmasi · {request.confirmedBookingSnapshot.bookingReference}
                            </span>
                          </div>
                          <Link
                            to={
                              '/admin/calendar?date=' +
                              encodeURIComponent(request.confirmedBookingSnapshot.date) +
                              '&bookingId=' +
                              encodeURIComponent(request.linkedBookingId)
                            }
                            className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#151515] px-3 py-1.5 font-semibold text-white hover:bg-[#2B2A27]"
                          >
                            <span>Lihat di Calendar</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                          </Link>
                        </div>
                        <p className="mt-2 font-medium leading-relaxed">
                          {request.confirmedBookingSnapshot.studioName} ·{' '}
                          {request.confirmedBookingSnapshot.serviceTypeName} (
                          {request.confirmedBookingSnapshot.serviceOptionName}) ·{' '}
                          {formatIndonesianDateMedium(request.confirmedBookingSnapshot.date)} ·{' '}
                          {formatMinuteRange(
                            request.confirmedBookingSnapshot.startMinute,
                            request.confirmedBookingSnapshot.endMinute,
                          )}{' '}
                          WIB ({formatDurationMinutes(request.confirmedBookingSnapshot.durationMinutes)})
                        </p>
                      </section>
                    ) : null}

                    {request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING ? (
                      <section
                        aria-labelledby="availability-context-heading"
                        className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-4 shadow-[0_2px_8px_rgba(21,21,21,0.035)] sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <RequestSectionHeading
                            icon={CalendarDays}
                            eyebrow="Calendar check"
                            title="Ketersediaan Jadwal"
                            description={
                              availabilityContext
                                ? availabilityContext.date + ' · ' + availabilityContext.requestedRangeLabel + ' WIB'
                                : 'Ringkasan jadwal ruangan untuk tanggal pilihan customer.'
                            }
                          />
                          {availabilityContext ? (
                            <AdminStatusBadge tone={availabilityTone} size="sm">
                              {availabilityContext.isLoading
                                ? 'Memeriksa'
                                : availabilityContext.error
                                  ? 'Tidak dapat diperiksa'
                                  : availabilityContext.hasAnyOpenRoom
                                    ? 'Ada room tersedia'
                                    : 'Semua room bentrok'}
                            </AdminStatusBadge>
                          ) : null}
                        </div>

                        {availabilityContext?.error ? (
                          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                            {availabilityContext.error}
                          </p>
                        ) : availabilityContext?.isLoading ? (
                          <div className="flex items-center gap-2 rounded-xl bg-[#FAF8F1] px-3 py-3 text-xs text-[#666159]">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Mengambil jadwal dari Calendar...
                          </div>
                        ) : availabilityContext?.roomResults?.length ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {availabilityContext.roomResults.map((roomRes) => (
                              <div
                                key={roomRes.studioId}
                                className="min-w-0 rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] p-3"
                              >
                                <p className="text-[11px] font-bold leading-snug text-[#151515]">
                                  {roomRes.roomLabel}
                                </p>
                                {roomRes.isOpen ? (
                                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#0F6246]">
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    Tidak ada konflik pada slot ini
                                  </p>
                                ) : (
                                  <div className="mt-1.5">
                                    <p className="text-[10px] font-bold text-[#B92B0C]">
                                      Konflik jadwal terdeteksi
                                    </p>
                                    {roomRes.conflicts?.[0] ? (
                                      <p className="mt-0.5 break-words text-[10px] leading-relaxed text-[#666159]">
                                        {roomRes.conflicts[0].customerName} · {roomRes.conflicts[0].rangeLabel}
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-[#FAF8F1] px-3 py-2.5 text-xs text-[#666159]">
                            Rincian ketersediaan belum tersedia.
                          </p>
                        )}

                        <p className="text-[10px] leading-relaxed text-[#777166]">
                          Pengecekan ini hanya konteks awal untuk membantu tim. Validasi final dan penguncian slot
                          tetap dilakukan secara atomik saat booking dibuat di Admin Calendar.
                        </p>
                      </section>
                    ) : (
                      <section className="rounded-2xl border border-dashed border-[#151515]/15 bg-white/70 p-4">
                        <div className="flex items-start gap-2.5">
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#666159]" aria-hidden="true" />
                          <div>
                            <h3 className="text-xs font-bold text-[#151515]">Proyek non-room</h3>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#666159]">
                              Mix &amp; Master ditangani sebagai inquiry post-production. Permintaan ini tidak
                              membutuhkan pengecekan slot ruangan atau konversi ke Calendar.
                            </p>
                          </div>
                        </div>
                      </section>
                    )}

                    {request.requestType === BOOKING_REQUEST_TYPES.STUDIO_BOOKING ? (
                      <>
                        <OfferComposerCard
                          key={`${request.id}:${activeOffer?.id || 'none'}:${activeOffer?.status || 'none'}:${activeOffer?.version || 0}`}
                          request={request}
                          offers={offers}
                          actorUid={actorUid}
                          actorName={actorName}
                        />
                        <section
                          aria-labelledby="offer-history-heading"
                          className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-4 shadow-[0_2px_8px_rgba(21,21,21,0.035)] sm:p-5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 id="offer-history-heading" className="text-sm font-bold text-[#151515]">
                              Riwayat Revisi Offer ({offers.length})
                            </h3>
                          </div>
                          <OfferRevisionHistoryList
                            offers={offers}
                            activeOfferId={request.activeOfferId || ''}
                          />
                        </section>
                      </>
                    ) : null}
                  </main>

                  <aside className="min-w-0 space-y-4">
                    <section
                      aria-labelledby="workflow-controls-heading"
                      className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-4 shadow-[0_2px_8px_rgba(21,21,21,0.035)] sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <RequestSectionHeading
                          icon={Clock3}
                          eyebrow="Next step"
                          title="Tindakan Workflow"
                          description="Pilih langkah penanganan request berikutnya."
                        />
                        <BookingRequestStatusBadge status={request.status} size="sm" />
                      </div>

                      {statusMeta?.description ? (
                        <p className="rounded-xl bg-[#FAF8F1] px-3 py-2.5 text-[11px] leading-relaxed text-[#666159]">
                          {statusMeta.description}
                        </p>
                      ) : null}

                      {statusError ? (
                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                          {statusError}
                        </p>
                      ) : null}

                      {request.statusReason &&
                      (request.status === BOOKING_REQUEST_STATUS.DECLINED ||
                        request.status === BOOKING_REQUEST_STATUS.CLOSED) ? (
                        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-900">
                          <strong>Alasan:</strong> {request.statusReason}
                        </p>
                      ) : null}

                      {request.status === BOOKING_REQUEST_STATUS.ACCEPTED ? (
                        <div className="flex items-start gap-2 rounded-xl border border-[#8BAD12]/40 bg-[#EDF8C2]/70 p-3 text-[11px] leading-relaxed text-[#243300]">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>
                            {provisionalOfferHoldId ? (
                              <>
                                <strong>Offer Disetujui · Slot Sudah Di-Hold (Opsi A).</strong> Slot
                                dikunci sementara oleh Deposit Hold{' '}
                                <code className="font-mono font-bold">{provisionalOfferHoldId}</code>{' '}
                                sambil menunggu verifikasi DP atau konfirmasi hold oleh Staff.
                              </>
                            ) : (
                              <>
                                <strong>Accepted belum Confirmed.</strong> Studio siap memproses
                                request, tetapi slot belum dikunci sampai booking berhasil dibuat di
                                Calendar.
                              </>
                            )}
                          </span>
                        </div>
                      ) : null}

                      {provisionalOfferHoldId ? (
                        <div
                          data-testid="provisional-offer-hold-card"
                          className="space-y-2 rounded-xl border border-amber-400/40 bg-[#FEF4DD]/70 p-3 text-[11px] leading-relaxed text-[#6A3B00]"
                        >
                          <p>
                            {hasPendingSentOffer ? (
                              <>
                                <strong>{activeOffer?.offerNumber}</strong> memakai{' '}
                                <strong>Deposit Hold Offer (Opsi A)</strong>. Hold provisional{' '}
                                <code className="font-mono font-bold">{provisionalOfferHoldId}</code>{' '}
                                dan invoice DP sudah dibuat di Calendar.
                              </>
                            ) : (
                              <>
                                Hold provisional{' '}
                                <code className="font-mono font-bold">{provisionalOfferHoldId}</code>{' '}
                                sudah aktif menunggu verifikasi pembayaran DP atau konfirmasi manual
                                di Calendar.
                              </>
                            )}
                          </p>
                          <Link
                            to={
                              '/admin/calendar?date=' +
                              encodeURIComponent(
                                activeOffer?.scheduleSnapshot?.date || request.preferredDate || '',
                              ) +
                              '&bookingId=' +
                              encodeURIComponent(provisionalOfferHoldId)
                            }
                            data-testid="open-provisional-hold-calendar-link"
                            className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#151515] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2B2A27]"
                          >
                            <CalendarCheck className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                            <span>Buka Hold &amp; Invoice di Calendar</span>
                            <ArrowUpRight className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
                          </Link>
                        </div>
                      ) : hasPendingSentOffer ? (
                        <div
                          data-testid="pending-offer-conversion-notice"
                          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900"
                        >
                          Offer aktif (<strong>{activeOffer?.offerNumber}</strong>) masih menunggu respons Client. Tarik/tandai expired Offer atau tunggu persetujuan Client sebelum membuat reservasi Calendar.
                        </div>
                      ) : canConvertToCalendarBooking ? (
                        <div className="space-y-2">
                          <Link
                            to={calendarConvertUrl}
                            data-testid="convert-to-calendar-booking-link"
                            className="sa-btn-orange inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold tracking-wide uppercase shadow-sm"
                          >
                            <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                            <span>
                              {acceptedOffer
                                ? `Buat Reservasi (${acceptedOffer.offerNumber})`
                                : 'Lanjutkan di Calendar'}
                            </span>
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <p className="text-[10px] leading-relaxed text-[#777166]">
                            {acceptedOffer
                              ? 'Jadwal & harga dari Accepted Offer akan diisi otomatis untuk membuat Deposit Hold atau Confirmed Reservation.'
                              : 'Booking baru akan dibuat melalui form Calendar. Slot baru terkunci setelah proses pembuatan booking berhasil.'}
                          </p>
                        </div>
                      ) : request.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY ? (
                        <p className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3 py-2.5 text-[11px] leading-relaxed text-[#46433D]">
                          Inquiry Mix &amp; Master dikelola melalui status workflow dan WhatsApp tanpa membuat
                          jadwal ruangan di Calendar.
                        </p>
                      ) : request.status === BOOKING_REQUEST_STATUS.CONFIRMED ? (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900">
                          Booking telah dibuat dan status request dikonfirmasi melalui proses booking kanonik.
                        </p>
                      ) : null}

                      {allowedManualTargets.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[9px] font-bold tracking-[0.12em] text-[#8B857B] uppercase">
                            Ubah status request
                          </p>
                          <div className="grid grid-cols-2 gap-2">
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
                                  className="min-h-11 w-full justify-center text-[10px]"
                                >
                                  {btnMeta.label}
                                </AdminButton>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#666159]">
                          Status ini sudah final. Tidak ada perubahan status manual yang tersedia.
                        </p>
                      )}

                      {pendingReasonTarget ? (
                        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/70 p-3">
                          <label
                            htmlFor="status-reason-input"
                            className="block text-xs font-semibold text-red-900"
                          >
                            Alasan {pendingReasonTarget === BOOKING_REQUEST_STATUS.DECLINED ? 'penolakan' : 'penutupan'} (wajib)
                          </label>
                          <input
                            id="status-reason-input"
                            type="text"
                            maxLength={400}
                            value={reasonInput}
                            onChange={(event) => setReasonInput(event.target.value)}
                            placeholder="Mis. Jadwal penuh atau customer membatalkan..."
                            className="sa-input min-h-11 w-full rounded-xl bg-white px-3 py-2 text-xs"
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <AdminButton
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setPendingReasonTarget('');
                                setReasonInput('');
                                setStatusError('');
                              }}
                              className="min-h-10"
                            >
                              Batal
                            </AdminButton>
                            <AdminButton
                              variant="danger"
                              size="sm"
                              disabled={isUpdatingStatus || reasonInput.trim().length < 3}
                              onClick={() => executeStatusTransition(pendingReasonTarget, reasonInput.trim())}
                              className="min-h-10"
                            >
                              {isUpdatingStatus ? 'Menyimpan...' : 'Konfirmasi'}
                            </AdminButton>
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <WhatsAppMessageComposer
                      request={request}
                      actorUid={actorUid}
                      alternativeSlots={availabilityContext?.alternativeSlots || []}
                    />
                  </aside>

                  <section className="min-w-0 lg:col-span-2">
                    <BookingRequestActivityTimeline
                      activities={activities}
                      communications={communications}
                    />
                  </section>
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
