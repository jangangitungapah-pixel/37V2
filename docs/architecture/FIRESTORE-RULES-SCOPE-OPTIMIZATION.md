# Firestore Rules Scope Optimization & Compiled-Size Remediation

**Project:** 37 Music Studio (`37V2`)  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `feature/phase-3-multi-method-payments-staff-cash-adjustments`  
**Starting Remediation Commit:** `47c3a5ed56316a3a312bb91704bb5ae918bf7a6d` (`feat(phase3): implement multi-method payments, staff cash desk & invoice adjustments`)  
**Base Accepted Phase 2 SHA:** `d9125b9446b53871f062f2f0d5b37ab6db73b1b3`  
**Deployment Status:** Local branch remediation only — NO Firebase production deploy, release mutation, index/hosting deploy, or data backfill executed.

---

## 1. Production Incident & Root Cause

- **Target Firebase Project:** `studio37classic` (`(default)`, `asia-southeast2`, Spark/free-tier).
- **Previous Active Production Ruleset:** `2ca8e80a-50ee-4a5d-8d6d-913d3c91cab9` (`updateTime: 2026-11-24T15:26:52.373102Z`, still active and unmodified).
- **Rejected Phase 3 Ruleset:** `65f12907-04f3-40e8-9ff2-278ac527da9d` (SHA-256 `730cb06bb1805de3e9225374e94995d88024bef646693c7a00b258a04c8655f4`, identical to `47c3a5e:firestore.rules`, `235,980` LF UTF-8 bytes).
- **Production Error:** Controlled release PATCH failed with `HTTP 400 INVALID_ARGUMENT: Total size of compiled executables must be smaller than 256000 bytes (actual: 331716 bytes)`.
- **Root Cause:** At baseline `47c3a5e`, all `202` helper functions were declared inside the broad root `match /databases/{database}/documents` block and inherited/compiled into every one of the `47` child collection and nested subcollection match scopes, inflating symbol/scope expansion into `331,716` compiled executable bytes (exceeding the `256,000`-byte hard limit by `75,717+` bytes).

### Measurement Methodology & Byte-Count Reconciliation
- **Source UTF-8 Bytes (LF-normalized):** Git stores LF line endings (`\n`). At `47c3a5e`, `firestore.rules` measured **`235,980` UTF-8 LF bytes**; after scope localization (additional 2–4 spaces indentation on relocated match functions), source measures **`244,017` UTF-8 LF bytes** (limit strictly `< 262,144` bytes).
- **Windows Disk UTF-8 Bytes (CRLF):** On Windows checkouts (`\r\n`), `47c3a5e` measured **`241,463` bytes** and post-remediation measures **`249,490` bytes** (`+5,473` bytes from CRLF line endings). The earlier handoff reference to `241,463` bytes reflected Windows CRLF disk bytes / API character display length rather than Git LF UTF-8 bytes.
- **Compiled Executable Bytes:** Produced exclusively by the Firebase backend compiler when creating/activating a production Ruleset. The local Firestore Emulator does not report production compiled executable size; since `.firebaserc` configures only production `studio37classic` and no staging project exists, post-refactor compiled executable size is **`NOT MEASURED`** locally and must be confirmed strictly `< 256,000` bytes on the next separately authorized production publish.

---

## 2. Before vs After Metrics

| Metric | Baseline (`47c3a5e`) | Post-Remediation | Delta |
|---|---:|---:|---:|
| Source UTF-8 Bytes (LF-normalized) | 235980 | 244017 | +8037 (< 262,144 limit) |
| Source Disk Bytes (Windows CRLF) | 241463 | 249490 | +8027 |
| Top-level Collection Match Blocks | 43 | 43 | 0 |
| Nested Subcollection Match Blocks | 4 | 4 | 0 |
| Total Helpers Declared | 202 | 201 | -1 (unused helper removed) |
| Root-Scoped Helpers (`/databases/{database}/documents`) | 202 | 30 | -172 (-85.1%) |
| Collection / Subcollection Localized Helpers | 0 | 171 | +171 |
| Localizable Root Candidates Remaining | 171 | 0 | -171 |
| Unused Helper Declarations | 1 | 0 | -1 |
| Scope / Wildcard Resolution Errors | 0 | 0 | 0 |
| Production Compiled Executable Bytes | 331,716 (rejected) | NOT MEASURED (pending authorized deploy) | Pending backend publish check |

---

## 3. Security Semantics Preservation & Compiler Warnings

- **Token-for-Token Semantic Equivalence:** Verified programmatically via `tokenizeFirestoreRules` & `parseFirestoreRulesTree` (`scripts/audit-firestore-rules-scope.mjs`): all `48` `match` blocks (`1` root + `43` collections + `4` subcollections), all `allow` expressions, and all `201` retained helper parameter lists and function bodies preserve identical normalized token streams. Relocated functions are positioned cleanly inside their narrowest enclosing `match` block after `allow` declarations so all existing structural contract regex checks (`public-availability.test.jsx`) remain intact.
- **Invariants Preserved:** All Phase 0–3 contracts remain intact without weakening predicates: Owner/Staff/Client RBAC, `clientReservations` projection read/write coupling, Option A `deposit_hold_offer` + `getAfter` invariants, Staff Desk Cash vs Client Portal non-cash proof boundaries, `500`-char secure URL cap on new uploads with `600`-char legacy support, `50`-pending lock cap, immutable `financialSnapshot` & append-only `/adjustments`, `draft -> issued`, active Client review submission, and Factory Reset `29`-target cleanup order.
- **Compiler Warnings Audit:**
  - **Removed:** Unused function `isValidBookingCreate` (baseline lines `916-924`) had `0` direct or transitive callers because `match /bookings/{bookingId}` (`allow create`) already directly enforces all 7 checks (`isValidBookingKeys`, `isValidBookingShape`, `hasValidBookingCustomerLinkAfter`, `isBookingAutomaticDiscountMathMatched`, `createdByUid == request.auth.uid`, `updatedByUid == request.auth.uid`, `version == 1`). Removing `isValidBookingCreate` also eliminates its associated unused-function compiler warning and its nested `request.auth.uid` invalid-variable warning.
  - **Pre-Existing Retained Warnings:** Nullable `get()` / `getAfter()` ternary expressions returning `null` vs document maps (`isActiveStaff`, `isActiveOwner`, `getFactoryResetOperation`, etc.) predate this refactor and remain untouched intentionally so cross-document null guards remain identical and regression-free.

---

## 4. Unused Helpers Removed (1)

- `isValidBookingCreate` (baseline lines `916-924`, old scope `/databases/{database}/documents`): `0` direct callers (`allow` rules or helper functions); replaced identically by inline `allow create` expressions in `match /bookings/{bookingId}`.

---

## 5. Helpers Intentionally Retained at Root (30)

Each helper below reaches `2` to `42` separate top-level collection subtrees with no common domain `match` ancestor below `/databases/{database}/documents`, so retaining one shared declaration at root prevents cross-sibling duplication.

| Helper | Baseline Line | New Line | Collection Subtrees Reached | Rationale (Direct / Transitive Subtrees) |
|---|---:|---:|---:|---|
| `isActiveStaff` | 6 | 6 | 24 | Shared across 24 subtrees: `/bookingEvents/{eventId}`, `/bookingRequestMessageTemplates/{templateId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customerReviews/{bookingId}`, `/customers/{customerId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}`, `/settings/bookingPolicies`, `/settings/pricing`, `/settings/studioProfile` |
| `isActiveOwner` | 15 | 15 | 42 | Shared across 42 subtrees: `/bookingEvents/{eventId}`, `/bookingRequestMessageTemplates/{templateId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/bookkeepingEntries/{entryId}`, `/bookkeepingSettings/{docId}`, `/bookkeepingSettlements/{settlementId}`, `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientIdentityLinkAudits/{operationId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/commissionBatches/{batchId}`, `/commissionPostingItems/{itemId}`, `/commissionReviewResolutions/{resolutionId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customerReviews/{bookingId}`, `/customers/{customerId}`, `/galleryItems/{galleryItemId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/landingPagePlacements/{placementId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicAvailabilityMetadata/{docId}`, `/publicBookingRequests/{requestId}`, `/publicPricingCatalog/{docId}`, `/publicReviewStats/{docId}`, `/publicSiteSettings/{docId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}`, `/settings/bookingPolicies`, `/settings/clientReservationBackfill`, `/settings/pricing`, `/settings/studioProfile`, `/systemOperations/clientReservationBackfill`, `/systemOperations/{operationId}` |
| `isAnyStaffProfile` | 24 | 24 | 13 | Shared across 13 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerReviews/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `isValidNormalizedEmail` | 29 | 29 | 14 | Shared across 14 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerReviews/{bookingId}`, `/customers/{customerId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `hasVerifiedGoogleEmail` | 36 | 36 | 3 | Shared across 3 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/customerEmailIndex/{normalizedEmail}` |
| `hasEligibleClientAuth` | 47 | 47 | 12 | Shared across 12 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerReviews/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `normalizedAuthEmail` | 63 | 63 | 4 | Shared across 4 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/customerEmailIndex/{normalizedEmail}` |
| `getClientAccountDoc` | 67 | 67 | 13 | Shared across 13 subtrees: `/bookings/{bookingId}`, `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerReviews/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `isValidActiveClientAccountDoc` | 71 | 71 | 11 | Shared across 11 subtrees: `/clientAccounts/{uid}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerReviews/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `isActiveClient` | 80 | 80 | 11 | Shared across 11 subtrees: `/clientAccounts/{uid}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/customerReviews/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitations/{tokenHash}` |
| `isActiveClientCustomerMatch` | 87 | 87 | 7 | Shared across 7 subtrees: `/bookings/{bookingId}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `isClientOwnerOfCustomer` | 110 | 105 | 6 | Shared across 6 subtrees: `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `isClientUidOwner` | 118 | 113 | 4 | Shared across 4 subtrees: `/clientReservations/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `isClientDocumentOwner` | 126 | 121 | 4 | Shared across 4 subtrees: `/clientReservations/{bookingId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `isClientReadableParentInvoiceDoc` | 140 | 129 | 3 | Shared across 3 subtrees: `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `isClientReadableParentInvoice` | 156 | 145 | 2 | Shared across 2 subtrees: `/paymentEvidence/{evidenceId}`, `/paymentTransactions/{transactionId}` |
| `getFactoryResetOperation` | 164 | 153 | 31 | Shared across 31 subtrees: `/bookingEvents/{eventId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/bookkeepingEntries/{entryId}`, `/bookkeepingSettlements/{settlementId}`, `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientIdentityLinkAudits/{operationId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/commissionBatches/{batchId}`, `/commissionPostingItems/{itemId}`, `/commissionReviewResolutions/{resolutionId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customerReviews/{bookingId}`, `/customers/{customerId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}`, `/settings/bookingPolicies`, `/settings/clientReservationBackfill`, `/systemOperations/clientReservationBackfill` |
| `isFactoryResetLocked` | 170 | 159 | 31 | Shared across 31 subtrees: `/bookingEvents/{eventId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/bookkeepingEntries/{entryId}`, `/bookkeepingSettlements/{settlementId}`, `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientIdentityLinkAudits/{operationId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/commissionBatches/{batchId}`, `/commissionPostingItems/{itemId}`, `/commissionReviewResolutions/{resolutionId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customerReviews/{bookingId}`, `/customers/{customerId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}`, `/settings/bookingPolicies`, `/settings/clientReservationBackfill`, `/systemOperations/clientReservationBackfill` |
| `isFactoryResetRunning` | 176 | 165 | 25 | Shared across 25 subtrees: `/bookingEvents/{eventId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/bookkeepingEntries/{entryId}`, `/bookkeepingSettlements/{settlementId}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/commissionBatches/{batchId}`, `/commissionPostingItems/{itemId}`, `/commissionReviewResolutions/{resolutionId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customers/{customerId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}` |
| `canFactoryResetDelete` | 184 | 173 | 25 | Shared across 25 subtrees: `/bookingEvents/{eventId}`, `/bookingSlots/{slotId}`, `/bookings/{bookingId}`, `/bookkeepingEntries/{entryId}`, `/bookkeepingSettlements/{settlementId}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}`, `/clientReservations/{bookingId}`, `/commissionBatches/{batchId}`, `/commissionPostingItems/{itemId}`, `/commissionReviewResolutions/{resolutionId}`, `/customerEmailIndex/{normalizedEmail}`, `/customerPhoneIndex/{phoneHash}`, `/customers/{customerId}`, `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}`, `/invoices/{invoiceId}`, `/paymentEvidence/{evidenceId}`, `/paymentEvidenceLocks/{invoiceId}`, `/paymentTransactions/{transactionId}`, `/publicAvailability/{bookingId}`, `/publicBookingRequests/{requestId}`, `/refundCases/{refundId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}` |
| `isValidCommissionRoleEntry` | 598 | 177 | 2 | Shared across 2 subtrees: `/bookings/{bookingId}`, `/commissionPostingItems/{itemId}` |
| `isValidBookingCommissionSnapshotV1` | 608 | 187 | 2 | Shared across 2 subtrees: `/bookings/{bookingId}`, `/commissionPostingItems/{itemId}` |
| `isValidBookingCommissionSnapshotV2` | 622 | 201 | 2 | Shared across 2 subtrees: `/bookings/{bookingId}`, `/commissionPostingItems/{itemId}` |
| `isValidConsumableStockMap` | 1883 | 212 | 2 | Shared across 2 subtrees: `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}` |
| `isValidEquipmentStockMap` | 1890 | 219 | 2 | Shared across 2 subtrees: `/inventoryItems/{itemId}`, `/inventoryMovements/{movementId}` |
| `isValidBookkeepingPaymentMethod` | 2235 | 232 | 2 | Shared across 2 subtrees: `/bookkeepingEntries/{entryId}`, `/bookkeepingSettlements/{settlementId}` |
| `isValidSha256Hex` | 4583 | 4573 | 3 | Shared across 3 subtrees: `/customerReviews/{bookingId}`, `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}` |
| `isBookingEligibleForReviewInvitation` | 4587 | 4577 | 2 | Shared across 2 subtrees: `/reviewInvitationIndexes/{bookingId}`, `/reviewInvitations/{tokenHash}` |
| `isClientIdentityLinkAuditId` | 5131 | 4979 | 4 | Shared across 4 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientIdentityLinkAudits/{operationId}`, `/clientProfiles/{customerId}` |
| `isOwnerReviewedIdentityBindingAfter` | 5135 | 4983 | 3 | Shared across 3 subtrees: `/clientAccounts/{uid}`, `/clientCustomerLinks/{customerId}`, `/clientProfiles/{customerId}` |

---

## 6. Relocated Collection & Subcollection Helpers (171)

All `171` helpers below moved from root (`/databases/{database}/documents`) into their exact Lowest Common Ancestor `match` block:

| Helper | Baseline Line | New Narrowest Match Scope | New Line | Direct Callers |
|---|---:|---|---:|---|
| `isActiveLinkedCrmClientCustomerMatch` | 105 | `/bookings/{bookingId}` | 738 | 1 helper(s): `isLegacyBookingCrmClientUidUpdate` |
| `isClientReadableInvoiceData` | 134 | `/invoices/{invoiceId}` | 1630 | 1 `allow` rule(s) |
| `isValidFactoryResetVerificationSummary` | 188 | `/systemOperations/{operationId}` | 255 | 1 helper(s): `isValidFactoryResetOperationShape` |
| `isValidFactoryResetOperationShape` | 206 | `/systemOperations/{operationId}` | 273 | 2 helper(s): `isValidFactoryResetOperationCreate`, `isValidFactoryResetOperationUpdate` |
| `isValidFactoryResetOperationCreate` | 254 | `/systemOperations/{operationId}` | 321 | 1 `allow` rule(s) |
| `isValidFactoryResetOperationUpdate` | 264 | `/systemOperations/{operationId}` | 331 | 1 `allow` rule(s) |
| `isValidBookingKeys` | 306 | `/bookings/{bookingId}` | 743 | 1 `allow` rule(s) |
| `isValidBookingUpdateKeys` | 314 | `/bookings/{bookingId}` | 751 | 1 helper(s): `isValidBookingStandardUpdate` |
| `isBookingLifecycleOnlyUpdate` | 364 | `/bookings/{bookingId}` | 801 | 1 helper(s): `isValidBookingUpdate` |
| `isBookingLifecycleEligibleBeforeDiff` | 409 | `/bookings/{bookingId}` | 846 | 1 helper(s): `isValidBookingUpdate` |
| `isHoldDepositVerifiedByInvoiceAfter` | 431 | `/bookings/{bookingId}` | 868 | 1 helper(s): `isBookingHoldLifecycleUpdate` |
| `isHoldExpiryAllowedByLockAndInvoice` | 436 | `/bookings/{bookingId}` | 873 | 1 helper(s): `isBookingHoldLifecycleUpdate` |
| `isBookingHoldImmutableFieldsUnchanged` | 448 | `/bookings/{bookingId}` | 885 | 1 helper(s): `isBookingHoldLifecycleUpdate` |
| `isBookingHoldLifecycleUpdate` | 476 | `/bookings/{bookingId}` | 913 | 1 helper(s): `isValidBookingUpdate` |
| `isValidBookingV2ServiceFields` | 549 | `/bookings/{bookingId}` | 986 | 1 helper(s): `isValidBookingCoreShape` |
| `isValidAutomaticDiscountMap` | 561 | `/bookings/{bookingId}` | 998 | 1 helper(s): `isValidBookingAutomaticDiscountShape` |
| `isValidBookingAutomaticDiscountShape` | 580 | `/bookings/{bookingId}` | 1017 | 3 helper(s): `isValidBookingShape`, `isValidBookingFocusedPricingUpdate`, `isValidBookingStandardPricingUpdate` |
| `isBookingAutomaticDiscountMathMatched` | 589 | `/bookings/{bookingId}` | 1026 | 1 `allow` rule(s); 2 helper(s): `isValidBookingFocusedPricingUpdate`, `isValidBookingStandardPricingUpdate` |
| `isValidBookingCommissionSnapshot` | 633 | `/bookings/{bookingId}` | 1035 | 3 helper(s): `isValidBookingShape`, `isValidBookingFocusedPricingUpdate`, `isValidBookingStandardPricingUpdate` |
| `isServiceScopeUnchanged` | 643 | `/bookings/{bookingId}` | 1045 | 1 helper(s): `isValidBookingStandardPricingUpdate` |
| `isValidOperationalSettingsV2` | 652 | `/settings/pricing` | 388 | 1 helper(s): `isValidPricingSettings` |
| `isValidPricingSettings` | 659 | `/settings/pricing` | 395 | 2 `allow` rule(s) |
| `isValidStudioProfile` | 671 | `/settings/studioProfile` | 557 | 2 `allow` rule(s) |
| `isValidBookingCoreShape` | 711 | `/bookings/{bookingId}` | 1054 | 2 helper(s): `isValidBookingShape`, `isValidBookingStandardUpdate` |
| `isValidBookingShape` | 778 | `/bookings/{bookingId}` | 1121 | 1 `allow` rule(s) |
| `isValidCustomerShape` | 784 | `/customers/{customerId}` | 620 | 2 `allow` rule(s) |
| `isValidPhoneIndex` | 851 | `/customerPhoneIndex/{phoneHash}` | 704 | 2 `allow` rule(s) |
| `isLinkedCustomerPhoneMatchedAfter` | 865 | `/bookings/{bookingId}` | 1127 | 2 helper(s): `hasValidBookingCustomerLinkAfter`, `isLegacyBookingCustomerLinkUpdate` |
| `hasValidBookingCustomerLinkAfter` | 872 | `/bookings/{bookingId}` | 1134 | 1 `allow` rule(s) |
| `isLegacyBookingCustomerLinkUpdate` | 897 | `/bookings/{bookingId}` | 1159 | 1 helper(s): `isValidBookingUpdate` |
| `isValidBookingFocusedPricingUpdate` | 926 | `/bookings/{bookingId}` | 1178 | 1 helper(s): `isValidBookingUpdate` |
| `isValidBookingStandardPricingUpdate` | 971 | `/bookings/{bookingId}` | 1224 | 1 helper(s): `isValidBookingStandardUpdate` |
| `isValidBookingStandardUpdate` | 994 | `/bookings/{bookingId}` | 1247 | 1 helper(s): `isValidBookingUpdate` |
| `isLegacyBookingClientUidUpdate` | 1001 | `/bookings/{bookingId}` | 1254 | 1 helper(s): `isValidBookingUpdate` |
| `isLegacyBookingCrmClientUidUpdate` | 1025 | `/bookings/{bookingId}` | 1278 | 1 helper(s): `isValidBookingUpdate` |
| `isValidBookingUpdate` | 1050 | `/bookings/{bookingId}` | 1303 | 1 `allow` rule(s) |
| `isValidInvoiceSnapshots` | 1070 | `/invoices/{invoiceId}` | 1636 | 1 helper(s): `isValidInvoiceBase` |
| `isValidInvoicePaymentMath` | 1099 | `/invoices/{invoiceId}` | 1665 | 2 helper(s): `isValidInvoiceBase`, `isValidInvoiceMutableUpdateBase` |
| `isValidInvoiceBase` | 1127 | `/invoices/{invoiceId}` | 1693 | 1 `allow` rule(s) |
| `isValidInvoiceMutableUpdateBase` | 1170 | `/invoices/{invoiceId}` | 1736 | 1 `allow` rule(s) |
| `isValidInitialInvoicePaymentLinkAfter` | 1194 | `/invoices/{invoiceId}` | 1760 | 1 `allow` rule(s) |
| `isLegacyInvoiceClientUidUpdate` | 1207 | `/invoices/{invoiceId}` | 1773 | 1 `allow` rule(s) |
| `isInvoiceImmutableFieldsUnchanged` | 1228 | `/invoices/{invoiceId}` | 1794 | 1 `allow` rule(s) |
| `isInvoiceAdjustmentSummaryUnchanged` | 1242 | `/invoices/{invoiceId}` | 1808 | 1 `allow` rule(s) |
| `isInvoiceAggregateMatchingTxAfter` | 1253 | `/invoices/{invoiceId}` | 1819 | 1 helper(s): `isValidInvoicePaymentAggregateUpdate` |
| `isValidInvoicePaymentAggregateUpdate` | 1264 | `/invoices/{invoiceId}` | 1830 | 1 `allow` rule(s) |
| `isInvoiceWithoutPendingEvidenceLock` | 1271 | `/invoices/{invoiceId}` | 1837 | 1 `allow` rule(s) |
| `isValidInvoiceVoidUpdate` | 1276 | `/invoices/{invoiceId}` | 1842 | 1 `allow` rule(s) |
| `isInvoiceRestoreParentBookingValid` | 1285 | `/invoices/{invoiceId}` | 1851 | 1 helper(s): `isValidInvoiceRestoreUnvoidUpdate` |
| `isValidInvoiceRestoreUnvoidUpdate` | 1297 | `/invoices/{invoiceId}` | 1863 | 1 `allow` rule(s) |
| `isValidInvoiceAdjustmentUpdate` | 1308 | `/invoices/{invoiceId}` | 1874 | 1 `allow` rule(s) |
| `isValidInvoiceAdjustmentCreate` | 1322 | `/invoices/{invoiceId}/adjustments/{adjustmentId}` | 1902 | 1 `allow` rule(s) |
| `isValidReversalOriginalPayment` | 1382 | `/paymentTransactions/{transactionId}` | 1983 | 1 helper(s): `isValidPaymentTransactionCreate` |
| `isTxInvoiceConsistentAfter` | 1389 | `/paymentTransactions/{transactionId}` | 1990 | 1 helper(s): `isValidPaymentTransactionCreate` |
| `isValidVerifiedEvidenceTxLinkAfter` | 1399 | `/paymentTransactions/{transactionId}` | 2000 | 1 helper(s): `isValidPaymentTxPolicyAfter` |
| `isValidPaymentTxPolicyAfter` | 1420 | `/paymentTransactions/{transactionId}` | 2021 | 1 helper(s): `isValidPaymentTransactionCreate` |
| `isValidPaymentTransactionCreate` | 1437 | `/paymentTransactions/{transactionId}` | 2038 | 1 `allow` rule(s) |
| `isValidPaymentEvidenceAsset` | 1479 | `/paymentEvidence/{evidenceId}` | 2120 | 1 helper(s): `isValidPaymentEvidenceBase` |
| `isValidPaymentEvidenceBase` | 1506 | `/paymentEvidence/{evidenceId}` | 2147 | 1 `allow` rule(s); 2 helper(s): `isValidClientEvidenceCreate`, `isValidAdminAttachedEvidenceCreate` |
| `isValidClientEvidenceParentInvoice` | 1550 | `/paymentEvidence/{evidenceId}` | 2191 | 1 helper(s): `isValidClientEvidenceCreate` |
| `isValidClientEvidenceCreate` | 1571 | `/paymentEvidence/{evidenceId}` | 2212 | 1 `allow` rule(s) |
| `isAdminAttachedEvidenceLinkedAfter` | 1591 | `/paymentEvidence/{evidenceId}` | 2232 | 1 helper(s): `isValidAdminAttachedEvidenceCreate` |
| `isValidAdminAttachedEvidenceCreate` | 1610 | `/paymentEvidence/{evidenceId}` | 2251 | 1 `allow` rule(s) |
| `isPaymentEvidenceImmutableFieldsUnchanged` | 1631 | `/paymentEvidence/{evidenceId}` | 2272 | 1 `allow` rule(s) |
| `isVerifiedEvidenceLinkedAfter` | 1649 | `/paymentEvidence/{evidenceId}` | 2290 | 1 helper(s): `isValidStaffEvidenceVerifyUpdate` |
| `isValidStaffEvidenceVerifyUpdate` | 1664 | `/paymentEvidence/{evidenceId}` | 2305 | 1 `allow` rule(s) |
| `isValidStaffEvidenceRejectUpdate` | 1676 | `/paymentEvidence/{evidenceId}` | 2317 | 1 `allow` rule(s) |
| `isCommissionItemAmountsMatchingSnapshot` | 1685 | `/commissionPostingItems/{itemId}` | 2470 | 1 helper(s): `isValidCommissionPostingItemCreate` |
| `isValidCommissionBatchCreate` | 1704 | `/commissionBatches/{batchId}` | 2418 | 1 `allow` rule(s) |
| `isValidCommissionPostingItemCreate` | 1745 | `/commissionPostingItems/{itemId}` | 2489 | 1 `allow` rule(s) |
| `isValidCommissionBookkeepingEntryCreate` | 1792 | `/bookkeepingEntries/{entryId}` | 2559 | 1 `allow` rule(s) |
| `isValidCommissionReviewResolutionCreate` | 1826 | `/commissionReviewResolutions/{resolutionId}` | 2992 | 1 `allow` rule(s) |
| `isValidInventoryCategory` | 1855 | `/inventoryItems/{itemId}` | 3048 | 1 helper(s): `isValidInventoryItemShape` |
| `isValidInventoryUnit` | 1867 | `/inventoryItems/{itemId}` | 3060 | 1 helper(s): `isValidInventoryItemShape` |
| `isZeroInventoryItemStock` | 1903 | `/inventoryItems/{itemId}` | 3076 | 1 helper(s): `isValidInventoryInitialLink` |
| `isValidInventoryItemFlags` | 1914 | `/inventoryItems/{itemId}` | 3087 | 1 helper(s): `isValidInventoryItemShape` |
| `isValidInventoryItemShape` | 1931 | `/inventoryItems/{itemId}` | 3104 | 2 `allow` rule(s) |
| `isValidInventoryInitialLink` | 2000 | `/inventoryItems/{itemId}` | 3173 | 1 `allow` rule(s) |
| `isInventoryStockUnchanged` | 2016 | `/inventoryItems/{itemId}` | 3189 | 2 helper(s): `isValidInventoryMetadataUpdate`, `isValidInventoryArchiveOrReactivateUpdate` |
| `isInventoryMetadataUnchanged` | 2023 | `/inventoryItems/{itemId}` | 3196 | 1 helper(s): `isValidInventoryArchiveOrReactivateUpdate` |
| `isInventoryCanArchive` | 2044 | `/inventoryItems/{itemId}` | 3217 | 1 helper(s): `isValidInventoryArchiveOrReactivateUpdate` |
| `isValidInventoryMetadataUpdate` | 2054 | `/inventoryItems/{itemId}` | 3227 | 1 `allow` rule(s) |
| `isValidInventoryArchiveOrReactivateUpdate` | 2062 | `/inventoryItems/{itemId}` | 3235 | 1 `allow` rule(s) |
| `isValidInventoryMovementLinkedDetails` | 2071 | `/inventoryItems/{itemId}` | 3244 | 1 helper(s): `isValidInventoryMovementLinkedUpdate` |
| `isValidInventoryMovementLinkedUpdate` | 2098 | `/inventoryItems/{itemId}` | 3271 | 1 `allow` rule(s) |
| `isValidInventoryMovementType` | 2109 | `/inventoryMovements/{movementId}` | 3293 | 1 helper(s): `isValidInventoryMovementCreate` |
| `isValidInventoryLocationSnapshot` | 2124 | `/inventoryMovements/{movementId}` | 3308 | 1 helper(s): `isValidInventoryMovementCreate` |
| `isValidInventoryMovementItemAfterLink` | 2134 | `/inventoryMovements/{movementId}` | 3318 | 1 helper(s): `isValidInventoryMovementCreate` |
| `isValidInventoryMovementCreate` | 2167 | `/inventoryMovements/{movementId}` | 3351 | 1 `allow` rule(s) |
| `isValidBookkeepingManualIncomeCategory` | 2212 | `/bookkeepingEntries/{entryId}` | 2593 | 1 helper(s): `isValidManualIncomeBookkeepingEntryCreate` |
| `isValidBookkeepingManualExpenseCategory` | 2221 | `/bookkeepingEntries/{entryId}` | 2602 | 1 helper(s): `isValidManualExpenseBookkeepingEntryCreate` |
| `isValidManualIncomeBookkeepingEntryCreate` | 2239 | `/bookkeepingEntries/{entryId}` | 2616 | 1 `allow` rule(s) |
| `isValidManualExpenseBookkeepingEntryCreate` | 2282 | `/bookkeepingEntries/{entryId}` | 2659 | 1 `allow` rule(s) |
| `isValidManualReversalBookkeepingEntryCreate` | 2363 | `/bookkeepingEntries/{entryId}` | 2740 | 1 `allow` rule(s) |
| `isBookkeepingImmutableFieldsUnchanged` | 2424 | `/bookkeepingEntries/{entryId}` | 2801 | 1 `allow` rule(s) |
| `isValidBookkeepingSettlementAggregateUpdate` | 2442 | `/bookkeepingEntries/{entryId}` | 2819 | 1 `allow` rule(s) |
| `isValidManualBookkeepingReversalMarkUpdate` | 2477 | `/bookkeepingEntries/{entryId}` | 2854 | 1 `allow` rule(s) |
| `isValidBookkeepingSettlementCreate` | 2504 | `/bookkeepingSettlements/{settlementId}` | 2892 | 1 `allow` rule(s) |
| `isValidBookkeepingSettingsWrite` | 2566 | `/bookkeepingSettings/{docId}` | 2964 | 1 `allow` rule(s) |
| `isValidClientReservationBackfillOperation` | 2618 | `/systemOperations/clientReservationBackfill` | 430 | 2 `allow` rule(s) |
| `isValidBookingPolicies` | 2665 | `/settings/bookingPolicies` | 495 | 2 `allow` rule(s) |
| `isClientReservationBookingDataMatched` | 2828 | `/clientReservations/{bookingId}` | 1332 | 1 helper(s): `isClientReservationBookingMatched` |
| `isClientReservationBookingMatched` | 2863 | `/clientReservations/{bookingId}` | 1367 | 1 helper(s): `isValidClientReservationShape` |
| `isClientReservationFinancialSummaryMatched` | 2869 | `/clientReservations/{bookingId}` | 1373 | 1 helper(s): `isValidClientReservationShape` |
| `isClientReservationBackedByCanonicalMutation` | 2903 | `/clientReservations/{bookingId}` | 1407 | 1 `allow` rule(s) |
| `isValidClientReservationShape` | 2931 | `/clientReservations/{bookingId}` | 1435 | 1 `allow` rule(s) |
| `isValidSlotCanonicalBookingAfter` | 2983 | `/bookingSlots/{slotId}` | 1505 | 1 `allow` rule(s) |
| `isValidPaymentEvidenceLockWrite` | 3210 | `/paymentEvidenceLocks/{invoiceId}` | 2344 | 1 `allow` rule(s) |
| `isValidGalleryItemShape` | 3406 | `/galleryItems/{galleryItemId}` | 3412 | 2 helper(s): `isValidGalleryItemCreate`, `isValidGalleryItemUpdate` |
| `isValidGalleryItemCreate` | 3481 | `/galleryItems/{galleryItemId}` | 3487 | 1 `allow` rule(s) |
| `isValidGalleryItemUpdate` | 3488 | `/galleryItems/{galleryItemId}` | 3494 | 1 `allow` rule(s) |
| `isValidHeroFeaturedCopy` | 3522 | `/landingPagePlacements/{placementId}` | 3528 | 1 helper(s): `isValidLandingPagePlacementCopy` |
| `isValidRoomPlacementCopy` | 3545 | `/landingPagePlacements/{placementId}` | 3551 | 1 helper(s): `isValidLandingPagePlacementCopy` |
| `isValidStudioExteriorCopy` | 3574 | `/landingPagePlacements/{placementId}` | 3580 | 1 helper(s): `isValidLandingPagePlacementCopy` |
| `isValidLandingPagePlacementCopy` | 3582 | `/landingPagePlacements/{placementId}` | 3588 | 1 helper(s): `isValidLandingPagePlacementShape` |
| `isValidLandingPagePlacementShape` | 3588 | `/landingPagePlacements/{placementId}` | 3594 | 2 helper(s): `isValidLandingPagePlacementCreate`, `isValidLandingPagePlacementUpdate` |
| `isValidLandingPagePlacementCreate` | 3653 | `/landingPagePlacements/{placementId}` | 3659 | 1 `allow` rule(s) |
| `isValidLandingPagePlacementUpdate` | 3659 | `/landingPagePlacements/{placementId}` | 3665 | 1 `allow` rule(s) |
| `isValidPublicAvailabilityProjectionShape` | 3682 | `/publicAvailability/{bookingId}` | 3684 | 1 `allow` rule(s) |
| `isPublicAvailabilityMatchedToCanonicalBookingAfter` | 3707 | `/publicAvailability/{bookingId}` | 3709 | 1 `allow` rule(s) |
| `isPublicAvailabilityDeleteAllowedAfter` | 3718 | `/publicAvailability/{bookingId}` | 3720 | 1 `allow` rule(s) |
| `isValidPublicAvailabilityMetadataShape` | 3725 | `/publicAvailabilityMetadata/{docId}` | 3738 | 1 `allow` rule(s) |
| `isValidPublicPricingCatalogShape` | 3765 | `/publicPricingCatalog/{docId}` | 3766 | 1 `allow` rule(s) |
| `isValidPublicSiteSettingsShape` | 3810 | `/publicSiteSettings/{docId}` | 3811 | 1 `allow` rule(s) |
| `isValidPublicBookingRequestKeys` | 3884 | `/publicBookingRequests/{requestId}` | 3902 | 1 helper(s): `isValidAnonymousPublicBookingRequestCreate` |
| `isValidPublicBookingRequestUpdateKeys` | 3897 | `/publicBookingRequests/{requestId}` | 3915 | 1 helper(s): `isValidBookingRequestStaffUpdate` |
| `isValidClientBookingRequestKeys` | 3920 | `/publicBookingRequests/{requestId}` | 3938 | 1 helper(s): `isValidClientPortalBookingRequestCreate` |
| `isValidClientBookingRequestUpdateKeys` | 3934 | `/publicBookingRequests/{requestId}` | 3952 | 1 helper(s): `isValidBookingRequestStaffUpdate` |
| `isValidPublicBookingRequestScheduleShape` | 3959 | `/publicBookingRequests/{requestId}` | 3977 | 1 helper(s): `isValidPublicBookingRequestCreate` |
| `isValidClientPortalProjectDetails` | 3985 | `/publicBookingRequests/{requestId}` | 4003 | 1 helper(s): `isValidClientPortalBookingRequestCreate` |
| `isValidClientBookingCatalogSnapshot` | 3995 | `/publicBookingRequests/{requestId}` | 4013 | 1 helper(s): `isValidClientPortalBookingRequestCreate` |
| `isValidClientPortalBookingRequestCreate` | 4009 | `/publicBookingRequests/{requestId}` | 4027 | 1 helper(s): `isValidPublicBookingRequestCreate` |
| `isValidAnonymousPublicBookingRequestCreate` | 4032 | `/publicBookingRequests/{requestId}` | 4049 | 1 helper(s): `isValidPublicBookingRequestCreate` |
| `isValidPublicBookingRequestCreate` | 4041 | `/publicBookingRequests/{requestId}` | 4058 | 1 `allow` rule(s) |
| `isBookingRequestCustomerFieldsUnchanged` | 4085 | `/publicBookingRequests/{requestId}` | 4102 | 1 helper(s): `isValidBookingRequestStaffUpdate` |
| `isValidConfirmedBookingSnapshot` | 4112 | `/publicBookingRequests/{requestId}` | 4129 | 1 helper(s): `isBookingRequestLinkedBookingValidAfter` |
| `isBookingRequestLinkedBookingValidAfter` | 4128 | `/publicBookingRequests/{requestId}` | 4145 | 1 helper(s): `isValidBookingRequestStatusTransition` |
| `isValidBookingRequestOfferUpdateByStaff` | 4143 | `/publicBookingRequests/{requestId}` | 4160 | 1 helper(s): `isValidBookingRequestStatusTransition` |
| `isValidBookingRequestStatusTransition` | 4164 | `/publicBookingRequests/{requestId}` | 4181 | 1 helper(s): `isValidBookingRequestStaffUpdate` |
| `isValidBookingRequestStaffUpdate` | 4206 | `/publicBookingRequests/{requestId}` | 4223 | 1 `allow` rule(s) |
| `isValidBookingRequestClientOfferResponseUpdate` | 4228 | `/publicBookingRequests/{requestId}` | 4245 | 1 `allow` rule(s) |
| `isValidBookingRequestCommunicationCreate` | 4261 | `/publicBookingRequests/{requestId}/communications/{eventId}` | 4435 | 1 `allow` rule(s) |
| `isValidBookingRequestActivityCreate` | 4290 | `/publicBookingRequests/{requestId}/activities/{eventId}` | 4481 | 1 `allow` rule(s) |
| `isValidDepositHoldOfferProvisionalLink` | 4318 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4296 | 1 helper(s): `isValidOfferCreate` |
| `isValidDepositHoldOfferReleaseAfter` | 4333 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4311 | 1 helper(s): `isValidOfferStaffUpdate` |
| `isValidDepositHoldOfferConfirmAcceptAfter` | 4340 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4318 | 1 helper(s): `isValidOfferStaffUpdate` |
| `isValidOfferCreate` | 4349 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4327 | 1 `allow` rule(s) |
| `isValidOfferStaffUpdate` | 4391 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4369 | 1 `allow` rule(s) |
| `isValidOfferClientRespondUpdate` | 4422 | `/publicBookingRequests/{requestId}/offers/{offerId}` | 4400 | 1 `allow` rule(s) |
| `isValidBookingRequestMessageTemplateWrite` | 4521 | `/bookingRequestMessageTemplates/{templateId}` | 4519 | 1 `allow` rule(s) |
| `isValidReviewInvitationShape` | 4598 | `/reviewInvitations/{tokenHash}` | 4616 | 3 helper(s): `isValidReviewInvitationStaffCreate`, `isValidReviewInvitationStaffRevoke`, `isValidReviewInvitationPublicSubmitUpdate` |
| `isValidReviewInvitationStaffCreate` | 4638 | `/reviewInvitations/{tokenHash}` | 4656 | 1 `allow` rule(s) |
| `isValidReviewInvitationStaffRevoke` | 4654 | `/reviewInvitations/{tokenHash}` | 4672 | 1 `allow` rule(s) |
| `isValidReviewInvitationPublicSubmitUpdate` | 4673 | `/reviewInvitations/{tokenHash}` | 4691 | 1 `allow` rule(s) |
| `isValidReviewInvitationIndexShape` | 4728 | `/reviewInvitationIndexes/{bookingId}` | 4741 | 2 `allow` rule(s) |
| `isValidCustomerReviewShape` | 4772 | `/customerReviews/{bookingId}` | 4778 | 2 helper(s): `isValidCustomerReviewPublicCreate`, `isValidCustomerReviewModerationUpdate` |
| `isValidCustomerReviewPublicCreate` | 4820 | `/customerReviews/{bookingId}` | 4826 | 1 `allow` rule(s) |
| `isValidCustomerReviewModerationUpdate` | 4840 | `/customerReviews/{bookingId}` | 4846 | 1 `allow` rule(s) |
| `isValidPublicReviewStatsWrite` | 4883 | `/publicReviewStats/{docId}` | 4883 | 1 `allow` rule(s) |
| `isValidCustomerEmailIndex` | 4928 | `/customerEmailIndex/{normalizedEmail}` | 4941 | 2 `allow` rule(s) |
| `isValidClientProfileShape` | 4986 | `/clientProfiles/{customerId}` | 5327 | 2 `allow` rule(s) |
| `isValidClientAccountShape` | 5025 | `/clientAccounts/{uid}` | 5102 | 2 `allow` rule(s) |
| `isValidClientCustomerLinkShape` | 5066 | `/clientCustomerLinks/{customerId}` | 5209 | 1 `allow` rule(s) |
| `isClientAccountCreateLinkMatched` | 5092 | `/clientAccounts/{uid}` | 5143 | 1 `allow` rule(s) |
| `isClientAccountCreateIsolatedProfileMatched` | 5099 | `/clientAccounts/{uid}` | 5150 | 1 `allow` rule(s) |
| `isClientAccountCreateLinkedCustomerMatched` | 5107 | `/clientAccounts/{uid}` | 5158 | 1 `allow` rule(s) |
| `isClientCustomerLinkCreateAccountMatched` | 5116 | `/clientCustomerLinks/{customerId}` | 5235 | 1 `allow` rule(s) |
| `isClientCustomerLinkCreateEmailIndexMatched` | 5122 | `/clientCustomerLinks/{customerId}` | 5241 | 1 `allow` rule(s) |
| `isClientIdentityAuditSourceMatches` | 5183 | `/clientIdentityLinkAudits/{operationId}` | 5377 | 1 helper(s): `isValidClientIdentityLinkAudit` |
| `isClientIdentityAuditTargetMatches` | 5211 | `/clientIdentityLinkAudits/{operationId}` | 5405 | 1 helper(s): `isValidClientIdentityLinkAudit` |
| `isValidClientIdentityLinkAudit` | 5240 | `/clientIdentityLinkAudits/{operationId}` | 5434 | 1 `allow` rule(s) |

---

## 7. Automated Guardrail & Verification Evidence

- **Scope Audit Tooling:** `scripts/audit-firestore-rules-scope.mjs` (`npm run audit:rules:scope`) lexes comments/strings/map literals accurately, builds the transitive call graph, checks wildcards against ancestor bindings, and enforces `localizableRootCandidatesCount === 0`, `unusedHelpersCount === 0`, and `0` scope/wildcard errors. Covered by Vitest in `src/lib/firestore/rules-scope-audit.test.js`.
- **Post-Remediation Gate Results:**
  - `git diff --check`: `exit=0`
  - `npm run audit:rules:scope`: `PASS` (`exit=0`) — `30` root, `171` localized, `0` candidates, `0` unused, `0` errors
  - `npm run lint` (`eslint .`): `PASS` (`exit=0`)
  - `npm run test:run` (`vitest run`): `PASS` (`exit=0`) — `33/33` test files, `273/273` tests passed (`34.04s`)
  - `npm run test:rules:diagnostics` (Real Firestore Emulator `demo-studio37-rules`, port `8088`): `PASS` (`exit=0`, all 21 suites passed; log `D:\PROJECT VS\37V2\logs\firestore-rules\rules-diagnostics-2026-11-28T10-57-15-796Z.txt`)
  - `npm run build` (`vite build`): `PASS` (`exit=0`, `4277` modules, `12.66s`)
  - `npm run verify:phase3`: `PASS` (`4/4` stages; log `D:\PROJECT VS\37V2\logs\phase3\phase3-gates-2026-11-28T10-56-11-643Z.txt`)
