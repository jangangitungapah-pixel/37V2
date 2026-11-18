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
      className="cal-card bg-studio-white p-3 sm:p-4"
    >
      {/* Top Row: Studio Context Badges + Active Period Heading + Primary New Booking CTA */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold tracking-wider uppercase">
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>STUDIO BOOKING SCHEDULE</span>
            </span>

            <span className="border-studio-ink bg-studio-ivory text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase">
              <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>10:00 – 22:00 WIB</span>
            </span>
          </div>

          <h2 className="font-display text-studio-ink mt-1.5 truncate text-xl leading-none font-black tracking-tight uppercase sm:text-3xl">
            {periodLabel}
          </h2>
          <p className="text-studio-muted-ink mt-1 hidden text-xs font-medium sm:block">
            Kelola jadwal Room A &amp; Room B secara realtime. Klik slot jam untuk menambah booking
            baru atau klik kartu sesi untuk detail operasional.
          </p>
        </div>

        <button
          ref={newBookingButtonRef}
          type="button"
          onClick={() => onOpenNewBooking()}
          className="cal-control bg-studio-orange text-studio-white inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3.5 py-2 font-mono text-[11px] font-extrabold tracking-wider uppercase sm:w-auto sm:px-4"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
          <span>New Booking</span>
        </button>
      </div>

      {/* Bottom Controls Bar: Prev/Today/Next + Date Picker + Symmetric View Switcher */}
      <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="grid w-full grid-cols-[44px_1fr_44px] items-center gap-1.5 sm:inline-flex sm:w-auto">
            <button
              type="button"
              onClick={onPreviousPeriod}
              aria-label="Periode sebelumnya"
              className="cal-control bg-studio-ivory text-studio-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onSelectToday}
              aria-pressed={isTodaySelected}
              className={
                isTodaySelected
                  ? 'cal-control bg-studio-lime text-studio-ink inline-flex h-11 cursor-pointer items-center justify-center px-3 font-mono text-[11px] font-extrabold tracking-wider uppercase'
                  : 'cal-control bg-studio-ivory text-studio-ink inline-flex h-11 cursor-pointer items-center justify-center px-3 font-mono text-[11px] font-extrabold tracking-wider uppercase'
              }
            >
              Today
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              aria-label="Periode berikutnya"
              className="cal-control bg-studio-ivory text-studio-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="calendar-date-Jump" className="sr-only">
              Pilih tanggal kalender
            </label>
            <input
              id="calendar-date-Jump"
              type="date"
              aria-label="Pilih tanggal kalender"
              value={activeDate}
              onChange={handleDateInputChange}
              className="border-studio-ink bg-studio-ivory text-studio-ink h-11 w-full border-2 px-2.5 py-1.5 font-mono text-[11px] font-bold shadow-[2px_2px_0px_#151515] sm:w-auto"
            />
          </div>
        </div>

        <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>
    </section>
  );
}
