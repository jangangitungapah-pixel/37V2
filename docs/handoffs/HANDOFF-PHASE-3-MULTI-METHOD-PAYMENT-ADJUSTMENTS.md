# PHASE 3 HANDOFF — MULTI-METHOD PAYMENT, STAFF CASH & PRICE ADJUSTMENTS

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Phase:** `3` — Multi-Method Payment, Staff Cash & Price Adjustments  
**Branch:** `feature/phase-3-multi-method-payments-staff-cash-adjustments`  
**Base Accepted Phase 2 SHA:** `d9125b9446b53871f062f2f0d5b37ab6db73b1b3` (`feature/phase-2-offer-revisions-deposit-hold-engine`)  
**Handoff Status:** **READY FOR OWNER REVIEW** (local implementation & verification complete; Owner acceptance pending; production deployment NOT authorized and NOT performed)  
**Runtime Baseline Used:** Node `v26.13.0`, npm `11.20.0` (matches `package.json` `>=26.0.0`)

---

## 1. Executive Summary

Phase 3 delivers the complete domain engine, transactional persistence, security rules, Admin & Client Portal UI, Factory Reset coverage, and automated verification for:

1. **Multi-Method Payments & Staff Studio Desk Cash (`AD-03`, `OD-06`):**
   - Independent, immutable per-transaction `paymentMethod` (`cash`, `transfer`, `qris`, `other`) supporting multiple installments/methods against a single invoice.
   - Added `PAYMENT_SOURCE.STAFF_CASH_DESK = 'staff_cash_desk'` and `recordStaffCashPayment()` (`src/features/admin/payment/services/payment-service.js`), allowing Staff/Owner to record Studio Desk Cash payments even on Client Portal invoices flagged `clientPaymentEvidenceRequired === true` while preserving strict fail-closed rejection (`payment/client-evidence-required`) for non-cash manual bypasses.
   - Enforced atomically in `firestore.rules` (`isValidPaymentTxPolicyAfter`) and surfaced in Admin UI (`RecordPaymentDialog.jsx`, `InvoiceDetailDrawer.jsx`, `InvoiceDirectoryTable.jsx`, `AdminPaymentAndBillPage.jsx`).

2. **Client Payment Evidence Rules, Multi-Pending & URL Harmonization (`OD-05`):**
   - Excluded `'cash'` specifically on new Client Portal `paymentEvidence` submissions across `CLIENT_PORTAL_PAYMENT_METHODS` (`['transfer', 'qris', 'other']`), `clientEvidenceSubmissionInputSchema`, `submitClientPaymentEvidence()`, `ClientPaymentEvidenceForm.jsx`, and `isValidClientEvidenceCreate` in `firestore.rules` — while preserving `'cash'` on historical records and optional `admin_manual` Studio cash attachments.
   - Harmonized `PAYMENT_EVIDENCE_FIELD_LIMITS.secureUrlMax = 500` on new uploads (`payment-evidence-config.js`) with `firestore.rules` (`isValidPaymentEvidenceAsset`), while retaining `PAYMENT_EVIDENCE_LEGACY_SECURE_URL_MAX = 600` in read/preview helpers (`normalizePaymentEvidenceAsset`, `PaymentEvidencePreview.jsx`).
   - Removed the single-pending UI lockout in `ClientPaymentEvidencePanel.jsx`: Clients can submit multiple concurrent proofs (e.g., installments or split digital methods) up to `PAYMENT_EVIDENCE_MAX_PENDING_PER_INVOICE = 50`, with pending claimed totals, over-balance warnings, and duplicate asset/reference alerts across Client & Admin review UIs (`ClientPaymentEvidencePanel.jsx`, `ClientPaymentEvidenceForm.jsx`, `PaymentEvidenceReviewDrawer.jsx`).

3. **Append-Only Price Adjustment Subcollection Engine (`AD-06`, `OD-11`):**
   - Implemented `invoices/{invoiceId}/adjustments/{adjustmentId}` (`adj_{24hex}`, exact 13 contract keys; fixed `BOOKING-LIFECYCLE-DATA-CONTRACTS.md` label `12 -> 13` keys) with strictly append-only Firestore Rules (`allow update: if false`, delete only during active Factory Reset).
   - Added `src/features/admin/payment/services/adjustment-service.js` (`applyInvoiceAdjustmentInTransaction`, `createInvoiceAdjustment`) keeping `financialSnapshot` and `minimumDepositAmount` immutable while atomically maintaining `adjustmentTotal`, `effectiveTotalAmount >= 0`, `balanceDue`, `overpaidCreditBalance`, `paymentStatus` (including `'overpaid_credit_pending'` and reversal recovery), `lastAdjustmentId`, `adjustmentCount`, and `clientReservations` synchronization.
   - Added Admin `InvoiceAdjustmentDialog.jsx`, Admin & Client adjustment timelines (`InvoiceDetailDrawer.jsx`, `ClientInvoiceDetailDrawer.jsx` stripping `approvedByUid`/`createdByUid`), printables/WhatsApp formatting (`InvoicePrintable.jsx`, `ClientInvoicePrintable.jsx`, `invoice-format.js`), Client billing cards/lists (`ClientInvoiceCard.jsx`, `ClientInvoiceList.jsx`), `CustomerDetailDrawer.jsx`, and `calculateBookkeepingMetrics()` (`effectiveTotalAmount`).

4. **Calendar `applyUpdatedPricing` Closure (`DISC-07`), Rules Fixes & Factory Reset Coverage:**
   - Updated `updateOrRescheduleBooking()` and `BookingFormDialog.jsx` so scope/duration price changes on an issued invoice atomically record an `/adjustments` document requiring a non-empty `pricingAdjustmentReason` (`3..300` chars) and preserving `financialSnapshot`, instead of overwriting invoice totals directly (`booking/invoice-not-issued-for-adjustment`, `booking/adjustment-reason-required`).
   - Added `isValidInvoiceDraftIssueUpdate` (`draft -> issued`) in `firestore.rules` + `issueDraftInvoice()` in `invoice-service.js`.
   - Updated `reviewInvitations.update` and `customerReviews.create` in `firestore.rules` to `(request.auth == null || isActiveClient())` so signed-in active Clients can submit post-session reviews.
   - Optimized `invoices.update` rules (`isValidInvoiceMutableUpdateBase` + factored lifecycle/immutable checks) to stay well within Firestore's 1,000-expression evaluation budget (`firestore.rules` file size: `241,463 bytes < 262,144 bytes`).
   - Extended Factory Reset v1 (`factory-reset-config.js`, `factory-reset-repository.js`, `factory-reset-service.js`, `FactoryResetResult.jsx`, `factory-reset.test.jsx`) to `29` manifest targets with `invoices_adjustments` (`order: 9.5`) deleted cleanly before parent `invoices`.

---

## 2. Modified & Added Files

### Added Files
- `docs/handoffs/PHASE-2-OWNER-ACCEPTANCE-RECORD.md`
- `docs/architecture/PHASE-3-MULTI-METHOD-PAYMENT-ADJUSTMENT-IMPLEMENTATION.md`
- `docs/handoffs/HANDOFF-PHASE-3-MULTI-METHOD-PAYMENT-ADJUSTMENTS.md`
- `scripts/run-phase-3-gate-diagnostics.mjs`
- `src/features/admin/payment/services/adjustment-service.js`
- `src/features/admin/payment/components/InvoiceAdjustmentDialog.jsx`
- `src/features/admin/payment/phase3-payment-adjustments.test.jsx`

### Modified Files
- **Rules & Verification Infrastructure:** `firestore.rules`, `package.json`, `scripts/test-firestore-rules.mjs`
- **Documentation:** `docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md`, `docs/handoffs/HANDOFF-PHASE-2-OFFER-REVISIONS-DEPOSIT-HOLD-ENGINE.md`, `docs/project/37V2-PROJECT-CONTEXT.md`
- **Admin Payment & Adjustments:** `src/features/admin/payment/utils/invoice-status.js`, `payment-calculation.js`, `invoice-format.js`, `src/features/admin/payment/schemas/payment-schema.js`, `src/features/admin/payment/repositories/payment-repository.js`, `src/features/admin/payment/hooks/useInvoiceDetail.js`, `src/features/admin/payment/services/payment-service.js`, `invoice-service.js`, `src/features/admin/payment/components/RecordPaymentDialog.jsx`, `InvoiceDetailDrawer.jsx`, `InvoiceDirectoryTable.jsx`, `InvoicePrintable.jsx`, `PaymentEvidenceReviewDrawer.jsx`, `src/features/admin/payment/pages/AdminPaymentAndBillPage.jsx`
- **Payment Evidence:** `src/features/payment-evidence/config/payment-evidence-config.js`, `schemas/payment-evidence-schema.js`, `services/payment-evidence-service.js`, `utils/payment-evidence-utils.js`, `components/PaymentEvidencePreview.jsx`, `payment-evidence.test.jsx`
- **Client Portal Billing:** `src/features/client-portal/billing/components/ClientPaymentEvidenceForm.jsx`, `ClientPaymentEvidencePanel.jsx`, `ClientInvoiceCard.jsx`, `ClientInvoiceList.jsx`, `ClientInvoiceDetailDrawer.jsx`, `ClientInvoicePrintable.jsx`, `src/features/client-portal/billing/hooks/useClientInvoiceDetail.js`, `repositories/client-billing-repository.js`, `utils/client-billing-utils.js`
- **Calendar, Bookkeeping, Customer & Factory Reset:** `src/features/admin/calendar/components/BookingFormDialog.jsx`, `repositories/calendar-booking-repository.js`, `services/calendar-booking-service.js`, `src/features/admin/bookkeeping/utils/bookkeeping-calculation.js`, `src/features/admin/customer/components/CustomerDetailDrawer.jsx`, `src/features/admin/settings/danger-area/config/factory-reset-config.js`, `repositories/factory-reset-repository.js`, `services/factory-reset-service.js`, `components/FactoryResetResult.jsx`, `factory-reset.test.jsx`

---

## 3. Verification Results (Observed Locally)

All checks ran locally after final code, rules, and test edits (`git diff --check`: `exit=0`):

1. **`npm run verify:phase1` — PASS (`4/4` stages)**
   - **ESLint (`npm run lint`):** `PASS` (`0` errors)
   - **Vitest (`npm run test:run`):** `PASS` (`32/32` test files, `270/270` tests passed, `35.67s`)
   - **Real Firestore Security Rules Emulator (`npm run test:rules:diagnostics`):** `PASS` (`ALL FIRESTORE SECURITY RULES TESTS PASSED (REAL EMULATOR)!`, log `logs/firestore-rules/rules-diagnostics-2026-11-28T07-13-22-950Z.txt`)
   - **Production Build (`npm run build`):** `PASS` (`4277` modules transformed; known Vite large-chunk warning preserved)
   - **Gate Log:** `logs/phase1/phase1-gates-2026-11-28T07-12-24-948Z.txt`

2. **`npm run verify:phase2` — PASS (`4/4` stages)**
   - **ESLint (`npm run lint`):** `PASS` (`0` errors)
   - **Vitest (`npm run test:run`):** `PASS` (`32/32` test files, `270/270` tests passed, `31.58s`)
   - **Real Firestore Security Rules Emulator (`npm run test:rules:diagnostics`):** `PASS` (`ALL FIRESTORE SECURITY RULES TESTS PASSED (REAL EMULATOR)!`, log `logs/firestore-rules/rules-diagnostics-2026-11-28T07-14-58-440Z.txt`)
   - **Production Build (`npm run build`):** `PASS` (`4277` modules transformed)
   - **Gate Log:** `logs/phase2/phase2-gates-2026-11-28T07-13-55-356Z.txt`

3. **`npm run verify:phase3` — PASS (`4/4` stages)**
   - **ESLint (`npm run lint`):** `PASS` (`0` errors)
   - **Vitest (`npm run test:run`):** `PASS` (`32/32` test files, `270/270` tests passed, `37.91s`)
   - **Real Firestore Security Rules Emulator (`npm run test:rules:diagnostics`):** `PASS` (all regression + Phase 3 checks: Staff Cash Desk on Portal invoices, manual non-cash block, Client cash block, 500-char URL cap, multi-pending + 50 lock cap, `/adjustments` subcollection atomicity/immutability/Client read/negative total denial, `draft -> issued`, active Client review submission, Factory Reset delete of `/adjustments`; log `logs/firestore-rules/rules-diagnostics-2026-11-28T07-16-37-056Z.txt`)
   - **Production Build (`npm run build`):** `PASS` (`4277` modules transformed, `12.13s`; known large-chunk warning preserved)
   - **Gate Log:** `logs/phase3/phase3-gates-2026-11-28T07-15-29-844Z.txt`

4. **`firestore.rules` Size Check:** `241,463 bytes` (under Firebase `262,144` bytes / 256 KB cap).

---

## 4. Non-Executed / Out-of-Scope Actions & Owner Next Step

- **NOT EXECUTED (by Phase 3 boundary):**
  - No `firebase deploy` (Rules, Indexes, or Hosting).
  - No production `clientReservations` migration/backfill.
  - No Factory Reset execution against live data.
  - No merge into `main`, no PR opened, and no Phase 4 or Phase 5 code written.
- **Recommended Owner Action:** Review the Phase 3 diff, test coverage, and gate logs on branch `feature/phase-3-multi-method-payments-staff-cash-adjustments`; confirm acceptance before authorizing Phase 4 or any staging/production deployment prerequisites.
