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
      className="brutal-card bg-studio-white p-4 sm:p-6"
    >
      {/* Top Row: Context Heading + Primary New Booking Action */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold tracking-widest uppercase">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <span>STUDIO BOOKING SCHEDULE</span>
            </span>

            <span className="border-studio-ink bg-studio-ivory text-studio-ink inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-bold uppercase">
              <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>10:00 – 23:00 WIB • INTERVAL 30 MENIT</span>
            </span>
          </div>

          <h2 className="font-display text-studio-ink mt-2.5 text-2xl leading-none font-black tracking-tight uppercase sm:text-4xl">
            {periodLabel}
          </h2>
          <p className="text-studio-muted-ink mt-1 text-xs font-medium sm:text-sm">
            Kelola jadwal Room A &amp; Room B secara realtime. Klik slot waktu kosong untuk menambah
            booking atau klik kartu sesi untuk detail operasional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            ref={newBookingButtonRef}
            type="button"
            onClick={() => onOpenNewBooking()}
            className="brutal-btn bg-studio-orange text-studio-white inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 px-5 py-2.5 font-mono text-xs font-extrabold tracking-wider uppercase sm:w-auto"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
            <span>+ New Booking</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Period Navigation + Date Picker + View Mode Switcher */}
      <div className="mt-4 flex flex-col gap-3 border-t-2 border-neutral-200 pt-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPreviousPeriod}
              aria-label="Periode sebelumnya"
              className="brutal-btn bg-studio-ivory text-studio-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onSelectToday}
              aria-pressed={isTodaySelected}
              className={
                isTodaySelected
                  ? 'brutal-btn bg-studio-lime text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center px-3.5 py-2 font-mono text-xs font-extrabold tracking-wider uppercase'
                  : 'brutal-btn bg-studio-ivory text-studio-ink inline-flex min-h-11 cursor-pointer items-center justify-center px-3.5 py-2 font-mono text-xs font-extrabold tracking-wider uppercase'
              }
            >
              Today
            </button>

            <button
              type="button"
              onClick={onNextPeriod}
              aria-label="Periode berikutnya"
              className="brutal-btn bg-studio-ivory text-studio-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="calendar-date-Jump" className="sr-only">
              Pilih tanggal kalender
            </label>
            <input
              id="calendar-date-Jump"
              type="date"
              aria-label="Pilih tanggal kalender"
              value={activeDate}
              onChange={handleDateInputChange}
              className="border-studio-ink bg-studio-ivory text-studio-ink min-h-11 border-2 px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0px_#151515]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <CalendarViewSwitcher viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </div>
      </div>
    </section>
  );
}
