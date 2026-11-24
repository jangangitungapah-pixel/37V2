import { CalendarDays, Clock3, Plus, RadioTower } from 'lucide-react';
import { Link } from 'react-router';

/**
 * SECTION A — Command header and primary actions.
 * Keeps the studio identity prominent without pushing operational data below the fold.
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
    <section
      aria-labelledby="dashboard-command-center-heading"
      className="relative isolate overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#151515] px-4 py-4 text-[#F8F6EF] shadow-[0_18px_42px_-22px_rgba(21,21,21,0.48)] sm:px-5 sm:py-5 lg:px-6 lg:py-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-[-3rem] h-72 w-72 rounded-full bg-[#C8F13A]/[0.13] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 left-[34%] h-64 w-64 rounded-full bg-[#FF4B22]/[0.08] blur-3xl"
      />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_190px] lg:items-end lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-[#C8F13A] px-2.5 py-1 font-mono text-[9px] font-extrabold tracking-[0.12em] text-[#151515]">
              <RadioTower className="h-3 w-3" aria-hidden="true" />
              37 / STUDIO OPERATIONS
            </span>
            <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[0.1em] text-neutral-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8F13A] shadow-[0_0_10px_rgba(200,241,58,0.85)]" />
              LIVE WORKSPACE
            </span>
            <span
              className={
                isOwner
                  ? 'inline-flex min-h-6 items-center rounded-full border border-[#C8F13A]/25 bg-[#C8F13A]/10 px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.1em] text-[#D8F67A]'
                  : 'inline-flex min-h-6 items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 font-mono text-[9px] font-bold tracking-[0.1em] text-neutral-300'
              }
            >
              {String(roleLabel || 'Staff').toUpperCase()} ACCESS
            </span>
          </div>

          <h2
            id="dashboard-command-center-heading"
            className="mt-3 text-[clamp(1.45rem,3.2vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.045em] text-white"
          >
            {greeting},{' '}
            <span className="text-[#C8F13A]">{displayName}</span>
            <span className="sr-only"> — Welcome back, {displayName}.</span>
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-neutral-300 sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
              {formattedDate}
            </span>
            <span className="text-white/25" aria-hidden="true">/</span>
            <span className="font-mono text-[10px] tracking-[0.12em] text-neutral-400">WIB · UTC+7</span>
          </div>

          <p className="mt-3 max-w-2xl text-[11.5px] leading-relaxed text-neutral-300 sm:text-xs">
            Pantau aktivitas Room A dan Room B, tindak lanjut pelanggan, serta performa studio
            dari satu ruang kendali.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Link
            to="/admin/calendar?action=new-booking"
            className="sa-btn-lime inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold sm:text-xs"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Booking Baru</span>
          </Link>

          <Link
            to="/admin/calendar"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/[0.11] sm:text-xs"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-[#C8F13A]" aria-hidden="true" />
            <span>Buka Kalender</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DashboardHeader;
