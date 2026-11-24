import { AlertCircle, AlertTriangle, CheckCircle2, FileText, RefreshCw, Wallet } from 'lucide-react';

import { AdminMetricCard, AdminSurface } from '@/features/admin/design-system';

import { formatClientRupiah } from '../utils/client-billing-utils';

function InlineMetricSkeleton({ widthClass = 'w-24' }) {
  return (
    <span
      data-testid="client-billing-metric-skeleton"
      aria-label="Loading metric"
      className={`inline-block h-6 ${widthClass} animate-pulse rounded-lg bg-[#151515]/10 align-middle`}
    />
  );
}

/**
 * Module A — Billing Overview summary KPI strip for `/portal/invoices`.
 * Computed strictly from the authenticated Client's own `issued` invoices.
 */
export function ClientBillingOverview({
  metrics,
  isLoading = false,
  error = '',
  onRetry,
}) {
  const safeMetrics = metrics || {
    totalOutstanding: 0,
    totalPaid: 0,
    unpaidCount: 0,
    overdueCount: 0,
  };

  return (
    <section
      aria-labelledby="client-billing-summary-heading"
      data-testid="client-billing-overview"
      className="space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2
          id="client-billing-summary-heading"
          className="text-xs font-semibold tracking-wider text-[#666159] uppercase"
        >
          Billing Summary
        </h2>
        <span className="font-mono text-[10.5px] text-[#8B857B]">
          {error ? 'Unavailable' : isLoading ? 'Loading...' : 'Live ledger'}
        </span>
      </div>

      {error ? (
        <AdminSurface
          variant="card"
          role="alert"
          data-testid="client-billing-overview-error"
          className="flex flex-col gap-3 border-[#FF4B22]/25 bg-[#FFEDE8]/55 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[#B92B0C]"
              aria-hidden="true"
            />
            <div className="text-xs text-[#46433D]">
              <p className="font-semibold text-[#151515]">Unable to load billing summary</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          ) : null}
        </AdminSurface>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Total Outstanding"
          value={
            isLoading ? (
              <InlineMetricSkeleton widthClass="w-28" />
            ) : error ? (
              '—'
            ) : (
              formatClientRupiah(safeMetrics.totalOutstanding)
            )
          }
          hint={
            isLoading || error
              ? 'Active invoice balance'
              : safeMetrics.totalOutstanding > 0
                ? 'Remaining balance on active invoices'
                : 'All active invoices are settled'
          }
          icon={Wallet}
          tone={!isLoading && !error && safeMetrics.totalOutstanding > 0 ? 'orange' : 'neutral'}
        />

        <AdminMetricCard
          label="Total Paid"
          value={
            isLoading ? (
              <InlineMetricSkeleton widthClass="w-28" />
            ) : error ? (
              '—'
            ) : (
              formatClientRupiah(safeMetrics.totalPaid)
            )
          }
          hint={
            isLoading || error
              ? 'Verified studio payments'
              : safeMetrics.totalPaid > 0
                ? 'Net payments recorded on active invoices'
                : 'No settled payments recorded yet'
          }
          icon={CheckCircle2}
          tone={!isLoading && !error && safeMetrics.totalPaid > 0 ? 'emerald' : 'neutral'}
        />

        <AdminMetricCard
          label="Unpaid Invoices"
          value={
            isLoading ? (
              <InlineMetricSkeleton widthClass="w-12" />
            ) : error ? (
              '—'
            ) : (
              String(safeMetrics.unpaidCount)
            )
          }
          hint={
            isLoading || error
              ? 'Open studio invoices'
              : safeMetrics.unpaidCount > 0
                ? 'Active invoices with remaining balance'
                : 'Zero open invoices awaiting payment'
          }
          icon={FileText}
          tone={!isLoading && !error && safeMetrics.unpaidCount > 0 ? 'amber' : 'neutral'}
        />

        <AdminMetricCard
          label="Overdue Invoices"
          value={
            isLoading ? (
              <InlineMetricSkeleton widthClass="w-12" />
            ) : error ? (
              '—'
            ) : (
              String(safeMetrics.overdueCount)
            )
          }
          hint={
            isLoading || error
              ? 'Checked in Asia/Jakarta time'
              : safeMetrics.overdueCount > 0
                ? 'Past due date in Asia/Jakarta'
                : 'No overdue invoices'
          }
          icon={AlertCircle}
          tone={!isLoading && !error && safeMetrics.overdueCount > 0 ? 'orange' : 'neutral'}
        />
      </div>
    </section>
  );
}
