import { useState } from 'react';
import { Download, Eye, Filter, Loader2, Search, X } from 'lucide-react';

import {
  AdminButton,
  AdminEmptyState,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';

import {
  ALL_BOOKKEEPING_CATEGORIES,
  getLedgerPresentationMeta,
  getLedgerSourceGroupLabel,
  getLedgerStatusMeta,
} from '../config/bookkeeping-config';
import {
  buildLedgerCsv,
  formatBookkeepingDateTime,
  formatBookkeepingRupiah,
  triggerCsvDownload,
} from '../utils/bookkeeping-format';
import { BookkeepingTransactionCard } from './BookkeepingTransactionCard';

export function BookkeepingTransactionTable({
  items = [],
  searchQuery,
  onSearchQueryChange,
  directionFilter,
  onDirectionFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  hasActiveFilters,
  onClearFilters,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  onSelectEntry,
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const mobileFilterCount = [
    directionFilter !== 'all',
    categoryFilter !== 'all',
    sourceFilter !== 'all',
    statusFilter !== 'all',
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const handleExportCsv = () => {
    const csv = buildLedgerCsv(items);
    const filename = `37studio-ledger-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`;
    triggerCsvDownload(filename, csv);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Filter dan pencarian transaksi pembukuan"
        className="space-y-2.5 p-3 sm:space-y-3 sm:p-5"
      >
        {/* Top Row: Search + Actions */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8B857B]"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari deskripsi, kategori, nomor referensi, atau invoice"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Cari deskripsi, referensi, atau nomor invoice..."
              className="sa-input min-h-10 w-full py-2 pr-3 pl-9 text-xs text-[#151515] sm:text-[13px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="secondary"
              size="sm"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="sm:hidden"
            >
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter</span>
              {mobileFilterCount > 0 ? (
                <span className="rounded-full bg-[#151515] px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold text-[#C8F13A]">
                  {mobileFilterCount}
                </span>
              ) : null}
            </AdminButton>

            {hasActiveFilters ? (
              <AdminButton variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset</span>
              </AdminButton>
            ) : null}

            <AdminButton variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </AdminButton>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          className={`${mobileFiltersOpen ? 'grid' : 'hidden sm:grid'
            } grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6`}
        >
          <select
            aria-label="Filter arah transaksi"
            value={directionFilter}
            onChange={(e) => onDirectionFilterChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 text-xs text-[#151515]"
          >
            <option value="all">Semua Tipe (Income &amp; Expense)</option>
            <option value="income">Income (Masuk)</option>
            <option value="expense">Expense (Keluar / Akrual)</option>
          </select>

          <select
            aria-label="Filter kategori transaksi"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 text-xs text-[#151515]"
          >
            <option value="all">Semua Kategori</option>
            {ALL_BOOKKEEPING_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter sumber transaksi"
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 text-xs text-[#151515]"
          >
            <option value="all">Semua Sumber</option>
            <option value="invoice">Invoice / Customer</option>
            <option value="commission">Commission &amp; Fee</option>
            <option value="manual">Manual Bookkeeping</option>
          </select>

          <select
            aria-label="Filter status transaksi"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 text-xs text-[#151515]"
          >
            <option value="all">Semua Status</option>
            <option value="recorded">Recorded</option>
            <option value="accrued">Accrued (Belum Lunas)</option>
            <option value="partially_settled">Partially Paid</option>
            <option value="settled">Settled</option>
            <option value="reversed">Reversed</option>
          </select>

          <input
            type="date"
            aria-label="Filter dari tanggal"
            value={dateFrom}
            onChange={(e) => onDateFromChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 font-mono text-xs text-[#151515]"
          />

          <input
            type="date"
            aria-label="Filter sampai tanggal"
            value={dateTo}
            onChange={(e) => onDateToChange?.(e.target.value)}
            className="sa-input min-h-9 px-2.5 py-1.5 font-mono text-xs text-[#151515]"
          />
        </div>

        {/* Presentation Legend */}
        <div className="hidden flex-wrap items-center gap-2 border-t border-[#151515]/[0.06] pt-2 text-[11px] text-[#666159] sm:flex">
          <span className="font-semibold text-[#46433D]">Keterangan sifat catatan:</span>
          <AdminStatusBadge tone="lime" size="sm">
            Cash Tx
          </AdminStatusBadge>
          <span>Kas diterima / dibayar langsung</span>
          <span aria-hidden="true">•</span>
          <AdminStatusBadge tone="amber" size="sm">
            Accrual
          </AdminStatusBadge>
          <span>Kewajiban diakui (bukan kas keluar)</span>
          <span aria-hidden="true">•</span>
          <AdminStatusBadge tone="ink" size="sm">
            Settlement
          </AdminStatusBadge>
          <span>Kas keluar pelunasan kewajiban</span>
        </div>
      </AdminSurface>

      {isLoading && items.length === 0 ? (
        <AdminSurface
          variant="card"
          className="flex items-center justify-center gap-2 p-8 text-xs text-[#666159]"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memuat buku transaksi...</span>
        </AdminSurface>
      ) : items.length === 0 ? (
        <AdminEmptyState
          icon={Search}
          title={hasActiveFilters ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi'}
          description={
            hasActiveFilters
              ? 'Ubah filter atau kata kunci pencarian Anda.'
              : 'Belum ada transaksi keuangan yang tercatat pada sistem.'
          }
          action={
            hasActiveFilters ? (
              <AdminButton variant="secondary" onClick={onClearFilters}>
                Clear Filters
              </AdminButton>
            ) : null
          }
        />
      ) : (
        <AdminSurface variant="card" className="p-3.5 sm:p-5">
          {/* Desktop Compact Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#151515]/10 text-[11px] font-semibold text-[#666159] uppercase">
                  <th className="py-2.5 pr-3">Date</th>
                  <th className="px-3 py-2.5">Description</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Type / Nature</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]/[0.06]">
                {items.map((item) => {
                  const presentationMeta = getLedgerPresentationMeta(item.presentationType);
                  const statusMeta = getLedgerStatusMeta(item.status);
                  const isPositive = item.signedAmount > 0;

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#FAF8F3]">
                      <td className="py-2.5 pr-3 font-mono text-[11px] whitespace-nowrap text-[#46433D]">
                        {formatBookkeepingDateTime(item.date)}
                      </td>
                      <td className="max-w-xs px-3 py-2.5">
                        <p className="truncate font-semibold text-[#151515]">{item.description}</p>
                        {item.referenceNumber ? (
                          <p className="truncate font-mono text-[10.5px] text-[#666159]">
                            Ref: {item.referenceNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-[#46433D]">{item.categoryLabel}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <AdminStatusBadge
                            tone={item.direction === 'income' ? 'lime' : 'orange'}
                            size="sm"
                          >
                            {item.direction === 'income' ? 'Income' : 'Expense'}
                          </AdminStatusBadge>
                          <AdminStatusBadge tone={presentationMeta.tone} size="sm">
                            {presentationMeta.label}
                          </AdminStatusBadge>
                        </div>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap tabular-nums ${item.status === 'reversed'
                          ? 'text-[#666159] line-through'
                          : isPositive
                            ? 'text-[#243300]'
                            : 'text-[#B92B0C]'
                          }`}
                      >
                        {formatBookkeepingRupiah(item.signedAmount, { showPositiveSign: true })}
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminStatusBadge tone={statusMeta.tone} size="sm">
                          {statusMeta.label}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <AdminStatusBadge tone="ivory" size="sm">
                          {getLedgerSourceGroupLabel(item.sourceGroup)}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <AdminButton
                          variant="secondary"
                          size="xs"
                          onClick={() => onSelectEntry?.(item)}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Detail</span>
                        </AdminButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="space-y-2.5 md:hidden">
            {items.map((item) => (
              <BookkeepingTransactionCard key={item.id} item={item} onSelect={onSelectEntry} />
            ))}
          </div>

          {hasMore ? (
            <div className="mt-4 flex justify-center border-t border-[#151515]/[0.07] pt-3">
              <AdminButton variant="secondary" size="sm" onClick={onLoadMore}>
                Muat Lebih Banyak Transaksi
              </AdminButton>
            </div>
          ) : null}
        </AdminSurface>
      )}
    </div>
  );
}
