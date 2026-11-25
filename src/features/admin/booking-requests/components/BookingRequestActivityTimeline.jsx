import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  History,
  MessageSquare,
  StickyNote,
} from 'lucide-react';

import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { formatSettingsTimestamp } from '@/features/admin/settings/utils/settings-formatters';

import {
  BOOKING_REQUEST_COMMUNICATION_TYPES,
  BOOKING_REQUEST_STATUS_META,
} from '../config/booking-request-config';

const INITIAL_VISIBLE_EVENTS = 5;
const MESSAGE_PREVIEW_LIMIT = 220;

function formatRelativeEventTime(timestampMs, timestampIso) {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return { label: 'Waktu tidak tersedia', absolute: 'Waktu tidak tersedia' };
  }

  const absolute = timestampIso ? formatSettingsTimestamp(timestampIso) : formatSettingsTimestamp(timestampMs);
  const elapsed = Date.now() - timestampMs;

  if (elapsed < 60_000 && elapsed >= -60_000) return { label: 'Baru saja', absolute };
  if (elapsed >= 0 && elapsed < 60 * 60_000) {
    return { label: `${Math.max(1, Math.floor(elapsed / 60_000))} menit lalu`, absolute };
  }
  if (elapsed >= 0 && elapsed < 24 * 60 * 60_000) {
    return { label: `${Math.floor(elapsed / (60 * 60_000))} jam lalu`, absolute };
  }
  if (elapsed >= 0 && elapsed < 7 * 24 * 60 * 60_000) {
    return { label: `${Math.floor(elapsed / (24 * 60 * 60_000))} hari lalu`, absolute };
  }

  return { label: absolute, absolute };
}

function getStatusLabel(status) {
  return BOOKING_REQUEST_STATUS_META[status]?.shortLabel || status || '—';
}

export function BookingRequestActivityTimeline({ activities = [], communications = [] }) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState([]);

  const mergedEvents = useMemo(() => {
    const items = [];

    for (const act of activities || []) {
      const isConfirmed = act.eventType === 'booking_confirmed';
      const isAssigned = act.eventType === 'staff_assigned';
      const isStatusChanged = act.eventType === 'status_changed';

      items.push({
        id: `act-${act.id}`,
        kind: 'activity',
        category: isConfirmed ? 'BOOKING' : isAssigned ? 'ASSIGNMENT' : 'STATUS',
        timestampMs: getTimestampMillis(act.createdAt),
        timestampIso: act.createdAtIso,
        title: isConfirmed
          ? 'Booking dikonfirmasi'
          : isAssigned
            ? 'Penanggung jawab diperbarui'
            : isStatusChanged && (act.fromStatus || act.toStatus)
              ? `${getStatusLabel(act.fromStatus)} → ${getStatusLabel(act.toStatus)}`
              : 'Aktivitas request',
        note: act.note,
        actor: act.actorName || 'Tim Studio',
        eventType: act.eventType,
      });
    }

    for (const comm of communications || []) {
      let title = 'Komunikasi WhatsApp';
      let category = 'WHATSAPP';

      if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED) {
        title = `Disiapkan di WhatsApp · ${comm.templateLabel || 'Template'}`;
      } else if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT) {
        title = `Ditandai terkirim · ${comm.templateLabel || 'Template'}`;
      } else if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED) {
        title = 'Catatan internal staff';
        category = 'INTERNAL';
      }

      items.push({
        id: `comm-${comm.id}`,
        kind: 'communication',
        category,
        timestampMs: getTimestampMillis(comm.createdAt),
        timestampIso: comm.createdAtIso,
        title,
        note: comm.messageBodySnapshot,
        actor: 'Tim Studio',
        eventType: comm.eventType,
      });
    }

    return items.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [activities, communications]);

  const visibleEvents = showAllEvents
    ? mergedEvents
    : mergedEvents.slice(0, INITIAL_VISIBLE_EVENTS);

  const toggleMessage = (eventId) => {
    setExpandedMessageIds((previous) =>
      previous.includes(eventId)
        ? previous.filter((id) => id !== eventId)
        : [...previous, eventId],
    );
  };

  return (
    <section
      aria-labelledby="request-timeline-heading"
      className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-3.5 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.08] pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
          <div className="min-w-0">
            <h4 id="request-timeline-heading" className="text-sm font-bold text-[#151515]">
              Aktivitas &amp; Komunikasi
            </h4>
            <p className="text-[10px] text-[#8B857B]">{mergedEvents.length} peristiwa · terbaru di atas</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#FAF8F1] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#666159] tabular-nums">
          {mergedEvents.length}
        </span>
      </div>

      {mergedEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#151515]/15 bg-[#FAF8F1] px-3 py-4 text-center">
          <MessageSquare className="mx-auto h-5 w-5 text-[#A29B8E]" aria-hidden="true" />
          <p className="mt-1.5 text-xs font-semibold text-[#46433D]">Belum ada aktivitas</p>
          <p className="mt-0.5 text-[10.5px] text-[#8B857B]">
            Perubahan status, pesan WhatsApp, dan catatan tim akan muncul di sini.
          </p>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {visibleEvents.map((event) => {
              const isPrepared = event.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED;
              const isMarkedSent = event.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT;
              const isInternalNote = event.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED;
              const Icon = isMarkedSent
                ? CheckCheck
                : isPrepared
                  ? ExternalLink
                  : isInternalNote
                    ? StickyNote
                    : event.kind === 'communication'
                      ? MessageSquare
                      : Activity;
              const time = formatRelativeEventTime(event.timestampMs, event.timestampIso);
              const hasLongMessage = Boolean(event.note && event.note.length > MESSAGE_PREVIEW_LIMIT);
              const isMessageExpanded = expandedMessageIds.includes(event.id);
              const message = hasLongMessage && !isMessageExpanded
                ? `${event.note.slice(0, MESSAGE_PREVIEW_LIMIT).trimEnd()}…`
                : event.note;

              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#151515]/[0.07] bg-white">
                        <Icon className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-snug text-[#151515]">{event.title}</p>
                        <span className="mt-1 inline-flex rounded-full border border-[#151515]/[0.08] bg-white px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#8B857B]">
                          {event.category}
                        </span>
                      </div>
                    </div>
                    <time
                      dateTime={event.timestampIso || undefined}
                      title={time.absolute}
                      className="shrink-0 pt-0.5 font-mono text-[9.5px] font-medium text-[#8B857B] tabular-nums"
                    >
                      {time.label}
                    </time>
                  </div>

                  {message ? (
                    <div className="mt-2 border-l-2 border-[#C8F13A] pl-2.5">
                      <p className="break-words text-[11px] leading-relaxed whitespace-pre-wrap text-[#46433D]">
                        {message}
                      </p>
                      {hasLongMessage ? (
                        <button
                          type="button"
                          aria-expanded={isMessageExpanded}
                          onClick={() => toggleMessage(event.id)}
                          className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1 text-[10px] font-semibold text-[#566F0C] hover:underline"
                        >
                          {isMessageExpanded ? 'Ringkas pesan' : 'Baca pesan lengkap'}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isMessageExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-2 text-[9.5px] font-medium text-[#8B857B]">
                    Oleh {event.actor}
                  </p>
                </li>
              );
            })}
          </ol>

          {mergedEvents.length > INITIAL_VISIBLE_EVENTS ? (
            <button
              type="button"
              aria-expanded={showAllEvents}
              onClick={() => setShowAllEvents((previous) => !previous)}
              className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#151515]/10 bg-white px-3 py-2 text-xs font-semibold text-[#46433D] transition-colors hover:bg-[#FAF8F1]"
            >
              {showAllEvents
                ? 'Tampilkan lebih sedikit'
                : `Lihat seluruh riwayat · ${mergedEvents.length}`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllEvents ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
