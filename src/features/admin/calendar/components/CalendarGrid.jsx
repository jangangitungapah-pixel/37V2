import { AlertTriangle, Loader2 } from 'lucide-react';

import { CalendarDayView } from './CalendarDayView';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';

export function CalendarGrid({
  viewMode,
  activeDate,
  roomFilter,
  bookings,
  isLoading,
  error,
  isTruncated,
  maxLimit,
  onSelectEmptySlot,
  onSelectBooking,
  onOpenDayView,
}) {
  return (
    <div className="space-y-3">
      {/* Error Alert Banner */}
      {error ? (
        <div
          role="alert"
          className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-2.5 border-2 p-3 shadow-[2px_2px_0px_#151515]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
              GAGAL MEMUAT JADWAL KALENDER
            </p>
            <p className="mt-0.5 text-xs leading-relaxed font-semibold">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Query Limit Truncation Notice */}
      {isTruncated ? (
        <div
          role="status"
          className="border-studio-ink text-studio-ink flex items-center justify-between gap-2.5 border-2 bg-amber-100 px-3 py-2.5 text-xs font-bold shadow-[2px_2px_0px_#151515]"
        >
          <span>
            Rentang tanggal ini mencapai batas tampilan maksimum ({maxLimit} dokumen booking).
            Gunakan tampilan Week atau Day untuk melihat seluruh slot secara lengkap.
          </span>
        </div>
      ) : null}

      {/* Subtle Loading Indicator when switching date range */}
      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="border-studio-ink bg-studio-ivory text-studio-ink flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Memuat jadwal studio dari Firestore...</span>
        </div>
      ) : null}

      {/* Active View Mode Renderer */}
      {viewMode === 'day' ? (
        <CalendarDayView
          activeDate={activeDate}
          roomFilter={roomFilter}
          bookings={bookings}
          onSelectEmptySlot={onSelectEmptySlot}
          onSelectBooking={onSelectBooking}
        />
      ) : null}

      {viewMode === 'week' ? (
        <CalendarWeekView
          activeDate={activeDate}
          roomFilter={roomFilter}
          bookings={bookings}
          onSelectEmptySlot={onSelectEmptySlot}
          onSelectBooking={onSelectBooking}
          onOpenDayView={onOpenDayView}
        />
      ) : null}

      {viewMode === 'month' ? (
        <CalendarMonthView
          activeDate={activeDate}
          roomFilter={roomFilter}
          bookings={bookings}
          onSelectEmptySlot={onSelectEmptySlot}
          onSelectBooking={onSelectBooking}
          onOpenDayView={onOpenDayView}
        />
      ) : null}
    </div>
  );
}
