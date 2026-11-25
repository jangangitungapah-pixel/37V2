import {
  CalendarDays,
  Clock3,
  MessageSquare,
  Phone,
  UserRound,
} from 'lucide-react';

import { formatSettingsTimestamp } from '@/features/admin/settings/utils/settings-formatters';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';

import {
  BOOKING_REQUEST_SOURCES,
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '../config/booking-request-config';
import { formatRequestDurationLabel } from '../utils/booking-request-normalize';
import {
  BookingRequestStatusBadge,
} from './BookingRequestStatusBadge';

const REQUEST_SOURCE_LABELS = Object.freeze({
  [BOOKING_REQUEST_SOURCES.PUBLIC_LANDING_PAGE]: 'Website',
  [BOOKING_REQUEST_SOURCES.PUBLIC_AVAILABILITY_CALENDAR]: 'Kalender Publik',
  [BOOKING_REQUEST_SOURCES.CLIENT_PORTAL]: 'Client Portal',
});

function formatRequestAge(value) {
  if (!value) {
    return { label: 'Baru masuk', title: 'Waktu penerimaan belum tersedia' };
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return { label: 'Baru masuk', title: 'Waktu penerimaan tidak valid' };
  }

  const elapsed = Date.now() - timestamp;
  const absoluteDate = formatSettingsTimestamp(value);

  if (elapsed < 60_000 && elapsed >= -60_000) {
    return { label: 'Baru saja', title: absoluteDate };
  }
  if (elapsed >= 0 && elapsed < 60 * 60_000) {
    return {
      label: `${Math.max(1, Math.floor(elapsed / 60_000))} mnt lalu`,
      title: absoluteDate,
    };
  }
  if (elapsed >= 0 && elapsed < 24 * 60 * 60_000) {
    return {
      label: `${Math.floor(elapsed / (60 * 60_000))} jam lalu`,
      title: absoluteDate,
    };
  }
  if (elapsed >= 0 && elapsed < 7 * 24 * 60 * 60_000) {
    return {
      label: `${Math.floor(elapsed / (24 * 60 * 60_000))} hari lalu`,
      title: absoluteDate,
    };
  }

  return { label: absoluteDate, title: absoluteDate };
}

function getCommunicationLabel(status) {
  if (status === 'manually_marked_sent') return 'WA dicatat terkirim';
  if (status === 'prepared_in_whatsapp') return 'WA siap dikirim';
  if (status === 'staff_note_added') return 'Catatan internal';
  return '';
}

function getRoomShortLabel(label = '') {
  const clean = String(label || '').trim();
  if (!clean) return 'Ruangan belum ditentukan';
  if (clean.startsWith('Room A')) return 'Room A';
  if (clean.startsWith('Room B')) return 'Room B';
  if (clean.toLowerCase().startsWith('no preference')) return 'Bebas';
  return clean;
}

export function BookingRequestListItem({ request, isSelected = false, onSelect }) {
  const isNew = request.status === BOOKING_REQUEST_STATUS.NEW;
  const isPostProd = request.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY;
  const requestAge = formatRequestAge(request.createdAtIso);
  const sourceLabel = REQUEST_SOURCE_LABELS[request.source] || 'Sumber lain';
  const communicationLabel = getCommunicationLabel(request.lastCommunicationStatus);
  const confirmedReference = request.confirmedBookingSnapshot?.bookingReference;
  const roomLabel = getRoomShortLabel(request.requestedRoomLabel);
  const durationLabel = formatRequestDurationLabel(request.preferredDurationMinutes);

  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      data-testid={`booking-request-row-${request.id}`}
      aria-label={`Buka request ${request.requestReference} dari ${request.customerName}`}
      className={`group w-full cursor-pointer rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_8px_22px_-16px_rgba(21,21,21,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8BAD12] sm:p-4 ${
        isSelected
          ? 'border-[#151515] bg-[#EDF8C2]/45 shadow-[0_8px_20px_-10px_rgba(21,21,21,0.22)]'
          : isNew
            ? 'border-[#FF4B22]/25 bg-white shadow-[inset_3px_0_0_#FF4B22,0_1px_2px_rgba(21,21,21,0.035)] hover:border-[#FF4B22]/45'
            : 'border-[#151515]/10 bg-white/95 hover:border-[#151515]/25 hover:bg-white'
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-[#151515] px-2 py-1 font-mono text-[9.5px] font-bold tracking-wide text-[#F1EEE4] sm:text-[10px]">
            {request.requestReference}
          </span>
          <BookingRequestStatusBadge status={request.status} size="sm" />
        </div>
        <time
          dateTime={request.createdAtIso || undefined}
          title={requestAge.title}
          className="shrink-0 font-mono text-[10px] font-medium text-[#8B857B] tabular-nums sm:text-[10.5px]"
        >
          {requestAge.label}
        </time>
      </div>

      <div className="mt-2.5 grid min-w-0 gap-2.5 sm:mt-3 sm:grid-cols-[minmax(0,1fr)_minmax(250px,0.92fr)] sm:items-stretch sm:gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold leading-tight tracking-tight text-[#151515] sm:text-base">
            {request.customerName || 'Nama customer belum tersedia'}
          </h3>
          {request.bandName ? (
            <p className="mt-0.5 truncate text-xs font-medium text-[#666159] sm:text-[13px]">
              {request.bandName}
            </p>
          ) : null}

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[#46433D] sm:text-xs">
              <Phone className="h-3 w-3 shrink-0 text-[#8B857B]" aria-hidden="true" />
              <span className="truncate font-mono">
                {request.contactPhoneDisplay || request.contactPhone || 'Nomor belum tersedia'}
              </span>
            </span>
            {request.assignedStaffName || request.assignedStaffUid ? (
              <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#666159]">
                <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{request.assignedStaffName || 'Staff'}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[#151515]/[0.07] bg-[#FAF8F1] px-3 py-2.5 sm:flex sm:flex-col sm:justify-center sm:px-3.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-xs font-bold text-[#151515] sm:text-[13px]">
              {request.serviceLabelSnapshot || (isPostProd ? 'Mix & Master' : 'Layanan belum ditentukan')}
            </span>
            {request.serviceOptionName ? (
              <span className="max-w-[44%] shrink-0 truncate rounded-full border border-[#151515]/10 bg-white px-2 py-0.5 text-[9.5px] font-medium text-[#666159]">
                {request.serviceOptionName}
              </span>
            ) : null}
          </div>

          {isPostProd ? (
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[#46433D] sm:text-xs">
              <CalendarDays className="h-3 w-3 shrink-0 text-[#8B857B]" aria-hidden="true" />
              <span className="truncate">
                {request.targetDeadline
                  ? `Target selesai · ${formatIndonesianDateMedium(request.targetDeadline)}`
                  : 'Belum ada target deadline'}
              </span>
            </div>
          ) : (
            <>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[#46433D] sm:text-xs">
                <CalendarDays className="h-3 w-3 shrink-0 text-[#8B857B]" aria-hidden="true" />
                <span className="truncate">
                  {request.preferredDate
                    ? formatIndonesianDateMedium(request.preferredDate)
                    : 'Tanggal belum ditentukan'}
                </span>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#46433D] sm:text-xs">
                <span className="inline-flex items-center gap-1 font-mono font-semibold tabular-nums">
                  <Clock3 className="h-3 w-3 text-[#8B857B]" aria-hidden="true" />
                  {request.preferredTimeLabel || '--:--'} WIB
                </span>
                {durationLabel !== '-' ? (
                  <span className="text-[#8B857B]">· {durationLabel}</span>
                ) : null}
                <span className="ml-auto max-w-[48%] truncate rounded-full border border-[#151515]/10 bg-white px-2 py-0.5 text-[9.5px] font-semibold text-[#46433D]">
                  {roomLabel}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-[#151515]/[0.07] pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-[#151515]/10 bg-white px-2 py-0.5 text-[9.5px] font-semibold text-[#666159]">
            {isPostProd ? 'Mix & Master' : 'Studio Booking'}
          </span>
          <span className="rounded-full border border-[#151515]/10 bg-white px-2 py-0.5 text-[9.5px] font-medium text-[#666159]">
            {sourceLabel}
          </span>
          {communicationLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#8BAD12]/20 bg-[#EDF8C2]/65 px-2 py-0.5 text-[9.5px] font-medium text-[#344D0A]">
              <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />
              {communicationLabel}
            </span>
          ) : null}
        </div>

        {request.status === BOOKING_REQUEST_STATUS.ACCEPTED && !request.linkedBookingId ? (
          <span className="text-[9.5px] font-semibold text-[#8A4B08]">
            Slot belum dikunci
          </span>
        ) : request.status === BOOKING_REQUEST_STATUS.CONFIRMED && confirmedReference ? (
          <span className="font-mono text-[9.5px] font-semibold text-[#0F6246]">
            {confirmedReference}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-[#8B857B] transition-colors group-hover:text-[#151515]">
            Buka detail <span aria-hidden="true">→</span>
          </span>
        )}
      </div>
    </button>
  );
}
