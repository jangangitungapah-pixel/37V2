# CLIENT PORTAL PHASE 4 — CLIENT BILLING & PAYMENTS ARCHITECTURE

## 37 Music Studio — Customer Billing Workspace (`/portal/invoices`)

**Primary Route:** `/portal/invoices`  
**Firestore Collections Read:** `invoices`, `paymentTransactions`, `publicSiteSettings`  
**Ownership Identity Collections:** `clientAccounts`, `clientCustomerLinks`, `clientProfiles`  
**Core Principle:** *One Source of Data, Two User Experiences* — Staff/Owner manage invoices and record append-only payments in Admin Portal; authenticated Clients inspect their own billing statements, balances, and verified payment history in real time inside Client Portal.

---

## 1. Data Contracts & Customer-Safe Projections

Client Portal Phase 4 consumes the canonical Phase 8 Admin Payment & Bill collections without introducing duplicate billing schemas or client-side write paths.

### A. Canonical `invoices/{invoiceId}` -> Client Projection (`projectClientInvoiceRecord`)

Normalized via `normalizeInvoiceRecord()` (`src/features/admin/payment/schemas/payment-schema.js`) and projected through an explicit customer-safe allow-list (`src/features/client-portal/billing/utils/client-billing-utils.js`):

- **Allowed Fields:**
  - `id` (`inv_{bookingId}`), `invoiceNumber` (`37MS-YYYYMMDD-XXXXXXXXXXXX`), `bookingId`, `invoiceStatus` (`issued` | `void`), `currency` (`IDR`).
  - `customerSnapshot`: `{ name, phone, bandName }`.
  - `bookingSnapshot`: `{ serviceTypeName, serviceOptionName, studioId, bookingDate, startMinute, endMinute, durationMinutes }`.
  - `financialSnapshot`: `{ subtotal, discountAmount, totalAmount }` (integer IDR).
  - `amountPaid`, `balanceDue`, `paymentStatus` (`unpaid` | `partial` | `paid`), `invoiceDate`, `dueDate`, `createdAt`, `updatedAt`.
- **Explicitly Stripped Fields:**
  - `customerId`, `createdByUid`, `updatedByUid`, `lastPaymentTransactionId`, `voidReason`, and any internal commission/fee structures (`booking.commissionSnapshot` is never stored on or read for client invoices).

### B. Canonical `paymentTransactions/{transactionId}` -> Client Projection (`projectClientPaymentTransactions`)

Normalized via `normalizePaymentTransactionRecord()` and projected through a strict privacy allow-list:

- **Allowed Fields:**
  - `id` (React key only), `invoiceId`, `invoiceNumber`.
  - `transactionType` (`payment` | `reversal`) mapped to `transactionTypeLabel` (`Payment Received` | `Payment Correction`).
  - `amount` (integer IDR), `currency` (`IDR`).
  - `paymentMethod` (`cash` | `transfer` | `qris` | `other`) mapped to `paymentMethodLabel` (`Cash` | `Bank Transfer` | `QRIS` | `Other`).
  - `receivedAt`, `referenceNumber`, and computed `isReversed` flag.
- **Explicitly Stripped Fields:**
  - `recordedByUid`, `customerId`, `notes` (internal staff notes & reversal audit reasons), `source`, and raw `reversalOfTransactionId`.

---

## 2. Ownership Resolution

Customer identity is resolved **exclusively** from the authenticated Client session (`AuthContext` in Client UI, and `request.auth.uid` in `firestore.rules`) — never from URL parameters, query strings, props, or user inputs.

In `firestore.rules`, helper `isClientOwnerOfCustomer(customerId)` enforces all Phase 1 ownership invariants:

1. `isActiveClient()` is `true` (`request.auth != null`, non-staff UID, verified Google email, `clientAccounts/{uid}` exists with `role == 'client'`, `status == 'active'`, and non-empty `customerId`).
2. `clientAccounts/{request.auth.uid}.data.customerId == customerId`.
3. `exists(/databases/$(database)/documents/clientCustomerLinks/$(customerId))`.
4. `get(/databases/$(database)/documents/clientCustomerLinks/$(customerId)).data.ownerUid == request.auth.uid`.

---

## 3. Client Read Permissions (`firestore.rules`)

All `create`, `update`, and `delete` rules on `invoices` and `paymentTransactions` remain strictly locked to active Staff/Owner (and Factory Reset maintenance rules). Client Portal has **read-only** access:

- **`match /invoices/{invoiceId}`:**
  - `allow get`: `isActiveStaff()` OR (`resource != null && resource.data.invoiceStatus in ['issued', 'void'] && isClientOwnerOfCustomer(resource.data.customerId)`).
  - `allow list`: `isActiveStaff()` OR (`resource.data.invoiceStatus in ['issued', 'void'] && isClientOwnerOfCustomer(resource.data.customerId)`).
- **`match /paymentTransactions/{transactionId}`:**
  - `allow get` & `allow list`: `isActiveStaff()` OR (`isClientOwnerOfCustomer(resource.data.customerId) && isClientReadableParentInvoice(resource.data.invoiceId, resource.data.customerId)`), where `isClientReadableParentInvoice` verifies the parent `invoices/{invoiceId}` exists, belongs to the same `customerId`, and has `invoiceStatus in ['issued', 'void']`.

---

## 4. Query Strategy & Zero Custom Composite Indexes

Firestore Security Rules are not filters; every Client query is shaped so Firestore's query analyzer statically proves ownership and visibility while using built-in single-field index zigzag merges (**zero new composite indexes** in `firestore.indexes.json`):

1. **Customer Invoice Directory (`subscribeClientInvoices`):**
   - `where('customerId', '==', customerId)`
   - `where('invoiceStatus', 'in', ['issued', 'void'])`
   - `limit(maxLimit + 1)` (default `100`, step `+100` via `Load More Invoices`)
   - Sorted newest-first in memory (`sortClientInvoices`) across Firestore `Timestamp`, `Date`, `{ seconds }`, and ISO strings.
   - Local search (`invoiceNumber`, `bookingId`, `serviceTypeName`, `serviceOptionName`) and status tabs filter the subscribed list in memory without per-keystroke Firestore reads.
2. **Invoice Payment History (`subscribeClientPaymentTransactions`):**
   - Opened on demand when `ClientInvoiceDetailDrawer` is active (avoiding N+1 per-invoice listeners on the directory page).
   - `where('customerId', '==', customerId)` + `where('invoiceId', '==', invoiceId)` + `limit(maxLimit + 1)` (default `200`).
   - Sorted newest-first in memory by `receivedAt || createdAt`.

---

## 5. Invoice Visibility & Summary Metric Formulas

| Internal State | Client Visibility | Client Status Label | Included in Financial KPIs? |
|---|---|---|---|
| `draft` | **Hidden & Denied (`403`)** | — | No |
| `issued` + `unpaid` | Visible | `Unpaid` | Yes |
| `issued` + `partial` | Visible | `Partial Payment` | Yes |
| `issued` + `paid` | Visible | `Paid` | Yes |
| `issued` + `overdue` (`dueDate < todayIso` WIB) | Visible | `Overdue` | Yes |
| `void` | Visible as history | `Cancelled` | Excluded from `Total Outstanding`, `Total Paid`, `Unpaid`, and `Overdue` |

Summary KPIs (`computeClientBillingMetrics`):
- **Total Outstanding:** `SUM(balanceDue)` for `invoiceStatus == 'issued'`
- **Total Paid:** `SUM(amountPaid)` for `invoiceStatus == 'issued'` (uses authoritative invoice aggregate so append-only reversals are never double-counted)
- **Unpaid Invoices:** `COUNT` where `invoiceStatus == 'issued' && balanceDue > 0`
- **Overdue Invoices:** `COUNT` where `invoiceStatus == 'issued' && getEffectivePaymentStatus(inv, todayIso) == 'overdue'` (`Asia/Jakarta`; invoices with `dueDate == null` are never overdue)

---

## 6. Transaction Visibility & Reversal Semantics

- `payment` renders as **Payment Received**; `reversal` renders as **Payment Correction**.
- When an original payment has a matching `reversal` (`reversalOfTransactionId`), the original entry displays a **Corrected** badge and line-through amount while the `Payment Correction` entry shows `- Rp ...`, keeping the audit trail transparent without double-counting `Total Paid`.
- Empty state renders `"No payment records yet"` when an invoice has zero recorded transactions.

---

## 7. Realtime Update Lifecycle & Session Isolation

- `useClientInvoices`, `useClientPaymentTransactions`, and `useClientInvoiceDetail` key their state by `uid:customerId:limit:nonce`.
- When Admin/Staff records a payment (`recordInvoicePayment`), records a reversal (`reversePaymentTransaction`), updates `dueDate`, or voids an invoice (`voidInvoice`), `onSnapshot` pushes the updated document immediately to Client Portal without a page reload.
- If the authenticated user signs out, switches Google accounts, or transitions to `suspended`, hook state immediately resets to empty in the same render cycle and unsubscribes active Firestore listeners.

---

## 8. UI Component Architecture & A4 Print Isolation

Located under `src/features/client-portal/billing/`:

- `pages/ClientInvoicesPage.jsx`: Coordinates live `useClientInvoices`, local filter/search state, public site settings (`usePublicSiteSettings`), and selected invoice drawer state.
- `components/ClientBillingOverview.jsx`: 4 Spatial Ambient `AdminMetricCard`s with inline loading skeletons, tabular IDR formatting, and retryable error banner.
- `components/ClientInvoiceList.jsx` & `ClientInvoiceCard.jsx`: Status tabs with live counts, search input, desktop right-aligned tabular ledger (`lg+`), mobile zero-overflow cards (`< lg`), and truncation `Load More Invoices` control.
- `components/ClientBillingEmptyState.jsx`: Dedicated zero-invoices, zero-filter-matches, and retryable error views.
- `components/ClientInvoiceDetailDrawer.jsx`: Accessible `@base-ui/react/dialog` Spatial Ambient drawer displaying Header, Payment Status Summary, `Contact Studio` WhatsApp CTA (`"Payment is recorded and verified by the studio team."` + dynamic `Halo 37 Music Studio, saya ingin konfirmasi pembayaran untuk invoice ...`), immutable Financial Breakdown, Booking Snapshot (`Asia/Jakarta`), Customer Snapshot, and `ClientPaymentTimeline`.
- `components/ClientInvoicePrintable.jsx`: Mounts customer-safe `ClientInvoiceDocumentSheet` and `ClientPaymentReceiptSheet` into `#studio-print-portal` with `body[data-studio-print-mode='true']` and `window.print()`, isolating clean A4 output while hiding Sidebar, Topbar, dialogs, backdrops, and `.no-print` buttons, without fabricating legal addresses, NPWP, bank accounts, or tax IDs.

---

## 9. Known Limitations & Scope Boundaries

- **Spark-Only Manual Verification:** By design, Phase 4 provides read-only billing visibility and WhatsApp confirmation links; online payment gateways, `Pay Now` checkout, automatic QRIS settlement, and payment proof file uploads are intentionally excluded.
- **Historical Unlinked Bookings:** Client billing visibility relies on the authenticated Client's linked `customerId` (`clientAccounts/{uid}.customerId`). Legacy bookings belonging to a separate unmerged phone-only customer record will only appear if linked to the same `customerId`.
- **Not Yet Deployed:** Updated `firestore.rules` and frontend bundle are verified locally and have **not** been committed or deployed to Firebase Hosting / Cloud Firestore per workflow rules.

---

## 10. Verification & Testing Coverage

- **Unit & Integration Suite (`src/features/client-portal/billing/client-billing.test.jsx`):** Covers invoice/transaction privacy allow-lists, integer Rupiah formatting, status & `Asia/Jakarta` overdue calculation, KPI aggregation, reversal display, timestamp sorting, local search/filtering, query constraint enforcement, missing `customerId` / suspended client guards, UID switch isolation, live realtime Admin payment/reversal updates, and `#studio-print-portal` printing.
- **Real Firestore Emulator Security Suite (`scripts/test-firestore-rules.mjs` — Section `2F`):** Verifies all invoice & paymentTransaction read/query/write scenarios across Owner, Active Staff, Active Client A, Active Client B, Suspended Client, and Anonymous users, plus full regression checks for Admin payment recording, reversals, invoice immutability, Client Booking rules, and Factory Reset.
