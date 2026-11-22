import {
  AlertTriangle,
  ArrowUpRight,
  CalendarPlus,
  Clock,
  DoorOpen,
  Music2,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  AdminButton,
  AdminEmptyState,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

/**
 * SECTION C — Today's Studio Schedule
 * Chronological operational agenda grouped by studio room (`Room A` & `Room B`)
 * for today's Jakarta date (`WIB`).
 */
export function DashboardTodaySchedule({
  todaySchedule,
  formattedDateFull = '',
  isLoading = false,
  error = null,
  isTruncated = false,
  maxLimit = 300,
  onRetry,
}) {
  const rooms = todaySchedule?.rooms || [];
  const totalActiveSessions = todaySchedule?.totalActiveSessions ?? 0;

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="dashboard-today-schedule-heading"
      className="space-y-4 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-2 border-b border-[#151515]/[0.07] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="dashboard-today-schedule-heading"
              className="text-base font-bold tracking-tight text-[#151515]"
            >
              Jadwal Studio Hari Ini
            </h3>
            <AdminStatusBadge tone="ivory" size="sm">
              {totalActiveSessions} Sesi Aktif
            </AdminStatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-[#666159]">
            Agenda kronologis Room A &amp; Room B untuk {formattedDateFull || 'hari ini'} (WIB).
          </p>
        </div>

        <Link
          to="/admin/calendar"
          className="inline-flex items-center gap-1.5 self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#46433D] transition-colors hover:bg-[#151515]/[0.05] hover:text-[#151515] sm:self-auto"
        >
          <span>Lihat Timeline Penuh</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {isTruncated ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-[#FEF4DD] px-3.5 py-2.5 text-xs text-[#8A4B08]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Menampilkan {maxLimit} sesi pertama untuk hari ini. Buka modul Kalender untuk meninjau
            jadwal secara menyeluruh.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 sm:flex-row sm:items-center">
          <p className="text-xs font-medium text-red-800">{error}</p>
          {onRetry ? (
            <AdminButton variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Muat Ulang</span>
            </AdminButton>
          ) : null}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="space-y-2.5 rounded-2xl border border-[#151515]/[0.07] bg-[#F8F6EF]/60 p-3.5"
            >
              <div className="h-4 w-28 animate-pulse rounded bg-[#151515]/10" />
              <div className="h-16 animate-pulse rounded-xl bg-white/80" />
              <div className="h-16 animate-pulse rounded-xl bg-white/80" />
            </div>
          ))}
        </div>
      ) : totalActiveSessions === 0 ? (
        <AdminEmptyState
          icon={CalendarPlus}
          title="Belum ada sesi terjadwal hari ini"
          description="Room A dan Room B belum memiliki sesi aktif untuk tanggal hari ini. Tambahkan jadwal latihan atau rekaman baru langsung dari kalender."
          action={
            <Link
              to="/admin/calendar?action=new-booking"
              className="sa-btn-primary inline-flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buat Booking Hari Ini</span>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <div
              key={room.id}
              data-testid={`dashboard-schedule-${room.id}`}
              className="flex flex-col rounded-2xl border border-[#151515]/[0.08] bg-[#F8F6EF]/75 p-3.5 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 shrink-0 text-[#46433D]" aria-hidden="true" />
                    <h4 className="text-sm font-bold text-[#151515]">{room.label}</h4>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-[#666159]">{room.subtitle}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {room.inProgressCount > 0 ? (
                    <AdminStatusBadge tone="lime" size="sm" dot>
                      {room.inProgressCount} Live
                    </AdminStatusBadge>
                  ) : null}
                  <AdminStatusBadge tone="neutral" size="sm">
                    {room.sessions.length} Sesi
                  </AdminStatusBadge>
                </div>
              </div>

              {room.sessions.length === 0 ? (
                <div className="my-auto flex flex-col items-center justify-center rounded-xl border border-dashed border-[#151515]/12 bg-white/60 px-4 py-7 text-center">
                  <Music2 className="h-5 w-5 text-[#666159]" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-[#151515]">
                    Tidak ada sesi aktif di {room.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#666159]">
                    Slot waktu {room.label} tersedia untuk booking baru hari ini.
                  </p>
                  <Link
                    to={`/admin/calendar?action=new-booking&studioId=${encodeURIComponent(room.id)}`}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#658800] hover:underline"
                  >
                    <span>Jadwalkan {room.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <ul className="mt-3 space-y-2.5" aria-label={`Daftar sesi ${room.label} hari ini`}>
                  {room.sessions.map((session) => (
                    <li
                      key={session.id}
                      className="group rounded-xl border border-[#151515]/[0.08] bg-white p-3 shadow-2xs transition-all hover:border-[#151515]/20 hover:shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#151515] px-2.5 py-1 font-mono text-xs font-bold text-[#F8F6EF] tabular-nums">
                          <Clock className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
                          <span>{session.timeRangeLabel}</span>
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <AdminStatusBadge
                            tone={session.sessionStatusTone}
                            size="sm"
                            dot={session.sessionStatus === 'in_progress'}
                          >
                            {session.sessionStatusLabel}
                          </AdminStatusBadge>
                          <AdminStatusBadge tone={session.paymentBadge.tone} size="sm">
                            {session.paymentBadge.shortLabel}
                          </AdminStatusBadge>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#151515]">
                            {session.customerName}
                            {session.bandName ? (
                              <span className="font-normal text-[#666159]">
                                {' '}
                                • {session.bandName}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[#5C5850]">
                            {session.serviceLabel}
                          </p>
                        </div>

                        <Link
                          to={session.calendarHref}
                          aria-label={`Buka detail sesi ${session.customerName} di Kalender`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#151515]/10 bg-[#F8F6EF] px-2.5 py-1 text-[11px] font-semibold text-[#151515] transition-colors hover:bg-[#151515] hover:text-white"
                        >
                          <span>Detail</span>
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}
