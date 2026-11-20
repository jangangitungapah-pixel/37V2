import { AlertTriangle, Loader2 } from 'lucide-react';

import { CalendarDayView } from './CalendarDayView';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';

export function CalendarGrid({
  viewMode,
  activeDate,
  focusRequestKey = 0,
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
          className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-[#B92B0C] shadow-xs"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">Gagal memuat jadwal kalender</p>
            <p className="mt-0.5 text-xs leading-relaxed opacity-90">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Query Limit Truncation Notice */}
      {isTruncated ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2.5 rounded-2xl border border-amber-500/25 bg-[#FEF4DD] px-4 py-3 text-xs font-medium text-[#8A4B08]"
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
          className="flex items-center gap-2 rounded-xl border border-[#151515]/10 bg-[#F8F6EF] px-3.5 py-2 text-xs font-medium text-[#46433D]"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#666159]" aria-hidden="true" />
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
          focusRequestKey={focusRequestKey}
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
          focusRequestKey={focusRequestKey}
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
