# HANDOFF — PHASE 0: 37V2 BOOKING LIFECYCLE & RESERVATION ENGINE (ARCHITECTURE FREEZE)

**Document Path:** `docs/handoffs/HANDOFF-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`  
**Intended Audience:** Owner review + next independent Phase 1 implementation session (written to be 100% self-contained without needing access to any prior conversation transcript).  
**Date:** 25 November 2026  

---

## 1. Project & Repository Identity

- **Application:** 37 Music Studio (`37V2`)
- **Repository:** `https://github.com/jangangitungapah-pixel/37V2`
- **Repository Owner:** `jangangitungapah-pixel`
- **Local Workspace:** `c:\Users\hazel\source\repos\37V2`
- **Firebase Project:** `studio37classic` (`studio37-os` Hosting site, Spark Free Plan only)
- **Tech Stack:** React `19.3.1`, Vite `8.3.8`, JavaScript / JSX, Tailwind CSS `4.3.5`, Base UI `1.9.0`, React Hook Form `7.92.0`, Zod `4.6.7`, TanStack Query `5.107.1`, Zustand `5.1.0`, `date-fns` `4.4.0` + `@date-fns/tz` `1.5.0`, Firebase Auth + Cloud Firestore + Firebase Hosting + optional App Check (`ReCaptchaV3Provider`), unsigned Cloudinary media uploads (`VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET` & `VITE_CLOUDINARY_UPLOAD_PRESET`).

---

## 2. Branch & Actual Inspected HEAD SHA

- **Branch:** `main`
- **Inspected HEAD Commit SHA:** `6ef8f0cab8f66a439309deb9b2a63488695a615a`
- **HEAD Commit Subject:** `fix(booking-requests): reduce advanced filter control sizing`
- **Recent Commits Prior to Phase 0:**
  - `6ef8f0c` — `fix(booking-requests): reduce advanced filter control sizing`
  - `85c96f6` — `feat(booking-requests): compact inbox toolbar and search`
  - `e1bd619` — `feat(booking-requests): redesign detail request workspace`
  - `556fac9` — `fix(booking-requests): refine communication composer safeguards`
  - `f6db6f8` — `feat(booking-requests): improve WhatsApp and activity UX`
- **Pre-Phase 0 Working Tree State:** Clean (`git status --short` returned zero lines before Phase 0 authoring).

---

## 3. Phase Completion Status

- **Phase 0 Execution Status:** **Complete — Requires Owner Decisions to Unlock Phase 1 Entry Gate**
- All deep repository audits, scenario analyses, domain modeling, data contracts, state machines, compatibility plans, and pending Owner decisions are frozen on disk across the 6 deliverables listed in Section 9.
- **No Phase 1 implementation may start** until the Owner reviews the architecture and issues explicit approval on the unresolved decisions (especially Top-3 blockers `OD-01`, `OD-02`, `OD-03`).

---

## 4. Source Files & Architecture Documents Audited

### 4.1 Application Source, Security Rules & Configuration Audited
- **Firebase & Infrastructure:** `package.json`, `firebase.json`, `.firebaserc`, `firestore.rules` (4,122 lines, 167,726 bytes, 38 collection/subcollection match blocks), `firestore.indexes.json`, `scripts/test-firestore-rules.mjs`, `src/lib/firebase/client.js`, `src/lib/firebase/auth.js`, `src/lib/firebase/firestore.js`, `src/lib/firebase/app-check.js`, `src/lib/booking-date.js`, `README.md`.
- **Booking Requests & Public Website:** `src/components/landing/BookingSection.jsx`, `src/features/admin/booking-requests/config/booking-request-config.js`, `src/features/admin/booking-requests/utils/booking-request-validation.js`, `src/features/admin/booking-requests/utils/booking-request-normalize.js`, `src/features/admin/booking-requests/services/booking-request-service.js`, `src/features/admin/booking-requests/services/whatsapp-message-service.js`, `src/features/admin/booking-requests/repositories/booking-request-repository.js`, `src/features/admin/booking-requests/hooks/useBookingRequests.js`, `src/features/admin/booking-requests/components/BookingRequestToolbar.jsx`, `src/features/admin/booking-requests/components/BookingRequestDetailDrawer.jsx`, `src/features/admin/booking-requests/components/BookingRequestStatusBadge.jsx`, `src/features/admin/booking-requests/booking-requests.test.jsx`.
- **Calendar, Reservations & Public Availability:** `src/features/admin/calendar/calendar-config.js`, `src/features/admin/calendar/services/calendar-booking-service.js`, `src/features/admin/calendar/repositories/calendar-booking-repository.js`, `src/features/admin/calendar/schemas/booking-schema.js`, `src/features/admin/calendar/utils/booking-time.js`, `src/features/admin/calendar/utils/booking-pricing.js`, `src/features/admin/calendar/components/BookingFormDialog.jsx`, `src/features/admin/calendar/components/BookingDetailDrawer.jsx`, `src/features/admin/calendar/pages/AdminCalendarPage.jsx`, `src/features/public-availability/**`, `src/features/public-pricing/**`.
- **Payment, Invoice & Payment Evidence:** `src/features/admin/payment/services/payment-service.js`, `src/features/admin/payment/services/invoice-service.js`, `src/features/admin/payment/schemas/payment-schema.js`, `src/features/admin/payment/repositories/payment-repository.js`, `src/features/admin/payment/utils/invoice-status.js`, `src/features/admin/payment/utils/invoice-number.js`, `src/features/admin/payment/utils/payment-calculation.js`, `src/features/admin/payment/components/RecordPaymentDialog.jsx`, `src/features/admin/payment/components/PaymentCorrectionDialog.jsx`, `src/features/admin/payment/components/InvoiceDirectoryTable.jsx`, `src/features/admin/payment/components/InvoiceDetailDrawer.jsx`, `src/features/payment-evidence/config/payment-evidence-config.js`, `src/features/payment-evidence/schemas/payment-evidence-schema.js`, `src/features/payment-evidence/services/payment-evidence-service.js`, `src/features/payment-evidence/services/cloudinary-payment-evidence-upload-service.js`, `src/features/payment-evidence/repositories/payment-evidence-repository.js`, `src/features/payment-evidence/hooks/usePaymentEvidenceUpload.js`, `src/features/payment-evidence/components/PaymentEvidenceUploadField.jsx`, `src/features/payment-evidence/components/PaymentEvidenceReviewDrawer.jsx`, `src/features/payment-evidence/components/PaymentEvidenceQueue.jsx`, `src/features/payment-evidence/utils/payment-evidence-utils.js`.
- **Client Portal:** `src/features/client-portal/services/client-auth-service.js`, `src/features/client-portal/utils/client-auth-helpers.js`, `src/features/client-portal/repositories/client-portal-repository.js`, `src/features/client-portal/pages/ClientLoginPage.jsx`, `src/features/client-portal/pages/ClientPortalHomePage.jsx`, `src/features/client-portal/pages/ClientBookSessionPage.jsx`, `src/features/client-portal/pages/ClientBookingsPage.jsx`, `src/features/client-portal/pages/ClientInvoicesPage.jsx`, `src/features/client-portal/pages/ClientProfilePage.jsx`, `src/features/client-portal/components/booking/*`, `src/features/client-portal/billing/*`.
- **Settings, Catalog & Downstream Integrations:** `src/features/admin/settings/**` (`pricing/`, `studio-profile/`, `danger-area/factory-reset-config.js`), `src/features/admin/bookkeeping/**`, `src/features/admin/commission/**`, `src/features/admin/customer/**`, `src/features/admin/dashboard/**`, `src/features/customer-reviews/**`, `src/features/admin/navigation/admin-navigation.js`.

### 4.2 Existing Documentation Audited
- `README.md`, `docs/setup/CLOUDINARY-PAYMENT-EVIDENCE-SETUP.md`, `docs/prd/PRD-LANDING-PAGE-PHASE-2-v0.2.md`, `docs/handoffs/HANDOFF-CLIENT-PORTAL-PHASE-3-BOOKING.txt`, and all `docs/architecture/*.md` covering: `PUBLIC-BOOKING-REQUEST-WORKFLOW.md`, `PUBLIC-AVAILABILITY-CALENDAR.md`, `ADMIN-CALENDAR-BOOKING.md`, `PRICE-AND-FEE-CATALOG-V2.md`, `ADMIN-PRICE-AND-FEE-SETTINGS.md`, `ADMIN-SETTINGS-CENTER.md`, `PAYMENT-AND-BILL.md`, `PAYMENT-EVIDENCE-AND-VERIFICATION.md`, `CLIENT-BOOKING-AND-SESSION-WORKFLOW.md`, `CLIENT-BILLING-AND-PAYMENTS.md`, `CLIENT-PORTAL-PHASE-1-AUTH.md`, `FIREBASE-AUTH-FIRESTORE.md`, `DEPENDENCY-FOUNDATION.md`, `ADMIN-BOOKKEEPING-MANAGEMENT.md`, `COMMISSION-AND-FEE-MANAGEMENT.md`, `CUSTOMER-MANAGEMENT.md`, `CUSTOMER-REVIEW-MANAGEMENT.md`, `ADMIN-DASHBOARD-COMMAND-CENTER.md`, `FACTORY-RESET-AND-DANGER-AREA.md`.

---

## 5. Key Existing Implementation Findings (Verified Baseline Facts)

1. **`DISC-01` — Cash Permitted in Client Payment Evidence:** `ClientPaymentEvidenceForm.jsx:201` iterates all `SUPPORTED_PAYMENT_METHODS` (`['cash','transfer','qris','other']`), `payment-evidence-schema.js:48` validates the same enum, and `firestore.rules:1048` permits `'cash'` on `client_portal` proof creation (violating `Cash: staff`).
2. **`DISC-02` — Generic Manual / Staff Cash Hard-Blocked on Client Portal Invoices:** `createBooking()` (`calendar-booking-service.js:636-661`) freezes `clientPaymentEvidenceRequired = true` on `invoices/inv_{bookingId}` for `client_portal` requests; `applyValidatedPaymentInTransaction()` (`payment-service.js:128-133`), `InvoiceDirectoryTable.jsx:116`, `InvoiceDetailDrawer.jsx:98`, and `firestore.rules:949-958` reject ALL non-evidence payments (blocking Desk Cash settlement after online DP).
3. **`DISC-03` — Single Pending Evidence Restriction Is UI-Only:** Enforced only in `ClientPaymentEvidencePanel.jsx:46-58`. `submitClientPaymentEvidence()` and `firestore.rules:1085-1104` allow multiple concurrent `pending_review` docs (confirmed in `test-firestore-rules.mjs:4650-4669`).
4. **`DISC-04` — Premature Slot Lock & Confirmation Prior to Deposit Verification:** `createBooking()` immediately locks `bookingSlots`, creates `bookings` with `sessionStatus: 'upcoming'`, issues `invoices`, and marks `publicBookingRequests` terminal `'confirmed'` with `amountPaid == 0` and zero deposit gate.
5. **`DISC-05` — CRITICAL Identity Deadlock for Isolated Client Accounts (`client_{uid}`):** Email/Password clients (100%) and unmatched Google sign-ins have `clientAccounts/{uid}.customerId = "client_{uid}"`. `createBooking()` ignores `existingBookingRequest.customerId` and resolves `customers/cust_...` by phone, issuing an invoice with `customerId = "cust_..."` AND `clientPaymentEvidenceRequired = true` -> Client CANNOT read or submit proof (`isClientOwnerOfCustomer` fails) AND Staff CANNOT record manual payment!
6. **`DISC-06` — Stale Client Booking Projections:** Clients cannot read `bookings` (`firestore.rules:2186`); `/portal/bookings` derives labels from static `publicBookingRequests.confirmedBookingSnapshot` vs browser clock, so Admin reschedules, cancellations, no-shows, and walk-in bookings never sync to Client Portal.
7. **`DISC-07` — Historical Price Overwrite vs Immutable Invoice Drift:** `updateOrRescheduleBooking()` with `applyUpdatedPricing: true` overwrites `bookings` prices & `commissionSnapshot` in place, while `invoices.financialSnapshot` is immutable (`firestore.rules:863`), creating an unfixable `isSnapshotMismatch` warning.
8. **`DISC-08` — Zero Refund Model & Stuck Draft Invoice:** Only clerical `Payment Reversal` exists (`pay_rev_{txId}`); `cancelBooking()` never resolves invoices; `invoices.create` allows `'draft'` (`firestore.rules:2277`), yet no update rule permits exiting `'draft'`.
9. **`DISC-09` — Mix & Master Ends at Inquiry + Filter Defect:** WFA (`mixing`/`mastering`/`mix-master`) cannot create `bookings`/`invoices`; `BookingRequestToolbar.jsx:229-233` misses Client Portal `'mixing'`/`'mastering'` filter IDs.
10. **`DISC-10` — Transaction Budget & Quality Bugs Discovered:**
    - `postCommissionBatch()` exceeds Firestore's 20-lookup transaction cap at `>= 16` bookings; `importLegacyBookingHistory()` at `> 18` distinct customers; `importLegacyBookingInvoices()` at `>= 7` paid bookings; `subscribeClientPaymentTransactions()` query limit hits at `> 7` invoice IDs in one chunk.
    - `firestore.rules` is `167,726 bytes` (64.0% of 256 KB cap); `bookings.update` evaluates ~300–450+ CEL expressions; repeated uncached `getAfter` calls bloat AST; `bookingSlots` omits `no_show` check; `customerReviews.create` (`request.auth == null`) blocks signed-in Client Portal users; `payment-evidence-config.js` allows `secureUrlMax: 600` while `firestore.rules:1013` caps at `500`.
    - Bugs found in `src/lib/booking-date.js` (local timezone vs WIB), `ClientBookingStepSchedule.jsx` & `ClientBookingStepReview.jsx` (`formatMinuteRange(start, duration)` instead of `start + duration`), `PaymentEvidenceReviewDrawer.jsx` (drops `notes`, omits `expectedEvidenceVersion`, passes `'id'` string instead of `{ locale: 'id' }`), `FACTORY_RESET_DELETION_MANIFEST` (omits `customerEmailIndex`, `clientCustomerLinks`, `clientProfiles` while rules cap manifest at `<= 25`), `useDashboardData.js:345` (`{ entries }` vs `{ payables }` breaking `ownerPayables`), `dashboard-calculations.js:630` (`?tab=settlement` vs `?tab=cash-settlement`), plus extensive doc-vs-code drift across `docs/architecture/*.md`.

---

## 6. Eight Approved Decisions (Immutable — Do Not Alter Without Owner Confirmation)

1. **Reservation model:** `deposit_hold` (hold protects slots; Hold != Confirmed).
2. **Deposit policy:** `configurable` (`none | fixed | percentage` default + service/option overrides; frozen at accepted offer).
3. **Cash policy:** `staff` (Clients never declare Cash as received; Staff/Owner record with actor & audit).
4. **Refund policy:** `case_by_case` (No automatic refund; requires decision & reason; Refund strictly separated from Payment Reversal).
5. **Hold expiry:** `manual_expiry` (Zero automated cron/Functions; UI surfaces overdue holds prominently; Staff/Owner expire/release manually).
6. **Pricing changes:** `adjustment` (Never silently overwrite historical offer/invoice totals; append-only Adjustment w/ reason, amount, approval).
7. **Client changes:** `approval` (Client change requests go through Staff/Admin approval; never mutate canonical booking directly).
8. **Mix & Master:** `project` (Separate `postProductionProjects` lifecycle; NEVER creates `bookings`, `bookingSlots`, or room locks).

---

## 7. Owner Decisions Still Pending (`PENDING OWNER APPROVAL` — 14 Items)

*(Recommendations are NOT approved decisions. Phase 1 cannot start until Owner resolves Top-3 blockers `#OD-01`..`#OD-03` and confirms scope for `#OD-04`..`#OD-14`.)*

| ID | Priority | Decision Topic | Recommended Option *(Unapproved)* | Status |
|---|---|---|---|---|
| **`OD-01`** | **TOP-3 BLOCKER** | Reservation confirmation trigger | Option A: Auto-confirm inside payment tx when verified net paid >= `minimumDepositAmount`, plus authorized Staff/Owner override with reason | `PENDING OWNER APPROVAL` |
| **`OD-02`** | **TOP-3 BLOCKER** | Hold deadline policy | Option A: Configurable default TTL in `settings/bookingPolicies` (clamped before session start) + Staff per-booking override | `PENDING OWNER APPROVAL` |
| **`OD-03`** | **TOP-3 BLOCKER** | Outstanding balance due deadline | Option A: Configurable per service type (e.g. Check-In for Rehearsal; pre-session/delivery for Recording/Project) + override | `PENDING OWNER APPROVAL` |
| **`OD-04`** | High | No Deposit confirmation path | Option A: Immediate `confirmed` upon Accepted Offer / Admin creation (`depositStatus: 'not_required'`) | `PENDING OWNER APPROVAL` |
| **`OD-05`** | High | Multiple pending evidence submissions | Option B in backend w/ duplicate-asset warnings OR strict Option A server pending-lock if Owner prefers single queue item | `PENDING OWNER APPROVAL` |
| **`OD-06`** | High | Staff Cash & manual non-cash on Client Portal invoices | Option B: Always allow `staff_cash_desk` directly for Staff/Owner; keep non-cash proof-backed (or Owner override) | `PENDING OWNER APPROVAL` |
| **`OD-07`** | High | Payment below minimum deposit | Option A+C: Keep `deposit_hold` (`partial_below_minimum`) until topped up, plus optional Owner/Staff manual exception | `PENDING OWNER APPROVAL` |
| **`OD-08`** | Medium | Hold extension authority | Option B for Phase 1-2 (`Staff/Owner` only with audit), optionally opening Client extension request in Phase 4 | `PENDING OWNER APPROVAL` |
| **`OD-09`** | Medium | Hold expiry while evidence `pending_review` | Option A: Protect hold & block manual expiry while unreviewed `pending_review` evidence exists (`verify/reject` first) | `PENDING OWNER APPROVAL` |
| **`OD-10`** | Medium | Late payment / proof after expiry | Option A: Re-check `bookingSlots` availability if Staff restores; otherwise record funds & open `refundCases` (Refund/Credit) | `PENDING OWNER APPROVAL` |
| **`OD-11`** | Medium | Pricing decrease below `amountPaid` & credit handling | Option A: Clamp `balanceDue >= 0`, expose `overpaidCreditBalance`, resolve via `refundCases` (Studio Credit or Cash Refund) | `PENDING OWNER APPROVAL` |
| **`OD-12`** | Medium | Refund accounting & tx linkage | Option A: `refundCases` referencing `sourcePaymentTransactionIds[]` + read-only Pembukuan outflow deduction | `PENDING OWNER APPROVAL` |
| **`OD-13`** | Medium | Offer revision handling | Option A: New Offer revision atomically supersedes prior `sent` Offer (`superseded`) | `PENDING OWNER APPROVAL` |
| **`OD-14`** | High | Isolated `client_{uid}` vs CRM `customers/{cust_...}` linkage | Option B+propagation: Stamp `clientUid` across booking/invoice/projection + explicit Staff-confirmed link tool (no silent merges) | `PENDING OWNER APPROVAL` |

---

## 8. Final Architecture Conclusions

1. **Zero Collection Bloat:** All 9 operational domains fit cleanly across existing core collections + 4 targeted additions (`clientReservations`, `bookingChangeRequests`, `refundCases`, `postProductionProjects`) + subcollections (`requests/offers`, `invoices/adjustments`, `projects/quotations`, `projects/activities`) + `settings/bookingPolicies`.
2. **Lifecycles Separated Cleanly:** `Request` != `Offer` != `Reservation (deposit_hold | confirmed | expired | cancelled)` != `Session (pending_confirmation | upcoming | in_progress | completed | no_show | cancelled)` != `Payment/Deposit` != `Evidence` != `Change Request` != `Refund Case` != `Mix & Master Project`.
3. **True Multi-Method Installments + Fixed Staff Cash:** One invoice reconciles unlimited append-only `paymentTransactions` across Transfer, QRIS, Cash, and Other. Client Portal forbids `'cash'` proof uploads while Staff/Owner can always record `staff_cash_desk` directly.
4. **Clients Never Lock Slots or Touch Financial Truth Directly:** Even under `deposit_hold_offer`, Staff initiates slot locks (`bookings` + `bookingSlots`) within `10/20` Firestore doc lookup caps, preserving Security Rules integrity and historical immutability.
5. **100% Firebase Spark-Only Compatible:** Zero Cloud Functions, zero Blaze, zero Firebase Storage, zero Workers, zero scheduled crons; manual expiry relies on WIB overdue indicators; Cloudinary uses existing unsigned preset + privacy guardrails.

---

## 9. All Generated Phase 0 Documentation Paths

1. [`docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`](file:///c:/Users/hazel/source/repos/37V2/docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md) — Verbatim persisted Phase 0 PRD.
2. [`docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md`](file:///c:/Users/hazel/source/repos/37V2/docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md) — Complete system audit, 9-domain engine specification, workflows, 70-scenario matrix, Spark audit, and 14-item Owner Decision Register.
3. [`docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md`](file:///c:/Users/hazel/source/repos/37V2/docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md) — Complete entity field schemas, immutability contracts, all 11 Firestore `runTransaction` specs with lookup budgets, Role Permission Matrix, and Rules/Index governance.
4. [`docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md`](file:///c:/Users/hazel/source/repos/37V2/docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md) — Independent state machines with Mermaid diagrams, allowed/forbidden transitions, actors, guards, recovery, and cross-lifecycle sync matrix for all 9 domains.
5. [`docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md`](file:///c:/Users/hazel/source/repos/37V2/docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md) — Zero-fabricated-history legacy normalization matrix, phased rollout sequence (Phases 1–5), `<= 5`-item safe batch chunking, validation gates, rollback plan, and deferred `firestore.rules` / `firestore.indexes.json` roadmap.
6. [`docs/handoffs/HANDOFF-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`](file:///c:/Users/hazel/source/repos/37V2/docs/handoffs/HANDOFF-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md) — This standalone Phase 0 handoff document.

---

## 10. Phase 1 Scope, Entry Requirements & Future Handoff Discipline

### 10.1 Phase 1 Entry Gate (Mandatory Before Coding Starts)
Phase 1 may begin **ONLY AFTER Owner explicitly reviews and approves**:
1. `BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md`
2. `BOOKING-LIFECYCLE-DATA-CONTRACTS.md`
3. `BOOKING-LIFECYCLE-STATE-MACHINES.md`
4. `BOOKING-LIFECYCLE-MIGRATION-PLAN.md`
5. Outstanding Decision Register (`OD-01`, `OD-02`, `OD-03` mandatory blockers; `OD-04`..`OD-14` for relevant phased decisions).

### 10.2 Recommended Phase 1 Scope ("Core Domain & Data Foundation")
- Compact `firestore.rules` helpers to restore AST/expression headroom (`< 256 KB`, `<= 1000` expr).
- Implement `settings/bookingPolicies` repository/service/settings panel + `publicPricingCatalog/current` v4 deposit preview projection.
- Fix `src/lib/booking-date.js` (`Asia/Jakarta` `@date-fns/tz`), `clientUid` dual-ownership binding & `clientReservations/{bookingId}` projection (resolving `DISC-05` & `DISC-06`), and chunk `postCommissionBatch` / legacy importers (`<= 5` items/tx).
- Add additive read-time legacy normalizers & expand Factory Reset manifest (`<= 40` rule cap).
- *Remediate critical low-risk defects discovered in audit:* `formatMinuteRange` duration arg bug, `PaymentEvidenceReviewDrawer` notes/version/locale bug, `BookingRequestToolbar` filter bug, Dashboard `ownerPayables` destructuring & tab query bug.

### 10.3 Mandatory Handoff Standard for All Future Phases
Every implementation phase (Phase 1, Phase 2, Phase 3, Phase 4, Phase 5+) **MUST conclude with one standalone handoff document** inside `docs/handoffs/` containing: baseline commit SHA, exact files changed, design decisions & resolved Owner rules implemented, actual test/emulator/build/lint validation results, outstanding issues, and exact next-phase entry instructions.

---

## 11. Known Risks & Unresolved Issues

1. **Firestore Rules Size & Expression Ceiling:** `firestore.rules` is already `167,726 bytes` (64.0% of 256 KB) and `bookings.update` uses ~300–450+ expressions (1,000 cap). Adding Phase 2–5 entities *without* refactoring shared helpers first risks `firebaserules.googleapis.com:test` HTTP 503 or deployment failure.
2. **Existing 20-Lookup Transaction Failure in Live Prod Utilities:** Calling `postCommissionBatch` on `>= 16` bookings or legacy batch importers on large sets will fail with Firestore rules lookup errors until fixed to `<= 5` per tx.
3. **Production Rules / Client Auth Deployment Gap:** Audit docs note some recent rules updates have been validated on local emulator only and require deliberate `firebase deploy --only firestore:rules,firestore:indexes` during Phase 1 rollout.
4. **Cloudinary Orphan Files Under Spark-Only Unsigned Upload:** Rejected or abandoned uploads remain accessible at public random URLs (`pe_<24hex>`); UI privacy redaction notices remain essential since server-side signed deletion is prohibited on Spark-only.
5. **Unverified Phase 1 Decisions:** Implementing confirmation gates (`OD-01`), hold TTL defaults (`OD-02`), or due dates (`OD-03`) before Owner sign-off risks rework across both Admin UI and Client Portal.

---

## 12. Explicit Statement on Application Source Code Changes

**ZERO application source code, UI components, services, repositories, Zod schemas, `firestore.rules`, `firestore.indexes.json`, `package.json`, `.env*`, or build/deploy configurations were created, edited, or deleted during Phase 0.**

Phase 0 executed strictly as a read-only repository audit and documentation/architecture-freeze deliverable.

---

## 13. Actual Verification Performed

- **Git Baseline Verified (`run_command`):** Branch `main`, HEAD SHA `6ef8f0cab8f66a439309deb9b2a63488695a615a`, pre-Phase 0 working tree completely clean.
- **Direct Code & Security Rules Audit:** Line-by-line inspection across `src/features/**`, `src/lib/**`, `firestore.rules` (4,122 lines / 167,726 bytes), `firestore.indexes.json` (2 composite indexes), `firebase.json`, `package.json`, `scripts/test-firestore-rules.mjs`, and `docs/architecture/**` using read-only inspection and three domain research auditors.
- **PRD Parity Check:** `Compare-Object` line diff between supplied Phase 0 PRD and `docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md` reported `PRD_LINE_DIFF_COUNT=0` (515 lines, 16,511 bytes).
- **Diagram & Formatting Check:** Audited all 13 Mermaid blocks across `BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md` (`flowchart LR`), `BOOKING-LIFECYCLE-DATA-CONTRACTS.md` (`erDiagram`), and `BOOKING-LIFECYCLE-STATE-MACHINES.md` (11 `stateDiagram-v2` blocks) — verified valid headers, zero raw HTML tags, and zero unescaped `$` math delimiters across all 6 deliverables.
- **Repository Mutation Check (`git diff --stat` & `git status --short`):** Confirmed **0 tracked files changed** and **only the 6 untracked Phase 0 documents created**. *(Note: Since Phase 0 is strictly documentation-only with zero code changes, `npm run lint`, `npm run test:run`, `npm run build`, and `npm run test:rules` were not mutated or re-executed against untouched application code.)*

---

## 14. Exact Git Status & Commit / Push Status

- **Commit Status:** **NOT COMMITTED** (`git commit` was strictly prohibited in Phase 0; Owner will review before committing).
- **Push / Deploy Status:** **NOT PUSHED / NOT DEPLOYED** (`git push`, `git merge`, and `firebase deploy` were strictly prohibited in Phase 0).
- **Tracked Changes (`git diff --stat`):** **None (0 tracked files modified).**
- **Exact `git status --short` Output:**
  - `?? docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md`
  - `?? docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md`
  - `?? docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md`
  - `?? docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md`
  - `?? docs/handoffs/HANDOFF-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`
  - `?? docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md`
