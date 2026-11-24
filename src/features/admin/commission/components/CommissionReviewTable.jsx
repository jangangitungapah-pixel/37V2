import { CheckSquare, ChevronRight, Square } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatDurationMinutes } from '@/features/admin/calendar/utils/booking-time';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { COMMISSION_ITEM_STATUS } from '../utils/commission-calculation';
import { getCommissionBasisLabel } from '../utils/commission-snapshot';
import { CommissionReviewCard } from './CommissionReviewCard';

/**
 * Responsive Commission Review Table (`md+` desktop refined table + mobile `CommissionReviewCard`).
 * Guarantees already-posted / non-eligible items cannot be selected.
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
    <AdminSurface
      as="section"
      variant="card"
      aria-label="Daftar sesi selesai untuk review komisi"
      className="overflow-hidden"
    >
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/80 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-tight text-[#151515] sm:text-sm">
            Completed Sessions Review
          </span>
          <AdminStatusBadge tone="neutral" size="sm" className="font-mono">
            {items.length} baris
          </AdminStatusBadge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectableCount > 0 ? (
            <button
              type="button"
              onClick={allVisibleSelected ? onClearSelection : onSelectAllEligible}
              className="sa-control sa-btn-secondary inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 px-3 py-1 text-xs font-semibold"
            >
              {allVisibleSelected ? (
                <>
                  <Square className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                  <span>Clear Selection</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-[#46433D]" aria-hidden="true" />
                  <span>Select All Eligible ({selectableCount})</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-12 text-center text-xs font-medium text-[#666159]">
          Memuat data sesi selesai...
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 sm:p-6">
          <AdminEmptyState
            title="Tidak ada sesi selesai pada filter ini"
            description="Sesi Rehearsal dan Recording berstatus Completed dengan fee > Rp 0 akan otomatis muncul di sini berdasarkan tanggal selesainya."
          />
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

          {/* Desktop / Tablet Refined Table (>= 768px) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-[#151515]/[0.08] bg-[#FAF8F3] text-[11px] font-semibold tracking-wide text-[#666159]">
                <tr>
                  <th scope="col" className="w-10 px-2 py-2.5 text-center 2xl:px-3">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua sesi eligible pada halaman ini"
                      checked={selectableCount > 0 && allVisibleSelected}
                      disabled={selectableCount === 0}
                      onChange={() =>
                        allVisibleSelected ? onClearSelection?.() : onSelectAllEligible?.()
                      }
                      className="accent-studio-ink h-4 w-4 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 whitespace-nowrap 2xl:px-3">
                    Completed At
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 whitespace-nowrap 2xl:px-3">
                    Booking
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 2xl:px-3">
                    Customer / Band
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 whitespace-nowrap 2xl:px-3">
                    Service
                  </th>
                  <th scope="col" className="hidden px-2.5 py-2.5 2xl:table-cell 2xl:px-3">
                    Subcategory
                  </th>
                  <th
                    scope="col"
                    className="hidden px-2.5 py-2.5 whitespace-nowrap 2xl:table-cell 2xl:px-3"
                  >
                    Duration
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 text-right whitespace-nowrap 2xl:px-3">
                    Staff Fee
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 text-right whitespace-nowrap 2xl:px-3">
                    Operator Fee
                  </th>
                  <th
                    scope="col"
                    className="hidden px-2.5 py-2.5 text-right whitespace-nowrap xl:table-cell 2xl:px-3"
                  >
                    Owner Allocation
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 whitespace-nowrap 2xl:px-3">
                    Status
                  </th>
                  <th scope="col" className="px-2.5 py-2.5 text-right whitespace-nowrap 2xl:px-3">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#151515]/[0.06] text-xs">
                {items.map((item) => {
                  const isPosted = item.status === COMMISSION_ITEM_STATUS.POSTED;
                  const isSelected = selectedIdSet.has(item.bookingId);
                  const rowBg = isPosted
                    ? 'bg-[#FAF8F3]/60 text-[#46433D]'
                    : isSelected
                      ? 'bg-[#EDF8C2]/40'
                      : 'bg-white hover:bg-[#FAF8F3]/75';

                  return (
                    <tr key={item.bookingId} className={`transition-colors ${rowBg}`}>
                      <td className="px-2 py-3 text-center align-middle 2xl:px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!item.selectable}
                          onChange={() => item.selectable && onToggleSelect?.(item.bookingId)}
                          aria-label={`Pilih booking ${item.bookingId}`}
                          className="accent-studio-ink h-4 w-4 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>

                      <td className="px-2.5 py-3 align-middle font-mono text-[11px] font-medium whitespace-nowrap text-[#151515] 2xl:px-3">
                        <div>{formatIndonesianTimestamp(item.booking.actualCompletedAt)}</div>
                        {item.booking.date && item.booking.date !== item.completedDateIso ? (
                          <span className="block text-[10px] text-[#8B857B]">
                            Tgl Booking: {item.booking.date}
                          </span>
                        ) : null}
                      </td>

                      <td className="px-2.5 py-3 align-middle font-mono text-[11px] font-semibold whitespace-nowrap 2xl:px-3">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(item)}
                          className="cursor-pointer text-[#151515] underline decoration-[#151515]/30 decoration-dotted underline-offset-4 hover:text-[#FF4B22] hover:decoration-[#FF4B22]"
                        >
                          {item.bookingId}
                        </button>
                      </td>

                      <td className="max-w-[165px] px-2.5 py-3 align-middle 2xl:max-w-[190px] 2xl:px-3">
                        <p className="truncate font-semibold text-[#151515]">
                          {item.booking.customerName}
                        </p>
                        {item.booking.bandName ? (
                          <p className="truncate text-[11px] text-[#666159]">
                            {item.booking.bandName}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-2.5 py-3 align-middle text-xs font-medium whitespace-nowrap text-[#151515] 2xl:px-3">
                        {item.serviceInfo.serviceTypeName}
                      </td>

                      <td className="hidden max-w-[140px] truncate px-2.5 py-3 align-middle text-xs text-[#666159] 2xl:table-cell 2xl:px-3">
                        {item.serviceInfo.serviceOptionName}
                      </td>

                      <td className="hidden px-2.5 py-3 align-middle font-mono text-[11px] whitespace-nowrap text-[#666159] 2xl:table-cell 2xl:px-3">
                        {formatDurationMinutes(item.booking.durationMinutes)}
                      </td>

                      <td className="px-2.5 py-3 text-right align-middle font-mono whitespace-nowrap 2xl:px-3">
                        <span className="font-semibold text-[#151515] tabular-nums">
                          {formatRupiah(item.staffPayableAmount)}
                        </span>
                        <span className="block text-[10px] text-[#8B857B]">
                          {getCommissionBasisLabel(item.snapshot.staff?.basis)}
                        </span>
                      </td>

                      <td className="px-2.5 py-3 text-right align-middle font-mono whitespace-nowrap 2xl:px-3">
                        <span className="font-semibold text-[#151515] tabular-nums">
                          {formatRupiah(item.recordingOperatorPayableAmount)}
                        </span>
                        <span className="block text-[10px] text-[#8B857B]">
                          {getCommissionBasisLabel(item.snapshot.recordingOperator?.basis)}
                        </span>
                      </td>

                      <td className="hidden px-2.5 py-3 text-right align-middle font-mono whitespace-nowrap xl:table-cell 2xl:px-3">
                        <span className="font-medium text-[#666159] tabular-nums">
                          {formatRupiah(item.ownerAllocationReference)}
                        </span>
                        <span className="block text-[10px] text-[#8B857B]">Referensi saja</span>
                      </td>

                      <td className="px-2.5 py-3 align-middle whitespace-nowrap 2xl:px-3">
                        <AdminStatusBadge tone={isPosted ? 'lime' : 'amber'} size="sm">
                          {isPosted ? 'Posted' : 'Pending'}
                        </AdminStatusBadge>
                      </td>

                      <td className="px-2.5 py-3 text-right align-middle whitespace-nowrap 2xl:px-3">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(item)}
                          className="sa-control sa-btn-secondary inline-flex h-8 cursor-pointer items-center gap-1 px-2.5 text-xs font-semibold"
                        >
                          <span>Detail</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
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
    </AdminSurface>
  );
}
