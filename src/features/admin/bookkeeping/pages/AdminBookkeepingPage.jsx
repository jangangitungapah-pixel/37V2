import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenText,
  ChevronDown,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import {
  AdminButton,
  AdminPageHeader,
  AdminStatusBadge,
  AdminSurface,
} from '@/features/admin/design-system';
import { useAuth } from '@/features/auth/AuthContext';

import { BookkeepingCashSummary } from '../components/BookkeepingCashSummary';
import { BookkeepingEntryDetailDrawer } from '../components/BookkeepingEntryDetailDrawer';
import { BookkeepingEntryDialog } from '../components/BookkeepingEntryDialog';
import { BookkeepingOverviewMetrics } from '../components/BookkeepingOverviewMetrics';
import { BookkeepingPayablesList } from '../components/BookkeepingPayablesList';
import { BookkeepingPeriodFilter } from '../components/BookkeepingPeriodFilter';
import { BookkeepingRecentActivity } from '../components/BookkeepingRecentActivity';
import { BookkeepingReports } from '../components/BookkeepingReports';
import { BookkeepingSettlementDialog } from '../components/BookkeepingSettlementDialog';
import { BookkeepingTransactionTable } from '../components/BookkeepingTransactionTable';
import { BookkeepingWorkspaceTabs } from '../components/BookkeepingWorkspaceTabs';
import {
  BOOKKEEPING_PERIOD_PRESETS,
  BOOKKEEPING_TABS,
  BOOKKEEPING_TAB_ITEMS,
  getBookkeepingCategoryLabel,
  LEDGER_PRESENTATION_TYPES,
  LEDGER_SOURCE_GROUPS,
  LEDGER_SOURCE_TYPES,
} from '../config/bookkeeping-config';
import { useBookkeepingOverview } from '../hooks/useBookkeepingOverview';
import { useBookkeepingReports } from '../hooks/useBookkeepingReports';
import {
  createManualExpenseEntry,
  createManualIncomeEntry,
  reverseBookkeepingEntry,
  saveBookkeepingOpeningBalance,
} from '../services/bookkeeping-entry-service';
import { settleBookkeepingEntry } from '../services/bookkeeping-settlement-service';
import { filterUnifiedLedgerItems } from '../utils/bookkeeping-calculation';
import { resolveBookkeepingPeriodBounds } from '../utils/bookkeeping-period';

function resolveTabFromUrl(paramValue = '') {
  const clean = String(paramValue || '')
    .trim()
    .toLowerCase();
  const matched = BOOKKEEPING_TAB_ITEMS.find((item) => item.urlKey === clean || item.id === clean);
  return matched ? matched.id : BOOKKEEPING_TABS.OVERVIEW;
}

export function AdminBookkeepingPage() {
  const { user, profile, role } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const actorRole = String(role || profile?.role || '')
    .trim()
    .toLowerCase();
  const isOwner = actorRole === 'owner';

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => resolveTabFromUrl(searchParams.get('tab')));

  const todayIso = getJakartaTodayIso();
  const [preset, setPreset] = useState(BOOKKEEPING_PERIOD_PRESETS.THIS_MONTH);
  const [customStartDate, setCustomStartDate] = useState(() => `${todayIso.slice(0, 8)}01`);
  const [customEndDate, setCustomEndDate] = useState(todayIso);

  // Transactions Tab Filters
  const [txSearch, setTxSearch] = useState('');
  const [txDirection, setTxDirection] = useState('all');
  const [txCategory, setTxCategory] = useState('all');
  const [txSourceGroup, setTxSourceGroup] = useState('all');
  const [txStatus, setTxStatus] = useState('all');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');

  // Compact "+ New Entry" menu
  const [newEntryMenuOpen, setNewEntryMenuOpen] = useState(false);
  const newEntryMenuRef = useRef(null);

  // Sibling dialogs & detail drawer state
  const [entryDialogState, setEntryDialogState] = useState({
    sessionKey: 0,
    open: false,
    mode: 'income',
  });
  const [settlementDialogState, setSettlementDialogState] = useState({
    sessionKey: 0,
    open: false,
    entry: null,
  });
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => {
    if (!newEntryMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (newEntryMenuRef.current && !newEntryMenuRef.current.contains(event.target)) {
        setNewEntryMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setNewEntryMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [newEntryMenuOpen]);

  const periodBounds = useMemo(
    () =>
      resolveBookkeepingPeriodBounds({
        preset,
        customStartDate,
        customEndDate,
      }),
    [preset, customStartDate, customEndDate],
  );

  const {
    entries,
    activePayables,
    settings,
    metrics,
    ledgerItems,
    cashMovementItems,
    recentActivity,
    hasMoreEntries,
    hasMoreSettlements,
    hasMorePayables,
    hasMoreInvoices,
    hasMorePayments,
    isLoading,
    error,
    loadMorePayables,
    loadMoreLedgerSources,
  } = useBookkeepingOverview({
    enabled: isOwner,
    periodBounds,
  });

  const { categoryBreakdown } = useBookkeepingReports({
    entries,
    activePayables,
    periodBounds,
  });

  const filteredLedgerItems = useMemo(
    () =>
      filterUnifiedLedgerItems({
        items: ledgerItems,
        dateFrom: txDateFrom,
        dateTo: txDateTo,
        direction: txDirection,
        category: txCategory,
        sourceGroup: txSourceGroup,
        status: txStatus,
        searchQuery: txSearch,
      }),
    [ledgerItems, txDateFrom, txDateTo, txDirection, txCategory, txSourceGroup, txStatus, txSearch],
  );

  const hasActiveTxFilters = Boolean(
    txSearch ||
    txDirection !== 'all' ||
    txCategory !== 'all' ||
    txSourceGroup !== 'all' ||
    txStatus !== 'all' ||
    txDateFrom ||
    txDateTo,
  );

  const handleClearTxFilters = () => {
    setTxSearch('');
    setTxDirection('all');
    setTxCategory('all');
    setTxSourceGroup('all');
    setTxStatus('all');
    setTxDateFrom('');
    setTxDateTo('');
  };

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    const tabMeta = BOOKKEEPING_TAB_ITEMS.find((t) => t.id === nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (!tabMeta || nextTab === BOOKKEEPING_TABS.OVERVIEW) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tabMeta.urlKey);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const openEntryDialog = (mode) => {
    setNewEntryMenuOpen(false);
    setEntryDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      mode,
    }));
  };

  const openSettlementDialog = (entry) => {
    if (!entry) return;
    setSettlementDialogState((prev) => ({
      sessionKey: prev.sessionKey + 1,
      open: true,
      entry,
    }));
  };

  const inspectPayableEntry = (entry) => {
    if (!entry) return;
    setDetailItem({
      id: `entry_${entry.id}`,
      recordId: entry.id,
      recordCollection: 'bookkeepingEntries',
      date: entry.occurredAt || entry.postedAt || entry.createdAt,
      description: entry.description || getBookkeepingCategoryLabel(entry.category),
      category: entry.category,
      categoryLabel: getBookkeepingCategoryLabel(entry.category),
      direction: 'expense',
      amount: entry.amount,
      signedAmount: -entry.amount,
      status:
        entry.settlementStatus === 'paid'
          ? 'settled'
          : entry.settlementStatus === 'partially_paid'
            ? 'partially_settled'
            : 'accrued',
      statusLabel:
        entry.settlementStatus === 'paid'
          ? 'Settled'
          : entry.settlementStatus === 'partially_paid'
            ? 'Partial'
            : 'Accrued',
      presentationType: LEDGER_PRESENTATION_TYPES.ACCRUAL,
      sourceType:
        entry.sourceType === 'commission_batch'
          ? LEDGER_SOURCE_TYPES.COMMISSION_ACCRUAL
          : LEDGER_SOURCE_TYPES.MANUAL_PAYABLE,
      sourceGroup:
        entry.sourceType === 'commission_batch'
          ? LEDGER_SOURCE_GROUPS.COMMISSION
          : LEDGER_SOURCE_GROUPS.MANUAL,
      paymentMethod: entry.paymentMethod || '',
      referenceNumber: entry.referenceNumber || entry.sourceId || '',
      notes: entry.notes || '',
      actorUid: entry.createdByUid || '',
      sourceId: entry.sourceId || '',
      linkedEntry: entry,
      originalRecord: entry,
    });
  };

  const handleSubmitIncome = async ({ entryId, input }) => {
    const result = await createManualIncomeEntry({
      entryId,
      actorUid,
      actorRole,
      input,
    });
    toast.success(
      result.idempotentReplay
        ? 'Pemasukan manual ini sudah tercatat sebelumnya.'
        : 'Pemasukan manual berhasil disimpan.',
    );
    return result;
  };

  const handleSubmitExpense = async ({ entryId, settlementId, input }) => {
    const result = await createManualExpenseEntry({
      entryId,
      settlementId,
      actorUid,
      actorRole,
      input,
    });
    toast.success(
      result.idempotentReplay
        ? 'Pengeluaran manual ini sudah tercatat sebelumnya.'
        : input.paymentStatus === 'paid'
          ? 'Pengeluaran manual (Paid) berhasil disimpan beserta bukti kas keluar.'
          : 'Kewajiban pengeluaran (Unpaid) berhasil ditambahkan ke Outstanding Payables.',
    );
    return result;
  };

  const handleSubmitSettlement = async (params) => {
    const result = await settleBookkeepingEntry({
      ...params,
      actorUid,
      actorRole,
    });
    toast.success(
      result.idempotentReplay
        ? 'Pembayaran kewajiban ini sudah tercatat sebelumnya.'
        : result.entry.remainingAmount === 0
          ? 'Kewajiban berhasil dilunasi sepenuhnya.'
          : 'Pembayaran parsial berhasil dicatat.',
    );
    return result;
  };

  const handleReverseManualEntry = async ({ entryId, expectedVersion, reason }) => {
    const result = await reverseBookkeepingEntry({
      entryId,
      expectedVersion,
      reason,
      actorUid,
      actorRole,
    });
    toast.success(
      result.idempotentReplay
        ? 'Koreksi untuk catatan ini sudah tercatat sebelumnya.'
        : 'Koreksi / reversal manual berhasil disimpan dengan jejak audit.',
    );
    setDetailItem(null);
    return result;
  };

  const handleSaveOpeningBalance = async (input) => {
    return saveBookkeepingOpeningBalance({
      actorUid,
      actorRole,
      input,
    });
  };

  // Sync live detail item if entry or settlement updates while drawer is open
  const liveDetailItem = useMemo(() => {
    if (!detailItem) return null;
    if (detailItem.recordCollection === 'bookkeepingEntries') {
      const updated = entries.find((e) => e.id === detailItem.recordId);
      if (updated) {
        return {
          ...detailItem,
          linkedEntry: updated,
          originalRecord: updated,
          status:
            updated.settlementStatus === 'reversed'
              ? 'reversed'
              : updated.settlementStatus === 'paid'
                ? 'settled'
                : updated.settlementStatus === 'partially_paid'
                  ? 'partially_settled'
                  : detailItem.status,
        };
      }
    }
    return detailItem;
  }, [detailItem, entries]);

  return (
    <div data-bookkeeping-scoped="true" className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        compactMobile
        eyebrow="FINANCIAL CONTROL CENTER"
        icon={BookOpenText}
        title="Pembukuan"
        titleId="bookkeeping-page-heading"
        description="Monitor studio income, expenses, and cash movement."
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge tone="ivory" size="sm">
              Owner Only
            </AdminStatusBadge>
            <AdminStatusBadge tone="neutral" size="sm">
              IDR • WIB
            </AdminStatusBadge>
          </div>
        }
        actions={
          isOwner ? (
            <div ref={newEntryMenuRef} className="relative">
              <AdminButton
                variant="orange"
                size="sm"
                onClick={() => setNewEntryMenuOpen((prev) => !prev)}
                aria-expanded={newEntryMenuOpen}
                aria-haspopup="menu"
                aria-label="Tambah catatan pembukuan baru"
                className="min-h-10 gap-1.5"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>New Entry</span>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </AdminButton>

              {newEntryMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Pilih tipe catatan baru"
                  className="sa-card absolute right-0 z-30 mt-1.5 w-52 space-y-1 p-1.5"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openEntryDialog('income')}
                    className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#151515] transition-colors hover:bg-[#EDF8C2]"
                  >
                    <ArrowDownLeft className="h-4 w-4 text-[#243300]" aria-hidden="true" />
                    <span>Record Income</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openEntryDialog('expense')}
                    className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[#151515] transition-colors hover:bg-[#FFEDE8]"
                  >
                    <ArrowUpRight className="h-4 w-4 text-[#B92B0C]" aria-hidden="true" />
                    <span>Record Expense</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null
        }
      >
        {isOwner ? (
          <BookkeepingWorkspaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            transactionsCount={ledgerItems.length}
            openPayablesCount={metrics.openPayablesCount}
          />
        ) : null}
      </AdminPageHeader>

      {!isOwner ? (
        <AdminSurface
          as="section"
          variant="card"
          aria-label="Pembatasan akses halaman Pembukuan"
          className="p-5 sm:p-7"
        >
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFEDE8] text-[#B92B0C]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-[#151515]">Owner Access Required</h3>
                <AdminStatusBadge tone="ivory" size="sm">
                  Restricted Financial Control Center
                </AdminStatusBadge>
              </div>

              <p className="text-xs leading-relaxed text-[#46433D] sm:text-sm">
                Halaman <strong className="text-[#151515]">Pembukuan</strong> berisi ringkasan arus
                kas studio, kewajiban komisi, pengeluaran operasional, dan laporan keuangan yang
                hanya dapat diakses dan dikelola oleh{' '}
                <strong className="text-[#151515]">Owner aktif</strong>.
              </p>
              <p className="text-xs text-[#666159]">
                Operasional harian seperti Calendar, Customer, Payment and Bill, dan Inventory tetap
                dapat digunakan seperti biasa.
              </p>
            </div>
          </div>
        </AdminSurface>
      ) : (
        <>
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {activeTab === BOOKKEEPING_TABS.OVERVIEW ? (
            <div className="space-y-4 sm:space-y-5">
              <AdminSurface variant="card" className="p-3.5 sm:p-5">
                <BookkeepingPeriodFilter
                  preset={preset}
                  onPresetChange={setPreset}
                  customStartDate={customStartDate}
                  onCustomStartDateChange={setCustomStartDate}
                  customEndDate={customEndDate}
                  onCustomEndDateChange={setCustomEndDate}
                  periodLabel={periodBounds.periodLabel}
                />
              </AdminSurface>

              <BookkeepingOverviewMetrics
                metrics={metrics}
                periodLabel={periodBounds.periodLabel}
                onOpenPayables={() => handleTabChange(BOOKKEEPING_TABS.CASH_SETTLEMENT)}
              />

              <BookkeepingRecentActivity
                items={recentActivity}
                isLoading={isLoading}
                onSelectActivity={(item) => setDetailItem(item)}
                onViewAllTransactions={() => handleTabChange(BOOKKEEPING_TABS.TRANSACTIONS)}
              />
            </div>
          ) : null}

          {activeTab === BOOKKEEPING_TABS.TRANSACTIONS ? (
            <BookkeepingTransactionTable
              items={filteredLedgerItems}
              searchQuery={txSearch}
              onSearchQueryChange={setTxSearch}
              directionFilter={txDirection}
              onDirectionFilterChange={setTxDirection}
              categoryFilter={txCategory}
              onCategoryFilterChange={setTxCategory}
              sourceFilter={txSourceGroup}
              onSourceFilterChange={setTxSourceGroup}
              statusFilter={txStatus}
              onStatusFilterChange={setTxStatus}
              dateFrom={txDateFrom}
              onDateFromChange={setTxDateFrom}
              dateTo={txDateTo}
              onDateToChange={setTxDateTo}
              hasActiveFilters={hasActiveTxFilters}
              onClearFilters={handleClearTxFilters}
              hasMore={hasMoreEntries || hasMoreSettlements || hasMoreInvoices || hasMorePayments}
              isLoading={isLoading}
              onLoadMore={loadMoreLedgerSources}
              onSelectEntry={(item) => setDetailItem(item)}
            />
          ) : null}

          {activeTab === BOOKKEEPING_TABS.CASH_SETTLEMENT ? (
            <div className="space-y-4 sm:space-y-5">
              <AdminSurface variant="card" className="p-3.5 sm:p-5">
                <BookkeepingPeriodFilter
                  preset={preset}
                  onPresetChange={setPreset}
                  customStartDate={customStartDate}
                  onCustomStartDateChange={setCustomStartDate}
                  customEndDate={customEndDate}
                  onCustomEndDateChange={setCustomEndDate}
                  periodLabel={periodBounds.periodLabel}
                />
              </AdminSurface>

              <BookkeepingCashSummary
                items={cashMovementItems}
                metrics={metrics}
                periodBounds={periodBounds}
                isLoading={isLoading}
                onSelectEntry={(item) => setDetailItem(item)}
              />

              <BookkeepingPayablesList
                entries={entries}
                activePayables={activePayables}
                metrics={metrics}
                isLoading={isLoading}
                hasMorePayables={hasMorePayables}
                onLoadMorePayables={loadMorePayables}
                onSettlePayable={(entry) => openSettlementDialog(entry)}
                onInspectPayable={inspectPayableEntry}
              />
            </div>
          ) : null}

          {activeTab === BOOKKEEPING_TABS.REPORTS ? (
            <BookkeepingReports
              preset={preset}
              onPresetChange={setPreset}
              customStartDate={customStartDate}
              onCustomStartDateChange={setCustomStartDate}
              customEndDate={customEndDate}
              onCustomEndDateChange={setCustomEndDate}
              periodBounds={periodBounds}
              metrics={metrics}
              categoryBreakdown={categoryBreakdown}
              ledgerItems={ledgerItems}
              cashMovementItems={cashMovementItems}
              settings={settings}
              onSaveOpeningBalance={handleSaveOpeningBalance}
            />
          ) : null}
        </>
      )}

      {/* Sibling Overlays */}
      {entryDialogState.open ? (
        <BookkeepingEntryDialog
          key={entryDialogState.sessionKey}
          open={entryDialogState.open}
          mode={entryDialogState.mode}
          onOpenChange={(next) => setEntryDialogState((prev) => ({ ...prev, open: next }))}
          onSubmitIncome={handleSubmitIncome}
          onSubmitExpense={handleSubmitExpense}
        />
      ) : null}

      {settlementDialogState.open && settlementDialogState.entry ? (
        <BookkeepingSettlementDialog
          key={settlementDialogState.sessionKey}
          open={settlementDialogState.open}
          entry={settlementDialogState.entry}
          onOpenChange={(next) => setSettlementDialogState((prev) => ({ ...prev, open: next }))}
          onSubmitSettlement={handleSubmitSettlement}
        />
      ) : null}

      <BookkeepingEntryDetailDrawer
        item={liveDetailItem}
        open={Boolean(liveDetailItem)}
        onOpenChange={(next) => {
          if (!next) setDetailItem(null);
        }}
        onOpenSettleDialog={(entry) => openSettlementDialog(entry)}
        onReverseManualEntry={handleReverseManualEntry}
      />
    </div>
  );
}

export default AdminBookkeepingPage;
