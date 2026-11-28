# HANDOFF — 37V2 Phase 2: Offer Revisions & Deposit Hold Engine

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `feature/phase-2-offer-revisions-deposit-hold-engine`  
**Base Accepted Phase 1 Commit:** `2762923ea6de93345058b97012951555f1a354f2`  
**Owner ADR Resolution (`2026-11-28`, `"saya pilih opsi A"`):** **Option A Authorized & Implemented**  
**Phase Status:** **OWNER-ACCEPTED ON `2026-11-28` (`d9125b9446b53871f062f2f0d5b37ab6db73b1b3`) — PHASE 3 AUTHORIZED LOCALLY (`feature/phase-3-multi-method-payments-staff-cash-adjustments`) — PRODUCTION DEPLOY & BACKFILL NOT PERFORMED** (see `docs/handoffs/PHASE-2-OWNER-ACCEPTANCE-RECORD.md`)
**Companion Architecture Doc:** `docs/architecture/PHASE-2-OFFER-DEPOSIT-HOLD-IMPLEMENTATION.md`  
**Date:** `2026-11-28` (`Asia/Jakarta`)

---

## 1. Executive Summary & Owner ADR Option A Resolution

Phase 2 builds upon the Owner-accepted Phase 1 foundation (`2762923ea6de93345058b97012951555f1a354f2`) to deliver both the commercial proposal revision lifecycle (`publicBookingRequests/{requestId}/offers/{offerId}`) and the provisional reservation / Deposit Hold engine (`deposit_hold`, `confirmed`, `expired`, `cancelled`, `OD-01`..`OD-14`).

**Owner Decision (`"saya pilih opsi A"`, 2026-11-28):**
Per Owner resolution selecting **Choice A**, `offerMode = 'deposit_hold_offer'` is now enabled end-to-end:
- Staff atomically creates the provisional `deposit_hold` booking, 30-minute `bookingSlots` locks, `publicAvailability`, `clientReservations/{provisionalBookingId}`, `bookingEvents`, and unpaid issued `invoices/inv_{provisionalBookingId}` (`clientPaymentEvidenceRequired: Boolean(clientUid)`) at Offer send time (`TX-02` / Option A), linking `provisionalBookingId` and `holdDeadline` on the Offer doc and `activeOfferSummary`.
- Services requiring `none` / `Rp 0` DP fail closed (`offer/deposit-not-required`), preventing empty hold creation.
- Client acceptance/rejection remains scoped strictly to `offers`, `publicBookingRequests`, and `activities` (zero Client writes to canonical `bookings`, `bookingSlots`, or `invoices`), while Clients can immediately upload DP payment evidence on `/portal/invoices` (`inv_{provisionalBookingId}`).
- Revising, withdrawing, expiring, or Staff-rejecting an unpaid, unlocked `deposit_hold_offer` atomically checks `OD-09` and releases/expires the provisional hold; confirming the hold (via `verifyClientPaymentEvidence`, `recordInvoicePayment`, or `confirmReservation`) atomically promotes the parent `publicBookingRequests/{requestId}` to `confirmed`.

---

## 2. Verification Gate Runner (`verify:phase1` & `verify:phase2`)

Verification commands executed under Node `v26.13.0`:
- **ESLint:** `npm run lint` (`eslint .`)
- **Vitest Unit & UI Suite:** `npm run test:run` (includes Phase 0/1/Gate 2/Gate 3 + Phase 2 `phase2-offers.test.jsx` covering `quote_only`, `deposit_hold_offer` Option A E2E, `OD-09`, revisions/downgrades/expiry sync, and Admin/Client Portal UI, `phase2-deposit-hold-lifecycle.test.jsx`, `calendar.test.jsx`, `factory-reset.test.jsx`)
- **Firestore Security Rules (Real Emulator):** `npm run test:rules:diagnostics` (includes Phase 1, Gate 2, Gate 3, `quote_only`, Option A `deposit_hold_offer` atomic send/accept/withdraw-release invariants `2A..2K`, 13h=26-slot budget, `OD-08`, `OD-09`, `OD-10`, `refundCases` RBAC; rules source size `233,477` bytes < `262,144` bytes limit)
- **Production Build:** `npm run build`
- **Combined Gate Runners:** `npm run verify:phase1` and `npm run verify:phase2` (`scripts/run-phase-2-gate-diagnostics.mjs`, logs saved to `logs/phase2/`)

**Pre-existing formatting baseline caveat (`npm run format:check`):**  
The repository contains no `.prettierrc` config and `.editorconfig` specifies `end_of_line = lf` while Windows Git working copies contain CRLF and historical pre-Phase-2 files were not Prettier-formatted repo-wide (`npm run format:check` warns on 455 pre-existing files across `src/`, `scripts/`, and root docs). Consistent with `run-phase-1-gate-diagnostics.mjs`, `verify:phase2` validates ESLint, full Vitest, real Firestore Emulator Rules, and Vite production build without reformatting unrelated Phase 0/1 files.

---

## 3. File Inventory (Over Phase 1 Base `2762923ea6de93345058b97012951555f1a354f2`)

### New Phase 2 Code, Tests, Rules & Tooling
- `src/features/admin/settings/booking-policies/utils/booking-policy-engine.js` — runtime policy resolution, DP math, WIB hold deadline computation & clamping (`OD-01`..`OD-07`)
- `src/features/admin/booking-requests/schemas/offer-schema.js` — Offer v1 schema, status metadata, Option A mode authorization (`quote_only` & `deposit_hold_offer`), client-safe summary & projection
- `src/features/admin/booking-requests/services/offer-service.js` — transactional Offer send, Option A atomic provisional hold dispatch, `OD-13` revision supersession, Client accept/reject, Staff withdraw/expire/record response
- `src/features/admin/booking-requests/components/OfferComposerCard.jsx` — Admin Offer compose & revision UI (supports Option A mode toggle, live DP/hold deadline preview, rejected hold release)
- `src/features/admin/booking-requests/components/OfferRevisionHistoryList.jsx` — Admin revision timeline UI with provisional hold & Calendar link metadata
- `src/features/admin/booking-requests/phase2-offers.test.jsx` — Phase 2 policy engine + Offer revisions + Option A E2E domain & UI integration tests
- `src/features/admin/calendar/services/reservation-hold-service.js` — `confirmReservation`, `extendReservationHold`, `expireReservationHold`, `restoreExpiredReservation` (`TX-05..TX-07`, `OD-08..OD-10`, `AD-05`, Offer/Request sync)
- `src/features/admin/calendar/components/HoldLifecyclePanel.jsx` — Calendar Detail Drawer Hold management panel (`OD-09` pending-evidence notice, confirm override, extend, manual expire, restore)
- `src/features/admin/calendar/phase2-deposit-hold-lifecycle.test.jsx` — Phase 2 Deposit Hold lifecycle, legacy fallback, Dashboard/Drawer UI tests
- `src/features/client-portal/components/bookings/ClientOfferReviewCard.jsx` — Client Portal Offer review, Option A provisional hold & invoice upload notice, and accept/reject UI
- `scripts/run-phase-2-gate-diagnostics.mjs` — Phase 2 sequential verification gate runner

### Modified Modules, Rules, Indexes & Documentation
- `firestore.rules` — Offer subcollection rules (`quote_only` + Option A `deposit_hold_offer` atomic backing invariants), Hold lifecycle booking update validation, `paymentEvidenceLocks` & `OD-09` invoice void / hold expiry shield, `refundCases` RBAC, consolidated single `allow update` rules & CEL expression-budget optimization preserving all Phase 0/1 contract test signatures
- `firestore.indexes.json` — added composite index `bookings` (`reservationStatus ASC`, `holdExpiresAt ASC`)
- `package.json` — added `"verify:phase2"` script
- `scripts/test-firestore-rules.mjs` — added Phase 2 real Emulator integration & security denial suite (`quote_only` / `OD-13` / Option A `2A..2K`, 13h = 26-slot Deposit Hold, `OD-08`, `OD-09`, unpaid manual expiry + `OD-10` restore, paid expiry `refundCases` RBAC)
- Booking Requests UI/repo/config/utils: `BookingRequestActivityTimeline.jsx`, `BookingRequestDetailDrawer.jsx`, `BookingRequestStatusBadge.jsx`, `booking-request-config.js`, `useBookingRequestDetail.js`, `booking-request-repository.js`, `booking-request-normalize.js`, `booking-request-validation.js`
- Calendar UI/repo/service/config/tests: `calendar.test.jsx`, `BookingDetailDrawer.jsx`, `BookingFormDialog.jsx`, `CalendarBookingCard.jsx`, `UpcomingBookings.jsx`, `calendar-config.js`, `AdminCalendarPage.jsx`, `calendar-booking-repository.js`, `calendar-booking-service.js`, `booking-time.js`
- Dashboard & Public Availability: `DashboardNeedsAttention.jsx`, `dashboard-config.js`, `useDashboardData.js`, `dashboard-calculations.js`, `public-availability-calculation.js`
- Payment, Evidence & Booking Policies: `payment-repository.js`, `payment-schema.js`, `invoice-service.js`, `payment-service.js`, `booking-policies-repository.js`, `payment-evidence-repository.js`, `payment-evidence-service.js`
- Client Portal: `ClientInvoiceDetailDrawer.jsx`, `client-billing-utils.js`, `ClientBookingCard.jsx`, `ClientBookingsPage.jsx`, `ClientInvoicesPage.jsx`, `client-bookings-utils.js`
- Danger Area / Factory Reset: `factory-reset-config.js`, `factory-reset-repository.js`, `factory-reset.test.jsx`
- Docs: `docs/project/37V2-PROJECT-CONTEXT.md`, `docs/handoffs/HANDOFF-PHASE-1-CORE-DOMAIN-IDENTITY-POLICY-FOUNDATION.md`, `docs/handoffs/PHASE-1-OWNER-ACCEPTANCE-RECORD.md`, `docs/architecture/PHASE-2-OFFER-DEPOSIT-HOLD-IMPLEMENTATION.md`, `docs/handoffs/HANDOFF-PHASE-2-OFFER-REVISIONS-DEPOSIT-HOLD-ENGINE.md`

---

## 4. Owner Acceptance & Phase 3 Transition Record

1. **Owner Acceptance of Phase 2 (`d9125b9446b53871f062f2f0d5b37ab6db73b1b3`):** On `2026-11-28`, the Owner explicitly accepted Phase 2 (`"phase 2 selesai bro, lanjut phase 3"`, recorded in `docs/handoffs/PHASE-2-OWNER-ACCEPTANCE-RECORD.md`) and authorized local Phase 3 development on `feature/phase-3-multi-method-payments-staff-cash-adjustments`.
2. **Production Deployment Preconditions (Remain Not Executed):**
   - Neither Phase 1 nor Phase 2 rules/indexes/code have been deployed to live Firebase.
   - Live `clientReservations` backfill from Phase 1/2 has not been run.
   - Do **not** merge to `main` or run `firebase deploy` without explicit Owner deployment authorization.
