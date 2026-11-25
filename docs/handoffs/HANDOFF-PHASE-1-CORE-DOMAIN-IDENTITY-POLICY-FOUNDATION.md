# HANDOFF — 37V2 PHASE 1
## Core Domain, Identity & Policy Foundation

**Project:** 37 Music Studio — 37V2  
**Repository:** https://github.com/jangangitungapah-pixel/37V2  
**Branch:** `feature/phase-1-core-domain-identity-policy-foundation`  
**Implementation commit:** `a0abe9ac9507c7956a3ded795ac994653da7eed3`  
**Parent:** `c134b6312b5b2818e1c5f7511c19ec164ae43e55`  
**Phase:** Phase 1 — Core Domain, Identity & Policy Foundation  
**Handoff status:** IMPLEMENTED — VERIFICATION PENDING — PHASE 2 BLOCKED  
**Date:** 25 November 2026

---

## 1. Executive status

The Phase 1 source and architecture changes have been committed to the dedicated feature branch in one implementation commit. The commit contains **48 changed files**.

GitHub compare confirms the branch is one commit ahead of the Phase 0 architecture-freeze baseline. No pull request was opened. The default `main` branch was not updated.

This is **not yet a verified Phase 1 completion**. Local lint, unit tests, Firestore Rules emulator tests, and production build have not been executed. A local clone attempt failed because the execution environment could not resolve `github.com`; GitHub reports no CI status checks and no workflow runs for the implementation commit.

**Do not start Phase 2 until the outstanding verification and identity-reconciliation gate in Section 8 is resolved.**

## 2. Owner-approved business decisions

The delegated Owner approval for OD-01 through OD-14 remains recorded in the Phase 1 PRD and implementation prompt. No additional business-policy values were invented during this phase.

The implemented policy defaults are intentionally neutral:
- Default deposit policy is `none`.
- Default hold TTL is `null` / not configured.
- Service and option overrides start empty.
- A future deposit-hold engine must fail closed if no effective TTL is configured.
- No cron or scheduled expiry was introduced.

Booking Policies are configuration foundations only. They do not yet confirm reservations, create deposit holds, expire holds, or enforce balance-due transitions. Those behaviors belong to Phase 2.

## 3. Implemented scope

### 3.1 Booking Policies foundation
- Added normalization, validation, option > service > studio-default policy resolution, optimistic version checks, Firestore/in-memory repository adapters, hook, Owner-facing settings page, and settings navigation.
- Added `settings/bookingPolicies` Rules validation and a customer-safe preview path to the public pricing projection.
- Null hold TTL is represented as unconfigured, not replaced by a made-up number.

### 3.2 Public Pricing Catalog v4
- Public catalog schema is now v4.
- The projection includes sanitized service and option deposit previews, balance-due trigger, and `policyVersion`.
- Internal fees, commission data, and operational metadata remain excluded.
- Schema v3 catalogs fail closed until the Owner republishes a v4 catalog.
- Firestore Rules permit `policyVersion: 0` for an unpublished/unpersisted Booking Policies singleton.

### 3.3 Client identity and booking projection
- Booking, invoice, and payment-transaction normalizers preserve `clientUid`.
- Legacy booking normalization derives `reservationStatus: confirmed` (or `cancelled` when the session is cancelled) at read time only; it does not write fabricated history.
- Client Portal-originated booking conversion uses the source request's `clientUid` and `customerId` as its identity source. It avoids silent CRM profile matching/merging by phone, name, or email.
- Added customer-safe `clientReservations/{bookingId}` projection writes for new Client Portal booking conversion and canonical booking update/reschedule/cancel/session lifecycle paths.
- Firestore and in-memory booking repositories support reservation projection writes.
- Added a manual, Owner-triggered, resumable reservation backfill service. It processes at most five candidate bookings per invocation and only links a booking when its source Client Portal request, UID, and customer identity checks agree.
- No production backfill was run.

### 3.4 Client Billing and payment ownership
- Client invoice, payment transaction, and evidence subscriptions support both CRM `customerId` and authenticated `clientUid` ownership.
- Payment and reversal ledger records carry the invoice's `clientUid`.
- Admin evidence attachments retain the same UID ownership binding.
- Evidence submission for isolated Client accounts checks invoice `clientUid` and preserves the invoice's canonical `customerId`.
- Firestore Rules include UID-scoped ownership paths and cross-document UID consistency checks.
- Payment evidence review now passes the evidence version; verification notes are accepted and persisted to the payment transaction.

### 3.5 Operational corrections and limits
- Booking calendar date helpers use `Asia/Jakarta` independently of browser timezone.
- Client booking Schedule and Review time ranges pass the actual end minute, not duration as an end time.
- Mix & Master filters include legacy `mixing` and `mastering` IDs.
- Dashboard payable adapter destructuring and settlement tab navigation were corrected.
- Commission posting and legacy importer write batches are capped at five.
- Factory Reset now contains 25 operational targets, including `clientReservations`, `customerEmailIndex`, `clientCustomerLinks`, and `clientProfiles`; `settings/bookingPolicies` is preserved.

## 4. Data contracts and indexes

- Added bounded indexes for UID/CRM-scoped invoice, payment transaction, and payment evidence queries.
- Added a `publicBookingRequests(source, clientUid)` index.
- Added a `bookings(source, date)` index for the manual reservation backfill.
- `firestore.rules` in the implementation commit is approximately 178,719 bytes (below the Phase 1 target of 220 KB and the 256 KB Firestore Rules file limit). This size is a source-file measurement, not proof that emulator compilation succeeds.
- Existing Firestore rules were not broadly structurally compacted in this phase; only the needed additive and ownership contracts were changed.

## 5. Changed files

The implementation commit changes 48 files:

**Application and domain**
- `src/App.jsx`
- `src/lib/booking-date.js`
- `src/lib/booking-date.test.js`
- `src/features/admin/booking-requests/hooks/useBookingRequests.js`
- `src/features/admin/calendar/repositories/calendar-booking-repository.js`
- `src/features/admin/calendar/services/calendar-booking-service.js`
- `src/features/admin/commission/schemas/commission-schema.js`
- `src/features/admin/customer/repositories/customer-repository.js`
- `src/features/admin/customer/services/customer-migration-service.js`
- `src/features/admin/dashboard/hooks/useDashboardData.js`
- `src/features/admin/dashboard/utils/dashboard-calculations.js`
- `src/features/admin/payment/components/PaymentEvidenceReviewDrawer.jsx`
- `src/features/admin/payment/repositories/payment-repository.js`
- `src/features/admin/payment/schemas/payment-schema.js`
- `src/features/admin/payment/services/legacy-invoice-service.js`
- `src/features/admin/payment/services/payment-service.js`
- `src/features/payment-evidence/hooks/useClientPaymentEvidence.js`
- `src/features/payment-evidence/payment-evidence.test.jsx`
- `src/features/payment-evidence/repositories/payment-evidence-repository.js`
- `src/features/payment-evidence/services/payment-evidence-service.js`
- `src/features/client-portal/billing/hooks/useClientInvoiceDetail.js`
- `src/features/client-portal/billing/hooks/useClientInvoices.js`
- `src/features/client-portal/billing/hooks/useClientPaymentTransactions.js`
- `src/features/client-portal/billing/repositories/client-billing-repository.js`
- `src/features/client-portal/components/booking/ClientBookingStepReview.jsx`
- `src/features/client-portal/components/booking/ClientBookingStepSchedule.jsx`
- `src/features/public-pricing/config/public-pricing-config.js`
- `src/features/public-pricing/public-pricing-projection.test.js`
- `src/features/public-pricing/utils/public-pricing-projection.js`

**Booking Policies**
- `src/features/admin/settings/booking-policies/booking-policies.test.js`
- `src/features/admin/settings/booking-policies/config/booking-policies-config.js`
- `src/features/admin/settings/booking-policies/hooks/useBookingPolicies.js`
- `src/features/admin/settings/booking-policies/hooks/useClientReservationBackfill.js`
- `src/features/admin/settings/booking-policies/repositories/booking-policies-repository.js`
- `src/features/admin/settings/booking-policies/services/booking-policies-service.js`
- `src/features/admin/settings/booking-policies/services/client-reservation-backfill-service.js`
- `src/features/admin/settings/booking-policies/utils/booking-policies-normalize.js`
- `src/features/admin/settings/pages/AdminSettingsPage.jsx`
- `src/features/admin/settings/pages/BookingPoliciesPage.jsx`
- `src/features/admin/settings/pricing/config/default-pricing-settings.js`
- `src/features/admin/settings/pricing/repositories/pricing-settings-repository.js`

**Factory Reset, Firebase, and architecture**
- `firestore.indexes.json`
- `firestore.rules`
- `src/features/admin/settings/danger-area/config/factory-reset-config.js`
- `src/features/admin/settings/danger-area/factory-reset.test.jsx`
- `docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md`
- `docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md`
- `docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md`

## 6. Verification record

| Check | Result | Evidence |
|---|---|---|
| GitHub branch update | PASS | Feature branch points to `a0abe9ac9507c7956a3ded795ac994653da7eed3` |
| GitHub commit comparison | PASS | 1 commit ahead; 48 changed files |
| `npm run lint` | NOT RUN | Local clone blocked by DNS resolution failure to github.com |
| `npm run test:run` | NOT RUN | Same local clone blocker |
| `npm run test:rules` | NOT RUN | Firestore emulator not executed |
| `npm run build` | NOT RUN | Same local clone blocker |
| GitHub Actions / status checks | NONE FOUND | Commit status returned no statuses; workflow query returned 0 runs |
| Firebase deploy | NOT RUN | No deployment executed |
| Production identity backfill | NOT RUN | No production data mutation executed |
| PR creation / merge | NOT DONE | No PR opened; no branch merge performed |

The new tests are test source, not test results. Do not mark this phase green until the four local commands above have run successfully and the Firestore Rules tests have been reviewed.

## 7. Deployment and production safety

- No Firebase Rules or index deployment has been executed.
- No Firestore production data has been backfilled or mutated.
- No factory reset has been run.
- No scheduled job, Cloud Function, or paid Firebase feature was added.
- No PR was created or merged.
- No change was made to `main`.

## 8. Outstanding gates before Phase 1 can be marked complete

1. **Run the verification suite** in a local checkout:
   ```bash
   npm ci
   npm run lint
   npm run test:run
   npm run test:rules
   npm run build
   ```
   Capture the real output and fix all failures before any deployment approval.

2. **Complete the explicit CRM identity-link workflow.** The current backfill safely handles booking records whose source Client Portal request carries the matching `clientUid` and `customerId`. A general Owner-reviewed, one-to-one identity-link UI/service for legacy records that cannot be proven from a matching request is not yet implemented. Ambiguous records must remain unlinked; do not use phone/name/email matching as an automatic merge.

3. **Review transactional and Rules consistency.** In particular, verify createBooking Client Portal conversion, invoice/payment/evidence linkage, `clientReservations` projection writes, the Firestore Rules emulator budget, and the five-write batching assumptions with actual tests. The source-file Rules size being below the limit does not replace emulator compilation.

4. **Confirm Phase 1 acceptance criteria** against the PRD and this handoff. Only after owner-side review and verified tests should Phase 1 be considered complete.

## 9. Next session instructions

- Continue only Phase 1 verification and gap closure.
- Do not begin Phase 2 Offer revisions or deposit-hold lifecycle transitions in this session.
- Do not run the production backfill.
- Do not deploy Firestore rules or indexes.
- Do not merge or update `main`.
- After all Phase 1 gates pass, update this handoff with exact test output and create a new Phase 2 handoff prompt in a separate session.

**Handoff conclusion:** Phase 1 implementation is committed on its feature branch, but its verification and general manual identity-link gate remain open. Phase 2 must remain blocked until those gates are closed.
