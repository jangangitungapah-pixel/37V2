import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Loader2, ReceiptText } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { useAuth } from '@/features/auth/AuthContext';

import { InvoiceDetailDrawer } from '../components/InvoiceDetailDrawer';
import { InvoiceDirectoryTable } from '../components/InvoiceDirectoryTable';
import { InvoiceDirectoryToolbar } from '../components/InvoiceDirectoryToolbar';
import { InvoicePrintable } from '../components/InvoicePrintable';
import { LegacyInvoiceImportDialog } from '../components/LegacyInvoiceImportDialog';
import { PaymentCorrectionDialog } from '../components/PaymentCorrectionDialog';
import { PaymentOverviewMetrics } from '../components/PaymentOverviewMetrics';
import { PaymentReceipt } from '../components/PaymentReceipt';
import { PaymentTransactionList } from '../components/PaymentTransactionList';
import { PaymentWorkspaceTabs } from '../components/PaymentWorkspaceTabs';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { VoidInvoiceDialog } from '../components/VoidInvoiceDialog';
import { useInvoices } from '../hooks/useInvoices';
import { usePaymentTransactions } from '../hooks/usePaymentTransactions';
import {
  mapPaymentErrorToMessage,
  updateInvoiceDueDate,
  voidInvoice,
} from '../services/invoice-service';
import { recordInvoicePayment, reversePaymentTransaction } from '../services/payment-service';
import {
  computeOverviewMetrics,
  filterInvoices,
  filterTransactions,
} from '../utils/payment-calculation';

export function AdminPaymentAndBillPage() {
  const { user, profile } = useAuth();
  const actorUid = user?.uid || profile?.uid || '';
  const [searchParams, setSearchParams] = useSearchParams();

  const urlInvoiceId = searchParams.get('invoiceId') || '';
  const initialTabParam = searchParams.get('tab') === 'transactions' ? 'transactions' : 'invoices';

  const [activeTab, setActiveTab] = useState(initialTabParam);
  const [selectedInvoiceIdState, setSelectedInvoiceIdState] = useState('');

  // Invoices tab filters
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [studioFilter, setStudioFilter] = useState('all');
  const [invoiceDateFrom, setInvoiceDateFrom] = useState('');
  const [invoiceDateTo, setInvoiceDateTo] = useState('');

  // Transactions tab filters
  const [txSearch, setTxSearch] = useState('');
  const [txMethodFilter, setTxMethodFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');

  // Modal states (all rendered as siblings to avoid nested Base UI Dialog issues)
  const [recordPaymentState, setRecordPaymentState] = useState({
    sessionKey: 0,
    open: false,
    invoice: null,
  });
  const [printPreviewState, setPrintPreviewState] = useState({
    open: false,
    invoice: null,
    transactions: [],
  });
  const [receiptState, setReceiptState] = useState({
    open: false,
    transaction: null,
    invoice: null,
  });
  const [correctionState, setCorrectionState] = useState({
    sessionKey: 0,
    open: false,
    invoice: null,
    transaction: null,
  });
  const [voidDialogState, setVoidDialogState] = useState({
    sessionKey: 0,
    open: false,
    invoice: null,
  });
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);

  const {
    invoices,
    hasMore: hasMoreInvoices,
    isLoading: isInvoicesLoading,
    error: invoicesError,
    loadMoreInvoices,
    legacyWithoutInvoiceCount,
    legacyNeedsReviewCount,
    refreshLegacyOverview,
  } = useInvoices();

  const {
    transactions,
    reversedTransactionIds,
    hasMore: hasMoreTransactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    loadMoreTransactions,
  } = usePaymentTransactions();

  const todayIso = getJakartaTodayIso();
  const activeInvoiceId = selectedInvoiceIdState || urlInvoiceId;

  const invoicesById = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      map.set(inv.id, inv);
    }
    return map;
  }, [invoices]);

  const fallbackSelectedInvoice = activeInvoiceId
    ? invoicesById.get(activeInvoiceId) || null
    : null;

  const hasActiveInvoiceFilters = Boolean(
    invoiceSearch ||
    paymentStatusFilter !== 'all' ||
    invoiceStatusFilter !== 'all' ||
    studioFilter !== 'all' ||
    invoiceDateFrom ||
    invoiceDateTo,
  );

  const hasActiveTxFilters = Boolean(
    txSearch || txMethodFilter !== 'all' || txTypeFilter !== 'all' || txDateFrom || txDateTo,
  );

  const filteredInvoices = useMemo(
    () =>
      filterInvoices({
        invoices,
        searchQuery: invoiceSearch,
        invoiceStatus: invoiceStatusFilter,
        paymentStatus: paymentStatusFilter,
        studioId: studioFilter,
        dateFrom: invoiceDateFrom,
        dateTo: invoiceDateTo,
        referenceDateIso: todayIso,
      }),
    [
      invoices,
      invoiceSearch,
      invoiceStatusFilter,
      paymentStatusFilter,
      studioFilter,
      invoiceDateFrom,
      invoiceDateTo,
      todayIso,
    ],
  );

  const filteredTransactions = useMemo(
    () =>
      filterTransactions({
        transactions,
        invoicesById,
        searchQuery: txSearch,
        paymentMethod: txMethodFilter,
        transactionType: txTypeFilter,
        dateFrom: txDateFrom,
        dateTo: txDateTo,
      }),
    [transactions, invoicesById, txSearch, txMethodFilter, txTypeFilter, txDateFrom, txDateTo],
  );

  // Period-scoped metrics follow active date range filter when present
  const activePeriodFrom = activeTab === 'transactions' ? txDateFrom : invoiceDateFrom;
  const activePeriodTo = activeTab === 'transactions' ? txDateTo : invoiceDateTo;
  const hasActivePeriodFilter = Boolean(activePeriodFrom || activePeriodTo);

  const periodInvoices = useMemo(
    () =>
      filterInvoices({
        invoices,
        dateFrom: activePeriodFrom,
        dateTo: activePeriodTo,
        referenceDateIso: todayIso,
      }),
    [invoices, activePeriodFrom, activePeriodTo, todayIso],
  );

  const periodTransactions = useMemo(
    () =>
      filterTransactions({
        transactions,
        invoicesById,
        dateFrom: activePeriodFrom,
        dateTo: activePeriodTo,
      }),
    [transactions, invoicesById, activePeriodFrom, activePeriodTo],
  );

  const overviewMetrics = useMemo(
    () =>
      computeOverviewMetrics({
        allInvoices: invoices,
        periodInvoices,
        periodTransactions,
        referenceDateIso: todayIso,
      }),
    [invoices, periodInvoices, periodTransactions, todayIso],
  );

  const handleOpenInvoice = (invoiceOrId) => {
    const id = typeof invoiceOrId === 'string' ? invoiceOrId : invoiceOrId?.id || '';
    setSelectedInvoiceIdState(id);
  };

  const handleCloseInvoiceDrawer = () => {
    setSelectedInvoiceIdState('');
    if (urlInvoiceId) {
      const next = new URLSearchParams(searchParams);
      next.delete('invoiceId');
      setSearchParams(next, { replace: true });
    }
  };

  const handleClearInvoiceFilters = () => {
    setInvoiceSearch('');
    setPaymentStatusFilter('all');
    setInvoiceStatusFilter('all');
    setStudioFilter('all');
    setInvoiceDateFrom('');
    setInvoiceDateTo('');
  };

  const handleClearTxFilters = () => {
    setTxSearch('');
    setTxMethodFilter('all');
    setTxTypeFilter('all');
    setTxDateFrom('');
    setTxDateTo('');
  };

  const handleRecordPayment = async (payload) => {
    const result = await recordInvoicePayment({
      ...payload,
      actorUid,
    });
    toast.success(
      `Pembayaran ${formatRupiah(result.transaction.amount)} berhasil dicatat pada ${result.invoice.invoiceNumber}.`,
    );
    return result;
  };

  const handleConfirmReversal = async ({
    invoiceId,
    originalTransactionId,
    expectedVersion,
    reason,
  }) => {
    const result = await reversePaymentTransaction({
      invoiceId,
      originalTransactionId,
      expectedVersion,
      reason,
      actorUid,
    });
    toast.success(
      `Koreksi reversal ${formatRupiah(result.reversal.amount)} berhasil dicatat pada ${result.invoice.invoiceNumber}.`,
    );
    return result;
  };

  const handleConfirmVoidInvoice = async ({ invoiceId, expectedVersion, reason }) => {
    const updated = await voidInvoice({
      invoiceId,
      expectedVersion,
      reason,
      actorUid,
    });
    toast.success(`Invoice ${updated.invoiceNumber} telah diubah ke status Void.`);
    return updated;
  };

  const handleSaveDueDate = async ({ invoiceId, expectedVersion, dueDate }) => {
    try {
      const updated = await updateInvoiceDueDate({
        invoiceId,
        expectedVersion,
        dueDate,
        actorUid,
      });
      toast.success(
        updated.dueDate
          ? `Jatuh tempo ${updated.invoiceNumber} diatur ke ${updated.dueDate}.`
          : `Jatuh tempo ${updated.invoiceNumber} dihapus.`,
      );
      return updated;
    } catch (err) {
      toast.error(mapPaymentErrorToMessage(err));
      throw err;
    }
  };

  const activeError = activeTab === 'transactions' ? transactionsError : invoicesError;

  return (
    <div data-payment-scoped="true" className="relative isolate z-0 space-y-2.5 sm:space-y-4">
      {/* Page Header, Primary Tab Switcher & Compact Overview Metrics */}
      <section
        aria-labelledby="payment-page-heading"
        className="cal-card bg-studio-white p-2.5 sm:p-4"
      >
        <div className="flex flex-col gap-2 sm:gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border-studio-ink bg-studio-ink text-studio-lime inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8.5px] font-extrabold tracking-wider uppercase sm:px-2 sm:text-[9px]">
                <ReceiptText className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
                <span>CUSTOMER BILLING &amp; PAYMENT LEDGER</span>
              </span>
              <span className="border-studio-ink bg-studio-ivory text-studio-ink hidden items-center gap-1 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase sm:inline-flex">
                <span>1 BOOKING = 1 INVOICE</span>
              </span>
            </div>

            <h2
              id="payment-page-heading"
              className="font-display text-studio-ink mt-1 truncate text-lg leading-none font-black tracking-tight uppercase sm:mt-1.5 sm:text-3xl"
            >
              Payment and Bill
            </h2>
            <p className="text-studio-muted-ink mt-0.5 text-[11px] font-medium sm:mt-1 sm:text-xs">
              Invoices, customer payments, and outstanding balances.
            </p>
          </div>

          <PaymentWorkspaceTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            invoicesCount={invoices.length}
            transactionsCount={transactions.length}
          />
        </div>

        {/* Overview Metrics */}
        <PaymentOverviewMetrics
          metrics={overviewMetrics}
          hasActivePeriodFilter={hasActivePeriodFilter}
        />
      </section>

      {/* Legacy Booking Invoice Reconciliation Banner (Zero Auto-Writes on Render!) */}
      {legacyWithoutInvoiceCount > 0 ? (
        <section
          role="region"
          aria-label="Rekonsiliasi invoice booking lama"
          className="cal-card bg-studio-lime/35 flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5 sm:px-4 sm:py-2.5"
        >
          <div className="flex items-start gap-2">
            <Database
              className="text-studio-ink mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-extrabold uppercase sm:text-[10.5px]">
                Existing bookings are ready for invoice reconciliation.
              </p>
              <p className="text-studio-ink mt-0.5 text-[11px] leading-snug font-medium sm:text-xs">
                Ditemukan <strong>{legacyWithoutInvoiceCount} booking lama</strong> belum punya
                invoice
                {legacyNeedsReviewCount > 0 ? ` (${legacyNeedsReviewCount} perlu review)` : ''}.
                Tinjau preview sebelum import.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLegacyImportOpen(true)}
            className="cal-control bg-studio-ink text-studio-lime inline-flex min-h-8.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-3 py-1 font-mono text-[10px] font-extrabold uppercase sm:min-h-10 sm:py-1.5 sm:text-[10.5px]"
          >
            <Database className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            <span>Review Existing Bookings</span>
          </button>
        </section>
      ) : null}

      {/* Load Error Alert */}
      {activeError ? (
        <div
          role="alert"
          className="cal-card bg-studio-orange text-studio-white flex items-start gap-2 p-3 text-xs font-bold"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      ) : null}

      {/* Active Workspace Tab Content */}
      {activeTab === 'invoices' ? (
        <div className="space-y-3.5">
          <InvoiceDirectoryToolbar
            searchQuery={invoiceSearch}
            onSearchQueryChange={setInvoiceSearch}
            paymentStatus={paymentStatusFilter}
            onPaymentStatusChange={setPaymentStatusFilter}
            invoiceStatus={invoiceStatusFilter}
            onInvoiceStatusChange={setInvoiceStatusFilter}
            studioId={studioFilter}
            onStudioIdChange={setStudioFilter}
            dateFrom={invoiceDateFrom}
            onDateFromChange={setInvoiceDateFrom}
            dateTo={invoiceDateTo}
            onDateToChange={setInvoiceDateTo}
            onClearFilters={handleClearInvoiceFilters}
            hasActiveFilters={hasActiveInvoiceFilters}
            visibleCount={filteredInvoices.length}
          />

          {isInvoicesLoading ? (
            <div
              role="status"
              className="cal-card bg-studio-white flex items-center gap-2 p-4 font-mono text-xs font-bold"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Memuat daftar invoice dari Firestore...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <section className="cal-card bg-studio-white p-6 text-center">
              <p className="font-display text-studio-ink text-xl font-black uppercase">
                {hasActiveInvoiceFilters
                  ? 'Tidak Ada Invoice yang Cocok'
                  : 'Belum Ada Invoice Tercatat'}
              </p>
              <p className="text-studio-muted-ink mx-auto mt-1 max-w-md text-xs font-medium">
                {hasActiveInvoiceFilters
                  ? 'Coba ubah filter status, ruangan, tanggal, atau kata kunci pencarian.'
                  : 'Invoice akan diterbitkan otomatis setiap kali booking baru dibuat melalui halaman Calendar.'}
              </p>
              {hasActiveInvoiceFilters ? (
                <button
                  type="button"
                  onClick={handleClearInvoiceFilters}
                  className="cal-control bg-studio-lime text-studio-ink mt-3 inline-flex min-h-10 cursor-pointer items-center justify-center px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
                >
                  Clear Filters
                </button>
              ) : legacyWithoutInvoiceCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setLegacyImportOpen(true)}
                  className="cal-control bg-studio-lime text-studio-ink mt-3 inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-3.5 py-1.5 font-mono text-[10.5px] font-extrabold uppercase"
                >
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Review Existing Bookings</span>
                </button>
              ) : null}
            </section>
          ) : (
            <InvoiceDirectoryTable
              invoices={filteredInvoices}
              onSelectInvoice={(inv) => handleOpenInvoice(inv)}
              onQuickRecordPayment={(inv) =>
                setRecordPaymentState((prev) => ({
                  sessionKey: prev.sessionKey + 1,
                  open: true,
                  invoice: inv,
                }))
              }
              hasMore={hasMoreInvoices}
              onLoadMore={loadMoreInvoices}
            />
          )}
        </div>
      ) : isTransactionsLoading ? (
        <div
          role="status"
          className="cal-card bg-studio-white flex items-center gap-2 p-4 font-mono text-xs font-bold"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Memuat riwayat transaksi pembayaran...</span>
        </div>
      ) : (
        <PaymentTransactionList
          transactions={filteredTransactions}
          invoicesById={invoicesById}
          reversedTransactionIds={reversedTransactionIds}
          searchQuery={txSearch}
          onSearchQueryChange={setTxSearch}
          paymentMethod={txMethodFilter}
          onPaymentMethodChange={setTxMethodFilter}
          transactionType={txTypeFilter}
          onTransactionTypeChange={setTxTypeFilter}
          dateFrom={txDateFrom}
          onDateFromChange={setTxDateFrom}
          dateTo={txDateTo}
          onDateToChange={setTxDateTo}
          hasActiveFilters={hasActiveTxFilters}
          onClearFilters={handleClearTxFilters}
          onOpenReceipt={(tx, inv) =>
            setReceiptState({
              open: true,
              transaction: tx,
              invoice: inv || null,
            })
          }
          onOpenInvoice={(invId) => handleOpenInvoice(invId)}
          hasMore={hasMoreTransactions}
          onLoadMore={loadMoreTransactions}
        />
      )}

      {/* Slide-Over Invoice Detail Drawer */}
      <InvoiceDetailDrawer
        key={activeInvoiceId || 'invoice-detail-closed'}
        invoiceId={activeInvoiceId}
        fallbackInvoice={fallbackSelectedInvoice}
        open={Boolean(activeInvoiceId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleCloseInvoiceDrawer();
        }}
        onOpenRecordPayment={(inv) =>
          setRecordPaymentState((prev) => ({
            sessionKey: prev.sessionKey + 1,
            open: true,
            invoice: inv,
          }))
        }
        onOpenPrintPreview={(inv, txs) =>
          setPrintPreviewState({
            open: true,
            invoice: inv,
            transactions: txs || [],
          })
        }
        onOpenReceipt={(tx, inv) =>
          setReceiptState({
            open: true,
            transaction: tx,
            invoice: inv,
          })
        }
        onOpenCorrection={(inv, tx) =>
          setCorrectionState((prev) => ({
            sessionKey: prev.sessionKey + 1,
            open: true,
            invoice: inv,
            transaction: tx,
          }))
        }
        onOpenVoidInvoice={(inv) =>
          setVoidDialogState((prev) => ({
            sessionKey: prev.sessionKey + 1,
            open: true,
            invoice: inv,
          }))
        }
        onSaveDueDate={handleSaveDueDate}
      />

      {/* Record Payment Modal */}
      <RecordPaymentDialog
        key={`record-pay-${recordPaymentState.sessionKey}`}
        open={recordPaymentState.open}
        invoice={recordPaymentState.invoice}
        onOpenChange={(nextOpen) => setRecordPaymentState((prev) => ({ ...prev, open: nextOpen }))}
        onSubmitPayment={handleRecordPayment}
      />

      {/* Printable A4 Invoice Preview & Print Portal */}
      <InvoicePrintable
        open={printPreviewState.open}
        invoice={printPreviewState.invoice}
        transactions={printPreviewState.transactions}
        onOpenChange={(nextOpen) => setPrintPreviewState((prev) => ({ ...prev, open: nextOpen }))}
      />

      {/* Printable Payment Receipt Modal */}
      <PaymentReceipt
        open={receiptState.open}
        transaction={receiptState.transaction}
        invoice={receiptState.invoice}
        onOpenChange={(nextOpen) => setReceiptState((prev) => ({ ...prev, open: nextOpen }))}
      />

      {/* Append-Only Payment Reversal / Correction Dialog */}
      <PaymentCorrectionDialog
        key={`correct-pay-${correctionState.sessionKey}`}
        open={correctionState.open}
        invoice={correctionState.invoice}
        transaction={correctionState.transaction}
        onOpenChange={(nextOpen) => setCorrectionState((prev) => ({ ...prev, open: nextOpen }))}
        onConfirmReversal={handleConfirmReversal}
      />

      {/* Void Invoice Dialog */}
      <VoidInvoiceDialog
        key={`void-inv-${voidDialogState.sessionKey}`}
        open={voidDialogState.open}
        invoice={voidDialogState.invoice}
        onOpenChange={(nextOpen) => setVoidDialogState((prev) => ({ ...prev, open: nextOpen }))}
        onConfirmVoid={handleConfirmVoidInvoice}
      />

      {/* Legacy Booking Invoice Reconciliation Dialog */}
      <LegacyInvoiceImportDialog
        open={legacyImportOpen}
        onOpenChange={setLegacyImportOpen}
        actorUid={actorUid}
        onImportCompleted={() => {
          refreshLegacyOverview().catch(() => {});
        }}
      />
    </div>
  );
}

export default AdminPaymentAndBillPage;
