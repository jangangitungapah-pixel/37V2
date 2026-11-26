# Phase 1 Remediation Plan — 37V2

**Current branch:** feature/phase-1-core-domain-identity-policy-foundation  
**Objective:** Close all Phase 1 acceptance gates without expanding product scope or starting Phase 2.  
**Status:** Remediation not yet implemented. This document is the execution plan and investigation checklist.

Read first:
1. docs/project/37V2-PROJECT-CONTEXT.md
2. docs/architecture/BOOKING-LIFECYCLE-ARCHITECTURE-READER-GUIDE.md
3. docs/handoffs/PHASE-1-IMPLEMENTATION-BASELINE-AND-GATE-1-RESULTS.md
4. Existing Phase 0 PRD, Engine Specification, Data Contracts, State Machines and Migration Plan.

---

## 1. Mission and scope boundary

The mission is to make Phase 1's Core Domain, Identity & Policy Foundation coherent, secure, buildable and verifiable.

This is not:
- A redesign of the Booking Lifecycle architecture.
- Implementation of Offer issuance or revisions.
- Implementation of live deposit hold creation/confirmation/expiry.
- Implementation of the Phase 3 payment engine, adjustment ledger, Phase 4 refund/change lifecycle, or Phase 5 Mix & Master project workflow.
- Permission to deploy or backfill production data.

Do not “solve” the test run by deleting tests, weakening expected access denials, disabling lint rules, restoring only shallow import stubs, or changing Owner-approved business decisions.

## 2. Entry procedure

Before editing source:
1. Confirm the local checkout is on feature/phase-1-core-domain-identity-policy-foundation.
2. Record git status --short and current HEAD. Preserve any local user edits; do not reset, clean, stash or overwrite them without inspection.
3. Confirm the local HEAD is the latest intended branch commit. The documentation commit created in this handoff may be newer than the previous 637d1335 baseline.
4. Read this plan and the Implementation Baseline document.
5. Inspect the exact current versions of the files named below; do not rely on old line numbers after a fix changes the source.

## 3. P0 — Repair Firestore paymentEvidence parent ownership authorization

**Severity:** P0 — cross-customer data confidentiality defect.  
**Failing test:** active linked Client expects 403 for paymentEvidence/ev_reset_1 but receives 200.  
**Relevant source:** firestore.rules helper around isClientReadableParentInvoiceDoc / isClientReadableParentInvoice and match /paymentEvidence/{evidenceId}; scripts/test-firestore-rules.mjs fixture around ev_reset_1 and assertion around line 1800.

### Confirmed defect

The current isClientReadableParentInvoiceDoc helper checks that:
- Parent invoice customerId equals the evidence customerId OR parent invoice clientUid equals the current auth UID; and
- Invoice status is issued or void.

It does not check that the authenticated Client actually owns the parent invoice. A matching customerId between an evidence record and its parent invoice proves consistency between those two documents, not ownership by the caller.

The ev_reset_1 fixture is admin_manual evidence linked to inv_bkg_1 / cust_1. The test actor owns cust_email_matched, not cust_1. The current helper nevertheless returns true.

### Required repair properties

The Client read path must:
1. Confirm that the parent invoice exists and is client-readable.
2. Confirm that the authenticated active Client owns that invoice, using the established ownership abstraction (CRM link or explicit clientUid ownership).
3. Confirm the evidence's invoice/customer/UID identity fields are consistent with the parent invoice.
4. Preserve Staff/Owner access according to the existing operational rules.
5. Deny anonymous users, suspended/inactive Clients, and all cross-customer access.
6. Avoid adding broad read permissions to paymentEvidence.

Do not assume the same customerId string on two documents is sufficient authentication. The ownership proof must come from the active Client account and its explicit clientCustomerLinks binding, or the invoice's explicit clientUid binding.

### Required regression coverage

At minimum, run the Rules emulator tests for:
- Active Client A cannot GET Admin-attached evidence belonging to Client B.
- Active Client A cannot GET Client Portal evidence belonging to Client B.
- Active Client A can GET only its own permitted Client Portal evidence when its parent invoice is also owned by A and all identity fields agree.
- A mismatch between evidence customerId and invoice customerId is denied.
- A mismatch between evidence clientUid and invoice/client ownership is denied.
- A Client cannot read evidence for draft/unreadable invoice status.
- Missing parent invoice is denied.
- Anonymous read is denied.
- Staff and Owner retain the intended operational read access.
- Client LIST/query behavior cannot reveal evidence from another customer.
- Isolated UID-based Client ownership is tested separately from CRM-linked Client ownership.

Run the entire Rules suite after adding regression tests. Do not stop after the first assertion passes.

## 4. P1 — Restore the Price & Fee Settings V2 configuration contract

**Severity:** P1 — systemic import/runtime/build blocker.  
**Relevant source:** src/features/admin/settings/pricing/config/default-pricing-settings.js, src/features/admin/settings/booking-policies/config/booking-policies-config.js, pricing normalizers/repositories and all imports of pricing constants.

### Confirmed source condition

The main baseline version of default-pricing-settings.js contains the 404-line pricing V2 configuration and exports the established constants, service/options and defaults. In the Phase 1 branch it has been reduced to 36 lines containing Booking Policies constants/defaults. Existing consumers still import DELIVERY_MODES and PRICING_MODES from the pricing module, so those imports now resolve to undefined.

The same condition explains known Vitest import-time failures and many of the 81 build errors. It may not explain every downstream error; rerun the full checks after the shared contract is restored.

### Required repair properties

1. Restore the established Price & Fee Settings V2 module contract from the Phase 0/main baseline or a carefully verified equivalent. Preserve all existing defaults, existing service/option definitions and current tariff facts. Do not invent or silently alter prices, fees, discounts, modes or IDs.
2. Keep Booking Policies constants and defaults inside the Booking Policies feature's dedicated config module. Do not use the Price & Fee Settings file as a Booking Policies file.
3. Ensure every existing consumer imports the correct source module.
4. Review the settings repository and public pricing projection to make sure the separation between internal pricing settings, customer-safe public pricing and booking policies remains intact.
5. Preserve the Public Pricing Catalog v4 contract and its sanitized metadata. Do not reintroduce internal fees/commission data into public projection.
6. Add or update focused tests for the restored pricing exports, pricing normalization, booking policy normalization, and public projection compatibility.

Do not fix this by adding only DELIVERY_MODES and PRICING_MODES stubs; the rest of the deleted pricing schema/default contract is also required by the existing application.

## 5. P1 — Resolve lint errors and hook correctness

The local lint output has five errors and four warnings.

### Synchronous setState in effects
- WhatsAppMessageComposer.jsx: composer state is copied from request communication status in an effect.
- useBookingPolicies.js: state is synchronously set to loading at effect start.
- useClientReservationBackfill.js: status/loading/error state is synchronously reset in the effect.

Review whether the state is derived from props/data and can be calculated directly, whether a reset key or reducer is more appropriate, or whether state updates belong in asynchronous callbacks/subscription callbacks. Preserve cancellation, loading, and race-protection behavior. Do not merely suppress react-hooks/set-state-in-effect.

### Unused variables
- client-reservation-backfill-service.js: caught error is not used.
- client-billing-repository.js: key variable is assigned but not used.

Remove unnecessary variables or intentionally consume them if the behavior requires it. Do not leave lint exceptions without a documented reason.

### Hook dependencies
- useClientInvoiceDetail.js
- useClientInvoices.js
- useClientPaymentTransactions.js
- useClientPaymentEvidence.js

Review cleanUid stability and include correct dependencies without causing unnecessary resubscriptions or stale closures. A useCallback/memoized normalizer may be appropriate only after reviewing its identity and use.

## 6. P2 — Re-run and close Vitest suites

The previous run reported 25 failed suites, 3 passed suites, and 7 passing tests. Many failures occurred before tests ran because shared imports failed.

After restoring the pricing module:
1. Run npm run test:run.
2. Capture the complete output, including all suite failure names and actual stack traces.
3. Separate import-time/module initialization failures from true assertion failures.
4. Fix root causes in production code and add regression tests for the Phase 1 domain changes.
5. Keep pre-existing unrelated product coverage intact.
6. Do not mark success until all suites pass and every suite reports the expected tests.

The 3 suites that passed in the earlier run were Booking Policies (3), shared utils (2), and booking-date (2). Re-verify them; do not assume they still pass after changes.

## 7. P0/P1/P2 — Re-run the production build

After pricing config restoration and lint fixes:
1. Run npm run build.
2. Capture the complete current build output.
3. Resolve all missing exports and any remaining Vite/Rolldown errors.
4. Confirm the build succeeds without relying on local cache-only behavior.
5. Record Vite version, module transform count, output result and any remaining warning.

A build success does not replace the unit and Rules tests.

## 8. Gate 2 — Build the general Owner-reviewed identity-link workflow

This gate is broader than the current safe backfill.

The current Phase 1 backfill supports only future Client Portal booking records with a provable matching source request, clientUid and customerId. It does not resolve all legacy CRM records that cannot be proven from a matching source request.

Required solution:
- Owner-only review and explicit confirm action.
- Enforce one-to-one identity relationship between a client account UID and canonical CRM customer.
- Record actor UID, timestamp, reason/source, before/after link and audit event.
- Validate no existing conflicting customer link or UID link inside an atomic transaction.
- Keep ambiguous cases unlinked; no best-guess auto-resolution.
- Never auto-merge by phone, display name, or email. These may be search hints only if the Owner still inspects evidence and explicitly confirms.
- Define safe handling for unclaimed customers, already-linked accounts, isolated client_{uid} profiles, duplicate CRM candidates, and unlink/reassignment disputes.
- Preserve invoice/payment ownership and historical transaction facts.
- Ensure Firestore Rules only permit the approved Owner path and reject direct Client mutation.

Before implementation, review the existing clientAccounts, clientCustomerLinks, clientProfiles, customerEmailIndex, customer repository, customer migration service, and the current backfill implementation. Do not invent a parallel identity model if the existing link collections can be extended safely.

Add tests for one-to-one conflicts, already-linked identities, ambiguous records, rejected attempts by Staff/Client, audit fields, idempotent retry, and the effect on client invoice/evidence ownership.

## 9. Gate 3 — Full transaction, projection and Rules consistency audit

Verify end-to-end consistency across:
- Client Portal booking request identity.
- Calendar booking conversion transaction.
- Canonical bookings record.
- Invoice creation and ownership binding.
- clientReservations projection creation and later sync.
- Payment transaction and payment evidence ownership fields.
- Customer CRM link records.

Check each transaction against:
- Read-before-write discipline.
- Deterministic IDs and retry idempotency.
- Optimistic version increment.
- Same-transaction writes for canonical document and required projections.
- Correct conflict behavior on room slot claims.
- Rules lookups per write and combined multi-document transaction.
- Firestore query and composite-index coverage.
- Bounded batch size, especially the established maximum of five records for risky multi-entity jobs.

The Phase 0 architecture specification and data-contract document define the expected transactions and lookup assumptions. Compare current implementation to those contracts instead of guessing.

The source review, discovered defect, corrective change, regression coverage, Rules lookup-budget case, batch inventory, and remaining local-verification steps are recorded in [PHASE-1-GATE-3-TRANSACTION-PROJECTION-AUDIT.md](../architecture/PHASE-1-GATE-3-TRANSACTION-PROJECTION-AUDIT.md).

## 10. Phase 1 acceptance checklist

Phase 1 remains open until every item is explicitly closed:

- [ ] Cross-customer paymentEvidence reads are denied by Firestore Rules and emulator regression tests.
- [ ] Price & Fee Settings V2 module contract is fully restored; Booking Policies remains separately scoped.
- [ ] npm run lint passes without errors; warnings are reviewed and cleared or explicitly justified.
- [ ] npm run test:run passes all suites.
- [ ] npm run test:rules passes the entire emulator suite.
- [ ] npm run build passes.
- [ ] Owner-reviewed one-to-one legacy identity-link workflow exists and its Rules/tests pass.
- [ ] Client UID / CRM customer / booking / invoice / evidence / clientReservations transactional consistency is verified.
- [ ] Batch and Rules lookup budgets are verified, not inferred from file size alone.
- [ ] Phase 1 scope and acceptance criteria are reviewed against the PRD and architecture.
- [ ] Owner explicitly accepts Phase 1 closure.

## 11. Required final verification commands

Run from the repository root after the final remediation changes:

~~~powershell
npm run lint
npm run test:run
npm run test:rules
npm run build
~~~

Capture the complete output. Record the exact commit SHA that was verified and the local Node/npm environment. If any code changes occur after the test run, rerun all four commands before calling the phase complete.

## 12. Exit conditions and safety

When all gates pass:
1. Update the implementation baseline with exact test output/status and remediation commit hashes.
2. Update the Phase 1 handoff with verified status and the remaining explicit Owner review, if any.
3. Stop. Do not begin Phase 2 in the same session unless there is a separate explicit instruction to open the next phase.
4. Do not create or merge a PR, update main, deploy rules/indexes/hosting, run a production backfill, or run Factory Reset without explicit Owner authorization.

If any gate remains unresolved, keep status as NOT ACCEPTED and document the exact blocker.
