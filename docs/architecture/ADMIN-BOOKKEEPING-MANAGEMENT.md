# 37 MUSIC STUDIO — ADMIN BOOKKEEPING (`PEMBUKUAN`) ARCHITECTURE

**Module Route:** `/admin/pembukuan` (supports `?tab=overview|transactions|cash-settlement|reports`)  
**Access Control:** Strictly Active Owner Only (`role === 'owner' && active === true`), enforced both at UI guard level and Cloud Firestore Security Rules (`isActiveOwner()`).  
**Primary Firestore Collections:** `bookkeepingEntries`, `bookkeepingSettlements`, `bookkeepingSettings`  
**Integrated Read-Only Sources:** `invoices`, `paymentTransactions`, `commissionBatches` (via `bookkeepingEntries` accruals)  
**Currency:** `IDR` (Integer Rupiah)  
**Timezone:** `Asia/Jakarta` (WIB / UTC+7)

---

## 1. Financial Product Principles

Pembukuan serves as the financial control center for the 37 Music Studio Owner, answering five daily operational questions without enterprise ERP complexity:

1. **Billed Revenue:** How much studio revenue was billed via issued invoices?
2. **Cash Received:** How much actual money entered the studio (customer net payments + manual income)?
3. **Studio Expenses:** What operational expenses and internal commissions were recognized (`accrued`) and actually paid (`cash out`)?
4. **Outstanding Payables:** How much does the studio still owe to staff, recording operators, and unpaid vendors/bills?
5. **Net Cash Movement:** What is the net cash flow (`Cash In - Cash Out`) over a selected `Asia/Jakarta` period?

**Core integrity invariant:** Simplicity on the surface, strict anti-double-counting financial semantics underneath.

---

## 2. Income & Expense Sources

| Flow Type                 | Firestore Source                                                                            | Treatment                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer Billed Revenue   | `invoices` (`invoiceStatus === 'issued'`)                                                   | Contributes to **Total Billed** & **Customer Outstanding Receivable** (`balanceDue`). Excluded when `void`.                                                                                                                             |
| Customer Cash In          | `paymentTransactions` (`payment` minus `reversal`)                                          | Contributes to **Customer Cash Received** & **Cash Movement** by `receivedAt`.                                                                                                                                                          |
| Manual Income             | `bookkeepingEntries` (`entryType: 'income'`, `sourceModule: 'bookkeeping'`)                 | Non-invoice cash receipt (`other_studio_service`, `equipment_rental`, `merchandise`, `other_income`).                                                                                                                                   |
| Commission & Fee Accruals | `bookkeepingEntries` (`sourceModule: 'commission-and-fee'`, `entryType: 'expense_accrual'`) | Staff Commission & Recording Operator Fee obligations posted from Commission & Fee.                                                                                                                                                     |
| Manual Expenses           | `bookkeepingEntries` (`entryType: 'expense_accrual'`, `sourceModule: 'bookkeeping'`)        | Operational costs (`utilities`, `internet_communication`, `cleaning_housekeeping`, `equipment_maintenance`, `equipment_purchase`, `studio_supplies`, `transportation`, `rent_facilities`, `other_operational_expense`), Paid or Unpaid. |
| Cash Out / Settlements    | `bookkeepingSettlements` (`settlementType: 'expense_payment'`)                              | Append-only cash outflow ledger settling commission or manual expenses by `paidAt`.                                                                                                                                                     |

**Strict Inventory Boundary:** `inventoryItems` and `inventoryMovements` (`stock_in`, `consume`, `write_off`, `stock_adjustment`, equipment repairs/retirements) **never** generate `bookkeepingEntries` or expenses automatically.

---

## 3. Invoice vs. Cash Distinction

- `invoices.financialSnapshot.totalAmount` records **Total Billed Revenue** for `issued` invoices (filtered by `invoiceDate`). It is **never** added to Cash Received.
- `invoices.amountPaid` is a per-invoice aggregate used by Payment & Bill; Pembukuan **never** sums `invoice.amountPaid` alongside `paymentTransactions` so customer receipts are never counted twice.
- `void` invoices are strictly excluded from both period Billed Revenue and Customer Outstanding Receivable.

---

## 4. Payment & Reversal Treatment

- Net Customer Cash Received in period = `SUM(paymentTransactions where transactionType == 'payment') - SUM(paymentTransactions where transactionType == 'reversal')` filtered by `receivedAt`.
- Reversal rows appear visibly in Unified Ledger and Cash Movement with negative sign (`-Rp ...`) and distinct `Reversal` badge so history remains intact and auditable.
- Customer payment reversals continue to be managed exclusively inside `/admin/payment-and-bill` (linked directly from the Detail Drawer) to preserve invoice balance integrity.

---

## 5. Commission Accrual Integration & Owner Allocation Exclusion

- Phase 9 Commission posting writes deterministic 13-field `bookkeepingEntries/{bk_commission_{batchId}_staff|operator}` records with `entryType: 'expense_accrual'` and `settlementStatus: 'unpaid'`.
- Pembukuan reads `bookkeepingEntries` directly and **never** adds `commissionBatches` totals on top of its linked bookkeeping entries.
- **Unpaid Accrual Rule:** Newly posted commissions increase **Expense Accrued** and **Outstanding Payables**, while contributing `Rp 0` to **Total Operating Cash Out** until paid via `Settle Payment`.
- **Owner Allocation Exclusion:** `owner_allocation` is reference-only inside `commissionBatches` / `commissionPostingItems` and is explicitly filtered out from payables, expenses, and settlement targets.
- Existing 13-field legacy Commission entries are normalized lazily (`amountSettled: 0`, `remainingAmount: amount`, `version: 1`) without requiring any backfill migration.

---

## 6. Settlement Architecture (Partial & Full)

Implemented in `src/features/admin/bookkeeping/services/bookkeeping-settlement-service.js` (`settleBookkeepingEntry()`):

1. Pre-generates a stable `settlementId` (`operationId`) before submission.
2. Executes inside a single Firestore `runTransaction` with **all reads before writes** (`getBookkeepingEntry`, `getBookkeepingSettlement`).
3. Enforces optimistic concurrency (`expectedVersion === existingEntry.version`) and strict non-overpayment (`0 < amount <= existingEntry.remainingAmount`).
4. Appends an immutable `bookkeepingSettlements/{settlementId}` (14 fields) and atomically updates the payable aggregate (`amountSettled`, `remainingAmount`, `settlementStatus`, `lastSettlementId`, `lastSettledAt`, `updatedAt`, `updatedByUid`, `version + 1`).
5. **Derived Statuses Only:** `unpaid` (`amountSettled === 0`), `partially_paid` (`0 < amountSettled < amount`), `paid` (`amountSettled === amount`). Original accrual `amount` is never overwritten.

---

## 7. Manual Income, Manual Expense & Owner Reversal

Implemented in `src/features/admin/bookkeeping/services/bookkeeping-entry-service.js`:

- **`createManualIncomeEntry()`:** Validates via Zod, creates `entryType: 'income'` with `sourceModule: 'bookkeeping'`, `sourceType: 'manual'`. Never fabricates `invoices` or `paymentTransactions`. Disallows creating manual income as unpaid payable.
- **`createManualExpenseEntry()`:** Supports `Paid` and `Unpaid`:
  - **Paid (`paidOnCreate: true`):** Atomically creates both `bookkeepingEntries` (`settlementStatus: 'paid'`, `amountSettled: amount`, `remainingAmount: 0`) AND `bookkeepingSettlements` inside one transaction. Unified Ledger displays one `manual_expense` cash row (avoiding visual duplicate clutter), while `Expense Accrued` sums `bookkeepingEntries` once and `Cash Out` sums `bookkeepingSettlements` once.
  - **Unpaid (`paidOnCreate: false`):** Creates only `bookkeepingEntries` (`settlementStatus: 'unpaid'`, `amountSettled: 0`, `remainingAmount: amount`) with zero settlement; appears in Outstanding Payables until later settled.
- **`reverseBookkeepingEntry()`:** Owner-only correction for unsettled manual entries (`sourceModule === 'bookkeeping' && sourceType === 'manual'` with zero settlements). Preserves original entry (`settlementStatus: 'reversed'`) and appends immutable `bookkeepingEntries/bk_rev_{entryId}` with mandatory audit `reason` (`>= 3` chars). Refuses modifying Commission entries or already-settled manual expenses (no fabricated physical refunds).

---

## 8. Cash Movement Calculations

- **Cash In (Period):** `Customer Cash Received (Net)` + `Active Manual Income`.
- **Cash Out (Period):** `SUM(bookkeepingSettlements.amount)` where `settlementType === 'expense_payment'` and `paidAt` falls in `[startMs, endMs]`. Excludes unpaid accruals cleanly.
- **Net Cash Movement (Period):** `Cash In - Cash Out` (explicitly labeled as period cash flow movement, **not** accounting net profit).
- **Optional Opening Balance:** Owners can optionally configure `openingCashBalance` in `bookkeepingSettings/default` (`Cash Summary -> Saldo Awal`). When unset, UI displays **`Net Cash Movement for Selected Period`** without fabricating a bank/cash drawer balance.

---

## 9. Outstanding Receivable & Payable Calculations

Both metrics represent **current point-in-time balances across all open records**, kept visually separate from period activity totals:

- **Customer Outstanding Receivable:** `SUM(inv.balanceDue)` across all `invoices` where `invoiceStatus === 'issued'` (backed by bounded active unpaid invoice query `where('paymentStatus', 'in', ['unpaid', 'partial'])` deduplicated against latest invoices).
- **Outstanding Payables:** `SUM(entry.remainingAmount)` across all active non-reversed `expense_accrual` entries in `bookkeepingEntries` where `settlementStatus in ['unpaid', 'partially_paid']`.

---

## 10. Data Model Summary

1. **`bookkeepingEntries/{entryId}`**
   - Commission Accrual (13 legacy fields untouched at create; extended with settlement aggregate fields upon first settlement).
   - Manual Income (16 validated fields).
   - Manual Expense (24 validated fields supporting `paidOnCreate`, `dueDate`, and settlement aggregates).
   - Manual Compensating Reversal (`bk_rev_{entryId}`, 16 validated fields).
2. **`bookkeepingSettlements/{settlementId}` (14 fields, Append-Only)**
   - `entryId`, `sourceModule: 'bookkeeping'`, `sourceType: 'manual' | 'commission_batch'`, `sourceId`, `settlementType: 'expense_payment'`, `amount`, `currency: 'IDR'`, `paymentMethod`, `paidAt`, `referenceNumber`, `notes`, `operationId`, `createdAt`, `createdByUid`.
3. **`bookkeepingSettings/default` (5 fields, Owner-Only)**
   - `openingCashBalance` (`int | null`), `openingBalanceAsOf` (`YYYY-MM-DD | null`), `openingBalanceNote`, `updatedAt`, `updatedByUid`.

---

## 11. Security Rules (`firestore.rules`)

Verified live against the Firebase Firestore Emulator (`22/22` checks passed):

- `isActiveOwner()` required for **all** `read` and write operations on `bookkeepingEntries`, `bookkeepingSettlements`, and `bookkeepingSettings` (Staff, inactive accounts, and anonymous users are strictly denied).
- `bookkeepingSettlements` is strictly append-only (`allow update, delete: if false`).
- `bookkeepingEntries` prohibits permanent delete (`allow delete: if false`) and restricts updates strictly to:
  1. Settlement aggregate progression verified atomically via `existsAfter` / `getAfter` against the newly created `bookkeepingSettlements/{lastSettlementId}` document (preventing overpayment and negative balances, supporting legacy 13-field commission entries via `.get(..., 0)` defaults).
  2. One-time manual entry reversal linking to `bk_rev_{entryId}`, blocking settled manual expenses and blocking any alteration of Commission batch accruals.
- Commission posting rule (`isValidCommissionBookkeepingEntryCreate`) and all existing modules (`bookings`, `customers`, `invoices`, `paymentTransactions`, `commissionBatches`, `commissionPostingItems`, `commissionReviewResolutions`, `inventoryItems`, `inventoryMovements`) remain intact.

---

## 12. Idempotency & Concurrency

- Dialogs (`BookkeepingEntryDialog`, `BookkeepingSettlementDialog`) generate stable `entryId` and `settlementId` operation IDs once on mount via `useState(() => generateOperationId(...))` + parent `key` prop — zero random ID generation inside transaction retry callbacks.
- Duplicate retries detecting the committed document with matching target ID return `{ idempotentReplay: true }` without double-writing or double-counting.
- Concurrent settlement requests serialize via Firestore optimistic locking (`expectedVersion`), preventing race-condition overpayment or negative remaining balances.

---

## 13. Bounded Pagination & Single-Field Index Strategy

All Firestore queries rely exclusively on single-field indexes (zero custom `firestore.indexes.json` entries required):

- `bookkeepingEntries`: `orderBy('occurredAt', 'desc'), limit(maxLimit + 1)` (`PAGE_SIZE = 100`)
- Active payables: `where('settlementStatus', 'in', ['unpaid', 'partially_paid']), limit(201)`
- `bookkeepingSettlements`: `orderBy('paidAt', 'desc'), limit(maxLimit + 1)` (`PAGE_SIZE = 100`)
- Entry detail settlement history: `where('entryId', '==', entryId), limit(100)`
- Outstanding invoices supplement: `invoices` `where('paymentStatus', 'in', ['unpaid', 'partial']), limit(201)`
- Recent invoices & payments: reused bounded `subscribeInvoices` and `subscribePaymentTransactions` (`PAGE_SIZE = 150`).

---

## 14. Reporting Period Logic (`Asia/Jakarta`) & Exports

- `src/features/admin/bookkeeping/utils/bookkeeping-period.js` computes exact `Asia/Jakarta` (`+07:00`) period bounds via `date-fns` and `@date-fns/tz` (`This Month`, `Last Month`, `This Year`, `Custom Range`).
- Category distribution uses modular ECharts 6 (`echarts/core` + `BarChart` + `SVGRenderer`) grounded strictly in actual expense accrual records, showing `AdminEmptyState` when empty.
- Four RFC-4180 CSV exports (`Transaction Ledger`, `Cash Movement`, `Outstanding Payables`, `Period Report`) emit unformatted integer Rupiah values in numeric columns alongside Indonesian and ISO dates, reflecting active table filters.

---

## 15. Known Limitations

- Updated `firestore.rules` has been verified on the local Firestore Emulator only and **not** deployed to production Firebase (`studio37classic`).
- Settled manual expenses (`amountSettled > 0`) cannot be automatically reversed in v1 to preserve cash audit integrity without fabricating physical cash refunds.
- Customer payment reversals remain managed exclusively inside Payment & Bill (`/admin/payment-and-bill`).
- Initial release assumes bounded operational volume within paginated single-field queries (`100–200` recent records per page with `Load More` expansion).

---

## 16. Explicit Non-Accounting Scope

Out of scope by design:

- Full double-entry debit/credit general ledger, trial balance, balance sheet, or formal accrual P&L statements.
- Tax / VAT / PPN calculation or payroll disbursement automation.
- Bank API integration, bank statement reconciliation, online payment gateway webhooks, PO/procurement workflows, inventory valuation, asset depreciation, PDF export, or multi-currency accounting.
