import { ArrowUpRight, ChevronDown, Search, X } from 'lucide-react';

import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { getClientInvoiceEvidenceIndicator } from '@/features/payment-evidence/utils/payment-evidence-utils';

import {
  CLIENT_INVOICE_FILTERS,
  formatClientInvoiceServiceTitle,
  formatClientRupiah,
  getClientInvoiceStatusDisplay,
} from '../utils/client-billing-utils';
import { ClientBillingEmptyState } from './ClientBillingEmptyState';
import { ClientInvoiceCard } from './ClientInvoiceCard';

/**
 * Module B — Customer Invoice Directory with local search, status filter pills,
 * desktop structured ledger table, mobile cards, and truncation load-more support.
 */
export function ClientInvoiceList({
  invoices = [],
  totalInvoiceCount = 0,
  filterCounts = {},
  statusFilter = 'all',
  onStatusFilterChange,
  searchQuery = '',
  onSearchQueryChange,
  referenceDateIso,
  evidenceByInvoiceId = null,
  isLoading = false,
  hasMore = false,
  isTruncated = false,
  onLoadMore,
  error = '',
  onRetry,
  onSelectInvoice,
}) {
  const hasActiveFilters = statusFilter !== 'all' || Boolean(String(searchQuery || '').trim());

  const handleResetFilters = () => {
    onStatusFilterChange?.('all');
    onSearchQueryChange?.('');
  };

  return (
    <AdminSurface
      as="section"
      variant="card"
      aria-labelledby="client-invoice-directory-heading"
      data-testid="client-invoice-directory"
      className="space-y-4 p-4 sm:p-5"
    >
      {/* Directory Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="client-invoice-directory-heading"
            className="text-sm font-bold text-[#151515] sm:text-base"
          >
            Studio Invoices
          </h2>
          <p className="text-xs text-[#666159]">
            Official billing statements and payment status for your studio sessions
          </p>
        </div>

        {!isLoading && !error ? (
          <AdminStatusBadge tone={totalInvoiceCount > 0 ? 'lime' : 'neutral'} dot={totalInvoiceCount > 0}>
            {totalInvoiceCount === 1 ? '1 Invoice' : `${totalInvoiceCount} Invoices`}
          </AdminStatusBadge>
        ) : null}
      </div>

      {/* Filter Pills + Local Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter invoices by payment status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {CLIENT_INVOICE_FILTERS.map((tab) => {
            const active = statusFilter === tab.id;
            const count = filterCounts?.[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusFilterChange?.(tab.id)}
                className={`inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-[#151515] bg-[#151515] text-[#F1EEE4]'
                    : 'border-[#151515]/12 bg-[#F8F6EF] text-[#46433D] hover:border-[#151515]/30 hover:text-[#151515]'
                }`}
              >
                <span>{tab.label}</span>
                {!isLoading && !error ? (
                  <span
                    className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
                      active ? 'bg-white/15 text-[#C8F13A]' : 'bg-[#151515]/[0.06] text-[#666159]'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#666159]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            aria-label="Search invoices by invoice number, booking reference, or service"
            placeholder="Search invoice, booking ref, or service..."
            className="sa-input min-h-9 w-full pr-8 pl-8.5 text-xs"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchQueryChange?.('')}
              aria-label="Clear invoice search"
              className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-[#666159] hover:bg-[#151515]/[0.06] hover:text-[#151515]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div data-testid="client-invoice-list-skeleton" className="space-y-2.5">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-20 w-full animate-pulse rounded-2xl bg-[#151515]/[0.06]"
            />
          ))}
        </div>
      ) : error ? (
        <ClientBillingEmptyState variant="error" errorMessage={error} onRetry={onRetry} />
      ) : totalInvoiceCount === 0 ? (
        <ClientBillingEmptyState variant="no-invoices" />
      ) : invoices.length === 0 ? (
        <ClientBillingEmptyState
          variant="no-matches"
          onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
        />
      ) : (
        <>
          {/* Desktop Structured Ledger Table (`lg+`) */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#151515]/10 bg-white lg:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#151515]/10 bg-[#F8F6EF] font-mono text-[10.5px] font-semibold tracking-wider text-[#666159] uppercase">
                  <th scope="col" className="px-3.5 py-3">
                    Invoice Number
                  </th>
                  <th scope="col" className="px-3.5 py-3">
                    Service
                  </th>
                  <th scope="col" className="px-3.5 py-3">
                    Booking Date
                  </th>
                  <th scope="col" className="px-3.5 py-3">
                    Invoice Date
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-right">
                    Total
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-right">
                    Amount Paid
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-right">
                    Balance Due
                  </th>
                  <th scope="col" className="px-3.5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151515]/[0.07]">
                {invoices.map((invoice) => {
                  const statusDisplay = getClientInvoiceStatusDisplay(invoice, referenceDateIso);
                  const invoiceEvidence = evidenceByInvoiceId?.get?.(invoice.id) || [];
                  const evidenceIndicator = getClientInvoiceEvidenceIndicator(
                    invoice,
                    invoiceEvidence,
                  );
                  const serviceTitle = formatClientInvoiceServiceTitle(invoice.bookingSnapshot);
                  const bookingDateLabel = invoice.bookingSnapshot?.bookingDate
                    ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
                    : '—';
                  const invoiceDateLabel = formatIndonesianTimestamp(
                    invoice.invoiceDate || invoice.createdAt,
                  );

                  return (
                    <tr
                      key={invoice.id}
                      data-testid={`client-invoice-row-${invoice.id}`}
                      onClick={() => onSelectInvoice?.(invoice)}
                      className="cursor-pointer transition-colors hover:bg-[#F8F6EF]/75"
                    >
                      <td className="px-3.5 py-3.5 align-middle">
                        <span className="font-mono text-xs font-bold text-[#151515]">
                          {invoice.invoiceNumber}
                        </span>
                      </td>

                      <td className="px-3.5 py-3.5 align-middle">
                        <p className="font-semibold text-[#151515]">{serviceTitle}</p>
                        {invoice.bookingId ? (
                          <p className="mt-0.5 font-mono text-[10.5px] text-[#666159]">
                            Ref: {invoice.bookingId}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-3.5 py-3.5 align-middle font-medium whitespace-nowrap text-[#46433D]">
                        {bookingDateLabel}
                      </td>

                      <td className="px-3.5 py-3.5 align-middle whitespace-nowrap text-[#666159]">
                        {invoiceDateLabel}
                      </td>

                      <td className="px-3.5 py-3.5 text-right align-middle font-mono font-semibold whitespace-nowrap text-[#151515] tabular-nums">
                        {formatClientRupiah(invoice.financialSnapshot?.totalAmount)}
                      </td>

                      <td className="px-3.5 py-3.5 text-right align-middle font-mono whitespace-nowrap text-[#0F6246] tabular-nums">
                        {formatClientRupiah(invoice.amountPaid)}
                      </td>

                      <td
                        className={`px-3.5 py-3.5 text-right align-middle font-mono font-bold whitespace-nowrap tabular-nums ${
                          !statusDisplay.isCancelled && invoice.balanceDue > 0
                            ? 'text-[#B92B0C]'
                            : 'text-[#151515]'
                        }`}
                      >
                        {statusDisplay.isCancelled
                          ? formatClientRupiah(0)
                          : formatClientRupiah(invoice.balanceDue)}
                      </td>

                      <td className="px-3.5 py-3.5 align-middle whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <AdminStatusBadge
                            tone={statusDisplay.tone}
                            dot={!statusDisplay.isCancelled}
                            size="sm"
                          >
                            {statusDisplay.label}
                          </AdminStatusBadge>
                          {evidenceIndicator ? (
                            <AdminStatusBadge
                              tone={evidenceIndicator.tone}
                              size="sm"
                              data-testid={`client-invoice-evidence-indicator-${invoice.id}`}
                            >
                              {evidenceIndicator.label}
                            </AdminStatusBadge>
                          ) : null}
                        </div>
                      </td>

                      <td
                        className="px-3.5 py-3.5 text-right align-middle whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectInvoice?.(invoice)}
                          aria-label={`View details for invoice ${invoice.invoiceNumber}`}
                          className="sa-btn-secondary inline-flex min-h-8 cursor-pointer items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                        >
                          <span>View Details</span>
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Invoice Cards (`< lg`) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {invoices.map((invoice) => (
              <ClientInvoiceCard
                key={invoice.id}
                invoice={invoice}
                referenceDateIso={referenceDateIso}
                evidenceItems={evidenceByInvoiceId?.get?.(invoice.id) || []}
                onSelect={onSelectInvoice}
              />
            ))}
          </div>

          {/* Truncation / Pagination Notice */}
          {(hasMore || isTruncated) && (
            <div
              data-testid="client-invoice-truncation-banner"
              className="sa-panel-ivory flex flex-col items-center justify-between gap-2 rounded-xl px-4 py-3 text-xs sm:flex-row"
            >
              <p className="text-[#46433D]">
                Showing the latest <span className="font-semibold">{totalInvoiceCount}</span>{' '}
                invoices. Older billing statements are available.
              </p>
              {onLoadMore ? (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Load More Invoices</span>
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </AdminSurface>
  );
}
