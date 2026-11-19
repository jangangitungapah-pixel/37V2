import { CheckSquare, ChevronRight, Square } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';
import { getCommissionBasisLabel } from '../utils/commission-snapshot';
import { CommissionReviewCard } from './CommissionReviewCard';

/**
 * Responsive Commission Review Table (`md+` desktop compact table + mobile `CommissionReviewCard`).
 * Enforces exact prompt columns and guarantees already-posted / non-eligible items cannot be selected.
 */
export function CommissionReviewTable({
  items = [],
  selectedIdSet = new Set(),
  selectableCount = 0,
  allVisibleSelected = false,
  onToggleSelect,
  onSelectAllEligible,
  onClearSelection,
  onOpenDetail,
  isLoading = false,
}) {
  return (
    <section
      aria-label="Daftar sesi selesai untuk review komisi"
      className="cal-card bg-studio-white overflow-hidden"
    >
      {/* Top Action Strip */}
      <div className="border-studio-ink bg-studio-ivory flex flex-wrap items-center justify-between gap-2 border-b-2 px-2.5 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-studio-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
            COMPLETED SESSIONS REVIEW
          </span>
          <span className="border-studio-ink bg-studio-white text-studio-ink border px-1.5 py-0.5 font-mono text-[9.5px] font-extrabold tabular-nums">
            {items.length} baris
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {selectableCount > 0 ? (
            <button
              type="button"
              onClick={allVisibleSelected ? onClearSelection : onSelectAllEligible}
              className="cal-control border-studio-ink bg-studio-white text-studio-ink hover:bg-studio-lime inline-flex min-h-8.5 cursor-pointer items-center gap-1 px-2.5 py-1 font-mono text-[9.5px] font-extrabold uppercase"
            >
              {allVisibleSelected ? (
                <>
                  <Square className="h-3 w-3" aria-hidden="true" />
                  <span>Clear Selection</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3 w-3" aria-hidden="true" />
                  <span>Select All Eligible ({selectableCount})</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="text-studio-muted-ink px-4 py-10 text-center font-mono text-xs font-bold uppercase">
          Memuat data sesi selesai...
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-studio-ink font-mono text-xs font-extrabold uppercase">
            Tidak ada sesi selesai pada filter ini
          </p>
          <p className="text-studio-muted-ink mt-1 text-xs">
            Sesi Rehearsal dan Recording berstatus Completed dengan fee &gt; Rp 0 akan otomatis
            muncul di sini berdasarkan tanggal selesainya.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards (< 768px) */}
          <div className="md:hidden">
            {items.map((item) => (
              <CommissionReviewCard
                key={item.bookingId}
                item={item}
                isSelected={selectedIdSet.has(item.bookingId)}
                onToggleSelect={onToggleSelect}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>

          {/* Desktop / Tablet Compact Table (>= 768px) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead className="border-studio-ink bg-studio-ink text-studio-ivory border-b-2 font-mono text-[9.5px] font-extrabold tracking-wider uppercase">
                <tr>
                  <th scope="col" className="w-10 px-2.5 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua sesi eligible pada halaman ini"
                      checked={selectableCount > 0 && allVisibleSelected}
                      disabled={selectableCount === 0}
                      onChange={() =>
                        allVisibleSelected ? onClearSelection?.() : onSelectAllEligible?.()
                      }
                      className="accent-studio-lime h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </th>
                  <th scope="col" className="px-2.5 py-2 whitespace-nowrap">
                    Completed At
                  </th>
                  <th scope="col" className="px-2.5 py-2 whitespace-nowrap">
                    Booking
                  </th>
                  <th scope="col" className="px-2.5 py-2">
                    Customer / Band
                  </th>
                  <th scope="col" className="px-2.5 py-2 whitespace-nowrap">
                    Service
                  </th>
                  <th scope="col" className="hidden px-2.5 py-2 lg:table-cell">
                    Subcategory
                  </th>
                  <th scope="col" className="hidden px-2.5 py-2 whitespace-nowrap xl:table-cell">
                    Duration
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap">
                    Staff Fee
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap">
                    Operator Fee
                  </th>
                  <th
                    scope="col"
                    className="hidden px-2.5 py-2 text-right whitespace-nowrap xl:table-cell"
                  >
                    Owner Allocation
                  </th>
                  <th scope="col" className="px-2.5 py-2 whitespace-nowrap">
                    Status
                  </th>
                  <th scope="col" className="px-2.5 py-2 text-right whitespace-nowrap">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200 text-xs">
                {items.map((item, idx) => {
                  const isPosted = item.status === COMMISSION_ITEM_STATUS.POSTED;
                  const isSelected = selectedIdSet.has(item.bookingId);
                  const rowBg = isPosted
                    ? 'bg-neutral-50 text-neutral-700'
                    : isSelected
                      ? 'bg-studio-lime/20'
                      : idx % 2 === 1
                        ? 'bg-studio-ivory/40 hover:bg-studio-lime/10'
                        : 'bg-studio-white hover:bg-studio-lime/10';

                  return (
                    <tr key={item.bookingId} className={`transition-colors ${rowBg}`}>
                      <td className="px-2.5 py-2 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!item.selectable}
                          onChange={() => item.selectable && onToggleSelect?.(item.bookingId)}
                          aria-label={`Pilih booking ${item.bookingId}`}
                          className="accent-studio-ink h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>

                      <td className="px-2.5 py-2 align-middle font-mono text-[10.5px] font-bold whitespace-nowrap">
                        <div>{formatIndonesianTimestamp(item.booking.actualCompletedAt)}</div>
                        {item.booking.date && item.booking.date !== item.completedDateIso ? (
                          <span className="text-studio-subtle-ink block text-[9px] font-semibold">
                            Tgl Booking: {item.booking.date}
                          </span>
                        ) : null}
                      </td>

                      <td className="px-2.5 py-2 align-middle font-mono text-[10.5px] font-extrabold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(item)}
                          className="text-studio-ink hover:text-studio-orange cursor-pointer underline decoration-dotted underline-offset-2"
                        >
                          {item.bookingId}
                        </button>
                      </td>

                      <td className="max-w-[190px] px-2.5 py-2 align-middle">
                        <p className="text-studio-ink truncate font-extrabold">
                          {item.booking.customerName}
                        </p>
                        {item.booking.bandName ? (
                          <p className="text-studio-muted-ink truncate text-[11px] font-semibold">
                            {item.booking.bandName}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-2.5 py-2 align-middle font-mono text-[10.5px] font-bold whitespace-nowrap">
                        {item.serviceInfo.serviceTypeName}
                      </td>

                      <td className="hidden max-w-[150px] truncate px-2.5 py-2 align-middle text-[11px] font-semibold lg:table-cell">
                        {item.serviceInfo.serviceOptionName}
                      </td>

                      <td className="hidden px-2.5 py-2 align-middle font-mono text-[10.5px] font-semibold whitespace-nowrap xl:table-cell">
                        {formatDurationMinutes(item.booking.durationMinutes)}
                      </td>

                      <td className="px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                        <span className="text-studio-ink font-extrabold tabular-nums">
                          {formatRupiah(item.staffPayableAmount)}
                        </span>
                        <span className="text-studio-subtle-ink block text-[9px]">
                          {getCommissionBasisLabel(item.snapshot.staff?.basis)}
                        </span>
                      </td>

                      <td className="px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap">
                        <span className="text-studio-ink font-extrabold tabular-nums">
                          {formatRupiah(item.recordingOperatorPayableAmount)}
                        </span>
                        <span className="text-studio-subtle-ink block text-[9px]">
                          {getCommissionBasisLabel(item.snapshot.recordingOperator?.basis)}
                        </span>
                      </td>

                      <td className="hidden px-2.5 py-2 text-right align-middle font-mono whitespace-nowrap xl:table-cell">
                        <span className="text-studio-muted-ink font-bold tabular-nums">
                          {formatRupiah(item.ownerAllocationReference)}
                        </span>
                        <span className="text-studio-subtle-ink block text-[9px]">
                          Referensi saja
                        </span>
                      </td>

                      <td className="px-2.5 py-2 align-middle whitespace-nowrap">
                        <span
                          className={`border-studio-ink inline-block border px-1.5 py-0.5 font-mono text-[9px] font-extrabold uppercase ${
                            isPosted
                              ? 'bg-studio-lime text-studio-ink'
                              : 'text-studio-ink bg-amber-200'
                          }`}
                        >
                          {isPosted ? 'Posted' : 'Pending'}
                        </span>
                      </td>

                      <td className="px-2.5 py-2 text-right align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(item)}
                          className="cal-control border-studio-ink bg-studio-ink text-studio-white hover:bg-studio-lime hover:text-studio-ink inline-flex h-7.5 cursor-pointer items-center gap-0.5 px-2 font-mono text-[9.5px] font-extrabold uppercase"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
