# Phase 2 — Offer Revisions & Deposit Hold Engine Implementation

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `feature/phase-2-offer-revisions-deposit-hold-engine`  
**Base Accepted Phase 1 Commit:** `2762923ea6de93345058b97012951555f1a354f2`  
**Owner ADR Resolution (`2026-11-28`, `"saya pilih opsi A"`):** **Choice A Selected** — `offerMode = 'deposit_hold_offer'` is active end-to-end.  
**Target Environment Mode:** Local development, automated tests, and documentation only (no Firebase production deployment or backfill performed)  
**Overall Gate Status:** Both `quote_only` and `deposit_hold_offer` (Option A) Offer workflows, Policy Runtime Engine, Deposit Hold Lifecycle (`create`, `extend`, `manual expiry`, `confirm`, `restore`, `OD-09` pending-evidence shield, `refundCases` handoff), Client Portal Option A Offer + Deposit Hold flow, and Firestore Rules/Indexes are implemented and verified locally (`verify:phase1` and `verify:phase2`).

---

## 1. Resolved Owner ADR Architecture (`deposit_hold_offer` — Choice A)

Per Owner decision on `2026-11-28` (`"saya pilih opsi A"`), the Spark security-boundary flow for `offerMode = 'deposit_hold_offer'` uses **Option A**:

- **At Offer Send Time (Staff Authority):** When Staff sends or revises an Offer with `offerMode = 'deposit_hold_offer'`, Staff atomically creates:
  1. Provisional `bookings/{provisionalBookingId}` (`reservationStatus = 'deposit_hold'`, `sessionStatus = 'pending_confirmation'`, `holdExpiresAt = holdDeadline`, `sourceRequestId`, `acceptedOfferId`)
  2. All 30-minute `bookingSlots/{date__studioId__slotStartMinute}` locks + `publicAvailability/{provisionalBookingId}`
  3. Issued unpaid `invoices/inv_{provisionalBookingId}` (`clientPaymentEvidenceRequired: Boolean(clientUid)`)
  4. Customer-safe `clientReservations/{provisionalBookingId}` projection + `bookingEvents`
  5. `publicBookingRequests/{requestId}/offers/{offerId}` (`status = 'sent'`, `provisionalBookingId`, `holdDeadline`) + parent `publicBookingRequests/{requestId}` (`status = 'offer_sent'`, `activeOfferSummary` with `provisionalBookingId` & `holdExpiresAt`) + `activities`
- **No-Deposit Guard:** Because a provisional `deposit_hold` has no meaning when minimum DP is `Rp 0`, `createAndSendOffer` fails closed with `offer/deposit-not-required` when `depositPolicySnapshot.type === 'none' || minimumDepositAmount <= 0` (directing Staff to use `quote_only`).
- **Client Action Boundary Preserved:** `acceptClientOffer` and `rejectClientOffer` still mutate **ONLY** `offers/{offerId}`, `publicBookingRequests/{requestId}`, and `activities/{actId}` (Clients never write `bookings`, `bookingSlots`, `publicAvailability`, or `invoices`), while Clients can immediately upload DP payment evidence against `inv_{provisionalBookingId}`.
- **Revision, Withdraw, Manual Expiry & DP Confirmation Sync:**
  - Superseding, withdrawing, expiring, or Staff-rejecting an active/rejected `deposit_hold_offer` atomically checks `OD-09` (`paymentEvidenceLocks` / zero `pending_review` evidence) and zero verified payments (`amountPaid === 0`, otherwise failing closed with `offer/provisional-hold-has-payment` so Hold Ledger / `refundCases` handles refunds), then releases all unneeded 30-minute slots, voids `inv_{provisionalBookingId}`, expires the provisional booking, and updates `clientReservations`.
  - Double-booking prevention: `createReservationFromOffer` / `createBooking` rejects creating a second booking from a `deposit_hold_offer` that already owns an active `provisionalBookingId` (`offer/provisional-booking-exists`).
  - Automatic Request Confirmation Sync: `verifyClientPaymentEvidence`, `recordInvoicePayment`, and `confirmReservation` call shared `finalizeBookingRequestInTx` so once a provisional hold confirms (`deposit_verified` or authorized override), the parent `publicBookingRequests/{requestId}` atomically advances to `confirmed` with `linkedBookingId` and `confirmedBookingSnapshot`.
- **Fail-Closed Rules & Validation:** Unrecognized `offerMode` values remain rejected (`offer/invalid-mode`), and Firestore Rules (`isValidOfferCreate`, `isValidOfferStaffUpdate`, `isValidOfferClientRespondUpdate`, `isValidBookingRequestOfferUpdateByStaff`, `isValidBookingRequestClientOfferResponseUpdate`) enforce atomic coupling between `deposit_hold_offer` and its backing `bookings/{provisionalBookingId}` + `invoices/inv_{provisionalBookingId}`.

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

### Transactional Workflows (`offer-service.js` + `calendar-booking-service.js`)
- `createAndSendOffer` / `reviseOffer`:
  - Supports both `quote_only` and Option A `deposit_hold_offer` (while enforcing `offer/deposit-not-required` when DP is `none` / `<= 0` and `offer/invalid-mode` on unknown modes).
  - Reads request, pricing/policy snapshots, and prior active/rejected Offer hold state before writing (`TX` read-before-write).
  - Enforces **OD-13** monotonic revision supersession (`superseded` + `supersededByOfferId` on prior `sent` revision when Staff issues a revision), atomically releasing any unpaid/unlocked provisional holds (preserving slot continuity when revising across overlapping slots), increments `revisionNumber` (`OFF-01`, `OFF-02`, `OFF-03`, ...), appends request activity timeline entries, and updates request summary atomically.
- `acceptClientOffer` / `rejectClientOffer`:
  - Verifies active Client ownership (`client_portal` request match) and checks offer deadline (`isOfferExpiredByTime` / Firestore Rules `request.time <= prevData.offerExpiresAt`) for both `quote_only` and `deposit_hold_offer`.
  - Touches only `offers`, `publicBookingRequests`, and `activities`; stale or superseded offer IDs fail deterministically.
- `withdrawOffer` / `expireOffer` / `staffRecordOfferResponse`:
  - Staff/Owner workflows for withdrawing an active Offer, manually marking a sent Offer expired (`AD-05` — zero scheduled cron jobs), or recording offline client responses on non-Client-Portal requests, atomically releasing any unpaid/unlocked `deposit_hold_offer` provisional booking (`OD-09` enforced).
- **UI Components:**
  - Admin: `OfferComposerCard.jsx` (supports Option A mode toggle, live DP & WIB hold deadline preview, rejected hold release), `OfferRevisionHistoryList.jsx`, integrated into `BookingRequestDetailDrawer.jsx` (surfaces active Option A Hold Calendar link instead of duplicate booking conversion) & `BookingRequestActivityTimeline.jsx`.
  - Client Portal: `ClientOfferReviewCard.jsx` inside `ClientBookingsPage.jsx` / `ClientBookingCard.jsx` (`client-bookings-utils.js` preserves active request/offer metadata onto Option A `deposit_hold` cards and directs Clients to `/portal/invoices` for DP upload).

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
- Current rules source size: **`233,477` bytes** (below Firebase's 256 KiB source limit).
- Enforces:
  - Offer subcollection rules (`isValidOfferCreate`, `isValidOfferStaffUpdate`, `isValidOfferClientRespondUpdate`, plus Option A helpers `isValidDepositHoldOfferProvisionalLink`, `isValidDepositHoldOfferReleaseAfter`, `isValidDepositHoldOfferConfirmAcceptAfter`) enforcing `quote_only` (`provisionalBookingId == null`), Option A `deposit_hold_offer` atomic backing by a `deposit_hold` booking + `inv_{provisionalBookingId}`, atomic provisional hold expiry on Offer supersede/withdraw/expire, and `request.time <= prevData.offerExpiresAt` on client acceptance.
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
- **Explicit Out of Scope:** Production Firebase deployment (`firestore.rules`, `firestore.indexes.json`, Hosting), production `clientReservations` backfill, branch merge/PR/push to `main`, and Phase 3–5 features (`bookingChangeRequests`, `adjustments`, `projects`).
