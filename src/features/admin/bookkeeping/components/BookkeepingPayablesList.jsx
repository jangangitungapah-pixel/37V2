import { useState } from 'react';
import { Banknote, CheckCircle2, Clock, Download } from 'lucide-react';

import {
  AdminButton,
  AdminEmptyState,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import {
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SOURCE_TYPES,
  getPayableStatusMeta,
} from '../config/bookkeeping-config';
import {
  buildPayablesCsv,
  formatBookkeepingDate,
  formatBookkeepingRupiah,
  triggerCsvDownload,
} from '../utils/bookkeeping-format';
import { isActivePayableEntry } from '../utils/bookkeeping-calculation';

export function BookkeepingPayablesList({
  entries = [],
  activePayables = [],
  metrics,
  isLoading = false,
  onSettlePayable,
  onInspectPayable,
  hasMorePayables = false,
  onLoadMorePayables,
}) {
  const [showSettled, setShowSettled] = useState(false);

  // Merge activePayables + entries cleanly without duplicates
  const payablesById = new Map();
  for (const item of entries) {
    if (isActivePayableEntry(item)) payablesById.set(item.id, item);
  }
  for (const item of activePayables) {
    if (isActivePayableEntry(item)) payablesById.set(item.id, item);
  }

  const allPayables = Array.from(payablesById.values());
  const visiblePayables = showSettled
    ? allPayables
    : allPayables.filter(
        (p) => p.remainingAmount > 0 && p.settlementStatus !== BOOKKEEPING_SETTLEMENT_STATUS.PAID,
      );

  const handleExportPayables = () => {
    const csv = buildPayablesCsv(visiblePayables);
    triggerCsvDownload('37studio-outstanding-payables.csv', csv);
  };

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Daftar Kewajiban Belum Dibayar"
      className="space-y-3 p-3.5 sm:space-y-4 sm:p-5"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-[#8A4B08]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">
              Section B — Outstanding Payables (Kewajiban Belum Lunas)
            </h3>
            <AdminStatusBadge tone="amber" size="sm">
              Total Sisa: {formatBookkeepingRupiah(metrics.outstandingPayables)}
            </AdminStatusBadge>
          </div>
          <p className="mt-1 hidden text-xs text-[#666159] sm:block">
            Mencakup Komisi Staff, Fee Operator Recording, dan Pengeluaran Manual status Unpaid.
            Owner Allocation bersifat referensi dan tidak masuk sebagai kewajiban.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettled((prev) => !prev)}
            className="sa-control min-h-9 cursor-pointer bg-white px-3 py-1.5 text-xs font-medium text-[#46433D] hover:text-[#151515]"
          >
            {showSettled ? 'Sembunyikan yang Lunas' : 'Tampilkan yang Sudah Lunas'}
          </button>

          <AdminButton variant="secondary" size="sm" onClick={handleExportPayables}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export Payables CSV</span>
          </AdminButton>
        </div>
      </div>

      {isLoading && visiblePayables.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#666159]">Memuat daftar kewajiban...</div>
      ) : visiblePayables.length === 0 ? (
        <AdminEmptyState
          icon={CheckCircle2}
          tone="lime"
          title="Semua kewajiban sudah lunas"
          description="Saat ini tidak ada komisi staff, fee operator, atau beban manual unpaid yang masih terbuka."
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#151515]/10 text-[11px] font-semibold text-[#666159] uppercase">
                  <th className="py-2.5 pr-3">Description</th>
                  <th className="px-3 py-2.5">Category / Source</th>
                  <th className="px-3 py-2.5 text-right">Original</th>
                  <th className="px-3 py-2.5 text-right">Settled</th>
                  <th className="px-3 py-2.5 text-right">Remaining</th>
                  <th className="px-3 py-2.5">Due Date</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]/[0.06]">
                {visiblePayables.map((entry) => {
                  const statusMeta = getPayableStatusMeta(entry.settlementStatus);
                  const canSettle = entry.remainingAmount > 0;
                  const isCommission =
                    entry.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH;

                  return (
                    <tr key={entry.id} className="transition-colors hover:bg-[#FAF8F3]">
                      <td className="max-w-xs py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => onInspectPayable?.(entry)}
                          className="cursor-pointer text-left font-semibold text-[#151515] hover:underline"
                        >
                          {entry.description}
                        </button>
                        <p className="mt-0.5 text-[10.5px] text-[#666159]">
                          Diakui: {formatBookkeepingDate(entry.occurredAt || entry.postedAt)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-[#46433D]">{entry.categoryLabel}</p>
                        <AdminStatusBadge tone="ivory" size="sm" className="mt-0.5">
                          {isCommission ? 'Commission Batch' : 'Manual Unpaid'}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[#46433D] tabular-nums">
                        {formatBookkeepingRupiah(entry.amount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[#0F6246] tabular-nums">
                        {formatBookkeepingRupiah(entry.amountSettled)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-[#B92B0C] tabular-nums">
                        {formatBookkeepingRupiah(entry.remainingAmount)}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-[#46433D]">
                        {entry.dueDate ? formatBookkeepingDate(entry.dueDate) : '-'}
                      </td>
                      <td className="px-3 py-3">
                        <AdminStatusBadge tone={statusMeta.tone} size="sm">
                          {statusMeta.label}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-3 pl-3 text-right">
                        {canSettle ? (
                          <AdminButton
                            variant="orange"
                            size="xs"
                            onClick={() => onSettlePayable?.(entry)}
                          >
                            <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Settle Payment</span>
                          </AdminButton>
                        ) : (
                          <AdminButton
                            variant="secondary"
                            size="xs"
                            onClick={() => onInspectPayable?.(entry)}
                          >
                            Lihat Detail
                          </AdminButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="space-y-3 md:hidden">
            {visiblePayables.map((entry) => {
              const statusMeta = getPayableStatusMeta(entry.settlementStatus);
              const canSettle = entry.remainingAmount > 0;
              const isCommission = entry.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH;

              return (
                <article key={entry.id} className="sa-subcard space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onInspectPayable?.(entry)}
                        className="cursor-pointer text-left text-xs font-bold text-[#151515] hover:underline"
                      >
                        {entry.description}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge tone={statusMeta.tone} size="sm">
                          {statusMeta.label}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone="ivory" size="sm">
                          {isCommission ? 'Commission' : 'Manual Unpaid'}
                        </AdminStatusBadge>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold text-[#666159] uppercase">Sisa</p>
                      <p className="font-mono text-sm font-bold text-[#B92B0C] tabular-nums">
                        {formatBookkeepingRupiah(entry.remainingAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F8F6EF] p-2.5 text-[11px]">
                    <div>
                      <span className="text-[#666159]">Total Kewajiban</span>
                      <p className="font-mono font-semibold text-[#151515] tabular-nums">
                        {formatBookkeepingRupiah(entry.amount)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#666159]">Sudah Dibayar</span>
                      <p className="font-mono font-semibold text-[#0F6246] tabular-nums">
                        {formatBookkeepingRupiah(entry.amountSettled)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#666159]">
                      {entry.dueDate
                        ? `Jatuh tempo: ${formatBookkeepingDate(entry.dueDate)}`
                        : `Diakui: ${formatBookkeepingDate(entry.occurredAt || entry.postedAt)}`}
                    </span>

                    {canSettle ? (
                      <AdminButton
                        variant="orange"
                        size="md"
                        onClick={() => onSettlePayable?.(entry)}
                        className="min-h-11 w-full sm:w-auto"
                      >
                        <Banknote className="h-4 w-4" aria-hidden="true" />
                        <span>Settle Payment</span>
                      </AdminButton>
                    ) : (
                      <AdminButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onInspectPayable?.(entry)}
                        className="min-h-10"
                      >
                        Lihat Detail
                      </AdminButton>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {hasMorePayables ? (
            <div className="flex justify-center pt-2">
              <AdminButton variant="secondary" size="sm" onClick={onLoadMorePayables}>
                Muat Lebih Banyak Kewajiban
              </AdminButton>
            </div>
          ) : null}
        </>
      )}
    </AdminSurface>
  );
}
