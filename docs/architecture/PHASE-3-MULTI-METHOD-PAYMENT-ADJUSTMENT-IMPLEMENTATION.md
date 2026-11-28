# Phase 3 — Multi-Method Payment, Staff Cash & Price Adjustments Implementation

**Project:** 37 Music Studio (`37V2`)
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`
**Branch:** `feature/phase-3-multi-method-payments-staff-cash-adjustments`
**Base Accepted Phase 2 Commit:** `d9125b9446b53871f062f2f0d5b37ab6db73b1b3` (`feat(phase2): implement Owner ADR Option A for deposit_hold_offer end-to-end`)
**Target Environment Mode:** Local development, automated tests, Emulator Rules verification, and documentation only (no Firebase production deployment or live backfill performed)

---

## 1. Multi-Method Payments & Staff Studio Desk Cash (`AD-03`, `OD-06`)

- **Immutable Per-Transaction `paymentMethod`:** Every payment transaction in `paymentTransactions/{transactionId}` (`cash | transfer | qris | other`) remains independent and append-only; multiple partial payments across mixed methods accumulate safely onto one invoice (`amountPaid`, `balanceDue`, `paymentStatus`, `clientReservations`).
- **Staff Cash Desk Authority (`PAYMENT_SOURCE.STAFF_CASH_DESK`):**
  - Added `PAYMENT_SOURCE.STAFF_CASH_DESK = 'staff_cash_desk'` in `src/features/admin/payment/utils/invoice-status.js`.
  - Added `recordStaffCashPayment()` in `src/features/admin/payment/services/payment-service.js` and updated `applyValidatedPaymentInTransaction()` so Staff/Owner can record direct studio-desk Cash payments (`source: 'staff_cash_desk'`, `paymentMethod: 'cash'`) even on invoices flagged `clientPaymentEvidenceRequired: true`.
  - Generic non-cash manual recording (`manual` or non-cash methods) on Client Portal invoices remains fail-closed (`payment/client-evidence-required`), enforced identically in `firestore.rules` (`isValidPaymentTxPolicyAfter`).
- **Admin UI:** `RecordPaymentDialog.jsx`, `InvoiceDetailDrawer.jsx`, `InvoiceDirectoryTable.jsx`, and `AdminPaymentAndBillPage.jsx` enable Studio Desk Cash directly on Client Portal invoices while locking Transfer/QRIS/Other to verified Client Portal evidence uploads.

## 2. Client Payment Evidence Rules, Multi-Pending & URL Limit Harmonization (`OD-05`)

- **Cash Exclusion for Client Submissions:** Removed `'cash'` from `CLIENT_PORTAL_PAYMENT_METHODS` (`['transfer', 'qris', 'other']`) across `payment-evidence-config.js`, `clientEvidenceSubmissionInputSchema`, `submitClientPaymentEvidence()` (`payment-evidence/cash-not-allowed`), `ClientPaymentEvidenceForm.jsx`, and `firestore.rules` (`isValidClientEvidenceCreate`), while keeping historical records and optional `admin_manual` Studio cash attachments valid.
- **Secure URL Limit Synchronization:** Harmonized `PAYMENT_EVIDENCE_FIELD_LIMITS.secureUrlMax = 500` on new uploads (`payment-evidence-config.js` matching `firestore.rules`), while retaining `PAYMENT_EVIDENCE_LEGACY_SECURE_URL_MAX = 600` in read/preview helpers (`normalizePaymentEvidenceAsset`, `PaymentEvidencePreview.jsx`) so historical 501–600 char records remain readable.
- **Multi-Pending Client Flow (`OD-05`, Cap `<= 50`):**
  - Removed the single-pending UI lockout in `ClientPaymentEvidencePanel.jsx`; Clients can upload multiple concurrent receipts (e.g., installments or mixed digital methods) up to `PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE = 50` (`payment-evidence/pending-limit-reached` on overflow).
  - Added multi-pending claimed totals, over-balance warnings, and duplicate asset/reference alerts in `ClientPaymentEvidencePanel.jsx`, `ClientPaymentEvidenceForm.jsx`, and `PaymentEvidenceReviewDrawer.jsx`, alongside atomic invoice `balanceDue` / overpayment guards.

## 3. Append-Only Price Adjustment Subcollection Engine (`AD-06`, `OD-11`)

- **Schema & Categories:** Added `invoices/{invoiceId}/adjustments/{adjustmentId}` (`adj_{24hex}`, 13 contract keys, immutable `allow update: if false`, categories: `duration_change`, `room_change`, `service_change`, `scope_addendum`, `discount_credit`, `cancellation_fee`, `manual_correction`) and fixed the Data Contract key-count label (`12 -> 13`).
- **Atomic Adjustment Service (`src/features/admin/payment/services/adjustment-service.js`):**
  - `applyInvoiceAdjustmentInTransaction` and `createInvoiceAdjustment` keep `financialSnapshot` and `minimumDepositAmount` completely immutable while atomically writing `/adjustments/{adjustmentId}`, updating parent invoice aggregates (`adjustmentTotal`, `effectiveTotalAmount >= 0`, `balanceDue`, `overpaidCreditBalance`, `paymentStatus`, `lastAdjustmentId`, `adjustmentCount`), and syncing `clientReservations`.
  - Downward adjustments causing verified payments (`netPaid`) to exceed `effectiveTotalAmount` transition `paymentStatus` cleanly to `'overpaid_credit_pending'` (`overpaidCreditBalance = netPaid - effectiveTotalAmount`) without deleting or rewriting past ledger transactions.
- **UI & Projections:** Added `InvoiceAdjustmentDialog.jsx`, Admin & Client Adjustment timelines (`InvoiceDetailDrawer.jsx`, `ClientInvoiceDetailDrawer.jsx` stripping `approvedByUid`/`createdByUid`), updated `InvoicePrintable.jsx`, `ClientInvoicePrintable.jsx`, `invoice-format.js`, `ClientInvoiceCard.jsx`, `ClientInvoiceList.jsx`, `CustomerDetailDrawer.jsx`, and `calculateBookkeepingMetrics()` (`effectiveTotalAmount`).

## 4. Calendar `applyUpdatedPricing` Closure, Rules Fixes & Factory Reset (`DISC-07`)

- **Calendar Scope/Duration Pricing Closure:** `updateOrRescheduleBooking()` and `BookingFormDialog.jsx` no longer mutate booking totals silently out of sync with invoices; when `applyUpdatedPricing` changes `totalAmount` on an issued invoice, Staff must provide `pricingAdjustmentReason` (`3..300` chars) and the transaction atomically commits an `/adjustments` entry via `applyInvoiceAdjustmentInTransaction`. Unissued (`draft`/`void`) or missing-reason updates fail closed (`booking/invoice-not-issued-for-adjustment`, `booking/adjustment-reason-required`).
- **Security Rules Fixes (`firestore.rules`):**
  - Added `isValidInvoiceDraftIssueUpdate` (`draft -> issued`), added `issueDraftInvoice()` in `invoice-service.js`, and relaxed `reviewInvitations.update` & `customerReviews.create` to `(request.auth == null || isActiveClient())` so logged-in Clients can submit post-session reviews.
- **Factory Reset v1 Extended (`29` Targets):** Added `invoices_adjustments` (`order: 9.5`) before parent `invoices`, generalized In-Memory subcollection handling in `factory-reset-repository.js`, enforced empty `adjustments` verification before parent `invoices` deletion in `factory-reset-service.js`, and updated `FactoryResetResult.jsx` & `factory-reset.test.jsx`.
