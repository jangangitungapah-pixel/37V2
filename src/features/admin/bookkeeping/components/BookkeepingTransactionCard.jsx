import { Eye } from 'lucide-react';

import { AdminButton, AdminStatusBadge } from '@/features/admin/design-system';

import {
  getBookkeepingPaymentMethodLabel,
  getLedgerPresentationMeta,
  getLedgerSourceGroupLabel,
  getLedgerStatusMeta,
} from '../config/bookkeeping-config';
import { formatBookkeepingDateTime, formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingTransactionCard({ item, onSelect }) {
  const presentationMeta = getLedgerPresentationMeta(item.presentationType);
  const statusMeta = getLedgerStatusMeta(item.status);
  const isIncome = item.direction === 'income' && item.signedAmount >= 0;

  return (
    <article className="sa-subcard space-y-2 p-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold break-words text-[#151515] sm:text-sm">
            {item.description}
          </p>
          <p className="mt-0.5 text-[11px] text-[#666159]">
            {item.categoryLabel} • {formatBookkeepingDateTime(item.date)}
          </p>
        </div>

        <span
          className={`shrink-0 font-mono text-xs font-bold tabular-nums sm:text-sm ${item.status === 'reversed'
            ? 'text-[#666159] line-through'
            : isIncome
              ? 'text-[#243300]'
              : 'text-[#B92B0C]'
            }`}
        >
          {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <AdminStatusBadge tone={item.direction === 'income' ? 'lime' : 'orange'} size="sm">
          {item.direction === 'income' ? 'Income' : 'Expense'}
        </AdminStatusBadge>
        <AdminStatusBadge tone={presentationMeta.tone} size="sm">
          {presentationMeta.label}
        </AdminStatusBadge>
        <AdminStatusBadge tone={statusMeta.tone} size="sm">
          {statusMeta.label}
        </AdminStatusBadge>
        <AdminStatusBadge tone="ivory" size="sm">
          {getLedgerSourceGroupLabel(item.sourceGroup)}
        </AdminStatusBadge>
        {item.paymentMethod ? (
          <AdminStatusBadge tone="neutral" size="sm">
            {getBookkeepingPaymentMethodLabel(item.paymentMethod)}
          </AdminStatusBadge>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#151515]/[0.07] pt-2">
        <span className="truncate font-mono text-[10.5px] text-[#666159]">
          {item.referenceNumber ? `Ref: ${item.referenceNumber}` : item.recordId}
        </span>

        <AdminButton
          variant="secondary"
          size="sm"
          onClick={() => onSelect?.(item)}
          className="min-h-10 shrink-0"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>View Detail</span>
        </AdminButton>
      </div>
    </article>
  );
}
