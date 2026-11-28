import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import {
  BOOKING_REQUEST_STATUS,
  BOOKING_REQUEST_TYPES,
} from '@/features/admin/booking-requests/config/booking-request-config';
import { getBookingRequestRepositoryAdapter } from '@/features/admin/booking-requests/repositories/booking-request-repository';
import { mapPublicServiceToInternalPricing } from '@/features/admin/booking-requests/utils/booking-request-normalize';
import { useBookingPolicies } from '@/features/admin/settings/booking-policies/hooks/useBookingPolicies';
import { usePricingSettings } from '@/features/admin/settings/hooks/usePricingSettings';
import { useCalendarInvoiceSummaries } from '@/features/admin/payment/hooks/useInvoicePaymentSummaries';
import { useAuth } from '@/features/auth/AuthContext';
import { useFactoryResetStatus } from '@/features/admin/settings/danger-area/hooks/useFactoryReset';
import { useOptionalOwnerPublicAvailabilitySync } from '@/features/public-availability/context/OwnerPublicAvailabilitySyncContext';
import { useOwnerPublicAvailabilityAutoSync } from '@/features/public-availability/hooks/useOwnerPublicAvailabilityAutoSync';

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
  formatIndonesianTimestamp,
  getCalendarViewDateRange,
  getJakartaTodayIso,
  isValidIsoDateString,
  shiftCalendarDate,
} from '../utils/calendar-date';

function getInitialCalendarViewMode() {
  if (typeof window === 'undefined') {
    return 'month';
  }
  return window.innerWidth < 768 ? 'day' : window.innerWidth < 1024 ? 'week' : 'month';
}

export function AdminCalendarPage() {
  const { user, profile, role } = useAuth();
  const {
    settings: pricingSettings,
    activeStudioServiceTypes,
    isLoading: isPricingLoading,
  } = usePricingSettings();
  const { policies: bookingPolicies } = useBookingPolicies();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isOwner = actorRole === 'owner';
  const { isLocked: isFactoryResetLocked } = useFactoryResetStatus({ enabled: isOwner });
  const contextAvailabilitySync = useOptionalOwnerPublicAvailabilitySync();
  const standaloneAvailabilitySync = useOwnerPublicAvailabilityAutoSync({
    enabled: !contextAvailabilitySync && isOwner && !isFactoryResetLocked,
    actorUid,
    actorRole,
  });
  const availabilitySync = contextAvailabilitySync || standaloneAvailabilitySync;
  const {
    metadata: publicMetadata,
    isReady: isPublicScheduleReady,
    isLoading: isPublicMetaLoading,
    metaError: publicMetaError,
    isSyncing: isSyncingPublicCalendar,
    syncError: publicSyncError,
  } = availabilitySync;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestIdParam = searchParams.get('requestId') || '';
  const offerIdParam = searchParams.get('offerId') || '';
  const isRequestAction = searchParams.get('action') === 'new-booking' && Boolean(requestIdParam);

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
  const [requestLoadError, setRequestLoadError] = useState('');

  const [bookingDialogState, setBookingDialogState] = useState(() => {
    const shouldOpenNew =
      searchParams.get('action') === 'new-booking' && !searchParams.get('requestId');
    const paramStudioId = searchParams.get('studioId');
    const paramDate = searchParams.get('date');
    const initialDate = isValidIsoDateString(paramDate) ? paramDate : getJakartaTodayIso();
    return {
      sessionKey: shouldOpenNew ? 1 : 0,
      open: shouldOpenNew,
      mode: 'create',
      sourceBookingRequest: null,
      sourceOffer: null,
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

  const loadedRequestKeyRef = useRef('');

  useEffect(() => {
    if (!isRequestAction || !requestIdParam || isPricingLoading) {
      return undefined;
    }

    const loadKey = `${requestIdParam}:${offerIdParam}:${activeStudioServiceTypes.map((s) => s.id).join(',')}`;
    if (loadedRequestKeyRef.current === loadKey) {
      return undefined;
    }

    let isCancelled = false;
    setRequestLoadError('');

    (async () => {
      try {
        const reqRepo = getBookingRequestRepositoryAdapter();
        const loaded = await reqRepo.getBookingRequestById(requestIdParam);
        if (isCancelled) return;
        loadedRequestKeyRef.current = loadKey;

        if (!loaded) {
          setRequestLoadError(`Booking request "${requestIdParam}" tidak ditemukan di inbox.`);
          return;
        }
        if (loaded.requestType !== BOOKING_REQUEST_TYPES.STUDIO_BOOKING) {
          setRequestLoadError(
            `Inquiry "${loaded.requestReference}" (${loaded.serviceLabelSnapshot}) bersifat Post-Production dan tidak dapat dikonversi ke slot ruangan Calendar.`,
          );
          return;
        }
        if (loaded.status === BOOKING_REQUEST_STATUS.CONFIRMED || loaded.linkedBookingId) {
          setRequestLoadError(
            `Request "${loaded.requestReference}" sudah dikonfirmasi ke booking ${loaded.linkedBookingId} dan tidak dapat dikonversi ulang.`,
          );
          return;
        }
        if (
          loaded.status === BOOKING_REQUEST_STATUS.DECLINED ||
          loaded.status === BOOKING_REQUEST_STATUS.CLOSED
        ) {
          setRequestLoadError(
            `Request "${loaded.requestReference}" berstatus "${loaded.status}" sehingga tidak dapat dikonversi menjadi booking.`,
          );
          return;
        }

        const candidateOfferId = offerIdParam || loaded.activeOfferId || '';
        const loadedOffer =
          candidateOfferId && typeof reqRepo.getOfferById === 'function'
            ? await reqRepo.getOfferById(loaded.id, candidateOfferId)
            : null;
        if (isCancelled) return;

        if (offerIdParam && !loadedOffer) {
          setRequestLoadError(`Offer "${offerIdParam}" tidak ditemukan pada request ini.`);
          return;
        }
        if (loadedOffer?.status === 'sent') {
          setRequestLoadError(
            `Offer ${loadedOffer.offerNumber} masih menunggu respons Client. Tarik/tandai expired atau catat persetujuan Client terlebih dahulu.`,
          );
          return;
        }
        if (
          loadedOffer?.offerMode === 'deposit_hold_offer' &&
          loadedOffer?.provisionalBookingId
        ) {
          setRequestLoadError(
            `Offer ${loadedOffer.offerNumber} menggunakan mode Deposit Hold Offer (Opsi A) dan sudah memiliki Hold provisional (${loadedOffer.provisionalBookingId}). Buka Hold tersebut langsung di Calendar untuk konfirmasi atau verifikasi DP.`,
          );
          return;
        }

        const acceptedOffer = loadedOffer?.status === 'accepted' ? loadedOffer : null;
        const serviceMapping = mapPublicServiceToInternalPricing(
          loaded.publicServiceId,
          activeStudioServiceTypes,
          acceptedOffer?.serviceSnapshot?.serviceOptionId || loaded.serviceOptionId,
        );
        const offerDate = acceptedOffer?.scheduleSnapshot?.date;
        const targetDate = isValidIsoDateString(offerDate)
          ? offerDate
          : isValidIsoDateString(loaded.preferredDate)
            ? loaded.preferredDate
            : getJakartaTodayIso();

        setActiveDate(targetDate);
        setBookingDialogState((prev) => ({
          sessionKey: prev.sessionKey + 1,
          open: true,
          mode: 'create',
          sourceBookingRequest: loaded,
          sourceOffer: acceptedOffer,
          initialSlot: {
            customerName: loaded.customerName,
            bandName: loaded.bandName,
            phone: loaded.contactPhone,
            notes: loaded.notes,
            date: targetDate,
            studioId:
              acceptedOffer?.scheduleSnapshot?.studioId ||
              (loaded.requestedRoomId === 'room-b' ? 'room-b' : 'room-a'),
            startMinute: Number.isInteger(acceptedOffer?.scheduleSnapshot?.startMinute)
              ? acceptedOffer.scheduleSnapshot.startMinute
              : Number.isInteger(loaded.preferredStartMinute)
                ? loaded.preferredStartMinute
                : 600,
            durationMinutes: Number.isInteger(acceptedOffer?.scheduleSnapshot?.durationMinutes)
              ? acceptedOffer.scheduleSnapshot.durationMinutes
              : Number.isInteger(loaded.preferredDurationMinutes)
                ? loaded.preferredDurationMinutes
                : 120,
            defaultServiceId: acceptedOffer?.serviceSnapshot?.serviceTypeId
              ? acceptedOffer.serviceSnapshot.serviceTypeId
              : serviceMapping.requiresManualSelection
                ? ''
                : serviceMapping.serviceTypeId,
            defaultOptionId: acceptedOffer?.serviceSnapshot?.serviceOptionId
              ? acceptedOffer.serviceSnapshot.serviceOptionId
              : serviceMapping.requiresManualSelection
                ? ''
                : serviceMapping.serviceOptionId,
            manualCustomerPrice:
              acceptedOffer?.serviceSnapshot?.pricingMode === 'manual_quote' &&
              acceptedOffer?.financialSnapshot?.totalAmount
                ? String(acceptedOffer.financialSnapshot.totalAmount)
                : '',
            requiresManualServiceSelection: acceptedOffer
              ? false
              : serviceMapping.requiresManualSelection,
            serviceMappingWarning: acceptedOffer ? '' : serviceMapping.reason,
          },
          editingBooking: null,
        }));
      } catch (err) {
        if (!isCancelled) {
          setRequestLoadError(err?.message || 'Gagal memuat data Booking Request untuk konversi.');
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isRequestAction, requestIdParam, offerIdParam, isPricingLoading, activeStudioServiceTypes]);

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
      sourceBookingRequest: null,
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
      sourceBookingRequest: null,
      initialSlot: null,
      editingBooking: booking,
    }));
  };

  const handleOpenRescheduleBooking = (booking) => {
    setBookingDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode: 'reschedule',
      sourceBookingRequest: null,
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
    bookingRequestId = '',
    acceptedOfferId = '',
    holdMode = '',
    holdOverrideHours = null,
    holdOverrideReason = '',
    optionalInitialPaymentEvidence = null,
    initialEvidenceId = '',
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
        bookingPolicies,
        acceptedOfferId,
        holdMode,
        holdOverrideHours,
        holdOverrideReason,
        bookingRequestId,
        optionalInitialPaymentEvidence,
        initialEvidenceId,
      });
      const isHoldCreated = created.reservationStatus === 'deposit_hold';
      const message = bookingRequestId
        ? isHoldCreated
          ? `Deposit Hold untuk "${created.customerName}" dibuat dan menunggu DP.`
          : `Booking resmi untuk "${created.customerName}" berhasil dibuat dan request dikonfirmasi.`
        : isHoldCreated
          ? `Deposit Hold untuk "${created.customerName}" berhasil disimpan.`
          : `Booking baru untuk "${created.customerName}" berhasil disimpan.`;
      setStatusFeedback(message);
      toast.success(message);
      if (bookingRequestId) {
        setSearchParams({}, { replace: true });
        setSelectedBookingId(created.id);
      }
      if (
        isOwner &&
        !isFactoryResetLocked &&
        !isPublicScheduleReady &&
        !publicMetaError &&
        !isSyncingPublicCalendar
      ) {
        void availabilitySync.triggerSync();
      }
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

  const handleSyncPublicAvailability = useCallback(async () => {
    if (!isOwner || !actorUid || isFactoryResetLocked || isSyncingPublicCalendar) return;
    const outcome = await availabilitySync.triggerSync();
    if (outcome?.ok) {
      setStatusFeedback(outcome.message);
      toast.success(outcome.message);
    } else if (outcome?.errorMessage) {
      toast.error(outcome.errorMessage);
    }
  }, [actorUid, availabilitySync, isFactoryResetLocked, isOwner, isSyncingPublicCalendar]);

  const publicSyncedAtLabel = useMemo(() => {
    const formatted = formatIndonesianTimestamp(
      publicMetadata?.backfillCompletedAt || publicMetadata?.updatedAt,
    );
    return formatted && formatted !== '-' ? formatted : '';
  }, [publicMetadata]);

  return (
    <div data-calendar-scoped="true" className="relative isolate z-0 space-y-3 sm:space-y-4">
      {/* Request Conversion Eligibility Error Banner */}
      {requestLoadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#FF4B22]/30 bg-[#FFEDE8] px-4 py-2.5 text-xs font-medium text-[#B92B0C]"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{requestLoadError}</span>
          </span>
          <Link to="/admin/booking-requests" className="font-bold underline">
            Kembali ke Inbox Request →
          </Link>
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
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5"
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
        showPublicAvailabilityStatus={isOwner}
        isPublicScheduleReady={isPublicScheduleReady}
        isPublicMetaLoading={isPublicMetaLoading}
        publicMetaError={publicMetaError}
        isSyncingPublicCalendar={isSyncingPublicCalendar}
        publicSyncError={publicSyncError}
        publicSyncedAtLabel={publicSyncedAtLabel}
        isPublicSyncDisabled={isFactoryResetLocked || isSyncingPublicCalendar}
        onSyncPublicAvailability={handleSyncPublicAvailability}
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
        <div className="min-w-0 xl:col-span-9">
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

        <aside className="min-w-0 xl:col-span-3">
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
        sourceBookingRequest={bookingDialogState.sourceBookingRequest}
        sourceOffer={bookingDialogState.sourceOffer}
        editingBooking={bookingDialogState.editingBooking}
        existingBookings={activeSlotBookings}
        pricingSettings={pricingSettings}
        bookingPolicies={bookingPolicies}
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
        actorUid={actorUid}
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
