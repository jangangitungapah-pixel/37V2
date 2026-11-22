import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  formatIndonesianDateFull,
  formatIndonesianPeriodLabel,
  getJakartaTodayIso,
  isValidIsoDateString,
  shiftCalendarDate,
} from '@/features/admin/calendar/utils/calendar-date';
import { AuthContext } from '@/features/auth/AuthContext';
import { usePublicSiteSettings } from '@/features/public-site-settings/hooks/usePublicSiteSettings';

import { PublicAvailabilityEmptyState } from '../components/PublicAvailabilityEmptyState';
import { PublicAvailabilityGrid } from '../components/PublicAvailabilityGrid';
import { PublicAvailabilityHeader } from '../components/PublicAvailabilityHeader';
import { PublicAvailabilityLegend } from '../components/PublicAvailabilityLegend';
import { PublicAvailabilityToolbar } from '../components/PublicAvailabilityToolbar';
import {
  PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';
import { usePublicAvailability } from '../hooks/usePublicAvailability';
import {
  backfillPublicAvailabilityProjections,
  mapPublicAvailabilityErrorToMessage,
} from '../services/public-availability-service';

function getInitialPublicViewMode(paramView) {
  if (paramView === PUBLIC_VIEW_MODES.DAY || paramView === PUBLIC_VIEW_MODES.WEEK) {
    return paramView;
  }
  if (typeof window === 'undefined') {
    return PUBLIC_VIEW_MODES.DAY;
  }
  return window.innerWidth < 1024 ? PUBLIC_VIEW_MODES.DAY : PUBLIC_VIEW_MODES.WEEK;
}

function getInitialRoomFilter(paramRoom) {
  const clean = String(paramRoom || '')
    .trim()
    .toLowerCase();
  if (clean === 'room-a' || clean === 'room-b') {
    return clean;
  }
  return 'all';
}

function mapDurationMinutesToInquiryLabel(minutes) {
  const m = Number(minutes) || 0;
  if (m >= 240) return '4 hours';
  if (m >= 180) return '3 hours';
  return '2 hours';
}

/**
 * Dedicated Customer-Facing Public Availability Calendar (`/availability`).
 * Accessible without authentication outside `/admin`.
 */
export function PublicAvailabilityPage({ now } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const { settings: siteSettings } = usePublicSiteSettings();

  const todayIso = useMemo(() => getJakartaTodayIso(now), [now]);
  const initialServiceParam = useMemo(() => {
    const raw = String(searchParams.get('service') || '')
      .trim()
      .toLowerCase();
    return ['rehearsal', 'recording', 'mix-master'].includes(raw) ? raw : '';
  }, [searchParams]);

  const [viewMode, setViewMode] = useState(() =>
    getInitialPublicViewMode(searchParams.get('view')),
  );
  const [activeDate, setActiveDate] = useState(() => {
    const paramDate = searchParams.get('date');
    return isValidIsoDateString(paramDate) && paramDate >= todayIso ? paramDate : todayIso;
  });
  const [roomFilter, setRoomFilter] = useState(() =>
    getInitialRoomFilter(searchParams.get('room')),
  );
  const [requestedDurationMinutes, setRequestedDurationMinutes] = useState(
    PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES,
  );
  const [selectedSlot, setSelectedSlot] = useState(null);

  const actorUid = auth?.user?.uid || auth?.profile?.uid || '';
  const actorRole = String(auth?.role || auth?.profile?.role || '')
    .trim()
    .toLowerCase();
  const isAuthenticatedOwner = Boolean(
    auth?.status === 'authenticated' && actorUid && actorRole === 'owner',
  );
  const [isOwnerSyncing, setIsOwnerSyncing] = useState(false);
  const [ownerSyncError, setOwnerSyncError] = useState('');
  const ownerAutoSyncAttemptedRef = useRef(false);
  const ownerSyncInFlightRef = useRef(false);

  const { dateRange, roomSchedules, isReady, isTruncated, isLoading, error, retry } =
    usePublicAvailability({
      viewMode,
      activeDateIso: activeDate,
      roomFilter,
      requestedDurationMinutes,
      now,
    });

  const handleOwnerSync = useCallback(async () => {
    if (!isAuthenticatedOwner || ownerSyncInFlightRef.current) return;
    ownerSyncInFlightRef.current = true;
    setIsOwnerSyncing(true);
    setOwnerSyncError('');
    try {
      await backfillPublicAvailabilityProjections({
        actorUid,
        actorRole,
        fromDateIso: todayIso,
      });
    } catch (err) {
      setOwnerSyncError(mapPublicAvailabilityErrorToMessage(err, { isAdmin: true }));
    } finally {
      ownerSyncInFlightRef.current = false;
      setIsOwnerSyncing(false);
    }
  }, [actorRole, actorUid, isAuthenticatedOwner, todayIso]);

  // If an authenticated Studio Owner lands on /availability while metadata is not ready yet,
  // initialize & verify the projection once automatically instead of leaving it stuck.
  useEffect(() => {
    if (
      !isAuthenticatedOwner ||
      isLoading ||
      error ||
      isReady ||
      isOwnerSyncing ||
      ownerAutoSyncAttemptedRef.current
    ) {
      return undefined;
    }

    let isCancelled = false;
    Promise.resolve().then(() => {
      if (isCancelled || ownerAutoSyncAttemptedRef.current) return;
      ownerAutoSyncAttemptedRef.current = true;
      void handleOwnerSync();
    });

    return () => {
      isCancelled = true;
    };
  }, [error, handleOwnerSync, isAuthenticatedOwner, isLoading, isOwnerSyncing, isReady]);

  const whatsappUrl = useMemo(() => {
    const digits = String(siteSettings?.publicWhatsappNumber || '').replace(/\D/g, '');
    if (!digits) return '';
    const studioLabel = siteSettings?.studioName || '37 Music Studio';
    return `https://wa.me/${digits}?text=${encodeURIComponent(
      `Halo ${studioLabel}, saya ingin mengecek ketersediaan jadwal studio.`,
    )}`;
  }, [siteSettings?.publicWhatsappNumber, siteSettings?.studioName]);

  const dateRangeLabel = useMemo(() => {
    if (viewMode === PUBLIC_VIEW_MODES.WEEK) {
      return formatIndonesianPeriodLabel('week', activeDate);
    }
    return formatIndonesianDateFull(activeDate);
  }, [viewMode, activeDate]);

  const syncUrlParams = (nextPatch = {}) => {
    const nextRoom = nextPatch.room ?? roomFilter;
    const nextDate = nextPatch.date ?? activeDate;
    const nextView = nextPatch.view ?? viewMode;
    const params = new URLSearchParams();
    if (nextRoom && nextRoom !== 'all') params.set('room', nextRoom);
    if (nextDate) params.set('date', nextDate);
    if (nextView) params.set('view', nextView);
    if (initialServiceParam) params.set('service', initialServiceParam);
    setSearchParams(params, { replace: true });
  };

  const handleSelectDate = (nextDateIso) => {
    if (!isValidIsoDateString(nextDateIso)) return;
    const clamped = nextDateIso < todayIso ? todayIso : nextDateIso;
    setActiveDate(clamped);
    syncUrlParams({ date: clamped });
  };

  const handlePreviousPeriod = () => {
    const prevDate = shiftCalendarDate(viewMode, activeDate, -1);
    const clamped = prevDate < todayIso ? todayIso : prevDate;
    setActiveDate(clamped);
    syncUrlParams({ date: clamped });
  };

  const handleNextPeriod = () => {
    const nextDate = shiftCalendarDate(viewMode, activeDate, 1);
    setActiveDate(nextDate);
    syncUrlParams({ date: nextDate });
  };

  const handleSelectToday = () => {
    setActiveDate(todayIso);
    syncUrlParams({ date: todayIso });
  };

  const handleRoomFilterChange = (nextRoom) => {
    setRoomFilter(nextRoom);
    syncUrlParams({ room: nextRoom });
  };

  const handleViewModeChange = (nextView) => {
    setViewMode(nextView);
    syncUrlParams({ view: nextView });
  };

  const handleContinueToInquiry = (slot) => {
    if (!slot) return;
    const params = new URLSearchParams();
    params.set('date', slot.dateIso);
    params.set('room', slot.studioId);
    params.set('time', slot.startLabel);
    const serviceToCarry = initialServiceParam || slot.defaultService || 'rehearsal';
    params.set('service', serviceToCarry);
    if (slot.durationMinutes && slot.durationMinutes > PUBLIC_DISPLAY_SLOT_INTERVAL_MINUTES) {
      params.set('duration', mapDurationMinutesToInquiryLabel(slot.durationMinutes));
    }
    navigate(`/?${params.toString()}#booking`);
  };

  const showLiveSchedule = !isLoading && !error && isReady && !isTruncated;

  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col">
      <PublicAvailabilityHeader
        studioName={siteSettings?.studioName}
        operatingHours={siteSettings?.operatingHours}
        isReady={isReady}
        isLoading={isLoading}
        isOwnerSyncing={isOwnerSyncing}
        error={error}
      />

      <PublicAvailabilityToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        activeDate={activeDate}
        todayIso={todayIso}
        dateRangeLabel={dateRangeLabel}
        onPreviousPeriod={handlePreviousPeriod}
        onNextPeriod={handleNextPeriod}
        onSelectToday={handleSelectToday}
        onSelectDate={handleSelectDate}
        roomFilter={roomFilter}
        onRoomFilterChange={handleRoomFilterChange}
        requestedDurationMinutes={requestedDurationMinutes}
        onDurationChange={(mins) => {
          setRequestedDurationMinutes(mins);
          setSelectedSlot(null);
        }}
      />

      {showLiveSchedule ? <PublicAvailabilityLegend /> : null}

      <main
        id="public-availability-main"
        className="mx-auto w-full max-w-[1680px] flex-1 px-3 py-5 sm:px-6 sm:py-8 lg:px-8"
      >
        {isLoading ? (
          <PublicAvailabilityEmptyState variant="loading" />
        ) : error ? (
          <PublicAvailabilityEmptyState
            variant="error"
            error={error}
            onRetry={retry}
            whatsappUrl={whatsappUrl}
            studioName={siteSettings?.studioName}
          />
        ) : !isReady ? (
          <PublicAvailabilityEmptyState
            variant="not_ready"
            onRetry={retry}
            whatsappUrl={whatsappUrl}
            studioName={siteSettings?.studioName}
            isOwner={isAuthenticatedOwner}
            isOwnerSyncing={isOwnerSyncing}
            ownerSyncError={ownerSyncError}
            onOwnerSync={handleOwnerSync}
          />
        ) : isTruncated ? (
          <PublicAvailabilityEmptyState
            variant="truncated"
            onSwitchToDayView={() => handleViewModeChange(PUBLIC_VIEW_MODES.DAY)}
            whatsappUrl={whatsappUrl}
            studioName={siteSettings?.studioName}
          />
        ) : (
          <PublicAvailabilityGrid
            roomSchedules={roomSchedules}
            viewMode={viewMode}
            activeDate={dateRange.activeDate}
            onSelectDayInWeek={(dayIso) => handleSelectDate(dayIso)}
            onNextDay={handleNextPeriod}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            onClearSelectedSlot={() => setSelectedSlot(null)}
            onContinueToInquiry={handleContinueToInquiry}
            requestedDurationMinutes={requestedDurationMinutes}
          />
        )}
      </main>

      <footer className="border-studio-ink bg-studio-ink text-studio-ivory border-t-2 py-5">
        <div className="mx-auto flex max-w-[1680px] flex-col items-start justify-between gap-2 px-4 font-mono text-[11px] text-neutral-400 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>
            {(siteSettings?.studioName || '37 Music Studio').toUpperCase()} • LIVE ROOM A &amp; ROOM
            B • ALL TIMES IN WIB (ASIA/JAKARTA)
          </p>
          <div className="flex items-center gap-4">
            <Link to="/" className="transition-colors hover:text-[#C8F13A]">
              Home
            </Link>
            <Link to="/privacy" className="transition-colors hover:text-[#C8F13A]">
              Privacy Notice
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicAvailabilityPage;
