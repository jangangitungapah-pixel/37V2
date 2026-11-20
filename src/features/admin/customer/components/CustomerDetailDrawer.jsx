import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Edit3,
  ExternalLink,
  GitMerge,
  History,
  Music2,
  Phone,
  PhoneForwarded,
  ReceiptText,
  Tag,
  X,
} from 'lucide-react';
import { Link } from 'react-router';

import { BookingDetailDrawer } from '@/features/admin/calendar/components/BookingDetailDrawer';
import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
import { useCustomerInvoices } from '@/features/admin/payment/hooks/useInvoicePaymentSummaries';
import {
  getEffectivePaymentStatus,
  getInvoiceStatusMeta,
  getPaymentStatusMeta,
  INVOICE_STATUS,
} from '@/features/admin/payment/utils/invoice-status';

import { useCustomerBookingHistory } from '../hooks/useCustomerBookingHistory';
import { CUSTOMER_STATUS } from '../utils/customer-identity';
import { formatPhoneDisplay } from '../utils/phone-number';
import { CustomerBookingHistory } from './CustomerBookingHistory';

export function CustomerDetailDrawer({
  customer,
  open,
  onOpenChange,
  samePhonePeers = [],
  onEditCustomer,
  onUpdatePhone,
  onToggleArchive,
  onOpenMerge,
}) {
  const [selectedBooking, setSelectedBooking] = useState(null);

  const {
    visibleBookings,
    totalLoaded,
    activeBookingsCount,
    bandHistory,
    hasMore,
    isTruncated,
    isLoading: isHistoryLoading,
    error: historyError,
    loadMore,
  } = useCustomerBookingHistory(open && customer ? customer : null);

  const {
    invoices: customerInvoices,
    isLoading: isInvoicesLoading,
    error: invoicesError,
  } = useCustomerInvoices(open && customer ? customer : null);

  if (!customer) {
    return null;
  }

  const isArchived = customer.status === CUSTOMER_STATUS.ARCHIVED;
  const isMerged = customer.status === CUSTOMER_STATUS.MERGED;
  const canMerge =
    !isArchived && !isMerged && Array.isArray(samePhonePeers) && samePhonePeers.length >= 2;
  const formattedPhone = formatPhoneDisplay(customer.phoneNormalized || customer.phoneDisplay);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop
            data-admin-portal-layer="true"
            className="sa-overlay-backdrop fixed inset-0 z-40"
          />

          <Dialog.Popup
            data-admin-portal-layer="true"
            aria-label={`Detail customer ${customer.displayName}`}
            data-customer-scoped="true"
            className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col outline-none"
          >
            {/* Sticky Header */}
            <div className="shrink-0 border-b border-[#151515]/[0.08] bg-white px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AdminStatusBadge
                      tone={isArchived ? 'neutral' : isMerged ? 'orange' : 'lime'}
                      size="sm"
                    >
                      {isArchived ? 'Diarsipkan' : isMerged ? 'Digabung' : 'Aktif'}
                    </AdminStatusBadge>

                    {customer.historyCustomerIds?.length > 1 ? (
                      <AdminStatusBadge tone="ink" icon={GitMerge} size="sm">
                        {customer.historyCustomerIds.length} Profil Tergabung
                      </AdminStatusBadge>
                    ) : null}
                  </div>

                  <Dialog.Title className="mt-1.5 truncate text-base font-bold tracking-tight text-[#151515] sm:mt-2 sm:text-xl">
                    {customer.displayName}
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[#666159] sm:text-xs">
                    <span className="font-semibold text-[#151515]">{formattedPhone}</span>
                    <span>• {customer.bookingCount || 0} booking</span>
                  </Dialog.Description>
                </div>

                <Dialog.Close
                  aria-label="Tutup detail customer"
                  className="sa-control inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-[#151515]/10 bg-[#FAF8F3] text-[#46433D] hover:bg-white hover:text-[#151515] sm:h-9 sm:w-9 sm:rounded-xl"
                >
                  <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" aria-hidden="true" />
                </Dialog.Close>
              </div>

              {/* Action Bar */}
              {!isMerged ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#151515]/[0.07] pt-2.5 sm:mt-3.5 sm:gap-2 sm:pt-3">
                  <button
                    type="button"
                    onClick={() => onEditCustomer?.(customer)}
                    className="sa-control sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                    <span>Edit Profil</span>
                  </button>

                  {!isArchived ? (
                    <button
                      type="button"
                      onClick={() => onUpdatePhone?.(customer)}
                      className="sa-control sa-btn-lime inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                    >
                      <PhoneForwarded className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ganti No. HP</span>
                    </button>
                  ) : null}

                  {canMerge ? (
                    <button
                      type="button"
                      onClick={() => onOpenMerge?.(samePhonePeers, customer)}
                      aria-label="Merge History"
                      className="sa-control sa-btn-secondary inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                    >
                      <GitMerge className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                      <span>Gabung Riwayat</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onToggleArchive?.(customer)}
                    className={`sa-control inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold ${
                      isArchived ? 'sa-btn-lime' : 'sa-btn-orange'
                    }`}
                  >
                    {isArchived ? (
                      <>
                        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Aktifkan Kembali</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Arsipkan</span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-8 sm:px-5">
              {/* SECTION 1: IDENTITY */}
              <AdminSurface
                as="section"
                variant="card"
                aria-labelledby="customer-identity-heading"
                className="p-4"
              >
                <h3
                  id="customer-identity-heading"
                  className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                >
                  Data Pelanggan
                </h3>

                <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-[#151515]/[0.07] pt-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-medium text-[#666159]">Nama Pelanggan</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#151515]">
                      {customer.displayName}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[11px] font-medium text-[#666159]">
                      Nomor HP / WhatsApp Utama
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-semibold text-[#151515]">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[#666159]" aria-hidden="true" />
                      <span>{formattedPhone}</span>
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[11px] font-medium text-[#666159]">Terdaftar Sejak</dt>
                    <dd className="mt-0.5 font-mono text-xs font-medium text-[#151515]">
                      {formatIndonesianTimestamp(customer.createdAt)}
                    </dd>
                  </div>
                </dl>

                {/* Previous Names / Aliases */}
                <div className="mt-3.5 border-t border-[#151515]/[0.07] pt-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#666159]">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Nama Lain yang Pernah Dipakai</span>
                  </p>
                  {customer.nameAliases?.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {customer.nameAliases.map((alias) => (
                        <AdminStatusBadge key={alias} tone="ivory" size="sm">
                          {alias}
                        </AdminStatusBadge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-[#8B857B]">Belum ada catatan nama lain.</p>
                  )}
                </div>

                {/* Previous Phone Numbers */}
                {customer.previousPhones?.length > 0 ? (
                  <div className="mt-3.5 border-t border-[#151515]/[0.07] pt-3.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#666159]">
                      <History className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Riwayat Nomor HP Lama</span>
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {customer.previousPhones.map((prev, idx) => (
                        <li
                          key={`${prev.phoneNormalized}-${idx}`}
                          className="sa-panel-ivory flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono text-xs"
                        >
                          <span className="font-semibold text-[#151515]">
                            {formatPhoneDisplay(prev.phoneNormalized || prev.phoneDisplay)}
                          </span>
                          {prev.changedAt ? (
                            <span className="text-[11px] text-[#666159]">
                              Diganti: {formatIndonesianTimestamp(prev.changedAt)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {customer.notes ? (
                  <div className="mt-3.5 border-t border-[#151515]/[0.07] pt-3.5">
                    <p className="text-[11px] font-medium text-[#666159]">Catatan Profil</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#151515]">{customer.notes}</p>
                  </div>
                ) : null}
              </AdminSurface>

              {/* SECTION 2: BOOKING SUMMARY */}
              <AdminSurface
                as="section"
                variant="card"
                aria-labelledby="customer-summary-heading"
                className="p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="customer-summary-heading"
                    className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                  >
                    Ringkasan Booking
                  </h3>
                  <span className="text-[11px] text-[#666159]">
                    Termasuk dibatalkan &amp; tidak hadir
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Total Booking
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515] tabular-nums">
                      {customer.bookingCount}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Booking Aktif
                    </span>
                    <span className="mt-1 block font-mono text-xl font-bold text-[#151515] tabular-nums">
                      {isHistoryLoading ? '…' : activeBookingsCount}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Booking Pertama
                    </span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-[#151515]">
                      {customer.firstBookingDate
                        ? formatIndonesianDateMedium(customer.firstBookingDate)
                        : '-'}
                    </span>
                  </div>

                  <div className="sa-panel-ivory p-3">
                    <span className="block text-[11px] font-medium text-[#666159]">
                      Booking Terakhir
                    </span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-[#151515]">
                      {customer.lastBookingDate
                        ? formatIndonesianDateMedium(customer.lastBookingDate)
                        : '-'}
                    </span>
                  </div>
                </div>
              </AdminSurface>

              {/* SECTION 3: BAND / PROJECT HISTORY */}
              <AdminSurface
                as="section"
                variant="card"
                aria-labelledby="customer-band-history-heading"
                className="p-4"
              >
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 shrink-0 text-[#FF4B22]" aria-hidden="true" />
                  <h3
                    id="customer-band-history-heading"
                    className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                  >
                    Band / Project yang Pernah Dipakai
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#666159]">
                  Daftar band atau project dari setiap sesi booking. Satu pelanggan dapat mencatat
                  banyak nama band sekaligus.
                </p>

                {bandHistory.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bandHistory.map((band) => (
                      <AdminStatusBadge key={band} tone="lime" className="font-semibold">
                        {band}
                      </AdminStatusBadge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#8B857B]">
                    Belum ada nama band / project yang tercatat pada booking customer ini.
                  </p>
                )}
              </AdminSurface>

              {/* SECTION 4: INVOICES & PAYMENTS */}
              <AdminSurface
                as="section"
                variant="card"
                aria-labelledby="customer-invoices-heading"
                className="p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
                    <h3
                      id="customer-invoices-heading"
                      className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      Tagihan &amp; Invoice ({customerInvoices.length})
                    </h3>
                  </div>
                  <Link
                    to="/admin/payment-and-bill"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#666159] transition-colors hover:text-[#FF4B22]"
                  >
                    <span>Payment &amp; Bill</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                {invoicesError ? (
                  <p role="alert" className="text-xs font-medium text-[#B92B0C]">
                    {invoicesError}
                  </p>
                ) : isInvoicesLoading ? (
                  <p className="text-xs text-[#666159]">Memuat daftar invoice pelanggan...</p>
                ) : customerInvoices.length === 0 ? (
                  <p className="text-xs text-[#8B857B]">
                    Belum ada invoice yang tercatat untuk pelanggan ini.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {customerInvoices.slice(0, 15).map((inv) => {
                      const isVoid = inv.invoiceStatus === INVOICE_STATUS.VOID;
                      const effectiveStatus = getEffectivePaymentStatus(inv);
                      const payMeta = getPaymentStatusMeta(effectiveStatus);
                      const invMeta = getInvoiceStatusMeta(inv.invoiceStatus);

                      return (
                        <li
                          key={inv.id}
                          className="sa-panel-ivory flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono font-semibold text-[#151515]">
                                {inv.invoiceNumber}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                                  isVoid ? invMeta.badgeClass : payMeta.badgeClass
                                }`}
                              >
                                {isVoid ? invMeta.label : payMeta.indoLabel || payMeta.label}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-[#666159]">
                              {inv.bookingSnapshot?.bookingDate
                                ? formatIndonesianDateMedium(inv.bookingSnapshot.bookingDate)
                                : '-'}{' '}
                              • Total {formatRupiah(inv.financialSnapshot?.totalAmount || 0)} •
                              Dibayar {formatRupiah(inv.amountPaid || 0)} • Sisa{' '}
                              <strong
                                className={
                                  inv.balanceDue > 0 && !isVoid
                                    ? 'text-[#FF4B22]'
                                    : 'text-[#0F6246]'
                                }
                              >
                                {formatRupiah(inv.balanceDue || 0)}
                              </strong>
                            </p>
                          </div>

                          <Link
                            to={`/admin/payment-and-bill?invoiceId=${encodeURIComponent(inv.id)}`}
                            aria-label={`Buka invoice ${inv.invoiceNumber}`}
                            className="sa-control sa-btn-primary inline-flex h-8 shrink-0 items-center gap-1 px-2.5 text-[11px] font-semibold"
                          >
                            <span>Lihat Invoice</span>
                            <ExternalLink className="h-3 w-3 text-[#C8F13A]" aria-hidden="true" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </AdminSurface>

              {/* SECTION 5: BOOKING HISTORY */}
              <AdminSurface
                as="section"
                variant="card"
                aria-labelledby="customer-booking-history-heading"
                className="p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 shrink-0 text-[#151515]" aria-hidden="true" />
                    <h3
                      id="customer-booking-history-heading"
                      className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm"
                    >
                      Riwayat Booking ({totalLoaded})
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#666159]">Klik item untuk detail booking</span>
                </div>

                <CustomerBookingHistory
                  bookings={visibleBookings}
                  totalLoaded={totalLoaded}
                  hasMore={hasMore}
                  isTruncated={isTruncated}
                  isLoading={isHistoryLoading}
                  error={historyError}
                  onLoadMore={loadMore}
                  onSelectBooking={(booking) => setSelectedBooking(booking)}
                />
              </AdminSurface>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Reusable Calendar Booking Detail Drawer */}
      <BookingDetailDrawer
        key={selectedBooking?.id || 'customer-history-booking-closed'}
        booking={selectedBooking}
        open={Boolean(selectedBooking)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedBooking(null);
        }}
        readOnly
        overlayZIndexClass="z-[70]"
      />
    </>
  );
}
