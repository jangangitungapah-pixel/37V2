import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/features/auth/AuthContext';

import { BookingDetailDrawer } from '../components/BookingDetailDrawer';
import { BookingFormDialog } from '../components/BookingFormDialog';
import { CalendarFilters } from '../components/CalendarFilters';
import { CalendarGrid } from '../components/CalendarGrid';
import { CalendarToolbar } from '../components/CalendarToolbar';
import { UpcomingBookings } from '../components/UpcomingBookings';
import { useCalendarBookings } from '../hooks/useCalendarBookings';
import {
  createBooking,
  mapBookingErrorToMessage,
  transitionBookingSession,
  updateOrRescheduleBooking,
} from '../services/calendar-booking-service';
import {
  getCalendarViewDateRange,
  getJakartaTodayIso,
  shiftCalendarDate,
} from '../utils/calendar-date';

function getInitialCalendarViewMode() {
  if (typeof window === 'undefined') {
    return 'month';
  }
  return window.innerWidth < 1024 ? 'week' : 'month';
}

export function AdminCalendarPage() {
  const { user, profile } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';

  const [viewMode, setViewMode] = useState(getInitialCalendarViewMode);
  const [activeDate, setActiveDate] = useState(() => getJakartaTodayIso());
  const [roomFilter, setRoomFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const [bookingDialogState, setBookingDialogState] = useState({
    sessionKey: 0,
    open: false,
    mode: 'create',
    initialSlot: null,
    editingBooking: null,
  });

  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [statusFeedback, setStatusFeedback] = useState('');

  const newBookingButtonRef = useRef(null);

  const viewDateRange = useMemo(
    () => getCalendarViewDateRange(viewMode, activeDate),
    [viewMode, activeDate],
  );

  const {
    allBookings,
    activeSlotBookings,
    filteredBookings,
    upcomingBookings,
    isLoading,
    error,
    isTruncated,
    maxLimit,
  } = useCalendarBookings({
    startDate: viewDateRange.startDate,
    endDate: viewDateRange.endDate,
    roomFilter,
    paymentFilter,
    showCancelled,
    searchQuery,
  });

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return allBookings.find((item) => item.id === selectedBookingId) || null;
  }, [allBookings, selectedBookingId]);

  const handlePreviousPeriod = () => {
    setActiveDate((prev) => shiftCalendarDate(viewMode, prev, -1));
  };

  const handleNextPeriod = () => {
    setActiveDate((prev) => shiftCalendarDate(viewMode, prev, 1));
  };

  const handleSelectToday = () => {
    setActiveDate(getJakartaTodayIso());
  };

  const handleOpenDayView = (targetDateIso) => {
    setActiveDate(targetDateIso);
    setViewMode('day');
  };

  const handleOpenNewBooking = (slotOverride = null) => {
    setBookingDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'create',
      initialSlot: {
        date: slotOverride?.date || activeDate,
        studioId: slotOverride?.studioId || (roomFilter === 'all' ? 'room-a' : roomFilter),
        startMinute: slotOverride?.startMinute ?? 600,
      },
      editingBooking: null,
    }));
  };

  const handleOpenEditBooking = (booking) => {
    setBookingDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'edit',
      initialSlot: null,
      editingBooking: booking,
    }));
  };

  const handleOpenRescheduleBooking = (booking) => {
    setBookingDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'reschedule',
      initialSlot: null,
      editingBooking: booking,
    }));
  };

  const handleSubmitBooking = async ({ mode, bookingId, eventId, expectedVersion, formValues }) => {
    try {
      if (mode === 'edit' || mode === 'reschedule') {
        const updated = await updateOrRescheduleBooking({
          bookingId,
          expectedVersion,
          eventId,
          actorUid,
          formValues,
          mode,
        });
        const message =
          mode === 'reschedule'
            ? `Jadwal booking "${updated.customerName}" berhasil di-reschedule.`
            : `Perubahan booking "${updated.customerName}" berhasil disimpan.`;
        setStatusFeedback(message);
        toast.success(message);
        setSelectedBookingId(updated.id);
        return updated;
      }

      const created = await createBooking({
        bookingId,
        eventId,
        actorUid,
        formValues,
      });
      const message = `Booking baru untuk "${created.customerName}" berhasil disimpan.`;
      setStatusFeedback(message);
      toast.success(message);
      return created;
    } catch (err) {
      const readableMessage = mapBookingErrorToMessage(err);
      toast.error(readableMessage);
      const wrappedError = new Error(readableMessage);
      wrappedError.code = err?.code || 'booking/failed';
      throw wrappedError;
    }
  };

  const handleLifecycleAction = async ({ booking, action, note, eventId }) => {
    try {
      const updated = await transitionBookingSession({
        bookingId: booking.id,
        action,
        expectedVersion: booking.version,
        eventId,
        actorUid,
        note,
      });
      const message = `Status operasional booking "${updated.customerName}" berhasil diperbarui.`;
      setStatusFeedback(message);
      toast.success(message);
      return updated;
    } catch (err) {
      const readableMessage = mapBookingErrorToMessage(err);
      toast.error(readableMessage);
      const wrappedError = new Error(readableMessage);
      wrappedError.code = err?.code || 'booking/lifecycle-failed';
      throw wrappedError;
    }
  };

  return (
    <div data-calendar-scoped="true" className="space-y-3.5 sm:space-y-4">
      {/* Operational Feedback Banner */}
      {statusFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="border-studio-ink bg-studio-lime text-studio-ink flex items-center justify-between gap-2.5 border-2 px-3 py-2 text-xs font-extrabold shadow-[2px_2px_0px_#151515]"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{statusFeedback}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusFeedback('')}
            aria-label="Tutup notifikasi status"
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* 1. Calendar Control Toolbar */}
      <CalendarToolbar
        viewMode={viewMode}
        activeDate={activeDate}
        onViewModeChange={setViewMode}
        onPreviousPeriod={handlePreviousPeriod}
        onNextPeriod={handleNextPeriod}
        onSelectToday={handleSelectToday}
        onSelectDate={setActiveDate}
        onOpenNewBooking={() => handleOpenNewBooking()}
        newBookingButtonRef={newBookingButtonRef}
      />

      {/* 2. Room, Payment Status & Search Filters */}
      <CalendarFilters
        roomFilter={roomFilter}
        onRoomFilterChange={setRoomFilter}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        showCancelled={showCancelled}
        onToggleShowCancelled={() => setShowCancelled((prev) => !prev)}
        totalVisibleCount={filteredBookings.length}
      />

      {/* 3. Main Workspace Split: Timeline Grid + Upcoming Bookings Sidebar */}
      <div className="grid grid-cols-1 items-start gap-3.5 sm:gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8 2xl:col-span-9">
          <CalendarGrid
            viewMode={viewMode}
            activeDate={activeDate}
            roomFilter={roomFilter}
            bookings={filteredBookings}
            isLoading={isLoading}
            error={error}
            isTruncated={isTruncated}
            maxLimit={maxLimit}
            onSelectEmptySlot={(slot) => handleOpenNewBooking(slot)}
            onSelectBooking={(booking) => setSelectedBookingId(booking.id)}
            onOpenDayView={handleOpenDayView}
          />
        </div>

        <aside className="min-w-0 xl:col-span-4 2xl:col-span-3">
          <UpcomingBookings
            bookings={upcomingBookings}
            onSelectBooking={(booking) => setSelectedBookingId(booking.id)}
            onOpenNewBooking={() => handleOpenNewBooking()}
          />
        </aside>
      </div>

      {/* 4. Adaptive 4-Step Booking Form Modal */}
      <BookingFormDialog
        key={bookingDialogState.sessionKey}
        open={bookingDialogState.open}
        mode={bookingDialogState.mode}
        initialSlot={bookingDialogState.initialSlot}
        editingBooking={bookingDialogState.editingBooking}
        existingBookings={activeSlotBookings}
        onOpenChange={(nextOpen) =>
          setBookingDialogState((prev) => ({
            ...prev,
            open: nextOpen,
          }))
        }
        onSubmitBooking={handleSubmitBooking}
        returnFocusRef={newBookingButtonRef}
      />

      {/* 5. Slide-Over Booking Detail Drawer */}
      <BookingDetailDrawer
        key={selectedBooking?.id || 'closed'}
        booking={selectedBooking}
        open={Boolean(selectedBooking)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedBookingId('');
          }
        }}
        onEditBooking={(booking) => handleOpenEditBooking(booking)}
        onRescheduleBooking={(booking) => handleOpenRescheduleBooking(booking)}
        onLifecycleAction={handleLifecycleAction}
      />
    </div>
  );
}

export default AdminCalendarPage;
