import { ArrowUpRight, CalendarDays, ReceiptText } from 'lucide-react';

import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  formatClientInvoiceServiceTitle,
  formatClientRupiah,
  getClientInvoiceStatusDisplay,
} from '../utils/client-billing-utils';

/**
 * Mobile-first Spatial Ambient invoice card (`< lg` screens).
 * Keeps Invoice Number, Service, Total, Balance Due, Payment Status, and View Details
 * immediately scannable with zero horizontal overflow at 320px+.
 */
export function ClientInvoiceCard({ invoice, referenceDateIso, onSelect }) {
  const statusDisplay = getClientInvoiceStatusDisplay(invoice, referenceDateIso);
  const serviceTitle = formatClientInvoiceServiceTitle(invoice.bookingSnapshot);
  const bookingDateLabel = invoice.bookingSnapshot?.bookingDate
    ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
    : '—';
  const invoiceDateLabel = formatIndonesianTimestamp(invoice.invoiceDate || invoice.createdAt);

  return (
    <article
      data-testid={`client-invoice-card-${invoice.id}`}
      className="rounded-2xl border border-[#151515]/10 bg-white/95 p-4 shadow-[0_1px_2px_rgba(21,21,21,0.03),0_8px_20px_-10px_rgba(21,21,21,0.08)] transition-colors hover:border-[#151515]/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
            <span className="truncate font-mono text-xs font-bold tracking-tight text-[#151515]">
              {invoice.invoiceNumber}
            </span>
          </div>
          <h4 className="mt-1 text-sm font-bold text-[#151515]">{serviceTitle}</h4>
        </div>

        <AdminStatusBadge tone={statusDisplay.tone} dot={!statusDisplay.isCancelled}>
          {statusDisplay.label}
        </AdminStatusBadge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#666159]">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>Session: {bookingDateLabel}</span>
        </span>
        {invoiceDateLabel && invoiceDateLabel !== '-' ? (
          <span>Issued: {invoiceDateLabel}</span>
        ) : null}
      </div>

      <dl className="sa-panel-ivory mt-3 grid grid-cols-2 gap-2.5 rounded-xl p-3 text-xs">
        <div>
          <dt className="text-[10.5px] font-medium text-[#666159]">Total</dt>
          <dd className="mt-0.5 font-mono text-xs font-semibold text-[#151515] tabular-nums sm:text-[13px]">
            {formatClientRupiah(invoice.financialSnapshot?.totalAmount)}
          </dd>
        </div>

        <div className="text-right">
          <dt className="text-[10.5px] font-medium text-[#666159]">Balance Due</dt>
          <dd
            className={`mt-0.5 font-mono text-xs font-bold tabular-nums sm:text-[13px] ${
              !statusDisplay.isCancelled && invoice.balanceDue > 0
                ? 'text-[#B92B0C]'
                : 'text-[#151515]'
            }`}
          >
            {statusDisplay.isCancelled ? formatClientRupiah(0) : formatClientRupiah(invoice.balanceDue)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span className="font-mono text-[11px] text-[#666159] tabular-nums">
          Paid: {formatClientRupiah(invoice.amountPaid)}
        </span>

        <button
          type="button"
          onClick={() => onSelect?.(invoice)}
          aria-label={`View details for invoice ${invoice.invoiceNumber}`}
          className="sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
        >
          <span>View Details</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
