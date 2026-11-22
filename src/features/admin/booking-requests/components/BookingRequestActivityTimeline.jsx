import { useMemo } from 'react';
import { Activity, CheckCheck, ExternalLink, History, StickyNote } from 'lucide-react';

import { getTimestampMillis } from '@/features/admin/payment/utils/invoice-format';
import { formatSettingsTimestamp } from '@/features/admin/settings/utils/settings-formatters';

import { BOOKING_REQUEST_COMMUNICATION_TYPES } from '../config/booking-request-config';

export function BookingRequestActivityTimeline({ activities = [], communications = [] }) {
  const mergedEvents = useMemo(() => {
    const items = [];

    for (const act of activities || []) {
      items.push({
        id: `act-${act.id}`,
        kind: 'activity',
        timestampMs: getTimestampMillis(act.createdAt),
        timestampIso: act.createdAtIso,
        title:
          act.eventType === 'booking_confirmed'
            ? 'Booking Dikonfirmasi di Calendar'
            : act.eventType === 'staff_assigned'
              ? 'Penanggung Jawab Diperbarui'
              : 'Perubahan Status Request',
        note: act.note,
        actor: act.actorName || act.actorUid || 'System',
        eventType: act.eventType,
      });
    }

    for (const comm of communications || []) {
      let title = 'Komunikasi WhatsApp';
      if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED) {
        title = `Prepared in WhatsApp (${comm.templateLabel || 'Template'})`;
      } else if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT) {
        title = `Manually marked sent (${comm.templateLabel || 'Template'})`;
      } else if (comm.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED) {
        title = 'Catatan Internal Staff';
      }

      items.push({
        id: `comm-${comm.id}`,
        kind: 'communication',
        timestampMs: getTimestampMillis(comm.createdAt),
        timestampIso: comm.createdAtIso,
        title,
        note: comm.messageBodySnapshot,
        actor: comm.actorUid || 'Staff',
        eventType: comm.eventType,
      });
    }

    return items.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [activities, communications]);

  return (
    <section
      aria-labelledby="request-timeline-heading"
      className="space-y-3 rounded-2xl border border-[#151515]/10 bg-white p-4"
    >
      <div className="flex items-center gap-2 border-b border-[#151515]/[0.08] pb-2.5">
        <History className="h-4 w-4 text-[#151515]" aria-hidden="true" />
        <h4 id="request-timeline-heading" className="text-sm font-bold text-[#151515]">
          Riwayat Status &amp; Komunikasi ({mergedEvents.length})
        </h4>
      </div>

      {mergedEvents.length === 0 ? (
        <p className="text-xs text-[#666159]">
          Belum ada riwayat perubahan status atau pesan WhatsApp yang tercatat.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {mergedEvents.map((ev) => {
            const Icon =
              ev.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_MARKED_SENT
                ? CheckCheck
                : ev.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.WHATSAPP_PREPARED
                  ? ExternalLink
                  : ev.eventType === BOOKING_REQUEST_COMMUNICATION_TYPES.STAFF_NOTE_ADDED
                    ? StickyNote
                    : Activity;

            return (
              <li
                key={ev.id}
                className="rounded-xl border border-[#151515]/[0.08] bg-[#FAF8F1] p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#151515]">
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{ev.title}</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-[#666159]">
                    {ev.timestampIso ? formatSettingsTimestamp(ev.timestampIso) : 'Baru saja'}
                  </span>
                </div>
                {ev.note ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-[#46433D]">{ev.note}</p>
                ) : null}
                {ev.actor ? (
                  <p className="mt-1 font-mono text-[10px] text-[#8B857B]">Oleh: {ev.actor}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
