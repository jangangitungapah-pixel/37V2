# HANDOFF — 37V2 Phase 2: Offer Revisions & Deposit Hold Engine

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `feature/phase-2-offer-revisions-deposit-hold-engine`  
**Base Accepted Phase 1 Commit:** `2762923ea6de93345058b97012951555f1a354f2`  
**Phase Status:** **IMPLEMENTATION & VERIFICATION COMPLETE FOR INDEPENDENT PHASE 2 DELIVERABLES (`verify:phase2` `4/4` PASS) — EXPLICITLY `BLOCKED` ON DEPENDENT `deposit_hold_offer` PATH PENDING OWNER ADR CHOICE (A vs B) — LOCAL DEVELOPMENT ONLY (NOT DEPLOYED)**  
**Companion Architecture Doc:** `docs/architecture/PHASE-2-OFFER-DEPOSIT-HOLD-IMPLEMENTATION.md`  
**Date:** `2026-11-28` (`Asia/Jakarta`)

---

## 1. Executive Summary & Honest Block Status

Phase 2 builds upon the Owner-accepted Phase 1 foundation (`2762923ea6de93345058b97012951555f1a354f2`) to deliver the real commercial proposal revision lifecycle (`publicBookingRequests/{requestId}/offers/{offerId}`) and provisional reservation / Deposit Hold engine (`deposit_hold`, `confirmed`, `expired`, `cancelled`, `OD-01`..`OD-14`).

**Why the `deposit_hold_offer` path remains explicitly `BLOCKED`:**
Per the frozen Phase 0 / Section 3 Spark security-boundary ADR, activating `offerMode = 'deposit_hold_offer'` requires an explicit Owner architectural choice on invoice-issuance timing:
- **Choice A:** Staff creates an unpaid `deposit_hold` booking and issued invoice atomically at Offer send time.
- **Choice B:** Client accepts the `deposit_hold_offer` first, followed by a separate Staff conversion step to create the provisional hold and invoice.

Because resolving Choice A vs Choice B is an Owner architecture decision (not self-decidable during Phase 2 local implementation), `offerMode = 'deposit_hold_offer'` is fail-closed in both application code (`DEPOSIT_HOLD_OFFER_BLOCK_ERROR_CODE = 'offer/deposit-hold-timing-unresolved'` in `offer-schema.js` / `offer-service.js`) and Firestore Security Rules (`data.offerMode == 'quote_only'` in `isValidOfferCreate` / `isValidOfferStaffUpdate` / `prevData.offerMode == 'quote_only'` in `isValidOfferClientRespondUpdate`). All `quote_only` Offer revision workflows and direct Calendar / Offer-conversion Deposit Hold lifecycle flows work end-to-end.

---

## 2. Verification Gate Results (Observed Locally)

Run command: `npm run verify:phase2` (`scripts/run-phase-2-gate-diagnostics.mjs`, active Node `v26.13.0`):

| Gate | Command | Result | Observed Details |
|---|---|---|---|
| **ESLint** | `npm run lint` | **PASS (`exit 0`)** | 0 errors across workspace (`eslint .`) |
| **Vitest Unit & UI Suite** | `npm run test:run` | **PASS (`exit 0`)** | `Test Files 31 passed (31)`, `Tests 258 passed (258)` — includes new `phase2-offers.test.jsx` (`4` tests), `phase2-deposit-hold-lifecycle.test.jsx` (`4` tests), updated `calendar.test.jsx` (`13` tests), `factory-reset.test.jsx`, and all Phase 1/Gate 2/Gate 3 suites (`Duration 42.00s`) |
| **Firestore Security Rules (Real Emulator)** | `npm run test:rules:diagnostics` | **PASS (`exit 0`)** | `ALL FIRESTORE SECURITY RULES TESTS PASSED (REAL EMULATOR)!` — covers all Phase 1, Gate 2, Gate 3, plus Phase 2 tests (`2E..2J`: `quote_only` / `OD-13` / ADR enforcement, 13h = 26-slot Deposit Hold create & CEL expression budget, `OD-08` Staff extend vs Client deny, `OD-09` Pending-Evidence Shield blocking void/expiry & reject unlock, manual unpaid expiry + `OD-10` Restore + unvoid, paid expiry `refundCases` RBAC) |
| **Production Build** | `npm run build` | **PASS (`exit 0`)** | `4,275` modules transformed, built cleanly in `12.30s` (`dist/assets/index-CriR1_fo.js 3,639.78 kB`) |
| **Rules Source Size** | `(Get-Item firestore.rules).Length` | **PASS** | `230,887` bytes (< `262,144` bytes / 256 KiB limit) |
| **Gate Log File** | — | **Recorded** | `logs/phase2/phase2-gates-2026-11-28T02-57-15-349Z.txt` (`4/4` PASS; `test:rules` log `logs/firestore-rules/rules-diagnostics-2026-11-28T02-58-30-036Z.txt`) |

**Pre-existing formatting baseline caveat (`npm run format:check`):**  
The repository contains no `.prettierrc` config and `.editorconfig` specifies `end_of_line = lf` while Windows Git working copies contain CRLF and historical pre-Phase-2 files were not Prettier-formatted repo-wide (`npm run format:check` warns on 455 pre-existing files across `src/`, `scripts/`, and root docs). Consistent with `run-phase-1-gate-diagnostics.mjs`, `verify:phase2` validates ESLint, full Vitest, real Firestore Emulator Rules, and Vite production build without reformatting unrelated Phase 0/1 files.

---

## 3. File Inventory (Over Phase 1 Base `2762923ea6de93345058b97012951555f1a354f2`)

### New Phase 2 Code, Tests, Rules & Tooling
- `src/features/admin/settings/booking-policies/utils/booking-policy-engine.js` — runtime policy resolution, DP math, WIB hold deadline computation & clamping (`OD-01`..`OD-07`)
- `src/features/admin/booking-requests/schemas/offer-schema.js` — Offer v1 schema, status metadata, ADR guard (`DEPOSIT_HOLD_OFFER_BLOCK_ERROR_CODE`)
- `src/features/admin/booking-requests/services/offer-service.js` — transactional Offer send, `OD-13` revision supersession, Client accept/reject, Staff withdraw/expire/record response
- `src/features/admin/booking-requests/components/OfferComposerCard.jsx` — Admin Offer compose & revision UI
- `src/features/admin/booking-requests/components/OfferRevisionHistoryList.jsx` — Admin revision timeline UI
- `src/features/admin/booking-requests/phase2-offers.test.jsx` — Phase 2 policy engine + Offer revisions unit & UI integration tests
- `src/features/admin/calendar/services/reservation-hold-service.js` — `confirmReservation`, `extendReservationHold`, `expireReservationHold`, `restoreExpiredReservation` (`TX-05..TX-07`, `OD-08..OD-10`, `AD-05`)
- `src/features/admin/calendar/components/HoldLifecyclePanel.jsx` — Calendar Detail Drawer Hold management panel (`OD-09` pending-evidence notice, confirm override, extend, manual expire, restore)
- `src/features/admin/calendar/phase2-deposit-hold-lifecycle.test.jsx` — Phase 2 Deposit Hold lifecycle, legacy fallback, Dashboard/Drawer UI tests
- `src/features/client-portal/components/bookings/ClientOfferReviewCard.jsx` — Client Portal Offer review, summary, and accept/reject UI
- `scripts/run-phase-2-gate-diagnostics.mjs` — Phase 2 sequential verification gate runner

### Modified Modules, Rules, Indexes & Documentation
- `firestore.rules` — Offer subcollection rules, Hold lifecycle booking update validation, `paymentEvidenceLocks` & `OD-09` invoice void / hold expiry shield, `refundCases` RBAC, consolidated single `allow update` rules & CEL expression-budget optimization preserving all Phase 0/1 contract test signatures
- `firestore.indexes.json` — added composite index `bookings` (`reservationStatus ASC`, `holdExpiresAt ASC`)
- `package.json` — added `"verify:phase2"` script
- `scripts/test-firestore-rules.mjs` — added Phase 2 real Emulator integration & security denial suite (`quote_only` / `OD-13` / ADR block, 13h = 26-slot Deposit Hold, `OD-08`, `OD-09`, unpaid manual expiry + `OD-10` restore, paid expiry `refundCases` RBAC)
- Booking Requests UI/repo/config/utils: `BookingRequestActivityTimeline.jsx`, `BookingRequestDetailDrawer.jsx`, `BookingRequestStatusBadge.jsx`, `booking-request-config.js`, `useBookingRequestDetail.js`, `booking-request-repository.js`, `booking-request-normalize.js`, `booking-request-validation.js`
- Calendar UI/repo/service/config/tests: `calendar.test.jsx`, `BookingDetailDrawer.jsx`, `BookingFormDialog.jsx`, `CalendarBookingCard.jsx`, `UpcomingBookings.jsx`, `calendar-config.js`, `AdminCalendarPage.jsx`, `calendar-booking-repository.js`, `calendar-booking-service.js`, `booking-time.js`
- Dashboard & Public Availability: `DashboardNeedsAttention.jsx`, `dashboard-config.js`, `useDashboardData.js`, `dashboard-calculations.js`, `public-availability-calculation.js`
- Payment, Evidence & Booking Policies: `payment-repository.js`, `payment-schema.js`, `invoice-service.js`, `payment-service.js`, `booking-policies-repository.js`, `payment-evidence-repository.js`, `payment-evidence-service.js`
- Client Portal: `ClientInvoiceDetailDrawer.jsx`, `client-billing-utils.js`, `ClientBookingCard.jsx`, `ClientBookingsPage.jsx`, `ClientInvoicesPage.jsx`, `client-bookings-utils.js`
- Danger Area / Factory Reset: `factory-reset-config.js`, `factory-reset-repository.js`, `factory-reset.test.jsx`
- Docs: `docs/project/37V2-PROJECT-CONTEXT.md`, `docs/handoffs/HANDOFF-PHASE-1-CORE-DOMAIN-IDENTITY-POLICY-FOUNDATION.md`, `docs/handoffs/PHASE-1-OWNER-ACCEPTANCE-RECORD.md`, `docs/architecture/PHASE-2-OFFER-DEPOSIT-HOLD-IMPLEMENTATION.md`, `docs/handoffs/HANDOFF-PHASE-2-OFFER-REVISIONS-DEPOSIT-HOLD-ENGINE.md`

---

## 4. Next Steps for Owner Review & Phase 3 Entry Criteria

1. **Owner Review of Phase 2 Independent Deliverables:** Review Offer Revisions (`quote_only` + `OD-13`) and the Deposit Hold Lifecycle (`OD-01..OD-10`) locally.
2. **Resolve Dependent ADR (`offer/deposit-hold-timing-unresolved`):** Owner decides between **Choice A** (Staff creates unpaid provisional booking + invoice when sending Hold Offer) and **Choice B** (Client accepts first, Staff issues invoice in follow-up step) if `deposit_hold_offer` inside Offers is required before accepting Phase 2 completely.
3. **Production Deployment Preconditions (Still Not Executed):**
   - Neither Phase 1 nor Phase 2 rules/indexes/code have been deployed to live Firebase.
   - Live `clientReservations` backfill from Phase 1 has not been run.
   - Do **not** merge to `main`, run `firebase deploy`, or begin Phases 3–5 until Owner acceptance and required deployment preconditions are completed.
