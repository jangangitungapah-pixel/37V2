# PHASE 9 — COMMISSION & FEE MANAGEMENT ARCHITECTURE

## 37 Music Studio — Session-Based Commission Review & Bookkeeping Posting

**Module Route:** `/admin/commission-and-fee`  
**Firestore Collections Created:** `commissionBatches`, `commissionPostingItems`, `commissionReviewResolutions`, `bookkeepingEntries`  
**Source Collection:** `bookings` (`bookings/{bookingId}.commissionSnapshot`)  
**Core Workflow:** `Completed Sessions → Commission & Fee Review → Owner Approval → Post to Pembukuan`

---

## 1. Core Principles & Financial Boundaries

1. **Completed Studio Sessions Only:** Commission review strictly evaluates bookings with `sessionStatus === 'completed'`, valid `actualCompletedAt`, `deliveryMode === 'studio'`, and service `rehearsal` or `recording`. `upcoming`, `in_progress`, `cancelled`, `no_show`, and `wfa` (Mixing/Mastering) records are excluded.
2. **Completion Date Period Logic (`Asia/Jakarta`):** Active periods (`This Month`, `Last Month`, `Custom Date Range`) filter strictly by `bookings.actualCompletedAt` anchored to `Asia/Jakarta` via `date-fns` and `@date-fns/tz`. A booking created in October and completed in November is counted in November, never October. Bookings without a valid `actualCompletedAt` are not eligible.
3. **Immutable Commission Snapshots as Source of Truth:** Nominal fees always come directly from historical `booking.commissionSnapshot` (supporting both V2 schema and Legacy V1 compatibility). Live changes to `settings/pricing` never recalculate past sessions.
4. **Strict Separation of Payable Fees vs. Owner Allocation:**
   - **Staff Commission (`staff`)** → **Payable** (`Staff / Studio Guard`)
   - **Recording Operator Fee (`recordingOperator`)** → **Payable** (`Recording Operator / External PIC`)
   - **Owner Allocation (`owner`)** → **Reference Only** (stored in batches/items for transparency, explicitly excluded from `Total To Pay` and never generates `bookkeepingEntries` debt)
   - **Formula:** `Total To Pay = Staff Commission + Recording Operator Fee`
5. **Customer Billing Independence:** Commission eligibility is decoupled from invoice payment status. Posting commissions never modifies customer profiles, `invoices`, `paymentTransactions`, or `booking.commissionSnapshot`.
6. **Posting Semantics (Expense Accrual, Not Cash Payout):** Executing `Post to Pembukuan` creates `entryType: 'expense_accrual'` records in `bookkeepingEntries` with `settlementStatus: 'unpaid'`. Actual disbursement/settlement is reserved exclusively for the future Pembukuan phase.

---

## 2. Snapshot Normalization & Needs Review Handling

Implemented in `src/features/admin/commission/utils/commission-snapshot.js`:

- **V2 Snapshots (`schemaVersion: 2`):** Extracts `staff`, `owner`, and `recordingOperator` basis (`none`, `fixed`, `hourly`, `manual`), rates, integer Rupiah amounts, and `settingsVersion`.
- **Legacy V1 Compatibility:** Maps `staffAmount` (using `staffBasis`, `staffRate`) and `recordingOperatorAmount` safely with `owner = 0`.
- **Raw Snapshot Preservation:** `commission-repository.js` preserves raw Firestore `commissionSnapshot` without coercing corrupted/negative values to valid zero records.
- **Needs Review Queue & Explicit Resolution:** Completed studio bookings whose `commissionSnapshot` is `null`, malformed, or negative are routed to a compact collapsible `Needs Review` panel (`CommissionNeedsReviewList.jsx`), displaying booking ID, customer, service, actual completion timestamp, and exact reason, with selection/posting disabled. Silent manual override or recalculation from live Settings is forbidden. Active Owners can explicitly dismiss resolved legacy sessions via `CommissionResolveNeedsReviewDialog.jsx` (`Tandai Selesai`), writing an immutable audit record to `commissionReviewResolutions/{bookingId}` without modifying historical `bookings` or creating fake `bookkeepingEntries`.
- **Zero-Payable Bookings:** Completed sessions with valid snapshots whose `payableTotal === 0` (including Owner-allocation-only records) cannot be posted to Pembukuan (`zero_payable`).

---

## 3. Firestore Data Model & Deterministic Contracts

### A. `commissionBatches/{batchId}` (15 fields, Immutable)

- Period metadata: `periodStart` (`YYYY-MM-DD`), `periodEnd` (`YYYY-MM-DD`), `completionTimeZone` (`'Asia/Jakarta'`), `bookingCount` (`1..100`).
- Totals: `staffCommissionTotal`, `recordingOperatorFeeTotal`, `payableTotal` (`staff + operator`), `ownerAllocationReferenceTotal` (reference only), `currency` (`'IDR'`).
- Status & Audit: `status` (`'posted'`), `bookkeepingEntryIds` (1 or 2 deterministic IDs), `postedAt`, `postedByUid`, `createdAt`, `createdByUid`.
- Large per-booking arrays are never embedded inside batch documents.

### B. `commissionPostingItems/{bookingId}` (15 fields, Deterministic ID = `bookingId`, Immutable)

- Links to `batchId` and `bookingId` (`itemId == bookingId`), guaranteeing at most **one** posting per booking across concurrent Owner sessions.
- Stores immutable `customerSnapshot`, `completedAt` (exact match to `booking.actualCompletedAt`), `serviceSnapshot`, original `commissionSnapshot` (V1 or V2 verbatim), integer payable/reference figures (`staffPayableAmount`, `recordingOperatorPayableAmount`, `ownerAllocationReference`, `payableTotal`), `status: 'posted'`, `postedAt`, `postedByUid`, `createdAt`.

### C. `bookkeepingEntries/{entryId}` (13 fields, Integration Contract for Pembukuan)

- Deterministic IDs:
  - Staff Commission: `bk_commission_{batchId}_staff` (created only when `staffCommissionTotal > 0`)
  - Recording Operator Fee: `bk_commission_{batchId}_operator` (created only when `recordingOperatorFeeTotal > 0`)
- Fields: `sourceModule: 'commission-and-fee'`, `sourceType: 'commission_batch'`, `sourceId: batchId`, `entryType: 'expense_accrual'`, `category` (`'staff_commission' | 'recording_operator_fee'`), `description`, `amount` (int > 0), `currency: 'IDR'`, `settlementStatus: 'unpaid'`, `occurredAt`, `postedAt`, `createdAt`, `createdByUid`.

### Single-Field Index Strategy (Zero Custom Composite Indexes)

- Completed bookings in active period: `where('actualCompletedAt', '>=', startTs)`, `where('actualCompletedAt', '<=', endTs)`, `orderBy('actualCompletedAt', 'asc')`, `limit(pageSize + 1)` with bounded Load More (`More sessions available`).
- Existing posting items check: chunked (`<= 10`) `where('bookingId', 'in', chunk)`.
- Batch history (`Posted` tab): `orderBy('postedAt', 'desc')`, `limit(pageSize + 1)`.
- Batch audit details: `commissionPostingItems` `where('batchId', '==', batchId)` and `bookkeepingEntries` `where('sourceId', '==', batchId)`.

---

## 4. Transactional Integrity, Idempotency & Duplicate Prevention

Implemented in `src/features/admin/commission/services/commission-posting-service.js`:

1. **Pre-Generated Stable `batchId`:** Generated when opening `Confirm Commission Posting` so network retries execute idempotently.
2. **Maximum 100 Bookings per Batch:** Keeps Firestore transactions bounded and deterministic.
3. **All Reads Before Writes:** Atomically reads target `commissionBatches/{batchId}`, candidate `bookkeepingEntries`, every selected `bookings/{bookingId}`, and every `commissionPostingItems/{bookingId}`.
4. **Concurrency & Stale Review Guards:** Rejects if `booking.sessionStatus !== 'completed'`, `booking.version` mismatches `expectedVersion`, `commissionSnapshot` signature changed since review, or any selected `commissionPostingItems/{bookingId}` already exists (`commission/already-posted`).
5. **Atomic Write Phase:** Commits `commissionBatches/{batchId}`, all `commissionPostingItems/{bookingId}`, and non-zero `bookkeepingEntries` in one `runTransaction` or rolls back completely with zero partial posting.

---

## 5. Authorization & Firestore Security Rules (`firestore.rules`)

- **Owner-Only Access (`isActiveOwner()`):** Only active Owner accounts can read or write `commissionBatches`, `commissionPostingItems`, and commission `bookkeepingEntries`.
- **Active Staff Restriction:** On `/admin/commission-and-fee`, Staff accounts see `Owner Access Required` (`Read Only — Owner Approval Required`), fire zero privileged Firestore listeners, and cannot invoke posting services (`commission/owner-only`).
- **Immutability & Cross-Document Validation:**
  - `update` and `delete` strictly denied (`if false;`) across all three collections.
  - Rules verify `postingItems` document ID equals `bookingId`, source booking is `completed` (`studio` Rehearsal/Recording), `completedAt == booking.actualCompletedAt`, `commissionSnapshot == booking.commissionSnapshot`, integer math matches V1/V2 snapshot, `payableTotal == staff + operator` (excluding Owner Allocation), and `bookkeepingEntries` exist via atomic `existsAfter()` / `getAfter()` cross-checks with no wildcard entry loophole.

---

## 6. Known Limitations (Intentionally Out of Scope for Phase 9)

- Recipient names are grouped by role (`Staff / Studio Guard`, `Recording Operator / External PIC`) because booking records do not yet assign individual shift/staff identities (`createdByUid` is never treated as fee recipient).
- Actual cash/bank payout settlement, payroll, P&L/cash-flow reports, WFA job commission lifecycle, and manual fee override workflows belong to future phases (e.g., Pembukuan).
