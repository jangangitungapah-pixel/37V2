import { CalendarClock, ExternalLink, FileText, GitCommitHorizontal } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge } from '@/features/admin/design-system';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

import { OFFER_MODES, OFFER_STATUS_META } from '../schemas/offer-schema';

export function OfferRevisionHistoryList({ offers = [], activeOfferId = '' }) {
  if (!offers || offers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#151515]/15 bg-[#FAF8F1] px-3.5 py-4 text-xs text-[#666159]">
        Belum ada Offer penawaran yang dikirim untuk permintaan ini.
      </div>
    );
  }

  return (
    <ol data-testid="offer-revision-history" className="space-y-2.5">
      {offers.map((offer) => {
        const statusMeta = OFFER_STATUS_META[offer.status] || {
          indoLabel: offer.status,
          tone: 'neutral',
        };
        const isCurrentActive = offer.id === activeOfferId;
        const schedule = offer.scheduleSnapshot || {};
        const service = offer.serviceSnapshot || {};
        const fin = offer.financialSnapshot || {};
        const dp = offer.depositPolicySnapshot || {};
        const minDp = Number(dp.minimumDepositAmount) || 0;

        return (
          <li
            key={offer.id}
            data-testid={`offer-revision-item-${offer.offerNumber}`}
            className={`rounded-2xl border p-3.5 transition-colors ${
              isCurrentActive
                ? 'border-[#151515]/20 bg-white shadow-xs'
                : 'border-[#151515]/[0.08] bg-[#FAF8F1]/80'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#151515] px-2 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                  <GitCommitHorizontal className="h-3 w-3" aria-hidden="true" />
                  {offer.offerNumber}
                </span>
                <AdminStatusBadge tone={statusMeta.tone} size="sm">
                  {statusMeta.indoLabel}
                </AdminStatusBadge>
                <AdminStatusBadge tone="ivory" size="sm">
                  {offer.offerMode === OFFER_MODES.DEPOSIT_HOLD_OFFER
                    ? 'Deposit Hold Offer'
                    : 'Quote Only'}
                </AdminStatusBadge>
                {isCurrentActive ? (
                  <AdminStatusBadge tone="lime" size="sm">
                    Aktif Terakhir
                  </AdminStatusBadge>
                ) : null}
              </div>

              <span className="font-mono text-xs font-bold text-[#151515] tabular-nums">
                {formatRupiah(fin.totalAmount || 0)}
              </span>
            </div>

            <div className="mt-2 grid gap-1.5 text-[11px] text-[#46433D] sm:grid-cols-2">
              <p className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-[#8B857B]" aria-hidden="true" />
                <span>
                  {schedule.date ? formatIndonesianDateMedium(schedule.date) : '-'} ·{' '}
                  {formatMinuteRange(schedule.startMinute, schedule.endMinute)} ·{' '}
                  {schedule.studioName || (schedule.studioId === 'room-b' ? 'Room B' : 'Room A')}
                </span>
              </p>
              <p className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#8B857B]" aria-hidden="true" />
                <span>
                  {service.serviceTypeName || '-'}
                  {service.serviceOptionName ? ` · ${service.serviceOptionName}` : ''}
                </span>
              </p>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[#666159]">
              <span>
                Minimum DP:{' '}
                <strong className="font-semibold text-[#151515]">
                  {minDp > 0 ? formatRupiah(minDp) : 'Tanpa DP'}
                </strong>
              </span>
              {offer.holdDeadline ? (
                <span>Batas Hold: {formatIndonesianTimestamp(offer.holdDeadline)}</span>
              ) : null}
              {offer.offerExpiresAt ? (
                <span>Berlaku s/d {formatIndonesianTimestamp(offer.offerExpiresAt)}</span>
              ) : null}
              {offer.provisionalBookingId ? (
                <Link
                  to={
                    '/admin/calendar?date=' +
                    encodeURIComponent(schedule.date || '') +
                    '&bookingId=' +
                    encodeURIComponent(offer.provisionalBookingId)
                  }
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[#0F6246] underline decoration-[#0F6246]/40 hover:text-[#151515]"
                >
                  <span>Hold: {offer.provisionalBookingId}</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : null}
              {offer.supersededByOfferId ? (
                <span className="text-[#8B857B]">Digantikan oleh revisi baru</span>
              ) : null}
            </div>

            {offer.staffNoteToClient ? (
              <p className="mt-2 rounded-lg bg-[#F4F1E8] px-2.5 py-1.5 text-[11px] leading-relaxed text-[#46433D]">
                Catatan ke Client: &ldquo;{offer.staffNoteToClient}&rdquo;
              </p>
            ) : null}

            {offer.responseReason ? (
              <p className="mt-1.5 rounded-lg border border-red-200/70 bg-red-50/70 px-2.5 py-1.5 text-[11px] text-red-900">
                Catatan respons Client: {offer.responseReason}
              </p>
            ) : null}

            {offer.withdrawalOrExpiryReason ? (
              <p className="mt-1.5 text-[10.5px] text-[#777166]">
                Keterangan penutupan: {offer.withdrawalOrExpiryReason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
