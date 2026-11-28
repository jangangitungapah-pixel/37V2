# Phase 2 — Offer Revisions & Deposit Hold Engine Implementation

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `feature/phase-2-offer-revisions-deposit-hold-engine`  
**Base Accepted Phase 1 Commit:** `2762923ea6de93345058b97012951555f1a354f2`  
**Target Environment Mode:** Local development, automated tests, and documentation only (no Firebase production deployment or backfill performed)  
**Overall Gate Status (Dependent Path ADR):** `quote_only` Offers, Policy Runtime Engine, Deposit Hold Lifecycle (`create`, `extend`, `manual expiry`, `confirm`, `restore`, `OD-09` pending-evidence shield, `refundCases` handoff), and Firestore Rules/Indexes are implemented and locally verified. The `deposit_hold_offer` mode remains **explicitly BLOCKED** behind `offer/deposit-hold-timing-unresolved` pending an Owner Architecture Decision Record (ADR Choice A vs Choice B).

---

## 1. Explicit ADR Blocking Boundary (`deposit_hold_offer`)

Until the Owner resolves the Spark security-boundary timing question for provisional holds issued *within* an Offer:

- **Choice A:** Staff creates an unpaid provisional `deposit_hold` booking + issued invoice atomically at Offer send time (so Client Portal payment evidence attaches to an existing Staff-created invoice before Offer acceptance).
- **Choice B:** Client accepts the `deposit_hold_offer` first, and a separate Staff conversion action issues the `deposit_hold` booking + invoice afterward.

**Implemented Fail-Closed Guard:**
- `src/features/admin/booking-requests/schemas/offer-schema.js` defines `OFFER_MODES.QUOTE_ONLY` (`'quote_only'`), `OFFER_MODES.DEPOSIT_HOLD_OFFER` (`'deposit_hold_offer'`), `DEPOSIT_HOLD_OFFER_BLOCK_ERROR_CODE = 'offer/deposit-hold-timing-unresolved'`, and `assertOfferModeAuthorized(offerMode)`.
- `offer-service.js` and `firestore.rules` (`isValidOfferCreate`, `isValidOfferStaffUpdate`, `isValidOfferClientRespondUpdate`) restrict active offers strictly to `offerMode == 'quote_only'` and `provisionalBookingId == null` until the Owner resolves Choice A vs Choice B.

---

## 2. Booking Policy Runtime Engine (`OD-01` .. `OD-07`)

Module: `src/features/admin/settings/booking-policies/utils/booking-policy-engine.js`

| Export | Responsibility | Key Invariants |
|---|---|---|
| `DEPOSIT_STATUS` | Canonical DP fulfillment states | `not_required`, `awaiting_deposit`, `partial_below_minimum`, `met` |
| `resolvePolicySourceTier` | Precedence resolution | `option_override` > `service_override` > `default` across `depositPolicy`, `holdPolicy`, `balanceDuePolicy` |
| `computeMinimumDepositAmount` | Integer IDR DP calculation | Supports fixed, percentage, or none policies using `Math.round` / integer arithmetic without floating-point currency drift |
| `computeDepositStatus` | Reconciles paid amount vs minimum DP | Returns `not_required` when minimum DP <= 0; otherwise `awaiting_deposit` / `partial_below_minimum` / `met` |
| `buildDepositPolicySnapshot` | Historical policy snapshot | Captures resolved policy metadata (`type`, `minimumDepositAmount`, tier source, `policyVersion`) onto Offer / Booking / Invoice |
| `resolveEffectiveHoldDeadline` | Computes TTL in `Asia/Jakarta` | Enforces fail-closed validation and clamps hold expiration strictly before session start time in WIB (`UTC+7`) |
| `resolveBalanceDuePolicySnapshot` | Resolves balance due date (`Asia/Jakarta`) | Derives `dueDate` (`YYYY-MM-DD`) and trigger metadata only when policy version >= 1 or explicitly provided |

---

## 3. Offer Revisions Domain (`OD-13`)

Subcollection: `publicBookingRequests/{requestId}/offers/{offerId}` (`BOOKING_REQUEST_OFFERS_SUBCOLLECTION = 'offers'`, `OFFER_SCHEMA_VERSION = 1`)

### Schema, State Machine & Normalization
- **Statuses (`OFFER_STATUSES`):** `sent`, `accepted`, `rejected`, `superseded`, `withdrawn`, `expired`.
- **Terminal Set (`OFFER_TERMINAL_STATUSES`):** all statuses except `sent`.
- **Parent Summary & Client Projection:** `buildActiveOfferSummary(offer)` maintains summary fields on `publicBookingRequests/{requestId}` (`activeOfferId`, `activeOfferSummary`, `activeOfferStatus`, etc.), while `projectClientOfferRecord(offer)` sanitizes internal fields before client rendering.

### Transactional Workflows (`offer-service.js`)
- `createAndSendOffer` / `reviseOffer`:
  - Rejects `deposit_hold_offer` with `offer/deposit-hold-timing-unresolved`.
  - Reads request, pricing/policy snapshots, and prior active `sent` Offer before writing (`TX` read-before-write).
  - Enforces **OD-13** monotonic revision supersession (`superseded` + `supersededByOfferId` on prior `sent` revision when Staff issues a revision), increments `revisionNumber` (`OFF-01`, `OFF-02`, `OFF-03`, ...), appends request activity timeline entries, and updates request summary atomically.
- `acceptClientOffer` / `rejectClientOffer`:
  - Verifies active Client ownership (`client_portal` request match) and checks offer deadline (`isOfferExpiredByTime` / Firestore Rules `request.time <= prevData.offerExpiresAt`).
  - Stale or superseded offer IDs fail deterministically without overwriting newer revisions.
- `withdrawOffer` / `expireOffer` / `staffRecordOfferResponse`:
  - Staff/Owner workflows for withdrawing an active Offer, manually marking a sent Offer expired (`AD-05` — zero scheduled cron jobs), or recording offline client acceptance/rejection on non-Client-Portal requests (matching `isValidOfferStaffUpdate` rules).
- **UI Components:**
  - Admin: `OfferComposerCard.jsx`, `OfferRevisionHistoryList.jsx`, integrated into `BookingRequestDetailDrawer.jsx` & `BookingRequestActivityTimeline.jsx`.
  - Client Portal: `ClientOfferReviewCard.jsx` inside `ClientBookingsPage.jsx` / `ClientBookingCard.jsx`.

---

## 4. Reservation & Deposit Hold Lifecycle (`OD-01`, `OD-02`, `OD-04`, `OD-08`, `OD-09`, `OD-10`)

### Domain States (`src/features/admin/calendar/config/calendar-config.js`)
- **`RESERVATION_STATUS`:** `deposit_hold`, `confirmed`, `expired`, `cancelled`.
- **`BOOKING_SESSION_STATUS`:** `pending_confirmation`, `upcoming`, `in_progress`, `completed`, `no_show`, `cancelled`.
- **`CONFIRMATION_SOURCES`:** `deposit_verified`, `no_deposit_policy`, `staff_override`, `legacy_confirmed`.
- **`BOOKING_EVENT_TYPES`:** adds `hold_created`, `hold_extended`, `hold_expired`, `reservation_confirmed`, `reservation_restored_from_expiry`, `late_payment_routed_to_refund`.
- **`CANCELLATION_TYPES`:** `client_cancel`, `studio_cancel`, `hold_expired`, `no_show`.

### Booking Creation & Offer Conversion (`calendar-booking-service.js`)
- `createBooking` (aliased as `createReservation`) and `createReservationFromOffer`:
  - Verifies accepted Offer invariants when converting from an accepted request (blocks rejected/superseded/mismatched-price/room/schedule offers).
  - Determines initial reservation state from effective DP policy and initial payment:
    - When minimum DP > 0 and unpaid/below minimum: creates `deposit_hold` + `pending_confirmation` session with `holdExpiresAt` deadline (in `Asia/Jakarta`) and acquires all 30-minute `bookingSlots`.
    - When no DP is required or DP is met (`initialPaidAmount >= minimumDepositAmount`): creates `confirmed` + `upcoming`.
  - Writes canonical `booking`, deterministic `invoice` (`inv_{bookingId}`), optional `paymentTransaction`, `bookingSlots`, `publicAvailability`, `clientReservations/{bookingId}`, `bookingEvents`, and request confirmation atomically.
- `updateOrRescheduleBooking`, `cancelBooking`, `transitionBookingSession`:
  - `check_in` / `start` / `complete` / `no_show` are blocked while a booking is in `deposit_hold` / `pending_confirmation` or `expired`.
  - `normalizeBookingReservationStatus` in `booking-time.js` prioritizes explicit `booking.reservationStatus` before inspecting `sessionStatus === 'cancelled'` fallback so `expired` holds are never misclassified as `cancelled`.

### Hold Lifecycle Operations (`reservation-hold-service.js`)
- **`confirmReservation` (`OD-01`, `OD-04`):** promotes `deposit_hold` -> `confirmed` and `pending_confirmation` -> `upcoming` (clears `holdExpiresAt`, records `confirmedAt`/`confirmedByUid`/`confirmationSource`) under `no_deposit_policy`, `deposit_verified` (verifying `invAfter.amountPaid >= minimumDepositAmount`), or authorized `staff_override` with mandatory override reason (>= 5 chars).
- **`extendReservationHold` (`OD-08`):** Staff/Owner-only (`holdExtensionCount` incremented optimistically, `holdExpiresAt`, `holdLastExtendedAt`, `holdLastExtendedByUid`, `holdLastExtensionReason` >= 5 chars) while preserving `deposit_hold` + `pending_confirmation`.
- **`expireReservationHold` (`AD-05`, `OD-09`):**
  - Strictly manual trigger (zero scheduled/background expiry jobs, compliant with Firebase Spark-only architecture).
  - **OD-09 Pending-Evidence Shield:** reads `paymentEvidenceLocks/{invoiceId}`; aborts if `pendingCount > 0` (`permission-denied` in Rules and service validation in app code).
  - Unpaid expiry (`amountPaid == 0`): transitions booking to `expired` / `cancelled`, voids invoice (`invoiceStatus = 'void'`), deletes owned `bookingSlots` and `publicAvailability`, and syncs `clientReservations`.
  - Paid expiry (`amountPaid > 0`): leaves historical invoice financial ledger intact (`voidInvoice` cannot void paid invoices) and atomically creates `refundCases/{refundId}` (`status = 'under_review'`, `triggerCategory = 'hold_expired_partial_paid'`).
- **`restoreExpiredReservation` (`OD-10`):**
  - Re-validates all required 30-minute `bookingSlots` for availability. If occupied, restoration aborts cleanly without mutating slots.
  - If slots are free: re-acquires `bookingSlots`, restores `booking` (`deposit_hold` or `confirmed` if DP met), unvoids voided unpaid invoice back to `issued`, restores `publicAvailability`, and updates `clientReservations` atomically.
- **UI Workflows:** `HoldLifecyclePanel.jsx` (integrated into `BookingDetailDrawer.jsx` and surfaced in `AdminCalendarPage.jsx` / `CalendarBookingCard.jsx` / `UpcomingBookings.jsx`), Dashboard overdue hold alerts (`DashboardNeedsAttention.jsx`, `useDashboardData.js`, `dashboard-calculations.js`), and Client DP gap / hold deadline visibility (`ClientInvoiceDetailDrawer.jsx`, `ClientBookingCard.jsx`, `ClientInvoicesPage.jsx`, `client-bookings-utils.js`, `client-billing-utils.js`).

---

## 5. Payment, Invoice & OD-09 Lock Integration

- **Pending-Evidence Lock (`paymentEvidenceLocks/{invoiceId}`):**
  - `submitClientPaymentEvidence` (`payment-evidence-service.js`) creates/increments `pendingCount` and `pendingEvidenceIds` atomically with `paymentEvidence/{evidenceId}`.
  - `verifyClientPaymentEvidence` and `rejectClientPaymentEvidence` decrement/clear the lock in the same atomic commit as evidence review.
  - `voidInvoice` (`invoice-service.js`) and `expireReservationHold` (`reservation-hold-service.js`) both inspect `paymentEvidenceLocks/{invoiceId}` and reject when `pendingCount > 0`. Rules enforce `isInvoiceWithoutPendingEvidenceLock(invoiceId)` and `isHoldExpiryAllowedByLockAndInvoice(bookingId)`.
- **Payment & Reversal Auto-Sync (`payment-service.js`):**
  - `applyValidatedPaymentInTransaction` updates `depositStatus` (`computeDepositStatus`) cleanly when DP snapshots exist (preserving V1 legacy bookings without `depositPolicySnapshot` / `depositStatus`), automatically confirms an eligible `deposit_hold` booking when minimum DP becomes `met` (`deposit_verified`), or routes late payment against an already `expired` booking without free room slots/auto-resurrection into `refundCases` + `LATE_PAYMENT_REFUND_CASE` event (`OD-10`).
  - `reversePaymentTransaction` recalculates invoice and `depositStatus` / `depositIntegrityAlert` when a confirmed booking's net paid drops below minimum deposit.

---

## 6. Firestore Security Rules Optimization & Indexes

### Security Rules Architecture & CEL Expression-Budget Optimization (`firestore.rules`)
- Current rules source size: **`230,887` bytes** (below Firebase's 256 KiB source limit).
- Enforces:
  - Offer subcollection rules (`isValidOfferCreate`, `isValidOfferStaffUpdate`, `isValidOfferClientRespondUpdate`) hard-blocking `offerMode != 'quote_only'` and enforcing `request.time <= prevData.offerExpiresAt` on client acceptance.
  - Consolidated single `allow update:` rules on `/bookings/{bookingId}` and `/invoices/{invoiceId}` to avoid multi-rule redundant re-evaluation of `isActiveStaff()`, `!isFactoryResetLocked()`, `isValidInvoiceBase(...)`, and `reqData.diff(resData).affectedKeys()`.
  - Direct O(1) pre-checks before `.diff()` calls (`isBookingLifecycleEligibleBeforeDiff`, `isBookingHoldImmutableFieldsUnchanged`, direct `isInvoiceImmutableFieldsUnchanged` equality checks) and staff/lock short-circuit ordering on `bookingSlots` and `publicAvailability` deletes, keeping worst-case multi-document commits (e.g., 13h = 26-slot `deposit_hold` create, manual expiry + invoice void + 26-slot release, and `OD-10` restore) safely under Firestore's 1,000-expression evaluation cap while retaining all legacy Phase 0/1 Vitest contract signatures (`isValidBookingUpdateKeys`, `isBookingLifecycleOnlyUpdate`, `isLegacyBookingCustomerLinkUpdate`, `isBookingAutomaticDiscountMathMatched`, `isValidInvoiceVoidUpdate`).
  - `refundCases/{refundId}` rules allowing Staff/Owner creation on expired bookings with positive `maxRefundableAmount`, Client read scoped to `clientUid == request.auth.uid`, and immutable updates (`allow update: if false`).
  - `paymentEvidenceLocks/{invoiceId}` write rules allowing client increment on evidence submit and Staff/Owner lock updates during verify/reject.

### Composite Indexes (`firestore.indexes.json`) & Factory Reset (`factory-reset-config.js`)
- Added composite index on `bookings`: `reservationStatus ASC` + `holdExpiresAt ASC`.
- Expanded `FACTORY_RESET_DELETION_MANIFEST` to 28 explicit ordered deletion targets by adding `publicBookingRequests_offers`, `paymentEvidenceLocks`, and `refundCases` (matching updated batch-failure guard coverage in `factory-reset.test.jsx`).

---

## 7. Firebase Spark Boundary & Out-of-Scope Confirmation

- **Spark-Only Compliance:** Zero Cloud Functions, zero Firebase Storage, zero Blaze/Cloud Billing APIs, and zero background schedulers/cron jobs were added. Hold expiration and offer expiration evaluation are explicit Staff/Owner manual actions + read-time deadline checks + Security Rules `request.time` enforcement.
- **Explicit Out of Scope:** Production Firebase deployment (`firestore.rules`, `firestore.indexes.json`, Hosting), production `clientReservations` backfill, branch merge/PR/push to `main`, activation of `deposit_hold_offer`, and Phase 3–5 features (`bookingChangeRequests`, `adjustments`, `projects`).
