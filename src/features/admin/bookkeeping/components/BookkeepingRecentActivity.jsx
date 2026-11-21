import { ArrowDownLeft, ArrowUpRight, ChevronRight, Clock, History } from 'lucide-react';

import {
  AdminButton,
  AdminEmptyState,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import {
  getLedgerPresentationMeta,
  getLedgerSourceGroupLabel,
  getLedgerStatusMeta,
} from '../config/bookkeeping-config';
import { formatBookkeepingDateTime, formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingRecentActivity({
  items = [],
  isLoading = false,
  onSelectActivity,
  onViewAllTransactions,
}) {
  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Aktivitas Keuangan Terbaru"
      className="p-3.5 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5 sm:pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">Recent Activity</h3>
            <p className="hidden text-[11px] text-[#666159] sm:block">
              Pembayaran customer, pemasukan/pengeluaran manual, akrual komisi, dan settlement
              terbaru.
            </p>
          </div>
        </div>

        {onViewAllTransactions ? (
          <AdminButton variant="secondary" size="xs" onClick={onViewAllTransactions}>
            <span>Lihat Semua</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </AdminButton>
        ) : null}
      </div>

      {isLoading && items.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#666159]">Memuat aktivitas keuangan...</div>
      ) : items.length === 0 ? (
        <AdminEmptyState
          icon={Clock}
          title="Belum ada aktivitas pembukuan"
          description="Catat pemasukan atau pengeluaran manual, terima pembayaran invoice, atau posting komisi untuk melihat aktivitas di sini."
          className="mt-4"
        />
      ) : (
        <div className="mt-3 divide-y divide-[#151515]/[0.07]">
          {items.map((item) => {
            const presentationMeta = getLedgerPresentationMeta(item.presentationType);
            const statusMeta = getLedgerStatusMeta(item.status);
            const isPositive = item.signedAmount > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectActivity?.(item)}
                className="flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#FAF8F3] sm:items-center sm:px-3"
              >
                <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:mt-0 ${isPositive ? 'bg-[#EDF8C2] text-[#243300]' : 'bg-[#FFEDE8] text-[#B92B0C]'
                      }`}
                  >
                    {isPositive ? (
                      <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#151515] sm:text-sm">
                      {item.description}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#666159]">
                      <span>{item.categoryLabel}</span>
                      <span aria-hidden="true">•</span>
                      <span>{formatBookkeepingDateTime(item.date)}</span>
                      <AdminStatusBadge tone="ivory" size="sm" className="hidden sm:inline-flex">
                        {getLedgerSourceGroupLabel(item.sourceGroup)}
                      </AdminStatusBadge>
                      <AdminStatusBadge
                        tone={presentationMeta.tone}
                        size="sm"
                        className="hidden sm:inline-flex"
                      >
                        {presentationMeta.label}
                      </AdminStatusBadge>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`font-mono text-xs font-bold tabular-nums sm:text-sm ${item.status === 'reversed'
                      ? 'text-[#666159] line-through'
                      : isPositive
                        ? 'text-[#243300]'
                        : 'text-[#B92B0C]'
                      }`}
                  >
                    {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
                  </span>
                  <AdminStatusBadge tone={statusMeta.tone} size="sm">
                    {statusMeta.label}
                  </AdminStatusBadge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AdminSurface>
  );
}
