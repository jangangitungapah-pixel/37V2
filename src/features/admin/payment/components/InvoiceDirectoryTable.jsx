import { Banknote, CalendarDays, ChevronRight, ShieldCheck } from 'lucide-react';

import { getStudioRoomById } from '@/features/admin/calendar/config/calendar-config';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatMinuteRange } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianDateMedium } from '@/features/admin/calendar/utils/calendar-date';
import { formatPhoneDisplay } from '@/features/admin/customer/utils/phone-number';
import { AdminSurface } from '@/features/admin/design-system';
import { PAYMENT_EVIDENCE_STATUSES } from '@/features/payment-evidence/config/payment-evidence-config';

import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
  INVOICE_STATUS,
} from '../utils/invoice-status';

/**
 * Single-DOM Responsive Invoice Table:
 * - Renders as a refined table on `md+` (`768px`–`1440px`)
 * - Stacks cleanly per row on mobile (`286px`–`767px`) with zero horizontal overflow
 */
export function InvoiceDirectoryTable({
  invoices = [],
  evidenceByInvoiceId = null,
  onSelectInvoice,
  onQuickRecordPayment,
  onReviewInvoiceEvidence,
  hasMore = false,
  onLoadMore,
}) {
  return (
    <div className="space-y-3.5">
      <AdminSurface
        as="section"
        variant="card"
        aria-label="Tabel daftar invoice studio"
        className="overflow-hidden"
      >
        {/* Top Legend Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
              Daftar Invoice
            </span>

            <div className="hidden flex-wrap items-center gap-2.5 text-[11px] font-medium text-[#666159] sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full bg-[#C8F13A] ring-1 ring-[#658800]/40"
                  aria-hidden="true"
                />
                <span>Lunas</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                <span>DP</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#FF4B22]" aria-hidden="true" />
                <span>Lewat Tempo</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-neutral-400" aria-hidden="true" />
                <span>Belum Bayar</span>
              </span>
            </div>
          </div>

          <span className="hidden text-xs text-[#666159] sm:inline">
            Klik nomor invoice atau Detail untuk riwayat &amp; cetak
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="block w-full border-collapse text-left md:table">
            <thead className="hidden border-b border-[#151515]/[0.08] bg-[#FAF8F3] text-[11px] font-semibold tracking-wide text-[#666159] md:table-header-group">
              <tr>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Invoice &amp; Jadwal
                </th>
                <th scope="col" className="px-3.5 py-2.5">
                  Pelanggan &amp; Layanan
                </th>
                <th scope="col" className="px-3.5 py-2.5 whitespace-nowrap">
                  Status
                </th>
                <th
                  scope="col"
                  className="hidden px-3.5 py-2.5 text-right whitespace-nowrap xl:table-cell"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="hidden px-3.5 py-2.5 text-right whitespace-nowrap 2xl:table-cell"
                >
                  Dibayar
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  Sisa Tagihan
                </th>
                <th scope="col" className="px-3.5 py-2.5 text-right whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="block divide-y divide-[#151515]/[0.06] md:table-row-group">
              {invoices.map((invoice) => {
                const isVoid = invoice.invoiceStatus === INVOICE_STATUS.VOID;
                const effectiveStatus = getEffectivePaymentStatus(invoice);
                const paymentMeta = getPaymentStatusMeta(effectiveStatus);
                const invoiceMeta = getInvoiceStatusMeta(invoice.invoiceStatus);
                const room = getStudioRoomById(invoice.bookingSnapshot?.studioId);
                const requiresClientEvidence = Boolean(invoice.clientPaymentEvidenceRequired);
                const invoiceEvidenceList = evidenceByInvoiceId?.get?.(invoice.id) || [];
                const pendingEvidence =
                  invoiceEvidenceList.find(
                    (ev) => ev.status === PAYMENT_EVIDENCE_STATUSES.PENDING_REVIEW,
                  ) || null;
                const canRecordManualPayment =
                  !isVoid && invoice.balanceDue > 0 && !requiresClientEvidence;
                const canReviewEvidence =
                  !isVoid && invoice.balanceDue > 0 && requiresClientEvidence;

                const serviceLabel = [
                  invoice.bookingSnapshot?.serviceTypeName,
                  invoice.bookingSnapshot?.serviceOptionName,
                ]
                  .filter(Boolean)
                  .join(' • ');

                const rowBgClass = isVoid
                  ? 'bg-[#FAF8F3]/70 opacity-75'
                  : 'bg-white hover:bg-[#FAF8F3]/80';

                return (
                  <tr
                    key={invoice.id}
                    className={`group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 px-3 py-2.5 transition-colors md:table-row md:p-0 ${rowBgClass}`}
                  >
                    {/* Col 1: Invoice Number & Booking Date */}
                    <td className="col-start-1 row-start-1 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle md:whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectInvoice?.(invoice)}
                        className="block max-w-full cursor-pointer truncate text-left font-mono text-xs font-semibold text-[#151515] transition-colors hover:text-[#FF4B22]"
                      >
                        {invoice.invoiceNumber}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#666159]">
                        <CalendarDays
                          className="h-3.5 w-3.5 shrink-0 text-[#8B857B]"
                          aria-hidden="true"
                        />
                        <span>
                          {invoice.bookingSnapshot?.bookingDate
                            ? formatIndonesianDateMedium(invoice.bookingSnapshot.bookingDate)
                            : '-'}
                        </span>
                        <span
                          className={`rounded-full border px-1.5 py-0 font-mono text-[9.5px] font-semibold uppercase ${room.badgeClass}`}
                        >
                          {room.shortLabel}
                        </span>
                      </div>
                    </td>

                    {/* Col 2: Customer Snapshot & Service */}
                    <td className="col-span-2 row-start-2 min-w-0 md:table-cell md:px-3.5 md:py-3 md:align-middle">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-semibold text-[#151515]">
                          {invoice.customerSnapshot?.name || '-'}
                        </span>
                        {invoice.customerSnapshot?.bandName ? (
                          <span className="text-xs text-[#666159]">
                            • {invoice.customerSnapshot.bandName}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] leading-snug text-[#666159]">
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
                    <td className="col-start-2 row-start-1 justify-self-end md:table-cell md:px-3.5 md:py-3 md:align-middle md:whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1 md:items-start">
                        {isVoid ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${invoiceMeta.badgeClass}`}
                          >
                            DIBATALKAN
                          </span>
                        ) : (
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${paymentMeta.badgeClass}`}
                          >
                            {paymentMeta.label}
                          </span>
                        )}
                        {invoice.dueDate && !isVoid && invoice.balanceDue > 0 ? (
                          <span className="font-mono text-[10px] text-[#666159]">
                            Tempo {formatIndonesianDateMedium(invoice.dueDate)}
                          </span>
                        ) : null}
                        {pendingEvidence ? (
                          <span className="rounded-full border border-amber-500/30 bg-[#FEF4DD] px-2 py-0.2 font-mono text-[9.5px] font-semibold text-[#8A4B08]">
                            Bukti Menunggu
                          </span>
                        ) : canReviewEvidence ? (
                          <span className="rounded-full border border-[#FF4B22]/25 bg-[#FFEDE8] px-2 py-0.2 font-mono text-[9.5px] font-semibold text-[#B92B0C]">
                            Wajib Bukti Client
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Col 4: Total Amount */}
                    <td className="hidden xl:table-cell xl:px-3.5 xl:py-3 xl:text-right xl:align-middle xl:whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-[#151515] tabular-nums">
                        {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                      </span>
                    </td>

                    {/* Col 5: Amount Paid */}
                    <td className="hidden 2xl:table-cell 2xl:px-3.5 2xl:py-3 2xl:text-right 2xl:align-middle 2xl:whitespace-nowrap">
                      <span className="font-mono text-xs font-medium text-[#0F6246] tabular-nums">
                        {formatRupiah(invoice.amountPaid || 0)}
                      </span>
                    </td>

                    {/* Col 6: Outstanding Balance */}
                    <td className="col-start-1 row-start-3 min-w-0 self-center pt-1 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:text-right md:align-middle md:whitespace-nowrap">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 md:block">
                        <span className="inline-flex items-baseline gap-1 md:hidden">
                          <span className="text-[11px] text-[#666159]">Total</span>
                          <span className="font-mono text-xs font-semibold text-[#151515] tabular-nums">
                            {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)}
                          </span>
                        </span>

                        <span className="inline-flex items-baseline gap-1 md:block">
                          <span className="text-[11px] text-[#666159] md:hidden">Sisa</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums md:block ${
                              isVoid
                                ? 'text-[#8B857B] line-through'
                                : invoice.balanceDue > 0
                                  ? 'text-[#FF4B22]'
                                  : 'text-[#0F6246]'
                            }`}
                          >
                            {formatRupiah(invoice.balanceDue || 0)}
                          </span>
                        </span>
                      </div>

                      <span className="hidden font-mono text-[10.5px] text-[#666159] tabular-nums md:block 2xl:hidden">
                        <span className="xl:hidden">
                          Total {formatRupiah(invoice.financialSnapshot?.totalAmount || 0)} •{' '}
                        </span>
                        Dibayar {formatRupiah(invoice.amountPaid || 0)}
                      </span>
                    </td>

                    {/* Col 7: Compact Row Actions */}
                    <td className="col-start-2 row-start-3 self-center justify-self-end pt-1 md:table-cell md:px-3.5 md:py-3 md:pt-3 md:text-right md:align-middle md:whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {canRecordManualPayment ? (
                          <button
                            type="button"
                            onClick={() => onQuickRecordPayment?.(invoice)}
                            aria-label={`Catat pembayaran ${invoice.invoiceNumber}`}
                            className="sa-control sa-btn-lime inline-flex h-8 cursor-pointer items-center justify-center gap-1 px-2.5 text-xs font-semibold"
                          >
                            <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Bayar</span>
                          </button>
                        ) : canReviewEvidence && pendingEvidence ? (
                          <button
                            type="button"
                            onClick={() => onReviewInvoiceEvidence?.(pendingEvidence, invoice)}
                            aria-label={`Tinjau bukti pembayaran ${invoice.invoiceNumber}`}
                            className="sa-control sa-btn-lime inline-flex h-8 cursor-pointer items-center justify-center gap-1 px-2.5 text-xs font-semibold"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Tinjau Bukti</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => onSelectInvoice?.(invoice)}
                          aria-label={`Buka detail invoice ${invoice.invoiceNumber}`}
                          className="sa-control sa-btn-secondary inline-flex h-8 cursor-pointer items-center justify-center gap-1 px-3 text-xs font-semibold hover:bg-[#C8F13A]"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminSurface>

      {hasMore ? (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            className="sa-control sa-btn-secondary inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-2 text-xs font-semibold"
          >
            Muat Lebih Banyak Invoice
          </button>
        </div>
      ) : null}
    </div>
  );
}
