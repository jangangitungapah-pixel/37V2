import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';

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
}) {
  const todayIso = getJakartaTodayIso();
  const isTodaySelected = activeDate === todayIso;
  const periodLabel = formatIndonesianPeriodLabel(viewMode, activeDate);

  const handleDateInputChange = (event) => {
    const nextValue = event.target.value;
    if (isValidIsoDateString(nextValue)) {
      onSelectDate(nextValue);
    }
  };

  return (
    <section aria-label="Kontrol jadwal kalender studio" className="sa-card-hero p-3 sm:p-5">
      {/* Top Row: Studio Context Badges + Active Period Heading + Primary New Booking CTA */}
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
          className="sa-control sa-btn-orange inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold sm:min-h-10.5 sm:gap-2 sm:px-5 sm:py-2 sm:text-sm"
        >
          <Plus className="h-4 w-4 stroke-[2.25]" aria-hidden="true" />
          <span>
            Booking<span className="hidden sm:inline"> Baru</span>
          </span>
        </button>
      </div>

      {/* Bottom Controls Bar: Prev/Today/Next + Date Picker + Symmetric View Switcher */}
      <div className="mt-3 flex flex-col gap-2 border-t border-[#151515]/8 pt-3 sm:mt-4 sm:gap-3 sm:pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-[auto_minmax(0,1fr)] min-[340px]:items-center sm:flex sm:items-center sm:gap-2">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPreviousPeriod}
              aria-label="Periode sebelumnya"
              className="sa-control sa-btn-secondary inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-xl sm:h-10 sm:w-10"
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
                  ? 'sa-control sa-btn-lime inline-flex h-9.5 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap sm:h-10 sm:px-4'
                  : 'sa-control sa-btn-secondary inline-flex h-9.5 cursor-pointer items-center justify-center rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap text-[#46433D] sm:h-10 sm:px-4'
              }
            >
              Hari Ini
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              aria-label="Periode berikutnya"
              className="sa-control sa-btn-secondary inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-xl sm:h-10 sm:w-10"
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
              className="sa-input h-9.5 w-full min-w-0 rounded-xl px-3 py-1.5 font-mono text-xs font-medium sm:h-10 sm:w-auto"
            />
          </div>
        </div>

        <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </section>
  );
}
