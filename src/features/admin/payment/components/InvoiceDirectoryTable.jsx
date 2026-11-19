import { Banknote, CalendarDays, ChevronRight } from 'lucide-react';

import { getStudioRoomById } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';
import { formatPhoneDisplay } from '@/features/admin/customer/utils/phone-number';

import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
  INVOICE_STATUS,
} from '../utils/invoice-status';

/**
 * Single-DOM Responsive Neo-Brutalist Invoice Table:
 * - Renders as a genuine compact `<table>` on `md+` (`768px`–`1440px`) with zero clipping
 * - Stacks cleanly per row on mobile (`286px`–`767px`) with zero horizontal page overflow
 */
export function InvoiceDirectoryTable({
  invoices = [],
  onSelectInvoice,
  onQuickRecordPayment,
  hasMore = false,
  onLoadMore,
}) {
  return (
    <div className="space-y-3">
      <section
        aria-label="Tabel daftar invoice studio"
        className="cal-card bg-studio-white overflow-hidden"
      >
        {/* Top Legend Strip (consistent with Calendar & Customer tables) */}
        <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-studio-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
              INVOICE LEDGER
            </span>

            <div className="flex flex-wrap items-center gap-2.5 font-mono text-[10px] font-bold">
              <span className="inline-flex items-center gap-1">
                <span
                  className="bg-studio-lime border-studio-ink h-2.5 w-2.5 border"
                  aria-hidden="true"
                />
                <span>Paid</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="border-studio-ink h-2.5 w-2.5 border bg-amber-200"
                  aria-hidden="true"
                />
                <span>Partial</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="bg-studio-orange border-studio-ink h-2.5 w-2.5 border"
                  aria-hidden="true"
                />
                <span>Overdue</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="border-studio-ink bg-studio-ivory h-2.5 w-2.5 border"
                  aria-hidden="true"
                />
                <span>Unpaid</span>
              </span>
            </div>
          </div>

          <span className="text-studio-muted-ink hidden font-mono text-[9.5px] font-bold uppercase sm:inline">
            Klik nomor invoice atau Detail untuk riwayat &amp; cetak
          </span>
        </div>

        <table className="block w-full border-collapse text-left md:table">
          <thead className="border-studio-ink bg-studio-ink text-studio-ivory hidden border-b-2 font-mono text-[10px] font-extrabold tracking-wider uppercase md:table-header-group">
            <tr>
              <th scope="col" className="px-2.5 py-2 whitespace-nowrap xl:px-3">
                Invoice / Jadwal
              </th>
              <th scope="col" className="px-2.5 py-2 xl:px-3">
                Customer &amp; Layanan
              </th>
              <th scope="col" className="px-2.5 py-2 whitespace-nowrap xl:px-3">
                Status
              </th>
              <th
                scope="col"
                className="hidden px-2.5 py-2 text-right whitespace-nowrap xl:table-cell xl:px-3"
              >
                Total
              </th>
              <th
                scope="col"
                className="hidden px-2.5 py-2 text-right whitespace-nowrap 2xl:table-cell 2xl:px-3"
              >
                Terbayar
              </th>
              <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap xl:px-3">
                Sisa Tagihan
              </th>
              <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap xl:px-3">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="block divide-y divide-neutral-200 md:table-row-group">
            {invoices.map((invoice, idx) => {
              const isVoid = invoice.invoiceStatus === INVOICE_STATUS.VOID;
              const effectiveStatus = getEffectivePaymentStatus(invoice);
              const paymentMeta = getPaymentStatusMeta(effectiveStatus);
              const invoiceMeta = getInvoiceStatusMeta(invoice.invoiceStatus);
              const room = getStudioRoomById(invoice.bookingSnapshot?.studioId);
              const canRecordPayment = !isVoid && invoice.balanceDue > 0;

              const serviceLabel = [
                invoice.bookingSnapshot?.serviceTypeName,
                invoice.bookingSnapshot?.serviceOptionName,
              ]
                .filter(Boolean)
                .join(' • ');

              const rowBgClass = isVoid
                ? 'bg-neutral-100/80 opacity-80 hover:bg-neutral-100'
                : idx % 2 === 1
                  ? 'bg-studio-ivory/40 hover:bg-studio-lime/15'
                  : 'bg-studio-white hover:bg-studio-lime/15';

              return (
                <tr
                  key={invoice.id}
                  className={`group block px-3 py-2.5 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                >
                  {/* Col 1: Invoice Number & Booking Date */}
                  <td className="block md:table-cell md:px-2.5 md:py-2 md:align-middle md:whitespace-nowrap xl:px-3">
                    <button
                      type="button"
                      onClick={() => onSelectInvoice?.(invoice)}
                      className="text-studio-ink hover:text-studio-orange block cursor-pointer text-left font-mono text-[10.5px] font-extrabold transition-colors xl:text-[11px]"
                    >
                      {invoice.invoiceNumber}
                    </button>
                    <div className="text-studio-muted-ink mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[9.5px] font-semibold xl:text-[10px]">
                      <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>
                        {invoice.bookingSnapshot?.bookingDate
                          ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
                          : '-'}
                      </span>
                      <span
                        className={`border px-1 py-0 text-[8.5px] font-extrabold uppercase ${room.badgeClass}`}
                      >
                        {room.shortLabel}
                      </span>
                    </div>
                  </td>

                  {/* Col 2: Customer Snapshot & Service (wraps cleanly, zero horizontal expansion) */}
                  <td className="mt-1 block min-w-0 md:mt-0 md:table-cell md:px-2.5 md:py-2 md:align-middle xl:px-3">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-studio-ink text-xs font-extrabold">
                        {invoice.customerSnapshot?.name || '-'}
                      </span>
                      {invoice.customerSnapshot?.bandName ? (
                        <span className="text-studio-muted-ink text-[11px] font-semibold">
                          • {invoice.customerSnapshot.bandName}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-studio-subtle-ink mt-0.5 font-mono text-[9.5px] leading-snug font-semibold xl:text-[10px]">
                      {formatPhoneDisplay(invoice.customerSnapshot?.phone || '') || '-'}
                      {serviceLabel ? ` • ${serviceLabel}` : ''}
                      {` (${formatMinuteRange(
                        invoice.bookingSnapshot?.startMinute ?? 600,
                        invoice.bookingSnapshot?.endMinute ?? 660,
                        false,
                      )})`}
                    </p>
                  </td>

                  {/* Col 3: Invoice + Payment Status Badges */}
                  <td className="mt-1.5 block md:mt-0 md:table-cell md:px-2.5 md:py-2 md:align-middle md:whitespace-nowrap xl:px-3">
                    <div className="flex flex-wrap items-center gap-1 md:flex-col md:items-start">
                      {isVoid ? (
                        <span
                          className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${invoiceMeta.badgeClass}`}
                        >
                          VOID
                        </span>
                      ) : (
                        <span
                          className={`border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${paymentMeta.badgeClass}`}
                        >
                          {paymentMeta.label}
                        </span>
                      )}
                      {invoice.dueDate && !isVoid && invoice.balanceDue > 0 ? (
                        <span className="text-studio-muted-ink font-mono text-[8.5px] font-bold">
                          Due {formatIndonesianDateMedium(invoice.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Col 4: Total Amount (mobile inline + desktop xl+) */}
                  <td className="mt-1.5 mr-3 inline-flex items-baseline gap-1 md:hidden xl:table-cell xl:px-3 xl:py-2 xl:text-right xl:align-middle xl:whitespace-nowrap">
                    <span className="text-studio-muted-ink font-mono text-[9px] font-bold uppercase md:hidden">
                      Total:
                    </span>
                    <span className="text-studio-ink font-mono text-[11px] font-extrabold tabular-nums">
                      {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                    </span>
                  </td>

                  {/* Col 5: Amount Paid (2xl+) */}
                  <td className="hidden 2xl:table-cell 2xl:px-3 2xl:py-2 2xl:text-right 2xl:align-middle 2xl:whitespace-nowrap">
                    <span className="font-mono text-[11px] font-bold text-emerald-800 tabular-nums">
                      {formatRupiah(invoice.amountPaid || 0)}
                    </span>
                  </td>

                  {/* Col 6: Outstanding Balance (with compact Total/Paid sub-info on md–xl) */}
                  <td className="mt-1.5 inline-flex items-baseline gap-1 md:mt-0 md:table-cell md:px-2.5 md:py-2 md:text-right md:align-middle md:whitespace-nowrap xl:px-3">
                    <span className="text-studio-muted-ink font-mono text-[9px] font-bold uppercase md:hidden">
                      Sisa:
                    </span>
                    <span
                      className={`block font-mono text-[11px] font-extrabold tabular-nums ${
                        isVoid
                          ? 'text-neutral-500 line-through'
                          : invoice.balanceDue > 0
                            ? 'text-studio-orange'
                            : 'text-emerald-800'
                      }`}
                    >
                      {formatRupiah(invoice.balanceDue || 0)}
                    </span>
                    <span className="text-studio-subtle-ink hidden font-mono text-[9px] font-semibold tabular-nums md:block 2xl:hidden">
                      <span className="xl:hidden">
                        Tot {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)} •{' '}
                      </span>
                      Paid {formatRupiah(invoice.amountPaid || 0)}
                    </span>
                  </td>

                  {/* Col 7: Compact Row Actions */}
                  <td className="mt-2 flex items-center justify-end border-t border-neutral-200/80 pt-2 md:mt-0 md:table-cell md:border-t-0 md:px-2.5 md:py-2 md:text-right md:align-middle md:whitespace-nowrap xl:px-3">
                    <div className="inline-flex items-center justify-end gap-1">
                      {canRecordPayment ? (
                        <button
                          type="button"
                          onClick={() => onQuickRecordPayment?.(invoice)}
                          aria-label={`Catat pembayaran ${invoice.invoiceNumber}`}
                          className="border-studio-ink bg-studio-lime text-studio-ink hover:bg-studio-ink hover:text-studio-lime inline-flex h-8 cursor-pointer items-center justify-center gap-1 border px-2 font-mono text-[9.5px] font-extrabold uppercase transition-colors"
                        >
                          <Banknote className="h-3 w-3" aria-hidden="true" />
                          <span>Bayar</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onSelectInvoice?.(invoice)}
                        aria-label={`Buka detail invoice ${invoice.invoiceNumber}`}
                        className="border-studio-ink bg-studio-ink text-studio-lime hover:bg-studio-orange hover:text-studio-white inline-flex h-8 cursor-pointer items-center justify-center gap-1 border px-2 font-mono text-[9.5px] font-extrabold uppercase transition-colors xl:px-2.5"
                      >
                        <span>Detail</span>
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="cal-control bg-studio-white text-studio-ink inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
          >
            Muat Lebih Banyak Invoice
          </button>
        </div>
      ) : null}
    </div>
  );
}
