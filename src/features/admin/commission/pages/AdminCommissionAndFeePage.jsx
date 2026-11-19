import { useMemo, useState } from 'react';
import { AlertTriangle, HandCoins, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { generateOperationId } from '@/features/admin/calendar/repositories/calendar-booking-repository';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { useAuth } from '@/features/auth/AuthContext';

import { CommissionBatchDetailDrawer } from '../components/CommissionBatchDetailDrawer';
import { CommissionBatchHistory } from '../components/CommissionBatchHistory';
import { CommissionBookingDetailDrawer } from '../components/CommissionBookingDetailDrawer';
import { CommissionNeedsReviewList } from '../components/CommissionNeedsReviewList';
import { CommissionOverviewMetrics } from '../components/CommissionOverviewMetrics';
import { CommissionPeriodFilter } from '../components/CommissionPeriodFilter';
import { CommissionPostConfirmDialog } from '../components/CommissionPostConfirmDialog';
import { CommissionResolveNeedsReviewDialog } from '../components/CommissionResolveNeedsReviewDialog';
import { CommissionReviewTable } from '../components/CommissionReviewTable';
import { CommissionSelectedSummary } from '../components/CommissionSelectedSummary';
import { CommissionWorkspaceTabs } from '../components/CommissionWorkspaceTabs';
import { useCommissionBatches } from '../hooks/useCommissionBatches';
import { useCommissionReview } from '../hooks/useCommissionReview';
import {
  COMMISSION_BATCHES_PAGE_SIZE,
  COMMISSION_REVIEW_PAGE_SIZE,
} from '../repositories/commission-repository';
import {
  mapCommissionErrorToMessage,
  postCommissionBatch,
  resolveNeedsReviewBooking,
} from '../services/commission-posting-service';
import { buildCommissionReviewView } from '../services/commission-review-service';
import {
  COMMISSION_REVIEW_STATUS_FILTER,
  computeCommissionAggregateTotals,
} from '../utils/commission-calculation';
import {
  COMMISSION_PERIOD_PRESETS,
  resolveCommissionPeriodBounds,
} from '../utils/commission-period';

export function AdminCommissionAndFeePage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isOwner = actorRole === 'owner';

  const todayIso = getJakartaTodayIso();
  const [activeTab, setActiveTab] = useState('to_review');
  const [preset, setPreset] = useState(COMMISSION_PERIOD_PRESETS.THIS_MONTH);
  const [customStartDate, setCustomStartDate] = useState(() => `${todayIso.slice(0, 8)}01`);
  const [customEndDate, setCustomEndDate] = useState(todayIso);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(COMMISSION_REVIEW_STATUS_FILTER.PENDING);
  const [searchQuery, setSearchQuery] = useState('');

  const [reviewLimit, setReviewLimit] = useState(COMMISSION_REVIEW_PAGE_SIZE);
  const [batchesLimit, setBatchesLimit] = useState(COMMISSION_BATCHES_PAGE_SIZE);

  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [detailBookingItem, setDetailBookingItem] = useState(null);
  const [detailBatch, setDetailBatch] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    batchId: '',
    errorMessage: '',
    isSubmitting: false,
  });
  const [resolveDialogState, setResolveDialogState] = useState({
    open: false,
    item: null,
    errorMessage: '',
    isSubmitting: false,
  });

  const periodBounds = useMemo(
    () =>
      resolveCommissionPeriodBounds({
        preset,
        customStartDate,
        customEndDate,
      }),
    [preset, customStartDate, customEndDate],
  );

  const {
    bookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    hasMore: hasMoreSessions,
    isLoading: isReviewLoading,
    error: reviewError,
  } = useCommissionReview({
    enabled: isOwner,
    periodBounds,
    maxLimit: reviewLimit,
  });

  const {
    batches,
    hasMore: hasMoreBatches,
    isLoading: isBatchesLoading,
    error: batchesError,
  } = useCommissionBatches({
    enabled: isOwner,
    maxLimit: batchesLimit,
  });

  const reviewDataset = useMemo(() => {
    return buildCommissionReviewView({
      bookings,
      postingItemsByBookingId,
      resolutionsByBookingId,
      periodBounds,
      serviceFilter,
      searchQuery,
      statusFilter,
    });
  }, [
    bookings,
    postingItemsByBookingId,
    resolutionsByBookingId,
    periodBounds,
    serviceFilter,
    searchQuery,
    statusFilter,
  ]);

  const selectedIdSet = useMemo(() => new Set(selectedBookingIds), [selectedBookingIds]);

  const validSelectedItems = useMemo(
    () => reviewDataset.pendingItems.filter((item) => selectedIdSet.has(item.bookingId)),
    [reviewDataset.pendingItems, selectedIdSet],
  );

  const validSelectedIdSet = useMemo(
    () => new Set(validSelectedItems.map((item) => item.bookingId)),
    [validSelectedItems],
  );

  const selectedTotals = useMemo(
    () => computeCommissionAggregateTotals(validSelectedItems),
    [validSelectedItems],
  );

  const visibleSelectableItems = useMemo(
    () => reviewDataset.visibleTableItems.filter((item) => item.selectable),
    [reviewDataset.visibleTableItems],
  );

  const allVisibleSelected =
    visibleSelectableItems.length > 0 &&
    visibleSelectableItems.every((item) => validSelectedIdSet.has(item.bookingId));

  const canPost =
    isOwner &&
    validSelectedItems.length >= 1 &&
    validSelectedItems.length <= 100 &&
    selectedTotals.payableTotal > 0;

  const handlePresetChange = (nextPreset) => {
    setPreset(nextPreset);
    setSelectedBookingIds([]);
    setReviewLimit(COMMISSION_REVIEW_PAGE_SIZE);
  };

  const handleToggleSelectBooking = (bookingId) => {
    setSelectedBookingIds((prev) =>
      prev.includes(bookingId) ? prev.filter((id) => id !== bookingId) : [...prev, bookingId],
    );
  };

  const handleSelectAllEligible = () => {
    setSelectedBookingIds(visibleSelectableItems.map((item) => item.bookingId));
  };

  const handleClearSelection = () => {
    setSelectedBookingIds([]);
  };

  const handleResetFilters = () => {
    setServiceFilter('all');
    setStatusFilter(COMMISSION_REVIEW_STATUS_FILTER.PENDING);
    setSearchQuery('');
    setSelectedBookingIds([]);
  };

  const handleOpenConfirmPost = () => {
    if (!canPost) return;
    setConfirmState({
      open: true,
      batchId: generateOperationId('cbt'),
      errorMessage: '',
      isSubmitting: false,
    });
  };

  const handleConfirmPost = async (batchId) => {
    if (!canPost) return;
    setConfirmState((prev) => ({ ...prev, errorMessage: '', isSubmitting: true }));

    try {
      const result = await postCommissionBatch({
        batchId,
        actorUid,
        actorRole,
        periodStart: periodBounds.periodStart,
        periodEnd: periodBounds.periodEnd,
        periodLabel: periodBounds.periodLabel,
        selectedBookings: validSelectedItems.map((item) => ({
          bookingId: item.bookingId,
          expectedVersion: item.booking.version,
          expectedSnapshotSignature: item.snapshotSignature,
        })),
      });

      toast.success(
        result.idempotentReplay
          ? 'Batch komisi sudah tercatat di Pembukuan.'
          : `${result.batch.bookingCount} sesi berhasil diposting ke Pembukuan.`,
      );
      setSelectedBookingIds([]);
      setConfirmState({
        open: false,
        batchId: '',
        errorMessage: '',
        isSubmitting: false,
      });
    } catch (err) {
      setConfirmState((prev) => ({
        ...prev,
        errorMessage: mapCommissionErrorToMessage(err),
        isSubmitting: false,
      }));
    }
  };

  const handleConfirmResolveNeedsReview = async ({ item, reason }) => {
    if (!item || !isOwner) return;
    setResolveDialogState((prev) => ({ ...prev, errorMessage: '', isSubmitting: true }));

    try {
      const result = await resolveNeedsReviewBooking({
        bookingId: item.bookingId,
        expectedVersion: item.booking.version,
        reason,
        actorUid,
        actorRole,
      });

      toast.success(
        result.idempotentReplay
          ? 'Item Needs Review ini sudah ditandai selesai sebelumnya.'
          : 'Sesi lama ditandai selesai dan disembunyikan dari Needs Review.',
      );
      setResolveDialogState({
        open: false,
        item: null,
        errorMessage: '',
        isSubmitting: false,
      });
    } catch (err) {
      setResolveDialogState((prev) => ({
        ...prev,
        errorMessage: mapCommissionErrorToMessage(err),
        isSubmitting: false,
      }));
    }
  };

  return (
    <div data-commission-scoped="true" className="space-y-3 sm:space-y-4">
      {/* Header & Workspace Summary */}
      <header className="cal-card bg-studio-white p-3 sm:p-5">
        <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="bg-studio-ink text-studio-lime inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-wider uppercase sm:px-2.5">
                <HandCoins className="h-3 w-3" aria-hidden="true" />
                <span>KOMISI &amp; FEE SESI STUDIO</span>
              </span>
              <span className="border-studio-ink bg-studio-ivory border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase">
                Owner Only
              </span>
            </div>

            <h2 className="font-display text-studio-ink mt-1.5 text-xl leading-none font-black tracking-tight uppercase sm:mt-2 sm:text-3xl">
              Commission and Fee
            </h2>
            <p className="text-studio-muted-ink mt-1 text-xs leading-snug font-medium">
              Review completed session fees before posting them to bookkeeping.
            </p>
          </div>

          {isOwner ? (
            <CommissionWorkspaceTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              toReviewCount={reviewDataset.pendingItems.length}
              postedBatchCount={batches.length}
            />
          ) : null}
        </div>

        {isOwner ? (
          <CommissionOverviewMetrics
            metrics={reviewDataset.summary}
            periodLabel={periodBounds.periodLabel}
            hasMoreSessions={hasMoreSessions}
            onLoadMoreSessions={() => setReviewLimit((prev) => prev + COMMISSION_REVIEW_PAGE_SIZE)}
            zeroPayableCount={reviewDataset.zeroPayableItems.length}
          />
        ) : null}
      </header>

      {/* Active Staff Access Restriction Card (Section 13) */}
      {!isOwner ? (
        <section
          aria-label="Pembatasan akses halaman Commission and Fee"
          className="cal-card border-studio-ink bg-studio-white p-4 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="border-studio-ink bg-studio-orange text-studio-white flex h-11 w-11 shrink-0 items-center justify-center border-2">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-studio-ink text-xl font-black uppercase">
                  Owner Access Required
                </h3>
                <span className="border-studio-ink bg-studio-ivory text-studio-muted-ink border px-2 py-0.5 font-mono text-[9.5px] font-extrabold uppercase">
                  Read Only — Owner Approval Required
                </span>
              </div>

              <p className="text-studio-muted-ink text-sm leading-relaxed">
                Halaman <strong>Commission and Fee</strong> berisi rekap komisi tim dan pembagian
                internal studio yang hanya dapat dibuka serta diposting oleh{' '}
                <strong>Owner aktif</strong>.
              </p>
              <p className="text-studio-subtle-ink font-mono text-xs">
                Operasional harian seperti Calendar, Customer, dan Payment and Bill tetap dapat Anda
                gunakan seperti biasa.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          {reviewError || batchesError ? (
            <div
              role="alert"
              className="cal-card border-studio-ink bg-studio-orange/15 text-studio-ink flex items-start gap-2.5 p-3 font-mono text-xs font-bold"
            >
              <AlertTriangle
                className="text-studio-orange mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{reviewError || batchesError}</span>
            </div>
          ) : null}

          {activeTab === 'to_review' ? (
            <div className="space-y-3 sm:space-y-4">
              <CommissionPeriodFilter
                preset={preset}
                onPresetChange={handlePresetChange}
                customStartDate={customStartDate}
                onCustomStartDateChange={(val) => {
                  setCustomStartDate(val);
                  setSelectedBookingIds([]);
                }}
                customEndDate={customEndDate}
                onCustomEndDateChange={(val) => {
                  setCustomEndDate(val);
                  setSelectedBookingIds([]);
                }}
                periodLabel={periodBounds.periodLabel}
                serviceFilter={serviceFilter}
                onServiceFilterChange={(val) => {
                  setServiceFilter(val);
                  setSelectedBookingIds([]);
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(val) => {
                  setStatusFilter(val);
                  setSelectedBookingIds([]);
                }}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                visibleCount={reviewDataset.visibleTableItems.length}
                onResetFilters={handleResetFilters}
              />

              <CommissionReviewTable
                items={reviewDataset.visibleTableItems}
                selectedIdSet={validSelectedIdSet}
                selectableCount={visibleSelectableItems.length}
                allVisibleSelected={allVisibleSelected}
                onToggleSelect={handleToggleSelectBooking}
                onSelectAllEligible={handleSelectAllEligible}
                onClearSelection={handleClearSelection}
                onOpenDetail={(item) => setDetailBookingItem(item)}
                isLoading={isReviewLoading}
              />

              <CommissionSelectedSummary
                selectedCount={validSelectedItems.length}
                selectedTotals={selectedTotals}
                isOwner={isOwner}
                canPost={canPost}
                isPosting={confirmState.isSubmitting}
                onClearSelection={handleClearSelection}
                onOpenConfirmPost={handleOpenConfirmPost}
              />

              <CommissionNeedsReviewList
                items={reviewDataset.needsReviewItems}
                resolvedCount={reviewDataset.resolvedNeedsReviewItems?.length || 0}
                onSelectBookingItem={(item) => setDetailBookingItem(item)}
                onResolveBookingItem={(item) =>
                  setResolveDialogState({
                    open: true,
                    item,
                    errorMessage: '',
                    isSubmitting: false,
                  })
                }
              />
            </div>
          ) : (
            <CommissionBatchHistory
              batches={batches}
              hasMore={hasMoreBatches}
              onLoadMore={() => setBatchesLimit((prev) => prev + COMMISSION_BATCHES_PAGE_SIZE)}
              onSelectBatch={(batch) => setDetailBatch(batch)}
              isLoading={isBatchesLoading}
            />
          )}
        </>
      )}

      {/* Sibling Drawers & Dialogs */}
      <CommissionBookingDetailDrawer
        item={detailBookingItem}
        open={Boolean(detailBookingItem)}
        onOpenChange={(next) => {
          if (!next) setDetailBookingItem(null);
        }}
      />

      <CommissionBatchDetailDrawer
        batch={detailBatch}
        open={Boolean(detailBatch)}
        onOpenChange={(next) => {
          if (!next) setDetailBatch(null);
        }}
      />

      <CommissionPostConfirmDialog
        open={confirmState.open}
        batchId={confirmState.batchId}
        periodLabel={periodBounds.periodLabel}
        summary={selectedTotals}
        errorMessage={confirmState.errorMessage}
        onOpenChange={(next) => {
          if (!next && !confirmState.isSubmitting) {
            setConfirmState({
              open: false,
              batchId: '',
              errorMessage: '',
              isSubmitting: false,
            });
          }
        }}
        onConfirmPost={handleConfirmPost}
      />

      <CommissionResolveNeedsReviewDialog
        item={resolveDialogState.item}
        open={resolveDialogState.open}
        errorMessage={resolveDialogState.errorMessage}
        onOpenChange={(next) => {
          if (!next && !resolveDialogState.isSubmitting) {
            setResolveDialogState({
              open: false,
              item: null,
              errorMessage: '',
              isSubmitting: false,
            });
          }
        }}
        onConfirmResolve={handleConfirmResolveNeedsReview}
      />
    </div>
  );
}
