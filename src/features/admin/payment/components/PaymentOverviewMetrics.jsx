import { AlertCircle, Banknote, FileText, Wallet } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminMetricCard } from '@/features/admin/design-system';

/**
 * Spatial Ambient overview metrics strip for Payment and Bill.
 */
export function PaymentOverviewMetrics({ metrics, hasActivePeriodFilter = false }) {
  const periodLabel = hasActivePeriodFilter ? 'Periode filter aktif' : 'Semua periode termuat';

  return (
    <dl
      aria-label="Ringkasan Payment and Bill"
      className="mt-3 grid grid-cols-2 gap-2 border-t border-[#151515]/[0.07] pt-3 sm:mt-5 sm:gap-3 sm:pt-5 xl:grid-cols-4"
    >
      <AdminMetricCard
        label="Total Sisa Tagihan"
        value={formatRupiah(metrics.outstandingBalance)}
        hint={`Dari semua invoice aktif (${metrics.allActiveUnpaidOrPartialCount} belum lunas)`}
        icon={Wallet}
        tone={metrics.outstandingBalance > 0 ? 'amber' : 'neutral'}
        compactMobile
      />

      <AdminMetricCard
        label="Pembayaran Masuk"
        value={formatRupiah(Math.max(0, metrics.paymentsReceived))}
        hint={`${periodLabel} • ${metrics.paymentCount} masuk${
          metrics.reversalCount > 0 ? `, ${metrics.reversalCount} dibatalkan` : ''
        }`}
        icon={Banknote}
        tone="lime"
        compactMobile
      />

      <AdminMetricCard
        label="Total Invoice"
        value={metrics.totalInvoices}
        hint={`Aktif (${periodLabel.toLowerCase()})`}
        icon={FileText}
        tone="neutral"
        compactMobile
      />

      <AdminMetricCard
        label="Belum Lunas"
        value={metrics.unpaidOrPartialCount}
        hint={
          metrics.overdueCount > 0
            ? `${metrics.overdueCount} lewat tempo`
            : `Masih memiliki sisa tagihan (${periodLabel.toLowerCase()})`
        }
        icon={AlertCircle}
        tone={metrics.overdueCount > 0 ? 'orange' : 'neutral'}
        compactMobile
      />
    </dl>
  );
}
