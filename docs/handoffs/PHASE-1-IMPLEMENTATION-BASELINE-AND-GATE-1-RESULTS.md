# Phase 1 — Implementation Baseline & Gate 1 Test Results

**Project:** 37 Music Studio / 37V2  
**Phase:** Phase 1 — Core Domain, Identity & Policy Foundation  
**Status:** IMPLEMENTED — VERIFICATION FAILED / PENDING — PHASE 2 BLOCKED  
**Evidence date:** 25 November 2026  
**Source of local test output:** User-provided PowerShell run log captured in the prior session.

---

## 1. Git and branch baseline

| Item | Verified value |
|---|---|
| Repository | https://github.com/jangangitungapah-pixel/37V2 |
| Active branch | feature/phase-1-core-domain-identity-policy-foundation |
| Current branch HEAD at documentation start | 637d133527d1fac256aff44019a7ed0b1daad662 |
| Phase 1 implementation commit | a0abe9ac9507c7956a3ded795ac994653da7eed3 |
| Previous handoff commit | 637d133527d1fac256aff44019a7ed0b1daad662 |
| Phase 0 / main baseline | c134b6312b5b2818e1c5f7511c19ec164ae43e55 |
| Branch comparison | 2 commits ahead, 0 behind main |
| Changed files vs main at the initial handoff point | 49 |
| Pull request | Not created |
| Merge | Not performed |
| Main | Not changed |

The current feature branch is the authorized working baseline. Re-check the branch HEAD and local working tree before any source change in a later session. The test log came from the user's local PowerShell checkout at C:\Users\hazel\source\repos\37V2.

## 2. What the Phase 1 implementation intended to establish

Phase 1 was not intended to build the whole Booking Lifecycle Engine. It established the cross-module foundations required before Offer and Deposit Hold behavior could be safely added.

### 2.1 Booking Policies foundation
- New Booking Policies normalization, schema validation, option > service > studio-default resolution, version-aware service, repository adapters, React hook, and Owner-facing settings page.
- Owner settings navigation and settings page integration.
- Firestore Rules contract for settings/bookingPolicies.
- Explicit unconfigured hold TTL behavior. The policy model uses null to mean no effective TTL has been configured; a future deposit hold must fail closed instead of inventing a default.
- No cron or scheduled expiry mechanism.

### 2.2 Public Pricing Catalog v4
- Customer-safe public pricing projection moved to schema v4.
- Added policyVersion and sanitized deposit preview / balance-due metadata.
- Internal fees, commissions, operational settings and staff-only metadata remain excluded from the public projection.
- Legacy schema v3 catalog is rejected by the new projection contract until republished as v4.
- policyVersion 0 is supported where the Booking Policies singleton has not yet been persisted.

### 2.3 Client identity and reservation projection foundation
- Propagated clientUid through relevant booking, invoice and payment paths.
- Added clientReservations/{bookingId} projection writes for Client Portal-originated booking conversion and canonical booking lifecycle updates.
- Added a manual, Owner-triggered, resumable reservation backfill.
- Backfill is deliberately limited to bookings linked through a matching Client Portal source request with consistent UID and customer identity.
- It processes no more than five candidates per invocation and uses per-record transactions.
- It does not perform general phone/name/email-based identity inference.
- No production backfill was run.

### 2.4 Billing and evidence ownership
- Client invoice, payment transaction and evidence subscriptions support CRM customerId and authenticated clientUid ownership paths.
- Payment and reversal records preserve invoice clientUid.
- Evidence submission checks invoice ownership and preserves canonical customerId.
- Payment Evidence review path was changed to carry evidence version and accept/persist verification notes.

### 2.5 Compatibility and operational fixes
- WIB booking date helper changes.
- Client Booking schedule/review end-time argument correction.
- Legacy Mixing and Mastering service ID filter support.
- Dashboard payable adapter and settlement tab correction.
- Bounded commission and legacy-import batch work.
- Factory Reset manifest expanded to 25 operational targets; Booking Policies settings is preserved.
- Firestore indexes expanded for client UID / CRM-scoped reads and reservation backfill.

## 3. Exact implementation footprint — 49 files in the original Phase 1 compare

The implementation commit changed 48 files. The additional 49th file in the branch compare was the initial Phase 1 handoff document.

### Architecture and migration documents
1. docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md
2. docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md
3. docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md

### Firebase, app entry and booking/calendar
4. firestore.indexes.json
5. firestore.rules
6. src/App.jsx
7. src/features/admin/booking-requests/hooks/useBookingRequests.js
8. src/features/admin/calendar/repositories/calendar-booking-repository.js
9. src/features/admin/calendar/services/calendar-booking-service.js
10. src/lib/booking-date.js
11. src/lib/booking-date.test.js

### Commission, CRM and Dashboard
12. src/features/admin/commission/schemas/commission-schema.js
13. src/features/admin/customer/repositories/customer-repository.js
14. src/features/admin/customer/services/customer-migration-service.js
15. src/features/admin/dashboard/hooks/useDashboardData.js
16. src/features/admin/dashboard/utils/dashboard-calculations.js

### Payment, invoice and evidence
17. src/features/admin/payment/components/PaymentEvidenceReviewDrawer.jsx
18. src/features/admin/payment/repositories/payment-repository.js
19. src/features/admin/payment/schemas/payment-schema.js
20. src/features/admin/payment/services/legacy-invoice-service.js
21. src/features/admin/payment/services/payment-service.js
22. src/features/client-portal/billing/hooks/useClientInvoiceDetail.js
23. src/features/client-portal/billing/hooks/useClientInvoices.js
24. src/features/client-portal/billing/hooks/useClientPaymentTransactions.js
25. src/features/client-portal/billing/repositories/client-billing-repository.js
26. src/features/payment-evidence/hooks/useClientPaymentEvidence.js
27. src/features/payment-evidence/payment-evidence.test.jsx
28. src/features/payment-evidence/repositories/payment-evidence-repository.js
29. src/features/payment-evidence/services/payment-evidence-service.js

### Booking Policies and Settings
30. src/features/admin/settings/booking-policies/booking-policies.test.js
31. src/features/admin/settings/booking-policies/config/booking-policies-config.js
32. src/features/admin/settings/booking-policies/hooks/useBookingPolicies.js
33. src/features/admin/settings/booking-policies/hooks/useClientReservationBackfill.js
34. src/features/admin/settings/booking-policies/repositories/booking-policies-repository.js
35. src/features/admin/settings/booking-policies/services/booking-policies-service.js
36. src/features/admin/settings/booking-policies/services/client-reservation-backfill-service.js
37. src/features/admin/settings/booking-policies/utils/booking-policies-normalize.js
38. src/features/admin/settings/pages/AdminSettingsPage.jsx
39. src/features/admin/settings/pages/BookingPoliciesPage.jsx
40. src/features/admin/settings/pricing/config/default-pricing-settings.js
41. src/features/admin/settings/pricing/repositories/pricing-settings-repository.js

### Factory Reset, client booking and public pricing
42. src/features/admin/settings/danger-area/config/factory-reset-config.js
43. src/features/admin/settings/danger-area/factory-reset.test.jsx
44. src/features/client-portal/components/booking/ClientBookingStepReview.jsx
45. src/features/client-portal/components/booking/ClientBookingStepSchedule.jsx
46. src/features/public-pricing/config/public-pricing-config.js
47. src/features/public-pricing/public-pricing-projection.test.js
48. src/features/public-pricing/utils/public-pricing-projection.js
49. docs/handoffs/HANDOFF-PHASE-1-CORE-DOMAIN-IDENTITY-POLICY-FOUNDATION.md

The file list is included so a later implementation agent can inspect the exact cross-module footprint. It is not a claim that every touched module has been proven correct.

## 4. Gate 1 — actual local verification record

All four commands were executed by the user in the local PowerShell checkout. The results below supersede the earlier handoff's “NOT RUN” statement.

### 4.1 npm run lint — FAILED

Result: **5 errors and 4 warnings**.

Errors:
1. src/features/admin/booking-requests/components/WhatsAppMessageComposer.jsx — line 96: synchronous state update inside an effect; rule react-hooks/set-state-in-effect.
2. src/features/admin/settings/booking-policies/hooks/useBookingPolicies.js — line 19: synchronous state update inside an effect; rule react-hooks/set-state-in-effect.
3. src/features/admin/settings/booking-policies/hooks/useClientReservationBackfill.js — line 18: synchronous state updates inside an effect; rule react-hooks/set-state-in-effect.
4. src/features/admin/settings/booking-policies/services/client-reservation-backfill-service.js — line 277: caught variable error is unused.
5. src/features/client-portal/billing/repositories/client-billing-repository.js — line 270: variable key is assigned but never used.

Warnings:
- src/features/client-portal/billing/hooks/useClientInvoiceDetail.js — line 84: missing cleanUid dependency.
- src/features/client-portal/billing/hooks/useClientInvoices.js — line 117: missing cleanUid dependency.
- src/features/client-portal/billing/hooks/useClientPaymentTransactions.js — line 124: missing cleanUid dependency.
- src/features/payment-evidence/hooks/useClientPaymentEvidence.js — line 108: missing cleanUid dependency.

Do not “fix” these by globally disabling lint rules. Review whether each state update is derived state that should not be stored, or a real asynchronous subscription state update. Preserve cancellation and stale-response behavior in hooks.

### 4.2 npm run test:run — FAILED

Vitest 5.1.0 result:
- 28 test files/suites discovered.
- 25 failed suites.
- 3 passed suites.
- 7 tests passed.
- The output reports many failed suites with 0 tests collected because module import/initialization failed before test execution.

Passed suites:
- src/features/admin/settings/booking-policies/booking-policies.test.js — 3 tests.
- src/lib/utils.test.js — 2 tests.
- src/lib/booking-date.test.js — 2 tests.

The captured failure output identifies the pricing configuration contract as a systemic import problem:
- src/features/admin/settings/pricing/utils/normalize-pricing-settings.js line 16 attempts Object.values(DELIVERY_MODES), but DELIVERY_MODES is undefined.
- src/features/public-pricing/config/public-pricing-config.js line 13 accesses DELIVERY_MODES.STUDIO, but DELIVERY_MODES is undefined.
- The Client Billing suite also imports the pricing normalizer and fails during module initialization.
- The output lists 25 failed suites, including Landing Page, Admin Shell, Auth, Client Portal, Client Booking, Customer Reviews, Public Availability, Payment Evidence, Booking Requests, Bookkeeping, Calendar, Commission, Customer, Dashboard, Gallery, Inventory, Payment, Settings, Factory Reset and related suites.

Important distinction: the 25 suite failures do not prove that 25 independent business assertions are broken. Several suites fail before running their tests because shared imports cannot initialize. Fix the shared module contract first, then rerun to reveal remaining test-level failures.

### 4.3 npm run test:rules — FAILED

Command starts the Firestore Emulator successfully and executes scripts/test-firestore-rules.mjs.

The emulator reached and passed these checks before stopping:
- Matrix IDLE denials.
- Normal six-hour multi-document Staff booking transaction under the Rules lookup budget.
- customerPhoneIndex list RBAC (Owner vs Staff vs unauthenticated).
- Customer Review invitation, atomic submission, RBAC and moderation.

The failure:
- Test actor: active linked Client, TOKEN_CLIENT_MATCHED.
- Requested document: paymentEvidence/ev_reset_1.
- Expected HTTP status: 403.
- Actual HTTP status: 200.
- Assertion: “Active Client MUST be denied reading admin path paymentEvidence/ev_reset_1”.
- Test location: scripts/test-firestore-rules.mjs around line 1800.

#### Confirmed source-level reason for the Rules failure

The current Firestore Rules define:
- isClientDocumentOwner(data) — checks whether the authenticated active Client owns the CRM customer via isClientOwnerOfCustomer(data.customerId), or owns the document via clientUid.
- isClientReadableParentInvoiceDoc(invoiceId, customerId) — fetches the invoice and currently checks only that invoice.customerId equals the evidence customerId OR invoice.clientUid equals the current UID, and that invoice status is issued or void.
- isClientReadableParentInvoice(...) — checks that the parent invoice exists and delegates to the previous helper.
- paymentEvidence/{evidenceId} allows Client get/list whenever isClientReadableParentInvoice(...) is true.

The parent invoice helper does **not** call isClientDocumentOwner(inv.data). It verifies that the evidence's customerId matches the invoice's customerId, but that relationship is not proof that the current authenticated Client owns that customer.

The test fixture confirms the cross-customer case:
- paymentEvidence/ev_reset_1 is evidenceSource admin_manual, status attached, invoiceId inv_bkg_1, customerId cust_1, clientUid empty.
- The active linked test Client owns cust_email_matched, not cust_1.
- The evidence and its parent invoice share cust_1, so the helper's child-to-parent consistency comparison succeeds even though the caller does not own cust_1.
- The rule consequently returns 200 where the test correctly expects 403.

This is a **confirmed cross-customer read-authorization defect**, not a test expectation that should be weakened. The fix must verify authenticated ownership of the parent invoice and separately verify consistency between the evidence and parent invoice. Preserve legitimate access to a Client's own allowed evidence and preserve Staff/Owner review access.

### 4.4 npm run build — FAILED

Vite 8.3.8 / Rolldown transformed 4,265 modules, then failed with **81 errors**.

The captured build output includes missing exports:
- DELIVERY_MODES is not exported by src/features/admin/settings/pricing/config/default-pricing-settings.js.
- PRICING_MODES is not exported by the same file.
- These missing exports affect PriceAndFeeSettingsPage.jsx, ClientBookSessionPage.jsx, booking-request-normalize.js, the pricing normalizer, and other dependent modules.
- The full 81-error diagnostic list was not preserved in the pasted output; rerun after restoring the shared configuration contract to reveal the remaining errors.

#### Confirmed source comparison for default-pricing-settings.js

At the branch implementation:
- src/features/admin/settings/pricing/config/default-pricing-settings.js is only 36 lines and exports Booking Policies constants/defaults.
- The current main baseline version of that file is 404 lines and includes the established Price & Fee Settings V2 contract, including DELIVERY_MODES, PRICING_MODES, FEE_MODES, DISCOUNT_RULE_MODES, default services/options, fees, operational settings, and pricing defaults.
- The Phase 1 compare shows this file changed by 432 lines: 32 additions and 400 deletions.

This means a Booking Policies configuration concern has replaced a pre-existing pricing configuration module. It is not sufficient to add two missing export stubs: the existing pricing V2 schema/defaults must be restored intact, and Booking Policies constants must live in their dedicated feature config module. Do not invent tariff values while restoring it.

## 5. Other Phase 1 gates not covered by Gate 1

Gate 1 is only the local code-quality/test/build gate. Phase 1 also has these explicit acceptance gates:

### Gate 2 — General Owner-reviewed legacy identity linking
The current backfill only links data that has a matching Client Portal source request with consistent clientUid and customerId. It does not provide a general Owner-reviewed one-to-one identity-link workflow for legacy records that cannot be proven by a matching request.

The missing workflow must:
- Be Owner-reviewed and auditable.
- Enforce one-to-one identity binding.
- Preserve both clientUid and customerId ownership invariants.
- Never auto-merge based on phone, display name, or email.
- Leave ambiguous or disputed legacy records unlinked.
- Avoid silently rewriting financial history or transferring another Client's access.

### Gate 3 — Transaction, projection, Rules and batch consistency
Review and verify:
- Client Portal booking conversion and its source-request identity.
- Canonical booking, invoice and payment/evidence clientUid consistency.
- clientReservations projection writes for create/update/reschedule/cancel/session lifecycle.
- Firestore Rules helper lookup budgets and emulator behavior.
- Transaction read-before-write, idempotency and optimistic version assumptions.
- Five-record bounded batch assumptions for commission/import/backfill paths.
- Composite indexes required by all UID/CRM-scoped queries.

The Rules failure described in Gate 1 is already one part of this gate and must be closed before acceptance.

## 6. Production and repository safety status

At the latest verified branch state:
- No Firebase Rules deployment.
- No Firestore index deployment.
- No Firebase Hosting deployment.
- No production data backfill.
- No Factory Reset execution.
- No cron, Cloud Function, Cloudflare Worker, Firebase Storage or paid backend addition.
- No PR created.
- No merge performed.
- main remains at the Phase 0 baseline SHA.

These restrictions remain in force during remediation unless the Owner explicitly authorizes a separate operation.

## 7. How to interpret the current status

**Phase 1 source work exists, but Phase 1 is not accepted.**  
**Gate 1 has actual failures, not a missing test run.**  
**A cross-customer paymentEvidence read rule defect is confirmed.**  
**The Price & Fee Settings V2 configuration module has been overwritten by Booking Policies configuration and must be restored.**  
**Identity linking and full transaction/Rules consistency gates remain open.**

No session should begin Phase 2 until all gates are verified and Owner acceptance is explicit.
