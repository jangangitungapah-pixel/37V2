import { CalendarDays, Clock, MessageSquare, Phone, UserCheck } from 'lucide-react';

import { formatSettingsTimestamp } from '@/features/admin/settings/utils/settings-formatters';

import { BOOKING_REQUEST_STATUS, BOOKING_REQUEST_TYPES } from '../config/booking-request-config';
import { formatRequestDurationLabel } from '../utils/booking-request-normalize';
import {
  BookingRequestSourceBadge,
  BookingRequestStatusBadge,
  BookingRequestTypeBadge,
} from './BookingRequestStatusBadge';

export function BookingRequestListItem({ request, isSelected = false, onSelect }) {
  const isNew = request.status === BOOKING_REQUEST_STATUS.NEW;
  const isPostProd = request.requestType === BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY;

  return (
    <button
      type="button"
      onClick={() => onSelect(request.id)}
      data-testid={`booking-request-row-${request.id}`}
      className={`w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:p-4 ${
        isSelected
          ? 'border-[#151515] bg-[#EDF8C2]/45 shadow-[0_8px_20px_-10px_rgba(21,21,21,0.22)]'
          : isNew
            ? 'border-[#FF4B22]/30 bg-white shadow-[inset_3px_0_0_#FF4B22,0_1px_2px_rgba(21,21,21,0.035)] hover:border-[#151515]/30'
            : 'border-[#151515]/10 bg-white/90 hover:border-[#151515]/25 hover:bg-white'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {isNew ? (
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#FF4B22]"
                aria-label="Unread new request"
              />
            ) : null}
            <span className="rounded-md bg-[#151515] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#F1EEE4]">
              {request.requestReference}
            </span>
            <BookingRequestStatusBadge status={request.status} size="sm" />
            <BookingRequestTypeBadge requestType={request.requestType} size="sm" />
            <BookingRequestSourceBadge source={request.source} size="sm" />
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">
              {request.customerName}
            </h3>
            {request.bandName ? (
              <span className="text-xs font-medium text-[#666159]">• {request.bandName}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#46433D]">
            <span className="inline-flex items-center gap-1 font-mono">
              <Phone className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
              <span>{request.contactPhoneDisplay || request.contactPhone}</span>
            </span>

            <span className="font-semibold text-[#151515]">
              {request.serviceLabelSnapshot}
              {request.serviceOptionName ? ` · ${request.serviceOptionName}` : ''}
            </span>

            {!isPostProd ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                <span>
                  {request.requestedRoomLabel} • {request.preferredDate || '-'} •{' '}
                  {request.preferredTimeLabel || '-'} WIB (
                  {formatRequestDurationLabel(request.preferredDurationMinutes)})
                </span>
              </span>
            ) : (
              <span>
                {request.targetDeadline
                  ? `Target deadline: ${request.targetDeadline}`
                  : 'Post-production inquiry (non-room)'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-[11px] text-[#666159] sm:flex-col sm:items-end">
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>
              {request.createdAtIso ? formatSettingsTimestamp(request.createdAtIso) : 'Baru masuk'}
            </span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {request.assignedStaffName || request.assignedStaffUid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F1E8] px-2 py-0.5 font-medium text-[#151515]">
                <UserCheck className="h-3 w-3" aria-hidden="true" />
                <span>{request.assignedStaffName || 'Staff'}</span>
              </span>
            ) : null}

            {request.lastCommunicationStatus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EDF8C2] px-2 py-0.5 font-medium text-[#243300]">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                <span>
                  {request.lastCommunicationStatus === 'manually_marked_sent'
                    ? 'WA Marked Sent'
                    : request.lastCommunicationStatus === 'prepared_in_whatsapp'
                      ? 'WA Prepared'
                      : 'Note Logged'}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
