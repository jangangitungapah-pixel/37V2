# HANDOFF — 37V2 Phase 1 Remediation

**Project:** 37 Music Studio / 37V2  
**Repository:** <https://github.com/jangangitungapah-pixel/37V2>  
**Branch:** feature/phase-1-core-domain-identity-policy-foundation  
**Status:** Phase 1 REMEDIATED LOCALLY (Gate 3 `verify:phase1` PASS `4/4`, uncommitted over `0256e79179b305f444dba380c172104eb8419690`) — NOT ACCEPTED UNTIL OWNER ACCEPTANCE — PHASE 2 BLOCKED
**Previous branch tip:** 0256e79179b305f444dba380c172104eb8419690
**Owner-approved architecture:** Phase 0 decisions AD-01..AD-08 and detailed decisions OD-01..OD-14.

---

## 1. Read the detailed documents first

This handoff is deliberately short. The full context is stored in the repository so a new session does not depend on the previous chat transcript.

Read these documents in this order:

1. **docs/project/37V2-PROJECT-CONTEXT.md**  
   Understand what 37V2 is: product users, service model, existing modules, stack, Firebase Spark constraints, project conventions and safety rules.

2. **docs/architecture/BOOKING-LIFECYCLE-ARCHITECTURE-READER-GUIDE.md**  
   Understand the Booking Lifecycle target architecture, independent domains, target collection topology, business flows, Owner-approved decisions OD-01..OD-14, phase dependency map, and the explicit distinction between Phase 1 foundations and future engine phases.

3. **docs/handoffs/PHASE-1-IMPLEMENTATION-BASELINE-AND-GATE-1-RESULTS.md**  
   Understand the exact Phase 1 implementation footprint, Git baseline, the 49-file list, actual local Gate 1 output, confirmed pricing configuration regression, confirmed paymentEvidence Rules defect, and open acceptance gates.

4. **docs/handoffs/PHASE-1-REMEDIATION-PLAN.md**  
   Follow the prioritized execution plan, required regressions, Gate 2 identity work, Gate 3 consistency audit, verification commands and exit criteria.

5. **Original frozen architecture sources**  
   Read the Phase 0 PRD, Engine Specification, Data Contracts, State Machines, Migration Plan and Phase 0 handoff when a detailed schema, transaction, transition or legacy-compatibility question arises.

Do not treat this summary as a replacement for those documents.

## 2. Overall product context

37V2 is the studio operating platform, not just a booking calendar. It includes public website/request intake, Client Portal, Admin operations, calendar, customer CRM, pricing catalog, invoice/payment/evidence, commissions, bookkeeping, dashboard, inventory, gallery, reviews and settings.

Studio services such as Rehearsal and Recording reserve physical room time. Mix & Master is a post-production Project, not a room reservation. The app must keep the Client experience simple while the domain engine handles the underlying business complexity.

The approved backend boundary is Firebase Authentication + Cloud Firestore + Firebase Hosting on Spark. Do not introduce Cloud Functions, Cloudflare Workers, Firebase Storage, Blaze/Billing, paid backend services or scheduled jobs. Cloudinary is limited to approved media binaries.

## 3. What we are actually building

The Booking Lifecycle initiative separates:

- Booking Request
- Offer and Offer revisions
- Reservation and room-slot locks
- Studio Session
- Invoice and Payment Transactions
- Payment Evidence
- Booking Change Requests and price Adjustments
- Refund Cases
- Mix & Master Projects

Each domain owns its own state machine. Do not conflate accepted request, confirmed reservation, paid invoice or completed session.

Owner-approved policies include deposit_hold reservation model, configurable deposit, Staff-controlled cash, case-by-case refund, manual hold expiry, adjustment-based pricing changes, approval-based Client changes, and Project-based Mix & Master. The architecture reader guide records OD-01 through OD-14 in detail.

## 4. Current implementation state

Phase 0 architecture freeze is complete. Phase 1 implementation is committed on the feature branch. It established Booking Policies configuration, Public Pricing Catalog v4 policy projection, clientUid propagation, clientReservations projection/backfill foundations, payment ownership query changes and compatibility fixes.

It did **not** implement the full Offer, deposit-hold, payment, refund, change-request or Mix & Master project lifecycle. Those belong to later phases.

Phase 1 Gate 3 remediation was subsequently implemented and verified PASS locally (`npm run verify:phase1`: ESLint exit `0`, Vitest `29/29` files / `250/250` tests exit `0`, Firestore Rules Emulator exit `0`, Vite build exit `0` — see `docs/architecture/PHASE-1-GATE-3-TRANSACTION-PROJECTION-AUDIT.md`). **Phase 1 remains not accepted until Owner acceptance is explicitly recorded; Phase 2 remains blocked until Owner acceptance.**

## 5. First remediation priorities

Use the exact evidence and acceptance checklist in the detailed docs. The known order is:

1. **P0 — Firestore Rules paymentEvidence ownership defect.**  
   A linked active Client can read paymentEvidence/ev_reset_1 belonging to another CRM Customer. The parent-invoice helper checks evidence/invoice customerId consistency but does not verify that the authenticated Client owns the parent invoice. Do not weaken the denial test. Fix the ownership condition and add cross-customer regression cases.

2. **P1 — Restore the Price & Fee Settings V2 configuration contract.**  
   In the feature branch, default-pricing-settings.js was reduced from the 404-line existing pricing module to 36 lines of Booking Policies constants. DELIVERY_MODES and PRICING_MODES and the established pricing defaults are missing, causing shared import failures. Restore the existing pricing contract and keep Booking Policies config in its own feature module. Do not restore guessed or invented tariff values.

3. **P1 — Resolve lint errors/warnings and hook correctness.**

4. **P2 — Re-run Vitest and address the remaining real test failures after shared imports are repaired.**  
   The previous run had 25 failed suites, 3 passed suites and 7 passed tests. Many failures were import-time failures, not 25 proven independent assertion defects.

5. **P2 — Re-run production build and resolve the complete error list.**

6. **Gate 2 — Implement general Owner-reviewed one-to-one identity linking for legacy CRM records that cannot be proven from a matching Client Portal request.**

7. **Gate 3 — Verify transaction, Rules lookup budget, clientReservations projection, UID/CRM ownership, indexes and five-record batch assumptions.**

The full issue details, file paths, test fixture evidence, required regression matrix and acceptance checklist are in the Phase 1 Baseline and Remediation Plan documents.

## 6. Next-session operating instructions

Start by confirming:

- Current branch is feature/phase-1-core-domain-identity-policy-foundation.
- Current HEAD is the latest documentation commit on that branch.
- Local git status and user edits are understood and preserved.
- The four detailed documents above have been read.

Continue **Phase 1 Remediation only**. Work one gate at a time and report verified results. Do not start Phase 2 in the same session.

## 7. Hard safety boundaries

Without explicit Owner authorization:

- Do not merge or update main.
- Do not create or merge a PR.
- Do not deploy Firebase Rules, indexes or Hosting.
- Do not run production backfill or Factory Reset.
- Do not introduce paid infrastructure, Cloud Functions, Workers, Firebase Storage or scheduled jobs.

**Completion condition:** Phase 1 can only be proposed for acceptance after lint, Vitest, Firestore Rules emulator and build pass; the Owner-reviewed identity-link workflow is complete; transaction/projection/Rules consistency is verified; and the Owner explicitly accepts Phase 1 closure. Phase 2 stays blocked until then.
