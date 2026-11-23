import { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';

import {
  formatDurationMinutes,
  formatMinuteOfDay,
  formatMinuteRange,
} from '@/features/admin/calendar/utils/booking-time';
import {
  addDaysToIsoDate,
  formatIndonesianDateFull,
} from '@/features/admin/calendar/utils/calendar-date';
import { PRICING_MODES } from '@/features/admin/settings/pricing/config/default-pricing-settings';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import {
  PUBLIC_SLOT_STATES,
  PUBLIC_VIEW_MODES,
} from '@/features/public-availability/config/public-availability-config';
import { usePublicAvailability } from '@/features/public-availability/hooks/usePublicAvailability';

const WHOLE_HOUR_DURATIONS = [60, 120, 180, 240, 300, 360];

const ROOM_PREFERENCE_OPTIONS = [
  { id: 'any', label: 'No Preference', subtitle: 'Any open room' },
  { id: 'room-a', label: 'Room A', subtitle: 'Live Room' },
  { id: 'room-b', label: 'Room B', subtitle: 'Control + Booth' },
];

const PERIOD_GROUPS = [
  { id: 'morning', label: 'Morning', windowLabel: '10:00–12:00', match: (m) => m < 720 },
  {
    id: 'afternoon',
    label: 'Afternoon',
    windowLabel: '12:00–18:00',
    match: (m) => m >= 720 && m < 1080,
  },
  { id: 'evening', label: 'Evening', windowLabel: '18:00–23:00', match: (m) => m >= 1080 },
];

function buildAllowedDurationOptions(selectedOption, pricingEstimate) {
  const mode = pricingEstimate?.pricingMode || selectedOption?.pricing?.mode;

  if (mode === PRICING_MODES.FIXED_SHIFT) {
    const baseMinutes = Math.max(
      60,
      Number(pricingEstimate?.baseDurationMinutes || selectedOption?.pricing?.durationMinutes) ||
      180,
    );
    if (!pricingEstimate?.canExtendDuration) {
      return [baseMinutes];
    }
    const baseSet = new Set(WHOLE_HOUR_DURATIONS.filter((m) => m >= baseMinutes));
    baseSet.add(baseMinutes);
    return [...baseSet].sort((a, b) => a - b);
  }

  return WHOLE_HOUR_DURATIONS;
}

function mergeRoomDaySlots(roomSchedules = [], activeDateIso, requestedRoomId, durationMinutes) {
  const dayByRoom = roomSchedules
    .map((room) => ({
      room,
      day:
        (room.daySchedules || []).find((d) => d.dateIso === activeDateIso) ||
        room.daySchedules?.[0] ||
        null,
    }))
    .filter((entry) => Boolean(entry.day));

  if (dayByRoom.length === 0) return [];

  if (requestedRoomId !== 'any') {
    const target = dayByRoom.find((e) => e.room.id === requestedRoomId) || dayByRoom[0];
    return (target.day.slots || []).map((slot) => ({
      startMinute: slot.startMinute,
      startLabel: slot.startLabel,
      rangeLabel: formatMinuteRange(slot.startMinute, durationMinutes),
      state: slot.state,
      availableRoomLabels:
        slot.state === PUBLIC_SLOT_STATES.AVAILABLE ? [target.room.shortLabel] : [],
    }));
  }

  const slotsByMinute = new Map();
  for (const { room, day } of dayByRoom) {
    for (const slot of day.slots || []) {
      const existing = slotsByMinute.get(slot.startMinute) || {
        startMinute: slot.startMinute,
        startLabel: slot.startLabel || formatMinuteOfDay(slot.startMinute),
        rangeLabel: formatMinuteRange(slot.startMinute, durationMinutes),
        states: [],
        availableRoomLabels: [],
      };
      existing.states.push(slot.state);
      if (slot.state === PUBLIC_SLOT_STATES.AVAILABLE) {
        existing.availableRoomLabels.push(room.shortLabel);
      }
      slotsByMinute.set(slot.startMinute, existing);
    }
  }

  return [...slotsByMinute.values()]
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((entry) => {
      let state = PUBLIC_SLOT_STATES.PAST;
      if (entry.availableRoomLabels.length > 0) {
        state = PUBLIC_SLOT_STATES.AVAILABLE;
      } else if (entry.states.includes(PUBLIC_SLOT_STATES.DURATION_TOO_SHORT)) {
        state = PUBLIC_SLOT_STATES.DURATION_TOO_SHORT;
      } else if (entry.states.includes(PUBLIC_SLOT_STATES.OCCUPIED)) {
        state = PUBLIC_SLOT_STATES.OCCUPIED;
      }
      return {
        startMinute: entry.startMinute,
        startLabel: entry.startLabel,
        rangeLabel: entry.rangeLabel,
        state,
        availableRoomLabels: entry.availableRoomLabels,
      };
    });
}

export function ClientBookingStepSchedule({
  selectedService,
  selectedOption,
  preferredDate,
  requestedRoomId,
  durationMinutes,
  selectedStartMinute,
  pricingEstimate,
  todayIso,
  now,
  onChangeDate,
  onChangeRoom,
  onChangeDuration,
  onSelectStartMinute,
  onBack,
  onContinue,
}) {
  const allowedDurations = useMemo(
    () => buildAllowedDurationOptions(selectedOption, pricingEstimate),
    [selectedOption, pricingEstimate],
  );

  const isLockedFixedShift =
    (pricingEstimate?.pricingMode || selectedOption?.pricing?.mode) === PRICING_MODES.FIXED_SHIFT &&
    !pricingEstimate?.canExtendDuration;

  const availability = usePublicAvailability({
    viewMode: PUBLIC_VIEW_MODES.DAY,
    activeDateIso: preferredDate,
    roomFilter: requestedRoomId === 'any' ? 'all' : requestedRoomId,
    requestedDurationMinutes: durationMinutes,
    enabled: true,
    now,
  });

  const combinedSlots = useMemo(
    () =>
      availability.isReady
        ? mergeRoomDaySlots(
          availability.roomSchedules,
          preferredDate,
          requestedRoomId,
          durationMinutes,
        )
        : [],
    [
      availability.isReady,
      availability.roomSchedules,
      preferredDate,
      requestedRoomId,
      durationMinutes,
    ],
  );

  const selectedSlotObject = useMemo(
    () => combinedSlots.find((s) => s.startMinute === selectedStartMinute) || null,
    [combinedSlots, selectedStartMinute],
  );

  // Clear stale start time whenever date, room, or duration makes the previous start invalid
  useEffect(() => {
    if (!availability.isReady || availability.isLoading) return;
    if (
      selectedStartMinute !== null &&
      (!selectedSlotObject || selectedSlotObject.state !== PUBLIC_SLOT_STATES.AVAILABLE)
    ) {
      onSelectStartMinute(null);
    }
  }, [
    availability.isReady,
    availability.isLoading,
    selectedStartMinute,
    selectedSlotObject,
    onSelectStartMinute,
  ]);

  const groupedSlots = useMemo(
    () =>
      PERIOD_GROUPS.map((group) => {
        const slots = combinedSlots.filter((s) => group.match(s.startMinute));
        const openCount = slots.filter((s) => s.state === PUBLIC_SLOT_STATES.AVAILABLE).length;
        return { ...group, slots, openCount };
      }),
    [combinedSlots],
  );

  const totalOpenSlots = combinedSlots.filter(
    (s) => s.state === PUBLIC_SLOT_STATES.AVAILABLE,
  ).length;
  const canContinue =
    availability.isReady &&
    !availability.error &&
    selectedSlotObject?.state === PUBLIC_SLOT_STATES.AVAILABLE;

  const prevDate = addDaysToIsoDate(preferredDate, -1);
  const canGoPrev = prevDate >= todayIso;

  return (
    <div data-testid="client-booking-step-schedule" className="space-y-4">
      <AdminSurface variant="card" className="space-y-5 p-4 sm:p-6">
        {/* Header & Customer-Safe Estimate */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151515]/[0.08] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#151515] sm:text-lg">2. Choose Schedule</h2>
              <AdminStatusBadge tone="lime" size="sm">
                {selectedService?.name} · {selectedOption?.name}
              </AdminStatusBadge>
            </div>
            <p className="mt-0.5 text-xs text-[#666159]">
              Select your duration, studio room preference, and an open hourly start time
              (10:00–23:00 WIB).
            </p>
          </div>

          <div
            data-testid="client-schedule-price-badge"
            className="rounded-xl border border-[#151515]/10 bg-[#FAF8F1] px-3.5 py-2 text-right"
          >
            <span className="block font-mono text-[10px] font-bold tracking-wider text-[#666159] uppercase">
              Estimated Total
            </span>
            {pricingEstimate?.isManualQuote || pricingEstimate?.estimatedTotal === null ? (
              <span className="mt-0.5 block text-sm font-bold text-[#151515]">Custom Quote</span>
            ) : (
              <>
                <span className="mt-0.5 block font-mono text-sm font-bold text-[#151515]">
                  {formatRupiah(pricingEstimate?.estimatedTotal ?? 0)}
                </span>
                {pricingEstimate?.extensionAmount > 0 ? (
                  <span className="block text-[10px] text-[#46433D]">
                    Base {formatRupiah(pricingEstimate.basePrice)} +{' '}
                    {pricingEstimate.extensionHours}h ext (
                    {formatRupiah(pricingEstimate.extensionAmount)})
                  </span>
                ) : pricingEstimate?.discountAmount > 0 ? (
                  <span className="block text-[10px] font-medium text-[#0F6246]">
                    Includes −{formatRupiah(pricingEstimate.discountAmount)}{' '}
                    {pricingEstimate.appliedDiscountName || 'discount'}
                  </span>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Duration & Room Controls */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-6">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs font-semibold text-[#151515]">Session Duration</span>
              {isLockedFixedShift ? (
                <span className="font-mono text-[10px] font-bold text-[#0F6246] uppercase">
                  Fixed Shift Package ({formatDurationMinutes(durationMinutes)})
                </span>
              ) : pricingEstimate?.pricingMode === PRICING_MODES.FIXED_SHIFT &&
                pricingEstimate?.canExtendDuration ? (
                <span className="font-mono text-[10px] font-bold text-[#0F6246] uppercase">
                  +{formatRupiah(pricingEstimate.extensionHourlyRate)}/h after{' '}
                  {Math.round((pricingEstimate.baseDurationMinutes || 180) / 60)}h
                </span>
              ) : null}
            </div>

            <div role="group" aria-label="Choose session duration" className="flex flex-wrap gap-2">
              {allowedDurations.map((mins) => {
                const isSelected = durationMinutes === mins;
                const hours = mins / 60;
                return (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isLockedFixedShift && allowedDurations.length === 1}
                    data-testid={`client-duration-btn-${mins}`}
                    onClick={() => onChangeDuration(mins)}
                    className={`min-h-10 cursor-pointer rounded-xl border px-3.5 py-1.5 font-mono text-xs font-bold transition-all disabled:cursor-default ${isSelected
                      ? 'border-[#151515] bg-[#151515] text-[#C8F13A]'
                      : 'border-[#151515]/12 bg-[#FAF8F1] text-[#151515] hover:bg-white'
                      }`}
                  >
                    {Number.isInteger(hours)
                      ? `${hours} hour${hours > 1 ? 's' : ''}`
                      : formatDurationMinutes(mins)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 lg:col-span-6">
            <span className="block text-xs font-semibold text-[#151515]">Room Preference</span>
            <div
              role="group"
              aria-label="Choose room preference"
              className="grid grid-cols-3 gap-2"
            >
              {ROOM_PREFERENCE_OPTIONS.map((roomOpt) => {
                const isSelected = requestedRoomId === roomOpt.id;
                return (
                  <button
                    key={roomOpt.id}
                    type="button"
                    aria-pressed={isSelected}
                    data-testid={`client-room-btn-${roomOpt.id}`}
                    onClick={() => onChangeRoom(roomOpt.id)}
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-left transition-all ${isSelected
                      ? 'border-[#151515] bg-[#151515] text-white'
                      : 'border-[#151515]/12 bg-[#FAF8F1] text-[#151515] hover:bg-white'
                      }`}
                  >
                    <span className="block truncate text-xs font-bold">{roomOpt.label}</span>
                    <span
                      className={`block truncate text-[10px] ${isSelected ? 'text-neutral-300' : 'text-[#666159]'
                        }`}
                    >
                      {roomOpt.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Date Picker */}
        <div className="sa-panel-ivory flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#151515]" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-[#151515] sm:text-sm">
                {formatIndonesianDateFull(preferredDate)}
              </p>
              <p className="font-mono text-[11px] text-[#666159]">
                Asia/Jakarta (WIB) •{' '}
                {availability.isReady
                  ? `${totalOpenSlots} open start slot${totalOpenSlots === 1 ? '' : 's'}`
                  : 'Checking schedule...'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-[#151515]/12 bg-white p-0.5">
              <button
                type="button"
                aria-label="Previous day"
                disabled={!canGoPrev}
                onClick={() => canGoPrev && onChangeDate(prevDate)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#151515] hover:bg-[#FAF8F1] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onChangeDate(todayIso)}
                className="cursor-pointer px-2.5 py-1 font-mono text-[11px] font-bold text-[#151515] uppercase hover:text-[#FF4B22]"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next day"
                onClick={() => onChangeDate(addDaysToIsoDate(preferredDate, 1))}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#151515] hover:bg-[#FAF8F1]"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <input
              aria-label="Session date"
              type="date"
              min={todayIso}
              value={preferredDate}
              onChange={(e) => {
                if (e.target.value && e.target.value >= todayIso) {
                  onChangeDate(e.target.value);
                }
              }}
              className="sa-input min-h-9.5 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold"
            />
          </div>
        </div>

        {/* Availability Matrix (Fail Closed if Missing / Loading / Errored) */}
        {availability.isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-2xl border border-[#151515]/10 bg-[#FAF8F1] p-5 text-xs font-medium text-[#46433D]"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
            <span>Loading live room availability...</span>
          </div>
        ) : availability.error ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-4 text-xs text-[#B92B0C] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Unable to verify studio schedule right now ({availability.error}). Open slots are
                hidden to avoid conflicts.
              </span>
            </div>
            <button
              type="button"
              onClick={availability.retry}
              className="sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#151515]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        ) : !availability.isReady ? (
          <div
            role="status"
            data-testid="client-availability-sync-pending"
            className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-[#FEF4DD] p-4 text-xs text-[#6B3904] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]"
                aria-hidden="true"
              />
              <div>
                <p className="font-bold text-[#151515]">Live Schedule Temporarily Unavailable</p>
                <p className="mt-0.5 leading-relaxed">
                  Live room availability has not been initialized yet. Unverified free slots are
                  hidden for accuracy — please check back shortly or contact studio staff.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={availability.retry}
              className="sa-btn-secondary inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#151515]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Check Again</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {totalOpenSlots === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#151515]/12 bg-[#FAF8F1] p-4 text-xs text-[#46433D]">
                <span>
                  No open {formatDurationMinutes(durationMinutes)} start slots remain on{' '}
                  <strong>{preferredDate}</strong>. Try another date or shorter duration.
                </span>
                <button
                  type="button"
                  onClick={() => onChangeDate(addDaysToIsoDate(preferredDate, 1))}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#151515] underline"
                >
                  <span>Check Next Day</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {groupedSlots.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between border-b border-[#151515]/[0.08] pb-1">
                  <span className="font-mono text-[11px] font-bold tracking-wider text-[#151515] uppercase">
                    {group.label}{' '}
                    <span className="font-normal text-[#666159]">({group.windowLabel})</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#666159] uppercase">
                    {group.openCount} open
                  </span>
                </div>

                <div
                  role="list"
                  aria-label={`${group.label} time slots`}
                  className="grid grid-cols-2 gap-2 min-[460px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
                >
                  {group.slots.map((slot) => {
                    const isSelected = selectedStartMinute === slot.startMinute;

                    if (slot.state === PUBLIC_SLOT_STATES.OCCUPIED) {
                      return (
                        <div
                          key={slot.startMinute}
                          role="listitem"
                          data-testid={`client-slot-${slot.startLabel}`}
                          data-slot-state="occupied"
                          aria-label={`${slot.startLabel} WIB — Booked`}
                          className="flex min-h-14 flex-col justify-between rounded-xl border border-[#151515]/15 bg-[#151515]/90 p-2.5 text-neutral-300"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold text-white">
                              {slot.startLabel}
                            </span>
                            <Lock className="h-3 w-3 text-[#FF4B22]" aria-hidden="true" />
                          </div>
                          <span className="font-mono text-[10px] font-semibold text-[#FF8C6E] uppercase">
                            Booked
                          </span>
                        </div>
                      );
                    }

                    if (slot.state === PUBLIC_SLOT_STATES.PAST) {
                      return (
                        <div
                          key={slot.startMinute}
                          role="listitem"
                          data-testid={`client-slot-${slot.startLabel}`}
                          data-slot-state="past"
                          aria-label={`${slot.startLabel} WIB — Past`}
                          className="flex min-h-14 flex-col justify-between rounded-xl border border-[#151515]/[0.06] bg-[#FAF8F1] p-2.5 text-[#8A8378] opacity-60"
                        >
                          <span className="font-mono text-xs font-bold">{slot.startLabel}</span>
                          <span className="font-mono text-[10px] uppercase">Past</span>
                        </div>
                      );
                    }

                    if (slot.state === PUBLIC_SLOT_STATES.DURATION_TOO_SHORT) {
                      return (
                        <div
                          key={slot.startMinute}
                          role="listitem"
                          data-testid={`client-slot-${slot.startLabel}`}
                          data-slot-state="duration_too_short"
                          aria-label={`${slot.startLabel} WIB — Window too short`}
                          className="flex min-h-14 flex-col justify-between rounded-xl border border-dashed border-[#FF4B22]/35 bg-[#FFEDE8]/55 p-2.5 text-[#8C2B14]"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-bold">{slot.startLabel}</span>
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          </div>
                          <span className="font-mono text-[10px] font-semibold uppercase">
                            Too short
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={slot.startMinute} role="listitem">
                        <button
                          type="button"
                          data-testid={`client-slot-${slot.startLabel}`}
                          data-slot-state="available"
                          aria-pressed={isSelected}
                          aria-label={`Select ${slot.rangeLabel} WIB (${slot.availableRoomLabels.join(', ')})`}
                          onClick={() => onSelectStartMinute(slot.startMinute)}
                          className={`flex min-h-14 w-full cursor-pointer flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${isSelected
                            ? 'border-[#151515] bg-[#151515] text-white shadow-xs ring-2 ring-[#C8F13A]'
                            : 'border-[#8BAD12]/40 bg-[#EDF8C2]/55 text-[#151515] hover:border-[#151515]/40 hover:bg-[#EDF8C2]'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <span className="block font-mono text-xs font-extrabold">
                                {slot.startLabel}
                              </span>
                              <span
                                className={`block font-mono text-[10px] ${isSelected ? 'text-neutral-300' : 'text-[#46433D]'
                                  }`}
                              >
                                {slot.rangeLabel}
                              </span>
                            </div>
                            {isSelected ? (
                              <Check
                                className="h-3.5 w-3.5 shrink-0 text-[#C8F13A]"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>

                          <span
                            className={`mt-1 truncate font-mono text-[10px] font-bold uppercase ${isSelected ? 'text-[#C8F13A]' : 'text-[#243300]'
                              }`}
                          >
                            {requestedRoomId === 'any'
                              ? slot.availableRoomLabels.length === 2
                                ? 'Room A & B'
                                : slot.availableRoomLabels[0] || 'Open'
                              : isSelected
                                ? 'Selected'
                                : 'Open'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex flex-col-reverse gap-2.5 border-t border-[#151515]/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="sa-btn-secondary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-xs font-semibold sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="button"
            disabled={!canContinue}
            data-testid="client-schedule-continue-btn"
            onClick={onContinue}
            className="sa-btn-primary inline-flex min-h-10.5 cursor-pointer items-center justify-center gap-2 px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            <span>Continue to Review</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </AdminSurface>
    </div>
  );
}
