import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Edit3,
  GitMerge,
  History,
  Music2,
  Phone,
  PhoneForwarded,
  Tag,
  X,
} from 'lucide-react';

import { BookingDetailDrawer } from '@/features/admin/calendar/components/BookingDetailDrawer';
import {
  formatIndonesianDateMedium,
  formatIndonesianTimestamp,
} from '@/features/admin/calendar/utils/calendar-date';

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
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px]" />

          <Dialog.Popup
            aria-label={`Detail customer ${customer.displayName}`}
            data-customer-scoped="true"
            className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col border-l-2 shadow-[-6px_0px_0px_#151515]"
          >
            {/* Sticky Header */}
              <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-3.5 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                              ? 'border-neutral-400 bg-neutral-700 text-neutral-100'
                              : isMerged
                                ? 'border-studio-orange bg-studio-orange text-white'
                                : 'border-studio-ivory bg-studio-lime text-studio-ink'
                            }`}
                    >
                      {customer.status}
                    </span>

                    {customer.historyCustomerIds?.length > 1 ? (
                      <span className="border-studio-ivory text-studio-lime inline-flex items-center gap-1 border bg-neutral-800 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                        <GitMerge className="h-3 w-3" aria-hidden="true" />
                        <span>{customer.historyCustomerIds.length} Profil Tergabung</span>
                      </span>
                    ) : null}
                  </div>

                  <Dialog.Title className="font-display mt-1.5 truncate text-xl leading-none font-black tracking-tight text-white uppercase sm:text-2xl">
                    {customer.displayName}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-neutral-300">
                    <span className="text-studio-lime font-bold">{formattedPhone}</span>
                    <span>• ID: {customer.id}</span>
                  </Dialog.Description>
                </div>

                <Dialog.Close
                  aria-label="Tutup detail customer"
                  className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Dialog.Close>
              </div>

              {/* Action Bar */}
              {!isMerged ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-neutral-800 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onEditCustomer?.(customer)}
                    className="border-studio-ivory bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase transition-colors"
                  >
                    <Edit3 className="h-3 w-3" aria-hidden="true" />
                    <span>Edit Profile</span>
                  </button>

                  {!isArchived ? (
                    <button
                      type="button"
                      onClick={() => onUpdatePhone?.(customer)}
                      className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase transition-colors"
                    >
                      <PhoneForwarded className="h-3 w-3" aria-hidden="true" />
                      <span>Update Phone Number</span>
                    </button>
                  ) : null}

                  {canMerge ? (
                    <button
                      type="button"
                      onClick={() => onOpenMerge?.(samePhonePeers, customer)}
                      className="border-studio-ivory bg-studio-ivory text-studio-ink hover:bg-studio-lime inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase transition-colors"
                    >
                      <GitMerge className="h-3 w-3" aria-hidden="true" />
                      <span>Merge History</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onToggleArchive?.(customer)}
                        className = {`border-studio-ivory inline-flex min-h-9 cursor-pointer items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase transition-colors ${isArchived
                            ? 'bg-studio-lime text-studio-ink'
                            : 'bg-studio-orange text-studio-white'
                          }`}
                  >
                      {isArchived ? (
                        <>
                          <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
                          <span>Aktifkan Kembali</span>
                        </>
                      ) : (
                        <>
                          <Archive className="h-3 w-3" aria-hidden="true" />
                          <span>Arsipkan</span>
                        </>
                      )}
                    </button>
                  </div>
              ) : null}
                </div>

                {/* Scrollable Body */}
                  <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5 pb-7 sm:px-5 sm:py-4">
                    {/* SECTION 1: IDENTITY */}
                    <section
                      aria-labelledby="customer-identity-heading"
                      className="cal-card bg-studio-white p-3.5 sm:p-4"
                    >
                      <h3
                        id="customer-identity-heading"
                        className="font-mono text-xs font-extrabold tracking-wider uppercase"
                      >
                        Identity
                      </h3>

                      <dl className="mt-3 grid grid-cols-1 gap-3 border-t border-neutral-200 pt-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                            Customer Name
                          </dt>
                          <dd className="text-studio-ink mt-0.5 text-sm font-extrabold">
                            {customer.displayName}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                            Primary Phone Number
                          </dt>
                          <dd className="text-studio-ink mt-0.5 flex items-center gap-1.5 font-mono text-sm font-extrabold">
                            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{formattedPhone}</span>
                          </dd>
                          <span className="text-studio-subtle-ink block font-mono text-[10px]">
                            Canonical: {customer.phoneNormalized}
                          </span>
                        </div>

                        <div>
                          <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                            Customer ID
                          </dt>
                          <dd className="text-studio-ink mt-0.5 font-mono text-[11px] font-bold break-all">
                            {customer.id}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                            Created At
                          </dt>
                          <dd className="text-studio-ink mt-0.5 font-mono text-[11px] font-bold">
                            {formatIndonesianTimestamp(customer.createdAt)}
                          </dd>
                        </div>
                      </dl>

                      {/* Previous Names / Aliases */}
                      <div className="mt-3 border-t border-neutral-200 pt-3">
                        <p className="text-studio-muted-ink flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
                          <Tag className="h-3 w-3" aria-hidden="true" />
                          <span>Previous Names / Name Aliases</span>
                        </p>
                        {customer.nameAliases?.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {customer.nameAliases.map((alias) => (
                              <span
                                key={alias}
                                className="border-studio-ink bg-studio-ivory border px-2 py-0.5 text-xs font-bold"
                              >
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-studio-subtle-ink mt-1 text-xs">Belum ada nama alias.</p>
                        )}
                      </div>

                      {/* Previous Phone Numbers */}
                      {customer.previousPhones?.length > 0 ? (
                        <div className="mt-3 border-t border-neutral-200 pt-3">
                          <p className="text-studio-muted-ink flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase">
                            <History className="h-3 w-3" aria-hidden="true" />
                            <span>Previous Phone Number</span>
                          </p>
                          <ul className="mt-1.5 space-y-1.5">
                            {customer.previousPhones.map((prev, idx) => (
                              <li
                                key={`${prev.phoneNormalized}-${idx}`}
                                className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border px-2.5 py-1.5 font-mono text-[11px]"
                              >
                                <span className="text-studio-ink font-extrabold">
                                  {formatPhoneDisplay(prev.phoneNormalized || prev.phoneDisplay)}
                                </span>
                                {prev.changedAt ? (
                                  <span className="text-studio-muted-ink text-[10px]">
                                    Diganti: {formatIndonesianTimestamp(prev.changedAt)}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {customer.notes ? (
                        <div className="mt-3 border-t border-neutral-200 pt-3">
                          <p className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                            Catatan Profil
                          </p>
                          <p className="text-studio-ink mt-1 text-xs leading-relaxed font-medium">
                            {customer.notes}
                          </p>
                        </div>
                      ) : null}
                    </section>

                    {/* SECTION 2: BOOKING SUMMARY (NO AGGREGATE MONEY TOTALS) */}
                    <section
                      aria-labelledby="customer-summary-heading"
                      className="cal-card bg-studio-white p-3.5 sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          id="customer-summary-heading"
                          className="font-mono text-xs font-extrabold tracking-wider uppercase"
                        >
                          Booking Summary
                        </h3>
                        <span className="text-studio-muted-ink font-mono text-[10px] font-bold">
                          Termasuk cancelled &amp; no-show
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <div className="border-studio-ink bg-studio-ivory border p-2.5">
                          <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                            Total Booking
                          </span>
                          <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                            {customer.bookingCount}
                          </span>
                        </div>

                        <div className="border-studio-ink bg-studio-ivory border p-2.5">
                          <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                            Active Bookings
                          </span>
                          <span className="font-display text-studio-ink mt-0.5 block text-2xl leading-none font-black">
                            {isHistoryLoading ? '…' : activeBookingsCount}
                          </span>
                        </div>

                        <div className="border-studio-ink bg-studio-ivory border p-2.5">
                          <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                            First Booking
                          </span>
                          <span className="text-studio-ink mt-1 block font-mono text-[11px] font-extrabold">
                            {customer.firstBookingDate
                              ? formatIndonesianDateMedium(customer.firstBookingDate)
                              : '-'}
                          </span>
                        </div>

                        <div className="border-studio-ink bg-studio-ivory border p-2.5">
                          <span className="text-studio-muted-ink block font-mono text-[9px] font-bold uppercase">
                            Last Booking
                          </span>
                          <span className="text-studio-ink mt-1 block font-mono text-[11px] font-extrabold">
                            {customer.lastBookingDate
                              ? formatIndonesianDateMedium(customer.lastBookingDate)
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </section>

                    {/* SECTION 3: BAND / PROJECT HISTORY */}
                    <section
                      aria-labelledby="customer-band-history-heading"
                      className="cal-card bg-studio-white p-3.5 sm:p-4"
                    >
                      <div className="flex items-center gap-1.5">
                        <Music2 className="text-studio-orange h-4 w-4 shrink-0" aria-hidden="true" />
                        <h3
                          id="customer-band-history-heading"
                          className="font-mono text-xs font-extrabold tracking-wider uppercase"
                        >
                          Band / Project History
                        </h3>
                      </div>
                      <p className="text-studio-muted-ink mt-1 text-[11px] font-medium">
                        Nama band/project adalah snapshot per booking. Satu customer dapat memiliki
                        beberapa nama band tanpa membuat profil baru.
                      </p>

                      {bandHistory.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {bandHistory.map((band) => (
                            <span
                              key={band}
                              className="border-studio-ink bg-studio-lime/30 text-studio-ink border px-2.5 py-1 font-mono text-[11px] font-extrabold"
                            >
                              {band}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-studio-subtle-ink mt-2 text-xs">
                          Belum ada nama band / project yang tercatat pada booking customer ini.
                        </p>
                      )}
                    </section>

                    {/* SECTION 4: BOOKING HISTORY */}
                    <section
                      aria-labelledby="customer-booking-history-heading"
                      className="cal-card bg-studio-white p-3.5 sm:p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <CalendarClock
                            className="text-studio-ink h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <h3
                            id="customer-booking-history-heading"
                            className="font-mono text-xs font-extrabold tracking-wider uppercase"
                          >
                            Booking History ({totalLoaded})
                          </h3>
                        </div>
                        <span className="text-studio-muted-ink font-mono text-[10px] font-bold uppercase">
                          Klik item untuk detail booking
                        </span>
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
                    </section>
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
