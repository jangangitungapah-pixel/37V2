import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
  HandCoins,
  RefreshCw,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router';

import {
  AdminButton,
  AdminMetricCard,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import { DASHBOARD_PERIOD_OPTIONS } from '../config/dashboard-config';
import { formatDashboardRupiah } from '../utils/dashboard-calculations';
import { DashboardCashFlowChart } from './DashboardCashFlowChart';

/**
 * SECTION E — Owner Financial Overview (Strictly Owner-Only)
 * Never rendered or mounted for Staff users.
 *
 * Enforces Financial Integrity Rules:
 * - `Kas Masuk` = net customer payment transactions (minus reversals) + paid manual income
 * - `Kas Keluar` = actual `bookkeepingSettlements` paid out (never unpaid accruals)
 * - `Perubahan Kas Bersih` (`Net Cash Movement`) = `Kas Masuk - Kas Keluar` (NEVER labeled as Profit / Laba Bersih)
 * - `Outstanding Payables` = current open payable obligations from `bookkeepingEntries`
 */
export function DashboardOwnerFinancials({
  periodId,
  onPeriodChange,
  periodBounds,
  financialSummary,
  cashFlowTrend,
  isLoading = false,
  error = null,
  onRetry,
}) {
  const prefersReducedMotion = useReducedMotion();
  const cashIn = financialSummary?.cashIn ?? 0;
  const cashOut = financialSummary?.cashOut ?? 0;
  const netCashMovement = financialSummary?.netCashMovement ?? 0;
  const outstandingPayables = financialSummary?.outstandingPayables ?? 0;
  const openPayablesCount = financialSummary?.openPayablesCount ?? 0;
  const customerReversals = financialSummary?.customerPaymentReversals ?? 0;

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="dashboard-owner-financial-heading"
      data-testid="dashboard-owner-financial-section"
      className="space-y-3.5 p-3.5 sm:p-4 lg:p-5"
    >
      <div className="flex flex-col gap-3 border-b border-[#151515]/[0.07] pb-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="dashboard-owner-financial-heading"
              className="text-[15px] font-bold tracking-tight text-[#151515]"
            >
              Ringkasan Arus Kas &amp; Kewajiban (Owner)
            </h3>
            <AdminStatusBadge tone="ink" size="sm" icon={ShieldCheck}>
              Khusus Owner
            </AdminStatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-[#666159]">
            Pergerakan kas aktual periode {periodBounds?.periodRangeLabel || '-'} (WIB) serta posisi
            utang operasional terbuka saat ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Pilih rentang periode keuangan"
            className="sa-pill-track inline-flex items-center gap-0.5"
          >
            {DASHBOARD_PERIOD_OPTIONS.map((opt) => {
              const isActive = opt.id === periodId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPeriodChange?.(opt.id)}
                  aria-pressed={isActive}
                  className={`relative min-h-8.5 cursor-pointer rounded-[10px] px-3 py-1 text-xs transition-colors ${
                    isActive
                      ? 'font-semibold text-[#F8F6EF]'
                      : 'font-medium text-[#46433D] hover:text-[#151515]'
                  }`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId={prefersReducedMotion ? undefined : 'dash-fin-period-pill'}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 460, damping: 34 }
                      }
                      className="absolute inset-0 rounded-[10px] bg-[#151515] shadow-xs"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <Link
            to="/admin/pembukuan"
            className="sa-control sa-btn-secondary inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[#151515]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#658800]" aria-hidden="true" />
            <span>Buka Pembukuan</span>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-red-900">
                Gagal memuat ringkasan keuangan Owner
              </p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
          {onRetry ? (
            <AdminButton variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Coba Lagi</span>
            </AdminButton>
          ) : null}
        </div>
      ) : isLoading ? (
        <div className="space-y-4" aria-label="Memuat ringkasan keuangan Owner">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-24 animate-pulse rounded-2xl border border-[#151515]/[0.07] bg-[#F8F6EF]/70 p-3.5"
              />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-[#151515]/[0.07] bg-[#F8F6EF]/70" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <AdminMetricCard
              label="Kas Masuk"
              value={formatDashboardRupiah(cashIn)}
              hint={
                customerReversals > 0
                  ? `Setelah dikurangi reversal ${formatDashboardRupiah(customerReversals)}`
                  : `Penerimaan pembayaran bersih (${periodBounds?.label || 'periode'})`
              }
              icon={ArrowUpRight}
              tone="lime"
              compactMobile
            />

            <AdminMetricCard
              label="Kas Keluar"
              value={formatDashboardRupiah(cashOut)}
              hint="Pelunasan kas aktual (settlements, bukan akrual)"
              icon={ArrowDownRight}
              tone="orange"
              compactMobile
            />

            <AdminMetricCard
              label="Perubahan Kas Bersih"
              value={formatDashboardRupiah(netCashMovement)}
              hint="Net Cash Movement (Kas Masuk − Kas Keluar)"
              icon={Scale}
              tone={netCashMovement >= 0 ? 'emerald' : 'orange'}
              compactMobile
            />

            <AdminMetricCard
              label="Outstanding Payables"
              value={formatDashboardRupiah(outstandingPayables)}
              hint={`${openPayablesCount} kewajiban akrual terbuka saat ini`}
              icon={HandCoins}
              tone={outstandingPayables > 0 ? 'amber' : 'neutral'}
              compactMobile
            />
          </div>

          <DashboardCashFlowChart cashFlowTrend={cashFlowTrend} />
        </>
      )}
    </AdminSurface>
  );
}
