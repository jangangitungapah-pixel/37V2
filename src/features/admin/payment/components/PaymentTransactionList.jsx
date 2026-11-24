import { useState } from 'react';
import { ArrowLeftRight, ReceiptText, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';

import {
  getPaymentMethodLabel,
  PAYMENT_METHOD_OPTIONS,
} from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import {
  getPaymentSourceMeta,
  getTransactionTypeMeta,
  TRANSACTION_TYPE,
  TRANSACTION_TYPE_FILTER_OPTIONS,
} from '../utils/invoice-status';

export function PaymentTransactionList({
  transactions = [],
  invoicesById = new Map(),
  reversedTransactionIds = new Set(),
  searchQuery,
  onSearchQueryChange,
  paymentMethod,
  onPaymentMethodChange,
  transactionType,
  onTransactionTypeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  hasActiveFilters = false,
  onClearFilters,
  onOpenReceipt,
  onOpenInvoice,
  hasMore = false,
  onLoadMore,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const secondaryFilterCount =
    (paymentMethod !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Transactions Filter Bar */}
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Filter dan pencarian transaksi pembayaran"
        className="space-y-2.5 p-3 sm:space-y-3.5 sm:p-5"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
          <div className="order-2 min-w-0 xl:order-1">
            <div className="mb-1.5 hidden min-h-5 items-center justify-between gap-2 sm:flex">
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#666159]">
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Jenis Transaksi</span>
              </span>
              <AdminStatusBadge tone="ivory" size="sm" className="font-mono xl:hidden">
                {transactions.length} transaksi
              </AdminStatusBadge>
            </div>

            <div
              role="group"
              aria-label="Filter jenis transaksi pembayaran"
              className="sa-pill-track grid w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto"
            >
              {TRANSACTION_TYPE_FILTER_OPTIONS.map((opt) => {
                const isSelected = transactionType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onTransactionTypeChange(opt.id)}
                    aria-pressed={isSelected}
                    className={
                      isSelected
                        ? 'inline-flex min-h-9 w-full cursor-pointer items-center justify-center rounded-[10px] bg-white px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#151515] shadow-[0_1px_3px_rgba(21,21,21,0.08)] sm:w-auto sm:px-3.5'
                        : 'inline-flex min-h-9 w-full cursor-pointer items-center justify-center rounded-[10px] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#666159] transition-colors hover:text-[#151515] sm:w-auto sm:px-3.5'
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="order-1 flex w-full min-w-0 flex-col xl:order-2 xl:min-w-[320px] xl:flex-1">
            <div className="mb-1.5 hidden min-h-5 items-center justify-end gap-2 text-xs xl:flex">
              <span className="text-[#666159]">Hasil Tampil:</span>
              <AdminStatusBadge tone="ivory" size="sm" className="font-mono font-semibold">
                {transactions.length} transaksi
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
                  aria-label="Cari ID transaksi, no. invoice, pelanggan, atau referensi"
                  placeholder="Cari ID transaksi, no. invoice, pelanggan, atau ref..."
                  className="sa-input h-10.5 w-full py-2 pr-10 pl-9.5 text-xs font-medium sm:text-[13px]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => onSearchQueryChange('')}
                    aria-label="Bersihkan pencarian transaksi"
                    className="absolute top-1/2 right-1 inline-flex h-8.5 w-8.5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#666159] hover:bg-[#151515]/[0.05] hover:text-[#151515]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                aria-expanded={mobileFiltersOpen}
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                className="sa-control sa-btn-secondary inline-flex h-10.5 shrink-0 cursor-pointer items-center gap-1.5 px-3 text-xs font-semibold sm:hidden"
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

        {/* Method + Date Range (Collapsed on Mobile by Default) */}
        <div
          className={`${mobileFiltersOpen ? 'grid' : 'hidden sm:grid'} grid-cols-1 gap-2.5 border-t border-[#151515]/[0.07] pt-3 min-[420px]:grid-cols-2 sm:pt-3.5 lg:flex lg:flex-wrap lg:items-end`}
        >
          <div className="min-w-0 min-[420px]:col-span-2 lg:col-span-1 lg:w-44">
            <label
              htmlFor="tx-method-filter"
              className="mb-1 block text-xs font-medium text-[#666159]"
            >
              Metode Pembayaran
            </label>
            <select
              id="tx-method-filter"
              value={paymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value)}
              className="sa-input h-10.5 w-full cursor-pointer px-3 text-xs font-medium"
            >
              <option value="all">Semua Metode</option>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:w-44">
            <label htmlFor="tx-date-from" className="mb-1 block text-xs font-medium text-[#666159]">
              Dari Tanggal
            </label>
            <input
              id="tx-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="sa-input h-10.5 w-full min-w-0 px-3 font-mono text-xs font-medium"
            />
          </div>

          <div className="min-w-0 lg:w-44">
            <label htmlFor="tx-date-to" className="mb-1 block text-xs font-medium text-[#666159]">
              Sampai Tanggal
            </label>
            <input
              id="tx-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="sa-input h-10.5 w-full min-w-0 px-3 font-mono text-xs font-medium"
            />
          </div>

          {hasActiveFilters ? (
            <div className="min-[420px]:col-span-2 lg:ml-auto">
              <button
                type="button"
                onClick={onClearFilters}
                className="sa-control sa-btn-secondary inline-flex h-10.5 w-full cursor-pointer items-center justify-center gap-1.5 px-3.5 text-xs font-semibold lg:w-auto"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                <span>Clear Filters</span>
              </button>
            </div>
          ) : null}
        </div>
      </AdminSurface>

      {/* Transactions Table / Mobile List */}
      {transactions.length === 0 ? (
        <AdminSurface as="section" variant="card" className="p-5 sm:p-6">
          <AdminEmptyState
            icon={ReceiptText}
            title={
              hasActiveFilters ? 'Tidak Ada Transaksi yang Cocok' : 'Belum Ada Transaksi Pembayaran'
            }
            description={
              hasActiveFilters
                ? 'Ubah kata kunci pencarian, metode, atau rentang tanggal untuk melihat transaksi lain.'
                : 'Setiap pembayaran DP booking maupun pelunasan manual akan tercatat otomatis di ledger ini.'
            }
          />
        </AdminSurface>
      ) : (
        <AdminSurface
          as="section"
          variant="card"
          aria-label="Tabel riwayat transaksi pembayaran"
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-4 py-3">
            <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
              Catatan Pembayaran
            </span>
            <span className="hidden text-xs text-[#666159] sm:inline">
              Catatan tersimpan permanen • Salah input dikoreksi lewat Pembatalan
            </span>
          </div>

          <table className="block w-full border-collapse text-left md:table">
            <thead className="hidden border-b border-[#151515]/[0.08] bg-[#FAF8F3]/90 text-[11px] font-semibold tracking-wide text-[#666159] md:table-header-group">
              <tr>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Waktu &amp; No. Transaksi
                </th>
                <th scope="col" className="px-3.5 py-2.5">
                  Invoice &amp; Pelanggan
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Jenis / Sumber
                </th>
                <th scope="col" className="hidden px-3.5 py-2.5 whitespace-nowrap xl:table-cell">
                  Metode
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  Nominal
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="block divide-y divide-[#151515]/[0.06] md:table-row-group">
              {transactions.map((tx) => {
                const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
                const isReversed = reversedTransactionIds.has(tx.id);
                const typeMeta = getTransactionTypeMeta(tx.transactionType);
                const sourceMeta = getPaymentSourceMeta(tx.source);
                const linkedInvoice = invoicesById.get(tx.invoiceId) || null;

                const rowBgClass = isReversal
                  ? 'border-l-[3px] border-l-[#FF4B22] bg-[#FFEDE8]/35 hover:bg-[#FFEDE8]/55'
                  : 'bg-white hover:bg-[#FAF8F3]/75';

                return (
                  <tr
                    key={tx.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 px-3 py-2.5 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                  >
                    <td className="col-start-1 row-start-1 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle">
                      <p className="font-mono text-xs font-semibold break-words text-[#151515] md:whitespace-nowrap">
                        {formatIndonesianTimestamp(tx.receivedAt || tx.createdAt)}
                      </p>
                      <p className="mt-0.5 hidden truncate font-mono text-[10px] text-[#8B857B] sm:block md:break-all md:whitespace-normal">
                        {tx.id}
                      </p>
                    </td>

                    <td className="col-span-2 row-start-2 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice?.(tx.invoiceId)}
                        className="block max-w-full cursor-pointer truncate py-1 text-left font-mono text-xs font-semibold text-[#151515] transition-colors hover:text-[#FF4B22]"
                      >
                        {tx.invoiceNumber || tx.invoiceId}
                      </button>
                      <p className="mt-0.5 text-xs font-medium text-[#46433D]">
                        {linkedInvoice?.customerSnapshot?.name || 'Customer Invoice'}
                        {tx.referenceNumber ? (
                          <span className="font-mono text-[11px] text-[#666159]">
                            {' '}
                            • Ref: {tx.referenceNumber}
                          </span>
                        ) : null}
                      </p>
                      {tx.notes ? (
                        <p className="mt-0.5 text-[11px] text-[#666159]">{tx.notes}</p>
                      ) : null}
                    </td>

                    <td className="col-start-1 row-start-3 min-w-0 self-center pt-0.5 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:align-middle md:whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </span>
                        <AdminStatusBadge
                          tone="ivory"
                          size="sm"
                          className="font-mono uppercase xl:hidden"
                        >
                          {getPaymentMethodLabel(tx.paymentMethod)}
                        </AdminStatusBadge>
                        {isReversed ? (
                          <AdminStatusBadge tone="neutral" size="sm" className="uppercase">
                            Dibatalkan
                          </AdminStatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#666159]">{sourceMeta.shortLabel}</p>
                    </td>

                    <td className="hidden xl:table-cell xl:px-3.5 xl:py-3 xl:align-middle xl:whitespace-nowrap">
                      <AdminStatusBadge tone="ivory" size="sm" className="font-mono uppercase">
                        {getPaymentMethodLabel(tx.paymentMethod)}
                      </AdminStatusBadge>
                    </td>

                    <td className="col-start-2 row-start-1 justify-self-end md:table-cell md:px-3.5 md:py-3 md:text-right md:align-middle md:whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-bold whitespace-nowrap tabular-nums ${
                          isReversal
                            ? 'text-[#FF4B22]'
                            : isReversed
                              ? 'text-[#8B857B] line-through'
                              : 'text-[#0F6246]'
                        }`}
                      >
                        {isReversal ? '-' : '+'}
                        {formatRupiah(tx.amount)}
                      </span>
                    </td>

                    <td className="col-start-2 row-start-3 self-center justify-self-end pt-0.5 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:text-right md:align-middle md:whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt?.(tx, linkedInvoice)}
                        aria-label={`Buka receipt transaksi ${tx.id}`}
                        className="sa-control sa-btn-secondary inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-semibold hover:bg-[#C8F13A]"
                      >
                        <ReceiptText className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                        <span>Kwitansi</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminSurface>
      )}

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="sa-control sa-btn-secondary inline-flex min-h-9.5 w-full cursor-pointer items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold sm:w-auto"
          >
            Muat Lebih Banyak Transaksi
          </button>
        </div>
      ) : null}
    </div>
  );
}
