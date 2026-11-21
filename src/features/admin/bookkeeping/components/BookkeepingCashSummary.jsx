import { ArrowDownLeft, ArrowUpRight, Download, Scale, Wallet } from 'lucide-react';

import {
  AdminButton,
  AdminEmptyState,
  AdminMetricCard,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import {
  getBookkeepingPaymentMethodLabel,
  getLedgerSourceGroupLabel,
} from '../config/bookkeeping-config';
import {
  buildCashMovementCsv,
  formatBookkeepingDateTime,
  formatBookkeepingRupiah,
  triggerCsvDownload,
} from '../utils/bookkeeping-format';

export function BookkeepingCashSummary({
  items = [],
  metrics,
  periodBounds,
  isLoading = false,
  onSelectEntry,
}) {
  const handleExportCsv = () => {
    const csv = buildCashMovementCsv(items);
    const filename = `37studio-cash-movement-${periodBounds?.periodStart || 'all'}-to-${periodBounds?.periodEnd || 'all'}.csv`;
    triggerCsvDownload(filename, csv);
  };

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Pergerakan Kas Aktual"
      className="space-y-3 p-3.5 sm:space-y-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">
              Section A — Cash Movement (Kas Masuk &amp; Kas Keluar Aktual)
            </h3>
          </div>
          <p className="mt-0.5 hidden text-xs text-[#666159] sm:block">
            Hanya menampilkan penerimaan kas aktual dan pengeluaran kas yang sudah benar-benar
            dibayarkan pada periode{' '}
            <strong className="text-[#151515]">{periodBounds?.periodLabel}</strong>. Utang komisi
            atau beban yang belum dilunasi tidak dihitung sebagai Cash Out.
          </p>
        </div>

        <AdminButton variant="secondary" size="sm" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export Cash Movement CSV</span>
        </AdminButton>
      </div>

      {/* Period Cash Flow Strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
        <AdminMetricCard
          compactMobile
          tone="lime"
          icon={ArrowDownLeft}
          label="Cash In (Periode)"
          value={formatBookkeepingRupiah(metrics.totalIncomeReceived)}
          hint="Pembayaran customer (net reversal) + Manual Income"
        />
        <AdminMetricCard
          compactMobile
          tone="orange"
          icon={ArrowUpRight}
          label="Cash Out (Periode)"
          value={formatBookkeepingRupiah(metrics.totalOperatingCashOut)}
          hint={`Komisi ${formatBookkeepingRupiah(metrics.commissionCashOut)} + Beban Manual ${formatBookkeepingRupiah(metrics.manualExpenseCashOut)}`}
        />
        <AdminMetricCard
          compactMobile
          tone={metrics.netCashMovement < 0 ? 'orange' : 'emerald'}
          icon={Scale}
          label="Net Cash Movement"
          value={formatBookkeepingRupiah(metrics.netCashMovement, { showPositiveSign: true })}
          hint="Cash In − Cash Out pada periode aktif"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {isLoading && items.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#666159]">Memuat pergerakan kas...</div>
      ) : items.length === 0 ? (
        <AdminEmptyState
          icon={Wallet}
          title="Belum ada pergerakan kas pada periode ini"
          description="Pembayaran invoice, manual income, dan pelunasan beban/komisi pada periode ini akan tampil di sini."
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#151515]/10 text-[11px] font-semibold text-[#666159] uppercase">
                  <th className="py-2.5 pr-3">Date</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Direction</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Method</th>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-3 py-2.5">Actor</th>
                  <th className="py-2.5 pl-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]/[0.06]">
                {items.map((item) => {
                  const isIn = item.signedAmount > 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectEntry?.(item)}
                      className="cursor-pointer transition-colors hover:bg-[#FAF8F3]"
                    >
                      <td className="py-2.5 pr-3 font-mono text-[11px] whitespace-nowrap text-[#46433D]">
                        {formatBookkeepingDateTime(item.date)}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 font-medium text-[#151515]">
                        <p className="truncate">{item.description}</p>
                        <p className="text-[10.5px] text-[#666159]">{item.categoryLabel}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminStatusBadge
                          tone={item.status === 'reversed' ? 'neutral' : isIn ? 'lime' : 'orange'}
                          size="sm"
                        >
                          {item.status === 'reversed' ? 'Reversal' : isIn ? 'Cash In' : 'Cash Out'}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminStatusBadge tone="ivory" size="sm">
                          {getLedgerSourceGroupLabel(item.sourceGroup)}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-3 py-2.5 text-[#46433D]">
                        {getBookkeepingPaymentMethodLabel(item.paymentMethod)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#46433D]">
                        {item.referenceNumber || '-'}
                      </td>
                      <td className="max-w-[110px] truncate px-3 py-2.5 font-mono text-[10.5px] text-[#666159]">
                        {item.actorUid || '-'}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono font-bold whitespace-nowrap tabular-nums ${
                          item.status === 'reversed'
                            ? 'text-[#B92B0C]'
                            : isIn
                              ? 'text-[#243300]'
                              : 'text-[#B92B0C]'
                        }`}
                      >
                        {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="space-y-2.5 md:hidden">
            {items.map((item) => {
              const isIn = item.signedAmount > 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectEntry?.(item)}
                  className="sa-subcard w-full cursor-pointer space-y-2 p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#151515]">{item.description}</p>
                      <p className="mt-0.5 text-[11px] text-[#666159]">
                        {formatBookkeepingDateTime(item.date)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
                        isIn ? 'text-[#243300]' : 'text-[#B92B0C]'
                      }`}
                    >
                      {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    <AdminStatusBadge
                      tone={item.status === 'reversed' ? 'neutral' : isIn ? 'lime' : 'orange'}
                      size="sm"
                    >
                      {item.status === 'reversed' ? 'Reversal' : isIn ? 'Cash In' : 'Cash Out'}
                    </AdminStatusBadge>
                    <AdminStatusBadge tone="ivory" size="sm">
                      {getLedgerSourceGroupLabel(item.sourceGroup)}
                    </AdminStatusBadge>
                    <AdminStatusBadge tone="neutral" size="sm">
                      {getBookkeepingPaymentMethodLabel(item.paymentMethod)}
                    </AdminStatusBadge>
                    {item.referenceNumber ? (
                      <span className="font-mono text-[#666159]">Ref: {item.referenceNumber}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </AdminSurface>
  );
}
