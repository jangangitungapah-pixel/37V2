import { useState } from 'react';
import { Download, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { AdminButton, AdminStatusBadge, AdminSurface } from '@/features/admin/design-system';

import { mapBookkeepingErrorToMessage } from '../services/bookkeeping-entry-service';
import {
  buildCashMovementCsv,
  buildLedgerCsv,
  buildPayablesCsv,
  buildPeriodReportCsv,
  formatBookkeepingRupiah,
  triggerCsvDownload,
} from '../utils/bookkeeping-format';
import { BookkeepingCategoryChart } from './BookkeepingCategoryChart';
import { BookkeepingPeriodFilter } from './BookkeepingPeriodFilter';

export function BookkeepingReports({
  preset,
  onPresetChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  periodBounds,
  metrics,
  categoryBreakdown = [],
  ledgerItems = [],
  cashMovementItems = [],
  settings,
  onSaveOpeningBalance,
}) {
  const [openingFormOpen, setOpeningFormOpen] = useState(false);
  const [openingEnabled, setOpeningEnabled] = useState(
    () => settings?.openingCashBalance !== null && settings?.openingCashBalance !== undefined,
  );
  const [openingAmount, setOpeningAmount] = useState(() =>
    settings?.openingCashBalance !== null && settings?.openingCashBalance !== undefined
      ? String(settings.openingCashBalance)
      : '0',
  );
  const [openingAsOf, setOpeningAsOf] = useState(() => settings?.openingBalanceAsOf || '');
  const [openingNote, setOpeningNote] = useState(() => settings?.openingBalanceNote || '');
  const [openingError, setOpeningError] = useState('');
  const [isSavingOpening, setIsSavingOpening] = useState(false);

  const handleSaveOpening = async (e) => {
    e.preventDefault();
    if (isSavingOpening) return;
    setOpeningError('');
    setIsSavingOpening(true);
    try {
      await onSaveOpeningBalance?.({
        enabled: openingEnabled,
        openingCashBalance: openingEnabled ? openingAmount : 0,
        openingBalanceAsOf: openingEnabled ? openingAsOf : '',
        openingBalanceNote: openingEnabled ? openingNote : '',
      });
      toast.success(
        openingEnabled
          ? 'Saldo awal pergerakan kas berhasil disimpan.'
          : 'Saldo awal opsional dinonaktifkan.',
      );
      setOpeningFormOpen(false);
    } catch (err) {
      setOpeningError(mapBookkeepingErrorToMessage(err));
    } finally {
      setIsSavingOpening(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Period Selector */}
      <AdminSurface variant="card" className="p-3 sm:p-5">
        <BookkeepingPeriodFilter
          preset={preset}
          onPresetChange={onPresetChange}
          customStartDate={customStartDate}
          onCustomStartDateChange={onCustomStartDateChange}
          customEndDate={customEndDate}
          onCustomEndDateChange={onCustomEndDateChange}
          periodLabel={periodBounds?.periodLabel}
        />
      </AdminSurface>

      {/* A, B, C Financial Report Summaries */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* A. Income Summary */}
        <AdminSurface variant="card" className="space-y-2.5 p-3.5 sm:space-y-3 sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
            <h3 className="text-sm font-bold text-[#151515]">A. Income Summary</h3>
            <AdminStatusBadge tone="lime" size="sm">
              Pendapatan
            </AdminStatusBadge>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Billed Revenue (Issued Invoices)</dt>
              <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                {formatBookkeepingRupiah(metrics.totalBilled)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Customer Cash Received (Net)</dt>
              <dd className="font-mono font-bold text-[#243300] tabular-nums">
                {formatBookkeepingRupiah(metrics.customerCashReceived)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Other Manual Income</dt>
              <dd className="font-mono font-bold text-[#243300] tabular-nums">
                {formatBookkeepingRupiah(metrics.manualIncomeTotal)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#151515]/[0.07] pt-2">
              <dt className="font-semibold text-[#151515]">
                Customer Outstanding Receivable (Current)
              </dt>
              <dd className="font-mono font-bold text-[#8A4B08] tabular-nums">
                {formatBookkeepingRupiah(metrics.customerOutstandingReceivable)}
              </dd>
            </div>
          </dl>
        </AdminSurface>

        {/* B. Expense Summary */}
        <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
            <h3 className="text-sm font-bold text-[#151515]">B. Expense Summary</h3>
            <AdminStatusBadge tone="orange" size="sm">
              Beban &amp; Komisi
            </AdminStatusBadge>
          </div>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Staff Commission Accrued</dt>
              <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                {formatBookkeepingRupiah(metrics.staffCommissionAccrued)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Recording Operator Fee Accrued</dt>
              <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                {formatBookkeepingRupiah(metrics.recordingOperatorFeeAccrued)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Manual Expense Accrued</dt>
              <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                {formatBookkeepingRupiah(metrics.manualExpenseAccrued)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Expense Settled (Cash Out)</dt>
              <dd className="font-mono font-bold text-[#B92B0C] tabular-nums">
                {formatBookkeepingRupiah(metrics.expenseSettled)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#151515]/[0.07] pt-2">
              <dt className="font-semibold text-[#151515]">Remaining Payables (Current)</dt>
              <dd className="font-mono font-bold text-[#8A4B08] tabular-nums">
                {formatBookkeepingRupiah(metrics.outstandingPayables)}
              </dd>
            </div>
          </dl>
        </AdminSurface>

        {/* C. Cash Summary */}
        <AdminSurface variant="card" className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 border-b border-[#151515]/[0.07] pb-2.5">
            <h3 className="text-sm font-bold text-[#151515]">C. Cash Summary</h3>
            <button
              type="button"
              onClick={() => setOpeningFormOpen((prev) => !prev)}
              className="inline-flex min-h-9.5 cursor-pointer items-center gap-1.5 rounded-lg bg-[#F8F6EF] px-3 py-1 text-xs font-semibold text-[#46433D] hover:text-[#151515]"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Saldo Awal</span>
            </button>
          </div>

          <dl className="space-y-2 text-xs">
            {metrics.hasOpeningBalance ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#666159]">Opening Cash Movement Balance</dt>
                <dd className="font-mono font-semibold text-[#151515] tabular-nums">
                  {formatBookkeepingRupiah(metrics.openingCashBalance)}
                </dd>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Cash In</dt>
              <dd className="font-mono font-bold text-[#243300] tabular-nums">
                {formatBookkeepingRupiah(metrics.totalIncomeReceived)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#666159]">Cash Out</dt>
              <dd className="font-mono font-bold text-[#B92B0C] tabular-nums">
                {formatBookkeepingRupiah(metrics.totalOperatingCashOut)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[#151515]/[0.07] pt-2">
              <dt className="font-semibold text-[#151515]">
                {metrics.hasOpeningBalance
                  ? 'Net Cash Movement'
                  : 'Net Cash Movement for Selected Period'}
              </dt>
              <dd
                className={`font-mono font-bold tabular-nums ${
                  metrics.netCashMovement < 0 ? 'text-[#B92B0C]' : 'text-[#151515]'
                }`}
              >
                {formatBookkeepingRupiah(metrics.netCashMovement, { showPositiveSign: true })}
              </dd>
            </div>

            {metrics.hasOpeningBalance ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="font-semibold text-[#151515]">Opening + Net Cash Movement</dt>
                <dd className="font-mono font-bold text-[#151515] tabular-nums">
                  {formatBookkeepingRupiah(metrics.closingCashMovement)}
                </dd>
              </div>
            ) : null}
          </dl>

          {openingFormOpen ? (
            <form
              onSubmit={handleSaveOpening}
              className="sa-panel-ivory space-y-2.5 border-t border-[#151515]/[0.08] p-3 text-xs"
            >
              <label className="flex items-center gap-2 font-semibold text-[#151515]">
                <input
                  type="checkbox"
                  checked={openingEnabled}
                  onChange={(e) => setOpeningEnabled(e.target.checked)}
                />
                <span>Aktifkan Saldo Awal Pergerakan Kas</span>
              </label>

              {openingEnabled ? (
                <div className="space-y-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="Nominal saldo awal (IDR)"
                    className="sa-input min-h-10 w-full px-2.5 py-1 font-mono text-xs text-[#151515]"
                  />
                  <input
                    type="date"
                    value={openingAsOf}
                    onChange={(e) => setOpeningAsOf(e.target.value)}
                    className="sa-input min-h-10 w-full px-2.5 py-1 font-mono text-xs text-[#151515]"
                  />
                  <input
                    type="text"
                    value={openingNote}
                    onChange={(e) => setOpeningNote(e.target.value)}
                    placeholder="Catatan singkat (opsional)"
                    className="sa-input min-h-10 w-full px-2.5 py-1 text-xs text-[#151515]"
                  />
                </div>
              ) : null}

              {openingError ? <p className="text-[11px] text-[#B92B0C]">{openingError}</p> : null}

              <div className="flex justify-end gap-2">
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpeningFormOpen(false)}
                  className="min-h-10"
                >
                  Tutup
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSavingOpening}
                  className="min-h-10"
                >
                  {isSavingOpening ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>Simpan</span>
                </AdminButton>
              </div>
            </form>
          ) : null}
        </AdminSurface>
      </div>

      {/* D. Category Breakdown */}
      <AdminSurface variant="card" className="space-y-2.5 p-3.5 sm:space-y-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#151515] sm:text-base">
              D. Expense Category Breakdown ({periodBounds?.periodLabel})
            </h3>
            <p className="hidden text-xs text-[#666159] sm:block">
              Distribusi pengeluaran &amp; akrual komisi berdasarkan data aktual periode aktif.
            </p>
          </div>
          <AdminStatusBadge tone="ivory" size="sm">
            Total: {formatBookkeepingRupiah(metrics.totalExpenseAccrued)}
          </AdminStatusBadge>
        </div>

        <BookkeepingCategoryChart data={categoryBreakdown} />
      </AdminSurface>

      {/* E. CSV Exports */}
      <AdminSurface variant="card" className="space-y-2.5 p-3.5 sm:space-y-3 sm:p-5">
        <div>
          <h3 className="text-sm font-bold text-[#151515] sm:text-base">
            E. Export Laporan Keuangan (CSV)
          </h3>
          <p className="hidden text-xs text-[#666159] sm:block">
            File CSV menggunakan nilai numerik Rupiah murni (siap diolah di Excel/Google Sheets)
            serta format tanggal Indonesia dan ISO.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <AdminButton
            variant="secondary"
            size="md"
            onClick={() =>
              triggerCsvDownload(
                `37studio-transaction-ledger-${periodBounds?.periodStart || 'all'}.csv`,
                buildLedgerCsv(ledgerItems),
              )
            }
            className="justify-start"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Transaction Ledger CSV</span>
          </AdminButton>

          <AdminButton
            variant="secondary"
            size="md"
            onClick={() =>
              triggerCsvDownload(
                `37studio-cash-movement-${periodBounds?.periodStart || 'all'}.csv`,
                buildCashMovementCsv(cashMovementItems),
              )
            }
            className="justify-start"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Cash Movement CSV</span>
          </AdminButton>

          <AdminButton
            variant="secondary"
            size="md"
            onClick={() =>
              triggerCsvDownload(
                '37studio-outstanding-payables.csv',
                buildPayablesCsv(metrics.openPayables),
              )
            }
            className="justify-start"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Outstanding Payables CSV</span>
          </AdminButton>

          <AdminButton
            variant="primary"
            size="md"
            onClick={() =>
              triggerCsvDownload(
                `37studio-period-report-${periodBounds?.periodStart || 'all'}.csv`,
                buildPeriodReportCsv({ periodBounds, metrics, categoryBreakdown }),
              )
            }
            className="justify-start"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Period Report CSV</span>
          </AdminButton>
        </div>
      </AdminSurface>
    </div>
  );
}
