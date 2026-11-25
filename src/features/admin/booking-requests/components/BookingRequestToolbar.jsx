import { useState } from 'react';
import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { AdminSurface } from '@/features/admin/design-system';

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
  const [filtersOpen, setFiltersOpen] = useState(
    Boolean(requestTypeFilter !== 'all' || serviceFilter !== 'all' || preferredDateFilter),
  );

  const activeAdvancedFilterCount =
    (requestTypeFilter !== 'all' ? 1 : 0) +
    (serviceFilter !== 'all' ? 1 : 0) +
    (preferredDateFilter ? 1 : 0);

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
    <AdminSurface variant="card" className="space-y-3 rounded-2xl p-3 sm:space-y-3.5 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-bold tracking-wide text-[#151515]">Inbox</span>
          <span className="text-[10px] text-[#8B857B]">·</span>
          <span className="font-mono text-[10px] text-[#8B857B] tabular-nums">
            {summaryCounts.totalLoaded} dimuat
          </span>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-[#777166] transition-colors hover:bg-[#F4F1E8] hover:text-[#151515] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8BAD12]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#777166]"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Cari customer, band, nomor HP, atau referensi"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Cari nama, band, nomor WA, atau REQ..."
            className="sa-input min-h-10 w-full rounded-xl py-2 pr-3 pl-9 text-[12px] leading-normal font-medium placeholder:text-[12px] placeholder:font-normal placeholder:text-[#999286] sm:text-xs"
          />
        </div>

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="booking-request-advanced-filters"
          onClick={() => setFiltersOpen((previous) => !previous)}
          className={
            'sa-control inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8BAD12] ' +
            (filtersOpen || activeAdvancedFilterCount > 0
              ? 'border-[#151515]/20 bg-[#F4F1E8] text-[#151515]'
              : 'sa-btn-secondary')
          }
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Filter</span>
          {activeAdvancedFilterCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#151515] px-1 font-mono text-[9px] font-bold text-[#C8F13A]">
              {activeAdvancedFilterCount}
            </span>
          ) : null}
          <ChevronDown
            className={
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ' +
              (filtersOpen ? 'rotate-180' : 'rotate-0')
            }
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        role="group"
        aria-label="Filter status permintaan"
        className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {statusOptions.map((option) => {
          const isSelected = statusFilter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onStatusFilterChange(option.id)}
              className={
                'inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold leading-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8BAD12] ' +
                (isSelected
                  ? STATUS_FILTER_TONES[option.id]
                  : 'border-[#151515]/10 bg-white text-[#5F5A51] hover:border-[#151515]/25 hover:bg-[#F8F6EF]')
              }
            >
              <span>{option.label}</span>
              <span
                className={
                  'font-mono text-[9px] tabular-nums ' +
                  (isSelected ? 'opacity-75' : 'text-[#999286]')
                }
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="booking-request-advanced-filters"
        className={
          'grid min-w-0 transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none ' +
          (filtersOpen
            ? 'grid-rows-[1fr] visible opacity-100'
            : 'grid-rows-[0fr] invisible opacity-0')
        }
      >
        <div className="min-h-0 min-w-0 overflow-hidden">
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#151515]/[0.07] bg-[#FAF8F1] p-2.5 sm:grid-cols-2 sm:gap-2.5 sm:p-3 lg:grid-cols-3">
            <div className="min-w-0 space-y-1">
              <label htmlFor="booking-request-type-filter" className="block text-[10px] font-semibold text-[#666159]">
                Tipe Permintaan
              </label>
              <select
                id="booking-request-type-filter"
                aria-label="Filter tipe request"
                value={requestTypeFilter}
                onChange={(event) => onRequestTypeFilterChange(event.target.value)}
                className="sa-input !h-10 !min-h-10 w-full rounded-lg px-3 py-2 !text-sm !leading-tight font-medium"
                style={{ height: 40, minHeight: 40, fontSize: 14, lineHeight: '20px' }}
              >
                <option value="all">Semua Tipe</option>
                <option value={BOOKING_REQUEST_TYPES.STUDIO_BOOKING}>Studio Booking</option>
                <option value={BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY}>Mix &amp; Master</option>
              </select>
            </div>

            <div className="min-w-0 space-y-1">
              <label htmlFor="booking-request-service-filter" className="block text-[10px] font-semibold text-[#666159]">
                Layanan
              </label>
              <select
                id="booking-request-service-filter"
                aria-label="Filter layanan"
                value={serviceFilter}
                onChange={(event) => onServiceFilterChange(event.target.value)}
                className="sa-input !h-10 !min-h-10 w-full rounded-lg px-3 py-2 !text-sm !leading-tight font-medium"
                style={{ height: 40, minHeight: 40, fontSize: 14, lineHeight: '20px' }}
              >
                <option value="all">Semua Layanan</option>
                {PUBLIC_SERVICE_OPTIONS.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-1">
              <label htmlFor="booking-request-date-filter" className="block text-[10px] font-semibold text-[#666159]">
                Tanggal pilihan
              </label>
              <input
                id="booking-request-date-filter"
                type="date"
                aria-label="Filter tanggal pilihan"
                value={preferredDateFilter}
                onChange={handleDateInputChange}
                className="sa-input !h-10 !min-h-10 w-full min-w-0 rounded-lg px-3 py-2 !text-sm !leading-tight font-medium"
                style={{ height: 40, minHeight: 40, fontSize: 14, lineHeight: '20px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
