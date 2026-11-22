import {
  AlertCircle,
  CalendarCheck2,
  Clock,
  CreditCard,
  Radio,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import { AdminButton, AdminMetricCard, AdminSurface } from '@/features/admin/design-system';

import { formatDashboardRupiah } from '../utils/dashboard-calculations';

/**
 * SECTION B — Today's Overview (4 Primary Operational Metrics)
 *
 * Mobile: 2x2 compact grid. Desktop: 4-column row.
 * Role-Adaptive 4th Tile:
 * - Owner: `Kas Masuk Hari Ini` (net valid paymentTransactions minus reversals today in WIB)
 * - Staff: `Sesi Akan Datang` (today's upcoming sessions awaiting check-in; zero financial leak)
 */
export function DashboardTodayOverview({
  todayOverview,
  isOwner = false,
  isLoading = false,
  error = null,
  onRetry,
}) {
  if (error) {
    return (
      <AdminSurface
        as="section"
        aria-label="Ringkasan operasional hari ini"
        variant="card"
        className="flex flex-col items-start justify-between gap-3 border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-red-900">
              Gagal memuat ringkasan operasional hari ini
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
      </AdminSurface>
    );
  }

  if (isLoading) {
    return (
      <section
        aria-label="Memuat ringkasan operasional hari ini"
        className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4"
      >
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-24 animate-pulse rounded-2xl border border-[#151515]/[0.07] bg-white/80 p-3.5 sm:h-28 sm:p-4"
          >
            <div className="h-3 w-24 rounded bg-[#151515]/10" />
            <div className="mt-3 h-6 w-16 rounded bg-[#151515]/15" />
            <div className="mt-2 hidden h-2.5 w-32 rounded bg-[#151515]/10 sm:block" />
          </div>
        ))}
      </section>
    );
  }

  const activeCount = todayOverview?.todayActiveBookingsCount ?? 0;
  const inProgressCount = todayOverview?.inProgressSessionsCount ?? 0;
  const upcomingCount = todayOverview?.upcomingSessionsCount ?? 0;
  const completedCount = todayOverview?.completedSessionsCount ?? 0;
  const unpaidCount = todayOverview?.unpaidBookingsCount ?? 0;
  const unpaidBalanceDue = todayOverview?.unpaidBookingsBalanceDue ?? 0;
  const unverifiedCount = todayOverview?.unverifiedInvoiceBookingsCount ?? 0;

  let unpaidHint = 'Seluruh sesi terverifikasi hari ini sudah lunas';
  if (unpaidCount > 0 && unverifiedCount > 0) {
    unpaidHint = `Sisa tagihan ${formatDashboardRupiah(unpaidBalanceDue)} • ${unverifiedCount} sesi belum terverifikasi`;
  } else if (unpaidCount > 0) {
    unpaidHint = `Sisa tagihan hari ini ${formatDashboardRupiah(unpaidBalanceDue)}`;
  } else if (unverifiedCount > 0) {
    unpaidHint = `${unverifiedCount} sesi belum memiliki data invoice terverifikasi`;
  }

  const cashInNet = todayOverview?.todayCashIn?.netCashIn ?? 0;
  const paymentCount = todayOverview?.todayCashIn?.paymentCount ?? 0;
  const reversalCount = todayOverview?.todayCashIn?.reversalCount ?? 0;

  let cashInHint = 'Belum ada pembayaran masuk hari ini (WIB)';
  if (paymentCount > 0 || reversalCount > 0) {
    cashInHint =
      reversalCount > 0
        ? `${paymentCount} pembayaran masuk • ${reversalCount} koreksi (reversal)`
        : `${paymentCount} transaksi pembayaran diterima hari ini`;
  }

  return (
    <section
      aria-label="Ringkasan operasional hari ini"
      className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4"
    >
      <AdminMetricCard
        label="Booking Hari Ini"
        value={`${activeCount} Sesi`}
        hint={`${completedCount} selesai • ${upcomingCount} akan datang`}
        icon={CalendarCheck2}
        tone="neutral"
        compactMobile
      />

      <AdminMetricCard
        label="Sesi Berlangsung"
        value={`${inProgressCount} Sesi`}
        hint={
          inProgressCount > 0
            ? 'Sesi sedang aktif di ruang studio'
            : 'Tidak ada sesi yang sedang berlangsung'
        }
        icon={Radio}
        tone={inProgressCount > 0 ? 'lime' : 'neutral'}
        compactMobile
      />

      <AdminMetricCard
        label="Booking Belum Lunas"
        value={`${unpaidCount} Sesi`}
        hint={unpaidHint}
        icon={CreditCard}
        tone={unpaidCount > 0 ? 'orange' : unverifiedCount > 0 ? 'amber' : 'emerald'}
        compactMobile
      />

      {isOwner ? (
        <AdminMetricCard
          label="Kas Masuk Hari Ini"
          value={formatDashboardRupiah(cashInNet)}
          hint={cashInHint}
          icon={Wallet}
          tone="ink"
          compactMobile
        />
      ) : (
        <AdminMetricCard
          label="Sesi Akan Datang"
          value={`${upcomingCount} Sesi`}
          hint={
            upcomingCount > 0
              ? 'Menunggu kedatangan & check-in pelanggan hari ini'
              : 'Tidak ada antrian sesi berikutnya hari ini'
          }
          icon={Clock}
          tone={upcomingCount > 0 ? 'amber' : 'neutral'}
          compactMobile
        />
      )}
    </section>
  );
}
