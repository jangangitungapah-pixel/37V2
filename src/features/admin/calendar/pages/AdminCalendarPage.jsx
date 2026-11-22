import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { usePricingSettings } from '@/features/admin/settings/hooks/usePricingSettings';
import { useCalendarInvoiceSummaries } from '@/features/admin/payment/hooks/useInvoicePaymentSummaries';
import { useAuth } from '@/features/auth/AuthContext';
import { backfillPublicAvailabilityProjections } from '@/features/public-availability/services/public-availability-service';

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
  isValidIsoDateString,
  shiftCalendarDate,
} from '../utils/calendar-date';

function getInitialCalendarViewMode() {
  if (typeof window === 'undefined') {
    return 'month';
  }
  return window.innerWidth < 1024 ? 'week' : 'month';
}

export function AdminCalendarPage() {
  const { user, profile, role } = useAuth();
  const { settings: pricingSettings, activeStudioServiceTypes } = usePricingSettings();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isOwner = actorRole === 'owner';
  const [isSyncingPublicCalendar, setIsSyncingPublicCalendar] = useState(false);
  const [searchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState(getInitialCalendarViewMode);
  const [activeDate, setActiveDate] = useState(() => {
    const paramDate = searchParams.get('date');
    return isValidIsoDateString(paramDate) ? paramDate : getJakartaTodayIso();
  });
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [roomFilter, setRoomFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);

  const [bookingDialogState, setBookingDialogState] = useState(() => {
    const shouldOpenNew = searchParams.get('action') === 'new-booking';
    const paramStudioId = searchParams.get('studioId');
    const paramDate = searchParams.get('date');
    const initialDate = isValidIsoDateString(paramDate) ? paramDate : getJakartaTodayIso();
    return {
      sessionKey: shouldOpenNew ? 1 : 0,
      open: shouldOpenNew,
      mode: 'create',
      initialSlot: shouldOpenNew
        ? {
            date: initialDate,
            studioId: paramStudioId === 'room-b' ? 'room-b' : 'room-a',
            startMinute: 600,
            defaultServiceId: 'rehearsal',
            defaultOptionId: 'rehearsal-regular',
          }
        : null,
      editingBooking: null,
    };
  });

  const [selectedBookingId, setSelectedBookingId] = useState(
    () => searchParams.get('bookingId') || '',
  );
  const [statusFeedback, setStatusFeedback] = useState('');

  const newBookingButtonRef = useRef(null);

  const viewDateRange = useMemo(
    () => getCalendarViewDateRange(viewMode, activeDate),
    [viewMode, activeDate],
  );

  // Single shared invoice range listener (zero N+1 per-booking listeners)
  const { invoicesByBookingId } = useCalendarInvoiceSummaries({
    startDate: viewDateRange.startDate,
    endDate: viewDateRange.endDate,
  });

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
    invoicesByBookingId,
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
    setFocusRequestKey((prev) => prev + 1);
  };

  const handleSelectDate = (nextDateIso) => {
    setActiveDate(nextDateIso);
    setFocusRequestKey((prev) => prev + 1);
  };

  const handleOpenDayView = (targetDateIso) => {
    setActiveDate(targetDateIso);
    setViewMode('day');
  };

  const handleOpenNewBooking = (slotOverride = null) => {
    const defaultService = activeStudioServiceTypes[0] || null;
    const defaultActiveServiceId = defaultService?.id || 'rehearsal';
    const defaultActiveOptionId = defaultService?.bookableOptions?.[0]?.id || 'rehearsal-regular';

    setBookingDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'create',
      initialSlot: {
        date: slotOverride?.date || activeDate,
        studioId: slotOverride?.studioId || (roomFilter === 'all' ? 'room-a' : roomFilter),
        startMinute: slotOverride?.startMinute ?? 600,
        defaultServiceId: defaultActiveServiceId,
        defaultOptionId: defaultActiveOptionId,
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

  const handleSubmitBooking = async ({
    mode,
    bookingId,
    eventId,
    expectedVersion,
    formValues,
    customerResolution = null,
  }) => {
    try {
      if (mode === 'edit' || mode === 'reschedule') {
        const updated = await updateOrRescheduleBooking({
          bookingId,
          expectedVersion,
          eventId,
          actorUid,
          formValues,
          mode,
          pricingSettings,
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
        customerResolution,
        pricingSettings,
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

  const handleSyncPublicAvailability = async () => {
    if (!isOwner || isSyncingPublicCalendar) return;
    setIsSyncingPublicCalendar(true);
    try {
      const result = await backfillPublicAvailabilityProjections({
        actorUid,
        actorRole,
        fromDateIso: getJakartaTodayIso(),
      });
      const msg = `Kalender publik berhasil disinkronkan (${result.activeProjectedCount} sesi aktif diverifikasi).`;
      setStatusFeedback(msg);
      toast.success(msg);
    } catch (err) {
      const msg = err?.message || 'Gagal menyinkronkan jadwal kalender publik.';
      toast.error(msg);
    } finally {
      setIsSyncingPublicCalendar(false);
    }
  };

  return (
    <div data-calendar-scoped="true" className="relative isolate z-0 space-y-3 sm:space-y-4">
      {/* Owner-Only Public Availability Projection Backfill / Sync Strip */}
      {isOwner ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#151515]/10 bg-white/85 px-4 py-2 text-xs text-[#46433D]">
          <span>
            <strong className="text-[#151515]">Kalender Publik (/availability):</strong> Sinkron
            otomatis untuk setiap booking baru &amp; perubahan jadwal.
          </span>
          <button
            type="button"
            onClick={handleSyncPublicAvailability}
            disabled={isSyncingPublicCalendar}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#151515]/15 bg-[#F8F6EF] px-2.5 py-1 text-[11px] font-semibold text-[#151515] transition-colors hover:bg-[#151515] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isSyncingPublicCalendar ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isSyncingPublicCalendar ? 'Menyinkronkan...' : 'Sinkronkan Data Lama (Backfill)'}
            </span>
          </button>
        </div>
      ) : null}

      {/* Operational Feedback Banner */}
      {statusFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#8BAD12]/35 bg-[#EDF8C2] px-4 py-2.5 text-xs font-medium text-[#243300] shadow-xs"
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
        onSelectDate={handleSelectDate}
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
            focusRequestKey={focusRequestKey}
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
        pricingSettings={pricingSettings}
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
