import { ChevronRight } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';

/**
 * Calm responsive mobile card for a single completed session in Commission Review (<768px).
 */
export function CommissionReviewCard({ item, isSelected = false, onToggleSelect, onOpenDetail }) {
  const isPosted = item.status === COMMISSION_ITEM_STATUS.POSTED;
  const isSelectable = item.selectable;
  const completedLabel = formatIndonesianTimestamp(item.booking.actualCompletedAt);

  return (
    <article
      className={`border-b border-[#151515]/[0.07] p-3 transition-colors last:border-b-0 ${isPosted
        ? 'bg-[#FAF8F3]/60'
        : isSelected
          ? 'bg-[#EDF8C2]/45'
          : 'bg-white hover:bg-[#FAF8F3]/60'
        }`}
    >
      {/* Row 1: Checkbox + Booking ID + Status Badge */}
      <div className="flex items-start justify-between gap-2.5">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelectable}
            onChange={() => isSelectable && onToggleSelect?.(item.bookingId)}
            aria-label={`Pilih booking ${item.bookingId} (${item.booking.customerName})`}
            className="accent-studio-ink mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40"
          />
          <div className="min-w-0">
            <p className="block truncate font-mono text-[10.5px] font-medium text-[#666159]">
              {item.bookingId}
            </p>
            <p className="text-sm leading-snug font-semibold break-words text-[#151515]">
              {item.booking.customerName}
              {item.booking.bandName ? ` • ${item.booking.bandName}` : ''}
            </p>
          </div>
        </label>

        <AdminStatusBadge tone={isPosted ? 'lime' : 'amber'} size="sm" className="shrink-0">
          {isPosted ? 'Posted' : 'Pending'}
        </AdminStatusBadge>
      </div>

      {/* Row 2: Completed At & Service Details */}
      <div className="mt-2 space-y-0.5 text-xs text-[#666159]">
        <p className="break-words">
          Selesai: <strong className="font-medium text-[#151515]">{completedLabel}</strong>
        </p>
        <p className="break-words">
          {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName} (
          {formatDurationMinutes(item.booking.durationMinutes)})
        </p>
      </div>

      {/* Row 3: Distinct Staff vs Operator Payables */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <div className="sa-panel-ivory min-w-0 px-2.5 py-2">
          <span className="block text-[10.5px] font-medium text-[#666159]">Staff Fee</span>
          <span className="block font-mono font-bold break-words text-[#151515] tabular-nums">
            {formatRupiah(item.staffPayableAmount)}
          </span>
        </div>
        <div className="sa-panel-ivory min-w-0 px-2.5 py-2">
          <span className="block text-[10.5px] font-medium text-[#666159]">Operator Fee</span>
          <span className="block font-mono font-bold break-words text-[#151515] tabular-nums">
            {formatRupiah(item.recordingOperatorPayableAmount)}
          </span>
        </div>
      </div>

      {/* Row 4: Total Payable + Owner Allocation Reference + Detail Button */}
      <div className="mt-2.5 flex items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1 text-xs break-words">
          <span className="text-[#666159]">Bayar: </span>
          <span className="font-mono font-bold text-[#151515] tabular-nums">
            {formatRupiah(item.payableTotal)}
          </span>
          {item.ownerAllocationReference > 0 ? (
            <span className="block font-mono text-[10.5px] break-words text-[#8B857B]">
              Owner Ref: {formatRupiah(item.ownerAllocationReference)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail?.(item)}
          className="sa-control sa-btn-secondary inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 px-3 py-1.5 text-xs font-semibold"
        >
          <span>Detail</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
