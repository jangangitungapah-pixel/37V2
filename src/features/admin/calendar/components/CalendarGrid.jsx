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
    <div className="space-y-4">
      {/* Error Alert Banner */}
      {error ? (
        <div
          role="alert"
          className="border-studio-ink bg-studio-orange text-studio-white flex items-start gap-3 border-2 p-4 shadow-[3px_3px_0px_#151515]"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-xs font-extrabold tracking-wider uppercase">
              GAGAL MEMUAT JADWAL KALENDER
            </p>
            <p className="mt-1 text-xs leading-relaxed font-semibold sm:text-sm">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Query Limit Truncation Notice */}
      {isTruncated ? (
        <div
          role="status"
          className="border-studio-ink text-studio-ink flex items-center justify-between gap-3 border-2 bg-amber-100 px-4 py-3 text-xs font-bold shadow-[2px_2px_0px_#151515]"
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
          className="border-studio-ink bg-studio-ivory text-studio-ink flex items-center gap-2 border px-3.5 py-2 font-mono text-xs font-bold"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
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
