/**
 * Pure Integer-Rupiah Financial Calculation Engine for Pembukuan.
 *
 * Anti-double-counting invariants strictly enforced:
 * 1. Invoice `totalAmount` contributes ONLY to Billed Revenue (`issued` only); NEVER to Cash In.
 * 2. Customer Cash In = `SUM(paymentTransactions.payment) - SUM(paymentTransactions.reversal)`.
 * 3. `invoice.amountPaid` is an invoice aggregate and is NEVER summed alongside `paymentTransactions`.
 * 4. Commission `bookkeepingEntries` represent Expense Accruals; `commissionBatches` are NEVER added on top.
 * 5. Owner Allocation is excluded from payables and expenses.
 * 6. Unpaid expense accruals contribute to Expense Accrued and Outstanding Payables, NEVER to Cash Out.
 * 7. Actual Operating Cash Out = `SUM(bookkeepingSettlements.amount)` for `expense_payment` settlements.
 * 8. Inventory movements never create bookkeeping entries or expenses.
 */

import {
  BOOKKEEPING_ENTRY_TYPES,
  BOOKKEEPING_SETTLEMENT_STATUS,
  BOOKKEEPING_SETTLEMENT_TYPES,
  BOOKKEEPING_SOURCE_MODULES,
  BOOKKEEPING_SOURCE_TYPES,
  getBookkeepingCategoryLabel,
  LEDGER_PRESENTATION_TYPES,
  LEDGER_SOURCE_GROUPS,
  LEDGER_SOURCE_TYPES,
} from '../config/bookkeeping-config';
import { toNonNegativeRupiahInt } from '../schemas/bookkeeping-schema';
import { isTimestampInPeriod, parseJakartaTimestamp } from './bookkeeping-period';

export function mergeUniqueRecords(primaryList = [], secondaryList = []) {
  const byId = new Map();
  for (const item of secondaryList || []) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of primaryList || []) {
    if (!item?.id) continue;
    const prev = byId.get(item.id);
    if (!prev || Number(item.version || 0) >= Number(prev.version || 0)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

/**
 * Checks whether a `bookkeepingEntries` doc is an active payable expense obligation.
 * Strictly excludes income, reversals, reversed entries, Owner Allocation, and Inventory.
 */
export function isActivePayableEntry(entry) {
  if (!entry) return false;
  if (entry.entryType !== BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL) return false;
  if (entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED) return false;
  if (entry.category === 'owner_allocation' || entry.category === 'owner') return false;
  if (entry.sourceModule === 'inventory' || entry.sourceType === 'inventory_movement') return false;
  return true;
}

export function isActiveManualIncomeEntry(entry) {
  if (!entry) return false;
  if (entry.entryType !== BOOKKEEPING_ENTRY_TYPES.INCOME) return false;
  if (entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED) return false;
  if (entry.sourceModule !== BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING) return false;
  return true;
}

/**
 * Computes all Overview & Reports metrics for a selected `Asia/Jakarta` period,
 * cleanly separating Period Activity from Current Standing Balances.
 */
export function calculateBookkeepingMetrics({
  invoices = [],
  outstandingInvoices = [],
  paymentTransactions = [],
  bookkeepingEntries = [],
  activePayables = [],
  bookkeepingSettlements = [],
  periodBounds = null,
  settings = null,
} = {}) {
  const allInvoices = mergeUniqueRecords(invoices, outstandingInvoices);
  const allEntries = mergeUniqueRecords(bookkeepingEntries, activePayables);

  // 1. Customer Billed Revenue (Period Activity — Issued invoices only, void excluded)
  let totalBilled = 0;
  let issuedInvoicesCountInPeriod = 0;
  let customerOutstandingReceivable = 0;
  let outstandingReceivableCount = 0;

  for (const inv of allInvoices) {
    if (!inv || inv.invoiceStatus !== 'issued') continue;

    // Current Balance across ALL issued invoices
    const balanceDue = toNonNegativeRupiahInt(inv.balanceDue);
    customerOutstandingReceivable += balanceDue;
    if (balanceDue > 0) {
      outstandingReceivableCount += 1;
    }

    // Period Billed Revenue
    const invDate = inv.invoiceDate ?? inv.createdAt;
    if (!periodBounds || isTimestampInPeriod(invDate, periodBounds)) {
      totalBilled += toNonNegativeRupiahInt(
        inv.effectiveTotalAmount ?? inv.financialSnapshot?.totalAmount,
      );
      issuedInvoicesCountInPeriod += 1;
    }
  }

  // 2. Customer Cash In (Period Activity — SUM(payment) - SUM(reversal) by receivedAt)
  let grossCustomerPayments = 0;
  let customerPaymentReversals = 0;
  let customerPaymentCount = 0;
  let customerReversalCount = 0;

  for (const tx of paymentTransactions || []) {
    if (!tx) continue;
    const txTime = tx.receivedAt ?? tx.createdAt;
    if (periodBounds && !isTimestampInPeriod(txTime, periodBounds)) continue;

    const amount = toNonNegativeRupiahInt(tx.amount);
    if (tx.transactionType === 'reversal') {
      customerPaymentReversals += amount;
      customerReversalCount += 1;
    } else if (tx.transactionType === 'payment') {
      grossCustomerPayments += amount;
      customerPaymentCount += 1;
    }
  }

  const customerCashReceived = grossCustomerPayments - customerPaymentReversals;

  // 3. Manual Income & Expense Accruals
  let manualIncomeTotal = 0;
  let manualIncomeCount = 0;

  let staffCommissionAccrued = 0;
  let recordingOperatorFeeAccrued = 0;
  let manualExpenseAccrued = 0;
  let manualExpensePaidImmediateAccrued = 0;
  let manualExpenseUnpaidAccrued = 0;

  let outstandingPayables = 0;
  let staffCommissionPayable = 0;
  let recordingOperatorPayable = 0;
  let manualExpensePayable = 0;
  const openPayables = [];

  for (const entry of allEntries) {
    if (!entry) continue;
    const effectiveTime = entry.occurredAt ?? entry.postedAt ?? entry.createdAt;
    const inPeriod = !periodBounds || isTimestampInPeriod(effectiveTime, periodBounds);

    if (isActiveManualIncomeEntry(entry)) {
      if (inPeriod) {
        manualIncomeTotal += toNonNegativeRupiahInt(entry.amount);
        manualIncomeCount += 1;
      }
      continue;
    }

    if (!isActivePayableEntry(entry)) continue;

    // Current Balance across ALL active unpaid/partial payables (regardless of period filter)
    // Safely supports both normalized entries and raw legacy 13-field commission entries.
    const rawAmount = toNonNegativeRupiahInt(entry.amount);
    const rawSettled =
      entry.amountSettled !== undefined && entry.amountSettled !== null
        ? toNonNegativeRupiahInt(entry.amountSettled)
        : entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.PAID
          ? rawAmount
          : 0;
    const remaining =
      entry.remainingAmount !== undefined && entry.remainingAmount !== null
        ? toNonNegativeRupiahInt(entry.remainingAmount)
        : Math.max(0, rawAmount - rawSettled);
    if (remaining > 0) {
      outstandingPayables += remaining;
      openPayables.push(entry);
      if (entry.category === 'staff_commission') {
        staffCommissionPayable += remaining;
      } else if (entry.category === 'recording_operator_fee') {
        recordingOperatorPayable += remaining;
      } else {
        manualExpensePayable += remaining;
      }
    }

    // Period Expense Accrued
    if (inPeriod) {
      const amount = toNonNegativeRupiahInt(entry.amount);
      if (entry.category === 'staff_commission') {
        staffCommissionAccrued += amount;
      } else if (entry.category === 'recording_operator_fee') {
        recordingOperatorFeeAccrued += amount;
      } else if (entry.sourceModule === BOOKKEEPING_SOURCE_MODULES.BOOKKEEPING) {
        manualExpenseAccrued += amount;
        if (entry.paidOnCreate) {
          manualExpensePaidImmediateAccrued += amount;
        } else {
          manualExpenseUnpaidAccrued += amount;
        }
      }
    }
  }

  const totalExpenseAccrued =
    staffCommissionAccrued + recordingOperatorFeeAccrued + manualExpenseAccrued;

  // 4. Actual Operating Cash Out = SUM(bookkeepingSettlements.amount) in period by paidAt
  let totalOperatingCashOut = 0;
  let commissionCashOut = 0;
  let manualExpenseCashOut = 0;
  let settlementCountInPeriod = 0;

  for (const settlement of bookkeepingSettlements || []) {
    if (!settlement || settlement.settlementType !== BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT) {
      continue;
    }
    const paidTime = settlement.paidAt ?? settlement.createdAt;
    if (periodBounds && !isTimestampInPeriod(paidTime, periodBounds)) continue;

    const amount = toNonNegativeRupiahInt(settlement.amount);
    totalOperatingCashOut += amount;
    settlementCountInPeriod += 1;
    if (settlement.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH) {
      commissionCashOut += amount;
    } else {
      manualExpenseCashOut += amount;
    }
  }

  // 5. Net Income Received & Net Cash Movement
  const totalIncomeReceived = customerCashReceived + manualIncomeTotal;
  const netCashMovement = totalIncomeReceived - totalOperatingCashOut;

  // 6. Optional Opening Cash Movement Balance
  const hasOpeningBalance =
    settings?.openingCashBalance !== null &&
    settings?.openingCashBalance !== undefined &&
    Number.isInteger(Number(settings.openingCashBalance)) &&
    Number(settings.openingCashBalance) >= 0;

  const openingCashBalance = hasOpeningBalance ? Number(settings.openingCashBalance) : null;
  const closingCashMovement = hasOpeningBalance ? openingCashBalance + netCashMovement : null;

  openPayables.sort((a, b) => {
    const dueA = a.dueDate || '9999-99-99';
    const dueB = b.dueDate || '9999-99-99';
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return (
      parseJakartaTimestamp(b.occurredAt || b.createdAt).millis -
      parseJakartaTimestamp(a.occurredAt || a.createdAt).millis
    );
  });

  return {
    // Period Headline KPIs
    totalIncomeReceived,
    totalOperatingCashOut,
    netCashMovement,
    // Current Balance Headline KPI
    outstandingPayables,
    openPayablesCount: openPayables.length,
    openPayables,
    // Period Income Breakdown
    totalBilled,
    issuedInvoicesCountInPeriod,
    grossCustomerPayments,
    customerPaymentReversals,
    customerCashReceived,
    customerPaymentCount,
    customerReversalCount,
    manualIncomeTotal,
    manualIncomeCount,
    // Current Receivables Breakdown
    customerOutstandingReceivable,
    outstandingReceivableCount,
    // Period Expense & Settlement Breakdown
    totalExpenseAccrued,
    staffCommissionAccrued,
    recordingOperatorFeeAccrued,
    manualExpenseAccrued,
    manualExpensePaidImmediateAccrued,
    manualExpenseUnpaidAccrued,
    expenseSettled: totalOperatingCashOut,
    commissionCashOut,
    manualExpenseCashOut,
    settlementCountInPeriod,
    // Current Payables Breakdown
    staffCommissionPayable,
    recordingOperatorPayable,
    manualExpensePayable,
    // Optional Opening Balance
    hasOpeningBalance,
    openingCashBalance,
    openingBalanceAsOf: settings?.openingBalanceAsOf || '',
    openingBalanceNote: settings?.openingBalanceNote || '',
    closingCashMovement,
  };
}

/**
 * Normalizes existing sources (paymentTransactions, bookkeepingEntries, bookkeepingSettlements)
 * into a unified, non-mutating financial ledger list without double-counting immediate paid expenses.
 */
export function buildUnifiedLedgerItems({
  invoices = [],
  outstandingInvoices = [],
  paymentTransactions = [],
  bookkeepingEntries = [],
  activePayables = [],
  bookkeepingSettlements = [],
} = {}) {
  const allInvoices = mergeUniqueRecords(invoices, outstandingInvoices);
  const invoicesById = new Map(allInvoices.map((inv) => [inv.id, inv]));

  const allEntries = mergeUniqueRecords(bookkeepingEntries, activePayables);
  const entriesById = new Map(allEntries.map((entry) => [entry.id, entry]));

  const items = [];

  // 1. Customer Payments & Reversals from `paymentTransactions`
  for (const tx of paymentTransactions || []) {
    if (!tx) continue;
    const inv = invoicesById.get(tx.invoiceId) || null;
    const customerLabel = inv?.customerSnapshot?.name
      ? `${inv.customerSnapshot.name}${inv.customerSnapshot.bandName ? ` (${inv.customerSnapshot.bandName})` : ''}`
      : tx.invoiceNumber || tx.invoiceId;
    const isReversal = tx.transactionType === 'reversal';
    const parsedTime = parseJakartaTimestamp(tx.receivedAt ?? tx.createdAt);

    items.push({
      id: `tx_${tx.id}`,
      recordId: tx.id,
      recordCollection: 'paymentTransactions',
      date: tx.receivedAt ?? tx.createdAt,
      dateIso: parsedTime.dateIso,
      dateMillis: parsedTime.millis,
      description: isReversal
        ? `Koreksi Pembayaran • ${customerLabel}`
        : `Pembayaran Invoice ${tx.invoiceNumber || inv?.invoiceNumber || ''} • ${customerLabel}`.trim(),
      category: isReversal ? 'customer_payment_reversal' : 'customer_session_payment',
      categoryLabel: getBookkeepingCategoryLabel(
        isReversal ? 'customer_payment_reversal' : 'customer_session_payment',
      ),
      direction: 'income',
      amount: toNonNegativeRupiahInt(tx.amount),
      signedAmount: isReversal
        ? -toNonNegativeRupiahInt(tx.amount)
        : toNonNegativeRupiahInt(tx.amount),
      status: isReversal ? 'reversed' : 'recorded',
      statusLabel: isReversal ? 'Reversed' : 'Recorded',
      presentationType: isReversal
        ? LEDGER_PRESENTATION_TYPES.CORRECTION
        : LEDGER_PRESENTATION_TYPES.CASH,
      sourceType: isReversal
        ? LEDGER_SOURCE_TYPES.CUSTOMER_PAYMENT_REVERSAL
        : LEDGER_SOURCE_TYPES.CUSTOMER_PAYMENT,
      sourceGroup: LEDGER_SOURCE_GROUPS.INVOICE,
      paymentMethod: tx.paymentMethod || 'cash',
      referenceNumber: tx.referenceNumber || tx.invoiceNumber || '',
      notes: tx.notes || '',
      actorUid: tx.recordedByUid || '',
      invoiceId: tx.invoiceId || '',
      invoiceNumber: tx.invoiceNumber || inv?.invoiceNumber || '',
      entryId: '',
      sourceId: tx.invoiceId || '',
      originalRecord: tx,
      linkedInvoice: inv,
      linkedEntry: null,
    });
  }

  // 2. Bookkeeping Entries (`bookkeepingEntries`: Manual Income, Manual Expense, Commission Accrual, Manual Reversal)
  for (const entry of allEntries) {
    if (!entry) continue;
    const effectiveTime = entry.occurredAt ?? entry.postedAt ?? entry.createdAt;
    const parsedTime = parseJakartaTimestamp(effectiveTime);
    const isReversed = entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.REVERSED;

    if (entry.entryType === BOOKKEEPING_ENTRY_TYPES.INCOME) {
      items.push({
        id: `entry_${entry.id}`,
        recordId: entry.id,
        recordCollection: 'bookkeepingEntries',
        date: effectiveTime,
        dateIso: parsedTime.dateIso,
        dateMillis: parsedTime.millis,
        description: entry.description || 'Manual Income',
        category: entry.category,
        categoryLabel: getBookkeepingCategoryLabel(entry.category),
        direction: 'income',
        amount: entry.amount,
        signedAmount: entry.amount,
        status: isReversed ? 'reversed' : 'recorded',
        statusLabel: isReversed ? 'Reversed' : 'Recorded',
        presentationType: LEDGER_PRESENTATION_TYPES.CASH,
        sourceType: LEDGER_SOURCE_TYPES.MANUAL_INCOME,
        sourceGroup: LEDGER_SOURCE_GROUPS.MANUAL,
        paymentMethod: entry.paymentMethod || 'cash',
        referenceNumber: entry.referenceNumber || '',
        notes: entry.notes || '',
        actorUid: entry.createdByUid || '',
        invoiceId: '',
        invoiceNumber: '',
        entryId: entry.id,
        sourceId: entry.sourceId || entry.id,
        originalRecord: entry,
        linkedInvoice: null,
        linkedEntry: entry,
      });
      continue;
    }

    if (entry.entryType === BOOKKEEPING_ENTRY_TYPES.REVERSAL) {
      const targetEntry = entry.reversalOfEntryId ? entriesById.get(entry.reversalOfEntryId) : null;
      const wasIncome =
        entry.originalEntryType === BOOKKEEPING_ENTRY_TYPES.INCOME ||
        targetEntry?.entryType === BOOKKEEPING_ENTRY_TYPES.INCOME;

      items.push({
        id: `entry_${entry.id}`,
        recordId: entry.id,
        recordCollection: 'bookkeepingEntries',
        date: effectiveTime,
        dateIso: parsedTime.dateIso,
        dateMillis: parsedTime.millis,
        description: entry.description || 'Koreksi Manual',
        category: entry.category,
        categoryLabel: getBookkeepingCategoryLabel(entry.category),
        direction: wasIncome ? 'income' : 'expense',
        amount: entry.amount,
        signedAmount: -entry.amount,
        status: 'reversed',
        statusLabel: 'Reversed',
        presentationType: LEDGER_PRESENTATION_TYPES.CORRECTION,
        sourceType: LEDGER_SOURCE_TYPES.MANUAL_REVERSAL,
        sourceGroup: LEDGER_SOURCE_GROUPS.MANUAL,
        paymentMethod: '',
        referenceNumber: entry.reversalOfEntryId || entry.sourceId || '',
        notes: entry.notes || '',
        actorUid: entry.createdByUid || '',
        invoiceId: '',
        invoiceNumber: '',
        entryId: entry.id,
        sourceId: entry.sourceId || '',
        originalRecord: entry,
        linkedInvoice: null,
        linkedEntry: targetEntry || entry,
      });
      continue;
    }

    if (entry.entryType === BOOKKEEPING_ENTRY_TYPES.EXPENSE_ACCRUAL) {
      const isCommission = entry.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH;
      const isImmediatePaid = Boolean(entry.paidOnCreate && entry.sourceModule === 'bookkeeping');

      let statusKey = 'accrued';
      let statusLabel = 'Accrued';
      if (isReversed) {
        statusKey = 'reversed';
        statusLabel = 'Reversed';
      } else if (entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.PAID) {
        statusKey = 'settled';
        statusLabel = isImmediatePaid ? 'Recorded' : 'Settled';
      } else if (entry.settlementStatus === BOOKKEEPING_SETTLEMENT_STATUS.PARTIALLY_PAID) {
        statusKey = 'partially_settled';
        statusLabel = 'Partial';
      }

      items.push({
        id: `entry_${entry.id}`,
        recordId: entry.id,
        recordCollection: 'bookkeepingEntries',
        date: effectiveTime,
        dateIso: parsedTime.dateIso,
        dateMillis: parsedTime.millis,
        description: entry.description || getBookkeepingCategoryLabel(entry.category),
        category: entry.category,
        categoryLabel: getBookkeepingCategoryLabel(entry.category),
        direction: 'expense',
        amount: entry.amount,
        signedAmount: -entry.amount,
        status: statusKey,
        statusLabel,
        presentationType: isImmediatePaid
          ? LEDGER_PRESENTATION_TYPES.CASH
          : LEDGER_PRESENTATION_TYPES.ACCRUAL,
        sourceType: isCommission
          ? LEDGER_SOURCE_TYPES.COMMISSION_ACCRUAL
          : isImmediatePaid
            ? LEDGER_SOURCE_TYPES.MANUAL_EXPENSE
            : LEDGER_SOURCE_TYPES.MANUAL_PAYABLE,
        sourceGroup: isCommission ? LEDGER_SOURCE_GROUPS.COMMISSION : LEDGER_SOURCE_GROUPS.MANUAL,
        paymentMethod: isImmediatePaid ? entry.paymentMethod || 'cash' : '',
        referenceNumber: entry.referenceNumber || entry.sourceId || '',
        notes: entry.notes || '',
        actorUid: entry.createdByUid || '',
        invoiceId: '',
        invoiceNumber: '',
        entryId: entry.id,
        sourceId: entry.sourceId || '',
        originalRecord: entry,
        linkedInvoice: null,
        linkedEntry: entry,
      });
    }
  }

  // 3. Settlements from `bookkeepingSettlements`
  // Note: immediate paid manual expenses (`entry.paidOnCreate && entry.lastSettlementId === settlement.id`)
  // already appear as one `manual_expense` cash item above to prevent confusing duplicate ledger rows,
  // while Cash Out totals ALWAYS sum `bookkeepingSettlements`.
  for (const settlement of bookkeepingSettlements || []) {
    if (!settlement) continue;
    const parentEntry = settlement.entryId ? entriesById.get(settlement.entryId) : null;
    if (parentEntry && parentEntry.paidOnCreate && parentEntry.lastSettlementId === settlement.id) {
      continue;
    }

    const isCommission = settlement.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH;
    const paidTime = settlement.paidAt ?? settlement.createdAt;
    const parsedTime = parseJakartaTimestamp(paidTime);

    items.push({
      id: `set_${settlement.id}`,
      recordId: settlement.id,
      recordCollection: 'bookkeepingSettlements',
      date: paidTime,
      dateIso: parsedTime.dateIso,
      dateMillis: parsedTime.millis,
      description: parentEntry
        ? `Pembayaran Kewajiban • ${parentEntry.description}`
        : `Settlement Kewajiban (${settlement.entryId})`,
      category:
        parentEntry?.category || (isCommission ? 'staff_commission' : 'other_operational_expense'),
      categoryLabel: parentEntry
        ? getBookkeepingCategoryLabel(parentEntry.category)
        : isCommission
          ? 'Commission Settlement'
          : 'Payable Settlement',
      direction: 'expense',
      amount: settlement.amount,
      signedAmount: -settlement.amount,
      status: 'settled',
      statusLabel: 'Settled',
      presentationType: LEDGER_PRESENTATION_TYPES.SETTLEMENT,
      sourceType: isCommission
        ? LEDGER_SOURCE_TYPES.PAYABLE_SETTLEMENT
        : LEDGER_SOURCE_TYPES.MANUAL_PAYABLE_SETTLEMENT,
      sourceGroup: isCommission ? LEDGER_SOURCE_GROUPS.COMMISSION : LEDGER_SOURCE_GROUPS.MANUAL,
      paymentMethod: settlement.paymentMethod || 'cash',
      referenceNumber: settlement.referenceNumber || settlement.sourceId || '',
      notes: settlement.notes || '',
      actorUid: settlement.createdByUid || '',
      invoiceId: '',
      invoiceNumber: '',
      entryId: settlement.entryId || '',
      sourceId: settlement.sourceId || '',
      originalRecord: settlement,
      linkedInvoice: null,
      linkedEntry: parentEntry,
    });
  }

  items.sort((a, b) => {
    const diff = (b.dateMillis || 0) - (a.dateMillis || 0);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  return items;
}

/**
 * Filters unified ledger rows for the Transactions workspace.
 */
export function filterUnifiedLedgerItems({
  items = [],
  dateFrom = '',
  dateTo = '',
  direction = 'all',
  category = 'all',
  sourceGroup = 'all',
  status = 'all',
  presentationType = 'all',
  searchQuery = '',
} = {}) {
  const cleanSearch = String(searchQuery || '')
    .trim()
    .toLowerCase();

  return (items || []).filter((item) => {
    if (!item) return false;
    if (direction !== 'all' && item.direction !== direction) return false;
    if (category !== 'all' && item.category !== category) return false;
    if (sourceGroup !== 'all' && item.sourceGroup !== sourceGroup) return false;
    if (status !== 'all' && item.status !== status) return false;
    if (presentationType !== 'all' && item.presentationType !== presentationType) return false;
    if (dateFrom && item.dateIso && item.dateIso < dateFrom) return false;
    if (dateTo && item.dateIso && item.dateIso > dateTo) return false;

    if (cleanSearch) {
      const haystacks = [
        item.description,
        item.categoryLabel,
        item.referenceNumber,
        item.invoiceNumber,
        item.entryId,
        item.sourceId,
        item.recordId,
        item.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystacks.includes(cleanSearch)) return false;
    }

    return true;
  });
}

/**
 * Builds the Cash Movement ledger strictly from actual cash inflows and outflows:
 * - Customer payment transactions (`payment` & compensating `reversal`)
 * - Valid non-reversed Manual Income entries
 * - Bookkeeping expense settlements (`bookkeepingSettlements`)
 *
 * Strictly excludes unpaid accruals so cash movement never includes unpaid obligations.
 */
export function buildCashMovementItems({
  invoices = [],
  outstandingInvoices = [],
  paymentTransactions = [],
  bookkeepingEntries = [],
  activePayables = [],
  bookkeepingSettlements = [],
  periodBounds = null,
} = {}) {
  const allInvoices = mergeUniqueRecords(invoices, outstandingInvoices);
  const invoicesById = new Map(allInvoices.map((inv) => [inv.id, inv]));
  const allEntries = mergeUniqueRecords(bookkeepingEntries, activePayables);
  const entriesById = new Map(allEntries.map((entry) => [entry.id, entry]));

  const rows = [];

  for (const tx of paymentTransactions || []) {
    if (!tx) continue;
    const txTime = tx.receivedAt ?? tx.createdAt;
    if (periodBounds && !isTimestampInPeriod(txTime, periodBounds)) continue;

    const inv = invoicesById.get(tx.invoiceId) || null;
    const customerName = inv?.customerSnapshot?.name || tx.invoiceNumber || tx.invoiceId;
    const isReversal = tx.transactionType === 'reversal';
    const parsedTime = parseJakartaTimestamp(txTime);
    const amount = toNonNegativeRupiahInt(tx.amount);

    rows.push({
      id: `cash_tx_${tx.id}`,
      recordId: tx.id,
      recordCollection: 'paymentTransactions',
      date: txTime,
      dateIso: parsedTime.dateIso,
      dateMillis: parsedTime.millis,
      description: isReversal
        ? `Koreksi Penerimaan • ${customerName}`
        : `Pembayaran Customer (${tx.invoiceNumber || inv?.invoiceNumber || ''}) • ${customerName}`.trim(),
      category: isReversal ? 'customer_payment_reversal' : 'customer_session_payment',
      categoryLabel: isReversal ? 'Payment Reversal' : 'Customer Payment',
      direction: 'income',
      amount,
      signedAmount: isReversal ? -amount : amount,
      status: isReversal ? 'reversed' : 'recorded',
      statusLabel: isReversal ? 'Reversal' : 'Cash In',
      sourceType: isReversal
        ? LEDGER_SOURCE_TYPES.CUSTOMER_PAYMENT_REVERSAL
        : LEDGER_SOURCE_TYPES.CUSTOMER_PAYMENT,
      sourceGroup: LEDGER_SOURCE_GROUPS.INVOICE,
      paymentMethod: tx.paymentMethod || 'cash',
      referenceNumber: tx.referenceNumber || tx.invoiceNumber || '',
      actorUid: tx.recordedByUid || '',
      notes: tx.notes || '',
      invoiceId: tx.invoiceId || '',
      invoiceNumber: tx.invoiceNumber || inv?.invoiceNumber || '',
      entryId: '',
      originalRecord: tx,
      linkedInvoice: inv,
      linkedEntry: null,
    });
  }

  for (const entry of allEntries) {
    if (!isActiveManualIncomeEntry(entry)) continue;
    const effectiveTime = entry.occurredAt ?? entry.createdAt;
    if (periodBounds && !isTimestampInPeriod(effectiveTime, periodBounds)) continue;
    const parsedTime = parseJakartaTimestamp(effectiveTime);

    rows.push({
      id: `cash_inc_${entry.id}`,
      recordId: entry.id,
      recordCollection: 'bookkeepingEntries',
      date: effectiveTime,
      dateIso: parsedTime.dateIso,
      dateMillis: parsedTime.millis,
      description: entry.description || 'Manual Income',
      category: entry.category,
      categoryLabel: getBookkeepingCategoryLabel(entry.category),
      direction: 'income',
      amount: entry.amount,
      signedAmount: entry.amount,
      status: 'recorded',
      statusLabel: 'Cash In',
      sourceType: LEDGER_SOURCE_TYPES.MANUAL_INCOME,
      sourceGroup: LEDGER_SOURCE_GROUPS.MANUAL,
      paymentMethod: entry.paymentMethod || 'cash',
      referenceNumber: entry.referenceNumber || '',
      actorUid: entry.createdByUid || '',
      notes: entry.notes || '',
      invoiceId: '',
      invoiceNumber: '',
      entryId: entry.id,
      originalRecord: entry,
      linkedInvoice: null,
      linkedEntry: entry,
    });
  }

  for (const settlement of bookkeepingSettlements || []) {
    if (!settlement || settlement.settlementType !== BOOKKEEPING_SETTLEMENT_TYPES.EXPENSE_PAYMENT) {
      continue;
    }
    const paidTime = settlement.paidAt ?? settlement.createdAt;
    if (periodBounds && !isTimestampInPeriod(paidTime, periodBounds)) continue;

    const parentEntry = settlement.entryId ? entriesById.get(settlement.entryId) : null;
    const isCommission = settlement.sourceType === BOOKKEEPING_SOURCE_TYPES.COMMISSION_BATCH;
    const parsedTime = parseJakartaTimestamp(paidTime);

    rows.push({
      id: `cash_set_${settlement.id}`,
      recordId: settlement.id,
      recordCollection: 'bookkeepingSettlements',
      date: paidTime,
      dateIso: parsedTime.dateIso,
      dateMillis: parsedTime.millis,
      description: parentEntry
        ? parentEntry.paidOnCreate
          ? parentEntry.description
          : `Pelunasan • ${parentEntry.description}`
        : `Settlement (${settlement.entryId})`,
      category:
        parentEntry?.category || (isCommission ? 'staff_commission' : 'other_operational_expense'),
      categoryLabel: parentEntry
        ? getBookkeepingCategoryLabel(parentEntry.category)
        : isCommission
          ? 'Commission Payout'
          : 'Expense Settlement',
      direction: 'expense',
      amount: settlement.amount,
      signedAmount: -settlement.amount,
      status: 'settled',
      statusLabel: 'Cash Out',
      sourceType: isCommission
        ? LEDGER_SOURCE_TYPES.PAYABLE_SETTLEMENT
        : parentEntry?.paidOnCreate
          ? LEDGER_SOURCE_TYPES.MANUAL_EXPENSE
          : LEDGER_SOURCE_TYPES.MANUAL_PAYABLE_SETTLEMENT,
      sourceGroup: isCommission ? LEDGER_SOURCE_GROUPS.COMMISSION : LEDGER_SOURCE_GROUPS.MANUAL,
      paymentMethod: settlement.paymentMethod || 'cash',
      referenceNumber: settlement.referenceNumber || settlement.sourceId || '',
      actorUid: settlement.createdByUid || '',
      notes: settlement.notes || '',
      invoiceId: '',
      invoiceNumber: '',
      entryId: settlement.entryId || '',
      originalRecord: settlement,
      linkedInvoice: null,
      linkedEntry: parentEntry,
    });
  }

  rows.sort((a, b) => {
    const diff = (b.dateMillis || 0) - (a.dateMillis || 0);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  return rows;
}

/**
 * Aggregates recognized expense accruals by category for Reports & ECharts visualization.
 * Never fabricates data and never double-counts settlements.
 */
export function buildExpenseCategoryBreakdown({
  bookkeepingEntries = [],
  activePayables = [],
  periodBounds = null,
} = {}) {
  const allEntries = mergeUniqueRecords(bookkeepingEntries, activePayables);
  const buckets = new Map();
  let totalAmount = 0;

  for (const entry of allEntries) {
    if (!isActivePayableEntry(entry)) continue;
    const effectiveTime = entry.occurredAt ?? entry.postedAt ?? entry.createdAt;
    if (periodBounds && !isTimestampInPeriod(effectiveTime, periodBounds)) continue;

    const categoryId = entry.category || 'other_operational_expense';
    const amount = toNonNegativeRupiahInt(entry.amount);
    if (amount <= 0) continue;

    totalAmount += amount;
    const prev = buckets.get(categoryId) || {
      categoryId,
      label: getBookkeepingCategoryLabel(categoryId),
      amount: 0,
      count: 0,
    };
    prev.amount += amount;
    prev.count += 1;
    buckets.set(categoryId, prev);
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      sharePercent: totalAmount > 0 ? Math.round((item.amount / totalAmount) * 1000) / 10 : 0,
    }));
}
