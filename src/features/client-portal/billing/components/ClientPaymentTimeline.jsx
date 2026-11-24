import { ArrowDownLeft, CheckCircle2, ChevronDown, Printer, ReceiptText, RotateCcw } from 'lucide-react';

import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge } from '@/features/admin/design-system';
import { TRANSACTION_TYPE } from '@/features/admin/payment/utils/invoice-status';

import { formatClientRupiah } from '../utils/client-billing-utils';

/**
 * Module D — Customer-Safe Payment History Timeline.
 *
 * Strict privacy allow-list:
 * Renders ONLY `receivedAt`, `transactionTypeLabel` (`Payment Received` / `Payment Correction`),
 * `amount`, `paymentMethodLabel` (`Cash` / `Bank Transfer` / `QRIS` / `Other`), and `referenceNumber`.
 * NEVER renders `recordedByUid`, staff UIDs, `source`, raw internal IDs, or staff `notes`.
 */
export function ClientPaymentTimeline({
  transactions = [],
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onPrintReceipt,
}) {
  if (isLoading) {
    return (
      <div data-testid="client-payment-timeline-skeleton" className="space-y-2">
        {[0, 1].map((idx) => (
          <div key={idx} className="h-16 w-full animate-pulse rounded-xl bg-[#151515]/[0.06]" />
        ))}
      </div>
    );
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return (
      <div data-testid="client-payment-empty-state">
        <AdminEmptyState
          icon={ReceiptText}
          tone="neutral"
          title="No payment records yet"
          description="Payment history will appear here once payments are recorded and verified by the studio team."
        />
      </div>
    );
  }

  return (
    <div data-testid="client-payment-timeline" className="space-y-2.5">
      <ul className="space-y-2.5">
        {transactions.map((tx) => {
          const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
          const receivedDateLabel = formatIndonesianTimestamp(tx.receivedAt);

          return (
            <li
              key={tx.id}
              data-testid={`client-payment-item-${tx.transactionType}`}
              className={`rounded-xl border p-3.5 ${
                isReversal
                  ? 'border-amber-500/25 bg-[#FEF4DD]/45'
                  : 'border-[#151515]/10 bg-[#F8F6EF]/70'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isReversal
                        ? 'bg-[#FEF4DD] text-[#8A4B08]'
                        : 'bg-[#E6F6EC] text-[#0F6246]'
                    }`}
                  >
                    {isReversal ? (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-[#151515]">
                        {tx.transactionTypeLabel}
                      </span>
                      {isReversal ? (
                        <AdminStatusBadge tone="amber" size="sm">
                          Correction
                        </AdminStatusBadge>
                      ) : tx.isReversed ? (
                        <AdminStatusBadge tone="neutral" size="sm">
                          Corrected
                        </AdminStatusBadge>
                      ) : null}
                    </div>

                    <p className="mt-0.5 text-[11px] text-[#666159]">
                      Method: <span className="font-medium text-[#46433D]">{tx.paymentMethodLabel}</span>
                      {receivedDateLabel && receivedDateLabel !== '-'
                        ? ` · ${receivedDateLabel}`
                        : ''}
                    </p>

                    {tx.referenceNumber ? (
                      <p className="mt-1 font-mono text-[11px] text-[#46433D]">
                        Ref: {tx.referenceNumber}
                      </p>
                    ) : null}

                    {isReversal ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[#8A4B08]">
                        <ArrowDownLeft className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>Entry correction adjusting a previously recorded payment.</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`font-mono text-xs font-bold tabular-nums sm:text-sm ${
                      isReversal
                        ? 'text-[#8A4B08]'
                        : tx.isReversed
                          ? 'text-[#666159] line-through'
                          : 'text-[#0F6246]'
                    }`}
                  >
                    {isReversal ? `- ${formatClientRupiah(tx.amount)}` : formatClientRupiah(tx.amount)}
                  </span>

                  {!isReversal && !tx.isReversed && onPrintReceipt ? (
                    <button
                      type="button"
                      onClick={() => onPrintReceipt(tx)}
                      className="no-print inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#151515]/12 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#46433D] hover:border-[#151515]/30 hover:text-[#151515]"
                    >
                      <Printer className="h-3 w-3" aria-hidden="true" />
                      <span>Receipt</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && onLoadMore ? (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onLoadMore}
            className="sa-btn-secondary inline-flex min-h-8 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Load More Payment Records</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
