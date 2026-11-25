# BOOKING LIFECYCLE & RESERVATION ENGINE MIGRATION & COMPATIBILITY PLAN (PHASE 0 ARCHITECTURE FREEZE)

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Target Branch:** `main`  
**Audited Baseline HEAD SHA:** `6ef8f0cab8f66a439309deb9b2a63488695a615a`  
**Phase:** Phase 0 — Architecture Freeze (Migration Blueprint Only — No Migrations Executed)  
**Date:** 25 November 2026  

---

## 1. Compatibility Contract & Zero-Fabricated-History Principle (`FR-12`)

Every existing production record created prior to Phase 1+ rollout **MUST remain readable, financially accurate, and operationally functional without fabricating historical intent**.

Specifically:
- **NEVER retroactively stamp `deposit_hold` on legacy `bookings`!** Historical Studio bookings created under Schema V1 were created immediately as confirmed calendar commitments without an agreed `holdExpiresAt` or `depositPolicySnapshot`. Treating them retroactively as unpaid `deposit_hold` would wrongly block check-in or misclassify valid historical unpaid/walk-in bookings.
- **NEVER erase or rewrite historical `invoices.financialSnapshot`, `paymentTransactions`, or `paymentEvidence`**, including historical `client_portal` proofs whose `paymentMethod` happened to be `'cash'` prior to blocking `'cash'` in Phase 3+.

---

## 2. Legacy Data Interpretation & Normalization Matrix (All 8 Baseline Record Sets + Client Auth)

| Legacy Entity | Existing Baseline on `main` (`6ef8f0c`) | Read-Time Normalization Rule (No Destructive Write Needed) | Transitional & Backfill Treatment |
|---|---|---|---|
| **1. `bookings/{bookingId}`** | Schema V1 (`schemaVersion` absent / `1`), no `reservationStatus`, no `depositPolicySnapshot`, no `clientUid`, `sessionStatus in ['upcoming','in_progress','completed','no_show','cancelled']` (may have `initialPaidAmount == 0`). | • `schemaVersion` defaults to `1`<br>• `reservationStatus` derived read-time as `'cancelled'` iff `sessionStatus === 'cancelled'`, otherwise **`'confirmed'`** (`confirmationSource: 'legacy_confirmed'`)<br>• `depositPolicySnapshot` = `null` (`minimumDepositAmount: 0` unless an explicit policy existed)<br>• `clientUid` = `''` unless backfilled via customer link | Never blocks check-in on legacy `'upcoming'` bookings (`bookingCount`, `Commission`, `CustomerReviews` remain 100% intact). Optional Staff/Owner linking updates `clientUid` + creates `clientReservations/{bookingId}` projection cleanly. |
| **2. `bookingSlots/{slotId}` & `publicAvailability/{id}`** | 30-min `{date}__{studioId}__{slotStartMinute}`, supports `HH:30` bookings (`startMinute % 30 == 0`). | Unchanged! Exact same ID format and 30-min grid consumed natively by both V1 and V2 transactions. | Verify parity during Phase 1+: ensure any V1 `no_show` bookings with lingering `bookingSlots` (discovered rule gap on `main`) have slots cleaned properly. |
| **3. `invoices/{invoiceId}`** | 20-key legacy or 21-key with `clientPaymentEvidenceRequired` (`bool`), no `adjustmentTotal`, `refundedTotal`, `depositStatus`, `targetType`, `clientUid`. | • `targetType` defaults `'booking'`<br>• `adjustmentTotal: 0`, `refundedTotal: 0`, `creditConvertedTotal: 0`<br>• `effectiveTotalAmount = financialSnapshot.totalAmount`<br>• `depositStatus`: `'not_required'` (historical V1 had no deposit gate unless explicit policy snapshot exists)<br>• `clientPaymentPolicy`: `{ origin: clientPaymentEvidenceRequired ? 'client_portal' : 'legacy', requireEvidenceForClientNonCash: clientPaymentEvidenceRequired, allowStaffCashDirect: true }` | Unlocks **Staff Desk Cash (`staff_cash_desk`)** on existing unpaid Client Portal invoices immediately once Phase 3 ships, while preserving `financialSnapshot` & `amountPaid` reconciliation (`SUM(payment) - SUM(reversal)`). |
| **4. `paymentTransactions/{txId}`** | 15 keys, `source` in `['booking_initial_payment','manual','legacy_initial_snapshot','client_evidence_verified','reversal']`. | Append-only immutable! Normalize read-time: `targetType: 'booking'`, `evidenceId` inferred `'ev_...'` when `id` starts `'pay_evidence_'`, `clientUid: ''`. | Zero mutation of historical transactions! New methods use exact same ledger table. |
| **5. `paymentEvidence/{evId}`** | 23 keys; historical client submissions might contain `paymentMethod: 'cash'` (`DISC-01`) or `secureUrl` 501–600 chars (`payment-evidence-config.js` drift). | Read & verify existing `pending_review` docs cleanly via normalized contract (even if submitted pre-cutover with legacy field values), while **NEW** `client_portal` submissions strictly forbid `'cash'` and cap URL `<= 500`. | Preserves full history & verification capability across cutover boundary! |
| **6. `bookingEvents/{eventId}`** | 7 keys, append-only (`evt_...`). | Read-only compatible; render unknown/V2 `eventType` values gracefully with fallback label formatter. | New event types (`hold_extended`, `hold_expired`, `change_request_applied`, `refund_recorded`) are strictly additive. |
| **7. Client Portal Records (`clientAccounts`, `clientCustomerLinks`, `clientProfiles`, `customerEmailIndex`)** | Contains both `linked_customer` (`cust_...`) and `isolated_client_profile` (`client_{uid}`) accounts affected by `DISC-05`. | Dual ownership rules/queries accept `resource.data.clientUid == uid \|\| isClientOwnerOfCustomer(resource.data.customerId)`. | Phase 1 provides an audited **Identity Reconciliation Utility** (Owner/Staff confirms pairing of existing `bookings` / `invoices` belonging to `"client_{uid}"` phone/email -> stamps `clientUid` and syncs `clientReservations`!). |
| **8. `publicBookingRequests/{requestId}`** | 33-key public (`studio_booking` & `post_production_inquiry`) & 38-key `client_portal` (`'mixing'`, `'mastering'`, `'rehearsal'`, `'recording'`). | Requests without `activeOfferId` / `linkedProjectId` normalize `activeOfferId: null`, `linkedProjectId: null`. Legacy `post_production_inquiry` records in `new | in_review | awaiting_customer | accepted` become **eligible for Project conversion** (`postProductionProjects`)! | Preserves all `/communications` and `/activities` subcollections; fixes Admin toolbar filter to include `'mixing'` and `'mastering'` (`DISC-09`). |

---

## 3. Phased Implementation & Migration Sequence

**Architecture Rule:** Never ship monolithic all-at-once rewrites. Every phase keeps existing tests green, maintains additive schema compatibility, and produces its own standalone Handoff document.

| Phase | Target Scope & Modules | Preconditions / Dependencies | Migration & Compatibility Actions |
|---|---|---|---|
| **Phase 1 — Core Domain, Identity & Policy Foundation** | • Implement `settings/bookingPolicies` + `publicPricingCatalog/current` v4 deposit preview projection<br>• Add `Asia/Jakarta` `@date-fns/tz` date utilities (`booking-date.js` fix)<br>• Add dual `clientUid` propagation & `clientReservations/{bookingId}` projection (resolving `DISC-05` & `DISC-06`)<br>• Add read-time normalizers across Calendar, Payment & Client Portal<br>• Fix `BookingFormDialog`/`ClientBookingStepSchedule` `formatMinuteRange` bug, `PaymentEvidenceReviewDrawer` notes/version/locale bugs, Dashboard `ownerPayables` + tab query bugs, and `BookingRequestToolbar` filter bug | **Owner approves `OD-01`, `OD-02`, `OD-03`** + confirmation of remaining `OD-04`..`OD-14` as relevant | 1. Compact `firestore.rules` helpers FIRST (freeing AST/expression headroom).<br>2. Deploy additive rules for `settings/bookingPolicies`, `clientReservations`, `clientUid` fields.<br>3. Owner-run chunked backfill (`<= 5` bookings/tx!) populates `clientReservations` for active future bookings + fixes `K <= 5` chunking in `postCommissionBatch` & legacy importers.<br>4. Expand Factory Reset manifest & raise rule limit `25 -> 40`. |
| **Phase 2 — Offer Revisions & Deposit Hold Engine** | • Build `publicBookingRequests/{id}/offers/{offId}` workflow (`quote_only` + `deposit_hold_offer`)<br>• Split `bookings.reservationStatus` (`deposit_hold \| confirmed \| expired \| cancelled`) & `sessionStatus` (`pending_confirmation \| upcoming \| ...`)<br>• Implement Overdue Hold UI banners (`AD-05` manual expiry, zero cron), Hold Extension, Hold Expiry (`expireReservationHold`), & Pending-Evidence Protection (`OD-09`)<br>• Enforce Deposit Confirmation Gate (`OD-01`, `OD-04`, `OD-07`) | Phase 1 deployed & verified (`clientReservations` live) | 1. Update `firestore.rules` with Offer subcollection + `deposit_hold` / `pending_confirmation` rules + session transition guards.<br>2. Add `bookings` composite index `(reservationStatus ASC, holdExpiresAt ASC)` via `firestore.indexes.json`.<br>3. Legacy V1 bookings stay `confirmed` seamlessly via read-time fallback (zero forced rewrite!). |
| **Phase 3 — Multi-Method Payment, Staff Cash & Price Adjustments** | • Remove `'cash'` from `ClientPaymentEvidenceForm`, Zod & `firestore.rules` (`AD-03`)<br>• Unlock Staff Desk Cash (`staff_cash_desk`) on ALL issued invoices (`DISC-02`, `OD-06`)<br>• Implement `OD-05` decision (single-pending lock vs multi-pending w/ duplicate fingerprint warning)<br>• Build `invoices/{id}/adjustments/{adjId}` ledger (`AD-06`) replacing silent `applyUpdatedPricing` overwrites (`DISC-07`)<br>• Fix `draft` invoice rule gap & `customerReviews` logged-in client auth block | Phase 2 live (`OD-05`, `OD-06`, `OD-11` signed off) | 1. Harmonize Cloudinary `secureUrl <= 500` across client/Rules.<br>2. Update `paymentTransactions` & `paymentEvidence` rules.<br>3. Existing invoices normalize `adjustmentTotal: 0` cleanly without batch backfill. |
| **Phase 4 — Client Change Requests & Refund Lifecycle** | • Build `bookingChangeRequests` Client & Admin workflow (`AD-07`) + atomic slot swap + live session extension (`SC-CHG-06`)<br>• Build `refundCases` (`requested -> under_review -> approved -> settled \| converted_to_credit \| rejected`, `AD-04`) strictly separated from `Payment Reversal`<br>• Update Cancellation & Hold Expiry w/ Paid Balance flows to route into `refundCases`<br>• Wire `refundCases` cash outflow & adjustments into Pembukuan KPIs (`OD-12`) | Phase 3 live (`adjustments` & `OD-11`/`OD-12` signed off) | 1. Deploy new rules & indexes for `bookingChangeRequests` and `refundCases`.<br>2. Void unpaid cancelled legacy invoices optionally via Owner audit tool (never touch paid legacy invoices automatically). |
| **Phase 5 — Mix & Master Project Engine** | • Build `postProductionProjects` + `/quotations` + `/activities` (`AD-08`)<br>• Convert existing & new `post_production_inquiry` requests into Projects (`inv_prj_{projectId}` billing, milestones, materials, revision counter, additional scope adjustments)<br>• Zero interaction with `bookings` or `bookingSlots` | Phase 3 Financial Engine live (reuses `invoices`, `paymentTransactions`, `paymentEvidence`, `refundCases`) | 1. Deploy `postProductionProjects` rules & indexes + `invoices` `targetType: 'project'` support.<br>2. Existing open `post_production_inquiry` docs appear ready for `"Convert to Project"` CTA. |

---

## 4. Safe Batched Backfill & Transaction-Limit Prevention Strategy

Because audit `DISC-10` proved Firestore enforces a **hard 20 unique doc-lookup limit per transaction/batch**, ANY Phase 1+ backfill utility executed by Owner MUST obey:
1. **Strict Chunk Cap `<= 5` Bookings / Entities per Batch/Transaction:** Never exceed 5 multi-collection entities in one write batch/transaction (`2` auth/lock base lookups + `3 * 5 = 15` unique doc lookups `= 17 <= 20`). Fix existing `postCommissionBatch()` (`commission-posting-service.js`), `importLegacyBookingHistory()`, and `importLegacyBookingInvoices()` under the same `<= 5` chunking pattern!
2. **Idempotent Cursor & Resumability:** Every backfill record checks target doc existence (`clientReservations/{bookingId}`, `version`) so interrupted Owner runs can safely re-run from scratch or resume cleanly.
3. **Zero Blocking Client Migration:** Public & Client Portal routes NEVER mutate schemas on read (`Zero-write on read`); only Owner Admin utilities or intentional user transactions write new schema fields.

---

## 5. Pre-Migration & Post-Migration Validation Checklists

### 5.1 Pre-Deployment Verification Gate (Per Phase)
- [ ] **Firestore Rules Size & Complexity Check:** Confirm `firestore.rules` remains strictly `< 220 KB` (< 85% of 256 KB limit) and `firebase deploy --only firestore:rules --dry-run` compiles cleanly without AST/503 failure.
- [ ] **Emulator Rules Suite (`npm run test:rules`):** Dedicated security test cases pass for:
  - Client Portal `'cash'` proof rejection (`403`).
  - Staff `staff_cash_desk` success on `client_portal` invoice (`200`).
  - Client blocked from directly editing `bookings`, `bookingSlots`, `invoices`, `clientReservations`.
  - Deposit hold (`deposit_hold` + `pending_confirmation`) blocking `check_in`/`start_session` while blocking conflicting `bookingSlots`.
  - Legacy Schema V1 docs (`20-key` invoice, `v1` booking without `reservationStatus`) continuing to pass all reads, updates, payments, reversals, and commissions.
  - Multi-doc transaction test verifying 6-hour (12-slot) & 13-hour (26-slot) atomic operations remain `< 20` rule doc lookups.
- [ ] **Vitest Integrity Suite (`npm run test:run`):** Client billing, booking wizard, payment, evidence, calendar, commission, bookkeeping, dashboard, factory reset, and customer reviews tests 100% green.
- [ ] **Financial Reconciliation Invariant Check:** Assert across sample/staging fixtures that `invoice.amountPaid == SUM(payment) - SUM(reversal)` and `balanceDue == max(0, effectiveTotalAmount - amountPaid)` with `effectiveTotalAmount >= 0`.

### 5.2 Post-Deployment / Post-Backfill Verification Gate
- [ ] Deploy Firestore indexes (`firebase deploy --only firestore:indexes`) BEFORE deploying UI queries referencing new compound indexes.
- [ ] Run Owner read-only diagnostic check counting legacy V1 vs V2 docs, verifying zero orphaned `bookingSlots`, zero `client_{uid}` broken invoice links, and zero negative `balanceDue`.
- [ ] Verify existing production `bookings` show exact pre-cutover totals and commission/review eligibility untouched.

---

## 6. Rollback & Recovery Strategy

1. **Additive-First Schema Discipline:** Every new field added to `publicBookingRequests`, `bookings`, `invoices`, `paymentTransactions`, and `paymentEvidence` is additive during cutover. Deprecated legacy flags (`clientPaymentEvidenceRequired`) remain populated alongside new structured objects (`clientPaymentPolicy`) through Phase 4 so rolling back frontend JS to the prior Hosting release never crashes on missing fields or breaks Security Rules!
2. **Hosting Rollback:** Keep previous Vite bundle deployable via `firebase hosting:clone` / Git revert of Hosting deploy independently of Firestore Rules if rules remain backward-compatible.
3. **Rule Rollback Safety:** Never tighten/remove legacy Schema V1 read allowances inside `firestore.rules` until 100% of active clients are on the new version and verified cleanly in emulator + dry-run.
4. **Partial Transaction / Network Failure Recovery:** Because every transaction (`TX-01`..`TX-11`) pre-generates deterministic IDs (`bkg_`, `ev_`, `pay_rev_`, `chg_`, `ref_`, `prj_`), failed client retries replay safely without creating duplicate invoices, duplicate slot locks, or double `amountPaid` increments.

---

## 7. Complete Catalog of Future `firestore.rules` & `firestore.indexes.json` Changes (Deferred to Phase 1+)

> **Phase 0 Reminder:** Zero lines of `firestore.rules` or `firestore.indexes.json` were touched in Phase 0. The list below governs future Phase 1–5 security workstreams:

### 7.1 Required Future `firestore.rules` Workstreams
1. **Structural & Budget Refactor (Phase 1 Prerequisite):** Extract shared `isActiveStaff()`, `!isFactoryResetLocked()`, `isValidPaymentEvidenceBase()`, and local `let` bindings (`bookingAfter`, `invAfter`, `txAfter`) so rule additions stay well below 256 KB source size, 1,000 CEL expressions (`bookings.update`), and `:test` AST caps.
2. **`settings/bookingPolicies` & `publicPricingCatalog/current` v4 (Phase 1):** Owner write / Staff get on `bookingPolicies`; allow `depositPreview` keys on `publicPricingCatalog/current`.
3. **Dual Client Ownership & `clientReservations` (Phase 1):** Add `clientUid` to `bookings` & `invoices`; add `isClientOwnerOfDoc(data)` (`data.clientUid == uid || isClientOwnerOfCustomer(data.customerId)`); create `clientReservations/{bookingId}` (`Staff write / Owner Client read`).
4. **Factory Reset Completeness (Phase 1):** Raise target limit `25 -> 40` in `firestore.rules:201,203`; add Client Portal collections + new domain collections to `canFactoryResetDelete()` & manifest.
5. **Booking Requests `/offers` & `bookings` V2 Hold/Session Separation (Phase 2):** Allow Client `offers.update` ONLY on `sent -> accepted | rejected`; allow `reservationStatus` + `sessionStatus` V2 fields on `bookings`; enforce session state graph (`pending_confirmation` cannot `in_progress`, terminal states immutable) and monotonic `version == resData.version + 1` on `isValidBookingStandardUpdate()`; unify `bookingSlots` & `publicAvailability` release rules across `expired`, `cancelled`, and `no_show`.
6. **Payment Cash Enforcement, Adjustments & Invoice Draft Fix (Phase 3):** Reject `'cash'` for `paymentEvidence` `client_portal`; cap `secureUrl.size() <= 500` in JS too; permit `source == 'staff_cash_desk' && paymentMethod == 'cash'` unconditionally on issued invoices; add `invoices/{id}/adjustments/{adjId}` rules; resolve stuck `'draft'` invoice bug; optionally enforce `OD-05` single-pending lock; relax `reviewInvitations.update` & `customerReviews.create` (`request.auth == null || isActiveClient()`).
7. **`bookingChangeRequests` & `refundCases` Rules (Phase 4):** Strictly separate Client create/accept-counter/withdraw from Staff/Owner slot/price mutation (`AD-07`) and refund approval/settlement (`AD-04`).
8. **`postProductionProjects` Rules (Phase 5):** Enforce Client read-only own projects, Client `quotations` accept/reject only, and `invoices` `targetType == 'project'` (`inv_prj_{projectId}`, zero `bookingSlots` dependency).

### 7.2 Required Future `firestore.indexes.json` Composite Indexes
- `bookings`: `(reservationStatus ASC, holdExpiresAt ASC)` — Overdue holds dashboard/calendar list.
- `paymentEvidence`: `(status ASC, submittedAt ASC)` — Verification queue ordering.
- `bookingChangeRequests`: `(status ASC, createdAt DESC)` & `(clientUid ASC, createdAt DESC)`.
- `refundCases`: `(status ASC, createdAt DESC)` & `(clientUid ASC, createdAt DESC)`.
- `postProductionProjects`: `(status ASC, updatedAt DESC)` & `(clientUid ASC, updatedAt DESC)`.
- `clientReservations`: `(clientUid ASC, date DESC)`.
