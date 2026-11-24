# PAYMENT EVIDENCE & VERIFICATION v1 — ARCHITECTURE

## 37 Music Studio (`37V2`) — Client Payment Proof Upload, Verification & Optional Admin Attachments

**Primary Routes:**
- Client Portal: `/portal/invoices` (Invoice Detail Drawer + Directory indicators)
- Admin Portal: `/admin/payment-and-bill?tab=evidence` (`Payment Evidence` review queue, Review Drawer, Invoice Detail Drawer, Record Payment Dialog)
- Admin Calendar: `/admin/calendar` (`BookingFormDialog` — Client Portal conversion lock & optional Admin initial payment proof)

**Firestore Collections:** `paymentEvidence` (new), `invoices` (extended), `paymentTransactions` (extended)  
**Media Storage:** Direct unsigned image uploads to Cloudinary via dedicated preset (`VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET`)  
**Infrastructure Model:** Strict **Firebase Spark-only** (Firebase Authentication + Cloud Firestore + Firebase Hosting + Cloudinary unsigned uploads; **zero** Cloud Functions, Cloudflare Workers, backend servers, Firebase Storage, Blaze upgrades, payment gateways, or Cloudinary API Secrets in browser code).

---

## 1. Policy Model: Mandatory Client Portal vs Optional Admin-Managed

| Invoice Origin | `clientPaymentEvidenceRequired` | Client Portal Upload | Admin Manual Payment (`RecordPaymentDialog` / Initial DP) |
|---|---|---|---|
| Converted from `publicBookingRequests` with `source === 'client_portal'` | `true` (immutable) | **Mandatory** for `issued` invoices with `balanceDue > 0` | **Blocked** (`booking/client-evidence-required` on conversion, `payment/client-evidence-required` on manual recording, enforced in `firestore.rules`) |
| Admin walk-in / WhatsApp / Phone / Public anonymous request / Legacy invoices | `false` (default & normalized safely when missing) | Hidden (preserves Phase 4 experience) | **Allowed**; attaching an evidence image is strictly **optional** (cash/transfer without image works unchanged) |

### Trusted Server-Verified Derivation
- During `createBooking()` (`src/features/admin/calendar/services/calendar-booking-service.js`), `isClientPortalOrigin` is derived strictly from the persisted Firestore document `publicBookingRequests/{bookingRequestId}.source === 'client_portal'`, never from untrusted URL params or UI flags.
- `clientPaymentEvidenceRequired` is frozen on `invoices/{invoiceId}` at creation time and locked immutable by `firestore.rules` (`isInvoiceImmutableFieldsUnchanged`).
- Legacy invoices (20 fields, missing `clientPaymentEvidenceRequired`) normalize safely to `false` in `normalizeInvoiceRecord()`, `projectClientInvoiceRecord()`, and `firestore.rules` (`data.get('clientPaymentEvidenceRequired', false)`).

---

## 2. Firestore Data Model

### A. `paymentEvidence/{evidenceId}` (`schemaVersion: 1`, 23 fields)

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `1` | Schema version |
| `invoiceId` | `string` | Parent `invoices/inv_{bookingId}` |
| `invoiceNumber` | `string` | Canonical `37MS-YYYYMMDD-XXXXXXXXXXXX` |
| `bookingId` | `string` | Canonical booking ID |
| `customerId` | `string` | Canonical customer ownership ID |
| `clientUid` | `string` | Submitting client UID (`''` for `admin_manual`) |
| `evidenceSource` | `'client_portal' \| 'admin_manual'` | Submission provenance |
| `status` | `'pending_review' \| 'verified' \| 'rejected' \| 'attached'` | Lifecycle status |
| `claimedAmount` | `int > 0` | Integer IDR amount claimed/attached |
| `paymentMethod` | `'cash' \| 'transfer' \| 'qris' \| 'other'` | Payment method |
| `claimedPaidAt` | `YYYY-MM-DD` | Payment date (`Asia/Jakarta`) |
| `referenceNumber` | `string` (0–120) | Optional transfer/QRIS reference |
| `evidence` | `map` (10 keys) | Validated Cloudinary metadata: `provider`, `cloudName`, `cloudinaryPublicId`, `cloudinaryAssetId`, `secureUrl`, `resourceType`, `format`, `width`, `height`, `bytes` |
| `submittedByUid` | `string` | Actor UID (Client or Staff/Owner) |
| `submittedAt` | `timestamp` | Submission timestamp |
| `reviewedAt` | `timestamp \| null` | Review timestamp (`null` until reviewed) |
| `reviewedByUid` | `string` | Reviewing Staff/Owner UID (`''` until reviewed) |
| `rejectionReason` | `string` (0–300) | Mandatory (`3..300` chars) when `rejected` |
| `verifiedAmount` | `int \| null` | Recorded amount (`verified` or `attached`) |
| `linkedTransactionId` | `string \| null` | `pay_evidence_{evidenceId}` (verified) or linked payment tx ID (attached) |
| `createdAt`, `updatedAt` | `timestamp` | Audit timestamps |
| `version` | `int >= 1` | Optimistic concurrency version |

### B. `invoices/{invoiceId}` & `paymentTransactions/{transactionId}` Extensions
- `invoices/{invoiceId}` adds immutable boolean `clientPaymentEvidenceRequired` (accepting both 20-key legacy and 21-key new documents).
- `paymentTransactions/{transactionId}` adds `source: 'client_evidence_verified'` with deterministic transaction ID `pay_evidence_{evidenceId}`.

### C. Single-Field Index Query Strategy (Zero Custom Composite Indexes)
- Client invoice evidence: `where('customerId', '==', customerId)`, `where('invoiceId', '==', invoiceId)`, `limit(51)`, sorted newest-first in memory.
- Client customer-wide evidence: `where('customerId', '==', customerId)`, `limit(101)`, grouped by `invoiceId` in memory for directory indicators.
- Admin evidence queue: `orderBy('submittedAt', 'desc')`, `limit(maxLimit + 1)` (default `100`, paginated via `Load More`), filtered in memory by status (`pending_review` prioritized by default) and search query.
- Admin invoice drawer evidence: `where('invoiceId', '==', invoiceId)`, `limit(51)`, sorted newest-first in memory.

---

## 3. Shared Direct Unsigned Cloudinary Upload Module

Located under `src/features/payment-evidence/`:
- `config/payment-evidence-config.js`: Reads `VITE_CLOUDINARY_CLOUD_NAME` and **dedicated** `VITE_CLOUDINARY_PAYMENT_UPLOAD_PRESET` (`37payment-evidence`). Strictly **never** falls back to Gallery's `VITE_CLOUDINARY_UPLOAD_PRESET` (`37gallery`).
- `services/cloudinary-payment-evidence-upload-service.js`:
  - Enforces 1 image at a time, `JPG/JPEG/PNG/WEBP` only, max `5 MB` (`5242880` bytes), non-empty.
  - Sends randomized non-identifying filename (`pe_<random>.<ext>`) so uploaded public IDs never contain customer names, phone numbers, or invoice numbers.
  - Strictly validates Cloudinary response (`secure_url` HTTPS on `res.cloudinary.com/{cloudName}/image/upload/...`, `resource_type === 'image'`, allowed format, positive dimensions, `bytes <= 5 MB`).
- `hooks/usePaymentEvidenceUpload.js`: Tracks 8 upload states (`idle`, `validating`, `ready`, `uploading`, `uploaded`, `saving_metadata`, `completed`, `failed`), supports cancellation via `AbortSignal`, and **preserves `uploadedAsset` metadata across Firestore write failures** so retries do not re-upload duplicate images.

---

## 4. Atomic Verification, Rejection & Financial Integrity

1. **Client Submission (`submitClientPaymentEvidence`)**:
   - Validates active client session, customer ownership, `invoiceStatus === 'issued'`, `clientPaymentEvidenceRequired === true`, `balanceDue > 0`, `0 < claimedAmount <= balanceDue`, and validated Cloudinary asset.
   - Writes ONLY `paymentEvidence/{evidenceId}` (`status: 'pending_review'`). **Never** modifies `invoices` or `paymentTransactions`.
2. **Shared Atomic Payment Core (`applyValidatedPaymentInTransaction`)**:
   - Extracted in `src/features/admin/payment/services/payment-service.js` and reused by BOTH `recordInvoicePayment()` and `verifyClientPaymentEvidence()` so arithmetic, `expectedVersion` checks, overpayment protection (`0 < amount <= invoice.balanceDue`), and status transitions (`unpaid -> partial -> paid`) remain a single source of truth.
3. **Admin Verification (`verifyClientPaymentEvidence`)**:
   - Executes inside ONE atomic Firestore transaction:
     1. Reads `paymentEvidence/{evidenceId}`, `invoices/{invoiceId}`, and `paymentTransactions/pay_evidence_{evidenceId}`.
     2. Idempotent replay: if evidence is already `verified` AND `pay_evidence_{evidenceId}` already exists, returns cleanly without double-recording.
     3. Rejects non-pending evidence, mismatched `expectedInvoiceVersion`, void/paid invoices, or `verifiedAmount > live invoice.balanceDue`.
     4. Atomically writes `paymentTransactions/pay_evidence_{evidenceId}` (`source: 'client_evidence_verified'`), updates `invoices/{invoiceId}`, and updates `paymentEvidence/{evidenceId}` to `status: 'verified'`, `verifiedAmount`, `linkedTransactionId`, `reviewedByUid`, `reviewedAt`, `version + 1`.
4. **Admin Rejection (`rejectClientPaymentEvidence`)**:
   - Requires `rejectionReason` (`3..300` trimmed chars). Transitions `pending_review -> rejected` without touching `invoices` or `paymentTransactions`. Client sees the rejection reason and can upload corrected evidence.
5. **Payment Reversals & Voiding**:
   - Existing `reversePaymentTransaction()` continues working on verified Client Portal payments (restoring `balanceDue`) while preserving `paymentEvidence` audit records unchanged and displaying a reversed indicator in Admin UI.
   - `voidInvoice()` still requires `amountPaid === 0` and preserves `clientPaymentEvidenceRequired`.

---

## 5. Firestore Security Rules & Factory Reset

- **`paymentEvidence/{evidenceId}`:**
  - `get`: Active Staff/Owner OR owning active Client (`isClientOwnerOfCustomer` + `isClientReadableParentInvoice`).
  - `list`: Active Staff/Owner OR owning active Client (`isClientOwnerOfCustomer`).
  - `create`: Blocked while Factory Reset is locked. Allows either:
    - Active Client creating `client_portal` + `pending_review` on own `issued`, `clientPaymentEvidenceRequired == true`, `balanceDue > 0` invoice with `claimedAmount <= balanceDue` and validated HTTPS `res.cloudinary.com/{cloudName}/image/upload/...` asset.
    - Active Staff/Owner creating `admin_manual` + `attached` atomically linked via `getAfter()` to a valid `paymentTransactions` entry and `issued` invoice.
  - `update`: Active Staff/Owner ONLY, strictly transitioning `client_portal` + `pending_review -> verified | rejected` with immutable field preservation, `version + 1`, and `getAfter()` cross-checks against `paymentTransactions/pay_evidence_{evidenceId}` and `invoices/{invoiceId}` on verification.
  - `delete`: Factory Reset Owner execution ONLY (`canFactoryResetDelete()`).
- **`invoices` & `paymentTransactions`:**
  - Creating an invoice with `clientPaymentEvidenceRequired == true` requires `amountPaid == 0`.
  - Creating a `payment` transaction for a `clientPaymentEvidenceRequired == true` invoice requires `source == 'client_evidence_verified'`, `transactionId == 'pay_evidence_' + evidenceId`, and `getAfter()` proof that `paymentEvidence/{evidenceId}` is `verified` with matching invoice, customer, booking, amount, and `linkedTransactionId`.
- **Factory Reset:** `paymentEvidence` is registered as target #7 (in the `financial` group, deleted before `paymentTransactions` and `invoices`) in `FACTORY_RESET_DELETION_MANIFEST` (21 total targets). Cloudinary assets are never deleted by Factory Reset.

---

## 6. Public Cloudinary Delivery URL Trade-Off & Mitigations

Because this application runs strictly on **Firebase Spark** with direct unsigned Cloudinary uploads, **uploaded payment proof images use public Cloudinary delivery URLs (`https://res.cloudinary.com/...`)**. Anyone who obtains the exact URL can access the image. **Firestore Security Rules protect metadata documents only; they do NOT make Cloudinary image URLs private.**

Implemented mitigations:
1. Dedicated Cloudinary upload preset (`37payment-evidence`), isolated from Studio Gallery (`37gallery`).
2. Random, non-identifying filenames (`pe_<random>.<ext>`) — no customer names, phone numbers, emails, or invoice numbers in public IDs.
3. Strict file validation (`JPG`, `PNG`, `WEBP` only; max `5 MB`).
4. Explicit privacy disclosure displayed in the upload UI advising users to hide sensitive card/PIN details before uploading.
5. Zero Cloudinary API Secrets or signed credentials in browser code.

---

## 7. Known Limitations & Future Hardening Path

- **No Automatic Cloudinary Purge:** Deleting operational records via Factory Reset removes Firestore `paymentEvidence` documents but does not call Cloudinary Destroy APIs (which require server-side API Secrets).
- **Public Delivery URLs:** True private authenticated image delivery (signed URLs or private Cloud Storage buckets with token verification) would require migrating off Spark-only to a server-side signing layer (e.g., Cloud Functions on Blaze) in a future phase.
- **No Automated OCR / Bank Mutation Reconciliation:** Staff/Owner manually inspect uploaded images and confirm the verified amount against studio bank/QRIS records.
