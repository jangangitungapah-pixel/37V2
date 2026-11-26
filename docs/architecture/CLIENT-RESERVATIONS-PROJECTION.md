# Client Reservations Projection — Phase 1 Gate 3

**Status:** Gate 3 remediation implemented on the Phase 1 feature branch; local verification pending.  
**Canonical source:** `bookings/{bookingId}`  
**Client-facing read model:** `clientReservations/{bookingId}`  
**Schema:** version 2  
**Execution boundary:** Firebase Authentication + Cloud Firestore only; no Cloud Functions, scheduled workers, or production backfill is run by this change.

## 1. Purpose and ownership

`clientReservations` is the bounded, customer-safe read projection for confirmed and operational studio bookings. It prevents the Client Portal from treating the original booking-request snapshot as the ongoing source of truth after Calendar changes the booking.

A projection is eligible when the canonical booking has a non-empty CRM `customerId` or a non-empty Client Authentication UID. This permits two valid cases:

- Client Portal-origin booking: `clientUid` is set and the request identity is retained.
- CRM-linked walk-in / Admin-created booking: `customerId` is set and `clientUid` may be the empty string until an Owner-reviewed account link is explicitly backfilled.

An empty `clientUid` does not grant access by itself. Client read access is granted only through either:
1. The authenticated, active Client UID matching a non-empty `clientUid`; or
2. The active account's canonical `customerId` matching the projection, with the matching one-to-one `clientCustomerLinks/{customerId}` binding owned by that UID.

A Client can never create, update, or delete this projection. Staff may write a projection only in the same atomic commit as a matching canonical booking or invoice mutation. Owner may also create or repair a legacy projection through the explicit, bounded reconciliation action. Deletion remains restricted to the existing Factory Reset boundary.

## 2. Schema v2

The projection has an allowlisted 27-field shape:

| Group | Fields |
|---|---|
| Identity | `schemaVersion`, `bookingId`, `bookingReference`, `customerId`, `clientUid`, `sourceRequestId`, `acceptedOfferId`, `invoiceId` |
| Schedule & service | `studioId`, `studioName`, `serviceTypeName`, `serviceOptionName`, `date`, `startMinute`, `endMinute`, `durationMinutes`, `timeZone` |
| Lifecycle | `reservationStatus`, `sessionStatus`, `holdExpiresAt` |
| Customer-safe financial summary | `effectiveTotalAmount`, `minimumDepositAmount`, `depositStatus`, `paymentStatus` |
| Audit/version | `createdAt`, `updatedAt`, `version` |

The projection deliberately excludes CRM notes, customer phone/email, internal operator/commission details, private booking notes, and payment evidence assets. Financial transaction history remains in its dedicated collections and is not copied into the projection.

Firestore Rules enforce:
- Exact allowlisted keys and schema version 2.
- Stable `bookingId` and expected invoice path.
- Valid studio/time/status/amount field types.
- Agreement with the post-transaction canonical booking for identity, request references, date/time, studio, service labels, lifecycle state, and version.
- Agreement with the post-transaction invoice for the customer-safe total and payment status, while deposit fields remain sourced from the canonical booking.
- Staff create/update only when the same commit also creates or advances the canonical booking or invoice; Owner create/repair for bounded legacy reconciliation; factory-reset-only deletion.
- Client read ownership using the same canonical account/link boundary described above.

## 3. Atomic write lifecycle

The Calendar service builds the projection from the canonical booking and invoice state. It writes the projection in the same transaction as the authoritative mutation:

- New Calendar booking and invoice creation.
- Booking edit and reschedule.
- Cancellation.
- Check-in / session start / session completion / No Show lifecycle transitions.

For every persisted booking, these three later Calendar mutation paths read the deterministic invoice `inv_{bookingId}` before writes even when the booking has a CRM `customerId` but a blank `clientUid`. The projection therefore continues to use invoice-authoritative financial totals and payment status for CRM walk-ins instead of falling back to stale `initialPaidAmount` data on the booking.

When no safe `customerId` or `clientUid` exists, projection creation fails closed. When the booking has CRM identity but no Client Portal UID, it is still projected with `clientUid: ''`; Rules continue to require a valid CRM link for Client access.

The in-memory booking adapter mirrors the same projection writes and exposes an identity-scoped realtime subscription for deterministic integration tests. Booking create/edit/reschedule/cancel/lifecycle and payment summary changes retain the canonical booking/invoice mutation and the projection write in one transaction.

## 4. Client Portal read path

The Client Portal now subscribes to two distinct bounded sources:

- `publicBookingRequests`: source of truth for unconfirmed requests and inquiries.
- `clientReservations`: source of truth for confirmed/operational studio sessions, including CRM-linked walk-ins.

The Firestore repository makes two bounded subscriptions (one for `clientUid`, one for `customerId`), each ordered by `updatedAt DESC` with `limit(maxLimit + 1)`. Results are deduplicated by booking ID, merged, sorted client-side, and truncated to the Client Portal limit. Two explicit composite indexes support these bounded owner/activity queries: `clientUid ASC + updatedAt DESC` and `customerId ASC + updatedAt DESC`.

When a projection is present, the Client UI uses its latest schedule and lifecycle state instead of stale `confirmedBookingSnapshot` values. A matching request contributes context such as the original request reference, but cannot override the canonical schedule. Older confirmed requests without a projection remain visible as a compatibility fallback until reconciled.

The Client booking timeline distinguishes upcoming, completed, cancelled, expired, in-progress, and No Show states. A projection belonging to another CRM Customer is excluded by Firestore Rules and by the in-memory adapter's owner filters.

## 5. Owner-controlled bounded identity backfill

The existing Booking Policies action remains an explicit Owner action. It is not a scheduler and is not invoked automatically.

Each click scans at most five canonical booking documents ordered by `date`, with a document-snapshot cursor. Each candidate is processed in its own Firestore transaction with all reads before any writes.

Eligibility checks:
- For a Client Portal-origin booking, its confirmed request must match the booking ID, customer ID, and Client UID.
- For a CRM-linked walk-in, `clientCustomerLinks/{customerId}` must identify an Owner-reviewed active Client account whose `customerId` and `profileSource` match the CRM binding.
- A conflicting pre-existing UID on the booking or invoice is skipped, never reassigned.
- Missing or inconsistent booking/invoice identities are skipped and counted; they are not guessed or automatically merged.

On a valid CRM-linked walk-in, the transaction may fill an empty `clientUid` pointer on the canonical booking and invoice, and write the customer-safe projection. It never overwrites a different existing UID. The payment ledger, payment evidence, paid amount, received dates, references, and reversal history are not rewritten.

Ordinary eligibility or identity conflicts are counted as skipped records. An unexpected transaction, Rules, or infrastructure exception is propagated instead of being mislabeled as a skip. Because the batch progress document is written only after all candidate transactions finish, a failed batch does not advance its cursor; rerunning is safe because each candidate is transactionally reconciled and unchanged projections are not rewritten.

The scan includes historical bookings and terminal session states so the Client can see its own history. It can be restarted manually after completion to reconcile later Owner-reviewed links. Unchanged projections are not rewritten; unexpected extra fields in an existing projection force a replacement with the strict allowlisted shape.

**No production backfill has been run by this remediation.** Deploying rules or operating the Owner action remains a separate, explicitly approved step.

## 6. Payment summary synchronization

The existing Phase 8 manual payment, Client evidence verification, and reversal flows now update `clientReservations.paymentStatus` inside the same transaction that writes the payment transaction and updates the invoice, when a projection exists.

The payment status is a customer-safe summary only. It does not become a second payment ledger. The invoice and append-only payment transaction records remain authoritative. Before synchronizing an existing projection, the payment services require the booking ID, invoice ID, CRM customer ID, and any non-empty Client UID on the reservation and invoice to agree. A legacy blank UID is tolerated, but two conflicting non-empty UIDs prevent the projection update. After an Owner-reviewed CRM link, invoice summary access may follow the CRM customer binding, but transaction/evidence records pinned to another non-empty UID remain inaccessible. The newly linked Client is also blocked from creating new Client Portal evidence against an invoice pinned to a different UID.

Legacy projection creation derives `paymentStatus` from an existing invoice when available; otherwise it computes the base state from the booking's legacy total and initial paid amount. The projection's `effectiveTotalAmount` also uses the invoice financial snapshot when available before falling back to booking totals.

## 7. Indexes, bounds, and transaction discipline

- Client reservation subscriptions use equality filters by `clientUid` or `customerId`, each ordered by `updatedAt DESC` and limited to `maxLimit + 1`.
- The two bounded owner/activity queries require the committed composite indexes in `firestore.indexes.json`: `clientUid ASC + updatedAt DESC` and `customerId ASC + updatedAt DESC`. Results from the two subscriptions are merged, deduplicated by booking ID, globally sorted by latest activity, then truncated.
- Owner backfill page size is five bookings; each booking is handled in a separate bounded transaction.
- Existing Customer batch writes remain capped at five writes.
- Existing commission posting remains capped at five booking items per posting batch.
- Existing legacy invoice preview scan remains paginated (up to 200 bookings per page); import batches remain bounded to at most five writes and keep invoice/initial-payment pairs together.
- All transaction reads, including optional projection reads, occur before the first write.
- Projection, booking identity pointer, and invoice identity pointer changes are atomic for each backfill candidate.

## 8. Required local verification

The Phase 1 diagnostics must be rerun on the latest commit. Added regression coverage includes:

- Client Portal reads the latest projection schedule instead of a stale request snapshot.
- CRM-linked walk-in projection with blank `clientUid` appears in the Client timeline.
- Cancelled and No Show projection states render as terminal history.
- Another CRM Customer's projection is not exposed.
- Owner backfill projection builder emits the exact schema v2 shape and accepts a blank UID only when a CRM Customer ID exists.
- Firestore Emulator allows a linked Client to read and query its own CRM walk-in projection, denies another Client and Client mutation, rejects a Staff-only projection create, and rejects a standalone Staff payment-summary mutation.
- Firestore Emulator permits Owner creation of a legacy projection and a Staff atomic payment-ledger + invoice aggregate + projection summary update.
- Manual payment, Client evidence verification, and reversal update projection `paymentStatus` consistently when reservation/invoice identity matches.
- Calendar edit, cancellation, and session lifecycle preserve invoice-derived `partial` status for CRM walk-ins with a blank `clientUid`.
- The six-hour / twelve-slot Staff booking Rules-budget case now includes the matching schema v2 `clientReservations` create in the same commit.
- The payment service does not update a projection when its non-empty Client UID conflicts with the invoice UID.
- The in-memory merged reservation subscription returns the most recently updated reservation first.

A passing local diagnostic run is still required before Gate 3 can be marked PASS. Gate 2's earlier successful local run does not substitute for a rerun after these subsequent Gate 3 changes.
