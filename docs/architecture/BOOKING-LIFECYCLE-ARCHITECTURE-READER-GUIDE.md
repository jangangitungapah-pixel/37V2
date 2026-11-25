# 37V2 — Booking Lifecycle Architecture Reader Guide

**Purpose:** A guided, current interpretation of the frozen Phase 0 architecture and the Owner-approved policy decisions that govern Phase 1–5. This guide prevents later implementation sessions from confusing the full target engine with the limited Phase 1 foundation already committed.

**Authoritative detailed specifications:**
- docs/prd/PRD-PHASE-0-BOOKING-LIFECYCLE-ARCHITECTURE-FREEZE.md
- docs/architecture/BOOKING-LIFECYCLE-ENGINE-SPECIFICATION.md
- docs/architecture/BOOKING-LIFECYCLE-DATA-CONTRACTS.md
- docs/architecture/BOOKING-LIFECYCLE-STATE-MACHINES.md
- docs/architecture/BOOKING-LIFECYCLE-MIGRATION-PLAN.md

This reader guide does not replace their exact schemas, transition tables, transaction specs, or scenario matrix.

---

## 1. Architectural objective

The Booking Lifecycle & Reservation Engine is the domain layer that coordinates request intake, commercial offer, room reservation, studio session, invoice/payment, payment evidence, booking changes, financial adjustments, refunds, and post-production projects.

The design target is to:
- Prevent double booking through atomic room-slot locks.
- Distinguish a customer's request from an accepted Offer and from an actual reservation.
- Distinguish reservation confirmation from session execution and financial settlement.
- Support configurable deposits and manual hold expiry without a scheduled backend.
- Support multi-method and installment payments without overwriting transaction history.
- Make every price change, correction, exception, and refund auditable.
- Keep the Client workflow simple while protecting internal records.
- Keep old production records readable without fabricating historical state.
- Keep all infrastructure inside the approved Firebase Spark boundary.

## 2. The central domain rule: independent lifecycles

Never reuse one status field to represent two business domains. The state machines have separate owners, transitions, authorization, guards, and recovery paths.

| Domain | Canonical source | Meaning |
|---|---|---|
| Booking Request | publicBookingRequests | What the Client or public visitor asked the studio to do. It is an intake/conversation record. |
| Offer | publicBookingRequests/{requestId}/offers/{offerId} | A versioned commercial proposal from the studio. |
| Reservation | bookings.reservationStatus | Whether a room commitment is on hold, confirmed, expired, or cancelled. |
| Session | bookings.sessionStatus | Whether the actual studio session is pending, upcoming, in progress, completed, no-show, or cancelled. |
| Payment / Invoice | invoices and paymentTransactions | What is owed and what money has actually been recorded. |
| Payment Evidence | paymentEvidence | Client-submitted proof or Admin-attached supporting evidence awaiting review or already reviewed. |
| Change Request / Adjustment | bookingChangeRequests and invoice adjustments | A requested operational change and its approved effect on schedule or price. |
| Refund Case | refundCases | A governed decision and settlement process for returning or crediting money. |
| Project | postProductionProjects | Mix & Master / post-production work with quotation, materials, production, revisions, delivery, and billing. |

### Consequences

- Request status = accepted does not mean that money has been received.
- Request status = confirmed means it was converted into a tracked Reservation record; that Reservation may still be in deposit_hold.
- Reservation status = confirmed does not mean the invoice is fully paid.
- Payment status = paid does not mean a studio session is completed.
- Session completed/no_show/cancelled does not rewrite the historical financial ledger.
- A Mix & Master Project does not own a room slot and does not create bookingSlots.

## 3. Target collection topology

This is the conceptual map. Exact fields and permission matrices are in DATA-CONTRACTS.md.

| Collection / path | Role in the engine |
|---|---|
| settings/bookingPolicies | Owner-configured defaults and service/option overrides for deposits, hold, and balance-due triggers. |
| publicPricingCatalog/current | Sanitized customer-safe projection of active pricing and policy previews. |
| publicBookingRequests/{requestId} | Request intake and conversion pointer. |
| publicBookingRequests/{requestId}/offers/{offerId} | Immutable Offer revision snapshots with controlled lifecycle status. |
| bookings/{bookingId} | Canonical Staff-owned studio booking and reservation/session record. |
| bookingSlots/{date}__{studioId}__{slotStartMinute} | Atomic 30-minute slot locks; never Client writable. |
| publicAvailability/{bookingId} | Public availability projection containing no PII. |
| clientReservations/{bookingId} | Sanitized Client Portal projection; mirrored from canonical booking. |
| bookingEvents/{eventId} | Append-only booking lifecycle audit events. |
| invoices/{invoiceId} | Financial obligation and current aggregate state; booking invoice or project invoice. |
| invoices/{invoiceId}/adjustments/{adjustmentId} | Append-only price adjustment records. |
| paymentTransactions/{transactionId} | Append-only payment and reversal ledger. |
| paymentEvidence/{evidenceId} | Client proof or Staff-attached evidence; verified evidence links to a ledger transaction. |
| bookingChangeRequests/{changeRequestId} | Client/Staff requests to change a reservation, time, service, or extension. |
| refundCases/{refundId} | Separate review and settlement record for refund or conversion to Studio Credit. |
| postProductionProjects/{projectId} | Mix & Master / post-production lifecycle, never room-slot based. |
| postProductionProjects/{projectId}/quotations/{quotationId} | Versioned commercial quotation revisions. |

## 4. End-to-end studio booking flow

1. A Client or anonymous visitor submits a booking request. This creates request intake; it does not grant room locks.
2. Staff reviews the request, checks availability and commercial requirements, and may ask for clarification.
3. Staff issues a versioned Offer. The Offer is either:
   - **quote_only:** the customer receives a commercial offer without a provisional room lock; or
   - **deposit_hold_offer:** the studio creates a provisional reservation and atomically protects the requested room/time while the client reviews and pays within a configured hold window.
4. Client accepts or rejects the current Offer. The request, Offer, reservation and invoice transitions are coupled by explicit transaction boundaries. An obsolete Offer must not be accepted after a newer revision supersedes it.
5. For a deposit-required Offer, the Reservation stays in deposit_hold until the confirmation rule is satisfied. A verified cumulative net payment at or above the minimum deposit confirms it atomically. A permitted Staff/Owner override requires a written reason and audit.
6. When deposit policy is none, the approved no-deposit path confirms immediately upon Offer acceptance or Admin creation; no pointless deposit_hold is created.
7. Session status continues independently through the operational session lifecycle.
8. Remaining balance is settled according to the configured service/option balance-due policy.

### Slot locking

- Canonical slot locks remain 30-minute documents.
- A multi-slot booking transaction reads the required slot documents, validates all are available, and writes locks/projections atomically.
- A failed transaction must not leave a partial reservation or partial set of room locks.
- publicAvailability and clientReservations are projections of the canonical reservation state, not independent sources of truth.
- Staff and Owner have operational write authority. Clients cannot write bookings or bookingSlots.

## 5. Hold, deposit and confirmation behavior

- Deposit policy is configurable at studio default, service override and option override.
- Policy resolution is option > service > studio default.
- A deposit_hold cannot be created when the effective hold TTL is unconfigured. The system must fail closed and display an Owner-actionable message; it must not invent a 24-hour fallback.
- Hold expiry is a Staff/Owner manual action. There is no cron or scheduled expiry service.
- The actual hold deadline must respect the configured policy and the session-start safety cutoff.
- While payment evidence is pending review, the hold must not be manually expired.
- If verified cumulative net payment is below the minimum deposit, the reservation remains on hold and the Client must see the exact remaining amount needed to confirm.
- A permitted below-minimum confirmation exception requires Staff/Owner authorization and an audit reason.
- A late payment after expiry must never silently resurrect an expired reservation. Staff must recheck the live slot. If the slot has been taken, the funds route into the approved refund/credit case handling.
- Reversal can change net paid and therefore can trigger a need for Staff review; it is not a refund.

## 6. Invoice, payment, evidence and financial rules

### Pricing and invoice snapshot
- All monetary values are integer IDR and must remain safe integers.
- The Offer/Reservation and invoice retain immutable commercial snapshots.
- Do not update historical financialSnapshot merely because the current service catalog or policy changes.
- A price decrease after payment can make the Client overpaid. Keep balanceDue non-negative and surface the excess as an overpaid/credit amount; do not silently delete or reduce old payments.
- A price change after acceptance is represented by an append-only adjustment record. It is not a silent overwrite of the original quote or invoice snapshot.

### Payment ledger
- paymentTransactions is append-only.
- Support multiple methods and installments against the same invoice.
- Verification must check the live outstanding amount and prevent double credit inside an atomic transaction.
- A reversal is an accounting correction linked to an original transaction. A refund is a distinct settlement of money or Studio Credit back to a customer.
- Never use transaction deletion or rewrite as a refund implementation.

### Cash and payment evidence
- Client cannot submit self-declared cash payment evidence.
- Client non-cash proof (such as transfer or QRIS) remains proof-backed by default.
- Staff/Owner can record actual desk cash using the explicit staff_cash_desk source.
- Multiple pending proofs are allowed. Client UI should warn about duplicate evidence and show the amount already awaiting review. Staff verification must recheck live balance atomically.
- If a payment is represented by an Admin-attached evidence document, the document remains Staff-owned; a Client must not gain access to it merely because the evidence and invoice share the same customerId string. Parent invoice ownership must be checked against the authenticated Client.

## 7. Changes and adjustments

Client-requested booking changes are not direct edits to the canonical booking.

The target flow is:
1. Client submits a Change Request with the desired change and context.
2. Staff reviews and approves, rejects, or counters.
3. Applying an approved change rechecks the live slot availability and atomically swaps slot locks where necessary.
4. Canonical booking, clientReservations, publicAvailability and bookingEvents are kept consistent.
5. Price differences create adjustment records and can create an overpaid/credit/refund obligation.
6. Accepted Offers and original financial snapshots remain immutable.

Staff/Owner can make permitted operational changes, but price effects must remain traceable.

## 8. Refund cases

Refund is case-by-case and represented by refundCases, not by payment reversal.

A refund case:
- References the invoice and relevant booking or project.
- References the source payment transaction IDs.
- Records requested amount, refund/credit path, decision, reason, settlement evidence/reference, actor and timestamps.
- Moves through explicit review and settlement states.
- Contributes to financial reporting as a cash outflow or Studio Credit resolution only after the appropriate state is reached.

The source payment transaction remains in the ledger. A reversal and a refund must never be conflated in reporting or audit.

## 9. Mix & Master / post-production project

Mix & Master is a Project, not a studio reservation:
- A Client sends a project inquiry with scope, project/artist name, brief, optional project type, track count and target deadline.
- Staff scopes the work and issues a versioned quotation.
- Quotation acceptance creates or activates the Project and a deterministic project invoice such as inv_prj_{projectId}.
- Project status progresses through scoping, quotation, deposit/material readiness, production, review/revisions, final delivery and completion.
- Optional milestones can determine when balances are due.
- Revision quota and scope additions need explicit tracking and price adjustments.
- The project must not create bookings or bookingSlots.

## 10. Identity and ownership model

The system has two separate but connected identity concepts:
- **clientUid:** authenticated Firebase Client account identity.
- **customerId:** canonical CRM Customer identity used by the studio.

Client-owned operational records carry both identifiers when appropriate. Ownership authorization can be satisfied by the Client UID or an explicitly established CRM link, but every cross-document operation must keep these bindings consistent.

Critical rules:
- A Client Portal request converted into a booking may use its own verified clientUid/customerId pair as source identity.
- Legacy data without a provable matching source request requires an explicit Owner-reviewed one-to-one link workflow.
- Do not automatically merge customers or assign identity based only on phone, name, or email.
- Ambiguous or disputed candidates remain unlinked.
- Owner-reviewed identity links must be auditable and one-to-one; they must not silently change the financial or booking history of another account.

## 11. Owner-approved business decision baseline

The Owner-approved eight top-level decisions are:

| Decision | Approved value | Architectural meaning |
|---|---|---|
| AD-01 — Reservation model | deposit_hold | A deposit-required room commitment has an explicit provisional hold state before confirmation. |
| AD-02 — Deposit policy | configurable | Deposit rules are configurable, not hardcoded globally. |
| AD-03 — Cash policy | staff | Cash is recorded by Staff/Owner, not self-declared by Client. |
| AD-04 — Refund policy | case_by_case | Refunds require case review and a recorded decision. |
| AD-05 — Hold expiry | manual_expiry | Holds expire through an authorized manual action; no scheduled worker. |
| AD-06 — Pricing changes | adjustment | Changes after acceptance are traceable adjustments, not overwrites. |
| AD-07 — Client changes | approval | Client changes go through an approval workflow. |
| AD-08 — Mix & Master | project | Mix & Master uses a project lifecycle, not room reservation. |

### Detailed Owner decisions OD-01 through OD-14

The Phase 0 documents originally marked these fourteen details as pending. They were subsequently Owner-approved by explicit delegated authorization for the Booking Lifecycle design. The frozen source documents were not rewritten, so this table records the current decision state for later sessions.

| ID | Approved policy | Required behavior |
|---|---|---|
| OD-01 | Verified minimum deposit or authorized override | Cumulative verified net payments meeting the minimum deposit confirm the reservation atomically in the payment transaction. Staff/Owner override below threshold requires a reason and audit. |
| OD-02 | Configurable hold TTL, Staff override, clamped before session | Hold TTL is configurable. A specific booking override is permitted by Staff/Owner, but effective deadline must be clamped before session start. If no default is configured, hold creation fails closed. |
| OD-03 | Balance-due trigger by service/option | Rehearsal is due at check-in; Recording is configurable before session or at check-in; Mix & Master is due by project milestone before delivery. |
| OD-04 | No-deposit path immediately confirms accepted Offer | When effective deposit policy is none, accepted Offer (or permitted Admin creation) goes directly to confirmed, not deposit_hold. |
| OD-05 | Multiple pending evidence submissions allowed | Multiple pending proofs may coexist. Warn about duplicates and pending total. Verification must use live balance and atomic double-credit protection. |
| OD-06 | Staff desk cash | Staff/Owner can record real studio desk cash with staff_cash_desk. Client cannot submit cash. Non-cash Client payments remain proof-backed by default. |
| OD-07 | Below-minimum DP remains held; override available | Verified payment below minimum leaves reservation in deposit_hold and marks partial_below_minimum; show the exact top-up gap. Staff/Owner may override only with reason and audit. |
| OD-08 | Extension initially Staff/Owner only | Staff/Owner may extend a hold with reason and audit. Client extension request/button is deferred. |
| OD-09 | Pending evidence protects the hold | A hold cannot be manually expired while payment evidence is pending review. Staff reviews or rejects the proof first. |
| OD-10 | Late payment after expiry never silently resurrects | Recheck slot availability and require explicit Staff restoration. If slot is taken, route the money into refund/credit case handling. |
| OD-11 | Price decrease below paid amount becomes overpaid/credit | Balance never becomes negative. Surface excess as credit/overpayment and require a refundCases resolution; never erase old payment records. |
| OD-12 | Refund case links to source transactions | refundCases references sourcePaymentTransactionIds. Refund is separate from reversal; bookkeeping derives the outflow from refund case state rather than duplicating it into the payment ledger. |
| OD-13 | New sent Offer revision supersedes previous sent Offer atomically | When a new revision is sent, prior sent Offer becomes superseded in the same transaction. Accepted Offer is immutable; subsequent changes use Change Request / Adjustment. |
| OD-14 | Explicit one-to-one identity review; no silent merge | Propagate clientUid to booking, clientReservations and invoice. Legacy CRM links require explicit Owner-reviewed identity confirmation; never auto-merge by phone/name/email. |

## 12. Delivery phases and dependency order

| Phase | Scope | Must be true before the next phase |
|---|---|---|
| Phase 0 — Architecture Freeze | Audit, PRD, domain model, data contracts, state machines, transaction/rules analysis, migration plan, OD decisions | Architecture and Owner decisions approved. This phase is complete. |
| Phase 1 — Core Domain, Identity & Policy Foundation | Booking Policies singleton/service/UI, safe Public Pricing Catalog v4, dual client identity propagation, clientReservations projection/backfill foundation, legacy normalization, operational compatibility fixes, transaction/rules foundations | Lint, unit tests, Rules emulator and build all pass; identity reconciliation and transaction/rules consistency gates close; Phase 1 explicitly accepted. |
| Phase 2 — Offer Revisions & Deposit Hold Engine | Offer subcollection/revisions, quote_only/deposit_hold_offer, reservation and session state separation, hold creation/extension/manual expiry, confirmation gates, overdue UI | Phase 1 accepted and deployed under separate approval. |
| Phase 3 — Multi-Method Payment, Staff Cash & Price Adjustments | Multiple evidence/payment methods, Staff cash, verified ledger transaction paths, adjustment ledger, evidence/policy consistency | Phase 2 lifecycle live and the payment decisions implemented consistently. |
| Phase 4 — Client Change Requests & Refund Lifecycle | Client change approval, atomic schedule swaps, cancellation/paid balance handling, refundCases and bookkeeping | Phase 3 financial engine verified. |
| Phase 5 — Mix & Master Project Engine | Project, quotations, materials, milestones, revisions, delivery, project billing; zero room slot dependency | Shared financial engine stable. |

No later phase may be started just because its design is documented. It depends on preceding implementation and acceptance.

## 13. Transaction, compatibility and security constraints

- Read all required Firestore documents before writes in a transaction.
- Use deterministic IDs/idempotency keys where specified by the data contracts.
- Use optimistic versions for mutable state-bearing documents.
- Respect Firestore Security Rules lookup constraints: individual-operation limits and the combined multi-document transaction budget must be validated in emulator tests.
- Keep batch/transaction work bounded. Existing migration design caps risky multi-entity operations at five records per invocation/transaction group.
- Keep composite indexes aligned with actual query shape.
- Client can read only own customer-safe records; Staff/Owner access is based on explicit roles and policy.
- Preserve V1 booking semantics through read-time normalization. Never turn legacy confirmed bookings into deposit holds.
- Do not destructively rewrite historical invoices, payment transactions, evidence, commissions, or slot records as a convenience migration.
- No production backfill until the Owner authorizes it after emulator and diagnostic validation.

## 14. What Phase 1 does and does not deliver

### Phase 1 foundation includes
- Booking Policies configuration and normalization.
- Owner-facing Booking Policies settings.
- A customer-safe Public Pricing Catalog v4 policy preview.
- clientUid propagation and clientReservations projection support.
- A limited Owner-triggered, resumable backfill for records provably connected to a matching Client Portal request.
- Billing/payment/evidence read ownership updates.
- Compatibility fixes and bounded batch changes.

### Phase 1 does not yet deliver
- Offer issuance, acceptance, revision or superseding UI/service.
- Creating real deposit holds from Offers.
- Atomic deposit threshold confirmation transition.
- Manual hold expiry or restoration workflow.
- Full invoice balance-due enforcement.
- Full payment methods, Staff cash and adjustment engine.
- Change Request approval workflow.
- Refund case lifecycle.
- Mix & Master Project lifecycle.
- General Owner-reviewed identity-link user interface for all legacy CRM records.

This distinction is central. Later sessions must not describe the complete engine as implemented merely because its specification and foundational policy settings exist.
