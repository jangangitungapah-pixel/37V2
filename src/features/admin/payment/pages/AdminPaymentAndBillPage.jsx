import { useMemo, useState } from 'react';
import { AlertTriangle, Database, Loader2, ReceiptText } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { formatRupiah } from '@/features/admin/calendar/utils/booking-pricing';
import { getJakartaTodayIso } from '@/features/admin/calendar/utils/calendar-date';
import { AdminEmptyState, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';
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
    <div data-payment-scoped="true" className="relative isolate z-0 space-y-4 sm:space-y-6">
      {/* Page Header, Primary Tab Switcher & Compact Overview Metrics */}
      <AdminSurface
        as="section"
        variant="hero"
        aria-labelledby="payment-page-heading"
        className="p-4 sm:p-6"
      >
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge tone="ink" icon={ReceiptText} size="sm" className="uppercase">
                Tagihan &amp; Pembayaran Studio
              </AdminStatusBadge>
              <AdminStatusBadge tone="ivory" size="sm" className="hidden sm:inline-flex">
                1 Booking • 1 Invoice
              </AdminStatusBadge>
            </div>

            <h2
              id="payment-page-heading"
              className="mt-2.5 truncate text-xl font-bold tracking-[-0.025em] text-[#151515] sm:text-2xl lg:text-[28px]"
            >
              Payment and Bill
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#666159] sm:text-sm">
              Kelola tagihan, pembayaran DP atau cicilan, dan sisa tagihan pelanggan.
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
      </AdminSurface>

      {/* Legacy Booking Invoice Reconciliation Banner */}
      {legacyWithoutInvoiceCount > 0 ? (
        <section
          role="region"
          aria-label="Buat invoice booking lama"
          className="flex flex-col gap-3 rounded-2xl border border-[#8BAD12]/30 bg-[#EDF8C2]/55 p-3.5 shadow-[0_1px_2px_rgba(21,21,21,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5"
        >
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#243300]">
              <Database className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#151515]">
                Booking lama siap dibuatkan invoice.
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[#46433D]">
                Ditemukan <strong>{legacyWithoutInvoiceCount} booking lama</strong> belum punya
                invoice
                {legacyNeedsReviewCount > 0 ? ` (${legacyNeedsReviewCount} perlu dicek)` : ''}.
                Periksa daftarnya sebelum membuat invoice otomatis.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLegacyImportOpen(true)}
            className="sa-control sa-btn-primary inline-flex min-h-9.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-semibold"
          >
            <Database className="h-3.5 w-3.5 text-[#C8F13A]" aria-hidden="true" />
            <span>Periksa Booking Lama</span>
          </button>
        </section>
      ) : null}

      {/* Load Error Alert */}
      {activeError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-[#FF4B22]/25 bg-[#FFEDE8] p-3.5 text-xs font-medium text-[#B92B0C]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      ) : null}

      {/* Active Workspace Tab Content */}
      {activeTab === 'invoices' ? (
        <div className="space-y-4">
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
            <AdminSurface
              role="status"
              variant="card"
              className="flex items-center gap-2.5 p-5 text-xs font-medium text-[#666159]"
            >
              <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
              <span>Memuat daftar invoice dari Firestore...</span>
            </AdminSurface>
          ) : filteredInvoices.length === 0 ? (
            <AdminSurface as="section" variant="card" className="p-5 sm:p-6">
              <AdminEmptyState
                icon={ReceiptText}
                title={
                  hasActiveInvoiceFilters
                    ? 'Tidak Ada Invoice yang Cocok'
                    : 'Belum Ada Invoice Tercatat'
                }
                description={
                  hasActiveInvoiceFilters
                    ? 'Coba ubah filter status, ruangan, tanggal, atau kata kunci pencarian.'
                    : 'Invoice akan diterbitkan otomatis setiap kali booking baru dibuat melalui halaman Calendar.'
                }
                action={
                  hasActiveInvoiceFilters ? (
                    <button
                      type="button"
                      onClick={handleClearInvoiceFilters}
                      className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center justify-center px-4 py-2 text-xs font-semibold"
                    >
                      Clear Filters
                    </button>
                  ) : legacyWithoutInvoiceCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setLegacyImportOpen(true)}
                      className="sa-control sa-btn-lime inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold"
                    >
                      <Database className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Review Existing Bookings</span>
                    </button>
                  ) : null
                }
              />
            </AdminSurface>
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
        <AdminSurface
          role="status"
          variant="card"
          className="flex items-center gap-2.5 p-5 text-xs font-medium text-[#666159]"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#151515]" aria-hidden="true" />
          <span>Memuat riwayat transaksi pembayaran...</span>
        </AdminSurface>
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
