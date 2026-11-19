import { ChevronRight } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';

/**
 * Compact responsive mobile card for a single completed session in Commission Review (<768px).
 */
export function CommissionReviewCard({ item, isSelected = false, onToggleSelect, onOpenDetail }) {
  const isPosted = item.status === COMMISSION_ITEM_STATUS.POSTED;
  const isSelectable = item.selectable;
  const completedLabel = formatIndonesianTimestamp(item.booking.actualCompletedAt);

  return (
    <article
      className={`border-b border-neutral-200 p-2.5 transition-colors last:border-b-0 ${
        isPosted
          ? 'bg-neutral-50'
          : isSelected
            ? 'bg-studio-lime/25'
            : 'bg-studio-white hover:bg-studio-ivory/40'
      }`}
    >
      {/* Row 1: Checkbox + Booking ID + Status Badge */}
      <div className="flex items-start justify-between gap-2">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!isSelectable}
            onChange={() => isSelectable && onToggleSelect?.(item.bookingId)}
            aria-label={`Pilih booking ${item.bookingId} (${item.booking.customerName})`}
            className="accent-studio-ink mt-0.5 h-5 w-5 shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          />
          <div className="min-w-0">
            <p className="text-studio-ink truncate font-mono text-[10px] font-extrabold">
              {item.bookingId}
            </p>
            <p className="text-studio-ink truncate text-sm leading-snug font-extrabold">
              {item.booking.customerName}
              {item.booking.bandName ? ` • ${item.booking.bandName}` : ''}
            </p>
          </div>
        </label>

        <span
          className={`border-studio-ink shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${
            isPosted ? 'bg-studio-lime text-studio-ink' : 'text-studio-ink bg-amber-200'
          }`}
        >
          {isPosted ? 'Posted' : 'Pending'}
        </span>
      </div>

      {/* Row 2: Completed At & Service Details */}
      <div className="text-studio-muted-ink mt-1.5 pl-7 font-mono text-[10px] font-semibold">
        <p className="truncate">
          Selesai: <strong className="text-studio-ink">{completedLabel}</strong>
        </p>
        <p className="truncate">
          {item.serviceInfo.serviceTypeName} • {item.serviceInfo.serviceOptionName} (
          {formatDurationMinutes(item.booking.durationMinutes)})
        </p>
      </div>

      {/* Row 3: Distinct Staff vs Operator Payables + Owner Reference */}
      <div className="mt-2 ml-7 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
        <div className="border-studio-ink bg-studio-ivory border px-2 py-1">
          <span className="text-studio-muted-ink block text-[8.5px] font-bold uppercase">
            Staff Fee
          </span>
          <span className="text-studio-ink font-black tabular-nums">
            {formatRupiah(item.staffPayableAmount)}
          </span>
        </div>
        <div className="border-studio-ink bg-studio-ivory border px-2 py-1">
          <span className="text-studio-muted-ink block text-[8.5px] font-bold uppercase">
            Operator Fee
          </span>
          <span className="text-studio-ink font-black tabular-nums">
            {formatRupiah(item.recordingOperatorPayableAmount)}
          </span>
        </div>
      </div>

      {/* Row 4: Total Payable + Owner Allocation Reference + Detail Button */}
      <div className="mt-2 ml-7 flex items-center justify-between gap-2">
        <div className="min-w-0 font-mono text-[10px]">
          <span className="text-studio-muted-ink font-bold uppercase">Bayar: </span>
          <span className="text-studio-ink font-black tabular-nums">
            {formatRupiah(item.payableTotal)}
          </span>
          {item.ownerAllocationReference > 0 ? (
            <span className="text-studio-subtle-ink block truncate text-[9px] font-semibold">
              Owner Ref: {formatRupiah(item.ownerAllocationReference)}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail?.(item)}
          className="cal-control border-studio-ink bg-studio-ink text-studio-white hover:bg-studio-lime hover:text-studio-ink inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-0.5 px-2.5 py-1 font-mono text-[9.5px] font-extrabold uppercase"
        >
          <span>Detail</span>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
