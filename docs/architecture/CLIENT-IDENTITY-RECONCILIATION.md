# Owner-Reviewed Client Identity Reconciliation — Phase 1 Gate 2

**Status:** Implemented on the Phase 1 feature branch; local verification pending.  
**Scope:** Link an active, isolated Client Portal account to one explicitly selected, active CRM Customer.  
**Out of scope:** Reassignment of an already-linked Client, account merging, historical financial rewrites, production backfill, and automatic identity inference.

## 1. Purpose and identity model

37V2 uses two independent identifiers:

- **Client UID:** the Firebase Authentication UID for the Client Portal account.
- **CRM Customer ID:** the canonical studio customer record used by CRM and operational history.

The current model stores the binding in three existing documents:

- `clientAccounts/{uid}` — the Client account's active `customerId` and `profileSource`.
- `clientCustomerLinks/{customerId}` — the one-to-one reverse binding from CRM Customer to Client UID.
- `clientProfiles/{customerId}` — the Client-safe profile projection for that CRM Customer.

This workflow extends those existing records. It does not create a parallel identity graph.

## 2. Owner review workflow

From an active CRM Customer's detail drawer, an active Owner can open **Hubungkan Akun Client**.

The Owner must select one account from the bounded list of active isolated Client accounts and enter a review reason of 10–1000 characters. The workflow does not preselect or automatically match an account using phone, name, email, or any other similarity hint. The target CRM Customer is the one already opened in the detail drawer.

Candidate discovery is limited to active accounts where:

- `role == 'client'`
- `status == 'active'`
- `profileSource == 'isolated_client_profile'`
- `customerId == 'client_' + uid`

The list request returns at most 100 candidates. The transaction revalidates all identity conditions; the candidate list and UI are not authorization boundaries.

## 3. Transaction preconditions

The transaction re-reads and validates:

1. The current account exists, is an active Client, and is still bound to its synthetic `client_{uid}` customer ID.
2. The source `clientCustomerLinks` and `clientProfiles` documents exist and both point to that same UID and isolated profile source.
3. The selected CRM Customer exists and is active.
4. The target `clientCustomerLinks/{customerId}` does not already exist.
5. The target `clientProfiles/{customerId}`, when present, is active, uses `linked_customer`, and has no `ownerUid`.
6. An Owner-authorized preflight query checks whether another `clientAccounts` document already claims the target `customerId`, including orphaned account claims whose reverse-link document is missing. This is deliberately outside the Firestore transaction because the Firestore Web SDK transaction API accepts document-reference reads, not query reads. The transaction then re-reads the target `clientCustomerLinks` and `clientProfiles` documents and uses their atomic creation/update as the canonical one-to-one lock for concurrent identity-link operations.
7. The deterministic audit operation has not already been used.

A Client account already bound to a different real CRM Customer is rejected as `reassignment-blocked`. Reassignment, unlinking, duplicate-identity disputes, and conflicting bindings require a separate explicit review process. They are not silently handled by this workflow.

## 4. Atomic writes

On success, one Firestore transaction:

- Updates `clientAccounts/{uid}` to the target CRM Customer and `profileSource: 'linked_customer'`, incrementing its version.
- Creates or updates the target `clientProfiles/{customerId}` with the canonical Customer display name, normalized email, and phone display. A safe existing photo URL may be preserved; internal CRM notes are not copied.
- Creates `clientCustomerLinks/{customerId}` with the selected UID as its owner.
- Creates one immutable audit document at `clientIdentityLinkAudits/link_{uid}_{customerId}`.

The old synthetic `clientCustomerLinks/client_{uid}` and `clientProfiles/client_{uid}` records are preserved as inert historical records. They are no longer an active Client binding: Client reads now require the authenticated account's current `customerId` to match the requested link.

The workflow does not write to or rewrite:

- `customers/{customerId}`
- `customerEmailIndex/{email}`
- bookings, booking requests, or `clientReservations`
- invoices
- payment transactions
- payment evidence
- refunds, commissions, or bookkeeping entries

No production backfill or migration is performed.

## 5. Immutable audit contract

The Owner-created audit document contains exactly these fields:

| Field | Meaning |
|---|---|
| `schemaVersion` | Audit schema version 1 |
| `operationId` | Deterministic ID: `link_{clientUid}_{customerId}` |
| `action` | `owner_reviewed_legacy_link` |
| `clientUid` | Client Authentication UID |
| `actorUid` | Authenticated Owner UID |
| `fromCustomerId` | Original synthetic `client_{uid}` ID |
| `toCustomerId` | Explicitly selected CRM Customer ID |
| `fromProfileSource` / `toProfileSource` | Before/after profile-source values |
| `reviewReason` | Owner's 10–1000 character review note |
| `reviewedAt` / `createdAt` | Server request timestamps |
| `accountVersionBefore` / `accountVersionAfter` | Account version transition |
| `version` | Audit document version 1 |

Only an active Owner can create or read/list these audit records. Update and delete are always denied, including for Owner. The deterministic operation ID allows a retry after a successful commit to return the existing result without incrementing account version or creating a second audit event.

## 6. Billing and historical ownership boundary

The identity transaction never changes historical invoice, payment transaction, or evidence fields.

The current read contracts distinguish CRM Customer ownership from UID-pinned payment records:

- An issued/void invoice can be visible through the verified CRM Customer binding.
- A payment transaction or payment evidence item is readable only when its parent invoice is readable **and** its own UID/parent-invoice UID constraints remain compatible.
- Therefore, a historical payment transaction or evidence item that is explicitly pinned to a different Client UID remains restricted. This workflow does not transfer that financial record to the newly linked UID.

This behavior is intentional: identity reconciliation must not fabricate payment ownership or rewrite financial history. The Owner should handle any exceptional historical financial reconciliation through a separate audited process.

The currently authenticated Client session may be ended by the existing AuthProvider account watcher when the account's expected CRM binding changes. The Client should sign in again so the Portal loads the new Client account and CRM profile.

## 7. Security enforcement

Firestore Rules enforce the Owner path independently of the UI:

- `clientAccounts/{uid}` accepts only the isolated-to-linked Owner transition, with matching after-state link, profile, and audit documents.
- `clientCustomerLinks/{customerId}` remains immutable after creation. Owner can create the target link only as part of the validated identity transaction.
- `clientProfiles/{customerId}` supports Owner creation for a missing profile or a narrow Owner update when the existing linked profile is unclaimed.
- `clientIdentityLinkAudits/{operationId}` is Owner-readable and append-only.
- Client and Staff cannot directly mutate the canonical identity binding or the identity audit.
- The source synthetic link remains stored, but Client GET access is revoked once the account's canonical `customerId` changes.

No Cloud Functions, scheduled jobs, Cloudflare Workers, Firebase Storage, Blaze, or paid infrastructure is introduced.

## 8. Required verification

The implementation adds:

- In-memory service tests for successful link, explicit selection, one-to-one conflict, orphaned account claim, reassignment denial, Owner-only service access, and idempotent retry.
- Firestore Emulator tests for Owner atomic linking, both target-profile creation and unclaimed-profile update, retained source history with revoked Client access, Client/Staff mutation denial, one-to-one conflict, audit immutability, and unchanged UID-pinned financial records.

**Gate 2 remains unverified until the user runs the full local Phase 1 diagnostics against the latest branch commit and shares a clean result.** Gate 3 and explicit Owner acceptance remain separate requirements.
