import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  Music2,
} from 'lucide-react';

import {
  formatDurationMinutes,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateFull,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

function buildClientWhatsAppHref({ whatsappNumber, studioName, referenceCode, serviceTitle }) {
  const digits = String(whatsappNumber || '').replace(/\D/g, '');
  if (!digits) return '';
  const name = studioName || '37 Music Studio';
  const refPart = referenceCode ? ` (${referenceCode})` : '';
  const text = `Halo ${name}, saya ingin menanyakan booking saya untuk ${serviceTitle}${refPart}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Customer-safe Spatial Ambient card displaying one booking or inquiry belonging to
 * the authenticated Client Portal user. Never exposes internal UIDs or commission data.
 */
export function ClientBookingCard({ record, whatsappNumber = '', studioName = '37 Music Studio' }) {
  const [showDetails, setShowDetails] = useState(false);

  const view = record?._view || {};
  const schedule = view.schedule || {};
  const statusMeta = view.statusMeta || { label: 'Pending Review', tone: 'orange', helperText: '' };

  const serviceTitle = schedule.serviceOptionName
    ? `${schedule.serviceTypeName || record.serviceLabelSnapshot} · ${schedule.serviceOptionName}`
    : schedule.serviceTypeName || record.serviceLabelSnapshot || 'Studio Session';

  const referenceCode = schedule.bookingReference || record.requestReference;
  const whatsappHref = useMemo(
    () =>
      buildClientWhatsAppHref({
        whatsappNumber,
        studioName,
        referenceCode,
        serviceTitle,
      }),
    [referenceCode, serviceTitle, studioName, whatsappNumber],
  );

  const submittedLabel = formatIndonesianTimestamp(record.createdAt);
  const confirmedLabel = formatIndonesianTimestamp(record.confirmedAt);

  return (
    <article
      data-testid={`client-booking-card-${record.id}`}
      className="rounded-2xl border border-[#151515]/10 bg-white/95 p-4 shadow-[0_1px_2px_rgba(21,21,21,0.03),0_8px_20px_-10px_rgba(21,21,21,0.08)] transition-colors hover:border-[#151515]/18 sm:p-5"
    >
      {/* Top Row: Service heading + Status badge + Customer reference */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={statusMeta.tone} dot>
              {statusMeta.label}
            </AdminStatusBadge>
            {view.isToday ? (
              <AdminStatusBadge tone="lime" size="sm">
                Today
              </AdminStatusBadge>
            ) : null}
          </div>

          <h4 className="text-sm font-bold tracking-tight text-[#151515] sm:text-base">
            {serviceTitle}
          </h4>

          {record.bandName ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#46433D]">
              <Music2 className="h-3.5 w-3.5 shrink-0 text-[#8B857B]" aria-hidden="true" />
              <span>{record.bandName}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {schedule.bookingReference ? (
            <span className="rounded-lg bg-[#151515] px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide text-[#C8F13A]">
              {schedule.bookingReference}
            </span>
          ) : null}
          {record.requestReference ? (
            <span className="rounded-lg border border-[#151515]/12 bg-[#FAF8F1] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#46433D]">
              {record.requestReference}
            </span>
          ) : null}
        </div>
      </div>

      {/* Middle Schedule Summary */}
      {schedule.isPostProduction ? (
        <div className="sa-panel-ivory mt-3.5 grid grid-cols-1 gap-2.5 rounded-xl p-3 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#666159] uppercase">
                Service Type
              </p>
              <p className="text-xs font-semibold text-[#151515] sm:text-[13px]">
                Post-Production Inquiry (Remote)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#666159] uppercase">
                Target Timeline
              </p>
              <p className="text-xs font-semibold text-[#151515] sm:text-[13px]">
                {schedule.targetDeadline
                  ? formatIndonesianDateFull(schedule.targetDeadline)
                  : 'Flexible deadline'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="sa-panel-ivory mt-3.5 grid grid-cols-1 gap-2.5 rounded-xl p-3 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#666159] uppercase">
                {schedule.isConfirmedSnapshot ? 'Session Date' : 'Preferred Date'}
              </p>
              <p className="text-xs font-semibold text-[#151515] sm:text-[13px]">
                {schedule.date ? formatIndonesianDateFull(schedule.date) : 'Date pending'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#666159] uppercase">
                Time &amp; Duration
              </p>
              <p className="font-mono text-xs font-semibold text-[#151515] sm:text-[13px]">
                {schedule.startMinute !== null && schedule.endMinute !== null
                  ? formatMinuteRange(schedule.startMinute, schedule.endMinute)
                  : 'Schedule pending'}
              </p>
              {schedule.durationMinutes ? (
                <p className="text-[11px] text-[#666159]">
                  {formatDurationMinutes(schedule.durationMinutes)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[#666159] uppercase">
                Studio Room
              </p>
              <p className="text-xs font-semibold text-[#151515] sm:text-[13px]">
                {schedule.studioName || 'No preference / Studio recommends'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status note + Expandable Details / WhatsApp Action */}
      <div className="mt-3 flex flex-col gap-2.5 border-t border-[#151515]/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-[#666159]">{statusMeta.helperText}</p>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="sa-btn-secondary inline-flex min-h-8 items-center gap-1.5 px-3 py-1 text-xs font-semibold"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#0F6246]" aria-hidden="true" />
              <span>WhatsApp Studio</span>
            </a>
          ) : null}

          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-xl border border-[#151515]/12 bg-[#FAF8F1] px-3 py-1 text-xs font-semibold text-[#151515] hover:bg-[#F1EEE4]"
          >
            <span>{showDetails ? 'Hide Details' : 'Details'}</span>
            {showDetails ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {showDetails ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] p-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[10px] font-semibold text-[#666159] uppercase">
              Contact Phone
            </dt>
            <dd className="mt-0.5 font-mono font-medium text-[#151515]">
              {record.contactPhoneDisplay || record.contactPhone || '—'}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] font-semibold text-[#666159] uppercase">
              Submitted On
            </dt>
            <dd className="mt-0.5 font-medium text-[#151515]">
              {submittedLabel !== '-' ? submittedLabel : '—'}
            </dd>
          </div>
          {confirmedLabel !== '-' ? (
            <div>
              <dt className="font-mono text-[10px] font-semibold text-[#666159] uppercase">
                Confirmed On
              </dt>
              <dd className="mt-0.5 font-medium text-[#151515]">{confirmedLabel}</dd>
            </div>
          ) : null}
          {record.notes ? (
            <div className="sm:col-span-2">
              <dt className="font-mono text-[10px] font-semibold text-[#666159] uppercase">
                Notes
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[#46433D]">{record.notes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}
