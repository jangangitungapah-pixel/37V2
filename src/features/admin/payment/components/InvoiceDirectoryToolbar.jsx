import { Filter, RotateCcw, Search, X } from 'lucide-react';

import { ROOM_FILTER_OPTIONS } from '@/features/admin/calendar/config/calendar-config';

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
  return (
    <section
      aria-label="Filter dan pencarian invoice"
      className="cal-card bg-studio-white space-y-2 p-2.5 sm:space-y-2.5 sm:p-4"
    >
      {/* Row 1: Payment Status Pills + Visible Counter & Primary Search */}
      <div className="flex flex-col gap-2 sm:gap-2.5 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-3 xl:gap-y-2">
        <div className="min-w-0">
          <div className="mb-1 flex min-h-4 items-center justify-between gap-2 sm:min-h-5">
            <span className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase sm:text-[10px]">
              <Filter className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Status Pembayaran</span>
            </span>
            <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold whitespace-nowrap uppercase xl:hidden">
              {visibleCount} invoice
            </span>
          </div>

          <div
            role="group"
            aria-label="Filter status pembayaran invoice"
            className="flex flex-wrap gap-1 sm:inline-flex sm:w-auto sm:gap-1.5"
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
                      ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-8 cursor-pointer items-center justify-center border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] sm:min-h-10 sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                      : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-8 cursor-pointer items-center justify-center border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-bold whitespace-nowrap uppercase sm:min-h-10 sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                  }
                >
                  {option.compactLabel || option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col xl:min-w-[320px] xl:flex-1">
          <div className="mb-1 hidden min-h-5 items-center justify-end gap-2 font-mono text-[10px] font-bold uppercase xl:flex">
            <span className="text-studio-muted-ink">Hasil Tampil:</span>
            <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
              {visibleCount} invoice
            </span>
          </div>

          <div className="relative w-full min-w-0">
            <Search
              className="text-studio-muted-ink pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              aria-label="Cari nomor invoice, customer, nomor HP, atau band"
              placeholder="Cari no. invoice, customer, no. HP, atau band..."
              className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-9 w-full border-2 py-1 pr-8 pl-8 text-xs font-semibold sm:h-10 sm:py-1.5"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                aria-label="Bersihkan pencarian invoice"
                className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center sm:h-8 sm:w-8"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Row 2: Invoice Status, Room, Date Range & Clear Filters */}
      <div className="grid grid-cols-1 gap-1.5 border-t border-neutral-200 pt-2 min-[320px]:grid-cols-2 sm:gap-2 sm:pt-2.5 lg:flex lg:flex-wrap lg:items-end">
        <div className="min-w-0 lg:w-40">
          <label
            htmlFor="invoice-status-filter"
            className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
          >
            Invoice Status
          </label>
          <select
            id="invoice-status-filter"
            value={invoiceStatus}
            onChange={(event) => onInvoiceStatusChange(event.target.value)}
            className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full cursor-pointer border-2 px-1.5 font-mono text-[9.5px] font-extrabold uppercase sm:h-10 sm:px-2 sm:text-[10px]"
          >
            {INVOICE_STATUS_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:w-36">
          <label
            htmlFor="invoice-room-filter"
            className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
          >
            Ruangan
          </label>
          <select
            id="invoice-room-filter"
            value={studioId}
            onChange={(event) => onStudioIdChange(event.target.value)}
            className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full cursor-pointer border-2 px-1.5 font-mono text-[9.5px] font-extrabold uppercase sm:h-10 sm:px-2 sm:text-[10px]"
          >
            {ROOM_FILTER_OPTIONS.map((room) => (
              <option key={room.id} value={room.id}>
                {room.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:w-40">
          <label
            htmlFor="invoice-date-from"
            className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
          >
            Dari Tanggal
          </label>
          <input
            id="invoice-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full min-w-0 border-2 px-1.5 font-mono text-[9.5px] font-bold sm:h-10 sm:px-2 sm:text-[10.5px]"
          />
        </div>

        <div className="min-w-0 lg:w-40">
          <label
            htmlFor="invoice-date-to"
            className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
          >
            Sampai Tanggal
          </label>
          <input
            id="invoice-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full min-w-0 border-2 px-1.5 font-mono text-[9.5px] font-bold sm:h-10 sm:px-2 sm:text-[10.5px]"
          />
        </div>

        {hasActiveFilters ? (
          <div className="min-[320px]:col-span-2 lg:ml-auto">
            <button
              type="button"
              onClick={onClearFilters}
              className="cal-control bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex h-8.5 w-full cursor-pointer items-center justify-center gap-1.5 px-3 font-mono text-[10px] font-extrabold uppercase sm:h-10 lg:w-auto"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              <span>Clear Filters</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
