import { Calendar, Clock, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

/**
 * SECTION A — Header & Quick Actions
 * Displays time-sensitive Asia/Jakarta greeting, formatted Indonesian date,
 * operational subtitle, and direct actions (`Booking Baru` and `Buka Kalender`).
 */
export function DashboardHeader({
  displayName = 'Studio Team',
  roleLabel = 'Staff',
  isOwner = false,
  greetingInfo,
}) {
  const greeting = greetingInfo?.greeting || 'Selamat datang';
  const formattedDate = greetingInfo?.formattedDateFull || '-';

  return (
    <AdminSurface
      as="section"
      variant="hero"
      aria-labelledby="dashboard-command-center-heading"
      className="relative overflow-hidden p-3.5 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <AdminStatusBadge tone="ink" dot>
              Studio Command Center
            </AdminStatusBadge>
            <AdminStatusBadge tone={isOwner ? 'lime' : 'ivory'} className="hidden sm:inline-flex">
              AKSES: {String(roleLabel || 'Staff').toUpperCase()}
            </AdminStatusBadge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-white/80 px-2 py-0.5 font-mono text-[10.5px] font-medium text-[#46433D] sm:px-2.5 sm:text-[11px]">
              <Clock className="h-3 w-3 text-[#658800]" aria-hidden="true" />
              <span>{formattedDate} • WIB</span>
            </span>
          </div>

          <h2
            id="dashboard-command-center-heading"
            className="text-lg font-extrabold tracking-tight text-[#151515] sm:text-2xl"
          >
            {greeting}, {displayName}
            <span className="sr-only"> — Welcome back, {displayName}.</span>
          </h2>

          <p className="max-w-2xl text-xs leading-relaxed text-[#5C5850] sm:text-sm">
            Pantau jadwal sesi Room A &amp; Room B hari ini, status pelunasan tagihan, antrian
            tindak lanjut operasional, dan performa studio secara real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 lg:shrink-0">
          <Link
            to="/admin/calendar?action=new-booking"
            className="sa-btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Booking Baru</span>
          </Link>

          <Link
            to="/admin/calendar"
            className="sa-btn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:flex-initial sm:text-[13px]"
          >
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Buka Kalender</span>
          </Link>
        </div>
      </div>
    </AdminSurface>
  );
}
