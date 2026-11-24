import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { BookOpenText, CheckCircle2, Loader2, X } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';
import { AdminStatusBadge } from '@/features/admin/design-system';

import {
  fetchCommissionBatchDetails,
  getBatchPeriodDisplay,
} from '../services/commission-review-service';

/**
 * Slide-over audit drawer inspecting one posted Commission Batch.
 */
export function CommissionBatchDetailDrawer({ batch, open, onOpenChange }) {
  const [detailsState, setDetailsState] = useState({
    batchId: '',
    postingItems: [],
    bookkeepingEntries: [],
    error: '',
  });

  const targetBatchId = open && batch?.id ? batch.id : '';

  useEffect(() => {
    if (!targetBatchId) return undefined;

    let cancelled = false;
    fetchCommissionBatchDetails(targetBatchId)
      .then((res) => {
        if (cancelled) return;
        setDetailsState({
          batchId: targetBatchId,
          postingItems: res.postingItems || [],
          bookkeepingEntries: res.bookkeepingEntries || [],
          error: '',
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailsState({
          batchId: targetBatchId,
          postingItems: [],
          bookkeepingEntries: [],
          error: err?.message || 'Gagal memuat rincian batch posting.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [targetBatchId]);

  if (!batch && !open) return null;
  if (!batch) return null;

  const isLoading = Boolean(targetBatchId && detailsState.batchId !== targetBatchId);
  const postingItems = detailsState.batchId === batch.id ? detailsState.postingItems : [];
  const bookkeepingEntries =
    detailsState.batchId === batch.id ? detailsState.bookkeepingEntries : [];
  const error = detailsState.batchId === batch.id ? detailsState.error : '';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-admin-portal-layer="true"
          className="sa-overlay-backdrop fixed inset-0 z-40"
        />

        <Dialog.Popup
          data-admin-portal-layer="true"
          aria-label={`Detail batch posting ${batch.id}`}
          data-commission-scoped="true"
          className="sa-drawer fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-xl flex-col outline-none"
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 shrink-0 border-b border-[#151515]/[0.07] bg-[#FAF8F3]/92 px-4 py-3.5 backdrop-blur-md sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <AdminStatusBadge tone="lime" icon={CheckCircle2} size="sm">
                  Posted Batch Audit
                </AdminStatusBadge>
                <Dialog.Title className="mt-2 truncate text-lg font-bold tracking-tight text-[#151515] sm:text-xl">
                  {getBatchPeriodDisplay(batch)}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 font-mono text-xs break-all text-[#666159]">
                  Batch ID: <strong className="text-[#151515]">{batch.id}</strong> •{' '}
                  {batch.bookingCount} sesi
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail batch komisi"
                className="sa-control inline-flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-[#151515]/10 bg-white text-[#46433D] hover:text-[#151515]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="sa-safe-bottom flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* Batch Totals Summary */}
            <section className="sa-card p-4 text-xs">
              <dl className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Waktu Posting</dt>
                  <dd className="min-w-0 text-right font-mono font-medium text-[#151515]">
                    {formatIndonesianTimestamp(batch.postedAt)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Staff Commission</dt>
                  <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(batch.staffCommissionTotal)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 text-[#666159]">Recording Operator Fee</dt>
                  <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                    {formatRupiah(batch.recordingOperatorFeeTotal)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-[#151515]/[0.08] pt-2.5 text-sm font-bold">
                  <dt className="text-[#151515]">Total Kewajiban (Payable)</dt>
                  <dd className="font-mono text-[#FF4B22] tabular-nums">
                    {formatRupiah(batch.payableTotal)}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px]">
                  <dt className="shrink-0 text-[#666159]">Owner Allocation (Referensi)</dt>
                  <dd className="font-mono font-medium text-[#666159] tabular-nums">
                    {formatRupiah(batch.ownerAllocationReferenceTotal)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Bookkeeping Expense Accrual Entries */}
            <section className="sa-card p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#151515]">
                <BookOpenText className="h-3.5 w-3.5 text-[#666159]" aria-hidden="true" />
                <span>Catatan Masuk ke Pembukuan ({bookkeepingEntries.length})</span>
              </h3>

              {isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-xs text-[#666159]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Memuat rincian batch...</span>
                </div>
              ) : error ? (
                <p className="mt-2 text-xs font-medium text-[#B92B0C]">{error}</p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {bookkeepingEntries.map((entry) => (
                    <div key={entry.id} className="sa-panel-ivory p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <AdminStatusBadge tone="amber" size="sm">
                          Kewajiban • Belum Dibayar ({entry.settlementStatus})
                        </AdminStatusBadge>
                        <span className="font-mono font-bold text-[#151515] tabular-nums">
                          {formatRupiah(entry.amount)}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium break-words text-[#151515]">
                        {entry.description}
                      </p>
                      <p className="mt-0.5 font-mono text-[10.5px] break-all text-[#8B857B]">
                        ID: {entry.id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Booking Line Items in This Batch */}
            <section className="sa-card p-4">
              <h3 className="text-xs font-semibold text-[#151515]">
                Rincian Booking dalam Batch ({postingItems.length})
              </h3>

              {!isLoading && !error ? (
                <ul className="mt-3 divide-y divide-[#151515]/[0.06]">
                  {postingItems.map((item) => (
                    <li key={item.id} className="py-2.5 text-xs first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold break-words text-[#151515]">
                            {item.customerSnapshot?.name}
                            {item.customerSnapshot?.bandName
                              ? ` (${item.customerSnapshot.bandName})`
                              : ''}
                          </p>
                          <p className="mt-0.5 font-mono text-[10.5px] break-words text-[#666159]">
                            {item.bookingId} • {item.serviceSnapshot?.serviceTypeName} (
                            {item.serviceSnapshot?.serviceOptionName})
                          </p>
                          <p className="text-[10.5px] text-[#8B857B]">
                            Selesai: {formatIndonesianTimestamp(item.completedAt)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right font-mono">
                          <span className="block font-bold text-[#151515] tabular-nums">
                            {formatRupiah(item.payableTotal)}
                          </span>
                          <span className="block text-[10px] text-[#666159]">
                            S:{formatRupiah(item.staffPayableAmount)} • O:
                            {formatRupiah(item.recordingOperatorPayableAmount)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
