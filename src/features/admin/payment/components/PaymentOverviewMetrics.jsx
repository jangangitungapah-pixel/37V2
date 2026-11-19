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
      className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-neutral-200 pt-2 sm:mt-3 sm:gap-2 sm:pt-2.5 xl:grid-cols-4"
    >
      {/* 1. Outstanding Balance */}
      <div
        className={`border-studio-ink flex items-center justify-between gap-1.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:gap-2.5 sm:px-3 sm:py-2 ${
          metrics.outstandingBalance > 0 ? 'bg-amber-100' : 'bg-studio-ivory'
        }`}
      >
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
            <Wallet className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
            <span className="truncate">
              <span className="sm:hidden">Sisa Tagihan</span>
              <span className="hidden sm:inline">Total Sisa Tagihan</span>
            </span>
          </dt>
          <dd className="font-display text-studio-ink mt-0.5 truncate text-base leading-tight font-black tabular-nums min-[360px]:text-lg sm:mt-1 sm:text-xl xl:text-2xl">
            {formatRupiah(metrics.outstandingBalance)}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
            <span className="sm:hidden">{metrics.allActiveUnpaidOrPartialCount} belum lunas</span>
            <span className="hidden sm:inline">
              Dari semua invoice aktif ({metrics.allActiveUnpaidOrPartialCount} belum lunas)
            </span>
          </p>
        </div>
      </div>

      {/* 2. Payments Received (Net) */}
      <div className="border-studio-ink bg-studio-lime/30 flex items-center justify-between gap-1.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:gap-2.5 sm:px-3 sm:py-2">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
            <Banknote className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
            <span className="truncate">
              <span className="sm:hidden">Dana Masuk</span>
              <span className="hidden sm:inline">Pembayaran Masuk</span>
            </span>
          </dt>
          <dd className="font-display text-studio-ink mt-0.5 truncate text-base leading-tight font-black tabular-nums min-[360px]:text-lg sm:mt-1 sm:text-xl xl:text-2xl">
            {formatRupiah(Math.max(0, metrics.paymentsReceived))}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
            <span className="sm:hidden">
              {metrics.paymentCount} masuk
              {metrics.reversalCount > 0 ? `, ${metrics.reversalCount} batal` : ''}
            </span>
            <span className="hidden sm:inline">
              {periodLabel} • {metrics.paymentCount} masuk
              {metrics.reversalCount > 0 ? `, ${metrics.reversalCount} dibatalkan` : ''}
            </span>
          </p>
        </div>
      </div>

      {/* 3. Total Invoices Issued */}
      <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-1.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:gap-2.5 sm:px-3 sm:py-2">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
            <FileText className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
            <span className="truncate">Total Invoice</span>
          </dt>
          <dd className="font-display text-studio-ink mt-0.5 text-base leading-tight font-black tabular-nums min-[360px]:text-lg sm:mt-1 sm:text-xl xl:text-2xl">
            {metrics.totalInvoices}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
            <span className="sm:hidden">Invoice aktif</span>
            <span className="hidden sm:inline">Aktif ({periodLabel.toLowerCase()})</span>
          </p>
        </div>
      </div>

      {/* 4. Unpaid / Partial Invoices */}
      <div className="border-studio-ink bg-studio-ivory flex items-center justify-between gap-1.5 border-2 px-2 py-1.5 shadow-[2px_2px_0px_#151515] sm:gap-2.5 sm:px-3 sm:py-2">
        <div className="min-w-0">
          <dt className="text-studio-muted-ink flex items-center gap-1 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9.5px]">
            <AlertCircle className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
            <span className="truncate">Belum Lunas</span>
          </dt>
          <dd className="font-display text-studio-ink mt-0.5 text-base leading-tight font-black tabular-nums min-[360px]:text-lg sm:mt-1 sm:text-xl xl:text-2xl">
            {metrics.unpaidOrPartialCount}
          </dd>
          <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px]">
            {metrics.overdueCount > 0 ? (
              `${metrics.overdueCount} lewat tempo`
            ) : (
              <>
                <span className="sm:hidden">Ada sisa tagihan</span>
                <span className="hidden sm:inline">
                  Masih memiliki sisa tagihan ({periodLabel.toLowerCase()})
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </dl>
  );
}
