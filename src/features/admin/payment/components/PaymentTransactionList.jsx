import { ArrowLeftRight, ReceiptText, RotateCcw, Search, X } from 'lucide-react';

import {
  getPaymentMethodLabel,
  PAYMENT_METHOD_OPTIONS,
} from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

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
  return (
    <div className="space-y-2.5 sm:space-y-3.5">
      {/* Transactions Filter Bar */}
      <section
        aria-label="Filter dan pencarian transaksi pembayaran"
        className="cal-card bg-studio-white space-y-2 p-2.5 sm:space-y-2.5 sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:gap-2.5 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between xl:gap-x-3 xl:gap-y-2">
          <div className="min-w-0">
            <div className="mb-1 flex min-h-4 items-center justify-between gap-2 sm:min-h-5">
              <span className="text-studio-muted-ink flex items-center gap-1 font-mono text-[9.5px] font-extrabold uppercase sm:text-[10px]">
                <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Jenis Transaksi</span>
              </span>
              <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-1.5 py-0.5 font-mono text-[9px] font-extrabold whitespace-nowrap uppercase xl:hidden">
                {transactions.length} transaksi
              </span>
            </div>

            <div
              role="group"
              aria-label="Filter jenis transaksi pembayaran"
              className="grid w-full grid-cols-3 gap-1 sm:inline-flex sm:w-auto sm:gap-1.5"
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
                        ? 'border-studio-ink bg-studio-lime text-studio-ink inline-flex min-h-8 w-full cursor-pointer items-center justify-center border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-extrabold whitespace-nowrap uppercase shadow-[2px_2px_0px_#151515] sm:min-h-10 sm:w-auto sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                        : 'border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-white inline-flex min-h-8 w-full cursor-pointer items-center justify-center border-2 px-2 py-1 font-mono text-[9.5px] leading-none font-bold whitespace-nowrap uppercase sm:min-h-10 sm:w-auto sm:px-2.5 sm:text-[10px] md:text-[10.5px]'
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col xl:min-w-[320px] xl:flex-1">
            <div className="mb-1 hidden min-h-5 items-center justify-end gap-2 font-mono text-[10px] font-bold uppercase xl:flex">
              <span className="text-studio-muted-ink">Hasil Tampil:</span>
              <span className="border-studio-ink bg-studio-ivory text-studio-ink border px-2 py-0.5 font-extrabold whitespace-nowrap">
                {transactions.length} transaksi
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
                aria-label="Cari ID transaksi, no. invoice, customer, atau referensi"
                placeholder="Cari ID transaksi, no. invoice, customer, atau ref..."
                className="border-studio-ink bg-studio-ivory text-studio-ink placeholder:text-studio-subtle-ink h-9 w-full border-2 py-1 pr-8 pl-8 text-xs font-semibold sm:h-10 sm:py-1.5"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  aria-label="Bersihkan pencarian transaksi"
                  className="text-studio-ink hover:text-studio-orange absolute top-1/2 right-1 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center sm:h-8 sm:w-8"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Method + Date Range */}
        <div className="grid grid-cols-1 gap-1.5 border-t border-neutral-200 pt-2 min-[320px]:grid-cols-2 sm:gap-2 sm:pt-2.5 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-0 min-[320px]:col-span-2 lg:col-span-1 lg:w-40">
            <label
              htmlFor="tx-method-filter"
              className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
            >
              Metode Pembayaran
            </label>
            <select
              id="tx-method-filter"
              value={paymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value)}
              className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full cursor-pointer border-2 px-1.5 font-mono text-[9.5px] font-extrabold uppercase sm:h-10 sm:px-2 sm:text-[10px]"
            >
              <option value="all">All Methods</option>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:w-40">
            <label
              htmlFor="tx-date-from"
              className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
            >
              Dari Tanggal
            </label>
            <input
              id="tx-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="border-studio-ink bg-studio-ivory text-studio-ink h-8.5 w-full min-w-0 border-2 px-1.5 font-mono text-[9.5px] font-bold sm:h-10 sm:px-2 sm:text-[10.5px]"
            />
          </div>

          <div className="min-w-0 lg:w-40">
            <label
              htmlFor="tx-date-to"
              className="text-studio-muted-ink mb-0.5 block font-mono text-[9px] font-extrabold uppercase sm:mb-1 sm:text-[9.5px]"
            >
              Sampai Tanggal
            </label>
            <input
              id="tx-date-to"
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

      {/* Transactions Table / Mobile List */}
      {transactions.length === 0 ? (
        <section className="cal-card bg-studio-white p-6 text-center">
          <p className="font-display text-studio-ink text-xl font-black uppercase">
            {hasActiveFilters ? 'Tidak Ada Transaksi yang Cocok' : 'Belum Ada Transaksi Pembayaran'}
          </p>
          <p className="text-studio-muted-ink mx-auto mt-1 max-w-md text-xs font-medium">
            {hasActiveFilters
              ? 'Ubah kata kunci pencarian, metode, atau rentang tanggal untuk melihat transaksi lain.'
              : 'Setiap pembayaran DP booking maupun pelunasan manual akan tercatat otomatis di ledger ini.'}
          </p>
        </section>
      ) : (
        <section
          aria-label="Tabel riwayat transaksi pembayaran"
          className="cal-card bg-studio-white overflow-hidden"
        >
          <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-1.5 border-b-2 px-2.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
            <span className="text-studio-ink font-mono text-[9.5px] font-extrabold tracking-wider uppercase sm:text-[10px]">
              APPEND-ONLY PAYMENT LEDGER
            </span>
            <span className="text-studio-muted-ink hidden font-mono text-[9.5px] font-bold uppercase sm:inline">
              Transaksi tidak dapat diedit/dihapus • Koreksi melalui Reversal
            </span>
          </div>

          <table className="block w-full border-collapse text-left md:table">
            <thead className="border-studio-ink bg-studio-ink text-studio-ivory hidden border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase md:table-header-group">
              <tr>
                <th scope="col" className="px-2.5 py-2 whitespace-nowrap xl:px-3">
                  Waktu &amp; ID
                </th>
                <th scope="col" className="px-2.5 py-2 xl:px-3">
                  Invoice &amp; Customer
                </th>
                <th scope="col" className="px-2.5 py-2 whitespace-nowrap xl:px-3">
                  Jenis / Sumber
                </th>
                <th
                  scope="col"
                  className="hidden px-2.5 py-2 whitespace-nowrap xl:table-cell xl:px-3"
                >
                  Metode
                </th>
                <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap xl:px-3">
                  Nominal
                </th>
                <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap xl:px-3">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="block divide-y divide-neutral-200 md:table-row-group">
              {transactions.map((tx, idx) => {
                const isReversal = tx.transactionType === TRANSACTION_TYPE.REVERSAL;
                const isReversed = reversedTransactionIds.has(tx.id);
                const typeMeta = getTransactionTypeMeta(tx.transactionType);
                const sourceMeta = getPaymentSourceMeta(tx.source);
                const linkedInvoice = invoicesById.get(tx.invoiceId) || null;

                const rowBgClass = isReversal
                  ? 'border-l-4 border-l-studio-orange bg-orange-50/40 hover:bg-orange-50/80'
                  : idx % 2 === 1
                    ? 'bg-studio-ivory/40 hover:bg-studio-lime/15'
                    : 'bg-studio-white hover:bg-studio-lime/15';

                return (
                  <tr
                    key={tx.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 px-2.5 py-2 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                  >
                    <td className="col-start-1 row-start-1 min-w-0 md:table-cell md:px-2.5 md:py-2 md:align-middle xl:px-3">
                      <p className="text-studio-ink font-mono text-[10px] font-extrabold whitespace-nowrap sm:text-[10.5px] xl:text-[11px]">
                        {formatIndonesianTimestamp(tx.receivedAt || tx.createdAt)}
                      </p>
                      <p className="text-studio-subtle-ink mt-0.5 truncate font-mono text-[8.5px] font-semibold sm:text-[9px] md:break-all md:whitespace-normal">
                        {tx.id}
                      </p>
                    </td>

                    <td className="col-span-2 row-start-2 min-w-0 md:table-cell md:px-2.5 md:py-2 md:align-middle xl:px-3">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice?.(tx.invoiceId)}
                        className="text-studio-ink hover:text-studio-orange block max-w-full cursor-pointer truncate text-left font-mono text-[10.5px] font-extrabold transition-colors xl:text-[11px]"
                      >
                        {tx.invoiceNumber || tx.invoiceId}
                      </button>
                      <p className="text-studio-muted-ink text-xs leading-snug font-bold">
                        {linkedInvoice?.customerSnapshot?.name || 'Customer Invoice'}
                        {tx.referenceNumber ? (
                          <span className="text-studio-subtle-ink font-mono text-[9.5px] font-semibold">
                            {' '}
                            • Ref: {tx.referenceNumber}
                          </span>
                        ) : null}
                      </p>
                      {tx.notes ? (
                        <p className="text-studio-subtle-ink mt-0.5 text-[10.5px] leading-snug">
                          {tx.notes}
                        </p>
                      ) : null}
                    </td>

                    <td className="col-start-1 row-start-3 min-w-0 self-center pt-0.5 md:table-cell md:px-2.5 md:py-2 md:pt-2 md:align-middle md:whitespace-nowrap xl:px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold uppercase sm:text-[9px] ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.label}
                        </span>
                        <span className="border-studio-ink bg-studio-ivory border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold uppercase xl:hidden">
                          {getPaymentMethodLabel(tx.paymentMethod)}
                        </span>
                        {isReversed ? (
                          <span className="border-studio-ink border bg-neutral-200 px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold text-neutral-700 uppercase">
                            Reversed
                          </span>
                        ) : null}
                      </div>
                      <p className="text-studio-subtle-ink mt-0.5 font-mono text-[9px] font-semibold sm:text-[9.5px]">
                        {sourceMeta.shortLabel}
                      </p>
                    </td>

                    <td className="hidden xl:table-cell xl:px-3 xl:py-2 xl:align-middle xl:whitespace-nowrap">
                      <span className="border-studio-ink bg-studio-ivory border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold uppercase">
                        {getPaymentMethodLabel(tx.paymentMethod)}
                      </span>
                    </td>

                    <td className="col-start-2 row-start-1 justify-self-end md:table-cell md:px-2.5 md:py-2 md:text-right md:align-middle md:whitespace-nowrap xl:px-3">
                      <span
                        className={`font-mono text-xs font-extrabold tabular-nums ${
                          isReversal
                            ? 'text-studio-orange'
                            : isReversed
                              ? 'text-neutral-500 line-through'
                              : 'text-emerald-800'
                        }`}
                      >
                        {isReversal ? '-' : '+'}
                        {formatRupiah(tx.amount)}
                      </span>
                    </td>

                    <td className="col-start-2 row-start-3 self-center justify-self-end pt-0.5 md:table-cell md:px-2.5 md:py-2 md:pt-2 md:text-right md:align-middle md:whitespace-nowrap xl:px-3">
                      <button
                        type="button"
                        onClick={() => onOpenReceipt?.(tx, linkedInvoice)}
                        aria-label={`Buka receipt transaksi ${tx.id}`}
                        className="border-studio-ink bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex h-7.5 cursor-pointer items-center justify-center gap-1 border px-2 font-mono text-[9.5px] font-extrabold uppercase transition-colors sm:h-8 xl:px-2.5"
                      >
                        <ReceiptText className="h-3 w-3" aria-hidden="true" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="cal-control bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
          >
            Muat Lebih Banyak Transaksi
          </button>
        </div>
      ) : null}
    </div>
  );
}
