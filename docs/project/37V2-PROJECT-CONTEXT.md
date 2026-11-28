# 37V2 — Project Context & Operating Model

**Application:** 37 Music Studio  
**Repository:** https://github.com/jangangitungapah-pixel/37V2  
**Current working branch:** `feature/phase-3-multi-method-payments-staff-cash-adjustments` (branched from accepted Phase 2 tip `d9125b9446b53871f062f2f0d5b37ab6db73b1b3`)
**Current project phase:** Booking Lifecycle — Phase 1 & Phase 2 Owner-Accepted (Not Deployed); Phase 3 Multi-Method Payment, Staff Cash & Price Adjustments Implementation Under Local Verification (Local Dev Only)

This document gives a new engineering session enough product and repository context to make correct decisions instead of treating the latest test failures as an isolated task.

---

## 1. What 37V2 is

37V2 is the application repository for the 37 Music Studio operating platform. It is not merely a booking form or a calendar. It connects the public studio website, Client Portal, staff operations, customer/CRM records, scheduling, service pricing, invoices, payment evidence, payment transactions, commissions, bookkeeping, and operational reporting.

The product serves two audiences:

1. **Studio operations:** Owner and Staff need reliable tools to review requests, manage room schedules, create and maintain bookings, understand customer balances, verify evidence, record desk payments, manage operational and financial records, and resolve exceptions.
2. **Clients:** Clients need a straightforward self-service experience to understand services, submit a booking or project inquiry, follow reservation status, view their sessions, and manage invoices and payments without being exposed to internal studio data.

The Client experience is intentionally simpler than the Admin experience. Internal domain complexity must be handled by the engine and Staff workflow rather than pushed onto Clients as a complicated series of steps.

## 2. Service and delivery model

| Delivery mode | Typical service | Operational meaning |
|---|---|---|
| Studio | Rehearsal, Recording | Scheduled use of a physical studio/room. Requires date, start/end time, room availability, and atomic slot locking. |
| Work-from-anywhere / project | Mix & Master / post-production | Project-based service. It is not a studio-room reservation and must not create room-slot locks. It needs project scope, quotation, materials, milestones, revisions, delivery, and project billing. |

Do not collapse Mix & Master into the room-booking model just because both originate from the public service catalog or booking-request inbox.

## 3. Users and authority boundaries

| Actor | Primary responsibility | Authority boundary |
|---|---|---|
| Owner | Studio ownership, pricing/policy configuration, privileged exceptions, identity reconciliation, refund approval/settlement, financial oversight | Highest application-level operational authority. Owner-only actions must remain explicit and auditable. |
| Staff | Daily studio operations, request handling, calendar, booking conversion, payment evidence review, desk payment recording, customer service | Can execute permitted operational actions but must not silently take Owner-only policy, identity, or financial decisions. |
| Client | Own profile, own booking requests, own safe reservation projection, own invoices/payments/evidence, own project communications | Cannot write canonical bookings, room-slot locks, internal CRM records, internal pricing/fees, payment ledger, or Admin-only records. |
| Anonymous public visitor | Public service discovery, availability discovery, public booking request | Must not receive internal customer, financial, commission, or operational records. |

Role checks are not just UI visibility. They must be enforced by Firestore Security Rules and transactional service boundaries.

## 4. Main product surfaces and modules

The repository already contains architecture and implementation for multiple product areas. Booking Lifecycle work must account for these consumers instead of assuming a greenfield booking-only app.

### Public website and request intake
- Landing Page and public service discovery.
- Public availability calendar and availability projection.
- Anonymous public booking request submission.
- Client Portal request submission.
- Request inbox, search/filter, detail workspace, status, communications, activity history, and WhatsApp handoff.

### Client Portal
- Overview.
- Book a Session, implemented as a short flow with two branches:
  - Studio booking: choose service, choose schedule/room/time, review and submit.
  - Mix & Master inquiry: choose service, provide project details, review and submit; no room or slot selection.
- My Bookings / safe reservation projection.
- Invoices & Payments.
- My Profile.
- Client authentication and CRM identity binding.

### Admin and studio operations
- Admin shell, navigation, dashboard and analytics.
- Calendar workspace with Day / Week / Month timeline views.
- Booking creation, editing, rescheduling, cancellation and session operations.
- Booking request inbox and conversion into operational work.
- Customer management and CRM indexes.
- Price & Fee Settings and customer-safe Public Pricing Catalog.
- Invoice directory, invoice detail, payment transactions, evidence queue, evidence review, and correction/reversal paths.
- Commission calculation/posting and Owner fee visibility.
- Bookkeeping, settlement, manual income/expense and operational financial reporting.
- Inventory.
- Gallery and landing-page placements.
- Customer reviews and invitations.
- Settings, Booking Policies, and Factory Reset / Danger Area.

The complete source of truth for each established module remains its existing architecture document under docs/architecture. This project context is a map, not a replacement for module specifications.

## 5. Technical foundation

The Phase 0 repository audit records this stack:

| Area | Technology / constraint |
|---|---|
| Runtime | React 19.3.1, JavaScript / JSX |
| Build and dev server | Vite 8.3.8 |
| Styling | Tailwind CSS 4.3.5 and CSS-variable design tokens |
| UI primitives | Base UI; local shadcn/ui-generated components where appropriate |
| Forms and validation | React Hook Form 7.92.0, Zod 4.6.7 |
| Async state | TanStack Query 5.107.1 |
| Shared client state | Zustand 5.1.0 only when genuinely shared |
| Date/time | date-fns 4.4.0 and @date-fns/tz 1.5.0 |
| Backend | Firebase Authentication and Cloud Firestore |
| Hosting | Firebase Hosting |
| Optional protection | Firebase App Check, if configured |
| Media | Browser-side unsigned Cloudinary uploads for approved image/evidence assets |

Repository conventions:
- Keep JavaScript / JSX. Do not introduce a TypeScript migration as part of unrelated work.
- Firestore real-time subscriptions remain Firestore listeners; do not duplicate them into a separate query cache without a specific reason.
- Use local React state for local interactions.
- Respect reduced-motion preferences and avoid expensive global animation.
- Lazy-load large or heavy feature modules when needed.
- UI presentation, hooks, schemas, repositories, and transactional services should stay separated.

## 6. Infrastructure and cost boundary

This product is constrained to Firebase Spark / free-tier operation.

The approved application backend is Firebase Authentication + Cloud Firestore + Firebase Hosting. The audited architecture explicitly excludes:
- Cloud Functions.
- Cloudflare Workers in the application request path.
- Firebase Storage.
- Cloud Billing / Blaze.
- Paid background workers or external paid backend services.
- Cron or scheduled hold-expiry jobs.
- Paid payment-gateway integration unless separately approved.

Cloudinary is allowed only for media binaries covered by the existing product architecture, including gallery images and payment-evidence uploads. Related metadata and business records stay in Firestore.

A design that quietly introduces a scheduled job, server function, paid service, or new backend is outside the approved architecture and must not be implemented without a new Owner decision.

## 7. Product-wide invariants that matter to Booking Lifecycle

1. **Asia/Jakarta is the business timezone.** Date selection, booking-day interpretation, deadlines, labels, and calendar calculations must not depend on the browser machine's local timezone.
2. **Room locks use 30-minute granularity.** Calendar presentation may use hourly rows, but the canonical slot lock preserves the existing 30-minute grid, including HH:30 starts.
3. **Money is integer IDR.** Financial calculations use safe integer amounts, not floating-point currency values.
4. **Pricing snapshots are historical facts.** Changing today's catalog or booking policy must not silently rewrite a past invoice or accepted Offer.
5. **Payment transactions are an append-only financial ledger.** Corrections and reversals must be explicit; do not erase financial history.
6. **Client-safe projections are not canonical records.** The Client Portal reads a sanitized reservation projection; it must never gain direct write access to canonical bookings or slot locks.
7. **No silent identity merge.** A phone number, display name, or email match alone must never automatically merge a Client UID with a CRM Customer.
8. **No fabricated history.** Legacy records retain their real historical meaning. A legacy booking that was a confirmed studio commitment must not be retroactively relabelled as an unpaid deposit hold.

## 8. Why the Booking Lifecycle initiative exists

The original application had several concepts represented by overlapping fields and terminal statuses. Request acceptance, reservation confirmation, room-slot locking, payment completion, and session readiness could be interpreted as if they were one event.

That was not sufficient for real studio operations:
- A request can be accepted for discussion without being a confirmed reservation.
- A reservation can temporarily hold a room while deposit is outstanding.
- A verified deposit can confirm the reservation while the invoice still has an outstanding balance.
- A session can later be completed, cancelled, or marked no-show independently from whether the invoice is paid.
- A Client may upload more than one payment proof or pay by more than one method.
- A price change after acceptance must become a traceable adjustment.
- A refund is not the same as reversing an incorrect ledger entry.
- Mix & Master needs a project lifecycle rather than a room booking.

Phase 0 audited this existing baseline and froze the cross-domain architecture. Phase 1 is establishing shared data, identity, and policy foundations. Later phases implement the operational workflows.

## 9. Current project phase and hard boundaries

As of the current branch (`feature/phase-3-multi-method-payments-staff-cash-adjustments`):
- Phase 0 — Business Logic Discovery & Architecture Freeze: completed as documentation.
- Phase 1 — Core Domain, Identity & Policy Foundation: **Owner-accepted on `2026-11-28`** at `2762923ea6de93345058b97012951555f1a354f2` (`docs/handoffs/PHASE-1-OWNER-ACCEPTANCE-RECORD.md`, `verify:phase1` `4/4` PASS). **Production Firebase deployment and production `clientReservations` backfill have NOT been performed** and remain separate rollout preconditions.
- Phase 2 — Offer Revisions & Deposit Hold Engine: **Owner-accepted on `2026-11-28`** at `d9125b9446b53871f062f2f0d5b37ab6db73b1b3` (`docs/handoffs/PHASE-2-OWNER-ACCEPTANCE-RECORD.md`, `verify:phase1` & `verify:phase2` `4/4` PASS). **Production Firebase deployment and live backfill remain NOT PERFORMED.**
- Phase 3 — Multi-Method Payment, Staff Cash & Price Adjustments: **implemented locally on `feature/phase-3-multi-method-payments-staff-cash-adjustments`** (`docs/handoffs/HANDOFF-PHASE-3-MULTI-METHOD-PAYMENT-ADJUSTMENTS.md`), pending Owner review. **Production Rules Blocker & Remediation:** initial Phase 3 Rules (`47c3a5e` / Ruleset `65f12907...`) were rejected by production activation on `studio37classic` (`331,716` compiled executable bytes vs `< 256,000` bytes ceiling); production remains on prior Ruleset `2ca8e80a...`. Local scope optimization (`docs/architecture/FIRESTORE-RULES-SCOPE-OPTIMIZATION.md`) reduced root helpers from `202` to `30`, localized `171` collection helpers into their narrowest `match` scopes, removed `1` unused helper (`isValidBookingCreate`), and passed `audit:rules:scope` + `verify:phase3` (`4/4` PASS). Post-remediation compiled executable size is `NOT MEASURED` locally and remains the next controlled verification gate upon separately authorized production deployment.
- Phases 4–5: remain **blocked** until Phase 3 Owner acceptance and required deployment preconditions (including compiled executable size `< 256,000` bytes confirmation).

## 10. Engineering workflow and safety rules

- Work one named phase at a time. Do not begin the next phase in the same session.
- Keep work on the dedicated feature branch for that phase.
- Do not merge, create a PR, or update main without explicit Owner permission.
- Do not deploy Firestore Rules, indexes, Hosting, or production code without explicit deployment authorization.
- Do not run production backfills or Factory Reset operations as part of local remediation.
- Record actual test results; never mark a suite green because test files exist.
- Keep a detailed implementation/verification record in the repository and a short handoff that points to it.
- Before changing code, inspect the active branch and working tree. Preserve unrelated local changes.

## 11. Recommended document reading order for new sessions

1. This document — understand the product and operational context.
2. docs/architecture/BOOKING-LIFECYCLE-ARCHITECTURE-READER-GUIDE.md — understand the engine and Owner-approved rules.
3. docs/handoffs/PHASE-1-IMPLEMENTATION-BASELINE-AND-GATE-1-RESULTS.md — understand what Phase 1 actually changed and what happened during the tests.
4. docs/handoffs/PHASE-1-REMEDIATION-PLAN.md — execute the remaining Phase 1 work in the correct order.
5. Existing detailed frozen design documents:
   - docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md
   - docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md
   - docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md
   - docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md
   - docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md
6. Existing module documents under docs/architecture when touching a dependent module.

## 12. Known documentation caveat

README.md still describes the repository as a bare frontend foundation and says no product pages or operational workflows are defined. That statement reflects an earlier repository bootstrap snapshot and is not an adequate description of the current repository state or Booking Lifecycle architecture. The detailed architecture and handoff documents listed above are the relevant context for this work. Do not use that brief README description to conclude that existing modules or workflows do not exist.
