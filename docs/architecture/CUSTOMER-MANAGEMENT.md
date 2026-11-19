# Phase 7 Architecture — Customer Management (Phone-Based Identity & Booking History)

**Project:** 37 Music Studio  
**Repository:** `https://github.com/jangangitungapah-pixel/37V2`  
**Branch:** `main`  
**Audited Baseline HEAD:** `8cf4e6c7a5329f857b3a461580010857a45b444e`  
**Target Route:** `/admin/customer`  
**Firestore Collections:** `customers`, `customerPhoneIndex` (integrated with `bookings`)

---

## 1. Customer Identity Model ("Phone Number First, Customer Identity Aware")

Phase 7 decouples **Customer Identity** (`customerId`) from **Phone Number** (`phoneNormalized`):

- Every managed customer profile has an immutable unique ID (`cust_...`, generated via `crypto.randomUUID()` or deterministic legacy ID during backfill).
- Phone numbers are **never** used directly as `customers` document IDs.
- Customer names are **not** required to be unique; two distinct people with the same name on different phones remain separate profiles (displayed with an informational `Nama mirip, nomor berbeda` indicator).
- Multiple customer profiles are natively permitted to share the exact same canonical phone number (e.g., band manager, family member, or office admin).

---

## 2. Phone Normalization (`src/features/admin/customer/utils/phone-number.js`)

Single shared utility imported by both the Customer module and Calendar `booking-schema.js` (`normalizeCustomerPhone()` delegates directly to `normalizePhoneNumber()`):

- **Default Country:** Indonesia (`+62`).
- **Canonical Output:** E.164 format (`+<country><subscriber>`, 9–15 digits total; Indonesian `+62` requires 10–15 digits).
- All Indonesian input formats collapse to the identical canonical value:
  - `081234567890` → `+6281234567890`
  - `+6281234567890` → `+6281234567890`
  - `6281234567890` → `+6281234567890`
  - `+62 812-3456-7890` → `+6281234567890`
  - `(0812) 3456 7890` → `+6281234567890`
  - `006281234567890` → `+6281234567890`
- **International Preservation:** Explicit `+` or `00` non-Indonesian country codes (e.g., `+1 (415) 555-2671` → `+14155552671`, `0065 9123 4567` → `+6591234567`) are preserved without rewriting to `+62`.
- **Invalid Rejection:** Empty, alphabetic, or too-short strings return `''` and are never silently converted into customer records.
- **Legacy Compatibility:** Existing `bookings.phone` remains untouched as the display/original contact snapshot; new and backfilled bookings add `phoneNormalized`.

---

## 3. Phone Index (`customerPhoneIndex/{phoneHash}`)

Fast, privacy-safe phone lookup uses a dedicated index keyed by deterministic SHA-256 hash (`getPhoneNumberHash()` using Web Crypto `crypto.subtle.digest('SHA-256')` with an identical pure-JS FIPS 180-4 fallback `getPhoneNumberHashSync()`):

```js
// customerPhoneIndex/{sha256(phoneNormalized)}
{
  phoneNormalized: '+6281234567890',
  activeCustomerIds: ['cust_uuid_1', 'cust_uuid_2'],
  historicalCustomerIds: ['cust_old_or_merged'],
  version: 2,
  updatedAt: Timestamp,
  updatedByUid: '<staffOrOwnerUid>',
}
```

- Raw phone numbers are never used as Firestore document IDs.
- No customer names or booking details are duplicated inside `customerPhoneIndex`.
- `activeCustomerIds` vs `historicalCustomerIds` explicitly separates current owners from archived, merged, or previous-number owners (supporting **Recycled Phone Number** detection cleanly).

---

## 4. Shared Number Handling

- Default directory grouping on `/admin/customer` groups active customer profiles by `phoneNormalized` (`CustomerPhoneGroup`).
- Headline metrics clearly separate **Customer Profiles** vs **Unique Phone Numbers** vs **Duplicate / Shared Numbers**.
- Whenever 2+ active profiles share the same `phoneNormalized`:
  - The phone group displays a prominent `SHARED NUMBER • N PROFIL` dark header bar and explains that booking histories remain separate.
  - All profiles remain visible as distinct cards (never hidden).
  - An explicit `Merge History` CTA allows staff to merge them if they truly belong to the same person.
- During new Calendar booking creation on a shared number, `CustomerIdentityConflictDialog` renders all active candidate profiles as cards and never auto-picks by highest booking count.

---

## 5. Customer Profile (`customers/{customerId}`)

```js
{
  displayName: 'Arief Music',
  normalizedName: 'arief music',
  phoneDisplay: '+62 812-3456-7890',
  phoneNormalized: '+6281234567890',
  nameAliases: ['The Velvet Echo'],
  previousPhones: [
    { phoneDisplay: '+62 812-1111-1111', phoneNormalized: '+6281211111111', changedAt: Timestamp }
  ],
  status: 'active', // 'active' | 'archived' | 'merged'
  mergedIntoCustomerId: null,
  historyCustomerIds: ['cust_uuid_1'],
  bookingCount: 8,
  firstBookingDate: '2026-08-10',
  lastBookingDate: '2026-11-18',
  notes: '',
  createdAt: Timestamp,
  createdByUid: '<uid>',
  updatedAt: Timestamp,
  updatedByUid: '<uid>',
  version: 1,
}
```

- **Edit Display Name:** Previous `displayName` is appended to `nameAliases`; historical booking `customerName` snapshots remain untouched.
- **Update Phone Number (`updateCustomerPhone`):** Atomically verifies no active conflict on the target number (offering Merge or Cancel if occupied), appends old phone to `previousPhones`, moves `customerId` from `activeCustomerIds` to `historicalCustomerIds` on the old phone index, and activates it on the new phone index without mutating historical booking `phone` snapshots.
- **Archive / Reactivate (`setCustomerArchiveStatus`):** Soft-archives without deleting profiles or bookings; archived profiles are hidden from the default directory, never silently reused on new bookings, searchable under the `Archived` filter, and reactivatable at any time.

---

## 6. Merge History (Virtual History Merge)

`mergeCustomerProfiles()` runs in a single atomic Firestore transaction **without modifying a single historical booking document**:

1. Reads both `target` and `source` profiles; validates both are `active` (preventing chained merges on already-merged profiles), prevents self-merge and circular merge graphs, and requires matching `phoneNormalized` (unless explicitly resolving a cross-phone update conflict).
2. Combines `target.historyCustomerIds = unique([targetId, ...target.historyCustomerIds, sourceId, ...source.historyCustomerIds])`.
3. Combines `nameAliases` (including `source.displayName`), `previousPhones`, `bookingCount`, `firstBookingDate`, and `lastBookingDate`.
4. Marks `source.status = 'merged'` and `source.mergedIntoCustomerId = targetId`.
5. Updates `customerPhoneIndex` so `sourceId` moves from `activeCustomerIds` into `historicalCustomerIds`.
6. Every historical booking retains its original `customerId` and `customerName` snapshot; `CustomerDetailDrawer` stitches together the unified booking timeline across `target.historyCustomerIds`.

---

## 7. Keep Separate

When a phone number matches an existing active customer with a different name (`SINGLE_CONFLICT` or `MULTIPLE_MATCHES`), Staff/Owner can explicitly select **`Buat Profil Terpisah`**:

- Generates a new immutable `customerId`.
- Appends the new `customerId` to `customerPhoneIndex/{phoneHash}.activeCustomerIds` alongside existing active profiles.
- New bookings link exclusively to the new `customerId`; histories stay strictly separated until an explicit future Merge.

---

## 8. Booking Integration (`BookingFormDialog.jsx`)

Integrated seamlessly into **Step 1 — Customer** of the existing 4-step Calendar Booking Form without adding extra steps:

- Phone normalization and `customerPhoneIndex/{phoneHash}` lookup execute on phone blur (or before commit if not blurred), never on every keystroke.
- Lightweight name matching (`normalizeCustomerName`: NFKC + trim + collapse spaces + lowercase + spacing-variant check) handles `Arief Music` / `Ariefmusic` / `ARIEF MUSIC` as `EXACT_MATCH` (`CUSTOMER EXISTING` badge).
- Network/Firestore lookup failures display an explicit error alert with a `Coba Cek Lagi` retry button and block commit (never assuming the number is unregistered or creating duplicate profiles).
- Recycled numbers (`HISTORICAL_ONLY`) show a warning badge and create a new separate profile without auto-linking to the old owner.
- In Edit/Reschedule mode, `customerId` stays locked to the original customer profile, and Step 1 informs staff that changing phone in the Booking Form updates only the booking contact snapshot (primary phone changes happen on `/admin/customer`).

---

## 9. Atomic Customer + Booking Transaction (`createBooking()`)

Extended `calendar-booking-repository.js` and `calendar-booking-service.js` so new booking creation executes **all reads first, then all writes** in one atomic Firestore transaction:

1. **Reads:** `bookings/{bookingId}`, `bookingEvents/{eventId}`, `customerPhoneIndex/{phoneHash}`, all 30-min `bookingSlots/{slotId}`, and all candidate `customers/{id}` docs.
2. **Idempotency:** If `bookingId` + `eventId` already exist, returns immediately without double-incrementing `bookingCount` or duplicating aliases.
3. **Validation:** Checks slot conflicts first (so slot conflicts roll back with zero orphan customer profiles), checks `expectedPhoneIndexVersion` (rejecting stale identity changes with `booking/stale-customer-identity`), and validates active status & matching `phoneNormalized`.
4. **Writes:** Creates/updates `customers/{customerId}`, updates `customerPhoneIndex/{phoneHash}`, creates `bookings/{bookingId}` (with `customerId` + `phoneNormalized`), creates `bookingSlots`, and appends `bookingEvents`.

---

## 10. Historical Booking Import (`customer-migration-service.js`)

Provides a safe, preview-first, resumable backfill flow (**Import Existing Booking History**) for bookings created prior to Phase 7:

- **Preview (`scanLegacyBookingsPreview`):** Uses bounded pagination (`orderBy('date', 'desc'), limit(200)`) with zero automatic writes on page load. Reports unlinked count, unique normalized phones, estimated profiles, same-phone/different-name count, invalid `Needs Review` records, and already-linked count.
- **Conservative Grouping:** Groups strictly by `(phoneNormalized + normalizedName)`. Same phone with different names creates separate profiles (never auto-merges legacy data).
- **Deterministic Resumable Batches (`importLegacyBookingHistory`):** Computes deterministic legacy IDs (`cust_leg_<sha256(phone|name)>`), skips already-linked bookings, commits in conservative chunks (`<= 400` writes/batch), and updates **only** `customerId`, `phoneNormalized`, `updatedAt`, `updatedByUid`, `version` on legacy bookings.
- **`Needs Review` Resolution (`resolveNeedsReviewLegacyBooking`):** Invalid/missing legacy phone records are never discarded or guessed; staff can input a valid phone or link to an existing active customer profile.

---

## 11. Backward Compatibility

- Phase 5, Phase 5A, and Phase 6 V1/V2 bookings without `customerId` or `phoneNormalized` remain readable, editable, reschedulable, and cancellable without forced migration.
- Cancelling or marking No Show on a booking never deletes the Customer Profile and never decrements `bookingCount`; cancelled and no-show records remain visible in Customer Booking History.
- Financial snapshots (`unitRate`, `subtotal`, `discountAmount`, `totalAmount`, `automaticDiscount`, `commissionSnapshot`, `initialPaymentStatus`, `initialPaidAmount`, `paymentMethod`) are never touched by customer edits, phone changes, merges, or legacy backfill.

---

## 12. Firestore Security Rules (`firestore.rules`)

- **`customers/{customerId}`:** `isActiveStaff()` read/create/update; permanent `delete: if false`; strict 18-key exact schema enforcement (`isValidCustomerShape`), immutable `createdAt`/`createdByUid`, monotonic `version`, non-negative integer `bookingCount`, `customerId in historyCustomerIds`, self-merge denial, and merged-status immutability.
- **`customerPhoneIndex/{phoneHash}`:** `isActiveStaff()` `get`/create/update; `allow list: if false`; `allow delete: if false`; 6-key schema validation + `existsAfter()` verification for referenced active customer profile.
- **`bookings/{bookingId}`:**
  - `create`: requires valid `customerId`, `phoneNormalized`, and `getAfter()` verification that the linked customer exists, is `active`, and has matching `phoneNormalized`.
  - `update`: supports either (a) one-time legacy backfill linking (`isLegacyBookingCustomerLinkUpdate`, strictly limited via `affectedKeys()` to `customerId`, `phoneNormalized`, `updatedAt`, `updatedByUid`, `version` only when `resource.data.customerId` is empty) OR (b) standard booking update enforcing `customerId` immutability alongside all Phase 5/6 snapshot protections.

---

## 13. Customer History Queries

- `useCustomers()` subscribes with bounded `orderBy('updatedAt', 'desc'), limit(maxLimit)` (single-field index) and expandable pagination (`Muat Lebih Banyak Customer`).
- `useCustomerBookingHistory()` queries `bookings` across `customer.historyCustomerIds` chunked into groups of `<= 10` IDs (`where('customerId', 'in', chunk), limit(100)` — zero custom composite indexes required), merges & deduplicates by `booking.id`, sorts chronologically descending, extracts distinct `bandName` history, and paginates with `Load More`.
- Clicking any booking item opens the shared `BookingDetailDrawer` in read-only inspection mode without re-calculating historical prices.

---

## 14. Known Limitations

- **Firestore Rules Not Deployed:** Per Phase 7 scope (`no deployment`), updated `firestore.rules` was verified against the live Firebase Firestore Emulator (`21/21` checks passed) and has not been deployed to production project `studio37classic`.
- **No Aggregate Revenue / CRM Features:** Customer Management intentionally excludes lifetime spend totals, invoices, marketing automation, WhatsApp messaging, loyalty points, and customer self-service portals (reserved for dedicated modules such as Payment and Bill).
- **Band Name Search Scope on Directory:** Band-name search in the main directory inspects the latest bounded batch of bookings (`limit(200)`) to avoid unbounded full-collection scans on page load; complete band history for any individual customer is always loaded in `CustomerDetailDrawer`.
