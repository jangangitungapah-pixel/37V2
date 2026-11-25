import { useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router';

import {
  formatIndonesianPeriodLabel,
  getJakartaTodayIso,
  isValidIsoDateString,
} from '../utils/calendar-date';
import { CalendarViewSwitcher } from './CalendarViewSwitcher';

export function CalendarToolbar({
  viewMode,
  activeDate,
  onViewModeChange,
  onPreviousPeriod,
  onNextPeriod,
  onSelectToday,
  onSelectDate,
  onOpenNewBooking,
  newBookingButtonRef,
  showPublicAvailabilityStatus = false,
  isPublicScheduleReady = false,
  isPublicMetaLoading = false,
  publicMetaError = '',
  isSyncingPublicCalendar = false,
  publicSyncError = '',
  publicSyncedAtLabel = '',
  isPublicSyncDisabled = false,
  onSyncPublicAvailability,
}) {
  const [isPublicStatusExpanded, setIsPublicStatusExpanded] = useState(false);
  const todayIso = getJakartaTodayIso();
  const isTodaySelected = activeDate === todayIso;
  const periodLabel = formatIndonesianPeriodLabel(viewMode, activeDate);
  const isPublicStatusHealthy = isPublicScheduleReady && !publicSyncError;
  const needsPublicAttention = Boolean(
    publicSyncError ||
    (!isPublicMetaLoading && !publicMetaError && !isPublicScheduleReady),
  );
  const compactSyncTime = publicSyncedAtLabel.split(',').pop()?.trim().replace(/\\s*WIB$/, '') || '';

  let publicStatusLabel = 'Status diperiksa';
  let PublicStatusIcon = Loader2;
  let publicStatusClasses = 'border-[#151515]/10 bg-white/80 text-[#46433D]';
  if (isSyncingPublicCalendar) {
    publicStatusLabel = 'Menyinkronkan';
    PublicStatusIcon = RefreshCw;
  } else if (isPublicStatusHealthy) {
    publicStatusLabel = 'Publik Aktif';
    PublicStatusIcon = CheckCircle2;
    publicStatusClasses = 'border-[#8BAD12]/25 bg-[#EDF8C2]/65 text-[#344D0A]';
  } else if (needsPublicAttention) {
    publicStatusLabel = publicSyncError ? 'Sinkronisasi Bermasalah' : 'Publik Belum Aktif';
    PublicStatusIcon = AlertTriangle;
    publicStatusClasses = 'border-[#FF4B22]/25 bg-[#FFF1E9] text-[#9D341D]';
  } else if (publicMetaError) {
    publicStatusLabel = 'Status Tidak Tersedia';
    PublicStatusIcon = AlertTriangle;
    publicStatusClasses = 'border-[#FF4B22]/25 bg-[#FFF1E9] text-[#9D341D]';
  }

  const publicStatusDescription = isSyncingPublicCalendar
    ? 'Sinkronisasi kalender publik sedang berjalan.'
    : publicSyncError
      ? publicSyncError
      : publicMetaError
        ? publicMetaError
        : isPublicScheduleReady
          ? 'Jadwal publik tersinkron otomatis untuk setiap booking baru dan perubahan jadwal.'
          : isPublicMetaLoading
            ? 'Sedang memeriksa status kalender publik.'
            : 'Kalender publik belum aktif. Sinkronkan agar pengunjung dapat melihat ketersediaan slot.';

  const shouldShowSyncAction =
    !isPublicMetaLoading && (!isPublicScheduleReady || Boolean(publicSyncError));

  const handleDateInputChange = (event) => {
    const nextValue = event.target.value;
    if (isValidIsoDateString(nextValue)) {
      onSelectDate(nextValue);
    }
  };

  return (
    <section aria-label="Kontrol jadwal kalender studio" className="sa-card-hero p-3 sm:p-5">
      {/* Primary Period Heading + New Booking Action */}
      <div className="flex flex-row items-center justify-between gap-2.5 sm:gap-4">
        <div className="min-w-0">
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex sm:gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8BAD12]/35 bg-[#EDF8C2] px-2.5 py-0.5 text-[11px] font-medium text-[#243300]">
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Jadwal Studio</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#151515]/10 bg-[#151515]/[0.045] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#46433D] tabular-nums">
              <Clock3 className="h-3 w-3 shrink-0 text-[#666159]" aria-hidden="true" />
              <span>10:00 – 22:00 WIB</span>
            </span>
          </div>

          <h2 className="text-studio-ink truncate text-lg font-bold tracking-tight sm:mt-2 sm:text-2xl">
            {periodLabel}
          </h2>
          <p className="mt-1 hidden text-sm text-[#46433D] sm:block">
            Kelola jadwal Room A &amp; Room B. Klik slot jam untuk membuat booking baru atau klik
            kartu jadwal untuk melihat detailnya.
          </p>
        </div>

        <button
          ref={newBookingButtonRef}
          type="button"
          onClick={() => onOpenNewBooking()}
          aria-label="New Booking"
          className="sa-control sa-btn-orange inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold sm:min-h-10.5 sm:gap-2 sm:px-5 sm:py-2 sm:text-sm"
        >
          <Plus className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
          <span>
            Booking<span className="hidden sm:inline"> Baru</span>
          </span>
        </button>
      </div>

      {/* Owner-only public availability status — compact by default, expandable on demand */}
      {showPublicAvailabilityStatus ? (
        <div className="mt-3 border-t border-[#151515]/[0.07] pt-2.5 sm:mt-4 sm:pt-3">
          <button
            type="button"
            aria-label={`Status Kalender Publik: ${publicStatusLabel}`}
            aria-expanded={isPublicStatusExpanded}
            aria-controls="calendar-public-status-details"
            onClick={() => setIsPublicStatusExpanded((previous) => !previous)}
            className={`group flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:border-[#151515]/20 ${publicStatusClasses}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <PublicStatusIcon
                className={`h-3.5 w-3.5 shrink-0 ${isSyncingPublicCalendar || isPublicMetaLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="truncate text-xs font-semibold">{publicStatusLabel}</span>
              <span className="hidden h-1 w-1 shrink-0 rounded-full bg-current opacity-50 sm:inline-block" aria-hidden="true" />
              <span className="hidden truncate text-[11px] font-medium opacity-75 sm:inline">
                Kalender Publik
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-2">
              {compactSyncTime && isPublicStatusHealthy ? (
                <>
                  <span className="font-mono text-[10px] font-medium tabular-nums sm:hidden">
                    {compactSyncTime}
                  </span>
                  <span className="hidden font-mono text-[10px] font-medium tabular-nums opacity-75 sm:inline">
                    Terakhir {publicSyncedAtLabel}
                  </span>
                </>
              ) : null}
              <ChevronDown
                className={`h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 ${isPublicStatusExpanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </span>
          </button>

          {isPublicStatusExpanded ? (
            <div
              id="calendar-public-status-details"
              role="region"
              aria-label="Detail Kalender Publik"
              className="mt-2.5 flex flex-col gap-3 rounded-xl border border-[#151515]/[0.07] bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#151515]">
                  {isPublicStatusHealthy ? 'Ketersediaan publik aktif' : publicStatusLabel}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#666159]">
                  {publicStatusDescription}
                </p>
                {publicSyncedAtLabel && !isPublicStatusHealthy ? (
                  <p className="mt-1 font-mono text-[10px] text-[#666159]">
                    Terakhir sinkron: {publicSyncedAtLabel}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {isPublicScheduleReady ? (
                  <Link
                    to="/availability"
                    className="inline-flex min-h-9.5 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-[#46433D] underline underline-offset-2 hover:text-[#FF4B22]"
                  >
                    Lihat Kalender
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ) : null}

                {shouldShowSyncAction ? (
                  <button
                    type="button"
                    onClick={() => void onSyncPublicAvailability?.()}
                    disabled={isPublicSyncDisabled}
                    className="sa-control sa-btn-primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isSyncingPublicCalendar ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isSyncingPublicCalendar ? 'Menyinkronkan...' : publicSyncError ? 'Coba Sinkronkan' : 'Aktifkan & Sinkronkan'}</span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Period Navigation + Date Picker + View Switcher */}
      <div className="mt-3 flex flex-col gap-2 border-t border-[#151515]/8 pt-3 sm:mt-4 sm:gap-3 sm:pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-[auto_minmax(0,1fr)] min-[340px]:items-center sm:flex sm:items-center sm:gap-2">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPreviousPeriod}
              aria-label="Periode sebelumnya"
              className="sa-control sa-btn-secondary inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onSelectToday}
              aria-label="Today"
              aria-pressed={isTodaySelected}
              className={
                isTodaySelected
                  ? 'sa-control sa-btn-lime inline-flex h-10 min-h-10 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap sm:px-4'
                  : 'sa-control sa-btn-secondary inline-flex h-10 min-h-10 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap text-[#46433D] sm:px-4'
              }
            >
              Hari Ini
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              aria-label="Periode berikutnya"
              className="sa-control sa-btn-secondary inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="min-w-0 sm:w-auto">
            <label htmlFor="calendar-date-Jump" className="sr-only">
              Pilih tanggal kalender
            </label>
            <input
              id="calendar-date-Jump"
              type="date"
              aria-label="Pilih tanggal kalender"
              value={activeDate}
              onChange={handleDateInputChange}
              className="sa-input h-10 w-full min-w-0 rounded-xl px-3 py-1.5 font-mono text-xs font-medium sm:w-auto"
            />
          </div>
        </div>

        <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </section>
  );
}
