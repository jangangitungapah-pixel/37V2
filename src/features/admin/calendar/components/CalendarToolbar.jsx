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
    <section
      aria-label="Kontrol jadwal kalender studio"
      className="cal-card bg-studio-white p-2.5 sm:p-4"
    >
      {/* Top Row: Studio Context Badges + Active Period Heading + Primary New Booking CTA */}
      <div className="flex flex-col gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between sm:gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold tracking-wider uppercase sm:px-2 sm:text-[9px]">
              <CalendarDays className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
              <span>JADWAL STUDIO</span>
            </span>

            <span className="border-studio-ink bg-studio-ivory text-studio-ink inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase sm:px-2 sm:text-[9px]">
              <Clock3 className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
              <span>10:00 – 22:00 WIB</span>
            </span>
          </div>

          <h2 className="font-display text-studio-ink mt-1 truncate text-lg leading-none font-black tracking-tight uppercase sm:mt-1.5 sm:text-3xl">
            {periodLabel}
          </h2>
          <p className="text-studio-muted-ink mt-1 hidden text-xs font-medium sm:block">
            Kelola jadwal Room A &amp; Room B. Klik slot jam untuk membuat booking baru atau klik
            kartu jadwal untuk melihat detailnya.
          </p>
        </div>

        <button
          ref={newBookingButtonRef}
          type="button"
          onClick={() => onOpenNewBooking()}
          aria-label="New Booking"
          className="cal-control bg-studio-orange text-studio-white inline-flex min-h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1 px-3 py-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase min-[360px]:w-auto sm:min-h-11 sm:gap-1.5 sm:px-4 sm:py-2 sm:text-[11px]"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
          <span>Booking Baru</span>
        </button>
      </div>

      {/* Bottom Controls Bar: Prev/Today/Next + Date Picker + Symmetric View Switcher */}
      <div className="mt-2 flex flex-col gap-1.5 border-t border-neutral-200 pt-2 sm:mt-3 sm:gap-2 sm:pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-1.5 min-[340px]:grid-cols-[auto_minmax(0,1fr)] min-[340px]:items-center sm:flex sm:items-center sm:gap-2">
          <div className="inline-flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={onPreviousPeriod}
              aria-label="Periode sebelumnya"
              className="cal-control bg-studio-ivory text-studio-ink inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center sm:h-11 sm:w-11"
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
                  ? 'cal-control bg-studio-lime text-studio-ink inline-flex h-9 cursor-pointer items-center justify-center px-2.5 font-mono text-[10px] font-extrabold tracking-wider whitespace-nowrap uppercase sm:h-11 sm:px-3 sm:text-[11px]'
                  : 'cal-control bg-studio-ivory text-studio-ink inline-flex h-9 cursor-pointer items-center justify-center px-2.5 font-mono text-[10px] font-extrabold tracking-wider whitespace-nowrap uppercase sm:h-11 sm:px-3 sm:text-[11px]'
              }
            >
              Hari Ini
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              aria-label="Periode berikutnya"
              className="cal-control bg-studio-ivory text-studio-ink inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center sm:h-11 sm:w-11"
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
              className="border-studio-ink bg-studio-ivory text-studio-ink h-9 w-full min-w-0 border-2 px-2 py-1 font-mono text-[10.5px] font-bold shadow-[2px_2px_0px_#151515] sm:h-11 sm:w-auto sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            />
          </div>
        </div>

        <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </section>
  );
}
