import { RotateCcw, Search } from 'lucide-react';

import { AdminButton, AdminSurface } from '@/features/admin/design-system';

import {
  BOOKING_REQUEST_STATUS_META,
  BOOKING_REQUEST_STATUS_ORDER,
  BOOKING_REQUEST_TYPES,
  PUBLIC_SERVICE_OPTIONS,
} from '../config/booking-request-config';

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
  const kpiCards = [
    {
      label: 'New',
      value: summaryCounts.newCount,
      toneClass: 'border-[#FF4B22]/30 bg-[#FFEDE8]/70 text-[#B92B0C]',
      targetStatus: 'new',
    },
    {
      label: 'In Review',
      value: summaryCounts.inReviewCount,
      toneClass: 'border-amber-500/25 bg-[#FEF4DD]/70 text-[#8A4B08]',
      targetStatus: 'in_review',
    },
    {
      label: 'Awaiting Customer',
      value: summaryCounts.awaitingCustomerCount,
      toneClass: 'border-[#151515]/12 bg-[#F8F6EF] text-[#151515]',
      targetStatus: 'awaiting_customer',
    },
    {
      label: 'Confirmed',
      value: summaryCounts.confirmedCount,
      toneClass: 'border-emerald-500/25 bg-[#E6F6EC]/70 text-[#0F6246]',
      targetStatus: 'confirmed',
    },
    {
      label: 'Post-Production',
      value: summaryCounts.postProductionCount,
      toneClass: 'border-[#151515]/15 bg-[#151515] text-[#F1EEE4]',
      targetType: BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.targetStatus) {
                onStatusFilterChange(
                  statusFilter === card.targetStatus ? 'all' : card.targetStatus,
                );
              } else if (card.targetType) {
                onRequestTypeFilterChange(
                  requestTypeFilter === card.targetType ? 'all' : card.targetType,
                );
              }
            }}
            className={`flex cursor-pointer flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-transform hover:-translate-y-0.5 ${card.toneClass}`}
          >
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase opacity-85">
              {card.label}
            </span>
            <span className="mt-1.5 text-2xl leading-none font-extrabold tracking-tight">
              {card.value}
            </span>
          </button>
        ))}
      </div>

      {/* Filters Surface */}
      <AdminSurface variant="card" className="p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#666159]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari customer, band, nomor HP, atau referensi"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Cari nama, band, nomor WA, atau REQ-..."
              className="sa-input min-h-10 w-full rounded-xl py-2 pr-3 pl-9 text-xs font-medium sm:text-sm"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter status request"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
            >
              <option value="all">Semua Status</option>
              {BOOKING_REQUEST_STATUS_ORDER.map((statusId) => (
                <option key={statusId} value={statusId}>
                  {BOOKING_REQUEST_STATUS_META[statusId].shortLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter tipe request"
              value={requestTypeFilter}
              onChange={(e) => onRequestTypeFilterChange(e.target.value)}
              className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
            >
              <option value="all">Semua Tipe</option>
              <option value={BOOKING_REQUEST_TYPES.STUDIO_BOOKING}>Studio Booking</option>
              <option value={BOOKING_REQUEST_TYPES.POST_PRODUCTION_INQUIRY}>Post-Production</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter layanan"
              value={serviceFilter}
              onChange={(e) => onServiceFilterChange(e.target.value)}
              className="sa-input min-h-10 w-full rounded-xl px-3 py-2 text-xs font-medium sm:text-sm"
            >
              <option value="all">Semua Layanan</option>
              {PUBLIC_SERVICE_OPTIONS.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 lg:col-span-2">
            <input
              type="date"
              aria-label="Filter tanggal pilihan"
              value={preferredDateFilter}
              onChange={(e) => onPreferredDateFilterChange(e.target.value)}
              className="sa-input min-h-10 w-full rounded-xl px-2.5 py-2 text-xs font-medium"
            />
            {hasActiveFilters ? (
              <AdminButton
                variant="secondary"
                size="sm"
                onClick={onResetFilters}
                aria-label="Reset semua filter"
                title="Reset filter"
                className="shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </AdminButton>
            ) : null}
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
