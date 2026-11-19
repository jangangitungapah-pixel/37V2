import { AlertCircle, Banknote, FileText, Wallet } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';

/**
 * Compact Calendar-scaled overview metrics strip for Payment and Bill:
 * - Outstanding Balance (all active issued invoices)
 * - Payments Received (net payments - reversals within active filter period)
 * - Total Invoices (issued invoices within active filter period)
 * - Unpaid / Partial Invoices (invoices with balanceDue > 0 within active filter period)
 */
export function PaymentOverviewMetrics({ metrics, hasActivePeriodFilter = false }) {
  const periodLabel = hasActivePeriodFilter ? 'Periode filter aktif' : 'Semua periode termuat';

  return (
    <dl
      aria-label="Ringkasan Payment and Bill"
      className="mt-3 grid grid-cols-1 gap-2 border-t border-neutral-200 pt-2.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {/* 1. Outstanding Balance */}
      <div
        className={`border-studio-ink flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515] ${
          metrics.outstandingBalance > 0 ? 'bg-amber-100' : 'bg-studio-ivory'
        }`}
      >
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <Wallet className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Outstanding Balance</span>
          </dt>
          <dd className="font-display text-studio-ink mt-1 truncate text-xl leading-none font-black tabular-nums sm:text-2xl">
            {formatRupiah(metrics.outstandingBalance)}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
            Seluruh invoice aktif ({metrics.allActiveUnpaidOrPartialCount} belum lunas)
          </p>
        </div>
      </div>

      {/* 2. Payments Received (Net) */}
      <div className="border-studio-ink bg-studio-lime/30 flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515]">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <Banknote className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Payments Received</span>
          </dt>
          <dd className="font-display text-studio-ink mt-1 truncate text-xl leading-none font-black tabular-nums sm:text-2xl">
            {formatRupiah(Math.max(0, metrics.paymentsReceived))}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
            {periodLabel} • {metrics.paymentCount} masuk
            {metrics.reversalCount > 0 ? `, ${metrics.reversalCount} reversal` : ''}
          </p>
        </div>
      </div>

      {/* 3. Total Invoices Issued */}
      <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515]">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Total Invoices</span>
          </dt>
          <dd className="font-display text-studio-ink mt-1 text-xl leading-none font-black tabular-nums sm:text-2xl">
            {metrics.totalInvoices}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
            Diterbitkan ({periodLabel.toLowerCase()})
          </p>
        </div>
      </div>

      {/* 4. Unpaid / Partial Invoices */}
      <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-2.5 border-2 px-3 py-2 shadow-[2px_2px_0px_#151515]">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Unpaid / Partial</span>
          </dt>
          <dd className="font-display text-studio-ink mt-1 text-xl leading-none font-black tabular-nums sm:text-2xl">
            {metrics.unpaidOrPartialCount}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[9px] font-semibold">
            {metrics.overdueCount > 0
              ? `${metrics.overdueCount} melewati jatuh tempo`
              : `Masih memiliki sisa tagihan (${periodLabel.toLowerCase()})`}
          </p>
        </div>
      </div>
    </dl>
  );
}
