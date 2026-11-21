import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Receipt,
  Scale,
  Wallet,
} from 'lucide-react';

import { AdminMetricCard, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { formatBookkeepingRupiah } from '../utils/bookkeeping-format';

export function BookkeepingOverviewMetrics({ metrics, periodLabel, onOpenPayables }) {
  const [showSecondaryMobile, setShowSecondaryMobile] = useState(false);
  const isNegativeMovement = Number(metrics.netCashMovement) < 0;

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* 4 Headline Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3.5 xl:grid-cols-4">
        <AdminMetricCard
          compactMobile
          tone="lime"
          icon={ArrowDownLeft}
          label="Total Income Received"
          value={formatBookkeepingRupiah(metrics.totalIncomeReceived)}
          hint={`Aktivitas periode: Customer ${formatBookkeepingRupiah(metrics.customerCashReceived)} + Manual ${formatBookkeepingRupiah(metrics.manualIncomeTotal)}`}
        >
          <div className="mt-1.5 hidden items-center gap-1.5 sm:flex">
            <AdminStatusBadge tone="lime" size="sm">
              Kas Masuk Periode
            </AdminStatusBadge>
          </div>
        </AdminMetricCard>

        <AdminMetricCard
          compactMobile
          tone="orange"
          icon={ArrowUpRight}
          label="Total Operating Cash Out"
          value={formatBookkeepingRupiah(metrics.totalOperatingCashOut)}
          hint={`Aktivitas periode: ${metrics.settlementCountInPeriod} pembayaran tunai/transfer (tanpa utang belum dibayar)`}
        >
          <div className="mt-1.5 hidden items-center gap-1.5 sm:flex">
            <AdminStatusBadge tone="orange" size="sm">
              Kas Keluar Periode
            </AdminStatusBadge>
          </div>
        </AdminMetricCard>

        <AdminMetricCard
          compactMobile
          tone={metrics.outstandingPayables > 0 ? 'amber' : 'neutral'}
          icon={Clock}
          label="Outstanding Payables"
          value={formatBookkeepingRupiah(metrics.outstandingPayables)}
          hint={`Saldo berjalan saat ini: ${metrics.openPayablesCount} kewajiban belum lunas`}
        >
          <div className="mt-1 flex flex-wrap items-center justify-between gap-1 sm:mt-1.5">
            <AdminStatusBadge
              tone={metrics.outstandingPayables > 0 ? 'amber' : 'neutral'}
              size="sm"
              className="hidden sm:inline-flex"
            >
              Saldo Berjalan
            </AdminStatusBadge>
            {onOpenPayables && metrics.openPayablesCount > 0 ? (
              <button
                type="button"
                onClick={onOpenPayables}
                className="cursor-pointer text-[11px] font-semibold text-[#8A4B08] underline decoration-amber-500/40 underline-offset-2 hover:text-[#151515]"
              >
                Lunasi →
              </button>
            ) : null}
          </div>
        </AdminMetricCard>

        <AdminMetricCard
          compactMobile
          tone={isNegativeMovement ? 'orange' : 'emerald'}
          icon={Scale}
          label="Net Cash Movement"
          value={formatBookkeepingRupiah(metrics.netCashMovement, { showPositiveSign: true })}
          hint={`Pergerakan kas ${periodLabel} (Kas Masuk − Kas Keluar, bukan laba akuntansi)`}
        >
          <div className="mt-1.5 hidden items-center gap-1.5 sm:flex">
            <AdminStatusBadge tone={isNegativeMovement ? 'orange' : 'ink'} size="sm">
              {isNegativeMovement ? 'Defisit Kas Periode' : 'Surplus Kas Periode'}
            </AdminStatusBadge>
          </div>
        </AdminMetricCard>
      </div>

      {/* Mobile Collapsible Trigger for Secondary Summary */}
      <div className="sm:hidden">
        <button
          type="button"
          aria-expanded={showSecondaryMobile}
          onClick={() => setShowSecondaryMobile((prev) => !prev)}
          className="sa-control sa-btn-secondary flex min-h-9.5 w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-semibold text-[#46433D]"
        >
          <span className="inline-flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ringkasan Tagihan &amp; Saldo Posisi</span>
          </span>
          {showSecondaryMobile ? (
            <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Secondary Financial Summary cleanly separating Period Activity vs Current Balance */}
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Ringkasan Keuangan Periode dan Saldo Berjalan"
        className={`${showSecondaryMobile ? 'block' : 'hidden sm:block'} p-3.5 sm:p-5`}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Period Activity (4 items across 2 cols on lg) */}
          <div className="space-y-2.5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                <h3 className="text-xs font-bold tracking-wide text-[#151515] uppercase sm:text-[13px]">
                  Ringkasan Aktivitas Periode
                </h3>
              </div>
              <AdminStatusBadge tone="ivory" size="sm">
                Periode: {periodLabel}
              </AdminStatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <div className="sa-subcard p-2.5 sm:p-3">
                <p className="text-[11px] font-medium text-[#666159]">Total Billed</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                  {formatBookkeepingRupiah(metrics.totalBilled)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B857B]">
                  {metrics.issuedInvoicesCountInPeriod} invoice issued (bukan kas)
                </p>
              </div>

              <div className="sa-subcard p-2.5 sm:p-3">
                <p className="text-[11px] font-medium text-[#666159]">Expense Accrued</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                  {formatBookkeepingRupiah(metrics.totalExpenseAccrued)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B857B]">Komisi + beban operasional</p>
              </div>

              <div className="sa-subcard p-2.5 sm:p-3">
                <p className="text-[11px] font-medium text-[#666159]">Expense Settled</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#B92B0C] tabular-nums sm:text-base">
                  {formatBookkeepingRupiah(metrics.expenseSettled)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B857B]">Sudah dibayarkan keluar</p>
              </div>

              <div className="sa-subcard p-2.5 sm:p-3">
                <p className="text-[11px] font-medium text-[#666159]">Manual Income</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#243300] tabular-nums sm:text-base">
                  {formatBookkeepingRupiah(metrics.manualIncomeTotal)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B857B]">
                  {metrics.manualIncomeCount} pemasukan non-invoice
                </p>
              </div>

              <div className="sa-subcard col-span-2 p-2.5 sm:col-span-1 sm:p-3">
                <p className="text-[11px] font-medium text-[#666159]">Manual Expense</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#151515] tabular-nums sm:text-base">
                  {formatBookkeepingRupiah(metrics.manualExpenseAccrued)}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B857B]">
                  Lunas {formatBookkeepingRupiah(metrics.manualExpensePaidImmediateAccrued)} • Utang{' '}
                  {formatBookkeepingRupiah(metrics.manualExpenseUnpaidAccrued)}
                </p>
              </div>
            </div>
          </div>

          {/* Current Standing Balances */}
          <div className="space-y-2.5 border-t border-[#151515]/[0.08] pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#46433D]" aria-hidden="true" />
                <h3 className="text-xs font-bold tracking-wide text-[#151515] uppercase sm:text-[13px]">
                  Saldo Posisi Saat Ini
                </h3>
              </div>
              <AdminStatusBadge tone="amber" size="sm">
                Lintas Periode
              </AdminStatusBadge>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              <div className="sa-panel-ivory p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#46433D]">
                    Customer Outstanding Receivable
                  </span>
                  <AdminStatusBadge tone="neutral" size="sm">
                    {metrics.outstandingReceivableCount} invoice
                  </AdminStatusBadge>
                </div>
                <p className="mt-1 font-mono text-base font-bold text-[#151515] tabular-nums sm:text-lg">
                  {formatBookkeepingRupiah(metrics.customerOutstandingReceivable)}
                </p>
                <p className="mt-0.5 text-[10.5px] text-[#666159]">
                  Sisa tagihan pelanggan yang masih berjalan (tidak termasuk invoice Void).
                </p>
              </div>

              <div className="sa-panel-ivory p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#46433D]">
                    Breakdown Kewajiban Studio
                  </span>
                </div>
                <div className="mt-1.5 space-y-1 text-[11px] text-[#46433D]">
                  <div className="flex items-center justify-between gap-2">
                    <span>Staff Commission:</span>
                    <span className="font-mono font-semibold text-[#151515] tabular-nums">
                      {formatBookkeepingRupiah(metrics.staffCommissionPayable)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Recording Operator Fee:</span>
                    <span className="font-mono font-semibold text-[#151515] tabular-nums">
                      {formatBookkeepingRupiah(metrics.recordingOperatorPayable)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Unpaid Manual Expense:</span>
                    <span className="font-mono font-semibold text-[#151515] tabular-nums">
                      {formatBookkeepingRupiah(metrics.manualExpensePayable)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
