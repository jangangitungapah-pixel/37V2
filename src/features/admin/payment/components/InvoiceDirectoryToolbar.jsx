import { useState } from 'react';
import { Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';

import { ROOM_FILTER_OPTIONS } from '@/features/admin/calendar/config/calendar-config';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { INVOICE_PAYMENT_STATUS_OPTIONS, INVOICE_STATUS_OPTIONS } from '../utils/invoice-status';

export function InvoiceDirectoryToolbar({
  searchQuery,
  onSearchQueryChange,
  paymentStatus,
  onPaymentStatusChange,
  invoiceStatus,
  onInvoiceStatusChange,
  studioId,
  onStudioIdChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
  hasActiveFilters = false,
  visibleCount = 0,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const secondaryFilterCount =
    (invoiceStatus !== 'all' ? 1 : 0) +
    (studioId !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Filter dan pencarian invoice"
      className="space-y-2.5 p-3 sm:space-y-3.5 sm:p-5"
    >
      {/* Row 1: Primary Search + Mobile Filter Toggle first on mobile; Status Pills first on desktop */}
      <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
        <div className="order-2 min-w-0 xl:order-1">
          <div className="mb-1.5 hidden min-h-5 items-center justify-between gap-2 sm:flex">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#666159]">
              <Filter className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Status Pembayaran</span>
            </span>
            <AdminStatusBadge tone="ivory" size="sm" className="font-mono xl:hidden">
              {visibleCount} invoice
            </AdminStatusBadge>
          </div>

          <div
            role="group"
            aria-label="Filter status pembayaran invoice"
            className="sa-pill-track flex flex-nowrap gap-1 overflow-x-auto sm:inline-flex sm:w-auto sm:flex-wrap sm:overflow-visible"
          >
            {INVOICE_PAYMENT_STATUS_OPTIONS.map((option) => {
              const isSelected = paymentStatus === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onPaymentStatusChange(option.id)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? 'inline-flex min-h-8.5 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:min-h-9.5 sm:px-3.5 sm:py-1.5'
                      : 'inline-flex min-h-8.5 shrink-0 cursor-pointer items-center justify-center rounded-[10px] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#666159] transition-colors hover:text-[#151515] sm:min-h-9.5 sm:px-3.5 sm:py-1.5'
                  }
                >
                  {option.compactLabel || option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="order-1 flex w-full min-w-0 flex-col xl:order-2 xl:min-w-[320px] xl:flex-1">
          <div className="mb-1.5 hidden min-h-5 items-center justify-end gap-2 text-xs xl:flex">
            <span className="text-[#666159]">Hasil Tampil:</span>
            <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
              {visibleCount} invoice
            </AdminStatusBadge>
          </div>

          <div className="flex w-full items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                aria-label="Cari nomor invoice, pelanggan, nomor HP, atau band"
                placeholder="Cari no. invoice, pelanggan, no. HP, atau band..."
                className="sa-input h-9.5 w-full py-2 pr-9 pl-9.5 text-xs font-medium sm:h-10 sm:text-[13px]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian invoice"
                  className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.05] hover:text-[#151515]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="sa-control sa-btn-secondary inline-flex h-9.5 shrink-0 cursor-pointer items-center gap-1.5 px-2.5 text-xs font-semibold sm:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter</span>
              {secondaryFilterCount > 0 ? (
                <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#C8F13A]">
                  {secondaryFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Invoice Status, Room, Date Range & Clear Filters (Collapsed on Mobile by Default) */}
      <div
        className={`${mobileFiltersOpen ? 'grid' : 'hidden sm:grid'} grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 min-[320px]:grid-cols-2 sm:pt-3.5 lg:flex lg:flex-wrap lg:items-end`}
      >
        <div className="min-w-0 lg:w-44">
          <label
            htmlFor="invoice-status-filter"
            className="mb-1 block text-xs font-medium text-[#666159]"
          >
            Status Invoice
          </label>
          <select
            id="invoice-status-filter"
            value={invoiceStatus}
            onChange={(event) => onInvoiceStatusChange(event.target.value)}
            className="sa-input h-10 w-full cursor-pointer px-3 text-xs font-medium"
          >
            {INVOICE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:w-40">
          <label
            htmlFor="invoice-room-filter"
            className="mb-1 block text-xs font-medium text-[#666159]"
          >
            Ruangan
          </label>
          <select
            id="invoice-room-filter"
            value={studioId}
            onChange={(event) => onStudioIdChange(event.target.value)}
            className="sa-input h-10 w-full cursor-pointer px-3 text-xs font-medium"
          >
            {ROOM_FILTER_OPTIONS.map((room) => (
              <option key={room.id} value={room.id}>
                {room.id === 'all' ? 'Semua Ruangan' : room.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:w-44">
          <label
            htmlFor="invoice-date-from"
            className="mb-1 block text-xs font-medium text-[#666159]"
          >
            Dari Tanggal
          </label>
          <input
            id="invoice-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="sa-input h-10 w-full min-w-0 px-3 font-mono text-xs font-medium"
          />
        </div>

        <div className="min-w-0 lg:w-44">
          <label
            htmlFor="invoice-date-to"
            className="mb-1 block text-xs font-medium text-[#666159]"
          >
            Sampai Tanggal
          </label>
          <input
            id="invoice-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="sa-input h-10 w-full min-w-0 px-3 font-mono text-xs font-medium"
          />
        </div>

        {hasActiveFilters ? (
          <div className="min-[320px]:col-span-2 lg:ml-auto">
            <button
              type="button"
              onClick={onClearFilters}
              className="sa-control sa-btn-secondary inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 px-3.5 text-xs font-semibold lg:w-auto"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          </div>
        ) : null}
      </div>
    </AdminSurface>
  );
}
