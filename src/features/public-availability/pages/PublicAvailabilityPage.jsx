import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  formatIndonesianDateFull,
  formatIndonesianPeriodLabel,
  getJakartaTodayIso,
  isValidIsoDateString,
  shiftCalendarDate,
} from '@/features/admin/calendar/utils/calendar-date';

import { PublicAvailabilityEmptyState } from '../components/PublicAvailabilityEmptyState';
import { PublicAvailabilityGrid } from '../components/PublicAvailabilityGrid';
import { PublicAvailabilityHeader } from '../components/PublicAvailabilityHeader';
import { PublicAvailabilityLegend } from '../components/PublicAvailabilityLegend';
import { PublicAvailabilityToolbar } from '../components/PublicAvailabilityToolbar';
import {
  PUBLIC_SLOT_INTERVAL_MINUTES,
  PUBLIC_VIEW_MODES,
} from '../config/public-availability-config';
import { usePublicAvailability } from '../hooks/usePublicAvailability';

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
    PUBLIC_SLOT_INTERVAL_MINUTES,
  );
  const [selectedSlot, setSelectedSlot] = useState(null);

  const { dateRange, roomSchedules, isReady, isTruncated, isLoading, error, retry } =
    usePublicAvailability({
      viewMode,
      activeDateIso: activeDate,
      roomFilter,
      requestedDurationMinutes,
      now,
    });

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
    if (slot.durationMinutes && slot.durationMinutes > PUBLIC_SLOT_INTERVAL_MINUTES) {
      params.set('duration', mapDurationMinutesToInquiryLabel(slot.durationMinutes));
    }
    navigate(`/?${params.toString()}#booking`);
  };

  return (
    <div className="bg-studio-ivory text-studio-ink flex min-h-screen flex-col">
      <PublicAvailabilityHeader isReady={isReady} isLoading={isLoading} todayIso={todayIso} />

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

      <PublicAvailabilityLegend />

      <main
        id="public-availability-main"
        className="mx-auto w-full max-w-[1680px] flex-1 px-3 py-6 sm:px-6 sm:py-10 lg:px-8"
      >
        {isLoading ? (
          <PublicAvailabilityEmptyState variant="loading" />
        ) : error ? (
          <PublicAvailabilityEmptyState variant="error" error={error} onRetry={retry} />
        ) : !isReady ? (
          <PublicAvailabilityEmptyState variant="not_ready" />
        ) : isTruncated ? (
          <PublicAvailabilityEmptyState
            variant="truncated"
            onSwitchToDayView={() => handleViewModeChange(PUBLIC_VIEW_MODES.DAY)}
          />
        ) : (
          <PublicAvailabilityGrid
            roomSchedules={roomSchedules}
            viewMode={viewMode}
            activeDate={dateRange.activeDate}
            onSelectDayInWeek={(dayIso) => handleSelectDate(dayIso)}
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
          <p>37 MUSIC STUDIO • PUBLIC AVAILABILITY SCHEDULE (READ-ONLY)</p>
          <p>ALL TIMES IN ASIA/JAKARTA (WIB) • FINAL BOOKING SUBJECT TO STUDIO VERIFICATION</p>
        </div>
      </footer>
    </div>
  );
}

export default PublicAvailabilityPage;
