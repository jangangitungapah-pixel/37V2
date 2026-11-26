# Phase 1 Gate 3 — Transaction, Projection and Rules Audit

**Status:** Static source audit and remediation changes are committed on the Phase 1 feature branch. Final local diagnostics are pending; Gate 3 is **not yet marked PASS**.
**Scope:** Existing Phase 1 booking, CRM identity, invoice, payment/evidence, and Client reservation projection paths.
**Out of scope:** Phase 2 booking-engine expansion, production deployment, production data migration, or execution of the Owner backfill.

## 1. Audit principles

Every mutation is reviewed against the Phase 0 data contracts and the existing Firestore execution model:

- All transaction document reads must finish before the first write.
- IDs that govern retries must be deterministic or generated before entering the transaction callback.
- Mutable canonical documents use optimistic version checks/increments.
- Customer-facing projection updates must share the same transaction as the canonical booking or invoice mutation.
- Conflicting booking-slot ownership must abort the transaction without partial schedule changes.
- Query fields/orderings must have matching committed composite indexes.
- Multi-entity batch jobs must retain their conservative five-record/write ceiling where specified.
- Firestore Rules access-call budgets must be verified in the Emulator, not inferred from code inspection alone.

## 2. Transaction audit

| Flow | Canonical reads and writes | Consistency result from source review |
|---|---|---|
| Client booking request → Calendar conversion | The Calendar transaction reads the request, booking/event, CRM customer and phone-index records, deterministic invoice/payment documents, and required slot locks before writing. On success it creates the booking, invoice, reservation projection, public availability, slot locks, event, and request confirmation/activity in one transaction. | Request identity (Client UID, CRM customer ID, request ID) is carried to the booking and invoice. Slot conflicts are detected before writes. IDs are prepared before the transaction callback. |
| New booking / initial payment | Booking ID, event ID, invoice ID (inv_{bookingId}), and initial payment ID (pay_initial_{bookingId}) are stable for transaction retries. | Invoice, optional initial payment, booking, and reservation projection are created atomically. Client Portal-origin bookings cannot assert an initial paid amount; their proof follows the evidence workflow. |
| Calendar edit / reschedule | Reads the canonical booking, idempotency event, canonical invoice, and the union of old/new slot documents before writes. | Expected version is checked, booking version increments, old locks are released only when owned by the booking, conflicting target locks abort, and the reservation/public-availability projections are written atomically. |
| Calendar cancellation | Reads booking, event, invoice, and existing slot locks before writes. | Cancellation increments the canonical booking version, releases only owned slot locks, appends the event, and synchronizes reservation/public-availability projections. |
| Session lifecycle | Reads booking, event, invoice, and (for No Show) existing slot locks before writes. | Check-In, Start, Complete, and No Show preserve the read-before-write boundary and update the customer projection with the canonical lifecycle transition. No Show releases its locks. |
| Manual payment and reversal | Reads invoice, target transaction/reversal, optional evidence, and reservation before writes. | Invoice aggregate, append-only payment/reversal transaction, and matching reservation payment summary are synchronized in one transaction. Existing non-empty UID conflicts prevent a reservation summary write. |
| Client payment evidence | Submission reads the parent invoice and creates only the pending evidence record. Verification reads evidence, invoice, deterministic payment transaction, and reservation before writes. | Submission does not alter the invoice or ledger. Verification atomically writes the payment transaction, updates invoice totals, updates the reservation summary when identity matches, and marks evidence verified. Rejection only changes evidence review state. |
| Legacy invoice import | The service scans in bounded pages, derives fixed invoice/payment IDs, and groups invoice + initial-payment writes without splitting the pair. | Existing invoices are idempotent skips; ambiguous or inconsistent legacy records remain in Needs Review rather than being silently imported. |
| Owner Client-reservation reconciliation | Scans at most five bookings per click. Each candidate has its own transaction; canonical booking is read first, then request/invoice/CRM link/account/projection references are read before writes. | Only confirmed Portal request identity or an explicit active Owner-reviewed CRM link is accepted. Conflicting UIDs are skipped. Booking/invoice UID pointers and the projection are updated atomically; ledger/evidence history is not rewritten. |

## 3. Gate 3 defect found and remediation

The audit found one concrete projection-consistency defect in Calendar mutation paths:

- Edit/reschedule, cancellation, and session lifecycle code loaded inv_{bookingId} only when booking.clientUid was non-empty.
- A valid CRM-linked walk-in can have a populated customerId and an intentionally blank clientUid.
- For such a booking, a later Calendar mutation could pass no invoice to the projection builder. The builder would then fall back to the booking's legacy initial-payment snapshot, which can be stale after the invoice has received payments. Firestore Rules compare the projection's financial summary with the canonical invoice, so such a write could be rejected or would otherwise be inconsistent.

**Correction:** All three Calendar mutation paths now read the deterministic invoice whenever the booking exists, independent of clientUid. The projection builder can therefore continue to use invoice-authoritative total and payment status.

**Regression coverage added:** an in-memory Calendar test creates three CRM walk-ins with blank UIDs and Partial invoices, then exercises edit, cancellation, and Check-In; each resulting client reservation payment status must remain Partial.

## 4. Firestore Rules and query coverage

The schema v2 clientReservations projection is allowlisted to 27 fields. Rules compare its identity, request references, schedule, lifecycle state, version, and financial summary with the post-transaction booking/invoice documents.

- Clients may read only a projection whose non-empty Client UID or active CRM customer binding belongs to them.
- Client create/update/delete is denied.
- Staff projection writes require a matching canonical booking or invoice mutation in the same commit.
- Owner may create/repair an eligible legacy projection through the bounded reconciliation path.
- The projection's financial summary is checked against the invoice when it exists; only a legacy booking without an invoice uses the booking's initial-payment fallback.
- A Client linked to a CRM Customer cannot list another Customer's projection. The Emulator suite exercises both the clientUid + updatedAt DESC and customerId + updatedAt DESC bounded queries.

Required indexes are present in firestore.indexes.json:
- clientReservations: clientUid ASC + updatedAt DESC.
- clientReservations: customerId ASC + updatedAt DESC.
- Invoice, payment transaction, and payment evidence owner/invoice composite indexes used by their respective repository queries.

### Rules lookup-budget regression

The existing six-hour Staff booking Rules test uses 12 half-hour slot locks and the associated customer, phone index, booking, invoice, initial payment, event, and public availability writes. It now also includes the schema v2 clientReservations create in the same commit. This is intended to exercise the projection's get/getAfter checks together with the slot and financial Rules checks under the Firestore transaction access-call budget.

The test must pass in the local Firestore Emulator before the budget is considered verified.

## 5. Bounded batch inventory

| Workflow | Bound |
|---|---:|
| Client reservation Owner backfill | 5 canonical bookings per click; one transaction per candidate |
| Customer migration batch writes | Maximum 5 writes per batch |
| Commission posting | Maximum 5 booking items per batch |
| Legacy invoice import | Maximum 5 writes per batch; invoice + initial payment stay together |
| Legacy invoice preview | Paginated scan, up to 200 bookings per page |

The preview scan page size is not a write-batch size. No full-collection write or production backfill is introduced.

## 6. Verification status and safe execution boundary

Code review and regression additions are committed, but no claim is made that the latest source has passed local lint, Vitest, Firestore Emulator, or production build. Gate 2's earlier successful diagnostic run does not verify these later changes.

Run from the local repository root, on this branch:

    git pull --ff-only origin feature/phase-1-core-domain-identity-policy-foundation
    npm run verify:phase1

Record the exact HEAD, working-tree status, and full diagnostic output. If any stage fails, Gate 3 remains open and the failure must be fixed before rerunning the full suite.

No Firebase Rules/indexes/Hosting deployment, production backfill, data migration, or destructive operation is authorized by this audit. Phase 2 remains blocked until Gate 3 passes and the Owner explicitly accepts Phase 1 closure.
