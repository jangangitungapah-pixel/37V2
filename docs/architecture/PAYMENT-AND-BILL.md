# PHASE 8 — PAYMENT & BILL MANAGEMENT ARCHITECTURE

## 37 Music Studio — Invoice Generation & Customer Payment Ledger

**Module Route:** `/admin/payment-and-bill` (supports `?invoiceId=<id>` and `?tab=invoices|transactions|evidence`)  
**Firestore Collections:** `invoices`, `paymentTransactions`, `paymentEvidence`  
**Related Collections:** `bookings`, `customers`  
**Core Model:** `Booking → Invoice → (Optional/Mandatory Payment Evidence) → Payment Transactions → Outstanding Balance`

---

## 1. Core Principles & Scope Boundary

1. **One Booking, One Invoice:** Every Studio Booking creates at most one deterministic invoice document (`invoices/inv_{bookingId}`). Consolidated multi-booking invoicing is explicitly excluded from Phase 8.
2. **Append-Only Payment Ledger:** Every customer payment or correction is stored as its own immutable document inside `paymentTransactions/{transactionId}`. Invoices never embed growing payment arrays.
3. **Immutable Historical Snapshots:** Invoices freeze customer details (`customerSnapshot`), session details (`bookingSnapshot`), and customer billing amounts (`financialSnapshot`) at creation time. Updating Pricing Settings, renaming a Customer Profile, or rescheduling a booking never silently mutates historical invoices.
4. **Strict Separation from Internal Fees:** Staff, Owner, and Recording Operator commissions (`booking.commissionSnapshot`) are strictly excluded from customer invoices, totals, and printable documents.
5. **Integer Rupiah Arithmetic:** All monetary values (`subtotal`, `discountAmount`, `totalAmount`, `amountPaid`, `balanceDue`, `amount`) are stored and computed strictly as integer Rupiah (`IDR`).

---

## 2. Deterministic Identity & Invoice Number Generation

Implemented in `src/features/admin/payment/utils/invoice-number.js`:

- **Invoice Document ID:** `inv_{bookingId}`
- **Initial Payment Transaction ID:** `pay_initial_{bookingId}`
- **Reversal Transaction ID:** `pay_rev_{originalTransactionId}`
- **Invoice Number Format:** `37MS-YYYYMMDD-XXXXXXXXXXXX`
  - `YYYYMMDD` = booking date (`booking.date`, Asia/Jakarta).
  - `XXXXXXXXXXXX` = first 12 uppercase hex characters of `SHA-256("37ms:invoice:" + bookingId)`.
  - Guarantees global stability, collision resistance, and strict idempotency on retry without maintaining a mutable sequence counter.

---

## 3. Firestore Data Model

### A. `invoices/{invoiceId}` (20–21 fields)

- Identity: `invoiceNumber`, `bookingId`, `customerId`, `invoiceStatus` (`draft` | `issued` | `void`), `currency` (`IDR`).
- Payment Evidence Policy: `clientPaymentEvidenceRequired` (`boolean`, immutable; `true` strictly for invoices created from `publicBookingRequests.source === 'client_portal'`, defaulting safely to `false` on Admin-managed and 20-field legacy invoices).
- Immutable Snapshots:
  - `customerSnapshot`: `{ name, phone, bandName }`
  - `bookingSnapshot`: `{ serviceTypeName, serviceOptionName, studioId, bookingDate, startMinute, endMinute, durationMinutes }`
  - `financialSnapshot`: `{ subtotal, discountAmount, totalAmount }`
- Transactional Payment Aggregates: `amountPaid`, `balanceDue`, `paymentStatus` (`unpaid` | `partial` | `paid`), `lastPaymentTransactionId`.
- Metadata & Audit: `invoiceDate`, `dueDate` (`YYYY-MM-DD` or `null`), `voidReason`, `createdAt`, `createdByUid`, `updatedAt`, `updatedByUid`, `version`.

### B. `paymentTransactions/{transactionId}` (15 fields, Append-Only)

- References: `invoiceId`, `invoiceNumber`, `bookingId`, `customerId`.
- Ledger Entry: `transactionType` (`payment` | `reversal`), `amount` (int > 0), `currency` (`IDR`), `paymentMethod` (`cash` | `transfer` | `qris` | `other`), `receivedAt`, `referenceNumber`, `notes`.
- Provenance: `source` (`booking_initial_payment` | `manual` | `legacy_initial_snapshot` | `client_evidence_verified` | `reversal`), `reversalOfTransactionId` (`null` or original tx ID), `recordedByUid`, `createdAt`.
- Deterministic Verified Evidence ID: `pay_evidence_{evidenceId}` (created atomically during Staff/Owner verification of a Client Portal evidence submission).

### C. `paymentEvidence/{evidenceId}` (23 fields)

- Full architecture documented in [PAYMENT-EVIDENCE-AND-VERIFICATION.md](./PAYMENT-EVIDENCE-AND-VERIFICATION.md).
- Stores Client Portal mandatory submissions (`evidenceSource: 'client_portal'`, `status: 'pending_review' | 'verified' | 'rejected'`) and optional Admin-attached proof images (`evidenceSource: 'admin_manual'`, `status: 'attached'`).

### Single-Field Index Strategy (Zero Custom Composite Indexes)

- `invoices` directory: `orderBy('invoiceDate', 'desc'), limit(maxLimit + 1)`
- Calendar invoice range summary: `where('bookingSnapshot.bookingDate', '>=', startDate), where('bookingSnapshot.bookingDate', '<=', endDate), orderBy('bookingSnapshot.bookingDate', 'asc')`
- Customer invoice history (virtual merge compatible): chunked `<= 10` `where('customerId', 'in', chunk), limit(100)`
- `paymentTransactions` global list: `orderBy('receivedAt', 'desc'), limit(maxLimit + 1)`
- Per-invoice transactions: `where('invoiceId', '==', invoiceId), limit(200)` sorted client-side descending by `receivedAt`.

---

## 4. Automatic Invoice & Initial Payment Flow (`createBooking()`)

Extended inside `src/features/admin/calendar/services/calendar-booking-service.js`:

1. **All Reads First:** Reads `bookings/{bookingId}`, `bookingEvents/{eventId}`, `customerPhoneIndex/{phoneHash}`, `invoices/inv_{bookingId}`, `paymentTransactions/pay_initial_{bookingId}`, all 30-min `bookingSlots`, and candidate `customers`.
2. **Idempotent Retry:** If `bookingId` + `eventId` already exist, returns the committed booking immediately with zero duplicate invoice, payment, or customer increments.
3. **Slot & Identity Guards:** Any conflict throws before writes begin, leaving zero orphan customers, invoices, or payment records.
4. **All Writes Atomically:** Writes Customer/PhoneIndex, Booking, BookingSlots, BookingEvent, `invoices/inv_{bookingId}` (`invoiceStatus = 'issued'`), and — strictly when `initialPaidAmount > 0` — `paymentTransactions/pay_initial_{bookingId}` (`source = 'booking_initial_payment'`).

---

## 5. Partial Payments, Overpayment Protection & Status Logic

Implemented in `src/features/admin/payment/services/payment-service.js` and `utils/invoice-status.js`:

- **Atomic Recording (`recordInvoicePayment`):** Pre-generates stable `transactionId`, reads invoice + transaction ID first, verifies `invoiceStatus === 'issued'`, validates `expectedVersion`, enforces `0 < amount <= invoice.balanceDue`, writes the `paymentTransactions` record, and updates `amountPaid`, `balanceDue`, `paymentStatus`, `lastPaymentTransactionId`, and `version + 1` in one transaction.
- **Overdue Determination:** Computed dynamically in Asia/Jakarta local date: `dueDate !== null && dueDate < todayIso && balanceDue > 0 && invoiceStatus !== 'void'`. Invoices without `dueDate` are never auto-marked overdue.
- **Concurrency Safety:** Simultaneous payment submissions against the same invoice serialize via Firestore optimistic concurrency (`version` mismatch or `balanceDue` exceeded), preventing negative balances.

---

## 6. Append-Only Payment Reversal & Void Invoice

- **Payment Correction / Reversal (`reversePaymentTransaction`):**
  - Never updates or deletes an original payment transaction.
  - Creates a compensating record with deterministic ID `pay_rev_{originalTransactionId}`, `transactionType: 'reversal'`, `source: 'reversal'`, `reversalOfTransactionId`, matching `amount`, and mandatory `notes` (reason).
  - Atomically subtracts `amount` from `invoice.amountPaid` and restores `invoice.balanceDue`.
  - UI explicitly warns that reversal is an **entry correction, not a physical refund settlement**.
- **Void Invoice (`voidInvoice`):**
  - Allowed only when `invoiceStatus === 'issued'`, `amountPaid === 0`, and a mandatory `voidReason` (`>= 3` chars) is provided.
  - Rejects voiding invoices with net positive payments and rejects any new payment against a void invoice.
  - Cancelling a Calendar booking does not automatically void its invoice.

---

## 7. Legacy Booking Reconciliation (`legacy-invoice-service.js`)

- **Preview (`scanLegacyBookingsForInvoicesPreview`):** Read-only paginated scan (`pageSize <= 200`) detecting bookings without `invoices/inv_{bookingId}`. Classifies inconsistent initial payment amounts and `cancelled`/`no_show` legacy bookings into `Needs Review`.
- **Resumable Batch Import (`importLegacyBookingInvoices`):** Uses deterministic IDs (`inv_{bookingId}`, `pay_initial_{bookingId}` with `source = 'legacy_initial_snapshot'`), pairs each invoice and its initial payment within conservative `<= 400`-operation batches, never modifies historical bookings/slots/events/customers, and prevents double-counting on retry.
- **Explicit Review (`reconcileNeedsReviewLegacyBooking`):** Allows Staff to explicitly verify paid amount & method per flagged record inside an atomic transaction.

---

## 8. Calendar & Customer Integration

- **Calendar (`AdminCalendarPage`, `useCalendarInvoiceSummaries`, `CalendarBookingCard`, `UpcomingBookings`, `BookingDetailDrawer`):**
  - Uses ONE shared date-range invoice subscription (`bookingSnapshot.bookingDate`), avoiding N+1 per-booking listeners.
  - Calendar payment filters, badges, and Booking Detail Drawer consume the latest Invoice Ledger (`amountPaid`, `balanceDue`, `paymentStatus`, `invoiceNumber`, `Open Invoice` deep link) whenever an invoice exists, falling back to `booking.initialPaymentStatus` only for unreconciled legacy bookings.
  - Repricing an existing booking displays an explicit invoice-snapshot warning rather than mutating issued invoices silently.
- **Customer (`CustomerDetailDrawer`, `useCustomerInvoices`):**
  - Displays an `Invoices & Payments` section querying across `customer.historyCustomerIds` (compatible with virtual merged histories) with direct `Open Invoice` links to `/admin/payment-and-bill?invoiceId=...`.

---

## 9. Printable A4 Invoice & Payment Receipt

- `InvoicePrintable.jsx` and `PaymentReceipt.jsx` render crisp editorial Neo-Brutalist sheets into an isolated `#studio-print-portal` controlled by `@media print` in `src/styles/index.css`.
- Browser Print / Save as PDF hides Admin Sidebar, Topbar, backdrops, and dialog buttons, sets `@page { size: A4 portrait; margin: 12mm; }`, and avoids breaking Financial Summary across pages.
- Never displays fabricated legal addresses, NPWP/Tax IDs, bank account numbers, or internal staff fees.
- Provides plain-text `Copy Invoice Summary` and `Copy Receipt Summary` for manual WhatsApp sharing.

---

## 10. Payment Evidence Review & Optional Admin Attachments (v1)

- **3rd Workspace Tab (`Payment Evidence`, `?tab=evidence`):** Displays pending review count badge, prioritizes `pending_review` submissions with filters (`pending_review`, `verified`, `rejected`, `attached`, `all`) and search, and opens `PaymentEvidenceReviewDrawer` with validated Cloudinary image preview, editable `verifiedAmount` (<= live `balanceDue`), deliberate verification confirmation (`verifyClientPaymentEvidence`), and rejection with mandatory reason (`rejectClientPaymentEvidence`).
- **Policy Enforcement:** Invoices with `clientPaymentEvidenceRequired === true` cannot be paid via generic manual `recordInvoicePayment()` (`payment/client-evidence-required`) or via initial DP/Paid during Client Portal request conversion (`booking/client-evidence-required`); both UI (`InvoiceDirectoryTable`, `InvoiceDetailDrawer`, `BookingFormDialog`) and `firestore.rules` enforce verified evidence.
- **Optional Admin Attachments:** `RecordPaymentDialog` and Admin-managed `BookingFormDialog` create flows (when initial payment > 0) include an optional Cloudinary image upload field (`admin_manual`, `status: 'attached'`) without ever requiring an image for cash or manual studio payments.
- **Shared Transactional Payment Core:** `applyValidatedPaymentInTransaction()` in `payment-service.js` is shared between `recordInvoicePayment()` and `verifyClientPaymentEvidence()`.

---

## 11. Firestore Security Rules (`firestore.rules`)

Verified live on the Firebase Firestore Emulator (`scripts/test-firestore-rules.mjs`):

- `invoices/{invoiceId}`: active Owner/Staff read/create/controlled-update (plus scoped Client read on `issued`/`void`); permanent delete denied except Factory Reset; immutable snapshot, `invoiceNumber`, and `clientPaymentEvidenceRequired` locked; `clientPaymentEvidenceRequired == true` requires `amountPaid == 0` on create; aggregate `amountPaid`/`balanceDue` verified via `getAfter()` against the transaction created in the same atomic commit; void requires `amountPaid == 0` and `voidReason.size() >= 3`.
- `paymentTransactions/{transactionId}`: active Owner/Staff read/create (plus scoped Client read on parent `issued`/`void` invoice); update & delete strictly denied except Factory Reset; positive integer IDR amount; enum method; `recordedByUid == request.auth.uid`; enforces `source == 'client_evidence_verified'` with matching `getAfter()` verified `paymentEvidence/{evidenceId}` for `clientPaymentEvidenceRequired == true` invoices; reversals strictly enforce deterministic `pay_rev_{originalTxId}` and matching original payment via `get()`.
- `paymentEvidence/{evidenceId}`: active Client create (`pending_review` only for own eligible invoice) & scoped read; active Staff/Owner read, atomic verify/reject transitions, and `admin_manual` `attached` creation linked to valid transactions; delete strictly limited to Factory Reset (`21` operational deletion targets).

---

## 12. Known Limitations

- Updated `firestore.rules` has been verified locally on the Firestore Emulator and NOT deployed to production Firebase (`studio37classic`) per no-deployment rules.
- Uploaded Cloudinary payment evidence uses public delivery URLs (mitigated with a dedicated unsigned preset `37payment-evidence`, randomized `pe_*` filenames, 5 MB / JPG-PNG-WEBP caps, and UI privacy notices; see [CLOUDINARY-PAYMENT-EVIDENCE-SETUP.md](../setup/CLOUDINARY-PAYMENT-EVIDENCE-SETUP.md)).
- Online payment gateways, automated QRIS settlement, tax/PPN calculation, public unauthenticated invoice links, automated WhatsApp sending, Firebase Storage / private signed asset delivery, physical refund settlements, and multi-booking consolidated invoices remain outside scope.
