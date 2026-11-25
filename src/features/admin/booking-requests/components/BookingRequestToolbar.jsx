import { useState } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import {
  BOOKING_REQUEST_STATUS_META,
  BOOKING_REQUEST_STATUS_ORDER,
  BOOKING_REQUEST_TYPES,
  PUBLIC_SERVICE_OPTIONS,
} from '../config/booking-request-config';

const STATUS_FILTER_LABELS = Object.freeze({
  new: 'Baru',
  in_review: 'Diproses',
  awaiting_customer: 'Menunggu',
  accepted: 'Diterima',
  confirmed: 'Confirmed',
  declined: 'Ditolak',
  closed: 'Closed',
});

const STATUS_FILTER_TONES = Object.freeze({
  all: 'border-[#151515] bg-[#151515] text-[#F1EEE4]',
  new: 'border-[#FF4B22]/35 bg-[#FFEDE8] text-[#9D341D]',
  in_review: 'border-amber-500/35 bg-[#FEF4DD] text-[#8A4B08]',
  awaiting_customer: 'border-[#151515]/18 bg-[#F4F1E8] text-[#46433D]',
  accepted: 'border-[#8BAD12]/40 bg-[#EDF8C2] text-[#344D0A]',
  confirmed: 'border-emerald-500/30 bg-[#E6F6EC] text-[#0F6246]',
  declined: 'border-red-500/25 bg-red-50 text-red-800',
  closed: 'border-[#151515]/15 bg-[#F4F1E8] text-[#666159]',
});

export function BookingRequestToolbar({
  summaryCounts,
  statusFilter,
  onStatusFilterChange,
  requestTypeFilter,
  onRequestTypeFilterChange,
  serviceFilter,
  onServiceFilterChange,
  preferredDateFilter,
  onPreferredDateFilterChange,
  searchQuery,
  onSearchQueryChange,
  onResetFilters,
  hasActiveFilters,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(
    Boolean(requestTypeFilter !== 'all' || serviceFilter !== 'all' || preferredDateFilter),
  );

  const activeAdvancedFilterCount =
    (requestTypeFilter !== 'all' ? 1 : 0) +
    (serviceFilter !== 'all' ? 1 : 0) +
    (preferredDateFilter ? 1 : 0);

  const activeFilterCount =
    activeAdvancedFilterCount +
    (statusFilter !== 'all' ? 1 : 0) +
    (String(searchQuery || '').trim() ? 1 : 0);

  const statusCounts = {
    new: summaryCounts.newCount,
    in_review: summaryCounts.inReviewCount,
    awaiting_customer: summaryCounts.awaitingCustomerCount,
    accepted: summaryCounts.acceptedCount,
    confirmed: summaryCounts.confirmedCount,
    declined: summaryCounts.declinedCount,
    closed: summaryCounts.closedCount,
  };

  const statusOptions = [
    { id: 'all', label: 'Semua', count: summaryCounts.totalLoaded },
    ...BOOKING_REQUEST_STATUS_ORDER.map((statusId) => ({
      id: statusId,
      label: STATUS_FILTER_LABELS[statusId] || BOOKING_REQUEST_STATUS_META[statusId].shortLabel,
      count: statusCounts[statusId] || 0,
    })),
  ];

  const handleDateInputChange = (event) => {
    onPreferredDateFilterChange(event.target.value);
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold text-[#151515]">Inbox</span>
          <span className="font-mono text-[10px] text-[#8B857B] tabular-nums">
            {summaryCounts.totalLoaded} dimuat
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FF4B22]/25 bg-[#FFEDE8] px-2.5 py-1 text-[10px] font-bold text-[#9D341D]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF4B22]" aria-hidden="true" />
          {summaryCounts.newCount} baru
        </span>
      </div>

      <AdminSurface variant="card" className="space-y-3 p-3 sm:space-y-3.5 sm:p-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#666159]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari customer, band, nomor HP, atau referensi"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari nama, band, nomor WA, atau REQ..."
              className="sa-input min-h-11 w-full rounded-xl py-2 pr-3 pl-9 text-sm font-medium sm:text-sm"
            />
          </div>

          <button
            type="button"
            aria-expanded={mobileFiltersOpen}
            aria-controls="booking-request-advanced-filters"
            onClick={() => setMobileFiltersOpen((previous) => !previous)}
            className="sa-control sa-btn-secondary inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors duration-200 sm:px-3.5 lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filter</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                {activeFilterCount}
              </span>
            ) : null}
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                mobileFiltersOpen ? 'rotate-180' : 'rotate-0'
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          role="group"
          aria-label="Filter status permintaan"
          className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:flex-wrap sm:overflow-visible sm:pb-0"
        >
          {statusOptions.map((option) => {
            const isSelected = statusFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onStatusFilterChange(option.id)}
                className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8BAD12] ${
                  isSelected
                    ? STATUS_FILTER_TONES[option.id]
                    : 'border-[#151515]/10 bg-white text-[#46433D] hover:border-[#151515]/25 hover:bg-[#F8F6EF]'
                }`}
              >
                <span>{option.label}</span>
                <span className={`font-mono text-[10px] tabular-nums ${
                  isSelected ? 'opacity-80' : 'text-[#8B857B]'
                }`}>
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          id="booking-request-advanced-filters"
          className={`grid min-w-0 transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none lg:grid-rows-[1fr] lg:visible lg:opacity-100 lg:pointer-events-auto ${
            mobileFiltersOpen
              ? 'grid-rows-[1fr] visible opacity-100 pointer-events-auto [transition-delay:0ms]'
              : 'grid-rows-[0fr] invisible opacity-0 pointer-events-none [transition-delay:0ms,0ms,200ms]'
          }`}
        >
          <div className="min-h-0 min-w-0 overflow-hidden">
            <div className="grid grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-12 lg:items-end">
              <div className="min-w-0 space-y-1 lg:col-span-4">
                <label htmlFor="booking-request-type-filter" className="block text-[11px] font-semibold text-[#666159]">
                  Tipe Permintaan
                </label>
                <select
                  id="booking-request-type-filter"
                  aria-label="Filter tipe request"
                  value={requestTypeFilter}
                  onChange={(event) => onRequestTypeFilterChange(event.target.value)}
                  className="sa-input min-h-11 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
                >
                  <option value="all">Semua Tipe</option>
                  <option value={BOOKING_REQUEST_TYPES.STUDIO_BOOKING}>Studio Booking</option>
                  <option value={BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY}>Mix &amp; Master</option>
                </select>
              </div>

              <div className="min-w-0 space-y-1 lg:col-span-4">
                <label htmlFor="booking-request-service-filter" className="block text-[11px] font-semibold text-[#666159]">
                  Layanan
                </label>
                <select
                  id="booking-request-service-filter"
                  aria-label="Filter layanan"
                  value={serviceFilter}
                  onChange={(event) => onServiceFilterChange(event.target.value)}
                  className="sa-input min-h-11 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
                >
                  <option value="all">Semua Layanan</option>
                  {PUBLIC_SERVICE_OPTIONS.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 space-y-1 lg:col-span-2">
                <label htmlFor="booking-request-date-filter" className="block text-[11px] font-semibold text-[#666159]">
                  Tanggal pilihan
                </label>
                <input
                  id="booking-request-date-filter"
                  type="date"
                  aria-label="Filter tanggal pilihan"
                  value={preferredDateFilter}
                  onChange={handleDateInputChange}
                  className="sa-input min-h-11 w-full min-w-0 rounded-xl px-3 py-2 text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 lg:col-span-2">
                {hasActiveFilters ? (
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={onResetFilters}
                    aria-label="Reset semua filter"
                    title="Reset semua filter"
                    className="min-h-10 w-full sm:w-auto"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reset Filter</span>
                  </AdminButton>
                ) : (
                  <span className="hidden text-[10px] text-[#8B857B] lg:block">
                    Filter opsional
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
