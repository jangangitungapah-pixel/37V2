import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { BookOpenText, CheckCircle2, Loader2, X } from 'lucide-react';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { formatIndonesianTimestamp } from '@/features/admin/calendar/utils/calendar-date';

import {
  fetchCommissionBatchDetails,
  getBatchPeriodDisplay,
} from '../services/commission-review-service';

/**
 * Slide-over audit drawer inspecting one posted Commission Batch:
 * loads `commissionPostingItems` (`batchId == ...`) and linked `bookkeepingEntries` (`sourceId == ...`).
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
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px]" />

        <Dialog.Popup
          aria-label={`Detail batch posting ${batch.id}`}
          data-commission-scoped="true"
          className="border-studio-ink bg-studio-ivory text-studio-ink fixed inset-y-0 right-0 z-50 flex h-[100dvh] w-full max-w-xl flex-col border-l-2 shadow-[-6px_0px_0px_#151515]"
        >
          {/* Sticky Header */}
          <div className="border-studio-ink bg-studio-ink text-studio-ivory shrink-0 border-b-2 px-4 py-3.5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="border-studio-ivory bg-studio-lime text-studio-ink inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>Posted Batch Audit</span>
                </span>
                <Dialog.Title className="font-display mt-1.5 truncate text-xl leading-none font-black text-white uppercase sm:text-2xl">
                  {getBatchPeriodDisplay(batch)}
                </Dialog.Title>
                <Dialog.Description className="mt-1 truncate font-mono text-[11px] text-neutral-300">
                  Batch ID: <strong className="text-studio-lime">{batch.id}</strong> •{' '}
                  {batch.bookingCount} sesi
                </Dialog.Description>
              </div>

              <Dialog.Close
                aria-label="Tutup detail batch komisi"
                className="hover:border-studio-lime hover:text-studio-lime inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center border border-neutral-700 bg-neutral-900 text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* Batch Totals Summary */}
            <section className="cal-card bg-studio-white p-3.5 font-mono text-xs">
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Waktu Posting</dt>
                  <dd className="text-right font-bold">
                    {formatIndonesianTimestamp(batch.postedAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Staff Commission</dt>
                  <dd className="font-extrabold tabular-nums">
                    {formatRupiah(batch.staffCommissionTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-studio-muted-ink">Recording Operator Fee</dt>
                  <dd className="font-extrabold tabular-nums">
                    {formatRupiah(batch.recordingOperatorFeeTotal)}
                  </dd>
                </div>
                <div className="border-studio-ink flex justify-between gap-2 border-t pt-1.5 text-sm font-black">
                  <dt>Total Kewajiban (Payable)</dt>
                  <dd className="text-studio-orange tabular-nums">
                    {formatRupiah(batch.payableTotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 text-[11px]">
                  <dt className="text-studio-muted-ink">Owner Allocation (Referensi)</dt>
                  <dd className="text-studio-muted-ink font-bold tabular-nums">
                    {formatRupiah(batch.ownerAllocationReferenceTotal)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Bookkeeping Expense Accrual Entries */}
            <section className="cal-card bg-studio-white p-3.5">
              <h3 className="text-studio-ink flex items-center gap-1.5 font-mono text-[10px] font-extrabold tracking-wider uppercase">
                <BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Catatan Masuk ke Pembukuan ({bookkeepingEntries.length})</span>
              </h3>

              {isLoading ? (
                <div className="text-studio-muted-ink mt-3 flex items-center gap-2 font-mono text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Memuat rincian batch...</span>
                </div>
              ) : error ? (
                <p className="text-studio-orange mt-2 font-mono text-xs font-bold">{error}</p>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {bookkeepingEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-studio-ink bg-studio-ivory border p-2.5 font-mono text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="border-studio-ink border bg-amber-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                          Kewajiban • Belum Dibayar ({entry.settlementStatus})
                        </span>
                        <span className="font-black tabular-nums">
                          {formatRupiah(entry.amount)}
                        </span>
                      </div>
                      <p className="text-studio-ink mt-1 font-bold">{entry.description}</p>
                      <p className="text-studio-subtle-ink mt-0.5 text-[10px]">ID: {entry.id}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Booking Line Items in This Batch */}
            <section className="cal-card bg-studio-white p-3.5">
              <h3 className="text-studio-ink font-mono text-[10px] font-extrabold tracking-wider uppercase">
                Rincian Booking dalam Batch ({postingItems.length})
              </h3>

              {!isLoading && !error ? (
                <ul className="mt-2.5 divide-y divide-neutral-200">
                  {postingItems.map((item) => (
                    <li key={item.id} className="py-2 font-mono text-xs first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-studio-ink truncate font-extrabold">
                            {item.customerSnapshot?.name}
                            {item.customerSnapshot?.bandName
                              ? ` (${item.customerSnapshot.bandName})`
                              : ''}
                          </p>
                          <p className="text-studio-muted-ink text-[10px]">
                            {item.bookingId} • {item.serviceSnapshot?.serviceTypeName} (
                            {item.serviceSnapshot?.serviceOptionName})
                          </p>
                          <p className="text-studio-subtle-ink text-[10px]">
                            Selesai: {formatIndonesianTimestamp(item.completedAt)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-studio-ink block font-black tabular-nums">
                            {formatRupiah(item.payableTotal)}
                          </span>
                          <span className="text-studio-subtle-ink block text-[9.5px]">
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
